import { describe, it, expect, beforeEach } from 'vitest';
import { FFAMode } from '../game-modes/ffa-mode';

describe('FFAMode', () => {
  let ffa: FFAMode;

  beforeEach(() => {
    ffa = new FFAMode(20);
  });

  describe('onPlayerJoin', () => {
    it('adds player to internal tracking', () => {
      ffa.onPlayerJoin('p1', 'Alice', 0);
      const state = ffa.getState();
      expect(state.leaderboard).toHaveLength(1);
      expect(state.leaderboard[0].id).toBe('p1');
      expect(state.leaderboard[0].name).toBe('Alice');
    });
  });

  describe('onKill', () => {
    it('increments killer score in leaderboard', () => {
      ffa.onPlayerJoin('p1', 'Alice', 0);
      ffa.onPlayerJoin('p2', 'Bob', 1);
      ffa.onKill('p1', 'p2', 'bullet');

      const state = ffa.getState();
      const alice = state.leaderboard.find(e => e.id === 'p1');
      expect(alice!.kills).toBe(1);
    });

    it('increments killed player deaths', () => {
      ffa.onPlayerJoin('p1', 'Alice', 0);
      ffa.onPlayerJoin('p2', 'Bob', 1);
      ffa.onKill('p1', 'p2', 'bullet');

      const state = ffa.getState();
      const bob = state.leaderboard.find(e => e.id === 'p2');
      expect(bob!.deaths).toBe(1);
    });

    it('triggers game-over event when killer reaches scoreLimit', () => {
      const ffa3 = new FFAMode(3);
      ffa3.onPlayerJoin('p1', 'Alice', 0);
      ffa3.onPlayerJoin('p2', 'Bob', 1);

      ffa3.onKill('p1', 'p2', 'bullet');
      ffa3.onKill('p1', 'p2', 'bullet');
      const events = ffa3.onKill('p1', 'p2', 'bullet');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('game-over');
    });

    it('does not trigger game-over before scoreLimit', () => {
      const ffa3 = new FFAMode(3);
      ffa3.onPlayerJoin('p1', 'Alice', 0);
      ffa3.onPlayerJoin('p2', 'Bob', 1);

      const events = ffa3.onKill('p1', 'p2', 'bullet');
      expect(events).toHaveLength(0);
    });
  });

  describe('getState', () => {
    it('returns players sorted by kills descending', () => {
      ffa.onPlayerJoin('p1', 'Alice', 0);
      ffa.onPlayerJoin('p2', 'Bob', 1);
      ffa.onPlayerJoin('p3', 'Charlie', 2);

      ffa.onKill('p2', 'p1', 'bullet');
      ffa.onKill('p2', 'p3', 'bullet');
      ffa.onKill('p3', 'p1', 'bomb');

      const state = ffa.getState();
      expect(state.type).toBe('ffa');
      expect(state.leaderboard[0].id).toBe('p2');
      expect(state.leaderboard[0].kills).toBe(2);
      expect(state.leaderboard[1].id).toBe('p3');
      expect(state.leaderboard[1].kills).toBe(1);
      expect(state.leaderboard[2].id).toBe('p1');
      expect(state.leaderboard[2].kills).toBe(0);
    });

    it('includes scoreLimit', () => {
      const state = ffa.getState();
      expect(state.scoreLimit).toBe(20);
    });
  });

  describe('canRespawn', () => {
    it('returns true for all players', () => {
      ffa.onPlayerJoin('p1', 'Alice', 0);
      expect(ffa.canRespawn('p1')).toBe(true);
    });

    it('returns true even for unknown players', () => {
      expect(ffa.canRespawn('unknown')).toBe(true);
    });
  });

  describe('onPlayerLeave', () => {
    it('removes player from leaderboard', () => {
      ffa.onPlayerJoin('p1', 'Alice', 0);
      ffa.onPlayerJoin('p2', 'Bob', 1);
      ffa.onPlayerLeave('p1');

      const state = ffa.getState();
      expect(state.leaderboard).toHaveLength(1);
      expect(state.leaderboard[0].id).toBe('p2');
    });
  });

  describe('onTick', () => {
    it('returns empty events array', () => {
      const events = ffa.onTick(100);
      expect(events).toEqual([]);
    });
  });
});
