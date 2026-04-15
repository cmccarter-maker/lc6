// Tests for cold_physiology.ts — civdProtectionFactor + shiveringBoost + computeHLR.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import {
  civdProtectionFactor,
  shiveringBoost,
  computeHLR,
} from '../../src/heat_balance/cold_physiology.js';

describe('civdProtectionFactor (Flouris & Cheung 2008)', () => {
  it('returns 0.0 above 37.5°C (no risk)', () => {
    expect(civdProtectionFactor(37.5)).toBe(0.0);
    expect(civdProtectionFactor(37.6)).toBe(0.0);
    expect(civdProtectionFactor(38.0)).toBe(0.0);
  });

  it('linear ramp 37.0-37.5: 0.0 → 0.3', () => {
    expect(civdProtectionFactor(37.25)).toBeCloseTo(0.15, 4);
    expect(civdProtectionFactor(37.0)).toBeCloseTo(0.3, 4);
  });

  it('linear ramp 36.5-37.0: 0.3 → 0.7', () => {
    expect(civdProtectionFactor(36.75)).toBeCloseTo(0.5, 4);
    expect(civdProtectionFactor(36.5)).toBeCloseTo(0.7, 4);
  });

  it('linear ramp 36.0-36.5: 0.7 → 1.0', () => {
    expect(civdProtectionFactor(36.25)).toBeCloseTo(0.85, 4);
    expect(civdProtectionFactor(36.0)).toBeCloseTo(1.0, 4);
  });

  it('returns 1.0 below 36.0°C (CIVD abandoned)', () => {
    expect(civdProtectionFactor(35.5)).toBe(1.0);
    expect(civdProtectionFactor(34.0)).toBe(1.0);
  });
});

describe('shiveringBoost (Young et al. 1986)', () => {
  it('warm conditions → no shivering', () => {
    expect(shiveringBoost(20, 1.5, 1.0, 22)).toBe(0);
  });

  it('moderate cold rest with light gear → small shivering boost', () => {
    expect(shiveringBoost(-5, 1.5, 1.0, 22)).toBeCloseTo(0.082, 2);
  });

  it('moderate cold rest with heavy gear → no shivering (CLO protection sufficient)', () => {
    expect(shiveringBoost(-5, 1.5, 3.0, 22)).toBe(0);
  });

  it('cold but high MET → no shivering needed (above crossover)', () => {
    expect(shiveringBoost(-10, 6.0, 1.5, 22)).toBe(0);
  });

  it('extreme cold passive → strong shivering boost', () => {
    expect(shiveringBoost(-20, 1.0, 0.5, 15)).toBeCloseTo(1.5576, 3);
  });

  it('high BF protection reduces shivering', () => {
    expect(shiveringBoost(-10, 1.0, 1.0, 35)).toBeCloseTo(0.306, 2);
  });

  it('caps at 2.5 METs (Hayward 1975 max sustainable)', () => {
    // Extreme conditions to push toward cap
    expect(shiveringBoost(-50, 0.5, 0.0, 5)).toBeLessThanOrEqual(2.5);
  });
});

describe('computeHLR (composite cold-loss risk)', () => {
  it('surplus moderate (deficit=-50, T_amb=0, sat=0.2): HLR ≈ 3.34', () => {
    expect(computeHLR(-50, 37.0, 0, 0.2)).toBeCloseTo(3.337, 2);
  });

  it('neutral cool (deficit=0, T_amb=5, sat=0.2): HLR ≈ 2.86', () => {
    expect(computeHLR(0, 37.0, 5, 0.2)).toBeCloseTo(2.86, 2);
  });

  it('deficit cold (deficit=100, core=36.5, T=-5, sat=0.5): HLR ≈ 2.34', () => {
    expect(computeHLR(100, 36.5, -5, 0.5)).toBeCloseTo(2.337, 2);
  });

  it('extreme deficit hypothermic (deficit=200, core=35.5, T=-15, sat=0.8): HLR ≈ 1.82', () => {
    expect(computeHLR(200, 35.5, -15, 0.8)).toBeCloseTo(1.82, 2);
  });

  it('mild deficit warm wet (deficit=50, T=10, sat=0.6): HLR ≈ 2.28', () => {
    expect(computeHLR(50, 37.0, 10, 0.6)).toBeCloseTo(2.281, 2);
  });

  it('caps at HLR 10', () => {
    // Worst-case construction
    expect(computeHLR(-1000, 35.0, -30, 1.0)).toBeLessThanOrEqual(10);
  });
});
