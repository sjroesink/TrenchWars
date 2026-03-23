import { describe, it, expect, beforeEach } from 'vitest';
import { TeamArenaMode } from '../game-modes/team-arena-mode';

describe('TeamArenaMode', () => {
  let mode: TeamArenaMode;

  beforeEach(() => {
    mode = new TeamArenaMode({ roundCount: 5, livesPerRound: 3 });
  });

  describe('onPlayerJoin', () => {
    it('auto-balances by assigning to team with fewer players', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);
      mode.onPlayerJoin('p2', 'Bob', 1);
      mode.onPlayerJoin('p3', 'Charlie', 2);

      const state = mode.getState();
      // First player goes to team 0, second to team 1, third back to team 0
      expect(state.teams['p1']).toBe(0);
      expect(state.teams['p2']).toBe(1);
      expect(state.teams['p3']).toBe(0);
    });

    it('assigns team as 0 or 1', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);
      const state = mode.getState();
      expect([0, 1]).toContain(state.teams['p1']);
    });

    it('initializes player lives to livesPerRound', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);
      const state = mode.getState();
      expect(state.lives['p1']).toBe(3);
    });
  });

  describe('onKill', () => {
    it('decrements killed player lives', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);
      mode.onPlayerJoin('p2', 'Bob', 1);
      mode.onKill('p1', 'p2', 'bullet');

      const state = mode.getState();
      expect(state.lives['p2']).toBe(2);
    });

    it('does not decrement lives below 0', () => {
      // Use a 2v2 setup so eliminating one player doesn't end the round
      mode.onPlayerJoin('p1', 'Alice', 0);   // team 0
      mode.onPlayerJoin('p2', 'Bob', 1);     // team 1
      mode.onPlayerJoin('p3', 'Charlie', 0); // team 0
      mode.onPlayerJoin('p4', 'Diana', 1);   // team 1

      // Kill p2 three times (3 lives -> 0)
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');

      // p2 now at 0 lives -- one more kill shouldn't go negative
      mode.onKill('p1', 'p2', 'bullet');

      const state = mode.getState();
      expect(state.lives['p2']).toBe(0);
    });
  });

  describe('canRespawn', () => {
    it('returns false when player has 0 lives', () => {
      // 2v2 so eliminating one player doesn't end the round
      mode.onPlayerJoin('p1', 'Alice', 0);
      mode.onPlayerJoin('p2', 'Bob', 1);
      mode.onPlayerJoin('p3', 'Charlie', 0);
      mode.onPlayerJoin('p4', 'Diana', 1);

      // Use up all 3 of p2's lives
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');

      expect(mode.canRespawn('p2')).toBe(false);
    });

    it('returns true when player has lives remaining', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);
      mode.onPlayerJoin('p2', 'Bob', 1);
      mode.onPlayerJoin('p3', 'Charlie', 0);
      mode.onPlayerJoin('p4', 'Diana', 1);

      mode.onKill('p1', 'p2', 'bullet');
      expect(mode.canRespawn('p2')).toBe(true);
    });

    it('returns false for unknown players', () => {
      expect(mode.canRespawn('unknown')).toBe(false);
    });
  });

  describe('round lifecycle', () => {
    it('ends round when all players on a team reach 0 lives', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);  // team 0
      mode.onPlayerJoin('p2', 'Bob', 1);    // team 1

      // Kill p2 three times (3 lives) to eliminate team 1
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');
      const events = mode.onKill('p1', 'p2', 'bullet');

      // Should get a round-end event
      const roundEnd = events.find(e => e.type === 'round-end');
      expect(roundEnd).toBeDefined();
    });

    it('increments winning team score on round end', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);  // team 0
      mode.onPlayerJoin('p2', 'Bob', 1);    // team 1

      // Eliminate team 1
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');

      const state = mode.getState();
      // Team 0 wins the round
      expect(state.roundScores[0]).toBe(1);
      expect(state.roundScores[1]).toBe(0);
    });

    it('advances round number after round end', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);  // team 0
      mode.onPlayerJoin('p2', 'Bob', 1);    // team 1

      // Eliminate team 1
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');

      const state = mode.getState();
      expect(state.currentRound).toBe(2);
    });

    it('resets lives on new round', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);  // team 0
      mode.onPlayerJoin('p2', 'Bob', 1);    // team 1

      // Eliminate team 1
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');
      mode.onKill('p1', 'p2', 'bullet');

      // Lives should be reset for the new round
      const state = mode.getState();
      expect(state.lives['p1']).toBe(3);
      expect(state.lives['p2']).toBe(3);
    });

    it('emits game-over when all rounds completed', () => {
      const shortMode = new TeamArenaMode({ roundCount: 2, livesPerRound: 1 });
      shortMode.onPlayerJoin('p1', 'Alice', 0);  // team 0
      shortMode.onPlayerJoin('p2', 'Bob', 1);    // team 1

      // Round 1: eliminate team 1
      shortMode.onKill('p1', 'p2', 'bullet');

      // Round 2: eliminate team 1 again
      const events = shortMode.onKill('p1', 'p2', 'bullet');

      const gameOver = events.find(e => e.type === 'game-over');
      expect(gameOver).toBeDefined();
    });
  });

  describe('getState', () => {
    it('includes all required fields', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);
      mode.onPlayerJoin('p2', 'Bob', 1);

      const state = mode.getState();
      expect(state.type).toBe('team-arena');
      expect(state.teams).toBeDefined();
      expect(state.lives).toBeDefined();
      expect(state.roundScores).toEqual([0, 0]);
      expect(state.currentRound).toBe(1);
      expect(state.totalRounds).toBe(5);
      expect(state.roundActive).toBe(true);
    });
  });

  describe('onPlayerLeave', () => {
    it('removes player from teams and lives', () => {
      mode.onPlayerJoin('p1', 'Alice', 0);
      mode.onPlayerJoin('p2', 'Bob', 1);
      mode.onPlayerLeave('p1');

      const state = mode.getState();
      expect(state.teams['p1']).toBeUndefined();
      expect(state.lives['p1']).toBeUndefined();
    });
  });
});
