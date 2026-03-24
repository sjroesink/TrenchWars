import { Assets, Texture } from 'pixi.js';

const SHIP_NAMES = ['warbird', 'javelin', 'spider'] as const;

/**
 * Manages ship sprite textures. One texture per ship type.
 * Rotation is handled by PixiJS sprite.rotation (GPU-accelerated).
 */
export class ShipSpriteManager {
  private textures = new Map<string, Texture>();

  /** Load one texture per ship type. */
  async loadAll(): Promise<void> {
    await Promise.all(
      SHIP_NAMES.map(async (name) => {
        const texture = await Assets.load<Texture>(`/sprites/ships/${name}.png`);
        this.textures.set(name, texture);
      }),
    );
  }

  /**
   * Get the texture for a ship type.
   * @param shipType 0=Warbird, 1=Javelin, 2=Spider
   */
  getTexture(shipType: number): Texture {
    const name = SHIP_NAMES[shipType] ?? SHIP_NAMES[0];
    return this.textures.get(name) ?? Texture.EMPTY;
  }
}
