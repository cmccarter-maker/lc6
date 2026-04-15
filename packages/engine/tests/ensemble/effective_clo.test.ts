// Tests for effective_clo.ts — pumpingReduction, windCLOProtection,
// staticLayeringCorrection, computeEffectiveCLO, clothingInsulation.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import {
  pumpingReduction,
  windCLOProtection,
  staticLayeringCorrection,
  computeEffectiveCLO,
  clothingInsulation,
} from '../../src/ensemble/effective_clo.js';

describe('pumpingReduction (Havenith 2002, Lu 2015)', () => {
  it('returns 1.0 at MET 1.0 (rest)', () => {
    expect(pumpingReduction(1.0)).toBe(1.0);
  });

  it('returns 1.0 at MET 2.0 (boundary)', () => {
    expect(pumpingReduction(2.0)).toBe(1.0);
  });

  it('returns 0.55 at MET 10.0 (max reduction 45%)', () => {
    // 1 - min(0.45, (10-2)/8 * 0.45) = 1 - 0.45 = 0.55
    expect(pumpingReduction(10.0)).toBeCloseTo(0.55, 4);
  });

  it('returns 0.8875 at MET 4.0 (walking)', () => {
    // 1 - (4-2)/8 * 0.45 = 1 - 0.1125 = 0.8875
    expect(pumpingReduction(4.0)).toBeCloseTo(0.8875, 4);
  });

  it('caps at 0.55 above MET 10', () => {
    expect(pumpingReduction(15.0)).toBeCloseTo(0.55, 4);
  });
});

describe('windCLOProtection (PMC 10024235)', () => {
  it('returns 1.0 with no wind regardless of shell', () => {
    expect(windCLOProtection(5, 0)).toBe(1.0);
    expect(windCLOProtection(0, 0)).toBe(1.0);
  });

  it('returns 0.5 with no shell + wind ≥ 15 mph (max penetration)', () => {
    // penetration=1.0, windFactor=1.0; 1 - 1*1*0.5 = 0.5
    expect(windCLOProtection(0, 15)).toBeCloseTo(0.5, 4);
  });

  it('windproof shell (WR=10) at high wind → only 7.5% reduction', () => {
    // penetration=0.15, windFactor=1.0; 1 - 0.15*1*0.5 = 0.925
    expect(windCLOProtection(10, 15)).toBeCloseTo(0.925, 4);
  });

  it('locks in walking + light wind value: 5 mph, WR=5 → 0.9042', () => {
    // penetration=1-(5/10)*0.85=0.575; windFactor=5/15=0.333
    // 1 - 0.575 * 0.333 * 0.5 = 0.9042
    expect(windCLOProtection(5, 5)).toBeCloseTo(0.9042, 3);
  });
});

describe('staticLayeringCorrection (McCullough 1984, ISO 9920)', () => {
  it('returns 1.0 below 2 layers', () => {
    expect(staticLayeringCorrection(1.5, 1)).toBe(1.0);
    expect(staticLayeringCorrection(1.5, 0)).toBe(1.0);
  });

  it('returns 1.0 above MET 2.0 (movement disables this correction)', () => {
    expect(staticLayeringCorrection(3.0, 4)).toBe(1.0);
  });

  it('returns 0.96 at rest with 2 layers', () => {
    expect(staticLayeringCorrection(1.5, 2)).toBeCloseTo(0.96, 4);
  });

  it('returns 0.92 at rest with 3 layers', () => {
    expect(staticLayeringCorrection(1.5, 3)).toBeCloseTo(0.92, 4);
  });

  it('returns 0.88 at rest with 4 layers', () => {
    expect(staticLayeringCorrection(1.5, 4)).toBeCloseTo(0.88, 4);
  });

  it('caps reduction at 5+ layers (0.84)', () => {
    expect(staticLayeringCorrection(1.5, 5)).toBeCloseTo(0.84, 4);
    expect(staticLayeringCorrection(1.5, 7)).toBeCloseTo(0.84, 4);
  });
});

describe('computeEffectiveCLO — lock-in LC5 baselines', () => {
  it('rest, no wind, 1 layer → CLO unchanged (2.0)', () => {
    // pump=1.0, wind=1.0, lay=1.0 → result = baseCLO
    expect(computeEffectiveCLO(2.0, 1.5, 5, 0, 1)).toBe(2.0);
  });

  it('rest, no wind, 4 layers → 1.7600 (only layering correction applies)', () => {
    // pump=1.0, wind=1.0, lay=0.88 → 2.0 * 0.88 = 1.76
    expect(computeEffectiveCLO(2.0, 1.5, 5, 0, 4)).toBeCloseTo(1.7600, 4);
  });

  it('walking, light wind, 3 layers → 1.2037', () => {
    // pump=0.8875, wind=0.9042, lay=1.0 (MET>2 disables)
    // 1.5 * 0.8875 * 0.9042 * 1.0 = 1.2037
    expect(computeEffectiveCLO(1.5, 4.0, 5, 5, 3)).toBeCloseTo(1.2037, 3);
  });

  it('running, no wind, 2 layers → 0.6625', () => {
    // pump=1-0.45*(8-2)/8=0.6625, wind=1.0, lay=1.0
    // 1.0 * 0.6625 * 1.0 * 1.0 = 0.6625
    expect(computeEffectiveCLO(1.0, 8.0, 0, 0, 2)).toBeCloseTo(0.6625, 4);
  });

  it('skiing, heavy wind, 4 layers → 1.7456', () => {
    // pump=0.83125, wind=0.84, lay=1.0
    // 2.5 * 0.83125 * 0.84 * 1.0 = 1.7456
    expect(computeEffectiveCLO(2.5, 5.0, 8, 20, 4)).toBeCloseTo(1.7456, 3);
  });

  it('extreme conditions hit 30% floor', () => {
    // baseCLO=1.5, MET=10, no shell, 30 mph wind
    // pump=0.55, wind=0.5, lay=1.0; product=0.4125; floor=0.45 → result=0.45
    expect(computeEffectiveCLO(1.5, 10.0, 0, 30, 3)).toBeCloseTo(0.45, 4);
  });
});

describe('clothingInsulation (LC5 mixed convention: takes °F)', () => {
  it('hot 80°F + low intensity → minimal CLO', () => {
    // tempF>75 → clo=0.3, intMul=0.05, excess=0, heatTrap=0
    // result = 1.0 + 0 = 1.0
    expect(clothingInsulation(80, 'low')).toBe(1.0);
  });

  it('cool 50°F + moderate → 1.1 CLO', () => {
    // 45<tempF<55 → clo=1.0, intMul=0.2
    // excess=0.5, heatTrap=0.10; result = 1.0 + 0.10 = 1.10
    expect(clothingInsulation(50, 'moderate')).toBeCloseTo(1.10, 4);
  });

  it('cold 30°F + high intensity → 1.585 CLO', () => {
    // 25<tempF<35 → clo=1.8, intMul=0.45
    // excess=1.3, heatTrap=0.585; result = 1.0 + 0.585 = 1.585
    expect(clothingInsulation(30, 'high')).toBeCloseTo(1.585, 3);
  });

  it('extreme 5°F + very_high intensity → caps heat trapping at 1.0', () => {
    // tempF<10 → clo=2.5, intMul=0.65
    // excess=2.0, heatTrap=1.30 → capped at 1.0; result = 1.0 + 1.0 = 2.0
    expect(clothingInsulation(5, 'very_high')).toBe(2.0);
  });

  it('uses moderate default for unknown intensity', () => {
    expect(clothingInsulation(50, 'unknown_intensity')).toBeCloseTo(1.10, 4);
  });

  it('uses moderate default when intensity undefined', () => {
    expect(clothingInsulation(50, undefined)).toBeCloseTo(1.10, 4);
  });

  it('temperature tier boundaries — locks in 8 tiers', () => {
    // Exact boundary tests (just below tier transitions)
    expect(clothingInsulation(76, 'moderate')).toBeCloseTo(1.0, 4); // 0.3 base, no excess
    expect(clothingInsulation(66, 'moderate')).toBeCloseTo(1.0, 4); // 0.5 base, no excess
    expect(clothingInsulation(56, 'moderate')).toBeCloseTo(1.04, 2); // 0.7, excess=0.2, +0.04
    expect(clothingInsulation(46, 'moderate')).toBeCloseTo(1.10, 4); // 1.0, excess=0.5, +0.10
    expect(clothingInsulation(36, 'moderate')).toBeCloseTo(1.18, 4); // 1.4, excess=0.9, +0.18
    expect(clothingInsulation(26, 'moderate')).toBeCloseTo(1.26, 4); // 1.8, excess=1.3, +0.26
    expect(clothingInsulation(11, 'moderate')).toBeCloseTo(1.34, 4); // 2.2, excess=1.7, +0.34
    expect(clothingInsulation(0, 'moderate')).toBeCloseTo(1.40, 4); // 2.5, excess=2.0, +0.40
  });
});
