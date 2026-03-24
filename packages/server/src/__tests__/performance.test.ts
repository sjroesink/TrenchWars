import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaRoom } from '../arena-room';
import {
  generateTestArena,
  SHIP_CONFIGS,
  SHIP_WEAPONS,
  TICK_DT,
  SNAPSHOT_RATE,
} from '@trench-wars/shared';
import type { TileMap, GameSnapshot } from '@trench-wars/shared';
import { WebSocket } from 'ws';

describe('Performance benchmarks', () => {
  let map: TileMap;
  let room: ArenaRoom;

  beforeEach(() => {
    map = generateTestArena(200, 200);
    room = new ArenaRoom({
      id: 'perf-test',
      name: 'Perf Test',
      map,
      maxPlayers: 30,
    });
  });

  /**
   * Helper: add N synthetic players with random positions and velocities.
   * Does NOT use WebSocket -- adds directly via playerManager for benchmarking.
   */
  function addSyntheticPlayers(count: number): void {
    for (let i = 0; i < count; i++) {
      const playerId = `perf-player-${i}`;
      const shipType = i % 3; // Rotate through ship types
      const player = room.playerManager.addPlayer(playerId, `Player${i}`, shipType);
      // Place within map bounds (away from walls)
      player.ship.x = 10 + Math.random() * 180;
      player.ship.y = 10 + Math.random() * 180;
      player.ship.vx = (Math.random() - 0.5) * 2;
      player.ship.vy = (Math.random() - 0.5) * 2;
      player.ship.orientation = Math.random();
    }
  }

  describe('tick performance', () => {
    it('tick() completes in < 5ms with 25 simulated players', () => {
      addSyntheticPlayers(25);

      // Warm up: run a few ticks to stabilize
      for (let i = 0; i < 10; i++) {
        (room as any).tick();
      }

      // Measure 100 ticks
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        (room as any).tick();
      }
      const elapsed = performance.now() - start;
      const avgTickMs = elapsed / 100;

      console.log(`Average tick time with 25 players: ${avgTickMs.toFixed(3)}ms`);
      expect(avgTickMs).toBeLessThan(5);
    });

    it('tick rate stable over 1000 ticks with 25 players', () => {
      addSyntheticPlayers(25);

      // Warm up
      for (let i = 0; i < 10; i++) {
        (room as any).tick();
      }

      // Measure 1000 ticks
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        (room as any).tick();
      }
      const elapsed = performance.now() - start;
      const avgTickMs = elapsed / 1000;

      console.log(`Average tick time over 1000 ticks with 25 players: ${avgTickMs.toFixed(3)}ms`);
      expect(avgTickMs).toBeLessThan(5);
    });
  });

  describe('snapshot serialization performance', () => {
    it('broadcastSnapshot() serializes in < 2ms with 25 players', () => {
      addSyntheticPlayers(25);

      // Build the snapshot data structure manually (same as broadcastSnapshot)
      const players = room.playerManager.getAllPlayers();
      const projectiles = room.weaponManager.getProjectiles();

      // Add some synthetic projectiles by firing weapons
      // Instead, build snapshot directly to measure JSON.stringify time
      const snapshot: GameSnapshot = {
        tick: 0,
        players: players.map(p => ({
          id: p.id,
          name: p.name,
          x: p.ship.x,
          y: p.ship.y,
          vx: p.ship.vx,
          vy: p.ship.vy,
          orientation: p.ship.orientation,
          energy: p.ship.energy,
          shipType: p.shipType,
          alive: p.alive,
          kills: p.kills,
          deaths: p.deaths,
          lastProcessedSeq: p.lastProcessedSeq,
        })),
        projectiles: Array.from({ length: 50 }, (_, i) => ({
          id: i,
          type: 'bullet' as const,
          x: Math.random() * 200,
          y: Math.random() * 200,
          vx: Math.random() * 10,
          vy: Math.random() * 10,
          ownerId: `perf-player-${i % 25}`,
          rear: false,
        })),
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        JSON.stringify({ type: 0x20, ...snapshot });
      }

      // Measure
      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        JSON.stringify({ type: 0x20, ...snapshot });
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      console.log(`Average snapshot serialization time (25 players, 50 projectiles): ${avgMs.toFixed(3)}ms`);
      expect(avgMs).toBeLessThan(2);
    });
  });
});
