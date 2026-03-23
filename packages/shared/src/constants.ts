export const TICK_RATE = 100;       // Hz, matching SubSpace
export const TICK_DT = 1 / TICK_RATE; // 0.01 seconds
export const TILE_SIZE = 16;        // pixels per tile
export const MAP_SIZE = 1024;       // tiles per side (1024x1024)
export const DEFAULT_BOUNCE_FACTOR = 0.65; // SVS formula: 16/BounceFactor. TW zones typically ~0.6-0.7

// Weapon constants (arena-wide, from SVS defaults)
export const BULLET_DAMAGE_LEVEL = 200;     // damage for L1 bullet (SVS: 200000/1000)
export const BOMB_DAMAGE_LEVEL = 550;       // damage at bomb center (SVS: 550000/1000)
export const BULLET_DAMAGE_UPGRADE = 100;   // per-level damage increase (SVS: 100000/1000)
export const BULLET_ALIVE_TIME = 550;       // ticks (5.5 seconds at 100Hz)
export const BOMB_ALIVE_TIME = 700;         // ticks (7.0 seconds)
export const BOMB_EXPLODE_PIXELS = 80;      // L1 blast radius in pixels
export const BOMB_EXPLODE_RADIUS = 80 / 16; // 5 tiles blast radius
export const EXACT_DAMAGE = true;           // fixed damage (no randomness)
export const ENTER_DELAY = 100;             // ticks (1 second respawn delay)
export const SNAPSHOT_RATE = 5;             // broadcast every N ticks (20Hz)
export const RECONNECT_TIMEOUT = 3000;      // ticks (30 seconds)
