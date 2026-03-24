import GUI from 'lil-gui';
import type { ShipState, ShipConfig } from '@trench-wars/shared';
import { WARBIRD, JAVELIN, SPIDER, DEFAULT_BOUNCE_FACTOR } from '@trench-wars/shared';
import type { GameLoop } from './game-loop';

declare const __APP_VERSION__: string;

const SHIP_PRESETS: Record<string, ShipConfig> = {
  Warbird: WARBIRD,
  Javelin: JAVELIN,
  Spider: SPIDER,
};

/**
 * lil-gui panel for physics parameter tweaking.
 * Provides real-time tuning of ship physics parameters and
 * a display of current speed, position, energy, and FPS.
 */
export class DebugPanel {
  private gui: GUI;
  private displayFolder!: ReturnType<GUI['addFolder']>;
  private display = {
    fps: 0,
    speed: 0,
    posX: 0,
    posY: 0,
    energy: 0,
    orientation: 0,
  };

  constructor(
    private shipConfig: ShipConfig,
    private shipState: ShipState,
    private gameLoop: GameLoop,
  ) {
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
    this.gui = new GUI({ title: `TrenchWars v${version}` });

    // Ship selector
    const selector = { ship: shipConfig.name };
    this.gui.add(selector, 'ship', Object.keys(SHIP_PRESETS)).name('Ship').onChange((name: string) => {
      const preset = SHIP_PRESETS[name];
      if (preset) {
        Object.assign(this.shipConfig, preset);
        // Refresh all GUI controllers to reflect new config values
        this.gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }
    });

    // Physics parameters
    const physicsFolder = this.gui.addFolder('Physics');
    physicsFolder.add(this.shipConfig, 'rotation', 0.1, 2.0, 0.01).name('Rotation Speed');
    physicsFolder.add(this.shipConfig, 'thrust', 1, 50, 0.5).name('Thrust Power');
    physicsFolder.add(this.shipConfig, 'speed', 1, 50, 0.5).name('Max Speed');
    physicsFolder.add(this.shipConfig, 'maxThrust', 1, 50, 0.5).name('Afterburner Thrust');
    physicsFolder.add(this.shipConfig, 'maxSpeed', 1, 80, 0.5).name('Afterburner Max Speed');

    // Bounce factor
    const bounceParams = { bounceFactor: DEFAULT_BOUNCE_FACTOR };
    physicsFolder
      .add(bounceParams, 'bounceFactor', 0, 2, 0.05)
      .name('Bounce Factor')
      .onChange((v: number) => {
        this.gameLoop.setBounceFactor(v);
      });

    // Display (read-only)
    this.displayFolder = this.gui.addFolder('Display');
    this.displayFolder.add(this.display, 'fps').name('FPS').listen().disable();
    this.displayFolder.add(this.display, 'speed').name('Speed').listen().disable();
    this.displayFolder.add(this.display, 'posX').name('X').listen().disable();
    this.displayFolder.add(this.display, 'posY').name('Y').listen().disable();
    this.displayFolder.add(this.display, 'energy').name('Energy').listen().disable();
    this.displayFolder.add(this.display, 'orientation').name('Orientation').listen().disable();
  }

  /**
   * Update display values. Call each frame from the game loop or main.
   */
  update(): void {
    const speed = Math.sqrt(
      this.shipState.vx * this.shipState.vx + this.shipState.vy * this.shipState.vy,
    );
    this.display.fps = this.gameLoop.fps;
    this.display.speed = Math.round(speed * 100) / 100;
    this.display.posX = Math.round(this.shipState.x * 10) / 10;
    this.display.posY = Math.round(this.shipState.y * 10) / 10;
    this.display.energy = Math.round(this.shipState.energy);
    this.display.orientation = Math.round(this.shipState.orientation * 360);
  }
}
