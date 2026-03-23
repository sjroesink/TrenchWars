/** Game mode type identifiers. */
export type GameModeType = 'ffa' | 'team-arena';

/** Configuration for creating a game mode instance. */
export interface GameModeConfig {
  type: GameModeType;
  scoreLimit?: number;       // FFA: kills to win
  roundCount?: number;       // TeamArena: best of N rounds
  livesPerRound?: number;    // TeamArena: lives per player per round
  timeLimit?: number;        // seconds per round (optional)
}

/** FFA leaderboard entry. */
export interface FFALeaderboardEntry {
  id: string;
  name: string;
  kills: number;
  deaths: number;
  shipType: number;
}

/** State broadcast for FFA mode. */
export interface FFAState {
  type: 'ffa';
  leaderboard: FFALeaderboardEntry[];
  scoreLimit: number;
}

/** State broadcast for TeamArena mode. */
export interface TeamArenaState {
  type: 'team-arena';
  teams: Record<string, 0 | 1>;
  lives: Record<string, number>;
  roundScores: [number, number];
  currentRound: number;
  totalRounds: number;
  roundActive: boolean;
}

/** Discriminated union of all game mode states. */
export type GameModeState = FFAState | TeamArenaState;
