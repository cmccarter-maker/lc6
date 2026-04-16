// ============================================================================
// Session 10 diagnostic — run and inspect real gear recommendations
// packages/engine/tests/evaluate/diagnostic.test.ts
//
// This test prints the actual recommendation output so Christian can
// verify the physics produces sensible gear selections.
// Run with: npx vitest run packages/engine/tests/evaluate/diagnostic.test.ts
// ============================================================================

import { describe, it, expect } from 'vitest';
import { convertGearDB, catalogSummary } from '../../src/gear/adapter.js';
import type { RawGearDB } from '../../src/gear/adapter.js';
import { enumerateCandidates } from '../../src/strategy/enumerate.js';
import { evaluate } from '../../src/evaluate.js';
import type { EngineInput, GearEnsemble, TrajectoryPoint } from '../../src/types.js';

// ── Same embedded gear DB from real_gear.test.ts ──
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

function printEnsemble(label: string, e: GearEnsemble) {
  console.log(`\n  ── ${label} ──`);
  console.log(`  Ensemble: ${e.label ?? e.ensemble_id}`);
  console.log(`  Total CLO: ${e.total_clo}  |  Ensemble im: ${e.ensemble_im}`);
  for (const item of e.items) {
    console.log(`    ${item.slot.padEnd(12)} ${item.name.padEnd(45)} CLO=${item.clo.toFixed(2)}  im=${item.im.toFixed(3)}`);
  }
}

function printTrajectorySnapshot(label: string, points: TrajectoryPoint[]) {
  if (points.length === 0) return;
  const peakMR = Math.max(...points.map(p => p.MR));
  const peakHLR = Math.max(...points.map(p => p.HLR));
  const peakCDI = Math.max(...points.map(p => p.CDI));
  const stages = [...new Set(points.map(p => p.clinical_stage))];
  const regimes = [...new Set(points.map(p => p.regime))];
  console.log(`  ${label}:`);
  console.log(`    Peak MR=${peakMR.toFixed(1)}  HLR=${peakHLR.toFixed(1)}  CDI=${peakCDI.toFixed(1)}`);
  console.log(`    Stages: ${stages.join(', ')}`);
  console.log(`    Regimes: ${regimes.join(', ')}`);
  console.log(`    Trajectory points: ${points.length}`);
}


describe('DIAGNOSTIC — Human-readable recommendation output', () => {

  it('Skiing at Breckenridge 16°F — full recommendation', () => {
    const catalog = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing', minFitScore: 7 });
    const summary = catalogSummary(catalog);
    const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: 16, activity: 'skiing' });

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

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  LAYERCRAFT — Breckenridge Skiing 16°F Groomers 6hrs       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    console.log(`\n  Catalog: ${catalog.length} items (${Object.entries(summary).map(([k,v]) => `${k}:${v}`).join(', ')})`);
    console.log(`  Candidates generated: ${candidates.length}`);
    console.log(`  Candidates post-IREQ: ${result.strategy.candidates_post_ireq}`);
    console.log(`  Candidates evaluated: ${result.strategy.candidates_evaluated}`);

    console.log(`\n  IREQ at 16°F:`);
    console.log(`    IREQ_min = ${result.ireq_summary.ireq_min_clo.toFixed(2)} clo`);
    console.log(`    IREQ_neu = ${result.ireq_summary.ireq_neu_clo.toFixed(2)} clo`);
    console.log(`    Activity MET = ${result.ireq_summary.activity_met_w_m2.toFixed(0)} W/m²`);

    printEnsemble('PILL 1 — Your Gear', result.four_pill.your_gear.ensemble);
    printTrajectorySnapshot('Your Gear Performance', result.four_pill.your_gear.trajectory);

    printEnsemble('PILL 3 — Optimal Gear (WINNER)', result.four_pill.optimal_gear.ensemble);
    printTrajectorySnapshot('Optimal Gear Performance', result.four_pill.optimal_gear.trajectory);

    console.log(`\n  ── WINNER SELECTION ──`);
    console.log(`  Winner: ${result.strategy.winner_ensemble_id}`);
    console.log(`  Winner peak CDI: ${result.strategy.winner_peak_cdi?.toFixed(1) ?? 'N/A'}`);
    console.log(`  Winner peak stage: ${result.strategy.winner_peak_stage ?? 'N/A'}`);

    const userPeakCDI = result.four_pill.your_gear.trajectory_summary.peak_CDI;
    const optimalPeakCDI = result.four_pill.optimal_gear.trajectory_summary.peak_CDI;
    console.log(`\n  ── COMPARISON ──`);
    console.log(`  Your Gear CDI:    ${userPeakCDI.toFixed(1)}`);
    console.log(`  Optimal Gear CDI: ${optimalPeakCDI.toFixed(1)}`);
    console.log(`  Improvement:      ${(userPeakCDI - optimalPeakCDI).toFixed(1)} CDI points`);

    console.log(`\n  ── TRIP HEADLINE ──`);
    console.log(`  Peak MR: ${result.trip_headline.peak_MR.toFixed(1)}`);
    console.log(`  Peak HLR: ${result.trip_headline.peak_HLR.toFixed(1)}`);
    console.log(`  Peak CDI: ${result.trip_headline.peak_CDI.toFixed(1)}`);
    console.log(`  Clinical stage: ${result.trip_headline.peak_clinical_stage}`);
    console.log(`  Impairment reached: ${result.trip_headline.named_impairment_stage_reached}`);
    console.log(`  CM cards: ${result.trip_headline.cm_card_count}`);
    console.log('');

    // Test passes if pipeline completes — the console output is the deliverable
    expect(result).toBeDefined();
    expect(result.strategy.winner_ensemble_id).not.toBeNull();
  });

  it('Skiing at Breckenridge 5°F (colder) — does recommendation change?', () => {
    const catalog = convertGearDB(SKIING_GEAR_DB, { activity: 'skiing', minFitScore: 7 });
    const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: 5, activity: 'skiing' });
    const sorted = [...candidates].sort((a, b) => a.total_clo - b.total_clo);

    const input: EngineInput = {
      activity: {
        activity_id: 'skiing',
        duration_hr: 4,
        snow_terrain: 'groomers',
        segments: [{
          segment_id: 'cold-day',
          segment_label: 'Cold Day Groomers',
          activity_id: 'skiing',
          duration_hr: 4,
          weather: [{ t_start: 0, t_end: 14400, temp_f: 5, humidity: 40, wind_mph: 18, precip_probability: 0 }],
        }],
      },
      location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: sorted[0]!,
      strategy_candidates: candidates,
    };

    const result = evaluate(input);

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║  LAYERCRAFT — Breckenridge Skiing 5°F Groomers 4hrs        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    console.log(`\n  IREQ at 5°F:`);
    console.log(`    IREQ_min = ${result.ireq_summary.ireq_min_clo.toFixed(2)} clo`);
    console.log(`    IREQ_neu = ${result.ireq_summary.ireq_neu_clo.toFixed(2)} clo`);

    printEnsemble('WINNER', result.four_pill.optimal_gear.ensemble);
    printTrajectorySnapshot('Winner Performance', result.four_pill.optimal_gear.trajectory);

    console.log(`\n  Peak CDI: ${result.trip_headline.peak_CDI.toFixed(1)}`);
    console.log(`  Clinical stage: ${result.trip_headline.peak_clinical_stage}`);
    console.log(`  CM cards: ${result.trip_headline.cm_card_count}`);
    console.log('');

    expect(result).toBeDefined();
  });
});
