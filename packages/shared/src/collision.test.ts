import { describe, it, expect } from 'vitest';
import { isWallAt, isCollidingWithWalls, simulateAxis, applyWallCollision } from './collision';
import { DEFAULT_BOUNCE_FACTOR } from './constants';
import type { ShipState, TileMap } from './types';

function makeState(overrides?: Partial<ShipState>): ShipState {
  return {
    x: 512,
    y: 512,
    vx: 0,
    vy: 0,
    orientation: 0,
    energy: 1000,
    ...overrides,
  };
}

// 10x10 map with walls on the border
function makeTestMap(): TileMap {
  const width = 10;
  const height = 10;
  const tiles = new Array(width * height).fill(0);
  // Set border walls
  for (let x = 0; x < width; x++) {
    tiles[0 * width + x] = 1; // top row
    tiles[(height - 1) * width + x] = 1; // bottom row
  }
  for (let y = 0; y < height; y++) {
    tiles[y * width + 0] = 1; // left column
    tiles[y * width + (width - 1)] = 1; // right column
  }
  // Add a wall at (4, 5) for collision tests
  tiles[5 * width + 4] = 1;
  return { width, height, tiles };
}

describe('isWallAt', () => {
  const map = makeTestMap();

  it('returns true for wall tiles', () => {
    expect(isWallAt(map, 0, 0)).toBe(true); // border
    expect(isWallAt(map, 4, 5)).toBe(true); // internal wall
  });

  it('returns false for empty tiles', () => {
    expect(isWallAt(map, 5, 5)).toBe(false);
    expect(isWallAt(map, 3, 3)).toBe(false);
  });

  it('returns true for out-of-bounds coordinates', () => {
    expect(isWallAt(map, -1, 5)).toBe(true);
    expect(isWallAt(map, 10, 5)).toBe(true);
    expect(isWallAt(map, 5, -1)).toBe(true);
    expect(isWallAt(map, 5, 10)).toBe(true);
  });
});

describe('isCollidingWithWalls', () => {
  const map = makeTestMap();
  const radius = 0.875;

  it('returns false for ship in open area', () => {
    expect(isCollidingWithWalls(5.5, 5.5, radius, map)).toBe(false);
  });

  it('returns true when ship overlaps wall tile', () => {
    // Ship at x=5.1, wall at tile (4, 5). Ship AABB left edge = 5.1 - 0.875 = 4.225
    // Wall tile AABB = [4, 5] to [5, 6]. Ship y AABB = [4.625, 6.375] overlaps [5, 6]
    expect(isCollidingWithWalls(5.1, 5.5, radius, map)).toBe(true);
  });

  it('returns true when near border wall', () => {
    // Ship near top border wall (tile y=0)
    expect(isCollidingWithWalls(5, 1.5, radius, map)).toBe(true);
  });

  it('returns false when just outside wall range', () => {
    // Wall at (4,5). Ship at x=6.0, radius=0.875. Left edge = 5.125 > 5 (wall right edge)
    expect(isCollidingWithWalls(6.0, 5.5, radius, map)).toBe(false);
  });
});

describe('simulateAxis', () => {
  it('moves ship in open space without bounce (X axis)', () => {
    const map = makeTestMap();
    const state = makeState({ x: 5.5, y: 5.5, vx: 10 });
    const bounced = simulateAxis(state, 0.01, 'x', map, 0.875, DEFAULT_BOUNCE_FACTOR);
    expect(bounced).toBe(false);
    expect(state.x).toBeCloseTo(5.6, 5);
  });

  it('bounces ship off wall (X axis) - velocity negated', () => {
    const map = makeTestMap();
    // Ship near right border (wall at x=9). Position 8.2 + 0.875 radius -> close to wall
    // Moving right with high velocity
    const state = makeState({ x: 8.2, y: 5.5, vx: 20 });
    const bounced = simulateAxis(state, 0.01, 'x', map, 0.875, DEFAULT_BOUNCE_FACTOR);
    expect(bounced).toBe(true);
    expect(state.vx).toBeLessThan(0); // reversed
    expect(state.x).toBeCloseTo(8.2, 5); // restored
  });

  it('bounces ship off wall (Y axis) - velocity negated', () => {
    const map = makeTestMap();
    // Ship near bottom border (wall at y=9)
    const state = makeState({ x: 5.5, y: 8.2, vy: 20 });
    const bounced = simulateAxis(state, 0.01, 'y', map, 0.875, DEFAULT_BOUNCE_FACTOR);
    expect(bounced).toBe(true);
    expect(state.vy).toBeLessThan(0); // reversed
    expect(state.y).toBeCloseTo(8.2, 5); // restored
  });

  it('applies bounce factor to velocity', () => {
    const map = makeTestMap();
    const state = makeState({ x: 8.2, y: 5.5, vx: 20 });
    const bounceFactor = 0.5;
    simulateAxis(state, 0.01, 'x', map, 0.875, bounceFactor);
    expect(state.vx).toBeCloseTo(-10, 1); // 20 * -0.5 = -10
  });
});

describe('applyWallCollision', () => {
  it('applies axis-separated collision (X then Y)', () => {
    const map = makeTestMap();
    // Ship in open area, should just move
    const state = makeState({ x: 5.5, y: 5.5, vx: 5, vy: 5 });
    applyWallCollision(state, 0.01, map, 0.875, DEFAULT_BOUNCE_FACTOR);
    expect(state.x).toBeCloseTo(5.55, 5);
    expect(state.y).toBeCloseTo(5.55, 5);
  });
});
