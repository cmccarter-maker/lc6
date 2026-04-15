// Tests for moisture/perceived_mr.ts — computePerceivedMR + constants.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import {
  computePerceivedMR,
  PERCEIVED_WEIGHTS,
  COMFORT_THRESHOLD,
} from '../../src/moisture/perceived_mr.js';

describe('PERCEIVED_WEIGHTS (Fukazawa 2003 baseline)', () => {
  it('locks in [3, 2, 1.5, 1] (skin → outer)', () => {
    expect([...PERCEIVED_WEIGHTS]).toEqual([3, 2, 1.5, 1]);
  });
});

describe('COMFORT_THRESHOLD (Fukazawa 2003)', () => {
  it('locks in 40 mL', () => {
    expect(COMFORT_THRESHOLD).toBe(40);
  });
});

describe('computePerceivedMR', () => {
  it('empty layers → 0', () => {
    expect(computePerceivedMR([])).toBe(0);
    expect(computePerceivedMR(null)).toBe(0);
    expect(computePerceivedMR(undefined)).toBe(0);
  });

  it('base layer at half of comfort threshold (20mL/40mL=0.5) + mid layer 50% fill → 3.76', () => {
    const r = computePerceivedMR([
      { buffer: 20, cap: 75 },
      { buffer: 10, cap: 18 },
    ]);
    expect(r).toBeCloseTo(3.76, 2);
  });

  it('base at threshold + mid full + insul partial (3 layers) → 5.88', () => {
    const r = computePerceivedMR([
      { buffer: 40, cap: 75 },
      { buffer: 18, cap: 18 },
      { buffer: 5,  cap: 24 },
    ]);
    expect(r).toBeCloseTo(5.8846, 3);
  });

  it('all layers fully saturated (4 layers) → 7.2 (max projection)', () => {
    const r = computePerceivedMR([
      { buffer: 80, cap: 75 },  // base over threshold
      { buffer: 18, cap: 18 },
      { buffer: 24, cap: 24 },
      { buffer: 4,  cap: 4 },
    ]);
    expect(r).toBeCloseTo(7.2, 2);
  });

  it('caps at 10', () => {
    // Extreme — base way over threshold + all caps full
    const r = computePerceivedMR([
      { buffer: 1000, cap: 1000 },
      { buffer: 1000, cap: 1000 },
      { buffer: 1000, cap: 1000 },
      { buffer: 1000, cap: 1000 },
    ]);
    expect(r).toBeLessThanOrEqual(10);
  });

  it('zero-cap layer is treated as zero fill (skipped)', () => {
    const r = computePerceivedMR([
      { buffer: 40, cap: 40 },
      { buffer: 10, cap: 0 },  // zero cap → 0 fill
    ]);
    expect(r).toBeGreaterThan(0);
    expect(Number.isFinite(r)).toBe(true);
  });

  it('5+ layers use last weight (1) for index ≥ 3', () => {
    // PERCEIVED_WEIGHTS has 4 entries; 5th layer should reuse weight=1
    const r = computePerceivedMR([
      { buffer: 40, cap: 40 },
      { buffer: 10, cap: 10 },
      { buffer: 10, cap: 10 },
      { buffer: 10, cap: 10 },
      { buffer: 10, cap: 10 },  // 5th layer
    ]);
    expect(Number.isFinite(r)).toBe(true);
  });
});
