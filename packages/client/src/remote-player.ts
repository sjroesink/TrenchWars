import { Sprite, Container, Text, TextStyle } from 'pixi.js';
import type { InterpolatedEntity } from './interpolation';
import type { Camera } from './camera';
import type { ShipSpriteManager } from './sprites/ship-sprites';

interface PoolEntry {
  sprite: Sprite;
  label: Text;
}

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 10,
  fill: 0xff4444,
  align: 'center',
});

/**
 * Renders remote players' ships with name labels.
 */
export class RemotePlayerRenderer {
  readonly container: Container;
  private pool: PoolEntry[] = [];
  private shipSpriteManager: ShipSpriteManager;

  constructor(parent: Container, shipSpriteManager: ShipSpriteManager) {
    this.container = new Container();
    this.shipSpriteManager = shipSpriteManager;
    parent.addChild(this.container);
  }

  /** Render all remote players with name labels */
  render(
    remotePlayers: Map<string, InterpolatedEntity>,
    camera: Camera,
    playerNames?: Map<string, string>,
  ): void {
    let index = 0;

    for (const [id, entity] of remotePlayers) {
      if (!entity.alive) continue;

      const entry = this.getOrCreate(index);
      const screen = camera.worldToScreen(entity.x, entity.y);

      entry.sprite.x = screen.x;
      entry.sprite.y = screen.y;
      entry.sprite.texture = this.shipSpriteManager.getTexture(entity.shipType);
      entry.sprite.rotation = (entity.orientation + 0.25) * Math.PI * 2;
      entry.sprite.visible = true;

      // Name label above ship
      const name = playerNames?.get(id) || id.slice(0, 6);
      entry.label.text = name;
      entry.label.x = screen.x;
      entry.label.y = screen.y - 24;
      entry.label.anchor.set(0.5, 1);
      entry.label.visible = true;

      index++;
    }

    // Hide unused
    for (let i = index; i < this.pool.length; i++) {
      this.pool[i].sprite.visible = false;
      this.pool[i].label.visible = false;
    }
  }

  private getOrCreate(index: number): PoolEntry {
    if (index < this.pool.length) {
      return this.pool[index];
    }

    const sprite = new Sprite();
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(0.25);

    const label = new Text({ text: '', style: LABEL_STYLE });
    label.anchor.set(0.5, 1);

    this.container.addChild(sprite);
    this.container.addChild(label);

    const entry = { sprite, label };
    this.pool.push(entry);
    return entry;
  }

  destroy(): void {
    for (const entry of this.pool) {
      entry.sprite.destroy();
      entry.label.destroy();
    }
    this.pool.length = 0;
    this.container.destroy();
  }
}
