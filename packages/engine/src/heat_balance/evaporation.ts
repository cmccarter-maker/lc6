// Evaporation primitives — computeEmax, computeSweatRate, getDrainRate, hygroAbsorption.
// All ported verbatim from LC5 risk_functions.js (locked state, April 2026 audit).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment + hand-computed verification.

import { satVaporPressure } from './vpd.js';
import { L_V_J_PER_G, BASELINE_IM, C_HYGRO, DEFAULT_REGAIN_POLYESTER, MAGNUS_A, MAGNUS_B, MAGNUS_E0_HPA } from './constants.js';

/**
 * Result of computeEmax — full set of intermediates for transparency.
 */
export interface ComputeEmaxResult {
  eMax: number;       // Maximum evaporative heat loss (W)
  Recl: number;       // Clothing evaporative resistance (m²·kPa/W)
  Rea: number;        // Boundary layer evaporative resistance (m²·kPa/W)
  Ret: number;        // Total evaporative resistance (m²·kPa/W)
  pSkin: number;      // Vapor pressure at skin (hPa)
  pAmb: number;       // Vapor pressure ambient (hPa)
  vpdKpa: number;     // Vapor pressure deficit (kPa)
  hc: number;         // Convective heat transfer coefficient (W/(m²·K))
  he: number;         // Evaporative heat transfer coefficient (W/(m²·kPa))
  fcl: number;        // Clothing area factor (dimensionless)
}

/**
 * Maximum evaporative heat loss (E_max) in watts.
 *
 * Per ISO 7933:2023 §6.1.10 (Predicted Heat Strain model):
 *   - Total evaporative resistance R_e,t = R_e,cl + R_e,a
 *   - Clothing as vapor barrier: R_e,cl = I_cl / (im × LR × f_cl)  [Havenith 2000]
 *   - Boundary layer:           R_e,a = 1 / (f_cl × h_e)
 *   - E_max = VPD × BSA / R_e,t
 *
 * Cited primitives:
 *   - Magnus formula vapor pressure (Alduchov & Eskridge 1996)
 *   - h_c forced convection (ISO 7730)
 *   - Lewis relation he = 16.5 × hc (Gagge & Gonzalez 1996)
 *   - Clothing area factor fcl = 1.0 + 0.31 × CLO (McCullough & Jones 1984)
 *   - Icl = CLO × 0.155 m²·K/W (ISO 9920)
 *
 * LC5 risk_functions.js lines 313-334.
 *
 * @param tSkinC skin temperature (°C)
 * @param tAmbC ambient temperature (°C); clamped to ≥ -45°C internally
 * @param rh relative humidity (0-100)
 * @param vAir air velocity (m/s); minimum 0.5 (natural convection floor)
 * @param imEnsemble ensemble Woodcock im
 * @param clo ensemble CLO
 * @param bsa body surface area (m²)
 */
export function computeEmax(
  tSkinC: number,
  tAmbC: number,
  rh: number,
  vAir: number,
  imEnsemble: number,
  clo: number,
  bsa: number,
): ComputeEmaxResult {
  // Vapor pressures (Magnus formula, hPa)
  const pSkin = MAGNUS_E0_HPA * Math.exp(MAGNUS_A * tSkinC / (tSkinC + MAGNUS_B));
  const tAmbClamped = Math.max(-45, tAmbC);
  const pAmb = (rh / 100) * MAGNUS_E0_HPA * Math.exp(MAGNUS_A * tAmbClamped / (tAmbClamped + MAGNUS_B));
  const vpdKpa = (pSkin - pAmb) / 10; // hPa to kPa

  // Convective & evaporative coefficients
  const hc = 8.3 * Math.sqrt(Math.max(vAir, 0.5)); // ISO 7730 forced convection
  const he = 16.5 * hc; // Lewis relation (Gagge & Gonzalez 1996)
  const fcl = 1.0 + 0.31 * clo; // clothing area factor (McCullough & Jones 1984)

  // E_max — ISO 7933:2023 §6.1.10
  const Icl = clo * 0.155; // clothing thermal resistance (m²·K/W) — ISO 9920
  const Recl = imEnsemble > 0 ? Icl / (imEnsemble * 16.5 * fcl) : 9999;
  const Rea = 1 / (fcl * he);
  const Ret = Recl + Rea;
  const eMax = Math.max(0, vpdKpa * bsa / Ret);

  return { eMax, Recl, Rea, Ret, pSkin, pAmb, vpdKpa, hc, he, fcl };
}

/**
 * Sweat rate regime — compensable vs uncompensable per ISO 7933 §5.6.
 */
export type SweatRegime = 'cold' | 'compensable' | 'uncompensable';

export interface ComputeSweatRateResult {
  sweatGPerHr: number;  // Sweat rate produced (g/hr)
  evapGPerHr: number;   // Sweat that actually evaporates (g/hr)
  accumGPerHr: number;  // Sweat that accumulates (g/hr) — uncompensable only
  wReq: number;         // Required wettedness E_req/E_max
  qEvapW: number;       // Actual evaporative heat removal (W)
  regime: SweatRegime;
}

/**
 * Coupled sweat rate from Gagge two-node model (PHY-046, ISO 7933 §5.6).
 *
 * w_req = E_req / E_max determines regime:
 *   - w_req ≤ 0:   cold regime, no sweating
 *   - w_req ≤ 1:   compensable, all sweat evaporates
 *   - w_req > 1:   uncompensable, excess accumulates as trapped moisture
 *
 * LC5 risk_functions.js lines 338-355.
 *
 * @param eReq required evaporative heat loss (W)
 * @param eMax maximum possible evaporative heat loss (W) from computeEmax
 */
export function computeSweatRate(eReq: number, eMax: number): ComputeSweatRateResult {
  if (eReq <= 0) {
    return { sweatGPerHr: 0, evapGPerHr: 0, accumGPerHr: 0, wReq: 0, qEvapW: 0, regime: 'cold' };
  }
  const wReq = eMax > 0 ? eReq / eMax : 999;
  if (wReq <= 1.0) {
    // Compensable
    const sweat = (eReq / L_V_J_PER_G) * 3600; // g/hr
    return {
      sweatGPerHr: sweat,
      evapGPerHr: sweat,
      accumGPerHr: 0,
      wReq,
      qEvapW: eReq,
      regime: 'compensable',
    };
  } else {
    // Uncompensable
    const sweatU = (eReq / L_V_J_PER_G) * 3600;
    const evapU = (eMax / L_V_J_PER_G) * 3600;
    return {
      sweatGPerHr: sweatU,
      evapGPerHr: evapU,
      accumGPerHr: sweatU - evapU,
      wReq,
      qEvapW: eMax,
      regime: 'uncompensable',
    };
  }
}

/**
 * Surface-temperature evaporation drain rate (PHY-047, Yoo & Kim 2008 / Gagge / ISO 7730).
 *
 * Returns ABSOLUTE rate in g/hr (not a fraction). Caller converts to per-cycle drain.
 * Evaporation from clothing OUTER surface to ambient air, driven by surface VPD.
 *
 * Same resistance form as computeEmax — clothing is a vapor barrier, not a multiplier.
 *
 * Cited primitives: Magnus (Alduchov 1996), h_c (ISO 7730), Lewis (Gagge 1996),
 * f_cl (McCullough 1984), R_clo (ISO 9920), L_v (CRC Handbook).
 *
 * LC5 risk_functions.js lines 2057-2082.
 *
 * @param tempF ambient temperature (°F)
 * @param humidity relative humidity 0-100
 * @param windMph ambient wind speed (mph)
 * @param imEnsemble ensemble Woodcock im
 * @param clo ensemble CLO; defaults to 1.5
 * @param bsa body surface area (m²); defaults to 2.13
 * @returns drain rate in g/hr (no floor — 0 at 100% RH)
 */
export function getDrainRate(
  tempF: number,
  humidity: number,
  windMph: number,
  imEnsemble: number,
  clo: number,
  bsa: number,
): number {
  // Clothing surface temperature (ISO 7730 thermal node model)
  const tAmbC = (tempF - 32) * 5 / 9;
  const tSkinC = 30; // torso skin temp under insulation (Gagge two-node, insulated)
  const vAir = Math.max((windMph ?? 0) * 0.447, 0.5); // m/s, 0.5 natural convection floor (ISO 7730 §C.2)
  const hc = 8.3 * Math.sqrt(vAir);
  const Rclo = (clo ?? 1.5) * 0.155;
  const Rair = 1.0 / hc;
  const tSurfC = tAmbC + (tSkinC - tAmbC) * (Rair / (Rclo + Rair));

  // Vapor pressures (Magnus formula)
  const pSurf = MAGNUS_E0_HPA * Math.exp(MAGNUS_A * tSurfC / (tSurfC + MAGNUS_B));
  const pAmb = (humidity / 100) * MAGNUS_E0_HPA * Math.exp(
    MAGNUS_A * Math.max(-45, tAmbC) / (Math.max(-45, tAmbC) + MAGNUS_B),
  );
  const vpdKpa = Math.max(0, (pSurf - pAmb) / 10);

  // Evaporative transfer coefficient (Lewis relation, Gagge & Gonzalez 1996)
  const he = 16.5 * hc;
  const fcl = 1.0 + 0.31 * (clo ?? 1.5);
  const bodyArea = bsa ?? 2.13;

  // Drain rate: evaporation from clothing surface (ISO 7933 resistance form)
  const Icl = (clo ?? 1.5) * 0.155;
  const Recl = imEnsemble > 0 ? Icl / ((imEnsemble ?? 0.089) * 16.5 * fcl) : 9999;
  const Rea = 1 / (fcl * he);
  const Ret = Recl + Rea;
  const drainW = vpdKpa * bodyArea / Ret;

  return Math.max(0, (drainW / L_V_J_PER_G) * 3600);
}

/**
 * Hygroscopic absorption — ambient moisture entering fabric via vapor pressure gradient.
 * Per PHY-032: Clausius-Clapeyron actual vapor pressure × Woodcock im × fiber regain (ASTM D1909).
 *
 * Returns absorption in liters per cycle.
 *
 * LC5 risk_functions.js lines 2085-2092.
 *
 * @param tempF ambient temperature (°F)
 * @param humidity relative humidity 0-100
 * @param ensembleIm ensemble Woodcock im; defaults to BASELINE_IM
 * @param regainCoeff fiber regain coefficient; defaults to polyester (DEFAULT_REGAIN_POLYESTER)
 */
export function hygroAbsorption(
  tempF: number,
  humidity: number,
  ensembleIm?: number,
  regainCoeff?: number,
): number {
  const tC = (tempF - 32) * 5 / 9;
  const eSat = 0.6108 * Math.exp(MAGNUS_A * tC / (tC + MAGNUS_B));
  const eActual = eSat * (humidity / 100);
  const im = ensembleIm ?? BASELINE_IM;
  const regain = regainCoeff ?? DEFAULT_REGAIN_POLYESTER;
  return C_HYGRO * eActual * im * regain;
}
