import { describe, it, expect } from 'vitest';
import {
  magnusDewPoint,
  inverseMagnus,
  satVaporPressure,
} from '../../src/heat_balance/vpd.js';

/**
 * PHY-HUMID-01 v2 Phase 1: Magnus dew point helpers.
 *
 * Reference values hand-computed from Magnus formula (Alduchov & Eskridge 1996)
 * and cross-checked against published psychrometric tables.
 *
 * Tolerance: ±0.2°C. Magnus approximation has intrinsic error ~0.1°C in
 * 0-40°C range; tighter tolerance would flag floating-point noise.
 */
describe('magnusDewPoint', () => {
  it('matches published table value: 20°C, 50% RH → ~9.3°C', () => {
    expect(magnusDewPoint(20, 50)).toBeCloseTo(9.27, 1);
  });

  it('matches published table value: 30°C, 80% RH → ~26.2°C', () => {
    expect(magnusDewPoint(30, 80)).toBeCloseTo(26.17, 1);
  });

  it('H3 adversarial matrix: 23.9°C (75°F), 90% RH → ~22.0°C', () => {
    // Reference: hand-computed for PHY-HUMID-01 v2 spec
    expect(magnusDewPoint(23.9, 90)).toBeCloseTo(22.15, 1);
  });

  it('100% RH: dew point equals ambient temperature (saturated air)', () => {
    expect(magnusDewPoint(15, 100)).toBeCloseTo(15, 1);
    expect(magnusDewPoint(0, 100)).toBeCloseTo(0, 1);
    expect(magnusDewPoint(25, 100)).toBeCloseTo(25, 1);
  });

  it('cold temperatures: 0°C, 50% RH → roughly -8 to -9°C', () => {
    // Hand: p_sat(0) = 6.108, p_amb = 3.054, T_d = B*ln(3.054/6.108)/(A-ln(...))
    // = 237.3 * (-0.693) / (17.27 - (-0.693)) = -164.45 / 17.963 = -9.15°C
    expect(magnusDewPoint(0, 50)).toBeCloseTo(-9.15, 1);
  });
});

describe('inverseMagnus', () => {
  it('round-trip identity: inverseMagnus(satVaporPressure(T)) ≈ T', () => {
    for (const T of [-10, 0, 10, 15, 20, 25, 30, 35]) {
      expect(inverseMagnus(satVaporPressure(T))).toBeCloseTo(T, 1);
    }
  });

  it('returns ~15°C for p ≈ 17.05 hPa (satVaporPressure at 15°C)', () => {
    expect(inverseMagnus(17.05)).toBeCloseTo(15, 1);
  });

  it('returns ~0°C for p ≈ 6.108 hPa (saturation at 0°C)', () => {
    expect(inverseMagnus(6.108)).toBeCloseTo(0, 1);
  });
});
