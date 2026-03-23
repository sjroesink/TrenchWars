import { describe, it, expect } from 'vitest';
import { WARBIRD, JAVELIN, SPIDER } from './ships';
import { TICK_RATE, TICK_DT, TILE_SIZE } from './constants';
import type { ShipState, ShipInput, ShipConfig, TileMap } from './types';

describe('constants', () => {
  it('TICK_RATE is 100 Hz', () => {
    expect(TICK_RATE).toBe(100);
  });

  it('TICK_DT is 0.01 seconds', () => {
    expect(TICK_DT).toBe(0.01);
  });

  it('TILE_SIZE is 16 pixels', () => {
    expect(TILE_SIZE).toBe(16);
  });
});

describe('ShipState interface', () => {
  it('has required fields', () => {
    const state: ShipState = {
      x: 512, y: 512, vx: 0, vy: 0, orientation: 0, energy: 1000,
    };
    expect(state).toHaveProperty('x');
    expect(state).toHaveProperty('energy');
  });
});

describe('ShipInput interface', () => {
  it('has required fields', () => {
    const input: ShipInput = {
      left: false, right: false, thrust: false, reverse: false, afterburner: false, multifire: false,
    };
    expect(input).toHaveProperty('thrust');
    expect(input).toHaveProperty('reverse');
  });
});

describe('TileMap interface', () => {
  it('has required fields', () => {
    const map: TileMap = { width: 32, height: 32, tiles: new Array(32 * 32).fill(0) };
    expect(map).toHaveProperty('tiles');
  });
});

// TW competitive settings: Warbird E0=1500, R=4000, AB=5500, Rot=200, V0=2000, Vmax=6000, T0=16, Tmax=24
describe('WARBIRD config (TW competitive)', () => {
  it('rotation: 200/400 = 0.5 rotations/s', () => {
    expect(WARBIRD.rotation).toBe(0.5);
  });

  it('thrust: 16*10/16 = 10.0 tiles/s^2', () => {
    expect(WARBIRD.thrust).toBe(10);
  });

  it('speed: 2000/10/16 = 12.5 tiles/s', () => {
    expect(WARBIRD.speed).toBe(12.5);
  });

  it('maxSpeed: 6000/10/16 = 37.5 tiles/s', () => {
    expect(WARBIRD.maxSpeed).toBe(37.5);
  });

  it('maxThrust: 24*10/16 = 15.0 tiles/s^2', () => {
    expect(WARBIRD.maxThrust).toBe(15);
  });

  it('afterburnerCost: 5500/10 = 550 energy/s', () => {
    expect(WARBIRD.afterburnerCost).toBe(550);
  });

  it('energy: 1500', () => {
    expect(WARBIRD.energy).toBe(1500);
  });

  it('recharge: 4000/10 = 400 energy/s', () => {
    expect(WARBIRD.recharge).toBe(400);
  });

  it('has a radius property', () => {
    expect(typeof WARBIRD.radius).toBe('number');
  });
});

// TW competitive: Javelin E0=1500, R=1500, AB=5500, Rot=200, V0=1900, Vmax=6000, T0=13, Tmax=24
describe('JAVELIN config (TW competitive)', () => {
  it('rotation: 200/400 = 0.5 rotations/s', () => {
    expect(JAVELIN.rotation).toBe(0.5);
  });

  it('speed: 1900/10/16 = 11.875 tiles/s', () => {
    expect(JAVELIN.speed).toBe(11.875);
  });

  it('thrust: 13*10/16 = 8.125 tiles/s^2', () => {
    expect(JAVELIN.thrust).toBe(8.125);
  });

  it('recharge: 1500/10 = 150 energy/s (low recharge)', () => {
    expect(JAVELIN.recharge).toBe(150);
  });
});

// TW competitive: Spider E0=1400, R=2500, AB=6200, Rot=180, V0=1700, Vmax=6000, T0=18, Tmax=24
describe('SPIDER config (TW competitive)', () => {
  it('rotation: 180/400 = 0.45 rotations/s', () => {
    expect(SPIDER.rotation).toBe(0.45);
  });

  it('speed: 1700/10/16 = 10.625 tiles/s', () => {
    expect(SPIDER.speed).toBe(10.625);
  });

  it('thrust: 18*10/16 = 11.25 tiles/s^2', () => {
    expect(SPIDER.thrust).toBe(11.25);
  });

  it('recharge: 2500/10 = 250 energy/s', () => {
    expect(SPIDER.recharge).toBe(250);
  });

  it('afterburnerCost: 6200/10 = 620 energy/s (high drain)', () => {
    expect(SPIDER.afterburnerCost).toBe(620);
  });

  it('has a radius property', () => {
    expect(typeof SPIDER.radius).toBe('number');
  });
});
