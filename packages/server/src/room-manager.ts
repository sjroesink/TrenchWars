import { WebSocket } from 'ws';
import type { TileMap, RoomInfo } from '@trench-wars/shared';
import { ArenaRoom } from './arena-room';
import { FFAMode } from './game-modes/ffa-mode';

/**
 * Manages multiple ArenaRoom instances. Creates default rooms,
 * routes players to rooms, and provides room listing.
 */
export class RoomManager {
  private rooms = new Map<string, ArenaRoom>();
  /** Maps playerId -> roomId for routing messages to the correct room. */
  private playerRoomMap = new Map<string, string>();

  constructor(map: TileMap) {
    // Create 2 default rooms
    const room1 = new ArenaRoom({
      id: 'arena-1',
      name: 'Arena 1',
      map,
      maxPlayers: 20,
      gameMode: new FFAMode(20),
    });
    const room2 = new ArenaRoom({
      id: 'arena-2',
      name: 'Arena 2',
      map,
      maxPlayers: 20,
      gameMode: new FFAMode(20),
    });
    this.rooms.set(room1.id, room1);
    this.rooms.set(room2.id, room2);
  }

  /**
   * Get list of all rooms with their current info.
   */
  getRoomList(): RoomInfo[] {
    return Array.from(this.rooms.values()).map(room => room.getInfo());
  }

  /**
   * Get a room by ID.
   */
  getRoom(id: string): ArenaRoom | undefined {
    return this.rooms.get(id);
  }

  /**
   * Get the room a player is in.
   */
  getPlayerRoom(playerId: string): ArenaRoom | undefined {
    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  /**
   * Assign a player to a specific room.
   * Returns the ArenaRoom if successful, null if room is full or not found.
   */
  assignPlayer(
    roomId: string,
    playerId: string,
    name: string,
    shipType: number,
    ws: WebSocket,
  ): ArenaRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.addPlayer(playerId, name, shipType, ws);
    if (!player) return null;

    this.playerRoomMap.set(playerId, roomId);
    return room;
  }

  /**
   * Auto-assign a player to the first room with space.
   * Returns the ArenaRoom if successful, null if all rooms are full.
   */
  autoAssignPlayer(
    playerId: string,
    name: string,
    shipType: number,
    ws: WebSocket,
  ): ArenaRoom | null {
    for (const room of this.rooms.values()) {
      if (!room.isFull()) {
        const player = room.addPlayer(playerId, name, shipType, ws);
        if (player) {
          this.playerRoomMap.set(playerId, room.id);
          return room;
        }
      }
    }
    return null;
  }

  /**
   * Try to restore a reconnecting player across all rooms.
   * Returns the room and player state if found.
   */
  restorePlayer(
    sessionToken: string,
    ws: WebSocket,
  ): { room: ArenaRoom; player: import('@trench-wars/shared').PlayerState } | null {
    for (const room of this.rooms.values()) {
      const player = room.restorePlayer(sessionToken, ws);
      if (player) {
        this.playerRoomMap.set(player.id, room.id);
        return { room, player };
      }
    }
    return null;
  }

  /**
   * Remove a player from whatever room they are in.
   */
  removePlayer(playerId: string): void {
    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(playerId);
    }
    this.playerRoomMap.delete(playerId);
  }

  /**
   * Start all room game loops.
   */
  startAll(): void {
    for (const room of this.rooms.values()) {
      room.start();
    }
  }

  /**
   * Stop all room game loops.
   */
  stopAll(): void {
    for (const room of this.rooms.values()) {
      room.stop();
    }
  }
}
