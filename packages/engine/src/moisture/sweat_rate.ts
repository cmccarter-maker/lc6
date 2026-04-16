// Standalone sweat rate calculation for steady-state activities.
// Ported VERBATIM from LC5 risk_functions.js lines 1810-1863.
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

import { ACTIVITY_SWEAT_PROFILES } from '../activities/profiles.js';
import { clothingInsulation } from '../ensemble/index.js';
import { altitudeFactors, getMetabolicEfficiency } from '../heat_balance/index.js';

interface FitnessProfile {
  sweatMul?: number;
  vo2max?: number;
  restingHR?: number;
  [key: string]: unknown;
}

/**
 * Standalone sweat rate for steady-state activities (g/hr).
 *
 * Used by the steady-state path in calcIntermittentMoisture for activities
 * without phase profiles (bouldering, climbing, camping, etc.).
 *
 * NOT the same as phaseSweatRate (cyclic closure) — this is the standalone version
 * with intermittency, golf cart reduction, and ski override applied.
 *
 * Floor: 15 g/hr (PHY-061 insensible perspiration, Gagge 1996).
 *
 * LC5 risk_functions.js lines 1810-1863.
 */
export function sweatRate(
  intensity: string,
  tempF: number,
  humidity: number,
  sex: string | null | undefined,
  weightLb: number | null | undefined,
  activity: string,
  immersionGear: string | boolean | null | undefined,
  paceMul: number | null | undefined,
  golfCartRiding: boolean | null | undefined,
  descentMul: number | null | undefined,
  snowTerrain: string | null | undefined,
  packLoadMul: number | null | undefined,
  elevFt: number | null | undefined,
  fitnessProfile: FitnessProfile | null | undefined,
): number {
  const isDrysuit = immersionGear === 'drysuit' || immersionGear === true;
  const profile = ACTIVITY_SWEAT_PROFILES[activity] ?? ACTIVITY_SWEAT_PROFILES.hiking!;
  let base = (profile as unknown as Record<string, number>)[intensity] ?? profile.moderate;
  if (activity === 'golf' && golfCartRiding) {
    base = base * 0.45;
  }
  const effectiveTemp = isDrysuit ? Math.max(tempF, Math.min(80, tempF + 30)) : tempF;
  const rawTempMul = effectiveTemp > 80 ? 1.5 : effectiveTemp > 65 ? 1.0 : effectiveTemp > 45 ? 0.6 : effectiveTemp > 30 ? 0.35 : 0.2;
  const tempMul = rawTempMul;
  const humMul = 1 + (Math.max(humidity - 40, 0) / 100) * 0.8;
  const sexMul = (sex === 'female') ? 0.75 : 1.0;
  const wt = weightLb ?? 150;
  const wtMul = 0.6 + (wt / 170) * 0.4;
  const cloMul = clothingInsulation(tempF, intensity);
  let effIntermittency = profile.intermittency;
  if (activity === 'bouldering' && paceMul && paceMul !== 1.0) {
    const shift = (paceMul - 1.0) * 0.22;
    effIntermittency = Math.max(0.25, Math.min(0.75, profile.intermittency + shift));
  }
  if (activity === 'golf' && golfCartRiding) {
    effIntermittency = 0.30;
  }
  const isSki = activity === 'skiing' || activity === 'snowboarding';
  if (isSki) {
    effIntermittency = 1.0;
  }
  const altMet = altitudeFactors(elevFt).metabolic;
  let _fitSweat = fitnessProfile?.sweatMul ?? 1.0;
  let _metEff = 1.0;
  if (fitnessProfile && (fitnessProfile.vo2max || fitnessProfile.restingHR)) {
    const _metMap: Record<string, number> = { low: 3, moderate: 5, high: 7, very_high: 9 };
    const _actMET = _metMap[intensity] ?? 5;
    _metEff = getMetabolicEfficiency(_actMET, fitnessProfile.vo2max ?? null, null, sex, fitnessProfile.restingHR ?? null);
    _fitSweat = 1.0;
  }
  const _activeSweat = base * tempMul * cloMul * humMul * sexMul * wtMul * profile.coverageMul * effIntermittency * (descentMul ?? 1.0) * (packLoadMul ?? 1.0) * altMet * _fitSweat * _metEff;
  return Math.max(15, _activeSweat);
}
