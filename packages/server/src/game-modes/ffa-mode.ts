import type { FFAState } from '@trench-wars/shared';
import type { GameMode, GameModeEvent } from './game-mode';

interface FFAPlayerData {
  name: string;
  kills: number;
  deaths: number;
  shipType: number;
}

/**
 * Free-for-all deathmatch mode.
 * All players fight independently. First to reach scoreLimit wins.
 * Respawn is always allowed.
 */
export class FFAMode implements GameMode {
  readonly type = 'ffa' as const;
  private players = new Map<string, FFAPlayerData>();
  private scoreLimit: number;

  constructor(scoreLimit = 20) {
    this.scoreLimit = scoreLimit;
  }

  onPlayerJoin(playerId: string, name: string, shipType: number): void {
    this.players.set(playerId, { name, kills: 0, deaths: 0, shipType });
  }

  onPlayerLeave(playerId: string): void {
    this.players.delete(playerId);
  }

  onKill(killerId: string, killedId: string, _weaponType: string): GameModeEvent[] {
    const events: GameModeEvent[] = [];

    const killer = this.players.get(killerId);
    if (killer && killerId !== killedId) {
      killer.kills++;

      if (killer.kills >= this.scoreLimit) {
        events.push({
          type: 'game-over',
          data: { winnerId: killerId, winnerName: killer.name, kills: killer.kills },
        });
      }
    }

    const killed = this.players.get(killedId);
    if (killed) {
      killed.deaths++;
    }

    return events;
  }

  onTick(_tick: number): GameModeEvent[] {
    return [];
  }

  getState(): FFAState {
    const leaderboard = Array.from(this.players.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        kills: data.kills,
        deaths: data.deaths,
        shipType: data.shipType,
      }))
      .sort((a, b) => b.kills - a.kills);

    return {
      type: 'ffa',
      leaderboard,
      scoreLimit: this.scoreLimit,
    };
  }

  canRespawn(_playerId: string): boolean {
    return true;
  }
}
