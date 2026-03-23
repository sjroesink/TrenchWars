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
      x: 512,
      y: 512,
      vx: 0,
      vy: 0,
      orientation: 0,
      energy: 1000,
    };
    expect(state).toHaveProperty('x');
    expect(state).toHaveProperty('y');
    expect(state).toHaveProperty('vx');
    expect(state).toHaveProperty('vy');
    expect(state).toHaveProperty('orientation');
    expect(state).toHaveProperty('energy');
  });
});

describe('ShipInput interface', () => {
  it('has required fields', () => {
    const input: ShipInput = {
      left: false,
      right: false,
      thrust: false,
      afterburner: false,
    };
    expect(input).toHaveProperty('left');
    expect(input).toHaveProperty('right');
    expect(input).toHaveProperty('thrust');
    expect(input).toHaveProperty('afterburner');
  });
});

describe('TileMap interface', () => {
  it('has required fields', () => {
    const map: TileMap = {
      width: 32,
      height: 32,
      tiles: new Array(32 * 32).fill(0),
    };
    expect(map).toHaveProperty('width');
    expect(map).toHaveProperty('height');
    expect(map).toHaveProperty('tiles');
  });
});

describe('WARBIRD config', () => {
  it('has correct rotation: 210/400 = 0.525 rotations/s', () => {
    expect(WARBIRD.rotation).toBe(0.525);
  });

  it('has correct thrust: 16*10/16 = 10.0 tiles/s^2', () => {
    expect(WARBIRD.thrust).toBe(10);
  });

  it('has correct speed: 2010/10/16 = 12.5625 tiles/s', () => {
    expect(WARBIRD.speed).toBe(12.5625);
  });

  it('has correct maxSpeed: 3250/10/16 = 20.3125 tiles/s', () => {
    expect(WARBIRD.maxSpeed).toBe(20.3125);
  });

  it('has correct afterburnerCost: 1200/10 = 120 energy/s', () => {
    expect(WARBIRD.afterburnerCost).toBe(120);
  });

  it('has energy of 1000', () => {
    expect(WARBIRD.energy).toBe(1000);
  });

  it('has a radius property', () => {
    expect(WARBIRD.radius).toBeDefined();
    expect(typeof WARBIRD.radius).toBe('number');
  });
});

describe('JAVELIN config', () => {
  it('has correct rotation: 200/400 = 0.5 rotations/s', () => {
    expect(JAVELIN.rotation).toBe(0.5);
  });

  it('has correct speed: 2200/10/16 = 13.75 tiles/s', () => {
    expect(JAVELIN.speed).toBe(13.75);
  });
});

describe('SPIDER config', () => {
  it('has correct recharge: 500/10 = 50.0 energy/s', () => {
    expect(SPIDER.recharge).toBe(50);
  });

  it('has correct speed: 2010/10/16 = 12.5625 tiles/s', () => {
    expect(SPIDER.speed).toBe(12.5625);
  });

  it('has a radius property', () => {
    expect(SPIDER.radius).toBeDefined();
    expect(typeof SPIDER.radius).toBe('number');
  });
});
