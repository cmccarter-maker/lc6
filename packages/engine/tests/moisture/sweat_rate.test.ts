import { describe, it, expect } from 'vitest';
import { sweatRate } from '../../src/moisture/sweat_rate.js';

describe('sweatRate (standalone, steady-state path)', () => {
  it('skiing moderate 16F → 112.56 g/hr', () => {
    expect(sweatRate('moderate', 16, 40, 'male', 170, 'skiing', null, 1.0, false, null, 'groomers', 1.0, 0, null)).toBeCloseTo(112.56, 0);
  });
  it('hiking moderate 55F → 275.62 g/hr', () => {
    expect(sweatRate('moderate', 55, 60, 'male', 170, 'hiking', null, 1.0, false, null, null, 1.0, 0, null)).toBeCloseTo(275.62, 0);
  });
  it('bouldering moderate 50F → 87.25 g/hr', () => {
    expect(sweatRate('moderate', 50, 50, 'male', 170, 'bouldering', null, 1.0, false, null, null, 1.0, 0, null)).toBeCloseTo(87.25, 0);
  });
  it('camping low 40F → 15 g/hr (insensible floor)', () => {
    expect(sweatRate('low', 40, 50, 'male', 170, 'camping', null, 1.0, false, null, null, 1.0, 0, null)).toBe(15);
  });
});
