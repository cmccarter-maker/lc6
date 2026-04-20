// ============================================================================
// S21 DURATION SWEEP — does heavy MR eventually surpass ultralight?
// packages/engine/tests/evaluate/s21_duration_sweep.test.ts
//
// PURPOSE: Christian's physics challenge — a heavier/thicker garment should
// eventually produce HIGHER MR than a lighter garment given enough time,
// because the additional capacity only buys time before it too saturates.
//
// METHOD: Same 8-layer Breck snowboarding kit, same fixed CLO + im values,
// ONLY weight_category varies. Sweep duration: 2, 4, 6, 8, 12, 20 hours.
// Report peak_MR for each (ultralight vs heavy vs null-category).
//
// OBSERVATION-ONLY — no pass/fail on the direction of change. This is a
// physics probe to see whether the engine shows expected duration dynamics.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/evaluate.js';
import type { EngineInput, GearEnsemble, EngineGearItem } from '../../src/types.js';

function makeKit(
  ensembleId: string,
  weightCategory?: EngineGearItem['weight_category'],
): GearEnsemble {
  const mkItem = (
    slot: EngineGearItem['slot'],
    clo: number,
    im: number,
  ): EngineGearItem => ({
    product_id: `s21sweep-${ensembleId}-${slot}`,
    name: `S21 ${ensembleId} ${slot}`,
    slot, clo, im,
    fiber: 'synthetic',
    ...(weightCategory ? { weight_category: weightCategory } : {}),
  });

  return {
    ensemble_id: `s21sweep-${ensembleId}`,
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

function buildInput(ensemble: GearEnsemble, durationHr: number): EngineInput {
  const durSec = durationHr * 3600;
  return {
    activity: {
      activity_id: 'snowboarding',
      duration_hr: durationHr,
      snow_terrain: 'groomers',
      segments: [{
        segment_id: 'seg-1',
        segment_label: 'Breck Groomers',
        activity_id: 'snowboarding',
        duration_hr: durationHr,
        weather: [{
          t_start: 0, t_end: durSec,
          temp_f: 16, humidity: 40, wind_mph: 10, precip_probability: 0,
        }],
      }],
    },
    location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
    biometrics: { sex: 'male', weight_lb: 180 },
    user_ensemble: ensemble,
  };
}

describe('S21 Duration Sweep — MR trajectory across durations', () => {
  it('prints MR for ultralight/heavy/null at 2/4/6/8/12/20 hr', () => {
    const DURATIONS = [2, 4, 6, 8, 12, 20];
    const kits = {
      ultralight: makeKit('ultralight', 'ultralight'),
      heavy: makeKit('heavy', 'heavy'),
      null_cat: makeKit('null-cat'),
    };

    console.log('\n');
    console.log('='.repeat(80));
    console.log('S21 DURATION SWEEP — does heavy MR eventually surpass ultralight?');
    console.log('Breck snowboarding, 16°F/40%RH/10mph, varying duration:');
    console.log('='.repeat(80));
    console.log('');
    console.log('  hours | ultralight |   heavy  | null_cat | Δ(heavy-UL)');
    console.log('  ------|-----------|----------|----------|-------------');

    for (const hr of DURATIONS) {
      const mrUL = evaluate(buildInput(kits.ultralight, hr)).trip_headline?.peak_MR ?? NaN;
      const mrHV = evaluate(buildInput(kits.heavy, hr)).trip_headline?.peak_MR ?? NaN;
      const mrNC = evaluate(buildInput(kits.null_cat, hr)).trip_headline?.peak_MR ?? NaN;
      const delta = mrHV - mrUL;

      console.log(
        `  ${String(hr).padStart(5)} | ${mrUL.toFixed(3).padStart(9)} | ${mrHV.toFixed(3).padStart(8)} | ${mrNC.toFixed(3).padStart(8)} | ${(delta >= 0 ? '+' : '') + delta.toFixed(3)}`
      );
    }

    console.log('');
    console.log('Interpretation guide:');
    console.log('  Δ(heavy-UL) negative = heavy kit produces LOWER MR (more capacity buffers sweat)');
    console.log('  Δ(heavy-UL) positive = heavy kit produces HIGHER MR (eventually overtakes)');
    console.log('  If Δ stays negative across all durations — capacity dominates, no crossover observed');
    console.log('  If Δ turns positive at some duration — crossover confirmed');
    console.log('');

    expect(true).toBe(true); // observation-only
  });
});
