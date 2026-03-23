import { Graphics, Container } from 'pixi.js';
import type { InterpolatedEntity } from './interpolation';
import type { Camera } from './camera';

/**
 * Renders remote players' ships using pooled Graphics objects.
 * Enemy ships are drawn as red triangles (0xFF4444) to distinguish
 * from the local player's green ship.
 */
export class RemotePlayerRenderer {
  readonly container: Container;
  private pool: Graphics[] = [];
  private activeCount = 0;

  constructor(parent: Container) {
    this.container = new Container();
    parent.addChild(this.container);
  }

  /** Render all remote players, pooling Graphics objects */
  render(
    remotePlayers: Map<string, InterpolatedEntity>,
    camera: Camera,
  ): void {
    let index = 0;

    for (const [, entity] of remotePlayers) {
      if (!entity.alive) continue;

      const gfx = this.getOrCreateGraphics(index);
      const screen = camera.worldToScreen(entity.x, entity.y);

      gfx.x = screen.x;
      gfx.y = screen.y;
      gfx.rotation = entity.orientation * Math.PI * 2;
      gfx.visible = true;

      index++;
    }

    // Hide unused pooled graphics
    this.activeCount = index;
    for (let i = index; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }
  }

  private getOrCreateGraphics(index: number): Graphics {
    if (index < this.pool.length) {
      return this.pool[index];
    }

    // Create new ship graphic -- red enemy triangle (same shape as local ship)
    const gfx = new Graphics();
    gfx.poly([-8, -6, 12, 0, -8, 6]);
    gfx.fill({ color: 0xff4444 });
    this.container.addChild(gfx);
    this.pool.push(gfx);
    return gfx;
  }

  destroy(): void {
    for (const gfx of this.pool) {
      gfx.destroy();
    }
    this.pool.length = 0;
    this.container.destroy();
  }
}
