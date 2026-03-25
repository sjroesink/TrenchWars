use std::f32::consts::TAU;

/// Ship physics configuration (converted from SubSpace raw values).
#[derive(Debug, Clone)]
pub struct ShipConfig {
    pub name: &'static str,
    pub rotation: f32,        // full rotations per second
    pub thrust: f32,          // tiles/s^2
    pub speed: f32,           // tiles/s (max speed, hard cap)
    pub max_thrust: f32,      // tiles/s^2 (afterburner thrust)
    pub max_speed: f32,       // tiles/s (afterburner max speed)
    pub recharge: f32,        // energy/second
    pub energy: f32,          // starting energy
    pub max_recharge: f32,
    pub max_energy: f32,
    pub afterburner_cost: f32, // energy/second
    pub radius: f32,           // tiles (ship collision radius)
}

/// Weapon configuration per ship type.
#[derive(Debug, Clone)]
pub struct WeaponConfig {
    pub bullet_speed: f32,       // tiles/s (negative = rear-firing)
    pub bomb_speed: f32,
    pub bullet_fire_delay: f32,  // seconds
    pub bomb_fire_delay: f32,
    pub bullet_fire_energy: f32,
    pub bomb_fire_energy: f32,
    pub bomb_bounce_count: u32,
    pub bomb_thrust: f32,        // recoil tiles/s
    pub multifire_count: u32,
    pub multifire_energy: f32,
    pub multifire_delay: f32,
    pub multifire_angle: f32,    // radians
    pub has_bomb: bool,
}

// SVS conversion helpers
fn convert_ship(
    name: &'static str,
    raw_rotation: f32,
    raw_thrust: f32,
    raw_speed: f32,
    raw_max_thrust: f32,
    raw_max_speed: f32,
    raw_recharge: f32,
    raw_energy: f32,
    raw_max_recharge: f32,
    raw_max_energy: f32,
    raw_afterburner_energy: f32,
    radius: f32,
) -> ShipConfig {
    ShipConfig {
        name,
        rotation: raw_rotation / 400.0,
        thrust: raw_thrust * 10.0 / 16.0,
        speed: raw_speed / 10.0 / 16.0,
        max_thrust: raw_max_thrust * 10.0 / 16.0,
        max_speed: raw_max_speed / 10.0 / 16.0,
        recharge: raw_recharge / 10.0,
        energy: raw_energy,
        max_recharge: raw_max_recharge / 10.0,
        max_energy: raw_max_energy,
        afterburner_cost: raw_afterburner_energy / 10.0,
        radius,
    }
}

pub fn warbird() -> ShipConfig {
    convert_ship("Warbird", 200.0, 16.0, 2000.0, 24.0, 6000.0, 4000.0, 1500.0, 4000.0, 1500.0, 5500.0, 14.0 / 16.0)
}

pub fn javelin() -> ShipConfig {
    convert_ship("Javelin", 200.0, 13.0, 1900.0, 24.0, 6000.0, 1500.0, 1500.0, 1500.0, 1500.0, 5500.0, 14.0 / 16.0)
}

pub fn spider() -> ShipConfig {
    convert_ship("Spider", 180.0, 18.0, 1700.0, 24.0, 6000.0, 2500.0, 1400.0, 2500.0, 1400.0, 6200.0, 14.0 / 16.0)
}

pub fn warbird_weapons() -> WeaponConfig {
    WeaponConfig {
        bullet_speed: 5000.0 / 10.0 / 16.0,
        bomb_speed: 0.0,
        bullet_fire_delay: 100.0 / 100.0,
        bomb_fire_delay: 0.0,
        bullet_fire_energy: 450.0,
        bomb_fire_energy: 0.0,
        bomb_bounce_count: 0,
        bomb_thrust: 0.0,
        multifire_count: 0,
        multifire_energy: 450.0,
        multifire_delay: 100.0 / 100.0,
        multifire_angle: 0.0,
        has_bomb: false,
    }
}

pub fn javelin_weapons() -> WeaponConfig {
    WeaponConfig {
        bullet_speed: -600.0 / 10.0 / 16.0,
        bomb_speed: 2250.0 / 10.0 / 16.0,
        bullet_fire_delay: 60.0 / 100.0,
        bomb_fire_delay: 40.0 / 100.0,
        bullet_fire_energy: 300.0,
        bomb_fire_energy: 1100.0,
        bomb_bounce_count: 1,
        bomb_thrust: 50.0 / 100.0 * 10.0 / 16.0,
        multifire_count: 3,
        multifire_energy: 450.0,
        multifire_delay: 150.0 / 100.0,
        multifire_angle: 0.15,
        has_bomb: true,
    }
}

pub fn spider_weapons() -> WeaponConfig {
    WeaponConfig {
        bullet_speed: 4000.0 / 10.0 / 16.0,
        bomb_speed: 2000.0 / 10.0 / 16.0,
        bullet_fire_delay: 35.0 / 100.0,
        bomb_fire_delay: 50.0 / 100.0,
        bullet_fire_energy: 225.0,
        bomb_fire_energy: 300.0,
        bomb_bounce_count: 0,
        bomb_thrust: 50.0 / 100.0 * 10.0 / 16.0,
        multifire_count: 0,
        multifire_energy: 225.0,
        multifire_delay: 35.0 / 100.0,
        multifire_angle: 0.0,
        has_bomb: true,
    }
}

/// Get ship config by type number (0=Warbird, 1=Javelin, 2=Spider).
pub fn ship_config(ship_type: u8) -> ShipConfig {
    match ship_type {
        0 => warbird(),
        1 => javelin(),
        2 => spider(),
        _ => warbird(),
    }
}

/// Get weapon config by ship type number.
pub fn weapon_config(ship_type: u8) -> WeaponConfig {
    match ship_type {
        0 => warbird_weapons(),
        1 => javelin_weapons(),
        2 => spider_weapons(),
        _ => warbird_weapons(),
    }
}

// Game constants
pub const TICK_RATE: u32 = 100;
pub const TICK_DT: f32 = 0.01;
pub const SNAPSHOT_RATE: u32 = 5;
pub const DEFAULT_BOUNCE_FACTOR: f32 = 0.65;
pub const BULLET_ALIVE_TICKS: u32 = 800;
pub const BOMB_ALIVE_TICKS: u32 = 12000;
pub const BOMB_EXPLODE_RADIUS: f32 = 150.0 / 16.0;
pub const BOMB_DAMAGE_LEVEL: f32 = 2650.0;
pub const BULLET_DAMAGE_LEVEL: f32 = 520.0;
pub const ENTER_DELAY: u32 = 100;
pub const RECONNECT_TIMEOUT: u32 = 3000;
pub const PROJECTILE_RADIUS: f32 = 0.1;
pub const MAX_PLAYERS_PER_ROOM: usize = 20;
pub const FFA_SCORE_LIMIT: u32 = 20;

// Suppress unused warning for TAU import (used conceptually in physics)
const _: f32 = TAU;
