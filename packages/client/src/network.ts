import { ClientMsg, ServerMsg } from '@trench-wars/shared';
import type { ShipInput, GameSnapshot } from '@trench-wars/shared';

export type ServerMessageHandler = {
  onWelcome: (data: { playerId: string; tick: number; mapName: string }) => void;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onPlayerJoin: (data: { playerId: string; name: string; shipType: number }) => void;
  onPlayerLeave: (data: { playerId: string }) => void;
  onDeath: (data: { killerId: string; killedId: string; weaponType: string }) => void;
  onSpawn: (data: { playerId: string; x: number; y: number }) => void;
  onPong: (data: { clientTime: number; serverTime: number }) => void;
};

export class NetworkClient {
  private ws: WebSocket | null = null;
  private handlers: ServerMessageHandler;
  private connected = false;

  constructor(handlers: ServerMessageHandler) {
    this.handlers = handlers;
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => this.handleMessage(event.data as string);
      this.ws.onclose = () => {
        this.connected = false;
      };
    });
  }

  sendJoin(name: string, shipType: number): void {
    this.send({ type: ClientMsg.JOIN, name, shipType });
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
