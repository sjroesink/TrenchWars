import type { ShipState, ShipInput, ShipConfig, TileMap } from '@trench-wars/shared';
import { updateShipPhysics, applyWallCollision, TICK_DT, DEFAULT_BOUNCE_FACTOR } from '@trench-wars/shared';

export interface BufferedInput {
  seq: number;
  tick: number;
  data: ShipInput;
  fire: boolean;
  fireBomb: boolean;
}

export class PredictionManager {
  private inputBuffer: BufferedInput[] = [];
  private seq = 0;

  /** Record input and return buffered entry with sequence number */
  recordInput(input: ShipInput, tick: number, fire: boolean, fireBomb: boolean): BufferedInput {
    const buffered: BufferedInput = { seq: ++this.seq, tick, data: { ...input }, fire, fireBomb };
    this.inputBuffer.push(buffered);
    return buffered;
  }

  /** Get current sequence number */
  getSeq(): number {
    return this.seq;
  }

  /** Get pending input count (for debug display) */
  getPendingCount(): number {
    return this.inputBuffer.length;
  }

  /**
   * Reconcile with server state:
   * 1. Discard inputs acknowledged by server (seq <= lastProcessedSeq)
   * 2. Set local state to server's authoritative state
   * 3. Replay unacknowledged inputs through full physics pipeline
   */
  reconcile(
    serverState: ShipState,
    lastProcessedSeq: number,
    config: ShipConfig,
    map: TileMap,
    bounceFactor: number = DEFAULT_BOUNCE_FACTOR,
  ): ShipState {
    // Discard acknowledged inputs
    this.inputBuffer = this.inputBuffer.filter((i) => i.seq > lastProcessedSeq);

    // Start from server state
    const state: ShipState = { ...serverState };

    // Replay unacknowledged inputs through COMPLETE physics pipeline
    for (const input of this.inputBuffer) {
      updateShipPhysics(state, input.data, config, TICK_DT);
      applyWallCollision(state, TICK_DT, map, config.radius, bounceFactor);
    }

    return state;
  }

  /** Clear all buffered inputs (on reconnect or ship change) */
  clear(): void {
    this.inputBuffer = [];
    this.seq = 0;
  }
}
