import type { PlayerState, ProjectileState, TileMap, WeaponConfig } from '@trench-wars/shared';
import {
  createBullet,
  createBomb,
  createMultifire,
  updateProjectile,
  checkProjectileHit,
  calculateBombDamage,
  BULLET_DAMAGE_LEVEL,
  BOMB_EXPLODE_RADIUS,
  SHIP_CONFIGS,
} from '@trench-wars/shared';
import type { PlayerManager } from './player-manager';
import type { LagCompensation } from './lag-compensation';

/**
 * Manages active projectiles: creation, simulation, hit detection, and removal.
 * Tracks per-player fire cooldowns. Uses lag compensation for fair hit detection.
 */
export class WeaponManager {
  private projectiles: ProjectileState[] = [];
  private nextId = 1;
  /** Per-player cooldown tracking */
  private cooldowns = new Map<string, { nextBulletTick: number; nextBombTick: number; nextMultifireTick: number }>();
  /** Tracks the tick at which each projectile was created, for lag compensation rewind. */
  private creationTicks = new Map<number, number>();
  private lagCompensation: LagCompensation | null;

  constructor(lagCompensation?: LagCompensation) {
    this.lagCompensation = lagCompensation ?? null;
  }

  /**
   * Get or create cooldown entry for a player.
   */
  private getCooldown(playerId: string): { nextBulletTick: number; nextBombTick: number; nextMultifireTick: number } {
    let cd = this.cooldowns.get(playerId);
    if (!cd) {
      cd = { nextBulletTick: 0, nextBombTick: 0, nextMultifireTick: 0 };
      this.cooldowns.set(playerId, cd);
    }
    return cd;
  }

  /**
   * Attempt to fire a bullet for the given player.
   * Checks cooldown and energy. Deducts energy on success.
   */
  fireBullet(player: PlayerState, weaponConfig: WeaponConfig, tick: number): boolean {
    const cd = this.getCooldown(player.id);
    if (tick < cd.nextBulletTick) return false;
    if (player.ship.energy < weaponConfig.bulletFireEnergy) return false;

    player.ship.energy -= weaponConfig.bulletFireEnergy;
    const id = this.nextId++;
    const bullet = createBullet(player.ship, weaponConfig, player.id, id, tick);
    this.projectiles.push(bullet);
    this.creationTicks.set(id, tick);
    // Convert fire delay from seconds to ticks (100Hz)
    cd.nextBulletTick = tick + Math.ceil(weaponConfig.bulletFireDelay * 100);
    return true;
  }

  /**
   * Attempt to fire a bomb for the given player.
   * Checks cooldown and energy. Deducts energy and applies recoil on success.
   */
  fireBomb(player: PlayerState, weaponConfig: WeaponConfig, tick: number): boolean {
    const cd = this.getCooldown(player.id);
    if (tick < cd.nextBombTick) return false;
    if (player.ship.energy < weaponConfig.bombFireEnergy) return false;

    player.ship.energy -= weaponConfig.bombFireEnergy;
    const id = this.nextId++;
    const { projectile, recoilVx, recoilVy } = createBomb(
      player.ship, weaponConfig, player.id, id, tick,
    );
    this.projectiles.push(projectile);
    this.creationTicks.set(id, tick);
    player.ship.vx += recoilVx;
    player.ship.vy += recoilVy;
    cd.nextBombTick = tick + Math.ceil(weaponConfig.bombFireDelay * 100);
    return true;
  }

  /**
   * Attempt to fire multifire (e.g., Javelin 3-shot rear spread).
   * Checks cooldown, energy, and that the ship has multifire configured.
   */
  fireMultifire(player: PlayerState, weaponConfig: WeaponConfig, tick: number): boolean {
    if (weaponConfig.multifireCount <= 0) return false;
    const cd = this.getCooldown(player.id);
    if (tick < cd.nextMultifireTick) return false;
    if (player.ship.energy < weaponConfig.multifireEnergy) return false;

    player.ship.energy -= weaponConfig.multifireEnergy;
    const startId = this.nextId;
    this.nextId += weaponConfig.multifireCount;
    const bullets = createMultifire(player.ship, weaponConfig, player.id, startId, tick);
    for (const b of bullets) {
      this.projectiles.push(b);
      this.creationTicks.set(b.id, tick);
    }
    cd.nextMultifireTick = tick + Math.ceil(weaponConfig.multifireDelay * 100);
    return true;
  }

  /**
   * Update all projectiles: movement, wall collision, hit detection, damage application.
   * Returns array of kill events: { killerId, killedId, weaponType }.
   */
  update(
    dt: number,
    tick: number,
    map: TileMap,
    playerManager: PlayerManager,
  ): Array<{ killerId: string; killedId: string; weaponType: 'bullet' | 'bomb' }> {
    const kills: Array<{ killerId: string; killedId: string; weaponType: 'bullet' | 'bomb' }> = [];
    const toRemove = new Set<number>();
    const alivePlayers = playerManager.getAlivePlayers();

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];

      // Check if timed out
      if (tick >= proj.endTick) {
        toRemove.add(i);
        continue;
      }

      // Move projectile and check wall collision
      const status = updateProjectile(proj, map, dt);

      if (status === 'wall_explode') {
        // For bombs, apply area damage on wall explosion (skip owner — no self-damage)
        if (proj.type === 'bomb') {
          for (const player of alivePlayers) {
            if (player.id === proj.ownerId) continue;
            const dx = proj.x - player.ship.x;
            const dy = proj.y - player.ship.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const damage = calculateBombDamage(distance, proj.level);
            if (damage > 0) {
              const dead = playerManager.applyDamage(player.id, damage);
              if (dead) {
                kills.push(playerManager.killPlayer(player.id, proj.ownerId, 'bomb', tick));
              }
            }
          }
        }
        toRemove.add(i);
        continue;
      }

      // Check hit against alive players using CURRENT positions.
      // Projectiles physically travel through space, so they collide with
      // where players are NOW, not where they were when the bullet was created.
      // (Lag compensation / rewind is for instant hit-scan, not traveling projectiles.)
      for (const player of alivePlayers) {
        const config = SHIP_CONFIGS[player.shipType];
        const checkX = player.ship.x;
        const checkY = player.ship.y;
        const checkRadius = config.radius;

        if (checkProjectileHit(proj, checkX, checkY, checkRadius, player.id)) {
          if (proj.type === 'bullet') {
            const dead = playerManager.applyDamage(player.id, BULLET_DAMAGE_LEVEL);
            if (dead) {
              kills.push(playerManager.killPlayer(player.id, proj.ownerId, 'bullet', tick));
            }
          } else {
            // Bomb direct hit: apply area damage centered on impact
            const damage = calculateBombDamage(0, proj.level);
            const dead = playerManager.applyDamage(player.id, damage);
            if (dead) {
              kills.push(playerManager.killPlayer(player.id, proj.ownerId, 'bomb', tick));
            }
          }
          this.creationTicks.delete(proj.id);
          toRemove.add(i);
          break; // Projectile consumed on first hit
        }
      }
    }

    // Remove projectiles in reverse order to preserve indices
    const removeIndices = Array.from(toRemove).sort((a, b) => b - a);
    for (const idx of removeIndices) {
      this.creationTicks.delete(this.projectiles[idx].id);
      this.projectiles.splice(idx, 1);
    }

    return kills;
  }

  /**
   * Get current projectile list for snapshot broadcast.
   */
  getProjectiles(): ProjectileState[] {
    return this.projectiles;
  }

  /**
   * Remove cooldown tracking for a player (on disconnect).
   */
  removePlayer(playerId: string): void {
    this.cooldowns.delete(playerId);
  }
}
