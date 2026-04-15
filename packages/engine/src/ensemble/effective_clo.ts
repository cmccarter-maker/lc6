// Effective CLO calculations: gear → dynamic CLO with pumping/wind/layering corrections,
// plus temperature/intensity-based clothingInsulation utility.
// All ported VERBATIM from LC5 risk_functions.js.
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.
//
// NOTE: clothingInsulation takes temperature as °F (LC5 mixed convention).
// LC6 currently preserves this; OQ-028 tracks future °F-standardization across engine.

import { getWindPenetration } from '../heat_balance/utilities.js';

/**
 * Pumping reduction factor — activity-induced air movement reduces effective CLO.
 *
 * Per PHY-049 Effect 2: Havenith 2002, Lu et al. 2015.
 * No reduction below MET 2.0 (standing/seated). Linear ramp to 45% reduction at MET 10.0.
 * Returns multiplier 0.55 to 1.0.
 *
 * LC5 risk_functions.js lines 2387-2390.
 */
export function pumpingReduction(met: number): number {
  if (met <= 2.0) return 1.0;
  return 1.0 - Math.min(0.45, (met - 2.0) / 8.0 * 0.45);
}

/**
 * Wind protection factor — shell wind resistance moderates CLO loss to wind.
 *
 * Per PHY-049 Effect 3: PMC 10024235.
 * Extends getWindPenetration to modulate thermal resistance (not just evaporation).
 * Returns multiplier 0.5 to 1.0.
 *
 * LC5 risk_functions.js lines 2394-2398.
 *
 * @param shellWindResistance 0-10 scale (0=no shell, 10=Gore-Tex Pro)
 * @param windMph ambient wind speed (mph)
 */
export function windCLOProtection(shellWindResistance: number, windMph: number): number {
  const penetration = getWindPenetration(shellWindResistance);
  const windFactor = Math.min(1.0, windMph / 15.0);
  return 1.0 - penetration * windFactor * 0.50;
}

/**
 * Static layering correction — replaces additive airGapBonus.
 *
 * Per BUG-204: McCullough & Jones 1984 (ISO 9920) — measured ensemble CLO
 * is LESS than sum of garments. Compression at layer contacts + increased
 * surface area (f_cl) > air gap benefit. Net: ~4% reduction per additional layer.
 *
 * Only applies at rest (MET ≤ 2.0) — pumping reduction handles movement cases.
 * Does NOT overlap with pumping/wind/moisture corrections (separate physical mechanisms).
 *
 * 2 layers: 0.96, 3 layers: 0.92, 4 layers: 0.88, 5+: 0.84.
 *
 * LC5 risk_functions.js lines 2406-2410.
 */
export function staticLayeringCorrection(met: number, numLayers: number): number {
  if (numLayers < 2 || met > 2.0) return 1.0;
  return 1.0 - Math.min(numLayers - 1, 4) * 0.04;
}

/**
 * Combined dynamic CLO — gear × pumping × wind × layering corrections.
 *
 * Per PHY-049 + BUG-204. Floor at 30% of baseCLO (conduction resistance
 * persists even in worst case).
 *
 * LC5 risk_functions.js lines 2414-2420.
 *
 * @param baseCLO base CLO from gear ensemble
 * @param met metabolic equivalent
 * @param shellWR shell wind resistance 0-10
 * @param windMph ambient wind speed (mph)
 * @param numLayers number of layers in ensemble
 */
export function computeEffectiveCLO(
  baseCLO: number,
  met: number,
  shellWR: number,
  windMph: number,
  numLayers: number,
): number {
  const pump = pumpingReduction(met);
  const wind = windCLOProtection(shellWR, windMph);
  const layering = staticLayeringCorrection(met, numLayers);
  const eff = baseCLO * pump * wind * layering;
  return Math.max(baseCLO * 0.30, eff);
}

/**
 * Temperature/intensity-based clothing insulation estimate.
 *
 * Returns CLO adjusted for body heat trapping during activity.
 * Used as fallback for moistureRisk when no specific gear ensemble provided.
 *
 * Tier mapping (°F):
 *   > 75°F:  0.3 CLO (minimal: single light layer)
 *   65-75°F: 0.5 CLO (light: base + maybe wind shirt)
 *   55-65°F: 0.7 CLO (moderate: base + light mid)
 *   45-55°F: 1.0 CLO (cool: base + mid layer)
 *   35-45°F: 1.4 CLO (cold: base + mid + light insulation)
 *   25-35°F: 1.8 CLO (very cold: full system)
 *   10-25°F: 2.2 CLO (severe: full winter)
 *   ≤ 10°F:  2.5 CLO (extreme: maximum layering, vapor barrier)
 *
 * Heat trapping multiplier: 1.0 + min(excessClo × intMul, 1.0).
 *
 * NOTE: LC5 mixed-convention — this function takes °F. Tracked in OQ-028
 * for future °F-standardization across engine.
 *
 * LC5 risk_functions.js lines 816-829.
 *
 * @param tempF ambient temperature in Fahrenheit
 * @param intensity activity intensity level
 */
export function clothingInsulation(
  tempF: number,
  intensity: 'low' | 'moderate' | 'high' | 'very_high' | string | undefined,
): number {
  let clo: number;
  if (tempF > 75) clo = 0.3;
  else if (tempF > 65) clo = 0.5;
  else if (tempF > 55) clo = 0.7;
  else if (tempF > 45) clo = 1.0;
  else if (tempF > 35) clo = 1.4;
  else if (tempF > 25) clo = 1.8;
  else if (tempF > 10) clo = 2.2;
  else clo = 2.5;

  const intMulMap: Record<string, number> = {
    low: 0.05,
    moderate: 0.2,
    high: 0.45,
    very_high: 0.65,
  };
  const intMul = intMulMap[intensity ?? 'moderate'] ?? 0.2;
  const excessClo = Math.max(0, clo - 0.5);
  const heatTrapping = excessClo * intMul;
  return 1.0 + Math.min(heatTrapping, 1.0);
}
