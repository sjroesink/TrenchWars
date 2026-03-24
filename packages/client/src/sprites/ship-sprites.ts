import { Assets, Texture } from 'pixi.js';

const SHIP_NAMES = ['warbird', 'javelin', 'spider'] as const;
const FRAMES_PER_SHIP = 40;

/**
 * Manages ship sprite textures for all ship types.
 * Pre-loads all rotation frames so getTexture() is synchronous.
 * Each ship has 40 rotation frames (9-degree increments, clockwise).
 * Frame 0 = up, 10 = right, 20 = down, 30 = left.
 */
export class ShipSpriteManager {
  private textures = new Map<string, Texture>();

  /** Pre-load all 120 textures (3 ships x 40 frames). */
  async loadAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const shipName of SHIP_NAMES) {
      for (let frame = 0; frame < FRAMES_PER_SHIP; frame++) {
        const url = `/sprites/ships/${shipName}/${frame}.png`;
        const key = `${shipName}_${frame}`;
        promises.push(
          Assets.load<Texture>(url).then((texture) => {
            this.textures.set(key, texture);
          }),
        );
      }
    }

    await Promise.all(promises);
  }

  /**
   * Get the texture for a ship type at a given orientation.
   * @param shipType 0=Warbird, 1=Javelin, 2=Spider
   * @param orientation 0-1 normalized (0=up, 0.25=right, 0.5=down, 0.75=left)
   */
  getTexture(shipType: number, orientation: number): Texture {
    const shipName = SHIP_NAMES[shipType] ?? SHIP_NAMES[0];
    const frame = Math.round(orientation * FRAMES_PER_SHIP) % FRAMES_PER_SHIP;
    const key = `${shipName}_${frame}`;
    return this.textures.get(key) ?? this.textures.get(`${shipName}_0`) ?? Texture.EMPTY;
  }
}
