import { describe, it, expect } from 'vitest';
import {
  ANTI_BURN_IDLE_MS,
  ANTI_BURN_SHIFT_INTERVAL_MS,
  ANTI_BURN_MAX_OFFSET_PX,
  ANTI_BURN_DIM_OPACITY,
  ANTI_BURN_POSITIONS,
  getNextPositionIndex,
  DEFAULT_ANTI_BURN_MODE,
} from '@/lib/anti-burn';

describe('anti-burn config', () => {
  it('should have valid idle timeout', () => {
    expect(ANTI_BURN_IDLE_MS).toBeGreaterThan(0);
    expect(ANTI_BURN_IDLE_MS).toBeGreaterThanOrEqual(30_000);
  });

  it('should have valid shift interval', () => {
    expect(ANTI_BURN_SHIFT_INTERVAL_MS).toBeGreaterThan(0);
    expect(ANTI_BURN_SHIFT_INTERVAL_MS).toBeGreaterThanOrEqual(ANTI_BURN_IDLE_MS);
  });

  it('should have small max offset', () => {
    expect(ANTI_BURN_MAX_OFFSET_PX).toBeGreaterThanOrEqual(1);
    expect(ANTI_BURN_MAX_OFFSET_PX).toBeLessThanOrEqual(4);
  });

  it('should have minimal dim opacity', () => {
    expect(ANTI_BURN_DIM_OPACITY).toBeGreaterThan(0);
    expect(ANTI_BURN_DIM_OPACITY).toBeLessThanOrEqual(0.03);
  });

  it('should have at least 3 positions', () => {
    expect(ANTI_BURN_POSITIONS.length).toBeGreaterThanOrEqual(3);
  });

  it('should have positions within max offset range', () => {
    for (const pos of ANTI_BURN_POSITIONS) {
      expect(Math.abs(pos.x)).toBeLessThanOrEqual(ANTI_BURN_MAX_OFFSET_PX);
      expect(Math.abs(pos.y)).toBeLessThanOrEqual(ANTI_BURN_MAX_OFFSET_PX);
    }
  });

  it('should have valid default mode', () => {
    expect(['shift-only', 'shift-plus-dim']).toContain(DEFAULT_ANTI_BURN_MODE);
  });
});

describe('getNextPositionIndex', () => {
  it('should cycle through positions', () => {
    const length = ANTI_BURN_POSITIONS.length;
    for (let i = 0; i < length * 2; i++) {
      const next = getNextPositionIndex(i);
      expect(next).toBe((i + 1) % length);
    }
  });

  it('should wrap around at the end', () => {
    const last = ANTI_BURN_POSITIONS.length - 1;
    expect(getNextPositionIndex(last)).toBe(0);
  });
});
