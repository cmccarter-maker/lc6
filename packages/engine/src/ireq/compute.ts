// Dynamic IREQ computation per activity.
// No lookup tables, no interpolation — live solve per call.
// IREQ_neu/IREQ_min complete in <1ms, no performance concern.

import { IREQ_neu, IREQ_min } from './ireq.js';
import { m2KW_to_clo } from './helpers.js';
import { resolveActivityMet } from './activity_met.js';

/** Default moisture permeability index per d'Ambrosio 2025 Appendix B. */
const DEFAULT_IM = 0.38;

export interface ActivityIREQResult {
  /** Required insulation for thermal comfort (neutral), clo. */
  ireq_neu_clo: number;
  /** Minimum required insulation (high strain), clo. */
  ireq_min_clo: number;
  /** Metabolic rate used, W/m². */
  M: number;
  /** True if activity is triaged out of IREQ (water-primary). */
  excluded: false;
}

export interface ActivityIREQExcluded {
  excluded: true;
  reason: string;
}

export type ActivityIREQOutput = ActivityIREQResult | ActivityIREQExcluded;

/**
 * Compute IREQ_neu and IREQ_min for a given activity and conditions.
 * Returns required clothing insulation in clo.
 *
 * @param activity LC5/LC6 activity identifier
 * @param ta air temperature, °C
 * @param va air velocity, m/s (must be ≥ 0.4 per ISO 11079)
 * @param RH relative humidity, %
 * @param options optional overrides
 */
export function computeActivityIREQ(
  activity: string,
  ta: number,
  va: number,
  RH: number,
  options?: {
    snowTerrain?: string | null;
    im?: number;
    tr?: number;  // mean radiant temperature; defaults to ta
  },
): ActivityIREQOutput {
  const met = resolveActivityMet(activity, options?.snowTerrain);
  if (met === null) {
    return { excluded: true, reason: `Activity '${activity}' triaged out of IREQ (water-primary)` };
  }

  const im = options?.im ?? DEFAULT_IM;
  const tr = options?.tr ?? ta;  // ISO 11079 default: tr = ta (no solar model)
  const vaEff = Math.max(0.4, va);  // ISO 11079 minimum

  const neu_m2kw = IREQ_neu(ta, tr, vaEff, RH, met.M, met.W, im);
  const min_m2kw = IREQ_min(ta, tr, vaEff, RH, met.M, met.W, im);

  return {
    ireq_neu_clo: m2KW_to_clo(neu_m2kw),
    ireq_min_clo: m2KW_to_clo(min_m2kw),
    M: met.M,
    excluded: false,
  };
}
