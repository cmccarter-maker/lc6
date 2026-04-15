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
