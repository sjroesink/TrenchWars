import type { TeamArenaState } from '@trench-wars/shared';
import type { GameMode, GameModeEvent } from './game-mode';

interface TeamArenaOptions {
  roundCount?: number;
  livesPerRound?: number;
}

/**
 * Team arena elimination mode.
 * Two teams compete in rounds. Each player has a fixed number of lives per round.
 * When all players on a team reach 0 lives, the other team wins the round.
 * Best of N rounds determines the match winner.
 */
export class TeamArenaMode implements GameMode {
  readonly type = 'team-arena' as const;
  private teams = new Map<string, 0 | 1>();
  private lives = new Map<string, number>();
  private roundScores: [number, number] = [0, 0];
  private currentRound = 1;
  private totalRounds: number;
  private livesPerRound: number;
  private roundActive = true;

  constructor(options: TeamArenaOptions = {}) {
    this.totalRounds = options.roundCount ?? 5;
    this.livesPerRound = options.livesPerRound ?? 3;
  }

  onPlayerJoin(playerId: string, _name: string, _shipType: number): void {
    // Auto-balance: assign to team with fewer players
    let team0Count = 0;
    let team1Count = 0;
    for (const team of this.teams.values()) {
      if (team === 0) team0Count++;
      else team1Count++;
    }
    const team: 0 | 1 = team0Count <= team1Count ? 0 : 1;
    this.teams.set(playerId, team);
    this.lives.set(playerId, this.livesPerRound);
  }

  onPlayerLeave(playerId: string): void {
    this.teams.delete(playerId);
    this.lives.delete(playerId);
  }

  onKill(_killerId: string, killedId: string, _weaponType: string): GameModeEvent[] {
    const events: GameModeEvent[] = [];
    const currentLives = this.lives.get(killedId) ?? 0;
    this.lives.set(killedId, Math.max(0, currentLives - 1));

    // Check if the killed player's team is fully eliminated
    const killedTeam = this.teams.get(killedId);
    if (killedTeam === undefined) return events;

    const teamAlive = this.isTeamAlive(killedTeam);

    if (!teamAlive) {
      // Other team wins this round
      const winningTeam: 0 | 1 = killedTeam === 0 ? 1 : 0;
      this.roundScores[winningTeam]++;

      events.push({
        type: 'round-end',
        data: { winningTeam, round: this.currentRound, roundScores: [...this.roundScores] },
      });

      // Start next round or end game
      this.currentRound++;
      if (this.currentRound > this.totalRounds) {
        this.roundActive = false;
        events.push({
          type: 'game-over',
          data: { roundScores: [...this.roundScores] },
        });
      } else {
        // Reset lives for new round
        this.resetLives();
      }
    }

    return events;
  }

  onTick(_tick: number): GameModeEvent[] {
    return [];
  }

  getState(): TeamArenaState {
    const teams: Record<string, 0 | 1> = {};
    for (const [id, team] of this.teams) {
      teams[id] = team;
    }

    const lives: Record<string, number> = {};
    for (const [id, count] of this.lives) {
      lives[id] = count;
    }

    return {
      type: 'team-arena',
      teams,
      lives,
      roundScores: [...this.roundScores] as [number, number],
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      roundActive: this.roundActive,
    };
  }

  canRespawn(playerId: string): boolean {
    return (this.lives.get(playerId) ?? 0) > 0;
  }

  private isTeamAlive(team: 0 | 1): boolean {
    for (const [id, t] of this.teams) {
      if (t === team && (this.lives.get(id) ?? 0) > 0) {
        return true;
      }
    }
    return false;
  }

  private resetLives(): void {
    for (const id of this.teams.keys()) {
      this.lives.set(id, this.livesPerRound);
    }
  }
}
