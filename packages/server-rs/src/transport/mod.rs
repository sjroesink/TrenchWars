pub mod websocket;
pub mod webtransport;

use tokio::sync::mpsc;

/// Messages sent from transport to game server.
#[derive(Debug)]
pub enum TransportEvent {
    /// Reliable JSON message received.
    Message(String),
    /// Unreliable binary datagram received.
    Datagram(Vec<u8>),
    /// Connection closed.
    Closed,
}

/// Messages sent from game server to transport.
#[derive(Debug, Clone)]
pub enum TransportCommand {
    /// Send reliable JSON message.
    SendReliable(String),
    /// Send unreliable binary datagram (falls back to reliable if unavailable).
    SendUnreliable(Vec<u8>),
    /// Close the connection.
    Close,
}

/// A client connection handle used by the game server.
/// Cheaply cloneable — wraps a channel sender.
#[derive(Debug, Clone)]
pub struct ConnectionHandle {
    pub tx: mpsc::UnboundedSender<TransportCommand>,
}

impl ConnectionHandle {
    pub fn send_reliable(&self, data: String) {
        let _ = self.tx.send(TransportCommand::SendReliable(data));
    }

    pub fn send_unreliable(&self, data: Vec<u8>) {
        let _ = self.tx.send(TransportCommand::SendUnreliable(data));
    }

    pub fn close(&self) {
        let _ = self.tx.send(TransportCommand::Close);
    }
}
