use serde::{Deserialize, Serialize};
use serde_json::Value;

// Client -> Server message types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ClientMsg {
    Join = 0x01,
    Input = 0x02,
    ShipSelect = 0x03,
    Ping = 0x04,
    Chat = 0x05,
    RoomList = 0x06,
    RoomJoin = 0x07,
}

// Server -> Client message types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[repr(u8)]
pub enum ServerMsg {
    Welcome = 0x01,
    Snapshot = 0x02,
    PlayerJoin = 0x03,
    PlayerLeave = 0x04,
    Death = 0x05,
    Spawn = 0x06,
    Pong = 0x07,
    Chat = 0x08,
    GameState = 0x09,
    ScoreUpdate = 0x0A,
    TeamAssign = 0x0B,
    RoomList = 0x0C,
}

// Binary message types (unreliable datagrams, 0x80+ range)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum BinaryMsg {
    Input = 0x80,
    SnapshotPlayers = 0x81,
    SnapshotProjectiles = 0x82,
    Ping = 0x83,
    Pong = 0x84,
}

impl BinaryMsg {
    pub fn from_byte(b: u8) -> Option<Self> {
        match b {
            0x80 => Some(Self::Input),
            0x81 => Some(Self::SnapshotPlayers),
            0x82 => Some(Self::SnapshotProjectiles),
            0x83 => Some(Self::Ping),
            0x84 => Some(Self::Pong),
            _ => None,
        }
    }
}

/// Incoming JSON message from client (loosely typed for flexibility).
#[derive(Debug, Deserialize)]
pub struct ClientJsonMsg {
    #[serde(rename = "type")]
    pub msg_type: u8,
    #[serde(flatten)]
    pub fields: serde_json::Map<String, Value>,
}

impl ClientJsonMsg {
    pub fn client_msg_type(&self) -> Option<ClientMsg> {
        match self.msg_type {
            0x01 => Some(ClientMsg::Join),
            0x02 => Some(ClientMsg::Input),
            0x03 => Some(ClientMsg::ShipSelect),
            0x04 => Some(ClientMsg::Ping),
            0x05 => Some(ClientMsg::Chat),
            0x06 => Some(ClientMsg::RoomList),
            0x07 => Some(ClientMsg::RoomJoin),
            _ => None,
        }
    }

    pub fn get_str(&self, key: &str) -> Option<&str> {
        self.fields.get(key)?.as_str()
    }

    pub fn get_u32(&self, key: &str) -> Option<u32> {
        self.fields.get(key)?.as_u64().map(|v| v as u32)
    }

    pub fn get_f64(&self, key: &str) -> Option<f64> {
        self.fields.get(key)?.as_f64()
    }
}

/// Helper to build server JSON messages.
pub fn server_msg(msg_type: ServerMsg, extra: serde_json::Value) -> String {
    let mut obj = match extra {
        serde_json::Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    obj.insert("type".to_string(), serde_json::json!(msg_type as u8));
    serde_json::to_string(&serde_json::Value::Object(obj)).unwrap()
}
