// Tests for ensemble_im.ts — calcEnsembleIm + ENSEMBLE_IM_MAP.
// Lock-in baseline values captured from LC5 verbatim source on 2026-04-15.
// Any future drift from these values fails the tests, catching engine drift.

import { describe, it, expect } from 'vitest';
import {
  calcEnsembleIm,
  ENSEMBLE_IM_MAP,
  ENSEMBLE_LAYER_NAMES,
  ENSEMBLE_LAYER_KEYS,
} from '../../src/ensemble/ensemble_im.js';

describe('ENSEMBLE_IM_MAP (PHY-025R baseline values)', () => {
  it('has all 4 layer keys', () => {
    expect(Object.keys(ENSEMBLE_IM_MAP)).toEqual(['base', 'mid', 'insulative', 'shell']);
  });

  it('has all 4 tiers per layer', () => {
    for (const key of ENSEMBLE_LAYER_KEYS) {
      const layer = ENSEMBLE_IM_MAP[key]!;
      expect(Object.keys(layer)).toEqual(['typical', 'good', 'better', 'best']);
    }
  });

  it('locks in shell typical = 0.14 (most restrictive baseline)', () => {
    expect(ENSEMBLE_IM_MAP.shell!.typical).toBe(0.14);
  });

  it('locks in base best = 0.65 (most permeable baseline)', () => {
    expect(ENSEMBLE_IM_MAP.base!.best).toBe(0.65);
  });

  it('values monotonically increase: typical < good < better < best for each layer', () => {
    for (const key of ENSEMBLE_LAYER_KEYS) {
      const l = ENSEMBLE_IM_MAP[key]!;
      expect(l.typical!).toBeLessThan(l.good!);
      expect(l.good!).toBeLessThan(l.better!);
      expect(l.better!).toBeLessThan(l.best!);
    }
  });
});

describe('calcEnsembleIm — empty/single layer cases', () => {
  it('empty input → ensembleIm 0, hasGear false', () => {
    const r = calcEnsembleIm([]);
    expect(r.ensembleIm).toBe(0);
    expect(r.hasGear).toBe(false);
    expect(r.bottleneck).toBe(null);
    expect(r.layers).toEqual([]);
  });

  it('all empty strings → ensembleIm 0', () => {
    const r = calcEnsembleIm(['', '', '', '']);
    expect(r.ensembleIm).toBe(0);
    expect(r.hasGear).toBe(false);
  });

  it('single shell layer → returns single layer im as ensemble', () => {
    const r = calcEnsembleIm(['', '', '', 'good']);
    expect(r.ensembleIm).toBe(0.15);
    expect(r.hasGear).toBe(true);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckPct).toBe(100);
    expect(r.layers.length).toBe(1);
  });

  it('unknown tier → skipped silently', () => {
    const r = calcEnsembleIm(['unknown_tier' as any, '', '', '']);
    expect(r.hasGear).toBe(false);
  });
});

describe('calcEnsembleIm — multi-layer harmonic mean (LC5 lock-in)', () => {
  it('base+shell typical → ensembleIm ≈ 0.179487', () => {
    const r = calcEnsembleIm(['typical', '', '', 'typical']);
    expect(r.ensembleIm).toBeCloseTo(0.179487, 5);
    expect(r.hasGear).toBe(true);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.bottleneckPct).toBe(64);
    expect(r.whatIfImprovement).toBe(79);
    expect(r.upgEnsembleIm).toBeCloseTo(0.321429, 5);
  });

  it('base+mid+shell typical → ensembleIm ≈ 0.191225', () => {
    const r = calcEnsembleIm(['typical', 'typical', '', 'typical']);
    expect(r.ensembleIm).toBeCloseTo(0.191225, 5);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.bottleneckPct).toBe(46);
    expect(r.whatIfImprovement).toBe(46);
  });

  it('full 4-layer all good → ensembleIm ≈ 0.210526', () => {
    const r = calcEnsembleIm(['good', 'good', 'good', 'good']);
    expect(r.ensembleIm).toBeCloseTo(0.210526, 5);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.15);
    expect(r.bottleneckPct).toBe(35);
    expect(r.whatIfImprovement).toBe(31);
  });

  it('full 4-layer all best → ensembleIm ≈ 0.527783, no improvement available', () => {
    const r = calcEnsembleIm(['best', 'best', 'best', 'best']);
    expect(r.ensembleIm).toBeCloseTo(0.527783, 5);
    expect(r.bottleneck).toBe('Shell / Outer');  // shell is still lowest at best=0.45
    expect(r.bottleneckIm).toBe(0.45);
    expect(r.whatIfImprovement).toBe(0);
  });

  it('mixed: best base, typical others → ensembleIm ≈ 0.212966', () => {
    const r = calcEnsembleIm(['best', 'typical', 'typical', 'typical']);
    expect(r.ensembleIm).toBeCloseTo(0.212966, 5);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.whatIfImprovement).toBe(35);
  });

  it('shell weak link → identifies shell as bottleneck despite better other layers', () => {
    const r = calcEnsembleIm(['better', 'better', 'better', 'typical']);
    expect(r.ensembleIm).toBeCloseTo(0.288495, 5);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.bottleneckPct).toBe(52);
    expect(r.whatIfImprovement).toBe(55);
  });
});

describe('calcEnsembleIm — bottleneck identification', () => {
  it('correctly identifies bottleneck as the layer with lowest im', () => {
    // Setup: base good (0.30), mid better (0.45), insulative best (0.50), shell typical (0.14)
    const r = calcEnsembleIm(['good', 'better', 'best', 'typical']);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.bottleneckIdx).toBe(3);
    expect(r.bottleneckTier).toBe('typical');
  });

  it('what-if upgrade replaces bottleneck with best tier', () => {
    const r = calcEnsembleIm(['better', 'better', 'better', 'typical']);
    expect(r.upgEnsembleIm).toBeCloseTo(0.447205, 5);
    expect(r.upgEnsembleIm! > r.ensembleIm).toBe(true);
  });
});
