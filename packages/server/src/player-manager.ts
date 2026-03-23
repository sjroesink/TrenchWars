import type { PlayerState, TileMap } from '@trench-wars/shared';
import { SHIP_CONFIGS, ENTER_DELAY, isCollidingWithWalls } from '@trench-wars/shared';

/**
 * Manages player lifecycle: join, leave, death, respawn, damage.
 * Tracks kill/death counts and enforces ENTER_DELAY respawn timing.
 */
export class PlayerManager {
  private players = new Map<string, PlayerState>();

  /**
   * Add a new player with initial state derived from ship config.
   */
  addPlayer(id: string, name: string, shipType: number): PlayerState {
    const config = SHIP_CONFIGS[shipType];
    const player: PlayerState = {
      id,
      name,
      shipType,
      ship: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        orientation: 0,
        energy: config.energy,
      },
      alive: true,
      kills: 0,
      deaths: 0,
      lastProcessedSeq: 0,
      respawnTick: 0,
    };
    this.players.set(id, player);
    return player;
  }

  /**
   * Remove a player. Returns true if the player existed.
   */
  removePlayer(id: string): boolean {
    return this.players.delete(id);
  }

  /**
   * Get a player by ID, or undefined if not found.
   */
  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  /**
   * Get all alive players.
   */
  getAlivePlayers(): PlayerState[] {
    return Array.from(this.players.values()).filter(p => p.alive);
  }

  /**
   * Get all players (alive and dead).
   */
  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  /**
   * Find a valid spawn position that doesn't collide with walls.
   * Tries up to 100 random positions within the map bounds (excluding 2-tile border).
   */
  findSpawnPosition(map: TileMap, radius: number): { x: number; y: number } {
    const minX = 2;
    const maxX = map.width - 2;
    const minY = 2;
    const maxY = map.height - 2;

    for (let i = 0; i < 100; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (!isCollidingWithWalls(x, y, radius, map)) {
        return { x, y };
      }
    }

    // Fallback: center of map (should rarely happen with a well-designed arena)
    return { x: map.width / 2, y: map.height / 2 };
  }

  /**
   * Kill a player. Sets alive=false, increments kill/death counters,
   * sets respawnTick to currentTick + ENTER_DELAY.
   */
  killPlayer(
    killedId: string,
    killerId: string,
    weaponType: 'bullet' | 'bomb',
    currentTick: number,
  ): { killerId: string; killedId: string; weaponType: 'bullet' | 'bomb' } {
    const killed = this.players.get(killedId);
    if (killed) {
      killed.alive = false;
      killed.deaths++;
      killed.respawnTick = currentTick + ENTER_DELAY;
    }

    const killer = this.players.get(killerId);
    if (killer && killerId !== killedId) {
      killer.kills++;
    }

    return { killerId, killedId, weaponType };
  }

  /**
   * Respawn a dead player if enough time has passed.
   * Resets energy, velocity, and assigns a new spawn position.
   */
  respawnPlayer(id: string, map: TileMap, tick: number): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    if (tick < player.respawnTick) return false;

    const config = SHIP_CONFIGS[player.shipType];
    const pos = this.findSpawnPosition(map, config.radius);

    player.alive = true;
    player.ship.x = pos.x;
    player.ship.y = pos.y;
    player.ship.vx = 0;
    player.ship.vy = 0;
    player.ship.energy = config.energy;

    return true;
  }

  /**
   * Apply damage to a player. Returns true if the player's energy reaches zero or below (dead).
   */
  applyDamage(id: string, amount: number): boolean {
    const player = this.players.get(id);
    if (!player) return false;

    player.ship.energy -= amount;
    return player.ship.energy <= 0;
  }
}
