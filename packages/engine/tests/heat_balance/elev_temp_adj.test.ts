import { describe, it, expect } from 'vitest';
import { elevTempAdj } from '../../src/heat_balance/altitude.js';

describe('elevTempAdj (lapse rate)', () => {
  it('0 ft gain → 0°F adjustment', () => { expect(elevTempAdj(0)).toBe(-0); });
  it('1000 ft gain → -3.5°F', () => { expect(elevTempAdj(1000)).toBeCloseTo(-3.5, 4); });
  it('3000 ft gain → -10.5°F', () => { expect(elevTempAdj(3000)).toBeCloseTo(-10.5, 4); });
  it('caps at -18°F for extreme gain', () => { expect(elevTempAdj(10000)).toBe(-18); });
});
