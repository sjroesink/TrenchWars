use std::collections::HashMap;
use serde_json::{Value, json};
use super::{GameMode, GameModeEvent};

struct FFAPlayer {
    name: String,
    kills: u32,
    deaths: u32,
    ship_type: u8,
}

/// Free-for-all deathmatch mode.
pub struct FFAMode {
    players: HashMap<String, FFAPlayer>,
    score_limit: u32,
}

impl FFAMode {
    pub fn new(score_limit: u32) -> Self {
        Self {
            players: HashMap::new(),
            score_limit,
        }
    }
}

impl GameMode for FFAMode {
    fn mode_type(&self) -> &str { "ffa" }

    fn on_player_join(&mut self, player_id: &str, name: &str, ship_type: u8) {
        self.players.insert(player_id.to_string(), FFAPlayer {
            name: name.to_string(),
            kills: 0,
            deaths: 0,
            ship_type,
        });
    }

    fn on_player_leave(&mut self, player_id: &str) {
        self.players.remove(player_id);
    }

    fn on_kill(&mut self, killer_id: &str, killed_id: &str, _weapon_type: &str) -> Vec<GameModeEvent> {
        let mut events = Vec::new();

        if killer_id != killed_id {
            if let Some(killer) = self.players.get_mut(killer_id) {
                killer.kills += 1;
                if killer.kills >= self.score_limit {
                    let mut data = serde_json::Map::new();
                    data.insert("winnerId".to_string(), json!(killer_id));
                    data.insert("winnerName".to_string(), json!(killer.name));
                    data.insert("kills".to_string(), json!(killer.kills));
                    events.push(GameModeEvent {
                        event_type: "game-over".to_string(),
                        data,
                    });
                }
            }
        }

        if let Some(killed) = self.players.get_mut(killed_id) {
            killed.deaths += 1;
        }

        events
    }

    fn on_tick(&mut self, _tick: u32) -> Vec<GameModeEvent> {
        Vec::new()
    }

    fn get_state(&self) -> Value {
        let mut leaderboard: Vec<Value> = self.players.iter()
            .map(|(id, p)| json!({
                "id": id,
                "name": p.name,
                "kills": p.kills,
                "deaths": p.deaths,
                "shipType": p.ship_type,
            }))
            .collect();
        leaderboard.sort_by(|a, b| {
            let ak = a["kills"].as_u64().unwrap_or(0);
            let bk = b["kills"].as_u64().unwrap_or(0);
            bk.cmp(&ak)
        });

        json!({
            "type": "ffa",
            "leaderboard": leaderboard,
            "scoreLimit": self.score_limit,
        })
    }

    fn can_respawn(&self, _player_id: &str) -> bool {
        true
    }
}
