/**
 * Ship selection overlay UI.
 * Shows a semi-transparent overlay with three ship options (1/2/3 keys or click).
 * Returns a Promise that resolves with the selected ship type index.
 */
export class ShipSelectOverlay {
  private overlay: HTMLDivElement | null = null;

  /**
   * Show the ship selection overlay and wait for the user to choose.
   * Resolves with ship type index: 0=Warbird, 1=Javelin, 2=Spider.
   */
  show(): Promise<number> {
    return new Promise<number>((resolve) => {
      // Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'ship-select-overlay';
      overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'background: rgba(0, 0, 0, 0.85)',
        'display: flex',
        'flex-direction: column',
        'align-items: center',
        'justify-content: center',
        'z-index: 1000',
        'font-family: monospace',
        'color: #ffffff',
      ].join('; ');

      // Title
      const title = document.createElement('div');
      title.textContent = 'Select your ship:';
      title.style.cssText = 'font-size: 28px; margin-bottom: 40px; color: #00ff00;';
      overlay.appendChild(title);

      // Ship options
      const ships = [
        { key: '1', name: 'Warbird', desc: 'Fast, agile fighter', color: '#ff6644' },
        { key: '2', name: 'Javelin', desc: 'Powerful bomber', color: '#4488ff' },
        { key: '3', name: 'Spider', desc: 'Balanced all-rounder', color: '#44ff44' },
      ];

      for (let i = 0; i < ships.length; i++) {
        const ship = ships[i];
        const option = document.createElement('div');
        option.textContent = `[${ship.key}] ${ship.name} - ${ship.desc}`;
        option.style.cssText = [
          'font-size: 22px',
          'margin: 12px 0',
          'padding: 12px 24px',
          'cursor: pointer',
          `color: ${ship.color}`,
          'border: 1px solid transparent',
          'transition: border-color 0.15s',
        ].join('; ');

        option.addEventListener('mouseenter', () => {
          option.style.borderColor = ship.color;
        });
        option.addEventListener('mouseleave', () => {
          option.style.borderColor = 'transparent';
        });

        const shipIndex = i;
        option.addEventListener('click', () => {
          cleanup();
          resolve(shipIndex);
        });

        overlay.appendChild(option);
      }

      // Hint
      const hint = document.createElement('div');
      hint.textContent = 'Press 1, 2, or 3 to select';
      hint.style.cssText = 'font-size: 14px; margin-top: 30px; color: #888888;';
      overlay.appendChild(hint);

      document.body.appendChild(overlay);
      this.overlay = overlay;

      // Key handler
      const onKey = (e: KeyboardEvent) => {
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index <= 2) {
          cleanup();
          resolve(index);
        }
      };

      const cleanup = () => {
        window.removeEventListener('keydown', onKey);
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
          this.overlay = null;
        }
      };

      window.addEventListener('keydown', onKey);
    });
  }
}
