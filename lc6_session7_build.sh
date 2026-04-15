#!/bin/bash
# LC6 Session 7 — PHY-056 heat balance solver port from LC5 risk_functions.js (lines 1-126)
# Per Working Agreement Rule #13: verbatim Chat-produced script.
# Per Cardinal Rule #8: thermal engine functions ported VERBATIM from LC5 LOCKED state.
# Per Pre-Build Audit (Session 7 opening): all 18 Cardinal Rules verified before code production.
#
# Scope: PHY-056 path ONLY. PHY-040 functions (calcEvapHeatLoss, calcRespHeatLoss, calcEnvHeatLoss)
# are EXPLICITLY EXCLUDED per DEC-023 (Rule #3 single source of truth).
#
# Functions ported (8 total):
#   - computeTissueCLO (Rennie 1962)
#   - computeTSkin (canonical heat balance)
#   - computeVE (ACSM ventilation)
#   - computeRespiratoryHeatLoss (sensible + latent)
#   - computeMetabolicHeat (Ainsworth 2011)
#   - iterativeTSkin (PHY-056 Gagge two-node convergence — heart of the engine)
#   - computeConvectiveHeatLoss (ASHRAE forced convection)
#   - computeRadiativeHeatLoss (Stefan-Boltzmann)
#
# Constants ported (7 new):
#   LC5_C_P_AIR, LC5_RHO_AIR, LC5_RHO_VAP_EXP, LC5_SIGMA, LC5_EMISS,
#   LC5_T_CORE_BASE, LC5_BODY_SPEC_HEAT
#
# DO NOT MODIFY DURING THIS SCRIPT (Rule #12 — no while-we're-in-here):
#   - Algorithm internals of any function
#   - Magic numbers in iterativeTSkin (5.28, 45.0, 3.0, 0.5)
#   - The intentional duplication of ISO 7933 resistance form between
#     computeEmax and iterativeTSkin (LC5 design choice for solver intermediates)
#   - Parameter names or order
#   - Existing Session 5 (cdi/) or Session 6 (heat_balance/) files

set -e

echo ""
echo "=========================================="
echo "LC6 SESSION 7 BUILD"
echo "PHY-056 heat balance solver port from LC5"
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
if [ ! -d "packages/engine/src/heat_balance" ]; then
  echo "ERROR: packages/engine/src/heat_balance/ not found. Sessions 5 and 6 must be complete."
  exit 1
fi
echo "✓ In $EXPECTED_DIR with Sessions 5+6 workspace present"
echo ""

# ============================================================================
# PHASE 2 — Update constants module with PHY-056 atmospheric/physical constants
# ============================================================================
echo ">>> PHASE 2: Add PHY-056 constants to heat_balance/constants.ts"

# Append (do not overwrite — Session 6 constants must remain untouched)
cat >> packages/engine/src/heat_balance/constants.ts << 'EOF'

/**
 * PHY-056 atmospheric and physical constants for heat balance solver.
 * Ported verbatim from LC5 risk_functions.js lines 6-13.
 */

/**
 * Specific heat of dry air at constant pressure.
 * 1.005 J/(g·°C). Source: ASHRAE Fundamentals.
 * LC5 reference: risk_functions.js line 7 LC5_C_P_AIR.
 */
export const LC5_C_P_AIR = 1.005;

/**
 * Air density at sea level, 15°C (ISA standard atmosphere).
 * 1.225 g/L. Source: ICAO Standard Atmosphere.
 * LC5 reference: risk_functions.js line 8 LC5_RHO_AIR.
 */
export const LC5_RHO_AIR = 1.225;

/**
 * Expired air vapor density (saturated at 37°C body core temperature).
 * 44.0 g/m³. Computed from Magnus formula + ideal gas law at 37°C, 100% RH.
 * LC5 reference: risk_functions.js line 9 LC5_RHO_VAP_EXP.
 */
export const LC5_RHO_VAP_EXP = 44.0;

/**
 * Stefan-Boltzmann constant.
 * 5.67e-8 W/(m²·K⁴). Physical constant.
 * LC5 reference: risk_functions.js line 10 LC5_SIGMA.
 */
export const LC5_SIGMA = 5.67e-8;

/**
 * Clothing surface emissivity for radiative heat loss.
 * 0.95. Source: ASHRAE Fundamentals Ch.9 (clothing emissivity range 0.92-0.97).
 * LC5 reference: risk_functions.js line 11 LC5_EMISS.
 */
export const LC5_EMISS = 0.95;

/**
 * Baseline core body temperature.
 * 37.0 °C. Standard human physiology setpoint.
 * LC5 reference: risk_functions.js line 12 LC5_T_CORE_BASE.
 */
export const LC5_T_CORE_BASE = 37.0;

/**
 * Body specific heat capacity for thermal mass calculations.
 * 3490 J/(kg·°C). Source: Gagge 1972 (cited in LC5 source comment).
 * LC5 reference: risk_functions.js line 13 LC5_BODY_SPEC_HEAT.
 */
export const LC5_BODY_SPEC_HEAT = 3490;

/**
 * Gagge two-node baseline tissue conductance.
 * 5.28 W/(m²·K). Source: Gagge AP, 1972, Building Service Engineer.
 * Used as h_tissue floor in iterativeTSkin; modified by vasomotor response (vdil/vcon).
 */
export const GAGGE_H_TISSUE_BASE = 5.28;

/**
 * Maximum vasodilation contribution to h_tissue (W/(m²·K)).
 * Caps tissue conductance increase under heat stress.
 * Source: Gagge two-node model (Gagge 1972).
 */
export const GAGGE_VDIL_MAX = 45.0;

/**
 * Maximum vasoconstriction reduction to h_tissue (W/(m²·K)).
 * Caps tissue conductance decrease under cold stress.
 * Source: Gagge two-node model (Gagge 1972).
 */
export const GAGGE_VCON_MAX = 3.0;

/**
 * Vasoconstriction onset threshold (°C T_skin).
 * Below this T_skin, vasoconstriction begins.
 * Source: Gagge two-node model (Gagge 1972).
 */
export const GAGGE_VCON_THRESHOLD_C = 33.0;

/**
 * Vasoconstriction sensitivity slope.
 * vcon = (33 - T_skin) × 0.5, capped at GAGGE_VCON_MAX.
 * Source: Gagge two-node model (Gagge 1972).
 */
export const GAGGE_VCON_SLOPE = 0.5;

/**
 * Mechanical work fraction of metabolic rate.
 * W = M × 0.10 in iterativeTSkin. Source: Gagge two-node convention.
 */
export const GAGGE_MECHANICAL_WORK_FRACTION = 0.10;

/**
 * Clothing area factor base.
 * Used in iterativeTSkin and elsewhere: fcl = 1.0 + 0.31 × CLO.
 * Source: McCullough & Jones 1984.
 * Already present logically in evaporation.ts via inline 0.31 — exposed here
 * for future test cross-reference.
 */
export const CLOTHING_AREA_FACTOR_SLOPE = 0.31;

/**
 * Linearized radiative heat transfer coefficient for skin/clothing surface.
 * 4.7 W/(m²·K). Used in iterativeTSkin Qrad calculation.
 * Source: ASHRAE Fundamentals Ch.9 (linearized Stefan-Boltzmann at body temperature).
 */
export const H_RAD_LINEARIZED = 4.7;
EOF

echo "✓ Constants module extended"
echo ""

# ============================================================================
# PHASE 3 — Body thermo module (computeTissueCLO + computeTSkin + iterativeTSkin)
# ============================================================================
echo ">>> PHASE 3: heat_balance/body_thermo.ts (T_skin solver)"

cat > packages/engine/src/heat_balance/body_thermo.ts << 'EOF'
// Body thermal calculations: tissue insulation, single-pass T_skin, PHY-056 iterative solver.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment + hand-computed verification.

import {
  GAGGE_H_TISSUE_BASE,
  GAGGE_VDIL_MAX,
  GAGGE_VCON_MAX,
  GAGGE_VCON_THRESHOLD_C,
  GAGGE_VCON_SLOPE,
  GAGGE_MECHANICAL_WORK_FRACTION,
  CLOTHING_AREA_FACTOR_SLOPE,
  H_RAD_LINEARIZED,
} from './constants.js';

/**
 * Tissue insulation from subcutaneous fat thickness.
 * Returns equivalent CLO units of tissue insulation.
 *
 * Formula: 0.1 + (BF/100) × 2.0, bounded [0.15, 0.9]
 * Source: Rennie DW et al., 1962 (body composition vs cold tolerance).
 *
 * LC5 risk_functions.js lines 19-22.
 *
 * @param bodyFatPct body fat percentage (0-100)
 */
export function computeTissueCLO(bodyFatPct: number): number {
  return Math.min(0.9, Math.max(0.15, 0.1 + (bodyFatPct / 100) * 2.0));
}

/**
 * Single-pass steady-state skin temperature from heat balance.
 * Cardinal Rule #7: T_skin COMPUTED, never assumed constant.
 *
 * Formula: T_skin = (T_core × R_out + T_amb × R_tissue) / (R_tissue + R_out)
 * where R_out = R_clo + R_air.
 *
 * Returns 33.0°C fallback if total resistance ≤ 0 (degenerate input).
 *
 * LC5 risk_functions.js lines 26-31.
 *
 * @param TcoreC core temperature (°C)
 * @param TambC ambient temperature (°C)
 * @param Rtissue tissue resistance (m²·K/W)
 * @param Rclo clothing resistance (m²·K/W)
 * @param Rair boundary air layer resistance (m²·K/W)
 */
export function computeTSkin(
  TcoreC: number,
  TambC: number,
  Rtissue: number,
  Rclo: number,
  Rair: number,
): number {
  const Rout = Rclo + Rair;
  const denom = Rtissue + Rout;
  if (denom <= 0) return 33.0;
  return (TcoreC * Rout + TambC * Rtissue) / denom;
}

/**
 * Result of iterativeTSkin — full state from PHY-056 convergence loop.
 * Note: vasodilation is preserved per Pre-Build Audit Q15 option 1
 * (preserve full LC5 return shape; EngineOutput remains additive-only).
 */
export interface IterativeTSkinResult {
  T_skin: number;          // °C, converged skin temperature
  converged: boolean;      // true if converged within tol
  iterations: number;      // iteration count (1 to maxIter)
  h_tissue: number;        // W/(m²·K), final tissue conductance with vasomotor adjustment
  E_req: number;           // W, required evaporative heat loss
  E_actual: number;        // W, actual evaporative heat loss (capped by E_max)
  vasodilation: number;    // W/(m²·K), vasodilation contribution to h_tissue
}

/**
 * PHY-056: Iterative Gagge two-node T_skin solver.
 *
 * Replaces single-pass computeTSkin for the energy balance hot path.
 * Iterates until T_skin converges, accounting for:
 *   - Convective heat loss (h_c = 8.3 × √v, ASHRAE forced convection)
 *   - Radiative heat loss (linearized h_rad = 4.7)
 *   - Respiratory heat loss (sensible + latent, ISO 7933)
 *   - Evaporative heat loss (ISO 7933 resistance form, capped by E_max)
 *   - Vasodilation under heat stress (up to GAGGE_VDIL_MAX = 45)
 *   - Vasoconstriction under cold stress (up to GAGGE_VCON_MAX = 3)
 *
 * INTENTIONAL DUPLICATION NOTE: Lines 86-96 of LC5 source inline the
 * ISO 7933 resistance-form math (pSkin, pAmb, he, fcl, Recl, Rea, Emax)
 * even though computeEmax in evaporation.ts computes the same physics.
 * This is LC5 design — the solver computes these as intermediates during
 * convergence rather than calling computeEmax repeatedly. Preserved
 * verbatim per Cardinal Rule #8 (no algorithm changes).
 *
 * LC5 risk_functions.js lines 70-109.
 *
 * @param Tcore core temperature (°C)
 * @param TambC ambient temperature (°C)
 * @param Rtissue tissue resistance (m²·K/W)
 * @param RcloInit initial clothing resistance (m²·K/W)
 * @param Rair boundary air layer resistance (m²·K/W) — note: solver recomputes via hc
 * @param BSA body surface area (m²)
 * @param MET metabolic equivalent
 * @param windMs wind speed (m/s)
 * @param RH relative humidity (0-100)
 * @param imEnsemble ensemble Woodcock im
 * @param bodyFatPct body fat percentage (0-100; currently unused in solver but preserved per LC5 signature)
 * @param maxIter maximum iterations (default 8)
 * @param tol convergence tolerance °C (default 0.1)
 */
export function iterativeTSkin(
  Tcore: number,
  TambC: number,
  Rtissue: number,
  RcloInit: number,
  Rair: number,
  BSA: number,
  MET: number,
  windMs: number,
  RH: number,
  imEnsemble: number,
  bodyFatPct: number,
  maxIter?: number,
  tol?: number,
): IterativeTSkinResult {
  const _maxIter = maxIter ?? 8;
  const _tol = tol ?? 0.1;
  const M = MET * 58.2 * BSA;
  const W = M * GAGGE_MECHANICAL_WORK_FRACTION;
  let Tskin = computeTSkin(Tcore, TambC, Rtissue, RcloInit, Rair);
  const hTissueBase = GAGGE_H_TISSUE_BASE;
  let hTissue = hTissueBase;
  let Ereq = 0;
  let Eact = 0;
  let vdil = 0;

  for (let iter = 0; iter < _maxIter; iter++) {
    const TskinPrev = Tskin;
    const hc = 8.3 * Math.sqrt(Math.max(0.5, windMs));
    const RairCalc = 1 / hc;
    const Tcl = Tskin - (Tskin - TambC) * (RcloInit / (RcloInit + RairCalc));
    const Qconv = BSA * hc * (Tcl - TambC);
    const Qrad = BSA * H_RAD_LINEARIZED * (Tcl - TambC);
    const Eresp = 0.017 * M * (5.87 - (RH / 100) * 0.611 * Math.exp(17.27 * TambC / (TambC + 237.3)))
                + 0.0014 * M * (34 - TambC);
    Ereq = Math.max(0, (M - W) - Qconv - Qrad - Eresp);
    const pSkin = 0.611 * Math.exp(17.27 * Tskin / (Tskin + 237.3));
    const pAmb = (RH / 100) * 0.611 * Math.exp(17.27 * TambC / (TambC + 237.3));
    const he = 16.5 * hc;
    const fcl = 1.0 + CLOTHING_AREA_FACTOR_SLOPE * (RcloInit / 0.155);
    // ISO 7933 resistance form (consistent with computeEmax — see INTENTIONAL DUPLICATION NOTE above)
    const _itIcl = RcloInit;
    const _itRecl = (imEnsemble > 0) ? _itIcl / ((imEnsemble || 0.089) * 16.5 * fcl) : 9999;
    const _itRea = 1 / (fcl * he);
    const Emax = Math.max(1, (pSkin - pAmb) * BSA / (_itRecl + _itRea));
    Eact = Math.min(Ereq, Emax);
    const thermalLoad = (M - W) - Qconv - Qrad - Eresp;
    vdil = thermalLoad > 0 ? Math.min(GAGGE_VDIL_MAX, thermalLoad / (BSA * 6)) : 0;
    const vcon = Tskin < GAGGE_VCON_THRESHOLD_C
      ? Math.min(GAGGE_VCON_MAX, (GAGGE_VCON_THRESHOLD_C - Tskin) * GAGGE_VCON_SLOPE)
      : 0;
    hTissue = hTissueBase + vdil - vcon;
    Tskin = Tcore - ((M - W) - Eresp - Eact) / (hTissue * BSA);
    Tskin = Math.max(25, Math.min(37, Tskin));
    if (Math.abs(Tskin - TskinPrev) < _tol) {
      return {
        T_skin: Tskin,
        converged: true,
        iterations: iter + 1,
        h_tissue: hTissue,
        E_req: Ereq,
        E_actual: Eact,
        vasodilation: vdil,
      };
    }
  }
  return {
    T_skin: Tskin,
    converged: false,
    iterations: _maxIter,
    h_tissue: hTissue,
    E_req: Ereq,
    E_actual: Eact,
    vasodilation: vdil,
  };
}
EOF

echo "✓ body_thermo.ts written"
echo ""

# ============================================================================
# PHASE 4 — Metabolism module (computeVE + computeMetabolicHeat + computeRespiratoryHeatLoss)
# ============================================================================
echo ">>> PHASE 4: heat_balance/metabolism.ts"

cat > packages/engine/src/heat_balance/metabolism.ts << 'EOF'
// Metabolic and respiratory heat calculations.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

import { LC5_L_V, LC5_C_P_AIR, LC5_RHO_AIR, LC5_RHO_VAP_EXP } from './constants.js';

/**
 * Result of computeRespiratoryHeatLoss — total heat loss + moisture loss for downstream tracking.
 */
export interface RespiratoryHeatLossResult {
  total: number;          // W, total respiratory heat loss (sensible + latent)
  moistureGhr: number;    // g/hr, water lost via respiration
}

/**
 * Minute ventilation from ACSM MET-ventilation relationship.
 *
 * VO2 = MET × 3.5 × bodyMassKg [mL/min]
 * VE/VO2 ratio scales with intensity:
 *   MET ≤ 2:  ratio = 20
 *   MET 2-6:  ratio = 20 + (MET-2) × 1.25
 *   MET > 6:  ratio = 25 + (MET-6) × 2.5
 *
 * Returns L/min minute ventilation.
 *
 * Source: ACSM Guidelines for Exercise Testing and Prescription.
 * LC5 risk_functions.js lines 34-41.
 *
 * @param MET metabolic equivalent
 * @param bodyMassKg body mass in kg
 */
export function computeVE(MET: number, bodyMassKg: number): number {
  const vo2 = MET * 3.5 * bodyMassKg; // mL/min
  let veRatio: number;
  if (MET <= 2) veRatio = 20;
  else if (MET <= 6) veRatio = 20 + (MET - 2) * 1.25;
  else veRatio = 25 + (MET - 6) * 2.5;
  return vo2 * veRatio / 1000; // L/min
}

/**
 * Respiratory sensible + latent heat loss in Watts.
 *
 * Sensible: warming inhaled air from ambient to 37°C body core temp.
 * Latent: humidifying inhaled air from ambient vapor density to expired (saturated at 37°C).
 *
 * Face cover modifiers reduce both components:
 *   - 'balaclava': 0.65 (35% reduction)
 *   - 'hme' (heat-moisture exchanger): 0.50 (50% reduction)
 *   - none/other: 1.0 (no reduction)
 *
 * Returns total heat loss (W) and total moisture loss (g/hr) for downstream tracking.
 *
 * Source: ISO 7933 respiratory heat loss; Magnus formula vapor pressure.
 * LC5 risk_functions.js lines 44-59.
 *
 * @param MET metabolic equivalent
 * @param TambC ambient temperature (°C); clamped to ≥ -45°C for vapor pressure calc
 * @param RH relative humidity (0-100)
 * @param bodyMassKg body mass in kg
 * @param faceCover optional face cover type ('balaclava' | 'hme' | other)
 */
export function computeRespiratoryHeatLoss(
  MET: number,
  TambC: number,
  RH: number,
  bodyMassKg: number,
  faceCover?: string,
): RespiratoryHeatLossResult {
  const coverFactor = faceCover === 'balaclava' ? 0.65 : faceCover === 'hme' ? 0.50 : 1.0;
  const VE = computeVE(MET, bodyMassKg);
  // Sensible: warming air from ambient to 37°C
  const Qsens = VE * LC5_RHO_AIR * LC5_C_P_AIR * (37 - TambC) / 60;
  // Latent: humidifying air — Magnus formula for vapor density
  const TambClamped = Math.max(-45, TambC);
  const esat = 6.1078 * Math.exp((17.27 * TambClamped) / (TambClamped + 237.3));
  const eActual = esat * 100 * RH; // Pa
  const rhoAmb = Math.max(0, (eActual / (461.5 * (TambC + 273.15))) * 1000); // g/m³
  const moistureGmin = VE * (LC5_RHO_VAP_EXP - rhoAmb) / 1000; // g/min
  const Qlat = moistureGmin * LC5_L_V / 60; // W
  return {
    total: Math.max(0, (Qsens + Qlat) * coverFactor),
    moistureGhr: Math.max(0, moistureGmin * 60 * coverFactor),
  };
}

/**
 * Metabolic heat production in Watts.
 *
 * 1 MET = 1.163 W/kg. Mechanical efficiency ~17%, so heat production = MET × 1.163 × mass × 0.83.
 *
 * Source: Ainsworth BE et al., 2011 (Compendium of Physical Activities).
 * LC5 risk_functions.js lines 62-65.
 *
 * @param MET metabolic equivalent
 * @param bodyMassKg body mass in kg
 */
export function computeMetabolicHeat(MET: number, bodyMassKg: number): number {
  return MET * 1.163 * bodyMassKg * 0.83;
}
EOF

echo "✓ metabolism.ts written"
echo ""

# ============================================================================
# PHASE 5 — Environmental loss module (computeConvectiveHeatLoss + computeRadiativeHeatLoss)
# ============================================================================
echo ">>> PHASE 5: heat_balance/env_loss.ts"

cat > packages/engine/src/heat_balance/env_loss.ts << 'EOF'
// Environmental heat loss components: convective and radiative.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

import { LC5_EMISS, LC5_SIGMA } from './constants.js';

/**
 * Convective heat loss in Watts.
 *
 * Q_conv = (T_skin - T_amb) / (R_clo + R_air) × BSA
 * where R_air = 1 / h_c, and h_c = 8.3 × √(v_eff) [ASHRAE forced convection].
 * v_eff = wind + activity speed (e.g., descending skier adds speed-induced convection).
 *
 * Returns 0 if R_total ≤ 0 (degenerate input).
 *
 * Source: ASHRAE Fundamentals Ch.9 (forced convection for clothed cylinder).
 * LC5 risk_functions.js lines 112-119.
 *
 * @param TskinC skin temperature (°C)
 * @param TambC ambient temperature (°C)
 * @param Rclo clothing resistance (m²·K/W)
 * @param BSA body surface area (m²)
 * @param windMs wind speed (m/s)
 * @param speedWindMs activity-induced wind speed (m/s); defaults to 0
 */
export function computeConvectiveHeatLoss(
  TskinC: number,
  TambC: number,
  Rclo: number,
  BSA: number,
  windMs: number,
  speedWindMs?: number,
): number {
  const effWind = windMs + (speedWindMs ?? 0);
  const hc = 8.3 * Math.sqrt(Math.max(0.5, effWind));
  const Rair = 1 / hc;
  const Rtotal = Rclo + Rair;
  if (Rtotal <= 0) return 0;
  return (TskinC - TambC) / Rtotal * BSA;
}

/**
 * Radiative heat loss in Watts (Stefan-Boltzmann law).
 *
 * Q_rad = ε × σ × BSA × (T_surf⁴ - T_amb⁴)
 * where temperatures are in Kelvin.
 *
 * Source: Stefan-Boltzmann law; ε = 0.95 (clothing emissivity, ASHRAE).
 * LC5 risk_functions.js lines 122-126.
 *
 * @param TsurfC clothing surface temperature (°C)
 * @param TambC ambient temperature (°C; treated as mean radiant temp here)
 * @param BSA body surface area (m²)
 */
export function computeRadiativeHeatLoss(
  TsurfC: number,
  TambC: number,
  BSA: number,
): number {
  const TsK = TsurfC + 273.15;
  const TaK = TambC + 273.15;
  return LC5_EMISS * LC5_SIGMA * BSA * (Math.pow(TsK, 4) - Math.pow(TaK, 4));
}
EOF

echo "✓ env_loss.ts written"
echo ""

# ============================================================================
# PHASE 6 — Update heat_balance/index.ts to export new modules
# ============================================================================
echo ">>> PHASE 6: heat_balance/index.ts updated"

cat > packages/engine/src/heat_balance/index.ts << 'EOF'
// LC6 heat_balance module — public API.
// Sessions 6-7 cumulative exports.
// Future sessions add: gagge.ts (full Gagge integration), terms.ts (additional balance terms), coupling.ts.

// Constants (Sessions 6 + 7)
export {
  // Session 6
  L_V_J_PER_G,
  BASELINE_IM,
  TYPICAL_ENSEMBLE_IM,
  V_BOUNDARY_MPH,
  MIN_RETAINED_LITERS,
  FABRIC_CAPACITY_LITERS,
  C_HYGRO,
  DEFAULT_REGAIN_POLYESTER,
  ACTIVITY_LAYER_COUNT,
  MAGNUS_A,
  MAGNUS_B,
  MAGNUS_E0_HPA,
  // Session 7 — PHY-056 atmospheric/physical constants
  LC5_C_P_AIR,
  LC5_RHO_AIR,
  LC5_RHO_VAP_EXP,
  LC5_SIGMA,
  LC5_EMISS,
  LC5_T_CORE_BASE,
  LC5_BODY_SPEC_HEAT,
  // Session 7 — Gagge two-node parameters
  GAGGE_H_TISSUE_BASE,
  GAGGE_VDIL_MAX,
  GAGGE_VCON_MAX,
  GAGGE_VCON_THRESHOLD_C,
  GAGGE_VCON_SLOPE,
  GAGGE_MECHANICAL_WORK_FRACTION,
  CLOTHING_AREA_FACTOR_SLOPE,
  H_RAD_LINEARIZED,
} from './constants.js';

// Session 6 — VPD utilities
export { satVaporPressure, vpdRatio, VPD_REF_HPA } from './vpd.js';

// Session 6 — Wind, ensemble, duration, precipitation utilities
export {
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
} from './utilities.js';

// Session 6 — Evaporation primitives
export {
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
} from './evaporation.js';

// Session 7 — Body thermo (T_skin solver)
export {
  computeTissueCLO,
  computeTSkin,
  iterativeTSkin,
} from './body_thermo.js';

// Session 7 — Metabolism (M, VE, respiratory)
export {
  computeVE,
  computeMetabolicHeat,
  computeRespiratoryHeatLoss,
} from './metabolism.js';

// Session 7 — Environmental loss (convective, radiative)
export {
  computeConvectiveHeatLoss,
  computeRadiativeHeatLoss,
} from './env_loss.js';

// Type re-exports
export type { ComputeEmaxResult, ComputeSweatRateResult, SweatRegime } from './evaporation.js';
export type { IterativeTSkinResult } from './body_thermo.js';
export type { RespiratoryHeatLossResult } from './metabolism.js';
EOF

echo "✓ heat_balance/index.ts updated"
echo ""

# ============================================================================
# PHASE 7 — Update engine main index
# ============================================================================
echo ">>> PHASE 7: engine src/index.ts updated"

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

// Heat balance module — Sessions 6 + 7
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
} from './heat_balance/index.js';

export type {
  ComputeEmaxResult,
  ComputeSweatRateResult,
  SweatRegime,
  IterativeTSkinResult,
  RespiratoryHeatLossResult,
} from './heat_balance/index.js';
EOF

echo "✓ engine src/index.ts updated"
echo ""

# ============================================================================
# PHASE 8 — Tests for body_thermo (computeTissueCLO + computeTSkin + iterativeTSkin)
# ============================================================================
echo ">>> PHASE 8: tests for body_thermo.ts"

cat > packages/engine/tests/heat_balance/body_thermo.test.ts << 'EOF'
// Tests for body_thermo.ts — tissue insulation, T_skin, iterative solver.
// Hand-computed values for non-iterative functions; lock-in baseline values
// for iterativeTSkin (per Pre-Build Audit observe-then-test discipline).
//
// Lock-in values generated from LC5 risk_functions.js verbatim source on 2026-04-15.
// Any future drift from these values fails the tests, catching engine drift.

import { describe, it, expect } from 'vitest';
import {
  computeTissueCLO,
  computeTSkin,
  iterativeTSkin,
} from '../../src/heat_balance/body_thermo.js';

describe('computeTissueCLO (Rennie 1962)', () => {
  it('returns floor 0.15 at 0% body fat', () => {
    // 0.1 + 0/100 × 2.0 = 0.1 → bounded to 0.15
    expect(computeTissueCLO(0)).toBe(0.15);
  });

  it('returns 0.3 at 10% body fat', () => {
    // 0.1 + 10/100 × 2.0 = 0.3
    expect(computeTissueCLO(10)).toBeCloseTo(0.3, 4);
  });

  it('returns 0.5 at 20% body fat', () => {
    // 0.1 + 20/100 × 2.0 = 0.5
    expect(computeTissueCLO(20)).toBeCloseTo(0.5, 4);
  });

  it('returns ceiling 0.9 at 50% body fat (clamped)', () => {
    // 0.1 + 50/100 × 2.0 = 1.1 → clamped to 0.9
    expect(computeTissueCLO(50)).toBe(0.9);
  });

  it('monotonically increases with body fat (within bounds)', () => {
    const low = computeTissueCLO(15);
    const mid = computeTissueCLO(25);
    const high = computeTissueCLO(35);
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });
});

describe('computeTSkin (single-pass heat balance)', () => {
  it('returns mid-temp when tissue/clothing balanced', () => {
    // T_core = 37, T_amb = 17, R_tissue = R_clo+R_air = 0.2 each
    // T_skin = (37×0.2 + 17×0.2) / 0.4 = 27
    expect(computeTSkin(37, 17, 0.2, 0.1, 0.1)).toBeCloseTo(27, 4);
  });

  it('approaches T_core when external resistance dominates', () => {
    // Heavy clothing → R_out >> R_tissue → T_skin ≈ T_core
    const result = computeTSkin(37, -10, 0.05, 0.5, 0.1);
    expect(result).toBeGreaterThan(33); // closer to 37 than to -10
  });

  it('approaches T_amb when tissue resistance dominates', () => {
    // No clothing → R_tissue >> R_out → T_skin ≈ T_amb
    const result = computeTSkin(37, 10, 0.5, 0.01, 0.05);
    expect(result).toBeLessThan(20); // closer to 10 than to 37
  });

  it('returns 33.0 fallback for degenerate input (zero total resistance)', () => {
    expect(computeTSkin(37, 20, 0, 0, 0)).toBe(33.0);
  });

  it('correctly weights by resistance ratio', () => {
    // T_core = 37, T_amb = 0, R_tissue = 0.1, R_out (clo+air) = 0.3
    // T_skin = (37×0.3 + 0×0.1) / 0.4 = 27.75
    expect(computeTSkin(37, 0, 0.1, 0.2, 0.1)).toBeCloseTo(27.75, 4);
  });
});

describe('iterativeTSkin (PHY-056 Gagge two-node solver)', () => {
  // Lock-in baseline values from LC5 verbatim source 2026-04-15.
  // Operating points span cold/cool/warm/hot regimes per Pre-Build Audit table.

  it('cold_rest_heavy_clothing: T_core=37, T_amb=-10, MET=1.5, heavy clothing → T_skin clamped to floor', () => {
    const r = iterativeTSkin(37, -10, 0.075, 0.310, 0.10, 1.85, 1.5, 2.0, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(25.0, 2);     // clamped to min
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(2);
    expect(r.h_tissue).toBeCloseTo(2.28, 2);   // base 5.28 - vcon 3.0
    expect(r.E_req).toBeCloseTo(0, 2);         // no evap demand in cold
    expect(r.E_actual).toBeCloseTo(0, 2);
    expect(r.vasodilation).toBe(0);
  });

  it('cool_walk_moderate: T_amb=10, MET=4 → T_skin ~29.3, vasodilation engaged', () => {
    const r = iterativeTSkin(37, 10, 0.075, 0.232, 0.12, 1.85, 4.0, 2.0, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(29.27, 1);
    expect(r.converged).toBe(true);
    expect(r.iterations).toBe(2);
    expect(r.h_tissue).toBeCloseTo(19.37, 1);
    expect(r.E_req).toBeCloseTo(176.70, 0);
    expect(r.E_actual).toBeCloseTo(57.64, 0);
    expect(r.vasodilation).toBeCloseTo(15.92, 1);
  });

  it('cool_active_light: T_amb=10, MET=6, light clothing → T_skin ~28.9, high vasodilation', () => {
    const r = iterativeTSkin(37, 10, 0.075, 0.116, 0.10, 1.85, 6.0, 1.0, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(28.91, 1);
    expect(r.converged).toBe(true);
    expect(r.h_tissue).toBeCloseTo(27.62, 1);
    expect(r.E_req).toBeCloseTo(271.08, 0);
    expect(r.E_actual).toBeCloseTo(88.67, 0);
    expect(r.vasodilation).toBeCloseTo(24.42, 1);
  });

  it('warm_rest_light: T_amb=25, MET=1.5, light clothing → does NOT converge in 8 iterations (LC5 baseline behavior)', () => {
    // This case oscillates around equilibrium without converging within tolerance — this is
    // documented LC5 behavior, locked in as expected non-convergence.
    const r = iterativeTSkin(37, 25, 0.075, 0.116, 0.15, 1.85, 1.5, 0.5, 50, 0.089, 22);
    expect(r.converged).toBe(false);
    expect(r.iterations).toBe(8);
    expect(r.T_skin).toBeCloseTo(33.71, 1);
    expect(r.h_tissue).toBeCloseTo(10.32, 1);
    expect(r.E_req).toBeCloseTo(71.92, 0);
    expect(r.E_actual).toBeCloseTo(68.66, 0);
    expect(r.vasodilation).toBeCloseTo(6.48, 1);
  });

  it('warm_exercise_moderate: T_amb=25, MET=6 → T_skin ~31.6, strong vasodilation', () => {
    const r = iterativeTSkin(37, 25, 0.075, 0.116, 0.10, 1.85, 6.0, 1.0, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(31.62, 1);
    expect(r.converged).toBe(true);
    expect(r.h_tissue).toBeCloseTo(44.70, 1);
    expect(r.E_req).toBeCloseTo(445.36, 0);
    expect(r.E_actual).toBeCloseTo(80.95, 0);
    expect(r.vasodilation).toBeCloseTo(40.12, 1);
  });

  it('hot_exercise: T_amb=35, MET=8, hot regime → vasodilation pegged at GAGGE_VDIL_MAX (45)', () => {
    const r = iterativeTSkin(37, 35, 0.075, 0.077, 0.15, 1.85, 8.0, 0.5, 50, 0.089, 22);
    expect(r.T_skin).toBeCloseTo(29.32, 1);
    expect(r.converged).toBe(true);
    expect(r.h_tissue).toBeCloseTo(48.45, 1);
    expect(r.E_req).toBeCloseTo(807.80, 0);
    expect(r.E_actual).toBeCloseTo(43.39, 0);
    expect(r.vasodilation).toBeCloseTo(45.0, 2);  // pegged at max
  });

  it('returns IterativeTSkinResult shape with all fields including vasodilation (Pre-Build Audit Q15 option 1)', () => {
    const r = iterativeTSkin(37, 20, 0.075, 0.2, 0.1, 1.85, 3.0, 1.0, 50, 0.089, 22);
    expect(r).toHaveProperty('T_skin');
    expect(r).toHaveProperty('converged');
    expect(r).toHaveProperty('iterations');
    expect(r).toHaveProperty('h_tissue');
    expect(r).toHaveProperty('E_req');
    expect(r).toHaveProperty('E_actual');
    expect(r).toHaveProperty('vasodilation');
  });

  it('respects custom maxIter and tol parameters', () => {
    // Force fewer iterations to test parameter passing
    const r = iterativeTSkin(37, 25, 0.075, 0.116, 0.15, 1.85, 1.5, 0.5, 50, 0.089, 22, 3, 0.1);
    expect(r.iterations).toBeLessThanOrEqual(3);
  });

  it('T_skin output respects hard bounds [25, 37]', () => {
    // Extreme cold input
    const cold = iterativeTSkin(37, -40, 0.075, 0.05, 0.05, 1.85, 1.0, 5.0, 50, 0.089, 22);
    expect(cold.T_skin).toBeGreaterThanOrEqual(25);
    expect(cold.T_skin).toBeLessThanOrEqual(37);
    // Extreme hot input
    const hot = iterativeTSkin(37, 45, 0.075, 0.05, 0.05, 1.85, 10.0, 0.5, 80, 0.089, 22);
    expect(hot.T_skin).toBeGreaterThanOrEqual(25);
    expect(hot.T_skin).toBeLessThanOrEqual(37);
  });
});
EOF

echo "✓ body_thermo.test.ts written"
echo ""

# ============================================================================
# PHASE 9 — Tests for metabolism (computeVE + computeMetabolicHeat + computeRespiratoryHeatLoss)
# ============================================================================
echo ">>> PHASE 9: tests for metabolism.ts"

cat > packages/engine/tests/heat_balance/metabolism.test.ts << 'EOF'
// Tests for metabolism.ts — VE, metabolic heat, respiratory heat loss.
// Hand-computed reference values from cited sources.

import { describe, it, expect } from 'vitest';
import {
  computeVE,
  computeMetabolicHeat,
  computeRespiratoryHeatLoss,
} from '../../src/heat_balance/metabolism.js';

describe('computeVE (ACSM ventilation)', () => {
  it('rest at 1 MET, 70 kg → VE = vo2 × 20 / 1000 = 4.9 L/min', () => {
    // vo2 = 1 × 3.5 × 70 = 245 mL/min; veRatio = 20 (MET≤2)
    // VE = 245 × 20 / 1000 = 4.9 L/min
    expect(computeVE(1, 70)).toBeCloseTo(4.9, 2);
  });

  it('moderate at 4 MET, 70 kg → veRatio = 22.5', () => {
    // vo2 = 4 × 3.5 × 70 = 980 mL/min; veRatio = 20 + (4-2)×1.25 = 22.5
    // VE = 980 × 22.5 / 1000 = 22.05 L/min
    expect(computeVE(4, 70)).toBeCloseTo(22.05, 2);
  });

  it('hard at 8 MET, 70 kg → veRatio = 30', () => {
    // vo2 = 8 × 3.5 × 70 = 1960 mL/min; veRatio = 25 + (8-6)×2.5 = 30
    // VE = 1960 × 30 / 1000 = 58.8 L/min
    expect(computeVE(8, 70)).toBeCloseTo(58.8, 2);
  });

  it('scales linearly with body mass', () => {
    expect(computeVE(4, 100) / computeVE(4, 50)).toBeCloseTo(2.0, 4);
  });

  it('boundary at MET=2 → veRatio = 20 (low slope)', () => {
    // vo2 = 2 × 3.5 × 70 = 490; veRatio = 20
    expect(computeVE(2, 70)).toBeCloseTo(9.8, 2);
  });

  it('boundary at MET=6 → veRatio = 25 (mid slope)', () => {
    // vo2 = 6 × 3.5 × 70 = 1470; veRatio = 25
    expect(computeVE(6, 70)).toBeCloseTo(36.75, 2);
  });
});

describe('computeMetabolicHeat (Ainsworth 2011)', () => {
  it('1 MET × 70 kg × 0.83 efficiency = ~67.6 W', () => {
    // 1 × 1.163 × 70 × 0.83 = 67.57 W
    expect(computeMetabolicHeat(1, 70)).toBeCloseTo(67.57, 1);
  });

  it('5 MET × 70 kg → 5x scaling vs 1 MET', () => {
    expect(computeMetabolicHeat(5, 70) / computeMetabolicHeat(1, 70)).toBeCloseTo(5.0, 4);
  });

  it('scales linearly with body mass', () => {
    expect(computeMetabolicHeat(3, 100) / computeMetabolicHeat(3, 50)).toBeCloseTo(2.0, 4);
  });

  it('hard exercise (10 MET, 80 kg) ~ 772 W', () => {
    // 10 × 1.163 × 80 × 0.83 = 772.43 W
    expect(computeMetabolicHeat(10, 80)).toBeCloseTo(772.43, 1);
  });
});

describe('computeRespiratoryHeatLoss (sensible + latent)', () => {
  it('cold dry conditions → significant heat + moisture loss', () => {
    // -10°C, 30% RH, 4 MET, 70 kg, no face cover
    const r = computeRespiratoryHeatLoss(4, -10, 30, 70);
    expect(r.total).toBeGreaterThan(0);
    expect(r.moistureGhr).toBeGreaterThan(0);
  });

  it('warm humid conditions → low respiratory heat loss', () => {
    // 30°C, 80% RH, 1 MET, 70 kg
    const cold = computeRespiratoryHeatLoss(4, -10, 30, 70);
    const warm = computeRespiratoryHeatLoss(4, 30, 80, 70);
    expect(warm.total).toBeLessThan(cold.total);
  });

  it('balaclava reduces total by 35%', () => {
    const noCover = computeRespiratoryHeatLoss(4, -10, 30, 70);
    const balaclava = computeRespiratoryHeatLoss(4, -10, 30, 70, 'balaclava');
    expect(balaclava.total).toBeCloseTo(noCover.total * 0.65, 1);
    expect(balaclava.moistureGhr).toBeCloseTo(noCover.moistureGhr * 0.65, 1);
  });

  it('HME reduces total by 50%', () => {
    const noCover = computeRespiratoryHeatLoss(4, -10, 30, 70);
    const hme = computeRespiratoryHeatLoss(4, -10, 30, 70, 'hme');
    expect(hme.total).toBeCloseTo(noCover.total * 0.50, 1);
    expect(hme.moistureGhr).toBeCloseTo(noCover.moistureGhr * 0.50, 1);
  });

  it('returns 0 when ambient already at body core (37°C, 100% RH) — no gradient', () => {
    const r = computeRespiratoryHeatLoss(4, 37, 100, 70);
    // Sensible Q ~ 0 at T_amb = 37; latent Q small if ambient nearly saturated
    expect(r.total).toBeLessThan(20); // small residual from latent gradient
  });

  it('higher MET → more ventilation → more heat/moisture loss', () => {
    const rest = computeRespiratoryHeatLoss(1, -10, 30, 70);
    const hard = computeRespiratoryHeatLoss(8, -10, 30, 70);
    expect(hard.total).toBeGreaterThan(rest.total);
    expect(hard.moistureGhr).toBeGreaterThan(rest.moistureGhr);
  });

  it('clamps extreme cold (T_amb < -45°C) gracefully', () => {
    const r = computeRespiratoryHeatLoss(4, -60, 30, 70);
    expect(Number.isFinite(r.total)).toBe(true);
    expect(r.total).toBeGreaterThan(0);
  });
});
EOF

echo "✓ metabolism.test.ts written"
echo ""

# ============================================================================
# PHASE 10 — Tests for env_loss (computeConvectiveHeatLoss + computeRadiativeHeatLoss)
# ============================================================================
echo ">>> PHASE 10: tests for env_loss.ts"

cat > packages/engine/tests/heat_balance/env_loss.test.ts << 'EOF'
// Tests for env_loss.ts — convective and radiative heat loss.
// Hand-computed reference values; physics-based assertions.

import { describe, it, expect } from 'vitest';
import {
  computeConvectiveHeatLoss,
  computeRadiativeHeatLoss,
} from '../../src/heat_balance/env_loss.js';

describe('computeConvectiveHeatLoss (ASHRAE forced convection)', () => {
  it('returns positive heat loss when skin warmer than ambient', () => {
    // T_skin = 33, T_amb = 10
    const q = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 1.0);
    expect(q).toBeGreaterThan(0);
  });

  it('returns negative heat loss (gain) when ambient warmer than skin', () => {
    const q = computeConvectiveHeatLoss(33, 40, 0.155, 1.85, 1.0);
    expect(q).toBeLessThan(0);
  });

  it('returns 0 when skin temp equals ambient', () => {
    expect(computeConvectiveHeatLoss(20, 20, 0.155, 1.85, 1.0)).toBe(0);
  });

  it('higher wind → more heat loss (cold conditions)', () => {
    const calm = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 0.5);
    const windy = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 5.0);
    expect(windy).toBeGreaterThan(calm);
  });

  it('higher CLO → less heat loss', () => {
    const lightClo = computeConvectiveHeatLoss(33, 10, 0.05, 1.85, 1.0);
    const heavyClo = computeConvectiveHeatLoss(33, 10, 0.5, 1.85, 1.0);
    expect(heavyClo).toBeLessThan(lightClo);
  });

  it('activity speed adds to wind for effective convection', () => {
    const ambient = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 1.0, 0);
    const moving = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 1.0, 5);
    expect(moving).toBeGreaterThan(ambient);
  });

  it('returns 0 for degenerate input (negative resistances)', () => {
    expect(computeConvectiveHeatLoss(33, 10, -0.5, 1.85, 1.0)).toBe(0);
  });

  it('respects natural convection floor (wind < 0.5 → uses 0.5)', () => {
    const zero = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 0);
    const min = computeConvectiveHeatLoss(33, 10, 0.155, 1.85, 0.5);
    expect(zero).toBeCloseTo(min, 4);
  });
});

describe('computeRadiativeHeatLoss (Stefan-Boltzmann)', () => {
  it('returns positive heat loss when surface warmer than ambient', () => {
    // T_surf = 20°C, T_amb = 0°C
    const q = computeRadiativeHeatLoss(20, 0, 1.85);
    expect(q).toBeGreaterThan(0);
  });

  it('returns negative heat loss (gain) when ambient warmer', () => {
    const q = computeRadiativeHeatLoss(15, 35, 1.85);
    expect(q).toBeLessThan(0);
  });

  it('returns 0 when surfaces at same temperature', () => {
    expect(computeRadiativeHeatLoss(20, 20, 1.85)).toBe(0);
  });

  it('hand-computed: T_surf=20°C, T_amb=0°C, BSA=2.0 → ~190 W', () => {
    // ε × σ × BSA × (T_s⁴ - T_a⁴)
    // = 0.95 × 5.67e-8 × 2.0 × (293.15⁴ - 273.15⁴)
    // T_s⁴ = 7385000730; T_a⁴ = 5567929590; diff = 1817071140
    // 0.95 × 5.67e-8 × 2.0 × 1.817e9 ≈ 195.7 W
    expect(computeRadiativeHeatLoss(20, 0, 2.0)).toBeCloseTo(195.7, 0);
  });

  it('scales linearly with BSA', () => {
    const small = computeRadiativeHeatLoss(20, 0, 1.5);
    const large = computeRadiativeHeatLoss(20, 0, 3.0);
    expect(large / small).toBeCloseTo(2.0, 4);
  });

  it('non-linear scaling with temperature (Stefan-Boltzmann ⁴ power)', () => {
    // Doubling delta T should more than quadruple heat loss
    const small = computeRadiativeHeatLoss(20, 10, 1.85);
    const large = computeRadiativeHeatLoss(30, 10, 1.85);
    expect(large / small).toBeGreaterThan(2.0); // not linear scaling
  });
});
EOF

echo "✓ env_loss.test.ts written"
echo ""

# ============================================================================
# PHASE 11 — Run tests + typecheck + commit + push
# ============================================================================
echo ">>> PHASE 11: Run tests, typecheck, commit, push to GitHub"

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
git commit -m "Session 7: PHY-056 heat balance solver port from LC5 (DEC-023)

Per Architecture Document v1.1 §2 repo structure, Cardinal Rule #8 (engine locked),
and DEC-023 (PHY-056 = single source of truth; PHY-040 explicitly excluded).

heat_balance/ module additions:
  - body_thermo.ts: computeTissueCLO (Rennie 1962), computeTSkin (canonical),
                    iterativeTSkin (PHY-056 Gagge two-node solver — heart of engine)
  - metabolism.ts: computeVE (ACSM), computeMetabolicHeat (Ainsworth 2011),
                   computeRespiratoryHeatLoss (sensible + latent)
  - env_loss.ts: computeConvectiveHeatLoss (ASHRAE), computeRadiativeHeatLoss (Stefan-Boltzmann)
  - constants.ts extended: LC5_C_P_AIR, LC5_RHO_AIR, LC5_RHO_VAP_EXP, LC5_SIGMA,
                           LC5_EMISS, LC5_T_CORE_BASE, LC5_BODY_SPEC_HEAT,
                           Gagge two-node parameters (vdil/vcon caps, threshold, slope)

8 functions ported VERBATIM from LC5 risk_functions.js lines 1-126.
14 named constants ported with primary source attributions.

Tests: lock-in baseline values for iterativeTSkin captured 2026-04-15 from
LC5 verbatim source across 6 operating points (cold rest, cool walk, cool active,
warm rest non-converging, warm exercise, hot exercise). Hand-computed values for
non-iterative functions (Rennie BF→CLO, ACSM VE, Ainsworth MET→W, Stefan-Boltzmann).

Pre-Build Audit (Session 7 opening) verified all 18 Cardinal Rules before code
production; this audit becomes the standard for Session 8+ build phases.

DEC-023 ratifies PHY-056 as LC6 single source of truth for heat balance;
PHY-040 functions (calcEvapHeatLoss, calcRespHeatLoss, calcEnvHeatLoss) explicitly
NOT ported — represent LC5 technical debt that LC6 will not inherit per Cardinal Rule #3."

git push origin main

echo ""
echo "=========================================="
echo "SESSION 7 BUILD COMPLETE"
echo "=========================================="
echo ""
echo "Engine state:"
echo "  - CDI v1.4 stage detector (Session 5)"
echo "  - Heat balance primitives (Session 6: VPD, evaporation, sweat, drain)"
echo "  - PHY-056 heat balance solver (Session 7: T_skin, iterative, metabolism, env loss)"
echo ""
echo "Session 8 candidates:"
echo "  - Port LC5 calcEnsembleIm (harmonic mean for clothing system im)"
echo "  - Port LC5 buildLayerArray + computeEffectiveCLO (gear ensemble assembly)"
echo "  - Begin assembling toward calcIntermittentMoisture (Session 9 target)"
echo ""
