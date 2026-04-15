// Tests for activities/split_body.ts — wader/snow sport split-body models.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import {
  WADER_DATA,
  SNOW_SPORT_ZONES,
  waderSplitIm,
  waderSplitCLO,
  snowSportSplitIm,
} from '../../src/activities/split_body.js';

describe('WADER_DATA (PHY-052 baseline values)', () => {
  it('contains all 10 wader types', () => {
    expect(Object.keys(WADER_DATA).length).toBe(10);
    expect(WADER_DATA.none).toBeDefined();
    expect(WADER_DATA.neoprene_5mm).toBeDefined();
    expect(WADER_DATA.breathable).toBeDefined();
  });

  it('locks in neoprene_5mm: im=0, clo=1.50', () => {
    expect(WADER_DATA.neoprene_5mm!.im).toBe(0.00);
    expect(WADER_DATA.neoprene_5mm!.clo).toBe(1.50);
  });

  it('locks in breathable: im=0.15, clo=0.15', () => {
    expect(WADER_DATA.breathable!.im).toBe(0.15);
    expect(WADER_DATA.breathable!.clo).toBe(0.15);
  });

  it('locks in none: im=0, clo=0', () => {
    expect(WADER_DATA.none!.im).toBe(0.00);
    expect(WADER_DATA.none!.clo).toBe(0.00);
  });

  it('all entries have label string', () => {
    for (const key of Object.keys(WADER_DATA)) {
      expect(typeof WADER_DATA[key]!.label).toBe('string');
      expect(WADER_DATA[key]!.label.length).toBeGreaterThan(0);
    }
  });
});

describe('SNOW_SPORT_ZONES (PHY-065 baseline)', () => {
  it('zone fractions sum to 1.00', () => {
    const sum = SNOW_SPORT_ZONES.layeringSystem!.frac +
                SNOW_SPORT_ZONES.hands!.frac +
                SNOW_SPORT_ZONES.head!.frac +
                SNOW_SPORT_ZONES.feet!.frac +
                SNOW_SPORT_ZONES.calves!.frac +
                SNOW_SPORT_ZONES.face!.frac;
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('layering system covers 80% (trunk + arms + upper legs)', () => {
    expect(SNOW_SPORT_ZONES.layeringSystem!.frac).toBe(0.80);
    expect(SNOW_SPORT_ZONES.layeringSystem!.usesEnsemble).toBe(true);
  });

  it('hands im=0.05, head im=0.03, feet im=0.02', () => {
    expect(SNOW_SPORT_ZONES.hands!.im).toBe(0.05);
    expect(SNOW_SPORT_ZONES.head!.im).toBe(0.03);
    expect(SNOW_SPORT_ZONES.feet!.im).toBe(0.02);
  });
});

describe('waderSplitIm (PHY-052)', () => {
  it('no wader → returns ensembleIm unchanged', () => {
    expect(waderSplitIm(0.20, undefined)).toBe(0.20);
    expect(waderSplitIm(0.20, null)).toBe(0.20);
    expect(waderSplitIm(0.20, '')).toBe(0.20);
  });

  it("'none' wader → returns ensembleIm unchanged", () => {
    expect(waderSplitIm(0.20, 'none')).toBe(0.20);
  });

  it('unknown wader → returns ensembleIm unchanged', () => {
    expect(waderSplitIm(0.20, 'fake_wader_type')).toBe(0.20);
  });

  it('neoprene_5mm + ensembleIm=0.20 → 0.45×0.20 + 0.55×0 = 0.09', () => {
    expect(waderSplitIm(0.20, 'neoprene_5mm')).toBeCloseTo(0.09, 4);
  });

  it('breathable + ensembleIm=0.20 → 0.45×0.20 + 0.55×0.15 = 0.1725', () => {
    expect(waderSplitIm(0.20, 'breathable')).toBeCloseTo(0.1725, 4);
  });

  it('null ensembleIm with wader → uses BASELINE_IM (0.089)', () => {
    // 0.45 × 0.089 + 0.55 × 0 = 0.04005
    expect(waderSplitIm(null, 'neoprene_5mm')).toBeCloseTo(0.04005, 4);
  });
});

describe('waderSplitCLO (PHY-052)', () => {
  it('no wader → returns upperCLO unchanged', () => {
    expect(waderSplitCLO(1.5, undefined)).toBe(1.5);
    expect(waderSplitCLO(1.5, 'none')).toBe(1.5);
  });

  it('neoprene_5mm + upper=1.5 → 0.45×1.5 + 0.55×1.5 = 1.5', () => {
    expect(waderSplitCLO(1.5, 'neoprene_5mm')).toBeCloseTo(1.5, 4);
  });

  it('breathable + upper=1.5 → 0.45×1.5 + 0.55×0.15 = 0.7575', () => {
    expect(waderSplitCLO(1.5, 'breathable')).toBeCloseTo(0.7575, 4);
  });
});

describe('snowSportSplitIm (PHY-065)', () => {
  it('ensembleIm=0.089 (baseline) → 0.0766 (locked-in baseline)', () => {
    expect(snowSportSplitIm(0.089)).toBeCloseTo(0.0766, 4);
  });

  it('ensembleIm=0.15 → 0.1254', () => {
    expect(snowSportSplitIm(0.15)).toBeCloseTo(0.1254, 4);
  });

  it('ensembleIm=0.30 → 0.2454', () => {
    expect(snowSportSplitIm(0.30)).toBeCloseTo(0.2454, 4);
  });

  it('ensembleIm=0.50 → 0.4054', () => {
    expect(snowSportSplitIm(0.50)).toBeCloseTo(0.4054, 4);
  });

  it('null ensembleIm → uses BASELINE_IM (0.089) → same as 0.089', () => {
    expect(snowSportSplitIm(null)).toBeCloseTo(0.0766, 4);
  });

  it('higher ensembleIm produces higher splitIm (monotonic)', () => {
    const a = snowSportSplitIm(0.10);
    const b = snowSportSplitIm(0.20);
    const c = snowSportSplitIm(0.40);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
