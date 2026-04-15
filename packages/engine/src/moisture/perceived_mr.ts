// Perceived moisture risk — skin-weighted layer saturation perception.
// Ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * Perceived MR layer weights — skin-adjacent layers matter most.
 *
 * Source: Fukazawa 2003, Zhang 2002 — skin wetness perception correlates with
 * skin-fabric interface, not deeper layer saturation.
 *
 * Order: [base, mid, insulation, shell].
 * LC5 risk_functions.js line 287.
 */
export const PERCEIVED_WEIGHTS: readonly number[] = [3, 2, 1.5, 1];

/**
 * Comfort threshold for base layer in mL.
 *
 * Source: Fukazawa 2003 — skin wetness perception onset at ~50 g/m².
 * Torso base layer contact area ~0.8 m² → threshold ~40 mL.
 *
 * LC5 risk_functions.js line 291.
 */
export const COMFORT_THRESHOLD = 40;

/**
 * Layer with buffer state for perceived MR calculation.
 */
export interface PerceivedMRLayer {
  buffer: number;  // mL retained moisture
  cap: number;     // mL maximum capacity
}

/**
 * Compute perceived MR (0-10 scale) from layer buffer state.
 *
 * Base layer (i=0): uses absolute moisture vs comfort threshold (40 mL).
 *   User feels moisture against skin regardless of how much fabric CAN hold.
 *
 * Other layers (i≥1): use fill fraction (buffer/cap).
 *   User doesn't feel these layers directly; they affect drying and perception
 *   indirectly through capacity.
 *
 * Weighted average using PERCEIVED_WEIGHTS, scaled by 7.2 to project onto 0-10.
 *
 * LC5 risk_functions.js lines 293-309.
 *
 * @param layers per-layer buffer state in skin-out order
 */
export function computePerceivedMR(
  layers: PerceivedMRLayer[] | null | undefined,
): number {
  if (!layers || layers.length === 0) return 0;
  // Base layer (i=0): absolute moisture vs comfort threshold, not fill fraction
  const base = layers[0]!;
  const baseSat = Math.min(1, base.buffer / COMFORT_THRESHOLD);
  let num = PERCEIVED_WEIGHTS[0]! * baseSat;
  let den = PERCEIVED_WEIGHTS[0]!;
  // Other layers: fill fraction
  for (let i = 1; i < layers.length; i++) {
    const w = PERCEIVED_WEIGHTS[Math.min(i, PERCEIVED_WEIGHTS.length - 1)]!;
    const layer = layers[i]!;
    const fill = layer.cap > 0 ? Math.min(1, layer.buffer / layer.cap) : 0;
    num += w * fill;
    den += w;
  }
  if (den <= 0) return 0;
  return Math.min(10, 7.2 * (num / den));
}
