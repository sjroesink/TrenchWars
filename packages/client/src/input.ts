import type { ShipInput } from '@trench-wars/shared';

/**
 * Keyboard state polling for arrow keys and shift.
 * Tracks key states via keydown/keyup events, polled each frame.
 */
export class InputManager {
  private keys: Map<string, boolean> = new Map();

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);
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
}
