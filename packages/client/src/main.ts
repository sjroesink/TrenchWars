import { Application } from 'pixi.js';
import { parseMap, WARBIRD } from '@trench-wars/shared';
import type { ShipState, ShipConfig } from '@trench-wars/shared';
import { InputManager } from './input';
import { Camera } from './camera';
import { Renderer } from './renderer';
import { GameLoop } from './game-loop';
import { DebugPanel } from './debug';

async function main(): Promise<void> {
  // Load arena map from public assets
  const response = await fetch('/maps/arena.json');
  const json = await response.text();
  const tileMap = parseMap(json);

  // Create initial ship state (spawn in open area of the map)
  const shipState: ShipState = {
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    orientation: 0,
    energy: 1000,
  };

  // Mutable config copy so debug panel can modify it
  const shipConfig: ShipConfig = { ...WARBIRD };

  // Initialize systems
  const inputManager = new InputManager();
  const camera = new Camera();
  const renderer = new Renderer();
  await renderer.init(tileMap);

  // Create game loop
  const gameLoop = new GameLoop({
    shipState,
    shipConfig,
    tileMap,
    inputManager,
    camera,
    renderer,
  });

  // Create debug panel (references the same mutable config and state)
  const debugPanel = new DebugPanel(shipConfig, shipState, gameLoop);

  // Hook debug panel update into RAF via a separate loop
  function updateDebug(): void {
    debugPanel.update();
    requestAnimationFrame(updateDebug);
  }
  requestAnimationFrame(updateDebug);

  // Start the game
  gameLoop.start();

  console.log('TrenchWars client started');
}

main().catch(console.error);
