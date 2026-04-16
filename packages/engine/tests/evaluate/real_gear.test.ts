// ============================================================================
// Session 10 — Real gear DB integration test
// packages/engine/tests/evaluate/real_gear.test.ts
//
// Uses actual LC5 gear DB products (embedded subset) through the full pipeline:
//   Real products → adapter → enumerateCandidates → evaluate → named winner
//
// This is the test that proves LayerCraft can recommend actual products.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { convertGearDB, catalogSummary } from '../../src/gear/adapter.js';
import type { RawGearDB } from '../../src/gear/adapter.js';
import { enumerateCandidates } from '../../src/strategy/enumerate.js';
import { evaluate } from '../../src/evaluate.js';
import type { EngineInput } from '../../src/types.js';

// ============================================================================
// Embedded real gear data — skiing-relevant subset from LC5 gear.js
// ============================================================================

const SKIING_GEAR_DB: RawGearDB = {
  upper: {
    base_layer: [
      {brand:"Patagonia",model:"Capilene Cool Merino",price:69,tempRange:[30,70],breathability:9,windResist:2,weight:"ultralight",packable:true,warmthRatio:5,waterproof:0,moisture:9,fit:{hiking:9,skiing:7,running:8}},
      {brand:"Smartwool",model:"Merino 250 Base Layer",price:100,tempRange:[0,45],breathability:7,windResist:3,weight:"light",packable:true,warmthRatio:8,waterproof:0,moisture:9,fit:{skiing:10,snowboarding:10,hiking:7}},
      {brand:"Icebreaker",model:"200 Oasis LS Crewe",price:90,tempRange:[5,50],breathability:8,windResist:3,weight:"light",packable:true,warmthRatio:7,waterproof:0,moisture:9,fit:{hiking:8,skiing:9,snowboarding:8}},
      {brand:"Norrøna",model:"Equaliser Merino LS",price:110,tempRange:[5,45],breathability:8,windResist:3,weight:"light",packable:true,warmthRatio:8,waterproof:0,moisture:9,fit:{skiing:10,snowboarding:9}},
      {brand:"Arc'teryx",model:"Motus AR Crew LS",price:85,tempRange:[25,65],breathability:10,windResist:2,weight:"ultralight",packable:true,warmthRatio:5,waterproof:0,moisture:10,fit:{skiing:8,snowboarding:7}},
    ],
    mid_layer: [
      {brand:"Patagonia",model:"R1 Air Full-Zip Hoody",price:169,tempRange:[20,50],breathability:10,windResist:4,weight:"light",packable:true,warmthRatio:7,waterproof:0,moisture:8,fit:{skiing:9,climbing:10}},
      {brand:"Arc'teryx",model:"Kyanite LT Hoody",price:175,tempRange:[15,45],breathability:8,windResist:5,weight:"mid",packable:false,warmthRatio:8,waterproof:0,moisture:7,fit:{skiing:9,snowboarding:9}},
      {brand:"Norrøna",model:"Falketind Warm1 Stretch",price:189,tempRange:[15,45],breathability:9,windResist:5,weight:"light",packable:true,warmthRatio:8,waterproof:0,moisture:8,fit:{skiing:10}},
      {brand:"Mountain Hardwear",model:"Polartec Power Grid",price:130,tempRange:[15,45],breathability:9,windResist:4,weight:"light",packable:true,warmthRatio:7,waterproof:0,moisture:8,fit:{skiing:8}},
      // Insulative-class (warmthRatio >= 8 → slot = insulative)
      {brand:"Arc'teryx",model:"Cerium LT Hoody",price:380,tempRange:[-10,35],breathability:5,windResist:6,weight:"ultralight",packable:true,warmthRatio:9,waterproof:0,moisture:3,fit:{skiing:9,snowboarding:8}},
      {brand:"Patagonia",model:"Nano Puff Hoody",price:279,tempRange:[0,45],breathability:7,windResist:7,weight:"light",packable:true,warmthRatio:8,waterproof:1,moisture:5,fit:{skiing:8,snowboarding:8}},
      {brand:"Rab",model:"Microlight Alpine",price:300,tempRange:[-15,30],breathability:5,windResist:7,weight:"light",packable:true,warmthRatio:9,waterproof:1,moisture:3,fit:{skiing:9}},
    ],
    shell: [
      {brand:"Arc'teryx",model:"Beta LT Jacket",price:450,tempRange:[-20,60],breathability:8,windResist:10,weight:"light",packable:true,warmthRatio:1,waterproof:3,moisture:3,fit:{skiing:10,snowboarding:9}},
      {brand:"Norrøna",model:"Falketind Gore-Tex",price:500,tempRange:[-15,55],breathability:9,windResist:10,weight:"light",packable:true,warmthRatio:1,waterproof:3,moisture:3,fit:{skiing:10,snowboarding:9}},
      {brand:"Helly Hansen",model:"Verglas 3L Shell",price:350,tempRange:[-10,55],breathability:8,windResist:10,weight:"mid",packable:false,warmthRatio:1,waterproof:3,moisture:3,fit:{skiing:9,snowboarding:9}},
      {brand:"Outdoor Research",model:"Hemispheres II",price:399,tempRange:[-15,45],breathability:9,windResist:10,weight:"mid",packable:false,warmthRatio:2,waterproof:3,moisture:3,fit:{skiing:10}},
    ],
  },
  lower: {
    base_layer: [
      {brand:"Smartwool",model:"Merino 250 Bottom",price:100,tempRange:[0,40],breathability:7,windResist:2,weight:"light",warmthRatio:8,waterproof:0,moisture:9,fit:{skiing:10,snowboarding:10}},
      {brand:"Patagonia",model:"Capilene MW Bottoms",price:59,tempRange:[10,45],breathability:9,windResist:2,weight:"ultralight",warmthRatio:6,waterproof:0,moisture:9,fit:{skiing:8}},
      {brand:"Icebreaker",model:"200 Oasis Leggings",price:85,tempRange:[5,45],breathability:8,windResist:2,weight:"light",warmthRatio:7,waterproof:0,moisture:9,fit:{skiing:9,snowboarding:9}},
      // Ski pants (higher warmthRatio)
      {brand:"Arc'teryx",model:"Sabre AR Pant",price:500,tempRange:[-20,40],breathability:7,windResist:10,weight:"mid",warmthRatio:5,waterproof:3,moisture:3,fit:{skiing:10,snowboarding:9}},
      {brand:"The North Face",model:"Freedom Insulated Pant",price:200,tempRange:[-15,35],breathability:5,windResist:9,weight:"mid",warmthRatio:7,waterproof:3,moisture:3,fit:{skiing:9,snowboarding:10}},
    ],
  },
  footwear: [
    {brand:"Salomon",model:"S/Pro MV 100",price:450,waterproof:9,packable:false,tempRange:[-20,35],breathability:2,windResist:9,weight:"heavy",moisture:2,warmthRatio:8,fit:{skiing:10}},
    {brand:"Tecnica",model:"Mach Sport MV 90",price:350,waterproof:9,packable:false,tempRange:[-20,35],breathability:2,windResist:9,weight:"heavy",moisture:2,warmthRatio:8,fit:{skiing:10}},
    {brand:"Nordica",model:"Speedmachine 3 100",price:450,waterproof:9,packable:false,tempRange:[-20,35],breathability:2,windResist:9,weight:"heavy",moisture:2,warmthRatio:8,fit:{skiing:10}},
  ],
  headgear: [
    {brand:"Smartwool",model:"Merino 250 Beanie",price:35,tempRange:[-15,30],breathability:5,windResist:6,weight:"ultralight",packable:true,warmthRatio:7,waterproof:0,moisture:4,fit:{skiing:9,snowboarding:9}},
    {brand:"Patagonia",model:"Brodeo Beanie",price:39,tempRange:[-10,35],breathability:5,windResist:6,weight:"ultralight",packable:true,warmthRatio:7,waterproof:0,moisture:4,fit:{skiing:8,snowboarding:8}},
    {brand:"Smith",model:"Vantage MIPS Helmet",price:260,tempRange:[-20,40],breathability:8,windResist:8,weight:"mid",packable:false,warmthRatio:6,waterproof:0,moisture:3,fit:{skiing:10,snowboarding:10}},
  ],
  handwear: [
    {brand:"Black Diamond",model:"Guide Gloves",price:170,tempRange:[-20,25],breathability:4,windResist:8,weight:"mid",warmthRatio:9,waterproof:2,moisture:3,fit:{skiing:10,snowboarding:10}},
    {brand:"Hestra",model:"Army Leather Heli Ski",price:175,tempRange:[-25,20],breathability:4,windResist:9,weight:"mid",warmthRatio:9,waterproof:2,moisture:3,fit:{skiing:10,snowboarding:10}},
    {brand:"Outdoor Research",model:"Stormtracker Gloves",price:79,tempRange:[-5,35],breathability:6,windResist:7,weight:"light",warmthRatio:6,waterproof:1,moisture:5,fit:{skiing:8,snowboarding:7}},
  ],
};


// ============================================================================
// Tests
// ============================================================================

describe('Gear adapter — convertGearDB', () => {

  it('converts skiing subset to EngineGearItem array', () => {
    const items = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing', minFitScore: 7 });
    expect(items.length).toBeGreaterThan(15);
  });

  it('all converted items have valid slot, clo, im', () => {
    const items = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing' });
    for (const item of items) {
      expect(item.slot).toBeDefined();
      expect(item.clo).toBeGreaterThan(0);
      expect(item.im).toBeGreaterThan(0);
      expect(item.im).toBeLessThanOrEqual(0.50);
    }
  });

  it('mid_layer items with warmthRatio >= 8 get slot = insulative', () => {
    const items = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing' });
    const insulative = items.filter(i => i.slot === 'insulative');
    expect(insulative.length).toBeGreaterThan(0);
    // Arc'teryx Cerium and Rab Microlight should be insulative
    const ceriumOrRab = insulative.filter(i => i.name.includes('Cerium') || i.name.includes('Microlight'));
    expect(ceriumOrRab.length).toBeGreaterThan(0);
  });

  it('catalogSummary shows coverage across slots', () => {
    const items = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing', minFitScore: 7 });
    const summary = catalogSummary(items);
    expect(summary['base']).toBeGreaterThan(0);
    expect(summary['mid']).toBeGreaterThan(0);
    expect(summary['shell']).toBeGreaterThan(0);
    expect(summary['legwear']).toBeGreaterThan(0);
    expect(summary['footwear']).toBeGreaterThan(0);
    expect(summary['headgear']).toBeGreaterThan(0);
    expect(summary['handwear']).toBeGreaterThan(0);
  });

  it('product names are preserved through conversion', () => {
    const items = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing' });
    const arcteryx = items.filter(i => i.name.includes("Arc'teryx"));
    expect(arcteryx.length).toBeGreaterThan(0);
    const smartwool = items.filter(i => i.name.includes('Smartwool'));
    expect(smartwool.length).toBeGreaterThan(0);
  });
});


describe('Real gear → enumerate → evaluate: full pipeline', () => {

  it('enumerate produces candidates from real skiing gear', () => {
    const catalog = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing', minFitScore: 7 });
    const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: 16, activity: 'skiing' });
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    // Each candidate should have real brand-name products
    for (const c of candidates) {
      expect(c.items.length).toBeGreaterThan(0);
      for (const item of c.items) {
        expect(item.name.length).toBeGreaterThan(3);
      }
    }
  });

  it('evaluate selects a winner from real products', () => {
    const catalog = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing', minFitScore: 7 });
    const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: 16, activity: 'skiing' });

    // Use the least-insulated candidate as "user gear" to force a meaningful comparison
    const sorted = [...candidates].sort((a, b) => a.total_clo - b.total_clo);
    const userEnsemble = sorted[0]!;

    const input: EngineInput = {
      activity: {
        activity_id: 'skiing',
        duration_hr: 6,
        snow_terrain: 'groomers',
        segments: [{
          segment_id: 'breck',
          segment_label: 'Breckenridge Groomers',
          activity_id: 'skiing',
          duration_hr: 6,
          weather: [{ t_start: 0, t_end: 21600, temp_f: 16, humidity: 45, wind_mph: 12, precip_probability: 0 }],
        }],
      },
      location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: userEnsemble,
      strategy_candidates: candidates,
    };

    const result = evaluate(input);

    // A winner should be selected
    expect(result.strategy.winner_ensemble_id).not.toBeNull();
    expect(result.strategy.candidates_evaluated).toBeGreaterThan(0);

    // Winner should be identifiable
    const winnerId = result.strategy.winner_ensemble_id!;
    const winnerCandidate = candidates.find(c => c.ensemble_id === winnerId);
    expect(winnerCandidate).toBeDefined();

    // Optimal gear pill should use the winner
    expect(result.four_pill.optimal_gear.ensemble.ensemble_id).toBe(winnerId);
  });

  it('winner ensemble contains named products from real brands', () => {
    const catalog = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing', minFitScore: 7 });
    const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: 16, activity: 'skiing' });
    const sorted = [...candidates].sort((a, b) => a.total_clo - b.total_clo);

    const input: EngineInput = {
      activity: {
        activity_id: 'skiing',
        duration_hr: 6,
        snow_terrain: 'groomers',
        segments: [{
          segment_id: 'breck',
          segment_label: 'Breckenridge',
          activity_id: 'skiing',
          duration_hr: 6,
          weather: [{ t_start: 0, t_end: 21600, temp_f: 16, humidity: 45, wind_mph: 12, precip_probability: 0 }],
        }],
      },
      location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: sorted[0]!,
      strategy_candidates: candidates,
    };

    const result = evaluate(input);
    const winnerItems = result.four_pill.optimal_gear.ensemble.items;

    // Each slot should have a named product
    const slots = winnerItems.map(i => i.slot);
    expect(slots).toContain('base');
    expect(slots).toContain('shell');
    expect(slots).toContain('footwear');

    // Products should have real brand names
    const brands = winnerItems.map(i => i.name.split(' ')[0]);
    const knownBrands = ['Patagonia', 'Smartwool', "Arc'teryx", 'Norrøna', 'Salomon', 'Black', 'Hestra', 'Smith'];
    const matchCount = brands.filter(b => knownBrands.some(kb => b?.includes(kb))).length;
    expect(matchCount).toBeGreaterThan(0);
  });

  it('Pill 1 vs Pill 3 shows real product upgrade recommendation', () => {
    const catalog = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing', minFitScore: 7 });
    const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: 16, activity: 'skiing' });
    const sorted = [...candidates].sort((a, b) => a.total_clo - b.total_clo);

    const input: EngineInput = {
      activity: {
        activity_id: 'skiing',
        duration_hr: 6,
        snow_terrain: 'groomers',
        segments: [{
          segment_id: 'breck',
          segment_label: 'Breckenridge',
          activity_id: 'skiing',
          duration_hr: 6,
          weather: [{ t_start: 0, t_end: 21600, temp_f: 5, humidity: 40, wind_mph: 15, precip_probability: 0 }],
        }],
      },
      location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: sorted[0]!, // weakest as user
      strategy_candidates: candidates,
    };

    const result = evaluate(input);

    // User gear and optimal gear should have different ensembles
    const userCLO = result.four_pill.your_gear.ensemble.total_clo;
    const optimalCLO = result.four_pill.optimal_gear.ensemble.total_clo;

    if (result.strategy.winner_ensemble_id !== null) {
      // Optimal should have higher CLO (more insulation) at 5°F
      expect(optimalCLO).toBeGreaterThanOrEqual(userCLO);
    }
  });
});
