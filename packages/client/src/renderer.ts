import { Application, Graphics, Container } from 'pixi.js';
import type { ShipState, TileMap, GameSnapshot } from '@trench-wars/shared';
import { TILE_SIZE } from '@trench-wars/shared';
import type { Camera } from './camera';
import type { InterpolatedEntity } from './interpolation';
import { WeaponRenderer } from './weapon-renderer';
import { RemotePlayerRenderer } from './remote-player';

export class Renderer {
  readonly app: Application;
  private shipGraphics!: Graphics;
  private wallGraphics!: Graphics;
  private tilemapContainer!: Container;
  private mapData!: TileMap;
  private weaponRenderer!: WeaponRenderer;
  private remotePlayerRenderer!: RemotePlayerRenderer;

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

    // Remote players layer (behind projectiles and local ship)
    this.remotePlayerRenderer = new RemotePlayerRenderer(this.app.stage);

    // Weapon/projectile layer (above remote players, below local ship)
    this.weaponRenderer = new WeaponRenderer(this.app.stage);

    // Ship sprite: arrow pointing right = orientation 0 = east (on top)
    this.shipGraphics = new Graphics();
    this.shipGraphics.poly([-8, -6, 12, 0, -8, 6]);
    this.shipGraphics.fill({ color: 0x00ff88 });
    this.app.stage.addChild(this.shipGraphics);
  }

  /** Trigger an explosion effect at a world position */
  addExplosion(x: number, y: number): void {
    this.weaponRenderer.addExplosion(x, y);
  }

  render(
    state: ShipState,
    camera: Camera,
    remotePlayers?: Map<string, InterpolatedEntity>,
    projectiles?: GameSnapshot['projectiles'],
  ): void {
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

    // Remote players
    if (remotePlayers) {
      this.remotePlayerRenderer.render(remotePlayers, camera);
    }

    // Projectiles and explosions
    if (projectiles) {
      this.weaponRenderer.render(projectiles, camera);
    }

    // Ship sprite (local player -- rendered on top)
    const shipScreen = camera.worldToScreen(state.x, state.y);
    this.shipGraphics.x = shipScreen.x;
    this.shipGraphics.y = shipScreen.y;
    this.shipGraphics.rotation = state.orientation * Math.PI * 2;
  }
}
