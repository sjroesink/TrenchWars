import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerManager } from '../player-manager';
import { generateTestArena, SHIP_CONFIGS, ENTER_DELAY, isCollidingWithWalls } from '@trench-wars/shared';
import type { TileMap } from '@trench-wars/shared';

describe('PlayerManager', () => {
  let pm: PlayerManager;
  let map: TileMap;

  beforeEach(() => {
    pm = new PlayerManager();
    map = generateTestArena(50, 50);
  });

  describe('addPlayer', () => {
    it('creates correct initial state', () => {
      const player = pm.addPlayer('p1', 'Alice', 0);
      expect(player.id).toBe('p1');
      expect(player.name).toBe('Alice');
      expect(player.shipType).toBe(0);
      expect(player.alive).toBe(true);
      expect(player.kills).toBe(0);
      expect(player.deaths).toBe(0);
      expect(player.ship.energy).toBe(SHIP_CONFIGS[0].energy);
      expect(player.lastProcessedSeq).toBe(0);
      expect(player.respawnTick).toBe(0);
    });

    it('creates player with correct ship type energy', () => {
      const player = pm.addPlayer('p2', 'Bob', 1);
      expect(player.shipType).toBe(1);
      expect(player.ship.energy).toBe(SHIP_CONFIGS[1].energy);
    });
  });

  describe('removePlayer', () => {
    it('removes existing player and returns true', () => {
      pm.addPlayer('p1', 'Alice', 0);
      expect(pm.removePlayer('p1')).toBe(true);
      expect(pm.getPlayer('p1')).toBeUndefined();
    });

    it('returns false for nonexistent player', () => {
      expect(pm.removePlayer('nonexistent')).toBe(false);
    });
  });

  describe('getPlayer', () => {
    it('returns player state', () => {
      pm.addPlayer('p1', 'Alice', 0);
      const player = pm.getPlayer('p1');
      expect(player).toBeDefined();
      expect(player!.name).toBe('Alice');
    });

    it('returns undefined for nonexistent player', () => {
      expect(pm.getPlayer('nonexistent')).toBeUndefined();
    });
  });

  describe('getAlivePlayers', () => {
    it('returns only alive players', () => {
      pm.addPlayer('p1', 'Alice', 0);
      pm.addPlayer('p2', 'Bob', 1);
      pm.killPlayer('p1', 'p2', 'bullet', 100);
      const alive = pm.getAlivePlayers();
      expect(alive).toHaveLength(1);
      expect(alive[0].id).toBe('p2');
    });
  });

  describe('getAllPlayers', () => {
    it('returns all players including dead', () => {
      pm.addPlayer('p1', 'Alice', 0);
      pm.addPlayer('p2', 'Bob', 1);
      pm.killPlayer('p1', 'p2', 'bullet', 100);
      expect(pm.getAllPlayers()).toHaveLength(2);
    });
  });

  describe('findSpawnPosition', () => {
    it('returns position not colliding with walls', () => {
      const radius = SHIP_CONFIGS[0].radius;
      const pos = pm.findSpawnPosition(map, radius);
      expect(pos.x).toBeGreaterThanOrEqual(2);
      expect(pos.x).toBeLessThan(map.width - 2);
      expect(pos.y).toBeGreaterThanOrEqual(2);
      expect(pos.y).toBeLessThan(map.height - 2);
      expect(isCollidingWithWalls(pos.x, pos.y, radius, map)).toBe(false);
    });
  });

  describe('killPlayer', () => {
    it('increments kills/deaths and sets respawnTick', () => {
      pm.addPlayer('p1', 'Alice', 0);
      pm.addPlayer('p2', 'Bob', 1);
      const result = pm.killPlayer('p1', 'p2', 'bullet', 500);
      expect(result.killerId).toBe('p2');
      expect(result.killedId).toBe('p1');
      expect(result.weaponType).toBe('bullet');

      const killed = pm.getPlayer('p1')!;
      expect(killed.alive).toBe(false);
      expect(killed.deaths).toBe(1);
      expect(killed.respawnTick).toBe(500 + ENTER_DELAY);

      const killer = pm.getPlayer('p2')!;
      expect(killer.kills).toBe(1);
    });
  });

  describe('respawnPlayer', () => {
    it('respawns when tick >= respawnTick', () => {
      pm.addPlayer('p1', 'Alice', 0);
      pm.addPlayer('p2', 'Bob', 1);
      pm.killPlayer('p1', 'p2', 'bullet', 500);
      const respawnTick = 500 + ENTER_DELAY;

      const result = pm.respawnPlayer('p1', map, respawnTick);
      expect(result).toBe(true);

      const p1 = pm.getPlayer('p1')!;
      expect(p1.alive).toBe(true);
      expect(p1.ship.energy).toBe(SHIP_CONFIGS[0].energy);
      expect(p1.ship.vx).toBe(0);
      expect(p1.ship.vy).toBe(0);
    });

    it('returns false when tick < respawnTick', () => {
      pm.addPlayer('p1', 'Alice', 0);
      pm.addPlayer('p2', 'Bob', 1);
      pm.killPlayer('p1', 'p2', 'bullet', 500);

      const result = pm.respawnPlayer('p1', map, 500 + ENTER_DELAY - 1);
      expect(result).toBe(false);
      expect(pm.getPlayer('p1')!.alive).toBe(false);
    });
  });

  describe('applyDamage', () => {
    it('reduces energy', () => {
      pm.addPlayer('p1', 'Alice', 0);
      const result = pm.applyDamage('p1', 100);
      expect(result).toBe(false);
      expect(pm.getPlayer('p1')!.ship.energy).toBe(SHIP_CONFIGS[0].energy - 100);
    });

    it('returns true when energy reaches zero', () => {
      pm.addPlayer('p1', 'Alice', 0);
      const result = pm.applyDamage('p1', SHIP_CONFIGS[0].energy);
      expect(result).toBe(true);
    });

    it('returns true when energy goes below zero', () => {
      pm.addPlayer('p1', 'Alice', 0);
      const result = pm.applyDamage('p1', SHIP_CONFIGS[0].energy + 500);
      expect(result).toBe(true);
    });
  });
});
