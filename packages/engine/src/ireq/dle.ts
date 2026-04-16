// DLE_neu and DLE_min — ISO 11079 Duration Limited Exposure.
// Verbatim TypeScript port of d'Ambrosio 2025 Appendix B.3 (DLE_neu) and B.4 (DLE_min).
// Per Cardinal Rule #8: no freelance improvements. Pure transcription.
//
// Key differences from IREQ functions:
//   - Additional inputs: Icl (basic clothing insulation m²K/W), ap (air permeability L/m²s)
//   - Walking speed cap: 1.2 m/s (vs 0.7 for IREQ)
//   - Bisects on S (heat storage rate), not IREQ. Initial S=-40, factor=100, |balance|<0.0001
//   - Uses wind correction: Iclr via IT,r formula (d'Ambrosio Eq. 8)
//   - DLE = -Qlim/S = -40/S (hours). S≥0 → infinite (no cooling).
//
// Block 2 validated vs Angelova 2017 Table 3 Case 1 (M=80, va=0.14):
// Cold zone (ta ≤ -5°C): DLE_neu max Δ=0.020h, DLE_min max Δ=0.137h. PASS.

import { psks_kPa, pa_kPa, tex_C, pex_kPa } from './helpers.js';

/** Qlim = 40 W·h/m² = 144 kJ/m² (ISO 11079 Table 1). */
const Q_LIM = 40;

/** Sentinel for "no cooling" (S ≥ 0 → DLE is effectively infinite). */
const DLE_INFINITE = 9999999;

/**
 * DLE_neu — Duration limited exposure, low strain criterion (neutral).
 * Returns exposure limit in hours.
 *
 * @param ta air temperature, °C
 * @param tr mean radiant temperature, °C
 * @param va air velocity, m/s
 * @param RH relative humidity, %
 * @param M metabolic rate, W/m²
 * @param W effective mechanical power, W/m²
 * @param Icl basic clothing insulation, m²K/W
 * @param im moisture permeability index (default 0.38)
 * @param ap air permeability of outer fabric, L/m²s
 */
export function DLE_neu(
  ta: number, tr: number, va: number, RH: number,
  M: number, W: number, Icl: number, im: number, ap: number,
): number {
  let walk = 0.0052 * (M - 58);
  if (walk >= 1.2) walk = 1.2;  // DLE cap is 1.2, not 0.7

  const tsk = 35.7 - 0.0285 * M;
  const wetness = 0.001 * M;

  const tex = tex_C(ta);
  const pex = pex_kPa(ta);
  const psks = psks_kPa(tsk);
  const pa = pa_kPa(ta, RH);

  const Iar = 0.092 * Math.exp(-0.15 * va - 0.22 * walk) - 0.0045;

  let S = -40;
  const aradu = 0.77;
  let factor = 100;
  let Iclr = Icl;
  let balance = 1;

  let safety = 0;
  while (Math.abs(balance) > 0.0001 && safety < 100000) {
    safety++;
    const fcl = 1 + 1.97 * Iclr;
    // Wind correction: resultant clothing insulation (d'Ambrosio Eq. 8)
    Iclr = ((Icl + 0.085 / fcl) * (0.54 * Math.exp(0.075 * Math.log(ap) - 0.15 * va - 0.22 * walk) - 0.06 * Math.log(ap) + 0.5)) - Iar / fcl;
    const ReT = (0.06 / im) * (Iar / fcl + Iclr);
    const E = wetness * (psks - pa) / ReT;
    const Hres = 0.0173 * M * (pex - pa) + 0.0014 * M * (tex - ta);
    const tcl = tsk - Iclr * (M - W - E - Hres - S);
    const hr = 0.0000000567 * 0.97 * aradu *
               (Math.pow(273 + tcl, 4) - Math.pow(273 + tr, 4)) / (tcl - tr);
    const R = fcl * hr * (tcl - tr);
    const hc = 1 / Iar - hr;
    const C = fcl * hc * (tcl - ta);
    balance = M - W - E - Hres - R - C - S;
    if (balance > 0) {
      S = S + factor;
      factor = factor / 2;
    } else {
      S = S - factor;
    }
  }

  if (S < 0) return -Q_LIM / S;
  return DLE_INFINITE;
}

/**
 * DLE_min — Duration limited exposure, high strain criterion (minimum).
 * Returns exposure limit in hours.
 */
export function DLE_min(
  ta: number, tr: number, va: number, RH: number,
  M: number, W: number, Icl: number, im: number, ap: number,
): number {
  let walk = 0.0052 * (M - 58);
  if (walk >= 1.2) walk = 1.2;

  const tsk = 33.34 - 0.0354 * M;
  const wetness = 0.06;

  const tex = tex_C(ta);
  const pex = pex_kPa(ta);
  const psks = psks_kPa(tsk);
  const pa = pa_kPa(ta, RH);

  const Iar = 0.092 * Math.exp(-0.15 * va - 0.22 * walk) - 0.0045;

  let S = -40;
  const aradu = 0.77;
  let factor = 100;
  let Iclr = Icl;
  let balance = 1;

  let safety = 0;
  while (Math.abs(balance) > 0.0001 && safety < 100000) {
    safety++;
    const fcl = 1 + 1.97 * Iclr;
    Iclr = ((Icl + 0.085 / fcl) * (0.54 * Math.exp(0.075 * Math.log(ap) - 0.15 * va - 0.22 * walk) - 0.06 * Math.log(ap) + 0.5)) - Iar / fcl;
    const ReT = (0.06 / im) * (Iar / fcl + Iclr);
    const E = wetness * (psks - pa) / ReT;
    const Hres = 0.0173 * M * (pex - pa) + 0.0014 * M * (tex - ta);
    const tcl = tsk - Iclr * (M - W - E - Hres - S);
    const hr = 0.0000000567 * 0.97 * aradu *
               (Math.pow(273 + tcl, 4) - Math.pow(273 + tr, 4)) / (tcl - tr);
    const R = fcl * hr * (tcl - tr);
    const hc = 1 / Iar - hr;
    const C = fcl * hc * (tcl - ta);
    balance = M - W - E - Hres - R - C - S;
    if (balance > 0) {
      S = S + factor;
      factor = factor / 2;
    } else {
      S = S - factor;
    }
  }

  if (S < 0) return -Q_LIM / S;
  return DLE_INFINITE;
}
