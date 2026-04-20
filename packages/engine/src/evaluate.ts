// ============================================================================
// @lc6/engine — evaluate()
// packages/engine/src/evaluate.ts
//
// Top-level pure function: evaluate(input: EngineInput): EngineOutput
// Architecture v1.1 §1.1 — 8-step pipeline.
//
// Session 10a scope:
//   Steps 1-4: validate, IREQ filter, single-ensemble evaluation, aggregation
//   Steps 5-8: placeholders for Session 10b (multi-ensemble, winner, four-pill)
//
// Per Q1b RATIFIED: reuses calcIntermittentMoisture per-cycle data as
// TrajectoryPoint source. Does NOT duplicate MR computation (Rule #3).
//
// Per RATIFIED supplementary-pass approach: heat balance display terms
// populated from available per-cycle data where possible. Fields requiring
// full heat-balance primitive calls marked TODO-SUPPLEMENTARY for follow-up.
// ============================================================================

import type {
  EngineInput,
  EngineOutput,
  TrajectoryPoint,
  SegmentSummary,
  TripHeadline,
  PillResult,
  FourPill,
  IREQSummary,
  StrategyMetadata,
  GearEnsemble,
  ClinicalStage,
  CdiBasis,
  Regime,
  BindingPathway,
  CmCard,
  CmTriggerState,
  StageDetectionInput,
  GearSlot,
  GearSubslot,
} from './types.js';

import { identifyCriticalMoments, buildStrategyWindows } from './scheduling/index.js';
import { validate } from './validate.js';

// Moisture — THE single source of truth for MR (Cardinal Rule #3)
import { calcIntermittentMoisture } from './moisture/index.js';
import type { IntermittentMoistureResult } from './moisture/index.js';

// IREQ — feasibility filter (Step 2)
import { computeActivityIREQ, DLE_neu, DLE_min, m2KW_to_clo, IREQ_neu, IREQ_min } from './ireq/index.js';
import type { ActivityIREQOutput } from './ireq/index.js';

// CDI v1.4 — stage detection (Step 3)
import {
  detectStage,
  applyStagePromotion,
  applyWithinStageRamp,
  detectShiveringSustained,
  STAGE_TIER_RANGES,
  STAGE_TAU_MAX_HR,
} from './cdi/index.js';

// Ensemble — for GearItem mapping
import type { GearItem as EnsembleGearItem } from './ensemble/index.js';

// Heat balance — for supplementary pass
import {
  civdProtectionFactor,
  shiveringBoost,
  duboisBSA,
  computeHLR,
} from './heat_balance/index.js';

// ── Constants ───────────────────────────────────────────
const ENGINE_VERSION = '0.10.0-alpha'; // Session 10a

// CIVD threshold: values below 1.0 indicate vasoconstriction is active.
// civdProtectionFactor returns 1.0 at normal, decreasing with vasoconstriction.
const CIVD_VASOCONSTRICTION_THRESHOLD = 0.7; // 30% below resting baseline

// ============================================================================
// Top-level: evaluate()
// ============================================================================

/**
 * Evaluate thermal comfort for a trip.
 * Pure function — no side effects, no DOM, no fetch, no storage.
 * Architecture v1.1 §1.1.
 */
export function evaluate(input: EngineInput): EngineOutput {
  // ── Step 1: Validate ──────────────────────────────────
  validate(input);

  // ── Step 2: IREQ feasibility filter ───────────────────
  const ireqSummary = computeIREQSummary(input);

  // ── Step 3-4: Evaluate user ensemble ──────────────────
  const userResult = evaluateSingleEnsemble(input, input.user_ensemble, 'your_gear', false);

  // ── Step 5: Evaluate strategy candidates + select winner (PHY-070c) ──
  //
  // Filter-then-rank hierarchy grounded in published physiological thresholds:
  //   1. HARD CLINICAL FLOOR:  peak CDI ≥ 5 disqualifies absolutely (named impairment)
  //   2. COMFORT/FAILURE GATES: peak MR ≤ 4, peak HLR ≤ 4, peak CDI ≤ 4
  //   3. Rank survivors by argmin peak |TSENS| (Gagge 1986 comfort distance)
  //   4. Tiebreaker 1 (|TSENS| gap < 0.2): argmin peak MR (drier = more robust)
  //   5. Tiebreaker 2 (MR gap < 0.3):     argmin |T_core drift| (most stable)
  //
  // If no candidate passes gates, fall back to "least bad" via lexicographic
  // sort (min peak CDI, then min peak MR, then min peak HLR) with warning flag.
  //
  // Sources: Yoo & Kim 2008 (MR cascade), ACSM 2021/Mayo (CDI clinical stages),
  //          Gagge 1986 (TSENS comfort), ISO 7730 Annex D (neutral skin).

  interface CandidateScore {
    ensemble: GearEnsemble;
    result: PillResult;
    peakCDI: number;
    peakMR: number;
    peakHLR: number;
    peakAbsTSENS: number;
    coreDrift: number;
    stage: ClinicalStage;
  }

  const candidates = input.strategy_candidates ?? [];
  const candidateScores: CandidateScore[] = [];
  let candidatesPostIreq = 0;

  for (const candidate of candidates) {
    // IREQ gate: reject ensembles below IREQ_min
    if (!ireqSummary.user_ensemble_feasible && candidate.total_clo < ireqSummary.ireq_min_clo) {
      continue;
    }
    if (ireqSummary.ireq_min_clo > 0 && candidate.total_clo < ireqSummary.ireq_min_clo) {
      continue;
    }
    candidatesPostIreq++;

    const result = evaluateSingleEnsemble(input, candidate, 'optimal_gear', false);
    const traj = result.trajectory;
    const peakCDI = result.trajectory_summary.peak_CDI;
    const peakMR = traj.length > 0 ? Math.max(...traj.map(p => p.MR)) : 0;
    const peakHLR = traj.length > 0 ? Math.max(...traj.map(p => p.HLR)) : 0;
    const peakAbsTSENS = traj.length > 0 ? Math.max(...traj.map(p => Math.abs(p.TSENS))) : 0;
    const coreStart = traj[0]?.T_core ?? 37;
    const coreEnd = traj[traj.length - 1]?.T_core ?? 37;
    const coreDrift = Math.abs(coreEnd - coreStart);

    candidateScores.push({
      ensemble: candidate,
      result,
      peakCDI,
      peakMR,
      peakHLR,
      peakAbsTSENS,
      coreDrift,
      stage: result.trajectory_summary.peak_clinical_stage,
    });
  }

  // ── PHY-070c selection hierarchy ──
  // Step 1: HARD CLINICAL FLOOR — peak CDI ≥ 5 (named clinical impairment)
  //         These are NEVER recommended without explicit STOP warning.
  const CDI_CLINICAL_FLOOR = 5;
  const MR_COMFORT_CEILING = 4;
  const HLR_COMFORT_CEILING = 4;
  const CDI_COMFORT_CEILING = 4;
  const TSENS_TIEBREAKER_GAP = 0.2;
  const MR_TIEBREAKER_GAP = 0.3;

  // Step 2: COMFORT GATES — all three metrics must be ≤ 4
  const qualified = candidateScores.filter(c =>
    c.peakCDI <= CDI_COMFORT_CEILING &&
    c.peakMR  <= MR_COMFORT_CEILING &&
    c.peakHLR <= HLR_COMFORT_CEILING,
  );

  // Step 3-5: Rank qualified candidates by comfort (|TSENS|) with tiebreakers
  const rankSurvivors = (arr: CandidateScore[]): CandidateScore[] => {
    return [...arr].sort((a, b) => {
      const tsensDiff = a.peakAbsTSENS - b.peakAbsTSENS;
      if (Math.abs(tsensDiff) > TSENS_TIEBREAKER_GAP) return tsensDiff;
      const mrDiff = a.peakMR - b.peakMR;
      if (Math.abs(mrDiff) > MR_TIEBREAKER_GAP) return mrDiff;
      return a.coreDrift - b.coreDrift;
    });
  };

  // Fallback: if no candidate passes comfort gates, rank ALL by lexicographic severity
  //          (min peak CDI → min peak MR → min peak HLR). Flag as warning.
  const rankLeastBad = (arr: CandidateScore[]): CandidateScore[] => {
    return [...arr].sort((a, b) => {
      const cdiDiff = a.peakCDI - b.peakCDI;
      if (cdiDiff !== 0) return cdiDiff;
      const mrDiff = a.peakMR - b.peakMR;
      if (Math.abs(mrDiff) > 0.1) return mrDiff;
      return a.peakHLR - b.peakHLR;
    });
  };

  let winnerResult: PillResult | null = null;
  let winnerEnsemble: GearEnsemble | null = null;
  let winnerPeakCDI: number | null = null;
  let winnerPeakStage: ClinicalStage | null = null;
  let winnerQualified = false;
  let winnerWarnings: string[] = [];

  if (qualified.length > 0) {
    // Normal path: pick best comfort among qualified kits
    const ranked = rankSurvivors(qualified);
    const best = ranked[0]!;
    winnerResult = best.result;
    winnerEnsemble = best.ensemble;
    winnerPeakCDI = best.peakCDI;
    winnerPeakStage = best.stage;
    winnerQualified = true;
  } else if (candidateScores.length > 0) {
    // Fallback: least-bad with warning narrative
    const ranked = rankLeastBad(candidateScores);
    const best = ranked[0]!;
    winnerResult = best.result;
    winnerEnsemble = best.ensemble;
    winnerPeakCDI = best.peakCDI;
    winnerPeakStage = best.stage;
    winnerQualified = false;

    // Build warning narrative based on which thresholds were crossed
    if (best.peakCDI >= CDI_CLINICAL_FLOOR) {
      winnerWarnings.push(
        `STOP: Best available kit produces expected clinical impairment (peak CDI ${best.peakCDI.toFixed(1)}, stage ${best.stage}). Do not proceed without substantial gear change or postponement.`,
      );
    } else if (best.peakCDI > CDI_COMFORT_CEILING) {
      winnerWarnings.push(
        `CDI ${best.peakCDI.toFixed(1)} exceeds comfort threshold — body will work hard to compensate. Monitor for shivering, judgment impairment, or heat stress.`,
      );
    }
    if (best.peakMR > MR_COMFORT_CEILING) {
      winnerWarnings.push(
        `MR ${best.peakMR.toFixed(1)} exceeds saturation threshold — inner layers will become wet. Plan layer swap or warming hut break; expect evaporative chill for remainder of trip.`,
      );
    }
    if (best.peakHLR > HLR_COMFORT_CEILING) {
      winnerWarnings.push(
        `HLR ${best.peakHLR.toFixed(1)} exceeds comfort threshold — sustained cold exposure during stationary phases. Warming breaks recommended; shivering onset likely with prolonged exposure.`,
      );
    }
  }

  // ── Step 6: Four-pill comparison with PHY-072 precognitive CMs ────────
  // Pill 1: User gear, reactive venting
  // Pill 2: User gear + proactive CMs/windows (PHY-072)
  // Pill 3: Optimal gear (winner), reactive venting
  // Pill 4: Optimal gear + proactive CMs/windows (PHY-072)
  const pacingPill: PillResult = {
    ...userResult,
    pill_id: 'pacing',
    uses_pacing: true,
  };

  const optimalPill: PillResult = winnerResult
    ? { ...winnerResult, pill_id: 'optimal_gear' }
    : { ...userResult, pill_id: 'optimal_gear' };

  const bestOutcomePill: PillResult = winnerResult
    ? { ...winnerResult, pill_id: 'best_outcome', uses_pacing: true }
    : { ...userResult, pill_id: 'best_outcome', uses_pacing: true };

  // ── PHY-072: Precognitive Critical Moments + Strategy Windows ──
  // Run optimizer against Pill 1 (user's gear, reactive) — this is the
  // trajectory the user will experience without intervention. CMs identify
  // the <=3 pivotal actions that prevent cumulative damage. Strategy
  // Windows provide 3-5 coherent browseable guidance blocks.
  //
  // Budget is enforced inside identifyCriticalMoments (slice to top 3).
  // For adequate gear, expect 0 CMs (silent trust); for marginal kits,
  // expect 1-2 targeted preventive alerts.
  const criticalMoments = identifyCriticalMoments(userResult.trajectory);
  const strategyWindows = buildStrategyWindows(userResult.trajectory);

  const fourPill: FourPill = {
    your_gear: userResult,
    pacing: pacingPill,
    optimal_gear: optimalPill,
    best_outcome: bestOutcomePill,
  };

  // ── Step 7: Overlays ───────────────────────────────────
  // Fall-In and sleep system deferred per Architecture §4.3

  // ── Step 8: Assemble EngineOutput ─────────────────────
  // Headline uses winner if available, otherwise user gear
  const headlineSource = winnerResult ?? userResult;
  const headline = buildTripHeadline(headlineSource);

  // Update IREQ summary with candidate counts
  ireqSummary.candidates_total = candidates.length;
  ireqSummary.candidates_passing = candidatesPostIreq;

  return {
    trip_headline: headline,
    four_pill: fourPill,
    ireq_summary: ireqSummary,
    strategy: {
      candidates_total: candidates.length,
      candidates_post_ireq: candidatesPostIreq,
      candidates_evaluated: candidateScores.length,
      winner_ensemble_id: winnerEnsemble?.ensemble_id ?? null,
      winner_peak_cdi: winnerPeakCDI,
      winner_peak_stage: winnerPeakStage,
      winner_qualified: winnerQualified,
      winner_warnings: winnerWarnings,
    },
    fall_in: null,    // Deferred per Architecture §4.3
    sleep_system: null, // Deferred per Architecture §4.3
    engine_version: ENGINE_VERSION,
    critical_moments: criticalMoments,
    strategy_windows: strategyWindows,
  };
}


// ============================================================================
// Step 2: IREQ Summary
// ============================================================================

function computeIREQSummary(input: EngineInput): IREQSummary {
  // Use first segment's first weather slice for IREQ computation
  const seg0 = input.activity.segments[0]!;
  const w0 = seg0.weather[0]!;
  const ta_C = (w0.temp_f - 32) * 5 / 9;
  const va_ms = w0.wind_mph * 0.44704;

  const ireqResult = computeActivityIREQ(
    input.activity.activity_id,
    ta_C,
    va_ms,
    w0.humidity,
    { snowTerrain: input.activity.snow_terrain ?? null },
  );

  if (ireqResult.excluded) {
    // Water-primary activities are triaged out of IREQ
    return {
      ireq_min_clo: 0,
      ireq_neu_clo: 0,
      dle_min_hr: null,
      dle_neu_hr: null,
      activity_met_w_m2: 0,
      user_ensemble_feasible: true, // Not applicable, pass through
      candidates_passing: 0,
      candidates_total: 0,
    };
  }

  const userFeasible = input.user_ensemble.total_clo >= ireqResult.ireq_min_clo;

  // Compute DLE if user ensemble is below IREQ_neu
  let dle_min_hr: number | null = null;
  let dle_neu_hr: number | null = null;
  if (input.user_ensemble.total_clo < ireqResult.ireq_neu_clo) {
    // DLE computation needs actual insulation in m²K/W
    const icl_m2kw = input.user_ensemble.total_clo * 0.155;
    const tr = ta_C; // v1: T_mrt = T_air
    const va_eff = Math.max(0.4, va_ms);
    const W = 0; // Default mechanical work = 0

    try {
      dle_neu_hr = DLE_neu(ta_C, tr, va_eff, w0.humidity, ireqResult.M, W, icl_m2kw, 0.38, 50);
      dle_min_hr = DLE_min(ta_C, tr, va_eff, w0.humidity, ireqResult.M, W, icl_m2kw, 0.38, 50);
      // Cap at 8h (consistent with Angelova 2017)
      if (dle_neu_hr > 8) dle_neu_hr = null; // null means unlimited
      if (dle_min_hr !== null && dle_min_hr > 8) dle_min_hr = null;
    } catch {
      // DLE can fail for edge cases (very warm conditions); treat as unlimited
      dle_neu_hr = null;
      dle_min_hr = null;
    }
  }

  return {
    ireq_min_clo: ireqResult.ireq_min_clo,
    ireq_neu_clo: ireqResult.ireq_neu_clo,
    dle_min_hr,
    dle_neu_hr,
    activity_met_w_m2: ireqResult.M,
    user_ensemble_feasible: userFeasible,
    candidates_passing: 0, // TODO-10b
    candidates_total: 0,   // TODO-10b
  };
}


// ============================================================================
// Steps 3-4: Single-ensemble evaluation
// ============================================================================

function evaluateSingleEnsemble(
  input: EngineInput,
  ensemble: GearEnsemble,
  pillId: 'your_gear' | 'pacing' | 'optimal_gear' | 'best_outcome',
  usesPacing: boolean,
): PillResult {
  // For single-segment trips, use the first (only) segment.
  // Multi-segment chaining is a Session 10b+ scope item.
  const seg = input.activity.segments[0]!;
  const w = seg.weather[0]!;

  // ── Call calcIntermittentMoisture ──────────────────────
  // Map EngineInput → 27 positional parameters
  const mrResult = calcIntermittentMoisture(
    /* activity */          input.activity.activity_id,
    /* tempF */             w.temp_f,
    /* humidity */          w.humidity,
    /* windMph */           w.wind_mph,
    /* durationHrs */       seg.duration_hr,
    /* sex */               input.biometrics.sex,
    /* weightLb */          input.biometrics.weight_lb,
    /* paceMul */           input.biometrics.pace_mul ?? null,
    /* ensembleIm */        ensemble.ensemble_im,
    /* snowTerrain */       input.activity.snow_terrain ?? null,
    /* immersionGear */     input.activity.immersion_gear ?? null,
    /* golfCartRiding */    input.activity.golf_cart_riding ?? null,
    /* bcVerticalGainFt */  input.activity.bc_vertical_gain_ft ?? null,
    /* fishWading */        input.activity.fish_wading ?? null,
    /* packLoadMul */       input.pack ? input.pack.weight_lb / 150 : null, // Pandolf load multiplier
    /* kayakType */         input.activity.kayak_type ?? null,
    /* fitnessProfile */    mapFitnessProfile(input),
    /* effInt */            null,  // No effective intensity override
    /* cycleOverride */     null,  // No cycle override in 10a
    /* shellWindRes */      input.shell_wind_resistance ?? null,
    /* ventEvents */        null,  // TODO-10b: map VentEvent[] to expected format
    /* initialTrapped */    null,  // No segment chaining in 10a
    /* totalCLOoverride */  ensemble.total_clo,
    /* gearItems */         mapGearItems(ensemble),
    /* initialLayers */     null,  // No segment chaining in 10a
    /* precipProbability */ input.precip_probability ?? null,
    /* waderType */         input.activity.wader_type ?? null,
  );

  // ── Map per-cycle data → TrajectoryPoint[] ────────────
  const trajectory = buildTrajectory(input, seg, ensemble, mrResult);

  // ── Aggregate → SegmentSummary[] ──────────────────────
  const segments = [aggregateSegment(seg.segment_id, seg.segment_label ?? seg.segment_id, trajectory)];

  // ── Build PillResult ──────────────────────────────────
  const summary = buildTrajectorySnapshot(trajectory);

  return {
    pill_id: pillId,
    ensemble,
    trajectory,
    segments,
    trajectory_summary: summary,
    uses_pacing: usesPacing,
    comfort_hour_escalation: null, // TODO: stationary activity escalation per DEC-013
  };
}


// ============================================================================
// Per-cycle → TrajectoryPoint mapping
// ============================================================================

function buildTrajectory(
  input: EngineInput,
  seg: EngineInput['activity']['segments'][0],
  ensemble: GearEnsemble,
  mr: IntermittentMoistureResult,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const w = seg.weather[0]!;
  const ta_C = (w.temp_f - 32) * 5 / 9;

  // Supplementary pass: resolve activity MET for shiveringBoost
  const _activityMET = resolveActivityMETForSupplementary(input.activity.activity_id);

  // PHY-069 phase-resolution: prefer per-phase data when available
  const phaseCount = mr.perPhaseMR?.length ?? 0;
  const hasPhaseData = phaseCount > 0 && mr.perPhaseHL != null && mr.perPhaseHL.length > 0;
  const cycleCount = mr.perCycleMR?.length ?? 0;

  if (!hasPhaseData && cycleCount === 0) {
    // Steady-state or linear path
    points.push(buildSinglePoint(input, seg, ensemble, mr, 0));
    return points;
  }

  // Iteration bounds
  const iterCount = hasPhaseData ? phaseCount : cycleCount;
  const totalDurS = seg.duration_hr * 3600;
  const phaseDurS = hasPhaseData ? totalDurS / phaseCount : totalDurS / (mr.totalRuns ?? cycleCount);
  const cycleDurS = totalDurS / (mr.totalRuns ?? cycleCount);
  const sliceDurS = hasPhaseData ? phaseDurS : cycleDurS;

  // Shivering history for sustained-shivering detection
  const qShiverHistory: number[] = [];

  for (let j = 0; j < iterCount; j++) {
    // Resolve cycle index and phase entry
    const phaseEntry = hasPhaseData ? mr.perPhaseMR![j]! : null;
    const hlEntry = hasPhaseData ? mr.perPhaseHL![j]! : null;
    const cycleIdx = phaseEntry ? phaseEntry.cycle : j;
    const i = cycleIdx; // legacy alias for per-cycle lookups below
    const t = Math.round(j * sliceDurS);

    // ── Available data — phase-level if present, else per-cycle ──
    const T_skin = mr.perCycleTSkin?.[cycleIdx] ?? 33.0;
    const T_core = mr.perCycleCoreTemp?.[cycleIdx] ?? 37.0;
    // MR: phase-level moisture risk (PHY-069)
    const MR = phaseEntry ? phaseEntry.mr : (mr.perCycleMR?.[cycleIdx] ?? 0);
    // S_heat: PHY-069 signed residual (positive = surplus, negative = deficit)
    // Phase-level resolves the cycle-average masking that hid lift-phase cold stress.
    const S_heat = hlEntry ? hlEntry.residualW : (mr.perCycleHeatStorage?.[cycleIdx] ?? 0);
    const HLR = hlEntry ? hlEntry.hl : (mr.perCycleWetPenalty?.[cycleIdx] ?? 0);
    const civd = mr.perCycleCIVD?.[cycleIdx] ?? 1.0;
    const fatigue = mr.perCycleFatigue?.[cycleIdx] ?? 0;

    // ── Supplementary derivations from available data ──
    // vasoconstriction_active: CIVD < threshold means constriction engaged
    const vasoconstriction_active = civd < CIVD_VASOCONSTRICTION_THRESHOLD;

    // Q_shiver: SUPPLEMENTARY PASS — real shiveringBoost (Young et al. 1986)
    // Phase-aware MET: lift/wait/rest phases use ~30% of activity MET (EPOC decayed)
    const _bsa = duboisBSA(input.biometrics.weight_lb);
    const _bodyFatPct = input.biometrics.body_fat_pct ?? 20;
    const _tissueCLO = 0.6;
    const _isLowPhase = phaseEntry ? (phaseEntry.phase === 'lift' || phaseEntry.phase === 'wait' || phaseEntry.phase === 'rest') : false;
    const _phaseMET = _isLowPhase ? Math.max(1.5, _activityMET * 0.3) : _activityMET;
    const _shivMETs = shiveringBoost(ta_C, _phaseMET, ensemble.total_clo + _tissueCLO, _bodyFatPct);
    const Q_shiver = _shivMETs * 58.2 * _bsa;

    // Track shivering history for sustained detection
    qShiverHistory.push(Q_shiver);
    const sliceDurMin = sliceDurS / 60;
    const shiverResult = detectShiveringSustained({
      q_shiver_history: qShiverHistory,
      slice_duration_min: sliceDurMin,
    });

    // Sweat rate: TODO-SUPPLEMENTARY — full pass would call computeSweatRate.
    // For 10a, estimate from MR regime.
    const sweat_rate = S_heat > 0 ? 0.01 : 0; // crude placeholder
    const SW_max = 0.03; // g/s, typical max (TODO-SUPPLEMENTARY)

    // T_core projection for next cycle (not next phase)
    const T_core_next = (cycleIdx < cycleCount - 1 && mr.perCycleCoreTemp?.[cycleIdx + 1] != null)
      ? mr.perCycleCoreTemp[cycleIdx + 1]!
      : T_core;

    // dT/dt estimates (per-cycle scale, not per-phase)
    const T_core_prev = (cycleIdx > 0 && mr.perCycleCoreTemp?.[cycleIdx - 1] != null) ? mr.perCycleCoreTemp[cycleIdx - 1]! : T_core;
    const dT_core_dt = cycleDurS > 0 ? (T_core - T_core_prev) / (cycleDurS / 3600) : 0;
    const T_skin_prev = (cycleIdx > 0 && mr.perCycleTSkin?.[cycleIdx - 1] != null) ? mr.perCycleTSkin[cycleIdx - 1]! : T_skin;
    const dT_skin_dt = cycleDurS > 0 ? (T_skin - T_skin_prev) / (cycleDurS / 3600) : 0;

    // T_skin smoothed (3-point trailing average on per-cycle data)
    const smoothWindow = Math.min(3, cycleIdx + 1);
    let smoothSum = 0;
    for (let si = cycleIdx - smoothWindow + 1; si <= cycleIdx; si++) {
      smoothSum += mr.perCycleTSkin?.[Math.max(0, si)] ?? T_skin;
    }
    const T_skin_smoothed = smoothSum / smoothWindow;
    const dT_skin_dt_smoothed = cycleIdx >= 2
      ? (T_skin_smoothed - (mr.perCycleTSkin?.[cycleIdx - 2] ?? T_skin)) / ((2 * cycleDurS) / 3600)
      : dT_skin_dt;

    // ── CDI Stage Detection (v1.4 §4.2) ──────────────────
    const stageInput: StageDetectionInput = {
      T_core,
      T_skin,
      S: S_heat,
      Q_shiver,
      q_shiver_sustained: shiverResult.q_shiver_sustained,
      shivering_ceased_involuntarily: shiverResult.shivering_ceased_involuntarily,
      vasoconstriction_active,
      sweat_rate,
      SW_max,
      T_core_projected_next_slice: T_core_next,
      cognitive_impairment_observed: false, // v1: T_core >= 40 is proxy
    };

    const stageResult = detectStage(stageInput);

    // ── Within-stage CDI ramp (v1.4 §4.3) ────────────────
    // tau_to_next_stage: estimated from dT_core_dt and threshold distances
    const tau_to_next = estimateTauToNext(stageResult.stage, T_core, dT_core_dt);
    const stageTauMax = STAGE_TAU_MAX_HR[stageResult.stage] ?? null;

    // Apply stage promotion if within 15-min threshold
    const effectiveStage = applyStagePromotion(stageResult.stage, tau_to_next);

    // Compute CDI from stage floor + progression ramp
    const rampResult = applyWithinStageRamp({
      stage: effectiveStage,
      tau_to_next_stage: tau_to_next,
      stage_tau_max: stageTauMax,
    });

    // ── Regime and binding pathway ────────────────────────
    const regime: Regime = stageResult.regime;
    const binding_pathway: BindingPathway =
      MR > 3 && HLR > 3 ? 'compound' :
      MR > HLR ? 'moisture' :
      HLR > MR ? 'heat_loss' :
      'neutral';

    // ── CM trigger states ─────────────────────────────────
    const cm_trigger = {
      cold_core: buildTriggerState(T_core <= 35.0, T_core, T_core_next, 35.0, 'below', sliceDurS),
      cold_dex: buildTriggerState(T_skin <= 28.0, T_skin, T_skin, 28.0, 'below', sliceDurS),
      heat_core: buildTriggerState(T_core >= 38.5, T_core, T_core_next, 38.5, 'above', sliceDurS),
      shivering_sustained: {
        threshold_crossed: shiverResult.q_shiver_sustained,
        projected_crossing_eta: null, // Not projectable
      },
    };

    // ── τ values ──────────────────────────────────────────
    const tau_core_cold = dT_core_dt < 0 ? (T_core - 35.0) / Math.abs(dT_core_dt) : null;
    const tau_dex = dT_skin_dt < 0 ? (T_skin - 28.0) / Math.abs(dT_skin_dt) : null;
    const tau_core_hot = dT_core_dt > 0 ? (38.5 - T_core) / dT_core_dt : null;
    const tau_impair = computeTauImpair(stageResult.stage, T_core, dT_core_dt);

    // ── Assemble TrajectoryPoint ──────────────────────────
    // PHY-070b: Gagge 1986 thermal sensation (comfort metric)
    // Coefficients: Gagge/Fobelets/Berglund 1986 (ASHRAE Trans 92(2B):709-731)
    // Neutral skin: ISO 7730 Annex D equation C.1 (activity-dependent)
    const TSENS_ALPHA = 0.4305;
    const TSENS_BETA = 0.0905;
    const T_CORE_NEUTRAL = 36.8;
    const _M_Wm2_tsens = _phaseMET * 58.2;
    const T_skin_neutral = 35.7 - 0.0275 * _M_Wm2_tsens;
    const TSENS = TSENS_ALPHA * (T_skin - T_skin_neutral) + TSENS_BETA * (T_core - T_CORE_NEUTRAL);

    const point: TrajectoryPoint = {
      t,
      segment_id: seg.segment_id,

      T_skin,
      T_skin_smoothed,
      dT_skin_dt,
      dT_skin_dt_smoothed,
      T_core,
      dT_core_dt,
      T_cl: T_skin - 2, // TODO-SUPPLEMENTARY: from iterativeTSkin convergence
      h_tissue: vasoconstriction_active ? 5.0 : 9.0, // TODO-SUPPLEMENTARY: from Gagge solve

      // Heat balance terms — TODO-SUPPLEMENTARY: from second-pass primitives
      M: 0,
      W: 0,
      C: 0,
      R: 0,
      E_resp: 0,
      E_skin: 0,
      E_max: 0,
      E_req: 0,
      S: S_heat,
      S_net: S_heat - Q_shiver, // S after shivering compensation
      SW_required: sweat_rate,
      Q_shiver,

      V_effective: w.wind_mph * 0.44704,
      h_c: 0, // TODO-SUPPLEMENTARY
      h_mass: 0, // TODO-SUPPLEMENTARY
      T_air: ta_C,
      T_mrt: ta_C, // v1: T_mrt = T_air
      RH: w.humidity,
      P_a: 0, // TODO-SUPPLEMENTARY

      R_clo_effective: ensemble.total_clo * 0.155, // clo → m²K/W
      R_e_cl_effective: 0, // TODO-SUPPLEMENTARY
      im_system: ensemble.ensemble_im,
      VPD: 0, // TODO-SUPPLEMENTARY

      MR,
      HLR,
      CDI: rampResult.cdi,
      regime,
      binding_pathway,

      clinical_stage: effectiveStage,
      cdi_basis: rampResult.cdi_basis,
      tau_to_next_stage: tau_to_next,
      q_shiver_sustained: shiverResult.q_shiver_sustained,

      tau_core_cold: tau_core_cold !== null && tau_core_cold > 0 ? tau_core_cold : null,
      tau_dex: tau_dex !== null && tau_dex > 0 ? tau_dex : null,
      tau_core_hot: tau_core_hot !== null && tau_core_hot > 0 ? tau_core_hot : null,
      tau_impair,

      cm_trigger,

      phase: phaseEntry ? phaseEntry.phase : 'cycle',
      TSENS: Math.round(TSENS * 100) / 100,
    };

    points.push(point);
  }

  return points;
}


// ============================================================================
// Single-point builder (for steady-state/linear paths with no per-cycle data)
// ============================================================================

function buildSinglePoint(
  input: EngineInput,
  seg: EngineInput['activity']['segments'][0],
  ensemble: GearEnsemble,
  mr: IntermittentMoistureResult,
  t: number,
): TrajectoryPoint {
  const w = seg.weather[0]!;
  const ta_C = (w.temp_f - 32) * 5 / 9;
  const neutralTrigger: CmTriggerState = { threshold_crossed: false, projected_crossing_eta: null };

  return {
    t,
    segment_id: seg.segment_id,
    T_skin: 33.0,
    T_skin_smoothed: 33.0,
    dT_skin_dt: 0,
    dT_skin_dt_smoothed: 0,
    T_core: 37.0,
    dT_core_dt: 0,
    T_cl: 31.0,
    h_tissue: 9.0,
    M: 0, W: 0, C: 0, R: 0, E_resp: 0, E_skin: 0, E_max: 0, E_req: 0,
    S: 0, S_net: 0, SW_required: 0, Q_shiver: 0,
    V_effective: w.wind_mph * 0.44704,
    h_c: 0, h_mass: 0,
    T_air: ta_C, T_mrt: ta_C, RH: w.humidity, P_a: 0,
    R_clo_effective: ensemble.total_clo * 0.155,
    R_e_cl_effective: 0,
    im_system: ensemble.ensemble_im,
    VPD: 0,
    MR: mr.sessionMR,
    HLR: 0,
    CDI: mr.sessionMR > 5 ? mr.sessionMR * 0.8 : mr.sessionMR * 0.5,
    TSENS: 0, // PHY-070b: steady-state path doesn't differentiate comfort by phase
    regime: 'neutral',
    binding_pathway: mr.sessionMR > 3 ? 'moisture' : 'neutral',
    clinical_stage: 'thermal_neutral',
    cdi_basis: 'current_stage',
    tau_to_next_stage: null,
    q_shiver_sustained: false,
    tau_core_cold: null,
    tau_dex: null,
    tau_core_hot: null,
    tau_impair: 8,
    cm_trigger: {
      cold_core: neutralTrigger,
      cold_dex: neutralTrigger,
      heat_core: neutralTrigger,
      shivering_sustained: neutralTrigger,
    },
    phase: 'steady',
  };
}


// ============================================================================
// Segment aggregation
// ============================================================================

function aggregateSegment(
  segId: string,
  segLabel: string,
  points: TrajectoryPoint[],
): SegmentSummary {
  let peak_MR = 0, peak_MR_at_t = 0;
  let peak_HLR = 0, peak_HLR_at_t = 0;
  let peak_CDI = 0, peak_CDI_at_t = 0;
  let peak_clinical_stage: ClinicalStage = 'thermal_neutral';
  let peak_cdi_basis: CdiBasis = 'current_stage';
  let peak_binding_pathway: BindingPathway = 'neutral';
  let peak_regime: Regime = 'neutral';

  // Stage severity ordering for peak detection
  const stageSeverity: Record<ClinicalStage, number> = {
    thermal_neutral: 0,
    cold_compensable: 1, heat_compensable: 1,
    cold_intensifying: 2, heat_intensifying: 2,
    mild_hypothermia: 3, heat_exhaustion: 3,
    mild_hypothermia_deteriorating: 4, heat_exhaustion_deteriorating: 4,
    severe_hypothermia: 5, heat_stroke: 5,
  };

  const cmCards: CmCard[] = [];

  for (const p of points) {
    if (p.MR > peak_MR) { peak_MR = p.MR; peak_MR_at_t = p.t; }
    if (p.HLR > peak_HLR) { peak_HLR = p.HLR; peak_HLR_at_t = p.t; }
    if (p.CDI > peak_CDI) {
      peak_CDI = p.CDI;
      peak_CDI_at_t = p.t;
      peak_cdi_basis = p.cdi_basis;
      peak_binding_pathway = p.binding_pathway;
      peak_regime = p.regime;
    }
    if (stageSeverity[p.clinical_stage] > stageSeverity[peak_clinical_stage]) {
      peak_clinical_stage = p.clinical_stage;
    }

    // CM card generation: MR saturation threshold at 4.0
    if (p.MR >= 4.0 && (cmCards.length === 0 || cmCards[cmCards.length - 1]!.trigger_type !== 'mr_saturation')) {
      cmCards.push({
        card_id: `cm-mr-${p.t}`,
        trigger_type: 'mr_saturation',
        fired_at_t: p.t,
        severity: p.MR >= 7 ? 'high' : p.MR >= 5 ? 'moderate' : 'elevated',
        copy: '', // Q4b: defer card copy assembly
        mitigation_type: 'moisture',
        activity_specific_imperative: '', // Q4b: defer
        clinical_stage_context: p.clinical_stage,
      });
    }

    // CM: stage-anchored cards
    if (p.clinical_stage === 'mild_hypothermia' || p.clinical_stage === 'mild_hypothermia_deteriorating') {
      const trigType = p.clinical_stage === 'mild_hypothermia' ? 'mild_hypothermia_active' as const : 'mild_hypothermia_deteriorating' as const;
      if (!cmCards.some(c => c.trigger_type === trigType)) {
        cmCards.push({
          card_id: `cm-${trigType}-${p.t}`,
          trigger_type: trigType,
          fired_at_t: p.t,
          severity: p.clinical_stage === 'mild_hypothermia' ? 'moderate' : 'high',
          copy: '',
          mitigation_type: 'layer',
          activity_specific_imperative: '',
          clinical_stage_context: p.clinical_stage,
        });
      }
    }

    // CM: threshold crossings
    if (p.cm_trigger.cold_core.threshold_crossed && !cmCards.some(c => c.trigger_type === 'cold_core_threshold')) {
      cmCards.push({
        card_id: `cm-cold-core-${p.t}`,
        trigger_type: 'cold_core_threshold',
        fired_at_t: p.t,
        severity: 'high',
        copy: '',
        mitigation_type: 'shelter',
        activity_specific_imperative: '',
        clinical_stage_context: p.clinical_stage,
      });
    }
    if (p.cm_trigger.heat_core.threshold_crossed && !cmCards.some(c => c.trigger_type === 'heat_core_threshold')) {
      cmCards.push({
        card_id: `cm-heat-core-${p.t}`,
        trigger_type: 'heat_core_threshold',
        fired_at_t: p.t,
        severity: 'high',
        copy: '',
        mitigation_type: 'cool',
        activity_specific_imperative: '',
        clinical_stage_context: p.clinical_stage,
      });
    }
  }

  const startT = points.length > 0 ? points[0]!.t : 0;
  const endT = points.length > 0 ? points[points.length - 1]!.t : 0;

  return {
    segment_id: segId,
    segment_label: segLabel,
    start_t: startT,
    end_t: endT,
    peak_MR,
    peak_MR_at_t,
    peak_HLR,
    peak_HLR_at_t,
    peak_CDI,
    peak_CDI_at_t,
    peak_binding_pathway,
    peak_regime,
    peak_clinical_stage,
    peak_cdi_basis,
    cm_cards_fired: cmCards,
    is_stationary: false, // TODO: check MET < 2.0 for DEC-013
  };
}


// ============================================================================
// TripHeadline builder
// ============================================================================

function buildTripHeadline(pill: PillResult): TripHeadline {
  const segs = pill.segments;
  let peak_MR = 0, peak_HLR = 0, peak_CDI = 0;
  let peak_CDI_segment_id = '';
  let peak_clinical_stage: ClinicalStage = 'thermal_neutral';
  let cm_card_count = 0;
  let cold_count = 0, heat_count = 0, neutral_count = 0;
  const totalPoints = pill.trajectory.length || 1;

  const stageSeverity: Record<ClinicalStage, number> = {
    thermal_neutral: 0,
    cold_compensable: 1, heat_compensable: 1,
    cold_intensifying: 2, heat_intensifying: 2,
    mild_hypothermia: 3, heat_exhaustion: 3,
    mild_hypothermia_deteriorating: 4, heat_exhaustion_deteriorating: 4,
    severe_hypothermia: 5, heat_stroke: 5,
  };

  for (const s of segs) {
    if (s.peak_MR > peak_MR) peak_MR = s.peak_MR;
    if (s.peak_HLR > peak_HLR) peak_HLR = s.peak_HLR;
    if (s.peak_CDI > peak_CDI) { peak_CDI = s.peak_CDI; peak_CDI_segment_id = s.segment_id; }
    if (stageSeverity[s.peak_clinical_stage] > stageSeverity[peak_clinical_stage]) {
      peak_clinical_stage = s.peak_clinical_stage;
    }
    cm_card_count += s.cm_cards_fired.length;
  }

  for (const p of pill.trajectory) {
    if (p.regime === 'cold') cold_count++;
    else if (p.regime === 'heat') heat_count++;
    else neutral_count++;
  }

  return {
    peak_MR,
    peak_HLR,
    peak_CDI,
    peak_CDI_segment_id,
    peak_clinical_stage,
    binding_pathway: pill.trajectory_summary.binding_pathway,
    regime_mix: {
      cold_fraction: cold_count / totalPoints,
      heat_fraction: heat_count / totalPoints,
      neutral_fraction: neutral_count / totalPoints,
    },
    total_duration_hr: pill.segments.reduce((sum, s) => sum + (s.end_t - s.start_t) / 3600, 0),
    cm_card_count,
    named_impairment_stage_reached: stageSeverity[peak_clinical_stage] >= 3,
    edge_of_scope_triggered: peak_CDI >= 9.5,
  };
}

function buildTrajectorySnapshot(points: TrajectoryPoint[]) {
  let peak_MR = 0, peak_HLR = 0, peak_CDI = 0;
  let peak_clinical_stage: ClinicalStage = 'thermal_neutral';
  let binding = points[0]?.binding_pathway ?? 'neutral' as BindingPathway;
  let regime = points[0]?.regime ?? 'neutral' as Regime;

  const stageSeverity: Record<ClinicalStage, number> = {
    thermal_neutral: 0,
    cold_compensable: 1, heat_compensable: 1,
    cold_intensifying: 2, heat_intensifying: 2,
    mild_hypothermia: 3, heat_exhaustion: 3,
    mild_hypothermia_deteriorating: 4, heat_exhaustion_deteriorating: 4,
    severe_hypothermia: 5, heat_stroke: 5,
  };

  for (const p of points) {
    if (p.MR > peak_MR) peak_MR = p.MR;
    if (p.HLR > peak_HLR) peak_HLR = p.HLR;
    if (p.CDI > peak_CDI) { peak_CDI = p.CDI; binding = p.binding_pathway; regime = p.regime; }
    if (stageSeverity[p.clinical_stage] > stageSeverity[peak_clinical_stage]) {
      peak_clinical_stage = p.clinical_stage;
    }
  }

  return { peak_MR, peak_HLR, peak_CDI, peak_clinical_stage, binding_pathway: binding, regime };
}


// ============================================================================
// Helper functions
// ============================================================================

/**
 * Inverse of gear/adapter.ts warmthToCLO.
 * calcIntermittentMoisture reads warmthRatio (1-10) to sum gear CLO internally.
 * Without this, _gearCLO = 0 and _baseCLO floors at 0.30 — entire dynamic CLO path breaks.
 */
function cloToWarmthRatio(clo: number): number {
  if (clo <= 0.30) return Math.max(1, clo / 0.06);
  if (clo <= 0.50) return 5 + (clo - 0.30) / 0.10;
  return Math.min(10, 7 + (clo - 0.50) / 0.17);
}

/**
 * Map categorical weight tier → representative grams per slot.
 *
 * CITATION: Compiled internet search and AI search, April 19 2026.
 * Backpacking/alpine community ranges for Men's Medium, corroborated by
 * Adventure Alan / YouTube / Facebook outdoor gear community sources.
 * Both sets agree within normal variance.
 *
 * Midpoint convention: each tier is the midpoint of its range.
 * For "ultralight" (which is an open-ended "< X" bin), uses 0.8 × tier ceiling.
 *
 * These are seed values for the moisture-capacity pipeline. When affiliate
 * partner data provides actual garment weights (numeric grams), those values
 * supersede this table. Peer matching can also impute weight_category when
 * missing on a product (see adapter.ts imputeAttributes, weight uses modeOf).
 *
 * SKIP slots: footwear, sleeping_bag, sleeping_pad, immersion — these use
 * different physics paths (boots/sleep/water) and do not flow through the
 * per-layer moisture-capacity calculation.
 */
function weightCategoryToGrams(
  category: "ultralight" | "light" | "mid" | "heavy" | undefined,
  slot: GearSlot,
  subslot?: GearSubslot,
): number {
  if (!category) {
    // No categorical input — fall back to slot median.
    // Values = midpoint of 'light' tier per slot (reasonable typical gear).
    const slotFallback: Partial<Record<GearSlot, number>> = {
      base: 160, mid: 265, insulative: 295, shell: 255,
      legwear: 295, headgear: 40, handwear: 55, neck: 40,
    };
    return slotFallback[slot] ?? 200;
  }

  // Legwear uses subslot to pick the right sub-table.
  if (slot === 'legwear') {
    // Shell pants: lower_ski_shell, lower_shell
    if (subslot === 'lower_ski_shell' || subslot === 'lower_shell') {
      const t = { ultralight: 110, light: 210, mid: 355, heavy: 510 };
      return t[category];
    }
    // Leg base: lower_base
    if (subslot === 'lower_base') {
      const t = { ultralight: 90, light: 155, mid: 210, heavy: 320 };
      return t[category];
    }
    // Everything else (pants, insulated, bike, unspecified): use Pants values
    const t = { ultralight: 180, light: 295, mid: 425, heavy: 610 };
    return t[category];
  }

  // Upper body + accessories
  const tables: Partial<Record<GearSlot, Record<"ultralight" | "light" | "mid" | "heavy", number>>> = {
    base:       { ultralight: 90,  light: 160, mid: 225, heavy: 320 },
    mid:        { ultralight: 160, light: 265, mid: 395, heavy: 570 },
    insulative: { ultralight: 180, light: 295, mid: 440, heavy: 640 },
    shell:      { ultralight: 135, light: 255, mid: 410, heavy: 610 },
    headgear:   { ultralight: 20,  light: 40,  mid: 70,  heavy: 115 },
    handwear:   { ultralight: 25,  light: 55,  mid: 110, heavy: 190 },
    neck:       { ultralight: 25,  light: 40,  mid: 70,  heavy: 115 },
  };
  return tables[slot]?.[category] ?? 200;
}

/** Map EngineGearItem[] to ensemble module's GearItem format. */
function mapGearItems(ensemble: GearEnsemble): EnsembleGearItem[] {
  return ensemble.items.map(item => ({
    slot: item.slot,
    im: item.im,
    warmth: item.clo,
    warmthRatio: cloToWarmthRatio(item.clo),  // required by calcIntermittentMoisture _gearCLO sum
    weightG: weightCategoryToGrams(item.weight_category, item.slot, item.subslot),  // S21: populate from categorical
    breathability: item.breathability ?? 5,
    waterproof: item.waterproof ?? 0,
    windResist: item.wind_resistance ?? 3,
    fiber: item.fiber ?? 'synthetic',
    wicking: item.wicking ?? 7,
    name: item.name,
    specConfidence: item.spec_confidence ?? 5,
  } as unknown as EnsembleGearItem));
}

/** Map fitness profile from EngineInput format to calcIntermittentMoisture format. */
function mapFitnessProfile(input: EngineInput) {
  if (!input.biometrics.fitness_profile) return null;
  return {
    bodyFatPct: input.biometrics.body_fat_pct,
    sweatMul: input.biometrics.fitness_profile.sweat_efficiency,
    vo2max: input.biometrics.vo2max,
  };
}

/** Estimate tau_to_next_stage from T_core trajectory and stage thresholds. */
function estimateTauToNext(
  stage: ClinicalStage,
  T_core: number,
  dT_core_dt: number,
): number | null {
  // Terminal stages: no next stage
  if (stage === 'severe_hypothermia' || stage === 'heat_stroke') return null;

  // Cold side: how long until T_core drops to next threshold?
  const coldThresholds: Partial<Record<ClinicalStage, number>> = {
    cold_compensable: 35.5,    // → cold_intensifying
    cold_intensifying: 35.0,   // → mild_hypothermia (via sustained shivering)
    mild_hypothermia: 34.0,    // → mild_hypothermia_deteriorating
    mild_hypothermia_deteriorating: 32.0, // → severe_hypothermia
  };

  // Heat side: how long until T_core rises to next threshold?
  const heatThresholds: Partial<Record<ClinicalStage, number>> = {
    heat_compensable: 37.8,
    heat_intensifying: 38.5,
    heat_exhaustion: 39.5,
    heat_exhaustion_deteriorating: 40.0,
  };

  const coldTarget = coldThresholds[stage];
  if (coldTarget !== undefined && dT_core_dt < -0.01) {
    const hrs = (T_core - coldTarget) / Math.abs(dT_core_dt);
    return hrs > 0 ? hrs : null;
  }

  const heatTarget = heatThresholds[stage];
  if (heatTarget !== undefined && dT_core_dt > 0.01) {
    const hrs = (heatTarget - T_core) / dT_core_dt;
    return hrs > 0 ? hrs : null;
  }

  return null; // Not trending toward threshold
}

/** Compute tau_impair: time to impairment in hours. */
function computeTauImpair(stage: ClinicalStage, T_core: number, dT_core_dt: number): number {
  // Impairment threshold: mild_hypothermia (T_core < 35°C) or heat_exhaustion (T_core > 38.5°C)
  if (dT_core_dt < -0.01) {
    const hrs = (T_core - 35.0) / Math.abs(dT_core_dt);
    return Math.max(0, hrs);
  }
  if (dT_core_dt > 0.01) {
    const hrs = (38.5 - T_core) / dT_core_dt;
    return Math.max(0, hrs);
  }
  return 8; // Stable — no impairment projected within shift
}

/** Build a CmTriggerState from threshold crossing check. */
function buildTriggerState(
  crossed: boolean,
  currentVal: number,
  projectedVal: number,
  threshold: number,
  direction: 'above' | 'below',
  cycleDurS: number,
): CmTriggerState {
  if (crossed) {
    return { threshold_crossed: true, projected_crossing_eta: null };
  }
  // Check if projected value crosses
  if (direction === 'below' && projectedVal <= threshold && currentVal > threshold) {
    return { threshold_crossed: false, projected_crossing_eta: cycleDurS / 3600 };
  }
  if (direction === 'above' && projectedVal >= threshold && currentVal < threshold) {
    return { threshold_crossed: false, projected_crossing_eta: cycleDurS / 3600 };
  }
  return { threshold_crossed: false, projected_crossing_eta: null };
}

/** Resolve approximate activity MET for supplementary shiveringBoost pass. */
function resolveActivityMETForSupplementary(activityId: string): number {
  // Approximate METs from Ainsworth 2011 Compendium.
  // This is for the supplementary pass only — calcIntermittentMoisture
  // uses its own internal MET resolution with full phase profiles.
  const metMap: Record<string, number> = {
    skiing: 5.5, snowboarding: 5.0, cross_country_ski: 7.0,
    hiking: 6.0, day_hike: 5.5, backpacking: 7.0,
    road_cycling: 8.0, gravel_biking: 7.0, mountain_biking: 8.5,
    running: 8.0, trail_running: 9.0,
    golf: 3.5, fishing: 2.5, hunting: 3.0,
    climbing: 5.5, bouldering: 5.0, snowshoeing: 6.5,
    camping: 2.0, kayaking: 5.0, paddle_boarding: 4.0,
  };
  return metMap[activityId] ?? 4.0;
}
