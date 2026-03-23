/**
 * Kill feed overlay at top-right of screen.
 * Shows recent kills with killer/victim names and weapon icon.
 * Entries auto-fade after 5 seconds, max 5 visible at a time.
 */
export class KillFeed {
  private container: HTMLDivElement;
  private entries: HTMLDivElement[] = [];
  private timers: number[] = [];

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'kill-feed';
    this.container.style.cssText = [
      'position: fixed',
      'top: 16px',
      'right: 16px',
      'z-index: 100',
      'pointer-events: none',
      'font-family: monospace',
      'display: flex',
      'flex-direction: column',
      'align-items: flex-end',
    ].join('; ');

    document.body.appendChild(this.container);
  }

  /**
   * Add a kill entry to the feed.
   * @param killerName - name of the killer
   * @param victimName - name of the victim
   * @param weaponType - 'bullet' or 'bomb'
   */
  addKill(killerName: string, victimName: string, weaponType: 'bullet' | 'bomb'): void {
    const entry = document.createElement('div');
    entry.style.cssText = [
      'font-size: 14px',
      'font-family: monospace',
      'background: rgba(0,0,0,0.5)',
      'padding: 4px 8px',
      'margin: 4px 0',
      'border-radius: 2px',
      'opacity: 0',
      'transition: opacity 0.2s ease',
      'white-space: nowrap',
    ].join('; ');

    const killerSpan = document.createElement('span');
    killerSpan.textContent = killerName;
    killerSpan.style.color = '#00ff88';

    const weaponIcon = weaponType === 'bullet' ? ' > ' : ' * ';
    const weaponSpan = document.createElement('span');
    weaponSpan.textContent = weaponIcon;
    weaponSpan.style.color = '#ffffff';

    const victimSpan = document.createElement('span');
    victimSpan.textContent = victimName;
    victimSpan.style.color = '#ff3333';

    entry.appendChild(killerSpan);
    entry.appendChild(weaponSpan);
    entry.appendChild(victimSpan);

    this.container.appendChild(entry);
    this.entries.push(entry);

    // Fade in
    requestAnimationFrame(() => {
      entry.style.opacity = '1';
    });

    // Remove oldest if over max
    while (this.entries.length > 5) {
      this.removeEntry(0);
    }

    // Auto-fade after 5000ms, then remove after fade (500ms)
    const timer = window.setTimeout(() => {
      entry.style.transition = 'opacity 0.5s ease';
      entry.style.opacity = '0';
      const removeTimer = window.setTimeout(() => {
        const idx = this.entries.indexOf(entry);
        if (idx !== -1) {
          this.removeEntry(idx);
        }
      }, 500);
      // Track remove timer in the same slot
      const timerIdx = this.timers.indexOf(timer);
      if (timerIdx !== -1) {
        this.timers[timerIdx] = removeTimer;
      }
    }, 5000);
    this.timers.push(timer);
  }

  private removeEntry(index: number): void {
    const entry = this.entries[index];
    if (entry && entry.parentNode) {
      entry.parentNode.removeChild(entry);
    }
    this.entries.splice(index, 1);
    // Clear associated timer
    if (this.timers[index] !== undefined) {
      clearTimeout(this.timers[index]);
      this.timers.splice(index, 1);
    }
  }

  destroy(): void {
    // Clear all timers
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];
    this.entries = [];
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
