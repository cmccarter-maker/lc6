// ============================================================================
// S18 SMOKE TEST — 4 scenarios against post-S17-revert engine
// packages/engine/tests/evaluate/s18_smoke.test.ts
//
// PURPOSE: Run 4 user-realistic scenarios (Breck snowboarding, day hike,
// backpacking, fishing) through evaluate() and print actual MR/HLR/CDI
// output. Human reviews the table and judges the distribution on sniff.
//
// This is NOT a pass/fail test. It's an observation harness. Assertions
// check only that the engine doesn't crash or return NaN. The interesting
// output is the console.log table.
//
// Delete this file or mark it as informational once S18 is closed.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/evaluate.js';
import type {
  EngineInput,
  WeatherSlice,
  GearEnsemble,
  EngineGearItem,
} from '../../src/types.js';

// ----------------------------------------------------------------------------
// Gear item factory (borrowed from evaluate.test.ts pattern)
// ----------------------------------------------------------------------------
function makeGearItem(
  slot: EngineGearItem['slot'],
  clo: number,
  im: number,
): EngineGearItem {
  return {
    product_id: `s18-${slot}`,
    name: `S18 ${slot}`,
    slot,
    clo,
    im,
    fiber: 'synthetic',
  };
}

// ----------------------------------------------------------------------------
// Four scenarios
// Each builds a complete EngineInput. Gear CLO totals chosen for user realism,
// not to hit any specific MR target.
// ----------------------------------------------------------------------------

const SCENARIOS: Array<{
  id: string;
  label: string;
  expected_feel: string;
  input: EngineInput;
}> = [
  // ---- 1. Breck snowboarding 16°F / 40% RH / 6hr ------------------------
  {
    id: 'breck',
    label: 'Breck snowboarding 16°F 40%RH 6hr',
    expected_feel: 'Cold baseline, well-matched kit, moderate activity',
    input: {
      activity: {
        activity_id: 'snowboarding',
        duration_hr: 6,
        date_iso: "2026-02-03",
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
      user_ensemble: {
        ensemble_id: 's18-breck',
        label: 'Breck Kit',
        items: [
          makeGearItem('base', 0.35, 0.42),
          makeGearItem('mid', 0.6, 0.38),
          makeGearItem('insulative', 1.0, 0.22),
          makeGearItem('shell', 0.4, 0.18),
          makeGearItem('legwear', 0.7, 0.28),
          makeGearItem('footwear', 0.5, 0.20),
          makeGearItem('headgear', 0.3, 0.30),
          makeGearItem('handwear', 0.4, 0.25),
        ],
        total_clo: 3.4,
        ensemble_im: 0.22,
      },
    },
  },

  // ---- 2. Day hike shoulder season 55°F / 70% RH / 4hr -----------------
  {
    id: 'dayhike',
    label: 'Day hike 55°F 70%RH 4hr moderate pace',
    expected_feel: 'Cool-humid middle ground, 3-layer kit',
    input: {
      activity: {
        activity_id: 'hiking',
        duration_hr: 4,
        date_iso: "2026-02-03",
        segments: [{
          segment_id: 'seg-1',
          segment_label: 'Shoulder-season trail',
          activity_id: 'hiking',
          duration_hr: 4,
          weather: [{
            t_start: 0, t_end: 14400,
            temp_f: 55, humidity: 70, wind_mph: 6, precip_probability: 0,
          }],
        }],
      },
      location: { lat: 47.6, lng: -121.9, elevation_ft: 3000 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: {
        ensemble_id: 's18-dayhike',
        label: 'Day Hike Kit',
        items: [
          makeGearItem('base', 0.25, 0.48),
          makeGearItem('mid', 0.4, 0.42),
          makeGearItem('shell', 0.2, 0.35),
          makeGearItem('legwear', 0.4, 0.40),
          makeGearItem('footwear', 0.4, 0.25),
          makeGearItem('headgear', 0.15, 0.40),
          makeGearItem('handwear', 0.2, 0.30),
        ],
        total_clo: 1.5,
        ensemble_im: 0.38,
      },
    },
  },

  // ---- 3. Backpacking warm sustained 72°F / 65% RH / 6hr w/ pack ------
  {
    id: 'backpack',
    label: 'Backpacking 72°F 65%RH 6hr sustained climb + pack',
    expected_feel: 'Warm sustained exertion, real-world uncompensable edge',
    input: {
      activity: {
        activity_id: 'backpacking',
        duration_hr: 6,
        date_iso: "2026-02-03",
        segments: [{
          segment_id: 'seg-1',
          segment_label: 'Sustained climb',
          activity_id: 'backpacking',
          duration_hr: 6,
          weather: [{
            t_start: 0, t_end: 21600,
            temp_f: 72, humidity: 65, wind_mph: 4, precip_probability: 0,
          }],
        }],
      },
      location: { lat: 44.4, lng: -110.6, elevation_ft: 7500 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: {
        ensemble_id: 's18-backpack',
        label: 'Backpacking Kit',
        items: [
          makeGearItem('base', 0.25, 0.48),
          makeGearItem('shell', 0.2, 0.40),
          makeGearItem('legwear', 0.35, 0.42),
          makeGearItem('footwear', 0.4, 0.25),
          makeGearItem('headgear', 0.15, 0.45),
        ],
        total_clo: 1.0,
        ensemble_im: 0.42,
      },
      pack: { weight_lb: 35, panel_type: 'mesh' },
    },
  },

  // ---- 4. Fishing cold wet stationary 38°F / 85% RH / 4hr --------------
  {
    id: 'fishing',
    label: 'Fishing 38°F 85%RH 4hr stationary + light drizzle',
    expected_feel: 'Cold, low sweat, ambient hygro load from wet environment',
    input: {
      activity: {
        activity_id: 'fishing',
        duration_hr: 4,
        date_iso: "2026-02-03",
        segments: [{
          segment_id: 'seg-1',
          segment_label: 'Stationary fishing',
          activity_id: 'fishing',
          duration_hr: 4,
          weather: [{
            t_start: 0, t_end: 14400,
            temp_f: 38, humidity: 85, wind_mph: 5, precip_probability: 0.7,
          }],
        }],
      },
      location: { lat: 60.5, lng: -149.6, elevation_ft: 100 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: {
        ensemble_id: 's18-fishing',
        label: 'Fishing Kit',
        items: [
          makeGearItem('base', 0.3, 0.42),
          makeGearItem('mid', 0.5, 0.35),
          makeGearItem('insulative', 0.6, 0.28),
          makeGearItem('shell', 0.3, 0.20),
          makeGearItem('legwear', 0.8, 0.15), // waders: thick, low vapor transfer
          makeGearItem('footwear', 0.5, 0.10),
          makeGearItem('headgear', 0.25, 0.35),
          makeGearItem('handwear', 0.35, 0.25),
        ],
        total_clo: 2.6,
        ensemble_im: 0.22,
      },
    },
  },
];

// ----------------------------------------------------------------------------
// Run scenarios and print table
// ----------------------------------------------------------------------------

describe('S18 Smoke Test — 4 user scenarios', () => {

  it('runs all 4 scenarios and prints results table', () => {
    // Header
    console.log('\n');
    console.log('═'.repeat(110));
    console.log('S18 SMOKE TEST — post-S17-revert engine output');
    console.log('═'.repeat(110));
    console.log(
      'ID'.padEnd(10) +
      'SCENARIO'.padEnd(52) +
      'peak_MR'.padEnd(10) +
      'peak_HLR'.padEnd(10) +
      'peak_CDI'.padEnd(10) +
      'STAGE'.padEnd(18)
    );
    console.log('─'.repeat(110));

    const results: Array<{
      id: string;
      label: string;
      peak_MR: number;
      peak_HLR: number;
      peak_CDI: number;
      peak_clinical_stage: string;
      binding_pathway: string;
      regime_mix: { cold: number; heat: number; neutral: number };
      cm_card_count: number;
    }> = [];

    for (const scenario of SCENARIOS) {
      let output;
      try {
        output = evaluate(scenario.input);
      } catch (err) {
        console.log(
          scenario.id.padEnd(10) +
          scenario.label.padEnd(52) +
          'CRASHED: ' + (err as Error).message
        );
        // still record it so the table is complete
        results.push({
          id: scenario.id,
          label: scenario.label,
          peak_MR: NaN,
          peak_HLR: NaN,
          peak_CDI: NaN,
          peak_clinical_stage: 'CRASHED',
          binding_pathway: 'CRASHED',
          regime_mix: { cold: 0, heat: 0, neutral: 0 },
          cm_card_count: 0,
        });
        continue;
      }

      const th = output.trip_headline;
      results.push({
        id: scenario.id,
        label: scenario.label,
        peak_MR: th.peak_MR,
        peak_HLR: th.peak_HLR,
        peak_CDI: th.peak_CDI,
        peak_clinical_stage: th.peak_clinical_stage,
        binding_pathway: th.binding_pathway,
        regime_mix: {
          cold: th.regime_mix.cold_fraction,
          heat: th.regime_mix.heat_fraction,
          neutral: th.regime_mix.neutral_fraction,
        },
        cm_card_count: th.cm_card_count,
      });

      console.log(
        scenario.id.padEnd(10) +
        scenario.label.padEnd(52) +
        th.peak_MR.toFixed(2).padEnd(10) +
        th.peak_HLR.toFixed(2).padEnd(10) +
        th.peak_CDI.toFixed(2).padEnd(10) +
        String(th.peak_clinical_stage).padEnd(18)
      );
    }

    console.log('─'.repeat(110));
    console.log('\nDETAIL:');
    for (const r of results) {
      console.log(`\n[${r.id}] ${r.label}`);
      console.log(`  MR=${r.peak_MR.toFixed(2)}  HLR=${r.peak_HLR.toFixed(2)}  CDI=${r.peak_CDI.toFixed(2)}`);
      console.log(`  stage: ${r.peak_clinical_stage}`);
      console.log(`  binding_pathway: ${r.binding_pathway}`);
      console.log(`  regime: cold=${r.regime_mix.cold.toFixed(2)} heat=${r.regime_mix.heat.toFixed(2)} neutral=${r.regime_mix.neutral.toFixed(2)}`);
      console.log(`  cm_cards: ${r.cm_card_count}`);
    }
    console.log('\n' + '═'.repeat(110));

    // Minimal sanity assertions — test passes if engine doesn't crash or NaN
    for (const r of results) {
      expect(r.peak_clinical_stage).not.toBe('CRASHED');
      expect(Number.isFinite(r.peak_MR)).toBe(true);
      expect(Number.isFinite(r.peak_HLR)).toBe(true);
      expect(Number.isFinite(r.peak_CDI)).toBe(true);
      expect(r.peak_MR).toBeGreaterThanOrEqual(0);
      expect(r.peak_MR).toBeLessThanOrEqual(10);
      expect(r.peak_HLR).toBeGreaterThanOrEqual(0);
      expect(r.peak_HLR).toBeLessThanOrEqual(10);
      expect(r.peak_CDI).toBeGreaterThanOrEqual(0);
      expect(r.peak_CDI).toBeLessThanOrEqual(10);
    }
  });

});
