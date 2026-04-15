// Metabolic and respiratory heat calculations.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

import { L_V_J_PER_G, LC5_C_P_AIR, LC5_RHO_AIR, LC5_RHO_VAP_EXP } from './constants.js';

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
 * @param RH relative humidity as PERCENT (0-100). DEC-024: standardized across all heat-balance functions.
 *   (LC5 source expected this as fraction 0-1, inconsistent with rest of engine; LC6 unifies to percent.)
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
  // Latent: humidifying air — Magnus formula for vapor density.
  // DEC-024: RH parameter standardized to percent (0-100) across all heat-balance functions.
  // LC5 source had this function expecting RH as fraction (0-1) while all other functions
  // expected percent — a silent-bug landmine. LC6 unifies to percent (0-100); convert here.
  const TambClamped = Math.max(-45, TambC);
  const esat = 6.1078 * Math.exp((17.27 * TambClamped) / (TambClamped + 237.3));
  const eActual = esat * 100 * (RH / 100); // Pa
  const rhoAmb = Math.max(0, (eActual / (461.5 * (TambC + 273.15))) * 1000); // g/m³
  const moistureGmin = VE * (LC5_RHO_VAP_EXP - rhoAmb) / 1000; // g/min
  const Qlat = moistureGmin * L_V_J_PER_G / 60; // W
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
