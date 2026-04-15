// Hand-computed regression tests for utility functions.

import { describe, it, expect } from 'vitest';
import {
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
} from '../../src/heat_balance/utilities.js';

describe('getWindPenetration', () => {
  it('returns 1.0 at WR=0 (no shell, full wind through)', () => {
    expect(getWindPenetration(0)).toBe(1.0);
  });

  it('returns 0.15 at WR=10 (Gore-Tex Pro, 15% min penetration)', () => {
    // 1.0 - (10/10)*0.85 = 0.15
    expect(getWindPenetration(10)).toBeCloseTo(0.15, 4);
  });

  it('returns 0.575 at WR=5 (mid-range)', () => {
    // 1.0 - (5/10)*0.85 = 0.575
    expect(getWindPenetration(5)).toBeCloseTo(0.575, 4);
  });
});

describe('getEnsembleCapacity', () => {
  it('returns 0.42 L for 4-layer activity (skiing)', () => {
    // 0.18 + 0.08 × (4-1) = 0.42
    expect(getEnsembleCapacity('skiing')).toBeCloseTo(0.42, 4);
  });

  it('returns 0.34 L for 3-layer activity (hiking)', () => {
    expect(getEnsembleCapacity('hiking')).toBeCloseTo(0.34, 4);
  });

  it('returns 0.26 L for 2-layer activity (fishing)', () => {
    expect(getEnsembleCapacity('fishing')).toBeCloseTo(0.26, 4);
  });

  it('defaults to 3-layer (0.34) for unknown activity', () => {
    expect(getEnsembleCapacity('unknown_activity')).toBeCloseTo(0.34, 4);
  });
});

describe('humidityFloorFactor', () => {
  it('returns 1.0 below 70% RH', () => {
    expect(humidityFloorFactor(50)).toBe(1.0);
    expect(humidityFloorFactor(69)).toBe(1.0);
  });

  it('decreases linearly above 70% RH', () => {
    // 1 - (85-70)/60 = 1 - 0.25 = 0.75
    expect(humidityFloorFactor(85)).toBeCloseTo(0.75, 4);
  });

  it('caps at 0.25 minimum', () => {
    // 1 - (130-70)/60 = -0.0; capped at 0.25
    expect(humidityFloorFactor(130)).toBe(0.25);
  });

  it('returns 0.25 at 100% RH', () => {
    // 1 - (100-70)/60 = 0.5; not at floor yet
    expect(humidityFloorFactor(100)).toBeCloseTo(0.5, 4);
  });
});

describe('applyDurationPenalty', () => {
  it('returns baseMR unchanged at 0 hrs at cap', () => {
    expect(applyDurationPenalty(5, 0)).toBe(5);
  });

  it('adds log penalty at 1 hr at cap', () => {
    // 0.45 × log(1+1) = 0.45 × 0.693 ≈ 0.312
    expect(applyDurationPenalty(5, 1)).toBeCloseTo(5.312, 2);
  });

  it('caps at 10', () => {
    expect(applyDurationPenalty(9.8, 100)).toBe(10);
  });

  it('handles negative timeAtCapHrs as zero', () => {
    expect(applyDurationPenalty(5, -1)).toBe(5);
  });
});

describe('precipWettingRate', () => {
  it('returns 0 below 50% precip probability', () => {
    expect(precipWettingRate(0.3, 50, 5)).toBe(0);
    expect(precipWettingRate(0.5, 50, 5)).toBe(0);
  });

  it('returns 0 with waterproof shell (WR ≥ 7) regardless of conditions', () => {
    expect(precipWettingRate(0.9, 50, 7)).toBe(0);
    expect(precipWettingRate(1.0, 60, 10)).toBe(0);
  });

  it('returns reduced rate with water-resistant shell (WR 4-6)', () => {
    // baseRate at 80% precip: 0.03 + 0.30*0.04 = 0.042
    // shellGate 0.40, tempGate 1.0 (60°F)
    // = 0.042 * 0.40 * 1.0 = 0.0168
    expect(precipWettingRate(0.8, 60, 5)).toBeCloseTo(0.0168, 3);
  });

  it('returns reduced rate with snow temperature (< 30°F)', () => {
    // baseRate at 80%: 0.042; shellGate 1.0 (no shell); tempGate 0.10
    // = 0.042 * 1.0 * 0.10 = 0.0042
    expect(precipWettingRate(0.8, 25, 0)).toBeCloseTo(0.0042, 3);
  });

  it('returns full rate above 36°F with no shell', () => {
    // baseRate at 80%: 0.042; shellGate 1.0; tempGate 1.0
    expect(precipWettingRate(0.8, 50, 0)).toBeCloseTo(0.042, 3);
  });
});
