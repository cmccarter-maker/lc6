/**
 * PHY-031 CycleMin Reconciliation — Pre-Patch Baseline Capture
 *
 * PURPOSE: Capture engine output at HEAD 78cd56a under the three reconciliation
 *          spec §9 vectors (G1, M2, P5) and 11 non-ski activities from spec §9.5
 *          criterion #8. These values become the pre-reconciliation regression
 *          anchors used by:
 *            - spec §9.5 criterion #7 (delta attribution verification)
 *            - spec §9.5 criterion #8 (non-ski bit-identical reproduction)
 *
 * SPEC:    LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md
 * KICKOFF: LC6_Planning/session_kickoffs/S31_kickoff.md §2
 *
 * Outputs: console.log structured blocks, one per vector. No physics assertions.
 *          Trivial `expect(result).toBeDefined()` satisfies vitest.
 *
 * Re-run: `pnpm -F @lc6/engine test baseline-capture`
 */

import { describe, it, expect } from 'vitest';
import { calcIntermittentMoisture } from '../../../src/moisture/calc_intermittent_moisture';
import { getCrowdFactor, computeCycle } from '../../../src/activities/crowd_factor';
import type { SkiTerrain } from '../../../src/activities/crowd_factor';
import type { GearItem } from '../../../src/ensemble/index';

// ============================================================================
// Shared fixtures (spec §9.2 gear ensemble + biometrics)
// ============================================================================

const GEAR_ITEMS: GearItem[] = [
  {
    brand: 'Smartwool', model: 'Merino 200gsm long-sleeve crew',
    material: 'merino',
    warmthRatio: 4, breathability: 7, moisture: 8,
    weightG: 220,
  },
  {
    brand: 'Patagonia', model: 'R1 Air Hoody',
    material: 'polyester',
    warmthRatio: 6, breathability: 7, moisture: 6,
    weightG: 320,
  },
  {
    brand: 'Patagonia', model: 'Nano Puff Hoody',
    material: 'polyester',
    warmthRatio: 7, breathability: 5, moisture: 3,
    weightG: 310,
  },
  {
    brand: "Arc'teryx", model: 'Beta LT hardshell',
    material: 'polyester',
    warmthRatio: 1, breathability: 4, moisture: 1,
    weightG: 390,
  },
];

const TOTAL_CLO_SPEC = 2.60;     // spec §9.2 ensemble totals
const ENSEMBLE_IM_SPEC = 0.089;  // spec §9.2 shell-gated series
const FITNESS_PROFILE = { bodyFatPct: 18, vo2max: 48, restingHR: 56 };

// ============================================================================
// Console helpers
// ============================================================================

function logBaseline(label: string, input: Record<string, unknown>, result: Awaited<ReturnType<typeof calcIntermittentMoisture>>): void {
  const r = result as unknown as Record<string, unknown>;
  console.log(`\n=== ${label} BASELINE (HEAD 78cd56a) ===`);
  console.log(`INPUTS: ${JSON.stringify(input)}`);
  console.log(`sessionMR:          ${r.sessionMR}`);
  console.log(`totalRuns:          ${r.totalRuns ?? 'undef'}`);
  console.log(`goodRunCount:       ${r.goodRunCount ?? 'undef'}`);
  console.log(`yellowRunCount:     ${r.yellowRunCount ?? 'undef'}`);
  console.log(`totalFluidLoss:     ${r.totalFluidLoss ?? 'undef'}`);
  console.log(`fluidLossPerHr:     ${r.fluidLossPerHr ?? 'undef'}`);
  console.log(`timeAtCapHrs:       ${r.timeAtCapHrs}`);
  console.log(`peakSaturationFrac: ${r.peakSaturationFrac}`);
  console.log(`peakHeatBalanceW:   ${r.peakHeatBalanceW}`);
  console.log(`totalHeatBalanceWh: ${r.totalHeatBalanceWh}`);
  console.log(`fatigue:            ${r.fatigue}`);
  console.log(`trapped:            ${r.trapped}`);
  const perCycleMR = r.perCycleMR as number[] | null;
  if (perCycleMR) {
    console.log(`perCycleMR.length:  ${perCycleMR.length}`);
    console.log(`perCycleMR:         ${JSON.stringify(perCycleMR)}`);
  }
  const perCycleHeat = r.perCycleHeatStorage as number[] | null;
  if (perCycleHeat) {
    console.log(`perCycleHeatStorage: ${JSON.stringify(perCycleHeat)}`);
  }
  const endingLayers = r.endingLayers as Array<{buffer:number; cap:number; fiber:string}> | null;
  if (endingLayers) {
    console.log(`Final layer buffers:`);
    for (let i = 0; i < endingLayers.length; i++) {
      const l = endingLayers[i]!;
      const pct = l.cap > 0 ? (l.buffer / l.cap * 100).toFixed(1) : '0.0';
      console.log(`  [${i}] buffer=${l.buffer.toFixed(2)}g cap=${l.cap.toFixed(2)}g fill=${pct}% fiber=${l.fiber}`);
    }
  }
  console.log(`=== END ${label} ===\n`);
}

// ============================================================================
// Ski vector inputs (per reconciliation spec §9.2, §9.3, §9.4)
// ============================================================================

interface SkiVector {
  label: string;
  date: string;
  terrain: SkiTerrain;
  powderFlag: boolean;
  tempF: number;
  humidity: number;
  windMph: number;
  precipProbability: number;
}

const G1: SkiVector = {
  label: 'G1 Ghost Town groomers',
  date: '2026-11-10',      // Tuesday, early-season weekday, Tier 1 fallthrough
  terrain: 'groomers',
  powderFlag: false,
  tempF: 16, humidity: 30, windMph: 5, precipProbability: 0,
};

const M2: SkiVector = {
  label: 'M2 Tier 2 moguls',
  date: '2026-02-03',      // Tuesday, peak season, Tier 2 fallthrough (S-001 anchor)
  terrain: 'moguls',
  powderFlag: false,
  tempF: 20, humidity: 45, windMph: 8, precipProbability: 0,
};

const P5: SkiVector = {
  label: 'P5 Tier 5 powder Saturday',
  date: '2026-01-17',      // Saturday, peak season baseline Tier 4 Busy + powder → Tier 5
  terrain: 'moguls',
  powderFlag: true,
  tempF: 18, humidity: 80, windMph: 3, precipProbability: 0.70,
};

function runSkiVector(v: SkiVector) {
  const crowdTier = getCrowdFactor(v.date, v.powderFlag);
  const cycle = computeCycle(crowdTier, v.terrain, 8.5);
  const cycleOverride = { totalCycles: cycle.totalCycles, cycleMin: cycle.cycleMin };

  const result = calcIntermittentMoisture(
    /* 0: activity */         'snowboarding',
    /* 1: tempF */            v.tempF,
    /* 2: humidity */         v.humidity,
    /* 3: windMph */          v.windMph,
    /* 4: durationHrs */      8.5,
    /* 5: sex */              'male',
    /* 6: weightLb */         170,
    /* 7: paceMul */          1.0,
    /* 8: ensembleIm */       ENSEMBLE_IM_SPEC,
    /* 9: snowTerrain */      v.terrain,
    /* 10: immersionGear */   null,
    /* 11: golfCartRiding */  false,
    /* 12: bcVerticalGainFt */ 0,
    /* 13: fishWading */      false,
    /* 14: packLoadMul */     1.0,
    /* 15: kayakType */       null,
    /* 16: fitnessProfile */  FITNESS_PROFILE,
    /* 17: effInt */          'moderate',
    /* 18: cycleOverride */   cycleOverride,
    /* 19: shellWindRes */    3,
    /* 20: ventEvents */      null,
    /* 21: initialTrapped */  0,
    /* 22: totalCLOoverride */ TOTAL_CLO_SPEC,
    /* 23: gearItems */       GEAR_ITEMS,
    /* 24: initialLayers */   null,
    /* 25: precipProbability */ v.precipProbability,
    /* 26: waderType */       null,
  );

  console.log(`[cycleOverride derivation] crowdTier=${crowdTier} totalCycles=${cycle.totalCycles} cycleMin=${cycle.cycleMin.toFixed(3)}`);

  const inputRecord = {
    date: v.date, powderFlag: v.powderFlag, tempF: v.tempF, humidity: v.humidity,
    windMph: v.windMph, precipProbability: v.precipProbability,
    terrain: v.terrain, durationHrs: 8.5, activity: 'snowboarding',
    totalCLOoverride: TOTAL_CLO_SPEC, ensembleIm: ENSEMBLE_IM_SPEC,
    weightLb: 170, sex: 'male',
  };
  logBaseline(v.label, inputRecord, result);
  return result;
}

// ============================================================================
// Non-ski activities (spec §9.5 criterion #8 bit-identical regression anchors)
// ============================================================================

const NON_SKI_ACTIVITIES = [
  'day_hike', 'backpacking', 'running', 'mountain_biking', 'trail_running',
  'bouldering', 'camping', 'fishing', 'kayaking_lake', 'cycling_road_flat', 'snowshoeing',
];

function runNonSkiActivity(activity: string) {
  const result = calcIntermittentMoisture(
    /* 0: activity */         activity,
    /* 1: tempF */            60,
    /* 2: humidity */         50,
    /* 3: windMph */          5,
    /* 4: durationHrs */      2,
    /* 5: sex */              'male',
    /* 6: weightLb */         170,
    /* 7: paceMul */          1.0,
    /* 8: ensembleIm */       0.40,
    /* 9: snowTerrain */      null,
    /* 10: immersionGear */   null,
    /* 11: golfCartRiding */  false,
    /* 12: bcVerticalGainFt */ 0,
    /* 13: fishWading */      false,
    /* 14: packLoadMul */     1.0,
    /* 15: kayakType */       activity === 'kayaking_lake' ? 'touring' : null,
    /* 16: fitnessProfile */  FITNESS_PROFILE,
    /* 17: effInt */          'moderate',
    /* 18: cycleOverride */   null,
    /* 19: shellWindRes */    3,
    /* 20: ventEvents */      null,
    /* 21: initialTrapped */  0,
    /* 22: totalCLOoverride */ 1.0,
    /* 23: gearItems */       GEAR_ITEMS,
    /* 24: initialLayers */   null,
    /* 25: precipProbability */ 0,
    /* 26: waderType */       null,
  );
  const inputRecord = {
    activity, tempF: 60, humidity: 50, windMph: 5, durationHrs: 2,
    totalCLOoverride: 1.0, ensembleIm: 0.40,
  };
  logBaseline(`NONSKI ${activity}`, inputRecord, result);
  return result;
}

// ============================================================================
// Tests
// ============================================================================

describe('PHY-031 CycleMin Reconciliation — Pre-Patch Baselines (§9 vectors)', () => {
  it('G1 Ghost Town groomers baseline', () => {
    const r = runSkiVector(G1);
    expect(r).toBeDefined();
  });

  it('M2 Tier 2 moguls baseline', () => {
    const r = runSkiVector(M2);
    expect(r).toBeDefined();
  });

  it('P5 Tier 5 powder Saturday baseline', () => {
    const r = runSkiVector(P5);
    expect(r).toBeDefined();
  });
});

describe('PHY-031 CycleMin Reconciliation — Non-ski bit-identical baselines (§9.5 #8)', () => {
  for (const activity of NON_SKI_ACTIVITIES) {
    it(`${activity} baseline`, () => {
      const r = runNonSkiActivity(activity);
      expect(r).toBeDefined();
    });
  }
});
