import type { ShipState, ShipConfig, TileMap } from '@trench-wars/shared';
import { TICK_DT, DEFAULT_BOUNCE_FACTOR, updateShipPhysics, applyWallCollision } from '@trench-wars/shared';
import type { InputManager } from './input';
import type { Camera } from './camera';
import type { Renderer } from './renderer';

export interface GameLoopOptions {
  shipState: ShipState;
  shipConfig: ShipConfig;
  tileMap: TileMap;
  inputManager: InputManager;
  camera: Camera;
  renderer: Renderer;
  bounceFactor?: number;
}

/**
 * Fixed-timestep accumulator at 100Hz with RAF rendering.
 * Physics runs at a fixed rate while rendering happens every animation frame.
 */
export class GameLoop {
  private shipState: ShipState;
  private shipConfig: ShipConfig;
  private tileMap: TileMap;
  private inputManager: InputManager;
  private camera: Camera;
  private renderer: Renderer;
  private bounceFactor: number;

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
  }

  /** Allow external mutation of bounce factor (debug panel). */
  setBounceFactor(value: number): void {
    this.bounceFactor = value;
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
      updateShipPhysics(this.shipState, input, this.shipConfig, TICK_DT);
      applyWallCollision(
        this.shipState,
        TICK_DT,
        this.tileMap,
        this.shipConfig.radius,
        this.bounceFactor,
      );
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
    this.renderer.render(this.shipState, this.camera);

    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }
}
