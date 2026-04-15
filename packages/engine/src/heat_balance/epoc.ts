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
