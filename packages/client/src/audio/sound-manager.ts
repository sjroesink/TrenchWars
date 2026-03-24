import { Howl } from 'howler';

const SOUNDS = {
  thrust:     { src: '/audio/thrust.wav', loop: true, volume: 0.3 },
  bulletFire: { src: '/audio/bullet-fire.wav', volume: 0.4 },
  bombFire:   { src: '/audio/bomb-fire.wav', volume: 0.5 },
  explosion:  { src: '/audio/explosion.wav', volume: 0.5 },
  bounce:     { src: '/audio/bounce.wav', volume: 0.3 },
  death:      { src: '/audio/death.wav', volume: 0.6 },
} as const;

type SoundName = keyof typeof SOUNDS;

/**
 * Audio manager using individual Howl instances per sound.
 * Must be initialized after a user interaction to satisfy browser autoplay policy.
 */
export class SoundManager {
  private howls = new Map<string, Howl>();
  private initialized = false;
  private thrustId: number | null = null;

  /** Initialize all Howl instances. Call on first user interaction. */
  init(): void {
    if (this.initialized) return;

    for (const [name, config] of Object.entries(SOUNDS)) {
      this.howls.set(name, new Howl({
        src: [config.src],
        loop: 'loop' in config && config.loop,
        volume: config.volume,
      }));
    }
    this.initialized = true;
  }

  /** Play a named sound. */
  play(name: string): void {
    if (!this.initialized) return;
    this.howls.get(name)?.play();
  }

  /** Play a sound with volume scaled by distance (in tiles). */
  playAtDistance(name: string, distance: number, maxDistance = 30): void {
    if (!this.initialized) return;
    if (distance >= maxDistance) return;
    const howl = this.howls.get(name);
    if (!howl) return;
    const volume = Math.max(0, 1 - distance / maxDistance);
    const id = howl.play();
    howl.volume(volume * (SOUNDS[name as SoundName]?.volume ?? 0.5), id);
  }

  /** Start the looping thrust sound. */
  startThrust(): void {
    if (!this.initialized) return;
    if (this.thrustId !== null) return;
    const howl = this.howls.get('thrust');
    if (howl) this.thrustId = howl.play();
  }

  /** Stop the looping thrust sound. */
  stopThrust(): void {
    if (this.thrustId === null) return;
    const howl = this.howls.get('thrust');
    if (howl) howl.stop(this.thrustId);
    this.thrustId = null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
