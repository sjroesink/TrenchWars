import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../room-manager';
import { generateTestArena } from '@trench-wars/shared';
import type { TileMap } from '@trench-wars/shared';
import { WebSocket } from 'ws';

// Create a minimal mock WebSocket for testing (no real connection needed)
function createMockWs(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: () => {},
    on: () => {},
    close: () => {},
  } as unknown as WebSocket;
}

describe('RoomManager', () => {
  let map: TileMap;
  let manager: RoomManager;

  beforeEach(() => {
    map = generateTestArena(50, 50);
    manager = new RoomManager(map);
  });

  describe('room creation', () => {
    it('creates default rooms on construction', () => {
      const rooms = manager.getRoomList();
      expect(rooms).toHaveLength(2);
      expect(rooms[0].id).toBe('arena-1');
      expect(rooms[1].id).toBe('arena-2');
    });

    it('default rooms are FFA mode with max 20 players', () => {
      const rooms = manager.getRoomList();
      expect(rooms[0].mode).toBe('ffa');
      expect(rooms[0].maxPlayers).toBe(20);
      expect(rooms[1].mode).toBe('ffa');
      expect(rooms[1].maxPlayers).toBe(20);
    });
  });

  describe('room listing', () => {
    it('getRoomList returns all rooms with player counts', () => {
      const rooms = manager.getRoomList();
      expect(rooms).toHaveLength(2);
      expect(rooms[0]).toHaveProperty('playerCount');
      expect(rooms[0]).toHaveProperty('maxPlayers');
      expect(rooms[0]).toHaveProperty('name');
      expect(rooms[0]).toHaveProperty('id');
      expect(rooms[0]).toHaveProperty('mode');
      // Initially no players
      expect(rooms[0].playerCount).toBe(0);
      expect(rooms[1].playerCount).toBe(0);
    });

    it('player count updates after assignment', () => {
      const ws = createMockWs();
      manager.assignPlayer('arena-1', 'p1', 'Alice', 0, ws);

      const rooms = manager.getRoomList();
      expect(rooms[0].playerCount).toBe(1);
      expect(rooms[1].playerCount).toBe(0);
    });
  });

  describe('player assignment', () => {
    it('assignPlayer adds player to specified room', () => {
      const ws = createMockWs();
      const room = manager.assignPlayer('arena-1', 'p1', 'Alice', 0, ws);

      expect(room).not.toBeNull();
      expect(room!.id).toBe('arena-1');
      expect(room!.playerManager.getPlayer('p1')).toBeDefined();
    });

    it('assignPlayer returns null for non-existent room', () => {
      const ws = createMockWs();
      const room = manager.assignPlayer('no-such-room', 'p1', 'Alice', 0, ws);
      expect(room).toBeNull();
    });

    it('assignPlayer returns null when room is full', () => {
      // Fill room to capacity (20 players)
      for (let i = 0; i < 20; i++) {
        const ws = createMockWs();
        const result = manager.assignPlayer('arena-1', `p${i}`, `Player${i}`, 0, ws);
        expect(result).not.toBeNull();
      }

      // 21st player should be rejected
      const ws = createMockWs();
      const result = manager.assignPlayer('arena-1', 'p-overflow', 'Overflow', 0, ws);
      expect(result).toBeNull();
    });

    it('autoAssignPlayer assigns to first non-full room', () => {
      const ws = createMockWs();
      const room = manager.autoAssignPlayer('p1', 'Alice', 0, ws);

      expect(room).not.toBeNull();
      expect(room!.id).toBe('arena-1'); // First room
    });
  });

  describe('player removal', () => {
    it('removePlayer removes from correct room', () => {
      const ws = createMockWs();
      manager.assignPlayer('arena-1', 'p1', 'Alice', 0, ws);

      // Verify player exists
      const playerRoom = manager.getPlayerRoom('p1');
      expect(playerRoom).toBeDefined();
      expect(playerRoom!.id).toBe('arena-1');

      // Remove player
      manager.removePlayer('p1');

      // Player room mapping should be gone
      const afterRemove = manager.getPlayerRoom('p1');
      expect(afterRemove).toBeUndefined();
    });

    it('removePlayer is a no-op for unknown player', () => {
      // Should not throw
      expect(() => manager.removePlayer('nonexistent')).not.toThrow();
    });
  });

  describe('cross-room isolation', () => {
    it('players in different rooms are independent', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      // Add players to different rooms
      manager.assignPlayer('arena-1', 'p1', 'Alice', 0, ws1);
      manager.assignPlayer('arena-2', 'p2', 'Bob', 1, ws2);

      // Get rooms
      const room1 = manager.getRoom('arena-1')!;
      const room2 = manager.getRoom('arena-2')!;

      // Each room should only have its own player
      expect(room1.playerManager.getAllPlayers()).toHaveLength(1);
      expect(room1.playerManager.getPlayer('p1')).toBeDefined();
      expect(room1.playerManager.getPlayer('p2')).toBeUndefined();

      expect(room2.playerManager.getAllPlayers()).toHaveLength(1);
      expect(room2.playerManager.getPlayer('p2')).toBeDefined();
      expect(room2.playerManager.getPlayer('p1')).toBeUndefined();
    });

    it('removing a player from one room does not affect another', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      manager.assignPlayer('arena-1', 'p1', 'Alice', 0, ws1);
      manager.assignPlayer('arena-2', 'p2', 'Bob', 1, ws2);

      // Remove from room 1
      manager.removePlayer('p1');

      // Room 2 player should be unaffected
      const room2 = manager.getRoom('arena-2')!;
      expect(room2.playerManager.getPlayer('p2')).toBeDefined();
      expect(room2.playerManager.getAllPlayers()).toHaveLength(1);
    });
  });
});
