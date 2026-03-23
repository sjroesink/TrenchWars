import type { ShipState, WeaponConfig, ProjectileState, TileMap } from './types';
import { isCollidingWithWalls } from './collision';
import {
  BULLET_ALIVE_TIME,
  BOMB_ALIVE_TIME,
  BOMB_DAMAGE_LEVEL,
  BOMB_EXPLODE_RADIUS,
} from './constants';

const PROJECTILE_RADIUS = 0.1;

/**
 * Create a bullet projectile from ship state.
 * Bullet velocity = ship velocity + heading * bulletSpeed.
 * Orientation is 0-1 fraction of full rotation (0 = east, CW positive).
 */
export function createBullet(
  ship: ShipState,
  config: WeaponConfig,
  ownerId: string,
  id: number,
  currentTick: number,
): ProjectileState {
  const angle = ship.orientation * 2 * Math.PI;
  const headingX = Math.cos(angle);
  const headingY = Math.sin(angle);

  return {
    id,
    ownerId,
    type: 'bullet',
    x: ship.x,
    y: ship.y,
    vx: ship.vx + headingX * config.bulletSpeed,
    vy: ship.vy + headingY * config.bulletSpeed,
    level: 0,
    bouncesRemaining: 0,
    endTick: currentTick + BULLET_ALIVE_TIME,
  };
}

/**
 * Create multifire bullets (e.g., Javelin rear 3-shot spread).
 * Returns an array of projectiles. Uses bulletSpeed (negative = rear-facing).
 * Spread is symmetric around the ship heading with config.multifireAngle between each.
 */
export function createMultifire(
  ship: ShipState,
  config: WeaponConfig,
  ownerId: string,
  startId: number,
  currentTick: number,
): ProjectileState[] {
  const count = config.multifireCount;
  if (count <= 0) return [];

  const baseAngle = ship.orientation * 2 * Math.PI;
  const projectiles: ProjectileState[] = [];

  for (let i = 0; i < count; i++) {
    // Spread bullets symmetrically: -(count-1)/2 to +(count-1)/2
    const offsetIndex = i - (count - 1) / 2;
    const angle = baseAngle + offsetIndex * config.multifireAngle;
    const headingX = Math.cos(angle);
    const headingY = Math.sin(angle);

    projectiles.push({
      id: startId + i,
      ownerId,
      type: 'bullet',
      x: ship.x,
      y: ship.y,
      vx: ship.vx + headingX * config.bulletSpeed,
      vy: ship.vy + headingY * config.bulletSpeed,
      level: 0,
      bouncesRemaining: 0,
      endTick: currentTick + BULLET_ALIVE_TIME,
    });
  }

  return projectiles;
}

/**
 * Create a bomb projectile from ship state.
 * Returns the projectile and recoil velocities to apply to the ship.
 */
export function createBomb(
  ship: ShipState,
  config: WeaponConfig,
  ownerId: string,
  id: number,
  currentTick: number,
): { projectile: ProjectileState; recoilVx: number; recoilVy: number } {
  const angle = ship.orientation * 2 * Math.PI;
  const headingX = Math.cos(angle);
  const headingY = Math.sin(angle);

  const projectile: ProjectileState = {
    id,
    ownerId,
    type: 'bomb',
    x: ship.x,
    y: ship.y,
    vx: ship.vx + headingX * config.bombSpeed,
    vy: ship.vy + headingY * config.bombSpeed,
    level: 0,
    bouncesRemaining: config.bombBounceCount,
    endTick: currentTick + BOMB_ALIVE_TIME,
  };

  return {
    projectile,
    recoilVx: -headingX * config.bombThrust,
    recoilVy: -headingY * config.bombThrust,
  };
}

/**
 * Update a projectile's position. Axis-separated collision (X then Y).
 * Returns 'active' if still alive, 'wall_explode' if destroyed by wall.
 */
export function updateProjectile(
  proj: ProjectileState,
  map: TileMap,
  dt: number,
): 'active' | 'wall_explode' {
  // Move X axis
  const prevX = proj.x;
  proj.x += proj.vx * dt;

  if (isCollidingWithWalls(proj.x, proj.y, PROJECTILE_RADIUS, map)) {
    proj.x = prevX;
    proj.vx = -proj.vx;

    if (proj.type === 'bullet') {
      return 'wall_explode';
    }
    // Bomb: check bounces remaining before decrementing
    if (proj.bouncesRemaining <= 0) {
      return 'wall_explode';
    }
    proj.bouncesRemaining--;
  }

  // Move Y axis
  const prevY = proj.y;
  proj.y += proj.vy * dt;

  if (isCollidingWithWalls(proj.x, proj.y, PROJECTILE_RADIUS, map)) {
    proj.y = prevY;
    proj.vy = -proj.vy;

    if (proj.type === 'bullet') {
      return 'wall_explode';
    }
    if (proj.bouncesRemaining <= 0) {
      return 'wall_explode';
    }
    proj.bouncesRemaining--;
  }

  return 'active';
}

/**
 * Check if a projectile hits a player using AABB overlap.
 * Returns false if projectile owner is the same as player (no self-hit).
 */
export function checkProjectileHit(
  proj: ProjectileState,
  playerX: number,
  playerY: number,
  playerRadius: number,
  playerId: string,
): boolean {
  if (proj.ownerId === playerId) {
    return false;
  }

  const dx = Math.abs(proj.x - playerX);
  const dy = Math.abs(proj.y - playerY);

  return dx < (PROJECTILE_RADIUS + playerRadius) &&
         dy < (PROJECTILE_RADIUS + playerRadius);
}

/**
 * Calculate bomb area damage with linear falloff.
 * Full damage at center, zero at edge of blast radius.
 * Higher bomb level increases blast radius.
 */
export function calculateBombDamage(distance: number, bombLevel: number): number {
  const explodeRadius = BOMB_EXPLODE_RADIUS * (1 + bombLevel);

  if (distance >= explodeRadius) {
    return 0;
  }

  const damage = (explodeRadius - distance) * (BOMB_DAMAGE_LEVEL / explodeRadius);
  return Math.floor(damage);
}
