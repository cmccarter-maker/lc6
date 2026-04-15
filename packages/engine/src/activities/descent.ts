// Descent speed wind lookup (PHY-019).
// Ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * Result of descentSpeedWind — descent speed (mph) and time-in-fall-line fraction.
 */
export interface DescentSpeedWindResult {
  speed: number;       // average descent speed in mph
  turnFactor: number;  // fraction of time in fall line (0-1)
}

/**
 * Descent speed wind data per ski/snowboard terrain variant.
 *
 * Sources: Shealy et al. 2023 radar data + GPS aggregates from SkiTalk/AlpineZone.
 *
 * Effective wind during descent: W_run = W_ambient + speed × turnFactor
 *
 * LC5 risk_functions.js lines 1438-1450.
 *
 * Strips ski/snowboard sport prefix per PHY-030 unified terrain keys.
 *
 * Returns default { speed: 25, turnFactor: 0.6 } for unknown variants
 * or non-string inputs.
 *
 * @param variant terrain variant string (e.g., 'groomers', 'skiing_groomers', 'moguls')
 */
export function descentSpeedWind(variant: string | null | undefined): DescentSpeedWindResult {
  if (typeof variant !== 'string') return { speed: 25, turnFactor: 0.6 };
  // PHY-030: Unified terrain keys (ski = snowboard). Strip sport prefix for backward compat.
  const v = variant.replace(/^(skiing|snowboarding)_/, '');
  const data: Record<string, DescentSpeedWindResult> = {
    groomers: { speed: 30, turnFactor: 0.7 },  // 20-35 mph avg, medium-radius turns
    moguls:   { speed: 12, turnFactor: 0.5 },  // 8-15 mph, constant tight turns
    trees:    { speed:  8, turnFactor: 0.45 }, // 5-12 mph, line-picking pauses
    bowls:    { speed: 20, turnFactor: 0.6 },  // 15-25 mph, open steeps/chutes
    park:     { speed: 18, turnFactor: 0.55 }, // 12-22 mph approach between features
  };
  return data[v] ?? { speed: 25, turnFactor: 0.6 };
}
