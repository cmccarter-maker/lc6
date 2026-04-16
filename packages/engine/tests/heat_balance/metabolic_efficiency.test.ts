import { describe, it, expect } from 'vitest';
import { getMetabolicEfficiency } from '../../src/heat_balance/metabolism.js';

describe('getMetabolicEfficiency (ECO-001 Uth-Sorensen 2004)', () => {
  it('no data → 1.0', () => { expect(getMetabolicEfficiency(5, null, null, null, null)).toBe(1.0); });
  it('high VO2 (55), easy MET 3 → 0.65', () => { expect(getMetabolicEfficiency(3, 55, null, 'male', null)).toBe(0.65); });
  it('high VO2 (55), hard MET 8 → 0.80', () => { expect(getMetabolicEfficiency(8, 55, null, 'male', null)).toBe(0.80); });
  it('low VO2 (30), moderate MET 5 → 1.00', () => { expect(getMetabolicEfficiency(5, 30, null, 'male', null)).toBe(1.00); });
  it('from resting HR 60, male 35y, MET 5 → 0.65', () => { expect(getMetabolicEfficiency(5, null, 35, 'male', 60)).toBe(0.65); });
  it('from resting HR 75, female 30y, MET 5 → 0.80', () => { expect(getMetabolicEfficiency(5, null, 30, 'female', 75)).toBe(0.80); });
  it('elite VO2 (70), easy MET 3 → 0.65', () => { expect(getMetabolicEfficiency(3, 70, null, 'male', null)).toBe(0.65); });
});
