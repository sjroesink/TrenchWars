import { describe, it, expect } from 'vitest';
import { isSpectator } from '../game-modes/spectator';
import type { PlayerState } from '@trench-wars/shared';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    name: 'Alice',
    shipType: 0,
    ship: { x: 0, y: 0, vx: 0, vy: 0, orientation: 0, energy: 1000 },
    alive: true,
    kills: 0,
    deaths: 0,
    lastProcessedSeq: 0,
    respawnTick: 0,
    sessionToken: 'tok',
    disconnectedAt: 0,
    ...overrides,
  };
}

describe('isSpectator', () => {
  it('returns true for spectating players', () => {
    const player = makePlayer({ spectating: true });
    expect(isSpectator(player)).toBe(true);
  });

  it('returns false for non-spectating players', () => {
    const player = makePlayer({ spectating: false });
    expect(isSpectator(player)).toBe(false);
  });

  it('returns false when spectating is undefined', () => {
    const player = makePlayer();
    expect(isSpectator(player)).toBe(false);
  });
});
