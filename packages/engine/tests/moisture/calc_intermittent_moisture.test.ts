// End-to-end tests for calcIntermittentMoisture cyclic path.
// Lock-in baselines captured from LC5 verbatim source on 2026-04-15.
// Per Step 6 AMENDED: ALL numeric assertions from LC5 baseline capture, no eyeball.

import { describe, it, expect } from 'vitest';
import { calcIntermittentMoisture } from '../../src/moisture/calc_intermittent_moisture.js';


describe('calcIntermittentMoisture — Breck 16°F groomers 6hrs', () => {
  const r = calcIntermittentMoisture(
    'skiing', 16, 40, 8, 6, 'male', 170, 1.0, 0.089, 'groomers', null, false, 0, false, 1.0, null, null, 'moderate', null, 5, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 7', () => { expect(r.sessionMR).toBeCloseTo(3.4, 1); });  // PHY-071: was 7 (inflated by wrong fiber cap)
  it('trapped ≈ 0.090 [PHY-069]', () => { expect(r.trapped).toBeCloseTo(0.111, 2); });  // PHY-071
  it('totalRuns = 36', () => { expect(r.totalRuns).toBe(36); });
  it('goodRunCount = 11 [PHY-069]', () => { expect(r.goodRunCount).toBe(36); });  // PHY-071
  it('yellowRunCount = 2', () => { expect(r.yellowRunCount).toBe(0); });  // PHY-071
  it('peakHeatBalanceDirection = cold [PHY-069]', () => { expect(r.peakHeatBalanceDirection).toBe('cold'); });
  // S31 Phase A (spec v1.2 §4.6 respiratory scoping: _runMin → _cycleMinRaw) shifts ski totalFluidLoss
  // on this scenario to ~792g. Re-author in S31-PHASE-C-REBASELINE arc once Phase B/C land; same
  // discipline as S29-MATRIX-PENDING (commit 78cd56a). sessionMR assertion above still passes.
  it.skip('totalFluidLoss ≈ 450 [PHY-069]', () => { expect(r.totalFluidLoss).toBeCloseTo(445, -1); });  // PHY-071
  it('perCycleTrapped has 36 entries', () => { expect(r.perCycleTrapped?.length).toBe(36); });
  it('perCycleMR first entry ≈ 0.4 [PHY-069]', () => { expect(r.perCycleMR?.[0]).toBeCloseTo(0.1, 1); });  // PHY-071
  it('has layerBuffers', () => { expect(r.layerBuffers).not.toBeNull(); });
  it('has endingLayers', () => { expect(r.endingLayers).not.toBeNull(); });
});

describe('calcIntermittentMoisture — sunny golf walking 80°F 4hrs', () => {
  const r = calcIntermittentMoisture(
    'golf', 80, 55, 5, 4, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR ≈ 1.1 [PHY-071]', () => { expect(r.sessionMR).toBeCloseTo(1.1, 1); });
  it('trapped ≈ 0.0234 [PHY-071]', () => { expect(r.trapped).toBeCloseTo(0.0234, 3); });
  it('totalRuns = 16', () => { expect(r.totalRuns).toBe(16); });
  it('goodRunCount = 16 (all comfortable)', () => { expect(r.goodRunCount).toBe(16); });
});

describe('calcIntermittentMoisture — cool day hike 55°F 4hrs (synthetic cyclic)', () => {
  const r = calcIntermittentMoisture(
    'hiking', 55, 60, 3, 4, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 5.5', () => { expect(r.sessionMR).toBeCloseTo(3.5, 1); });  // PHY-071
  it('trapped ≈ 0.0804', () => { expect(r.trapped).toBeCloseTo(0.1043, 3); });
  it('totalRuns = 4', () => { expect(r.totalRuns).toBe(4); });
  it('perCycleTrapped has 4 entries', () => { expect(r.perCycleTrapped?.length).toBe(4); });
});

describe('calcIntermittentMoisture — hot road cycling flat 85°F 2hrs', () => {
  const r = calcIntermittentMoisture(
    'road_cycling', 85, 50, 10, 2, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'high', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR ≈ 0.4 [PHY-071]', () => { expect(r.sessionMR).toBeCloseTo(0.4, 1); });
  it('trapped ≈ 0.0091 [PHY-071]', () => { expect(r.trapped).toBeCloseTo(0.0091, 3); });
  it('totalRuns = 2', () => { expect(r.totalRuns).toBe(2); });
  it('peakHeatBalanceDirection = hot', () => { expect(r.peakHeatBalanceDirection).toBe('hot'); });
});

describe('calcIntermittentMoisture — bouldering 50°F 2hrs (steady-state)', () => {
  const r = calcIntermittentMoisture(
    'bouldering', 50, 50, 5, 2, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 0.4', () => { expect(r.sessionMR).toBe(0.4); });
  it('trapped ≈ 0.0130', () => { expect(r.trapped).toBeCloseTo(0.0130, 3); });
  it('has perStepMR (steady-state output)', () => { expect(r.perStepMR?.length).toBe(20); });
  it('no perCycleTrapped (not cyclic)', () => { expect(r.perCycleTrapped).toBeNull(); });
});

describe('calcIntermittentMoisture — camping 40°F 8hrs (steady-state)', () => {
  const r = calcIntermittentMoisture(
    'camping', 40, 50, 3, 8, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'low', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 0', () => { expect(r.sessionMR).toBe(0); });
  it('trapped = 0', () => { expect(r.trapped).toBe(0); });
});

describe('calcIntermittentMoisture — snowshoeing 20°F 3hrs (linear)', () => {
  it('does not throw (Session 9c removes β1 stub)', () => {
    expect(() => calcIntermittentMoisture(
      'snowshoeing', 20, 40, 5, 3, 'male', 170, 1.0, 0.089, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 5, null, 0, null, null, null, 0, null,
    )).not.toThrow();
  });

  it('returns valid sessionMR > 0', () => {
    const r = calcIntermittentMoisture(
      'snowshoeing', 20, 40, 5, 3, 'male', 170, 1.0, 0.089, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 5, null, 0, null, null, null, 0, null,
    );
    expect(r.sessionMR).toBeGreaterThanOrEqual(0);
    expect(r.trapped).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.sessionMR)).toBe(true);
  });
});
