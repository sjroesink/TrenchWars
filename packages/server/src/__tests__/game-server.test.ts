import { describe, it, expect, beforeEach } from 'vitest';
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
      expect(server.roomManager).toBeDefined();
    });

    it('creates default rooms via RoomManager', () => {
      const server = new GameServer({ map, port: 0 });
      const rooms = server.roomManager.getRoomList();
      expect(rooms).toHaveLength(2);
      expect(rooms[0].name).toBe('Arena 1');
      expect(rooms[1].name).toBe('Arena 2');
    });
  });

  describe('player management via rooms', () => {
    it('adds player to a room via roomManager', () => {
      const server = new GameServer({ map, port: 0 });
      const room = server.roomManager.getRoom('arena-1');
      expect(room).toBeDefined();
      const player = room!.playerManager.addPlayer('p1', 'Alice', 0);
      expect(player.id).toBe('p1');
      expect(player.name).toBe('Alice');
    });
  });

  describe('snapshot building via rooms', () => {
    it('builds snapshot with player positions in a room', () => {
      const server = new GameServer({ map, port: 0 });
      const room = server.roomManager.getRoom('arena-1')!;
      const player = room.playerManager.addPlayer('p1', 'Alice', 0);
      player.ship.x = 10;
      player.ship.y = 20;
      player.ship.vx = 1;
      player.ship.vy = 2;
      player.ship.orientation = 0.5;

      const allPlayers = room.playerManager.getAllPlayers();
      expect(allPlayers).toHaveLength(1);
      expect(allPlayers[0].ship.x).toBe(10);
      expect(allPlayers[0].ship.y).toBe(20);
    });

    it('includes projectiles in snapshot data', () => {
      const server = new GameServer({ map, port: 0 });
      const room = server.roomManager.getRoom('arena-1')!;
      expect(room.weaponManager.getProjectiles()).toHaveLength(0);
    });
  });

  describe('shared physics integration', () => {
    it('uses updateShipPhysics for input processing', () => {
      const server = new GameServer({ map, port: 0 });
      const room = server.roomManager.getRoom('arena-1')!;
      const player = room.playerManager.addPlayer('p1', 'Alice', 0);

      player.ship.x = 25;
      player.ship.y = 25;
      player.ship.vx = 0;
      player.ship.vy = 0;
      player.ship.orientation = 0;

      const input: ShipInput = { left: false, right: false, thrust: true, reverse: false, afterburner: false, multifire: false };
      const config = SHIP_CONFIGS[0];
      const prevVx = player.ship.vx;

      updateShipPhysics(player.ship, input, config, TICK_DT);

      expect(player.ship.vx).toBeGreaterThan(prevVx);
    });
  });
});
