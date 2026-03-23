import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameServer } from '../game-server';
import { generateTestArena, ClientMsg, ServerMsg } from '@trench-wars/shared';
import type { TileMap } from '@trench-wars/shared';

/**
 * Chat relay tests.
 * These test the CHAT message handling in GameServer:
 * - Receive ClientMsg.CHAT, broadcast ServerMsg.CHAT to all clients
 * - Reject messages exceeding 200 characters
 * - Reject empty messages
 *
 * NOTE: These tests will be RED until Task 2 integrates chat handling into GameServer.
 */
describe('Chat relay', () => {
  let server: GameServer;
  let map: TileMap;
  let broadcastSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    map = generateTestArena(50, 50);
    server = new GameServer({ map, port: 0 });

    // Add a player so we have someone to send chat from
    const player = server.playerManager.addPlayer('p1', 'Alice', 0);
    player.ship.x = 25;
    player.ship.y = 25;

    // Spy on broadcast by intercepting the private method
    // We access the internal broadcast via the prototype
    broadcastSpy = vi.fn();
    (server as unknown as { broadcast: (msg: Record<string, unknown>) => void }).broadcast = broadcastSpy;

    // Register p1 as a connected client (simulate connection)
    (server as unknown as { clients: Map<string, unknown> }).clients.set('p1', {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn(),
    });
  });

  it('broadcasts CHAT message with playerId, name, and message', () => {
    // Simulate receiving a CHAT message from p1
    const handleMessage = (server as unknown as { handleChat: (playerId: string, message: string) => void }).handleChat;
    handleMessage.call(server, 'p1', 'hello');

    expect(broadcastSpy).toHaveBeenCalledWith({
      type: ServerMsg.CHAT,
      playerId: 'p1',
      name: 'Alice',
      message: 'hello',
    });
  });

  it('rejects CHAT message exceeding 200 characters', () => {
    const longMessage = 'a'.repeat(201);
    const handleMessage = (server as unknown as { handleChat: (playerId: string, message: string) => void }).handleChat;
    handleMessage.call(server, 'p1', longMessage);

    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('rejects empty CHAT message', () => {
    const handleMessage = (server as unknown as { handleChat: (playerId: string, message: string) => void }).handleChat;
    handleMessage.call(server, 'p1', '');

    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
