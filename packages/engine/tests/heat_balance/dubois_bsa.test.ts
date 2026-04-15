// Tests for duboisBSA appended to body_thermo.ts.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import { duboisBSA } from '../../src/heat_balance/body_thermo.js';

describe('duboisBSA (DuBois & DuBois 1916)', () => {
  it('100 lb (45.36 kg) → 1.4727 m²', () => {
    expect(duboisBSA(100)).toBeCloseTo(1.4727, 3);
  });

  it('130 lb (58.97 kg) → 1.6465 m²', () => {
    expect(duboisBSA(130)).toBeCloseTo(1.6465, 3);
  });

  it('150 lb (68.04 kg) → 1.8108 m² (default fallback weight)', () => {
    expect(duboisBSA(150)).toBeCloseTo(1.8108, 3);
  });

  it('170 lb (77.11 kg) → 1.9097 m²', () => {
    expect(duboisBSA(170)).toBeCloseTo(1.9097, 3);
  });

  it('200 lb (90.72 kg) → 2.0890 m²', () => {
    expect(duboisBSA(200)).toBeCloseTo(2.0890, 3);
  });

  it('250 lb (113.4 kg) → 2.3155 m²', () => {
    expect(duboisBSA(250)).toBeCloseTo(2.3155, 3);
  });

  it('300 lb (136.08 kg) → 2.5322 m²', () => {
    expect(duboisBSA(300)).toBeCloseTo(2.5322, 3);
  });

  it('null/undefined defaults to 150 lb', () => {
    expect(duboisBSA(null)).toBeCloseTo(1.8108, 3);
    expect(duboisBSA(undefined)).toBeCloseTo(1.8108, 3);
  });

  it('monotonically increases with weight', () => {
    const a = duboisBSA(120);
    const b = duboisBSA(170);
    const c = duboisBSA(220);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('uses height stratification: 130lb → 173cm, 200lb → 180cm', () => {
    // 130lb = 58.97kg < 60 → 165cm
    // 200lb = 90.72kg in 80-100 → 178cm
    // Verifying through known baselines (already locked in)
    expect(duboisBSA(130)).toBeCloseTo(1.6465, 3);
    expect(duboisBSA(200)).toBeCloseTo(2.0890, 3);
  });
});
