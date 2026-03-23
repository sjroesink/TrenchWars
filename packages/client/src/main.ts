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
import { Chat } from './ui/chat';
import { HUD } from './ui/hud';
import { KillFeed } from './ui/kill-feed';
import { Scoreboard } from './ui/scoreboard';
import { GameOverScreen } from './ui/game-over';
import { SoundManager } from './audio/sound-manager';
import type { GameModeState, FFAState } from '@trench-wars/shared';

/** Server WebSocket URL (configurable via query param or default) */
function getServerUrl(): string {
  const params = new URLSearchParams(window.location.search);
  if (params.get('server')) return params.get('server')!;
  // Dev mode (Vite on 9010): connect to separate server
  if (window.location.port === '9010') return 'ws://localhost:9020';
  // Production: WebSocket on same host as page (wss:// if https://)
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

async function main(): Promise<void> {
  // Load arena map from public assets
  const response = await fetch('/maps/arena.json');
  const json = await response.text();
  const tileMap = parseMap(json);

  // Player name — prompt or default
  const playerName = prompt('Enter name:') || 'Player';

  // Audio and game-over screen
  const soundManager = new SoundManager();
  const gameOverScreen = new GameOverScreen();

  // Show ship selection overlay before connecting
  // onInteraction initializes audio on first user gesture (browser autoplay policy)
  const shipSelectOverlay = new ShipSelectOverlay({
    onInteraction: () => soundManager.init(),
  });
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

  // UI overlays (created before network so handlers can reference them)
  const hud = new HUD();
  const killFeed = new KillFeed();
  const scoreboard = new Scoreboard();

  // Player name tracking for kill feed name resolution
  const playerNames = new Map<string, string>();

  // Chat overlay
  let networkRef: NetworkClient | undefined;
  const chat = new Chat(
    (message) => { if (networkRef?.isConnected()) networkRef.sendChat(message); },
    (active) => { inputManager.setChatActive(active); },
  );

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
          hud,
          soundManager,
          onFire: (type) => soundManager.play(type === 'bullet' ? 'bulletFire' : 'bombFire'),
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

        // Scoreboard toggle driven by Tab key hold
        function updateScoreboard(): void {
          if (inputManager.isScoreboardHeld()) {
            scoreboard.show();
          } else {
            scoreboard.hide();
          }
          requestAnimationFrame(updateScoreboard);
        }
        requestAnimationFrame(updateScoreboard);

        console.log('TrenchWars client started (networked)');
      },

      onSnapshot: (snapshot: GameSnapshot) => {
        if (gameLoop) {
          gameLoop.onSnapshot(snapshot);
        }
      },

      onPlayerJoin: (data) => {
        playerNames.set(data.playerId, data.name);
        console.log(`Player joined: ${data.name} (${data.playerId})`);
      },

      onPlayerLeave: (data) => {
        playerNames.delete(data.playerId);
        console.log(`Player left: ${data.playerId}`);
      },

      onDeath: (data) => {
        const killerName = playerNames.get(data.killerId) || data.killerId;
        const victimName = playerNames.get(data.killedId) || data.killedId;
        const weaponType = (data.weaponType === 'bomb' ? 'bomb' : 'bullet') as 'bullet' | 'bomb';
        killFeed.addKill(killerName, victimName, weaponType);
        // Audio: explosion for any death, death sound if local player died
        soundManager.play('explosion');
        if (data.killedId === playerId) {
          soundManager.play('death');
        }
        console.log(`Kill: ${killerName} -> ${victimName} (${data.weaponType})`);
      },

      onScoreUpdate: (data) => {
        const state = data.state;
        if (state.type === 'ffa') {
          const ffaState = state as FFAState;
          scoreboard.update(ffaState.leaderboard, playerId || '');
        }
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

      onChat: (data) => {
        chat.addMessage(data.name, data.message);
      },

      onGameState: (data) => {
        if (data.event === 'game-over') {
          const modeType = data.modeType as string | undefined;
          if (modeType === 'team-arena') {
            const winnerTeam = data.winnerTeam as number | undefined;
            const teamColor = winnerTeam === 0 ? '#4488ff' : '#ff4444';
            const teamName = winnerTeam === 0 ? 'Blue' : 'Red';
            gameOverScreen.show(`${teamName} team wins!`, teamColor, 'Match complete');
          } else {
            // FFA mode
            const winnerName = data.winnerName as string || 'Unknown';
            gameOverScreen.show(`${winnerName} wins the match!`, '#00ff88', 'Match complete');
          }
        }
      },

      onDisconnect: () => {
        console.warn('Disconnected from server -- attempting reconnect...');
      },

      onReconnect: () => {
        console.log('Reconnection successful');
      },
    });

    networkRef = network;
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
      hud,
      soundManager,
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
