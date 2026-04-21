// ============================================================================
// S-001 Breckenridge baseline capture — diagnostic, NOT part of assertion suite
// packages/engine/tests/diagnostics/s001_breck_baseline.test.ts
//
// PURPOSE: capture per-cycle engine state for S-001 reference scenario
// (Breckenridge cold-dry skiing, 16°F / 40% RH / 8 mph / 6hr).
// Output will be used to rewrite S-001 v2 reference scenario with real
// numbers, replacing qualitative estimates currently in v1.
//
// METHOD: single 6-hour call to calcIntermittentMoisture (preserves cycle-to-
// cycle state continuity). Gear items constructed with pre-computed weightG
// values from the weightCategoryToGrams table in evaluate.ts:1011 (since
// ensemble-local GearItem does not carry weight_category directly — that
// lookup lives in the mapGearItems pipeline, not here).
//
// External computeSweatRate / computeEmax invocations serve as sanity-check
// ceilings using the same primitives the engine uses; eReq is an external
// estimate (engine's actual eReq derives from iterativeTSkin metabolic
// balance, not exposed on the result).
//
// No assertions. One trivial expect() to satisfy vitest.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { calcIntermittentMoisture } from '../../src/moisture/calc_intermittent_moisture.js';
import { computeEmax, computeSweatRate } from '../../src/heat_balance/evaporation.js';
import type { GearItem } from '../../src/ensemble/index.js';

describe('S-001 Breckenridge baseline capture', () => {
  it('logs per-hour engine state over 6-hour skiing session (no assertions)', () => {
    // ====== Scenario parameters (S-001) ======
    const TEMP_F = 16;
    const HUMIDITY = 40;
    const WIND_MPH = 8;
    const DURATION_HR = 6;
    const ACTIVITY = 'skiing';
    const TERRAIN = 'groomers';

    // ====== Ensemble: 4 real products from LC5 catalog ======
    // weightG values from weightCategoryToGrams table (evaluate.ts:1011):
    //   base light        → 160g
    //   mid light         → 265g
    //   insulative ultra  → 180g
    //   shell light       → 255g
    // Ordering = skin-out: base (0), mid (1), insulative (2), shell (3).
    const gearItems: GearItem[] = [
      {
        brand: 'Smartwool', model: 'Merino 250 Base Layer',
        material: 'merino',         // → WOOL via getFiberType
        warmthRatio: 8, breathability: 7, moisture: 9,
        weightG: 160,
      },
      {
        brand: 'Patagonia', model: 'R1 Air Full-Zip Hoody',
        material: 'polyester',      // → SYNTHETIC default
        warmthRatio: 7, breathability: 10, moisture: 9,
        weightG: 265,
      },
      {
        brand: 'Patagonia', model: 'Nano Puff Hoody',
        material: 'polyester',      // → SYNTHETIC
        warmthRatio: 7, breathability: 6, moisture: 3,
        weightG: 180,
      },
      {
        brand: "Arc'teryx", model: 'Beta LT Jacket',
        material: 'polyester',      // → SYNTHETIC (hardshell, PHY-SHELL-GATE class)
        warmthRatio: 1, breathability: 8, moisture: 3,
        weightG: 255,
      },
    ];

    // ====== Scalar ensembleIm + externally-estimated totalCLO ======
    // ensembleIm: 0.22 matches s18_smoke Breck kit baseline (aggregation lives
    // in ensemble_im.ts:139 but isn't directly callable from here).
    const ENSEMBLE_IM = 0.22;
    // totalCLO: sum of warmthToCLO(warmthRatio) per layer: 1.60 + 1.30 + 1.30 + 0.10 = 4.30
    // (warmthToCLO map: [0,0.10,0.20,0.30,0.50,0.70,1.00,1.30,1.60,2.00,2.50])
    const TOTAL_CLO = 4.30;

    // ====== External sweat/Emax primitives (same inputs engine uses) ======
    const T_SKIN_C = 32.5;
    const T_AMB_C = (TEMP_F - 32) * 5 / 9;  // -8.89°C
    const WIND_MS_LIFT = WIND_MPH * 0.44704;              // ~3.58 m/s (ambient only)
    const WIND_MS_RUN = WIND_MS_LIFT + 3.0;               // + ski-descent component
    const BSA = 2.0;

    const emaxLift = computeEmax(T_SKIN_C, T_AMB_C, HUMIDITY, WIND_MS_LIFT, ENSEMBLE_IM, TOTAL_CLO, BSA);
    const emaxRun = computeEmax(T_SKIN_C, T_AMB_C, HUMIDITY, WIND_MS_RUN, ENSEMBLE_IM, TOTAL_CLO, BSA);
    // External eReq estimates (engine's actual eReq from iterativeTSkin not exposed).
    // Run phase: skiing MET~6, M ≈ 700W, mechanical work ~20% → heat ~560W,
    //   minus cold-weather conv+rad+resp losses (~160W) → eReq ≈ 400W.
    // Lift phase: near-rest MET~2, minor remaining eReq.
    const E_REQ_RUN_EST = 400;   // W
    const E_REQ_LIFT_EST = 50;   // W
    const swRun = computeSweatRate(E_REQ_RUN_EST, emaxRun.eMax);
    const swLift = computeSweatRate(E_REQ_LIFT_EST, emaxLift.eMax);

    // ====== Single 6-hour engine call ======
    const r = calcIntermittentMoisture(
      ACTIVITY, TEMP_F, HUMIDITY, WIND_MPH, DURATION_HR,
      'male', 180, 1.0,
      ENSEMBLE_IM,                 // position 9
      TERRAIN,
      null, false, 0, false, 1.0,
      null, null, 'moderate', null, 3,
      null, 0, null,
      gearItems,                   // position 24
      null, 0, null,
    );

    // ====== Sum layer caps for total ensemble liquid capacity ======
    let totalCap = 0;
    if (r.endingLayers) {
      for (const l of r.endingLayers) totalCap += l.cap;
    }

    // ====== Emit diagnostic log ======
    console.log('\n');
    console.log('='.repeat(80));
    console.log('=== S-001 Breck Baseline Diagnostic ===');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Scenario: ${TEMP_F}°F / ${HUMIDITY}% RH / ${WIND_MPH} mph wind, ${DURATION_HR}hr ${ACTIVITY} ${TERRAIN}`);
    console.log('');
    console.log('Ensemble (skin-out order):');
    if (r.endingLayers) {
      for (let i = 0; i < r.endingLayers.length; i++) {
        const l = r.endingLayers[i]!;
        const g = gearItems[i]!;
        console.log(`  [${i}] ${g.brand} ${g.model}`);
        console.log(`      weightG=${g.weightG}   breathability=${g.breathability}   warmthRatio=${g.warmthRatio}   moisture=${g.moisture}`);
        console.log(`      derived: im=${l.im.toFixed(3)}   cap=${l.cap.toFixed(1)}g   fiber=${l.fiber}`);
      }
    }
    console.log('');
    console.log(`ensembleIm (scalar, passed to engine): ${ENSEMBLE_IM}  (matches s18_smoke Breck baseline)`);
    console.log(`totalCLO (derived from warmthRatios):  ${TOTAL_CLO}`);
    console.log(`Total liquid capacity (sum of layer caps): ${totalCap.toFixed(1)}g`);
    console.log('');
    console.log('External sweat/Emax estimates (same primitives, assumed eReq):');
    console.log(`  Run phase:   sweatGPerHr=${swRun.sweatGPerHr.toFixed(0)}   eMax(W)=${emaxRun.eMax.toFixed(1)}   regime=${swRun.regime}   [eReq(est)=${E_REQ_RUN_EST}W, wind=${WIND_MS_RUN.toFixed(1)}m/s]`);
    console.log(`  Lift phase:  sweatGPerHr=${swLift.sweatGPerHr.toFixed(0)}   eMax(W)=${emaxLift.eMax.toFixed(1)}   regime=${swLift.regime}   [eReq(est)=${E_REQ_LIFT_EST}W, wind=${WIND_MS_LIFT.toFixed(1)}m/s]`);
    console.log(`  VPD (Magnus, skin→amb): ${emaxRun.vpdKpa.toFixed(3)} kPa   pSkin=${emaxRun.pSkin.toFixed(1)}hPa   pAmb=${emaxRun.pAmb.toFixed(1)}hPa`);
    console.log('');

    // ====== Per-hour bucketed trajectory ======
    const nCycles = r.perCycleMR?.length ?? 0;
    const cycleMin = nCycles > 0 ? (DURATION_HR * 60) / nCycles : 0;
    console.log(`Per-hour trajectory (${nCycles} cycles @ ${cycleMin.toFixed(2)} min/cycle):`);
    console.log('');
    for (let hour = 1; hour <= DURATION_HR; hour++) {
      const startIdx = Math.max(0, Math.floor(((hour - 1) * 60) / cycleMin));
      const endIdxRaw = Math.floor((hour * 60) / cycleMin) - 1;
      const endIdx = Math.min(endIdxRaw, nCycles - 1);
      if (endIdx < startIdx) continue;
      const mrs = r.perCycleMR?.slice(startIdx, endIdx + 1) ?? [];
      const traps = r.perCycleTrapped?.slice(startIdx, endIdx + 1) ?? [];
      const mrAvg = mrs.length > 0 ? mrs.reduce((s, v) => s + v, 0) / mrs.length : 0;
      const mrEnd = mrs[mrs.length - 1] ?? 0;
      const trapEnd = traps[traps.length - 1] ?? 0;
      console.log(`  Hour ${hour}:  cycles ${startIdx}-${endIdx}   MR avg=${mrAvg.toFixed(2)} end=${mrEnd.toFixed(2)}   trapped=${trapEnd.toFixed(3)}L`);
    }
    console.log('');

    // ====== Final state ======
    console.log('Final state:');
    console.log(`  sessionMR:          ${r.sessionMR.toFixed(2)}`);
    console.log(`  timeAtCapHrs:       ${r.timeAtCapHrs.toFixed(2)}`);
    console.log(`  peakSaturationFrac: ${((r.peakSaturationFrac ?? 0) * 100).toFixed(1)}%`);
    console.log(`  totalFluidLoss:     ${(r.totalFluidLoss ?? 0).toFixed(0)} mL`);
    console.log(`  fluidLossPerHr:     ${(r.fluidLossPerHr ?? 0).toFixed(0)} mL/hr`);
    console.log(`  fatigue:            ${(r.fatigue ?? 0).toFixed(2)}`);
    console.log(`  goodRunCount:       ${r.goodRunCount ?? 0}`);
    console.log(`  yellowRunCount:     ${r.yellowRunCount ?? 0}`);
    console.log(`  totalRuns:          ${r.totalRuns ?? 0}`);
    console.log('');
    if (r.endingLayers) {
      console.log('Final layer state (buffer g / cap g / fill%):');
      for (let i = 0; i < r.endingLayers.length; i++) {
        const l = r.endingLayers[i]!;
        const g = gearItems[i]!;
        const pct = l.cap > 0 ? (l.buffer / l.cap * 100) : 0;
        const label = `${g.brand} ${g.model}`;
        console.log(`  [${i}] ${label.padEnd(46)} buffer=${l.buffer.toFixed(1).padStart(7)}g / cap=${l.cap.toFixed(1).padStart(6)}g   fill=${pct.toFixed(1).padStart(5)}%`);
      }
    }
    console.log('');
    const wetMax = r.perCycleWetPenalty && r.perCycleWetPenalty.length > 0
      ? Math.max(...r.perCycleWetPenalty) : 0;
    console.log(`perCycleWetPenalty (HLR score) max: ${wetMax.toFixed(3)}`);
    console.log('');
    console.log('='.repeat(80));
    console.log('');

    // Trivial satisfaction — this is diagnostic, not assertion
    expect(r.sessionMR).toBeDefined();
  });
});
