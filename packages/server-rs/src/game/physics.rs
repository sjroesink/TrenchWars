use std::f32::consts::TAU;

use crate::config::ShipConfig;

/// Ship state (position, velocity, orientation, energy).
#[derive(Debug, Clone)]
pub struct ShipState {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub orientation: f32, // 0-1 (fraction of full rotation, 0=east, CW positive)
    pub energy: f32,
}

/// Ship input flags.
#[derive(Debug, Clone, Default)]
pub struct ShipInput {
    pub left: bool,
    pub right: bool,
    pub thrust: bool,
    pub reverse: bool,
    pub afterburner: bool,
    pub multifire: bool,
}

/// Full physics update for one tick. Order: thrust -> rotation -> speed clamp -> energy.
pub fn update_ship_physics(state: &mut ShipState, input: &ShipInput, config: &ShipConfig, dt: f32) {
    apply_thrust(state, input, config, dt);
    apply_rotation(state, input, config, dt);
    clamp_speed(state, input, config);
    update_energy(state, input, config, dt);
}

fn apply_rotation(state: &mut ShipState, input: &ShipInput, config: &ShipConfig, dt: f32) {
    if input.left {
        state.orientation -= config.rotation * dt;
    }
    if input.right {
        state.orientation += config.rotation * dt;
    }
    if state.orientation < 0.0 {
        state.orientation += 1.0;
    }
    if state.orientation >= 1.0 {
        state.orientation -= 1.0;
    }
}

fn apply_thrust(state: &mut ShipState, input: &ShipInput, config: &ShipConfig, dt: f32) {
    if !input.thrust && !input.reverse {
        return;
    }

    let thrust_value = if input.afterburner && state.energy > 0.0 {
        config.max_thrust
    } else {
        config.thrust
    };
    let angle = state.orientation * TAU;
    let direction = if input.reverse { -1.0 } else { 1.0 };
    state.vx += angle.cos() * thrust_value * dt * direction;
    state.vy += angle.sin() * thrust_value * dt * direction;
}

fn clamp_speed(state: &mut ShipState, input: &ShipInput, config: &ShipConfig) {
    let speed_limit = if input.afterburner && state.energy > 0.0 {
        config.max_speed
    } else {
        config.speed
    };
    let current_speed = (state.vx * state.vx + state.vy * state.vy).sqrt();
    if current_speed > speed_limit {
        let scale = speed_limit / current_speed;
        state.vx *= scale;
        state.vy *= scale;
    }
}

fn update_energy(state: &mut ShipState, input: &ShipInput, config: &ShipConfig, dt: f32) {
    if input.afterburner && (input.thrust || input.reverse) && state.energy > 0.0 {
        state.energy -= config.afterburner_cost * dt;
    }
    state.energy += config.recharge * dt;
    state.energy = state.energy.clamp(0.0, config.max_energy);
}
