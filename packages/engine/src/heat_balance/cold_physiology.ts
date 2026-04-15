// Cold-side physiological responses: CIVD vasoconstriction, shivering, HLR scoring.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * CIVD (Cold-Induced Vasodilation) protection factor (Flouris & Cheung 2008).
 *
 * Returns 0.0 (fully protected — CIVD active in extremities) to 1.0 (CIVD abandoned).
 * Body sacrifices peripheral perfusion to defend core when core temp drops.
 *
 * Piecewise:
 *   ≥ 37.5°C → 0.0 (no risk, full peripheral perfusion)
 *   37.0-37.5 → linear ramp 0.0 → 0.3
 *   36.5-37.0 → linear ramp 0.3 → 0.7
 *   36.0-36.5 → linear ramp 0.7 → 1.0
 *   < 36.0   → 1.0 (CIVD abandoned)
 *
 * LC5 risk_functions.js lines 152-160.
 *
 * @param coreTempC core body temperature in °C
 */
export function civdProtectionFactor(coreTempC: number): number {
  // 0.0 = fully protected (CIVD active), 1.0 = abandoned (CIVD absent)
  if (coreTempC >= 37.5) return 0.0;
  if (coreTempC >= 37.0) return (37.5 - coreTempC) / 0.5 * 0.3;
  if (coreTempC >= 36.5) return 0.3 + (37.0 - coreTempC) / 0.5 * 0.4;
  if (coreTempC >= 36.0) return 0.7 + (36.5 - coreTempC) / 0.5 * 0.3;
  return 1.0;
}

/**
 * Shivering thermogenesis boost in METs (Young et al. 1986).
 *
 * Cold stress (T_amb < 10°C) is mitigated by CLO insulation and body fat.
 * Shivering activates when current activity MET is below the cold-stress crossover.
 *
 * Formulas:
 *   coldStress = max(0, (10 - T_amb) / 30)
 *   protection = CLO × 0.3 + (BF/100) × 0.5
 *   net = max(0, coldStress - protection)
 *   crossover = 2 + net × 4
 *   if MET ≥ crossover: 0 (no shivering needed)
 *   else: min(2.5, (crossover - MET)/crossover × 2.5 × net)
 *
 * Capped at 2.5 METs (Hayward et al. 1975 maximum sustainable shivering).
 *
 * LC5 risk_functions.js lines 181-190.
 *
 * @param TambC ambient temperature (°C)
 * @param METcurrent current metabolic rate (MET)
 * @param CLOtotal total clothing insulation (CLO)
 * @param bodyFatPct body fat percentage (0-100)
 */
export function shiveringBoost(
  TambC: number,
  METcurrent: number,
  CLOtotal: number,
  bodyFatPct: number,
): number {
  const coldStress = Math.max(0, (10 - TambC) / 30);
  const protection = CLOtotal * 0.3 + (bodyFatPct / 100) * 0.5;
  const net = Math.max(0, coldStress - protection);
  const crossover = 2 + net * 4;
  if (METcurrent >= crossover) return 0;
  return Math.max(0, Math.min(2.5, (crossover - METcurrent) / crossover * 2.5 * net));
}

/**
 * Heat-Loss Risk score (HLR, 0-10) from energy deficit + core temp + ambient + wetness.
 *
 * Composite multiplier (independent physical mechanisms — no double-dipping):
 *   base × coreAmp × coldSev × wetness, capped at 10.
 *
 * Components:
 *   - base: from heat balance deficit (negative deficit → surplus → low base)
 *   - coreAmp: 1.0 + civdDanger (1.0 to 2.0; rising as core temp drops)
 *   - coldSev: ambient severity (1.3 below -10°C; ramped to 0.8 above 5°C)
 *   - wetness: 1.0 + satFrac × 0.5 (saturated layers amplify HLR)
 *
 * LC5 risk_functions.js lines 162-179.
 *
 * @param deficitW heat balance residual in W (negative = surplus, positive = deficit)
 * @param coreTempC core body temperature (°C)
 * @param TambC ambient temperature (°C)
 * @param satFrac layer saturation fraction (0-1)
 */
export function computeHLR(
  deficitW: number,
  coreTempC: number,
  TambC: number,
  satFrac: number,
): number {
  let base: number;
  if (deficitW < 0) {
    base = 1.5 + Math.abs(deficitW) / 60;
  } else {
    base = Math.max(0.5, 2.0 - deficitW / 100);
  }
  const civdDanger = civdProtectionFactor(coreTempC);
  const coreAmp = 1.0 + civdDanger; // 1.0 → 2.0
  let coldSev: number;
  if (TambC < -10) coldSev = 1.3;
  else if (TambC < 0) coldSev = 1.0 + (-TambC) / 50;
  else if (TambC < 5) coldSev = 1.0;
  else coldSev = Math.max(0.8, 1.0 - (TambC - 5) / 50);
  const wetness = 1.0 + satFrac * 0.5;
  return Math.min(10, base * coreAmp * coldSev * wetness);
}
