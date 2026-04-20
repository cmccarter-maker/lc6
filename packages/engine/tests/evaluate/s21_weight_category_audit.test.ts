// ============================================================================
// S21 WEIGHT CATEGORY AUDIT — prove weight_category → weightG pipeline works
// packages/engine/tests/evaluate/s21_weight_category_audit.test.ts
//
// PURPOSE: Validate end-to-end that S21 infrastructure (weight_category added
// to EngineGearItem, weightCategoryToGrams mapping, mapGearItems populates
// weightG) produces differentiated MR output for ensembles that differ only
// in weight_category.
//
// METHOD: Clone S18 Breck snowboarding scenario structure exactly (known to
// produce non-zero MR output). Only vary weight_category across three kits:
//   A: all 8 slots at weight_category: "ultralight"
//   B: all 8 slots at weight_category: "heavy"
//   C: no weight_category (null — hits slot-fallback path in mapGearItems)
//
// HYPOTHESES:
//   (1) peak_MR(A) !== peak_MR(B)  — different weight_category → different MR
//   (2) peak_MR(A) !== peak_MR(C)  — categorical path differs from fallback
//
// If these pass, pipeline is operational end-to-end.
// If they fail at non-zero identical values, weight_category is being silently
// ignored somewhere downstream of mapGearItems.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/evaluate.js';
import type {
  EngineInput,
  GearEnsemble,
  EngineGearItem,
} from '../../src/types.js';

// ----------------------------------------------------------------------------
// Factory: build an 8-layer snowboard kit cloned from S18 Breck shape,
// with optional weight_category parameter.
// ----------------------------------------------------------------------------
function makeKit(
  ensembleId: string,
  weightCategory?: EngineGearItem['weight_category'],
): GearEnsemble {
  const mkItem = (
    slot: EngineGearItem['slot'],
    clo: number,
    im: number,
  ): EngineGearItem => ({
    product_id: `s21-${ensembleId}-${slot}`,
    name: `S21 ${ensembleId} ${slot}`,
    slot,
    clo,
    im,
    fiber: 'synthetic',
    ...(weightCategory ? { weight_category: weightCategory } : {}),
  });

  return {
    ensemble_id: `s21-${ensembleId}`,
    label: `S21 ${ensembleId} kit`,
    items: [
      mkItem('base', 0.35, 0.42),
      mkItem('mid', 0.6, 0.38),
      mkItem('insulative', 1.0, 0.22),
      mkItem('shell', 0.4, 0.18),
      mkItem('legwear', 0.7, 0.28),
      mkItem('footwear', 0.5, 0.20),
      mkItem('headgear', 0.3, 0.30),
      mkItem('handwear', 0.4, 0.25),
    ],
    total_clo: 3.4,
    ensemble_im: 0.22,
  };
}

// ----------------------------------------------------------------------------
// Cloned S18 Breck snowboarding scenario — known-working input shape
// ----------------------------------------------------------------------------
function buildInput(ensemble: GearEnsemble): EngineInput {
  return {
    activity: {
      activity_id: 'snowboarding',
      duration_hr: 6,
      snow_terrain: 'groomers',
      segments: [{
        segment_id: 'seg-1',
        segment_label: 'Breck Groomers',
        activity_id: 'snowboarding',
        duration_hr: 6,
        weather: [{
          t_start: 0, t_end: 21600,
          temp_f: 16, humidity: 40, wind_mph: 10, precip_probability: 0,
        }],
      }],
    },
    location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
    biometrics: { sex: 'male', weight_lb: 180 },
    user_ensemble: ensemble,
  };
}

// ----------------------------------------------------------------------------
// Test
// ----------------------------------------------------------------------------
describe('S21 Weight Category Pipeline Audit', () => {
  it('weight_category=ultralight, weight_category=heavy, and null produce differentiated MR', () => {
    const kitUL = makeKit('ultralight', 'ultralight');
    const kitHV = makeKit('heavy', 'heavy');
    const kitNoCat = makeKit('no-category'); // no weight_category set

    const inputUL = buildInput(kitUL);

    console.log('\n---- INPUT STRUCTURE ----');
    console.log(JSON.stringify(inputUL, null, 2).substring(0, 2000));
    console.log('(truncated at 2000 chars)');

    const outUL = evaluate(inputUL);

    console.log('\n---- OUTPUT STRUCTURE ----');
    console.log('trip_headline:', JSON.stringify(outUL.trip_headline, null, 2));
    console.log('four_pill present:', !!outUL.four_pill);
    console.log('\n---- END DEBUG ----\n');

    const outHV = evaluate(buildInput(kitHV));
    const outNC = evaluate(buildInput(kitNoCat));

    const mrUL = outUL.trip_headline?.peak_MR ?? 0;
    const mrHV = outHV.trip_headline?.peak_MR ?? 0;
    const mrNC = outNC.trip_headline?.peak_MR ?? 0;

    console.log('\n');
    console.log('='.repeat(80));
    console.log('S21 WEIGHT CATEGORY PIPELINE AUDIT');
    console.log('Cloned S18 Breck scenario (snowboarding 16°F/40%RH/10mph/6hr):');
    console.log('Same 8-layer kit, varying weight_category:');
    console.log('='.repeat(80));
    console.log(`  ultralight:   peak_MR = ${mrUL.toFixed(3)}`);
    console.log(`  heavy:        peak_MR = ${mrHV.toFixed(3)}`);
    console.log(`  no category:  peak_MR = ${mrNC.toFixed(3)}  (slot-fallback path)`);
    console.log('='.repeat(80));
    console.log(`  ΔMR (heavy - ultralight): ${(mrHV - mrUL).toFixed(3)}`);
    console.log(`  ΔMR (ultralight - null):  ${(mrUL - mrNC).toFixed(3)}`);
    console.log('');

    // Sanity — no crash, no NaN, MR in valid range
    expect(mrUL).toBeGreaterThanOrEqual(0);
    expect(mrUL).toBeLessThanOrEqual(10);
    expect(mrHV).toBeGreaterThanOrEqual(0);
    expect(mrHV).toBeLessThanOrEqual(10);
    expect(mrNC).toBeGreaterThanOrEqual(0);
    expect(mrNC).toBeLessThanOrEqual(10);
    expect(Number.isFinite(mrUL)).toBe(true);
    expect(Number.isFinite(mrHV)).toBe(true);
    expect(Number.isFinite(mrNC)).toBe(true);

    // First: MR must be non-zero (proves scenario is producing moisture computation)
    expect(mrUL).toBeGreaterThan(0);
    expect(mrHV).toBeGreaterThan(0);
    expect(mrNC).toBeGreaterThan(0);

    // Core assertions — proves weight_category flows through to output
    expect(mrUL).not.toBeCloseTo(mrHV, 3);
    expect(mrUL).not.toBeCloseTo(mrNC, 3);
  });
});
