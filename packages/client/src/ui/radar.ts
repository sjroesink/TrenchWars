import { Container, Graphics } from 'pixi.js';
import type { InterpolatedEntity } from '../interpolation';

/**
 * PixiJS-based minimap showing player positions as colored dots.
 * Positioned at bottom-right of the screen, 160x160px.
 */
export class Radar {
  private container: Container;
  private background: Graphics;
  private dots: Graphics;
  private scale: number;

  /** Minimap dimensions in pixels */
  private static readonly SIZE = 160;
  /** Inset from screen edge */
  private static readonly MARGIN = 16;

  constructor(parent: Container, mapSize: number) {
    this.scale = Radar.SIZE / mapSize;

    this.container = new Container();

    // Background fill
    this.background = new Graphics();
    this.background.rect(0, 0, Radar.SIZE, Radar.SIZE);
    this.background.fill({ color: 0x000011, alpha: 0.7 });
    this.background.rect(0, 0, Radar.SIZE, Radar.SIZE);
    this.background.stroke({ color: 0xffffff, alpha: 0.2, width: 1 });
    this.container.addChild(this.background);

    // Dots layer (cleared and redrawn each frame)
    this.dots = new Graphics();
    this.container.addChild(this.dots);

    parent.addChild(this.container);
  }

  /** Reposition the radar container when screen resizes */
  updatePosition(screenWidth: number, screenHeight: number): void {
    this.container.x = screenWidth - Radar.SIZE - Radar.MARGIN;
    this.container.y = screenHeight - Radar.SIZE - Radar.MARGIN;
  }

  /**
   * Render player dots on the minimap.
   * Local player is green, remote players are white (FFA mode).
   */
  render(
    localPlayer: { x: number; y: number },
    remotePlayers: Map<string, InterpolatedEntity>,
    screenWidth: number,
    screenHeight: number,
  ): void {
    this.updatePosition(screenWidth, screenHeight);

    this.dots.clear();

    // Draw remote players first (underneath local dot)
    for (const [, entity] of remotePlayers) {
      if (!entity.alive) continue;
      const rx = entity.x * this.scale;
      const ry = entity.y * this.scale;
      this.dots.circle(rx, ry, 2);
      this.dots.fill({ color: 0xffffff });
    }

    // Draw local player on top
    const lx = localPlayer.x * this.scale;
    const ly = localPlayer.y * this.scale;
    this.dots.circle(lx, ly, 3);
    this.dots.fill({ color: 0x00ff88 });
  }

  destroy(): void {
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
  }
}
