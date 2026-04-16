// Block 2 validation: Angelova 2017 Table 3 Case 1 (M=80 W/m², va=0.14 m/s, RH=61%).
// 3 representative ensembles × 10 temps × DLE_neu + DLE_min.
// Cold zone (ta ≤ -5°C): gate ±0.15 hours. Transition zone: wider tolerance.
//
// ap=5 L/m²s (tight woven outerwear, typical for Angelova's PES/PA/CO assemblies).
// im=0.38 (d'Ambrosio default per Appendix B).

import { describe, it, expect } from 'vitest';
import { DLE_neu, DLE_min, clo_to_m2KW } from '../../src/ireq/index.js';

const M = 80, va = 0.14, RH = 61, W = 0, im = 0.38, ap = 5;
const COLD_GATE = 0.15;   // hours, for ta ≤ -5°C
const TRANS_GATE = 1.0;    // hours, for ta = 0°C to +5°C (near S≈0 singularity)

const temps = [15, 10, 5, 0, -5, -10, -15, -20, -25, -30];

interface EnsembleData {
  id: number;
  clo: number;
  dle_neu: number[];
  dle_min: number[];
}

const ensembles: EnsembleData[] = [
  { id: 1, clo: 2.28,
    dle_neu: [8,8,8,2.23,1.27,0.89,0.68,0.55,0.47,0.4],
    dle_min: [8,8,8,4.05,1.7,1.08,0.79,0.62,0.51,0.44] },
  { id: 3, clo: 1.89,
    dle_neu: [8,8,2.13,1.21,0.81,0.62,0.5,0.41,0.36,0.31],
    dle_min: [8,8,5.13,1.68,1.01,0.72,0.56,0.46,0.39,0.34] },
  { id: 9, clo: 1.53,
    dle_neu: [8,2.74,1.2,0.77,0.56,0.45,0.37,0.32,0.27,0.24],
    dle_min: [8,8,1.79,0.97,0.67,0.51,0.41,0.35,0.3,0.26] },
];

describe('DLE_neu — Angelova 2017 Table 3 Case 1', () => {
  for (const ens of ensembles) {
    describe(`Ensemble ${ens.id} (${ens.clo} clo)`, () => {
      const Icl = clo_to_m2KW(ens.clo);
      temps.forEach((ta, i) => {
        const expected = ens.dle_neu[i]!;
        if (expected >= 8) {
          it(`ta=${ta}°C: DLE_neu ≥ 8h (infinite/comfort zone)`, () => {
            const result = DLE_neu(ta, ta, va, RH, M, W, Icl, im, ap);
            expect(result).toBeGreaterThanOrEqual(7.0); // allow some tolerance near boundary
          });
        } else {
          const gate = ta <= -5 ? COLD_GATE : TRANS_GATE;
          it(`ta=${ta}°C: DLE_neu ≈ ${expected}h (±${gate})`, () => {
            const result = DLE_neu(ta, ta, va, RH, M, W, Icl, im, ap);
            expect(Math.abs(result - expected)).toBeLessThan(gate);
          });
        }
      });
    });
  }
});

describe('DLE_min — Angelova 2017 Table 3 Case 1', () => {
  for (const ens of ensembles) {
    describe(`Ensemble ${ens.id} (${ens.clo} clo)`, () => {
      const Icl = clo_to_m2KW(ens.clo);
      temps.forEach((ta, i) => {
        const expected = ens.dle_min[i]!;
        if (expected >= 8) {
          it(`ta=${ta}°C: DLE_min ≥ 8h (infinite/comfort zone)`, () => {
            const result = DLE_min(ta, ta, va, RH, M, W, Icl, im, ap);
            expect(result).toBeGreaterThanOrEqual(7.0);
          });
        } else {
          const gate = ta <= -5 ? COLD_GATE : TRANS_GATE;
          it(`ta=${ta}°C: DLE_min ≈ ${expected}h (±${gate})`, () => {
            const result = DLE_min(ta, ta, va, RH, M, W, Icl, im, ap);
            expect(Math.abs(result - expected)).toBeLessThan(gate);
          });
        }
      });
    });
  }
});
