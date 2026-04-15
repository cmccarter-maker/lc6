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
