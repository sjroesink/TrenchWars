export const TICK_RATE = 100;       // Hz, matching SubSpace
export const TICK_DT = 1 / TICK_RATE; // 0.01 seconds
export const TILE_SIZE = 16;        // pixels per tile
export const MAP_SIZE = 1024;       // tiles per side (1024x1024)
export const DEFAULT_BOUNCE_FACTOR = 0.65; // SVS formula: 16/BounceFactor. TW zones typically ~0.6-0.7

// Weapon constants (TW competitive settings)
export const BULLET_DAMAGE_LEVEL = 520;     // base bullet damage
export const BOMB_DAMAGE_LEVEL = 2650;      // bomb direct damage at center
export const BULLET_DAMAGE_UPGRADE = 520;   // per-level damage increase
export const BULLET_ALIVE_TIME = 800;       // ticks (8.0 seconds at 100Hz)
export const BOMB_ALIVE_TIME = 12000;       // ticks (120 seconds — long-lived bombs)
export const BOMB_EXPLODE_PIXELS = 150;     // blast radius in pixels
export const BOMB_EXPLODE_RADIUS = 150 / 16; // ~9.375 tiles blast radius
export const EXACT_DAMAGE = true;           // no random damage variance
export const ENTER_DELAY = 100;             // ticks (1 second respawn delay)
export const SNAPSHOT_RATE = 5;             // broadcast every N ticks (20Hz)
export const RECONNECT_TIMEOUT = 3000;      // ticks (30 seconds)
