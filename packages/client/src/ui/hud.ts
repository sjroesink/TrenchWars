/**
 * In-game HUD overlay: energy bar (color-coded by threshold) and K/D counter.
 * Positioned over the PixiJS canvas via fixed HTML elements.
 */
export class HUD {
  private container: HTMLDivElement;
  private energyFill: HTMLDivElement;
  private energyLabel: HTMLDivElement;
  private kdText: HTMLDivElement;

  constructor() {
    // Root container covering the full screen, non-interactive
    this.container = document.createElement('div');
    this.container.id = 'hud';
    this.container.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'z-index: 100',
      'pointer-events: none',
      'font-family: monospace',
    ].join('; ');

    // --- Energy bar (bottom center) ---
    const energyContainer = document.createElement('div');
    energyContainer.style.cssText = [
      'position: absolute',
      'bottom: 16px',
      'left: 50%',
      'transform: translateX(-50%)',
      'text-align: center',
    ].join('; ');

    // Label above the bar
    this.energyLabel = document.createElement('div');
    this.energyLabel.textContent = 'ENERGY';
    this.energyLabel.style.cssText = [
      'font-size: 12px',
      'font-weight: 600',
      'color: #888888',
      'margin-bottom: 4px',
      'font-family: monospace',
    ].join('; ');
    energyContainer.appendChild(this.energyLabel);

    // Outer track
    const energyTrack = document.createElement('div');
    energyTrack.style.cssText = [
      'width: 200px',
      'height: 12px',
      'background: rgba(255,255,255,0.15)',
      'border: 1px solid rgba(255,255,255,0.3)',
      'border-radius: 2px',
      'overflow: hidden',
    ].join('; ');

    // Inner fill
    this.energyFill = document.createElement('div');
    this.energyFill.style.cssText = [
      'width: 100%',
      'height: 100%',
      'background: #00ff88',
      'transition: width 0.1s linear',
    ].join('; ');
    energyTrack.appendChild(this.energyFill);
    energyContainer.appendChild(energyTrack);
    this.container.appendChild(energyContainer);

    // --- K/D counter (bottom left) ---
    this.kdText = document.createElement('div');
    this.kdText.textContent = 'K: 0  D: 0';
    this.kdText.style.cssText = [
      'position: absolute',
      'bottom: 16px',
      'left: 16px',
      'font-size: 14px',
      'font-family: monospace',
      'color: #ffffff',
      'background: rgba(0,0,0,0.5)',
      'padding: 8px',
      'border-radius: 2px',
    ].join('; ');
    this.container.appendChild(this.kdText);

    document.body.appendChild(this.container);
  }

  /**
   * Update HUD values each frame.
   * Energy bar fill width and color change based on percentage thresholds.
   */
  update(energy: number, maxEnergy: number, kills: number, deaths: number): void {
    const pct = maxEnergy > 0 ? Math.max(0, Math.min(1, energy / maxEnergy)) : 0;
    this.energyFill.style.width = `${pct * 100}%`;

    // Color thresholds
    if (pct >= 0.5) {
      this.energyFill.style.background = '#00ff88';
    } else if (pct >= 0.25) {
      this.energyFill.style.background = '#ffaa00';
    } else {
      this.energyFill.style.background = '#ff3333';
    }

    this.kdText.textContent = `K: ${kills}  D: ${deaths}`;
  }

  destroy(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
