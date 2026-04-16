// Block 3 validation: computeActivityIREQ across the activity × temp envelope.
// Verifies:
// 1. Every activity resolves to a MET value (no undefined)
// 2. IREQ increases monotonically as temperature drops (physics sanity)
// 3. Higher MET activities need less insulation (physics: more heat production)
// 4. Water-primary activities return excluded
// 5. Ski terrain overrides produce expected MET values
// 6. Spot-check: skiing at -10°C produces IREQ_min in plausible range (~2 clo)

import { describe, it, expect } from 'vitest';
import { computeActivityIREQ, ACTIVITY_MET, resolveActivityMet } from '../../src/ireq/index.js';
import type { ActivityIREQResult } from '../../src/ireq/index.js';

const RH = 50, va = 3;

describe('resolveActivityMet — coverage', () => {
  const ALL_ACTIVITIES = Object.keys(ACTIVITY_MET);

  it('every ACTIVITY_MET key resolves to non-null', () => {
    for (const act of ALL_ACTIVITIES) {
      const met = resolveActivityMet(act);
      expect(met).not.toBeNull();
      expect(met!.M).toBeGreaterThan(0);
    }
  });

  it('water-primary activities return null', () => {
    expect(resolveActivityMet('kayaking')).toBeNull();
    expect(resolveActivityMet('paddle_boarding')).toBeNull();
    expect(resolveActivityMet('fishing_wading')).toBeNull();
  });

  it('hunting defaults to stand hunting', () => {
    const met = resolveActivityMet('hunting');
    expect(met!.M).toBe(146);
  });

  it('ski terrain override works', () => {
    const groomers = resolveActivityMet('skiing', 'groomers');
    expect(groomers!.M).toBe(378);
    const moguls = resolveActivityMet('skiing', 'moguls');
    expect(moguls!.M).toBe(400);
    const bc = resolveActivityMet('skiing', 'backcountry');
    expect(bc!.M).toBe(349);
  });
});

describe('computeActivityIREQ — physics sanity', () => {
  it('water-primary returns excluded', () => {
    const result = computeActivityIREQ('kayaking', -10, 3, 50);
    expect(result.excluded).toBe(true);
  });

  it('IREQ increases monotonically as temperature drops (hiking)', () => {
    const temps = [5, 0, -5, -10, -15, -20];
    const results = temps.map(t => {
      const r = computeActivityIREQ('hiking', t, va, RH);
      return (r as ActivityIREQResult).ireq_min_clo;
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!).toBeGreaterThan(results[i - 1]!);
    }
  });

  it('IREQ increases monotonically as temperature drops (camping)', () => {
    const temps = [5, 0, -5, -10, -15, -20];
    const results = temps.map(t => {
      const r = computeActivityIREQ('camping', t, va, RH);
      return (r as ActivityIREQResult).ireq_min_clo;
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!).toBeGreaterThan(results[i - 1]!);
    }
  });

  it('higher MET needs less insulation at same temp (running < camping at -10°C)', () => {
    const running = computeActivityIREQ('running', -10, va, RH) as ActivityIREQResult;
    const camping = computeActivityIREQ('camping', -10, va, RH) as ActivityIREQResult;
    expect(running.ireq_min_clo).toBeLessThan(camping.ireq_min_clo);
  });

  it('higher MET needs less insulation (hiking < fishing at -10°C)', () => {
    const hiking = computeActivityIREQ('hiking', -10, va, RH) as ActivityIREQResult;
    const fishing = computeActivityIREQ('fishing', -10, va, RH) as ActivityIREQResult;
    expect(hiking.ireq_min_clo).toBeLessThan(fishing.ireq_min_clo);
  });

  it('ski terrain: moguls needs less insulation than groomers at -15°C', () => {
    const groomers = computeActivityIREQ('skiing', -15, va, RH, { snowTerrain: 'groomers' }) as ActivityIREQResult;
    const moguls = computeActivityIREQ('skiing', -15, va, RH, { snowTerrain: 'moguls' }) as ActivityIREQResult;
    expect(moguls.ireq_min_clo).toBeLessThan(groomers.ireq_min_clo);
    expect(moguls.M).toBe(400);
    expect(groomers.M).toBe(378);
  });
});

describe('computeActivityIREQ — spot checks (plausible ranges)', () => {
  it('skiing groomers at -10°C: IREQ_min ~0.3 clo (high MET=378 → low insulation needed)', () => {
    const r = computeActivityIREQ('skiing', -10, 3, 50, { snowTerrain: 'groomers' }) as ActivityIREQResult;
    expect(r.ireq_min_clo).toBeGreaterThan(0.1);
    expect(r.ireq_min_clo).toBeLessThan(1.0);
  });

  it('camping at -20°C: IREQ_neu ~2.5 clo (M=146 low, but va=1 limits convective loss)', () => {
    const r = computeActivityIREQ('camping', -20, 1, 50) as ActivityIREQResult;
    expect(r.ireq_neu_clo).toBeGreaterThan(2.0);
    expect(r.ireq_neu_clo).toBeLessThan(4.0);
  });

  it('running at 0°C: IREQ_min ~0.07 clo (M=400 max → body is a furnace, minimal insulation)', () => {
    const r = computeActivityIREQ('running', 0, 3, 50) as ActivityIREQResult;
    expect(r.ireq_min_clo).toBeGreaterThan(0.0);
    expect(r.ireq_min_clo).toBeLessThan(0.5);
  });

  it('hiking at -10°C: IREQ_min ~0.7 clo (M=262, significant heat production)', () => {
    const r = computeActivityIREQ('hiking', -10, 3, 50) as ActivityIREQResult;
    expect(r.ireq_min_clo).toBeGreaterThan(0.3);
    expect(r.ireq_min_clo).toBeLessThan(1.5);
  });

  it('golf at 5°C: IREQ_neu ~0.4 clo (M=279, mild conditions)', () => {
    const r = computeActivityIREQ('golf', 5, 2, 50) as ActivityIREQResult;
    expect(r.ireq_neu_clo).toBeGreaterThan(0.2);
    expect(r.ireq_neu_clo).toBeLessThan(1.0);
  });
});

describe('computeActivityIREQ — full activity sweep at -10°C', () => {
  const ALL_LAND = [
    'hiking', 'backpacking', 'running', 'mountain_biking', 'road_cycling',
    'cross_country_ski', 'skiing', 'snowboarding', 'snowshoeing',
    'bouldering', 'climbing', 'skateboarding', 'onewheel',
    'camping', 'hunting_stand', 'hunting_walking', 'fishing', 'golf',
  ];

  ALL_LAND.forEach(act => {
    it(`${act} at -10°C: returns valid IREQ (not excluded, positive values)`, () => {
      const r = computeActivityIREQ(act, -10, 3, 50);
      expect(r.excluded).toBe(false);
      const result = r as ActivityIREQResult;
      expect(result.ireq_neu_clo).toBeGreaterThan(0);
      expect(result.ireq_min_clo).toBeGreaterThan(0);
      expect(result.ireq_neu_clo).toBeGreaterThan(result.ireq_min_clo);
      expect(result.M).toBeGreaterThan(0);
    });
  });
});
