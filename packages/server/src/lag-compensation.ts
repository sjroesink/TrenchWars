/**
 * Lag compensation module for fair hit detection across varying latencies.
 * Stores a rolling buffer of player position snapshots and supports
 * rewinding to any recorded tick for projectile-player collision checks.
 */

interface PositionSnapshot {
  tick: number;
  positions: Map<string, { x: number; y: number; radius: number }>;
}

export class LagCompensation {
  private history: PositionSnapshot[] = [];
  private maxHistoryTicks: number;

  constructor(maxHistoryTicks = 200) {
    this.maxHistoryTicks = maxHistoryTicks;
  }

  /**
   * Record all alive players' positions for the given tick.
   * Oldest entries are pruned when history exceeds maxHistoryTicks.
   */
  record(tick: number, players: Array<{ id: string; x: number; y: number; radius: number }>): void {
    const positions = new Map<string, { x: number; y: number; radius: number }>();
    for (const p of players) {
      positions.set(p.id, { x: p.x, y: p.y, radius: p.radius });
    }
    this.history.push({ tick, positions });
    while (this.history.length > this.maxHistoryTicks) {
      this.history.shift();
    }
  }

  /**
   * Retrieve player positions at the closest recorded tick <= the requested tick.
   * Returns null if no snapshot exists at or before the requested tick.
   */
  getPositionsAtTick(tick: number): Map<string, { x: number; y: number; radius: number }> | null {
    // Scan from newest to oldest for the first snapshot with tick <= requested
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].tick <= tick) {
        return this.history[i].positions;
      }
    }
    return null;
  }
}
