import { describe, it, expect } from 'vitest';
import { applyRotation, applyThrust, clampSpeed, updateEnergy, updateShipPhysics } from './physics';
import { WARBIRD } from './ships';
import { TICK_DT } from './constants';
import type { ShipState, ShipInput } from './types';

function makeState(overrides?: Partial<ShipState>): ShipState {
  return {
    x: 512, y: 512, vx: 0, vy: 0, orientation: 0, energy: 1500,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<ShipInput>): ShipInput {
  return {
    left: false, right: false, thrust: false, reverse: false, afterburner: false,
    ...overrides,
  };
}

// TW Warbird: rotation=0.5, thrust=10.0, speed=12.5, maxSpeed=37.5,
// maxThrust=15.0, recharge=400, energy=1500, maxEnergy=1500, afterburnerCost=550

describe('rotation', () => {
  it('rotates left at correct rate', () => {
    const state = makeState({ orientation: 0 });
    applyRotation(state, makeInput({ left: true }), WARBIRD, 1.0);
    // 1s at 0.5 rot/s -> 0 - 0.5 = -0.5 -> wraps to 0.5
    expect(state.orientation).toBeCloseTo(0.5, 5);
  });

  it('rotates right and wraps past 1.0', () => {
    const state = makeState({ orientation: 0.8 });
    applyRotation(state, makeInput({ right: true }), WARBIRD, 0.5);
    // 0.5s at 0.5 rot/s -> +0.25 -> 1.05 wraps to 0.05
    expect(state.orientation).toBeCloseTo(0.05, 5);
  });

  it('does not change when no keys pressed', () => {
    const state = makeState({ orientation: 0.5 });
    applyRotation(state, makeInput(), WARBIRD, 1.0);
    expect(state.orientation).toBe(0.5);
  });

  it('wraps left rotation below 0', () => {
    const state = makeState({ orientation: 0.1 });
    applyRotation(state, makeInput({ left: true }), WARBIRD, 1.0);
    // 0.1 - 0.5 = -0.4 -> wraps to 0.6
    expect(state.orientation).toBeCloseTo(0.6, 5);
  });

  it('applies per-tick rotation correctly', () => {
    const state = makeState({ orientation: 0 });
    applyRotation(state, makeInput({ right: true }), WARBIRD, TICK_DT);
    // 0.01s * 0.5 = 0.005
    expect(state.orientation).toBeCloseTo(0.005, 6);
  });
});

describe('thrust', () => {
  it('adds velocity in facing direction (east)', () => {
    const state = makeState({ orientation: 0 });
    applyThrust(state, makeInput({ thrust: true }), WARBIRD, TICK_DT);
    // thrust=10.0, dt=0.01 -> dvx=0.1
    expect(state.vx).toBeCloseTo(0.1, 5);
    expect(state.vy).toBeCloseTo(0, 5);
  });

  it('adds velocity facing south (orientation=0.25)', () => {
    const state = makeState({ orientation: 0.25 });
    applyThrust(state, makeInput({ thrust: true }), WARBIRD, TICK_DT);
    expect(state.vx).toBeCloseTo(0, 5);
    expect(state.vy).toBeCloseTo(0.1, 5);
  });

  it('reverse thrust subtracts velocity', () => {
    const state = makeState({ orientation: 0 });
    applyThrust(state, makeInput({ reverse: true }), WARBIRD, TICK_DT);
    // thrust=10.0, dt=0.01, direction=-1 -> dvx=-0.1
    expect(state.vx).toBeCloseTo(-0.1, 5);
  });

  it('uses afterburner thrust when active and energy > 0', () => {
    const state = makeState({ orientation: 0, energy: 500 });
    applyThrust(state, makeInput({ thrust: true, afterburner: true }), WARBIRD, TICK_DT);
    // maxThrust=15.0, dt=0.01 -> dvx=0.15
    expect(state.vx).toBeCloseTo(0.15, 5);
  });

  it('falls back to normal thrust when energy is 0', () => {
    const state = makeState({ orientation: 0, energy: 0 });
    applyThrust(state, makeInput({ thrust: true, afterburner: true }), WARBIRD, TICK_DT);
    expect(state.vx).toBeCloseTo(0.1, 5);
  });
});

describe('inertia', () => {
  it('velocity persists with no input -- NO drag', () => {
    const state = makeState({ vx: 5.0, vy: 3.0 });
    applyThrust(state, makeInput(), WARBIRD, TICK_DT);
    expect(state.vx).toBe(5.0);
    expect(state.vy).toBe(3.0);
  });

  it('velocity unchanged after full update with no input', () => {
    const state = makeState({ vx: 7.5, vy: -2.5 });
    updateShipPhysics(state, makeInput(), WARBIRD, TICK_DT);
    expect(state.vx).toBe(7.5);
    expect(state.vy).toBe(-2.5);
  });
});

describe('speed clamp', () => {
  it('clamps speed above normal limit', () => {
    const state = makeState({ vx: 12, vy: 9 }); // magnitude=15 > 12.5
    clampSpeed(state, makeInput(), WARBIRD);
    const speed = Math.sqrt(state.vx ** 2 + state.vy ** 2);
    expect(speed).toBeCloseTo(12.5, 3);
  });

  it('does NOT clamp speed below limit', () => {
    const state = makeState({ vx: 6, vy: 8 }); // magnitude=10 < 12.5
    clampSpeed(state, makeInput(), WARBIRD);
    expect(state.vx).toBe(6);
    expect(state.vy).toBe(8);
  });

  it('uses maxSpeed when afterburner active and energy > 0', () => {
    const state = makeState({ vx: 30, vy: 0, energy: 500 }); // 30 < 37.5
    clampSpeed(state, makeInput({ afterburner: true }), WARBIRD);
    expect(state.vx).toBe(30);
  });

  it('clamps to normal speed when afterburner active but energy is 0', () => {
    const state = makeState({ vx: 18, vy: 0, energy: 0 });
    clampSpeed(state, makeInput({ afterburner: true }), WARBIRD);
    expect(Math.sqrt(state.vx ** 2 + state.vy ** 2)).toBeCloseTo(12.5, 3);
  });

  it('preserves direction when clamping', () => {
    const state = makeState({ vx: 15, vy: 15 });
    const ratio = state.vy / state.vx;
    clampSpeed(state, makeInput(), WARBIRD);
    expect(state.vy / state.vx).toBeCloseTo(ratio, 5);
  });
});

describe('afterburner energy', () => {
  it('drains at afterburnerCost rate', () => {
    const state = makeState({ energy: 1500 });
    updateEnergy(state, makeInput({ afterburner: true }), WARBIRD, 1.0);
    // drain 550, recharge 400 -> 1500 - 550 + 400 = 1350
    expect(state.energy).toBeCloseTo(1350, 1);
  });

  it('does not drain when energy is 0', () => {
    const state = makeState({ energy: 0 });
    updateEnergy(state, makeInput({ afterburner: true }), WARBIRD, 1.0);
    // no drain, recharge 400 -> capped at maxEnergy=1500
    expect(state.energy).toBeCloseTo(400, 1);
  });
});

describe('energy', () => {
  it('recharges at recharge rate', () => {
    const state = makeState({ energy: 500 });
    updateEnergy(state, makeInput(), WARBIRD, 1.0);
    // 500 + 400 = 900
    expect(state.energy).toBeCloseTo(900, 1);
  });

  it('caps at maxEnergy', () => {
    const state = makeState({ energy: 1400 });
    updateEnergy(state, makeInput(), WARBIRD, 1.0);
    // 1400 + 400 = 1800 -> capped to 1500
    expect(state.energy).toBe(1500);
  });

  it('does not go below 0', () => {
    const state = makeState({ energy: 50 });
    updateEnergy(state, makeInput({ afterburner: true }), WARBIRD, 1.0);
    // 50 - 550 + 400 = -100 -> clamped to 0
    expect(state.energy).toBe(0);
  });
});

describe('updateShipPhysics', () => {
  it('applies thrust, rotation, speed clamp, and energy in order', () => {
    const state = makeState({ orientation: 0, energy: 1500 });
    updateShipPhysics(state, makeInput({ thrust: true, right: true }), WARBIRD, TICK_DT);
    expect(state.vx).toBeGreaterThan(0);
    expect(state.orientation).toBeGreaterThan(0);
  });
});
