import { TILE_SIZE } from '@trench-wars/shared';

/**
 * Viewport following ship, clamped to map bounds.
 * Tracks a target position (ship x, y in tile coords) and
 * provides world-to-screen coordinate conversion.
 */
export class Camera {
  /** Camera center in tile coordinates */
  x = 0;
  y = 0;

  /** Screen dimensions in pixels */
  screenWidth = 0;
  screenHeight = 0;

  /**
   * Update camera to follow target, clamped within map bounds.
   */
  update(
    targetX: number,
    targetY: number,
    mapWidth: number,
    mapHeight: number,
    screenWidth: number,
    screenHeight: number,
  ): void {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    // Half-screen in tile coords
    const halfW = screenWidth / 2 / TILE_SIZE;
    const halfH = screenHeight / 2 / TILE_SIZE;

    // Follow target, clamp so camera doesn't show outside map
    this.x = Math.max(halfW, Math.min(mapWidth - halfW, targetX));
    this.y = Math.max(halfH, Math.min(mapHeight - halfH, targetY));
  }

  /**
   * Convert tile coordinates to screen pixel coordinates.
   */
  worldToScreen(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: (tileX - this.x) * TILE_SIZE + this.screenWidth / 2,
      y: (tileY - this.y) * TILE_SIZE + this.screenHeight / 2,
    };
  }
}
