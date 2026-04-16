import { describe, it, expect } from 'vitest';
import { waderEvapFloor } from '../../src/activities/split_body.js';

describe('waderEvapFloor (PHY-051)', () => {
  it('no wader, low evap, low rh → 0.01', () => { expect(waderEvapFloor(0.01, 30, null, false)).toBeCloseTo(0.02, 4); });
  it('no wader, high evap, high rh → 0.50', () => { expect(waderEvapFloor(0.5, 80, null, false)).toBeCloseTo(0.50, 4); });
  it('neoprene sealed, low evap → 0.0145', () => { expect(waderEvapFloor(0.01, 50, 'neoprene_5mm', true)).toBeCloseTo(0.0145, 4); });
  it('breathable wader, moderate evap → 0.10', () => { expect(waderEvapFloor(0.1, 60, 'breathable', true)).toBeCloseTo(0.10, 4); });
  it('none wader type → same as no wader', () => { expect(waderEvapFloor(0.1, 50, 'none', true)).toBeCloseTo(0.10, 4); });
});
