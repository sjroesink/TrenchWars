import { describe, it, expect } from 'vitest';
import { parseMap, generateTestArena } from './map';
import type { TileMap } from './types';

describe('parseMap', () => {
  it('parses valid JSON map', () => {
    const json = JSON.stringify({ width: 3, height: 3, tiles: [1, 1, 1, 1, 0, 1, 1, 1, 1] });
    const map = parseMap(json);
    expect(map.width).toBe(3);
    expect(map.height).toBe(3);
    expect(map.tiles).toHaveLength(9);
    expect(map.tiles[4]).toBe(0); // center is empty
  });

  it('throws on missing width', () => {
    const json = JSON.stringify({ height: 3, tiles: [0, 0, 0] });
    expect(() => parseMap(json)).toThrow();
  });

  it('throws on missing height', () => {
    const json = JSON.stringify({ width: 3, tiles: [0, 0, 0] });
    expect(() => parseMap(json)).toThrow();
  });

  it('throws on missing tiles', () => {
    const json = JSON.stringify({ width: 3, height: 3 });
    expect(() => parseMap(json)).toThrow();
  });

  it('throws on tiles length mismatch', () => {
    const json = JSON.stringify({ width: 3, height: 3, tiles: [0, 0] });
    expect(() => parseMap(json)).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseMap('not json')).toThrow();
  });
});

describe('generateTestArena', () => {
  it('returns TileMap with correct dimensions', () => {
    const map = generateTestArena(200, 200);
    expect(map.width).toBe(200);
    expect(map.height).toBe(200);
    expect(map.tiles).toHaveLength(200 * 200);
  });

  it('has walls around perimeter', () => {
    const map = generateTestArena(200, 200);
    // Check all edge tiles are walls
    for (let x = 0; x < 200; x++) {
      expect(map.tiles[0 * 200 + x]).toBe(1); // top row
      expect(map.tiles[199 * 200 + x]).toBe(1); // bottom row
    }
    for (let y = 0; y < 200; y++) {
      expect(map.tiles[y * 200 + 0]).toBe(1); // left column
      expect(map.tiles[y * 200 + 199]).toBe(1); // right column
    }
  });

  it('has open interior spaces', () => {
    const map = generateTestArena(200, 200);
    // Center area should have open tiles
    let openCount = 0;
    for (let y = 80; y < 120; y++) {
      for (let x = 80; x < 120; x++) {
        if (map.tiles[y * 200 + x] === 0) openCount++;
      }
    }
    // At least 75% of center area should be open
    expect(openCount).toBeGreaterThan(40 * 40 * 0.75);
  });

  it('has some internal wall structures', () => {
    const map = generateTestArena(200, 200);
    // Count internal walls (not border)
    let wallCount = 0;
    for (let y = 3; y < 197; y++) {
      for (let x = 3; x < 197; x++) {
        if (map.tiles[y * 200 + x] === 1) wallCount++;
      }
    }
    // Should have some internal walls but not too many
    expect(wallCount).toBeGreaterThan(100);
    expect(wallCount).toBeLessThan(200 * 200 * 0.3); // less than 30% internal walls
  });
});
