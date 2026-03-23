import { Application, Graphics, Container } from 'pixi.js';
import { GlowFilter } from 'pixi-filters/glow';
import { AdvancedBloomFilter } from 'pixi-filters/advanced-bloom';
import type { ShipState, TileMap, GameSnapshot } from '@trench-wars/shared';
import { TILE_SIZE } from '@trench-wars/shared';
import type { Camera } from './camera';
import type { InterpolatedEntity } from './interpolation';
import { WeaponRenderer } from './weapon-renderer';
import { RemotePlayerRenderer } from './remote-player';
import { VisualEffects } from './visual-effects';
import { Radar } from './ui/radar';

export class Renderer {
  readonly app: Application;
  private shipGraphics!: Graphics;
  private shipContainer!: Container;
  private wallGraphics!: Graphics;
  private tilemapContainer!: Container;
  private mapData!: TileMap;
  private weaponRenderer!: WeaponRenderer;
  private remotePlayerRenderer!: RemotePlayerRenderer;
  private visualEffects!: VisualEffects;
  private radar!: Radar;

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

    // Container for all wall tiles -- positioned by camera offset
    this.tilemapContainer = new Container();
    this.app.stage.addChild(this.tilemapContainer);

    // Single Graphics object for all visible wall tiles (redrawn each frame)
    this.wallGraphics = new Graphics();
    this.tilemapContainer.addChild(this.wallGraphics);

    // Remote players layer (behind projectiles and local ship)
    this.remotePlayerRenderer = new RemotePlayerRenderer(this.app.stage);

    // Apply glow filter to remote player container (red glow)
    const remoteGlow = new GlowFilter({
      distance: 10,
      outerStrength: 2,
      innerStrength: 0,
      color: 0xff4444,
      quality: 0.3,
    });
    this.remotePlayerRenderer.container.filters = [remoteGlow];

    // Weapon/projectile layer (above remote players, below local ship)
    this.weaponRenderer = new WeaponRenderer(this.app.stage);

    // Apply glow filter to weapon container (yellow glow for projectiles)
    const weaponGlow = new GlowFilter({
      distance: 8,
      outerStrength: 3,
      innerStrength: 0,
      color: 0xffff66,
      quality: 0.3,
    });
    this.weaponRenderer.container.filters = [weaponGlow];

    // Visual effects layer (exhaust particles and enhanced explosions)
    this.visualEffects = new VisualEffects(this.app.stage);

    // Ship sprite in its own container for glow filter
    this.shipContainer = new Container();
    this.shipGraphics = new Graphics();
    this.shipGraphics.poly([-8, -6, 12, 0, -8, 6]);
    this.shipGraphics.fill({ color: 0x00ff88 });
    this.shipContainer.addChild(this.shipGraphics);
    this.app.stage.addChild(this.shipContainer);

    // Apply glow filter to local ship container (green glow)
    const shipGlow = new GlowFilter({
      distance: 10,
      outerStrength: 2,
      innerStrength: 0,
      color: 0x00ff88,
      quality: 0.3,
    });
    this.shipContainer.filters = [shipGlow];

    // Radar minimap (last child so it renders on top of all game elements)
    this.radar = new Radar(this.app.stage, map.width, map);

    // Global bloom filter for neon aesthetic
    const bloom = new AdvancedBloomFilter({
      threshold: 0.4,
      bloomScale: 0.8,
      brightness: 1.1,
      blur: 4,
      quality: 4,
    });
    this.app.stage.filters = [bloom];
  }

  /** Trigger an enhanced explosion effect at a world position */
  addExplosion(x: number, y: number, large = false): void {
    this.visualEffects.addExplosion(x, y, large);
  }

  /** Spawn an engine exhaust particle behind the ship */
  spawnExhaust(shipX: number, shipY: number, orientation: number): void {
    this.visualEffects.spawnExhaust(shipX, shipY, orientation);
  }

  /** Render visual effects (exhaust particles, explosions) */
  renderEffects(camera: Camera): void {
    this.visualEffects.render(camera);
  }

  /** Render the radar minimap with player positions */
  renderRadar(
    localPlayer: { x: number; y: number },
    remotePlayers: Map<string, InterpolatedEntity> | undefined,
  ): void {
    this.radar.render(
      localPlayer,
      remotePlayers || new Map(),
      this.app.screen.width,
      this.app.screen.height,
    );
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

    // Visual effects (exhaust particles, enhanced explosions)
    this.visualEffects.render(camera);

    // Ship sprite (local player -- rendered on top)
    const shipScreen = camera.worldToScreen(state.x, state.y);
    this.shipContainer.x = shipScreen.x;
    this.shipContainer.y = shipScreen.y;
    this.shipGraphics.rotation = state.orientation * Math.PI * 2;
  }
}
