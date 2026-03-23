import type { GameModeType, GameModeState } from '@trench-wars/shared';

/** Events emitted by game modes during tick or kill processing. */
export interface GameModeEvent {
  type: 'round-start' | 'round-end' | 'game-over';
  data?: Record<string, unknown>;
}

/** Interface that all game mode implementations must satisfy. */
export interface GameMode {
  readonly type: GameModeType;
  onPlayerJoin(playerId: string, name: string, shipType: number): void;
  onPlayerLeave(playerId: string): void;
  onKill(killerId: string, killedId: string, weaponType: string): GameModeEvent[];
  onTick(tick: number): GameModeEvent[];
  getState(): GameModeState;
  canRespawn(playerId: string): boolean;
}
