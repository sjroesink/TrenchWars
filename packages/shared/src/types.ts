export interface ShipState {
  x: number;          // tile coordinates (0-1023)
  y: number;
  vx: number;         // tiles per second
  vy: number;
  orientation: number; // 0-1 (fraction of full rotation, 0 = east/right, CW positive)
  energy: number;
}

export interface ShipInput {
  left: boolean;
  right: boolean;
  thrust: boolean;
  reverse: boolean;
  afterburner: boolean;
  multifire: boolean;
}

export interface ShipConfig {
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
  rotation: number;        // full rotations per second
  thrust: number;          // tiles/s^2
  speed: number;           // tiles/s (max speed, hard cap)
  maxThrust: number;       // tiles/s^2 (afterburner thrust)
  maxSpeed: number;        // tiles/s (afterburner max speed)
  recharge: number;        // energy/second
  energy: number;          // starting energy
  maxRecharge: number;
  maxEnergy: number;
  afterburnerCost: number; // energy/second
  radius: number;          // tiles (ship collision radius)
}

export interface TileMap {
  width: number;   // tiles
  height: number;  // tiles
  tiles: number[]; // flat array, row-major. 0=empty, 1=wall
}

export interface WeaponConfig {
  bulletSpeed: number;       // tiles/s (converted from SVS: value / 10 / 16)
  bombSpeed: number;         // tiles/s
  bulletFireDelay: number;   // seconds (converted from SVS: value / 100)
  bombFireDelay: number;     // seconds
  bulletFireEnergy: number;  // energy cost per bullet
  bombFireEnergy: number;    // energy cost per bomb
  bombBounceCount: number;   // wall bounces before explosion
  bombThrust: number;        // tiles/s recoil on bomb fire (SVS: value / 100 * 10 / 16)
  multifireCount: number;    // number of bullets in multifire (0 = disabled)
  multifireEnergy: number;   // energy cost for multifire
  multifireDelay: number;    // seconds between multifire shots
  multifireAngle: number;    // spread angle in radians between each bullet
}

export interface ProjectileState {
  id: number;
  ownerId: string;
  type: 'bullet' | 'bomb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  level: number;
  bouncesRemaining: number;
  endTick: number;           // tick at which projectile despawns
}

export interface PlayerState {
  id: string;
  name: string;
  shipType: number;          // 0=Warbird, 1=Javelin, 2=Spider
  ship: ShipState;
  alive: boolean;
  kills: number;
  deaths: number;
  lastProcessedSeq: number;  // for client reconciliation
  respawnTick: number;       // tick when respawn is allowed (0 = active)
  sessionToken: string;      // for reconnection (generated server-side)
  disconnectedAt: number;    // tick when disconnected (0 = connected)
  team?: 0 | 1;              // team assignment (0 or 1, undefined if no team mode)
  spectating?: boolean;      // true if player is spectating (no ship, no physics)
}

export interface GameSnapshot {
  tick: number;
  players: {
    id: string;
    name: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    orientation: number;
    energy: number;
    shipType: number;
    alive: boolean;
    kills: number;
    deaths: number;
    lastProcessedSeq: number;
  }[];
  projectiles: {
    id: number;
    type: 'bullet' | 'bomb';
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: string;
  }[];
}
