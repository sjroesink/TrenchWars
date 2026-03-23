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
  afterburner: boolean;
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
