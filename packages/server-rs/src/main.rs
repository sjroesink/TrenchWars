mod config;
mod game;
mod game_modes;
mod protocol;
mod transport;

use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    Router,
    extract::{State, WebSocketUpgrade},
    response::{Html, IntoResponse},
    routing::get,
};
use tower_http::services::ServeDir;
use tracing::{info, warn, Level};
use tracing_subscriber::FmtSubscriber;

use game::server::{GameServer, GameServerHandle};
use transport::websocket::spawn_ws_connection;
use transport::webtransport::start_webtransport_server;

#[derive(Clone)]
struct AppState {
    game_handle: GameServerHandle,
    index_html: Arc<String>,
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        let (conn_handle, events) = spawn_ws_connection(socket);
        state.game_handle.add_connection(conn_handle, events);
    })
}

async fn index_handler(State(state): State<AppState>) -> Html<String> {
    Html(state.index_html.as_str().to_string())
}

#[tokio::main]
async fn main() {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber");

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(9020);
    let wt_port: u16 = env::var("WT_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(port);
    let tls_cert = env::var("TLS_CERT").unwrap_or_default();
    let tls_key = env::var("TLS_KEY").unwrap_or_default();
    let static_dir = env::var("STATIC_DIR").unwrap_or_else(|_| "public".to_string());
    let app_version = env::var("APP_VERSION").unwrap_or_else(|_| "dev".to_string());

    info!("TrenchWars v{app_version} (Rust)");

    let (game_server, game_handle) = GameServer::new();
    tokio::spawn(game_server.run());

    // Start WebTransport server if TLS certs are configured
    if !tls_cert.is_empty()
        && !tls_key.is_empty()
        && std::path::Path::new(&tls_cert).exists()
        && std::path::Path::new(&tls_key).exists()
    {
        let wt_handle = game_handle.clone();
        let cert = tls_cert.clone();
        let key = tls_key.clone();
        tokio::spawn(async move {
            if let Err(e) = start_webtransport_server(wt_port, &cert, &key, wt_handle).await {
                warn!("WebTransport unavailable: {e}");
            }
        });
    } else {
        info!("  WebTransport disabled (no TLS_CERT/TLS_KEY)");
    }

    let index_path = PathBuf::from(&static_dir).join("index.html");
    let index_html = std::fs::read_to_string(&index_path).unwrap_or_else(|_| {
        "<html><body>index.html not found</body></html>".to_string()
    });

    let state = AppState {
        game_handle,
        index_html: Arc::new(index_html),
    };

    let app = Router::new()
        .route("/", get(index_handler))
        .route("/game", get(ws_handler))
        .with_state(state)
        .fallback_service(
            ServeDir::new(&static_dir),
        );

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("  HTTP + WebSocket on http://localhost:{port}");
    info!("  Static files from {static_dir}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
