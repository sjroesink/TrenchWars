import type { RoomInfo } from '@trench-wars/shared';

/**
 * Room selection overlay UI.
 * Shows available rooms as clickable cards. Returns a Promise
 * that resolves with the selected room ID.
 */
export class RoomSelect {
  private overlay: HTMLDivElement | null = null;

  /**
   * Show room selection overlay.
   * Auto-selects if only one room has space.
   * Returns the selected room ID.
   */
  show(rooms: RoomInfo[]): Promise<string> {
    // Auto-select if only one room has space
    const availableRooms = rooms.filter(r => r.playerCount < r.maxPlayers);
    if (availableRooms.length === 1) {
      return Promise.resolve(availableRooms[0].id);
    }
    // If no rooms available at all, return first room id (server will reject if full)
    if (availableRooms.length === 0 && rooms.length > 0) {
      return Promise.resolve(rooms[0].id);
    }

    return new Promise<string>((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = 'room-select-overlay';
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
      title.textContent = 'Select Arena:';
      title.style.cssText = 'font-size: 28px; margin-bottom: 40px; color: #00ff00;';
      overlay.appendChild(title);

      // Room cards container
      const container = document.createElement('div');
      container.style.cssText = 'display: flex; gap: 24px; flex-wrap: wrap; justify-content: center;';

      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const isFull = room.playerCount >= room.maxPlayers;

        const card = document.createElement('div');
        card.style.cssText = [
          'padding: 24px 32px',
          'border: 2px solid ' + (isFull ? '#666' : '#00ff88'),
          'border-radius: 8px',
          'cursor: ' + (isFull ? 'not-allowed' : 'pointer'),
          'min-width: 200px',
          'text-align: center',
          'opacity: ' + (isFull ? '0.5' : '1'),
          'transition: border-color 0.15s, box-shadow 0.15s',
        ].join('; ');

        // Room name
        const nameEl = document.createElement('div');
        nameEl.textContent = room.name;
        nameEl.style.cssText = 'font-size: 22px; color: #00ff88; margin-bottom: 12px;';
        card.appendChild(nameEl);

        // Player count
        const countEl = document.createElement('div');
        countEl.textContent = `${room.playerCount} / ${room.maxPlayers} players`;
        countEl.style.cssText = 'font-size: 16px; color: #aaaaaa; margin-bottom: 8px;';
        card.appendChild(countEl);

        // Mode
        const modeEl = document.createElement('div');
        modeEl.textContent = room.mode.toUpperCase();
        modeEl.style.cssText = 'font-size: 14px; color: #888888;';
        card.appendChild(modeEl);

        // Key hint
        const keyEl = document.createElement('div');
        keyEl.textContent = `[${i + 1}]`;
        keyEl.style.cssText = 'font-size: 14px; color: #666666; margin-top: 8px;';
        card.appendChild(keyEl);

        if (!isFull) {
          card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#44ffaa';
            card.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.3)';
          });
          card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#00ff88';
            card.style.boxShadow = 'none';
          });
          card.addEventListener('click', () => {
            cleanup();
            resolve(room.id);
          });
        }

        container.appendChild(card);
      }

      overlay.appendChild(container);

      // Hint
      const hint = document.createElement('div');
      hint.textContent = 'Press number key or click to select';
      hint.style.cssText = 'font-size: 14px; margin-top: 30px; color: #888888;';
      overlay.appendChild(hint);

      document.body.appendChild(overlay);
      this.overlay = overlay;

      // Key handler
      const onKey = (e: KeyboardEvent) => {
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < rooms.length) {
          const room = rooms[index];
          if (room.playerCount < room.maxPlayers) {
            cleanup();
            resolve(room.id);
          }
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
