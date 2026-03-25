use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::Instant;

use tokio::sync::Mutex;
use tracing::{debug, info};

use crate::config::{self, ShipConfig, WeaponConfig};
use crate::protocol::binary::{self, SnapshotPlayer, SnapshotProjectile};
use crate::protocol::messages::{ServerMsg, server_msg};
use crate::transport::ConnectionHandle;

use super::map::{self, TileMap};
use super::physics::{self, ShipInput, ShipState};
use super::player::{PlayerManager, PlayerState};
use super::weapon::{WeaponManager, KillEvent};
use crate::game_modes::GameMode;
use crate::game_modes::ffa::FFAMode;

/// Queued input from a client.
#[derive(Debug)]
pub(crate) struct QueuedInput {
    seq: u32,
    input: ShipInput,
    fire: bool,
    fire_bomb: bool,
    multifire: bool,
}

/// Shared room state, protected by a mutex for async access.
pub struct RoomState {
    pub id: String,
    pub name: String,
    pub map: TileMap,
    pub max_players: usize,

    pub player_manager: PlayerManager,
    pub weapon_manager: WeaponManager,
    pub game_mode: Box<dyn GameMode>,
    pub clients: HashMap<String, ConnectionHandle>,
    pub input_queues: HashMap<String, VecDeque<QueuedInput>>,
    pub tick_count: u32,
}

impl RoomState {
    /// Broadcast a reliable JSON message to all connected clients.
    pub fn broadcast(&self, msg: &str) {
        for conn in self.clients.values() {
            conn.send_reliable(msg.to_string());
        }
    }

    /// Broadcast unreliable binary data to all connected clients.
    pub fn broadcast_unreliable(&self, data: &[u8]) {
        for conn in self.clients.values() {
            conn.send_unreliable(data.to_vec());
        }
    }
}

/// A self-contained arena room with its own game loop.
pub type SharedRoom = Arc<Mutex<RoomState>>;

/// Create a new room.
pub fn create_room(id: &str, name: &str, map: TileMap, max_players: usize) -> SharedRoom {
    Arc::new(Mutex::new(RoomState {
        id: id.to_string(),
        name: name.to_string(),
        map,
        max_players,
        player_manager: PlayerManager::new(),
        weapon_manager: WeaponManager::new(),
        game_mode: Box::new(FFAMode::new(config::FFA_SCORE_LIMIT)),
        clients: HashMap::new(),
        input_queues: HashMap::new(),
        tick_count: 0,
    }))
}

/// Start the 100Hz game loop for a room.
pub fn start_game_loop(room: SharedRoom) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(10));
        let mut last_time = Instant::now();
        let mut accumulator: f64 = 0.0;
        let ns_per_tick: f64 = 1_000_000_000.0 / config::TICK_RATE as f64;
        let max_ticks_per_frame: u32 = 5; // prevent spiral of death

        loop {
            interval.tick().await;

            let now = Instant::now();
            let elapsed_ns = (now - last_time).as_nanos() as f64;
            last_time = now;
            accumulator += elapsed_ns;

            // Lock once, run all accumulated ticks, then release
            if accumulator >= ns_per_tick {
                let mut state = room.lock().await;
                let mut ticks_this_frame = 0;
                while accumulator >= ns_per_tick && ticks_this_frame < max_ticks_per_frame {
                    game_tick(&mut state);
                    accumulator -= ns_per_tick;
                    ticks_this_frame += 1;
                }
                // Drop excess accumulator to prevent spiral of death
                if accumulator > ns_per_tick * 2.0 {
                    accumulator = 0.0;
                }
            }
        }
    });
}

/// Run a single game tick.
fn game_tick(state: &mut RoomState) {
    let tick = state.tick_count;
    let alive_ids = state.player_manager.alive_player_ids();

    // 1. Process inputs for alive players
    for player_id in &alive_ids {
        let ship_config = {
            let player = state.player_manager.get_player(player_id).unwrap();
            config::ship_config(player.ship_type)
        };
        let weapon_config = {
            let player = state.player_manager.get_player(player_id).unwrap();
            config::weapon_config(player.ship_type)
        };

        let queued = state
            .input_queues
            .get_mut(player_id)
            .and_then(|q| q.pop_front());

        if let Some(input) = queued {
            {
                let player = state.player_manager.get_player_mut(player_id).unwrap();
                physics::update_ship_physics(&mut player.ship, &input.input, &ship_config, config::TICK_DT);
                map::apply_wall_collision(
                    &mut player.ship.x,
                    &mut player.ship.y,
                    &mut player.ship.vx,
                    &mut player.ship.vy,
                    config::TICK_DT,
                    &state.map,
                    ship_config.radius,
                    config::DEFAULT_BOUNCE_FACTOR,
                );
                player.last_processed_seq = input.seq;
            }

            // Weapon firing
            if input.fire {
                let player = state.player_manager.get_player_mut(player_id).unwrap();
                state.weapon_manager.fire_bullet(&mut player.ship, player_id, &weapon_config, tick);
            }
            if input.fire_bomb && weapon_config.has_bomb {
                let player = state.player_manager.get_player_mut(player_id).unwrap();
                state.weapon_manager.fire_bomb(&mut player.ship, player_id, &weapon_config, tick);
            }
            if input.multifire {
                if weapon_config.multifire_count > 0 {
                    let player = state.player_manager.get_player_mut(player_id).unwrap();
                    state.weapon_manager.fire_multifire(&mut player.ship, player_id, &weapon_config, tick);
                } else {
                    // Ships without multifire (e.g. Warbird): Ctrl fires a bullet
                    let player = state.player_manager.get_player_mut(player_id).unwrap();
                    state.weapon_manager.fire_bullet(&mut player.ship, player_id, &weapon_config, tick);
                }
            }
        } else {
            let neutral = ShipInput::default();
            let player = state.player_manager.get_player_mut(player_id).unwrap();
            physics::update_ship_physics(&mut player.ship, &neutral, &ship_config, config::TICK_DT);
            map::apply_wall_collision(
                &mut player.ship.x,
                &mut player.ship.y,
                &mut player.ship.vx,
                &mut player.ship.vy,
                config::TICK_DT,
                &state.map,
                ship_config.radius,
                config::DEFAULT_BOUNCE_FACTOR,
            );
        }
    }

    // 2. Update weapons and process damage
    let alive_for_hit: Vec<(String, f32, f32, f32)> = {
        let ids = state.player_manager.alive_player_ids();
        ids.iter()
            .filter_map(|pid| {
                state.player_manager.get_player(pid).map(|p| {
                    let cfg = config::ship_config(p.ship_type);
                    (p.id.clone(), p.ship.x, p.ship.y, cfg.radius)
                })
            })
            .collect()
    };

    let (_kills, damages) = state.weapon_manager.update(
        config::TICK_DT,
        tick,
        &state.map,
        &alive_for_hit,
    );

    // Apply damage and collect kill events
    let mut kill_events: Vec<KillEvent> = Vec::new();
    for dmg in &damages {
        let dead = state.player_manager.apply_damage(&dmg.player_id, dmg.amount);
        if dead {
            state.player_manager.kill_player(&dmg.player_id, &dmg.attacker_id, tick);
            kill_events.push(KillEvent {
                killer_id: dmg.attacker_id.clone(),
                killed_id: dmg.player_id.clone(),
                weapon_type: dmg.weapon_type,
            });
        }
    }

    // Broadcast death events and forward to game mode
    for kill in &kill_events {
        let msg = server_msg(
            ServerMsg::Death,
            serde_json::json!({
                "killerId": kill.killer_id,
                "killedId": kill.killed_id,
                "weaponType": kill.weapon_type,
            }),
        );
        state.broadcast(&msg);

        let mode_events = state.game_mode.on_kill(&kill.killer_id, &kill.killed_id, kill.weapon_type);
        for evt in mode_events {
            let mut data = evt.data;
            data.insert("event".to_string(), serde_json::json!(evt.event_type));
            let msg = server_msg(ServerMsg::GameState, serde_json::Value::Object(data));
            state.broadcast(&msg);
        }
    }

    // 3. Check for respawns (game mode controls whether respawn is allowed)
    let all_ids = state.player_manager.all_player_ids();
    for player_id in &all_ids {
        let should_respawn = {
            let player = state.player_manager.get_player(&player_id);
            player.map_or(false, |p| !p.alive && tick >= p.respawn_tick)
        };
        if should_respawn && state.game_mode.can_respawn(&player_id) {
            if state.player_manager.respawn_player(&player_id, &state.map, tick) {
                let player = state.player_manager.get_player(&player_id).unwrap();
                let msg = server_msg(
                    ServerMsg::Spawn,
                    serde_json::json!({
                        "playerId": player_id,
                        "x": player.ship.x,
                        "y": player.ship.y,
                    }),
                );
                state.broadcast(&msg);
            }
        }
    }

    // 4. Cleanup disconnected players periodically
    if state.tick_count % 100 == 0 {
        state.player_manager.cleanup_disconnected(state.tick_count);
    }

    // 4. Broadcast snapshot every SNAPSHOT_RATE ticks (20Hz)
    if state.tick_count % config::SNAPSHOT_RATE == 0 {
        broadcast_snapshot(state);
    }

    state.tick_count += 1;
}

fn broadcast_snapshot(state: &RoomState) {
    // Build player snapshot data
    let players: Vec<SnapshotPlayer> = state
        .player_manager
        .iter()
        .map(|p| SnapshotPlayer {
            id: p.id.clone(),
            x: p.ship.x,
            y: p.ship.y,
            vx: p.ship.vx,
            vy: p.ship.vy,
            orientation: p.ship.orientation,
            energy: p.ship.energy,
            ship_type: p.ship_type,
            alive: p.alive,
            kills: p.kills,
            deaths: p.deaths,
            last_processed_seq: p.last_processed_seq,
        })
        .collect();

    // Send as binary datagrams
    let player_data = binary::encode_snapshot_players(state.tick_count, &players);
    if player_data.len() <= binary::MAX_DATAGRAM_SIZE {
        state.broadcast_unreliable(&player_data);
    }

    let projectiles: Vec<SnapshotProjectile> = state
        .weapon_manager
        .projectiles
        .iter()
        .map(|pr| SnapshotProjectile {
            id: pr.id,
            is_bomb: pr.is_bomb,
            x: pr.x,
            y: pr.y,
            vx: pr.vx,
            vy: pr.vy,
            owner_id: pr.owner_id.clone(),
            rear: pr.rear,
        })
        .collect();

    let proj_data = binary::encode_snapshot_projectiles(state.tick_count, &projectiles);
    if proj_data.len() <= binary::MAX_DATAGRAM_SIZE {
        state.broadcast_unreliable(&proj_data);
    }

    // Send score update from game mode
    let score_msg = server_msg(
        ServerMsg::ScoreUpdate,
        serde_json::json!({ "state": state.game_mode.get_state() }),
    );
    state.broadcast(&score_msg);
}

/// Add a player to a room. Call while holding the lock.
pub fn add_player(
    state: &mut RoomState,
    player_id: &str,
    name: &str,
    ship_type: u8,
    conn: ConnectionHandle,
) -> bool {
    if state.player_manager.connected_count() >= state.max_players {
        return false;
    }

    let player = state.player_manager.add_player(player_id, name, ship_type);
    let ship_config = config::ship_config(ship_type);
    let (x, y) = PlayerManager::find_spawn_position(&state.map, ship_config.radius);
    player.ship.x = x;
    player.ship.y = y;

    state.game_mode.on_player_join(player_id, name, ship_type);
    state.clients.insert(player_id.to_string(), conn);
    state.input_queues.insert(player_id.to_string(), VecDeque::new());
    true
}

/// Queue an input for a player.
pub fn queue_input(
    state: &mut RoomState,
    player_id: &str,
    seq: u32,
    input: ShipInput,
    fire: bool,
    fire_bomb: bool,
    multifire: bool,
) {
    if let Some(queue) = state.input_queues.get_mut(player_id) {
        queue.push_back(QueuedInput {
            seq,
            input,
            fire,
            fire_bomb,
            multifire,
        });
    }
}
