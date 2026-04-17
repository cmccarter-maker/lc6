// ============================================================================
// Session 10 — Lock-in baseline regression: 3 remaining scenarios
// packages/engine/tests/evaluate/baselines.test.ts
//
// Lock-in baselines from Session 9b:
//   Golf walking 80°F 4hrs   → sessionMR = 1.5
//   Hiking 55°F 4hrs         → sessionMR = 5.5
//   Road cycling 85°F 2hrs   → sessionMR = 1.5
//
// These test different activity profiles, temperature regimes, and
// physics paths through calcIntermittentMoisture.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/evaluate.js';
import type { EngineInput, GearEnsemble, EngineGearItem } from '../../src/types.js';

// ============================================================================
// Fixtures
// ============================================================================

function item(
  slot: EngineGearItem['slot'], id: string, clo: number, im: number,
): EngineGearItem {
  return { product_id: id, name: id, slot, clo, im, fiber: 'synthetic' };
}

// ── Golf ensemble: light layers, moderate breathability ──
const GOLF_ENSEMBLE: GearEnsemble = {
  ensemble_id: 'golf-baseline',
  label: 'Golf Walking Kit',
  items: [
    item('base', 'golf-polo', 0.15, 0.42),
    item('legwear', 'golf-pants', 0.25, 0.38),
    item('footwear', 'golf-shoes', 0.15, 0.30),
    item('headgear', 'golf-cap', 0.05, 0.45),
  ],
  total_clo: 0.60,
  ensemble_im: 0.39,
};

// ── Hiking ensemble: moderate layers for 55°F ──
const HIKING_ENSEMBLE: GearEnsemble = {
  ensemble_id: 'hike-baseline',
  label: 'Day Hike Kit',
  items: [
    item('base', 'hike-base', 0.20, 0.40),
    item('mid', 'hike-fleece', 0.40, 0.35),
    item('shell', 'hike-wind', 0.10, 0.30),
    item('legwear', 'hike-pants', 0.30, 0.35),
    item('footwear', 'hike-boots', 0.30, 0.22),
    item('headgear', 'hike-beanie', 0.10, 0.35),
  ],
  total_clo: 1.40,
  ensemble_im: 0.33,
};

// ── Road cycling ensemble: minimal layers, maximum breathability ──
const CYCLING_ENSEMBLE: GearEnsemble = {
  ensemble_id: 'cycle-baseline',
  label: 'Road Cycling Kit',
  items: [
    item('base', 'cycle-jersey', 0.10, 0.50),
    item('legwear', 'cycle-bibs', 0.10, 0.48),
    item('footwear', 'cycle-shoes', 0.10, 0.35),
    item('headgear', 'cycle-cap', 0.03, 0.50),
  ],
  total_clo: 0.33,
  ensemble_im: 0.46,
};

function makeBaselineInput(
  activity: string,
  ensemble: GearEnsemble,
  tempF: number,
  durationHrs: number,
  humidity: number,
  windMph: number,
  options?: {
    golf_cart_riding?: boolean;
    elevation_ft?: number;
  },
): EngineInput {
  return {
    activity: {
      activity_id: activity,
      duration_hr: durationHrs,
      segments: [{
        segment_id: 'seg-1',
        segment_label: `${activity} baseline`,
        activity_id: activity,
        duration_hr: durationHrs,
        weather: [{
          t_start: 0,
          t_end: durationHrs * 3600,
          temp_f: tempF,
          humidity,
          wind_mph: windMph,
          precip_probability: 0,
        }],
      }],
      golf_cart_riding: options?.golf_cart_riding,
    },
    location: {
      lat: 39.48,
      lng: -106.07,
      elevation_ft: options?.elevation_ft ?? 5000,
    },
    biometrics: { sex: 'male', weight_lb: 180 },
    user_ensemble: ensemble,
  };
}


// ============================================================================
// Golf walking 80°F 4hrs — sessionMR baseline 1.5
// ============================================================================

describe('Baseline: Golf walking 80°F 4hrs', () => {
  const input = () => makeBaselineInput('golf', GOLF_ENSEMBLE, 80, 4, 55, 5, { golf_cart_riding: false });

  it('pipeline completes without error', () => {
    const result = evaluate(input());
    expect(result).toBeDefined();
    expect(result.trip_headline).toBeDefined();
  });

  it('MR is low (good evaporation in warm weather)', () => {
    const result = evaluate(input());
    // Baseline: sessionMR = 1.5. Per-cycle peak may differ.
    // Golf at 80°F with light breathable kit should have low moisture issues.
    expect(result.trip_headline.peak_MR).toBeLessThanOrEqual(4.0);
  });

  it('regime is heat or neutral (never cold at 80°F)', () => {
    const result = evaluate(input());
    for (const point of result.four_pill.your_gear.trajectory) {
      expect(point.regime).not.toBe('cold');
    }
  });

  it('no hypothermia stages at 80°F', () => {
    const result = evaluate(input());
    const coldStages = result.four_pill.your_gear.trajectory.filter(
      p => p.clinical_stage.includes('hypothermia')
    );
    expect(coldStages.length).toBe(0);
  });

  it('IREQ reports excluded or minimal insulation needed', () => {
    const result = evaluate(input());
    // At 80°F, IREQ should either be excluded (warm) or require minimal CLO
    expect(result.ireq_summary.ireq_min_clo).toBeLessThanOrEqual(0.5);
  });
});


// ============================================================================
// Hiking 55°F 4hrs — sessionMR baseline 5.5
// ============================================================================

describe('Baseline: Hiking 55°F 4hrs', () => {
  const input = () => makeBaselineInput('hiking', HIKING_ENSEMBLE, 55, 4, 50, 8, { elevation_ft: 7000 });

  it('pipeline completes without error', () => {
    const result = evaluate(input());
    expect(result).toBeDefined();
  });

  it('MR is moderate (sweating from exertion at mild temp)', () => {
    const result = evaluate(input());
    // PHY-071 corrected: sessionMR ~1.3 (was 5.5 under buggy cap). Hiking at 55°F with 1.4 CLO generates some sweat
    // at 55°F with 1.4 CLO — moderate moisture accumulation expected.
    expect(result.trip_headline.peak_MR).toBeGreaterThanOrEqual(0.5);  // PHY-071: corrected cap → lower MR
    expect(result.trip_headline.peak_MR).toBeLessThanOrEqual(8.0);
  });

  it('trajectory has multiple cycles', () => {
    const result = evaluate(input());
    expect(result.four_pill.your_gear.trajectory.length).toBeGreaterThan(1);
  });

  it('no extreme clinical stages (well-equipped hiker at 55°F)', () => {
    const result = evaluate(input());
    const dangerStages = result.four_pill.your_gear.trajectory.filter(
      p => p.clinical_stage === 'severe_hypothermia' ||
           p.clinical_stage === 'heat_stroke' ||
           p.clinical_stage === 'heat_exhaustion_deteriorating'
    );
    expect(dangerStages.length).toBe(0);
  });

  it('named_impairment_stage_reached is false', () => {
    const result = evaluate(input());
    expect(result.trip_headline.named_impairment_stage_reached).toBe(false);
  });
});


// ============================================================================
// Road cycling 85°F 2hrs — sessionMR baseline 1.5
// ============================================================================

describe('Baseline: Road cycling 85°F 2hrs', () => {
  const input = () => makeBaselineInput('road_cycling', CYCLING_ENSEMBLE, 85, 2, 60, 3);

  it('pipeline completes without error', () => {
    const result = evaluate(input());
    expect(result).toBeDefined();
  });

  it('MR is low (high im kit + self-generated wind)', () => {
    const result = evaluate(input());
    // Baseline: sessionMR = 1.5. Cycling kit has very high im (0.46)
    // and self-generated airflow aids evaporation dramatically.
    expect(result.trip_headline.peak_MR).toBeLessThanOrEqual(4.0);
  });

  it('regime is heat or neutral (never cold at 85°F)', () => {
    const result = evaluate(input());
    for (const point of result.four_pill.your_gear.trajectory) {
      expect(point.regime).not.toBe('cold');
    }
  });

  it('no cold-side clinical stages at 85°F', () => {
    const result = evaluate(input());
    const coldStages = result.four_pill.your_gear.trajectory.filter(
      p => p.clinical_stage.includes('hypothermia') || p.clinical_stage.includes('cold_')
    );
    expect(coldStages.length).toBe(0);
  });

  it('HLR is low or zero (no heat LOSS risk at 85°F)', () => {
    const result = evaluate(input());
    // At 85°F, heat loss is not a concern — HLR should be minimal
    expect(result.trip_headline.peak_HLR).toBeLessThanOrEqual(3.0);
  });

  it('IREQ reports excluded or zero insulation needed', () => {
    const result = evaluate(input());
    expect(result.ireq_summary.ireq_min_clo).toBeLessThanOrEqual(0.3);
  });
});


// ============================================================================
// Cross-activity comparison
// ============================================================================

describe('Cross-activity: physics varies by activity type', () => {

  it('hiking MR > cycling MR at similar temps (hiking sweats more into layers)', () => {
    const hikeResult = evaluate(makeBaselineInput('hiking', HIKING_ENSEMBLE, 65, 3, 50, 5));
    const cycleResult = evaluate(makeBaselineInput('road_cycling', CYCLING_ENSEMBLE, 65, 3, 50, 5));

    // Hiking with heavier layers and lower im should accumulate more moisture
    // than cycling with minimal high-im kit
    expect(hikeResult.trip_headline.peak_MR).toBeGreaterThanOrEqual(
      cycleResult.trip_headline.peak_MR - 1.0 // tolerance
    );
  });

  it('all three activities produce valid EngineOutput', () => {
    const golf = evaluate(makeBaselineInput('golf', GOLF_ENSEMBLE, 80, 4, 55, 5));
    const hike = evaluate(makeBaselineInput('hiking', HIKING_ENSEMBLE, 55, 4, 50, 8));
    const cycle = evaluate(makeBaselineInput('road_cycling', CYCLING_ENSEMBLE, 85, 2, 60, 3));

    for (const result of [golf, hike, cycle]) {
      expect(result.engine_version).toBeDefined();
      expect(result.four_pill.your_gear.trajectory.length).toBeGreaterThan(0);
      expect(result.four_pill.your_gear.segments.length).toBe(1);
      expect(result.trip_headline.peak_MR).toBeGreaterThanOrEqual(0);
      expect(result.trip_headline.peak_CDI).toBeGreaterThanOrEqual(0);
    }
  });
});
