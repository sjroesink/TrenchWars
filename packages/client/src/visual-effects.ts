import { Graphics, Container } from 'pixi.js';
import type { Camera } from './camera';

interface ExhaustParticle {
  x: number;       // world tile coords
  y: number;
  vx: number;      // tiles per frame
  vy: number;
  life: number;    // current frame count
  maxLife: number;  // total frames before removal
  size: number;    // radius in pixels
}

interface ExplosionEffect {
  x: number;       // world tile coords
  y: number;
  frame: number;
  maxFrames: number;
  large: boolean;
}

/**
 * Manages engine exhaust particles and enhanced explosion effects.
 * Uses PixiJS Graphics for rendering layered circles that expand and fade.
 */
export class VisualEffects {
  private gfx: Graphics;
  private exhaustParticles: ExhaustParticle[] = [];
  private explosions: ExplosionEffect[] = [];

  constructor(parent: Container) {
    this.gfx = new Graphics();
    parent.addChild(this.gfx);
  }

  /**
   * Spawn an engine exhaust particle behind the ship.
   * @param shipX - Ship x position in tile coords
   * @param shipY - Ship y position in tile coords
   * @param orientation - Ship orientation (0-1, fraction of full rotation)
   */
  spawnExhaust(shipX: number, shipY: number, orientation: number): void {
    const angle = orientation * Math.PI * 2;
    // Opposite direction with slight random spread
    const spread = (Math.random() - 0.5) * 0.4; // +-0.2 radians
    const exhaustAngle = angle + Math.PI + spread;

    // Speed: 2-4 tiles/s at 60fps = 0.033-0.067 tiles/frame
    const speed = (2 + Math.random() * 2) / 60;

    this.exhaustParticles.push({
      x: shipX,
      y: shipY,
      vx: Math.cos(exhaustAngle) * speed,
      vy: Math.sin(exhaustAngle) * speed,
      life: 0,
      maxLife: 12 + Math.floor(Math.random() * 13), // 12-24 frames (200-400ms)
      size: 2 + Math.random() * 2, // 2-4px radius
    });
  }

  /**
   * Add an explosion effect at a world position.
   * @param x - World x in tile coords
   * @param y - World y in tile coords
   * @param large - True for bomb explosions (larger, longer)
   */
  addExplosion(x: number, y: number, large: boolean): void {
    this.explosions.push({
      x,
      y,
      frame: 0,
      maxFrames: large ? 30 : 18, // 500ms or 300ms at 60fps
      large,
    });
  }

  /** Render all active particles and explosions, updating their state. */
  render(camera: Camera): void {
    this.gfx.clear();

    // Render exhaust particles
    for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
      const p = this.exhaustParticles[i];
      const progress = p.life / p.maxLife;

      // Color: lerp from 0x00ff88 to 0x004422
      const r = Math.round(0x00 * (1 - progress) + 0x00 * progress);
      const g = Math.round(0xff * (1 - progress) + 0x44 * progress);
      const b = Math.round(0x88 * (1 - progress) + 0x22 * progress);
      const color = (r << 16) | (g << 8) | b;
      const alpha = 1.0 - progress;

      const screen = camera.worldToScreen(p.x, p.y);
      this.gfx.circle(screen.x, screen.y, p.size);
      this.gfx.fill({ color, alpha });

      // Update position and lifetime
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      if (p.life >= p.maxLife) {
        this.exhaustParticles.splice(i, 1);
      }
    }

    // Render explosions with layered circles
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      const progress = exp.frame / exp.maxFrames;
      const screen = camera.worldToScreen(exp.x, exp.y);

      const startRadius = exp.large ? 8 : 4;
      const endRadius = exp.large ? 32 : 16;
      const radius = startRadius + (endRadius - startRadius) * progress;

      // Inner circle (white core)
      this.gfx.circle(screen.x, screen.y, radius * 0.3);
      this.gfx.fill({ color: 0xffffff, alpha: (1 - progress) });

      // Outer circle (orange)
      this.gfx.circle(screen.x, screen.y, radius * 0.65);
      this.gfx.fill({ color: 0xffaa33, alpha: (1 - progress) * 0.7 });

      // Edge circle (deep orange)
      this.gfx.circle(screen.x, screen.y, radius);
      this.gfx.fill({ color: 0xff6600, alpha: (1 - progress) * 0.4 });

      exp.frame++;
      if (exp.frame >= exp.maxFrames) {
        this.explosions.splice(i, 1);
      }
    }
  }

  /** Clean up resources. */
  destroy(): void {
    this.gfx.destroy();
    this.exhaustParticles.length = 0;
    this.explosions.length = 0;
  }
}
