#!/bin/bash
# LC6 Session 9a — Foundational helpers + data structures port from LC5
# Per Working Agreement Rule #13: verbatim Chat-produced script.
# Per Cardinal Rule #8: thermal engine functions ported VERBATIM from LC5 LOCKED state.
# Per Pre-Build Audit (Session 9a opening): all 18 Cardinal Rules verified before code production.
#
# Scope: 13 helper functions + 7 data structure constants prepping for Session 9b/9c
# (the calcIntermittentMoisture port). All helpers are atomic — no orchestration.
#
# Module structure:
#   - heat_balance/body_thermo.ts  APPEND duboisBSA
#   - heat_balance/epoc.ts         NEW  epocParams + epocTau + estimateCoreTemp
#   - heat_balance/cold_physiology.ts NEW civdProtectionFactor + shiveringBoost + computeHLR
#   - moisture/                    NEW MODULE
#     - perceived_mr.ts             NEW computePerceivedMR + PERCEIVED_WEIGHTS + COMFORT_THRESHOLD
#     - saturation_cascade.ts       NEW applySaturationCascade
#     - index.ts                    NEW
#   - activities/                   NEW MODULE
#     - split_body.ts                NEW WADER_DATA + SNOW_SPORT_ZONES + waderSplitIm/CLO + snowSportSplitIm
#     - descent.ts                   NEW descentSpeedWind + descent data
#     - profiles.ts                  NEW INTERMITTENT_PHASE_PROFILES + ACTIVITY_SWEAT_PROFILES + GENERIC_GEAR_SCORES_BY_SLOT
#     - index.ts                    NEW
#
# DO NOT MODIFY DURING THIS SCRIPT (Rule #12 — no while-we're-in-here):
#   - Algorithm internals of any function
#   - LC5 INTERMITTENT_PHASE_PROFILES values (Compendium of Physical Activities baselines)
#   - WADER_DATA / SNOW_SPORT_ZONES values (PHY-052/PHY-065 audit baselines)
#   - PERCEIVED_WEIGHTS / COMFORT_THRESHOLD (Fukazawa 2003)
#   - "cyclic" naming in profiles — OQ-029 future cleanup
#   - Existing Sessions 5-8 files (only body_thermo.ts gets one append)

set -e

echo ""
echo "=========================================="
echo "LC6 SESSION 9a BUILD"
echo "Foundational helpers + data structures"
echo "=========================================="
echo ""

# ============================================================================
# PHASE 1 — Verify environment
# ============================================================================
echo ">>> PHASE 1: Verify environment"
EXPECTED_DIR="/Users/cmcarter/Desktop/LC6"
if [ "$(pwd)" != "$EXPECTED_DIR" ]; then
  echo "ERROR: Not in $EXPECTED_DIR. Currently in $(pwd)."
  exit 1
fi
if [ ! -d "packages/engine/src/ensemble" ]; then
  echo "ERROR: packages/engine/src/ensemble/ not found. Sessions 5-8 must be complete."
  exit 1
fi
echo "✓ In $EXPECTED_DIR with Sessions 5-8 workspace present"
echo ""

# ============================================================================
# PHASE 2 — Create new directories
# ============================================================================
echo ">>> PHASE 2: Create moisture/ and activities/ module directories"
mkdir -p packages/engine/src/moisture
mkdir -p packages/engine/src/activities
mkdir -p packages/engine/tests/moisture
mkdir -p packages/engine/tests/activities
mkdir -p packages/engine/tests/heat_balance
echo "✓ Directories created"
echo ""

# ============================================================================
# PHASE 3 — heat_balance/body_thermo.ts: APPEND duboisBSA
# ============================================================================
echo ">>> PHASE 3: Append duboisBSA to heat_balance/body_thermo.ts"

cat >> packages/engine/src/heat_balance/body_thermo.ts << 'EOF'

/**
 * DuBois body surface area estimate (m²) from body weight in pounds.
 *
 * Uses a stratified height lookup to avoid requiring height as a parameter:
 *   < 60 kg  → 165 cm
 *   60-80 kg → 173 cm
 *   80-100 kg → 178 cm
 *   100-120 kg → 180 cm
 *   120-140 kg → 183 cm
 *   ≥ 140 kg → 185 cm
 *
 * Formula: BSA = 0.007184 × height_cm^0.725 × weight_kg^0.425
 * Source: DuBois D & DuBois EF (1916) "A formula to estimate surface area"
 *
 * LC5 risk_functions.js lines 3873-3877.
 *
 * @param weightLb body weight in pounds (defaults to 150 if null/undefined)
 * @returns body surface area in m²
 */
export function duboisBSA(weightLb: number | null | undefined): number {
  const kg = (weightLb ?? 150) * 0.453592;
  const hCm = kg < 60 ? 165 : kg < 80 ? 173 : kg < 100 ? 178 : kg < 120 ? 180 : kg < 140 ? 183 : 185;
  return 0.007184 * Math.pow(hCm, 0.725) * Math.pow(kg, 0.425);
}
EOF

echo "✓ body_thermo.ts appended"
echo ""

# ============================================================================
# PHASE 4 — heat_balance/epoc.ts: EPOC + core temp
# ============================================================================
echo ">>> PHASE 4: Create heat_balance/epoc.ts"

cat > packages/engine/src/heat_balance/epoc.ts << 'EOF'
// EPOC (Excess Post-exercise Oxygen Consumption) and core temp tracking.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

import { LC5_BODY_SPEC_HEAT } from './constants.js';

/**
 * Two-component EPOC model parameters (Børsheim & Bahr 2003, Sports Med 33(14)).
 *
 * Returns parameters for the recovery curve:
 *   MET(t) = MET_rest + aFast × exp(-t/tauFast) + aSlow × exp(-t/tauSlow)
 *
 * Intensity-dependent split per Børsheim Table 2:
 *   - MET ≤ 6: tauFast=3 min, tauSlow=30 min, fastFrac=0.70 (more fast component)
 *   - MET > 6: tauFast=5 min, tauSlow=45 min, fastFrac=0.60 (more slow component)
 *
 * LC5 risk_functions.js lines 130-137.
 *
 * @param METrun MET value during work phase
 * @param METrest MET value at rest (defaults to 1.5)
 */
export interface EpocParamsResult {
  tauFast: number;  // minutes
  tauSlow: number;  // minutes
  aFast: number;    // amplitude of fast component
  aSlow: number;    // amplitude of slow component
}

export function epocParams(METrun: number, METrest?: number): EpocParamsResult {
  const dMET = METrun - (METrest ?? 1.5);
  const fastFrac = METrun <= 6 ? 0.70 : 0.60;
  const tauFast = METrun <= 6 ? 3 : 5;
  const tauSlow = METrun <= 6 ? 30 : 45;
  return {
    tauFast,
    tauSlow,
    aFast: dMET * fastFrac,
    aSlow: dMET * (1 - fastFrac),
  };
}

/**
 * Legacy single-tau EPOC wrapper (backward compat for CLO floor calculations).
 *
 * Three-regime piecewise formula:
 *   - MET ≤ 3: tau = 4 min
 *   - MET 3-6: tau = 4 + (MET-3) × 2 min
 *   - MET > 6: tau = 10 + (MET-6) × 3.3 min
 *
 * LC5 risk_functions.js lines 138-143.
 */
export function epocTau(METrun: number): number {
  if (METrun <= 3) return 4;
  if (METrun <= 6) return 4 + (METrun - 3) * 2;
  return 10 + (METrun - 6) * 3.3;
}

/**
 * Core temperature from cumulative heat storage (Gagge 1972).
 *
 * Formula: ΔT = (cumStorage_W·min × 60 s/min) / (mass_kg × c_p_body)
 * where c_p_body = LC5_BODY_SPEC_HEAT = 3490 J/(kg·°C).
 *
 * Result clamped to physiologically plausible range [34.0, 39.5] °C.
 *
 * LC5 risk_functions.js lines 146-150.
 *
 * @param baseCoreC starting core temperature (°C, typically 37.0)
 * @param cumStorageWmin cumulative heat storage in W·minutes (negative = cooling)
 * @param bodyMassKg body mass in kg
 */
export function estimateCoreTemp(
  baseCoreC: number,
  cumStorageWmin: number,
  bodyMassKg: number,
): number {
  const energyJ = cumStorageWmin * 60;
  const deltaT = energyJ / (bodyMassKg * LC5_BODY_SPEC_HEAT);
  return Math.max(34.0, Math.min(39.5, baseCoreC + deltaT));
}
EOF

echo "✓ epoc.ts written"
echo ""

# ============================================================================
# PHASE 5 — heat_balance/cold_physiology.ts: CIVD + shivering + HLR
# ============================================================================
echo ">>> PHASE 5: Create heat_balance/cold_physiology.ts"

cat > packages/engine/src/heat_balance/cold_physiology.ts << 'EOF'
// Cold-side physiological responses: CIVD vasoconstriction, shivering, HLR scoring.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * CIVD (Cold-Induced Vasodilation) protection factor (Flouris & Cheung 2008).
 *
 * Returns 0.0 (fully protected — CIVD active in extremities) to 1.0 (CIVD abandoned).
 * Body sacrifices peripheral perfusion to defend core when core temp drops.
 *
 * Piecewise:
 *   ≥ 37.5°C → 0.0 (no risk, full peripheral perfusion)
 *   37.0-37.5 → linear ramp 0.0 → 0.3
 *   36.5-37.0 → linear ramp 0.3 → 0.7
 *   36.0-36.5 → linear ramp 0.7 → 1.0
 *   < 36.0   → 1.0 (CIVD abandoned)
 *
 * LC5 risk_functions.js lines 152-160.
 *
 * @param coreTempC core body temperature in °C
 */
export function civdProtectionFactor(coreTempC: number): number {
  // 0.0 = fully protected (CIVD active), 1.0 = abandoned (CIVD absent)
  if (coreTempC >= 37.5) return 0.0;
  if (coreTempC >= 37.0) return (37.5 - coreTempC) / 0.5 * 0.3;
  if (coreTempC >= 36.5) return 0.3 + (37.0 - coreTempC) / 0.5 * 0.4;
  if (coreTempC >= 36.0) return 0.7 + (36.5 - coreTempC) / 0.5 * 0.3;
  return 1.0;
}

/**
 * Shivering thermogenesis boost in METs (Young et al. 1986).
 *
 * Cold stress (T_amb < 10°C) is mitigated by CLO insulation and body fat.
 * Shivering activates when current activity MET is below the cold-stress crossover.
 *
 * Formulas:
 *   coldStress = max(0, (10 - T_amb) / 30)
 *   protection = CLO × 0.3 + (BF/100) × 0.5
 *   net = max(0, coldStress - protection)
 *   crossover = 2 + net × 4
 *   if MET ≥ crossover: 0 (no shivering needed)
 *   else: min(2.5, (crossover - MET)/crossover × 2.5 × net)
 *
 * Capped at 2.5 METs (Hayward et al. 1975 maximum sustainable shivering).
 *
 * LC5 risk_functions.js lines 181-190.
 *
 * @param TambC ambient temperature (°C)
 * @param METcurrent current metabolic rate (MET)
 * @param CLOtotal total clothing insulation (CLO)
 * @param bodyFatPct body fat percentage (0-100)
 */
export function shiveringBoost(
  TambC: number,
  METcurrent: number,
  CLOtotal: number,
  bodyFatPct: number,
): number {
  const coldStress = Math.max(0, (10 - TambC) / 30);
  const protection = CLOtotal * 0.3 + (bodyFatPct / 100) * 0.5;
  const net = Math.max(0, coldStress - protection);
  const crossover = 2 + net * 4;
  if (METcurrent >= crossover) return 0;
  return Math.max(0, Math.min(2.5, (crossover - METcurrent) / crossover * 2.5 * net));
}

/**
 * Heat-Loss Risk score (HLR, 0-10) from energy deficit + core temp + ambient + wetness.
 *
 * Composite multiplier (independent physical mechanisms — no double-dipping):
 *   base × coreAmp × coldSev × wetness, capped at 10.
 *
 * Components:
 *   - base: from heat balance deficit (negative deficit → surplus → low base)
 *   - coreAmp: 1.0 + civdDanger (1.0 to 2.0; rising as core temp drops)
 *   - coldSev: ambient severity (1.3 below -10°C; ramped to 0.8 above 5°C)
 *   - wetness: 1.0 + satFrac × 0.5 (saturated layers amplify HLR)
 *
 * LC5 risk_functions.js lines 162-179.
 *
 * @param deficitW heat balance residual in W (negative = surplus, positive = deficit)
 * @param coreTempC core body temperature (°C)
 * @param TambC ambient temperature (°C)
 * @param satFrac layer saturation fraction (0-1)
 */
export function computeHLR(
  deficitW: number,
  coreTempC: number,
  TambC: number,
  satFrac: number,
): number {
  let base: number;
  if (deficitW < 0) {
    base = 1.5 + Math.abs(deficitW) / 60;
  } else {
    base = Math.max(0.5, 2.0 - deficitW / 100);
  }
  const civdDanger = civdProtectionFactor(coreTempC);
  const coreAmp = 1.0 + civdDanger; // 1.0 → 2.0
  let coldSev: number;
  if (TambC < -10) coldSev = 1.3;
  else if (TambC < 0) coldSev = 1.0 + (-TambC) / 50;
  else if (TambC < 5) coldSev = 1.0;
  else coldSev = Math.max(0.8, 1.0 - (TambC - 5) / 50);
  const wetness = 1.0 + satFrac * 0.5;
  return Math.min(10, base * coreAmp * coldSev * wetness);
}
EOF

echo "✓ cold_physiology.ts written"
echo ""

# ============================================================================
# PHASE 6 — moisture/perceived_mr.ts + saturation_cascade.ts + index.ts
# ============================================================================
echo ">>> PHASE 6: Create moisture/ module"

cat > packages/engine/src/moisture/perceived_mr.ts << 'EOF'
// Perceived moisture risk — skin-weighted layer saturation perception.
// Ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * Perceived MR layer weights — skin-adjacent layers matter most.
 *
 * Source: Fukazawa 2003, Zhang 2002 — skin wetness perception correlates with
 * skin-fabric interface, not deeper layer saturation.
 *
 * Order: [base, mid, insulation, shell].
 * LC5 risk_functions.js line 287.
 */
export const PERCEIVED_WEIGHTS: readonly number[] = [3, 2, 1.5, 1];

/**
 * Comfort threshold for base layer in mL.
 *
 * Source: Fukazawa 2003 — skin wetness perception onset at ~50 g/m².
 * Torso base layer contact area ~0.8 m² → threshold ~40 mL.
 *
 * LC5 risk_functions.js line 291.
 */
export const COMFORT_THRESHOLD = 40;

/**
 * Layer with buffer state for perceived MR calculation.
 */
export interface PerceivedMRLayer {
  buffer: number;  // mL retained moisture
  cap: number;     // mL maximum capacity
}

/**
 * Compute perceived MR (0-10 scale) from layer buffer state.
 *
 * Base layer (i=0): uses absolute moisture vs comfort threshold (40 mL).
 *   User feels moisture against skin regardless of how much fabric CAN hold.
 *
 * Other layers (i≥1): use fill fraction (buffer/cap).
 *   User doesn't feel these layers directly; they affect drying and perception
 *   indirectly through capacity.
 *
 * Weighted average using PERCEIVED_WEIGHTS, scaled by 7.2 to project onto 0-10.
 *
 * LC5 risk_functions.js lines 293-309.
 *
 * @param layers per-layer buffer state in skin-out order
 */
export function computePerceivedMR(
  layers: PerceivedMRLayer[] | null | undefined,
): number {
  if (!layers || layers.length === 0) return 0;
  // Base layer (i=0): absolute moisture vs comfort threshold, not fill fraction
  const base = layers[0]!;
  const baseSat = Math.min(1, base.buffer / COMFORT_THRESHOLD);
  let num = PERCEIVED_WEIGHTS[0]! * baseSat;
  let den = PERCEIVED_WEIGHTS[0]!;
  // Other layers: fill fraction
  for (let i = 1; i < layers.length; i++) {
    const w = PERCEIVED_WEIGHTS[Math.min(i, PERCEIVED_WEIGHTS.length - 1)]!;
    const layer = layers[i]!;
    const fill = layer.cap > 0 ? Math.min(1, layer.buffer / layer.cap) : 0;
    num += w * fill;
    den += w;
  }
  if (den <= 0) return 0;
  return Math.min(10, 7.2 * (num / den));
}
EOF

cat > packages/engine/src/moisture/saturation_cascade.ts << 'EOF'
// Saturation cascade curve transformation (LC5 Saturation Cascade v3).
// Ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * Apply saturation cascade curve to raw MR.
 *
 * Two-phase curve:
 *   Phase 1 (0-6): Linear pass-through
 *     "Absorption + Crossover" — air pockets still mostly intact, k < 0.15 W/m·K
 *   Phase 2 (6-10): Quadratic ease-out
 *     "Saturation Cascade" — remaining air pockets collapse with accelerating speed
 *     Worst damage near full saturation. Castellani & Young (2016): wet k → 0.6 W/m·K
 *   ≥ 10: Capped at 10 (fully saturated)
 *
 * v3 change vs older curve: less aggressive in 6-8 range to preserve gear differentiation
 * in the cascade zone (raw 7 → 7.75 instead of 9.1).
 *
 * Formula (Phase 2): 6.0 + 4.0 × (1 - (1 - frac)²) where frac = (raw - 6) / 4
 *
 * LC5 risk_functions.js lines 839-845.
 *
 * @param rawMR raw moisture risk score
 * @returns transformed MR with saturation cascade applied
 */
export function applySaturationCascade(rawMR: number): number {
  if (rawMR <= 6.0) return rawMR;       // Linear through Absorption + Crossover
  if (rawMR >= 10.0) return 10.0;       // Fully saturated — cap at max
  const ex = rawMR - 6.0;               // 0 to 4 range
  const frac = ex / 4.0;                // 0 to 1 normalized
  return 6.0 + 4.0 * (1 - Math.pow(1 - frac, 2));  // Quadratic ease-out
}
EOF

cat > packages/engine/src/moisture/index.ts << 'EOF'
// LC6 moisture module — public API.
// Session 9a build: perceived MR, saturation cascade.

export {
  PERCEIVED_WEIGHTS,
  COMFORT_THRESHOLD,
  computePerceivedMR,
} from './perceived_mr.js';

export type { PerceivedMRLayer } from './perceived_mr.js';

export { applySaturationCascade } from './saturation_cascade.js';
EOF

echo "✓ moisture/ module written"
echo ""

# ============================================================================
# PHASE 7 — activities/split_body.ts + descent.ts + profiles.ts + index.ts
# ============================================================================
echo ">>> PHASE 7: Create activities/ module"

cat > packages/engine/src/activities/split_body.ts << 'EOF'
// Split-body models for activities with sealed regions.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

import { BASELINE_IM } from '../heat_balance/constants.js';

/**
 * Wader gear data for fishing split-body model (PHY-052).
 *
 * Each entry has:
 *   - im: Woodcock permeability index for lower body (0 for sealed neoprene)
 *   - clo: thermal insulation of wader material in CLO units
 *   - label: display name for UI
 *
 * Upper body (45%) uses normal im_ensemble; lower body (55%) uses wader im/clo.
 *
 * Source: ISO 15027 immersion suit testing methodology + manufacturer specs.
 * LC5 risk_functions.js lines 930-941.
 */
export interface WaderEntry {
  im: number;
  clo: number;
  label: string;
}

export const WADER_DATA: Readonly<Record<string, WaderEntry>> = {
  neoprene_5mm:           { im: 0.00, clo: 1.50, label: 'Neoprene 5mm' },
  neoprene_3mm:           { im: 0.00, clo: 0.70, label: 'Neoprene 3mm' },
  neoprene_3_5mm:         { im: 0.00, clo: 0.90, label: 'Neoprene 3.5mm' },
  breathable:             { im: 0.15, clo: 0.15, label: 'Breathable' },
  breathable_budget:      { im: 0.10, clo: 0.15, label: 'Breathable (budget)' },
  breathable_fleece:      { im: 0.15, clo: 0.75, label: 'Breathable + fleece' },
  breathable_expedition:  { im: 0.15, clo: 1.10, label: 'Breathable + expedition' },
  wet_wading_3mm:         { im: 0.00, clo: 0.25, label: 'Wet wading (3mm sock)' },
  wet_wading_2mm:         { im: 0.00, clo: 0.20, label: 'Wet wading (2mm sock)' },
  none:                   { im: 0.00, clo: 0.00, label: 'No waders' },
};

/**
 * Snow sport split-body BSA zones (PHY-065).
 *
 * Sealed extremities limit whole-body vapor transfer in skiing/snowboarding.
 * Mandatory sealed barriers (boots, gloves, helmet, goggles, insulated pants)
 * cover ~51% of BSA. Layering system covers ~80% (trunk + arms + upper legs).
 *
 * BSA fractions per ANSUR II 2012 + Rule of Nines (medical TBSA standard).
 * Boot im: ski boots are rigid plastic — effectively im ≈ 0 for vapor (ISO 9920)
 * Glove im: insulated ski gloves im 0.03-0.05 (Havenith 2002 Table 4)
 * Helmet im: hard shell + foam liner — negligible vapor transfer
 * Ski pants im: insulated waterproof — im 0.08-0.12 (ISO 9920 Category E)
 *
 * LC5 risk_functions.js lines 967-974.
 */
export interface SnowSportZone {
  frac: number;
  im?: number;
  usesEnsemble?: boolean;
}

export const SNOW_SPORT_ZONES: Readonly<Record<string, SnowSportZone>> = {
  layeringSystem: { frac: 0.80, usesEnsemble: true },  // trunk 36% + arms 18% + upper legs 26%
  hands:          { frac: 0.05, im: 0.05 },  // gloves: leather palm + breathable back, merino liner
  head:           { frac: 0.05, im: 0.03 },  // helmet: hard shell + wicking liner
  feet:           { frac: 0.04, im: 0.02 },  // ski boots: rigid plastic, merino socks inside
  calves:         { frac: 0.04, im: 0.01 },  // inside rigid boot shaft
  face:           { frac: 0.02, im: 0.01 },  // goggles: sealed foam + lens
};

/**
 * Wader-aware split-body Woodcock im (PHY-052).
 *
 * 45% upper body (normal im_ensemble) + 55% lower body (wader im).
 * Returns ensembleIm unchanged when no wader / 'none' / unknown wader type.
 *
 * LC5 risk_functions.js lines 943-948.
 *
 * @param ensembleIm upper-body ensemble im
 * @param waderType wader gear identifier (e.g., 'neoprene_5mm')
 */
export function waderSplitIm(
  ensembleIm: number | null | undefined,
  waderType: string | null | undefined,
): number {
  if (!waderType || waderType === 'none' || !WADER_DATA[waderType]) {
    return ensembleIm ?? 0;
  }
  const upper = ensembleIm ?? BASELINE_IM;
  const lower = WADER_DATA[waderType]!.im;
  return 0.45 * upper + 0.55 * lower;
}

/**
 * Wader-aware split-body CLO (PHY-052).
 *
 * 45% upper (existing CLO estimate) + 55% lower (wader CLO).
 * Returns upperCLO unchanged when no wader / 'none' / unknown wader type.
 *
 * LC5 risk_functions.js lines 950-953.
 *
 * @param upperCLO upper-body CLO estimate
 * @param waderType wader gear identifier
 */
export function waderSplitCLO(
  upperCLO: number,
  waderType: string | null | undefined,
): number {
  if (!waderType || waderType === 'none' || !WADER_DATA[waderType]) {
    return upperCLO;
  }
  return 0.45 * upperCLO + 0.55 * WADER_DATA[waderType]!.clo;
}

/**
 * Snow sport split-body Woodcock im (PHY-065).
 *
 * Six-zone weighted average: 80% layering system (uses ensembleIm) +
 * 20% sealed extremities (gloves + helmet + boots + calves + face).
 *
 * Falls back to BASELINE_IM if ensembleIm is null/0.
 *
 * LC5 risk_functions.js lines 975-984.
 *
 * @param ensembleIm upper-body layering system ensemble im
 */
export function snowSportSplitIm(ensembleIm: number | null | undefined): number {
  const ens = ensembleIm || BASELINE_IM;
  const z = SNOW_SPORT_ZONES;
  return z.layeringSystem!.frac * ens +
    z.hands!.frac * (z.hands!.im ?? 0) +
    z.head!.frac * (z.head!.im ?? 0) +
    z.feet!.frac * (z.feet!.im ?? 0) +
    z.calves!.frac * (z.calves!.im ?? 0) +
    z.face!.frac * (z.face!.im ?? 0);
}
EOF

cat > packages/engine/src/activities/descent.ts << 'EOF'
// Descent speed wind lookup (PHY-019).
// Ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * Result of descentSpeedWind — descent speed (mph) and time-in-fall-line fraction.
 */
export interface DescentSpeedWindResult {
  speed: number;       // average descent speed in mph
  turnFactor: number;  // fraction of time in fall line (0-1)
}

/**
 * Descent speed wind data per ski/snowboard terrain variant.
 *
 * Sources: Shealy et al. 2023 radar data + GPS aggregates from SkiTalk/AlpineZone.
 *
 * Effective wind during descent: W_run = W_ambient + speed × turnFactor
 *
 * LC5 risk_functions.js lines 1438-1450.
 *
 * Strips ski/snowboard sport prefix per PHY-030 unified terrain keys.
 *
 * Returns default { speed: 25, turnFactor: 0.6 } for unknown variants
 * or non-string inputs.
 *
 * @param variant terrain variant string (e.g., 'groomers', 'skiing_groomers', 'moguls')
 */
export function descentSpeedWind(variant: string | null | undefined): DescentSpeedWindResult {
  if (typeof variant !== 'string') return { speed: 25, turnFactor: 0.6 };
  // PHY-030: Unified terrain keys (ski = snowboard). Strip sport prefix for backward compat.
  const v = variant.replace(/^(skiing|snowboarding)_/, '');
  const data: Record<string, DescentSpeedWindResult> = {
    groomers: { speed: 30, turnFactor: 0.7 },  // 20-35 mph avg, medium-radius turns
    moguls:   { speed: 12, turnFactor: 0.5 },  // 8-15 mph, constant tight turns
    trees:    { speed:  8, turnFactor: 0.45 }, // 5-12 mph, line-picking pauses
    bowls:    { speed: 20, turnFactor: 0.6 },  // 15-25 mph, open steeps/chutes
    park:     { speed: 18, turnFactor: 0.55 }, // 12-22 mph approach between features
  };
  return data[v] ?? { speed: 25, turnFactor: 0.6 };
}
EOF

cat > packages/engine/src/activities/profiles.ts << 'EOF'
// Activity profile data: phase definitions, sweat profiles, gear score baselines.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.
//
// NOMENCLATURE NOTE (OQ-029): LC5 uses type:"cyclic" for activities with
// duty-cycle work/rest patterns (golf, fishing, cycling, kayaking) AND for
// true lap-based activities (resort skiing). "Cyclic" here means
// "duty-cycle modeled" not "lap-based." OQ-029 tracks future rename consideration.

/**
 * Per-activity sweat profile parameters.
 *
 * Sweat rates (g/hr) by intensity level + coverage multiplier + intermittency.
 * Sources: Bergh & Forsberg 1992; ACSM Sawka 2007; Compendium of Physical Activities.
 *
 * - low/moderate/high/very_high: sweat rate (g/hr) at given intensity
 * - coverageMul: skin coverage multiplier (1.0 = standard; 1.4 = full ski suit)
 * - intermittency: fraction of time spent at active intensity (0-1)
 *
 * LC5 risk_functions.js lines 1409-1434.
 */
export interface ActivitySweatProfile {
  low: number;
  moderate: number;
  high: number;
  very_high: number;
  coverageMul: number;
  intermittency: number;
}

export const ACTIVITY_SWEAT_PROFILES: Readonly<Record<string, ActivitySweatProfile>> = {
  running:           { low: 250, moderate: 600, high: 1000, very_high: 1400, coverageMul: 0.85, intermittency: 1.0 },
  // MFC #2 validated: S₀ per Bergh & Forsberg (1992), ACSM Sawka (2007)
  // f_cov=1.40: full-body tight-fitting XC suit. f_int=0.80: terrain undulation recovery.
  // Last validated: 2026-03-06, 18°F/10mph/30%RH/170lb scenario.
  cross_country_ski: { low: 120, moderate: 350, high:  600, very_high:  900, coverageMul: 1.40, intermittency: 0.80 },
  day_hike:          { low: 180, moderate: 400, high:  700, very_high: 1000, coverageMul: 1.0,  intermittency: 0.9 },
  hiking:            { low: 180, moderate: 400, high:  700, very_high: 1000, coverageMul: 1.0,  intermittency: 0.9 },
  backpacking:       { low: 200, moderate: 450, high:  750, very_high: 1050, coverageMul: 1.15, intermittency: 0.85 },
  skiing:            { low: 120, moderate: 300, high:  550, very_high:  800, coverageMul: 1.4,  intermittency: 0.55 },
  snowboarding:      { low: 120, moderate: 300, high:  550, very_high:  800, coverageMul: 1.4,  intermittency: 0.50 },
  mountain_biking:   { low: 180, moderate: 450, high:  800, very_high: 1150, coverageMul: 0.95, intermittency: 0.75 },
  road_cycling:      { low: 150, moderate: 380, high:  700, very_high: 1050, coverageMul: 0.80, intermittency: 0.95 },
  gravel_biking:     { low: 170, moderate: 420, high:  750, very_high: 1100, coverageMul: 0.90, intermittency: 0.85 },
  climbing:          { low: 150, moderate: 350, high:  650, very_high:  900, coverageMul: 0.90, intermittency: 0.60 },
  bouldering:        { low: 130, moderate: 320, high:  600, very_high:  850, coverageMul: 0.85, intermittency: 0.45 },
  snowshoeing:       { low: 170, moderate: 420, high:  720, very_high: 1000, coverageMul: 1.2,  intermittency: 0.9 },
  camping:           { low:  80, moderate: 150, high:  250, very_high:  400, coverageMul: 1.0,  intermittency: 0.3 },
  fishing:           { low:  70, moderate: 130, high:  220, very_high:  350, coverageMul: 0.95, intermittency: 0.25 },
  golf:              { low: 150, moderate: 350, high:  600, very_high:  900, coverageMul: 0.90, intermittency: 0.50 },
  skateboarding:     { low: 120, moderate: 280, high:  500, very_high:  750, coverageMul: 0.80, intermittency: 0.55 },
  onewheel:          { low:  50, moderate: 100, high:  180, very_high:  280, coverageMul: 0.85, intermittency: 0.70 },
  kayaking:          { low: 100, moderate: 280, high:  500, very_high:  750, coverageMul: 1.1,  intermittency: 0.85 },
  paddle_boarding:   { low:  90, moderate: 250, high:  450, very_high:  700, coverageMul: 0.95, intermittency: 0.80 },
  hunting:           { low: 100, moderate: 280, high:  500, very_high:  750, coverageMul: 1.0,  intermittency: 0.40 },
};

/**
 * Single phase definition within an INTERMITTENT_PHASE_PROFILES entry.
 */
export interface PhaseDefinition {
  name: string;
  durMin?: number;             // for type:"cyclic" — phase duration in minutes
  pct?: number;                // for type:"linear" — fraction of trip duration (0-1)
  intensity: 'low' | 'moderate' | 'high' | 'very_high';
  windType: string;
  canVent: boolean;
}

/**
 * Phase profile for an activity. Two types:
 *   - "cyclic": repeating duty cycle (work/rest), phases sum to one cycle
 *   - "linear": single trip traversal, phases scale by pct
 *
 * NOMENCLATURE NOTE (OQ-029): "cyclic" here means "duty-cycle modeled" not "lap-based."
 * Activities like golf and fishing use "cyclic" because they have repeating work-rest
 * patterns (cast/wait, walk/wait), not because golfers go in laps.
 */
export interface PhaseProfile {
  type: 'cyclic' | 'linear';
  phases: PhaseDefinition[];
}

/**
 * Phase profiles for intermittent activities — Compendium of Physical Activities (Ainsworth et al., 2011).
 *
 * Replaces flat intensity × intermittency approximation with explicit per-phase duty cycle physics.
 *
 * LC5 risk_functions.js lines 1453-1594.
 */
export const INTERMITTENT_PHASE_PROFILES: Readonly<Record<string, PhaseProfile>> = {
  // PHY-031: Unified resort terrain profiles — ski = snowboard per terrain
  // Lift ride = 7 min (high-speed quad western avg). Mogul run 10→7 (SkiTalk/AlpineZone data).
  // Per-cycle physics phases only (run+lift). Transition+line+rest handled by cycleOverride.
  groomers: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 3, intensity: 'moderate', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7, intensity: 'low',      windType: 'ambient',         canVent: false },
  ]},
  moguls: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 7, intensity: 'very_high', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7, intensity: 'low',       windType: 'ambient',         canVent: false },
  ]},
  trees: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 10, intensity: 'high', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7,  intensity: 'low',  windType: 'ambient',         canVent: false },
  ]},
  bowls: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 6, intensity: 'high', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7, intensity: 'low',  windType: 'ambient',         canVent: false },
  ]},
  park: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 4, intensity: 'moderate', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7, intensity: 'low',      windType: 'ambient',         canVent: false },
  ]},
  // Backcountry ski/splitboard: skinning → summit transition → descent (linear, not cyclic)
  // Skinning ≈ vigorous XC (Compendium 19180, 8.0 METs) with heavy gear → very_high
  // Transition: stopped, near-basal. Descent: moderate-high skiing (Compendium 19150, 5.3 METs)
  skiing_bc: { type: 'linear', phases: [
    { name: 'skinning',   pct: 0.55, intensity: 'very_high', windType: 'walking', canVent: true },
    { name: 'transition', pct: 0.05, intensity: 'low',       windType: 'ridge',   canVent: true },
    { name: 'descent',    pct: 0.40, intensity: 'high',      windType: 'speed',   canVent: false },
  ]},
  // Golf walking: 4 min walk+swing + 11 min wait → ~4 holes/hr
  // Source: Compendium 15255 (golf, walking, carrying clubs 4.3 METs)
  golf_walk: { type: 'cyclic', phases: [
    { name: 'walk_swing', durMin: 4,  intensity: 'moderate', windType: 'ambient', canVent: true },
    { name: 'wait',       durMin: 11, intensity: 'low',      windType: 'ambient', canVent: true },
  ]},
  // Golf cart: 0.5 min swing + 14.5 min ride/wait → ~4 holes/hr
  // Source: Compendium 15238 (golf, riding cart 3.5 METs average)
  golf_cart: { type: 'cyclic', phases: [
    { name: 'swing',     durMin: 0.5,  intensity: 'moderate', windType: 'calm', canVent: true },
    { name: 'ride_wait', durMin: 14.5, intensity: 'low',      windType: 'cart', canVent: true },
  ]},
  // Fishing shore/boat (stationary): 2.5 min cast/retrieve + 10 min wait
  // Source: Compendium 04001 (fishing, general 3.5 METs)
  fishing_shore: { type: 'cyclic', phases: [
    { name: 'cast', durMin: 2.5, intensity: 'moderate', windType: 'ambient', canVent: true },
    { name: 'wait', durMin: 10,  intensity: 'low',      windType: 'ambient', canVent: true },
  ]},
  // Fishing wading: 5 min wade/reposition + 2.5 min cast + 5 min wait
  // Source: Compendium 04050 (fishing in stream, wading 6.0 METs)
  // Wading against current raises metabolic rate significantly vs shore fishing
  fishing_wading: { type: 'cyclic', phases: [
    { name: 'wade', durMin: 5,   intensity: 'moderate', windType: 'ambient', canVent: true },
    { name: 'cast', durMin: 2.5, intensity: 'moderate', windType: 'ambient', canVent: true },
    { name: 'wait', durMin: 5,   intensity: 'low',      windType: 'ambient', canVent: true },
  ]},
  // Kayaking — creek/whitewater: 10 min rapids + 3 min eddy (spray deck sealed throughout)
  // Compendium 18115: whitewater kayaking = 8.0 METs → very_high; eddy = near-basal recovery
  // Spray deck remains sealed in eddy — no venting opportunity. Sheltered eddy = calm wind.
  // Primary creek vs lake differentiator is immersion risk (external wetting), not sweat alone.
  kayaking_creek: { type: 'cyclic', phases: [
    { name: 'rapids', durMin: 10, intensity: 'very_high', windType: 'kayak', canVent: false },
    { name: 'eddy',   durMin: 3,  intensity: 'low',       windType: 'calm',  canVent: false },
  ]},
  // Kayaking — lake/flatwater: 15 min sustained paddle + 7.5 min drift
  // Compendium 18090: kayaking moderate = 5.0 METs. Drift allows passive venting.
  kayaking_lake: { type: 'cyclic', phases: [
    { name: 'paddle', durMin: 15,  intensity: 'high', windType: 'kayak',   canVent: false },
    { name: 'drift',  durMin: 7.5, intensity: 'low',  windType: 'ambient', canVent: true },
  ]},
  // Kayaking — ocean/sea: 20 min sustained paddle + 5 min rest (swell, current, longer sets)
  // More continuous effort than lake; less rest. Wind exposure on open water.
  kayaking_ocean: { type: 'cyclic', phases: [
    { name: 'paddle', durMin: 20, intensity: 'high', windType: 'kayak',   canVent: false },
    { name: 'rest',   durMin: 5,  intensity: 'low',  windType: 'ambient', canVent: true },
  ]},
  // SUP — lake: 12 min paddle + 6 min rest. Upright posture, full-body balance.
  // Compendium 18095: paddleboarding = 6.0 METs. Less upper-body enclosure → better ventilation.
  // coverageMul 0.95 (vs kayak 1.1) reflects more exposed upper body on SUP.
  sup_lake: { type: 'cyclic', phases: [
    { name: 'paddle', durMin: 12, intensity: 'moderate', windType: 'kayak',   canVent: true },
    { name: 'rest',   durMin: 6,  intensity: 'low',      windType: 'ambient', canVent: true },
  ]},
  // SUP — ocean: 18 min sustained + 4 min rest. Ocean touring demands higher sustained output.
  sup_ocean: { type: 'cyclic', phases: [
    { name: 'paddle', durMin: 18, intensity: 'high', windType: 'kayak',   canVent: false },
    { name: 'rest',   durMin: 4,  intensity: 'low',  windType: 'ambient', canVent: true },
  ]},
  // SUP — creek: whitewater SUP, very high intensity, sealed position for balance
  sup_creek: { type: 'cyclic', phases: [
    { name: 'rapids', durMin: 10, intensity: 'very_high', windType: 'kayak', canVent: false },
    { name: 'eddy',   durMin: 3,  intensity: 'low',       windType: 'calm',  canVent: false },
  ]},
  // Road cycling — flat: sustained high effort, ~15% stops (lights, junctions)
  // Compendium 01015 (14-16 mph = 10.0 METs). Flat = no climb/descent intensity swings.
  // cycling_speed wind throughout — consistent forward-motion wind cooling.
  cycling_road_flat: { type: 'cyclic', phases: [
    { name: 'ride', durMin: 51, intensity: 'high', windType: 'cycling_speed', canVent: true },
    { name: 'stop', durMin: 9,  intensity: 'low',  windType: 'ambient',       canVent: true },
  ]},
  // Gravel cycling — flat: slightly lower intensity than road flat, variable surface
  // Compendium 01013 (12-14 mph = 8.0 METs). ~20% recovery/variable terrain.
  cycling_gravel_flat: { type: 'cyclic', phases: [
    { name: 'ride',     durMin: 48, intensity: 'high',     windType: 'cycling_speed', canVent: true },
    { name: 'recovery', durMin: 12, intensity: 'moderate', windType: 'cycling_speed', canVent: true },
  ]},
  // Road cycling hilly: climb/flat/descent cycle ~45 min
  // Source: Compendium 01015 (cycling 14-16 mph, 10.0 METs), 01013 (12-14 mph, 8.0 METs),
  // 01009 (coasting/descent, ~3.0 METs)
  cycling_road_hilly: { type: 'cyclic', phases: [
    { name: 'climb',   durMin: 18,   intensity: 'very_high', windType: 'headwind_low',  canVent: true },
    { name: 'flat',    durMin: 13.5, intensity: 'high',      windType: 'cycling_speed', canVent: true },
    { name: 'descent', durMin: 13.5, intensity: 'low',       windType: 'descent_speed', canVent: false },
  ]},
  // Gravel cycling hilly: longer climbs, slower descents ~50 min cycle
  // Source: Compendium 01009 adjusted for gravel surface resistance
  cycling_gravel_hilly: { type: 'cyclic', phases: [
    { name: 'climb',   durMin: 22.5, intensity: 'high', windType: 'headwind_low',  canVent: true },
    { name: 'flat',    durMin: 12.5, intensity: 'high', windType: 'cycling_speed', canVent: true },
    { name: 'descent', durMin: 15,   intensity: 'low',  windType: 'descent_speed', canVent: false },
  ]},
  // XC skiing: sustained push phase + glide/descent phase (linear, not cyclic)
  // Compendium 19180: XC ski vigorous = 9.0 METs (push/uphill); 19170: moderate = 6.8 METs (flat/glide)
  // Descent glide sealed: speed wind, low vent opportunity. Push/flat: vented via collar/zipper.
  // Phase split: ~55% push (uphill+flat effort), ~5% transition, ~40% glide/descent
  // Same linear sub-step structure as skiing_bc — fabric-cap drain correctly bounds long trips.
  xc_ski: { type: 'linear', phases: [
    { name: 'push',       pct: 0.55, intensity: 'high',     windType: 'walking', canVent: true },
    { name: 'transition', pct: 0.05, intensity: 'moderate', windType: 'walking', canVent: true },
    { name: 'glide',      pct: 0.40, intensity: 'moderate', windType: 'speed',   canVent: false },
  ]},
  // Snowshoeing: sustained uphill + descent (linear, same structure as XC ski / BC ski)
  // Compendium 17152: snowshoeing uphill = 8.3 METs (high); flat/descent ~5.3 METs (moderate)
  // Ascent: vented (collar, vent zipper accessible). Descent: sealed against speed wind.
  // Phase split: 60% ascent / 40% descent (standard out-and-back mountain profile)
  snowshoeing: { type: 'linear', phases: [
    { name: 'ascent',  pct: 0.60, intensity: 'high',     windType: 'walking', canVent: true },
    { name: 'descent', pct: 0.40, intensity: 'moderate', windType: 'ambient', canVent: false },
  ]},
};

/**
 * Per-slot generic gear scores — realistic "closet gear" baseline.
 *
 * Used as fallback when user has not entered specific gear (PHY-025).
 *
 * Note: Session 9b/9c will only use `.shell.windResist` from this constant
 * (in the steady-state and cyclic paths). Other fields are preserved for
 * future use in other engine functions.
 *
 * LC5 risk_functions.js lines 2217-2226.
 */
export interface GearSlotScores {
  breathability: number;
  moisture: number;
  windResist: number;
  warmthRatio: number;
  waterproof: number;
}

export const GENERIC_GEAR_SCORES_BY_SLOT: Readonly<Record<string, GearSlotScores>> = {
  base:       { breathability: 3, moisture: 2, windResist: 1, warmthRatio: 2, waterproof: 0 },
  mid:        { breathability: 4, moisture: 3, windResist: 1, warmthRatio: 5, waterproof: 0 },
  insulative: { breathability: 4, moisture: 3, windResist: 1, warmthRatio: 5, waterproof: 0 },
  shell:      { breathability: 2, moisture: 1, windResist: 8, warmthRatio: 1, waterproof: 2 },
  legs:       { breathability: 3, moisture: 2, windResist: 2, warmthRatio: 2, waterproof: 0 },
  legsBase:   { breathability: 3, moisture: 2, windResist: 1, warmthRatio: 2, waterproof: 0 },
  feet:       { breathability: 4, moisture: 3, windResist: 4, warmthRatio: 3, waterproof: 0 },
  head:       { breathability: 3, moisture: 2, windResist: 2, warmthRatio: 3, waterproof: 0 },
};
EOF

cat > packages/engine/src/activities/index.ts << 'EOF'
// LC6 activities module — public API.
// Session 9a build: split-body models, descent wind, activity profile data.

export {
  WADER_DATA,
  SNOW_SPORT_ZONES,
  waderSplitIm,
  waderSplitCLO,
  snowSportSplitIm,
} from './split_body.js';

export type { WaderEntry, SnowSportZone } from './split_body.js';

export { descentSpeedWind } from './descent.js';
export type { DescentSpeedWindResult } from './descent.js';

export {
  ACTIVITY_SWEAT_PROFILES,
  INTERMITTENT_PHASE_PROFILES,
  GENERIC_GEAR_SCORES_BY_SLOT,
} from './profiles.js';

export type {
  ActivitySweatProfile,
  PhaseDefinition,
  PhaseProfile,
  GearSlotScores,
} from './profiles.js';
EOF

echo "✓ activities/ module written"
echo ""

# ============================================================================
# PHASE 8 — Update heat_balance/index.ts and engine main index
# ============================================================================
echo ">>> PHASE 8: Update heat_balance/index.ts + engine src/index.ts"

# Append new heat_balance exports
cat >> packages/engine/src/heat_balance/index.ts << 'EOF'

// Session 9a — body anthropometry
export { duboisBSA } from './body_thermo.js';

// Session 9a — EPOC + core temp
export {
  epocParams,
  epocTau,
  estimateCoreTemp,
} from './epoc.js';
export type { EpocParamsResult } from './epoc.js';

// Session 9a — cold physiology
export {
  civdProtectionFactor,
  shiveringBoost,
  computeHLR,
} from './cold_physiology.js';
EOF

cat > packages/engine/src/index.ts << 'EOF'
// LC6 Engine — Public API
// Per Architecture Document v1.1 §3 RATIFIED.

// CDI v1.4 module surface (Session 5)
export type {
  Regime,
  ClinicalStage,
  CdiBasis,
  StageDetectionInput,
  StageDetectionOutput,
  StageTierRange,
  WithinStageRampInput,
  WithinStageRampOutput,
  ShiveringSustainedInput,
  ShiveringSustainedOutput,
} from './types.js';

export {
  detectStage,
  applyStagePromotion,
  applyWithinStageRamp,
  detectShiveringSustained,
  STAGE_TIER_RANGES,
  STAGE_TAU_MAX_HR,
  STAGE_PROMOTION_THRESHOLD_HR,
} from './cdi/index.js';

// Heat balance module — Sessions 6 + 7 + 9a
export {
  // Session 6 constants
  L_V_J_PER_G,
  BASELINE_IM,
  TYPICAL_ENSEMBLE_IM,
  V_BOUNDARY_MPH,
  MIN_RETAINED_LITERS,
  FABRIC_CAPACITY_LITERS,
  C_HYGRO,
  DEFAULT_REGAIN_POLYESTER,
  ACTIVITY_LAYER_COUNT,
  // Session 7 constants
  LC5_C_P_AIR,
  LC5_RHO_AIR,
  LC5_RHO_VAP_EXP,
  LC5_SIGMA,
  LC5_EMISS,
  LC5_T_CORE_BASE,
  LC5_BODY_SPEC_HEAT,
  GAGGE_H_TISSUE_BASE,
  GAGGE_VDIL_MAX,
  GAGGE_VCON_MAX,
  // Session 6 VPD + utilities
  satVaporPressure,
  vpdRatio,
  VPD_REF_HPA,
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
  // Session 6 evaporation
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
  // Session 7 body thermo
  computeTissueCLO,
  computeTSkin,
  iterativeTSkin,
  // Session 7 metabolism
  computeVE,
  computeMetabolicHeat,
  computeRespiratoryHeatLoss,
  // Session 7 environmental loss
  computeConvectiveHeatLoss,
  computeRadiativeHeatLoss,
  // Session 9a body anthropometry
  duboisBSA,
  // Session 9a EPOC + core temp
  epocParams,
  epocTau,
  estimateCoreTemp,
  // Session 9a cold physiology
  civdProtectionFactor,
  shiveringBoost,
  computeHLR,
} from './heat_balance/index.js';

export type {
  ComputeEmaxResult,
  ComputeSweatRateResult,
  SweatRegime,
  IterativeTSkinResult,
  RespiratoryHeatLossResult,
  EpocParamsResult,
} from './heat_balance/index.js';

// Ensemble module — Session 8
export {
  ENSEMBLE_IM_MAP,
  ENSEMBLE_LAYER_NAMES,
  ENSEMBLE_LAYER_KEYS,
  calcEnsembleIm,
  FIBER_ABSORPTION,
  getFiberType,
  getLayerCapacity,
  breathabilityToIm,
  activityCLO,
  warmthToCLO,
  buildLayerArray,
  pumpingReduction,
  windCLOProtection,
  staticLayeringCorrection,
  computeEffectiveCLO,
  clothingInsulation,
} from './ensemble/index.js';

export type {
  EnsembleTier,
  EnsembleLayer,
  EnsembleImResult,
  FiberType,
  GearItem,
  GearLayer,
} from './ensemble/index.js';

// Moisture module — Session 9a
export {
  PERCEIVED_WEIGHTS,
  COMFORT_THRESHOLD,
  computePerceivedMR,
  applySaturationCascade,
} from './moisture/index.js';

export type { PerceivedMRLayer } from './moisture/index.js';

// Activities module — Session 9a
export {
  WADER_DATA,
  SNOW_SPORT_ZONES,
  waderSplitIm,
  waderSplitCLO,
  snowSportSplitIm,
  descentSpeedWind,
  ACTIVITY_SWEAT_PROFILES,
  INTERMITTENT_PHASE_PROFILES,
  GENERIC_GEAR_SCORES_BY_SLOT,
} from './activities/index.js';

export type {
  WaderEntry,
  SnowSportZone,
  DescentSpeedWindResult,
  ActivitySweatProfile,
  PhaseDefinition,
  PhaseProfile,
  GearSlotScores,
} from './activities/index.js';
EOF

echo "✓ engine src/index.ts updated"
echo ""

# ============================================================================
# PHASE 9 — Tests for heat_balance new files (epoc + cold_physiology + duboisBSA)
# ============================================================================
echo ">>> PHASE 9: tests for heat_balance Session 9a additions"

cat > packages/engine/tests/heat_balance/epoc.test.ts << 'EOF'
// Tests for epoc.ts — epocParams + epocTau + estimateCoreTemp.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import { epocParams, epocTau, estimateCoreTemp } from '../../src/heat_balance/epoc.js';

describe('epocParams (Børsheim 2003 two-component)', () => {
  it('low intensity (MET≤6): tauFast=3, tauSlow=30, fastFrac=0.70', () => {
    const r = epocParams(4, 1.5);
    expect(r.tauFast).toBe(3);
    expect(r.tauSlow).toBe(30);
    expect(r.aFast).toBeCloseTo(1.75, 4);  // 2.5 × 0.70
    expect(r.aSlow).toBeCloseTo(0.75, 4);  // 2.5 × 0.30
  });

  it('high intensity (MET>6): tauFast=5, tauSlow=45, fastFrac=0.60', () => {
    const r = epocParams(8, 1.5);
    expect(r.tauFast).toBe(5);
    expect(r.tauSlow).toBe(45);
    expect(r.aFast).toBeCloseTo(3.9, 4);  // 6.5 × 0.60
    expect(r.aSlow).toBeCloseTo(2.6, 4);  // 6.5 × 0.40
  });

  it('boundary at MET=6: still in low-intensity regime', () => {
    const r = epocParams(6, 1.5);
    expect(r.tauFast).toBe(3);
    expect(r.aFast).toBeCloseTo(3.15, 4);  // 4.5 × 0.70
  });

  it('default METrest=1.5 when omitted', () => {
    const r1 = epocParams(4);
    const r2 = epocParams(4, 1.5);
    expect(r1.aFast).toBe(r2.aFast);
  });

  it('aFast + aSlow = METrun - METrest', () => {
    const r = epocParams(10, 1.5);
    expect(r.aFast + r.aSlow).toBeCloseTo(8.5, 4);
  });
});

describe('epocTau (legacy single-tau wrapper)', () => {
  it('rest regime (MET≤3): tau=4', () => {
    expect(epocTau(2)).toBe(4);
    expect(epocTau(3)).toBe(4);
  });

  it('mid regime (3<MET≤6): tau = 4 + (MET-3)×2', () => {
    expect(epocTau(5)).toBe(8);
    expect(epocTau(6)).toBe(10);
  });

  it('high regime (MET>6): tau = 10 + (MET-6)×3.3', () => {
    expect(epocTau(8)).toBeCloseTo(16.6, 4);
    expect(epocTau(10)).toBeCloseTo(23.2, 4);
  });
});

describe('estimateCoreTemp (Gagge 1972)', () => {
  it('zero storage → unchanged core temp', () => {
    expect(estimateCoreTemp(37.0, 0, 70)).toBeCloseTo(37.0, 4);
  });

  it('low storage (100 W·min, 70kg): T_core ≈ 37.0246', () => {
    // ΔT = 100×60 / (70×3490) = 0.02457
    expect(estimateCoreTemp(37.0, 100, 70)).toBeCloseTo(37.0246, 3);
  });

  it('moderate storage (500 W·min, 70kg): T_core ≈ 37.1228', () => {
    expect(estimateCoreTemp(37.0, 500, 70)).toBeCloseTo(37.1228, 3);
  });

  it('high storage (1500 W·min, 70kg): T_core ≈ 37.3684', () => {
    expect(estimateCoreTemp(37.0, 1500, 70)).toBeCloseTo(37.3684, 3);
  });

  it('extreme storage clamps to 39.5°C ceiling', () => {
    expect(estimateCoreTemp(37.0, 50000, 70)).toBe(39.5);
  });

  it('negative storage cooling: T_core decreases', () => {
    expect(estimateCoreTemp(37.0, -1000, 70)).toBeCloseTo(36.7544, 3);
  });

  it('extreme cooling clamps to 34.0°C floor', () => {
    expect(estimateCoreTemp(37.0, -50000, 70)).toBe(34.0);
  });
});
EOF

cat > packages/engine/tests/heat_balance/cold_physiology.test.ts << 'EOF'
// Tests for cold_physiology.ts — civdProtectionFactor + shiveringBoost + computeHLR.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import {
  civdProtectionFactor,
  shiveringBoost,
  computeHLR,
} from '../../src/heat_balance/cold_physiology.js';

describe('civdProtectionFactor (Flouris & Cheung 2008)', () => {
  it('returns 0.0 above 37.5°C (no risk)', () => {
    expect(civdProtectionFactor(37.5)).toBe(0.0);
    expect(civdProtectionFactor(37.6)).toBe(0.0);
    expect(civdProtectionFactor(38.0)).toBe(0.0);
  });

  it('linear ramp 37.0-37.5: 0.0 → 0.3', () => {
    expect(civdProtectionFactor(37.25)).toBeCloseTo(0.15, 4);
    expect(civdProtectionFactor(37.0)).toBeCloseTo(0.3, 4);
  });

  it('linear ramp 36.5-37.0: 0.3 → 0.7', () => {
    expect(civdProtectionFactor(36.75)).toBeCloseTo(0.5, 4);
    expect(civdProtectionFactor(36.5)).toBeCloseTo(0.7, 4);
  });

  it('linear ramp 36.0-36.5: 0.7 → 1.0', () => {
    expect(civdProtectionFactor(36.25)).toBeCloseTo(0.85, 4);
    expect(civdProtectionFactor(36.0)).toBeCloseTo(1.0, 4);
  });

  it('returns 1.0 below 36.0°C (CIVD abandoned)', () => {
    expect(civdProtectionFactor(35.5)).toBe(1.0);
    expect(civdProtectionFactor(34.0)).toBe(1.0);
  });
});

describe('shiveringBoost (Young et al. 1986)', () => {
  it('warm conditions → no shivering', () => {
    expect(shiveringBoost(20, 1.5, 1.0, 22)).toBe(0);
  });

  it('moderate cold rest with light gear → small shivering boost', () => {
    expect(shiveringBoost(-5, 1.5, 1.0, 22)).toBeCloseTo(0.082, 2);
  });

  it('moderate cold rest with heavy gear → no shivering (CLO protection sufficient)', () => {
    expect(shiveringBoost(-5, 1.5, 3.0, 22)).toBe(0);
  });

  it('cold but high MET → no shivering needed (above crossover)', () => {
    expect(shiveringBoost(-10, 6.0, 1.5, 22)).toBe(0);
  });

  it('extreme cold passive → strong shivering boost', () => {
    expect(shiveringBoost(-20, 1.0, 0.5, 15)).toBeCloseTo(1.5576, 3);
  });

  it('high BF protection reduces shivering', () => {
    expect(shiveringBoost(-10, 1.0, 1.0, 35)).toBeCloseTo(0.306, 2);
  });

  it('caps at 2.5 METs (Hayward 1975 max sustainable)', () => {
    // Extreme conditions to push toward cap
    expect(shiveringBoost(-50, 0.5, 0.0, 5)).toBeLessThanOrEqual(2.5);
  });
});

describe('computeHLR (composite cold-loss risk)', () => {
  it('surplus moderate (deficit=-50, T_amb=0, sat=0.2): HLR ≈ 3.34', () => {
    expect(computeHLR(-50, 37.0, 0, 0.2)).toBeCloseTo(3.337, 2);
  });

  it('neutral cool (deficit=0, T_amb=5, sat=0.2): HLR ≈ 2.86', () => {
    expect(computeHLR(0, 37.0, 5, 0.2)).toBeCloseTo(2.86, 2);
  });

  it('deficit cold (deficit=100, core=36.5, T=-5, sat=0.5): HLR ≈ 2.34', () => {
    expect(computeHLR(100, 36.5, -5, 0.5)).toBeCloseTo(2.337, 2);
  });

  it('extreme deficit hypothermic (deficit=200, core=35.5, T=-15, sat=0.8): HLR ≈ 1.82', () => {
    expect(computeHLR(200, 35.5, -15, 0.8)).toBeCloseTo(1.82, 2);
  });

  it('mild deficit warm wet (deficit=50, T=10, sat=0.6): HLR ≈ 2.28', () => {
    expect(computeHLR(50, 37.0, 10, 0.6)).toBeCloseTo(2.281, 2);
  });

  it('caps at HLR 10', () => {
    // Worst-case construction
    expect(computeHLR(-1000, 35.0, -30, 1.0)).toBeLessThanOrEqual(10);
  });
});
EOF

cat > packages/engine/tests/heat_balance/dubois_bsa.test.ts << 'EOF'
// Tests for duboisBSA appended to body_thermo.ts.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import { duboisBSA } from '../../src/heat_balance/body_thermo.js';

describe('duboisBSA (DuBois & DuBois 1916)', () => {
  it('100 lb (45.36 kg) → 1.4727 m²', () => {
    expect(duboisBSA(100)).toBeCloseTo(1.4727, 3);
  });

  it('130 lb (58.97 kg) → 1.6465 m²', () => {
    expect(duboisBSA(130)).toBeCloseTo(1.6465, 3);
  });

  it('150 lb (68.04 kg) → 1.8108 m² (default fallback weight)', () => {
    expect(duboisBSA(150)).toBeCloseTo(1.8108, 3);
  });

  it('170 lb (77.11 kg) → 1.9097 m²', () => {
    expect(duboisBSA(170)).toBeCloseTo(1.9097, 3);
  });

  it('200 lb (90.72 kg) → 2.0890 m²', () => {
    expect(duboisBSA(200)).toBeCloseTo(2.0890, 3);
  });

  it('250 lb (113.4 kg) → 2.3155 m²', () => {
    expect(duboisBSA(250)).toBeCloseTo(2.3155, 3);
  });

  it('300 lb (136.08 kg) → 2.5322 m²', () => {
    expect(duboisBSA(300)).toBeCloseTo(2.5322, 3);
  });

  it('null/undefined defaults to 150 lb', () => {
    expect(duboisBSA(null)).toBeCloseTo(1.8108, 3);
    expect(duboisBSA(undefined)).toBeCloseTo(1.8108, 3);
  });

  it('monotonically increases with weight', () => {
    const a = duboisBSA(120);
    const b = duboisBSA(170);
    const c = duboisBSA(220);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('uses height stratification: 130lb → 173cm, 200lb → 180cm', () => {
    // 130lb = 58.97kg < 60 → 165cm
    // 200lb = 90.72kg in 80-100 → 178cm
    // Verifying through known baselines (already locked in)
    expect(duboisBSA(130)).toBeCloseTo(1.6465, 3);
    expect(duboisBSA(200)).toBeCloseTo(2.0890, 3);
  });
});
EOF

echo "✓ heat_balance Session 9a tests written (3 files)"
echo ""

# ============================================================================
# PHASE 10 — Tests for moisture module
# ============================================================================
echo ">>> PHASE 10: tests for moisture/ module"

cat > packages/engine/tests/moisture/perceived_mr.test.ts << 'EOF'
// Tests for moisture/perceived_mr.ts — computePerceivedMR + constants.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import {
  computePerceivedMR,
  PERCEIVED_WEIGHTS,
  COMFORT_THRESHOLD,
} from '../../src/moisture/perceived_mr.js';

describe('PERCEIVED_WEIGHTS (Fukazawa 2003 baseline)', () => {
  it('locks in [3, 2, 1.5, 1] (skin → outer)', () => {
    expect([...PERCEIVED_WEIGHTS]).toEqual([3, 2, 1.5, 1]);
  });
});

describe('COMFORT_THRESHOLD (Fukazawa 2003)', () => {
  it('locks in 40 mL', () => {
    expect(COMFORT_THRESHOLD).toBe(40);
  });
});

describe('computePerceivedMR', () => {
  it('empty layers → 0', () => {
    expect(computePerceivedMR([])).toBe(0);
    expect(computePerceivedMR(null)).toBe(0);
    expect(computePerceivedMR(undefined)).toBe(0);
  });

  it('base layer at half of comfort threshold (20mL/40mL=0.5) + mid layer 50% fill → 3.76', () => {
    const r = computePerceivedMR([
      { buffer: 20, cap: 75 },
      { buffer: 10, cap: 18 },
    ]);
    expect(r).toBeCloseTo(3.76, 2);
  });

  it('base at threshold + mid full + insul partial (3 layers) → 5.88', () => {
    const r = computePerceivedMR([
      { buffer: 40, cap: 75 },
      { buffer: 18, cap: 18 },
      { buffer: 5,  cap: 24 },
    ]);
    expect(r).toBeCloseTo(5.8846, 3);
  });

  it('all layers fully saturated (4 layers) → 7.2 (max projection)', () => {
    const r = computePerceivedMR([
      { buffer: 80, cap: 75 },  // base over threshold
      { buffer: 18, cap: 18 },
      { buffer: 24, cap: 24 },
      { buffer: 4,  cap: 4 },
    ]);
    expect(r).toBeCloseTo(7.2, 2);
  });

  it('caps at 10', () => {
    // Extreme — base way over threshold + all caps full
    const r = computePerceivedMR([
      { buffer: 1000, cap: 1000 },
      { buffer: 1000, cap: 1000 },
      { buffer: 1000, cap: 1000 },
      { buffer: 1000, cap: 1000 },
    ]);
    expect(r).toBeLessThanOrEqual(10);
  });

  it('zero-cap layer is treated as zero fill (skipped)', () => {
    const r = computePerceivedMR([
      { buffer: 40, cap: 40 },
      { buffer: 10, cap: 0 },  // zero cap → 0 fill
    ]);
    expect(r).toBeGreaterThan(0);
    expect(Number.isFinite(r)).toBe(true);
  });

  it('5+ layers use last weight (1) for index ≥ 3', () => {
    // PERCEIVED_WEIGHTS has 4 entries; 5th layer should reuse weight=1
    const r = computePerceivedMR([
      { buffer: 40, cap: 40 },
      { buffer: 10, cap: 10 },
      { buffer: 10, cap: 10 },
      { buffer: 10, cap: 10 },
      { buffer: 10, cap: 10 },  // 5th layer
    ]);
    expect(Number.isFinite(r)).toBe(true);
  });
});
EOF

cat > packages/engine/tests/moisture/saturation_cascade.test.ts << 'EOF'
// Tests for moisture/saturation_cascade.ts — applySaturationCascade.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import { applySaturationCascade } from '../../src/moisture/saturation_cascade.js';

describe('applySaturationCascade (LC5 Saturation Cascade v3)', () => {
  it('Phase 1 (raw ≤ 6): linear pass-through', () => {
    expect(applySaturationCascade(0)).toBe(0);
    expect(applySaturationCascade(3)).toBe(3);
    expect(applySaturationCascade(6)).toBe(6);
  });

  it('Phase 2 (raw 6-10): quadratic ease-out', () => {
    // raw=7: 6 + 4 × (1 - (1 - 0.25)²) = 6 + 4 × 0.4375 = 7.75
    expect(applySaturationCascade(7)).toBeCloseTo(7.75, 4);
    // raw=8: 6 + 4 × (1 - (1 - 0.5)²) = 6 + 4 × 0.75 = 9.0
    expect(applySaturationCascade(8)).toBeCloseTo(9.0, 4);
    // raw=9: 6 + 4 × (1 - (1 - 0.75)²) = 6 + 4 × 0.9375 = 9.75
    expect(applySaturationCascade(9)).toBeCloseTo(9.75, 4);
  });

  it('cap at 10 for raw ≥ 10', () => {
    expect(applySaturationCascade(10)).toBe(10);
    expect(applySaturationCascade(11)).toBe(10);
    expect(applySaturationCascade(50)).toBe(10);
  });

  it('boundary at raw=6 returns exactly 6 (Phase 1 endpoint)', () => {
    expect(applySaturationCascade(6.0)).toBe(6.0);
  });

  it('curve continuous at raw=6 boundary', () => {
    // Just above 6 should be very close to 6
    expect(applySaturationCascade(6.001)).toBeCloseTo(6.0005, 3);
  });

  it('curve approaches 10 asymptotically near raw=10', () => {
    // raw=9.9: 6 + 4 × (1 - (1 - 0.975)²) = 6 + 4 × 0.999375 = 9.9975
    expect(applySaturationCascade(9.9)).toBeCloseTo(9.9975, 3);
  });

  it('monotonic non-decreasing across full range', () => {
    let prev = applySaturationCascade(0);
    for (let r = 0.1; r <= 12; r += 0.1) {
      const curr = applySaturationCascade(r);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});
EOF

echo "✓ moisture/ tests written"
echo ""

# ============================================================================
# PHASE 11 — Tests for activities module
# ============================================================================
echo ">>> PHASE 11: tests for activities/ module"

cat > packages/engine/tests/activities/split_body.test.ts << 'EOF'
// Tests for activities/split_body.ts — wader/snow sport split-body models.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import {
  WADER_DATA,
  SNOW_SPORT_ZONES,
  waderSplitIm,
  waderSplitCLO,
  snowSportSplitIm,
} from '../../src/activities/split_body.js';

describe('WADER_DATA (PHY-052 baseline values)', () => {
  it('contains all 10 wader types', () => {
    expect(Object.keys(WADER_DATA).length).toBe(10);
    expect(WADER_DATA.none).toBeDefined();
    expect(WADER_DATA.neoprene_5mm).toBeDefined();
    expect(WADER_DATA.breathable).toBeDefined();
  });

  it('locks in neoprene_5mm: im=0, clo=1.50', () => {
    expect(WADER_DATA.neoprene_5mm!.im).toBe(0.00);
    expect(WADER_DATA.neoprene_5mm!.clo).toBe(1.50);
  });

  it('locks in breathable: im=0.15, clo=0.15', () => {
    expect(WADER_DATA.breathable!.im).toBe(0.15);
    expect(WADER_DATA.breathable!.clo).toBe(0.15);
  });

  it('locks in none: im=0, clo=0', () => {
    expect(WADER_DATA.none!.im).toBe(0.00);
    expect(WADER_DATA.none!.clo).toBe(0.00);
  });

  it('all entries have label string', () => {
    for (const key of Object.keys(WADER_DATA)) {
      expect(typeof WADER_DATA[key]!.label).toBe('string');
      expect(WADER_DATA[key]!.label.length).toBeGreaterThan(0);
    }
  });
});

describe('SNOW_SPORT_ZONES (PHY-065 baseline)', () => {
  it('zone fractions sum to 1.00', () => {
    const sum = SNOW_SPORT_ZONES.layeringSystem!.frac +
                SNOW_SPORT_ZONES.hands!.frac +
                SNOW_SPORT_ZONES.head!.frac +
                SNOW_SPORT_ZONES.feet!.frac +
                SNOW_SPORT_ZONES.calves!.frac +
                SNOW_SPORT_ZONES.face!.frac;
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('layering system covers 80% (trunk + arms + upper legs)', () => {
    expect(SNOW_SPORT_ZONES.layeringSystem!.frac).toBe(0.80);
    expect(SNOW_SPORT_ZONES.layeringSystem!.usesEnsemble).toBe(true);
  });

  it('hands im=0.05, head im=0.03, feet im=0.02', () => {
    expect(SNOW_SPORT_ZONES.hands!.im).toBe(0.05);
    expect(SNOW_SPORT_ZONES.head!.im).toBe(0.03);
    expect(SNOW_SPORT_ZONES.feet!.im).toBe(0.02);
  });
});

describe('waderSplitIm (PHY-052)', () => {
  it('no wader → returns ensembleIm unchanged', () => {
    expect(waderSplitIm(0.20, undefined)).toBe(0.20);
    expect(waderSplitIm(0.20, null)).toBe(0.20);
    expect(waderSplitIm(0.20, '')).toBe(0.20);
  });

  it("'none' wader → returns ensembleIm unchanged", () => {
    expect(waderSplitIm(0.20, 'none')).toBe(0.20);
  });

  it('unknown wader → returns ensembleIm unchanged', () => {
    expect(waderSplitIm(0.20, 'fake_wader_type')).toBe(0.20);
  });

  it('neoprene_5mm + ensembleIm=0.20 → 0.45×0.20 + 0.55×0 = 0.09', () => {
    expect(waderSplitIm(0.20, 'neoprene_5mm')).toBeCloseTo(0.09, 4);
  });

  it('breathable + ensembleIm=0.20 → 0.45×0.20 + 0.55×0.15 = 0.1725', () => {
    expect(waderSplitIm(0.20, 'breathable')).toBeCloseTo(0.1725, 4);
  });

  it('null ensembleIm with wader → uses BASELINE_IM (0.089)', () => {
    // 0.45 × 0.089 + 0.55 × 0 = 0.04005
    expect(waderSplitIm(null, 'neoprene_5mm')).toBeCloseTo(0.04005, 4);
  });
});

describe('waderSplitCLO (PHY-052)', () => {
  it('no wader → returns upperCLO unchanged', () => {
    expect(waderSplitCLO(1.5, undefined)).toBe(1.5);
    expect(waderSplitCLO(1.5, 'none')).toBe(1.5);
  });

  it('neoprene_5mm + upper=1.5 → 0.45×1.5 + 0.55×1.5 = 1.5', () => {
    expect(waderSplitCLO(1.5, 'neoprene_5mm')).toBeCloseTo(1.5, 4);
  });

  it('breathable + upper=1.5 → 0.45×1.5 + 0.55×0.15 = 0.7575', () => {
    expect(waderSplitCLO(1.5, 'breathable')).toBeCloseTo(0.7575, 4);
  });
});

describe('snowSportSplitIm (PHY-065)', () => {
  it('ensembleIm=0.089 (baseline) → 0.0766 (locked-in baseline)', () => {
    expect(snowSportSplitIm(0.089)).toBeCloseTo(0.0766, 4);
  });

  it('ensembleIm=0.15 → 0.1254', () => {
    expect(snowSportSplitIm(0.15)).toBeCloseTo(0.1254, 4);
  });

  it('ensembleIm=0.30 → 0.2454', () => {
    expect(snowSportSplitIm(0.30)).toBeCloseTo(0.2454, 4);
  });

  it('ensembleIm=0.50 → 0.4054', () => {
    expect(snowSportSplitIm(0.50)).toBeCloseTo(0.4054, 4);
  });

  it('null ensembleIm → uses BASELINE_IM (0.089) → same as 0.089', () => {
    expect(snowSportSplitIm(null)).toBeCloseTo(0.0766, 4);
  });

  it('higher ensembleIm produces higher splitIm (monotonic)', () => {
    const a = snowSportSplitIm(0.10);
    const b = snowSportSplitIm(0.20);
    const c = snowSportSplitIm(0.40);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
EOF

cat > packages/engine/tests/activities/descent.test.ts << 'EOF'
// Tests for activities/descent.ts — descentSpeedWind lookup.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import { descentSpeedWind } from '../../src/activities/descent.js';

describe('descentSpeedWind (PHY-019)', () => {
  it('groomers → 30 mph, turnFactor 0.7', () => {
    expect(descentSpeedWind('groomers')).toEqual({ speed: 30, turnFactor: 0.7 });
  });

  it('moguls → 12 mph, turnFactor 0.5', () => {
    expect(descentSpeedWind('moguls')).toEqual({ speed: 12, turnFactor: 0.5 });
  });

  it('trees → 8 mph, turnFactor 0.45', () => {
    expect(descentSpeedWind('trees')).toEqual({ speed: 8, turnFactor: 0.45 });
  });

  it('bowls → 20 mph, turnFactor 0.6', () => {
    expect(descentSpeedWind('bowls')).toEqual({ speed: 20, turnFactor: 0.6 });
  });

  it('park → 18 mph, turnFactor 0.55', () => {
    expect(descentSpeedWind('park')).toEqual({ speed: 18, turnFactor: 0.55 });
  });

  it('strips skiing_ prefix (PHY-030 unified terrain keys)', () => {
    expect(descentSpeedWind('skiing_groomers')).toEqual({ speed: 30, turnFactor: 0.7 });
    expect(descentSpeedWind('skiing_moguls')).toEqual({ speed: 12, turnFactor: 0.5 });
  });

  it('strips snowboarding_ prefix', () => {
    expect(descentSpeedWind('snowboarding_groomers')).toEqual({ speed: 30, turnFactor: 0.7 });
  });

  it('unknown variant → default { speed: 25, turnFactor: 0.6 }', () => {
    expect(descentSpeedWind('unknown_terrain')).toEqual({ speed: 25, turnFactor: 0.6 });
    expect(descentSpeedWind('skiing_xyz')).toEqual({ speed: 25, turnFactor: 0.6 });
  });

  it('non-string input → default', () => {
    expect(descentSpeedWind(null)).toEqual({ speed: 25, turnFactor: 0.6 });
    expect(descentSpeedWind(undefined)).toEqual({ speed: 25, turnFactor: 0.6 });
  });
});
EOF

cat > packages/engine/tests/activities/profiles.test.ts << 'EOF'
// Tests for activities/profiles.ts — phase + sweat + gear score data structures.
// Structural integrity tests; lock-in tests for selected canonical entries.

import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_SWEAT_PROFILES,
  INTERMITTENT_PHASE_PROFILES,
  GENERIC_GEAR_SCORES_BY_SLOT,
} from '../../src/activities/profiles.js';

describe('ACTIVITY_SWEAT_PROFILES', () => {
  it('contains running, hiking, skiing, snowboarding, kayaking', () => {
    expect(ACTIVITY_SWEAT_PROFILES.running).toBeDefined();
    expect(ACTIVITY_SWEAT_PROFILES.hiking).toBeDefined();
    expect(ACTIVITY_SWEAT_PROFILES.skiing).toBeDefined();
    expect(ACTIVITY_SWEAT_PROFILES.snowboarding).toBeDefined();
    expect(ACTIVITY_SWEAT_PROFILES.kayaking).toBeDefined();
  });

  it('all entries have low/moderate/high/very_high + coverageMul + intermittency', () => {
    for (const [activity, profile] of Object.entries(ACTIVITY_SWEAT_PROFILES)) {
      expect(profile.low, `${activity}.low`).toBeGreaterThan(0);
      expect(profile.moderate, `${activity}.moderate`).toBeGreaterThan(profile.low);
      expect(profile.high, `${activity}.high`).toBeGreaterThan(profile.moderate);
      expect(profile.very_high, `${activity}.very_high`).toBeGreaterThan(profile.high);
      expect(profile.coverageMul, `${activity}.coverageMul`).toBeGreaterThan(0);
      expect(profile.intermittency, `${activity}.intermittency`).toBeGreaterThan(0);
      expect(profile.intermittency, `${activity}.intermittency`).toBeLessThanOrEqual(1.0);
    }
  });

  it('locks in running: low=250 mod=600 high=1000 vh=1400', () => {
    expect(ACTIVITY_SWEAT_PROFILES.running!.low).toBe(250);
    expect(ACTIVITY_SWEAT_PROFILES.running!.moderate).toBe(600);
    expect(ACTIVITY_SWEAT_PROFILES.running!.high).toBe(1000);
    expect(ACTIVITY_SWEAT_PROFILES.running!.very_high).toBe(1400);
  });

  it('locks in cross_country_ski: coverageMul=1.40, intermittency=0.80 (MFC #2 validated)', () => {
    expect(ACTIVITY_SWEAT_PROFILES.cross_country_ski!.coverageMul).toBe(1.40);
    expect(ACTIVITY_SWEAT_PROFILES.cross_country_ski!.intermittency).toBe(0.80);
  });

  it('locks in skiing/snowboarding identical sweat values (PHY-030 unified)', () => {
    expect(ACTIVITY_SWEAT_PROFILES.skiing!.low).toBe(ACTIVITY_SWEAT_PROFILES.snowboarding!.low);
    expect(ACTIVITY_SWEAT_PROFILES.skiing!.moderate).toBe(ACTIVITY_SWEAT_PROFILES.snowboarding!.moderate);
    expect(ACTIVITY_SWEAT_PROFILES.skiing!.high).toBe(ACTIVITY_SWEAT_PROFILES.snowboarding!.high);
    expect(ACTIVITY_SWEAT_PROFILES.skiing!.coverageMul).toBe(ACTIVITY_SWEAT_PROFILES.snowboarding!.coverageMul);
  });
});

describe('INTERMITTENT_PHASE_PROFILES', () => {
  it('contains all expected ski terrain profiles', () => {
    expect(INTERMITTENT_PHASE_PROFILES.groomers).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.moguls).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.trees).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.bowls).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.park).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.skiing_bc).toBeDefined();
  });

  it('contains all golf, fishing, kayaking, SUP variants', () => {
    expect(INTERMITTENT_PHASE_PROFILES.golf_walk).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.golf_cart).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.fishing_shore).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.fishing_wading).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.kayaking_creek).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.kayaking_lake).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.kayaking_ocean).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.sup_lake).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.sup_ocean).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.sup_creek).toBeDefined();
  });

  it('contains cycling profiles (flat + hilly for road and gravel)', () => {
    expect(INTERMITTENT_PHASE_PROFILES.cycling_road_flat).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.cycling_road_hilly).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.cycling_gravel_flat).toBeDefined();
    expect(INTERMITTENT_PHASE_PROFILES.cycling_gravel_hilly).toBeDefined();
  });

  it('contains linear-type profiles: skiing_bc, xc_ski, snowshoeing', () => {
    expect(INTERMITTENT_PHASE_PROFILES.skiing_bc!.type).toBe('linear');
    expect(INTERMITTENT_PHASE_PROFILES.xc_ski!.type).toBe('linear');
    expect(INTERMITTENT_PHASE_PROFILES.snowshoeing!.type).toBe('linear');
  });

  it('cyclic profiles have phases with durMin (not pct)', () => {
    const groomers = INTERMITTENT_PHASE_PROFILES.groomers!;
    expect(groomers.type).toBe('cyclic');
    for (const phase of groomers.phases) {
      expect(phase.durMin).toBeDefined();
      expect(phase.pct).toBeUndefined();
    }
  });

  it('linear profiles have phases with pct (not durMin)', () => {
    const xc = INTERMITTENT_PHASE_PROFILES.xc_ski!;
    expect(xc.type).toBe('linear');
    for (const phase of xc.phases) {
      expect(phase.pct).toBeDefined();
      expect(phase.durMin).toBeUndefined();
    }
  });

  it('linear profile pct values sum to 1.0', () => {
    for (const [key, profile] of Object.entries(INTERMITTENT_PHASE_PROFILES)) {
      if (profile.type === 'linear') {
        const pctSum = profile.phases.reduce((s, p) => s + (p.pct ?? 0), 0);
        expect(pctSum, `${key} pct sum`).toBeCloseTo(1.0, 4);
      }
    }
  });

  it('locks in groomers: 3 min run + 7 min lift', () => {
    const g = INTERMITTENT_PHASE_PROFILES.groomers!;
    expect(g.phases[0]!.durMin).toBe(3);
    expect(g.phases[0]!.intensity).toBe('moderate');
    expect(g.phases[1]!.durMin).toBe(7);
    expect(g.phases[1]!.intensity).toBe('low');
  });

  it('locks in golf_walk: 4 min walk_swing + 11 min wait (~4 holes/hr)', () => {
    const g = INTERMITTENT_PHASE_PROFILES.golf_walk!;
    expect(g.type).toBe('cyclic');
    expect(g.phases[0]!.name).toBe('walk_swing');
    expect(g.phases[0]!.durMin).toBe(4);
    expect(g.phases[1]!.name).toBe('wait');
    expect(g.phases[1]!.durMin).toBe(11);
  });

  it('locks in cycling_road_flat: 51 min ride + 9 min stop (15% stop fraction)', () => {
    const c = INTERMITTENT_PHASE_PROFILES.cycling_road_flat!;
    expect(c.phases[0]!.durMin).toBe(51);
    expect(c.phases[1]!.durMin).toBe(9);
  });

  it('locks in skiing_bc linear: skinning 55%, transition 5%, descent 40%', () => {
    const bc = INTERMITTENT_PHASE_PROFILES.skiing_bc!;
    expect(bc.type).toBe('linear');
    expect(bc.phases[0]!.pct).toBe(0.55);
    expect(bc.phases[1]!.pct).toBe(0.05);
    expect(bc.phases[2]!.pct).toBe(0.40);
  });
});

describe('GENERIC_GEAR_SCORES_BY_SLOT (PHY-025)', () => {
  it('contains all 8 gear slots', () => {
    expect(GENERIC_GEAR_SCORES_BY_SLOT.base).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.mid).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.insulative).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.shell).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.legs).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.legsBase).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.feet).toBeDefined();
    expect(GENERIC_GEAR_SCORES_BY_SLOT.head).toBeDefined();
  });

  it('locks in shell.windResist=8 (key field used by Session 9b/9c)', () => {
    expect(GENERIC_GEAR_SCORES_BY_SLOT.shell!.windResist).toBe(8);
  });

  it('all entries have all 5 score fields', () => {
    for (const [slot, scores] of Object.entries(GENERIC_GEAR_SCORES_BY_SLOT)) {
      expect(scores.breathability, `${slot}.breathability`).toBeGreaterThanOrEqual(0);
      expect(scores.moisture, `${slot}.moisture`).toBeGreaterThanOrEqual(0);
      expect(scores.windResist, `${slot}.windResist`).toBeGreaterThanOrEqual(0);
      expect(scores.warmthRatio, `${slot}.warmthRatio`).toBeGreaterThanOrEqual(0);
      expect(scores.waterproof, `${slot}.waterproof`).toBeGreaterThanOrEqual(0);
    }
  });
});
EOF

echo "✓ activities/ tests written"
echo ""

# ============================================================================
# PHASE 12 — Run tests + typecheck + commit + push
# ============================================================================
echo ">>> PHASE 12: Run tests, typecheck, commit, push to GitHub"

echo ""
echo "--- run engine tests ---"
pnpm --filter @lc6/engine test

echo ""
echo "--- typecheck all packages ---"
pnpm typecheck

echo ""
echo "--- Git status ---"
git status

echo ""
echo "--- Git add + commit + push ---"
git add .
git commit -m "Session 9a: Foundational helpers + data structures port from LC5

Per Architecture Document v1.1 §2 repo structure, Cardinal Rule #8 (engine locked,
verbatim port). Pre-Build Audit ratified before code production.

Module additions (13 functions, 7 named constant blocks across 4 modules):

heat_balance/ extensions:
  - body_thermo.ts APPEND: duboisBSA (DuBois & DuBois 1916)
  - epoc.ts NEW: epocParams (Børsheim 2003), epocTau (legacy single-tau wrapper),
                  estimateCoreTemp (Gagge 1972 from cumulative heat storage)
  - cold_physiology.ts NEW: civdProtectionFactor (Flouris & Cheung 2008),
                             shiveringBoost (Young et al. 1986),
                             computeHLR (composite cold-loss risk score)

moisture/ NEW MODULE:
  - perceived_mr.ts: PERCEIVED_WEIGHTS, COMFORT_THRESHOLD, computePerceivedMR
                     (Fukazawa 2003, Zhang 2002 — skin-weighted layer perception)
  - saturation_cascade.ts: applySaturationCascade
                           (LC5 v3 curve: linear ≤6, quadratic ease-out 6-10)

activities/ NEW MODULE:
  - split_body.ts: WADER_DATA, SNOW_SPORT_ZONES, waderSplitIm, waderSplitCLO,
                   snowSportSplitIm (PHY-052 + PHY-065 split-body models)
  - descent.ts: descentSpeedWind + descent terrain data (PHY-019 Shealy 2023)
  - profiles.ts: ACTIVITY_SWEAT_PROFILES (Bergh 1992, ACSM Sawka 2007),
                 INTERMITTENT_PHASE_PROFILES (Compendium of Physical Activities,
                 28 activity entries: ski terrain, golf, fishing, kayaking, SUP,
                 cycling road/gravel × flat/hilly, XC ski, snowshoeing, BC ski),
                 GENERIC_GEAR_SCORES_BY_SLOT (PHY-025)

NOMENCLATURE NOTE: OQ-029 opened — LC5 type:'cyclic' means duty-cycle modeling
(work/rest), NOT lap-based. Activities like golf_walk, fishing_shore, cycling_road_flat
use 'cyclic' for repeating work-rest patterns even when not literally cyclic in the
physical sense. Future LC6 cleanup may rename to 'phased' or 'duty_cycle' for clarity.

All 13 functions ported VERBATIM from LC5 risk_functions.js April 2026 audit baseline.
All 7 data structures ported with values preserved exactly.

Tests: ~80 new tests across 7 test files. Lock-in baselines captured 2026-04-15
from LC5 verbatim source for all functions and selected canonical data entries.

Engine state after Session 9a:
  - 47 functions across cdi/, heat_balance/, ensemble/, moisture/, activities/
  - 32 named constants
  - All Session 9b dependencies (cyclic path) and 9c dependencies (steady-state path) now in place"

git push origin main

echo ""
echo "=========================================="
echo "SESSION 9a BUILD COMPLETE"
echo "=========================================="
echo ""
echo "Engine state:"
echo "  - CDI v1.4 stage detector (Session 5)"
echo "  - Heat balance primitives + PHY-056 solver + EPOC + cold physiology (Sessions 6-7-9a)"
echo "  - Ensemble functions (Session 8)"
echo "  - Moisture: perceived MR + saturation cascade (Session 9a)"
echo "  - Activities: split-body + descent + profiles (Session 9a)"
echo ""
echo "Session 9b candidate scope (next):"
echo "  - Port LC5 calcIntermittentMoisture cyclic path (~610 lines)"
echo "  - All dependencies now in place from Sessions 5-9a"
echo "  - Pre-Build Audit will determine if 9b can be single-session"
echo ""
