import type { PlayerState } from '@trench-wars/shared';

/**
 * Check if a player is in spectator mode.
 * Spectators receive snapshots but have no ship and no physics processed.
 */
export function isSpectator(player: PlayerState): boolean {
  return player.spectating === true;
}
