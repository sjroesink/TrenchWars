import { ClientMsg, ServerMsg } from '@trench-wars/shared';
import type { ShipInput, GameSnapshot } from '@trench-wars/shared';

export type ServerMessageHandler = {
  onWelcome: (data: { playerId: string; tick: number; mapName: string; sessionToken?: string; reconnected?: boolean }) => void;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onPlayerJoin: (data: { playerId: string; name: string; shipType: number }) => void;
  onPlayerLeave: (data: { playerId: string }) => void;
  onDeath: (data: { killerId: string; killedId: string; weaponType: string }) => void;
  onSpawn: (data: { playerId: string; x: number; y: number }) => void;
  onPong: (data: { clientTime: number; serverTime: number }) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
};

export class NetworkClient {
  private ws: WebSocket | null = null;
  private handlers: ServerMessageHandler;
  private connected = false;
  private serverUrl = '';
  private sessionToken: string | null = null;
  private playerName = '';
  private shipType = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnecting = false;

  constructor(handlers: ServerMessageHandler) {
    this.handlers = handlers;
  }

  connect(url: string): Promise<void> {
    this.serverUrl = url;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => this.handleMessage(event.data as string);
      this.ws.onclose = () => {
        const wasConnected = this.connected;
        this.connected = false;
        if (wasConnected && this.sessionToken) {
          this.handlers.onDisconnect?.();
          this.attemptReconnect();
        }
      };
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

  sendJoin(name: string, shipType: number, sessionToken?: string): void {
    this.playerName = name;
    this.shipType = shipType;
    const msg: Record<string, unknown> = { type: ClientMsg.JOIN, name, shipType };
    if (sessionToken) {
      msg.sessionToken = sessionToken;
    }
    this.send(msg);
  }

  sendInput(seq: number, tick: number, input: ShipInput, fire: boolean, fireBomb: boolean): void {
    this.send({ type: ClientMsg.INPUT, seq, tick, input, fire, fireBomb });
  }

  sendShipSelect(shipType: number): void {
    this.send({ type: ClientMsg.SHIP_SELECT, shipType });
  }

  sendPing(): void {
    this.send({ type: ClientMsg.PING, clientTime: Date.now() });
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Send a reconnect (JOIN with session token) to the server.
   */
  sendReconnect(sessionToken: string): void {
    this.send({ type: ClientMsg.JOIN, name: this.playerName, shipType: this.shipType, sessionToken });
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

    setTimeout(() => {
      if (!this.sessionToken || !this.serverUrl) {
        this.reconnecting = false;
        return;
      }

      const ws = new WebSocket(this.serverUrl);
      ws.onopen = () => {
        this.ws = ws;
        this.connected = true;
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        ws.onmessage = (event) => this.handleMessage(event.data as string);
        ws.onclose = () => {
          const wasConnected = this.connected;
          this.connected = false;
          if (wasConnected && this.sessionToken) {
            this.handlers.onDisconnect?.();
            this.attemptReconnect();
          }
        };
        // Send JOIN with session token for reconnection
        this.sendReconnect(this.sessionToken!);
        this.handlers.onReconnect?.();
      };
      ws.onerror = () => {
        this.reconnecting = false;
        this.attemptReconnect();
      };
    }, 2000);
  }

  private send(msg: object): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(data: string): void {
    const msg = JSON.parse(data);
    switch (msg.type) {
      case ServerMsg.WELCOME:
        this.handlers.onWelcome(msg);
        break;
      case ServerMsg.SNAPSHOT:
        this.handlers.onSnapshot(msg);
        break;
      case ServerMsg.PLAYER_JOIN:
        this.handlers.onPlayerJoin(msg);
        break;
      case ServerMsg.PLAYER_LEAVE:
        this.handlers.onPlayerLeave(msg);
        break;
      case ServerMsg.DEATH:
        this.handlers.onDeath(msg);
        break;
      case ServerMsg.SPAWN:
        this.handlers.onSpawn(msg);
        break;
      case ServerMsg.PONG:
        this.handlers.onPong(msg);
        break;
    }
  }
}
