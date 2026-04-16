// Altitude-related physiological and physical adjustments.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * Compute relative humidity at a given temperature using dew point (Magnus formula).
 * Both inputs in °C. Stull (2017): dew point conserved in same air mass as elevation changes.
 *
 * Used to adjust humidity for altitude when elevation profile has dew point data.
 *
 * LC5 risk_functions.js lines 694-700.
 *
 * @param tempC air temperature at altitude (°C)
 * @param dewPointC dew point temperature (°C, conserved from base)
 * @returns relative humidity as percent (0-100)
 */
export function calcElevationHumidity(tempC: number, dewPointC: number): number {
  const a = 17.27, b = 237.3;
  const gamma_t = (a * tempC) / (b + tempC);
  const gamma_td = (a * dewPointC) / (b + dewPointC);
  const rh = 100 * Math.exp(gamma_td - gamma_t);
  return Math.min(100, Math.max(0, rh));
}

/**
 * Altitude correction factors for physiological and physical effects.
 *
 * Standard atmosphere: P/P₀ = (1 - 6.8753e-6 × h)^5.2559
 * Buskirk & Hodgson (1987): VO₂max drops ~3%/1000ft above 5000ft → same work costs more effort
 * Molecular diffusion ∝ 1/P: lower air pressure enhances vapor transport through porous fabrics
 * Forced convection ∝ ρ^0.5: lower air density reduces convective heat loss effectiveness
 *
 * Returns identity (1.0) for all factors below 1000 ft.
 *
 * LC5 risk_functions.js lines 796-804.
 *
 * @param elevFt elevation in feet above sea level
 */
export interface AltitudeFactorsResult {
  metabolic: number;    // increased metabolic cost (1.0 at sea level, up to 1.40)
  evap: number;         // enhanced evaporative transport (1.0 at sea level, up to 1.60)
  convective: number;   // reduced convective effectiveness (1.0 at sea level, down to 0.70)
}

export function altitudeFactors(elevFt: number | null | undefined): AltitudeFactorsResult {
  if (!elevFt || elevFt < 1000) return { metabolic: 1.0, evap: 1.0, convective: 1.0 };
  const pRatio = Math.pow(1 - 6.8753e-6 * elevFt, 5.2559);
  return {
    metabolic: Math.min(1.40, 1 + Math.max(0, (elevFt - 5000) / 1000) * 0.03),
    evap: Math.min(1.60, Math.pow(pRatio, -0.6)),
    convective: Math.max(0.70, Math.pow(pRatio, 0.5)),
  };
}
