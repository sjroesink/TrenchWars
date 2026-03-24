import { ClientMsg, ServerMsg } from '@trench-wars/shared';
import {
  BinaryMsg,
  encodeInput,
  encodePing,
  decodePong,
  decodeSnapshotPlayers,
  decodeSnapshotProjectiles,
  readBinaryMsgType,
} from '@trench-wars/shared';
import type { ShipInput, GameSnapshot, RoomInfo } from '@trench-wars/shared';
import type { GameModeState } from '@trench-wars/shared';
import type { TransportAdapter } from './transport/transport-adapter';
import { WsAdapter } from './transport/ws-adapter';
import { WtAdapter } from './transport/wt-adapter';

export type ServerMessageHandler = {
  onWelcome: (data: { playerId: string; tick: number; mapName: string; sessionToken?: string; reconnected?: boolean }) => void;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onPlayerJoin: (data: { playerId: string; name: string; shipType: number }) => void;
  onPlayerLeave: (data: { playerId: string }) => void;
  onDeath: (data: { killerId: string; killedId: string; weaponType: string }) => void;
  onSpawn: (data: { playerId: string; x: number; y: number }) => void;
  onPong: (data: { clientTime: number; serverTime: number }) => void;
  onScoreUpdate?: (data: { state: GameModeState }) => void;
  onChat?: (data: { playerId: string; name: string; message: string }) => void;
  onGameState?: (data: { event: string; [key: string]: unknown }) => void;
  onRoomList?: (data: { rooms: RoomInfo[] }) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
};

export class NetworkClient {
  private transport: TransportAdapter | null = null;
  private handlers: ServerMessageHandler;
  private connected = false;
  private wsUrl = '';
  private wtUrl = '';
  private sessionToken: string | null = null;
  private playerName = '';
  private shipType = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnecting = false;
  private usingWebTransport = false;

  /** Partial snapshot state: players and projectiles arrive as separate datagrams. */
  private pendingSnapshotTick = -1;
  private pendingPlayers: GameSnapshot['players'] = [];
  private pendingProjectiles: GameSnapshot['projectiles'] = [];
  /** Player name cache (binary snapshots omit names). */
  private playerNames = new Map<string, string>();

  constructor(handlers: ServerMessageHandler) {
    this.handlers = handlers;
  }

  async connect(wsUrl: string, wtUrl?: string): Promise<void> {
    this.wsUrl = wsUrl;
    this.wtUrl = wtUrl || '';

    // Try WebTransport first if supported and URL provided
    if (this.wtUrl && typeof globalThis.WebTransport !== 'undefined') {
      try {
        const adapter = new WtAdapter();
        await adapter.connect(this.wtUrl);
        this.transport = adapter;
        this.usingWebTransport = true;
        this.setupHandlers();
        this.connected = true;
        console.log('Connected via WebTransport');
        return;
      } catch (err) {
        console.warn('WebTransport unavailable, falling back to WebSocket:', err);
      }
    }

    // WebSocket fallback
    const adapter = new WsAdapter();
    await adapter.connect(wsUrl);
    this.transport = adapter;
    this.usingWebTransport = false;
    this.setupHandlers();
    this.connected = true;
    console.log('Connected via WebSocket');
  }

  private setupHandlers(): void {
    if (!this.transport) return;

    this.transport.onMessage((data) => this.handleMessage(data));
    this.transport.onDatagram((data) => this.handleDatagram(data));
    this.transport.onClose(() => {
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected && this.sessionToken) {
        this.handlers.onDisconnect?.();
        this.attemptReconnect();
      }
    });
  }

  /** Store session token for reconnection (called when WELCOME is received). */
  setSessionToken(token: string): void {
    this.sessionToken = token;
  }

  /** Get the stored session token. */
  getSessionToken(): string | null {
    return this.sessionToken;
  }

  /** Whether the client is using WebTransport (true) or WebSocket (false). */
  isWebTransport(): boolean {
    return this.usingWebTransport;
  }

  requestRoomList(): void {
    this.sendReliable({ type: ClientMsg.ROOM_LIST });
  }

  sendJoin(name: string, shipType: number, sessionToken?: string, roomId?: string): void {
    this.playerName = name;
    this.shipType = shipType;
    const msg: Record<string, unknown> = { type: ClientMsg.JOIN, name, shipType };
    if (sessionToken) {
      msg.sessionToken = sessionToken;
    }
    if (roomId) {
      msg.roomId = roomId;
    }
    this.sendReliable(msg);
  }

  sendInput(seq: number, tick: number, input: ShipInput, fire: boolean, fireBomb: boolean, multifire: boolean): void {
    // Send as binary datagram (unreliable)
    const data = encodeInput({ seq, tick, input, fire, fireBomb, multifire });
    if (this.transport && this.connected) {
      this.transport.sendUnreliable(data);
    }
  }

  sendShipSelect(shipType: number): void {
    this.sendReliable({ type: ClientMsg.SHIP_SELECT, shipType });
  }

  sendPing(): void {
    // Send as binary datagram (unreliable)
    const data = encodePing(Date.now());
    if (this.transport && this.connected) {
      this.transport.sendUnreliable(data);
    }
  }

  sendChat(message: string): void {
    this.sendReliable({ type: ClientMsg.CHAT, message });
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
      this.connected = false;
    }
  }

  /**
   * Send a reconnect (JOIN with session token) to the server.
   */
  sendReconnect(sessionToken: string): void {
    this.sendReliable({ type: ClientMsg.JOIN, name: this.playerName, shipType: this.shipType, sessionToken });
  }

  /**
   * Attempt auto-reconnect after disconnect. Tries up to 3 times with 2 second delays.
   */
  private attemptReconnect(): void {
    if (this.reconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    this.reconnecting = true;
    this.reconnectAttempts++;

    setTimeout(async () => {
      if (!this.sessionToken || !this.wsUrl) {
        this.reconnecting = false;
        return;
      }

      try {
        // Try WebTransport first on reconnect too
        if (this.wtUrl && typeof globalThis.WebTransport !== 'undefined') {
          try {
            const adapter = new WtAdapter();
            await adapter.connect(this.wtUrl);
            this.transport = adapter;
            this.usingWebTransport = true;
            this.setupHandlers();
            this.connected = true;
            this.reconnecting = false;
            this.reconnectAttempts = 0;
            this.sendReconnect(this.sessionToken!);
            this.handlers.onReconnect?.();
            return;
          } catch {
            // Fall through to WebSocket
          }
        }

        // WebSocket fallback
        const adapter = new WsAdapter();
        await adapter.connect(this.wsUrl);
        this.transport = adapter;
        this.usingWebTransport = false;
        this.setupHandlers();
        this.connected = true;
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        this.sendReconnect(this.sessionToken!);
        this.handlers.onReconnect?.();
      } catch {
        this.reconnecting = false;
        this.attemptReconnect();
      }
    }, 2000);
  }

  private sendReliable(msg: object): void {
    if (this.transport && this.connected) {
      this.transport.sendReliable(JSON.stringify(msg));
    }
  }

  private handleMessage(data: string): void {
    const msg = JSON.parse(data);
    switch (msg.type) {
      case ServerMsg.WELCOME:
        this.handlers.onWelcome(msg);
        break;
      case ServerMsg.SNAPSHOT:
        // JSON fallback snapshot (when binary datagram was too large)
        this.handlers.onSnapshot(msg);
        break;
      case ServerMsg.PLAYER_JOIN:
        // Cache player name for binary snapshot reconstruction
        this.playerNames.set(msg.playerId, msg.name);
        this.handlers.onPlayerJoin(msg);
        break;
      case ServerMsg.PLAYER_LEAVE:
        this.playerNames.delete(msg.playerId);
        this.handlers.onPlayerLeave(msg);
        break;
      case ServerMsg.DEATH:
        this.handlers.onDeath(msg);
        break;
      case ServerMsg.SPAWN:
        this.handlers.onSpawn(msg);
        break;
      case ServerMsg.PONG:
        // JSON fallback PONG (from WebSocket reliable path)
        this.handlers.onPong(msg);
        break;
      case ServerMsg.SCORE_UPDATE:
        this.handlers.onScoreUpdate?.(msg);
        break;
      case ServerMsg.CHAT:
        this.handlers.onChat?.(msg);
        break;
      case ServerMsg.GAME_STATE:
        this.handlers.onGameState?.(msg);
        break;
      case ServerMsg.ROOM_LIST:
        this.handlers.onRoomList?.(msg);
        break;
    }
  }

  private _dgCount = 0;
  private handleDatagram(data: Uint8Array): void {
    if (this._dgCount++ < 5) console.log(`[WT] datagram received: type=0x${data[0].toString(16)}, len=${data.length}`);
    const msgType = readBinaryMsgType(data);
    switch (msgType) {
      case BinaryMsg.SNAPSHOT_PLAYERS: {
        const { tick, players } = decodeSnapshotPlayers(data);
        // Fill in cached names
        for (const p of players) {
          p.name = this.playerNames.get(p.id) || p.name;
        }
        this.mergeSnapshotPart(tick, players, null);
        break;
      }
      case BinaryMsg.SNAPSHOT_PROJECTILES: {
        const { tick, projectiles } = decodeSnapshotProjectiles(data);
        this.mergeSnapshotPart(tick, null, projectiles);
        break;
      }
      case BinaryMsg.PONG: {
        const pong = decodePong(data);
        this.handlers.onPong(pong);
        break;
      }
    }
  }

  /**
   * Merge split snapshot datagrams. Players and projectiles arrive separately.
   * Emit a full snapshot when both parts for the same tick have arrived,
   * or after the first part if the other never comes (lost datagram).
   */
  private pendingHasPlayers = false;
  private pendingHasProjectiles = false;

  private mergeSnapshotPart(
    tick: number,
    players: GameSnapshot['players'] | null,
    projectiles: GameSnapshot['projectiles'] | null,
  ): void {
    if (tick !== this.pendingSnapshotTick) {
      // New tick — flush any pending incomplete snapshot from previous tick
      if (this.pendingSnapshotTick >= 0 && this.pendingHasPlayers) {
        this.handlers.onSnapshot({
          tick: this.pendingSnapshotTick,
          players: this.pendingPlayers,
          projectiles: this.pendingProjectiles,
        });
      }
      this.pendingSnapshotTick = tick;
      this.pendingPlayers = [];
      this.pendingProjectiles = [];
      this.pendingHasPlayers = false;
      this.pendingHasProjectiles = false;
    }

    if (players !== null) {
      this.pendingPlayers = players;
      this.pendingHasPlayers = true;
    }
    if (projectiles !== null) {
      this.pendingProjectiles = projectiles;
      this.pendingHasProjectiles = true;
    }

    // If we have both parts, emit immediately
    if (this.pendingHasPlayers && this.pendingHasProjectiles) {
      if (this._dgCount < 10) console.log(`[WT] emit snapshot tick=${tick}, players=${this.pendingPlayers.length}, projectiles=${this.pendingProjectiles.length}`);
      this.handlers.onSnapshot({
        tick,
        players: this.pendingPlayers,
        projectiles: this.pendingProjectiles,
      });
      this.pendingSnapshotTick = -1;
      this.pendingHasPlayers = false;
      this.pendingHasProjectiles = false;
    }
  }
}
