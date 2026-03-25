use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::sync::{Mutex, mpsc};
use tracing::{debug, info};

use crate::config;
use crate::protocol::binary;
use crate::protocol::messages::{BinaryMsg, ClientJsonMsg, ClientMsg, ServerMsg, server_msg};
use crate::transport::{ConnectionHandle, TransportEvent};

use super::map::{self, TileMap};
use super::physics::ShipInput;
use super::room::{self, SharedRoom, RoomState};

pub struct NewConnection {
    pub handle: ConnectionHandle,
    pub events: mpsc::UnboundedReceiver<TransportEvent>,
}

/// Sender half for submitting new connections to the game server.
#[derive(Clone)]
pub struct GameServerHandle {
    conn_tx: mpsc::UnboundedSender<NewConnection>,
}

impl GameServerHandle {
    pub fn add_connection(
        &self,
        handle: ConnectionHandle,
        events: mpsc::UnboundedReceiver<TransportEvent>,
    ) {
        let _ = self.conn_tx.send(NewConnection { handle, events });
    }
}

/// Central game server.
pub struct GameServer {
    conn_rx: mpsc::UnboundedReceiver<NewConnection>,
    rooms: Vec<SharedRoom>,
    player_room_map: Arc<Mutex<HashMap<String, usize>>>,
}

impl GameServer {
    pub fn new() -> (Self, GameServerHandle) {
        let (conn_tx, conn_rx) = mpsc::unbounded_channel();

        // Create default map and rooms
        let tile_map = map::generate_test_arena(200, 200);

        let rooms = vec![
            room::create_room("arena-1", "Arena 1", tile_map.clone(), 20),
            room::create_room("arena-2", "Arena 2", tile_map, 20),
        ];

        let server = GameServer {
            conn_rx,
            rooms,
            player_room_map: Arc::new(Mutex::new(HashMap::new())),
        };
        let handle = GameServerHandle { conn_tx };
        (server, handle)
    }

    pub async fn run(mut self) {
        info!("Game server started");

        // Start game loops for all rooms
        for room in &self.rooms {
            room::start_game_loop(room.clone());
            let state = room.lock().await;
            info!("  Room: {} (FFA, max {})", state.name, state.max_players);
        }

        loop {
            match self.conn_rx.recv().await {
                Some(new_conn) => {
                    tokio::spawn(handle_connection(
                        new_conn.handle,
                        new_conn.events,
                        self.rooms.clone(),
                        self.player_room_map.clone(),
                    ));
                }
                None => {
                    info!("Game server shutting down");
                    return;
                }
            }
        }
    }
}

fn now_millis() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64()
        * 1000.0
}

async fn handle_connection(
    conn: ConnectionHandle,
    mut events: mpsc::UnboundedReceiver<TransportEvent>,
    rooms: Vec<SharedRoom>,
    player_room_map: Arc<Mutex<HashMap<String, usize>>>,
) {
    debug!("New connection");
    let mut player_id: Option<String> = None;

    while let Some(event) = events.recv().await {
        match event {
            TransportEvent::Message(text) => {
                handle_reliable(
                    &conn,
                    &text,
                    &rooms,
                    &player_room_map,
                    &mut player_id,
                )
                .await;
            }
            TransportEvent::Datagram(data) => {
                handle_datagram(&conn, &data, &rooms, &player_room_map, &player_id).await;
            }
            TransportEvent::Closed => {
                debug!("Connection closed");
                if let Some(pid) = player_id {
                    let room_map = player_room_map.lock().await;
                    if let Some(&room_idx) = room_map.get(pid.as_str()) {
                        let mut state = rooms[room_idx].lock().await;
                        state.clients.remove(pid.as_str());

                        // Broadcast player leave
                        let msg = server_msg(
                            ServerMsg::PlayerLeave,
                            serde_json::json!({ "playerId": pid }),
                        );
                        state.broadcast(&msg);

                        // Notify game mode and hold player for reconnection
                        state.game_mode.on_player_leave(pid.as_str());
                        let tick = state.tick_count;
                        state.player_manager.hold_player(pid.as_str(), tick);
                    }
                }
                return;
            }
        }
    }
}

async fn handle_reliable(
    conn: &ConnectionHandle,
    text: &str,
    rooms: &[SharedRoom],
    player_room_map: &Arc<Mutex<HashMap<String, usize>>>,
    player_id: &mut Option<String>,
) {
    let msg: ClientJsonMsg = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(_) => return,
    };

    let Some(msg_type) = msg.client_msg_type() else {
        return;
    };

    match msg_type {
        ClientMsg::RoomList => {
            let mut room_list = Vec::new();
            for room in rooms {
                let state = room.lock().await;
                room_list.push(serde_json::json!({
                    "id": state.id,
                    "name": state.name,
                    "playerCount": state.player_manager.connected_count(),
                    "maxPlayers": state.max_players,
                    "mode": state.game_mode.mode_type(),
                }));
            }
            conn.send_reliable(server_msg(
                ServerMsg::RoomList,
                serde_json::json!({ "rooms": room_list }),
            ));
        }

        ClientMsg::Join => {
            let name = msg.get_str("name").unwrap_or("Player").to_string();
            let ship_type = msg.get_u32("shipType").unwrap_or(0) as u8;
            let room_id = msg.get_str("roomId").map(|s| s.to_string());

            let pid = uuid::Uuid::new_v4().to_string();

            // Find target room
            let room_idx = if let Some(rid) = room_id {
                rooms
                    .iter()
                    .enumerate()
                    .find(|(_, r)| {
                        // We can't await in find, so just check by trying
                        true
                    })
                    .map(|(i, _)| i)
                    .unwrap_or(0)
            } else {
                0 // auto-assign to first room
            };

            let mut state = rooms[room_idx].lock().await;

            if room::add_player(&mut state, &pid, &name, ship_type, conn.clone()) {
                let player = state.player_manager.get_player(&pid).unwrap();
                let session_token = player.session_token.clone();

                info!("Player joined: {name} (ship {ship_type}) as {pid} in {}", state.name);

                // Send WELCOME
                conn.send_reliable(server_msg(
                    ServerMsg::Welcome,
                    serde_json::json!({
                        "playerId": pid,
                        "tick": state.tick_count,
                        "mapWidth": state.map.width,
                        "mapHeight": state.map.height,
                        "sessionToken": session_token,
                        "roomId": state.id,
                        "gameState": state.game_mode.get_state(),
                    }),
                ));

                // Broadcast player join to all in room
                let join_msg = server_msg(
                    ServerMsg::PlayerJoin,
                    serde_json::json!({
                        "playerId": pid,
                        "name": name,
                        "shipType": ship_type,
                    }),
                );
                state.broadcast(&join_msg);

                drop(state);
                player_room_map.lock().await.insert(pid.clone(), room_idx);
                *player_id = Some(pid);
            }
        }

        ClientMsg::Input => {
            if let Some(pid) = player_id {
                let room_map = player_room_map.lock().await;
                if let Some(&room_idx) = room_map.get(pid) {
                    let mut state = rooms[room_idx].lock().await;
                    // Parse JSON input (fallback path — binary input is preferred)
                    let seq = msg.get_u32("seq").unwrap_or(0);
                    let input = parse_json_input(&msg);
                    let fire = msg.fields.get("fire").and_then(|v| v.as_bool()).unwrap_or(false);
                    let fire_bomb = msg.fields.get("fireBomb").and_then(|v| v.as_bool()).unwrap_or(false);
                    let multifire = msg.fields.get("multifire").and_then(|v| v.as_bool()).unwrap_or(false);
                    room::queue_input(&mut state, pid, seq, input, fire, fire_bomb, multifire);
                }
            }
        }

        ClientMsg::Ping => {
            if let Some(client_time) = msg.get_f64("clientTime") {
                conn.send_reliable(server_msg(
                    ServerMsg::Pong,
                    serde_json::json!({
                        "clientTime": client_time,
                        "serverTime": now_millis(),
                    }),
                ));
            }
        }

        ClientMsg::ShipSelect => {
            if let Some(pid) = player_id {
                let ship_type = msg.get_u32("shipType").unwrap_or(0) as u8;
                if ship_type < 3 {
                    let room_map = player_room_map.lock().await;
                    if let Some(&room_idx) = room_map.get(pid) {
                        let mut state = rooms[room_idx].lock().await;
                        if let Some(player) = state.player_manager.get_player_mut(pid) {
                            player.ship_type = ship_type;
                            player.ship.energy = config::ship_config(ship_type).energy;
                        }
                    }
                }
            }
        }

        ClientMsg::Chat => {
            if let Some(pid) = player_id {
                let message = msg.get_str("message").unwrap_or("").to_string();
                if !message.is_empty() && message.len() <= 200 {
                    let room_map = player_room_map.lock().await;
                    if let Some(&room_idx) = room_map.get(pid) {
                        let state = rooms[room_idx].lock().await;
                        let name = state
                            .player_manager
                            .get_player(pid)
                            .map(|p| p.name.clone())
                            .unwrap_or_default();
                        let chat_msg = server_msg(
                            ServerMsg::Chat,
                            serde_json::json!({
                                "playerId": pid,
                                "name": name,
                                "message": message,
                            }),
                        );
                        state.broadcast(&chat_msg);
                    }
                }
            }
        }

        ClientMsg::RoomJoin => {
            // TODO: handle room switching
        }
    }
}

async fn handle_datagram(
    conn: &ConnectionHandle,
    data: &[u8],
    rooms: &[SharedRoom],
    player_room_map: &Arc<Mutex<HashMap<String, usize>>>,
    player_id: &Option<String>,
) {
    if data.is_empty() {
        return;
    }

    let Some(msg_type) = BinaryMsg::from_byte(data[0]) else {
        return;
    };

    match msg_type {
        BinaryMsg::Input => {
            if let Some(pid) = player_id {
                if let Some(bi) = binary::decode_input(data) {
                    let room_map = player_room_map.lock().await;
                    if let Some(&room_idx) = room_map.get(pid) {
                        let mut state = rooms[room_idx].lock().await;
                        let input = ShipInput {
                            left: bi.left,
                            right: bi.right,
                            thrust: bi.thrust,
                            reverse: bi.reverse,
                            afterburner: bi.afterburner,
                            multifire: bi.multifire,
                        };
                        room::queue_input(
                            &mut state,
                            pid,
                            bi.seq,
                            input,
                            bi.fire,
                            bi.fire_bomb,
                            bi.multifire,
                        );
                    }
                }
            }
        }
        BinaryMsg::Ping => {
            if let Some(client_time) = binary::decode_ping(data) {
                let pong = binary::encode_pong(client_time, now_millis());
                conn.send_unreliable(pong);
            }
        }
        _ => {}
    }
}

fn parse_json_input(msg: &ClientJsonMsg) -> ShipInput {
    let input_obj = msg.fields.get("input");
    ShipInput {
        left: input_obj
            .and_then(|v| v.get("left"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        right: input_obj
            .and_then(|v| v.get("right"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        thrust: input_obj
            .and_then(|v| v.get("thrust"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        reverse: input_obj
            .and_then(|v| v.get("reverse"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        afterburner: input_obj
            .and_then(|v| v.get("afterburner"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        multifire: input_obj
            .and_then(|v| v.get("multifire"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    }
}
