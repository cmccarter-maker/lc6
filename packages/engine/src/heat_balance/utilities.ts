// Small physics utilities — wind penetration, ensemble capacity, humidity floor,
// duration penalty, precipitation wetting rate.
// All ported verbatim from LC5 risk_functions.js.

import { ACTIVITY_LAYER_COUNT } from './constants.js';

/**
 * Wind penetration through shell as fraction of ambient wind.
 * Per PHY-041: even the most windproof shell allows ~15% minimum
 * (seams, zippers, collar gaps always allow some air exchange).
 *
 * @param shellWindResistance 0-10 scale (0=no shell, 10=Gore-Tex Pro)
 * @returns fraction of ambient wind that penetrates shell
 *
 * Source: ISO 9237 fabric air permeability. LC5 risk_functions.js line 1928.
 */
export function getWindPenetration(shellWindResistance: number): number {
  return 1.0 - (shellWindResistance / 10) * 0.85;
}

/**
 * Ensemble moisture capacity in liters, scaled by activity-typical layer count.
 * Per PHY-038 A5: SAT_CAP = 0.18 + 0.08 × (numLayers − 1)
 *
 * 2 layers (fishing/golf) → 0.26 L
 * 3 layers (hiking/XC) → 0.34 L
 * 4 layers (skiing) → 0.42 L
 * 5 layers → 0.50 L
 *
 * @param activity activity ID (key into ACTIVITY_LAYER_COUNT); unknown defaults to 3 layers
 *
 * LC5 risk_functions.js line 1992.
 */
export function getEnsembleCapacity(activity: string): number {
  const n = ACTIVITY_LAYER_COUNT[activity] ?? 3;
  return 0.18 + 0.08 * (n - 1);
}

/**
 * Humidity-dependent evaporation floor factor.
 * VPD at shell-air interface shrinks with RH.
 * At 85% RH the vapor pressure gradient is ~73% smaller than at 45% RH.
 * Per PHY-051. LC5 risk_functions.js line 2014.
 *
 * @param rh relative humidity 0-100
 * @returns floor multiplier 0.25 to 1.0
 */
export function humidityFloorFactor(rh: number): number {
  return rh < 70 ? 1.0 : Math.max(0.25, 1.0 - (rh - 70) / 60);
}

/**
 * Duration penalty after MR cap reached.
 * Each hour at cap adds diminishing MR penalty (log curve prevents runaway).
 * Per PHY-028b. LC5 risk_functions.js line 2095.
 *
 * @param baseMR base moisture risk (0-10)
 * @param timeAtCapHrs hours spent at saturation cap
 * @returns adjusted MR (capped at 10)
 */
export function applyDurationPenalty(baseMR: number, timeAtCapHrs: number): number {
  if (timeAtCapHrs <= 0) return baseMR;
  const penalty = 0.45 * Math.log(1 + timeAtCapHrs);
  return Math.min(10, baseMR + penalty);
}

/**
 * Precipitation wetting rate (L/hr) — external moisture ingress from rain/snow.
 *
 * Models DWR degradation (Sefton & Sun 2015), seam ingress at interfaces, and
 * shell interior condensation when ambient RH > 80%. NOT rain through intact shell.
 *
 * Gates:
 *   - Waterproof shell (WR ≥ 7) blocks external moisture entirely (ASTM D4966)
 *   - WR 4-6 (water resistant): 40% pass-through
 *   - WR < 4: full rate
 *   - Snow below 30°F stays solid on shell — minimal melt (10%)
 *   - Wet snow 30-36°F: partial melt (50%)
 *   - Above 36°F: rain, full liquid wetting
 *
 * Per PHY-051 / PHY-060. LC5 risk_functions.js line 2033.
 *
 * @param precipProb probability of precipitation 0-1
 * @param tempF ambient temperature in Fahrenheit
 * @param shellWR shell water resistance 0-10
 * @returns wetting rate in L/hr
 */
export function precipWettingRate(
  precipProb: number,
  tempF: number,
  shellWR: number,
): number {
  if (precipProb <= 0.5) return 0;
  const baseRate = 0.03 + (precipProb - 0.5) * 0.04; // 0.03-0.05 L/hr at 50-100% probability

  // Shell gate
  let shellGate = 1.0;
  if (typeof shellWR === 'number') {
    if (shellWR >= 7) shellGate = 0.0;
    else if (shellWR >= 4) shellGate = 0.40;
  }

  // Temperature gate
  let tempGate = 1.0;
  if (typeof tempF === 'number') {
    if (tempF < 30) tempGate = 0.10;
    else if (tempF <= 36) tempGate = 0.50;
  }

  return baseRate * shellGate * tempGate;
}
