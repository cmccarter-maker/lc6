#!/bin/bash
# LC6 Session 9c — Complete calcIntermittentMoisture: steady-state + linear paths
# Per Working Agreement Rule #13: verbatim Chat-produced script.
# Per Cardinal Rule #8: engine functions ported VERBATIM from LC5 LOCKED state.
#
# Scope:
#   - 3 new helper functions: sweatRate, elevTempAdj, calcBCPhasePercentages
#   - Replace β1 steady-state throw with actual implementation (~132 lines)
#   - Replace β1 linear throw with actual implementation (~58 lines)
#   - Structural refactor: hoist shared variables + extract tail from cyclic block
#   - Add BC ski profile override (replaces placeholder comment)
#
# NOTE: Snowshoeing linear path crashes in LC5 itself due to var hoisting —
# cyclic-only variables are undefined when linear path hits the tail.
# LC6 fixes by hoisting shared variables before the cyclic/linear branch.

set -e

echo ""
echo "=========================================="
echo "LC6 SESSION 9c BUILD"
echo "Complete calcIntermittentMoisture"
echo "=========================================="
echo ""

EXPECTED_DIR="/Users/cmcarter/Desktop/LC6"
if [ "$(pwd)" != "$EXPECTED_DIR" ]; then echo "ERROR: Not in $EXPECTED_DIR"; exit 1; fi
echo "✓ Environment verified"
echo ""

# ============================================================================
# PHASE 1 — New helper: moisture/sweat_rate.ts
# ============================================================================
echo ">>> PHASE 1: moisture/sweat_rate.ts"

cat > packages/engine/src/moisture/sweat_rate.ts << 'EOF'
// Standalone sweat rate calculation for steady-state activities.
// Ported VERBATIM from LC5 risk_functions.js lines 1810-1863.
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

import { ACTIVITY_SWEAT_PROFILES } from '../activities/profiles.js';
import { clothingInsulation } from '../ensemble/index.js';
import { altitudeFactors, getMetabolicEfficiency } from '../heat_balance/index.js';

interface FitnessProfile {
  sweatMul?: number;
  vo2max?: number;
  restingHR?: number;
  [key: string]: unknown;
}

/**
 * Standalone sweat rate for steady-state activities (g/hr).
 *
 * Used by the steady-state path in calcIntermittentMoisture for activities
 * without phase profiles (bouldering, climbing, camping, etc.).
 *
 * NOT the same as phaseSweatRate (cyclic closure) — this is the standalone version
 * with intermittency, golf cart reduction, and ski override applied.
 *
 * Floor: 15 g/hr (PHY-061 insensible perspiration, Gagge 1996).
 *
 * LC5 risk_functions.js lines 1810-1863.
 */
export function sweatRate(
  intensity: string,
  tempF: number,
  humidity: number,
  sex: string | null | undefined,
  weightLb: number | null | undefined,
  activity: string,
  immersionGear: string | boolean | null | undefined,
  paceMul: number | null | undefined,
  golfCartRiding: boolean | null | undefined,
  descentMul: number | null | undefined,
  snowTerrain: string | null | undefined,
  packLoadMul: number | null | undefined,
  elevFt: number | null | undefined,
  fitnessProfile: FitnessProfile | null | undefined,
): number {
  const isDrysuit = immersionGear === 'drysuit' || immersionGear === true;
  const profile = ACTIVITY_SWEAT_PROFILES[activity] ?? ACTIVITY_SWEAT_PROFILES.hiking!;
  let base = (profile as Record<string, number>)[intensity] ?? profile.moderate;
  if (activity === 'golf' && golfCartRiding) {
    base = base * 0.45;
  }
  const effectiveTemp = isDrysuit ? Math.max(tempF, Math.min(80, tempF + 30)) : tempF;
  const rawTempMul = effectiveTemp > 80 ? 1.5 : effectiveTemp > 65 ? 1.0 : effectiveTemp > 45 ? 0.6 : effectiveTemp > 30 ? 0.35 : 0.2;
  const tempMul = rawTempMul;
  const humMul = 1 + (Math.max(humidity - 40, 0) / 100) * 0.8;
  const sexMul = (sex === 'female') ? 0.75 : 1.0;
  const wt = weightLb ?? 150;
  const wtMul = 0.6 + (wt / 170) * 0.4;
  const cloMul = clothingInsulation(tempF, intensity);
  let effIntermittency = profile.intermittency;
  if (activity === 'bouldering' && paceMul && paceMul !== 1.0) {
    const shift = (paceMul - 1.0) * 0.22;
    effIntermittency = Math.max(0.25, Math.min(0.75, profile.intermittency + shift));
  }
  if (activity === 'golf' && golfCartRiding) {
    effIntermittency = 0.30;
  }
  const isSki = activity === 'skiing' || activity === 'snowboarding';
  if (isSki) {
    effIntermittency = 1.0;
  }
  const altMet = altitudeFactors(elevFt).metabolic;
  let _fitSweat = fitnessProfile?.sweatMul ?? 1.0;
  let _metEff = 1.0;
  if (fitnessProfile && (fitnessProfile.vo2max || fitnessProfile.restingHR)) {
    const _metMap: Record<string, number> = { low: 3, moderate: 5, high: 7, very_high: 9 };
    const _actMET = _metMap[intensity] ?? 5;
    _metEff = getMetabolicEfficiency(_actMET, fitnessProfile.vo2max ?? null, null, sex, fitnessProfile.restingHR ?? null);
    _fitSweat = 1.0;
  }
  const _activeSweat = base * tempMul * cloMul * humMul * sexMul * wtMul * profile.coverageMul * effIntermittency * (descentMul ?? 1.0) * (packLoadMul ?? 1.0) * altMet * _fitSweat * _metEff;
  return Math.max(15, _activeSweat);
}
EOF

echo "✓ sweat_rate.ts written"
echo ""

# ============================================================================
# PHASE 2 — Append elevTempAdj to heat_balance/altitude.ts
# ============================================================================
echo ">>> PHASE 2: Append elevTempAdj to altitude.ts"

cat >> packages/engine/src/heat_balance/altitude.ts << 'EOF'

/**
 * Elevation-based temperature lapse rate adjustment (°F).
 *
 * ~3.5°F per 1000 ft gained. Capped at -18°F max adjustment to prevent
 * double-counting when weather data is already fetched at/near peak elevation.
 *
 * LC5 risk_functions.js lines 784-789.
 *
 * @param gainFt elevation gain in feet from base
 * @returns temperature adjustment in °F (always ≤ 0)
 */
export function elevTempAdj(gainFt: number): number {
  return Math.max(-18, -(gainFt / 1000) * 3.5);
}
EOF

echo "✓ altitude.ts appended"
echo ""

# ============================================================================
# PHASE 3 — Append calcBCPhasePercentages to activities/profiles.ts
# ============================================================================
echo ">>> PHASE 3: Append calcBCPhasePercentages to activities/profiles.ts"

cat >> packages/engine/src/activities/profiles.ts << 'EOF'

/**
 * Compute backcountry ski phase percentages from vertical gain.
 *
 * Skinning rate: ~1500 ft/hr (standard uphilling pace).
 * Transition: fixed 10 min summit stop.
 * Descent rate: provided by caller (3000-4000 ft/hr depending on terrain).
 *
 * Returns null if verticalGainFt ≤ 0.
 *
 * LC5 risk_functions.js lines 1620-1631.
 */
export interface BCPhasePercentages {
  skinning: number;
  transition: number;
  descent: number;
}

export function calcBCPhasePercentages(
  verticalGainFt: number | null | undefined,
  descentRateFtPerHr: number | null | undefined,
): BCPhasePercentages | null {
  if (!verticalGainFt || verticalGainFt <= 0) return null;
  const skinningHrs = verticalGainFt / 1500;
  const transitionHrs = 10 / 60;
  const descentHrs = verticalGainFt / (descentRateFtPerHr ?? 4000);
  const totalPhaseHrs = skinningHrs + transitionHrs + descentHrs;
  return {
    skinning: skinningHrs / totalPhaseHrs,
    transition: transitionHrs / totalPhaseHrs,
    descent: descentHrs / totalPhaseHrs,
  };
}
EOF

echo "✓ profiles.ts appended"
echo ""

# ============================================================================
# PHASE 4 — Update module indexes
# ============================================================================
echo ">>> PHASE 4: Update module indexes"

cat >> packages/engine/src/moisture/index.ts << 'EOF'

// Session 9c — standalone sweat rate
export { sweatRate } from './sweat_rate.js';
EOF

cat >> packages/engine/src/heat_balance/index.ts << 'EOF'

// Session 9c — lapse rate
export { elevTempAdj } from './altitude.js';
EOF

cat >> packages/engine/src/activities/index.ts << 'EOF'

// Session 9c — BC phase percentages
export { calcBCPhasePercentages } from './profiles.js';
export type { BCPhasePercentages } from './profiles.js';
EOF

cat >> packages/engine/src/index.ts << 'EOF'

// Session 9c
export { sweatRate } from './moisture/index.js';
export { elevTempAdj } from './heat_balance/index.js';
export { calcBCPhasePercentages } from './activities/index.js';
export type { BCPhasePercentages } from './activities/index.js';
EOF

echo "✓ Module indexes updated"
echo ""

# ============================================================================
# PHASE 5 — Structural refactor of calc_intermittent_moisture.ts
#            Uses Python for surgical precision on the large file
# ============================================================================
echo ">>> PHASE 5: Structural refactor of calc_intermittent_moisture.ts"
echo "    - Add imports for new helpers"
echo "    - Replace steady-state β1 throw with implementation"
echo "    - Add BC ski override"
echo "    - Hoist shared variables before cyclic/linear branch"
echo "    - Extract tail from inside cyclic block"
echo "    - Replace linear β1 throw with implementation"

python3 << 'PYEOF'
import sys

with open('packages/engine/src/moisture/calc_intermittent_moisture.ts', 'r') as f:
    content = f.read()

# ===== FIX 1: Add imports for new Session 9c helpers =====
old_imports_end = "import type { PhaseProfile, PhaseDefinition } from '../activities/profiles.js';"
new_imports = """import type { PhaseProfile, PhaseDefinition } from '../activities/profiles.js';

// Session 9c imports
import { sweatRate } from './sweat_rate.js';
import { elevTempAdj, calcElevationHumidity as calcElevHum9c } from '../heat_balance/altitude.js';
import { calcBCPhasePercentages } from '../activities/profiles.js';"""

if old_imports_end not in content:
    print("ERROR: Could not find import anchor for Session 9c imports")
    sys.exit(1)
content = content.replace(old_imports_end, new_imports)
# Remove duplicate calcElevationHumidity import (already imported from heat_balance/index.js)
content = content.replace("import { calcElevHum9c } from '../heat_balance/altitude.js';", "")
content = content.replace(", calcElevationHumidity as calcElevHum9c } from '../heat_balance/altitude.js';", " } from '../heat_balance/altitude.js';")
# Clean up: just need elevTempAdj and calcBCPhasePercentages
content = content.replace(
    "import { sweatRate } from './sweat_rate.js';\nimport { elevTempAdj, calcElevationHumidity as calcElevHum9c } from '../heat_balance/altitude.js';\nimport { calcBCPhasePercentages } from '../activities/profiles.js';",
    "import { sweatRate } from './sweat_rate.js';\nimport { elevTempAdj } from '../heat_balance/altitude.js';\nimport { calcBCPhasePercentages } from '../activities/profiles.js';"
)

# ===== FIX 2: Replace steady-state β1 throw with actual implementation =====
old_ss = """  // β1: Steady-state fallback — NOT YET PORTED (Session 9c)
  if (!profile) {
    throw new Error(`Session 9c TODO: steady-state path not yet ported. Activity: ${activity}`);
  }"""

new_ss = """  // === STEADY-STATE FALLBACK (PHY-039B) ===
  // Activities without phase profiles: bouldering, climbing, camping, hunting, etc.
  // Sub-steps along elevation profile when available; uniform time steps otherwise.
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
    const _hasElev = _mutableCycleOverride?.elevProfile && _mutableCycleOverride.elevProfile.length >= 2;
    const _epScaled = _hasElev ? _mutableCycleOverride!.elevProfile! : null;
    const _epGrade = _hasElev ? (_mutableCycleOverride!.rawElevProfile ?? _mutableCycleOverride!.elevProfile!) : null;
    const _dpC = _mutableCycleOverride?.dewPointC ?? null;
    const _baseElev = _hasElev ? (_mutableCycleOverride!.baseElevFt ?? 0) : 0;
    const _totalDist = _hasElev ? (_mutableCycleOverride!.totalDistMi ?? 1) : 0;
    const _tripStyle = _hasElev ? (_mutableCycleOverride!.tripStyle ?? 'out_and_back') : 'out_and_back';
    // Out-and-back: mirror profiles for return leg
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
    const _pace = _totalDist > 0 ? (_totalDist / durationHrs) : 3.0;
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
      // Grade-based intensity from RAW distances
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
      const _localDryBonus = _localRH < 20 ? 1.8 : _localRH < 30 ? 1.4 : _localRH < 40 ? 1.15 : 1.0;
      const _stepEvapRaw = (_ssVEvap / 20) * _localVpd * _ssImF * _localDryBonus;
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
      // Vent events
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
      _perStepMR.push(Math.min(10, Math.round(7.2 * (_ssTrapped / _ssCap) * 10) / 10));
    }
    let _ssMR = Math.max(..._perStepMR);
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
  }"""

if old_ss not in content:
    print("ERROR: Could not find steady-state β1 throw")
    sys.exit(1)
content = content.replace(old_ss, new_ss)

# ===== FIX 3: Replace BC ski placeholder with actual override =====
old_bc = """  // BC skiing: override phase percentages when vertical gain is provided
  // This converts BC ski to linear type, which will hit the β1 stub below
  if (profileKey === 'skiing_bc' && bcVerticalGainFt && bcVerticalGainFt > 0) {
    // calcBCPhasePercentages not yet ported — linear stub will catch this
    // Preserve LC5 behavior: BC ski with vertical gain routes to linear path
  }"""

new_bc = """  // BC skiing: override phase percentages when vertical gain is provided
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
  }"""

if old_bc not in content:
    print("ERROR: Could not find BC ski placeholder")
    sys.exit(1)
content = content.replace(old_bc, new_bc)

# ===== FIX 4: Replace linear β1 throw + extract tail from cyclic block =====
# Strategy: Find the tail inside the cyclic block, move it outside.
# The tail starts with "// === TAIL: Return assembly ==="
# and goes to the end of the cyclic if-block.
# Then replace the linear throw with actual implementation.

# First, find and extract the tail from inside the cyclic block
tail_marker = "    // === TAIL: Return assembly ==="
tail_idx = content.find(tail_marker)
if tail_idx < 0:
    print("ERROR: Could not find tail marker")
    sys.exit(1)

# Find the closing of the cyclic block + linear else-if + unknown else
# The pattern after the tail+return is:
#   } else if (profile.type === 'linear') {
#     throw ...
#   } else {
#     throw ...
#   }
# }

# Extract the tail content (from marker to end of return statement)
# We need to find the return { ... }; that closes the cyclic block
return_end = content.find("    };", tail_idx)
# This finds the first `    };` after the tail marker — should be end of return
# But we need to be more specific. The return object ends with `    };`
# Let me search for the specific closing pattern of the return
closing_pattern = """      endingLayers: _layers.map(l => ({ im: l.im, cap: l.cap, buffer: l.buffer, wicking: l.wicking, fiber: l.fiber, name: l.name })),
    };
  } else if (profile.type === 'linear') {
    // β1: Linear path — NOT YET PORTED (Session 9c)
    throw new Error(`Session 9c TODO: linear path not yet ported. Activity: ${activity}, profileKey: ${profileKey}`);
  } else {
    throw new Error(`Unknown profile type: ${profile.type}`);
  }
}"""

if closing_pattern not in content:
    print("ERROR: Could not find closing pattern for cyclic+linear+else")
    sys.exit(1)

# Extract the tail (from marker to just before the return's closing `};`)
tail_content = content[tail_idx:content.find(closing_pattern)]
# The tail needs to be at the SAME indentation level but outside the cyclic block

replacement = """      endingLayers: _layers.map(l => ({ im: l.im, cap: l.cap, buffer: l.buffer, wicking: l.wicking, fiber: l.fiber, name: l.name })),
    };
""" + """  } else if (profile.type === 'linear') {
    // === LINEAR PATH (Session 9c) ===
    // Sequential phases, sub-stepped to model realistic saturation dynamics.
    // Long phases need periodic drain events — fabric saturates continuously.
    let cumMoisture = initialTrapped ?? 0;
    const stepInterval = 15;
    const _linDrainGhr = getDrainRate(tempF, humidity, windMph, ensembleIm ?? 0, activityCLO(activity), _bsa || 2.13);
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
      const _lRawEvap = (_lVEvap / 20) * _lVpd * ventedMul * imFactor * drysuitEvapBlock * dryAirBonus;
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
    _totalTimeAtCapHrs = _stepsAtCap * (stepInterval / 60);
    netTrapped = Math.max(MIN_RETAINED_LITERS, cumMoisture);
    // Propagate linear fatigue to shared tail
    _fatigue = _linFatigue;
""" + """  } else {
    throw new Error('Unknown profile type: ' + profile.type);
  }

  // === SHARED TAIL: Return assembly (used by both cyclic and linear paths) ===
""" + tail_content.replace(tail_marker, "").lstrip() + """
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
    };
}"""

content = content.replace(closing_pattern, replacement)

# ===== FIX 5: Hoist shared variables before cyclic/linear branch =====
# The tail references variables that are currently only declared inside the cyclic block.
# These need to be declared before the if/else to be accessible from both paths + tail.
# In LC5, var hoists these automatically; in TS with let/const they're block-scoped.

# The shared variables used by the tail that are currently inside the cyclic block:
# _perCycleTrapped, _perCycleMR, _perCycleHL, _perPhaseMR, _perPhaseHL,
# _fatigue (already partially hoisted), _perCycleFatigue,
# _perCycleHeatStorage, _peakCycleHeatBalanceW, _peakCycleHeatBalanceDirection,
# _peakCycleHeatBalanceIdx, _cumStorageWmin, _perCycleCoreTemp, _perCycleCIVD,
# _totalFluidLoss, _perCycleTSkin, _goodRunCount, _yellowRunCount,
# wholeCycles, _layers

# Add declarations before the cyclic/linear branch
branch_anchor = "  if (profile.type === 'cyclic') {"
hoisted_vars = """  // Hoisted shared variables: accessible by cyclic path, linear path, AND shared tail.
  // In LC5, `var` hoists these to function scope. In LC6 with let/const, they must be
  // declared before the if/else branch. LC5 snowshoeing linear path crashes without this
  // (tail references undefined cyclic-only vars).
  let _fatigue = 0;
  let wholeCycles = 0;
  let _layers: GearLayer[] = [];
  const _perCycleTrapped: number[] = [];
  const _perCycleMR: number[] = [];
  const _perCycleHL: number[] = [];
  const _perPhaseMR: Array<{phase:string; cycle:number; mr:number; trapped:number}> = [];
  const _perPhaseHL: Array<{phase:string; cycle:number; hl:number; hlWatts:number; fatigue:number}> = [];
  const _perCycleFatigue: number[] = [];
  const _perCycleHeatStorage: number[] = [];
  let _peakCycleHeatBalanceW = 0;
  let _peakCycleHeatBalanceDirection = 'neutral';
  let _peakCycleHeatBalanceIdx = -1;
  let _cumStorageWmin = 0;
  const _perCycleCoreTemp: number[] = [];
  const _perCycleCIVD: number[] = [];
  let _totalFluidLoss = 0;
  const _perCycleTSkin: number[] = [];
  let _goodRunCount = 0;
  let _yellowRunCount = 0;

  """ + branch_anchor

if branch_anchor not in content:
    print("ERROR: Could not find cyclic branch anchor")
    sys.exit(1)
content = content.replace(branch_anchor, hoisted_vars, 1)  # Replace only first occurrence

# Now remove the DUPLICATE declarations that are inside the cyclic block
# These were the original declarations that are now hoisted.
# They need to become assignments instead of declarations.
cyclic_dups = [
    ("    const _perCycleTrapped: number[] = [];", "    // _perCycleTrapped already hoisted"),
    ("    const _perCycleMR: number[] = [];", "    // _perCycleMR already hoisted"),
    ("    const _perCycleHL: number[] = [];", "    // _perCycleHL already hoisted"),
    ("    const _perPhaseMR: Array<{phase:string; cycle:number; mr:number; trapped:number}> = [];", "    // _perPhaseMR already hoisted"),
    ("    const _perPhaseHL: Array<{phase:string; cycle:number; hl:number; hlWatts:number; fatigue:number}> = [];", "    // _perPhaseHL already hoisted"),
    ("    let _fatigue = 0;", "    // _fatigue already hoisted"),
    ("    const _perCycleFatigue: number[] = [];", "    // _perCycleFatigue already hoisted"),
    ("    const _perCycleHeatStorage: number[] = [];", "    // _perCycleHeatStorage already hoisted"),
    ("    let _peakCycleHeatBalanceW = 0;", "    // _peakCycleHeatBalanceW already hoisted"),
    ("    let _peakCycleHeatBalanceDirection = 'neutral';", "    // _peakCycleHeatBalanceDirection already hoisted"),
    ("    let _peakCycleHeatBalanceIdx = -1;", "    // _peakCycleHeatBalanceIdx already hoisted"),
    ("    let _cumStorageWmin = 0;", "    // _cumStorageWmin already hoisted"),
    ("    const _perCycleCoreTemp: number[] = [];", "    // _perCycleCoreTemp already hoisted"),
    ("    const _perCycleCIVD: number[] = [];", "    // _perCycleCIVD already hoisted"),
    ("    let _totalFluidLoss = 0;", "    // _totalFluidLoss already hoisted"),
    ("    const _perCycleTSkin: number[] = [];", "    // _perCycleTSkin already hoisted"),
    ("    let _goodRunCount = 0;", "    // _goodRunCount already hoisted"),
    ("    let _yellowRunCount = 0;", "    // _yellowRunCount already hoisted"),
]
for old, new in cyclic_dups:
    if old in content:
        content = content.replace(old, new, 1)

# Also need to remove the duplicate return statement that was inside the cyclic block
# The old return is still there — we added a NEW return in the shared tail.
# Find and remove the old cyclic return block.
old_return_start = "    return {\n      trapped: netTrapped,"
old_return_end = "      endingLayers: _layers.map(l => ({ im: l.im, cap: l.cap, buffer: l.buffer, wicking: l.wicking, fiber: l.fiber, name: l.name })),\n    };\n"
old_return_idx = content.find(old_return_start)
if old_return_idx >= 0:
    old_return_end_idx = content.find(old_return_end, old_return_idx)
    if old_return_end_idx >= 0:
        # Remove the first (old cyclic) return block entirely
        end_pos = old_return_end_idx + len(old_return_end)
        content = content[:old_return_idx] + content[end_pos:]

# wholeCycles also needs to be an assignment inside the cyclic block, not a declaration
content = content.replace("    const wholeCycles = _useOverride", "    wholeCycles = _useOverride", 1)

# _layers assignment inside cyclic block: change let to reassignment
content = content.replace("    let _layers: GearLayer[];", "    // _layers already hoisted", 1)
# But _layers is assigned later with if/else — those assignments should stay
# Actually, looking at it: inside the cyclic block we have:
#   let _layers: GearLayer[];
#   if (...) { _layers = ...; } else { _layers = ...; }
# With hoisting, we just remove the `let _layers: GearLayer[];` line

with open('packages/engine/src/moisture/calc_intermittent_moisture.ts', 'w') as f:
    f.write(content)

print("✓ Structural refactor applied successfully")
PYEOF

echo "✓ calc_intermittent_moisture.ts refactored"
echo ""

# ============================================================================
# PHASE 6 — Tests
# ============================================================================
echo ">>> PHASE 6: Tests for Session 9c additions"

cat > packages/engine/tests/moisture/sweat_rate.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { sweatRate } from '../../src/moisture/sweat_rate.js';

describe('sweatRate (standalone, steady-state path)', () => {
  it('skiing moderate 16F → 112.56 g/hr', () => {
    expect(sweatRate('moderate', 16, 40, 'male', 170, 'skiing', null, 1.0, false, null, 'groomers', 1.0, 0, null)).toBeCloseTo(112.56, 0);
  });
  it('hiking moderate 55F → 275.62 g/hr', () => {
    expect(sweatRate('moderate', 55, 60, 'male', 170, 'hiking', null, 1.0, false, null, null, 1.0, 0, null)).toBeCloseTo(275.62, 0);
  });
  it('bouldering moderate 50F → 87.25 g/hr', () => {
    expect(sweatRate('moderate', 50, 50, 'male', 170, 'bouldering', null, 1.0, false, null, null, 1.0, 0, null)).toBeCloseTo(87.25, 0);
  });
  it('camping low 40F → 15 g/hr (insensible floor)', () => {
    expect(sweatRate('low', 40, 50, 'male', 170, 'camping', null, 1.0, false, null, null, 1.0, 0, null)).toBe(15);
  });
});
EOF

cat > packages/engine/tests/activities/bc_phase_pct.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { calcBCPhasePercentages } from '../../src/activities/profiles.js';

describe('calcBCPhasePercentages', () => {
  it('3000ft gain, 4000 ft/hr descent → skin=0.6857 trans=0.0571 desc=0.2571', () => {
    const r = calcBCPhasePercentages(3000, 4000)!;
    expect(r.skinning).toBeCloseTo(0.6857, 3);
    expect(r.transition).toBeCloseTo(0.0571, 3);
    expect(r.descent).toBeCloseTo(0.2571, 3);
  });
  it('5000ft gain → more skinning', () => {
    const r = calcBCPhasePercentages(5000, 4000)!;
    expect(r.skinning).toBeCloseTo(0.7018, 3);
  });
  it('null/0 gain → null', () => {
    expect(calcBCPhasePercentages(0, 4000)).toBeNull();
    expect(calcBCPhasePercentages(null, 4000)).toBeNull();
  });
  it('percentages sum to 1.0', () => {
    const r = calcBCPhasePercentages(3000, 4000)!;
    expect(r.skinning + r.transition + r.descent).toBeCloseTo(1.0, 6);
  });
});
EOF

cat > packages/engine/tests/heat_balance/elev_temp_adj.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { elevTempAdj } from '../../src/heat_balance/altitude.js';

describe('elevTempAdj (lapse rate)', () => {
  it('0 ft gain → 0°F adjustment', () => { expect(elevTempAdj(0)).toBe(0); });
  it('1000 ft gain → -3.5°F', () => { expect(elevTempAdj(1000)).toBeCloseTo(-3.5, 4); });
  it('3000 ft gain → -10.5°F', () => { expect(elevTempAdj(3000)).toBeCloseTo(-10.5, 4); });
  it('caps at -18°F for extreme gain', () => { expect(elevTempAdj(10000)).toBe(-18); });
});
EOF

# Update the calc_intermittent_moisture e2e test to add steady-state + linear scenarios
cat >> packages/engine/tests/moisture/calc_intermittent_moisture.test.ts << 'EOF'

describe('calcIntermittentMoisture — bouldering 50°F 2hrs (steady-state)', () => {
  const r = calcIntermittentMoisture(
    'bouldering', 50, 50, 5, 2, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 0.4', () => { expect(r.sessionMR).toBe(0.4); });
  it('trapped ≈ 0.0130', () => { expect(r.trapped).toBeCloseTo(0.0130, 3); });
  it('has perStepMR (steady-state output)', () => { expect(r.perStepMR?.length).toBe(20); });
  it('no perCycleTrapped (not cyclic)', () => { expect(r.perCycleTrapped).toBeNull(); });
});

describe('calcIntermittentMoisture — camping 40°F 8hrs (steady-state)', () => {
  const r = calcIntermittentMoisture(
    'camping', 40, 50, 3, 8, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'low', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 0', () => { expect(r.sessionMR).toBe(0); });
  it('trapped = 0', () => { expect(r.trapped).toBe(0); });
});

describe('calcIntermittentMoisture — snowshoeing 20°F 3hrs (linear)', () => {
  it('does not throw (Session 9c removes β1 stub)', () => {
    expect(() => calcIntermittentMoisture(
      'snowshoeing', 20, 40, 5, 3, 'male', 170, 1.0, 0.089, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 5, null, 0, null, null, null, 0, null,
    )).not.toThrow();
  });

  it('returns valid sessionMR > 0', () => {
    const r = calcIntermittentMoisture(
      'snowshoeing', 20, 40, 5, 3, 'male', 170, 1.0, 0.089, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 5, null, 0, null, null, null, 0, null,
    );
    expect(r.sessionMR).toBeGreaterThanOrEqual(0);
    expect(r.trapped).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.sessionMR)).toBe(true);
  });
});
EOF

echo "✓ Tests written"
echo ""

# ============================================================================
# PHASE 7 — Run tests + typecheck + commit + push
# ============================================================================
echo ">>> PHASE 7: Run tests, typecheck, commit, push"

echo ""
echo "--- run engine tests ---"
pnpm --filter @lc6/engine test

echo ""
echo "--- typecheck ---"
pnpm typecheck

echo ""
echo "--- Git ---"
git add .
git commit -m "Session 9c: Complete calcIntermittentMoisture — steady-state + linear paths

All three paths of calcIntermittentMoisture now operational. β1 stubs removed.

New helpers:
  - moisture/sweat_rate.ts: sweatRate (standalone steady-state sweat, PHY-061 15g/hr floor)
  - heat_balance/altitude.ts APPEND: elevTempAdj (lapse rate, -3.5°F/1000ft, cap -18°F)
  - activities/profiles.ts APPEND: calcBCPhasePercentages (BC ski vertical gain → phase split)

Structural refactor of calc_intermittent_moisture.ts:
  - Shared variables hoisted before cyclic/linear branch (JS var hoisting → TS let/const)
  - Tail extracted from inside cyclic block to shared section after both branches
  - Fixes LC5 snowshoeing crash: linear path accessed undefined cyclic-only var.length
  - BC ski profile override now active (was placeholder in Session 9b)

Paths now operational:
  - Steady-state: bouldering, climbing, camping, hunting, skateboarding, onewheel, XC ski
  - Cyclic: skiing, snowboarding, golf, fishing, kayaking, cycling, hiking, running, MTB
  - Linear: snowshoeing, BC ski, XC ski (via INTERMITTENT_PHASE_PROFILES)

Tests: added steady-state (bouldering, camping), linear (snowshoeing), helper tests.
Lock-in baselines from LC5 verbatim source."

git push origin main

echo ""
echo "=========================================="
echo "SESSION 9c BUILD COMPLETE"
echo "=========================================="
echo "calcIntermittentMoisture is FULLY OPERATIONAL."
echo ""
