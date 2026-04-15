// Tests for activities/profiles.ts — phase + sweat + gear score data structures.
// Structural integrity tests; lock-in tests for selected canonical entries.

import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_SWEAT_PROFILES,
  INTERMITTENT_PHASE_PROFILES,
  GENERIC_GEAR_SCORES_BY_SLOT,
} from '../../src/activities/profiles.js';

describe('ACTIVITY_SWEAT_PROFILES', () => {
  it('contains running, hiking, skiing, snowboarding, kayaking', () => {
    expect(ACTIVITY_SWEAT_PROFILES.running).toBeDefined();
    expect(ACTIVITY_SWEAT_PROFILES.hiking).toBeDefined();
    expect(ACTIVITY_SWEAT_PROFILES.skiing).toBeDefined();
    expect(ACTIVITY_SWEAT_PROFILES.snowboarding).toBeDefined();
    expect(ACTIVITY_SWEAT_PROFILES.kayaking).toBeDefined();
  });

  it('all entries have low/moderate/high/very_high + coverageMul + intermittency', () => {
    for (const [activity, profile] of Object.entries(ACTIVITY_SWEAT_PROFILES)) {
      expect(profile.low, `${activity}.low`).toBeGreaterThan(0);
      expect(profile.moderate, `${activity}.moderate`).toBeGreaterThan(profile.low);
      expect(profile.high, `${activity}.high`).toBeGreaterThan(profile.moderate);
      expect(profile.very_high, `${activity}.very_high`).toBeGreaterThan(profile.high);
      expect(profile.coverageMul, `${activity}.coverageMul`).toBeGreaterThan(0);
      expect(profile.intermittency, `${activity}.intermittency`).toBeGreaterThan(0);
      expect(profile.intermittency, `${activity}.intermittency`).toBeLessThanOrEqual(1.0);
    }
  });

  it('locks in running: low=250 mod=600 high=1000 vh=1400', () => {
    expect(ACTIVITY_SWEAT_PROFILES.running!.low).toBe(250);
    expect(ACTIVITY_SWEAT_PROFILES.running!.moderate).toBe(600);
    expect(ACTIVITY_SWEAT_PROFILES.running!.high).toBe(1000);
    expect(ACTIVITY_SWEAT_PROFILES.running!.very_high).toBe(1400);
  });

  it('locks in cross_country_ski: coverageMul=1.40, intermittency=0.80 (MFC #2 validated)', () => {
    expect(ACTIVITY_SWEAT_PROFILES.cross_country_ski!.coverageMul).toBe(1.40);
    expect(ACTIVITY_SWEAT_PROFILES.cross_country_ski!.intermittency).toBe(0.80);
  });

  it('locks in skiing/snowboarding identical sweat values (PHY-030 unified)', () => {
    expect(ACTIVITY_SWEAT_PROFILES.skiing!.low).toBe(ACTIVITY_SWEAT_PROFILES.snowboarding!.low);
    expect(ACTIVITY_SWEAT_PROFILES.skiing!.moderate).toBe(ACTIVITY_SWEAT_PROFILES.snowboarding!.moderate);
    expect(ACTIVITY_SWEAT_PROFILES.skiing!.high).toBe(ACTIVITY_SWEAT_PROFILES.snowboarding!.high);
    expect(ACTIVITY_SWEAT_PROFILES.skiing!.coverageMul).toBe(ACTIVITY_SWEAT_PROFILES.snowboarding!.coverageMul);
  });
});

describe('INTERMITTENT_PHASE_PROFILES', () => {
  it('contains all expected ski terrain profiles', () => {
    expect(INTERMITTENT_PHASE_PROFILES.groomers).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.moguls).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.trees).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.bowls).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.park).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.skiing_bc).toBeDefined();
  });

  it('contains all golf, fishing, kayaking, SUP variants', () => {
    expect(INTERMITTENT_PHASE_PROFILES.golf_walk).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.golf_cart).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.fishing_shore).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.fishing_wading).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.kayaking_creek).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.kayaking_lake).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.kayaking_ocean).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.sup_lake).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.sup_ocean).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.sup_creek).toBeDefined();
  });

  it('contains cycling profiles (flat + hilly for road and gravel)', () => {
    expect(INTERMITTENT_PHASE_PROFILES.cycling_road_flat).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.cycling_road_hilly).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.cycling_gravel_flat).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.cycling_gravel_hilly).toBeDefined();
  });

  it('contains linear-type profiles: skiing_bc, xc_ski, snowshoeing', () => {
    expect(INTERMITTENT_PHASE_PROFILES.skiing_bc!.type).toBe('linear');
    expect(INTERMITTENT_PHASE_PROFILES.xc_ski!.type).toBe('linear');
    expect(INTERMITTENT_PHASE_PROFILES.snowshoeing!.type).toBe('linear');
  });

  it('cyclic profiles have phases with durMin (not pct)', () => {
    const groomers = INTERMITTENT_PHASE_PROFILES.groomers!;
    expect(groomers.type).toBe('cyclic');
    for (const phase of groomers.phases) {
      expect(phase.durMin).toBeDefined();
      expect(phase.pct).toBeUndefined();
    }
  });

  it('linear profiles have phases with pct (not durMin)', () => {
    const xc = INTERMITTENT_PHASE_PROFILES.xc_ski!;
    expect(xc.type).toBe('linear');
    for (const phase of xc.phases) {
      expect(phase.pct).toBeDefined();
      expect(phase.durMin).toBeUndefined();
    }
  });

  it('linear profile pct values sum to 1.0', () => {
    for (const [key, profile] of Object.entries(INTERMITTENT_PHASE_PROFILES)) {
      if (profile.type === 'linear') {
        const pctSum = profile.phases.reduce((s, p) => s + (p.pct ?? 0), 0);
        expect(pctSum, `${key} pct sum`).toBeCloseTo(1.0, 4);
      }
    }
  });

  it('locks in groomers: 3 min run + 7 min lift', () => {
    const g = INTERMITTENT_PHASE_PROFILES.groomers!;
    expect(g.phases[0]!.durMin).toBe(3);
    expect(g.phases[0]!.intensity).toBe('moderate');
    expect(g.phases[1]!.durMin).toBe(7);
    expect(g.phases[1]!.intensity).toBe('low');
  });

  it('locks in golf_walk: 4 min walk_swing + 11 min wait (~4 holes/hr)', () => {
    const g = INTERMITTENT_PHASE_PROFILES.golf_walk!;
    expect(g.type).toBe('cyclic');
    expect(g.phases[0]!.name).toBe('walk_swing');
    expect(g.phases[0]!.durMin).toBe(4);
    expect(g.phases[1]!.name).toBe('wait');
    expect(g.phases[1]!.durMin).toBe(11);
  });

  it('locks in cycling_road_flat: 51 min ride + 9 min stop (15% stop fraction)', () => {
    const c = INTERMITTENT_PHASE_PROFILES.cycling_road_flat!;
    expect(c.phases[0]!.durMin).toBe(51);
    expect(c.phases[1]!.durMin).toBe(9);
  });

  it('locks in skiing_bc linear: skinning 55%, transition 5%, descent 40%', () => {
    const bc = INTERMITTENT_PHASE_PROFILES.skiing_bc!;
    expect(bc.type).toBe('linear');
    expect(bc.phases[0]!.pct).toBe(0.55);
    expect(bc.phases[1]!.pct).toBe(0.05);
    expect(bc.phases[2]!.pct).toBe(0.40);
  });
});

describe('GENERIC_GEAR_SCORES_BY_SLOT (PHY-025)', () => {
  it('contains all 8 gear slots', () => {
    expect(GENERIC_GEAR_SCORES_BY_SLOT.base).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.mid).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.insulative).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.shell).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.legs).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.legsBase).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.feet).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.head).toBeDefined();
  });

  it('locks in shell.windResist=8 (key field used by Session 9b/9c)', () => {
    expect(GENERIC_GEAR_SCORES_BY_SLOT.shell!.windResist).toBe(8);
  });

  it('all entries have all 5 score fields', () => {
    for (const [slot, scores] of Object.entries(GENERIC_GEAR_SCORES_BY_SLOT)) {
      expect(scores.breathability, `${slot}.breathability`).toBeGreaterThanOrEqual(0);
      expect(scores.moisture, `${slot}.moisture`).toBeGreaterThanOrEqual(0);
      expect(scores.windResist, `${slot}.windResist`).toBeGreaterThanOrEqual(0);
      expect(scores.warmthRatio, `${slot}.warmthRatio`).toBeGreaterThanOrEqual(0);
      expect(scores.waterproof, `${slot}.waterproof`).toBeGreaterThanOrEqual(0);
    }
  });
});
