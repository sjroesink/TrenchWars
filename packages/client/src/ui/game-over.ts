/**
 * Game-over overlay screen.
 * Shows winner text with auto-dismiss after 5 seconds.
 */
export class GameOverScreen {
  private overlay: HTMLDivElement;
  private winnerText: HTMLDivElement;
  private subtitleText: HTMLDivElement;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'game-over';
    this.overlay.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'background: rgba(0,0,0,0.85)',
      'display: none',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'z-index: 1000',
      'font-family: monospace',
      'pointer-events: none',
    ].join('; ');

    this.winnerText = document.createElement('div');
    this.winnerText.style.cssText = [
      'font-size: 28px',
      'font-weight: 600',
      'text-align: center',
      'margin-bottom: 12px',
    ].join('; ');
    this.overlay.appendChild(this.winnerText);

    this.subtitleText = document.createElement('div');
    this.subtitleText.style.cssText = [
      'font-size: 14px',
      'color: #888888',
      'text-align: center',
    ].join('; ');
    this.overlay.appendChild(this.subtitleText);

    document.body.appendChild(this.overlay);
  }

  /**
   * Show the game-over overlay with winner information.
   * Auto-dismisses after 5 seconds.
   */
  show(text: string, color: string, subtitle?: string): void {
    this.winnerText.textContent = text;
    this.winnerText.style.color = color;
    this.subtitleText.textContent = subtitle || '';
    this.overlay.style.display = 'flex';

    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
    }
    this.dismissTimer = setTimeout(() => this.hide(), 5000);
  }

  /** Hide the game-over overlay. */
  hide(): void {
    this.overlay.style.display = 'none';
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }

  /** Remove the overlay from the DOM. */
  destroy(): void {
    this.hide();
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
