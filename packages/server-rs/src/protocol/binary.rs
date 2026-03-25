use super::messages::BinaryMsg;

/// Decoded binary input from client.
#[derive(Debug, Clone)]
pub struct BinaryInput {
    pub seq: u32,
    pub tick: u32,
    pub left: bool,
    pub right: bool,
    pub thrust: bool,
    pub reverse: bool,
    pub afterburner: bool,
    pub multifire: bool,
    pub fire: bool,
    pub fire_bomb: bool,
}

/// Decode 10-byte binary input: [type:1][seq:4LE][tick:4LE][flags:1]
pub fn decode_input(data: &[u8]) -> Option<BinaryInput> {
    if data.len() < 10 {
        return None;
    }
    let seq = u32::from_le_bytes([data[1], data[2], data[3], data[4]]);
    let tick = u32::from_le_bytes([data[5], data[6], data[7], data[8]]);
    let flags = data[9];
    Some(BinaryInput {
        seq,
        tick,
        left: flags & 0x01 != 0,
        right: flags & 0x02 != 0,
        thrust: flags & 0x04 != 0,
        reverse: flags & 0x08 != 0,
        afterburner: flags & 0x10 != 0,
        multifire: flags & 0x20 != 0,
        fire: flags & 0x40 != 0,
        fire_bomb: flags & 0x80 != 0,
    })
}

/// Decode 9-byte binary ping: [type:1][clientTime:8LE float64]
pub fn decode_ping(data: &[u8]) -> Option<f64> {
    if data.len() < 9 {
        return None;
    }
    let bytes: [u8; 8] = data[1..9].try_into().ok()?;
    Some(f64::from_le_bytes(bytes))
}

/// Encode 17-byte binary pong: [type:1][clientTime:8LE][serverTime:8LE]
pub fn encode_pong(client_time: f64, server_time: f64) -> Vec<u8> {
    let mut buf = Vec::with_capacity(17);
    buf.push(BinaryMsg::Pong as u8);
    buf.extend_from_slice(&client_time.to_le_bytes());
    buf.extend_from_slice(&server_time.to_le_bytes());
    buf
}

/// UUID string (36 chars) to 16 raw bytes.
pub fn uuid_to_bytes(uuid: &str, buf: &mut [u8]) {
    let mut bi = 0;
    let bytes = uuid.as_bytes();
    let mut i = 0;
    while i < bytes.len() && bi < 16 {
        if bytes[i] == b'-' {
            i += 1;
            continue;
        }
        let hi = hex_val(bytes[i]);
        let lo = if i + 1 < bytes.len() {
            hex_val(bytes[i + 1])
        } else {
            0
        };
        buf[bi] = (hi << 4) | lo;
        bi += 1;
        i += 2;
    }
}

/// 16 raw bytes to UUID string.
pub fn bytes_to_uuid(buf: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(36);
    for (i, &b) in buf.iter().enumerate().take(16) {
        if i == 4 || i == 6 || i == 8 || i == 10 {
            s.push('-');
        }
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0x0f) as usize] as char);
    }
    s
}

fn hex_val(c: u8) -> u8 {
    match c {
        b'0'..=b'9' => c - b'0',
        b'a'..=b'f' => c - b'a' + 10,
        b'A'..=b'F' => c - b'A' + 10,
        _ => 0,
    }
}

/// Encode snapshot players binary.
/// Header: [type:1][tick:4LE][count:1]
/// Per player (48 bytes): [id:16][x:4][y:4][vx:4][vy:4][orientation:4]
///   [energy:2][shipType:1][alive:1][kills:2][deaths:2][lastProcessedSeq:4]
pub fn encode_snapshot_players(tick: u32, players: &[SnapshotPlayer]) -> Vec<u8> {
    let header_size = 6;
    let mut buf = Vec::with_capacity(header_size + players.len() * 48);
    buf.push(BinaryMsg::SnapshotPlayers as u8);
    buf.extend_from_slice(&tick.to_le_bytes());
    buf.push(players.len() as u8);

    for p in players {
        let mut id_bytes = [0u8; 16];
        uuid_to_bytes(&p.id, &mut id_bytes);
        buf.extend_from_slice(&id_bytes);
        buf.extend_from_slice(&p.x.to_le_bytes());
        buf.extend_from_slice(&p.y.to_le_bytes());
        buf.extend_from_slice(&p.vx.to_le_bytes());
        buf.extend_from_slice(&p.vy.to_le_bytes());
        buf.extend_from_slice(&p.orientation.to_le_bytes());
        buf.extend_from_slice(&(p.energy.round() as i16).to_le_bytes());
        buf.push(p.ship_type);
        buf.push(if p.alive { 1 } else { 0 });
        buf.extend_from_slice(&p.kills.to_le_bytes());
        buf.extend_from_slice(&p.deaths.to_le_bytes());
        buf.extend_from_slice(&p.last_processed_seq.to_le_bytes());
    }
    buf
}

/// Encode snapshot projectiles binary.
/// Header: [type:1][tick:4LE][count:1]
/// Per projectile (38 bytes): [id:4][type:1][x:4][y:4][vx:4][vy:4][ownerId:16][flags:1]
pub fn encode_snapshot_projectiles(tick: u32, projectiles: &[SnapshotProjectile]) -> Vec<u8> {
    let header_size = 6;
    let mut buf = Vec::with_capacity(header_size + projectiles.len() * 38);
    buf.push(BinaryMsg::SnapshotProjectiles as u8);
    buf.extend_from_slice(&tick.to_le_bytes());
    buf.push(projectiles.len() as u8);

    for pr in projectiles {
        buf.extend_from_slice(&pr.id.to_le_bytes());
        buf.push(if pr.is_bomb { 1 } else { 0 });
        buf.extend_from_slice(&pr.x.to_le_bytes());
        buf.extend_from_slice(&pr.y.to_le_bytes());
        buf.extend_from_slice(&pr.vx.to_le_bytes());
        buf.extend_from_slice(&pr.vy.to_le_bytes());
        let mut id_bytes = [0u8; 16];
        uuid_to_bytes(&pr.owner_id, &mut id_bytes);
        buf.extend_from_slice(&id_bytes);
        buf.push(if pr.rear { 1 } else { 0 });
    }
    buf
}

/// Player data for snapshot encoding.
#[derive(Debug, Clone)]
pub struct SnapshotPlayer {
    pub id: String,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub orientation: f32,
    pub energy: f32,
    pub ship_type: u8,
    pub alive: bool,
    pub kills: u16,
    pub deaths: u16,
    pub last_processed_seq: u32,
}

/// Projectile data for snapshot encoding.
#[derive(Debug, Clone)]
pub struct SnapshotProjectile {
    pub id: u32,
    pub is_bomb: bool,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub owner_id: String,
    pub rear: bool,
}

pub const MAX_DATAGRAM_SIZE: usize = 1200;
