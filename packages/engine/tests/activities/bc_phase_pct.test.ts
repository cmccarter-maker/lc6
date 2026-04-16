import { describe, it, expect } from 'vitest';
import { calcBCPhasePercentages } from '../../src/activities/profiles.js';

describe('calcBCPhasePercentages', () => {
  it('3000ft gain, 4000 ft/hr descent → skin=0.6857 trans=0.0571 desc=0.2571', () => {
    const r = calcBCPhasePercentages(3000, 4000)!;
    expect(r.skinning).toBeCloseTo(0.6857, 3);
    expect(r.transition).toBeCloseTo(0.0571, 3);
    expect(r.descent).toBeCloseTo(0.2571, 3);
  });
  it('5000ft gain → more skinning', () => {
    const r = calcBCPhasePercentages(5000, 4000)!;
    expect(r.skinning).toBeCloseTo(0.7018, 3);
  });
  it('null/0 gain → null', () => {
    expect(calcBCPhasePercentages(0, 4000)).toBeNull();
    expect(calcBCPhasePercentages(null, 4000)).toBeNull();
  });
  it('percentages sum to 1.0', () => {
    const r = calcBCPhasePercentages(3000, 4000)!;
    expect(r.skinning + r.transition + r.descent).toBeCloseTo(1.0, 6);
  });
});
