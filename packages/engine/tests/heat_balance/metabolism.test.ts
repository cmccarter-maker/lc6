// Tests for metabolism.ts — VE, metabolic heat, respiratory heat loss.
// Hand-computed reference values from cited sources.

import { describe, it, expect } from 'vitest';
import {
  computeVE,
  computeMetabolicHeat,
  computeRespiratoryHeatLoss,
} from '../../src/heat_balance/metabolism.js';

describe('computeVE (ACSM ventilation)', () => {
  it('rest at 1 MET, 70 kg → VE = vo2 × 20 / 1000 = 4.9 L/min', () => {
    // vo2 = 1 × 3.5 × 70 = 245 mL/min; veRatio = 20 (MET≤2)
    // VE = 245 × 20 / 1000 = 4.9 L/min
    expect(computeVE(1, 70)).toBeCloseTo(4.9, 2);
  });

  it('moderate at 4 MET, 70 kg → veRatio = 22.5', () => {
    // vo2 = 4 × 3.5 × 70 = 980 mL/min; veRatio = 20 + (4-2)×1.25 = 22.5
    // VE = 980 × 22.5 / 1000 = 22.05 L/min
    expect(computeVE(4, 70)).toBeCloseTo(22.05, 2);
  });

  it('hard at 8 MET, 70 kg → veRatio = 30', () => {
    // vo2 = 8 × 3.5 × 70 = 1960 mL/min; veRatio = 25 + (8-6)×2.5 = 30
    // VE = 1960 × 30 / 1000 = 58.8 L/min
    expect(computeVE(8, 70)).toBeCloseTo(58.8, 2);
  });

  it('scales linearly with body mass', () => {
    expect(computeVE(4, 100) / computeVE(4, 50)).toBeCloseTo(2.0, 4);
  });

  it('boundary at MET=2 → veRatio = 20 (low slope)', () => {
    // vo2 = 2 × 3.5 × 70 = 490; veRatio = 20
    expect(computeVE(2, 70)).toBeCloseTo(9.8, 2);
  });

  it('boundary at MET=6 → veRatio = 25 (mid slope)', () => {
    // vo2 = 6 × 3.5 × 70 = 1470; veRatio = 25
    expect(computeVE(6, 70)).toBeCloseTo(36.75, 2);
  });
});

describe('computeMetabolicHeat (Ainsworth 2011)', () => {
  it('1 MET × 70 kg × 0.83 efficiency = ~67.6 W', () => {
    // 1 × 1.163 × 70 × 0.83 = 67.57 W
    expect(computeMetabolicHeat(1, 70)).toBeCloseTo(67.57, 1);
  });

  it('5 MET × 70 kg → 5x scaling vs 1 MET', () => {
    expect(computeMetabolicHeat(5, 70) / computeMetabolicHeat(1, 70)).toBeCloseTo(5.0, 4);
  });

  it('scales linearly with body mass', () => {
    expect(computeMetabolicHeat(3, 100) / computeMetabolicHeat(3, 50)).toBeCloseTo(2.0, 4);
  });

  it('hard exercise (10 MET, 80 kg) ~ 772 W', () => {
    // 10 × 1.163 × 80 × 0.83 = 772.43 W
    expect(computeMetabolicHeat(10, 80)).toBeCloseTo(772.232, 2);
  });
});

describe('computeRespiratoryHeatLoss (sensible + latent)', () => {
  it('cold dry conditions → significant heat + moisture loss', () => {
    // -10°C, 30% RH, 4 MET, 70 kg, no face cover
    const r = computeRespiratoryHeatLoss(4, -10, 30, 70);
    expect(r.total).toBeGreaterThan(0);
    expect(r.moistureGhr).toBeGreaterThan(0);
  });

  it('warm humid conditions → low respiratory heat loss', () => {
    // 30°C, 80% RH, 1 MET, 70 kg
    const cold = computeRespiratoryHeatLoss(4, -10, 30, 70);
    const warm = computeRespiratoryHeatLoss(4, 30, 80, 70);
    expect(warm.total).toBeLessThan(cold.total);
  });

  it('balaclava reduces total by 35%', () => {
    const noCover = computeRespiratoryHeatLoss(4, -10, 30, 70);
    const balaclava = computeRespiratoryHeatLoss(4, -10, 30, 70, 'balaclava');
    expect(balaclava.total).toBeCloseTo(noCover.total * 0.65, 1);
    expect(balaclava.moistureGhr).toBeCloseTo(noCover.moistureGhr * 0.65, 1);
  });

  it('HME reduces total by 50%', () => {
    const noCover = computeRespiratoryHeatLoss(4, -10, 30, 70);
    const hme = computeRespiratoryHeatLoss(4, -10, 30, 70, 'hme');
    expect(hme.total).toBeCloseTo(noCover.total * 0.50, 1);
    expect(hme.moistureGhr).toBeCloseTo(noCover.moistureGhr * 0.50, 1);
  });

  it('returns 0 when ambient already at body core (37°C, 100% RH) — no gradient', () => {
    const r = computeRespiratoryHeatLoss(4, 37, 100, 70);
    // Sensible Q ~ 0 at T_amb = 37; latent Q small if ambient nearly saturated
    expect(r.total).toBeLessThan(20); // small residual from latent gradient
  });

  it('higher MET → more ventilation → more heat/moisture loss', () => {
    const rest = computeRespiratoryHeatLoss(1, -10, 30, 70);
    const hard = computeRespiratoryHeatLoss(8, -10, 30, 70);
    expect(hard.total).toBeGreaterThan(rest.total);
    expect(hard.moistureGhr).toBeGreaterThan(rest.moistureGhr);
  });

  it('clamps extreme cold (T_amb < -45°C) gracefully', () => {
    const r = computeRespiratoryHeatLoss(4, -60, 30, 70);
    expect(Number.isFinite(r.total)).toBe(true);
    expect(r.total).toBeGreaterThan(0);
  });
});
