// PHY-FUDGE-DELETION-VERIFY: Diagnostic test for S23 fudge deletion.
//
// Session 23 (2026-04-20) deleted two fudges from calc_intermittent_moisture.ts:
//   - dryAirBonus (line 451 in pre-deletion code)
//   - _localDryBonus (line 385 in pre-deletion code)
// Both were staircase approximations of VPD narrowing in dry air:
//   humidity < 20 ? 1.8 : humidity < 30 ? 1.4 : humidity < 40 ? 1.15 : 1.0
//
// This test runs low-humidity scenarios to verify post-deletion behavior.
// No assertions — diagnostic output only. Compare numbers to baseline in
// LC6_Planning/baselines/S23_pre_fudge_deletion.md for verification.
//
// Expected behavior:
//   - RH < 40: MR should be HIGHER than pre-deletion (fudge was boosting evap)
//   - RH >= 40: MR should be IDENTICAL (fudge returned 1.0, no effect)
//   - ALL shifts should be UP (reduced evap = more retained moisture)

import { describe, it } from 'vitest';
import { convertGearDB } from '../../src/gear/adapter.js';
import { enumerateCandidates } from '../../src/strategy/enumerate.js';
import { evaluate } from '../../src/evaluate.js';
import type { EngineInput } from '../../src/types.js';

// @ts-expect-error — reference/lc5_gear.js is a JS module without types
import { G as UNIVERSAL_GEAR_DB } from '../../reference/lc5_gear.js';

interface Scenario {
  id: string;
  label: string;
  activity: string;
  tempF: number;
  humidity: number;
  windMph: number;
  durationHr: number;
  fudgeBracket: string;
  expectedPreDeletionFudge: number;
}

// Six scenarios spanning the three fudge brackets:
//   < 20 RH = fudge was 1.8 (44% evap reduction post-deletion)
//   20-29 RH = fudge was 1.4 (29% evap reduction post-deletion)
//   30-39 RH = fudge was 1.15 (13% evap reduction post-deletion)
//   40+ RH = fudge was 1.0 (zero effect — control scenarios)
const SCENARIOS: Scenario[] = [
  // === Low humidity (fudge was firing strongest) ===
  { id: 'F1', label: 'Desert day hike 15% RH / 95F / 3hr',
    activity: 'day_hike', tempF: 95, humidity: 15, windMph: 8, durationHr: 3,
    fudgeBracket: '< 20 RH', expectedPreDeletionFudge: 1.8 },

  { id: 'F2', label: 'Alpine cold-dry skiing 15% RH / -5F / 5hr',
    activity: 'skiing', tempF: -5, humidity: 15, windMph: 10, durationHr: 5,
    fudgeBracket: '< 20 RH', expectedPreDeletionFudge: 1.8 },

  // === Moderate-low humidity (mid-strength fudge) ===
  { id: 'F3', label: 'Desert XC ski 25% RH / 20F / 3hr',
    activity: 'cross_country_ski', tempF: 20, humidity: 25, windMph: 8, durationHr: 3,
    fudgeBracket: '20-29 RH', expectedPreDeletionFudge: 1.4 },

  { id: 'F4', label: 'High desert hike 25% RH / 80F / 4hr',
    activity: 'day_hike', tempF: 80, humidity: 25, windMph: 8, durationHr: 4,
    fudgeBracket: '20-29 RH', expectedPreDeletionFudge: 1.4 },

  // === Boundary humidity (weakest fudge firing) ===
  { id: 'F5', label: 'Moderate dry ski 35% RH / 16F / 6hr',
    activity: 'skiing', tempF: 16, humidity: 35, windMph: 10, durationHr: 6,
    fudgeBracket: '30-39 RH', expectedPreDeletionFudge: 1.15 },

  // === Control (no fudge — should be identical to pre-deletion) ===
  { id: 'F6', label: 'Control 50% RH / 16F ski / 6hr (fudge=1.0)',
    activity: 'skiing', tempF: 16, humidity: 50, windMph: 10, durationHr: 6,
    fudgeBracket: '>= 40 RH (control)', expectedPreDeletionFudge: 1.0 },

  // === Isolation scenarios (ONLY humidity varies) ===
  // All identical: 16F skiing, 6hr, 10mph wind. Isolates humidity effect.
  // Post-deletion output reveals the combined effect of:
  //   (a) lower RH = higher vpdRatio = more evap (MR drops as RH drops)
  //   (b) pre-deletion fudge boost is gone (MR rises relative to pre-deletion)
  // Net observed trajectory across I1->I4 tells us which effect dominates.
  { id: 'I1', label: 'Isolation 50% RH (fudge was 1.0)',
    activity: 'skiing', tempF: 16, humidity: 50, windMph: 10, durationHr: 6,
    fudgeBracket: 'isolation >= 40', expectedPreDeletionFudge: 1.0 },
  { id: 'I2', label: 'Isolation 35% RH (fudge was 1.15)',
    activity: 'skiing', tempF: 16, humidity: 35, windMph: 10, durationHr: 6,
    fudgeBracket: 'isolation 30-39', expectedPreDeletionFudge: 1.15 },
  { id: 'I3', label: 'Isolation 25% RH (fudge was 1.4)',
    activity: 'skiing', tempF: 16, humidity: 25, windMph: 10, durationHr: 6,
    fudgeBracket: 'isolation 20-29', expectedPreDeletionFudge: 1.4 },
  { id: 'I4', label: 'Isolation 15% RH (fudge was 1.8)',
    activity: 'skiing', tempF: 16, humidity: 15, windMph: 10, durationHr: 6,
    fudgeBracket: 'isolation < 20', expectedPreDeletionFudge: 1.8 },
];

function buildScenarioInput(s: Scenario): EngineInput | null {
  const catalog = convertGearDB(UNIVERSAL_GEAR_DB, { activity: s.activity, minFitScore: 5 });
  const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: s.tempF, activity: s.activity });
  if (candidates.length === 0) return null;

  // Pick median candidate by CLO
  const sorted = [...candidates].sort((a, b) => a.total_clo - b.total_clo);
  const userEnsemble = sorted[Math.floor(sorted.length / 2)]!;

  return {
    activity: {
      activity_id: s.activity,
      duration_hr: s.durationHr,
      date_iso: "2026-02-03",
      snow_terrain: (s.activity === 'skiing' || s.activity === 'snowboarding') ? 'groomers' : undefined,
      segments: [{
        segment_id: 'seg-1',
        segment_label: s.label,
        activity_id: s.activity,
        duration_hr: s.durationHr,
        weather: [{
          t_start: 0,
          t_end: s.durationHr * 3600,
          temp_f: s.tempF,
          humidity: s.humidity,
          wind_mph: s.windMph,
          precip_probability: 0,
        }],
      }],
    },
    location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
    biometrics: { sex: 'male', weight_lb: 180 },
    user_ensemble: userEnsemble,
    strategy_candidates: candidates,
  };
}

describe('S23 Fudge Deletion Verification', () => {
  it('prints MR output for 6 scenarios spanning all fudge brackets', () => {
    console.log('\n' + '='.repeat(80));
    console.log('S23 FUDGE DELETION VERIFICATION');
    console.log('Post-deletion engine run across humidity brackets.');
    console.log('Compare to baselines/S23_pre_fudge_deletion.md for direction check.');
    console.log('='.repeat(80) + '\n');

    console.log(
      'id | fudge bracket        | pre-del fudge | peakMR | peakCDI | gear            | clinical stage'
    );
    console.log('-'.repeat(90));

    for (const s of SCENARIOS) {
      const input = buildScenarioInput(s);
      if (!input) {
        console.log(`${s.id} | ${s.fudgeBracket.padEnd(20)} | SKIP — no candidates enumerated`);
        continue;
      }

      try {
        const output = evaluate(input);
        const userGear = output.four_pill.your_gear;
        const peakMR = userGear.trajectory_summary.peak_MR;
        const peakCDI = userGear.trajectory_summary.peak_CDI;
        const clo = userGear.ensemble.total_clo;
        const im = userGear.ensemble.ensemble_im;
        const stage = userGear.trajectory_summary.peak_clinical_stage;

        console.log(
          `${s.id} | ${s.fudgeBracket.padEnd(20)} | ${s.expectedPreDeletionFudge.toFixed(2).padStart(13)} | ${peakMR.toFixed(2).padStart(6)} | ${peakCDI.toFixed(2).padStart(6)} | CLO=${clo.toFixed(1)} im=${im.toFixed(2)} | ${stage}`
        );
      } catch (err) {
        console.log(`${s.id} | ${s.fudgeBracket.padEnd(20)} | ERROR: ${(err as Error).message.slice(0, 100)}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Interpretation guide:');
    console.log('  F1, F2 (RH < 20): should show HIGHEST MR — 44% less evap than pre-deletion');
    console.log('  F3, F4 (RH 20-29): should show moderate increase — 29% less evap');
    console.log('  F5 (RH 30-39): should show small increase — 13% less evap');
    console.log('  F6 (RH 50 control): should match pre-deletion exactly');
    console.log('');
    console.log('If F6 differs from known baseline OR any MR seems physically implausible,');
    console.log('investigate before declaring fudge deletion validated.');
    console.log('='.repeat(80));
    console.log('\nISOLATION ANALYSIS (I1-I4, same conditions except humidity):');
    console.log('  I1 (50% RH) = baseline. Fudge was 1.0, no change from pre-deletion.');
    console.log('  I2 (35% RH) = fudge was 1.15, now removed. Net MR depends on vpdRatio vs lost fudge.');
    console.log('  I3 (25% RH) = fudge was 1.4, now removed. Larger pre-deletion boost lost.');
    console.log('  I4 (15% RH) = fudge was 1.8, now removed. Largest pre-deletion boost lost.');
    console.log('');
    console.log('Monotonicity check: if vpdRatio effect dominates, MR drops I1->I4 (more evap at low RH).');
    console.log('If fudge-removal effect dominates, MR rises I1->I4 (less evap than pre-deletion).');
    console.log('Either monotonic direction is physically valid. NON-monotonic output = potential bug.');
    console.log('='.repeat(80) + '\n');
  });
});
