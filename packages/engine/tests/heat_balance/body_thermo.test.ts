// Tests for body_thermo.ts — tissue insulation, T_skin, iterative solver.
// Hand-computed values for non-iterative functions; lock-in baseline values
// for iterativeTSkin (per Pre-Build Audit observe-then-test discipline).
//
// Lock-in values generated from LC5 risk_functions.js verbatim source on 2026-04-15.
// Any future drift from these values fails the tests, catching engine drift.

import { describe, it, expect } from 'vitest';
import {
  computeTissueCLO,
  computeTSkin,
  iterativeTSkin,
} from '../../src/heat_balance/body_thermo.js';

describe('computeTissueCLO (Rennie 1962)', () => {
  it('returns floor 0.15 at 0% body fat', () => {
    // 0.1 + 0/100 × 2.0 = 0.1 → bounded to 0.15
    expect(computeTissueCLO(0)).toBe(0.15);
  });

  it('returns 0.3 at 10% body fat', () => {
    // 0.1 + 10/100 × 2.0 = 0.3
    expect(computeTissueCLO(10)).toBeCloseTo(0.3, 4);
  });

  it('returns 0.5 at 20% body fat', () => {
    // 0.1 + 20/100 × 2.0 = 0.5
    expect(computeTissueCLO(20)).toBeCloseTo(0.5, 4);
  });

  it('returns ceiling 0.9 at 50% body fat (clamped)', () => {
    // 0.1 + 50/100 × 2.0 = 1.1 → clamped to 0.9
    expect(computeTissueCLO(50)).toBe(0.9);
  });

  it('monotonically increases with body fat (within bounds)', () => {
    const low = computeTissueCLO(15);
    const mid = computeTissueCLO(25);
    const high = computeTissueCLO(35);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });
});

describe('computeTSkin (single-pass heat balance)', () => {
  it('returns mid-temp when tissue/clothing balanced', () => {
    // T_core = 37, T_amb = 17, R_tissue = R_clo+R_air = 0.2 each
    // T_skin = (37×0.2 + 17×0.2) / 0.4 = 27
    expect(computeTSkin(37, 17, 0.2, 0.1, 0.1)).toBeCloseTo(27, 4);
  });

  it('approaches T_core when external resistance dominates', () => {
    // Heavy clothing → R_out >> R_tissue → T_skin ≈ T_core
    const result = computeTSkin(37, -10, 0.05, 0.5, 0.1);
    expect(result).toBeGreaterThan(33); // closer to 37 than to -10
  });

  it('approaches T_amb when tissue resistance dominates', () => {
    // No clothing → R_tissue >> R_out → T_skin ≈ T_amb
    const result = computeTSkin(37, 10, 0.5, 0.01, 0.05);
    expect(result).toBeLessThan(20); // closer to 10 than to 37
  });

  it('returns 33.0 fallback for degenerate input (zero total resistance)', () => {
    expect(computeTSkin(37, 20, 0, 0, 0)).toBe(33.0);
  });

  it('correctly weights by resistance ratio', () => {
    // T_core = 37, T_amb = 0, R_tissue = 0.1, R_out (clo+air) = 0.3
    // T_skin = (37×0.3 + 0×0.1) / 0.4 = 27.75
    expect(computeTSkin(37, 0, 0.1, 0.2, 0.1)).toBeCloseTo(27.75, 4);
  });
});

describe('iterativeTSkin (PHY-056 Gagge two-node solver)', () => {
  // Lock-in baseline values from LC5 verbatim source 2026-04-15.
  // Operating points span cold/cool/warm/hot regimes per Pre-Build Audit table.

  it('cold_rest_heavy_clothing: T_core=37, T_amb=-10, MET=1.5, heavy clothing → T_skin clamped to floor', () => {
    const r = iterativeTSkin(37, -10, 0.075, 0.310, 0.10, 1.85, 1.5, 2.0, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(25.0, 2);     // clamped to min
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(2);
    expect(r.h_tissue).toBeCloseTo(2.28, 2);   // base 5.28 - vcon 3.0
    expect(r.E_req).toBeCloseTo(0, 2);         // no evap demand in cold
    expect(r.E_actual).toBeCloseTo(0, 2);
    expect(r.vasodilation).toBe(0);
  });

  it('cool_walk_moderate: T_amb=10, MET=4 → T_skin ~29.3, vasodilation engaged', () => {
    const r = iterativeTSkin(37, 10, 0.075, 0.232, 0.12, 1.85, 4.0, 2.0, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(29.27, 1);
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(2);
    expect(r.h_tissue).toBeCloseTo(19.37, 1);
    expect(r.E_req).toBeCloseTo(176.70, 0);
    expect(r.E_actual).toBeCloseTo(57.64, 0);
    expect(r.vasodilation).toBeCloseTo(15.92, 1);
  });

  it('cool_active_light: T_amb=10, MET=6, light clothing → T_skin ~28.9, high vasodilation', () => {
    const r = iterativeTSkin(37, 10, 0.075, 0.116, 0.10, 1.85, 6.0, 1.0, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(28.91, 1);
    expect(r.converged).toBe(true);
    expect(r.h_tissue).toBeCloseTo(27.62, 1);
    expect(r.E_req).toBeCloseTo(271.08, 0);
    expect(r.E_actual).toBeCloseTo(88.67, 0);
    expect(r.vasodilation).toBeCloseTo(24.42, 1);
  });

  it('warm_rest_light: T_amb=25, MET=1.5, light clothing → does NOT converge in 8 iterations (LC5 baseline behavior)', () => {
    // This case oscillates around equilibrium without converging within tolerance — this is
    // documented LC5 behavior, locked in as expected non-convergence.
    const r = iterativeTSkin(37, 25, 0.075, 0.116, 0.15, 1.85, 1.5, 0.5, 50, 0.089, 22);
    expect(r.converged).toBe(false);
    expect(r.iterations).toBe(8);
    expect(r.T_skin).toBeCloseTo(33.71, 1);
    expect(r.h_tissue).toBeCloseTo(10.32, 1);
    expect(r.E_req).toBeCloseTo(71.92, 0);
    expect(r.E_actual).toBeCloseTo(68.66, 0);
    expect(r.vasodilation).toBeCloseTo(6.48, 1);
  });

  it('warm_exercise_moderate: T_amb=25, MET=6 → T_skin ~31.6, strong vasodilation', () => {
    const r = iterativeTSkin(37, 25, 0.075, 0.116, 0.10, 1.85, 6.0, 1.0, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(31.62, 1);
    expect(r.converged).toBe(true);
    expect(r.h_tissue).toBeCloseTo(44.70, 1);
    expect(r.E_req).toBeCloseTo(445.36, 0);
    expect(r.E_actual).toBeCloseTo(80.95, 0);
    expect(r.vasodilation).toBeCloseTo(40.12, 1);
  });

  it('hot_exercise: T_amb=35, MET=8, hot regime → vasodilation pegged at GAGGE_VDIL_MAX (45)', () => {
    const r = iterativeTSkin(37, 35, 0.075, 0.077, 0.15, 1.85, 8.0, 0.5, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(29.32, 1);
    expect(r.converged).toBe(true);
    expect(r.h_tissue).toBeCloseTo(48.45, 1);
    expect(r.E_req).toBeCloseTo(807.80, 0);
    expect(r.E_actual).toBeCloseTo(43.39, 0);
    expect(r.vasodilation).toBeCloseTo(45.0, 2);  // pegged at max
  });

  it('returns IterativeTSkinResult shape with all fields including vasodilation (Pre-Build Audit Q15 option 1)', () => {
    const r = iterativeTSkin(37, 20, 0.075, 0.2, 0.1, 1.85, 3.0, 1.0, 50, 0.089, 22);
    expect(r).toHaveProperty('T_skin');
    expect(r).toHaveProperty('converged');
    expect(r).toHaveProperty('iterations');
    expect(r).toHaveProperty('h_tissue');
    expect(r).toHaveProperty('E_req');
    expect(r).toHaveProperty('E_actual');
    expect(r).toHaveProperty('vasodilation');
  });

  it('respects custom maxIter and tol parameters', () => {
    // Force fewer iterations to test parameter passing
    const r = iterativeTSkin(37, 25, 0.075, 0.116, 0.15, 1.85, 1.5, 0.5, 50, 0.089, 22, 3, 0.1);
    expect(r.iterations).toBeLessThanOrEqual(3);
  });

  it('T_skin output respects hard bounds [25, 37]', () => {
    // Extreme cold input
    const cold = iterativeTSkin(37, -40, 0.075, 0.05, 0.05, 1.85, 1.0, 5.0, 50, 0.089, 22);
    expect(cold.T_skin).toBeGreaterThanOrEqual(25);
    expect(cold.T_skin).toBeLessThanOrEqual(37);
    // Extreme hot input
    const hot = iterativeTSkin(37, 45, 0.075, 0.05, 0.05, 1.85, 10.0, 0.5, 80, 0.089, 22);
    expect(hot.T_skin).toBeGreaterThanOrEqual(25);
    expect(hot.T_skin).toBeLessThanOrEqual(37);
  });
});
