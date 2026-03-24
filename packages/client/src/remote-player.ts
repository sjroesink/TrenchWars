import { Sprite, Container } from 'pixi.js';
import type { InterpolatedEntity } from './interpolation';
import type { Camera } from './camera';
import type { ShipSpriteManager } from './sprites/ship-sprites';

/**
 * Renders remote players' ships using pooled Sprite objects.
 * Each sprite's texture is set per-frame via ShipSpriteManager
 * based on the entity's shipType and orientation.
 */
export class RemotePlayerRenderer {
  readonly container: Container;
  private pool: Sprite[] = [];
  private activeCount = 0;
  private shipSpriteManager: ShipSpriteManager;

  constructor(parent: Container, shipSpriteManager: ShipSpriteManager) {
    this.container = new Container();
    this.shipSpriteManager = shipSpriteManager;
    parent.addChild(this.container);
  }

  /** Render all remote players, pooling Sprite objects */
  render(
    remotePlayers: Map<string, InterpolatedEntity>,
    camera: Camera,
  ): void {
    let index = 0;

    for (const [, entity] of remotePlayers) {
      if (!entity.alive) continue;

      const sprite = this.getOrCreateSprite(index);
      const screen = camera.worldToScreen(entity.x, entity.y);

      sprite.x = screen.x;
      sprite.y = screen.y;
      sprite.texture = this.shipSpriteManager.getTexture(entity.shipType, entity.orientation);
      sprite.visible = true;

      index++;
    }

    // Hide unused pooled sprites
    this.activeCount = index;
    for (let i = index; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }
  }

  private getOrCreateSprite(index: number): Sprite {
    if (index < this.pool.length) {
      return this.pool[index];
    }

    const sprite = new Sprite();
    sprite.anchor.set(0.5, 0.5);
    this.container.addChild(sprite);
    this.pool.push(sprite);
    return sprite;
  }

  destroy(): void {
    for (const sprite of this.pool) {
      sprite.destroy();
    }
    this.pool.length = 0;
    this.container.destroy();
  }
}
