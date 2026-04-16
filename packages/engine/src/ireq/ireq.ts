// IREQ_neu and IREQ_min — ISO 11079 Required Clothing Insulation.
// Verbatim TypeScript port of d'Ambrosio 2025 Appendix B.1 (IREQ_neu) and B.2 (IREQ_min).
// Per Cardinal Rule #8: no freelance improvements. Pure transcription.
//
// Block 1 validated vs Angelova 2017 Table 2 Case 3 (M=134, va=3):
// 20/20 PASS, max Δ = 0.090 clo, gate ±0.10 clo.

import { psks_kPa, pa_kPa, tex_C, pex_kPa } from './helpers.js';

/**
 * IREQ_neu — Low strain criterion ("neutral" / thermal comfort).
 * Returns required clothing insulation in m²K/W.
 *
 * @param ta air temperature, °C
 * @param tr mean radiant temperature, °C
 * @param va air velocity, m/s
 * @param RH relative humidity, %
 * @param M metabolic rate, W/m²
 * @param W effective mechanical power, W/m²
 * @param im moisture permeability index (default 0.38)
 */
export function IREQ_neu(ta: number, tr: number, va: number, RH: number, M: number, W: number, im: number): number {
  let walk = 0.0052 * (M - 58);
  if (walk >= 0.7) walk = 0.7;

  const tsk = 35.7 - 0.0285 * M;
  const wetness = 0.001 * M;

  const tex = tex_C(ta);
  const pex = pex_kPa(ta);
  const psks = psks_kPa(tsk);
  const pa = pa_kPa(ta, RH);

  const Iar = 0.092 * Math.exp(-0.15 * va - 0.22 * walk) - 0.0045;

  let IREQ = 0.5;
  const aradu = 0.77;
  let factor = 0.5;
  let balance = 1;

  let safety = 0;
  while (Math.abs(balance) > 0.01 && safety < 10000) {
    safety++;
    const fcl = 1 + 1.97 * IREQ;
    const ReT = (0.06 / im) * (Iar / fcl + IREQ);
    const E = wetness * (psks - pa) / ReT;
    const Hres = 0.0173 * M * (pex - pa) + 0.0014 * M * (tex - ta);
    const tcl = tsk - IREQ * (M - W - E - Hres);
    const hr = 0.0000000567 * 0.97 * aradu *
               (Math.pow(273 + tcl, 4) - Math.pow(273 + tr, 4)) / (tcl - tr);
    const R = fcl * hr * (tcl - tr);
    const hc = 1 / Iar - hr;
    const C = fcl * hc * (tcl - ta);
    balance = M - W - E - Hres - R - C;
    if (balance > 0) {
      IREQ = IREQ - factor;
      factor = factor / 2;
    } else {
      IREQ = IREQ + factor;
    }
  }

  // Recompute at final IREQ for clean return
  const fcl = 1 + 1.97 * IREQ;
  const ReT = (0.06 / im) * (Iar / fcl + IREQ);
  const E = wetness * (psks - pa) / ReT;
  const Hres = 0.0173 * M * (pex - pa) + 0.0014 * M * (tex - ta);
  const tcl = tsk - IREQ * (M - W - E - Hres);
  const hr = 0.0000000567 * 0.97 * aradu *
             (Math.pow(273 + tcl, 4) - Math.pow(273 + tr, 4)) / (tcl - tr);
  const R = fcl * hr * (tcl - tr);
  const hc = 1 / Iar - hr;
  const C = fcl * hc * (tcl - ta);
  return (tsk - tcl) / (R + C);
}

/**
 * IREQ_min — High strain criterion (minimum insulation).
 * Returns required clothing insulation in m²K/W.
 */
export function IREQ_min(ta: number, tr: number, va: number, RH: number, M: number, W: number, im: number): number {
  let walk = 0.0052 * (M - 58);
  if (walk >= 0.7) walk = 0.7;

  const tsk = 33.34 - 0.0354 * M;
  const wetness = 0.06;

  const tex = tex_C(ta);
  const pex = pex_kPa(ta);
  const psks = psks_kPa(tsk);
  const pa = pa_kPa(ta, RH);

  const Iar = 0.092 * Math.exp(-0.15 * va - 0.22 * walk) - 0.0045;

  let IREQ = 0.5;
  const aradu = 0.77;
  let factor = 0.5;
  let balance = 1;

  let safety = 0;
  while (Math.abs(balance) > 0.01 && safety < 10000) {
    safety++;
    const fcl = 1 + 1.97 * IREQ;
    const ReT = (0.06 / im) * (Iar / fcl + IREQ);
    const E = wetness * (psks - pa) / ReT;
    const Hres = 0.0173 * M * (pex - pa) + 0.0014 * M * (tex - ta);
    const tcl = tsk - IREQ * (M - W - E - Hres);
    const hr = 0.0000000567 * 0.97 * aradu *
               (Math.pow(273 + tcl, 4) - Math.pow(273 + tr, 4)) / (tcl - tr);
    const R = fcl * hr * (tcl - tr);
    const hc = 1 / Iar - hr;
    const C = fcl * hc * (tcl - ta);
    balance = M - W - E - Hres - R - C;
    if (balance > 0) {
      IREQ = IREQ - factor;
      factor = factor / 2;
    } else {
      IREQ = IREQ + factor;
    }
  }

  const fcl = 1 + 1.97 * IREQ;
  const ReT = (0.06 / im) * (Iar / fcl + IREQ);
  const E = wetness * (psks - pa) / ReT;
  const Hres = 0.0173 * M * (pex - pa) + 0.0014 * M * (tex - ta);
  const tcl = tsk - IREQ * (M - W - E - Hres);
  const hr = 0.0000000567 * 0.97 * aradu *
             (Math.pow(273 + tcl, 4) - Math.pow(273 + tr, 4)) / (tcl - tr);
  const R = fcl * hr * (tcl - tr);
  const hc = 1 / Iar - hr;
  const C = fcl * hc * (tcl - ta);
  return (tsk - tcl) / (R + C);
}
