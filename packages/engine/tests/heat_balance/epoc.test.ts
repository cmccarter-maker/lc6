// Tests for epoc.ts — epocParams + epocTau + estimateCoreTemp.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import { epocParams, epocTau, estimateCoreTemp } from '../../src/heat_balance/epoc.js';

describe('epocParams (Børsheim 2003 two-component)', () => {
  it('low intensity (MET≤6): tauFast=3, tauSlow=30, fastFrac=0.70', () => {
    const r = epocParams(4, 1.5);
    expect(r.tauFast).toBe(3);
    expect(r.tauSlow).toBe(30);
    expect(r.aFast).toBeCloseTo(1.75, 4);  // 2.5 × 0.70
    expect(r.aSlow).toBeCloseTo(0.75, 4);  // 2.5 × 0.30
  });

  it('high intensity (MET>6): tauFast=5, tauSlow=45, fastFrac=0.60', () => {
    const r = epocParams(8, 1.5);
    expect(r.tauFast).toBe(5);
    expect(r.tauSlow).toBe(45);
    expect(r.aFast).toBeCloseTo(3.9, 4);  // 6.5 × 0.60
    expect(r.aSlow).toBeCloseTo(2.6, 4);  // 6.5 × 0.40
  });

  it('boundary at MET=6: still in low-intensity regime', () => {
    const r = epocParams(6, 1.5);
    expect(r.tauFast).toBe(3);
    expect(r.aFast).toBeCloseTo(3.15, 4);  // 4.5 × 0.70
  });

  it('default METrest=1.5 when omitted', () => {
    const r1 = epocParams(4);
    const r2 = epocParams(4, 1.5);
    expect(r1.aFast).toBe(r2.aFast);
  });

  it('aFast + aSlow = METrun - METrest', () => {
    const r = epocParams(10, 1.5);
    expect(r.aFast + r.aSlow).toBeCloseTo(8.5, 4);
  });
});

describe('epocTau (legacy single-tau wrapper)', () => {
  it('rest regime (MET≤3): tau=4', () => {
    expect(epocTau(2)).toBe(4);
    expect(epocTau(3)).toBe(4);
  });

  it('mid regime (3<MET≤6): tau = 4 + (MET-3)×2', () => {
    expect(epocTau(5)).toBe(8);
    expect(epocTau(6)).toBe(10);
  });

  it('high regime (MET>6): tau = 10 + (MET-6)×3.3', () => {
    expect(epocTau(8)).toBeCloseTo(16.6, 4);
    expect(epocTau(10)).toBeCloseTo(23.2, 4);
  });
});

describe('estimateCoreTemp (Gagge 1972)', () => {
  it('zero storage → unchanged core temp', () => {
    expect(estimateCoreTemp(37.0, 0, 70)).toBeCloseTo(37.0, 4);
  });

  it('low storage (100 W·min, 70kg): T_core ≈ 37.0246', () => {
    // ΔT = 100×60 / (70×3490) = 0.02457
    expect(estimateCoreTemp(37.0, 100, 70)).toBeCloseTo(37.0246, 3);
  });

  it('moderate storage (500 W·min, 70kg): T_core ≈ 37.1228', () => {
    expect(estimateCoreTemp(37.0, 500, 70)).toBeCloseTo(37.1228, 3);
  });

  it('high storage (1500 W·min, 70kg): T_core ≈ 37.3684', () => {
    expect(estimateCoreTemp(37.0, 1500, 70)).toBeCloseTo(37.3684, 3);
  });

  it('extreme storage clamps to 39.5°C ceiling', () => {
    expect(estimateCoreTemp(37.0, 50000, 70)).toBe(39.5);
  });

  it('negative storage cooling: T_core decreases', () => {
    expect(estimateCoreTemp(37.0, -1000, 70)).toBeCloseTo(36.7544, 3);
  });

  it('extreme cooling clamps to 34.0°C floor', () => {
    expect(estimateCoreTemp(37.0, -50000, 70)).toBe(34.0);
  });
});
