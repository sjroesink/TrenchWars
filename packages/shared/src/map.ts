import type { TileMap } from './types';

/**
 * Parse a JSON string into a TileMap, validating required fields.
 */
export function parseMap(json: string): TileMap {
  const data = JSON.parse(json);

  if (typeof data.width !== 'number') {
    throw new Error('Map missing required field: width');
  }
  if (typeof data.height !== 'number') {
    throw new Error('Map missing required field: height');
  }
  if (!Array.isArray(data.tiles)) {
    throw new Error('Map missing required field: tiles');
  }
  if (data.tiles.length !== data.width * data.height) {
    throw new Error(
      `Map tiles length (${data.tiles.length}) does not match width*height (${data.width * data.height})`,
    );
  }

  return {
    width: data.width,
    height: data.height,
    tiles: data.tiles,
  };
}

/**
 * Generate a test arena with walls, corridors, and open spaces.
 *
 * Layout:
 * - 2-tile thick border walls
 * - Central open area (~40x40) for dogfighting
 * - 4 quadrant rooms connected by corridors
 * - Wall pillars/obstacles scattered in open areas
 */
export function generateTestArena(width: number, height: number): TileMap {
  const tiles = new Array(width * height).fill(0);

  function setTile(x: number, y: number, value: number): void {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      tiles[y * width + x] = value;
    }
  }

  function fillRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    value: number,
  ): void {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        setTile(x, y, value);
      }
    }
  }

  // 2-tile thick border walls
  fillRect(0, 0, width - 1, 1, 1); // top
  fillRect(0, height - 2, width - 1, height - 1, 1); // bottom
  fillRect(0, 0, 1, height - 1, 1); // left
  fillRect(width - 2, 0, width - 1, height - 1, 1); // right

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  // Cross-shaped walls dividing map into quadrants
  // Horizontal wall with gaps (corridors)
  for (let x = 10; x < width - 10; x++) {
    if (
      Math.abs(x - cx) > 5 && // gap at center
      Math.abs(x - Math.floor(cx / 2)) > 3 && // gap at quarter
      Math.abs(x - Math.floor((cx * 3) / 2)) > 3 // gap at three-quarter
    ) {
      setTile(x, cy, 1);
      setTile(x, cy - 1, 1);
    }
  }

  // Vertical wall with gaps
  for (let y = 10; y < height - 10; y++) {
    if (
      Math.abs(y - cy) > 5 && // gap at center
      Math.abs(y - Math.floor(cy / 2)) > 3 && // gap at quarter
      Math.abs(y - Math.floor((cy * 3) / 2)) > 3 // gap at three-quarter
    ) {
      setTile(cx, y, 1);
      setTile(cx - 1, y, 1);
    }
  }

  // Corner room walls in each quadrant
  const quadrants = [
    { x: Math.floor(cx / 2), y: Math.floor(cy / 2) },
    { x: Math.floor((cx * 3) / 2), y: Math.floor(cy / 2) },
    { x: Math.floor(cx / 2), y: Math.floor((cy * 3) / 2) },
    { x: Math.floor((cx * 3) / 2), y: Math.floor((cy * 3) / 2) },
  ];

  for (const q of quadrants) {
    // L-shaped wall structures
    fillRect(q.x - 8, q.y - 8, q.x - 8, q.y - 3, 1); // vertical segment
    fillRect(q.x - 8, q.y - 8, q.x - 3, q.y - 8, 1); // horizontal segment

    fillRect(q.x + 3, q.y + 3, q.x + 8, q.y + 3, 1); // horizontal segment
    fillRect(q.x + 8, q.y + 3, q.x + 8, q.y + 8, 1); // vertical segment

    // Pillar obstacles (2x2)
    fillRect(q.x - 1, q.y - 1, q.x, q.y, 1);
  }

  // Additional corridor walls for complexity
  // Top-left diagonal-like structure
  fillRect(20, 20, 25, 20, 1);
  fillRect(25, 20, 25, 25, 1);

  // Bottom-right structure
  fillRect(width - 26, height - 26, width - 21, height - 26, 1);
  fillRect(width - 26, height - 26, width - 26, height - 21, 1);

  return { width, height, tiles };
}
