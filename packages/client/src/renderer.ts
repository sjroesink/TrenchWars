import { Application, Graphics, Container, RenderTexture } from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import type { ShipState, TileMap } from '@trench-wars/shared';
import { TILE_SIZE } from '@trench-wars/shared';
import type { Camera } from './camera';

/**
 * PixiJS rendering of ship sprite and tilemap.
 * Uses PixiJS v8 async init and @pixi/tilemap CompositeTilemap.
 */
export class Renderer {
  readonly app: Application;
  private shipGraphics!: Graphics;
  private tilemapContainer!: Container;
  private tilemap!: CompositeTilemap;
  private wallTexture!: RenderTexture;
  private mapData!: TileMap;

  constructor() {
    this.app = new Application();
  }

  /**
   * Initialize PixiJS application and create rendering objects.
   * Must be awaited before calling render().
   */
  async init(map: TileMap): Promise<void> {
    this.mapData = map;

    await this.app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      background: '#000011',
      resizeTo: window,
    });

    document.getElementById('game')!.appendChild(this.app.canvas);

    // Create wall tile texture using Graphics rendered to texture
    const wallGraphics = new Graphics();
    wallGraphics.rect(0, 0, TILE_SIZE, TILE_SIZE);
    wallGraphics.fill({ color: 0x334466 });
    this.wallTexture = RenderTexture.create({
      width: TILE_SIZE,
      height: TILE_SIZE,
    });
    this.app.renderer.render({
      container: wallGraphics,
      target: this.wallTexture,
    });
    wallGraphics.destroy();

    // Create tilemap container
    this.tilemapContainer = new Container();
    this.app.stage.addChild(this.tilemapContainer);

    // Create CompositeTilemap for wall rendering
    this.tilemap = new CompositeTilemap();
    this.tilemapContainer.addChild(this.tilemap);

    // Create ship sprite using Graphics (arrow pointing right = orientation 0 = east)
    this.shipGraphics = new Graphics();
    this.shipGraphics.poly([-8, -6, 12, 0, -8, 6]);
    this.shipGraphics.fill({ color: 0x00ff88 });
    this.app.stage.addChild(this.shipGraphics);
  }

  /**
   * Render the current game state: tilemap and ship.
   */
  render(state: ShipState, camera: Camera): void {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    // Calculate camera offset for tilemap positioning
    const offsetX = -camera.x * TILE_SIZE + screenW / 2;
    const offsetY = -camera.y * TILE_SIZE + screenH / 2;

    // Update tilemap: only render tiles visible in viewport
    this.tilemap.clear();

    const startTX = Math.max(0, Math.floor(camera.x - screenW / 2 / TILE_SIZE) - 1);
    const endTX = Math.min(
      this.mapData.width - 1,
      Math.ceil(camera.x + screenW / 2 / TILE_SIZE) + 1,
    );
    const startTY = Math.max(0, Math.floor(camera.y - screenH / 2 / TILE_SIZE) - 1);
    const endTY = Math.min(
      this.mapData.height - 1,
      Math.ceil(camera.y + screenH / 2 / TILE_SIZE) + 1,
    );

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        if (this.mapData.tiles[ty * this.mapData.width + tx] !== 0) {
          this.tilemap.tile(this.wallTexture, tx * TILE_SIZE, ty * TILE_SIZE);
        }
      }
    }

    // Position tilemap container using camera offset
    this.tilemapContainer.x = offsetX;
    this.tilemapContainer.y = offsetY;

    // Position and rotate ship sprite
    const shipScreen = camera.worldToScreen(state.x, state.y);
    this.shipGraphics.x = shipScreen.x;
    this.shipGraphics.y = shipScreen.y;
    this.shipGraphics.rotation = state.orientation * Math.PI * 2;
  }
}
