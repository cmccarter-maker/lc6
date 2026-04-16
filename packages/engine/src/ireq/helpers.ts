// Shared thermodynamic helpers for ISO 11079 IREQ model.
// All from d'Ambrosio Alfano et al. 2025, Appendix B, MATLAB verbatim.
// Per Cardinal Rule #8: no freelance improvements. Pure transcription.

/** Saturated water vapor pressure at skin temperature (kPa). */
export function psks_kPa(tsk: number): number {
  return 0.1333 * Math.exp(18.6686 - 4030.183 / (tsk + 235));
}

/** Ambient vapour partial pressure (kPa), split at freezing.
 *  ta ≥ 0: Antoine equation; ta < 0: Magnus-over-ice. */
export function pa_kPa(ta: number, RH: number): number {
  if (ta >= 0) {
    return (RH / 100) * 0.1333 * Math.exp(18.6686 - 4030.183 / (ta + 235));
  } else {
    return (RH / 100) * 0.6105 * Math.exp(21.875 * ta / (265.5 + ta));
  }
}

/** Expired air temperature (°C). */
export function tex_C(ta: number): number { return 29 + 0.2 * ta; }

/** Saturated vapour pressure at expired air temperature (kPa). */
export function pex_kPa(ta: number): number {
  const tex = tex_C(ta);
  return 0.1333 * Math.exp(18.6686 - 4030.183 / (tex + 235));
}

/** Convert m²K/W to clo (1 clo = 0.155 m²K/W). */
export function m2KW_to_clo(x: number): number { return x / 0.155; }

/** Convert clo to m²K/W. */
export function clo_to_m2KW(x: number): number { return x * 0.155; }
