import { describe, it, expect } from 'vitest';
import { calcElevationHumidity, altitudeFactors } from '../../src/heat_balance/altitude.js';

describe('calcElevationHumidity (Stull 2017 Magnus)', () => {
  it('sea level 20°C, dp 10°C → 52.52%', () => { expect(calcElevationHumidity(20, 10)).toBeCloseTo(52.5156, 3); });
  it('cold mountain 0°C, dp -5°C → 68.95%', () => { expect(calcElevationHumidity(0, -5)).toBeCloseTo(68.9549, 3); });
  it('summit -10°C, dp -15°C → 66.66%', () => { expect(calcElevationHumidity(-10, -15)).toBeCloseTo(66.6625, 3); });
  it('same temp=dp → 100%', () => { expect(calcElevationHumidity(15, 15)).toBeCloseTo(100, 2); });
  it('hot dry 35°C, dp 5°C → 15.51%', () => { expect(calcElevationHumidity(35, 5)).toBeCloseTo(15.5141, 3); });
  it('clamps to [0, 100]', () => {
    expect(calcElevationHumidity(-40, 30)).toBeLessThanOrEqual(100);
    expect(calcElevationHumidity(50, -40)).toBeGreaterThanOrEqual(0);
  });
});

describe('altitudeFactors (Buskirk & Hodgson 1987)', () => {
  it('sea level → all 1.0', () => { expect(altitudeFactors(0)).toEqual({ metabolic: 1.0, evap: 1.0, convective: 1.0 }); });
  it('below 1000ft → all 1.0', () => { expect(altitudeFactors(500)).toEqual({ metabolic: 1.0, evap: 1.0, convective: 1.0 }); });
  it('1000ft: evap=1.0220, conv=0.9820', () => {
    const r = altitudeFactors(1000);
    expect(r.metabolic).toBeCloseTo(1.0, 3);
    expect(r.evap).toBeCloseTo(1.0220, 3);
    expect(r.convective).toBeCloseTo(0.9820, 3);
  });
  it('10000ft: met=1.15, evap=1.2519, conv=0.8293', () => {
    const r = altitudeFactors(10000);
    expect(r.metabolic).toBeCloseTo(1.15, 3);
    expect(r.evap).toBeCloseTo(1.2519, 3);
    expect(r.convective).toBeCloseTo(0.8293, 3);
  });
  it('null/undefined → identity', () => { expect(altitudeFactors(null)).toEqual({ metabolic: 1.0, evap: 1.0, convective: 1.0 }); });
});
