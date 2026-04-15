// Hand-computed regression tests for VPD utilities.
// All expected values derived from Magnus formula constants in spec.

import { describe, it, expect } from 'vitest';
import { satVaporPressure, vpdRatio, VPD_REF_HPA } from '../../src/heat_balance/vpd.js';

describe('satVaporPressure (Magnus formula)', () => {
  it('returns 6.1078 hPa at 0°C (water freezing point reference)', () => {
    // p_sat(0) = 6.1078 × exp(0) = 6.1078 hPa
    expect(satVaporPressure(0)).toBeCloseTo(6.1078, 4);
  });

  it('returns ~23.39 hPa at 20°C (lab reference temperature)', () => {
    // p_sat(20) = 6.1078 × exp(17.27 × 20 / 257.3)
    //           = 6.1078 × exp(1.3427)
    //           = 6.1078 × 3.829
    //           ≈ 23.385 hPa
    expect(satVaporPressure(20)).toBeCloseTo(23.385, 2);
  });

  it('returns ~42.43 hPa at 30°C', () => {
    // p_sat(30) = 6.1078 × exp(17.27 × 30 / 267.3) ≈ 42.43 hPa
    expect(satVaporPressure(30)).toBeCloseTo(42.43, 1);
  });

  it('returns ~73.78 hPa at 40°C (heat stroke threshold)', () => {
    expect(satVaporPressure(40)).toBeCloseTo(73.78, 1);
  });

  it('VPD_REF_HPA equals satVaporPressure(20) × 0.5', () => {
    expect(VPD_REF_HPA).toBeCloseTo(satVaporPressure(20) * 0.5, 4);
    expect(VPD_REF_HPA).toBeCloseTo(11.69, 1);
  });
});

describe('vpdRatio', () => {
  it('returns 1.0 at 68°F / 50% RH (lab reference)', () => {
    expect(vpdRatio(68, 50)).toBeCloseTo(1.0, 2);
  });

  it('returns 0 at 100% RH (no vapor pressure deficit)', () => {
    expect(vpdRatio(68, 100)).toBeCloseTo(0, 4);
  });

  it('increases with temperature at constant RH', () => {
    const ratio80 = vpdRatio(80, 50);
    const ratio60 = vpdRatio(60, 50);
    expect(ratio80).toBeGreaterThan(ratio60);
  });

  it('decreases with humidity at constant temperature', () => {
    const dry = vpdRatio(68, 30);
    const humid = vpdRatio(68, 70);
    expect(dry).toBeGreaterThan(humid);
  });

  it('handles undefined humidity by defaulting to 45', () => {
    // @ts-expect-error: testing runtime fallback for undefined humidity
    const ratioDefault = vpdRatio(68, undefined);
    const ratio45 = vpdRatio(68, 45);
    expect(ratioDefault).toBeCloseTo(ratio45, 4);
  });
});
