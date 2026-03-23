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

    // At tick 50, target was at (10, 10)
    target.ship.x = 10;
    target.ship.y = 10;
    lc.record(50, [
      { id: 'shooter', x: 5, y: 5, radius: config.radius },
      { id: 'target', x: 10, y: 10, radius: config.radius },
    ]);

    // By tick 60, target has moved to (20, 10)
    target.ship.x = 20;
    target.ship.y = 10;
    lc.record(60, [
      { id: 'shooter', x: 5, y: 5, radius: config.radius },
      { id: 'target', x: 20, y: 10, radius: config.radius },
    ]);

    // Create a bullet at tick 50 that is now at (10, 10) — where target WAS
    // We simulate this by directly adding a projectile via fireBullet
    shooter.ship.x = 10;
    shooter.ship.y = 10;
    shooter.ship.orientation = 0; // facing east
    shooter.ship.vx = 0;
    shooter.ship.vy = 0;
    shooter.ship.energy = 10000;

    const weaponConfig = {
      bulletSpeed: 0,       // zero speed so bullet stays at ship position
      bombSpeed: 0,
      bulletFireDelay: 0,
      bombFireDelay: 0,
      bulletFireEnergy: 0,
      bombFireEnergy: 0,
      bombBounceCount: 0,
      bombThrust: 0,
    };

    wm.fireBullet(shooter, weaponConfig, 50);

    // The bullet should be at (10, 10) with zero velocity
    const projs = wm.getProjectiles();
    expect(projs.length).toBe(1);
    expect(projs[0].x).toBeCloseTo(10);
    expect(projs[0].y).toBeCloseTo(10);

    // Now update at tick 60: target is at (20,10) currently but was at (10,10) at tick 50
    // The lag-compensated hit detection should check against tick 50 positions
    const kills = wm.update(0.01, 60, map, pm);

    // The bullet should hit: at the bullet's creation tick (50), target was at (10,10)
    // Bullet is at (10,10), so it should collide with the historical position
    // (The bullet didn't move because speed is 0, and we check against historical positions)
    expect(projs.length).toBe(0); // bullet consumed
  });

  it('misses when player was not at that position historically', () => {
    const shooter = pm.addPlayer('shooter', 'Shooter', 0);
    const target = pm.addPlayer('target', 'Target', 0);
    shooter.alive = true;
    target.alive = true;

    const config = SHIP_CONFIGS[0];

    // At tick 50, target was at (100, 100) — far away
    lc.record(50, [
      { id: 'shooter', x: 5, y: 5, radius: config.radius },
      { id: 'target', x: 100, y: 100, radius: config.radius },
    ]);

    // At tick 60, target moved to (10, 10) — now near bullet
    target.ship.x = 10;
    target.ship.y = 10;
    lc.record(60, [
      { id: 'shooter', x: 5, y: 5, radius: config.radius },
      { id: 'target', x: 10, y: 10, radius: config.radius },
    ]);

    // Bullet created at tick 50, at position (10, 10) with zero velocity
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
      bombBounceCount: 0, bombThrust: 0,
    };

    wm.fireBullet(shooter, weaponConfig, 50);

    // Update at tick 60. Bullet at (10,10), target currently at (10,10) but historically at (100,100) at tick 50
    const kills = wm.update(0.01, 60, map, pm);

    // Should NOT hit: at tick 50, target was at (100,100) — nowhere near the bullet
    const projs = wm.getProjectiles();
    expect(projs.length).toBe(1); // bullet not consumed
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
      bombBounceCount: 0, bombThrust: 0,
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
      bombBounceCount: 0, bombThrust: 0,
    };

    wm.fireBullet(shooter, weaponConfig, 50);

    wm.update(0.01, 50, map, pm);

    // Target should have taken BULLET_DAMAGE_LEVEL damage
    expect(target.ship.energy).toBe(initialEnergy - BULLET_DAMAGE_LEVEL);
  });
});
