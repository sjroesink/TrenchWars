import { Application } from 'pixi.js';
import { parseMap, WARBIRD, SHIP_CONFIGS } from '@trench-wars/shared';
import type { ShipState, ShipConfig, GameSnapshot } from '@trench-wars/shared';
import { InputManager } from './input';
import { Camera } from './camera';
import { Renderer } from './renderer';
import { GameLoop } from './game-loop';
import { DebugPanel } from './debug';
import { NetworkClient } from './network';
import { PredictionManager } from './prediction';
import { ShipSelectOverlay } from './ship-select';

/** Server WebSocket URL (configurable via query param or default) */
function getServerUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('server') || 'ws://localhost:9020';
}

async function main(): Promise<void> {
  // Load arena map from public assets
  const response = await fetch('/maps/arena.json');
  const json = await response.text();
  const tileMap = parseMap(json);

  // Player name — prompt or default
  const playerName = prompt('Enter name:') || 'Player';

  // Show ship selection overlay before connecting
  const shipSelectOverlay = new ShipSelectOverlay();
  const selectedShipType = await shipSelectOverlay.show();
  const selectedConfig = SHIP_CONFIGS[selectedShipType];

  // Create initial ship state (spawn in open area of the map)
  const shipState: ShipState = {
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    orientation: 0,
    energy: selectedConfig.energy,
  };

  // Mutable config copy so debug panel can modify it
  const shipConfig: ShipConfig = { ...selectedConfig };

  // Initialize systems
  const inputManager = new InputManager();
  const camera = new Camera();
  const renderer = new Renderer();
  await renderer.init(tileMap);

  // Attempt server connection
  const serverUrl = getServerUrl();
  let network: NetworkClient | undefined;
  let prediction: PredictionManager | undefined;
  let playerId: string | undefined;
  let gameLoop: GameLoop | undefined;
  let debugStarted = false;

  try {
    prediction = new PredictionManager();

    network = new NetworkClient({
      onWelcome: (data) => {
        playerId = data.playerId;
        console.log(`Connected as ${playerId} at tick ${data.tick}${data.reconnected ? ' (reconnected)' : ''}`);

        // Store session token for reconnection
        if (data.sessionToken) {
          network!.setSessionToken(data.sessionToken);
        }

        // On reconnect, clear prediction buffer but don't recreate game loop
        if (data.reconnected && gameLoop) {
          prediction!.clear();
          console.log('Reconnected -- prediction buffer cleared');
          return;
        }

        // Create game loop with networking
        gameLoop = new GameLoop({
          shipState,
          shipConfig,
          tileMap,
          inputManager,
          camera,
          renderer,
          network,
          prediction,
          playerId,
        });

        // Create debug panel (references the same mutable config and state)
        if (!debugStarted) {
          debugStarted = true;
          const debugPanel = new DebugPanel(shipConfig, shipState, gameLoop);
          function updateDebug(): void {
            debugPanel.update();
            requestAnimationFrame(updateDebug);
          }
          requestAnimationFrame(updateDebug);
        }

        // Start the game loop after welcome
        gameLoop.start();
        console.log('TrenchWars client started (networked)');
      },

      onSnapshot: (snapshot: GameSnapshot) => {
        if (gameLoop) {
          gameLoop.onSnapshot(snapshot);
        }
      },

      onPlayerJoin: (data) => {
        console.log(`Player joined: ${data.name} (${data.playerId})`);
      },

      onPlayerLeave: (data) => {
        console.log(`Player left: ${data.playerId}`);
      },

      onDeath: (data) => {
        console.log(`Kill: ${data.killerId} -> ${data.killedId} (${data.weaponType})`);
      },

      onSpawn: (data) => {
        if (data.playerId === playerId) {
          shipState.x = data.x;
          shipState.y = data.y;
          shipState.vx = 0;
          shipState.vy = 0;
          console.log(`Respawned at (${data.x}, ${data.y})`);
        }
      },

      onPong: (data) => {
        const rtt = Date.now() - data.clientTime;
        console.log(`Ping: ${rtt}ms`);
      },

      onDisconnect: () => {
        console.warn('Disconnected from server -- attempting reconnect...');
      },

      onReconnect: () => {
        console.log('Reconnection successful');
      },
    });

    await network.connect(serverUrl);

    // Send JOIN after connection with selected ship type
    network.sendJoin(playerName, selectedShipType);
    console.log(`Connecting to ${serverUrl}...`);
  } catch {
    // Server not available — fall back to local-only mode
    console.warn('Server not available, running in local-only mode');

    gameLoop = new GameLoop({
      shipState,
      shipConfig,
      tileMap,
      inputManager,
      camera,
      renderer,
    });

    // Create debug panel
    if (!debugStarted) {
      debugStarted = true;
      const debugPanel = new DebugPanel(shipConfig, shipState, gameLoop);
      function updateDebug(): void {
        debugPanel.update();
        requestAnimationFrame(updateDebug);
      }
      requestAnimationFrame(updateDebug);
    }

    gameLoop.start();
    console.log('TrenchWars client started (local-only)');
  }
}

main().catch(console.error);
