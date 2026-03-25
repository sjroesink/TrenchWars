use std::collections::HashMap;
use std::f32::consts::TAU;

use tracing::debug;

use crate::config::{self, WeaponConfig};
use super::map::TileMap;
use super::physics::ShipState;

/// Projectile state.
#[derive(Debug, Clone)]
pub struct Projectile {
    pub id: u32,
    pub owner_id: String,
    pub is_bomb: bool,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub level: u32,
    pub bounces_remaining: i32,
    pub rear: bool,
    pub end_tick: u32,
}

/// Per-player cooldown tracking.
struct Cooldown {
    next_bullet_tick: u32,
    next_bomb_tick: u32,
    next_multifire_tick: u32,
}

/// Kill event.
#[derive(Debug, Clone)]
pub struct KillEvent {
    pub killer_id: String,
    pub killed_id: String,
    pub weapon_type: &'static str, // "bullet" or "bomb"
}

/// Manages projectiles, fire cooldowns, hit detection, and damage.
pub struct WeaponManager {
    pub projectiles: Vec<Projectile>,
    next_id: u32,
    cooldowns: HashMap<String, Cooldown>,
}

impl WeaponManager {
    pub fn new() -> Self {
        Self {
            projectiles: Vec::new(),
            next_id: 1,
            cooldowns: HashMap::new(),
        }
    }

    fn get_cooldown(&mut self, player_id: &str) -> &mut Cooldown {
        self.cooldowns.entry(player_id.to_string()).or_insert(Cooldown {
            next_bullet_tick: 0,
            next_bomb_tick: 0,
            next_multifire_tick: 0,
        })
    }

    /// Fire a bullet. Returns true if successful.
    pub fn fire_bullet(
        &mut self,
        ship: &mut ShipState,
        owner_id: &str,
        wc: &WeaponConfig,
        tick: u32,
    ) -> bool {
        let cd = self.get_cooldown(owner_id);
        if tick < cd.next_bullet_tick { return false; }
        if ship.energy < wc.bullet_fire_energy { return false; }

        ship.energy -= wc.bullet_fire_energy;
        let id = self.next_id;
        self.next_id += 1;

        let angle = ship.orientation * TAU;
        let hx = angle.cos();
        let hy = angle.sin();

        debug!("FIRE bullet {} by {} energy_left={:.0} pos=({:.1},{:.1})", id, &owner_id[..8], ship.energy, ship.x, ship.y);

        self.projectiles.push(Projectile {
            id,
            owner_id: owner_id.to_string(),
            is_bomb: false,
            x: ship.x,
            y: ship.y,
            vx: ship.vx + hx * wc.bullet_speed,
            vy: ship.vy + hy * wc.bullet_speed,
            level: 0,
            bounces_remaining: 0,
            rear: wc.bullet_speed < 0.0,
            end_tick: tick + config::BULLET_ALIVE_TICKS,
        });

        let cd = self.get_cooldown(owner_id);
        cd.next_bullet_tick = tick + (wc.bullet_fire_delay * 100.0).ceil() as u32;
        true
    }

    /// Fire a bomb with recoil. Returns true if successful.
    pub fn fire_bomb(
        &mut self,
        ship: &mut ShipState,
        owner_id: &str,
        wc: &WeaponConfig,
        tick: u32,
    ) -> bool {
        let cd = self.get_cooldown(owner_id);
        if tick < cd.next_bomb_tick { return false; }
        if ship.energy < wc.bomb_fire_energy { return false; }

        ship.energy -= wc.bomb_fire_energy;
        let id = self.next_id;
        self.next_id += 1;

        let angle = ship.orientation * TAU;
        let hx = angle.cos();
        let hy = angle.sin();

        self.projectiles.push(Projectile {
            id,
            owner_id: owner_id.to_string(),
            is_bomb: true,
            x: ship.x,
            y: ship.y,
            vx: ship.vx + hx * wc.bomb_speed,
            vy: ship.vy + hy * wc.bomb_speed,
            level: 0,
            bounces_remaining: wc.bomb_bounce_count as i32,
            rear: false,
            end_tick: tick + config::BOMB_ALIVE_TICKS,
        });

        // Apply recoil
        ship.vx -= hx * wc.bomb_thrust;
        ship.vy -= hy * wc.bomb_thrust;

        let cd = self.get_cooldown(owner_id);
        cd.next_bomb_tick = tick + (wc.bomb_fire_delay * 100.0).ceil() as u32;
        true
    }

    /// Fire multifire (e.g. Javelin 3-shot rear spread). Returns true if successful.
    pub fn fire_multifire(
        &mut self,
        ship: &mut ShipState,
        owner_id: &str,
        wc: &WeaponConfig,
        tick: u32,
    ) -> bool {
        if wc.multifire_count == 0 { return false; }
        let cd = self.get_cooldown(owner_id);
        if tick < cd.next_multifire_tick { return false; }
        if ship.energy < wc.multifire_energy { return false; }

        ship.energy -= wc.multifire_energy;
        let count = wc.multifire_count as i32;
        let base_angle = ship.orientation * TAU;
        let is_rear = wc.bullet_speed < 0.0;

        let fwd_x = base_angle.cos();
        let fwd_y = base_angle.sin();
        let perp_x = -fwd_y;
        let perp_y = fwd_x;

        let spawn_along = if is_rear { -1.2 } else { 1.2 };

        for i in 0..count {
            let offset_index = i as f32 - (count - 1) as f32 / 2.0;
            let angle = base_angle + offset_index * wc.multifire_angle;
            let hx = angle.cos();
            let hy = angle.sin();

            let lateral_offset = offset_index * 0.8;
            let spread_speed = offset_index * 1.5;

            let id = self.next_id;
            self.next_id += 1;

            self.projectiles.push(Projectile {
                id,
                owner_id: owner_id.to_string(),
                is_bomb: false,
                x: ship.x + fwd_x * spawn_along + perp_x * lateral_offset,
                y: ship.y + fwd_y * spawn_along + perp_y * lateral_offset,
                vx: ship.vx + hx * wc.bullet_speed + perp_x * spread_speed,
                vy: ship.vy + hy * wc.bullet_speed + perp_y * spread_speed,
                level: 0,
                bounces_remaining: 0,
                rear: is_rear,
                end_tick: tick + config::BULLET_ALIVE_TICKS,
            });
        }

        let cd = self.get_cooldown(owner_id);
        cd.next_multifire_tick = tick + (wc.multifire_delay * 100.0).ceil() as u32;
        true
    }

    /// Update all projectiles. Returns kill events.
    /// `alive_players`: list of (id, x, y, radius) for hit detection.
    pub fn update(
        &mut self,
        dt: f32,
        tick: u32,
        map: &TileMap,
        alive_players: &[(String, f32, f32, f32)],
    ) -> (Vec<KillEvent>, Vec<DamageEvent>) {
        let mut kills = Vec::new();
        let mut damages = Vec::new();
        let mut to_remove = Vec::new();

        for (idx, proj) in self.projectiles.iter_mut().enumerate() {
            // Timed out
            if tick >= proj.end_tick {
                to_remove.push(idx);
                continue;
            }

            // Move and check wall collision
            let status = update_projectile(proj, map, dt);

            if status == ProjStatus::WallExplode {
                // Bomb wall explosion: area damage
                if proj.is_bomb {
                    for (pid, px, py, _pr) in alive_players {
                        if pid == &proj.owner_id { continue; }
                        let dx = proj.x - px;
                        let dy = proj.y - py;
                        let distance = (dx * dx + dy * dy).sqrt();
                        let damage = calculate_bomb_damage(distance, proj.level);
                        if damage > 0.0 {
                            damages.push(DamageEvent {
                                player_id: pid.clone(),
                                amount: damage,
                                attacker_id: proj.owner_id.clone(),
                                weapon_type: "bomb",
                            });
                        }
                    }
                }
                to_remove.push(idx);
                continue;
            }

            // Hit detection against alive players
            let mut hit = false;
            for (pid, px, py, pr) in alive_players {
                if *pid == proj.owner_id { continue; }

                let dx = (proj.x - px).abs();
                let dy = (proj.y - py).abs();
                let hit_dist = config::PROJECTILE_RADIUS + pr;
                if dx < hit_dist && dy < hit_dist {
                    debug!("HIT! proj {} ({:.1},{:.1}) -> player {} ({:.1},{:.1}) dx={:.2} dy={:.2} hitdist={:.2}",
                        proj.id, proj.x, proj.y, &pid[..8], px, py, dx, dy, hit_dist);
                    if proj.is_bomb {
                        let damage = calculate_bomb_damage(0.0, proj.level);
                        damages.push(DamageEvent {
                            player_id: pid.clone(),
                            amount: damage,
                            attacker_id: proj.owner_id.clone(),
                            weapon_type: "bomb",
                        });
                    } else {
                        damages.push(DamageEvent {
                            player_id: pid.clone(),
                            amount: config::BULLET_DAMAGE_LEVEL,
                            attacker_id: proj.owner_id.clone(),
                            weapon_type: "bullet",
                        });
                    }
                    hit = true;
                    break;
                }
            }
            if hit {
                to_remove.push(idx);
            }
        }

        // Remove projectiles by marking indices, then retain non-removed
        let mut remove_set = vec![false; self.projectiles.len()];
        for idx in &to_remove {
            remove_set[*idx] = true;
        }
        let mut i = 0;
        self.projectiles.retain(|_| {
            let keep = !remove_set[i];
            i += 1;
            keep
        });

        (kills, damages)
    }

    pub fn remove_player(&mut self, player_id: &str) {
        self.cooldowns.remove(player_id);
    }
}

/// Damage event to be processed by the room.
#[derive(Debug)]
pub struct DamageEvent {
    pub player_id: String,
    pub amount: f32,
    pub attacker_id: String,
    pub weapon_type: &'static str,
}

#[derive(PartialEq)]
enum ProjStatus {
    Active,
    WallExplode,
}

/// Update projectile position with axis-separated wall collision.
fn update_projectile(proj: &mut Projectile, map: &TileMap, dt: f32) -> ProjStatus {
    let mut bounced_this_tick = false;

    // X axis
    let prev_x = proj.x;
    proj.x += proj.vx * dt;
    if map.is_colliding(proj.x, proj.y, config::PROJECTILE_RADIUS) {
        proj.x = prev_x;
        proj.vx = -proj.vx;
        if !proj.is_bomb { return ProjStatus::WallExplode; }
        if proj.bounces_remaining <= 0 { return ProjStatus::WallExplode; }
        proj.bounces_remaining -= 1;
        bounced_this_tick = true;
    }

    // Y axis
    let prev_y = proj.y;
    proj.y += proj.vy * dt;
    if map.is_colliding(proj.x, proj.y, config::PROJECTILE_RADIUS) {
        proj.y = prev_y;
        proj.vy = -proj.vy;
        if !proj.is_bomb { return ProjStatus::WallExplode; }
        if !bounced_this_tick {
            if proj.bounces_remaining <= 0 { return ProjStatus::WallExplode; }
            proj.bounces_remaining -= 1;
        }
    }

    ProjStatus::Active
}

/// Bomb area damage with linear falloff.
fn calculate_bomb_damage(distance: f32, bomb_level: u32) -> f32 {
    let explode_radius = config::BOMB_EXPLODE_RADIUS * (1.0 + bomb_level as f32);
    if distance >= explode_radius {
        return 0.0;
    }
    ((explode_radius - distance) * (config::BOMB_DAMAGE_LEVEL / explode_radius)).floor()
}
