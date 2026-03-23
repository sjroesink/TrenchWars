import type { ShipState, ShipConfig, TileMap, GameSnapshot } from '@trench-wars/shared';
import { TICK_DT, DEFAULT_BOUNCE_FACTOR, updateShipPhysics, applyWallCollision } from '@trench-wars/shared';
import type { InputManager } from './input';
import type { Camera } from './camera';
import type { Renderer } from './renderer';
import type { NetworkClient } from './network';
import type { PredictionManager } from './prediction';
import { InterpolationManager } from './interpolation';
import type { InterpolatedEntity } from './interpolation';
import type { HUD } from './ui/hud';

export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  orientation: number;
  energy: number;
  shipType: number;
  alive: boolean;
}

export interface GameLoopOptions {
  shipState: ShipState;
  shipConfig: ShipConfig;
  tileMap: TileMap;
  inputManager: InputManager;
  camera: Camera;
  renderer: Renderer;
  bounceFactor?: number;
  // Optional networking (when absent, runs local-only physics)
  network?: NetworkClient;
  prediction?: PredictionManager;
  playerId?: string;
  // Optional UI overlays
  hud?: HUD;
}

/**
 * Fixed-timestep accumulator at 100Hz with RAF rendering.
 * Physics runs at a fixed rate while rendering happens every animation frame.
 *
 * When network + prediction are provided:
 * - Each tick: poll input, record in prediction buffer, send to server, apply locally
 * - On server snapshot: reconcile by replaying unacknowledged inputs
 *
 * When network is absent: runs pure local physics (for testing).
 */
export class GameLoop {
  private shipState: ShipState;
  private shipConfig: ShipConfig;
  private tileMap: TileMap;
  private inputManager: InputManager;
  private camera: Camera;
  private renderer: Renderer;
  private bounceFactor: number;

  // Networking (optional)
  private network: NetworkClient | null;
  private prediction: PredictionManager | null;
  private playerId: string | null;
  private localTick = 0;

  // UI overlays (optional)
  private hud: HUD | null;

  // Player score tracking (updated from snapshots)
  kills = 0;
  deaths = 0;

  // Remote players from latest server snapshot
  private remotePlayers: Map<string, RemotePlayer> = new Map();

  // Interpolation for smooth remote entity rendering
  private interpolation = new InterpolationManager();

  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId = 0;

  /** Frames per second (smoothed) */
  fps = 0;
  private frameCount = 0;
  private fpsTimer = 0;

  constructor(options: GameLoopOptions) {
    this.shipState = options.shipState;
    this.shipConfig = options.shipConfig;
    this.tileMap = options.tileMap;
    this.inputManager = options.inputManager;
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.bounceFactor = options.bounceFactor ?? DEFAULT_BOUNCE_FACTOR;
    this.network = options.network ?? null;
    this.prediction = options.prediction ?? null;
    this.playerId = options.playerId ?? null;
    this.hud = options.hud ?? null;
  }

  /** Allow external mutation of bounce factor (debug panel). */
  setBounceFactor(value: number): void {
    this.bounceFactor = value;
  }

  /** Get remote players for rendering */
  getRemotePlayers(): Map<string, RemotePlayer> {
    return this.remotePlayers;
  }

  /**
   * Handle a server snapshot: reconcile local player, store remote players.
   */
  onSnapshot(snapshot: GameSnapshot): void {
    // Always feed snapshots to interpolation manager (even without prediction)
    this.interpolation.addSnapshot(snapshot);

    if (!this.prediction || !this.playerId) return;

    // Find local player in snapshot
    const localData = snapshot.players.find((p) => p.id === this.playerId);
    if (localData) {
      // Build server state from snapshot data
      const serverState: ShipState = {
        x: localData.x,
        y: localData.y,
        vx: localData.vx,
        vy: localData.vy,
        orientation: localData.orientation,
        energy: localData.energy,
      };

      // Reconcile: apply server state then replay unacknowledged inputs
      const reconciled = this.prediction.reconcile(
        serverState,
        localData.lastProcessedSeq,
        this.shipConfig,
        this.tileMap,
        this.bounceFactor,
      );

      // Update local state from reconciled result
      this.shipState.x = reconciled.x;
      this.shipState.y = reconciled.y;
      this.shipState.vx = reconciled.vx;
      this.shipState.vy = reconciled.vy;
      this.shipState.orientation = reconciled.orientation;
      this.shipState.energy = reconciled.energy;

      // Track kills/deaths for HUD
      this.kills = localData.kills;
      this.deaths = localData.deaths;
    }

    // Store remote players (everyone except local player)
    this.remotePlayers.clear();
    for (const p of snapshot.players) {
      if (p.id !== this.playerId) {
        this.remotePlayers.set(p.id, {
          id: p.id,
          x: p.x,
          y: p.y,
          vx: p.vx,
          vy: p.vy,
          orientation: p.orientation,
          energy: p.energy,
          shipType: p.shipType,
          alive: p.alive,
        });
      }
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.fpsTimer = this.lastTime;
    this.frameCount = 0;
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private loop(currentTime: number): void {
    if (!this.running) return;

    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;
    this.accumulator += frameTime;

    // FPS counter
    this.frameCount++;
    if (currentTime - this.fpsTimer >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = currentTime;
    }

    // Poll input once per frame
    const input = this.inputManager.poll();

    // Fixed timestep physics updates
    while (this.accumulator >= TICK_DT) {
      if (this.network && this.prediction) {
        // Networked mode: record, send, predict locally
        const weapons = this.inputManager.pollWeapons();
        const buffered = this.prediction.recordInput(
          input,
          this.localTick,
          weapons.fire,
          weapons.fireBomb,
        );
        this.network.sendInput(
          buffered.seq,
          buffered.tick,
          input,
          weapons.fire,
          weapons.fireBomb,
        );
      }

      // Apply physics locally (both networked prediction and local-only modes)
      updateShipPhysics(this.shipState, input, this.shipConfig, TICK_DT);
      applyWallCollision(
        this.shipState,
        TICK_DT,
        this.tileMap,
        this.shipConfig.radius,
        this.bounceFactor,
      );

      this.localTick++;
      this.accumulator -= TICK_DT;
    }

    // Update camera and render
    this.camera.update(
      this.shipState.x,
      this.shipState.y,
      this.tileMap.width,
      this.tileMap.height,
      this.renderer.app.screen.width,
      this.renderer.app.screen.height,
    );
    // Update HUD overlay
    if (this.hud) {
      this.hud.update(this.shipState.energy, this.shipConfig.energy, this.kills, this.deaths);
    }

    // Build interpolated remote player map for rendering
    let interpolatedRemotes: Map<string, InterpolatedEntity> | undefined;
    let projectiles: GameSnapshot['projectiles'] | undefined;

    if (this.playerId) {
      const remoteIds = this.interpolation.getRemotePlayerIds(this.playerId);
      if (remoteIds.length > 0) {
        interpolatedRemotes = new Map();
        for (const id of remoteIds) {
          const entity = this.interpolation.getInterpolatedPlayer(id);
          if (entity) {
            interpolatedRemotes.set(id, entity);
          }
        }
      }
      projectiles = this.interpolation.getProjectiles();
    }

    this.renderer.render(this.shipState, this.camera, interpolatedRemotes, projectiles);

    // Render radar minimap with player positions
    this.renderer.renderRadar(
      { x: this.shipState.x, y: this.shipState.y },
      interpolatedRemotes,
    );

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }
}
