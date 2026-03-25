pub mod ffa;

use serde_json::Value;

/// Events emitted by game modes.
#[derive(Debug, Clone)]
pub struct GameModeEvent {
    pub event_type: String,
    pub data: serde_json::Map<String, Value>,
}

/// Game mode trait.
pub trait GameMode: Send {
    fn mode_type(&self) -> &str;
    fn on_player_join(&mut self, player_id: &str, name: &str, ship_type: u8);
    fn on_player_leave(&mut self, player_id: &str);
    fn on_kill(&mut self, killer_id: &str, killed_id: &str, weapon_type: &str) -> Vec<GameModeEvent>;
    fn on_tick(&mut self, tick: u32) -> Vec<GameModeEvent>;
    fn get_state(&self) -> Value;
    fn can_respawn(&self, player_id: &str) -> bool;
}
