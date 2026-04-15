// Saturation cascade curve transformation (LC5 Saturation Cascade v3).
// Ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * Apply saturation cascade curve to raw MR.
 *
 * Two-phase curve:
 *   Phase 1 (0-6): Linear pass-through
 *     "Absorption + Crossover" — air pockets still mostly intact, k < 0.15 W/m·K
 *   Phase 2 (6-10): Quadratic ease-out
 *     "Saturation Cascade" — remaining air pockets collapse with accelerating speed
 *     Worst damage near full saturation. Castellani & Young (2016): wet k → 0.6 W/m·K
 *   ≥ 10: Capped at 10 (fully saturated)
 *
 * v3 change vs older curve: less aggressive in 6-8 range to preserve gear differentiation
 * in the cascade zone (raw 7 → 7.75 instead of 9.1).
 *
 * Formula (Phase 2): 6.0 + 4.0 × (1 - (1 - frac)²) where frac = (raw - 6) / 4
 *
 * LC5 risk_functions.js lines 839-845.
 *
 * @param rawMR raw moisture risk score
 * @returns transformed MR with saturation cascade applied
 */
export function applySaturationCascade(rawMR: number): number {
  if (rawMR <= 6.0) return rawMR;       // Linear through Absorption + Crossover
  if (rawMR >= 10.0) return 10.0;       // Fully saturated — cap at max
  const ex = rawMR - 6.0;               // 0 to 4 range
  const frac = ex / 4.0;                // 0 to 1 normalized
  return 6.0 + 4.0 * (1 - Math.pow(1 - frac, 2));  // Quadratic ease-out
}
