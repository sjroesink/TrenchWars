import type { ShipState, TileMap } from './types';

/**
 * Check if a tile at the given coordinates is a wall.
 * Out-of-bounds coordinates are treated as walls.
 */
export function isWallAt(map: TileMap, tileX: number, tileY: number): boolean {
  if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
    return true;
  }
  return map.tiles[tileY * map.width + tileX] !== 0;
}

/**
 * Check if a ship (circle approximated as AABB) collides with any wall tile.
 * Ship AABB: [x-radius, y-radius] to [x+radius, y+radius]
 * Tile AABB: [tx, ty] to [tx+1, ty+1]
 */
export function isCollidingWithWalls(
  x: number,
  y: number,
  radius: number,
  map: TileMap,
): boolean {
  const minTX = Math.floor(x - radius);
  const maxTX = Math.floor(x + radius);
  const minTY = Math.floor(y - radius);
  const maxTY = Math.floor(y + radius);

  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      if (isWallAt(map, tx, ty)) {
        // Check AABB overlap between ship and tile
        const shipLeft = x - radius;
        const shipRight = x + radius;
        const shipTop = y - radius;
        const shipBottom = y + radius;

        const tileLeft = tx;
        const tileRight = tx + 1;
        const tileTop = ty;
        const tileBottom = ty + 1;

        if (
          shipRight > tileLeft &&
          shipLeft < tileRight &&
          shipBottom > tileTop &&
          shipTop < tileBottom
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Simulate movement on a single axis and handle wall collision.
 * Axis-separated approach matching SubSpace: move on axis, check collision,
 * restore position and negate velocity if colliding.
 * Returns true if a bounce occurred.
 */
export function simulateAxis(
  state: ShipState,
  dt: number,
  axis: 'x' | 'y',
  map: TileMap,
  radius: number,
  bounceFactor: number,
): boolean {
  const velKey = axis === 'x' ? 'vx' : 'vy';
  const prevPos = state[axis];

  // Move on this axis
  state[axis] += state[velKey] * dt;

  // Check collision at new position
  if (isCollidingWithWalls(state.x, state.y, radius, map)) {
    // Restore position and bounce
    state[axis] = prevPos;
    state[velKey] *= -bounceFactor;
    return true;
  }

  return false;
}

/**
 * Apply wall collision using axis-separated approach (X then Y).
 * This matches SubSpace's collision order.
 */
export function applyWallCollision(
  state: ShipState,
  dt: number,
  map: TileMap,
  radius: number,
  bounceFactor: number,
): void {
  simulateAxis(state, dt, 'x', map, radius, bounceFactor);
  simulateAxis(state, dt, 'y', map, radius, bounceFactor);
}
