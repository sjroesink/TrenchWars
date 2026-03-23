import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerManager } from '../player-manager';
import { RECONNECT_TIMEOUT } from '@trench-wars/shared';

describe('PlayerManager reconnection', () => {
  let pm: PlayerManager;

  beforeEach(() => {
    pm = new PlayerManager();
  });

  it('holdPlayer marks player as disconnected', () => {
    const player = pm.addPlayer('p1', 'Alice', 0);
    expect(player.disconnectedAt).toBe(0);

    pm.holdPlayer('p1', 1000);

    const held = pm.getPlayer('p1');
    expect(held).toBeDefined();
    expect(held!.disconnectedAt).toBe(1000);
  });

  it('held player is excluded from getAlivePlayers', () => {
    pm.addPlayer('p1', 'Alice', 0);
    pm.addPlayer('p2', 'Bob', 1);

    expect(pm.getAlivePlayers()).toHaveLength(2);

    pm.holdPlayer('p1', 500);
    const alive = pm.getAlivePlayers();
    expect(alive).toHaveLength(1);
    expect(alive[0].id).toBe('p2');
  });

  it('held player remains in getAllPlayers', () => {
    pm.addPlayer('p1', 'Alice', 0);
    pm.holdPlayer('p1', 500);

    const all = pm.getAllPlayers();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('p1');
  });

  it('restorePlayer with valid token within timeout returns PlayerState', () => {
    const player = pm.addPlayer('p1', 'Alice', 0);
    const token = player.sessionToken;

    pm.holdPlayer('p1', 1000);
    const restored = pm.restorePlayer(token, 1000 + RECONNECT_TIMEOUT - 1);

    expect(restored).not.toBeNull();
    expect(restored!.id).toBe('p1');
    expect(restored!.disconnectedAt).toBe(0); // reconnected
    expect(restored!.name).toBe('Alice');
  });

  it('restorePlayer exactly at timeout boundary succeeds', () => {
    const player = pm.addPlayer('p1', 'Alice', 0);
    const token = player.sessionToken;

    pm.holdPlayer('p1', 1000);
    const restored = pm.restorePlayer(token, 1000 + RECONNECT_TIMEOUT);

    expect(restored).not.toBeNull();
    expect(restored!.id).toBe('p1');
  });

  it('restorePlayer after timeout returns null', () => {
    const player = pm.addPlayer('p1', 'Alice', 0);
    const token = player.sessionToken;

    pm.holdPlayer('p1', 1000);
    const restored = pm.restorePlayer(token, 1000 + RECONNECT_TIMEOUT + 1);

    expect(restored).toBeNull();
  });

  it('restorePlayer with invalid token returns null', () => {
    pm.addPlayer('p1', 'Alice', 0);
    pm.holdPlayer('p1', 1000);

    const restored = pm.restorePlayer('bogus-token', 1001);
    expect(restored).toBeNull();
  });

  it('restorePlayer for connected player (not held) returns null', () => {
    const player = pm.addPlayer('p1', 'Alice', 0);
    // Player is connected (disconnectedAt = 0), should not be restorable
    const restored = pm.restorePlayer(player.sessionToken, 100);
    expect(restored).toBeNull();
  });

  it('restored player is back in getAlivePlayers', () => {
    const player = pm.addPlayer('p1', 'Alice', 0);
    pm.holdPlayer('p1', 500);

    expect(pm.getAlivePlayers()).toHaveLength(0);

    pm.restorePlayer(player.sessionToken, 501);
    expect(pm.getAlivePlayers()).toHaveLength(1);
  });

  it('cleanupDisconnected removes expired held players', () => {
    const p1 = pm.addPlayer('p1', 'Alice', 0);
    const p2 = pm.addPlayer('p2', 'Bob', 1);

    pm.holdPlayer('p1', 100);
    pm.holdPlayer('p2', 500);

    // At tick 100 + RECONNECT_TIMEOUT + 1, p1 should be removed, p2 still held
    pm.cleanupDisconnected(100 + RECONNECT_TIMEOUT + 1);

    expect(pm.getPlayer('p1')).toBeUndefined();
    expect(pm.getPlayer('p2')).toBeDefined();
    expect(pm.getPlayer('p2')!.disconnectedAt).toBe(500);
  });

  it('cleanupDisconnected does not remove connected players', () => {
    pm.addPlayer('p1', 'Alice', 0);
    pm.cleanupDisconnected(999999);
    expect(pm.getPlayer('p1')).toBeDefined();
  });

  it('session token is unique per player', () => {
    const p1 = pm.addPlayer('p1', 'Alice', 0);
    const p2 = pm.addPlayer('p2', 'Bob', 1);
    expect(p1.sessionToken).not.toBe(p2.sessionToken);
    expect(p1.sessionToken.length).toBeGreaterThan(0);
  });
});
