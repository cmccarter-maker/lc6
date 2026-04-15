// Split-body models for activities with sealed regions.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

import { BASELINE_IM } from '../heat_balance/constants.js';

/**
 * Wader gear data for fishing split-body model (PHY-052).
 *
 * Each entry has:
 *   - im: Woodcock permeability index for lower body (0 for sealed neoprene)
 *   - clo: thermal insulation of wader material in CLO units
 *   - label: display name for UI
 *
 * Upper body (45%) uses normal im_ensemble; lower body (55%) uses wader im/clo.
 *
 * Source: ISO 15027 immersion suit testing methodology + manufacturer specs.
 * LC5 risk_functions.js lines 930-941.
 */
export interface WaderEntry {
  im: number;
  clo: number;
  label: string;
}

export const WADER_DATA: Readonly<Record<string, WaderEntry>> = {
  neoprene_5mm:           { im: 0.00, clo: 1.50, label: 'Neoprene 5mm' },
  neoprene_3mm:           { im: 0.00, clo: 0.70, label: 'Neoprene 3mm' },
  neoprene_3_5mm:         { im: 0.00, clo: 0.90, label: 'Neoprene 3.5mm' },
  breathable:             { im: 0.15, clo: 0.15, label: 'Breathable' },
  breathable_budget:      { im: 0.10, clo: 0.15, label: 'Breathable (budget)' },
  breathable_fleece:      { im: 0.15, clo: 0.75, label: 'Breathable + fleece' },
  breathable_expedition:  { im: 0.15, clo: 1.10, label: 'Breathable + expedition' },
  wet_wading_3mm:         { im: 0.00, clo: 0.25, label: 'Wet wading (3mm sock)' },
  wet_wading_2mm:         { im: 0.00, clo: 0.20, label: 'Wet wading (2mm sock)' },
  none:                   { im: 0.00, clo: 0.00, label: 'No waders' },
};

/**
 * Snow sport split-body BSA zones (PHY-065).
 *
 * Sealed extremities limit whole-body vapor transfer in skiing/snowboarding.
 * Mandatory sealed barriers (boots, gloves, helmet, goggles, insulated pants)
 * cover ~51% of BSA. Layering system covers ~80% (trunk + arms + upper legs).
 *
 * BSA fractions per ANSUR II 2012 + Rule of Nines (medical TBSA standard).
 * Boot im: ski boots are rigid plastic — effectively im ≈ 0 for vapor (ISO 9920)
 * Glove im: insulated ski gloves im 0.03-0.05 (Havenith 2002 Table 4)
 * Helmet im: hard shell + foam liner — negligible vapor transfer
 * Ski pants im: insulated waterproof — im 0.08-0.12 (ISO 9920 Category E)
 *
 * LC5 risk_functions.js lines 967-974.
 */
export interface SnowSportZone {
  frac: number;
  im?: number;
  usesEnsemble?: boolean;
}

export const SNOW_SPORT_ZONES: Readonly<Record<string, SnowSportZone>> = {
  layeringSystem: { frac: 0.80, usesEnsemble: true },  // trunk 36% + arms 18% + upper legs 26%
  hands:          { frac: 0.05, im: 0.05 },  // gloves: leather palm + breathable back, merino liner
  head:           { frac: 0.05, im: 0.03 },  // helmet: hard shell + wicking liner
  feet:           { frac: 0.04, im: 0.02 },  // ski boots: rigid plastic, merino socks inside
  calves:         { frac: 0.04, im: 0.01 },  // inside rigid boot shaft
  face:           { frac: 0.02, im: 0.01 },  // goggles: sealed foam + lens
};

/**
 * Wader-aware split-body Woodcock im (PHY-052).
 *
 * 45% upper body (normal im_ensemble) + 55% lower body (wader im).
 * Returns ensembleIm unchanged when no wader / 'none' / unknown wader type.
 *
 * LC5 risk_functions.js lines 943-948.
 *
 * @param ensembleIm upper-body ensemble im
 * @param waderType wader gear identifier (e.g., 'neoprene_5mm')
 */
export function waderSplitIm(
  ensembleIm: number | null | undefined,
  waderType: string | null | undefined,
): number {
  if (!waderType || waderType === 'none' || !WADER_DATA[waderType]) {
    return ensembleIm ?? 0;
  }
  const upper = ensembleIm ?? BASELINE_IM;
  const lower = WADER_DATA[waderType]!.im;
  return 0.45 * upper + 0.55 * lower;
}

/**
 * Wader-aware split-body CLO (PHY-052).
 *
 * 45% upper (existing CLO estimate) + 55% lower (wader CLO).
 * Returns upperCLO unchanged when no wader / 'none' / unknown wader type.
 *
 * LC5 risk_functions.js lines 950-953.
 *
 * @param upperCLO upper-body CLO estimate
 * @param waderType wader gear identifier
 */
export function waderSplitCLO(
  upperCLO: number,
  waderType: string | null | undefined,
): number {
  if (!waderType || waderType === 'none' || !WADER_DATA[waderType]) {
    return upperCLO;
  }
  return 0.45 * upperCLO + 0.55 * WADER_DATA[waderType]!.clo;
}

/**
 * Snow sport split-body Woodcock im (PHY-065).
 *
 * Six-zone weighted average: 80% layering system (uses ensembleIm) +
 * 20% sealed extremities (gloves + helmet + boots + calves + face).
 *
 * Falls back to BASELINE_IM if ensembleIm is null/0.
 *
 * LC5 risk_functions.js lines 975-984.
 *
 * @param ensembleIm upper-body layering system ensemble im
 */
export function snowSportSplitIm(ensembleIm: number | null | undefined): number {
  const ens = ensembleIm || BASELINE_IM;
  const z = SNOW_SPORT_ZONES;
  return z.layeringSystem!.frac * ens +
    z.hands!.frac * (z.hands!.im ?? 0) +
    z.head!.frac * (z.head!.im ?? 0) +
    z.feet!.frac * (z.feet!.im ?? 0) +
    z.calves!.frac * (z.calves!.im ?? 0) +
    z.face!.frac * (z.face!.im ?? 0);
}
