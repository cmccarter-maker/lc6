// Tests for moisture/saturation_cascade.ts — applySaturationCascade.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import { applySaturationCascade } from '../../src/moisture/saturation_cascade.js';

describe('applySaturationCascade (LC5 Saturation Cascade v3)', () => {
  it('Phase 1 (raw ≤ 6): linear pass-through', () => {
    expect(applySaturationCascade(0)).toBe(0);
    expect(applySaturationCascade(3)).toBe(3);
    expect(applySaturationCascade(6)).toBe(6);
  });

  it('Phase 2 (raw 6-10): quadratic ease-out', () => {
    // raw=7: 6 + 4 × (1 - (1 - 0.25)²) = 6 + 4 × 0.4375 = 7.75
    expect(applySaturationCascade(7)).toBeCloseTo(7.75, 4);
    // raw=8: 6 + 4 × (1 - (1 - 0.5)²) = 6 + 4 × 0.75 = 9.0
    expect(applySaturationCascade(8)).toBeCloseTo(9.0, 4);
    // raw=9: 6 + 4 × (1 - (1 - 0.75)²) = 6 + 4 × 0.9375 = 9.75
    expect(applySaturationCascade(9)).toBeCloseTo(9.75, 4);
  });

  it('cap at 10 for raw ≥ 10', () => {
    expect(applySaturationCascade(10)).toBe(10);
    expect(applySaturationCascade(11)).toBe(10);
    expect(applySaturationCascade(50)).toBe(10);
  });

  it('boundary at raw=6 returns exactly 6 (Phase 1 endpoint)', () => {
    expect(applySaturationCascade(6.0)).toBe(6.0);
  });

  it('curve continuous at raw=6 boundary', () => {
    // Just above 6 should be very close to 6
    expect(applySaturationCascade(6.001)).toBeCloseTo(6.0019997, 5);
  });

  it('curve approaches 10 asymptotically near raw=10', () => {
    // raw=9.9: 6 + 4 × (1 - (1 - 0.975)²) = 6 + 4 × 0.999375 = 9.9975
    expect(applySaturationCascade(9.9)).toBeCloseTo(9.9975, 3);
  });

  it('monotonic non-decreasing across full range', () => {
    let prev = applySaturationCascade(0);
    for (let r = 0.1; r <= 12; r += 0.1) {
      const curr = applySaturationCascade(r);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});
