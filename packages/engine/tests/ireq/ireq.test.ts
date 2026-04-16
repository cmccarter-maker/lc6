// Block 1 validation: Angelova 2017 Table 2 Case 3 (M=134 W/m², va=3 m/s, RH=61%).
// 20 data points (10 temps × IREQ_neu + IREQ_min). Gate: ±0.10 clo.
// Angelova RA et al. FIBRES & TEXTILES in Eastern Europe 2017; 25, 1(121): 95-101.

import { describe, it, expect } from 'vitest';
import { IREQ_neu, IREQ_min, m2KW_to_clo } from '../../src/ireq/index.js';

const M = 134, va = 3, RH = 61, W = 0, im = 0.38;
const GATE = 0.10; // clo

const temps =     [15,   10,   5,    0,    -5,   -10,  -15,  -20,  -25,  -30];
const exp_neu =   [0.85, 1.16, 1.47, 1.77, 2.07, 2.36, 2.66, 2.95, 3.24, 3.53];
const exp_min =   [0.54, 0.85, 1.15, 1.45, 1.75, 2.04, 2.33, 2.63, 2.92, 3.21];

describe('IREQ_neu — Angelova 2017 Table 2 Case 3', () => {
  temps.forEach((ta, i) => {
    it(`ta=${ta}°C: IREQ_neu ≈ ${exp_neu[i]} clo (±${GATE})`, () => {
      const result_clo = m2KW_to_clo(IREQ_neu(ta, ta, va, RH, M, W, im));
      expect(Math.abs(result_clo - exp_neu[i]!)).toBeLessThan(GATE);
    });
  });
});

describe('IREQ_min — Angelova 2017 Table 2 Case 3', () => {
  temps.forEach((ta, i) => {
    it(`ta=${ta}°C: IREQ_min ≈ ${exp_min[i]} clo (±${GATE})`, () => {
      const result_clo = m2KW_to_clo(IREQ_min(ta, ta, va, RH, M, W, im));
      expect(Math.abs(result_clo - exp_min[i]!)).toBeLessThan(GATE);
    });
  });
});
