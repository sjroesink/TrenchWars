import { WebSocketServer, WebSocket } from 'ws';
import type { TileMap } from '@trench-wars/shared';
import {
  ClientMsg,
  ServerMsg,
} from '@trench-wars/shared';
import { RoomManager } from './room-manager';

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
    this.wss.on('connection', (ws) => this.onConnection(ws));
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
   * Handle a new WebSocket connection.
   */
  private onConnection(ws: WebSocket): void {
    let playerId: string | null = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case ClientMsg.ROOM_LIST:
            this.handleRoomList(ws);
            break;

          case ClientMsg.JOIN:
            playerId = this.handleJoin(
              ws,
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
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: ServerMsg.PONG,
                clientTime: msg.clientTime,
                serverTime: Date.now(),
              }));
            }
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      if (playerId) {
        this.roomManager.removePlayer(playerId);
        playerId = null;
      }
    });

    ws.on('error', () => {
      // Connection errors handled by close event
    });
  }

  /**
   * Send room list to a client.
   */
  private handleRoomList(ws: WebSocket): void {
    const rooms = this.roomManager.getRoomList();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: ServerMsg.ROOM_LIST,
        rooms,
      }));
    }
  }

  /**
   * Handle JOIN message: reconnect or create new player in specified (or auto) room.
   */
  private handleJoin(
    ws: WebSocket,
    name: string,
    shipType: number,
    roomId?: string,
    sessionToken?: string,
  ): string | null {
    // Attempt reconnection if session token provided
    if (sessionToken) {
      const result = this.roomManager.restorePlayer(sessionToken, ws);
      if (result) {
        const { room, player } = result;
        const mapInfo = room.getMapInfo();

        room.send(ws, {
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
      room = this.roomManager.assignPlayer(roomId, playerId, name, shipType, ws);
    } else {
      room = this.roomManager.autoAssignPlayer(playerId, name, shipType, ws);
    }

    if (!room) {
      // All rooms full — notify and close
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'All rooms are full' }));
        ws.close();
      }
      return null;
    }

    const player = room.playerManager.getPlayer(playerId);
    if (!player) return null;

    const mapInfo = room.getMapInfo();
    room.send(ws, {
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
