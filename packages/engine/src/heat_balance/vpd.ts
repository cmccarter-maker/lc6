// Vapor pressure utilities — Magnus formula and VPD ratio.
// Ported verbatim from LC5 risk_functions.js (PHY-039).
// Single source of truth for vapor pressure across the engine.

import { MAGNUS_A, MAGNUS_B, MAGNUS_E0_HPA } from './constants.js';

/**
 * Saturation vapor pressure at temperature T (°C).
 * Returns hPa.
 *
 * Source: Magnus formula, Alduchov & Eskridge 1996.
 *   p_sat(T) = 6.1078 × exp(17.27 × T / (T + 237.3))   [hPa]
 *
 * Used by:
 *   - vpdRatio (PHY-039)
 *   - computeEmax (vapor pressure gradients)
 *   - getDrainRate (clothing surface evaporation)
 *   - hygroAbsorption (ambient absorption)
 *
 * LC5 risk_functions.js line 1998.
 */
export function satVaporPressure(tCelsius: number): number {
  return MAGNUS_E0_HPA * Math.exp((MAGNUS_A * tCelsius) / (tCelsius + MAGNUS_B));
}

/**
 * VPD reference: 20°C, 50% RH — standard exercise physiology lab condition.
 * Computed once at module load. ≈ 11.67 hPa.
 * LC5 risk_functions.js line 2004.
 */
export const VPD_REF_HPA = satVaporPressure(20) * (1 - 0.50);

/**
 * VPD ratio: actual VPD / reference VPD.
 * Replaces (100 - H)/100 humidity term per PHY-039.
 * Used to scale sweat rate physics relative to lab-measured baselines.
 *
 * Returns dimensionless ratio. Reference (20°C, 50% RH) = 1.0.
 *
 * @param tempF ambient temperature in Fahrenheit
 * @param humidity relative humidity 0-100
 *
 * LC5 risk_functions.js line 2005.
 */
export function vpdRatio(tempF: number, humidity: number): number {
  const tC = (tempF - 32) * 5 / 9;
  const eSat = satVaporPressure(tC);
  const vpd = Math.max(0, eSat * (1 - (humidity ?? 45) / 100));
  return vpd / VPD_REF_HPA;
}
