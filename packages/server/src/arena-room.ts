import type { TileMap, ShipInput, GameSnapshot, RoomInfo } from '@trench-wars/shared';
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
  encodeSnapshotPlayers,
  encodeSnapshotProjectiles,
  fitsInDatagram,
} from '@trench-wars/shared';
import type { ClientConnection } from './transport/client-connection';
import { PlayerManager } from './player-manager';
import { WeaponManager } from './weapon-manager';
import { LagCompensation } from './lag-compensation';
import type { GameMode } from './game-modes/game-mode';
import { FFAMode } from './game-modes/ffa-mode';

/** Nanoseconds per tick for the 100Hz fixed-timestep loop. */
const NS_PER_TICK = BigInt(Math.floor(1e9 / TICK_RATE));

/** Neutral input used when a player has no queued inputs. */
const NEUTRAL_INPUT: ShipInput = {
  left: false,
  right: false,
  thrust: false,
  reverse: false,
  afterburner: false,
  multifire: false,
};

interface QueuedInput {
  seq: number;
  data: ShipInput;
  fire: boolean;
  fireBomb: boolean;
  multifire: boolean;
}

export interface ArenaRoomOptions {
  id: string;
  name: string;
  map: TileMap;
  maxPlayers?: number;
  gameMode?: GameMode;
}

/**
 * Self-contained arena room with its own game loop, player manager,
 * weapon manager, and lag compensation. Each room runs independently.
 */
export class ArenaRoom {
  readonly id: string;
  readonly name: string;
  private map: TileMap;
  readonly maxPlayers: number;

  readonly playerManager: PlayerManager;
  readonly weaponManager: WeaponManager;
  readonly lagCompensation: LagCompensation;
  readonly gameMode: GameMode;

  private tickCount = 0;
  private accumulator = 0n;
  private lastTime = 0n;
  private loopTimer: ReturnType<typeof setInterval> | null = null;

  private clients = new Map<string, ClientConnection>();
  private inputQueues = new Map<string, QueuedInput[]>();
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: ArenaRoomOptions) {
    this.id = options.id;
    this.name = options.name;
    this.map = options.map;
    this.maxPlayers = options.maxPlayers ?? 20;
    this.playerManager = new PlayerManager();
    this.lagCompensation = new LagCompensation();
    this.weaponManager = new WeaponManager(this.lagCompensation);
    this.gameMode = options.gameMode ?? new FFAMode(20);
  }

  /**
   * Start the room's game loop.
   */
  start(): void {
    this.lastTime = process.hrtime.bigint();
    this.loopTimer = setInterval(() => this.update(), 1);
  }

  /**
   * Stop the room's game loop and clean up timers.
   */
  stop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }

  /**
   * Get room info for listing.
   */
  getInfo(): RoomInfo {
    return {
      id: this.id,
      name: this.name,
      playerCount: this.playerManager.getConnectedPlayers().length,
      maxPlayers: this.maxPlayers,
      mode: this.gameMode.type,
    };
  }

  /**
   * Check if room has space for another player.
   */
  isFull(): boolean {
    return this.playerManager.getConnectedPlayers().length >= this.maxPlayers;
  }

  /**
   * Add a player to this room. Returns the PlayerState, or null if room is full.
   */
  addPlayer(playerId: string, name: string, shipType: number, conn: ClientConnection): import('@trench-wars/shared').PlayerState | null {
    if (this.isFull()) return null;

    const player = this.playerManager.addPlayer(playerId, name, shipType);
    const spawnPos = this.playerManager.findSpawnPosition(this.map, SHIP_CONFIGS[shipType].radius);
    player.ship.x = spawnPos.x;
    player.ship.y = spawnPos.y;

    this.gameMode.onPlayerJoin(playerId, name, shipType);
    this.clients.set(playerId, conn);
    this.inputQueues.set(playerId, []);

    return player;
  }

  /**
   * Restore a reconnecting player. Returns the PlayerState or null.
   */
  restorePlayer(sessionToken: string, conn: ClientConnection): import('@trench-wars/shared').PlayerState | null {
    const restored = this.playerManager.restorePlayer(sessionToken, this.tickCount);
    if (!restored) return null;

    const playerId = restored.id;

    // Cancel pending disconnect timer
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    this.clients.set(playerId, conn);
    if (!this.inputQueues.has(playerId)) {
      this.inputQueues.set(playerId, []);
    }

    this.gameMode.onPlayerJoin(playerId, restored.name, restored.shipType);
    return restored;
  }

  /**
   * Remove a player from this room (disconnect).
   */
  removePlayer(playerId: string): void {
    this.clients.delete(playerId);
    this.gameMode.onPlayerLeave(playerId);
    this.playerManager.holdPlayer(playerId, this.tickCount);

    this.broadcast({
      type: ServerMsg.PLAYER_LEAVE,
      playerId,
    });

    // Schedule full removal after RECONNECT_TIMEOUT
    const timeoutMs = (RECONNECT_TIMEOUT / TICK_RATE) * 1000;
    this.disconnectTimers.set(playerId, setTimeout(() => {
      this.playerManager.removePlayer(playerId);
      this.weaponManager.removePlayer(playerId);
      this.inputQueues.delete(playerId);
      this.disconnectTimers.delete(playerId);
    }, timeoutMs));
  }

  /**
   * Handle INPUT message for a player in this room.
   */
  handleInput(playerId: string, msg: Record<string, unknown>): void {
    const queue = this.inputQueues.get(playerId);
    if (!queue) return;

    queue.push({
      seq: msg.seq as number,
      data: msg.input as ShipInput,
      fire: (msg.fire as boolean) ?? false,
      fireBomb: (msg.fireBomb as boolean) ?? false,
      multifire: (msg.multifire as boolean) ?? false,
    });
  }

  /**
   * Handle SHIP_SELECT for a player in this room.
   */
  handleShipSelect(playerId: string, shipType: number): void {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) return;
    if (shipType < 0 || shipType >= SHIP_CONFIGS.length) return;
    player.shipType = shipType;
    player.ship.energy = SHIP_CONFIGS[shipType].energy;
  }

  /**
   * Handle CHAT message within this room.
   */
  handleChat(playerId: string, message: string): void {
    if (!message || typeof message !== 'string' || message.length === 0 || message.length > 200) {
      return;
    }

    const player = this.playerManager.getPlayer(playerId);
    if (!player) return;

    this.broadcast({
      type: ServerMsg.CHAT,
      playerId,
      name: player.name,
      message,
    });
  }

  /**
   * Get the current tick count.
   */
  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Get map dimensions (for WELCOME message).
   */
  getMapInfo(): { mapWidth: number; mapHeight: number } {
    return { mapWidth: this.map.width, mapHeight: this.map.height };
  }

  /**
   * Get current game mode state (for WELCOME and SCORE_UPDATE messages).
   */
  getGameState(): import('@trench-wars/shared').GameModeState {
    return this.gameMode.getState();
  }

  /**
   * Send a message to a specific client in this room.
   */
  send(conn: ClientConnection, msg: Record<string, unknown>): void {
    conn.sendReliable(JSON.stringify(msg));
  }

  /**
   * Broadcast a message to all connected clients in this room.
   */
  broadcast(msg: Record<string, unknown>): void {
    const data = JSON.stringify(msg);
    for (const conn of this.clients.values()) {
      conn.sendReliable(data);
    }
  }

  /**
   * Broadcast binary data unreliably to all connected clients.
   * Falls back to reliable if the transport doesn't support datagrams.
   */
  broadcastUnreliable(data: Uint8Array): void {
    for (const conn of this.clients.values()) {
      conn.sendUnreliable(data);
    }
  }

  // ---- Private: game loop ----

  private update(): void {
    const now = process.hrtime.bigint();
    this.accumulator += now - this.lastTime;
    this.lastTime = now;

    while (this.accumulator >= NS_PER_TICK) {
      this.tick();
      this.accumulator -= NS_PER_TICK;
    }
  }

  private tick(): void {
    const alivePlayers = this.playerManager.getAlivePlayers();

    // Record positions for lag compensation
    this.lagCompensation.record(
      this.tickCount,
      alivePlayers.map(p => ({
        id: p.id,
        x: p.ship.x,
        y: p.ship.y,
        radius: SHIP_CONFIGS[p.shipType].radius,
      })),
    );

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
        if (input.fireBomb && weaponConfig.hasBomb) {
          this.weaponManager.fireBomb(player, weaponConfig, this.tickCount);
        }
        if (input.multifire) {
          if (weaponConfig.multifireCount > 0) {
            this.weaponManager.fireMultifire(player, weaponConfig, this.tickCount);
          } else {
            // Ships without multifire (e.g. Warbird): Ctrl fires a bullet
            this.weaponManager.fireBullet(player, weaponConfig, this.tickCount);
          }
        }
      } else {
        updateShipPhysics(player.ship, NEUTRAL_INPUT, config, TICK_DT);
        applyWallCollision(player.ship, TICK_DT, this.map, config.radius, DEFAULT_BOUNCE_FACTOR);
      }
    }

    // 2. Update weapons
    const kills = this.weaponManager.update(TICK_DT, this.tickCount, this.map, this.playerManager);

    // 3. Broadcast death events and forward kills to game mode
    for (const kill of kills) {
      this.broadcast({
        type: ServerMsg.DEATH,
        killerId: kill.killerId,
        killedId: kill.killedId,
        weaponType: kill.weaponType,
      });

      const events = this.gameMode.onKill(kill.killerId, kill.killedId, kill.weaponType);
      for (const event of events) {
        this.broadcast({ type: ServerMsg.GAME_STATE, event: event.type, ...event.data });
      }
    }

    // 4. Check for respawns
    const allPlayers = this.playerManager.getAllPlayers();
    for (const player of allPlayers) {
      if (!player.alive && this.tickCount >= player.respawnTick) {
        if (this.gameMode.canRespawn(player.id)) {
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
    }

    // 5. Cleanup expired disconnected players
    if (this.tickCount % 100 === 0) {
      this.playerManager.cleanupDisconnected(this.tickCount);
    }

    // 6. Process game mode tick events
    const tickEvents = this.gameMode.onTick(this.tickCount);
    for (const event of tickEvents) {
      this.broadcast({ type: ServerMsg.GAME_STATE, event: event.type, ...event.data });
    }

    // 7. Broadcast snapshot every SNAPSHOT_RATE ticks (20Hz)
    if (this.tickCount % SNAPSHOT_RATE === 0) {
      this.broadcastSnapshot();
      this.broadcast({ type: ServerMsg.SCORE_UPDATE, state: this.gameMode.getState() });
    }

    this.tickCount++;
  }

  private broadcastSnapshot(): void {
    const players = this.playerManager.getAllPlayers();
    const projectiles = this.weaponManager.getProjectiles();

    const snapshotPlayers = players.map(p => ({
      id: p.id,
      name: p.name,
      x: p.ship.x,
      y: p.ship.y,
      vx: p.ship.vx,
      vy: p.ship.vy,
      orientation: p.ship.orientation,
      energy: p.ship.energy,
      shipType: p.shipType,
      alive: p.alive,
      kills: p.kills,
      deaths: p.deaths,
      lastProcessedSeq: p.lastProcessedSeq,
    }));

    const snapshotProjectiles = projectiles.map(pr => ({
      id: pr.id,
      type: pr.type,
      x: pr.x,
      y: pr.y,
      vx: pr.vx,
      vy: pr.vy,
      ownerId: pr.ownerId,
      rear: pr.rear,
    }));

    // Send snapshot as reliable JSON for now
    // TODO: use binary datagrams when server→client datagram support is stable
    this.broadcast({
      type: ServerMsg.SNAPSHOT,
      tick: this.tickCount,
      players: snapshotPlayers,
      projectiles: snapshotProjectiles,
    });
  }
}
