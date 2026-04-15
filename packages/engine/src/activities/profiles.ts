// Activity profile data: phase definitions, sweat profiles, gear score baselines.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.
//
// NOMENCLATURE NOTE (OQ-029): LC5 uses type:"cyclic" for activities with
// duty-cycle work/rest patterns (golf, fishing, cycling, kayaking) AND for
// true lap-based activities (resort skiing). "Cyclic" here means
// "duty-cycle modeled" not "lap-based." OQ-029 tracks future rename consideration.

/**
 * Per-activity sweat profile parameters.
 *
 * Sweat rates (g/hr) by intensity level + coverage multiplier + intermittency.
 * Sources: Bergh & Forsberg 1992; ACSM Sawka 2007; Compendium of Physical Activities.
 *
 * - low/moderate/high/very_high: sweat rate (g/hr) at given intensity
 * - coverageMul: skin coverage multiplier (1.0 = standard; 1.4 = full ski suit)
 * - intermittency: fraction of time spent at active intensity (0-1)
 *
 * LC5 risk_functions.js lines 1409-1434.
 */
export interface ActivitySweatProfile {
  low: number;
  moderate: number;
  high: number;
  very_high: number;
  coverageMul: number;
  intermittency: number;
}

export const ACTIVITY_SWEAT_PROFILES: Readonly<Record<string, ActivitySweatProfile>> = {
  running:           { low: 250, moderate: 600, high: 1000, very_high: 1400, coverageMul: 0.85, intermittency: 1.0 },
  // MFC #2 validated: S₀ per Bergh & Forsberg (1992), ACSM Sawka (2007)
  // f_cov=1.40: full-body tight-fitting XC suit. f_int=0.80: terrain undulation recovery.
  // Last validated: 2026-03-06, 18°F/10mph/30%RH/170lb scenario.
  cross_country_ski: { low: 120, moderate: 350, high:  600, very_high:  900, coverageMul: 1.40, intermittency: 0.80 },
  day_hike:          { low: 180, moderate: 400, high:  700, very_high: 1000, coverageMul: 1.0,  intermittency: 0.9 },
  hiking:            { low: 180, moderate: 400, high:  700, very_high: 1000, coverageMul: 1.0,  intermittency: 0.9 },
  backpacking:       { low: 200, moderate: 450, high:  750, very_high: 1050, coverageMul: 1.15, intermittency: 0.85 },
  skiing:            { low: 120, moderate: 300, high:  550, very_high:  800, coverageMul: 1.4,  intermittency: 0.55 },
  snowboarding:      { low: 120, moderate: 300, high:  550, very_high:  800, coverageMul: 1.4,  intermittency: 0.50 },
  mountain_biking:   { low: 180, moderate: 450, high:  800, very_high: 1150, coverageMul: 0.95, intermittency: 0.75 },
  road_cycling:      { low: 150, moderate: 380, high:  700, very_high: 1050, coverageMul: 0.80, intermittency: 0.95 },
  gravel_biking:     { low: 170, moderate: 420, high:  750, very_high: 1100, coverageMul: 0.90, intermittency: 0.85 },
  climbing:          { low: 150, moderate: 350, high:  650, very_high:  900, coverageMul: 0.90, intermittency: 0.60 },
  bouldering:        { low: 130, moderate: 320, high:  600, very_high:  850, coverageMul: 0.85, intermittency: 0.45 },
  snowshoeing:       { low: 170, moderate: 420, high:  720, very_high: 1000, coverageMul: 1.2,  intermittency: 0.9 },
  camping:           { low:  80, moderate: 150, high:  250, very_high:  400, coverageMul: 1.0,  intermittency: 0.3 },
  fishing:           { low:  70, moderate: 130, high:  220, very_high:  350, coverageMul: 0.95, intermittency: 0.25 },
  golf:              { low: 150, moderate: 350, high:  600, very_high:  900, coverageMul: 0.90, intermittency: 0.50 },
  skateboarding:     { low: 120, moderate: 280, high:  500, very_high:  750, coverageMul: 0.80, intermittency: 0.55 },
  onewheel:          { low:  50, moderate: 100, high:  180, very_high:  280, coverageMul: 0.85, intermittency: 0.70 },
  kayaking:          { low: 100, moderate: 280, high:  500, very_high:  750, coverageMul: 1.1,  intermittency: 0.85 },
  paddle_boarding:   { low:  90, moderate: 250, high:  450, very_high:  700, coverageMul: 0.95, intermittency: 0.80 },
  hunting:           { low: 100, moderate: 280, high:  500, very_high:  750, coverageMul: 1.0,  intermittency: 0.40 },
};

/**
 * Single phase definition within an INTERMITTENT_PHASE_PROFILES entry.
 */
export interface PhaseDefinition {
  name: string;
  durMin?: number;             // for type:"cyclic" — phase duration in minutes
  pct?: number;                // for type:"linear" — fraction of trip duration (0-1)
  intensity: 'low' | 'moderate' | 'high' | 'very_high';
  windType: string;
  canVent: boolean;
}

/**
 * Phase profile for an activity. Two types:
 *   - "cyclic": repeating duty cycle (work/rest), phases sum to one cycle
 *   - "linear": single trip traversal, phases scale by pct
 *
 * NOMENCLATURE NOTE (OQ-029): "cyclic" here means "duty-cycle modeled" not "lap-based."
 * Activities like golf and fishing use "cyclic" because they have repeating work-rest
 * patterns (cast/wait, walk/wait), not because golfers go in laps.
 */
export interface PhaseProfile {
  type: 'cyclic' | 'linear';
  phases: PhaseDefinition[];
}

/**
 * Phase profiles for intermittent activities — Compendium of Physical Activities (Ainsworth et al., 2011).
 *
 * Replaces flat intensity × intermittency approximation with explicit per-phase duty cycle physics.
 *
 * LC5 risk_functions.js lines 1453-1594.
 */
export const INTERMITTENT_PHASE_PROFILES: Readonly<Record<string, PhaseProfile>> = {
  // PHY-031: Unified resort terrain profiles — ski = snowboard per terrain
  // Lift ride = 7 min (high-speed quad western avg). Mogul run 10→7 (SkiTalk/AlpineZone data).
  // Per-cycle physics phases only (run+lift). Transition+line+rest handled by cycleOverride.
  groomers: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 3, intensity: 'moderate', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7, intensity: 'low',      windType: 'ambient',         canVent: false },
  ]},
  moguls: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 7, intensity: 'very_high', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7, intensity: 'low',       windType: 'ambient',         canVent: false },
  ]},
  trees: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 10, intensity: 'high', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7,  intensity: 'low',  windType: 'ambient',         canVent: false },
  ]},
  bowls: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 6, intensity: 'high', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7, intensity: 'low',  windType: 'ambient',         canVent: false },
  ]},
  park: { type: 'cyclic', phases: [
    { name: 'run',  durMin: 4, intensity: 'moderate', windType: 'skiing_descent', canVent: false },
    { name: 'lift', durMin: 7, intensity: 'low',      windType: 'ambient',         canVent: false },
  ]},
  // Backcountry ski/splitboard: skinning → summit transition → descent (linear, not cyclic)
  // Skinning ≈ vigorous XC (Compendium 19180, 8.0 METs) with heavy gear → very_high
  // Transition: stopped, near-basal. Descent: moderate-high skiing (Compendium 19150, 5.3 METs)
  skiing_bc: { type: 'linear', phases: [
    { name: 'skinning',   pct: 0.55, intensity: 'very_high', windType: 'walking', canVent: true },
    { name: 'transition', pct: 0.05, intensity: 'low',       windType: 'ridge',   canVent: true },
    { name: 'descent',    pct: 0.40, intensity: 'high',      windType: 'speed',   canVent: false },
  ]},
  // Golf walking: 4 min walk+swing + 11 min wait → ~4 holes/hr
  // Source: Compendium 15255 (golf, walking, carrying clubs 4.3 METs)
  golf_walk: { type: 'cyclic', phases: [
    { name: 'walk_swing', durMin: 4,  intensity: 'moderate', windType: 'ambient', canVent: true },
    { name: 'wait',       durMin: 11, intensity: 'low',      windType: 'ambient', canVent: true },
  ]},
  // Golf cart: 0.5 min swing + 14.5 min ride/wait → ~4 holes/hr
  // Source: Compendium 15238 (golf, riding cart 3.5 METs average)
  golf_cart: { type: 'cyclic', phases: [
    { name: 'swing',     durMin: 0.5,  intensity: 'moderate', windType: 'calm', canVent: true },
    { name: 'ride_wait', durMin: 14.5, intensity: 'low',      windType: 'cart', canVent: true },
  ]},
  // Fishing shore/boat (stationary): 2.5 min cast/retrieve + 10 min wait
  // Source: Compendium 04001 (fishing, general 3.5 METs)
  fishing_shore: { type: 'cyclic', phases: [
    { name: 'cast', durMin: 2.5, intensity: 'moderate', windType: 'ambient', canVent: true },
    { name: 'wait', durMin: 10,  intensity: 'low',      windType: 'ambient', canVent: true },
  ]},
  // Fishing wading: 5 min wade/reposition + 2.5 min cast + 5 min wait
  // Source: Compendium 04050 (fishing in stream, wading 6.0 METs)
  // Wading against current raises metabolic rate significantly vs shore fishing
  fishing_wading: { type: 'cyclic', phases: [
    { name: 'wade', durMin: 5,   intensity: 'moderate', windType: 'ambient', canVent: true },
    { name: 'cast', durMin: 2.5, intensity: 'moderate', windType: 'ambient', canVent: true },
    { name: 'wait', durMin: 5,   intensity: 'low',      windType: 'ambient', canVent: true },
  ]},
  // Kayaking — creek/whitewater: 10 min rapids + 3 min eddy (spray deck sealed throughout)
  // Compendium 18115: whitewater kayaking = 8.0 METs → very_high; eddy = near-basal recovery
  // Spray deck remains sealed in eddy — no venting opportunity. Sheltered eddy = calm wind.
  // Primary creek vs lake differentiator is immersion risk (external wetting), not sweat alone.
  kayaking_creek: { type: 'cyclic', phases: [
    { name: 'rapids', durMin: 10, intensity: 'very_high', windType: 'kayak', canVent: false },
    { name: 'eddy',   durMin: 3,  intensity: 'low',       windType: 'calm',  canVent: false },
  ]},
  // Kayaking — lake/flatwater: 15 min sustained paddle + 7.5 min drift
  // Compendium 18090: kayaking moderate = 5.0 METs. Drift allows passive venting.
  kayaking_lake: { type: 'cyclic', phases: [
    { name: 'paddle', durMin: 15,  intensity: 'high', windType: 'kayak',   canVent: false },
    { name: 'drift',  durMin: 7.5, intensity: 'low',  windType: 'ambient', canVent: true },
  ]},
  // Kayaking — ocean/sea: 20 min sustained paddle + 5 min rest (swell, current, longer sets)
  // More continuous effort than lake; less rest. Wind exposure on open water.
  kayaking_ocean: { type: 'cyclic', phases: [
    { name: 'paddle', durMin: 20, intensity: 'high', windType: 'kayak',   canVent: false },
    { name: 'rest',   durMin: 5,  intensity: 'low',  windType: 'ambient', canVent: true },
  ]},
  // SUP — lake: 12 min paddle + 6 min rest. Upright posture, full-body balance.
  // Compendium 18095: paddleboarding = 6.0 METs. Less upper-body enclosure → better ventilation.
  // coverageMul 0.95 (vs kayak 1.1) reflects more exposed upper body on SUP.
  sup_lake: { type: 'cyclic', phases: [
    { name: 'paddle', durMin: 12, intensity: 'moderate', windType: 'kayak',   canVent: true },
    { name: 'rest',   durMin: 6,  intensity: 'low',      windType: 'ambient', canVent: true },
  ]},
  // SUP — ocean: 18 min sustained + 4 min rest. Ocean touring demands higher sustained output.
  sup_ocean: { type: 'cyclic', phases: [
    { name: 'paddle', durMin: 18, intensity: 'high', windType: 'kayak',   canVent: false },
    { name: 'rest',   durMin: 4,  intensity: 'low',  windType: 'ambient', canVent: true },
  ]},
  // SUP — creek: whitewater SUP, very high intensity, sealed position for balance
  sup_creek: { type: 'cyclic', phases: [
    { name: 'rapids', durMin: 10, intensity: 'very_high', windType: 'kayak', canVent: false },
    { name: 'eddy',   durMin: 3,  intensity: 'low',       windType: 'calm',  canVent: false },
  ]},
  // Road cycling — flat: sustained high effort, ~15% stops (lights, junctions)
  // Compendium 01015 (14-16 mph = 10.0 METs). Flat = no climb/descent intensity swings.
  // cycling_speed wind throughout — consistent forward-motion wind cooling.
  cycling_road_flat: { type: 'cyclic', phases: [
    { name: 'ride', durMin: 51, intensity: 'high', windType: 'cycling_speed', canVent: true },
    { name: 'stop', durMin: 9,  intensity: 'low',  windType: 'ambient',       canVent: true },
  ]},
  // Gravel cycling — flat: slightly lower intensity than road flat, variable surface
  // Compendium 01013 (12-14 mph = 8.0 METs). ~20% recovery/variable terrain.
  cycling_gravel_flat: { type: 'cyclic', phases: [
    { name: 'ride',     durMin: 48, intensity: 'high',     windType: 'cycling_speed', canVent: true },
    { name: 'recovery', durMin: 12, intensity: 'moderate', windType: 'cycling_speed', canVent: true },
  ]},
  // Road cycling hilly: climb/flat/descent cycle ~45 min
  // Source: Compendium 01015 (cycling 14-16 mph, 10.0 METs), 01013 (12-14 mph, 8.0 METs),
  // 01009 (coasting/descent, ~3.0 METs)
  cycling_road_hilly: { type: 'cyclic', phases: [
    { name: 'climb',   durMin: 18,   intensity: 'very_high', windType: 'headwind_low',  canVent: true },
    { name: 'flat',    durMin: 13.5, intensity: 'high',      windType: 'cycling_speed', canVent: true },
    { name: 'descent', durMin: 13.5, intensity: 'low',       windType: 'descent_speed', canVent: false },
  ]},
  // Gravel cycling hilly: longer climbs, slower descents ~50 min cycle
  // Source: Compendium 01009 adjusted for gravel surface resistance
  cycling_gravel_hilly: { type: 'cyclic', phases: [
    { name: 'climb',   durMin: 22.5, intensity: 'high', windType: 'headwind_low',  canVent: true },
    { name: 'flat',    durMin: 12.5, intensity: 'high', windType: 'cycling_speed', canVent: true },
    { name: 'descent', durMin: 15,   intensity: 'low',  windType: 'descent_speed', canVent: false },
  ]},
  // XC skiing: sustained push phase + glide/descent phase (linear, not cyclic)
  // Compendium 19180: XC ski vigorous = 9.0 METs (push/uphill); 19170: moderate = 6.8 METs (flat/glide)
  // Descent glide sealed: speed wind, low vent opportunity. Push/flat: vented via collar/zipper.
  // Phase split: ~55% push (uphill+flat effort), ~5% transition, ~40% glide/descent
  // Same linear sub-step structure as skiing_bc — fabric-cap drain correctly bounds long trips.
  xc_ski: { type: 'linear', phases: [
    { name: 'push',       pct: 0.55, intensity: 'high',     windType: 'walking', canVent: true },
    { name: 'transition', pct: 0.05, intensity: 'moderate', windType: 'walking', canVent: true },
    { name: 'glide',      pct: 0.40, intensity: 'moderate', windType: 'speed',   canVent: false },
  ]},
  // Snowshoeing: sustained uphill + descent (linear, same structure as XC ski / BC ski)
  // Compendium 17152: snowshoeing uphill = 8.3 METs (high); flat/descent ~5.3 METs (moderate)
  // Ascent: vented (collar, vent zipper accessible). Descent: sealed against speed wind.
  // Phase split: 60% ascent / 40% descent (standard out-and-back mountain profile)
  snowshoeing: { type: 'linear', phases: [
    { name: 'ascent',  pct: 0.60, intensity: 'high',     windType: 'walking', canVent: true },
    { name: 'descent', pct: 0.40, intensity: 'moderate', windType: 'ambient', canVent: false },
  ]},
};

/**
 * Per-slot generic gear scores — realistic "closet gear" baseline.
 *
 * Used as fallback when user has not entered specific gear (PHY-025).
 *
 * Note: Session 9b/9c will only use `.shell.windResist` from this constant
 * (in the steady-state and cyclic paths). Other fields are preserved for
 * future use in other engine functions.
 *
 * LC5 risk_functions.js lines 2217-2226.
 */
export interface GearSlotScores {
  breathability: number;
  moisture: number;
  windResist: number;
  warmthRatio: number;
  waterproof: number;
}

export const GENERIC_GEAR_SCORES_BY_SLOT: Readonly<Record<string, GearSlotScores>> = {
  base:       { breathability: 3, moisture: 2, windResist: 1, warmthRatio: 2, waterproof: 0 },
  mid:        { breathability: 4, moisture: 3, windResist: 1, warmthRatio: 5, waterproof: 0 },
  insulative: { breathability: 4, moisture: 3, windResist: 1, warmthRatio: 5, waterproof: 0 },
  shell:      { breathability: 2, moisture: 1, windResist: 8, warmthRatio: 1, waterproof: 2 },
  legs:       { breathability: 3, moisture: 2, windResist: 2, warmthRatio: 2, waterproof: 0 },
  legsBase:   { breathability: 3, moisture: 2, windResist: 1, warmthRatio: 2, waterproof: 0 },
  feet:       { breathability: 4, moisture: 3, windResist: 4, warmthRatio: 3, waterproof: 0 },
  head:       { breathability: 3, moisture: 2, windResist: 2, warmthRatio: 3, waterproof: 0 },
};
