import { describe, it, expect, beforeEach } from 'vitest';
import { LagCompensation } from '../lag-compensation';

describe('LagCompensation', () => {
  let lc: LagCompensation;

  beforeEach(() => {
    lc = new LagCompensation();
  });

  describe('record', () => {
    it('stores a single position snapshot', () => {
      lc.record(0, [{ id: 'p1', x: 10, y: 10, radius: 0.5 }]);
      const positions = lc.getPositionsAtTick(0);
      expect(positions).not.toBeNull();
      expect(positions!.get('p1')).toEqual({ x: 10, y: 10, radius: 0.5 });
    });

    it('caps history at maxHistoryTicks (200)', () => {
      for (let i = 0; i < 250; i++) {
        lc.record(i, [{ id: 'p1', x: i, y: i, radius: 0.5 }]);
      }
      // Oldest ticks (0-49) should be pruned
      const old = lc.getPositionsAtTick(0);
      expect(old).toBeNull();

      // Tick 50 should be the oldest remaining
      const earliest = lc.getPositionsAtTick(50);
      expect(earliest).not.toBeNull();
      expect(earliest!.get('p1')!.x).toBe(50);
    });

    it('stores multiple players per tick', () => {
      lc.record(5, [
        { id: 'p1', x: 10, y: 20, radius: 0.5 },
        { id: 'p2', x: 30, y: 40, radius: 0.6 },
      ]);
      const positions = lc.getPositionsAtTick(5);
      expect(positions).not.toBeNull();
      expect(positions!.size).toBe(2);
      expect(positions!.get('p1')).toEqual({ x: 10, y: 20, radius: 0.5 });
      expect(positions!.get('p2')).toEqual({ x: 30, y: 40, radius: 0.6 });
    });
  });

  describe('getPositionsAtTick', () => {
    it('returns exact tick when available', () => {
      lc.record(10, [{ id: 'p1', x: 100, y: 200, radius: 0.5 }]);
      const positions = lc.getPositionsAtTick(10);
      expect(positions).not.toBeNull();
      expect(positions!.get('p1')!.x).toBe(100);
    });

    it('returns closest tick <= requested when exact not available', () => {
      lc.record(0, [{ id: 'p1', x: 0, y: 0, radius: 0.5 }]);
      lc.record(10, [{ id: 'p1', x: 10, y: 10, radius: 0.5 }]);
      lc.record(20, [{ id: 'p1', x: 20, y: 20, radius: 0.5 }]);

      // Request tick 5 -> should return tick 0 (closest <=5)
      const positions = lc.getPositionsAtTick(5);
      expect(positions).not.toBeNull();
      expect(positions!.get('p1')!.x).toBe(0);

      // Request tick 15 -> should return tick 10
      const positions15 = lc.getPositionsAtTick(15);
      expect(positions15).not.toBeNull();
      expect(positions15!.get('p1')!.x).toBe(10);
    });

    it('returns null when tick is before all recorded history', () => {
      lc.record(10, [{ id: 'p1', x: 10, y: 10, radius: 0.5 }]);
      const positions = lc.getPositionsAtTick(-1);
      expect(positions).toBeNull();
    });

    it('returns null when no history recorded', () => {
      const positions = lc.getPositionsAtTick(5);
      expect(positions).toBeNull();
    });

    it('returns latest when requested tick is far in future', () => {
      lc.record(0, [{ id: 'p1', x: 0, y: 0, radius: 0.5 }]);
      lc.record(100, [{ id: 'p1', x: 100, y: 100, radius: 0.5 }]);

      // Tick 999 -> should return tick 100 (closest <= 999)
      const positions = lc.getPositionsAtTick(999);
      expect(positions).not.toBeNull();
      expect(positions!.get('p1')!.x).toBe(100);
    });
  });

  describe('custom maxHistoryTicks', () => {
    it('respects custom max history', () => {
      const smallLc = new LagCompensation(5);
      for (let i = 0; i < 10; i++) {
        smallLc.record(i, [{ id: 'p1', x: i, y: i, radius: 0.5 }]);
      }
      // Ticks 0-4 should be pruned, 5-9 remain
      expect(smallLc.getPositionsAtTick(4)).toBeNull();
      expect(smallLc.getPositionsAtTick(5)).not.toBeNull();
    });
  });
});
