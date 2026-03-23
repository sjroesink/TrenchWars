import type { ShipInput } from '@trench-wars/shared';

export interface WeaponInput {
  fire: boolean;
  fireBomb: boolean;
}

/**
 * Keyboard state polling for arrow keys, shift, and fire buttons.
 * Tracks key states via keydown/keyup events, polled each frame.
 * Fire inputs use edge detection (true only on keydown, cleared after poll).
 */
export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private firePressed = false;
  private fireBombPressed = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);

      // Edge-detect fire buttons (true once per press, ignore auto-repeat)
      if (e.code === 'Space' && !e.repeat) {
        this.firePressed = true;
        e.preventDefault();
      }
      if ((e.code === 'Tab' || e.code === 'KeyF') && !e.repeat) {
        this.fireBombPressed = true;
        e.preventDefault();
      }

      // Prevent arrow keys from scrolling the page
      if (
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown'
      ) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });
  }

  poll(): ShipInput {
    return {
      left: this.keys.get('ArrowLeft') ?? false,
      right: this.keys.get('ArrowRight') ?? false,
      thrust: this.keys.get('ArrowUp') ?? false,
      afterburner: this.keys.get('ShiftLeft') ?? this.keys.get('ShiftRight') ?? false,
    };
  }

  /** Poll and consume fire button edges. Clears after read. */
  pollWeapons(): WeaponInput {
    const result: WeaponInput = {
      fire: this.firePressed,
      fireBomb: this.fireBombPressed,
    };
    this.firePressed = false;
    this.fireBombPressed = false;
    return result;
  }
}
