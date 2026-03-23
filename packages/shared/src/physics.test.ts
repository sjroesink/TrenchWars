import { describe, it, expect } from 'vitest';
import { applyRotation, applyThrust, clampSpeed, updateEnergy, updateShipPhysics } from './physics';
import { WARBIRD } from './ships';
import { TICK_DT } from './constants';
import type { ShipState, ShipInput } from './types';

function makeState(overrides?: Partial<ShipState>): ShipState {
  return {
    x: 512,
    y: 512,
    vx: 0,
    vy: 0,
    orientation: 0,
    energy: 1000,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<ShipInput>): ShipInput {
  return {
    left: false,
    right: false,
    thrust: false,
    reverse: false,
    afterburner: false,
    ...overrides,
  };
}

describe('rotation', () => {
  it('rotates left (decreasing orientation) at correct rate', () => {
    const state = makeState({ orientation: 0 });
    const input = makeInput({ left: true });
    // 1 second at WARBIRD rotation = 0.525 rot/s -> orientation = 1 - 0.525 = 0.475
    applyRotation(state, input, WARBIRD, 1.0);
    expect(state.orientation).toBeCloseTo(0.475, 5);
  });

  it('rotates right (increasing orientation) and wraps past 1.0', () => {
    const state = makeState({ orientation: 0.95 });
    const input = makeInput({ right: true });
    // 0.2s at 0.525 rot/s -> +0.105 -> 1.055 wraps to 0.055
    applyRotation(state, input, WARBIRD, 0.2);
    expect(state.orientation).toBeCloseTo(0.055, 5);
  });

  it('does not change orientation when no keys pressed', () => {
    const state = makeState({ orientation: 0.5 });
    const input = makeInput();
    applyRotation(state, input, WARBIRD, 1.0);
    expect(state.orientation).toBe(0.5);
  });

  it('wraps left rotation below 0 correctly', () => {
    const state = makeState({ orientation: 0.1 });
    const input = makeInput({ left: true });
    // 1s at 0.525 -> 0.1 - 0.525 = -0.425 -> wraps to 0.575
    applyRotation(state, input, WARBIRD, 1.0);
    expect(state.orientation).toBeCloseTo(0.575, 5);
  });

  it('applies per-tick rotation correctly', () => {
    const state = makeState({ orientation: 0 });
    const input = makeInput({ right: true });
    applyRotation(state, input, WARBIRD, TICK_DT);
    // 0.01s * 0.525 = 0.00525
    expect(state.orientation).toBeCloseTo(0.00525, 6);
  });
});

describe('thrust', () => {
  it('adds velocity in facing direction (east, orientation=0)', () => {
    const state = makeState({ orientation: 0 });
    const input = makeInput({ thrust: true });
    applyThrust(state, input, WARBIRD, TICK_DT);
    // thrust=10.0, dt=0.01 -> dvx = cos(0)*10*0.01 = 0.1, dvy = sin(0)*10*0.01 = 0
    expect(state.vx).toBeCloseTo(0.1, 5);
    expect(state.vy).toBeCloseTo(0, 5);
  });

  it('adds velocity facing south (orientation=0.25)', () => {
    const state = makeState({ orientation: 0.25 });
    const input = makeInput({ thrust: true });
    applyThrust(state, input, WARBIRD, TICK_DT);
    // angle = 0.25 * 2PI = PI/2, cos(PI/2)~0, sin(PI/2)=1
    // dvx ~ 0, dvy = 10*0.01 = 0.1
    expect(state.vx).toBeCloseTo(0, 5);
    expect(state.vy).toBeCloseTo(0.1, 5);
  });

  it('uses afterburner thrust when afterburner active and energy > 0', () => {
    const state = makeState({ orientation: 0, energy: 500 });
    const input = makeInput({ thrust: true, afterburner: true });
    applyThrust(state, input, WARBIRD, TICK_DT);
    // maxThrust = 11.875, dt=0.01 -> dvx = 0.11875
    expect(state.vx).toBeCloseTo(0.11875, 5);
  });

  it('falls back to normal thrust when energy is 0', () => {
    const state = makeState({ orientation: 0, energy: 0 });
    const input = makeInput({ thrust: true, afterburner: true });
    applyThrust(state, input, WARBIRD, TICK_DT);
    // normal thrust=10.0, dt=0.01 -> dvx = 0.1
    expect(state.vx).toBeCloseTo(0.1, 5);
  });
});

describe('inertia', () => {
  it('velocity persists with no input -- NO drag, NO decay', () => {
    const state = makeState({ vx: 5.0, vy: 3.0 });
    const input = makeInput();
    // Apply thrust with no thrust pressed -- should NOT change velocity
    applyThrust(state, input, WARBIRD, TICK_DT);
    expect(state.vx).toBe(5.0);
    expect(state.vy).toBe(3.0);
  });

  it('velocity remains unchanged after full updateShipPhysics with no input', () => {
    const state = makeState({ vx: 7.5, vy: -2.5 });
    const input = makeInput();
    updateShipPhysics(state, input, WARBIRD, TICK_DT);
    expect(state.vx).toBe(7.5);
    expect(state.vy).toBe(-2.5);
  });
});

describe('speed clamp', () => {
  it('clamps speed above normal limit', () => {
    // velocity magnitude = sqrt(12^2 + 9^2) = 15.0 > 12.5625
    const state = makeState({ vx: 12, vy: 9 });
    const input = makeInput();
    clampSpeed(state, input, WARBIRD);
    const speed = Math.sqrt(state.vx ** 2 + state.vy ** 2);
    expect(speed).toBeCloseTo(12.5625, 3);
  });

  it('does NOT clamp speed below limit', () => {
    const state = makeState({ vx: 6, vy: 8 }); // magnitude = 10.0
    const input = makeInput();
    clampSpeed(state, input, WARBIRD);
    expect(state.vx).toBe(6);
    expect(state.vy).toBe(8);
  });

  it('uses maxSpeed when afterburner active and energy > 0', () => {
    // velocity magnitude = 18.0 < maxSpeed 20.3125 -> should NOT clamp
    const state = makeState({ vx: 18, vy: 0, energy: 500 });
    const input = makeInput({ afterburner: true });
    clampSpeed(state, input, WARBIRD);
    expect(state.vx).toBe(18);
  });

  it('clamps to normal speed when afterburner active but energy is 0', () => {
    const state = makeState({ vx: 18, vy: 0, energy: 0 });
    const input = makeInput({ afterburner: true });
    clampSpeed(state, input, WARBIRD);
    const speed = Math.sqrt(state.vx ** 2 + state.vy ** 2);
    expect(speed).toBeCloseTo(12.5625, 3);
  });

  it('preserves direction when clamping', () => {
    const state = makeState({ vx: 15, vy: 15 });
    const input = makeInput();
    const ratio = state.vy / state.vx;
    clampSpeed(state, input, WARBIRD);
    expect(state.vy / state.vx).toBeCloseTo(ratio, 5);
  });
});

describe('afterburner', () => {
  it('drains energy at afterburnerCost rate', () => {
    const state = makeState({ energy: 1000 });
    const input = makeInput({ afterburner: true });
    updateEnergy(state, input, WARBIRD, 1.0);
    // drain 120, recharge 40 -> net = 1000 - 120 + 40 = 920
    expect(state.energy).toBeCloseTo(920, 1);
  });

  it('does not drain when energy is 0', () => {
    const state = makeState({ energy: 0 });
    const input = makeInput({ afterburner: true });
    updateEnergy(state, input, WARBIRD, 1.0);
    // no drain (energy is 0), recharge 40
    expect(state.energy).toBeCloseTo(40, 1);
  });
});

describe('energy', () => {
  it('recharges at recharge rate per second', () => {
    const state = makeState({ energy: 500 });
    const input = makeInput();
    updateEnergy(state, input, WARBIRD, 1.0);
    expect(state.energy).toBeCloseTo(540, 1);
  });

  it('caps energy at maxEnergy', () => {
    const state = makeState({ energy: 1690 });
    const input = makeInput();
    updateEnergy(state, input, WARBIRD, 1.0);
    // 1690 + 40 = 1730 -> capped to 1700
    expect(state.energy).toBe(1700);
  });

  it('does not go below 0', () => {
    const state = makeState({ energy: 50 });
    const input = makeInput({ afterburner: true });
    updateEnergy(state, input, WARBIRD, 1.0);
    // 50 - 120 + 40 = -30 -> clamped to 0
    expect(state.energy).toBe(0);
  });
});

describe('updateShipPhysics', () => {
  it('applies thrust, rotation, speed clamp, and energy in order', () => {
    const state = makeState({ orientation: 0, energy: 1000 });
    const input = makeInput({ thrust: true, right: true });
    updateShipPhysics(state, input, WARBIRD, TICK_DT);
    // After one tick: vx increased, orientation increased, energy recharged
    expect(state.vx).toBeGreaterThan(0);
    expect(state.orientation).toBeGreaterThan(0);
  });
});
