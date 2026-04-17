// PHY-ADVERSARIAL: Stress-test matrix for LC6 engine.
//
// COVERAGE NOTE (Session 10):
// This matrix uses a small embedded gear DB (~50 items) adequate for validating
// skiing, running, golf, and fishing scenarios. 7 scenarios (day_hike cold/mild/hot,
// cross_country_ski, snowshoeing, -10F fishing, and road_cycling) currently report
// 'NO CANDIDATES ENUMERATED' because the embedded DB lacks activity-specific fits
// for those slots. This is a gear-DB coverage issue, NOT an engine issue.
//
// TO REACH FULL 19-SCENARIO COVERAGE: port LC5 gear.js (1,627 real products) into
// LC6 RawGearDB format via a new adapter. Once connected, all 19 scenarios will
// resolve against real product inventory and the engine's behavior can be
// validated comprehensively. See FUTURE_WORK.md / Session 11 handoff.
//
//
// Runs 19 scenarios across cold, hot, and edge-case regimes.
// Uses real gear DB converted through engine adapter (same path as diagnostic.test.ts).
// Full pipeline: user ensemble + strategy candidates → ranker + warnings + CMs.
// No assertions — diagnostic output only. Physician-reviewed.

import { describe, it } from 'vitest';
import { convertGearDB } from '../../src/gear/adapter.js';
import type { RawGearDB } from '../../src/gear/adapter.js';
import { enumerateCandidates } from '../../src/strategy/enumerate.js';
import { evaluate } from '../../src/evaluate.js';
import type { EngineInput, EngineOutput, GearEnsemble } from '../../src/types.js';

// ──────────────────────────────────────────────────────────────────────
// Shared gear DB — covers full range from lightweight summer to heavy winter
// Copy of the skiing gear DB with additional lightweight options
// ──────────────────────────────────────────────────────────────────────

const UNIVERSAL_GEAR_DB: RawGearDB = {
  upper: {
    base_layer: [
      {brand:"Patagonia",model:"Cap Cool Daily",price:45,tempRange:[50,95],breathability:10,windResist:1,weight:"ultralight",packable:true,warmthRatio:2,waterproof:0,moisture:10,fit:{running:10,hiking:9,cycling:9,golf:9}},
      {brand:"Patagonia",model:"Capilene Cool Merino",price:69,tempRange:[30,70],breathability:9,windResist:2,weight:"ultralight",packable:true,warmthRatio:5,waterproof:0,moisture:9,fit:{hiking:9,skiing:7,running:8,cycling:8}},
      {brand:"Smartwool",model:"Merino 250 Base Layer",price:100,tempRange:[0,45],breathability:7,windResist:3,weight:"light",packable:true,warmthRatio:8,waterproof:0,moisture:9,fit:{skiing:10,snowboarding:10,hiking:7,snowshoeing:10,fishing:9,cross_country_ski:9}},
      {brand:"Icebreaker",model:"200 Oasis LS Crewe",price:90,tempRange:[5,50],breathability:8,windResist:3,weight:"light",packable:true,warmthRatio:7,waterproof:0,moisture:9,fit:{hiking:8,skiing:9,snowboarding:8,snowshoeing:9,fishing:8,cross_country_ski:8}},
      {brand:"Arc'teryx",model:"Motus AR Crew LS",price:85,tempRange:[25,65],breathability:10,windResist:2,weight:"ultralight",packable:true,warmthRatio:5,waterproof:0,moisture:10,fit:{skiing:8,snowboarding:7,hiking:9,running:9,cross_country_ski:10}},
    ],
    mid_layer: [
      {brand:"Patagonia",model:"R1 Air Full-Zip Hoody",price:169,tempRange:[20,50],breathability:10,windResist:4,weight:"light",packable:true,warmthRatio:7,waterproof:0,moisture:8,fit:{skiing:9,climbing:10,hiking:8,cross_country_ski:9}},
      {brand:"Arc'teryx",model:"Kyanite LT Hoody",price:175,tempRange:[15,45],breathability:8,windResist:5,weight:"mid",packable:false,warmthRatio:8,waterproof:0,moisture:7,fit:{skiing:9,snowboarding:9,snowshoeing:9,fishing:8}},
      {brand:"Norrøna",model:"Falketind Warm1 Stretch",price:189,tempRange:[15,45],breathability:9,windResist:5,weight:"light",packable:true,warmthRatio:8,waterproof:0,moisture:8,fit:{skiing:10,snowshoeing:9,fishing:8}},
      {brand:"Arc'teryx",model:"Cerium LT Hoody",price:380,tempRange:[-10,35],breathability:5,windResist:6,weight:"ultralight",packable:true,warmthRatio:9,waterproof:0,moisture:3,fit:{skiing:9,snowboarding:8,snowshoeing:9,fishing:9}},
      {brand:"Patagonia",model:"Nano Puff Hoody",price:279,tempRange:[0,45],breathability:7,windResist:7,weight:"light",packable:true,warmthRatio:8,waterproof:1,moisture:5,fit:{skiing:8,snowboarding:8,hiking:8,fishing:8}},
      {brand:"Rab",model:"Microlight Alpine",price:300,tempRange:[-15,30],breathability:5,windResist:7,weight:"light",packable:true,warmthRatio:9,waterproof:1,moisture:3,fit:{skiing:9,fishing:9}},
      {brand:"Nike",model:"Dri-FIT Half-Zip",price:60,tempRange:[40,80],breathability:10,windResist:2,weight:"ultralight",packable:true,warmthRatio:3,waterproof:0,moisture:10,fit:{running:9,cycling:8,road_cycling:8,golf:8,day_hike:7,hiking:7}},
      {brand:"Patagonia",model:"Capilene Air Hoodie",price:179,tempRange:[30,70],breathability:9,windResist:3,weight:"light",packable:true,warmthRatio:5,waterproof:0,moisture:9,fit:{hiking:9,day_hike:9,running:7,cycling:7,road_cycling:7,golf:7,cross_country_ski:8}},
    ],
    shell: [
      {brand:"Patagonia",model:"Houdini Windshell",price:119,tempRange:[40,80],breathability:10,windResist:7,weight:"ultralight",packable:true,warmthRatio:1,waterproof:1,moisture:5,fit:{running:9,cycling:9,hiking:8}},
      {brand:"Arc'teryx",model:"Beta LT Jacket",price:450,tempRange:[-20,60],breathability:8,windResist:10,weight:"light",packable:true,warmthRatio:1,waterproof:3,moisture:3,fit:{skiing:10,snowboarding:9,hiking:9,snowshoeing:9,fishing:8,cross_country_ski:9,day_hike:9}},
      {brand:"Norrøna",model:"Falketind Gore-Tex",price:500,tempRange:[-15,55],breathability:9,windResist:10,weight:"light",packable:true,warmthRatio:1,waterproof:3,moisture:3,fit:{skiing:10,snowboarding:9,snowshoeing:10,fishing:9,cross_country_ski:9,day_hike:9}},
      {brand:"FootJoy",model:"HydroLite Rain Shell",price:150,tempRange:[40,85],breathability:7,windResist:8,weight:"light",packable:true,warmthRatio:1,waterproof:3,moisture:4,fit:{golf:10,hiking:6,day_hike:6}},
    ],
  },
  lower: {
    base_layer: [
      {brand:"Patagonia",model:"Cap Cool Trail Tights",price:79,tempRange:[45,85],breathability:10,windResist:1,weight:"ultralight",warmthRatio:3,waterproof:0,moisture:10,fit:{running:10,hiking:9,cycling:9}},
      {brand:"Smartwool",model:"Merino 250 Bottom",price:100,tempRange:[0,40],breathability:7,windResist:2,weight:"light",warmthRatio:8,waterproof:0,moisture:9,fit:{skiing:10,snowboarding:10,snowshoeing:10,fishing:9,cross_country_ski:9}},
      {brand:"Patagonia",model:"Capilene MW Bottoms",price:59,tempRange:[10,45],breathability:9,windResist:2,weight:"ultralight",warmthRatio:6,waterproof:0,moisture:9,fit:{skiing:8,hiking:8,cross_country_ski:9,day_hike:8}},
      {brand:"Icebreaker",model:"200 Oasis Leggings",price:85,tempRange:[5,45],breathability:8,windResist:2,weight:"light",warmthRatio:7,waterproof:0,moisture:9,fit:{skiing:9,snowboarding:9,snowshoeing:9,fishing:8,cross_country_ski:8}},
      {brand:"Arc'teryx",model:"Sabre AR Pant",price:500,tempRange:[-20,40],breathability:7,windResist:10,weight:"mid",warmthRatio:5,waterproof:3,moisture:3,fit:{skiing:10,snowboarding:9,snowshoeing:9,fishing:9}},
      {brand:"The North Face",model:"Freedom Insulated Pant",price:200,tempRange:[-15,35],breathability:5,windResist:9,weight:"mid",warmthRatio:7,waterproof:3,moisture:3,fit:{skiing:9,snowboarding:10,snowshoeing:8,fishing:8}},
      {brand:"Lululemon",model:"ABC Jogger",price:128,tempRange:[45,85],breathability:8,windResist:3,weight:"light",warmthRatio:3,waterproof:0,moisture:7,fit:{golf:9,hiking:7,day_hike:7,running:6}},
      {brand:"Rapha",model:"Core Cargo Bib Shorts",price:150,tempRange:[55,95],breathability:10,windResist:1,weight:"ultralight",warmthRatio:1,waterproof:0,moisture:10,fit:{cycling:10,road_cycling:10}},
      {brand:"Nike",model:"Dri-FIT Challenger Shorts",price:50,tempRange:[50,95],breathability:10,windResist:1,weight:"ultralight",warmthRatio:1,waterproof:0,moisture:10,fit:{running:10,hiking:7,golf:7}},
    ],
  },
  footwear: [
    {brand:"Salomon",model:"S/Pro MV 100",price:650,tempRange:[-20,35],breathability:3,windResist:9,weight:"heavy",warmthRatio:6,waterproof:3,moisture:3,fit:{skiing:10}},
    {brand:"Scarpa",model:"F1 LT",price:700,tempRange:[-20,30],breathability:4,windResist:9,weight:"heavy",warmthRatio:7,waterproof:3,moisture:3,fit:{skiing:9,snowboarding:8,snowshoeing:9}},
    {brand:"Merrell",model:"Moab 3",price:120,tempRange:[30,90],breathability:7,windResist:5,weight:"mid",warmthRatio:4,waterproof:2,moisture:6,fit:{hiking:10,day_hike:10,fishing:8,golf:7}},
    {brand:"Hoka",model:"Clifton 9",price:145,tempRange:[35,95],breathability:8,windResist:3,weight:"light",warmthRatio:3,waterproof:0,moisture:7,fit:{running:10,cycling:5}},
    {brand:"Salomon",model:"RC 10 Prolink XC Boot",price:300,tempRange:[-5,35],breathability:4,windResist:8,weight:"mid",warmthRatio:5,waterproof:2,moisture:5,fit:{cross_country_ski:10}},
    {brand:"MSR",model:"Lightning Ascent Boot Combo",price:300,tempRange:[-10,35],breathability:3,windResist:8,weight:"heavy",warmthRatio:7,waterproof:3,moisture:3,fit:{snowshoeing:10,hiking:6}},
    {brand:"Simms",model:"Freestone Wading Boot",price:200,tempRange:[-15,75],breathability:2,windResist:8,weight:"heavy",warmthRatio:5,waterproof:3,moisture:3,fit:{fishing:10}},
    {brand:"ECCO",model:"Biom G5 Golf Shoe",price:250,tempRange:[40,95],breathability:6,windResist:5,weight:"mid",warmthRatio:3,waterproof:2,moisture:6,fit:{golf:10,hiking:5}},
    {brand:"Specialized",model:"Torch 1.0 Road Shoe",price:150,tempRange:[40,95],breathability:8,windResist:3,weight:"light",warmthRatio:2,waterproof:0,moisture:7,fit:{cycling:10,road_cycling:10}},
  ],
  headgear: [
    {brand:"Smith",model:"Vantage MIPS Helmet",price:280,tempRange:[-20,45],breathability:5,windResist:9,weight:"mid",warmthRatio:5,waterproof:1,moisture:4,fit:{skiing:10,snowboarding:10}},
    {brand:"Buff",model:"Merino Wool Beanie",price:30,tempRange:[-10,45],breathability:6,windResist:4,weight:"ultralight",warmthRatio:6,waterproof:0,moisture:7,fit:{hiking:9,snowshoeing:9,fishing:9,cross_country_ski:9,day_hike:8}},
    {brand:"Nike",model:"Dri-FIT Running Cap",price:25,tempRange:[40,95],breathability:9,windResist:2,weight:"ultralight",warmthRatio:2,waterproof:0,moisture:9,fit:{running:10,golf:8,hiking:6}},
    {brand:"Bontrager",model:"Helmet",price:130,tempRange:[30,95],breathability:8,windResist:2,weight:"light",warmthRatio:2,waterproof:0,moisture:7,fit:{cycling:10,road_cycling:10}},
  ],
  handwear: [
    {brand:"Outdoor Research",model:"Stormtracker Gloves",price:90,tempRange:[5,45],breathability:6,windResist:8,weight:"light",warmthRatio:6,waterproof:2,moisture:5,fit:{skiing:9,snowboarding:9,hiking:7,snowshoeing:9}},
    {brand:"Hestra",model:"Fall Line Gloves",price:180,tempRange:[-15,25],breathability:4,windResist:10,weight:"mid",warmthRatio:8,waterproof:3,moisture:3,fit:{skiing:10,snowboarding:10,snowshoeing:9,fishing:9}},
    {brand:"Black Diamond",model:"Wind Hood Gridtech Gloves",price:40,tempRange:[35,65],breathability:8,windResist:5,weight:"light",warmthRatio:3,waterproof:0,moisture:7,fit:{running:8,cycling:8,hiking:8,day_hike:8,cross_country_ski:7,road_cycling:8}},
    {brand:"FootJoy",model:"WeatherSof Golf Glove",price:20,tempRange:[40,95],breathability:6,windResist:3,weight:"ultralight",warmthRatio:2,waterproof:0,moisture:6,fit:{golf:10}},
    {brand:"Pearl Izumi",model:"Summit Gel Glove",price:35,tempRange:[45,90],breathability:8,windResist:4,weight:"ultralight",warmthRatio:2,waterproof:0,moisture:7,fit:{cycling:9,road_cycling:10,running:6}},
    {brand:"OR",model:"Backstop Sensor Gloves",price:45,tempRange:[25,60],breathability:7,windResist:7,weight:"light",warmthRatio:5,waterproof:1,moisture:6,fit:{running:8,hiking:8,day_hike:8,fishing:8,cross_country_ski:8}},
  ],
};

// ──────────────────────────────────────────────────────────────────────
// Scenario catalog
// ──────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  label: string;
  activity: string;
  tempF: number;
  humidity: number;
  windMph: number;
  durationHr: number;
  expectedReality: string;
}

const SCENARIOS: Scenario[] = [
  // ─── COLD (C1–C7) ──────────────────────────────────────────────────
  { id: 'C1', label: '-20°F skiing / extreme cold',        activity: 'skiing',       tempF: -20, humidity: 30, windMph: 8,  durationHr: 4, expectedReality: 'Severe cold. Adequate gear should hold; CDI may reach impairment without heaviest kit.' },
  { id: 'C2', label: '16°F Breck baseline',                 activity: 'skiing',       tempF: 16,  humidity: 40, windMph: 10, durationHr: 6, expectedReality: 'Standard ski day. Normal 3.4 CLO kit should pass comfort gates cleanly.' },
  { id: 'C3', label: '45°F warm-cold shoulder',             activity: 'day_hike',     tempF: 45,  humidity: 60, windMph: 5,  durationHr: 4, expectedReality: 'Mild. Light kit should easily pass. Over-insulation = sweat trap.' },
  { id: 'C4', label: '30°F high-wind exposed skiing',       activity: 'skiing',       tempF: 30,  humidity: 50, windMph: 25, durationHr: 5, expectedReality: 'Wind chill dominates. Shell integrity matters; HLR likely elevated on lifts.' },
  { id: 'C5', label: '25°F XC skiing (high MET)',           activity: 'cross_country_ski', tempF: 25, humidity: 40, windMph: 5, durationHr: 3, expectedReality: 'High aerobic output. Over-insulation = soaking. Should run warm.' },
  { id: 'C6', label: '10°F snowshoeing / cold exertion',    activity: 'snowshoeing',  tempF: 10,  humidity: 35, windMph: 8,  durationHr: 4, expectedReality: 'Moderate exertion in cold. Balance between hypothermia and sweat saturation.' },
  { id: 'C7', label: '-10°F ice fishing / stationary cold', activity: 'fishing',      tempF: -10, humidity: 40, windMph: 10, durationHr: 5, expectedReality: 'Sedentary extreme cold. HLR should be highest risk; MR minimal.' },

  // ─── HOT (H1–H5) ───────────────────────────────────────────────────
  { id: 'H1', label: '95°F humid cycling',                  activity: 'road_cycling', tempF: 95,  humidity: 75, windMph: 5,  durationHr: 2, expectedReality: 'Humid heat stress. Evap limited; CDI should climb. Risk of heat exhaustion.' },
  { id: 'H2', label: '85°F dry cycling',                    activity: 'road_cycling', tempF: 85,  humidity: 35, windMph: 5,  durationHr: 3, expectedReality: 'Dry heat. Evaporative cooling works well. Should pass comfort.' },
  { id: 'H3', label: '75°F 90% RH running',                 activity: 'running',      tempF: 75,  humidity: 90, windMph: 3,  durationHr: 1.5, expectedReality: 'High humidity + high MET. Evap ceiling hit; CDI climbs despite modest temp.' },
  { id: 'H4', label: '105°F desert hiking',                 activity: 'day_hike',     tempF: 105, humidity: 20, windMph: 8,  durationHr: 3, expectedReality: 'Extreme heat, dry. Sweat rate extreme. Hydration-bound, but CDI should climb.' },
  { id: 'H5', label: '90°F humid golf',                     activity: 'golf',         tempF: 90,  humidity: 70, windMph: 4,  durationHr: 4, expectedReality: 'Low MET but prolonged humid heat. Gradual CDI climb expected.' },

  // ─── EDGE (E1–E7) ──────────────────────────────────────────────────
  { id: 'E1', label: 'Breck lightest candidate',            activity: 'skiing',       tempF: 16,  humidity: 40, windMph: 10, durationHr: 6, expectedReality: 'Lightest kit at Breck. Should fail comfort gates or fire CMs.' },
  { id: 'E2', label: 'Breck mid candidate',                 activity: 'skiing',       tempF: 16,  humidity: 40, windMph: 10, durationHr: 6, expectedReality: 'Median kit at Breck. Should pass clean with minor guidance.' },
  { id: 'E3', label: 'Breck heaviest candidate',            activity: 'skiing',       tempF: 16,  humidity: 40, windMph: 10, durationHr: 6, expectedReality: 'Heaviest kit at Breck. May overheat during active phases.' },
  { id: 'E4', label: 'Short trip (1 hr ski)',               activity: 'skiing',       tempF: 16,  humidity: 40, windMph: 10, durationHr: 1, expectedReality: 'Short duration. MR should not accumulate. Should pass easily.' },
  { id: 'E5', label: 'Long trip (10 hr ski)',               activity: 'skiing',       tempF: 16,  humidity: 40, windMph: 10, durationHr: 10, expectedReality: 'Very long. Cumulative MR pushes limits; CMs expected.' },
  { id: 'E6', label: 'Cool mild hike (60°F)',               activity: 'day_hike',     tempF: 60,  humidity: 50, windMph: 5,  durationHr: 3, expectedReality: 'Sweet spot. No stress, no CMs, minimal warnings.' },
  { id: 'E7', label: 'Humid night fishing (70°F 95%)',      activity: 'fishing',      tempF: 70,  humidity: 95, windMph: 3,  durationHr: 4, expectedReality: 'Humid stagnant. Low MET. Comfort but watch for clamminess.' },
];

// ──────────────────────────────────────────────────────────────────────
// Ensemble selection: use enumerateCandidates to build real ensembles per scenario
// ──────────────────────────────────────────────────────────────────────

function buildScenarioInput(s: Scenario, userCandidateIdx: number): EngineInput | null {
  const catalog = convertGearDB(UNIVERSAL_GEAR_DB, { activity: s.activity, minFitScore: 5 });
  const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: s.tempF, activity: s.activity });
  if (candidates.length === 0) return null;

  // Sort by CLO; pick user based on index (0=lightest, -1=heaviest, middle=median)
  const sorted = [...candidates].sort((a, b) => a.total_clo - b.total_clo);
  const userIdx = userCandidateIdx === -1 ? sorted.length - 1 :
                  userCandidateIdx === -2 ? Math.floor(sorted.length / 2) :
                  Math.min(userCandidateIdx, sorted.length - 1);
  const userEnsemble = sorted[userIdx]!;

  return {
    activity: {
      activity_id: s.activity,
      duration_hr: s.durationHr,
      snow_terrain: (s.activity === 'skiing' || s.activity === 'snowboarding') ? 'groomers' : undefined,
      segments: [{
        segment_id: 'seg-1',
        segment_label: s.label,
        activity_id: s.activity,
        duration_hr: s.durationHr,
        weather: [{
          t_start: 0,
          t_end: s.durationHr * 3600,
          temp_f: s.tempF,
          humidity: s.humidity,
          wind_mph: s.windMph,
          precip_probability: 0,
        }],
      }],
    },
    location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
    biometrics: { sex: 'male', weight_lb: 180 },
    user_ensemble: userEnsemble,
    strategy_candidates: candidates,
  };
}

function userIdxForScenario(s: Scenario): number {
  // E1 = lightest, E2 = median, E3 = heaviest, others = median
  if (s.id === 'E1') return 0;
  if (s.id === 'E2') return -2;  // median
  if (s.id === 'E3') return -1;  // heaviest
  return -2;  // default: median
}

// ──────────────────────────────────────────────────────────────────────
// Output formatter
// ──────────────────────────────────────────────────────────────────────

function pad(s: string | number, n: number): string {
  const str = String(s);
  return str.length >= n ? str.slice(0, n) : str + ' '.repeat(n - str.length);
}

function fmtRow(s: Scenario, r: EngineOutput): string {
  const userSum = r.four_pill.your_gear.trajectory_summary;
  const winSum = r.four_pill.optimal_gear.trajectory_summary;
  const userCLO = r.four_pill.your_gear.ensemble.total_clo;
  const userIm = r.four_pill.your_gear.ensemble.ensemble_im;
  const winCLO = r.four_pill.optimal_gear.ensemble.total_clo;
  const qualified = r.strategy.winner_qualified ? 'Y' : 'n';
  const warnings = r.strategy.winner_warnings?.length ?? 0;
  const cms = r.critical_moments.length;
  const windows = r.strategy_windows.length;

  return `  ${pad(s.id, 3)} ${pad(s.label, 38)} | USR CLO=${pad(userCLO.toFixed(1), 4)}/im=${pad(userIm.toFixed(2), 4)} MR=${pad(userSum.peak_MR.toFixed(1), 4)} CDI=${pad(userSum.peak_CDI.toFixed(1), 4)} | WIN CLO=${pad(winCLO.toFixed(1), 4)} MR=${pad(winSum.peak_MR.toFixed(1), 4)} CDI=${pad(winSum.peak_CDI.toFixed(1), 4)} | Q=${qualified} W=${warnings} CMs=${cms}/${windows}w | ${pad(userSum.peak_clinical_stage, 20)}`;
}

// ──────────────────────────────────────────────────────────────────────
// The matrix
// ──────────────────────────────────────────────────────────────────────

describe('ADVERSARIAL MATRIX: 19 scenarios across regimes (real gear, diagnostic)', () => {
  it('runs all scenarios and emits diagnostic table', () => {
    console.log('\n\n════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('  LC6 ADVERSARIAL MATRIX');
    console.log('  Legend: USR=user-selected kit, WIN=winner-selected kit. Q=qualified W=warnings_count CMs=critical_moments/windows');
    console.log('════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log(`  ${pad('ID', 3)} ${pad('SCENARIO', 38)} | USER GEAR / METRICS                 | WINNER / METRICS              | OUTPUT         | CLINICAL STAGE`);
    console.log('  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────');

    for (const s of SCENARIOS) {
      try {
        const input = buildScenarioInput(s, userIdxForScenario(s));
        if (!input) {
          console.log(`  ${pad(s.id, 3)} ${pad(s.label, 38)} | NO CANDIDATES ENUMERATED (gear DB may not cover activity)`);
          console.log(`      → expected: ${s.expectedReality}`);
          console.log('');
          continue;
        }
        const result = evaluate(input);
        console.log(fmtRow(s, result));

        const warns = result.strategy.winner_warnings ?? [];
        for (const w of warns) {
          console.log(`      ⚠  ${w.length > 110 ? w.slice(0, 110) + '…' : w}`);
        }
        for (const cm of result.critical_moments) {
          console.log(`      ◆  [${cm.prevents}] ${cm.message.slice(0, 110)}`);
        }
        console.log(`      → expected: ${s.expectedReality}`);
        console.log('');
      } catch (err) {
        console.log(`  ${pad(s.id, 3)} ${pad(s.label, 38)} | EVAL ERROR: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`);
        console.log('');
      }
    }

    console.log('════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════\n');
  });
});
