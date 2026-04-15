// Tests for env_loss.ts — convective and radiative heat loss.
// Hand-computed reference values; physics-based assertions.

import { describe, it, expect } from 'vitest';
import {
  computeConvectiveHeatLoss,
  computeRadiativeHeatLoss,
} from '../../src/heat_balance/env_loss.js';

describe('computeConvectiveHeatLoss (ASHRAE forced convection)', () => {
  it('returns positive heat loss when skin warmer than ambient', () => {
    // T_skin = 33, T_amb = 10
    const q = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 1.0);
    expect(q).toBeGreaterThan(0);
  });

  it('returns negative heat loss (gain) when ambient warmer than skin', () => {
    const q = computeConvectiveHeatLoss(33, 40, 0.155, 1.85, 1.0);
    expect(q).toBeLessThan(0);
  });

  it('returns 0 when skin temp equals ambient', () => {
    expect(computeConvectiveHeatLoss(20, 20, 0.155, 1.85, 1.0)).toBe(0);
  });

  it('higher wind → more heat loss (cold conditions)', () => {
    const calm = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 0.5);
    const windy = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 5.0);
    expect(windy).toBeGreaterThan(calm);
  });

  it('higher CLO → less heat loss', () => {
    const lightClo = computeConvectiveHeatLoss(33, 10, 0.05, 1.85, 1.0);
    const heavyClo = computeConvectiveHeatLoss(33, 10, 0.5, 1.85, 1.0);
    expect(heavyClo).toBeLessThan(lightClo);
  });

  it('activity speed adds to wind for effective convection', () => {
    const ambient = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 1.0, 0);
    const moving = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 1.0, 5);
    expect(moving).toBeGreaterThan(ambient);
  });

  it('returns 0 for degenerate input (negative resistances)', () => {
    expect(computeConvectiveHeatLoss(33, 10, -0.5, 1.85, 1.0)).toBe(0);
  });

  it('respects natural convection floor (wind < 0.5 → uses 0.5)', () => {
    const zero = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 0);
    const min = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 0.5);
    expect(zero).toBeCloseTo(min, 4);
  });
});

describe('computeRadiativeHeatLoss (Stefan-Boltzmann)', () => {
  it('returns positive heat loss when surface warmer than ambient', () => {
    // T_surf = 20°C, T_amb = 0°C
    const q = computeRadiativeHeatLoss(20, 0, 1.85);
    expect(q).toBeGreaterThan(0);
  });

  it('returns negative heat loss (gain) when ambient warmer', () => {
    const q = computeRadiativeHeatLoss(15, 35, 1.85);
    expect(q).toBeLessThan(0);
  });

  it('returns 0 when surfaces at same temperature', () => {
    expect(computeRadiativeHeatLoss(20, 20, 1.85)).toBe(0);
  });

  it('hand-computed: T_surf=20°C, T_amb=0°C, BSA=2.0 → ~190 W', () => {
    // ε × σ × BSA × (T_s⁴ - T_a⁴)
    // = 0.95 × 5.67e-8 × 2.0 × (293.15⁴ - 273.15⁴)
    // T_s⁴ = 7385000730; T_a⁴ = 5567929590; diff = 1817071140
    // 0.95 × 5.67e-8 × 2.0 × 1.817e9 ≈ 195.7 W
    expect(computeRadiativeHeatLoss(20, 0, 2.0)).toBeCloseTo(195.7, 0);
  });

  it('scales linearly with BSA', () => {
    const small = computeRadiativeHeatLoss(20, 0, 1.5);
    const large = computeRadiativeHeatLoss(20, 0, 3.0);
    expect(large / small).toBeCloseTo(2.0, 4);
  });

  it('non-linear scaling with temperature (Stefan-Boltzmann ⁴ power)', () => {
    // Doubling delta T should more than quadruple heat loss
    const small = computeRadiativeHeatLoss(20, 10, 1.85);
    const large = computeRadiativeHeatLoss(30, 10, 1.85);
    expect(large / small).toBeGreaterThan(2.0); // not linear scaling
  });
});
