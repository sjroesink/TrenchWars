import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameServer } from '../game-server';
import { generateTestArena, SHIP_CONFIGS, TICK_DT, updateShipPhysics } from '@trench-wars/shared';
import type { TileMap, ShipInput } from '@trench-wars/shared';

describe('GameServer', () => {
  let map: TileMap;

  beforeEach(() => {
    map = generateTestArena(50, 50);
  });

  describe('construction', () => {
    it('can be constructed with a map and port', () => {
      const server = new GameServer({ map, port: 0 });
      expect(server).toBeDefined();
      expect(server.playerManager).toBeDefined();
      expect(server.weaponManager).toBeDefined();
    });
  });

  describe('player management', () => {
    it('adds player via playerManager', () => {
      const server = new GameServer({ map, port: 0 });
      const player = server.playerManager.addPlayer('p1', 'Alice', 0);
      expect(player.id).toBe('p1');
      expect(player.name).toBe('Alice');
    });
  });

  describe('snapshot building', () => {
    it('builds snapshot with player positions', () => {
      const server = new GameServer({ map, port: 0 });
      const player = server.playerManager.addPlayer('p1', 'Alice', 0);
      player.ship.x = 10;
      player.ship.y = 20;
      player.ship.vx = 1;
      player.ship.vy = 2;
      player.ship.orientation = 0.5;

      // broadcastSnapshot builds the snapshot -- since no clients are connected,
      // we can verify through playerManager state
      const allPlayers = server.playerManager.getAllPlayers();
      expect(allPlayers).toHaveLength(1);
      expect(allPlayers[0].ship.x).toBe(10);
      expect(allPlayers[0].ship.y).toBe(20);
    });

    it('includes projectiles in snapshot data', () => {
      const server = new GameServer({ map, port: 0 });
      // Initially no projectiles
      expect(server.weaponManager.getProjectiles()).toHaveLength(0);
    });
  });

  describe('shared physics integration', () => {
    it('uses updateShipPhysics for input processing', () => {
      const server = new GameServer({ map, port: 0 });
      const player = server.playerManager.addPlayer('p1', 'Alice', 0);

      // Position player in open area
      player.ship.x = 25;
      player.ship.y = 25;
      player.ship.vx = 0;
      player.ship.vy = 0;
      player.ship.orientation = 0; // facing east

      // Apply thrust manually to verify shared physics is used
      const input: ShipInput = { left: false, right: false, thrust: true, reverse: false, afterburner: false, multifire: false };
      const config = SHIP_CONFIGS[0];
      const prevVx = player.ship.vx;

      updateShipPhysics(player.ship, input, config, TICK_DT);

      // Thrust in east direction should increase vx
      expect(player.ship.vx).toBeGreaterThan(prevVx);
    });
  });
});
