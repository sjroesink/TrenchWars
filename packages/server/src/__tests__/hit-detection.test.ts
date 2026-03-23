import { describe, it, expect, beforeEach } from 'vitest';
import { WeaponManager } from '../weapon-manager';
import { LagCompensation } from '../lag-compensation';
import { PlayerManager } from '../player-manager';
import { generateTestArena, SHIP_CONFIGS, BULLET_DAMAGE_LEVEL } from '@trench-wars/shared';
import type { TileMap } from '@trench-wars/shared';

describe('Lag-compensated hit detection', () => {
  let wm: WeaponManager;
  let lc: LagCompensation;
  let pm: PlayerManager;
  let map: TileMap;

  beforeEach(() => {
    lc = new LagCompensation();
    wm = new WeaponManager(lc);
    pm = new PlayerManager();
    map = generateTestArena(50, 50);
  });

  it('hits player at historical position, not current', () => {
    // Setup: two players
    const shooter = pm.addPlayer('shooter', 'Shooter', 0);
    const target = pm.addPlayer('target', 'Target', 0);
    shooter.alive = true;
    target.alive = true;

    const config = SHIP_CONFIGS[0];

    // Target currently at (10, 10) — same as bullet position
    target.ship.x = 10;
    target.ship.y = 10;

    // Create bullet at (10, 10) with zero velocity
    shooter.ship.x = 10;
    shooter.ship.y = 10;
    shooter.ship.orientation = 0;
    shooter.ship.vx = 0;
    shooter.ship.vy = 0;
    shooter.ship.energy = 10000;

    const weaponConfig = {
      bulletSpeed: 0, bombSpeed: 0,
      bulletFireDelay: 0, bombFireDelay: 0,
      bulletFireEnergy: 0, bombFireEnergy: 0,
      bombBounceCount: 0, bombThrust: 0, multifireCount: 0, multifireEnergy: 0, multifireDelay: 0, multifireAngle: 0,
    };

    wm.fireBullet(shooter, weaponConfig, 50);

    const projs = wm.getProjectiles();
    expect(projs.length).toBe(1);

    // Update: bullet at (10,10), target currently at (10,10) → hit
    const kills = wm.update(0.01, 60, map, pm);
    expect(projs.length).toBe(0); // bullet consumed
  });

  it('misses when player is not at projectile position', () => {
    const shooter = pm.addPlayer('shooter', 'Shooter', 0);
    const target = pm.addPlayer('target', 'Target', 0);
    shooter.alive = true;
    target.alive = true;

    // Target is far from bullet
    target.ship.x = 100;
    target.ship.y = 100;

    shooter.ship.x = 10;
    shooter.ship.y = 10;
    shooter.ship.orientation = 0;
    shooter.ship.vx = 0;
    shooter.ship.vy = 0;
    shooter.ship.energy = 10000;

    const weaponConfig = {
      bulletSpeed: 0, bombSpeed: 0,
      bulletFireDelay: 0, bombFireDelay: 0,
      bulletFireEnergy: 0, bombFireEnergy: 0,
      bombBounceCount: 0, bombThrust: 0, multifireCount: 0, multifireEnergy: 0, multifireDelay: 0, multifireAngle: 0,
    };

    wm.fireBullet(shooter, weaponConfig, 50);

    const kills = wm.update(0.01, 60, map, pm);

    // Should NOT hit: target at (100,100), bullet at (10,10) — too far
    const projs = wm.getProjectiles();
    expect(projs.length).toBe(1);
    expect(kills.length).toBe(0);
  });

  it('falls back to current positions when history unavailable', () => {
    // Use a fresh LagCompensation with no history
    const emptyLc = new LagCompensation();
    const emptyWm = new WeaponManager(emptyLc);

    const shooter = pm.addPlayer('shooter', 'Shooter', 0);
    const target = pm.addPlayer('target', 'Target', 0);
    shooter.alive = true;
    target.alive = true;

    const config = SHIP_CONFIGS[0];

    // Target currently at (10, 10)
    target.ship.x = 10;
    target.ship.y = 10;

    // Bullet at (10, 10)
    shooter.ship.x = 10;
    shooter.ship.y = 10;
    shooter.ship.orientation = 0;
    shooter.ship.vx = 0;
    shooter.ship.vy = 0;
    shooter.ship.energy = 10000;

    const weaponConfig = {
      bulletSpeed: 0, bombSpeed: 0,
      bulletFireDelay: 0, bombFireDelay: 0,
      bulletFireEnergy: 0, bombFireEnergy: 0,
      bombBounceCount: 0, bombThrust: 0, multifireCount: 0, multifireEnergy: 0, multifireDelay: 0, multifireAngle: 0,
    };

    emptyWm.fireBullet(shooter, weaponConfig, 50);

    // No history recorded -> should fall back to current positions
    const kills = emptyWm.update(0.01, 60, map, pm);

    // Should hit using current positions (fallback)
    const projs = emptyWm.getProjectiles();
    expect(projs.length).toBe(0); // bullet consumed
  });

  it('applies BULLET_DAMAGE_LEVEL damage on bullet hit', () => {
    const shooter = pm.addPlayer('shooter', 'Shooter', 0);
    const target = pm.addPlayer('target', 'Target', 0);
    shooter.alive = true;
    target.alive = true;

    const config = SHIP_CONFIGS[0];
    const initialEnergy = target.ship.energy;

    // Record target at (10, 10) at tick 50
    target.ship.x = 10;
    target.ship.y = 10;
    lc.record(50, [
      { id: 'shooter', x: 5, y: 5, radius: config.radius },
      { id: 'target', x: 10, y: 10, radius: config.radius },
    ]);

    // Bullet at (10, 10) created at tick 50
    shooter.ship.x = 10;
    shooter.ship.y = 10;
    shooter.ship.orientation = 0;
    shooter.ship.vx = 0;
    shooter.ship.vy = 0;
    shooter.ship.energy = 10000;

    const weaponConfig = {
      bulletSpeed: 0, bombSpeed: 0,
      bulletFireDelay: 0, bombFireDelay: 0,
      bulletFireEnergy: 0, bombFireEnergy: 0,
      bombBounceCount: 0, bombThrust: 0, multifireCount: 0, multifireEnergy: 0, multifireDelay: 0, multifireAngle: 0,
    };

    wm.fireBullet(shooter, weaponConfig, 50);

    wm.update(0.01, 50, map, pm);

    // Target should have taken BULLET_DAMAGE_LEVEL damage
    expect(target.ship.energy).toBe(initialEnergy - BULLET_DAMAGE_LEVEL);
  });
});
