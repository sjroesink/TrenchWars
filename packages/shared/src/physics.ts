import type { ShipState, ShipInput, ShipConfig } from './types';

/**
 * Apply rotation to ship based on left/right input.
 * Orientation is 0-1 (fraction of full rotation), 0 = east, CW positive.
 */
export function applyRotation(
  state: ShipState,
  input: ShipInput,
  config: ShipConfig,
  dt: number,
): void {
  if (input.left) {
    state.orientation -= config.rotation * dt;
  }
  if (input.right) {
    state.orientation += config.rotation * dt;
  }
  // Wrap to [0, 1)
  if (state.orientation < 0) {
    state.orientation += 1;
  }
  if (state.orientation >= 1) {
    state.orientation -= 1;
  }
}

/**
 * Apply thrust in facing direction. Does NOT apply any drag or decay.
 * When thrust is not pressed, velocity remains EXACTLY unchanged.
 */
export function applyThrust(
  state: ShipState,
  input: ShipInput,
  config: ShipConfig,
  dt: number,
): void {
  if (!input.thrust && !input.reverse) {
    return;
  }

  const thrustValue =
    input.afterburner && state.energy > 0 ? config.maxThrust : config.thrust;
  const angle = state.orientation * Math.PI * 2;
  const direction = input.reverse ? -1 : 1;
  state.vx += Math.cos(angle) * thrustValue * dt * direction;
  state.vy += Math.sin(angle) * thrustValue * dt * direction;
}

/**
 * Hard-clamp speed using Truncate method (NOT drag).
 * If speed exceeds limit, scale velocity to limit. Never reduces speed below limit.
 */
export function clampSpeed(
  state: ShipState,
  input: ShipInput,
  config: ShipConfig,
): void {
  const speedLimit =
    input.afterburner && state.energy > 0 ? config.maxSpeed : config.speed;
  const currentSpeed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);

  if (currentSpeed > speedLimit) {
    const scale = speedLimit / currentSpeed;
    state.vx *= scale;
    state.vy *= scale;
  }
}

/**
 * Update energy: afterburner drain and recharge.
 */
export function updateEnergy(
  state: ShipState,
  input: ShipInput,
  config: ShipConfig,
  dt: number,
): void {
  if (input.afterburner && state.energy > 0) {
    state.energy -= config.afterburnerCost * dt;
  }
  state.energy += config.recharge * dt;
  state.energy = Math.max(0, Math.min(config.maxEnergy, state.energy));
}

/**
 * Full physics update for one tick. Order: thrust -> rotation -> speed clamp -> energy.
 * Position update and collision are handled separately.
 */
export function updateShipPhysics(
  state: ShipState,
  input: ShipInput,
  config: ShipConfig,
  dt: number,
): void {
  applyThrust(state, input, config, dt);
  applyRotation(state, input, config, dt);
  clampSpeed(state, input, config);
  updateEnergy(state, input, config, dt);
}
