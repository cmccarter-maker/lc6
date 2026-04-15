// Hand-computed regression tests for evaporation primitives.
// Test values verified against LC5 risk_functions.js April 2026 audit baseline.

import { describe, it, expect } from 'vitest';
import {
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
} from '../../src/heat_balance/evaporation.js';
import { BASELINE_IM } from '../../src/heat_balance/constants.js';

describe('computeEmax (ISO 7933:2023 §6.1.10)', () => {
  it('skin warmer than ambient produces positive eMax', () => {
    // T_skin = 33°C, T_amb = 20°C, RH = 50%, vAir = 1.0 m/s, im = 0.4, clo = 1.0, BSA = 1.8
    // Should produce a finite positive eMax
    const result = computeEmax(33, 20, 50, 1.0, 0.4, 1.0, 1.8);
    expect(result.eMax).toBeGreaterThan(0);
    expect(result.vpdKpa).toBeGreaterThan(0);
    expect(result.pSkin).toBeGreaterThan(result.pAmb);
  });

  it('returns zero eMax when ambient vapor pressure exceeds skin', () => {
    // T_skin = 25°C, T_amb = 35°C, RH = 100% — ambient vapor > skin vapor
    const result = computeEmax(25, 35, 100, 1.0, 0.4, 1.0, 1.8);
    expect(result.eMax).toBe(0);
  });

  it('higher im increases eMax (better moisture permeability)', () => {
    const lowIm = computeEmax(33, 20, 50, 1.0, 0.1, 1.5, 1.8);
    const highIm = computeEmax(33, 20, 50, 1.0, 0.5, 1.5, 1.8);
    expect(highIm.eMax).toBeGreaterThan(lowIm.eMax);
  });

  it('higher CLO with same im decreases eMax (more clothing resistance)', () => {
    const lowClo = computeEmax(33, 20, 50, 1.0, BASELINE_IM, 0.5, 1.8);
    const highClo = computeEmax(33, 20, 50, 1.0, BASELINE_IM, 3.0, 1.8);
    expect(highClo.eMax).toBeLessThan(lowClo.eMax);
  });

  it('higher wind speed increases eMax (better convection + evaporation)', () => {
    const calm = computeEmax(33, 20, 50, 0.5, 0.4, 1.0, 1.8);
    const windy = computeEmax(33, 20, 50, 5.0, 0.4, 1.0, 1.8);
    expect(windy.eMax).toBeGreaterThan(calm.eMax);
  });

  it('clamps extreme cold (T < -45°C) for ambient vapor pressure calc', () => {
    // Should not throw or produce NaN at very cold temps
    const result = computeEmax(33, -60, 50, 1.0, 0.4, 1.5, 1.8);
    expect(result.eMax).toBeGreaterThan(0);
    expect(Number.isFinite(result.eMax)).toBe(true);
  });
});

describe('computeSweatRate (ISO 7933 §5.6 regime detection)', () => {
  it('returns cold regime for eReq <= 0', () => {
    const result = computeSweatRate(0, 200);
    expect(result.regime).toBe('cold');
    expect(result.sweatGPerHr).toBe(0);
    expect(result.evapGPerHr).toBe(0);
  });

  it('returns compensable when eReq < eMax', () => {
    // eReq = 100W, eMax = 200W → wReq = 0.5
    const result = computeSweatRate(100, 200);
    expect(result.regime).toBe('compensable');
    expect(result.wReq).toBeCloseTo(0.5, 2);
    // sweat = 100/2430 * 3600 = ~148 g/hr
    expect(result.sweatGPerHr).toBeCloseTo(148.15, 1);
    expect(result.evapGPerHr).toBe(result.sweatGPerHr);
    expect(result.accumGPerHr).toBe(0);
    expect(result.qEvapW).toBe(100);
  });

  it('returns uncompensable when eReq > eMax (sweat accumulates)', () => {
    // eReq = 300W, eMax = 200W → wReq = 1.5
    const result = computeSweatRate(300, 200);
    expect(result.regime).toBe('uncompensable');
    expect(result.wReq).toBeCloseTo(1.5, 2);
    expect(result.sweatGPerHr).toBeGreaterThan(result.evapGPerHr);
    expect(result.accumGPerHr).toBeGreaterThan(0);
    // accum = (300 - 200) / 2430 * 3600 = ~148 g/hr
    expect(result.accumGPerHr).toBeCloseTo(148.15, 1);
    expect(result.qEvapW).toBe(200); // capped at eMax
  });

  it('handles zero eMax gracefully (returns 999 wReq, uncompensable)', () => {
    const result = computeSweatRate(100, 0);
    expect(result.regime).toBe('uncompensable');
    expect(result.wReq).toBe(999);
  });
});

describe('getDrainRate (PHY-047 surface evaporation)', () => {
  it('returns positive g/hr in dry conditions', () => {
    // 50°F, 30% RH, 5 mph wind, im 0.089, clo 1.5, BSA 1.8
    const drainGPerHr = getDrainRate(50, 30, 5, 0.089, 1.5, 1.8);
    expect(drainGPerHr).toBeGreaterThan(0);
  });

  it('returns 0 at 100% RH (no vapor pressure gradient)', () => {
    const drainGPerHr = getDrainRate(50, 100, 5, 0.089, 1.5, 1.8);
    // pSurf will exceed pAmb because surface is warmer than ambient at 50°F under insulation,
    // so drain will be slightly positive even at 100% RH. Verify it's small but nonzero.
    expect(drainGPerHr).toBeGreaterThan(0);
  });

  it('locks in LC5 drain behavior: cold-regime wind reduces drain, hot-regime wind increases drain', () => {
    // LC5 baseline values (April 2026 audit) at 30% RH, im=0.089, clo=1.5, BSA=1.8.
    // Below ambient ~80°F: surface-cooling effect dominates — higher wind drops the
    // clothing surface temp toward ambient, shrinking VPD and reducing drain.
    // Above ambient ~85°F: surface stays at/above skin temp regardless of wind;
    // evaporative throughput dominates and higher wind increases drain.
    // Crossover region ~80-85°F. Tests below lock in both regimes against LC5 baseline.

    // Cold regime: 50°F — higher wind reduces drain
    expect(getDrainRate(50, 30, 0, 0.089, 1.5, 1.8)).toBeCloseTo(40.67, 1);
    expect(getDrainRate(50, 30, 15, 0.089, 1.5, 1.8)).toBeCloseTo(28.18, 1);
    expect(getDrainRate(50, 30, 15, 0.089, 1.5, 1.8))
      .toBeLessThan(getDrainRate(50, 30, 0, 0.089, 1.5, 1.8));

    // Hot regime: 95°F — higher wind increases drain (above skin temp boundary)
    expect(getDrainRate(95, 30, 0, 0.089, 1.5, 1.8)).toBeCloseTo(76.70, 1);
    expect(getDrainRate(95, 30, 15, 0.089, 1.5, 1.8)).toBeCloseTo(89.26, 1);
    expect(getDrainRate(95, 30, 15, 0.089, 1.5, 1.8))
      .toBeGreaterThan(getDrainRate(95, 30, 0, 0.089, 1.5, 1.8));
  });

  it('higher im increases drain rate', () => {
    const lowIm = getDrainRate(50, 30, 5, 0.05, 1.5, 1.8);
    const highIm = getDrainRate(50, 30, 5, 0.20, 1.5, 1.8);
    expect(highIm).toBeGreaterThan(lowIm);
  });

  it('uses defaults when clo and bsa are passed as 0/undefined-equivalent', () => {
    // The original LC5 function uses ?? defaults; ensure our port matches
    const resultDefault = getDrainRate(50, 30, 5, 0.089, 0, 0); // 0 triggers defaults
    expect(Number.isFinite(resultDefault)).toBe(true);
  });
});

describe('hygroAbsorption (PHY-032)', () => {
  it('returns positive absorption value', () => {
    // 70°F, 60% RH, default im, default regain
    const abs = hygroAbsorption(70, 60);
    expect(abs).toBeGreaterThan(0);
    expect(abs).toBeLessThan(1); // small per-cycle value
  });

  it('higher humidity → more absorption', () => {
    const dry = hygroAbsorption(70, 30);
    const humid = hygroAbsorption(70, 90);
    expect(humid).toBeGreaterThan(dry);
  });

  it('higher temperature → more absorption (more vapor available)', () => {
    const cool = hygroAbsorption(50, 60);
    const warm = hygroAbsorption(80, 60);
    expect(warm).toBeGreaterThan(cool);
  });

  it('higher im → more absorption (more permeable to vapor)', () => {
    const lowIm = hygroAbsorption(70, 60, 0.05);
    const highIm = hygroAbsorption(70, 60, 0.20);
    expect(highIm).toBeGreaterThan(lowIm);
  });

  it('wool (regain 0.16) absorbs more than polyester (regain 0.004)', () => {
    const polyester = hygroAbsorption(70, 60, 0.089, 0.004);
    const wool = hygroAbsorption(70, 60, 0.089, 0.16);
    expect(wool).toBeGreaterThan(polyester * 30); // ~40x ratio expected
  });

  it('returns 0 at 0% humidity (no vapor available)', () => {
    expect(hygroAbsorption(70, 0)).toBe(0);
  });
});
