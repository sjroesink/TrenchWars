import { describe, it, expect } from 'vitest';
import {
  createBullet,
  createBomb,
  updateProjectile,
  checkProjectileHit,
  calculateBombDamage,
} from '../weapons';
import type { ShipState, WeaponConfig, TileMap, ProjectileState } from '../types';
import {
  BULLET_ALIVE_TIME,
  BOMB_ALIVE_TIME,
  BOMB_DAMAGE_LEVEL,
  BOMB_EXPLODE_RADIUS,
} from '../constants';

// Helper: create a basic ship state
function makeShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    x: 10,
    y: 10,
    vx: 0,
    vy: 0,
    orientation: 0, // facing east
    energy: 1000,
    ...overrides,
  };
}

// Helper: create weapon config
function makeWeaponConfig(overrides: Partial<WeaponConfig> = {}): WeaponConfig {
  return {
    bulletSpeed: 12.5,
    bombSpeed: 10,
    bulletFireDelay: 0.5,
    bombFireDelay: 1.0,
    bulletFireEnergy: 100,
    bombFireEnergy: 200,
    bombBounceCount: 3,
    bombThrust: 5,
    ...overrides,
  };
}

// Helper: create an open map (no walls)
function makeOpenMap(size = 20): TileMap {
  return {
    width: size,
    height: size,
    tiles: new Array(size * size).fill(0),
  };
}

// Helper: create a map with walls around the edges
function makeWalledMap(size = 20): TileMap {
  const tiles = new Array(size * size).fill(0);
  for (let i = 0; i < size; i++) {
    tiles[i] = 1;                     // top row
    tiles[(size - 1) * size + i] = 1; // bottom row
    tiles[i * size] = 1;              // left column
    tiles[i * size + (size - 1)] = 1; // right column
  }
  return tiles as unknown as TileMap;
}

// Fix makeWalledMap to return proper TileMap
function makeWalledArena(size = 20): TileMap {
  const tiles = new Array(size * size).fill(0);
  for (let i = 0; i < size; i++) {
    tiles[i] = 1;                     // top row
    tiles[(size - 1) * size + i] = 1; // bottom row
    tiles[i * size] = 1;              // left column
    tiles[i * size + (size - 1)] = 1; // right column
  }
  return { width: size, height: size, tiles };
}

describe('createBullet', () => {
  it('creates bullet with velocity = heading * bulletSpeed when ship stationary', () => {
    const ship = makeShip(); // facing east, vx=0, vy=0
    const config = makeWeaponConfig();
    const bullet = createBullet(ship, config, 'p1', 1, 100);

    expect(bullet.type).toBe('bullet');
    expect(bullet.x).toBe(10);
    expect(bullet.y).toBe(10);
    expect(bullet.vx).toBeCloseTo(12.5, 5); // cos(0) * 12.5
    expect(bullet.vy).toBeCloseTo(0, 5);    // sin(0) * 12.5
    expect(bullet.ownerId).toBe('p1');
    expect(bullet.id).toBe(1);
    expect(bullet.bouncesRemaining).toBe(0);
    expect(bullet.endTick).toBe(100 + BULLET_ALIVE_TIME);
  });

  it('inherits ship velocity', () => {
    const ship = makeShip({ vx: 5, vy: 0 }); // facing east, moving east
    const config = makeWeaponConfig();
    const bullet = createBullet(ship, config, 'p1', 2, 100);

    expect(bullet.vx).toBeCloseTo(17.5, 5); // 5 + 12.5
    expect(bullet.vy).toBeCloseTo(0, 5);
  });

  it('handles non-zero orientation (facing south, orientation=0.25)', () => {
    const ship = makeShip({ orientation: 0.25 }); // facing south (CW from east)
    const config = makeWeaponConfig();
    const bullet = createBullet(ship, config, 'p1', 3, 0);

    expect(bullet.vx).toBeCloseTo(0, 3);
    expect(bullet.vy).toBeCloseTo(12.5, 3);
  });
});

describe('createBomb', () => {
  it('creates bomb with correct bounceCount and type', () => {
    const ship = makeShip();
    const config = makeWeaponConfig({ bombBounceCount: 3 });
    const result = createBomb(ship, config, 'p1', 10, 200);

    expect(result.projectile.type).toBe('bomb');
    expect(result.projectile.bouncesRemaining).toBe(3);
    expect(result.projectile.endTick).toBe(200 + BOMB_ALIVE_TIME);
  });

  it('returns recoil in opposite direction of heading', () => {
    const ship = makeShip(); // facing east
    const config = makeWeaponConfig({ bombThrust: 5 });
    const result = createBomb(ship, config, 'p1', 10, 0);

    // Recoil should be opposite to heading (west = negative x)
    expect(result.recoilVx).toBeCloseTo(-5, 3);
    expect(result.recoilVy).toBeCloseTo(0, 3);
  });

  it('bomb velocity uses bombSpeed', () => {
    const ship = makeShip();
    const config = makeWeaponConfig({ bombSpeed: 10 });
    const result = createBomb(ship, config, 'p1', 10, 0);

    expect(result.projectile.vx).toBeCloseTo(10, 5);
    expect(result.projectile.vy).toBeCloseTo(0, 5);
  });
});

describe('updateProjectile', () => {
  it('moves bullet by velocity * dt', () => {
    const bullet: ProjectileState = {
      id: 1, ownerId: 'p1', type: 'bullet',
      x: 10, y: 10, vx: 12.5, vy: 0,
      level: 0, bouncesRemaining: 0, endTick: 1000,
    };
    const map = makeOpenMap();
    const result = updateProjectile(bullet, map, 0.01);

    expect(bullet.x).toBeCloseTo(10.125, 5);
    expect(bullet.y).toBeCloseTo(10, 5);
    expect(result).toBe('active');
  });

  it('bullet hitting wall returns wall_explode (no bouncing)', () => {
    // Place bullet near left wall (x=0 is wall in walled arena)
    const bullet: ProjectileState = {
      id: 1, ownerId: 'p1', type: 'bullet',
      x: 1.05, y: 5, vx: -12.5, vy: 0,
      level: 0, bouncesRemaining: 0, endTick: 1000,
    };
    const map = makeWalledArena();
    const result = updateProjectile(bullet, map, 0.1);

    expect(result).toBe('wall_explode');
  });

  it('bomb hitting wall with bounces remaining decrements and continues', () => {
    const bomb: ProjectileState = {
      id: 2, ownerId: 'p1', type: 'bomb',
      x: 1.05, y: 5, vx: -10, vy: 0,
      level: 0, bouncesRemaining: 3, endTick: 1000,
    };
    const map = makeWalledArena();
    const result = updateProjectile(bomb, map, 0.1);

    expect(result).toBe('active');
    expect(bomb.bouncesRemaining).toBe(2);
    // Velocity should have reversed on x axis
    expect(bomb.vx).toBeGreaterThan(0);
  });

  it('bomb hitting wall on last bounce returns wall_explode', () => {
    const bomb: ProjectileState = {
      id: 3, ownerId: 'p1', type: 'bomb',
      x: 1.05, y: 5, vx: -10, vy: 0,
      level: 0, bouncesRemaining: 1, endTick: 1000,
    };
    const map = makeWalledArena();
    const result = updateProjectile(bomb, map, 0.1);

    expect(result).toBe('wall_explode');
  });
});

describe('checkProjectileHit', () => {
  it('detects overlap between projectile and player', () => {
    // Bullet at (10,10), player at (10.3,10) -- should overlap with radius=0.875
    const hit = checkProjectileHit(
      { x: 10, y: 10, ownerId: 'p1' } as ProjectileState,
      10.3, 10, 0.875, 'p2',
    );
    expect(hit).toBe(true);
  });

  it('returns false when no overlap', () => {
    const hit = checkProjectileHit(
      { x: 10, y: 10, ownerId: 'p1' } as ProjectileState,
      15, 15, 0.875, 'p2',
    );
    expect(hit).toBe(false);
  });

  it('returns false for self-hit (ownerId matches playerId)', () => {
    const hit = checkProjectileHit(
      { x: 10, y: 10, ownerId: 'p1' } as ProjectileState,
      10, 10, 0.875, 'p1',
    );
    expect(hit).toBe(false);
  });
});

describe('calculateBombDamage', () => {
  it('returns full damage at center (distance=0)', () => {
    const damage = calculateBombDamage(0, 0);
    expect(damage).toBe(BOMB_DAMAGE_LEVEL); // 550
  });

  it('returns zero at edge of blast radius', () => {
    // Level 0: explodeRadius = BOMB_EXPLODE_RADIUS * (1 + 0) = 5
    const damage = calculateBombDamage(BOMB_EXPLODE_RADIUS, 0);
    expect(damage).toBe(0);
  });

  it('returns half damage at half radius', () => {
    const halfRadius = BOMB_EXPLODE_RADIUS / 2; // 2.5
    const damage = calculateBombDamage(halfRadius, 0);
    expect(damage).toBe(Math.floor(BOMB_DAMAGE_LEVEL / 2)); // 275
  });

  it('returns zero beyond blast radius', () => {
    const damage = calculateBombDamage(BOMB_EXPLODE_RADIUS + 5, 0);
    expect(damage).toBe(0);
  });

  it('higher level increases blast radius', () => {
    // Level 1: explodeRadius = BOMB_EXPLODE_RADIUS * 2 = 10
    // At distance 5 (half of 10), should get half damage
    const damage = calculateBombDamage(5, 1);
    expect(damage).toBe(Math.floor(BOMB_DAMAGE_LEVEL / 2)); // 275
  });
});
