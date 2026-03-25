use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tracing::{debug, warn};

use super::{ConnectionHandle, TransportCommand, TransportEvent};

/// Spawn a WebSocket connection handler.
/// Returns a ConnectionHandle for sending messages and an event receiver for incoming messages.
pub fn spawn_ws_connection(
    ws: WebSocket,
) -> (ConnectionHandle, mpsc::UnboundedReceiver<TransportEvent>) {
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<TransportCommand>();
    let (evt_tx, evt_rx) = mpsc::unbounded_channel::<TransportEvent>();

    let handle = ConnectionHandle { tx: cmd_tx };

    tokio::spawn(ws_task(ws, cmd_rx, evt_tx));

    (handle, evt_rx)
}

async fn ws_task(
    ws: WebSocket,
    mut cmd_rx: mpsc::UnboundedReceiver<TransportCommand>,
    evt_tx: mpsc::UnboundedSender<TransportEvent>,
) {
    let (mut sink, mut stream) = ws.split();

    loop {
        tokio::select! {
            // Incoming message from client
            msg = stream.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let _ = evt_tx.send(TransportEvent::Message(text.to_string()));
                    }
                    Some(Ok(Message::Binary(data))) => {
                        // Route by first byte: >= 0x80 = datagram, else JSON
                        if !data.is_empty() && data[0] >= 0x80 {
                            let _ = evt_tx.send(TransportEvent::Datagram(data.to_vec()));
                        } else {
                            if let Ok(text) = String::from_utf8(data.to_vec()) {
                                let _ = evt_tx.send(TransportEvent::Message(text));
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        debug!("WebSocket closed");
                        let _ = evt_tx.send(TransportEvent::Closed);
                        return;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        let _ = sink.send(Message::Pong(data)).await;
                    }
                    Some(Ok(Message::Pong(_))) => {}
                    Some(Err(e)) => {
                        warn!("WebSocket error: {e}");
                        let _ = evt_tx.send(TransportEvent::Closed);
                        return;
                    }
                }
            }

            // Outgoing command from game server
            cmd = cmd_rx.recv() => {
                match cmd {
                    Some(TransportCommand::SendReliable(text)) => {
                        if sink.send(Message::Text(text.into())).await.is_err() {
                            let _ = evt_tx.send(TransportEvent::Closed);
                            return;
                        }
                    }
                    Some(TransportCommand::SendUnreliable(data)) => {
                        // WebSocket has no true unreliable path — send as binary
                        if sink.send(Message::Binary(data.into())).await.is_err() {
                            let _ = evt_tx.send(TransportEvent::Closed);
                            return;
                        }
                    }
                    Some(TransportCommand::Close) => {
                        let _ = sink.send(Message::Close(None)).await;
                        let _ = evt_tx.send(TransportEvent::Closed);
                        return;
                    }
                    None => {
                        // Command channel dropped — connection handle gone
                        let _ = evt_tx.send(TransportEvent::Closed);
                        return;
                    }
                }
            }
        }
    }
}
