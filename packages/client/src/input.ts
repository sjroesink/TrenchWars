import type { ShipInput } from '@trench-wars/shared';

export interface WeaponInput {
  fire: boolean;
  fireBomb: boolean;
  multifire: boolean;
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
  private multifirePressed = false;
  private chatActive = false;
  private scoreboardHeld = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);

      // Edge-detect fire buttons (true once per press, ignore auto-repeat)
      if (e.code === 'Space' && !e.repeat) {
        this.firePressed = true;
        e.preventDefault();
      }
      if (e.code === 'KeyF' && !e.repeat) {
        this.fireBombPressed = true;
        e.preventDefault();
      }
      if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) {
        this.multifirePressed = true;
        e.preventDefault();
      }

      // Tab key for scoreboard toggle
      if (e.code === 'Tab') {
        this.scoreboardHeld = true;
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

      if (e.code === 'Tab') {
        this.scoreboardHeld = false;
      }
    });
  }

  /** Set chat active state -- disables ship controls while typing */
  setChatActive(active: boolean): void {
    this.chatActive = active;
  }

  /** Returns true while Tab key is held down (for scoreboard display). */
  isScoreboardHeld(): boolean {
    return this.scoreboardHeld;
  }

  poll(): ShipInput {
    if (this.chatActive) {
      return { left: false, right: false, thrust: false, reverse: false, afterburner: false, multifire: false };
    }
    return {
      left: this.keys.get('ArrowLeft') ?? false,
      right: this.keys.get('ArrowRight') ?? false,
      thrust: this.keys.get('ArrowUp') ?? false,
      reverse: this.keys.get('ArrowDown') ?? false,
      afterburner: this.keys.get('ShiftLeft') ?? this.keys.get('ShiftRight') ?? false,
      multifire: this.keys.get('ControlLeft') ?? this.keys.get('ControlRight') ?? false,
    };
  }

  /** Poll and consume fire button edges. Clears after read. */
  pollWeapons(): WeaponInput {
    if (this.chatActive) {
      return { fire: false, fireBomb: false, multifire: false };
    }
    const result: WeaponInput = {
      fire: this.firePressed,
      fireBomb: this.fireBombPressed,
      multifire: this.multifirePressed,
    };
    this.firePressed = false;
    this.fireBombPressed = false;
    this.multifirePressed = false;
    return result;
  }
}
