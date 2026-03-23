import type { ShipConfig, WeaponConfig } from './types';

interface RawShipValues {
  name: string;
  rawRotation: number;
  rawThrust: number;
  rawSpeed: number;
  rawMaxRotation: number;
  rawMaxThrust: number;
  rawMaxSpeed: number;
  rawRecharge: number;
  rawEnergy: number;
  rawMaxRecharge: number;
  rawMaxEnergy: number;
  rawAfterburnerEnergy: number;
  radius?: number;
}

/**
 * Convert raw SVS (SubSpace Vié Settings) values to game units.
 *
 * Conversion formulas:
 *   rotation = rawRotation / 400       (full rotations per second)
 *   thrust   = rawThrust * 10 / 16     (tiles/s^2)
 *   speed    = rawSpeed / 10 / 16      (tiles/s)
 *   recharge = rawRecharge / 10        (energy/s)
 *   afterburnerCost = rawAfterburnerEnergy / 10  (energy/s)
 */
function convertShip(raw: RawShipValues): ShipConfig {
  return {
    name: raw.name,
    rawRotation: raw.rawRotation,
    rawThrust: raw.rawThrust,
    rawSpeed: raw.rawSpeed,
    rawMaxRotation: raw.rawMaxRotation,
    rawMaxThrust: raw.rawMaxThrust,
    rawMaxSpeed: raw.rawMaxSpeed,
    rawRecharge: raw.rawRecharge,
    rawEnergy: raw.rawEnergy,
    rawMaxRecharge: raw.rawMaxRecharge,
    rawMaxEnergy: raw.rawMaxEnergy,
    rawAfterburnerEnergy: raw.rawAfterburnerEnergy,
    rotation: raw.rawRotation / 400,
    thrust: raw.rawThrust * 10 / 16,
    speed: raw.rawSpeed / 10 / 16,
    maxThrust: raw.rawMaxThrust * 10 / 16,
    maxSpeed: raw.rawMaxSpeed / 10 / 16,
    recharge: raw.rawRecharge / 10,
    energy: raw.rawEnergy,
    maxRecharge: raw.rawMaxRecharge / 10,
    maxEnergy: raw.rawMaxEnergy,
    afterburnerCost: raw.rawAfterburnerEnergy / 10,
    radius: raw.radius ?? 14 / 16, // 0.875 tiles default
  };
}

export const WARBIRD: ShipConfig = convertShip({
  name: 'Warbird',
  rawRotation: 210,
  rawThrust: 16,
  rawSpeed: 2010,
  rawMaxRotation: 300,
  rawMaxThrust: 19,
  rawMaxSpeed: 3250,
  rawRecharge: 400,
  rawEnergy: 1000,
  rawMaxRecharge: 1150,
  rawMaxEnergy: 1700,
  rawAfterburnerEnergy: 1200,
});

export const JAVELIN: ShipConfig = convertShip({
  name: 'Javelin',
  rawRotation: 200,
  rawThrust: 15,
  rawSpeed: 2200,
  rawMaxRotation: 230,
  rawMaxThrust: 17,
  rawMaxSpeed: 3750,
  rawRecharge: 400,
  rawEnergy: 1000,
  rawMaxRecharge: 1150,
  rawMaxEnergy: 1700,
  rawAfterburnerEnergy: 1200,
});

export const SPIDER: ShipConfig = convertShip({
  name: 'Spider',
  rawRotation: 200,
  rawThrust: 15,
  rawSpeed: 2010,
  rawMaxRotation: 230,
  rawMaxThrust: 17,
  rawMaxSpeed: 3250,
  rawRecharge: 500,
  rawEnergy: 1000,
  rawMaxRecharge: 1150,
  rawMaxEnergy: 1700,
  rawAfterburnerEnergy: 1200,
});

// Per-ship weapon configurations (SVS defaults from research)
export const WARBIRD_WEAPONS: WeaponConfig = {
  bulletSpeed: 2000 / 10 / 16,     // 12.5 tiles/s
  bombSpeed: 2000 / 10 / 16,       // 12.5 tiles/s
  bulletFireDelay: 25 / 100,        // 0.25 seconds
  bombFireDelay: 50 / 100,          // 0.50 seconds
  bulletFireEnergy: 80,
  bombFireEnergy: 300,
  bombBounceCount: 0,               // Warbird: no bomb bounces (gun-focused)
  bombThrust: 36 / 100 * 10 / 16,  // 0.225 tiles/s recoil
};

export const JAVELIN_WEAPONS: WeaponConfig = {
  bulletSpeed: 2000 / 10 / 16,
  bombSpeed: 2000 / 10 / 16,
  bulletFireDelay: 30 / 100,        // 0.30 seconds (slower bullets)
  bombFireDelay: 40 / 100,          // 0.40 seconds (faster bombs)
  bulletFireEnergy: 100,
  bombFireEnergy: 250,
  bombBounceCount: 3,               // Javelin: high bomb bounces
  bombThrust: 36 / 100 * 10 / 16,
};

export const SPIDER_WEAPONS: WeaponConfig = {
  bulletSpeed: 2000 / 10 / 16,
  bombSpeed: 2000 / 10 / 16,
  bulletFireDelay: 20 / 100,        // 0.20 seconds (fastest bullets)
  bombFireDelay: 50 / 100,          // 0.50 seconds
  bulletFireEnergy: 60,
  bombFireEnergy: 300,
  bombBounceCount: 2,               // Spider: medium bomb bounces
  bombThrust: 36 / 100 * 10 / 16,
};

// Indexed by ship type number (0=Warbird, 1=Javelin, 2=Spider)
export const SHIP_WEAPONS: WeaponConfig[] = [WARBIRD_WEAPONS, JAVELIN_WEAPONS, SPIDER_WEAPONS];

// Ship configs indexed by type number
export const SHIP_CONFIGS: ShipConfig[] = [WARBIRD, JAVELIN, SPIDER];
