import { WebSocketServer } from 'ws';
import type { TileMap } from '@trench-wars/shared';
import {
  ClientMsg,
  ServerMsg,
  decodeInput,
  decodePing,
  encodePong,
  readBinaryMsgType,
  BinaryMsg,
} from '@trench-wars/shared';
import { RoomManager } from './room-manager';
import type { ClientConnection } from './transport/client-connection';
import { WsConnection } from './transport/ws-connection';

export interface GameServerOptions {
  map: TileMap;
  port: number;
  httpServer?: import('http').Server;
}

/**
 * Thin WebSocket router. Accepts connections, parses messages,
 * and delegates game logic to ArenaRoom instances via RoomManager.
 */
export class GameServer {
  private map: TileMap;
  private port: number;
  private httpServer?: import('http').Server;
  private wss: WebSocketServer | null = null;
  readonly roomManager: RoomManager;

  constructor(options: GameServerOptions) {
    this.map = options.map;
    this.port = options.port;
    this.httpServer = options.httpServer;
    this.roomManager = new RoomManager(this.map);
  }

  /**
   * Start the WebSocket server and all room game loops.
   */
  start(): void {
    if (this.httpServer) {
      this.wss = new WebSocketServer({ server: this.httpServer });
      this.httpServer.listen(this.port);
    } else {
      this.wss = new WebSocketServer({ port: this.port });
    }
    this.wss.on('connection', (ws) => this.onWsConnection(ws));
    this.roomManager.startAll();

    // Log room info
    const rooms = this.roomManager.getRoomList();
    for (const room of rooms) {
      console.log(`  Room: ${room.name} (${room.mode}, max ${room.maxPlayers})`);
    }
  }

  /**
   * Stop the server and all rooms.
   */
  stop(): void {
    this.roomManager.stopAll();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  /**
   * Handle a new WebSocket connection by wrapping it in a ClientConnection.
   */
  private onWsConnection(ws: import('ws').WebSocket): void {
    this.handleConnection(new WsConnection(ws));
  }

  /**
   * Handle a new transport-agnostic connection.
   */
  handleConnection(conn: ClientConnection): void {
    let playerId: string | null = null;

    // Reliable (JSON) message handler
    conn.onMessage((data) => {
      try {
        const msg = JSON.parse(data);
        switch (msg.type) {
          case ClientMsg.ROOM_LIST:
            this.handleRoomList(conn);
            break;

          case ClientMsg.JOIN:
            playerId = this.handleJoin(
              conn,
              msg.name,
              msg.shipType ?? 0,
              msg.roomId as string | undefined,
              msg.sessionToken as string | undefined,
            );
            break;

          case ClientMsg.INPUT:
            if (playerId) {
              const room = this.roomManager.getPlayerRoom(playerId);
              if (room) room.handleInput(playerId, msg);
            }
            break;

          case ClientMsg.SHIP_SELECT:
            if (playerId) {
              const room = this.roomManager.getPlayerRoom(playerId);
              if (room) room.handleShipSelect(playerId, msg.shipType);
            }
            break;

          case ClientMsg.CHAT:
            if (playerId) {
              const room = this.roomManager.getPlayerRoom(playerId);
              if (room) room.handleChat(playerId, msg.message as string);
            }
            break;

          case ClientMsg.PING:
            conn.sendReliable(JSON.stringify({
              type: ServerMsg.PONG,
              clientTime: msg.clientTime,
              serverTime: Date.now(),
            }));
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // Unreliable (binary) datagram handler
    conn.onDatagram((data) => {
      try {
        const msgType = readBinaryMsgType(data);
        switch (msgType) {
          case BinaryMsg.INPUT: {
            if (playerId) {
              const input = decodeInput(data);
              const room = this.roomManager.getPlayerRoom(playerId);
              if (room) {
                room.handleInput(playerId, {
                  seq: input.seq,
                  tick: input.tick,
                  input: input.input,
                  fire: input.fire,
                  fireBomb: input.fireBomb,
                  multifire: input.multifire,
                });
              }
            }
            break;
          }
          case BinaryMsg.PING: {
            const ping = decodePing(data);
            conn.sendUnreliable(encodePong(ping.clientTime, Date.now()));
            break;
          }
        }
      } catch {
        // Ignore malformed datagrams
      }
    });

    conn.onClose(() => {
      if (playerId) {
        this.roomManager.removePlayer(playerId);
        playerId = null;
      }
    });

    conn.onError(() => {
      // Connection errors handled by close event
    });
  }

  /**
   * Send room list to a client.
   */
  private handleRoomList(conn: ClientConnection): void {
    const rooms = this.roomManager.getRoomList();
    conn.sendReliable(JSON.stringify({
      type: ServerMsg.ROOM_LIST,
      rooms,
    }));
  }

  /**
   * Handle JOIN message: reconnect or create new player in specified (or auto) room.
   */
  private handleJoin(
    conn: ClientConnection,
    name: string,
    shipType: number,
    roomId?: string,
    sessionToken?: string,
  ): string | null {
    // Attempt reconnection if session token provided
    if (sessionToken) {
      const result = this.roomManager.restorePlayer(sessionToken, conn);
      if (result) {
        const { room, player } = result;
        const mapInfo = room.getMapInfo();

        room.send(conn, {
          type: ServerMsg.WELCOME,
          playerId: player.id,
          tick: room.getTickCount(),
          mapWidth: mapInfo.mapWidth,
          mapHeight: mapInfo.mapHeight,
          sessionToken: player.sessionToken,
          reconnected: true,
          roomId: room.id,
          gameState: room.getGameState(),
        });

        room.broadcast({
          type: ServerMsg.PLAYER_JOIN,
          playerId: player.id,
          name: player.name,
          shipType: player.shipType,
        });

        return player.id;
      }
      // Token invalid — fall through to new player creation
    }

    const playerId = crypto.randomUUID();

    // Assign to specified room or auto-assign
    let room;
    if (roomId) {
      room = this.roomManager.assignPlayer(roomId, playerId, name, shipType, conn);
    } else {
      room = this.roomManager.autoAssignPlayer(playerId, name, shipType, conn);
    }

    if (!room) {
      // All rooms full — notify and close
      conn.sendReliable(JSON.stringify({ type: 'error', message: 'All rooms are full' }));
      conn.close();
      return null;
    }

    const player = room.playerManager.getPlayer(playerId);
    if (!player) return null;

    const mapInfo = room.getMapInfo();
    room.send(conn, {
      type: ServerMsg.WELCOME,
      playerId,
      tick: room.getTickCount(),
      mapWidth: mapInfo.mapWidth,
      mapHeight: mapInfo.mapHeight,
      sessionToken: player.sessionToken,
      roomId: room.id,
      gameState: room.getGameState(),
    });

    room.broadcast({
      type: ServerMsg.PLAYER_JOIN,
      playerId,
      name,
      shipType,
    });

    return playerId;
  }
}
