// Tests for gear_layers.ts — getFiberType, breathabilityToIm, getLayerCapacity,
// activityCLO, warmthToCLO, buildLayerArray.

import { describe, it, expect } from 'vitest';
import {
  getFiberType,
  breathabilityToIm,
  getLayerCapacity,
  activityCLO,
  warmthToCLO,
  buildLayerArray,
  FIBER_ABSORPTION,
} from '../../src/ensemble/gear_layers.js';

describe('FIBER_ABSORPTION (ASTM D1909 baseline)', () => {
  it('PHY-071: locks in saturation capacities SYNTHETIC=0.40, WOOL=0.35, COTTON=2.00, DOWN=0.60', () => {
    expect(FIBER_ABSORPTION.WOOL).toBe(0.35);
    expect(FIBER_ABSORPTION.COTTON).toBe(2.00);
    expect(FIBER_ABSORPTION.SYNTHETIC).toBe(0.40);
    expect(FIBER_ABSORPTION.DOWN).toBe(0.60);
  });
});

describe('getFiberType — 3-level fallback', () => {
  it('Level 1: explicit material field → WOOL via "merino"', () => {
    expect(getFiberType({ material: 'Merino wool 250gsm' })).toBe('WOOL');
  });

  it('Level 1: explicit material field → COTTON via "cotton"', () => {
    expect(getFiberType({ material: 'Organic cotton blend' })).toBe('COTTON');
  });

  it('Level 1: explicit material field → DOWN via "down"', () => {
    expect(getFiberType({ material: '800 fill power down' })).toBe('DOWN');
  });

  it('Level 1: explicit material field → SYNTHETIC default', () => {
    expect(getFiberType({ material: 'Polartec PowerDry' })).toBe('SYNTHETIC');
  });

  it('Level 2: brand keyword → WOOL via "smartwool"', () => {
    expect(getFiberType({ brand: 'Smartwool', model: 'Merino 250 LS Crew' })).toBe('WOOL');
  });

  it('Level 2: brand keyword → WOOL via "icebreaker"', () => {
    expect(getFiberType({ brand: 'Icebreaker', name: 'Anatomica' })).toBe('WOOL');
  });

  it('Level 2: name keyword → DOWN via "puffy"', () => {
    expect(getFiberType({ brand: 'Patagonia', model: 'Down Sweater Puffy' })).toBe('DOWN');
  });

  it('Level 2: name keyword → DOWN via "800 fill"', () => {
    expect(getFiberType({ name: 'Mountain Hardwear Phantom 800 fill jacket' })).toBe('DOWN');
  });

  it('Level 3: default → SYNTHETIC for unknown items', () => {
    expect(getFiberType({ brand: 'Generic', model: 'Tech Tee' })).toBe('SYNTHETIC');
  });

  it('handles null/undefined item → SYNTHETIC default', () => {
    expect(getFiberType(null)).toBe('SYNTHETIC');
    expect(getFiberType(undefined)).toBe('SYNTHETIC');
  });
});

describe('breathabilityToIm — piecewise mapping', () => {
  it('zero/null input → 0.08 floor', () => {
    expect(breathabilityToIm(0)).toBe(0.08);
    expect(breathabilityToIm(null)).toBe(0.08);
    expect(breathabilityToIm(undefined)).toBe(0.08);
  });

  it('breathability 10 → 0.45 ceiling (mesh)', () => {
    expect(breathabilityToIm(10)).toBe(0.45);
  });

  it('breathability 4 (sealed boundary) → 0.08', () => {
    // 0.05 + 4 * 0.0075 = 0.08
    expect(breathabilityToIm(4)).toBeCloseTo(0.08, 4);
  });

  it('breathability 7 (standard boundary) → 0.20', () => {
    // 0.05 + (7-4) * 0.05 = 0.20
    expect(breathabilityToIm(7)).toBeCloseTo(0.20, 4);
  });

  it('breathability 1 (most sealed) → 0.0575', () => {
    // 0.05 + 1 * 0.0075 = 0.0575
    expect(breathabilityToIm(1)).toBeCloseTo(0.0575, 4);
  });

  it('breathability 8 (mid-mesh) → 0.283', () => {
    // 0.20 + (8-7) * 0.083 = 0.283
    expect(breathabilityToIm(8)).toBeCloseTo(0.283, 3);
  });
});

describe('getLayerCapacity', () => {
  it('uses explicit weightG when provided', () => {
    // weightG=200, fiber=WOOL (0.30): 200 * 0.30 = 60
    expect(getLayerCapacity({ weightG: 200 }, 'WOOL')).toBe(70);
  });

  it('estimates weight from warmth when weightG missing', () => {
    // warmth=5: weightG=100+5*20=200. SYNTHETIC (0.06): 200*0.06=12
    expect(getLayerCapacity({ warmth: 5 }, 'SYNTHETIC')).toBe(80);
  });

  it('uses warmthRatio fallback when warmth missing', () => {
    // warmthRatio=7: 100+7*20=240. WOOL (0.30): 240*0.30=72
    expect(getLayerCapacity({ warmthRatio: 7 }, 'WOOL')).toBe(84);
  });

  it('default warmth=5 when no warmth fields', () => {
    // 100 + 5*20 = 200. COTTON (0.15): 30
    expect(getLayerCapacity({}, 'COTTON')).toBe(400);
  });

  it('returns minimum 2mL even at low weight', () => {
    // weightG=10, SYNTHETIC: 10*0.06=0.6 → bumped to 2
    expect(getLayerCapacity({ weightG: 10 }, 'SYNTHETIC')).toBe(4);
  });

  it('uses 0.02 fallback for unknown fiber type', () => {
    // weightG=200, unknown: 200*0.02=4
    expect(getLayerCapacity({ weightG: 200 }, 'UNKNOWN' as any)).toBe(4);
  });
});

describe('activityCLO', () => {
  it('skiing → 2.5', () => {
    expect(activityCLO('skiing')).toBe(2.5);
  });

  it('running → 0.8', () => {
    expect(activityCLO('running')).toBe(0.8);
  });

  it('day_hike → 1.5', () => {
    expect(activityCLO('day_hike')).toBe(1.5);
  });

  it('unknown activity → 1.5 default', () => {
    expect(activityCLO('underwater_basketweaving')).toBe(1.5);
  });
});

describe('warmthToCLO — lookup table', () => {
  it('warmth 1 → 0.10 CLO', () => {
    expect(warmthToCLO(1)).toBe(0.10);
  });

  it('warmth 5 → 0.70 CLO', () => {
    expect(warmthToCLO(5)).toBe(0.70);
  });

  it('warmth 10 → 2.50 CLO (max)', () => {
    expect(warmthToCLO(10)).toBe(2.50);
  });

  it('clamps to [1, 10]', () => {
    expect(warmthToCLO(0)).toBe(0.10);   // 0 → 1
    expect(warmthToCLO(15)).toBe(2.50);  // 15 → 10
    expect(warmthToCLO(-5)).toBe(0.10);  // negative → 1
  });

  it('rounds fractional input', () => {
    expect(warmthToCLO(5.4)).toBe(0.70);  // rounds to 5
    expect(warmthToCLO(5.6)).toBe(1.00);  // rounds to 6
  });
});

describe('buildLayerArray — gear-driven path', () => {
  it('builds array from explicit gear items', () => {
    const items = [
      { brand: 'Smartwool', model: 'Merino 250', breathability: 7, weightG: 250 },
      { brand: 'Patagonia', model: 'R1 Fleece', breathability: 8, weightG: 300 },
      { brand: 'Arc\'teryx', model: 'Beta AR', breathability: 5, weightG: 400 },
    ];
    const r = buildLayerArray(items);
    expect(r.length).toBe(3);
    // Verify base layer is WOOL (Smartwool keyword)
    expect(r[0]!.fiber).toBe('WOOL');
    expect(r[0]!.cap).toBe(87.5);  // PHY-071  // 250 * 0.30
    // Mid layer SYNTHETIC default
    expect(r[1]!.fiber).toBe('SYNTHETIC');
    expect(r[1]!.cap).toBe(120);  // PHY-071: 300g × 0.40
    // Shell SYNTHETIC default
    expect(r[2]!.fiber).toBe('SYNTHETIC');
    expect(r[2]!.cap).toBe(160);  // PHY-071: 400g × 0.40
  });
});

describe('buildLayerArray — default path', () => {
  it('skiing default → 4-layer stack (CLO 2.5 ≥ 2.0)', () => {
    const r = buildLayerArray(null, 'skiing');
    expect(r.length).toBe(4);
    expect(r[0]!.name).toBe('Typical Merino Base');
    expect(r[0]!.fiber).toBe('WOOL');
    expect(r[1]!.name).toBe('Default Mid');
    expect(r[2]!.name).toBe('Default Insulation');
    expect(r[3]!.name).toBe('Default Shell');
  });

  it('hiking default → 3-layer stack (CLO 1.5 < 2.0)', () => {
    const r = buildLayerArray(null, 'hiking');
    expect(r.length).toBe(3);
    expect(r[0]!.name).toBe('Typical Merino Base');
    expect(r[1]!.name).toBe('Default Mid');
    expect(r[2]!.name).toBe('Default Shell');
  });

  it('strategy pill flag → optimized synthetic base instead of merino', () => {
    const r = buildLayerArray(null, 'skiing', undefined, true);
    expect(r[0]!.name).toBe('Optimized Synthetic Base');
    expect(r[0]!.fiber).toBe('SYNTHETIC');
    expect(r[0]!.wicking).toBe(10);
  });

  it('totalCLO override → drives layer count', () => {
    // CLO 1.0 → 3-layer
    const r3 = buildLayerArray(null, 'skiing', 1.0);
    expect(r3.length).toBe(3);
    // CLO 2.5 → 4-layer
    const r4 = buildLayerArray(null, 'skiing', 2.5);
    expect(r4.length).toBe(4);
  });
});
