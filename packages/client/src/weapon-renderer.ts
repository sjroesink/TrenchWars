import { Graphics, Container } from 'pixi.js';
import type { GameSnapshot } from '@trench-wars/shared';
import type { Camera } from './camera';

interface Explosion {
  x: number; // world tile coords
  y: number;
  frame: number;
  maxFrames: number;
}

export class WeaponRenderer {
  private gfx: Graphics;
  private explosions: Explosion[] = [];

  constructor(parent: Container) {
    this.gfx = new Graphics();
    parent.addChild(this.gfx);
  }

  /** Render all projectiles and active explosions */
  render(
    projectiles: GameSnapshot['projectiles'],
    camera: Camera,
  ): void {
    this.gfx.clear();

    // Draw projectiles
    for (const proj of projectiles) {
      const screen = camera.worldToScreen(proj.x, proj.y);

      if (proj.type === 'bullet') {
        // Bullets: small yellow circle (radius 2px)
        this.gfx.circle(screen.x, screen.y, 2);
        this.gfx.fill({ color: 0xffff00 });
      } else {
        // Bombs: larger red circle (radius 4px)
        this.gfx.circle(screen.x, screen.y, 4);
        this.gfx.fill({ color: 0xff3333 });
      }
    }

    // Draw and update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      const screen = camera.worldToScreen(exp.x, exp.y);
      const progress = exp.frame / exp.maxFrames;
      const radius = 4 + progress * 24; // expand from 4px to 28px
      const alpha = 1 - progress; // fade out

      // Orange-red explosion circle
      this.gfx.circle(screen.x, screen.y, radius);
      this.gfx.fill({ color: 0xff6600, alpha });

      exp.frame++;
      if (exp.frame >= exp.maxFrames) {
        this.explosions.splice(i, 1);
      }
    }
  }

  /** Trigger an explosion effect at a world position */
  addExplosion(x: number, y: number): void {
    this.explosions.push({
      x,
      y,
      frame: 0,
      maxFrames: 10,
    });
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
