import { Application, Graphics, Container } from 'pixi.js';
import type { ShipState, TileMap } from '@trench-wars/shared';
import { TILE_SIZE } from '@trench-wars/shared';
import type { Camera } from './camera';

export class Renderer {
  readonly app: Application;
  private shipGraphics!: Graphics;
  private wallGraphics!: Graphics;
  private tilemapContainer!: Container;
  private mapData!: TileMap;

  constructor() {
    this.app = new Application();
  }

  async init(map: TileMap): Promise<void> {
    this.mapData = map;

    await this.app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      background: '#000011',
      resizeTo: window,
    });

    document.getElementById('game')!.appendChild(this.app.canvas);

    // Container for all wall tiles — positioned by camera offset
    this.tilemapContainer = new Container();
    this.app.stage.addChild(this.tilemapContainer);

    // Single Graphics object for all visible wall tiles (redrawn each frame)
    this.wallGraphics = new Graphics();
    this.tilemapContainer.addChild(this.wallGraphics);

    // Ship sprite: arrow pointing right = orientation 0 = east
    this.shipGraphics = new Graphics();
    this.shipGraphics.poly([-8, -6, 12, 0, -8, 6]);
    this.shipGraphics.fill({ color: 0x00ff88 });
    this.app.stage.addChild(this.shipGraphics);
  }

  render(state: ShipState, camera: Camera): void {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    const offsetX = -camera.x * TILE_SIZE + screenW / 2;
    const offsetY = -camera.y * TILE_SIZE + screenH / 2;

    // Redraw only visible wall tiles as rectangles in a single Graphics batch
    this.wallGraphics.clear();
    this.wallGraphics.fill({ color: 0x334466 });

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
          this.wallGraphics.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    this.wallGraphics.fill();

    this.tilemapContainer.x = offsetX;
    this.tilemapContainer.y = offsetY;

    // Ship sprite
    const shipScreen = camera.worldToScreen(state.x, state.y);
    this.shipGraphics.x = shipScreen.x;
    this.shipGraphics.y = shipScreen.y;
    this.shipGraphics.rotation = state.orientation * Math.PI * 2;
  }
}
