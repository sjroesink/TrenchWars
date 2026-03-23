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

// TW competitive settings (from published TW settings table)
export const WARBIRD: ShipConfig = convertShip({
  name: 'Warbird',
  rawRotation: 200,
  rawThrust: 16,
  rawSpeed: 2000,
  rawMaxRotation: 200,  // same as initial in TW
  rawMaxThrust: 24,
  rawMaxSpeed: 6000,
  rawRecharge: 4000,
  rawEnergy: 1500,
  rawMaxRecharge: 4000,
  rawMaxEnergy: 1500,
  rawAfterburnerEnergy: 5500,
});

export const JAVELIN: ShipConfig = convertShip({
  name: 'Javelin',
  rawRotation: 200,
  rawThrust: 13,
  rawSpeed: 1900,
  rawMaxRotation: 200,
  rawMaxThrust: 24,
  rawMaxSpeed: 6000,
  rawRecharge: 1500,
  rawEnergy: 1500,
  rawMaxRecharge: 1500,
  rawMaxEnergy: 1500,
  rawAfterburnerEnergy: 5500,
});

export const SPIDER: ShipConfig = convertShip({
  name: 'Spider',
  rawRotation: 180,
  rawThrust: 18,
  rawSpeed: 1700,
  rawMaxRotation: 180,
  rawMaxThrust: 24,
  rawMaxSpeed: 6000,
  rawRecharge: 2500,
  rawEnergy: 1400,
  rawMaxRecharge: 2500,
  rawMaxEnergy: 1400,
  rawAfterburnerEnergy: 6200,
});

// Per-ship weapon configurations (TW competitive settings)
// BulletSpeed conversion: value / 10 / 16 = tiles/s
// BulletDelay conversion: value / 100 = seconds
// Negative bulletSpeed = rear-firing gun (Javelin)
export const WARBIRD_WEAPONS: WeaponConfig = {
  bulletSpeed: 5000 / 10 / 16,     // 31.25 tiles/s (fast forward gun)
  bombSpeed: 2000 / 10 / 16,       // 12.5 tiles/s (no bomb in TW, but keep as fallback)
  bulletFireDelay: 100 / 100,       // 1.00 seconds
  bombFireDelay: 50 / 100,          // 0.50 seconds
  bulletFireEnergy: 450,
  bombFireEnergy: 300,
  bombBounceCount: 0,               // Warbird: no bombs in TW
  bombThrust: 50 / 100 * 10 / 16,  // recoil
  multifireCount: 0,                // Warbird: no multifire
  multifireEnergy: 450,
  multifireDelay: 100 / 100,
  multifireAngle: 0,
};

export const JAVELIN_WEAPONS: WeaponConfig = {
  bulletSpeed: -600 / 10 / 16,     // -3.75 tiles/s (rear gun, slower than forward bullets)
  bombSpeed: 2250 / 10 / 16,       // 14.0625 tiles/s
  bulletFireDelay: 60 / 100,        // 0.60 seconds
  bombFireDelay: 40 / 100,          // 0.40 seconds
  bulletFireEnergy: 300,
  bombFireEnergy: 1100,
  bombBounceCount: 1,               // Javelin: bounces once, explodes on second wall hit
  bombThrust: 50 / 100 * 10 / 16,  // recoil
  multifireCount: 3,                // Javelin: 3 rear bullets on Ctrl
  multifireEnergy: 450,             // TW: MF-E=450 for Jav
  multifireDelay: 150 / 100,        // 1.50 seconds (TW: MF-D=150)
  multifireAngle: 0.15,             // wider spread between rear bullets
};

export const SPIDER_WEAPONS: WeaponConfig = {
  bulletSpeed: 4000 / 10 / 16,     // 25.0 tiles/s
  bombSpeed: 2000 / 10 / 16,       // 12.5 tiles/s
  bulletFireDelay: 35 / 100,        // 0.35 seconds (fast fire)
  bombFireDelay: 50 / 100,          // 0.50 seconds
  bulletFireEnergy: 225,
  bombFireEnergy: 300,
  bombBounceCount: 0,               // Spider: no bomb bounces
  bombThrust: 50 / 100 * 10 / 16,  // recoil
  multifireCount: 0,                // Spider: no multifire
  multifireEnergy: 225,
  multifireDelay: 35 / 100,
  multifireAngle: 0,
};

// Indexed by ship type number (0=Warbird, 1=Javelin, 2=Spider)
export const SHIP_WEAPONS: WeaponConfig[] = [WARBIRD_WEAPONS, JAVELIN_WEAPONS, SPIDER_WEAPONS];

// Ship configs indexed by type number
export const SHIP_CONFIGS: ShipConfig[] = [WARBIRD, JAVELIN, SPIDER];
