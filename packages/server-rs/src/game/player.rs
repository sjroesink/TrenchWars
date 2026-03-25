use std::collections::HashMap;

use rand::Rng;
use uuid::Uuid;

use crate::config::{self, ShipConfig};
use super::map::TileMap;
use super::physics::ShipState;

/// Full player state.
#[derive(Debug, Clone)]
pub struct PlayerState {
    pub id: String,
    pub name: String,
    pub ship_type: u8,
    pub ship: ShipState,
    pub alive: bool,
    pub kills: u16,
    pub deaths: u16,
    pub last_processed_seq: u32,
    pub respawn_tick: u32,
    pub session_token: String,
    pub disconnected_at: u32,
}

/// Manages player lifecycle: join, leave, death, respawn, damage.
pub struct PlayerManager {
    players: HashMap<String, PlayerState>,
}

impl PlayerManager {
    pub fn new() -> Self {
        Self {
            players: HashMap::new(),
        }
    }

    pub fn add_player(&mut self, id: &str, name: &str, ship_type: u8) -> &mut PlayerState {
        let config = config::ship_config(ship_type);
        let player = PlayerState {
            id: id.to_string(),
            name: name.to_string(),
            ship_type,
            ship: ShipState {
                x: 0.0,
                y: 0.0,
                vx: 0.0,
                vy: 0.0,
                orientation: 0.0,
                energy: config.energy,
            },
            alive: true,
            kills: 0,
            deaths: 0,
            last_processed_seq: 0,
            respawn_tick: 0,
            session_token: Uuid::new_v4().to_string(),
            disconnected_at: 0,
        };
        self.players.insert(id.to_string(), player);
        self.players.get_mut(id).unwrap()
    }

    pub fn remove_player(&mut self, id: &str) -> bool {
        self.players.remove(id).is_some()
    }

    pub fn get_player(&self, id: &str) -> Option<&PlayerState> {
        self.players.get(id)
    }

    pub fn get_player_mut(&mut self, id: &str) -> Option<&mut PlayerState> {
        self.players.get_mut(id)
    }

    /// Get all alive, connected, non-spectating player IDs.
    pub fn alive_player_ids(&self) -> Vec<String> {
        self.players
            .values()
            .filter(|p| p.alive && p.disconnected_at == 0)
            .map(|p| p.id.clone())
            .collect()
    }

    /// Get all player IDs.
    pub fn all_player_ids(&self) -> Vec<String> {
        self.players.keys().cloned().collect()
    }

    /// Get all connected player count.
    pub fn connected_count(&self) -> usize {
        self.players
            .values()
            .filter(|p| p.disconnected_at == 0)
            .count()
    }

    /// Find a valid spawn position that doesn't collide with walls.
    pub fn find_spawn_position(map: &TileMap, radius: f32) -> (f32, f32) {
        let mut rng = rand::rng();
        let min_x = 2.0_f32;
        let max_x = map.width as f32 - 2.0;
        let min_y = 2.0_f32;
        let max_y = map.height as f32 - 2.0;

        for _ in 0..100 {
            let x = rng.random_range(min_x..max_x);
            let y = rng.random_range(min_y..max_y);
            if !map.is_colliding(x, y, radius) {
                return (x, y);
            }
        }

        (map.width as f32 / 2.0, map.height as f32 / 2.0)
    }

    /// Kill a player. Returns kill info.
    pub fn kill_player(
        &mut self,
        killed_id: &str,
        killer_id: &str,
        current_tick: u32,
    ) -> bool {
        if let Some(killed) = self.players.get_mut(killed_id) {
            killed.alive = false;
            killed.deaths += 1;
            killed.respawn_tick = current_tick + config::ENTER_DELAY;
        }
        if killer_id != killed_id {
            if let Some(killer) = self.players.get_mut(killer_id) {
                killer.kills += 1;
            }
        }
        true
    }

    /// Respawn a dead player if enough time has passed.
    pub fn respawn_player(&mut self, id: &str, map: &TileMap, tick: u32) -> bool {
        let Some(player) = self.players.get_mut(id) else {
            return false;
        };
        if tick < player.respawn_tick {
            return false;
        }

        let config = config::ship_config(player.ship_type);
        let (x, y) = Self::find_spawn_position(map, config.radius);

        player.alive = true;
        player.ship.x = x;
        player.ship.y = y;
        player.ship.vx = 0.0;
        player.ship.vy = 0.0;
        player.ship.energy = config.energy;
        true
    }

    /// Apply damage to a player. Returns true if dead.
    pub fn apply_damage(&mut self, id: &str, amount: f32) -> bool {
        let Some(player) = self.players.get_mut(id) else {
            return false;
        };
        player.ship.energy -= amount;
        player.ship.energy <= 0.0
    }

    /// Mark player as disconnected.
    pub fn hold_player(&mut self, id: &str, tick: u32) {
        if let Some(player) = self.players.get_mut(id) {
            player.disconnected_at = tick;
        }
    }

    /// Attempt reconnection via session token.
    pub fn restore_player(&mut self, session_token: &str, current_tick: u32) -> Option<String> {
        for player in self.players.values_mut() {
            if player.session_token == session_token && player.disconnected_at > 0 {
                if current_tick - player.disconnected_at <= config::RECONNECT_TIMEOUT {
                    player.disconnected_at = 0;
                    return Some(player.id.clone());
                }
                return None;
            }
        }
        None
    }

    /// Remove players whose disconnect timeout has expired.
    pub fn cleanup_disconnected(&mut self, current_tick: u32) {
        self.players.retain(|_, p| {
            p.disconnected_at == 0
                || current_tick - p.disconnected_at <= config::RECONNECT_TIMEOUT
        });
    }

    /// Iterate all players (for snapshots).
    pub fn iter(&self) -> impl Iterator<Item = &PlayerState> {
        self.players.values()
    }
}
