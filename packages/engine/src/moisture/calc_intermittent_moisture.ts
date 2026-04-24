// calcIntermittentMoisture — THE single source of truth for Moisture Risk (Cardinal Rule #3).
//
// Ported VERBATIM from LC5 risk_functions.js lines 2426-3393 (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment + hand-computed verification.
//
// SESSION 9b SCOPE: Cyclic path only. Steady-state and linear paths stubbed (β1 throw).
// Session 9c will port these remaining paths.
//
// DEC-024 COMPLIANCE: computeRespiratoryHeatLoss call sites convert _humFrac to _humFrac*100.
// Cross-session name mappings applied (MIN_RETAINED→MIN_RETAINED_LITERS, etc.).
//
// Dead code preserved verbatim: PHY040_WATTS_PER_POINT (computed, result discarded in LC5).

// === IMPORTS ===
// Heat balance (Sessions 6-7-9a-9b)
import {
  BASELINE_IM,
  V_BOUNDARY_MPH,
  MIN_RETAINED_LITERS,
  FABRIC_CAPACITY_LITERS,
  DEFAULT_REGAIN_POLYESTER,
  L_V_J_PER_G,
  LC5_T_CORE_BASE,
  LC5_BODY_SPEC_HEAT,
  vpdRatio,
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
  computeTissueCLO,
  computeTSkin,
  iterativeTSkin,
  computeMetabolicHeat,
  computeRespiratoryHeatLoss,
  computeConvectiveHeatLoss,
  computeRadiativeHeatLoss,
  duboisBSA,
  epocParams,
  estimateCoreTemp,
  civdProtectionFactor,
  civdProtectionFromSkin,
  shiveringBoost,
  computeHLR,
  calcElevationHumidity,
  altitudeFactors,
  getMetabolicEfficiency,
} from '../heat_balance/index.js';

// Ensemble (Session 8)
import {
  activityCLO,
  warmthToCLO,
  buildLayerArray,
  computeEffectiveCLO,
  clothingInsulation,
} from '../ensemble/index.js';

import type { GearItem, GearLayer } from '../ensemble/index.js';

// Moisture (Session 9a-9b)
import { computePerceivedMR } from './perceived_mr.js';
import { applySaturationCascade } from './saturation_cascade.js';
// S19: applySaturationCascade wired into sessionMR pipeline
// (previously defined + tested + exported but never called in production —
//  see LC6_Planning/LC6_Master_Tracking.md B.14 S18-CASCADE-NOT-WIRED)
import {
  CROSSOVER_LITERS,
  FATIGUE_PER_MIN,
  RECOVERY_PER_MIN,
  MAX_FATIGUE,
  TAU_CLOTHING,
  GENERIC_LAYER_CAPS,
} from './constants.js';

// Activities (Session 9a-9b)
import {
  waderSplitIm,
  snowSportSplitIm,
  waderEvapFloor,
} from '../activities/split_body.js';
import { descentSpeedWind } from '../activities/descent.js';
import {
  ACTIVITY_SWEAT_PROFILES,
  INTERMITTENT_PHASE_PROFILES,
  GENERIC_GEAR_SCORES_BY_SLOT,
} from '../activities/profiles.js';
// PHY-031-CYCLEMIN-RECONCILIATION v1.2 §4 & §5: 4-phase cycle decomposition constants.
import { TRANSITION_MIN, LINE_MET, TRANSITION_MET } from '../activities/phy031_constants.js';

import type { PhaseProfile, PhaseDefinition } from '../activities/profiles.js';

// Session 9c imports
import { sweatRate } from './sweat_rate.js';
import { elevTempAdj } from '../heat_balance/altitude.js';
import { calcBCPhasePercentages } from '../activities/profiles.js';

// LC5 dead code constant — computed at 2 sites, result discarded in both.
// Preserved verbatim per Cardinal Rule #8. Can be removed in OQ-029 cleanup.
const PHY040_WATTS_PER_POINT = 30;

/**
 * Result type for calcIntermittentMoisture.
 * Per Cardinal Rule #16: this is NOT EngineOutput — it's a function-local type.
 * Future engine integration session maps this onto EngineOutput.
 */
// ============================================================================
// PHY-069 HELPERS — ratified Session 10
// ============================================================================

/**
 * Insensible evaporative heat loss through skin (E_diff).
 * ISO 7730:2005 §C.2 / Fanger 1970 eq. 3.
 *
 * E_diff = 3.05e-3 * (5733 - 6.99*(M-W) - P_a) [W/m²]
 *
 * Constants from Fanger 1970 thermal comfort study (N=1300).
 */
function computeEdiff(M_Wm2: number, W_Wm2: number, P_a_Pa: number, bsa: number): number {
  const ediff_Wm2 = 3.05e-3 * (5733 - 6.99 * (M_Wm2 - W_Wm2) - P_a_Pa);
  return Math.max(0, ediff_Wm2 * bsa);
}

/**
 * Cutaneous tissue thermal resistance as a function of CIVD vasoconstriction.
 * Interpolates between dilated (Burton 1935, Hardy 1938) and constricted
 * (Fanger 1970, Parsons 2003) endpoints using the Flouris & Cheung 2008
 * CIVD curve from civdProtectionFactor.
 *
 * @param civd CIVD protection factor [0,1]: 0=dilated, 1=fully constricted
 * @returns R_tissue in m²K/W
 */
function computeRtissueFromCIVD(civd: number): number {
  const CLO_DILATED = 0.30;     // Burton 1935, Hardy 1938
  const CLO_CONSTRICTED = 0.80; // Fanger 1970, Parsons 2003
  const clampedCivd = Math.max(0, Math.min(1, civd));
  const tissueCloEffective = CLO_DILATED + clampedCivd * (CLO_CONSTRICTED - CLO_DILATED);
  return tissueCloEffective * 0.155; // clo → m²K/W
}

/**
 * Saturation vapor pressure of water (Magnus formula).
 * Returns Pa for use in ISO 7730 E_diff formula.
 *
 * @param T_C temperature in °C
 */
function pSatPa(T_C: number): number {
  return 610.78 * Math.exp(17.27 * T_C / (T_C + 237.3));
}

export interface IntermittentMoistureResult {
  trapped: number;
  sessionMR: number;
  timeAtCapHrs: number;
  layerSat: number[] | null;
  perCycleTrapped: number[] | null;
  perCycleMR: number[] | null;
  perCycleWetPenalty: number[] | null;
  fatigue: number;
  perCycleFatigue: number[] | null;
  perPhaseMR: Array<{phase:string; cycle:number; mr:number; trapped:number}> | null;
  perPhaseHL: Array<{phase:string; cycle:number; hl:number; hlWatts:number; residualW:number; fatigue:number}> | null;
  perCycleHeatStorage: number[] | null;
  peakHeatBalanceW: number;
  peakHeatBalanceDirection: string;
  peakHeatBalanceCycleIdx: number;
  totalHeatBalanceWh: number;
  peakSaturationFrac: number;
  perCycleCoreTemp: number[] | null;
  perCycleCIVD: number[] | null;
  totalFluidLoss: number | null;
  fluidLossPerHr: number | null;
  perCycleTSkin: number[] | null;
  goodRunCount: number | null;
  yellowRunCount: number | null;
  totalRuns: number | null;
  layerBuffers: Array<{name:string; fiber:string; buffer:number; cap:number; fill:number}> | null;
  endingLayers: GearLayer[] | null;
  // Steady-state path fields (Session 9c)
  perStepMR?: number[];
  perStepDist?: number[];
  perStepElev?: number[];
  perStepTrapped?: number[];
  // ── S10B: per-cycle heat-balance terms (cyclic path only) ──
  // All arrays length === wholeCycles when present. null on non-cyclic paths.
  // Values represent end-of-cycle state (after RUN phase) unless noted.
  perCycleM?: number[] | null;         // Metabolic heat production, W (total body)
  perCycleW?: number[] | null;         // Mechanical work output, W (0 for non-cycling activities)
  perCycleC?: number[] | null;         // Convective heat loss, W
  perCycleR?: number[] | null;         // Radiative heat loss, W
  perCycleEResp?: number[] | null;     // Respiratory evaporative heat loss, W
  perCycleESkin?: number[] | null;     // Skin evaporative heat loss (actual), W
  perCycleEMax?: number[] | null;      // Maximum skin evaporative capacity, W
  perCycleEReq?: number[] | null;      // Required skin evaporation, W
  perCycleHc?: number[] | null;        // Convective heat transfer coefficient, W/m²K
  perCycleHMass?: number[] | null;     // Mass transfer coefficient (Lewis relation), m/s
  perCyclePa?: number[] | null;        // Ambient vapor pressure, Pa
  perCycleReClEffective?: number[] | null; // Effective clothing vapor resistance, m²Pa/W
  perCycleVPD?: number[] | null;       // Vapor pressure deficit (skin-to-ambient), Pa
  // ── S10B: supplementary-pass replacements for crude placeholders ──
  perCycleSweatRate?: number[] | null; // Sweat rate, g/s (replaces S_heat > 0 ? 0.01 : 0)
  perCycleTCl?: number[] | null;       // Clothing surface temperature from iterativeTSkin, °C
  perCycleHTissue?: number[] | null;   // Tissue heat transfer coefficient, W/m²K
  perCycleSRun?: number[] | null;      // RUN-phase storage, W (distinct from perCycleHeatStorage which is 4-phase avg)
}

/**
 * Fitness profile input shape.
 */
interface FitnessProfile {
  bodyFatPct?: number;
  sweatMul?: number;
  vo2max?: number;
  restingHR?: number;
  [key: string]: unknown;
}

/**
 * Cycle override input shape.
 */
interface CycleOverride {
  totalCycles?: number;
  liftLineMin?: number;  // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §4.1: tier-derived lift-line wait (minutes). Undefined for non-ski and ski-history short-circuit.
  lunch?: boolean;       // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §6.3/§8.6: gate 45-min shell-off rest at 12:15 PM.
  otherBreak?: boolean;  // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §6.3/§8.6: gate 15-min shell-on rest at 2:30 PM.
  elevFt?: number;
  perRunVertFt?: number;
  dewPointC?: number | null;
  elevProfile?: Array<{dist:number; elev:number}>;
  rawElevProfile?: Array<{dist:number; elev:number}>;
  baseElevFt?: number;
  totalDistMi?: number;
  tripStyle?: string;
  strategyLayerIms?: Array<{slot:string; im:number}>;
  [key: string]: unknown;
}

/**
 * calcIntermittentMoisture — THE single source of truth for Moisture Risk.
 *
 * Orchestrates all thermal engine primitives (PHY-056 solver, sweat model,
 * per-layer buffer, condensation placement, drain, perceived MR) across
 * phased activity profiles.
 *
 * SESSION 9b: cyclic path only. Steady-state and linear paths throw
 * per β1 ratification until Session 9c ports them.
 *
 * LC5 risk_functions.js lines 2426-3393.
 */
export function calcIntermittentMoisture(
  activity: string,
  tempF: number,
  humidity: number,
  windMph: number,
  durationHrs: number,
  sex: string | null | undefined,
  weightLb: number | null | undefined,
  paceMul: number | null | undefined,
  ensembleIm: number | null | undefined,
  snowTerrain: string | null | undefined,
  immersionGear: string | boolean | null | undefined,
  golfCartRiding: boolean | null | undefined,
  bcVerticalGainFt: number | null | undefined,
  fishWading: boolean | null | undefined,
  packLoadMul: number | null | undefined,
  kayakType: string | null | undefined,
  fitnessProfile: FitnessProfile | null | undefined,
  effInt: string | null | undefined,
  cycleOverride: CycleOverride | null | undefined,
  shellWindRes: number | null | undefined,
  ventEvents: Array<number | {time:number; type?:string}> | null | undefined,
  initialTrapped: number | null | undefined,
  totalCLOoverride: number | null | undefined,
  gearItems: GearItem[] | null | undefined,
  initialLayers: GearLayer[] | null | undefined,
  precipProbability: number | null | undefined,
  waderType: string | null | undefined,
): IntermittentMoistureResult {
  const isDrysuit = immersionGear === 'drysuit' || immersionGear === true;
  const _bodyMassKg = ((weightLb ?? 150) * 0.453592);
  const _bsa = duboisBSA(weightLb);

  // === ACTIVITY ROUTING: Resolve phase profile ===
  const isSki = activity === 'skiing' || activity === 'snowboarding';
  let profileKey: string | null;
  if (isSki) {
    if (snowTerrain === 'backcountry') profileKey = 'skiing_bc';
    else {
      profileKey = snowTerrain === 'mixed' ? 'moguls' : (snowTerrain || 'groomers');
    }
  } else if (activity === 'golf') {
    profileKey = golfCartRiding ? 'golf_cart' : 'golf_walk';
  } else if (activity === 'fishing') {
    profileKey = fishWading ? 'fishing_wading' : 'fishing_shore';
  } else if (activity === 'kayaking' || activity === 'paddle_boarding') {
    const kType = kayakType || 'lake';
    if (activity === 'paddle_boarding') {
      profileKey = kType === 'creek' ? 'sup_creek' : kType === 'ocean' ? 'sup_ocean' : 'sup_lake';
    } else {
      profileKey = kType === 'creek' ? 'kayaking_creek' : kType === 'ocean' ? 'kayaking_ocean' : 'kayaking_lake';
    }
  } else if (activity === 'road_cycling') {
    profileKey = snowTerrain === 'hilly' ? 'cycling_road_hilly' : 'cycling_road_flat';
  } else if (activity === 'gravel_biking') {
    profileKey = snowTerrain === 'hilly' ? 'cycling_gravel_hilly' : 'cycling_gravel_flat';
  } else if (activity === 'snowshoeing') {
    profileKey = 'snowshoeing';
  } else {
    profileKey = null;
  }

  let profile: PhaseProfile | null = profileKey ? (INTERMITTENT_PHASE_PROFILES[profileKey] ?? null) : null;

  // PHY-063: Route continuous exertion activities through cyclic engine
  const _continuousActivities: Record<string, boolean> = {
    day_hike: true, hiking: true, backpacking: true, running: true,
    mountain_biking: true, trail_running: true,
  };
  let _mutableCycleOverride = cycleOverride ? { ...cycleOverride } : null;
  if (!profile && _continuousActivities[activity]) {
    const _contInt = effInt || 'moderate';
    const _hikeHrs = Math.max(1, Math.round(durationHrs));
    profile = {
      type: 'cyclic',
      phases: [
        { name: 'run', durMin: 55, intensity: _contInt as PhaseDefinition['intensity'], windType: 'walking', canVent: true },
        { name: 'rest', durMin: 5, intensity: 'low', windType: 'ambient', canVent: true },
      ],
    };
    if (!_mutableCycleOverride) { _mutableCycleOverride = { totalCycles: _hikeHrs }; }
    else if (!_mutableCycleOverride.totalCycles) { _mutableCycleOverride.totalCycles = _hikeHrs; }
  }

  // === STEADY-STATE FALLBACK (PHY-039B, self-contained) ===
  // Activities without phase profiles: bouldering, climbing, camping, hunting, etc.
  // XC ski also routes here (activity='cross_country_ski' has no profile match).
  if (!profile) {
    const _ssCap = getEnsembleCapacity(activity);
    const _ssIsSnow = activity === 'skiing' || activity === 'snowboarding';
    const _ssEffIm = waderType && activity === 'fishing' && fishWading
      ? waderSplitIm(ensembleIm, waderType)
      : _ssIsSnow ? snowSportSplitIm(ensembleIm) : (ensembleIm ?? 0);
    const _ssImF = _ssEffIm ? (_ssEffIm / BASELINE_IM) : 1.0;
    const _ssShellWR = shellWindRes ?? GENERIC_GEAR_SCORES_BY_SLOT.shell!.windResist;
    const _ssWindPen = getWindPenetration(_ssShellWR);
    const _ssVEvap = V_BOUNDARY_MPH + windMph * _ssWindPen;
    const _ssInt = effInt || 'moderate';
    const _hasElev = !!_mutableCycleOverride?.elevProfile && _mutableCycleOverride.elevProfile.length >= 2;
    const _epScaled = _hasElev ? _mutableCycleOverride!.elevProfile! : null;
    const _epGrade = _hasElev ? (_mutableCycleOverride!.rawElevProfile ?? _mutableCycleOverride!.elevProfile!) : null;
    const _dpC = _mutableCycleOverride?.dewPointC ?? null;
    const _baseElev = _hasElev ? (_mutableCycleOverride!.baseElevFt ?? 0) : 0;
    const _totalDist = _hasElev ? (_mutableCycleOverride!.totalDistMi ?? 1) : 0;
    const _tripStyle = _hasElev ? (_mutableCycleOverride!.tripStyle ?? 'out_and_back') : 'out_and_back';
    let _ep = _epScaled;
    let _epR = _epGrade;
    if (_hasElev && _tripStyle === 'out_and_back' && _epScaled && _epGrade) {
      const _maxDist = _epScaled[_epScaled.length - 1]!.dist;
      const _retPts: Array<{dist:number; elev:number}> = [];
      for (let ri = _epScaled.length - 2; ri >= 0; ri--) { _retPts.push({ dist: _maxDist + (_maxDist - _epScaled[ri]!.dist), elev: _epScaled[ri]!.elev }); }
      _ep = _epScaled.concat(_retPts);
      const _rawMaxDist = _epGrade[_epGrade.length - 1]!.dist;
      const _rawRetPts: Array<{dist:number; elev:number}> = [];
      for (let rri = _epGrade.length - 2; rri >= 0; rri--) { _rawRetPts.push({ dist: _rawMaxDist + (_rawMaxDist - _epGrade[rri]!.dist), elev: _epGrade[rri]!.elev }); }
      _epR = _epGrade.concat(_rawRetPts);
    }
    const N = _ep ? Math.max(10, _ep.length) : 20;
    const _midpointIdx = Math.floor(N / 2);
    const _stepDurHrs = durationHrs / N;
    const _stepDurMin = _stepDurHrs * 60;
    let _ssTrapped = initialTrapped ?? 0;
    let _ssTimeAtCap = 0;
    const _perStepMR: number[] = [];
    const _perStepTrapped: number[] = [];
    const _perStepDist: number[] = [];
    const _perStepElev: number[] = [];
    for (let si = 0; si < N; si++) {
      let _localTemp = tempF;
      let _localRH = humidity;
      let _localElev = _baseElev;
      let _isDescending = false;
      if (_ep && si < _ep.length) {
        _localElev = _ep[si]!.elev;
        const _elevGainFromBase = _localElev - (_ep[0] ? _ep[0]!.elev : _baseElev);
        _localTemp = tempF + elevTempAdj(_elevGainFromBase);
        if (_dpC != null) {
          const _localTempC = (_localTemp - 32) * 5 / 9;
          _localRH = calcElevationHumidity(_localTempC, _dpC);
        }
        _isDescending = (_tripStyle === 'out_and_back' && si > _midpointIdx);
        _perStepDist.push(_ep[si]!.dist);
        _perStepElev.push(_localElev);
      } else {
        _perStepDist.push(si * (_totalDist / N));
        _perStepElev.push(_baseElev);
      }
      let _stepGradeFtMi = 0;
      if (_epR && si > 0 && si < _epR.length && _epR[si - 1]) {
        const _rawDistDelta = _epR[si]!.dist - _epR[si - 1]!.dist;
        if (_rawDistDelta > 0.001) { _stepGradeFtMi = Math.abs(_epR[si]!.elev - _epR[si - 1]!.elev) / _rawDistDelta; }
      }
      const _descentMul = _isDescending ? 0.65 : 1.0;
      const _gradeMul = _isDescending ? 1.0 : (_stepGradeFtMi > 1000 ? 1.4 : _stepGradeFtMi > 700 ? 1.25 : _stepGradeFtMi > 400 ? 1.1 : 1.0);
      const _stepSr = sweatRate(_ssInt, _localTemp, _localRH, sex, weightLb, activity, immersionGear, paceMul, golfCartRiding, undefined, snowTerrain, packLoadMul, undefined, fitnessProfile) * (paceMul ?? 1.0) * _descentMul * _gradeMul;
      const _stepSweat = _stepSr * _stepDurHrs / 1000;
      const _localVpd = vpdRatio(_localTemp, _localRH);
      const _stepEvapRaw = (_ssVEvap / 20) * _localVpd * _ssImF;
      const _stepEvapRate = Math.min(0.85, waderEvapFloor(_stepEvapRaw, _localRH, waderType, fishWading));
      const _stepEvap = _stepSweat * _stepEvapRate;
      _ssTrapped += Math.max(0, _stepSweat - _stepEvap);
      if ((precipProbability ?? 0) > 0 && activity !== 'kayaking' && activity !== 'paddle_boarding') {
        _ssTrapped += precipWettingRate(precipProbability ?? 0, _localTemp, _ssShellWR) * _stepDurHrs;
      }
      const _stepDrainGhr = getDrainRate(_localTemp, _localRH, windMph, ensembleIm ?? 0, activityCLO(activity), _bsa || 2.13);
      const _stepDrainL = Math.min(_stepDrainGhr * _stepDurHrs / 1000, _ssTrapped);
      _ssTrapped = Math.max(0, _ssTrapped - _stepDrainL);
      if (_ssTrapped > _ssCap) { _ssTrapped = _ssCap; _ssTimeAtCap += _stepDurHrs; }
      if (ventEvents && ventEvents.length > 0) {
        const _stepStartMin = si * _stepDurMin;
        const _stepEndMin = _stepStartMin + _stepDurMin;
        for (let vi = 0; vi < ventEvents.length; vi++) {
          const _vt = typeof ventEvents[vi] === 'object' ? (ventEvents[vi] as {time:number}).time : ventEvents[vi] as number;
          const _vType = typeof ventEvents[vi] === 'object' ? ((ventEvents[vi] as {type?:string}).type ?? 'vent') : 'vent';
          if (_vt >= _stepStartMin && _vt < _stepEndMin) {
            const _ventEff = _vType === 'lodge' ? 0.85 : (0.60 * Math.max(0.3, Math.min(1.0, (_localTemp - 20) / 40)) * Math.max(0.3, 1.0 - _localRH / 120));
            _ssTrapped *= (1 - _ventEff);
          }
        }
      }
      _perStepTrapped.push(_ssTrapped);
      _perStepMR.push(Math.min(10, Math.round(applySaturationCascade(7.2 * (_ssTrapped / _ssCap)) * 10) / 10));
    }
    let _ssMR = _perStepMR.length > 0 ? Math.max(..._perStepMR) : 0;
    if (_ssTimeAtCap > 0) { _ssMR = Math.min(10, Math.round(applyDurationPenalty(_ssMR, _ssTimeAtCap) * 10) / 10); }
    return {
      trapped: _ssTrapped, sessionMR: _ssMR, timeAtCapHrs: _ssTimeAtCap,
      layerSat: null, perCycleTrapped: null, perCycleMR: null, perCycleWetPenalty: null,
      fatigue: 0, perCycleFatigue: null, perPhaseMR: null, perPhaseHL: null,
      perCycleHeatStorage: null, peakHeatBalanceW: 0, peakHeatBalanceDirection: 'neutral',
      peakHeatBalanceCycleIdx: -1, totalHeatBalanceWh: 0, peakSaturationFrac: 0,
      perCycleCoreTemp: null, perCycleCIVD: null, totalFluidLoss: null, fluidLossPerHr: null,
      perCycleTSkin: null, goodRunCount: null, yellowRunCount: null, totalRuns: null,
      layerBuffers: null, endingLayers: null,
      perStepMR: _perStepMR, perStepDist: _perStepDist, perStepElev: _perStepElev, perStepTrapped: _perStepTrapped,
    };
  }

  // BC skiing: override phase percentages when vertical gain is provided
  if (profileKey === 'skiing_bc' && bcVerticalGainFt && bcVerticalGainFt > 0) {
    const descentRate = snowTerrain === 'backcountry' ? 4000 : 3000;
    const phasePcts = calcBCPhasePercentages(bcVerticalGainFt, descentRate);
    if (phasePcts) {
      profile = { type: 'linear', phases: [
        { name: 'skinning',   pct: phasePcts.skinning,   intensity: 'very_high' as const, windType: 'walking', canVent: true },
        { name: 'transition', pct: phasePcts.transition, intensity: 'low' as const,       windType: 'ridge',   canVent: true },
        { name: 'descent',    pct: phasePcts.descent,    intensity: 'high' as const,      windType: 'speed',   canVent: false },
      ]};
    }
  }

  const totalMin = durationHrs * 60;
  const sweatProfile = ACTIVITY_SWEAT_PROFILES[activity] ?? ACTIVITY_SWEAT_PROFILES.hiking!;

  // PHY-052: split-body im
  const _ppIsSnow = activity === 'skiing' || activity === 'snowboarding';
  const _effectiveIm = waderType && activity === 'fishing' && fishWading
    ? waderSplitIm(ensembleIm, waderType)
    : _ppIsSnow ? snowSportSplitIm(ensembleIm) : (ensembleIm ?? 0);
  const imFactor = _effectiveIm ? (_effectiveIm / BASELINE_IM) : 1.0;
  const cloFactor = clothingInsulation(tempF, effInt || 'moderate');
  const drysuitEvapBlock = isDrysuit ? 0.15 : 1.0;

  // === CLOSURES: phaseSweatRate + getPhaseWind ===
  const phaseSweatRate = (phaseInt: string, phaseDurMin: number | undefined, phaseName: string): number => {
    const base = (sweatProfile as unknown as Record<string, number>)[phaseInt] ?? sweatProfile.moderate;
    const effectiveTemp = isDrysuit ? Math.max(tempF, Math.min(80, tempF + 30)) : tempF;
    const rawTempMul = effectiveTemp > 80 ? 1.5 : effectiveTemp > 65 ? 1.0 : effectiveTemp > 45 ? 0.6 : effectiveTemp > 30 ? 0.35 : 0.2;
    const tempMul = rawTempMul;
    const humMul = 1 + (Math.max(humidity - 40, 0) / 100) * 0.8;
    const sexMul = (sex === 'female') ? 0.75 : 1.0;
    const wt = weightLb ?? 150;
    const wtMul = 0.6 + (wt / 170) * 0.4;
    let _fitSweat = fitnessProfile?.sweatMul ?? 1.0;
    let _metEff = 1.0;
    if (fitnessProfile && (fitnessProfile.vo2max || fitnessProfile.restingHR)) {
      const _metMap: Record<string, number> = { low: 3, moderate: 5, high: 7, very_high: 9 };
      _metEff = getMetabolicEfficiency(_metMap[phaseInt] ?? 5, fitnessProfile.vo2max ?? null, null, sex, fitnessProfile.restingHR ?? null);
      _fitSweat = 1.0;
    }
    let phaseClo: number;
    if (phaseName === 'lift' || phaseName === 'wait' || phaseName === 'rest') {
      phaseClo = 1.0;
    } else {
      const feF = clothingInsulation(tempF, phaseInt);
      const phaseR = Math.min(1.0, (phaseDurMin ?? 120) / TAU_CLOTHING);
      phaseClo = 1.0 + (feF - 1.0) * phaseR;
    }
    return base * tempMul * phaseClo * humMul * sexMul * wtMul * sweatProfile.coverageMul * (paceMul ?? 1.0) * (packLoadMul ?? 1.0) * _fitSweat * _metEff;
  };

  const getPhaseWind = (windType: string): number => {
    if (windType === 'skiing_descent') { const _dw = descentSpeedWind(profileKey); return windMph + _dw.speed * _dw.turnFactor; }
    if (windType === 'speed') return Math.max(windMph, 25);
    if (windType === 'headwind_low') return Math.max(windMph, 8);
    if (windType === 'cycling_speed') return Math.max(windMph, 15);
    if (windType === 'descent_speed') return Math.max(windMph, 30);
    if (windType === 'cart') return windMph + 5;
    if (windType === 'kayak') return windMph + 3;
    if (windType === 'walking') return Math.max(windMph, 3);
    if (windType === 'ridge') return Math.max(windMph, windMph * 1.3);
    if (windType === 'calm') return Math.max(2, windMph * 0.5);
    return windMph;
  };

  // === SHARED STATE ===
  let netTrapped = 0;
  let _totalTimeAtCapHrs = 0;
  let _systemCap = getEnsembleCapacity(activity);

  if (profile.type === 'cyclic') {
    const cycleDur = profile.phases.reduce((s: number, p: PhaseDefinition) => s + (p.durMin ?? 0), 0);
    const _useOverride = _mutableCycleOverride && typeof _mutableCycleOverride.totalCycles === 'number';
    const totalCycles = _useOverride
      ? _mutableCycleOverride!.totalCycles! + (_mutableCycleOverride!.totalCycles! % 1 === 0 ? 0.25 : 0)
      : totalMin / cycleDur;
    const wholeCycles = _useOverride ? _mutableCycleOverride!.totalCycles! : Math.floor(totalCycles);
    const fracCycle = totalCycles - wholeCycles;
    const _elevFt = _mutableCycleOverride?.elevFt ?? 0;
    const _perRunVert = _mutableCycleOverride?.perRunVertFt ?? 1000;
    const _dewPointC = _mutableCycleOverride?.dewPointC ?? null;
    let _adjHumidity = humidity;
    if (_dewPointC !== null && _elevFt > 1000) {
      const _tempC_h = (tempF - 32) * 5 / 9;
      _adjHumidity = calcElevationHumidity(_tempC_h, _dewPointC);
    }
    const _altEvap = altitudeFactors(_elevFt).evap;
    const _altConv = altitudeFactors(_elevFt).convective;
    const _cSwr = shellWindRes ?? GENERIC_GEAR_SCORES_BY_SLOT.shell!.windResist;

    const phaseData = profile.phases.map((phase: PhaseDefinition) => {
      const sr = phaseSweatRate(phase.intensity, phase.durMin, phase.name);
      const produced = sr * ((phase.durMin ?? 0) / 60) / 1000;
      const phaseWind = getPhaseWind(phase.windType);
      const _isActive = (phase.name !== 'lift' && phase.name !== 'wait' && phase.name !== 'rest');
      const ventedMul = phase.canVent ? 1.6 : 1.0;
      const _phVentWR = phase.canVent ? _cSwr * 0.5 : _cSwr;
      const _phVEvap = V_BOUNDARY_MPH + phaseWind * getWindPenetration(_phVentWR);
      const _phVpd = vpdRatio(tempF, _adjHumidity);
      const _phRawEvap = (_phVEvap / 20) * _phVpd * ventedMul * imFactor * drysuitEvapBlock * _altEvap;
      const evapRate = waderEvapFloor(_phRawEvap, humidity, waderType, fishWading);
      const evaporated = Math.min(produced, evapRate * produced);
      const retained = Math.max(MIN_RETAINED_LITERS / profile!.phases.length, produced - evaporated);
      const _phFeF = _isActive ? clothingInsulation(tempF, phase.intensity) : 1.0;
      const _phTauR = _isActive ? Math.min(1.0, (phase.durMin ?? 120) / TAU_CLOTHING) : 0;
      return { produced, evapRate, retained, durMin: phase.durMin ?? 0, _feF: _phFeF, _tauRamp: _phTauR };
    });

    const _aHygro = hygroAbsorption(tempF, humidity, ensembleIm ?? 0, DEFAULT_REGAIN_POLYESTER);
    // PHY-HUMID-01 v2 Finding 4: cycleNet was dead code (declared but never referenced in cyclic path). _aHygro is now applied to outermost layer buffer inside the cycle loop per §2.2 Category C.
    let cumMoisture = initialTrapped ?? 0;
    let _cyclesAtCap = 0;
    const _perCycleTrapped: number[] = [];
    const _perCycleMR: number[] = [];
    const _perCycleHL: number[] = [];
    const _perPhaseMR: Array<{phase:string; cycle:number; mr:number; trapped:number}> = [];
    const _perPhaseHL: Array<{phase:string; cycle:number; hl:number; hlWatts:number; residualW:number; fatigue:number}> = [];
    let _fatigue = 0;
    const _perCycleFatigue: number[] = [];

    // === ENERGY BALANCE ENGINE ===
    const _TambC = (tempF - 32) * 5 / 9;
    // PHY-069: Ambient vapor pressure in Pa for E_diff formula
    const _Pa_ambient = pSatPa(_TambC) * (humidity / 100);
    const _windMs = windMph * 0.44704;
    const _bodyFatPct = fitnessProfile?.bodyFatPct ?? 20;
    const _tissueCLO = computeTissueCLO(_bodyFatPct);
    // PHY-069: _Rtissue is now computed per-cycle from CIVD state (see inside cycle loop)
    const _totalCLO = (totalCLOoverride != null && totalCLOoverride > 0) ? totalCLOoverride : activityCLO(activity);
    let _gearCLO: number | null = null;
    if (gearItems && gearItems.length > 0) {
      _gearCLO = 0;
      for (let _gi = 0; _gi < gearItems.length; _gi++) {
        if (gearItems[_gi] && typeof gearItems[_gi]!.warmthRatio === 'number') {
          _gearCLO += warmthToCLO(gearItems[_gi]!.warmthRatio!);
        }
      }
    }
    const _baseCLO = Math.max(0.3, Math.min(4.0, _gearCLO ?? _totalCLO));
    let _phy049ShellWR = 0;
    if (gearItems && gearItems.length > 0) {
      const _outerGear = gearItems[gearItems.length - 1];
      _phy049ShellWR = (_outerGear as any)?.windResist ?? 0;
    }
    if (_phy049ShellWR === 0 && shellWindRes != null) { _phy049ShellWR = shellWindRes; }
    const _lc5Mets: Record<string, number> = { low: 1.5, moderate: 5, high: 8, very_high: 10 };
    const _METrun = _lc5Mets[profile.phases[0]!.intensity] ?? 5;
    const _METlift = profile.phases.length > 1 ? (_lc5Mets[profile.phases[1]!.intensity] ?? 1.5) : 1.5;
    const _epocTauVal = (function(m:number){if(m<=3)return 4;if(m<=6)return 4+(m-3)*2;return 10+(m-6)*3.3;})(_METrun);
    const _dMET = _METrun - _METlift;
    const _epoc = epocParams(_METrun, _METlift);
    let _speedWindMs = 0;
    if (isSki && profileKey) {
      const _dsw = descentSpeedWind(profileKey);
      _speedWindMs = _dsw.speed * _dsw.turnFactor * 0.44704;
    }
    const _faceCover = 'none';
    let _cumStorageWmin = 0;
    const _perCycleHeatStorage: number[] = [];
    let _peakCycleHeatBalanceW = 0;
    let _peakCycleHeatBalanceDirection = 'neutral';
    let _peakCycleHeatBalanceIdx = -1;
    const _runMin = profile.phases[0]!.durMin ?? 0;
    const _liftMin = profile.phases.length > 1 ? (profile.phases[1]!.durMin ?? 0) : 0;
    const _humFrac = humidity / 100;
    const _perCycleCoreTemp: number[] = [];
    const _perCycleCIVD: number[] = [];
    let _totalFluidLoss = 0;
    const _perCycleTSkin: number[] = [];
    // ── S10B accumulators: per-cycle heat-balance terms ──
    const _perCycleM: number[] = [];
    const _perCycleW: number[] = [];
    const _perCycleC: number[] = [];
    const _perCycleR: number[] = [];
    const _perCycleEResp: number[] = [];
    const _perCycleESkin: number[] = [];
    const _perCycleEMax: number[] = [];
    const _perCycleEReq: number[] = [];
    const _perCycleHc: number[] = [];
    const _perCycleHMass: number[] = [];
    const _perCyclePa: number[] = [];
    const _perCycleReClEffective: number[] = [];
    const _perCycleVPD: number[] = [];
    const _perCycleSweatRate: number[] = [];
    const _perCycleTCl: number[] = [];
    const _perCycleHTissue: number[] = [];
    const _perCycleSRun: number[] = [];
    let _goodRunCount = 0;
    let _yellowRunCount = 0;

    // PHY-048: Per-layer moisture buffer initialization
    const _resolvedGear = gearItems ?? null;
    const _isStratPill = !_resolvedGear && totalCLOoverride != null;
    let _layers: GearLayer[];
    if (initialLayers && Array.isArray(initialLayers) && initialLayers.length > 0) {
      _layers = initialLayers.map(l => ({ im: l.im, cap: l.cap, buffer: l.buffer || 0, wicking: l.wicking, fiber: l.fiber, name: l.name }));
    } else {
      _layers = buildLayerArray(_resolvedGear, activity, _totalCLO, _isStratPill);
    }
    // BUG-139: Override default layer ims with strategy winner's actual values
    if (_isStratPill && _mutableCycleOverride?.strategyLayerIms) {
      const _slotMap: Record<string, number> = {};
      _mutableCycleOverride.strategyLayerIms.forEach(l => { _slotMap[l.slot] = l.im; });
      const _slotOrder = _layers.length === 4 ? ['base', 'mid', 'insulative', 'shell']
        : _layers.length === 3 ? ['base', 'mid', 'shell']
        : _layers.length === 2 ? ['base', 'shell'] : ['base'];
      for (let _soi = 0; _soi < Math.min(_layers.length, _slotOrder.length); _soi++) {
        if (_slotMap[_slotOrder[_soi]!]) { _layers[_soi]!.im = _slotMap[_slotOrder[_soi]!]!; }
      }
    }
    const _systemCapLayers = _layers.reduce((s, l) => s + l.cap, 0);
    _systemCap = Math.max(_systemCap, _systemCapLayers / 1000);
    if (!initialLayers && (initialTrapped ?? 0) > 0 && _layers.length > 0) {
      _layers[0]!.buffer = Math.min((initialTrapped ?? 0) * 1000, _layers[0]!.cap);
    }
    const _hasWarmup = isSki;
    const _warmupCycles = _hasWarmup ? Math.max(1, Math.round(wholeCycles * 0.15)) : 0;
    const _groomerMET = 5.0;

    // Variable needed by condensation model across cycles
    let _surfacePassHr = 0;
    // Hoisted from inside loop: JS var hoists to function scope; TS const/let is block-scoped.
    // These are referenced in the fractional cycle block after the loop.
    let _sweatRateRunGhr = 0;
    let _condensWeights: number[] = [];

    // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §4.1: 4-phase decomposition applies to resort ski profiles only.
    // Backcountry (linear path), non-ski cyclic profiles (golf/fishing/cycling/etc.), and the continuous-activity
    // synthetic {run 55, rest 5} profile all retain the pre-Phase-B 2-phase structure (line and transition skipped,
    // _cycleMinRaw = _runMin + _liftMin).
    const _isResortSkiProfile = isSki && profileKey !== null && profileKey !== 'skiing_bc';
    const _liftLineMin = _isResortSkiProfile ? (_mutableCycleOverride?.liftLineMin ?? 0) : 0;

    // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §6: session-level rest-phase placement.
    // Deterministic 9:00 AM session start + fixed wall-clock targets per spec §6.5. Defaults wired
    // via computeResortCycleOverride (spec §6.3). Non-resort-ski activities see `lunch`/`otherBreak`
    // undefined → both `_lunchRequested` / `_otherBreakRequested` false → rest-phase code never
    // executes, preserving non-ski bit-identical per spec v1.2 §9.5.
    const SESSION_START_MIN = 9 * 60;               // 9:00 AM, deterministic per spec v1.2 §6.5 narrative
    const LUNCH_TARGET_MIN = 12 * 60 + 15;          // 12:15 PM per spec §6.5
    const BREAK_TARGET_MIN = 14 * 60 + 30;          // 2:30 PM per spec §6.5
    const LUNCH_DURATION_MIN = 45;                  // per spec §6.4
    const BREAK_DURATION_MIN = 15;                  // per spec §6.4
    const LUNCH_MET = 1.5;                          // Ainsworth 13030 "sitting, eating" per spec §6.4
    const BREAK_MET = 1.8;                          // Ainsworth 20030 "standing, talking" per spec §6.4
    const INDOOR_TEMP_F = 68;                       // spec §6.4 (20°C = 68°F)
    const INDOOR_TEMP_C = 20;                       // spec §6.4
    const INDOOR_HUMIDITY = 40;                     // spec §6.4 (% RH)
    const INDOOR_WIND_MS = 0;                       // spec §6.4 (still indoor air)
    const INDOOR_WIND_MPH = 0;
    const _lunchRequested = _isResortSkiProfile && (_mutableCycleOverride?.lunch ?? false);
    const _otherBreakRequested = _isResortSkiProfile && (_mutableCycleOverride?.otherBreak ?? false);
    const _sessionEndMin = SESSION_START_MIN + durationHrs * 60;
    let _wallClockMin = SESSION_START_MIN;
    let _lunchDone = false;
    let _breakDone = false;
    // Cross-cycle carry: after a rest phase ends, its T_skin seeds the NEXT cycle's CIVD snapshot
    // per spec §6.7.3. Cleared after first consumption so subsequent cycles revert to the normal
    // `_perCycleTSkin` last-element path.
    let _prevTskinRestCarry: number | null = null;
    // Indoor ambient water vapor partial pressure (Pa) for Ediff in rest phases.
    const _Pa_indoor = pSatPa(INDOOR_TEMP_C) * (INDOOR_HUMIDITY / 100);

    for (let c = 0; c < wholeCycles; c++) {
      // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §4.6: wall-clock cycle duration for "processes always on" buffer advancement. 4-phase for resort ski (line+lift+transition+run), 2-phase otherwise (run+lift).
      const _cycleMinRaw = _isResortSkiProfile
        ? _liftLineMin + _liftMin + TRANSITION_MIN + _runMin
        : _runMin + _liftMin;

      // === REST-PHASE PLACEMENT (spec v1.2 §6.5-§6.7) ===
      // Before running cycle c's phase physics, check if a rest target falls within this cycle's
      // wall-clock window [_wallClockMin, _wallClockMin + _cycleMinRaw]. If so, run the rest phase,
      // drain the moisture buffer under indoor conditions, advance the wall-clock, and carry
      // the rest-end T_skin into the upcoming cycle's CIVD snapshot per §6.7.3.
      const _cycleEndWallClock = _wallClockMin + _cycleMinRaw;

      // Lunch (shell-off, 45 min, MET 1.5, spec §6.7.1).
      if (_lunchRequested && !_lunchDone
          && LUNCH_TARGET_MIN >= _wallClockMin
          && LUNCH_TARGET_MIN < _cycleEndWallClock
          && LUNCH_TARGET_MIN < _sessionEndMin) {
        const _shellLayer = _layers[_layers.length - 1]!;
        const _innerLayers = _layers.slice(0, _layers.length - 1);
        // Spec §6.7.1: _Rclo_lunch = _Rclo × (1 - shellCLOfraction). Engine uses uniform per-layer
        // CLO (line 765 _RcloHalf convention); 1/_layers.length approximates shell's share.
        const _shellCLOfraction = _layers.length > 0 ? 1 / _layers.length : 0;
        const _Rclo_lunch = _totalCLO * 0.155 * (1 - _shellCLOfraction);  // pre-cumMoisture-degradation — CLO-only; rest phase re-enters a fresh-buffer regime as drying is the event
        const _totalCLO_lunch = _totalCLO * (1 - _shellCLOfraction);
        const _effectiveIm_lunch = _innerLayers.length > 0
          ? _innerLayers.length / _innerLayers.reduce((s, L) => s + 1 / Math.max(0.001, L.im), 0)
          : (_effectiveIm ?? 0.089);
        const _coreTempLunchEntry = estimateCoreTemp(LC5_T_CORE_BASE, _cumStorageWmin, _bodyMassKg);
        const _prevTskinForLunch = _perCycleTSkin.length > 0 ? _perCycleTSkin[_perCycleTSkin.length - 1]! : 33.7;
        const _RtissueLunchEntry = computeRtissueFromCIVD(civdProtectionFromSkin(_prevTskinForLunch));
        let _lunchStorage = 0;
        let _sweatLunchG = 0;
        let _respLunchGhrAccum = 0;
        let _TskLunchEnd = 33.7;
        for (let mn = 0; mn < LUNCH_DURATION_MIN; mn++) {
          const _hcLunch = 8.3 * Math.sqrt(Math.max(0.5, INDOOR_WIND_MS));
          const _RaLunch = 1 / _hcLunch;
          const _iterLunch = iterativeTSkin(_coreTempLunchEntry, INDOOR_TEMP_C, _RtissueLunchEntry, _Rclo_lunch, _RaLunch, _bsa, LUNCH_MET, INDOOR_WIND_MS, INDOOR_HUMIDITY, _effectiveIm_lunch, _bodyFatPct, 6, 0.1);
          const _TskLunch = _iterLunch.T_skin;
          _TskLunchEnd = _TskLunch;
          const _QmLunch = computeMetabolicHeat(LUNCH_MET, _bodyMassKg);
          const _QcLunch = computeConvectiveHeatLoss(_TskLunch, INDOOR_TEMP_C, _Rclo_lunch, _bsa, INDOOR_WIND_MS, 0);
          const _TsLunch = _TskLunch - (_TskLunch - INDOOR_TEMP_C) * (_Rclo_lunch / (_Rclo_lunch + _RaLunch));
          const _QrLunch = computeRadiativeHeatLoss(_TsLunch, INDOOR_TEMP_C, _bsa);
          const _respLunch = computeRespiratoryHeatLoss(LUNCH_MET, INDOOR_TEMP_C, INDOOR_HUMIDITY, _bodyMassKg, _faceCover);
          _respLunchGhrAccum += _respLunch.moistureGhr;
          const _M_Wm2_lunch = LUNCH_MET * 58.2;
          const _ediffLunch = computeEdiff(_M_Wm2_lunch, 0, _Pa_indoor, _bsa);
          const _QpLunch = _QcLunch + _QrLunch + _respLunch.total + _ediffLunch;
          const _resLunch = _QmLunch - _QpLunch;
          const _eReqLunch = Math.max(0, _resLunch);
          const _emaxLunch = computeEmax(_TskLunch, INDOOR_TEMP_C, INDOOR_HUMIDITY, INDOOR_WIND_MS, _effectiveIm_lunch, _totalCLO_lunch, _bsa);
          const _srLunch = computeSweatRate(_eReqLunch, _emaxLunch.eMax);
          _sweatLunchG += _srLunch.sweatGPerHr * (1 / 60);
          _lunchStorage += (_resLunch - _srLunch.qEvapW) * 1;
          // Inner-layer drying per spec §6.7.1 — each inner layer drains directly against indoor.
          for (let _li = 0; _li < _innerLayers.length; _li++) {
            const _L = _layers[_li]!;
            const _drainRate_L = getDrainRate(INDOOR_TEMP_F, INDOOR_HUMIDITY, INDOOR_WIND_MPH, _L.im, _Rclo_lunch, _bsa);
            const _drainG_L = _drainRate_L * (1 / 60) * Math.min(1, _L.cap > 0 ? _L.buffer / _L.cap : 0);
            _L.buffer = Math.max(0, _L.buffer - _drainG_L);
          }
          // Shell draped drain per spec §6.7.1 — 2× factor for both-sides exposure, Rclo=0 (detached).
          const _drainRate_shell = 2 * getDrainRate(INDOOR_TEMP_F, INDOOR_HUMIDITY, INDOOR_WIND_MPH, _shellLayer.im, 0, _bsa);
          const _drainG_shell = _drainRate_shell * (1 / 60) * Math.min(1, _shellLayer.cap > 0 ? _shellLayer.buffer / _shellLayer.cap : 0);
          _shellLayer.buffer = Math.max(0, _shellLayer.buffer - _drainG_shell);
        }
        // Post-lunch aHygro against insulative (outermost of inner ensemble while shell off) per spec §6.7.1.
        if (_innerLayers.length > 0) {
          const _insulativeLike = _layers[_innerLayers.length - 1]!;
          const _aHygro_lunch = hygroAbsorption(INDOOR_TEMP_F, INDOOR_HUMIDITY, _insulativeLike.im, DEFAULT_REGAIN_POLYESTER);
          _insulativeLike.buffer += _aHygro_lunch * 1000 * (LUNCH_DURATION_MIN / 60);
          _insulativeLike.buffer = Math.min(_insulativeLike.buffer, _insulativeLike.cap);
        }
        // Shared post-rest bookkeeping per spec §6.7.3.
        const _insensibleLunch = 10 * LUNCH_DURATION_MIN / 60;
        _totalFluidLoss += _sweatLunchG + _insensibleLunch + _respLunchGhrAccum * (1 / 60);
        _cumStorageWmin += _lunchStorage;
        _prevTskinRestCarry = _TskLunchEnd;
        // Refresh running cumMoisture from the now-drained layer buffers.
        cumMoisture = _layers.reduce((s, L) => s + L.buffer, 0) / 1000;
        _wallClockMin += LUNCH_DURATION_MIN;
        _lunchDone = true;
      }

      // otherBreak (shell-on, 15 min, MET 1.8, spec §6.7.2).
      if (_otherBreakRequested && !_breakDone
          && BREAK_TARGET_MIN >= _wallClockMin
          && BREAK_TARGET_MIN < _cycleEndWallClock
          && BREAK_TARGET_MIN < _sessionEndMin) {
        const _shellLayer = _layers[_layers.length - 1]!;
        const _effectiveIm_break = _effectiveIm ?? 0.089;
        const _Rclo_break = _totalCLO * 0.155;  // full-ensemble worn
        const _coreTempBreakEntry = estimateCoreTemp(LC5_T_CORE_BASE, _cumStorageWmin, _bodyMassKg);
        const _prevTskinForBreak = _prevTskinRestCarry !== null
          ? _prevTskinRestCarry
          : (_perCycleTSkin.length > 0 ? _perCycleTSkin[_perCycleTSkin.length - 1]! : 33.7);
        const _RtissueBreakEntry = computeRtissueFromCIVD(civdProtectionFromSkin(_prevTskinForBreak));
        let _breakStorage = 0;
        let _sweatBreakG = 0;
        let _respBreakGhrAccum = 0;
        let _TskBreakEnd = 33.7;
        for (let mn = 0; mn < BREAK_DURATION_MIN; mn++) {
          const _hcBreak = 8.3 * Math.sqrt(Math.max(0.5, INDOOR_WIND_MS));
          const _RaBreak = 1 / _hcBreak;
          const _iterBreak = iterativeTSkin(_coreTempBreakEntry, INDOOR_TEMP_C, _RtissueBreakEntry, _Rclo_break, _RaBreak, _bsa, BREAK_MET, INDOOR_WIND_MS, INDOOR_HUMIDITY, _effectiveIm_break, _bodyFatPct, 6, 0.1);
          const _TskBreak = _iterBreak.T_skin;
          _TskBreakEnd = _TskBreak;
          const _QmBreak = computeMetabolicHeat(BREAK_MET, _bodyMassKg);
          const _QcBreak = computeConvectiveHeatLoss(_TskBreak, INDOOR_TEMP_C, _Rclo_break, _bsa, INDOOR_WIND_MS, 0);
          const _TsBreak = _TskBreak - (_TskBreak - INDOOR_TEMP_C) * (_Rclo_break / (_Rclo_break + _RaBreak));
          const _QrBreak = computeRadiativeHeatLoss(_TsBreak, INDOOR_TEMP_C, _bsa);
          const _respBreak = computeRespiratoryHeatLoss(BREAK_MET, INDOOR_TEMP_C, INDOOR_HUMIDITY, _bodyMassKg, _faceCover);
          _respBreakGhrAccum += _respBreak.moistureGhr;
          const _M_Wm2_break = BREAK_MET * 58.2;
          const _ediffBreak = computeEdiff(_M_Wm2_break, 0, _Pa_indoor, _bsa);
          const _QpBreak = _QcBreak + _QrBreak + _respBreak.total + _ediffBreak;
          const _resBreak = _QmBreak - _QpBreak;
          const _eReqBreak = Math.max(0, _resBreak);
          const _emaxBreak = computeEmax(_TskBreak, INDOOR_TEMP_C, INDOOR_HUMIDITY, INDOOR_WIND_MS, _effectiveIm_break, _totalCLO, _bsa);
          const _srBreak = computeSweatRate(_eReqBreak, _emaxBreak.eMax);
          _sweatBreakG += _srBreak.sweatGPerHr * (1 / 60);
          _breakStorage += (_resBreak - _srBreak.qEvapW) * 1;
          // Shell on-body drain per spec §6.7.2.
          const _drainRate_shell = getDrainRate(INDOOR_TEMP_F, INDOOR_HUMIDITY, INDOOR_WIND_MPH, _shellLayer.im, _totalCLO, _bsa);
          const _drainG_shell = _drainRate_shell * (1 / 60) * Math.min(1, _shellLayer.cap > 0 ? _shellLayer.buffer / _shellLayer.cap : 0);
          _shellLayer.buffer = Math.max(0, _shellLayer.buffer - _drainG_shell);
        }
        // Post-break aHygro against shell (outermost worn) per spec §6.7.2.
        const _aHygro_break = hygroAbsorption(INDOOR_TEMP_F, INDOOR_HUMIDITY, _shellLayer.im, DEFAULT_REGAIN_POLYESTER);
        _shellLayer.buffer += _aHygro_break * 1000 * (BREAK_DURATION_MIN / 60);
        _shellLayer.buffer = Math.min(_shellLayer.buffer, _shellLayer.cap);
        // Shared post-rest bookkeeping per spec §6.7.3.
        const _insensibleBreak = 10 * BREAK_DURATION_MIN / 60;
        _totalFluidLoss += _sweatBreakG + _insensibleBreak + _respBreakGhrAccum * (1 / 60);
        _cumStorageWmin += _breakStorage;
        _prevTskinRestCarry = _TskBreakEnd;
        cumMoisture = _layers.reduce((s, L) => s + L.buffer, 0) / 1000;
        _wallClockMin += BREAK_DURATION_MIN;
        _breakDone = true;
      }

      const _isWarmup = (c < _warmupCycles);
      const _cycleMET = _isWarmup ? _groomerMET : _METrun;
      const _cycleSpeedWMs = _isWarmup ? (_speedWindMs * 0.6) : _speedWindMs;
      const sat = Math.min(1, cumMoisture / _systemCap);
      const _cloDeg = 1.0 - sat * 0.4;
      const _Rclo = _totalCLO * 0.155 * _cloDeg;
      const _runCLOdyn = computeEffectiveCLO(_baseCLO, _cycleMET, _phy049ShellWR, windMph, _layers.length);
      const coreTemp = estimateCoreTemp(LC5_T_CORE_BASE, _cumStorageWmin, _bodyMassKg);
      // PHY-070a: CIVD is skin-driven (Veicsteinas 1982, Young 1996).
      // Use previous cycle's T_skin to avoid circular dependency within iterativeTSkin.
      // Seed cycle 0 with Gagge neutral skin (33.7°C) since no prior exists.
      // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §6.7.3: if a rest phase just ran, its end-state
      // T_skin takes priority over the cycle-array tail for this cycle's CIVD snapshot.
      const _prevTskin = _prevTskinRestCarry !== null
        ? _prevTskinRestCarry
        : (_perCycleTSkin.length > 0
          ? _perCycleTSkin[_perCycleTSkin.length - 1]!
          : 33.7);
      _prevTskinRestCarry = null;
      const _civdCycle = civdProtectionFromSkin(_prevTskin);
      const _Rtissue = computeRtissueFromCIVD(_civdCycle);

      // === LINE PHASE: Sub-stepped, stationary-in-lift-line [spec v1.2 §4.2, §5.2] ===
      // Wall-clock first phase of each cycle. MET target = LINE_MET (1.8, Ainsworth 20030).
      // EPOC decay from phantom-prior-cycle run-end overlaid for c > 0; cycle 0 uses pure LINE_MET per spec §4.3.1.
      // Skipped entirely when _liftLineMin === 0 (Tier 1 Ghost Town or non-resort-ski).
      let _sweatLineG = 0, _lineCondensG = 0, _lineExcessG = 0, _lineStorage = 0;
      if (_liftLineMin > 0) {
        const _lineEpoc = epocParams(_cycleMET, LINE_MET);
        for (let mn = 0; mn < _liftLineMin; mn++) {
          const _t = mn + 0.5;
          const _METnow = c === 0
            ? LINE_MET
            : LINE_MET + _lineEpoc.aFast * Math.exp(-_t / _lineEpoc.tauFast) + _lineEpoc.aSlow * Math.exp(-_t / _lineEpoc.tauSlow);
          const _shiv = shiveringBoost(_TambC, _METnow, _totalCLO + _tissueCLO, _bodyFatPct);
          const _hcLine = 8.3 * Math.sqrt(Math.max(0.5, _windMs));
          const _RaLine = 1 / _hcLine;
          const _iterLine = iterativeTSkin(coreTemp, _TambC, _Rtissue, _Rclo, _RaLine, _bsa, _METnow, _windMs, _humFrac * 100, _effectiveIm || 0.089, _bodyFatPct, 6, 0.1);
          const _TskLine = _iterLine.T_skin;
          const _QmLine = computeMetabolicHeat(_METnow, _bodyMassKg);
          const _QcLine = computeConvectiveHeatLoss(_TskLine, _TambC, _Rclo, _bsa, _windMs, 0);
          const _TsLine = _TskLine - (_TskLine - _TambC) * (_Rclo / (_Rclo + _RaLine));
          const _QrLine = computeRadiativeHeatLoss(_TsLine, _TambC, _bsa);
          const _respLine = computeRespiratoryHeatLoss(_METnow, _TambC, _humFrac * 100, _bodyMassKg, _faceCover);
          const _M_Wm2_line = _METnow * 58.2;
          const _ediffLine = computeEdiff(_M_Wm2_line, 0, _Pa_ambient, _bsa);
          const _QpLine = _QcLine + _QrLine + _respLine.total + _ediffLine;
          const _resLine = _QmLine - _QpLine;
          const _eReqLine = Math.max(0, _resLine);
          const _emaxLine = computeEmax(_TskLine, _TambC, _humFrac * 100, _windMs, _effectiveIm || 0.089, _totalCLO, _bsa);
          const _srLine = computeSweatRate(_eReqLine, _emaxLine.eMax);
          _sweatLineG += _srLine.sweatGPerHr * (1 / 60);
          const _lineVaporMin = Math.min(_srLine.sweatGPerHr, (_emaxLine.eMax / L_V_J_PER_G) * 3600) / 60;
          const _lineSurfMin = _surfacePassHr / 60;
          _lineCondensG += Math.max(0, _lineVaporMin - _lineSurfMin);
          _lineExcessG += Math.max(0, _srLine.sweatGPerHr / 60 - _lineVaporMin);
          _lineStorage += (_resLine - _srLine.qEvapW) * 1;
        }
      }

      // === LIFT PHASE: Sub-stepped with EPOC decay (continuity from line-end per spec v1.2 §4.3.1) ===
      const _cycleEpoc = epocParams(_cycleMET, _METlift);
      let _sweatLiftG = 0, _liftCondensG = 0, _liftExcessG = 0, _liftStorage = 0, _eolDeficit = 0;
      for (let mn = 0; mn < _liftMin; mn++) {
        // tFromRunEnd = _liftLineMin + mn + 0.5: decay continues across the line → lift boundary.
        // For non-ski and _liftLineMin === 0, reduces to mn + 0.5 (current-engine behavior, bit-identical preservation).
        const _t = _liftLineMin + mn + 0.5;
        const _METnow = _METlift + _cycleEpoc.aFast * Math.exp(-_t / _cycleEpoc.tauFast) + _cycleEpoc.aSlow * Math.exp(-_t / _cycleEpoc.tauSlow);
        const _shiv = shiveringBoost(_TambC, _METnow, _totalCLO + _tissueCLO, _bodyFatPct);
        const _METeff = _METnow;
        const _hcL = 8.3 * Math.sqrt(Math.max(0.5, _windMs));
        const _RaL = 1 / _hcL;
        const _iterL = iterativeTSkin(coreTemp, _TambC, _Rtissue, _Rclo, _RaL, _bsa, _METnow, _windMs, _humFrac * 100, _effectiveIm || 0.089, _bodyFatPct, 6, 0.1);
        const _TskL = _iterL.T_skin;
        const _QmL = computeMetabolicHeat(_METeff, _bodyMassKg);
        const _QcL = computeConvectiveHeatLoss(_TskL, _TambC, _Rclo, _bsa, _windMs, 0);
        const _TsL = _TskL - (_TskL - _TambC) * (_Rclo / (_Rclo + _RaL));
        const _QrL = computeRadiativeHeatLoss(_TsL, _TambC, _bsa);
        // DEC-024 site 2: _humFrac → _humFrac*100
        const _respL = computeRespiratoryHeatLoss(_METeff, _TambC, _humFrac * 100, _bodyMassKg, _faceCover);
        // PHY-069: E_diff per ISO 7730 (was flat +7W)
        const _M_Wm2_lift = _METeff * 58.2;
        const _ediffLift = computeEdiff(_M_Wm2_lift, 0, _Pa_ambient, _bsa);
        const _QpL = _QcL + _QrL + _respL.total + _ediffLift;
        const _resL = _QmL - _QpL;
        const _eReqL = Math.max(0, _resL);
        const _emaxL = computeEmax(_TskL, _TambC, _humFrac * 100, _windMs, _effectiveIm || 0.089, _totalCLO, _bsa);
        const _srL = computeSweatRate(_eReqL, _emaxL.eMax);
        _sweatLiftG += _srL.sweatGPerHr * (1 / 60);
        const _liftVaporMin = Math.min(_srL.sweatGPerHr, (_emaxL.eMax / L_V_J_PER_G) * 3600) / 60;
        const _liftSurfMin = _surfacePassHr / 60;
        _liftCondensG += Math.max(0, _liftVaporMin - _liftSurfMin);
        _liftExcessG += Math.max(0, _srL.sweatGPerHr / 60 - _liftVaporMin);
        const _liftNetHeat = _resL - _srL.qEvapW;
        _liftStorage += _liftNetHeat * 1;
        if (mn === _liftMin - 1) _eolDeficit = _liftNetHeat;
      }

      // === TRANSITION PHASE: Sub-stepped, brief light-activity at lift top [spec v1.2 §4.2, §5.2] ===
      // 3 minutes at TRANSITION_MET (2.0, Ainsworth 05160). EPOC continuity from lift-end.
      // Cycle 0: pure TRANSITION_MET per spec §4.3.1 semantics mirrored from line.
      // Skipped for non-ski and backcountry: no strap-in / boot-tighten phase at lift top.
      let _sweatTransG = 0, _transCondensG = 0, _transExcessG = 0, _transStorage = 0;
      if (_isResortSkiProfile) {
        const _transEpoc = epocParams(_cycleMET, TRANSITION_MET);
        for (let mn = 0; mn < TRANSITION_MIN; mn++) {
          const _t = _liftLineMin + _liftMin + mn + 0.5;
          const _METnow = c === 0
            ? TRANSITION_MET
            : TRANSITION_MET + _transEpoc.aFast * Math.exp(-_t / _transEpoc.tauFast) + _transEpoc.aSlow * Math.exp(-_t / _transEpoc.tauSlow);
          const _shiv = shiveringBoost(_TambC, _METnow, _totalCLO + _tissueCLO, _bodyFatPct);
          const _hcTrans = 8.3 * Math.sqrt(Math.max(0.5, _windMs));
          const _RaTrans = 1 / _hcTrans;
          const _iterTrans = iterativeTSkin(coreTemp, _TambC, _Rtissue, _Rclo, _RaTrans, _bsa, _METnow, _windMs, _humFrac * 100, _effectiveIm || 0.089, _bodyFatPct, 6, 0.1);
          const _TskTrans = _iterTrans.T_skin;
          const _QmTrans = computeMetabolicHeat(_METnow, _bodyMassKg);
          const _QcTrans = computeConvectiveHeatLoss(_TskTrans, _TambC, _Rclo, _bsa, _windMs, 0);
          const _TsTrans = _TskTrans - (_TskTrans - _TambC) * (_Rclo / (_Rclo + _RaTrans));
          const _QrTrans = computeRadiativeHeatLoss(_TsTrans, _TambC, _bsa);
          const _respTrans = computeRespiratoryHeatLoss(_METnow, _TambC, _humFrac * 100, _bodyMassKg, _faceCover);
          const _M_Wm2_trans = _METnow * 58.2;
          const _ediffTrans = computeEdiff(_M_Wm2_trans, 0, _Pa_ambient, _bsa);
          const _QpTrans = _QcTrans + _QrTrans + _respTrans.total + _ediffTrans;
          const _resTrans = _QmTrans - _QpTrans;
          const _eReqTrans = Math.max(0, _resTrans);
          const _emaxTrans = computeEmax(_TskTrans, _TambC, _humFrac * 100, _windMs, _effectiveIm || 0.089, _totalCLO, _bsa);
          const _srTrans = computeSweatRate(_eReqTrans, _emaxTrans.eMax);
          _sweatTransG += _srTrans.sweatGPerHr * (1 / 60);
          const _transVaporMin = Math.min(_srTrans.sweatGPerHr, (_emaxTrans.eMax / L_V_J_PER_G) * 3600) / 60;
          const _transSurfMin = _surfacePassHr / 60;
          _transCondensG += Math.max(0, _transVaporMin - _transSurfMin);
          _transExcessG += Math.max(0, _srTrans.sweatGPerHr / 60 - _transVaporMin);
          _transStorage += (_resTrans - _srTrans.qEvapW) * 1;
        }
      }

      // === RUN PHASE: Energy Balance [wall-clock last per spec v1.2 §4.2] ===
      // Single-step integration at _cycleMET over _runMin minutes with descent-speed-added wind.
      // Outputs (_TskRun, _srRun, _emaxRun, _hcRun, _respRun) feed the post-cycle condensation /
      // moisture-buffer sections. Placed after LINE/LIFT/TRANSITION so code order tracks wall-clock
      // order (spec v1.2 §9.4 item 1 structural audit).
      const _hcRun = 8.3 * Math.sqrt(Math.max(0.5, _windMs + _cycleSpeedWMs));
      const _RaRun = 1 / _hcRun;
      const _iterRun = iterativeTSkin(coreTemp, _TambC, _Rtissue, _Rclo, _RaRun, _bsa, _cycleMET, _windMs + _cycleSpeedWMs, _humFrac * 100, _effectiveIm || 0.089, _bodyFatPct, 8, 0.1);
      const _TskRun = _iterRun.T_skin;
      const _Qmet = computeMetabolicHeat(_cycleMET, _bodyMassKg);
      const _QconvRun = computeConvectiveHeatLoss(_TskRun, _TambC, _Rclo, _bsa, _windMs, _cycleSpeedWMs);
      const _TsurfRun = _TskRun - (_TskRun - _TambC) * (_Rclo / (_Rclo + _RaRun));
      const _QradRun = computeRadiativeHeatLoss(_TsurfRun, _TambC, _bsa);
      // DEC-024 site 1: _humFrac → _humFrac*100
      const _respRun = computeRespiratoryHeatLoss(_cycleMET, _TambC, _humFrac * 100, _bodyMassKg, _faceCover);
      // PHY-069: E_diff per ISO 7730 (was flat +7W)
      const _M_Wm2_run = _cycleMET * 58.2;
      const _ediffRun = computeEdiff(_M_Wm2_run, 0, _Pa_ambient, _bsa);
      const _QpassRun = _QconvRun + _QradRun + _respRun.total + _ediffRun;
      const _residRun = _Qmet - _QpassRun;
      const _eReqRun = Math.max(0, _residRun);
      const _emaxRun = computeEmax(_TskRun, _TambC, _humFrac * 100, _windMs + _cycleSpeedWMs, _effectiveIm || 0.089, _totalCLO, _bsa);
      const _srRun = computeSweatRate(_eReqRun, _emaxRun.eMax);
      _sweatRateRunGhr = _srRun.sweatGPerHr;
      const _sweatRunG = _sweatRateRunGhr * (_runMin / 60);
      const _runNetHeat = _residRun - _srRun.qEvapW;
      const _runStorage = _runNetHeat * _runMin;

      _cumStorageWmin += _runStorage + _liftStorage + _lineStorage + _transStorage;
      const _cycleTotalWmin = _runStorage + _liftStorage + _lineStorage + _transStorage;
      const _cycleTotalMin = _cycleMinRaw;
      const _cycleAvgW = _cycleTotalMin > 0 ? _cycleTotalWmin / _cycleTotalMin : 0;
      _perCycleHeatStorage.push(Math.round(_cycleAvgW * 10) / 10);
      if (Math.abs(_cycleAvgW) > Math.abs(_peakCycleHeatBalanceW)) {
        _peakCycleHeatBalanceW = _cycleAvgW;
        _peakCycleHeatBalanceDirection = _cycleAvgW > 0 ? 'hot' : _cycleAvgW < 0 ? 'cold' : 'neutral';
        _peakCycleHeatBalanceIdx = _perCycleHeatStorage.length - 1;
      }

      // === PHY-048: PER-LAYER MOISTURE BUFFER ===
      const _insensibleG = 10 * _cycleMinRaw / 60;
      const _runProdG = _srRun.sweatGPerHr * (_runMin / 60);
      const _liftProdG = _sweatLiftG;
      const _lineProdG = _sweatLineG;  // 0 when line phase skipped (non-ski, BC, Tier 1)
      const _transProdG = _sweatTransG;  // 0 when transition phase skipped (non-ski, BC)
      const _cycleProdG = _runProdG + _liftProdG + _lineProdG + _transProdG + _insensibleG;
      _totalFluidLoss += _cycleProdG + _respRun.moistureGhr * (_cycleMinRaw / 60);
      const _cycleMin = _cycleMinRaw;
      const _outerL = _layers[_layers.length - 1]!;

      // Condensation model (Yoo & Kim 2008)
      const _vaporExitHr = Math.min(_srRun.sweatGPerHr, (_emaxRun.eMax / L_V_J_PER_G) * 3600);
      _surfacePassHr = getDrainRate(tempF, humidity, windMph, _outerL.im, _totalCLO, _bsa);
      const _condensHr = Math.max(0, _vaporExitHr - _surfacePassHr);
      const _excessHr = Math.max(0, _srRun.sweatGPerHr - _vaporExitHr);

      // DIAGNOSTIC: env-guarded per-cycle trace for S26-SYSTEMATIC-MR-UNDERESTIMATION investigation (S27). No behavior change.
      if (process.env.LC6_TRACE_S001) {
        // eslint-disable-next-line no-console
        console.log(`cycle=${c} isWarmup=${_isWarmup} MET=${_cycleMET.toFixed(2)} windMs=${(_windMs + _cycleSpeedWMs).toFixed(2)} effIm=${(_effectiveIm ?? 0).toFixed(3)} Tsk=${_TskRun.toFixed(2)} Ereq=${_eReqRun.toFixed(1)} Emax=${_emaxRun.eMax.toFixed(1)} sweatGhr=${_srRun.sweatGPerHr.toFixed(0)} runMin=${_runMin} cycleProdG=${_cycleProdG.toFixed(1)} vaporExitHr=${_vaporExitHr.toFixed(0)} excessHr=${_excessHr.toFixed(0)}`);
      }

      const _tSkinRetC = 30;
      const _tDewMicro = 29;
      const _RcloHalf = _totalCLO * 0.155 * 0.5;
      const _RairCond = 1 / (8.3 * Math.sqrt(Math.max(0.5, _windMs)));
      const _midFrac = (_totalCLO > 0) ? _RcloHalf / (_totalCLO * 0.155 + _RairCond) : 0.5;
      const _tMidC = _TambC + (_tSkinRetC - _TambC) * _midFrac;
      const _condensSeverity = Math.max(0, (_tDewMicro - _tMidC) / _tDewMicro);
      const _netRetention = 0.40 * _condensSeverity;
      const _retainedCondensG = _condensHr * _netRetention;
      const _liftRetainedG = _liftCondensG * _netRetention + _liftExcessG * _netRetention;
      const _liftFabricG = isNaN(_liftRetainedG) ? _liftProdG * 0.35 : _liftRetainedG;
      // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §5.8: line and transition phases contribute per-minute
      // condensation + excess retention. Zero when phases skipped (non-ski, BC) — preserves bit-identical.
      const _lineFabricG = _lineCondensG * _netRetention + _lineExcessG * _netRetention;
      const _transFabricG = _transCondensG * _netRetention + _transExcessG * _netRetention;
      const _fabricInG = (_retainedCondensG + _excessHr * _netRetention) * (_runMin / 60) + _liftFabricG + _lineFabricG + _transFabricG + _insensibleG;

      // Condensation placement by thermal gradient
      const _tSkinC = _TskRun;
      const _Rtotal = _totalCLO * 0.155 + (1 / _hcRun);
      let _Rcum = 0;
      _condensWeights = [];
      let _cwSum = 0;
      for (let _cwi = 0; _cwi < _layers.length; _cwi++) {
        const _layerCLO = _totalCLO / _layers.length;
        _Rcum += _layerCLO * 0.155;
        const _tLayerC = _tSkinC - (_tSkinC - _TambC) * (_Rcum / _Rtotal);
        const _undershoot = Math.max(0, _tDewMicro - _tLayerC);
        _condensWeights.push(_undershoot);
        _cwSum += _undershoot;
      }
      if (_cwSum > 0) { for (let _cwi = 0; _cwi < _condensWeights.length; _cwi++) { _condensWeights[_cwi] = _condensWeights[_cwi]! / _cwSum; } }
      else { _condensWeights[_condensWeights.length - 1] = 1.0; }
      for (let _di = 0; _di < _layers.length; _di++) { _layers[_di]!.buffer += _fabricInG * _condensWeights[_di]!; }

      // PHY-HUMID-01 v2 §2.2 Category C: ambient vapor absorbed from outside routes directly to outermost layer (shell). Activates _aHygro previously dead in cyclic path (Finding 4 of S21 LC5↔LC6 physics fidelity audit). _aHygro is per-cycle liters; multiply by 1000 to convert to grams for layer.buffer.
      _layers[_layers.length - 1]!.buffer += _aHygro * 1000;

      // Overflow cascade inward
      for (let _oi = _layers.length - 1; _oi > 0; _oi--) {
        const _overflow = Math.max(0, _layers[_oi]!.buffer - _layers[_oi]!.cap);
        if (_overflow > 0) { _layers[_oi]!.buffer = _layers[_oi]!.cap; _layers[_oi - 1]!.buffer += _overflow; }
      }
      _layers[0]!.buffer = Math.min(_layers[0]!.buffer, _layers[0]!.cap);

      // Bidirectional wicking (Washburn 1921)
      for (let _li = 0; _li < _layers.length - 1; _li++) {
        const _fillI = _layers[_li]!.cap > 0 ? _layers[_li]!.buffer / _layers[_li]!.cap : 0;
        const _fillJ = _layers[_li + 1]!.cap > 0 ? _layers[_li + 1]!.buffer / _layers[_li + 1]!.cap : 0;
        if (_fillI > _fillJ) {
          const _wickR = (_layers[_li]!.wicking || 7) / 10;
          const _retFrac = Math.pow(Math.max(0, 1 - _wickR), _cycleMin);
          let _delta = (_fillI - _fillJ) * _layers[_li]!.cap * (1 - _retFrac) * 0.5;
          _delta = Math.min(_delta, _layers[_li]!.buffer, Math.max(0, _layers[_li + 1]!.cap - _layers[_li + 1]!.buffer));
          _layers[_li]!.buffer -= _delta;
          _layers[_li + 1]!.buffer += _delta;
        } else if (_fillJ > _fillI) {
          const _wickR = (_layers[_li + 1]!.wicking || 7) / 10;
          const _retFrac = Math.pow(Math.max(0, 1 - _wickR), _cycleMin);
          let _delta = (_fillJ - _fillI) * _layers[_li + 1]!.cap * (1 - _retFrac) * 0.5;
          _delta = Math.min(_delta, _layers[_li + 1]!.buffer, Math.max(0, _layers[_li]!.cap - _layers[_li]!.buffer));
          _layers[_li + 1]!.buffer -= _delta;
          _layers[_li]!.buffer += _delta;
        }
      }

      // BUG-133: Pre-drain snapshot for run-phase sawtooth peak
      const _preDrainBufs: number[] = [];
      for (let _pdi = 0; _pdi < _layers.length; _pdi++) { _preDrainBufs.push(_layers[_pdi]!.buffer); }

      // Surface drain (PHY-047)
      const _outerFill = Math.min(1, _outerL.buffer / _outerL.cap);
      const _riderSpeedMph = (_cycleSpeedWMs || 0) / 0.447;
      const _effectiveWindRun = windMph + _riderSpeedMph * 0.5;
      const _runDrainHr = getDrainRate(tempF, humidity, _effectiveWindRun, _outerL.im, _totalCLO, _bsa);
      const _liftDrainHr = getDrainRate(tempF, humidity, windMph, _outerL.im, _totalCLO, _bsa);
      const _drainGPerHr = (_runDrainHr * _runMin + _liftDrainHr * _liftMin) / _cycleMin;
      let _drainG = _drainGPerHr * (_cycleMin / 60) * _outerFill;
      _drainG = Math.min(_drainG, _outerL.buffer);
      _outerL.buffer -= _drainG;

      // Vent events
      if (ventEvents && ventEvents.length > 0) {
        const _realCycMin = totalMin / Math.max(1, wholeCycles + (fracCycle > 0 ? fracCycle : 0));
        const _cycStartMin = c * _realCycMin;
        const _cycEndMin = _cycStartMin + _realCycMin;
        let _bestVentEff = 0;
        for (let _vi = 0; _vi < ventEvents.length; _vi++) {
          const _ve = ventEvents[_vi]!;
          const _veTime = typeof _ve === 'number' ? _ve : _ve.time;
          const _veType = typeof _ve === 'object' ? (_ve.type ?? 'vent') : 'vent';
          if (_veTime >= _cycStartMin && _veTime < _cycEndMin) {
            let _thisEff: number;
            if (_veType === 'lodge') { _thisEff = 0.85; }
            else {
              const _ventCold = tempF < 40 ? Math.max(0.4, 1 - (40 - tempF) / 80) : 1;
              const _ventHum = humidity > 80 ? 0.7 : humidity > 60 ? 0.85 : 1.0;
              _thisEff = 0.6 * _ventCold * _ventHum;
            }
            _bestVentEff = Math.max(_bestVentEff, _thisEff);
          }
        }
        if (_bestVentEff > 0) {
          const _ventArea = 0.15;
          const _ventBaseIm = (_layers.length > 0 ? _layers[0]!.im : 0.40) || 0.40;
          const _ventCLOval = 0.3;
          const _ventedDrainHr = getDrainRate(tempF, humidity, windMph, _ventBaseIm, _ventCLOval, _bsa * _ventArea);
          const _ventDurMin = 5;
          const _ventDrainG = _ventedDrainHr * (_ventDurMin / 60);
          let _ventTotalBuf = 0;
          for (let _vli = 0; _vli < _layers.length; _vli++) { _ventTotalBuf += _layers[_vli]!.buffer; }
          if (_ventTotalBuf > 0) {
            for (let _vli = 0; _vli < _layers.length; _vli++) {
              const _ventShare = _layers[_vli]!.buffer / _ventTotalBuf;
              _layers[_vli]!.buffer = Math.max(0, _layers[_vli]!.buffer - _ventDrainG * _ventShare);
            }
          }
          _cumStorageWmin *= (1 - _bestVentEff);
        }
      }

      // Per-layer cap overflow
      for (let _ci = 0; _ci < _layers.length; _ci++) {
        if (_layers[_ci]!.buffer > _layers[_ci]!.cap) { _layers[_ci]!.buffer = _layers[_ci]!.cap; }
      }

      // Derive cumMoisture from layer sum
      let _totalBuffer = 0;
      for (let _bi = 0; _bi < _layers.length; _bi++) { _totalBuffer += _layers[_bi]!.buffer; }
      cumMoisture = _totalBuffer / 1000;

      // Precipitation wetting
      if ((precipProbability ?? 0) > 0 && activity !== 'kayaking' && activity !== 'paddle_boarding') {
        const _phy060swr = shellWindRes ?? (typeof _phy049ShellWR === 'number' ? _phy049ShellWR : 5);
        const _pcPW = precipWettingRate(precipProbability ?? 0, tempF, _phy060swr) * (_cycleMin / 60);
        cumMoisture += _pcPW;
        _layers[0]!.buffer += _pcPW * 1000;
      }

      // Creek kayak roll cooling + splash wetting (conditional — requires globals not yet ported)
      // H_WATER, ROLL_COOLING, IMMERSION_SHIELD behind typeof guards → safely inactive in LC6

      // Per-phase display tracking (BUG-133)
      const _preDrainLayers: Array<{buffer:number; cap:number}> = [];
      for (let _pdl = 0; _pdl < _layers.length; _pdl++) { _preDrainLayers.push({ buffer: _preDrainBufs[_pdl]!, cap: _layers[_pdl]!.cap }); }
      const _runMR = Math.min(10, Math.round(computePerceivedMR(_preDrainLayers) * 10) / 10);
      let _preDrainMoistureL = 0;
      for (let _pds = 0; _pds < _preDrainBufs.length; _pds++) { _preDrainMoistureL += _preDrainBufs[_pds]!; }
      _preDrainMoistureL /= 1000;
      _perPhaseMR.push({ phase: 'run', cycle: c, mr: _runMR, trapped: Math.round(_preDrainMoistureL * 10000) / 10000 });

      // HLR sawtooth: run phase
      const _RcloDynRun = _runCLOdyn * 0.155 * _cloDeg;
      const _TskDynRun = computeTSkin(coreTemp, _TambC, _Rtissue, _RcloDynRun, _RaRun);
      const _QconvDynRun = computeConvectiveHeatLoss(_TskDynRun, _TambC, _RcloDynRun, _bsa, _windMs, _speedWindMs);
      const _TsDynRun = _TskDynRun - (_TskDynRun - _TambC) * (_RcloDynRun / (_RcloDynRun + _RaRun));
      const _QradDynRun = computeRadiativeHeatLoss(_TsDynRun, _TambC, _bsa);
      // PHY-069 (dynamic path): E_diff per ISO 7730
      const _M_Wm2_runDyn = _cycleMET * 58.2;
      const _ediffRunDyn = computeEdiff(_M_Wm2_runDyn, 0, _Pa_ambient, _bsa);
      const _residDynRun = _Qmet - (_QconvDynRun + _QradDynRun + _respRun.total + _ediffRunDyn);
      const _runHLwatts = _residDynRun > 0 ? 0 : Math.abs(_residDynRun);
      const _runHLscore = Math.min(10, _runHLwatts / PHY040_WATTS_PER_POINT); // dead code preserved
      const _coreNow = estimateCoreTemp(LC5_T_CORE_BASE, _cumStorageWmin, _bodyMassKg);
      const _hlrRunScore = computeHLR(_residDynRun, _coreNow, _TambC, sat);
      _perPhaseHL.push({ phase: 'run', cycle: c, hl: Math.round(_hlrRunScore * 1000) / 1000, hlWatts: Math.round(_runHLwatts), residualW: Math.round(_runNetHeat), fatigue: Math.round(_fatigue * 1000) / 1000 });

      // HLR sawtooth: lift phase
      const _liftEndMET = _METlift + _cycleEpoc.aFast * Math.exp(-(_liftMin - 0.5) / _cycleEpoc.tauFast) + _cycleEpoc.aSlow * Math.exp(-(_liftMin - 0.5) / _cycleEpoc.tauSlow);
      const _liftCLOdyn = computeEffectiveCLO(_baseCLO, _liftEndMET, _phy049ShellWR, windMph, _layers.length);
      const _RcloDynLift = _liftCLOdyn * 0.155 * _cloDeg;
      const _hcLift = 8.3 * Math.sqrt(Math.max(0.5, _windMs));
      const _RaLift = 1 / _hcLift;
      const _TskDynLift = computeTSkin(coreTemp, _TambC, _Rtissue, _RcloDynLift, _RaLift);
      const _QmLift = computeMetabolicHeat(_liftEndMET, _bodyMassKg);
      const _QconvDynLift = computeConvectiveHeatLoss(_TskDynLift, _TambC, _RcloDynLift, _bsa, _windMs, 0);
      const _TsDynLift = _TskDynLift - (_TskDynLift - _TambC) * (_RcloDynLift / (_RcloDynLift + _RaLift));
      const _QradDynLift = computeRadiativeHeatLoss(_TsDynLift, _TambC, _bsa);
      // DEC-024 site 3: _humFrac → _humFrac*100
      const _respLift = computeRespiratoryHeatLoss(_liftEndMET, _TambC, _humFrac * 100, _bodyMassKg, _faceCover);
      // PHY-069 (dynamic path): E_diff per ISO 7730
      const _M_Wm2_liftDyn = _METlift * 58.2;
      const _ediffLiftDyn = computeEdiff(_M_Wm2_liftDyn, 0, _Pa_ambient, _bsa);
      const _residDynLift = _QmLift - (_QconvDynLift + _QradDynLift + _respLift.total + _ediffLiftDyn);
      const _liftHLwatts = _residDynLift < 0 ? Math.abs(_residDynLift) : 0;
      const _liftHLscore = Math.min(10, _liftHLwatts / PHY040_WATTS_PER_POINT); // dead code preserved
      const _hlrScore = computeHLR(_residDynLift, _coreNow, _TambC, sat);
      const _liftMR = Math.min(10, Math.round(computePerceivedMR(_layers) * 10) / 10);
      _perPhaseMR.push({ phase: 'lift', cycle: c, mr: _liftMR, trapped: Math.round(cumMoisture * 10000) / 10000 });
      _perPhaseHL.push({ phase: 'lift', cycle: c, hl: Math.round(_hlrScore * 1000) / 1000, hlWatts: Math.round(_liftHLwatts), residualW: Math.round(_liftStorage / Math.max(1, _liftMin)), fatigue: Math.round(_fatigue * 1000) / 1000 });

      // PHY-034: fatigue accumulation
      const _cycleDurF = _cycleMinRaw;
      if (cumMoisture >= CROSSOVER_LITERS) {
        const _fSev = Math.min(1, (cumMoisture - CROSSOVER_LITERS) / (FABRIC_CAPACITY_LITERS - CROSSOVER_LITERS));
        const _fResist = 1 - (_fatigue / MAX_FATIGUE);
        _fatigue += FATIGUE_PER_MIN * _cycleDurF * _fSev * _fResist;
      } else {
        const _fHead = (CROSSOVER_LITERS - cumMoisture) / CROSSOVER_LITERS;
        _fatigue *= (1 - RECOVERY_PER_MIN * _cycleDurF * _fHead);
      }
      _fatigue = Math.min(_fatigue, MAX_FATIGUE);
      if (cumMoisture > _systemCap) { _cyclesAtCap++; }
      _perCycleFatigue.push(Math.round(_fatigue * 1000) / 1000);
      _perCycleTrapped.push(cumMoisture);

      const _cMRraw = Math.min(10, Math.round(computePerceivedMR(_layers) * 10) / 10);
      const _durPen = _cyclesAtCap > 0 ? applyDurationPenalty(_cMRraw, _cyclesAtCap * (cycleDur / 60)) : _cMRraw;
      const _cMR = Math.min(10, Math.round(_durPen * 10) / 10);
      _perCycleMR.push(_cMR);
      _perCycleHL.push(Math.round(_hlrScore * 1000) / 1000);
      const _cdi = Math.max(_cMR, _hlrScore);
      if (_cMR < 3.5) _goodRunCount++;
      else if (_cMR < 4.0) _yellowRunCount++;
      _perCycleCoreTemp.push(Math.round(_coreNow * 100) / 100);
      _perCycleCIVD.push(Math.round(civdProtectionFromSkin(_TskRun) * 100) / 100);
      _perCycleTSkin.push(Math.round(_TskRun * 10) / 10);
      // ── S10B pushes: heat-balance terms from RUN phase locals ──
      // All terms are end-of-RUN-phase values at end-of-cycle.
      // Rounding convention: 2 decimal places for W fields (sub-unit precision
      // not meaningful for heat balance display); 4 decimals for coefficients.
      _perCycleM.push(Math.round(_Qmet * 100) / 100);
      _perCycleW.push(0); // Mechanical work: 0 for ski/hike/etc. (TODO future: cycling W)
      _perCycleC.push(Math.round(_QconvRun * 100) / 100);
      _perCycleR.push(Math.round(_QradRun * 100) / 100);
      _perCycleEResp.push(Math.round(_respRun.total * 100) / 100);
      // E_skin: actual skin evaporation = min(E_req, E_max). Sweat rate × latent heat.
      // From the sweat-rate computation: _srRun (g/s) × LATENT_HEAT_VAP_J_PER_G.
      // Locals _srRun and _ediffRun exist at this scope per earlier grep (line 666).
      // E_skin = E_diff (insensible diffusion) + qEvapW (sweat-driven regulatory)
      // Per engine line 975 (_QpassRun composition) and line 982 (_runNetHeat).
      // Both channels operate in parallel — diffusion is humidity-gradient driven,
      // qEvapW is sweat-rate × latent heat. Both are real heat losses from skin.
      const _ESkinTotalW = _ediffRun + _srRun.qEvapW;
      _perCycleESkin.push(Math.round(_ESkinTotalW * 100) / 100);
      _perCycleEMax.push(Math.round(_emaxRun.eMax * 100) / 100);
      // E_req: required evaporation = residual heat after passive losses (_eReqRun at line 977).
      // Not _ediffRun (which is E_diff, passive insensible diffusion).
      _perCycleEReq.push(Math.round(_eReqRun * 100) / 100);
      _perCycleHc.push(Math.round(_hcRun * 10000) / 10000);
      // h_mass from Lewis relation: h_mass = h_c / (LEWIS_NUMBER × rho_air × cp_air)
      // For standard conditions ~ h_c / 16.5 gives m/s for vapor mass transfer.
      // Using Gagge convention: h_e ≈ 16.5 × h_c (W/m²kPa), so h_mass ≈ h_c / 61600 (m/s).
      const _hMassRun = _hcRun / 61600;
      _perCycleHMass.push(Math.round(_hMassRun * 100000000) / 100000000); // 8 decimals — m/s is small
      _perCyclePa.push(Math.round(_Pa_ambient * 100) / 100);
      // R_e_cl_effective: Rcl / (im × LR_factor) per ISO 9920
      // LR_factor = 16.5 K/kPa Lewis relation for sweating heat transfer
      const _ReClEffective = (_effectiveIm || 0.089) > 0
        ? _Rclo / ((_effectiveIm || 0.089) * 16.5)
        : 0;
      _perCycleReClEffective.push(Math.round(_ReClEffective * 10000) / 10000);
      // VPD: saturation pressure at T_skin minus ambient partial pressure
      const _pSatSkin = pSatPa(_TskRun);
      const _VPDRun = _pSatSkin - _Pa_ambient;
      _perCycleVPD.push(Math.round(_VPDRun * 100) / 100);
      _perCycleSweatRate.push(Math.round((_srRun.sweatGPerHr / 3600) * 100000) / 100000);
      // T_cl: clothing surface temperature from convergence, already computed at _TsurfRun (line 661)
      _perCycleTCl.push(Math.round(_TsurfRun * 10) / 10);
      // h_tissue: from iterativeTSkin convergence. The solver returns h_tissue implicitly
      // via R_tissue. _Rtissue = tissueCloEffective × 0.155. h_tissue = 1/R_tissue (W/m²K).
      const _hTissueRun = _Rtissue > 0 ? 1 / _Rtissue : 9.0;
      _perCycleHTissue.push(Math.round(_hTissueRun * 1000) / 1000);
      // S_run: RUN-phase-only storage (W). Distinct from perCycleHeatStorage which is
      // the cycle-averaged storage across all 4 phases. Needed for first-law
      // verification scoped to RUN-phase quantities.
      _perCycleSRun.push(Math.round(_runNetHeat * 100) / 100);

      // PHY-031-CYCLEMIN-RECONCILIATION v1.2 §6.5: advance wall-clock tracker by _cycleMinRaw.
      // Rest-phase insertions (lunch, otherBreak) advance it separately above.
      _wallClockMin += _cycleMinRaw;
    }

    // Fractional last cycle
    if (fracCycle > 0) {
      const _fracMin = cycleDur * fracCycle;
      const _fracProdG = (_sweatRateRunGhr ?? 0) * (_fracMin / 60);
      if (_condensWeights && _condensWeights.length === _layers.length) {
        for (let _fi = 0; _fi < _layers.length; _fi++) { _layers[_fi]!.buffer += _fracProdG * _condensWeights[_fi]!; }
      } else { _layers[0]!.buffer += _fracProdG; }
      for (let _fli = 0; _fli < _layers.length - 1; _fli++) {
        const _ffill = Math.min(1, _layers[_fli]!.buffer / _layers[_fli]!.cap);
        const _fwick = (_layers[_fli]!.wicking || 7) / 10;
        let _ftrans = _layers[_fli]!.buffer * _ffill * _fwick * fracCycle;
        const _fhead = Math.max(0, _layers[_fli + 1]!.cap - _layers[_fli + 1]!.buffer);
        _ftrans = Math.min(_ftrans, _fhead, _layers[_fli]!.buffer);
        _layers[_fli]!.buffer -= _ftrans;
        _layers[_fli + 1]!.buffer += _ftrans;
      }
      const _fOuter = _layers[_layers.length - 1]!;
      const _fOuterFill = Math.min(1, _fOuter.buffer / _fOuter.cap);
      const _fDrainGPerHr = getDrainRate(tempF, humidity, windMph, _fOuter.im, _totalCLO, _bsa);
      const _fDrainG = Math.min(_fDrainGPerHr * _fracMin / 60 * _fOuterFill, _fOuter.buffer);
      _fOuter.buffer -= _fDrainG;
      for (let _fci = 0; _fci < _layers.length; _fci++) { if (_layers[_fci]!.buffer > _layers[_fci]!.cap) _layers[_fci]!.buffer = _layers[_fci]!.cap; }
      let _fTotalBuf = 0; for (let _fbi = 0; _fbi < _layers.length; _fbi++) { _fTotalBuf += _layers[_fbi]!.buffer; }
      cumMoisture = _fTotalBuf / 1000;
      if (cumMoisture > _systemCap) { cumMoisture = _systemCap; _cyclesAtCap += fracCycle; }
    }

    _totalTimeAtCapHrs = _cyclesAtCap * (cycleDur / 60);
    netTrapped = Math.max(0, cumMoisture);

    // === TAIL: Return assembly ===
    let _layerSat: number[] | null = null;
    if (netTrapped > 0) {
      let _remaining = netTrapped;
      _layerSat = GENERIC_LAYER_CAPS.map(capL => {
        const filled = Math.min(_remaining, capL);
        _remaining = Math.max(0, _remaining - capL);
        return Math.round(filled / capL * 100);
      });
    }
    const _mrCap = getEnsembleCapacity(activity);
    let _sessionMR = (_perCycleMR.length > 0)
      ? _perCycleMR[_perCycleMR.length - 1]!
      : Math.min(10, Math.round(applySaturationCascade(7.2 * (netTrapped / _mrCap)) * 10) / 10);
    // S19: cascade applied to final sessionMR (covers the perCycleMR[last] branch too)
    _sessionMR = Math.min(10, Math.round(applySaturationCascade(_sessionMR) * 10) / 10);
    if (ventEvents && ventEvents.length > 0 && _perCycleMR.length > 1) {
      let _ventMean = 0; for (let _vmi = 0; _vmi < _perCycleMR.length; _vmi++) { _ventMean += _perCycleMR[_vmi]!; }
      _ventMean /= _perCycleMR.length;
      _sessionMR = Math.round((_sessionMR * 0.7 + _ventMean * 0.3) * 10) / 10;
    }
    if (_totalTimeAtCapHrs > 0) {
      _sessionMR = Math.min(10, Math.round(applyDurationPenalty(_sessionMR, _totalTimeAtCapHrs) * 10) / 10);
    }
    let _step2PeakTrapped = 0;
    if (_perCycleTrapped.length > 0) {
      for (let _ptIdx = 0; _ptIdx < _perCycleTrapped.length; _ptIdx++) {
        if (_perCycleTrapped[_ptIdx]! > _step2PeakTrapped) _step2PeakTrapped = _perCycleTrapped[_ptIdx]!;
      }
    }
    const _step2PeakSatFrac = _mrCap > 0 ? Math.min(1.0, _step2PeakTrapped / _mrCap) : 0;

    return {
      trapped: netTrapped,
      sessionMR: _sessionMR,
      timeAtCapHrs: _totalTimeAtCapHrs,
      layerSat: _layerSat,
      perCycleTrapped: _perCycleTrapped.length > 0 ? _perCycleTrapped : null,
      perCycleMR: _perCycleMR.length > 0 ? _perCycleMR : null,
      perCycleWetPenalty: _perCycleHL.length > 0 ? _perCycleHL : null,
      fatigue: _fatigue || 0,
      perCycleFatigue: _perCycleFatigue.length > 0 ? _perCycleFatigue : null,
      perPhaseMR: _perPhaseMR.length > 0 ? _perPhaseMR : null,
      perPhaseHL: _perPhaseHL.length > 0 ? _perPhaseHL : null,
      perCycleHeatStorage: _perCycleHeatStorage.length > 0 ? _perCycleHeatStorage : null,
      peakHeatBalanceW: _peakCycleHeatBalanceW,
      peakHeatBalanceDirection: _peakCycleHeatBalanceDirection,
      peakHeatBalanceCycleIdx: _peakCycleHeatBalanceIdx,
      totalHeatBalanceWh: Math.round(_cumStorageWmin / 60 * 100) / 100,
      peakSaturationFrac: _step2PeakSatFrac,
      perCycleCoreTemp: _perCycleCoreTemp.length > 0 ? _perCycleCoreTemp : null,
      perCycleCIVD: _perCycleCIVD.length > 0 ? _perCycleCIVD : null,
      totalFluidLoss: Math.round(_totalFluidLoss),
      fluidLossPerHr: durationHrs > 0 ? Math.round(_totalFluidLoss / durationHrs) : null,
      perCycleTSkin: _perCycleTSkin.length > 0 ? _perCycleTSkin : null,
      goodRunCount: _goodRunCount,
      yellowRunCount: _yellowRunCount,
      totalRuns: wholeCycles,
      layerBuffers: _layers.map(l => ({
        name: l.name, fiber: l.fiber,
        buffer: Math.round(l.buffer * 10) / 10,
        cap: Math.round(l.cap * 10) / 10,
        fill: l.cap > 0 ? Math.round(l.buffer / l.cap * 100) : 0,
      })),
      endingLayers: _layers.map(l => ({ im: l.im, cap: l.cap, buffer: l.buffer, wicking: l.wicking, fiber: l.fiber, name: l.name })),
      // ── S10B: per-cycle heat-balance terms ──
      perCycleM: _perCycleM.length > 0 ? _perCycleM : null,
      perCycleW: _perCycleW.length > 0 ? _perCycleW : null,
      perCycleC: _perCycleC.length > 0 ? _perCycleC : null,
      perCycleR: _perCycleR.length > 0 ? _perCycleR : null,
      perCycleEResp: _perCycleEResp.length > 0 ? _perCycleEResp : null,
      perCycleESkin: _perCycleESkin.length > 0 ? _perCycleESkin : null,
      perCycleEMax: _perCycleEMax.length > 0 ? _perCycleEMax : null,
      perCycleEReq: _perCycleEReq.length > 0 ? _perCycleEReq : null,
      perCycleHc: _perCycleHc.length > 0 ? _perCycleHc : null,
      perCycleHMass: _perCycleHMass.length > 0 ? _perCycleHMass : null,
      perCyclePa: _perCyclePa.length > 0 ? _perCyclePa : null,
      perCycleReClEffective: _perCycleReClEffective.length > 0 ? _perCycleReClEffective : null,
      perCycleVPD: _perCycleVPD.length > 0 ? _perCycleVPD : null,
      perCycleSweatRate: _perCycleSweatRate.length > 0 ? _perCycleSweatRate : null,
      perCycleTCl: _perCycleTCl.length > 0 ? _perCycleTCl : null,
      perCycleHTissue: _perCycleHTissue.length > 0 ? _perCycleHTissue : null,
      perCycleSRun: _perCycleSRun.length > 0 ? _perCycleSRun : null,
    };
  } else if (profile.type === 'linear') {
    // === LINEAR PATH (self-contained) ===
    // Sequential phases, sub-stepped. Used by BC ski (with vertical gain) and snowshoeing.
    // Note: LC5's linear path has a bug where the tail references cyclic-only variables;
    // here we keep the linear return self-contained so it can never crash.
    let cumMoisture = initialTrapped ?? 0;
    const stepInterval = 15;
    let _stepsAtCap = 0;
    let _linFatigue = 0;
    const _lSwr = shellWindRes ?? GENERIC_GEAR_SCORES_BY_SLOT.shell!.windResist;
    for (const phase of profile.phases) {
      const phaseMin = totalMin * (phase.pct ?? 0);
      const sr = phaseSweatRate(phase.intensity, phaseMin, phase.name);
      const phaseWind = getPhaseWind(phase.windType);
      const ventedMul = phase.canVent ? 1.6 : 1.0;
      const _lVpd = vpdRatio(tempF, humidity);
      const _lVentWR = phase.canVent ? _lSwr * 0.5 : _lSwr;
      const _lVEvap = V_BOUNDARY_MPH + phaseWind * getWindPenetration(_lVentWR);
      const _lRawEvap = (_lVEvap / 20) * _lVpd * ventedMul * imFactor * drysuitEvapBlock;
      const evapRate = Math.min(0.85, waderEvapFloor(_lRawEvap, humidity, waderType, fishWading));
      const steps = Math.max(1, Math.round(phaseMin / stepInterval));
      const stepDur = phaseMin / steps;
      const _stepHygro = hygroAbsorption(tempF, humidity, ensembleIm ?? 0, DEFAULT_REGAIN_POLYESTER) * (stepDur / 15);
      for (let s = 0; s < steps; s++) {
        const produced = sr * (stepDur / 60) / 1000;
        const evaporated = Math.min(produced, evapRate * produced);
        cumMoisture += Math.max(0, produced - evaporated) + _stepHygro;
        if ((precipProbability ?? 0) > 0 && activity !== 'kayaking' && activity !== 'paddle_boarding') {
          const _phy060swr5 = shellWindRes ?? 5;
          cumMoisture += precipWettingRate(precipProbability ?? 0, tempF, _phy060swr5) * (stepDur / 60);
        }
        if (cumMoisture > _systemCap) { cumMoisture = _systemCap; _stepsAtCap++; }
        if (cumMoisture >= CROSSOVER_LITERS) {
          const _lSev = Math.min(1, (cumMoisture - CROSSOVER_LITERS) / (FABRIC_CAPACITY_LITERS - CROSSOVER_LITERS));
          const _lResist = 1 - (_linFatigue / MAX_FATIGUE);
          _linFatigue += FATIGUE_PER_MIN * stepDur * _lSev * _lResist;
        } else {
          const _lHead = (CROSSOVER_LITERS - cumMoisture) / CROSSOVER_LITERS;
          _linFatigue *= (1 - RECOVERY_PER_MIN * stepDur * _lHead);
        }
        _linFatigue = Math.min(_linFatigue, MAX_FATIGUE);
      }
    }
    const _linTimeAtCapHrs = _stepsAtCap * (stepInterval / 60);
    const _linTrapped = Math.max(MIN_RETAINED_LITERS, cumMoisture);
    const _linCap = getEnsembleCapacity(activity);
    let _linSessionMR = Math.min(10, Math.round(applySaturationCascade(7.2 * (_linTrapped / _linCap)) * 10) / 10);
    if (_linTimeAtCapHrs > 0) { _linSessionMR = Math.min(10, Math.round(applyDurationPenalty(_linSessionMR, _linTimeAtCapHrs) * 10) / 10); }
    return {
      trapped: _linTrapped, sessionMR: _linSessionMR, timeAtCapHrs: _linTimeAtCapHrs,
      layerSat: null, perCycleTrapped: null, perCycleMR: null, perCycleWetPenalty: null,
      fatigue: _linFatigue, perCycleFatigue: null, perPhaseMR: null, perPhaseHL: null,
      perCycleHeatStorage: null, peakHeatBalanceW: 0, peakHeatBalanceDirection: 'neutral',
      peakHeatBalanceCycleIdx: -1, totalHeatBalanceWh: 0, peakSaturationFrac: 0,
      perCycleCoreTemp: null, perCycleCIVD: null, totalFluidLoss: null, fluidLossPerHr: null,
      perCycleTSkin: null, goodRunCount: null, yellowRunCount: null, totalRuns: null,
      layerBuffers: null, endingLayers: null,
    };
  } else {
    throw new Error('Unknown profile type: ' + profile.type);
  }
}
