import { WebSocketServer, WebSocket } from 'ws';
import type { TileMap, ShipInput, GameSnapshot } from '@trench-wars/shared';
import {
  TICK_RATE,
  TICK_DT,
  SNAPSHOT_RATE,
  RECONNECT_TIMEOUT,
  SHIP_CONFIGS,
  SHIP_WEAPONS,
  DEFAULT_BOUNCE_FACTOR,
  updateShipPhysics,
  applyWallCollision,
  ClientMsg,
  ServerMsg,
} from '@trench-wars/shared';
import { PlayerManager } from './player-manager';
import { WeaponManager } from './weapon-manager';

/** Nanoseconds per tick for the 100Hz fixed-timestep loop. */
const NS_PER_TICK = BigInt(Math.floor(1e9 / TICK_RATE));

/** Neutral input used when a player has no queued inputs. */
const NEUTRAL_INPUT: ShipInput = {
  left: false,
  right: false,
  thrust: false,
  afterburner: false,
};

interface QueuedInput {
  seq: number;
  data: ShipInput;
  fire: boolean;
  fireBomb: boolean;
}

export interface GameServerOptions {
  map: TileMap;
  port: number;
}

/**
 * Authoritative game server.
 * Runs a 100Hz fixed-timestep simulation loop with process.hrtime.bigint().
 * Accepts WebSocket connections, processes player inputs, runs shared physics,
 * simulates weapons, and broadcasts snapshots at 20Hz (every SNAPSHOT_RATE ticks).
 */
export class GameServer {
  private map: TileMap;
  private port: number;
  private tickCount = 0;
  private accumulator = 0n; // BigInt nanoseconds
  private lastTime = 0n;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private wss: WebSocketServer | null = null;

  readonly playerManager: PlayerManager;
  readonly weaponManager: WeaponManager;

  private clients = new Map<string, WebSocket>();
  private inputQueues = new Map<string, QueuedInput[]>();
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: GameServerOptions) {
    this.map = options.map;
    this.port = options.port;
    this.playerManager = new PlayerManager();
    this.weaponManager = new WeaponManager();
  }

  /**
   * Start the WebSocket server and game loop.
   */
  start(): void {
    this.wss = new WebSocketServer({ port: this.port });
    this.wss.on('connection', (ws) => this.onConnection(ws));

    this.lastTime = process.hrtime.bigint();
    this.loopTimer = setInterval(() => this.update(), 1);

    console.log(`TrenchWars server running on ws://localhost:${this.port}`);
  }

  /**
   * Stop the server and clean up.
   */
  stop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }

  /**
   * Accumulator-based fixed timestep update.
   * Called from setInterval(1ms). Runs tick() for each accumulated NS_PER_TICK.
   */
  private update(): void {
    const now = process.hrtime.bigint();
    this.accumulator += now - this.lastTime;
    this.lastTime = now;

    while (this.accumulator >= NS_PER_TICK) {
      this.tick();
      this.accumulator -= NS_PER_TICK;
    }
  }

  /**
   * Single simulation tick at 100Hz.
   * 1. Process player inputs (or neutral input)
   * 2. Update weapons (projectile simulation + hit detection)
   * 3. Check for respawns
   * 4. Broadcast snapshot every SNAPSHOT_RATE ticks
   */
  private tick(): void {
    const alivePlayers = this.playerManager.getAlivePlayers();

    // 1. Process inputs for alive players
    for (const player of alivePlayers) {
      const queue = this.inputQueues.get(player.id);
      const config = SHIP_CONFIGS[player.shipType];
      const weaponConfig = SHIP_WEAPONS[player.shipType];

      if (queue && queue.length > 0) {
        const input = queue.shift()!;
        updateShipPhysics(player.ship, input.data, config, TICK_DT);
        applyWallCollision(player.ship, TICK_DT, this.map, config.radius, DEFAULT_BOUNCE_FACTOR);
        player.lastProcessedSeq = input.seq;

        if (input.fire) {
          this.weaponManager.fireBullet(player, weaponConfig, this.tickCount);
        }
        if (input.fireBomb) {
          this.weaponManager.fireBomb(player, weaponConfig, this.tickCount);
        }
      } else {
        // No input queued: still run physics with neutral input for speed clamping
        updateShipPhysics(player.ship, NEUTRAL_INPUT, config, TICK_DT);
        applyWallCollision(player.ship, TICK_DT, this.map, config.radius, DEFAULT_BOUNCE_FACTOR);
      }
    }

    // 2. Update weapons (movement, collision, hit detection, damage)
    const kills = this.weaponManager.update(TICK_DT, this.tickCount, this.map, this.playerManager);

    // 3. Broadcast death events
    for (const kill of kills) {
      this.broadcast({
        type: ServerMsg.DEATH,
        killerId: kill.killerId,
        killedId: kill.killedId,
        weaponType: kill.weaponType,
      });
    }

    // 4. Check for respawns
    const allPlayers = this.playerManager.getAllPlayers();
    for (const player of allPlayers) {
      if (!player.alive && this.tickCount >= player.respawnTick) {
        if (this.playerManager.respawnPlayer(player.id, this.map, this.tickCount)) {
          this.broadcast({
            type: ServerMsg.SPAWN,
            playerId: player.id,
            x: player.ship.x,
            y: player.ship.y,
          });
        }
      }
    }

    // 5. Broadcast snapshot every SNAPSHOT_RATE ticks (20Hz)
    if (this.tickCount % SNAPSHOT_RATE === 0) {
      this.broadcastSnapshot();
    }

    this.tickCount++;
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
          case ClientMsg.JOIN:
            playerId = this.handleJoin(ws, msg.name, msg.shipType ?? 0);
            break;
          case ClientMsg.INPUT:
            if (playerId) this.handleInput(playerId, msg);
            break;
          case ClientMsg.SHIP_SELECT:
            if (playerId) this.handleShipSelect(playerId, msg.shipType);
            break;
          case ClientMsg.PING:
            this.send(ws, {
              type: ServerMsg.PONG,
              clientTime: msg.clientTime,
              serverTime: Date.now(),
            });
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      if (playerId) {
        this.onDisconnect(playerId);
      }
    });

    ws.on('error', () => {
      // Connection errors handled by close event
    });
  }

  /**
   * Handle JOIN message: create player, send WELCOME, broadcast PLAYER_JOIN.
   */
  private handleJoin(ws: WebSocket, name: string, shipType: number): string {
    const playerId = crypto.randomUUID();

    // Cancel pending disconnect timer if reconnecting
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    const player = this.playerManager.addPlayer(playerId, name, shipType);
    const spawnPos = this.playerManager.findSpawnPosition(this.map, SHIP_CONFIGS[shipType].radius);
    player.ship.x = spawnPos.x;
    player.ship.y = spawnPos.y;

    this.clients.set(playerId, ws);
    this.inputQueues.set(playerId, []);

    // Send WELCOME to the joining player
    this.send(ws, {
      type: ServerMsg.WELCOME,
      playerId,
      tick: this.tickCount,
      mapWidth: this.map.width,
      mapHeight: this.map.height,
    });

    // Broadcast PLAYER_JOIN to all other clients
    this.broadcast({
      type: ServerMsg.PLAYER_JOIN,
      playerId,
      name,
      shipType,
    });

    return playerId;
  }

  /**
   * Handle INPUT message: queue for processing in next tick.
   */
  private handleInput(playerId: string, msg: Record<string, unknown>): void {
    const queue = this.inputQueues.get(playerId);
    if (!queue) return;

    queue.push({
      seq: msg.seq as number,
      data: msg.input as ShipInput,
      fire: (msg.fire as boolean) ?? false,
      fireBomb: (msg.fireBomb as boolean) ?? false,
    });
  }

  /**
   * Handle SHIP_SELECT: update player's ship type.
   */
  private handleShipSelect(playerId: string, shipType: number): void {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) return;
    if (shipType < 0 || shipType >= SHIP_CONFIGS.length) return;
    player.shipType = shipType;
    player.ship.energy = SHIP_CONFIGS[shipType].energy;
  }

  /**
   * Handle player disconnect: broadcast PLAYER_LEAVE, schedule removal.
   */
  private onDisconnect(playerId: string): void {
    this.clients.delete(playerId);

    this.broadcast({
      type: ServerMsg.PLAYER_LEAVE,
      playerId,
    });

    // Schedule removal after RECONNECT_TIMEOUT (in ms, converting from ticks at 100Hz)
    const timeoutMs = (RECONNECT_TIMEOUT / TICK_RATE) * 1000;
    this.disconnectTimers.set(playerId, setTimeout(() => {
      this.playerManager.removePlayer(playerId);
      this.weaponManager.removePlayer(playerId);
      this.inputQueues.delete(playerId);
      this.disconnectTimers.delete(playerId);
    }, timeoutMs));
  }

  /**
   * Build and broadcast a GameSnapshot to all connected clients.
   */
  broadcastSnapshot(): void {
    const players = this.playerManager.getAllPlayers();
    const projectiles = this.weaponManager.getProjectiles();

    const snapshot: GameSnapshot = {
      tick: this.tickCount,
      players: players.map(p => ({
        id: p.id,
        x: p.ship.x,
        y: p.ship.y,
        vx: p.ship.vx,
        vy: p.ship.vy,
        orientation: p.ship.orientation,
        energy: p.ship.energy,
        shipType: p.shipType,
        alive: p.alive,
        lastProcessedSeq: p.lastProcessedSeq,
      })),
      projectiles: projectiles.map(pr => ({
        id: pr.id,
        type: pr.type,
        x: pr.x,
        y: pr.y,
        vx: pr.vx,
        vy: pr.vy,
        ownerId: pr.ownerId,
      })),
    };

    const msg = JSON.stringify({ type: ServerMsg.SNAPSHOT, ...snapshot });
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  /**
   * Broadcast a message to all connected clients.
   */
  private broadcast(msg: Record<string, unknown>): void {
    const data = JSON.stringify(msg);
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Send a message to a specific client.
   */
  private send(ws: WebSocket, msg: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Get the current tick count (useful for testing).
   */
  getTickCount(): number {
    return this.tickCount;
  }
}
