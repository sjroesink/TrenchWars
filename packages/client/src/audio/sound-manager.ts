import { Howl } from 'howler';

/**
 * Audio manager wrapping Howler.js with audio sprites for all game sounds.
 * Must be initialized after a user interaction (click/keypress) to satisfy
 * browser autoplay policy.
 */
export class SoundManager {
  private sfx: Howl | null = null;
  private initialized = false;
  private thrustId: number | null = null;

  /**
   * Initialize the Howl instance with audio sprites.
   * Call on first user interaction (e.g. ship-select click/key).
   */
  init(): void {
    if (this.initialized) return;

    this.sfx = new Howl({
      src: ['/audio/sfx.webm', '/audio/sfx.mp3'],
      sprite: {
        thrust:     [0, 200, true],     // looping
        bulletFire: [200, 150],
        bombFire:   [350, 300],
        explosion:  [650, 500],
        bounce:     [1150, 100],
        death:      [1250, 400],
      },
      volume: 0.5,
    });
    this.initialized = true;
  }

  /**
   * Play a named audio sprite.
   * @param name - Sprite name (thrust, bulletFire, bombFire, explosion, bounce, death)
   * @param pan - Optional stereo pan (-1 left to 1 right)
   */
  play(name: string, pan?: number): void {
    if (!this.initialized || !this.sfx) return;

    const id = this.sfx.play(name);
    if (pan !== undefined) {
      this.sfx.stereo(pan, id);
    }
  }

  /** Start the looping thrust sound. No-op if already playing. */
  startThrust(): void {
    if (!this.initialized || !this.sfx) return;
    if (this.thrustId !== null) return;

    this.thrustId = this.sfx.play('thrust');
  }

  /** Stop the looping thrust sound. */
  stopThrust(): void {
    if (!this.sfx || this.thrustId === null) return;

    this.sfx.stop(this.thrustId);
    this.thrustId = null;
  }

  /** Whether the sound manager has been initialized. */
  isInitialized(): boolean {
    return this.initialized;
  }
}
