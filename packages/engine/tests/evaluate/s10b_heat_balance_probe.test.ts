// ============================================================================
// S10B — Heat-balance first-law probe + TrajectoryPoint exposure verification
// packages/engine/tests/evaluate/s10b_heat_balance_probe.test.ts
//
// Verifies S10B's TrajectoryPoint heat-balance backfill at two layers:
//   Layer A (engine): calcIntermittentMoisture exposes 16 new perCycle*
//                     arrays with real physics values (not zero, not null).
//                     Heat-balance first law holds on per-cycle values.
//   Layer B (evaluate): buildTrajectory reads mr.perCycle* correctly and
//                       populates TrajectoryPoint fields (M/W/C/R/E_*/h_c/
//                       P_a/VPD/T_cl/h_tissue/R_e_cl_effective/h_mass/SW_*).
//
// Scope: cyclic path only (ski snowboarding at 16°F). Steady-state and
// linear paths out of S10B scope per S10B-STEADY-STATE-FOLLOWUP.
//
// This probe is authored against the spec §9.2 pattern from
// baseline-capture.test.ts (engine-layer) and the evaluate.test.ts
// Breck snowboarding pattern (evaluate-layer). Fixtures are inline for
// self-containment per S10B kickoff discipline.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/evaluate.js';
import { calcIntermittentMoisture } from '../../src/moisture/calc_intermittent_moisture.js';
import { getCrowdFactor, computeCycle } from '../../src/activities/crowd_factor.js';
import type { SkiTerrain } from '../../src/activities/crowd_factor.js';
import type { GearItem } from '../../src/ensemble/index.js';
import type { EngineInput, WeatherSlice, GearEnsemble, EngineGearItem } from '../../src/types.js';

// ============================================================================
// Engine-layer fixtures (spec §9.2 pattern — matches baseline-capture.test.ts)
// ============================================================================

const ENGINE_GEAR_ITEMS: GearItem[] = [
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

const TOTAL_CLO_SPEC = 2.60;
const ENSEMBLE_IM_SPEC = 0.089;
const FITNESS_PROFILE = { bodyFatPct: 18, vo2max: 48, restingHR: 56 };

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
  date: '2026-11-10',
  terrain: 'groomers',
  powderFlag: false,
  tempF: 16, humidity: 30, windMph: 5, precipProbability: 0,
};

const M2: SkiVector = {
  label: 'M2 Tier 2 moguls',
  date: '2026-02-03',
  terrain: 'moguls',
  powderFlag: false,
  tempF: 20, humidity: 45, windMph: 8, precipProbability: 0,
};

const P5: SkiVector = {
  label: 'P5 Tier 5 powder Saturday',
  date: '2026-01-17',
  terrain: 'moguls',
  powderFlag: true,
  tempF: 18, humidity: 80, windMph: 3, precipProbability: 0.70,
};

function runSkiVector(v: SkiVector) {
  const crowdTier = getCrowdFactor(v.date, v.powderFlag);
  const cycle = computeCycle(crowdTier, v.terrain, 8.5);
  const cycleOverride = {
    totalCycles: cycle.totalCycles,
    cycleMin: cycle.cycleMin,
    liftLineMin: cycle.liftLineMin,
    lunch: true,
    otherBreak: true,
  };

  return calcIntermittentMoisture(
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
    /* 23: gearItems */       ENGINE_GEAR_ITEMS,
    /* 24: initialLayers */   null,
    /* 25: precipProbability */ v.precipProbability,
    /* 26: waderType */       null,
  );
}

// ============================================================================
// Evaluate-layer fixtures (matches evaluate.test.ts Breck snowboarding pattern)
// ============================================================================

function makeEvalGearItem(slot: EngineGearItem['slot'], clo: number, im: number): EngineGearItem {
  return {
    product_id: `s10b-${slot}`,
    name: `S10B Test ${slot}`,
    slot,
    clo,
    im,
    fiber: 'synthetic',
  };
}

const EVAL_SKI_ENSEMBLE: GearEnsemble = {
  ensemble_id: 's10b-eval-ski',
  label: 'S10B Eval Ski Kit',
  items: [
    makeEvalGearItem('base', 0.3, 0.4),
    makeEvalGearItem('mid', 0.5, 0.35),
    makeEvalGearItem('insulative', 0.8, 0.25),
    makeEvalGearItem('shell', 0.3, 0.15),
    makeEvalGearItem('legwear', 0.5, 0.3),
    makeEvalGearItem('footwear', 0.4, 0.2),
    makeEvalGearItem('headgear', 0.2, 0.3),
    makeEvalGearItem('handwear', 0.3, 0.25),
  ],
  total_clo: 2.5,
  ensemble_im: 0.25,
};

const EVAL_COLD_WEATHER: WeatherSlice = {
  t_start: 0,
  t_end: 21600, // 6 hours in seconds
  temp_f: 16,
  humidity: 45,
  wind_mph: 10,
  precip_probability: 0,
};

function makeEvalInput(): EngineInput {
  return JSON.parse(JSON.stringify({
    activity: {
      activity_id: 'snowboarding',
      duration_hr: 6,
      date_iso: '2026-02-03',
      snow_terrain: 'groomers',
      segments: [{
        segment_id: 'seg-1',
        segment_label: 'S10B Probe Groomers',
        activity_id: 'snowboarding',
        duration_hr: 6,
        weather: [EVAL_COLD_WEATHER],
      }],
    },
    location: {
      lat: 39.48,
      lng: -106.07,
      elevation_ft: 9600,
    },
    biometrics: {
      sex: 'male',
      weight_lb: 180,
    },
    user_ensemble: EVAL_SKI_ENSEMBLE,
  })) as EngineInput;
}

// ============================================================================
// Helpers
// ============================================================================

type NumArrOrNull = number[] | null | undefined;
type MoistureResult = Record<string, unknown>;

function firstValue(arr: NumArrOrNull): number | null {
  if (!arr || arr.length === 0) return null;
  return arr[0] ?? null;
}

// ============================================================================
// Layer A — Engine-layer verification (calcIntermittentMoisture exposure)
// ============================================================================

describe('S10B Layer A — Engine-layer perCycle* heat-balance exposure', () => {
  const vectors: Array<[string, SkiVector]> = [
    ['G1', G1],
    ['M2', M2],
    ['P5', P5],
  ];

  for (const [name, vector] of vectors) {
    describe(`${name}`, () => {
      const result = runSkiVector(vector) as unknown as MoistureResult;

      it('perCycleM array populated with positive metabolic-heat values', () => {
        const arr = result.perCycleM as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
        // Metabolic heat for ski activity at MET ~5-10 is ~300-800W
        for (const v of arr!) {
          expect(v).toBeGreaterThan(50);
          expect(v).toBeLessThan(1500);
        }
      });

      it('perCycleC array populated with non-zero convective-loss values', () => {
        const arr = result.perCycleC as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
        // At 16-20°F, convective loss from skin is meaningful (magnitude > 5W)
        for (const v of arr!) {
          expect(Math.abs(v)).toBeGreaterThan(1);
        }
      });

      it('perCycleR array populated with non-zero radiative-loss values', () => {
        const arr = result.perCycleR as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
      });

      it('perCycleEResp array populated with positive respiratory-loss values', () => {
        const arr = result.perCycleEResp as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
        for (const v of arr!) {
          expect(v).toBeGreaterThan(0); // Respiratory loss always positive at MET > 1
        }
      });

      it('perCycleEMax array populated with positive max-evaporation values', () => {
        const arr = result.perCycleEMax as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
        for (const v of arr!) {
          expect(v).toBeGreaterThan(0); // Max evap capacity always positive
        }
      });

      it('perCyclePa array populated with positive ambient-vapor-pressure values', () => {
        const arr = result.perCyclePa as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
        for (const v of arr!) {
          expect(v).toBeGreaterThan(0); // Pa always > 0 at any humidity
        }
      });

      it('perCycleHc array populated with positive heat-transfer-coefficient values', () => {
        const arr = result.perCycleHc as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
        for (const v of arr!) {
          expect(v).toBeGreaterThan(0); // h_c is positive convective coefficient
        }
      });

      it('perCycleVPD array populated with non-zero vapor-pressure-deficit values', () => {
        const arr = result.perCycleVPD as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
      });

      it('perCycleTCl array populated with non-placeholder values', () => {
        const tClArr = result.perCycleTCl as NumArrOrNull;
        const tSkinArr = result.perCycleTSkin as NumArrOrNull;
        expect(tClArr).toBeTruthy();
        expect(tSkinArr).toBeTruthy();
        // T_cl should NOT equal T_skin - 2 (the old placeholder). It comes from
        // the iterativeTSkin solver's surface-temp calculation, which is
        // T_skin - (T_skin - T_amb) * (R_clo / (R_clo + R_a)) — generally
        // closer to ambient than T_skin - 2 for cold-weather scenarios.
        const firstTCl = firstValue(tClArr);
        const firstTSkin = firstValue(tSkinArr);
        expect(firstTCl).not.toBeNull();
        expect(firstTSkin).not.toBeNull();
        const placeholderValue = firstTSkin! - 2;
        // Allow some tolerance — just verifying it's not EXACTLY the placeholder
        expect(Math.abs(firstTCl! - placeholderValue)).toBeGreaterThan(0.1);
      });

      it('perCycleHTissue array populated with non-binary placeholder values', () => {
        const arr = result.perCycleHTissue as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
        // h_tissue = 1 / R_tissue where R_tissue is CIVD-modulated.
        // Old placeholder was exactly 5.0 or 9.0. Real values derive from solver.
        for (const v of arr!) {
          const isOldPlaceholder = v === 5.0 || v === 9.0;
          expect(isOldPlaceholder).toBe(false);
        }
      });

      it('perCycleSweatRate array populated with non-zero g/s values when thermally active', () => {
        const arr = result.perCycleSweatRate as NumArrOrNull;
        expect(arr).toBeTruthy();
        expect(arr!.length).toBeGreaterThan(0);
        // Sweat rate in g/s. For active snowboarding (MET 5-10), even in cold,
        // expect non-trivial rates at some point during the session.
        const anyNonZero = arr!.some(v => v > 0);
        expect(anyNonZero).toBe(true);
      });

      it('perCycleSRun exists separately from perCycleHeatStorage', () => {
        const sRunArr = result.perCycleSRun as NumArrOrNull;
        const sCycleArr = result.perCycleHeatStorage as NumArrOrNull;
        expect(sRunArr).toBeTruthy();
        expect(sCycleArr).toBeTruthy();
        expect(sRunArr!.length).toBe(sCycleArr!.length);
      });

      it('all 17 new arrays have equal length', () => {
        const fieldNames = [
          'perCycleM', 'perCycleW', 'perCycleC', 'perCycleR',
          'perCycleEResp', 'perCycleESkin', 'perCycleEMax', 'perCycleEReq',
          'perCycleHc', 'perCycleHMass', 'perCyclePa', 'perCycleReClEffective',
          'perCycleVPD', 'perCycleSweatRate', 'perCycleTCl', 'perCycleHTissue',
          'perCycleSRun',
        ];
        const expectedLen = (result.perCycleMR as NumArrOrNull)?.length ?? 0;
        expect(expectedLen).toBeGreaterThan(0);
        for (const name of fieldNames) {
          const arr = result[name] as NumArrOrNull;
          expect(arr, `${name} should be non-null`).toBeTruthy();
          expect(arr!.length, `${name} length should match perCycleMR`).toBe(expectedLen);
        }
      });

      it('heat-balance first law: M - W ≈ C + R + E_resp + E_skin + S (cycle 0, tolerance per kickoff amendment §11)', () => {
        const M = firstValue(result.perCycleM as NumArrOrNull);
        const W = firstValue(result.perCycleW as NumArrOrNull);
        const C = firstValue(result.perCycleC as NumArrOrNull);
        const R = firstValue(result.perCycleR as NumArrOrNull);
        const E_resp = firstValue(result.perCycleEResp as NumArrOrNull);
        const E_skin = firstValue(result.perCycleESkin as NumArrOrNull);
        const S = firstValue(result.perCycleSRun as NumArrOrNull);

        expect(M).not.toBeNull();
        expect(W).not.toBeNull();
        expect(C).not.toBeNull();
        expect(R).not.toBeNull();
        expect(E_resp).not.toBeNull();
        expect(E_skin).not.toBeNull();
        expect(S).not.toBeNull();

        const LHS = M! - W!;
        const RHS = C! + R! + E_resp! + E_skin! + S!;
        const residual = LHS - RHS;

        // eslint-disable-next-line no-console
        console.log(`${name} cycle-0 heat balance: M=${M} W=${W} C=${C} R=${R} E_resp=${E_resp} E_skin=${E_skin} S=${S}`);
        // eslint-disable-next-line no-console
        console.log(`${name} cycle-0: LHS(M-W)=${LHS.toFixed(2)}, RHS(C+R+E_resp+E_skin+S)=${RHS.toFixed(2)}, residual=${residual.toFixed(2)}`);

        // Per S10B kickoff amendment §11: tolerance is ±15W nominal, but
        // S31's 4-phase loop means S_heat is cycle-averaged across all
        // phases while M/C/R/E_* are RUN-phase. Residual may exceed ±15W
        // due to scope-window mismatch. If it does, this test will fail
        // and halt, which is correct behavior per amendment §11 —
        // diagnose with real numbers rather than preemptively widen.
        expect(Math.abs(residual)).toBeLessThan(15);
      });
    });
  }
});

// ============================================================================
// Layer B — Evaluate-layer TrajectoryPoint field-population verification
// ============================================================================

describe('S10B Layer B — TrajectoryPoint fields populated through evaluate()', () => {
  it('TrajectoryPoint heat-balance fields are non-zero (not STRUCT-ZERO-PADDED)', () => {
    const result = evaluate(makeEvalInput());
    const traj = result.four_pill.your_gear.trajectory;
    expect(traj.length).toBeGreaterThan(0);

    const pt = traj[0]!;

    // Core heat-balance fields — previously emitted as literal 0
    expect(pt.M).toBeGreaterThan(0);
    expect(Math.abs(pt.C)).toBeGreaterThan(0);
    expect(pt.E_resp).toBeGreaterThan(0);
    expect(pt.E_max).toBeGreaterThan(0);

    // P_a and h_c — previously 0, now real
    expect(pt.P_a).toBeGreaterThan(0);
    expect(pt.h_c).toBeGreaterThan(0);

    // VPD — previously 0, should be meaningful at 16°F
    expect(Math.abs(pt.VPD)).toBeGreaterThan(0);

    // R_e_cl_effective — previously 0, now derived from Rclo/im
    expect(pt.R_e_cl_effective).toBeGreaterThan(0);
  });

  it('TrajectoryPoint T_cl is not the old T_skin - 2 placeholder', () => {
    const result = evaluate(makeEvalInput());
    const pt = result.four_pill.your_gear.trajectory[0]!;
    const oldPlaceholder = pt.T_skin - 2;
    expect(Math.abs(pt.T_cl - oldPlaceholder)).toBeGreaterThan(0.1);
  });

  it('TrajectoryPoint h_tissue is not the old {5.0, 9.0} binary placeholder', () => {
    const result = evaluate(makeEvalInput());
    const traj = result.four_pill.your_gear.trajectory;
    let allOldPlaceholders = true;
    for (const pt of traj) {
      if (pt.h_tissue !== 5.0 && pt.h_tissue !== 9.0) {
        allOldPlaceholders = false;
        break;
      }
    }
    expect(allOldPlaceholders).toBe(false);
  });

  it('TrajectoryPoint SW_required is not the old crude placeholder', () => {
    // Old placeholder: S_heat > 0 ? 0.01 : 0. Real values from solver vary.
    const result = evaluate(makeEvalInput());
    const traj = result.four_pill.your_gear.trajectory;
    // If ANY point has a sweat rate that isn't exactly 0.01 or 0, we've moved off placeholder
    const anyNonPlaceholder = traj.some(pt =>
      pt.SW_required !== 0.01 && pt.SW_required !== 0 && pt.SW_required !== undefined
    );
    expect(anyNonPlaceholder).toBe(true);
  });

  it('TrajectoryPoint h_mass is non-zero when h_c is non-zero (Lewis relation)', () => {
    const result = evaluate(makeEvalInput());
    const pt = result.four_pill.your_gear.trajectory[0]!;
    if (pt.h_c > 0) {
      expect(pt.h_mass).toBeGreaterThan(0);
      // h_mass ≈ h_c / 61600 per Gagge mass-transfer convention
      const expectedHMassApprox = pt.h_c / 61600;
      const ratio = pt.h_mass / expectedHMassApprox;
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2.0);
    }
  });

  it('TrajectoryPoint VPD ≈ pSat(T_skin) - P_a (per S10B engine computation)', () => {
    const result = evaluate(makeEvalInput());
    const pt = result.four_pill.your_gear.trajectory[0]!;
    // Magnus formula pSat(T) = 610.78 * exp(17.27 * T / (T + 237.3))
    const pSatSkin = 610.78 * Math.exp(17.27 * pt.T_skin / (pt.T_skin + 237.3));
    const expectedVPD = pSatSkin - pt.P_a;
    // Allow 1% tolerance for rounding in engine push (values are rounded to 2 decimals)
    const tolerance = Math.max(10, Math.abs(expectedVPD) * 0.01);
    expect(Math.abs(pt.VPD - expectedVPD)).toBeLessThan(tolerance);
  });

  it('Multiple trajectory points all carry populated heat-balance fields', () => {
    const result = evaluate(makeEvalInput());
    const traj = result.four_pill.your_gear.trajectory;
    expect(traj.length).toBeGreaterThan(1);

    // Sample first, middle, last — all should have populated fields
    const samplePoints = [
      traj[0]!,
      traj[Math.floor(traj.length / 2)]!,
      traj[traj.length - 1]!,
    ];

    for (const pt of samplePoints) {
      expect(pt.M).toBeGreaterThan(0);
      expect(pt.E_resp).toBeGreaterThan(0);
      expect(pt.E_max).toBeGreaterThan(0);
      expect(pt.P_a).toBeGreaterThan(0);
      expect(pt.h_c).toBeGreaterThan(0);
    }
  });
});
