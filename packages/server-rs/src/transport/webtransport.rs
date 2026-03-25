use std::path::Path;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};
use wtransport::endpoint::IncomingSession;
use wtransport::{Connection, Endpoint, Identity, ServerConfig};

use super::{ConnectionHandle, TransportCommand, TransportEvent};
use crate::game::server::GameServerHandle;

/// Start the WebTransport server on the given port with TLS.
pub async fn start_webtransport_server(
    port: u16,
    cert_path: &str,
    key_path: &str,
    game_handle: GameServerHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    let identity = Identity::load_pemfiles(cert_path, key_path).await?;

    let config = ServerConfig::builder()
        .with_bind_default(port)
        .with_identity(identity)
        .build();

    let server = Endpoint::server(config)?;

    info!("  WebTransport on https://0.0.0.0:{port}/game (UDP)");

    loop {
        let incoming = server.accept().await;
        let handle = game_handle.clone();
        tokio::spawn(handle_incoming_session(incoming, handle));
    }
}

async fn handle_incoming_session(incoming: IncomingSession, game_handle: GameServerHandle) {
    let request = match incoming.await {
        Ok(req) => req,
        Err(e) => {
            warn!("WT session error: {e}");
            return;
        }
    };

    let path = request.path().to_string();
    if path != "/game" {
        warn!("WT rejected path: {path}");
        return;
    }

    let connection = match request.accept().await {
        Ok(conn) => conn,
        Err(e) => {
            warn!("WT accept error: {e}");
            return;
        }
    };

    info!("[WT] new session");

    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<TransportCommand>();
    let (evt_tx, evt_rx) = mpsc::unbounded_channel::<TransportEvent>();

    let conn_handle = ConnectionHandle { tx: cmd_tx };
    game_handle.add_connection(conn_handle, evt_rx);

    // Run the bidirectional bridge between WT connection and game server channels
    run_wt_bridge(connection, cmd_rx, evt_tx).await;
}

async fn run_wt_bridge(
    conn: Connection,
    mut cmd_rx: mpsc::UnboundedReceiver<TransportCommand>,
    evt_tx: mpsc::UnboundedSender<TransportEvent>,
) {
    // Open a server-initiated bidi stream for sending reliable messages
    let (mut send_stream, _recv_unused) = match conn.open_bi().await {
        Ok(opening) => match opening.await {
            Ok(pair) => pair,
            Err(e) => {
                warn!("[WT] open_bi await error: {e}");
                let _ = evt_tx.send(TransportEvent::Closed);
                return;
            }
        },
        Err(e) => {
            warn!("[WT] open_bi error: {e}");
            let _ = evt_tx.send(TransportEvent::Closed);
            return;
        }
    };

    // Spawn task to read client-initiated bidi streams (reliable JSON messages)
    let conn_clone = conn.clone();
    let evt_tx_stream = evt_tx.clone();
    tokio::spawn(async move {
        loop {
            match conn_clone.accept_bi().await {
                Ok((_, mut recv)) => {
                    let evt_tx = evt_tx_stream.clone();
                    tokio::spawn(async move {
                        let mut buf = Vec::new();
                        let mut tmp = [0u8; 4096];
                        loop {
                            match recv.read(&mut tmp).await {
                                Ok(Some(n)) => {
                                    buf.extend_from_slice(&tmp[..n]);
                                    // Process newline-delimited messages
                                    while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                                        let msg = String::from_utf8_lossy(&buf[..pos]).to_string();
                                        buf.drain(..=pos);
                                        if !msg.is_empty() {
                                            let _ = evt_tx.send(TransportEvent::Message(msg));
                                        }
                                    }
                                }
                                Ok(None) => break,
                                Err(_) => break,
                            }
                        }
                    });
                }
                Err(_) => break,
            }
        }
    });

    // Spawn task to read datagrams
    let conn_clone = conn.clone();
    let evt_tx_dgram = evt_tx.clone();
    tokio::spawn(async move {
        loop {
            match conn_clone.receive_datagram().await {
                Ok(datagram) => {
                    let data = datagram.payload().to_vec();
                    let _ = evt_tx_dgram.send(TransportEvent::Datagram(data));
                }
                Err(_) => {
                    let _ = evt_tx_dgram.send(TransportEvent::Closed);
                    break;
                }
            }
        }
    });

    // Main loop: send commands from game server to WT connection
    loop {
        match cmd_rx.recv().await {
            Some(TransportCommand::SendReliable(text)) => {
                let data = format!("{}\n", text);
                if send_stream.write_all(data.as_bytes()).await.is_err() {
                    let _ = evt_tx.send(TransportEvent::Closed);
                    return;
                }
            }
            Some(TransportCommand::SendUnreliable(data)) => {
                if conn.send_datagram(&data).is_err() {
                    // Fallback to reliable if datagram fails
                    // (shouldn't happen often with WT, but handle gracefully)
                    debug!("[WT] datagram send failed, skipping");
                }
            }
            Some(TransportCommand::Close) => {
                let _ = evt_tx.send(TransportEvent::Closed);
                return;
            }
            None => {
                let _ = evt_tx.send(TransportEvent::Closed);
                return;
            }
        }
    }
}
