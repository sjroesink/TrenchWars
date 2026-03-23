/**
 * Tab-toggled scoreboard overlay.
 * Shows all players sorted by kills with the local player highlighted.
 * Centered on screen with z-index: 300.
 */

const SHIP_NAMES = ['WB', 'JV', 'SP'];

export interface ScoreboardPlayer {
  id: string;
  name: string;
  kills: number;
  deaths: number;
  shipType: number;
}

export class Scoreboard {
  private overlay: HTMLDivElement;
  private tableBody: HTMLDivElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'scoreboard';
    this.overlay.style.cssText = [
      'position: fixed',
      'top: 50%',
      'left: 50%',
      'transform: translate(-50%, -50%)',
      'z-index: 300',
      'display: none',
      'flex-direction: column',
      'width: 480px',
      'max-height: 70vh',
      'overflow-y: auto',
      'background: rgba(0,0,0,0.85)',
      'border: 1px solid rgba(255,255,255,0.2)',
      'border-radius: 4px',
      'font-family: monospace',
      'color: #ffffff',
      'pointer-events: none',
    ].join('; ');

    // Title
    const title = document.createElement('div');
    title.textContent = 'SCOREBOARD';
    title.style.cssText = [
      'font-size: 22px',
      'font-weight: 600',
      'text-align: center',
      'padding: 24px',
      'font-family: monospace',
      'color: #ffffff',
    ].join('; ');
    this.overlay.appendChild(title);

    // Header row
    const header = document.createElement('div');
    header.style.cssText = [
      'display: flex',
      'padding: 4px 8px',
      'font-size: 12px',
      'font-weight: 600',
      'text-transform: uppercase',
      'color: #888888',
      'border-bottom: 1px solid rgba(255,255,255,0.1)',
      'font-family: monospace',
    ].join('; ');
    header.innerHTML = [
      '<span style="width:40px">#</span>',
      '<span style="flex:1">Name</span>',
      '<span style="width:40px;text-align:center">Ship</span>',
      '<span style="width:50px;text-align:right">Kills</span>',
      '<span style="width:60px;text-align:right">Deaths</span>',
      '<span style="width:60px;text-align:right">K/D</span>',
    ].join('');
    this.overlay.appendChild(header);

    // Table body container
    this.tableBody = document.createElement('div');
    this.overlay.appendChild(this.tableBody);

    document.body.appendChild(this.overlay);
  }

  show(): void {
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  /**
   * Rebuild the scoreboard rows from player data.
   * Sorted by kills descending. Local player row is highlighted.
   */
  update(players: ScoreboardPlayer[], localPlayerId: string): void {
    // Sort by kills descending
    const sorted = [...players].sort((a, b) => b.kills - a.kills);

    // Clear existing rows
    this.tableBody.innerHTML = '';

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const isLocal = p.id === localPlayerId;
      const kdRatio = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2);
      const shipName = SHIP_NAMES[p.shipType] ?? '??';

      const row = document.createElement('div');
      row.style.cssText = [
        'display: flex',
        'height: 32px',
        'align-items: center',
        'padding: 4px 8px',
        'font-size: 14px',
        'font-family: monospace',
        'color: #ffffff',
        isLocal ? 'background: rgba(0,255,136,0.1)' : '',
      ].join('; ');

      row.innerHTML = [
        `<span style="width:40px">${i + 1}</span>`,
        `<span style="flex:1;overflow:hidden;text-overflow:ellipsis">${this.escapeHtml(p.name)}</span>`,
        `<span style="width:40px;text-align:center">${shipName}</span>`,
        `<span style="width:50px;text-align:right">${p.kills}</span>`,
        `<span style="width:60px;text-align:right">${p.deaths}</span>`,
        `<span style="width:60px;text-align:right">${kdRatio}</span>`,
      ].join('');

      this.tableBody.appendChild(row);
    }
  }

  destroy(): void {
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
