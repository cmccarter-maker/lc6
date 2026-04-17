// PHY-GEAR-01 v2 (Session 11) — gearjs adapter tests
// packages/engine/tests/gear/gearjs_adapter.test.ts
//
// Validates full 1,627-product gear.js conversion through the adapter.

import { describe, it, expect } from 'vitest';
import {
  convertGearDB, catalogSummary, inferFiber, imputeAttributes,
} from '../../src/gear/adapter.js';
import type { RawGearDB, RawGearItem } from '../../src/gear/adapter.js';
// @ts-expect-error — reference/lc5_gear.js is a JS module without types
import { G as REAL_GEAR_DB } from '../../reference/lc5_gear.js';

describe('PHY-GEAR-01 structural coverage', () => {
  it('real gear.js produces between 1,100 and 1,700 EngineGearItems', () => {
    const items = convertGearDB(REAL_GEAR_DB as RawGearDB);
    expect(items.length).toBeGreaterThan(1100);
    expect(items.length).toBeLessThan(1700);
  });

  it('all core engine slots have items', () => {
    const items = convertGearDB(REAL_GEAR_DB as RawGearDB);
    const s = catalogSummary(items);
    expect(s.bySlot['base']).toBeGreaterThan(0);
    expect(s.bySlot['mid']).toBeGreaterThan(0);
    expect(s.bySlot['insulative']).toBeGreaterThan(0);
    expect(s.bySlot['shell']).toBeGreaterThan(0);
    expect(s.bySlot['legwear']).toBeGreaterThan(0);
    expect(s.bySlot['footwear']).toBeGreaterThan(0);
    expect(s.bySlot['headgear']).toBeGreaterThan(0);
    expect(s.bySlot['handwear']).toBeGreaterThan(0);
  });

  it('immersion slot captures drysuits + wetsuits', () => {
    const items = convertGearDB(REAL_GEAR_DB as RawGearDB);
    const s = catalogSummary(items);
    expect(s.bySlot['immersion'] ?? 0).toBeGreaterThan(0);
  });

  it('sleep slots populated from sleeping_bags and sleeping_pads', () => {
    const items = convertGearDB(REAL_GEAR_DB as RawGearDB);
    const s = catalogSummary(items);
    expect(s.bySlot['sleeping_bag'] ?? 0).toBeGreaterThan(0);
    expect(s.bySlot['sleeping_pad'] ?? 0).toBeGreaterThan(0);
  });
});

describe('PHY-GEAR-01 per-activity coverage', () => {
  const COLD_SLOTS = ['base', 'mid', 'insulative', 'shell', 'legwear', 'footwear', 'headgear', 'handwear'];

  it.each([
    'skiing', 'snowboarding', 'cross_country_ski', 'snowshoeing', 'fishing',
  ])('cold activity %s has all 8 required slots', (activity) => {
    const items = convertGearDB(REAL_GEAR_DB as RawGearDB, { activity, minFitScore: 5 });
    const s = catalogSummary(items);
    for (const slot of COLD_SLOTS) {
      expect(s.bySlot[slot] ?? 0, `${activity} missing ${slot}`).toBeGreaterThan(0);
    }
  });

  it('day_hike alias routes to hiking', () => {
    const dayHike = convertGearDB(REAL_GEAR_DB as RawGearDB, { activity: 'day_hike', minFitScore: 5 });
    const hiking = convertGearDB(REAL_GEAR_DB as RawGearDB, { activity: 'hiking', minFitScore: 5 });
    expect(dayHike.length).toBe(hiking.length);
  });

  it('cycling alias routes to road_cycling', () => {
    const cycling = convertGearDB(REAL_GEAR_DB as RawGearDB, { activity: 'cycling', minFitScore: 5 });
    const rc = convertGearDB(REAL_GEAR_DB as RawGearDB, { activity: 'road_cycling', minFitScore: 5 });
    expect(cycling.length).toBe(rc.length);
  });
});

describe('PHY-GEAR-01 activity-exclusive brand filter (Simms)', () => {
  it('hiking excludes all Simms products', () => {
    const items = convertGearDB(REAL_GEAR_DB as RawGearDB, { activity: 'hiking', minFitScore: 3 });
    const simmsCount = items.filter(i => i.name.toLowerCase().includes('simms')).length;
    expect(simmsCount).toBe(0);
  });

  it('fishing retains Simms products', () => {
    const items = convertGearDB(REAL_GEAR_DB as RawGearDB, { activity: 'fishing', minFitScore: 5 });
    const simmsCount = items.filter(i => i.name.toLowerCase().includes('simms')).length;
    expect(simmsCount).toBeGreaterThan(10);
  });
});

describe('PHY-GEAR-01 fiber inference', () => {
  it('Smartwool Merino → wool', () => {
    const raw: RawGearItem = { brand: 'Smartwool', model: 'Merino 250 Base Layer', fit: { skiing: 10 } };
    expect(inferFiber(raw)).toBe('wool');
  });

  it('Patagonia Capilene Cool Merino → wool (merino precedence)', () => {
    const raw: RawGearItem = { brand: 'Patagonia', model: 'Capilene Cool Merino', fit: {} };
    expect(inferFiber(raw)).toBe('wool');
  });

  it('Patagonia Nano Puff → synthetic', () => {
    const raw: RawGearItem = { brand: 'Patagonia', model: 'Nano Puff Hoody', features: 'PrimaLoft Gold', fit: {} };
    expect(inferFiber(raw)).toBe('synthetic');
  });

  it('Mountain Hardwear Phantom 800 Down → down', () => {
    const raw: RawGearItem = { brand: 'Mountain Hardwear', model: 'Phantom 800 Down Jacket', fit: {} };
    expect(inferFiber(raw)).toBe('down');
  });

  it('fillType explicit down → down', () => {
    const raw = { brand: 'REI', model: 'Magma 30', fit: {}, fillType: 'down' as const };
    expect(inferFiber(raw as RawGearItem)).toBe('down');
  });

  it('default fallback → synthetic', () => {
    const raw: RawGearItem = { brand: 'Generic', model: 'Shell Jacket', fit: {} };
    expect(inferFiber(raw)).toBe('synthetic');
  });

  it('fiber distribution across full catalog is sensible', () => {
    const items = convertGearDB(REAL_GEAR_DB as RawGearDB);
    const s = catalogSummary(items);
    expect(s.byFiber['synthetic']).toBeGreaterThan(200);
    expect(s.byFiber['wool'] ?? 0).toBeGreaterThan(30);
    expect(s.byFiber['down'] ?? 0).toBeGreaterThan(10);
  });
});

describe('PHY-GEAR-01 peer imputation', () => {
  it('median (not mean) for numeric attrs — regression guard', () => {
    const t: RawGearItem = { brand: 'T', model: 'T', tempRange: [0, 40], warmthRatio: 5, weight: 'light', fit: {} };
    const ps: RawGearItem[] = [3, 5, 5, 7, 9].map((w, i) => ({
      brand: 'P', model: `P${i}`, tempRange: [0, 40],
      breathability: 8, windResist: 3, weight: 'light', warmthRatio: 5, waterproof: 0, moisture: w,
      fit: {},
    }));
    const imp = imputeAttributes(t, ps);
    // moisture peer values [3, 5, 5, 7, 9] → median 5 (not mean 5.8)
    expect(imp.item.moisture).toBe(5);
  });

  it('weight imputed as mode', () => {
    const t: RawGearItem = { brand: 'T', model: 'T', tempRange: [0, 40], warmthRatio: 5, breathability: 8, windResist: 3, waterproof: 0, moisture: 7, fit: {} };
    const ps: RawGearItem[] = ['light', 'light', 'mid', 'ultralight', 'light'].map((w, i) => ({
      brand: 'P', model: `P${i}`, tempRange: [0, 40],
      breathability: 8, windResist: 3, weight: w, warmthRatio: 5, waterproof: 0, moisture: 7,
      fit: {},
    }));
    const imp = imputeAttributes(t, ps);
    expect(imp.item.weight).toBe('light');
  });

  it('<3 peers → missing attrs stay null', () => {
    const t: RawGearItem = { brand: 'T', model: 'T', warmthRatio: 5, breathability: 8, fit: {} };
    const imp = imputeAttributes(t, []);
    expect(imp.imputed.length).toBe(0);
    expect(imp.item.windResist).toBeUndefined();
  });
});

describe('PHY-GEAR-01 waterproof clamping', () => {
  it('footwear with waterproof=8 clamps to 3', () => {
    const db: RawGearDB = {
      footwear: [{ brand: 'Salomon', model: 'Test Boot', waterproof: 8, tempRange: [0, 50], breathability: 3, windResist: 6, weight: 'mid', warmthRatio: 5, moisture: 5, fit: { hiking: 10 } }],
    };
    const items = convertGearDB(db, { activity: 'hiking', minFitScore: 5 });
    expect(items[0]!.waterproof).toBe(3);
  });

  it('waterproof=3 passthrough', () => {
    const db: RawGearDB = {
      upper: { shell: [{ brand: 'A', model: 'S', waterproof: 3, tempRange: [0, 50], breathability: 7, windResist: 9, weight: 'light', warmthRatio: 1, moisture: 3, fit: { hiking: 10 } }] },
    };
    const items = convertGearDB(db, { activity: 'hiking', minFitScore: 5 });
    expect(items[0]!.waterproof).toBe(3);
  });
});

describe('PHY-GEAR-01 sleep system', () => {
  it('sleeping pad with rValue → spec_confidence: 8', () => {
    const db: RawGearDB = {
      sleeping_pads: [{ brand: 'Therm-a-Rest', model: 'NeoAir XTherm NXT', rValue: 7.3, fit: { camping: 10 } }],
    };
    const items = convertGearDB(db);
    expect(items.length).toBe(1);
    expect(items[0]!.slot).toBe('sleeping_pad');
    expect(items[0]!.r_value).toBe(7.3);
    expect(items[0]!.spec_confidence).toBe(8);
  });

  it('sleeping pad without rValue → excluded', () => {
    const db: RawGearDB = {
      sleeping_pads: [{ brand: 'X', model: 'NoR', fit: { camping: 10 } }],
    };
    expect(convertGearDB(db).length).toBe(0);
  });

  it('sleeping bag with comfort + lowerLimit → spec_confidence: 8', () => {
    const db: RawGearDB = {
      sleeping_bags: [{ brand: 'WM', model: 'UltraLite 20', comfortRating: 20, lowerLimit: 10, fillPower: 850, fillType: 'down', fit: { backpacking: 10 } }],
    };
    const items = convertGearDB(db);
    expect(items[0]!.spec_confidence).toBe(8);
    expect(items[0]!.comfort_rating_f).toBe(20);
    expect(items[0]!.lower_limit_f).toBe(10);
    expect(items[0]!.fill_power).toBe(850);
    expect(items[0]!.fiber).toBe('down');
  });

  it('sleeping bag with only comfortRating → spec_confidence: 5', () => {
    const db: RawGearDB = {
      sleeping_bags: [{ brand: 'X', model: 'Partial', comfortRating: 30, fit: { camping: 10 } }],
    };
    expect(convertGearDB(db)[0]!.spec_confidence).toBe(5);
  });
});

describe('PHY-GEAR-01 immersion gear', () => {
  it('drysuit routed to immersion slot with spec_confidence 0', () => {
    const db: RawGearDB = {
      drysuit: [{ brand: 'Kokatat', model: 'Meridian Drysuit', tempRange: [-10, 50], fit: { kayaking: 10 } }],
    };
    const items = convertGearDB(db);
    expect(items[0]!.slot).toBe('immersion');
    expect(items[0]!.subslot).toBe('immersion_drysuit');
    expect(items[0]!.spec_confidence).toBe(0);
  });

  it('wetsuit preserves thickness_mm', () => {
    const db: RawGearDB = {
      wetsuit: [{ brand: 'NRS', model: 'Radiant', thickness: '4/3mm', tempRange: [45, 62], fit: { kayaking: 10 } }],
    };
    const items = convertGearDB(db);
    expect(items[0]!.thickness_mm).toBe('4/3mm');
  });
});
