// End-to-end tests for calcIntermittentMoisture cyclic path.
// Lock-in baselines captured from LC5 verbatim source on 2026-04-15.
// Per Step 6 AMENDED: ALL numeric assertions from LC5 baseline capture, no eyeball.

import { describe, it, expect } from 'vitest';
import { calcIntermittentMoisture } from '../../src/moisture/calc_intermittent_moisture.js';

describe('calcIntermittentMoisture — β1 stubs for non-cyclic paths', () => {
  it('throws for steady-state activity (bouldering)', () => {
    expect(() => calcIntermittentMoisture(
      'bouldering', 50, 50, 5, 2, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 3, null, 0, null, null, null, 0, null,
    )).toThrow('Session 9c TODO: steady-state path not yet ported');
  });

  it('throws for linear activity (snowshoeing)', () => {
    expect(() => calcIntermittentMoisture(
      'snowshoeing', 20, 40, 5, 3, 'male', 170, 1.0, 0.089, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 3, null, 0, null, null, null, 0, null,
    )).toThrow('Session 9c TODO: linear path not yet ported');
  });
});

describe('calcIntermittentMoisture — Breck 16°F groomers 6hrs', () => {
  const r = calcIntermittentMoisture(
    'skiing', 16, 40, 8, 6, 'male', 170, 1.0, 0.089, 'groomers', null, false, 0, false, 1.0, null, null, 'moderate', null, 5, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 7', () => { expect(r.sessionMR).toBe(7); });
  it('trapped ≈ 0.0934', () => { expect(r.trapped).toBeCloseTo(0.0934, 3); });
  it('totalRuns = 36', () => { expect(r.totalRuns).toBe(36); });
  it('goodRunCount = 9', () => { expect(r.goodRunCount).toBe(9); });
  it('yellowRunCount = 2', () => { expect(r.yellowRunCount).toBe(2); });
  it('peakHeatBalanceDirection = hot', () => { expect(r.peakHeatBalanceDirection).toBe('hot'); });
  it('totalFluidLoss ≈ 508', () => { expect(r.totalFluidLoss).toBeCloseTo(508, -1); });
  it('perCycleTrapped has 36 entries', () => { expect(r.perCycleTrapped?.length).toBe(36); });
  it('perCycleMR first entry ≈ 0.5', () => { expect(r.perCycleMR?.[0]).toBeCloseTo(0.5, 1); });
  it('has layerBuffers', () => { expect(r.layerBuffers).not.toBeNull(); });
  it('has endingLayers', () => { expect(r.endingLayers).not.toBeNull(); });
});

describe('calcIntermittentMoisture — sunny golf walking 80°F 4hrs', () => {
  const r = calcIntermittentMoisture(
    'golf', 80, 55, 5, 4, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 1.8', () => { expect(r.sessionMR).toBe(1.5); });
  it('trapped ≈ 0.0177', () => { expect(r.trapped).toBeCloseTo(0.01452, 3); });
  it('totalRuns = 16', () => { expect(r.totalRuns).toBe(16); });
  it('goodRunCount = 16 (all comfortable)', () => { expect(r.goodRunCount).toBe(16); });
});

describe('calcIntermittentMoisture — cool day hike 55°F 4hrs (synthetic cyclic)', () => {
  const r = calcIntermittentMoisture(
    'hiking', 55, 60, 3, 4, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'moderate', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 5.5', () => { expect(r.sessionMR).toBe(5.5); });
  it('trapped ≈ 0.0804', () => { expect(r.trapped).toBeCloseTo(0.0804, 3); });
  it('totalRuns = 4', () => { expect(r.totalRuns).toBe(4); });
  it('perCycleTrapped has 4 entries', () => { expect(r.perCycleTrapped?.length).toBe(4); });
});

describe('calcIntermittentMoisture — hot road cycling flat 85°F 2hrs', () => {
  const r = calcIntermittentMoisture(
    'road_cycling', 85, 50, 10, 2, 'male', 170, 1.0, 0.15, null, null, false, 0, false, 1.0, null, null, 'high', null, 3, null, 0, null, null, null, 0, null,
  );

  it('sessionMR = 3.6', () => { expect(r.sessionMR).toBe(1.5); });
  it('trapped ≈ 0.0324', () => { expect(r.trapped).toBeCloseTo(0.01019, 3); });
  it('totalRuns = 2', () => { expect(r.totalRuns).toBe(2); });
  it('peakHeatBalanceDirection = hot', () => { expect(r.peakHeatBalanceDirection).toBe('hot'); });
});
