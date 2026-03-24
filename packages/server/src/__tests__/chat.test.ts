import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArenaRoom } from '../arena-room';
import { generateTestArena, ServerMsg } from '@trench-wars/shared';
import type { TileMap } from '@trench-wars/shared';

/**
 * Chat relay tests.
 * These test the CHAT message handling in ArenaRoom:
 * - Receive chat, broadcast ServerMsg.CHAT to all clients in room
 * - Reject messages exceeding 200 characters
 * - Reject empty messages
 */
describe('Chat relay', () => {
  let room: ArenaRoom;
  let map: TileMap;
  let broadcastSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    map = generateTestArena(50, 50);
    room = new ArenaRoom({ id: 'test', name: 'Test Room', map });

    // Add a player so we have someone to send chat from
    const player = room.playerManager.addPlayer('p1', 'Alice', 0);
    player.ship.x = 25;
    player.ship.y = 25;

    // Spy on broadcast
    broadcastSpy = vi.fn();
    (room as unknown as { broadcast: typeof broadcastSpy }).broadcast = broadcastSpy;
  });

  it('broadcasts CHAT message with playerId, name, and message', () => {
    room.handleChat('p1', 'hello');

    expect(broadcastSpy).toHaveBeenCalledWith({
      type: ServerMsg.CHAT,
      playerId: 'p1',
      name: 'Alice',
      message: 'hello',
    });
  });

  it('rejects CHAT message exceeding 200 characters', () => {
    const longMessage = 'a'.repeat(201);
    room.handleChat('p1', longMessage);

    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('rejects empty CHAT message', () => {
    room.handleChat('p1', '');

    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
