import type { GameSnapshot } from '@trench-wars/shared';

export interface InterpolatedEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  orientation: number;
  energy: number;
  shipType: number;
  alive: boolean;
}

const INTERPOLATION_DELAY = 100; // ms -- one server update interval at 20Hz

export class InterpolationManager {
  private snapshotBuffer: { time: number; snapshot: GameSnapshot }[] = [];
  private maxBufferSize = 10;

  /** Add a snapshot with its receive time */
  addSnapshot(snapshot: GameSnapshot): void {
    this.snapshotBuffer.push({ time: Date.now(), snapshot });
    // Keep only recent snapshots
    while (this.snapshotBuffer.length > this.maxBufferSize) {
      this.snapshotBuffer.shift();
    }
  }

  /** Get interpolated state for a remote player */
  getInterpolatedPlayer(playerId: string): InterpolatedEntity | null {
    if (this.snapshotBuffer.length < 2) return null;

    const renderTime = Date.now() - INTERPOLATION_DELAY;

    // Find two snapshots surrounding renderTime
    let prev = this.snapshotBuffer[0];
    let next = this.snapshotBuffer[1];

    for (let i = 1; i < this.snapshotBuffer.length; i++) {
      if (this.snapshotBuffer[i].time >= renderTime) {
        prev = this.snapshotBuffer[i - 1];
        next = this.snapshotBuffer[i];
        break;
      }
      // If all snapshots are in the past, use the last two
      if (i === this.snapshotBuffer.length - 1) {
        prev = this.snapshotBuffer[i - 1];
        next = this.snapshotBuffer[i];
      }
    }

    const prevPlayer = prev.snapshot.players.find((p) => p.id === playerId);
    const nextPlayer = next.snapshot.players.find((p) => p.id === playerId);

    if (!prevPlayer || !nextPlayer) return null;

    const duration = next.time - prev.time;
    const alpha =
      duration > 0
        ? Math.max(0, Math.min(1, (renderTime - prev.time) / duration))
        : 0;

    return {
      x: lerp(prevPlayer.x, nextPlayer.x, alpha),
      y: lerp(prevPlayer.y, nextPlayer.y, alpha),
      vx: lerp(prevPlayer.vx, nextPlayer.vx, alpha),
      vy: lerp(prevPlayer.vy, nextPlayer.vy, alpha),
      orientation: lerpAngle(
        prevPlayer.orientation,
        nextPlayer.orientation,
        alpha,
      ),
      energy: lerp(prevPlayer.energy, nextPlayer.energy, alpha),
      shipType: nextPlayer.shipType,
      alive: nextPlayer.alive,
    };
  }

  /** Get interpolated projectiles from latest snapshot (simple -- projectiles move predictably) */
  getProjectiles(): GameSnapshot['projectiles'] {
    if (this.snapshotBuffer.length === 0) return [];
    return this.snapshotBuffer[this.snapshotBuffer.length - 1].snapshot
      .projectiles;
  }

  /** Get all remote player IDs from latest snapshot */
  getRemotePlayerIds(localPlayerId: string): string[] {
    if (this.snapshotBuffer.length === 0) return [];
    const latest =
      this.snapshotBuffer[this.snapshotBuffer.length - 1].snapshot;
    return latest.players
      .filter((p) => p.id !== localPlayerId && p.alive)
      .map((p) => p.id);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  // Handle wrap-around for orientation (0-1 range)
  let diff = b - a;
  if (diff > 0.5) diff -= 1;
  if (diff < -0.5) diff += 1;
  let result = a + diff * t;
  if (result < 0) result += 1;
  if (result >= 1) result -= 1;
  return result;
}
