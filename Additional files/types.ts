// ============================================================================
// @lc6/engine — Public API Types
// packages/engine/src/types.ts
//
// Canonical type definitions for evaluate(input: EngineInput): EngineOutput.
// Inviolable per Working Agreement v3 Rule #16.
// Shape changes require formal Architecture Document amendment.
//
// Source: LC6 Architecture Document v1.1 RATIFIED (2026-04-14)
// Session: 10a (types standalone)
// ============================================================================

// ============================================================================
// §4.1 — Enums
// ============================================================================

/**
 * Clinical stage detected per CDI v1.4 §4.2.
 * Cold-side stages anchor to Mayo/WMS/Castellani clinical criteria.
 * Heat-side stages anchor to ACSM 2023 heat illness classification.
 * Architecture v1.1 §4.1.
 */
export type ClinicalStage =
  | "thermal_neutral"
  | "cold_compensable"                // CDI 1–2: vasoconstriction, no shivering
  | "cold_intensifying"               // CDI 3–4: heavy vasoconstriction, T_core 35.5–36.5
  | "mild_hypothermia"                // CDI 5–6: shivering active, T_core 32–35
  | "mild_hypothermia_deteriorating"  // CDI 7–8: sustained vigorous shivering, T_core → 32
  | "severe_hypothermia"              // CDI 9–10: shivering ceased OR T_core ≤ 32
  | "heat_compensable"                // CDI 1–2: sweating, T_core ≤ 37.8
  | "heat_intensifying"               // CDI 3–4: heavy sweating, T_core 37.8–38.5
  | "heat_exhaustion"                 // CDI 5–6: heavy sweating + dizziness, T_core 38.5–39.5
  | "heat_exhaustion_deteriorating"   // CDI 7–8: T_core 39.5+, pre-CNS-impairment
  | "heat_stroke";                    // CDI 9–10: T_core ≥ 40 OR projected ≥ 40

/**
 * What drove the CDI value at this TrajectoryPoint.
 * Architecture v1.1 §4.1.
 */
export type CdiBasis = "current_stage" | "progression_forecast" | "both";

/**
 * Thermal regime classification.
 * Derived from heat balance: S < 0 → cold, S > 0 → heat, S ≈ 0 → neutral.
 * Architecture v1.1 §4.2 (TrajectoryPoint.regime).
 */
export type Regime = "cold" | "heat" | "neutral";

/**
 * Which pathway binds (limits) thermal comfort.
 * Architecture v1.1 §4.2 (TrajectoryPoint.binding_pathway).
 *
 * - moisture: E_req > E_max (sweat accumulation is the constraint)
 * - heat_loss: Heat loss exceeds metabolic production (cold exposure)
 * - compound: Both moisture and heat loss are simultaneously constraining
 * - neutral: Neither pathway is binding
 */
export type BindingPathway = "moisture" | "heat_loss" | "compound" | "neutral";

// ============================================================================
// §4.2 — TrajectoryPoint (per-slice)
// ============================================================================

/**
 * CM trigger state for a single threshold.
 * Architecture v1.1 §4.2.
 */
export interface CmTriggerState {
  /** Whether the threshold has been crossed at this point. */
  threshold_crossed: boolean;
  /** Hours until projected crossing; null if not in next-slice window. */
  projected_crossing_eta: number | null;
}

/**
 * Venting state at a TrajectoryPoint.
 * Derived from LC5 vent-event model (TA v6 §28.3).
 * Architecture v1.1 §4.2 — "unchanged from v1.0."
 */
export interface VentingState {
  /** Whether venting is currently active. */
  active: boolean;
  /** Vent type if active. */
  type?: "pit_zip" | "chest_zip" | "full_open" | "hood_back" | "cuff_roll";
  /** Minutes since vent was opened. */
  elapsed_min?: number;
}

/**
 * EPOC transition state (PHY-050).
 * Two-component exponential decay: τ_fast ≈ 30s, τ_slow ≈ 120s.
 * Architecture v1.1 §4.2 — "unchanged from v1.0."
 * Source: TA v6 §28.4; Børsheim & Bahr 2003.
 */
export interface EpocState {
  /** Whether EPOC transition is active (post-exertion decay). */
  active: boolean;
  /** Seconds elapsed since activity change triggered EPOC. */
  elapsed_s: number;
  /** Current excess MET above rest from EPOC decay (W/m²). */
  excess_met_w_m2: number;
}

/**
 * Pack thermal modifier state (PHY-054).
 * Architecture v1.1 §4.2 — "unchanged from v1.0."
 * Source: TA v6 §26 (five effects: back-panel blockage 18% BSA,
 * strap CLO compression, pack-as-insulation, panel-type interaction,
 * pack-off chill flash).
 */
export interface PackState {
  /** Whether a pack is present. */
  present: boolean;
  /** Pack weight in lbs (drives Pandolf metabolic modifier). */
  weight_lb: number;
  /** Back-panel type affects blockage severity. */
  panel_type: "mesh" | "foam" | "contact" | "suspended";
  /** Fraction of BSA blocked by pack (typically 0.18). */
  blocked_bsa_frac: number;
  /** Whether pack was recently removed (chill flash active). */
  chill_flash_active: boolean;
}

/**
 * Per-slice engine output.
 * Architecture v1.1 §4.2 (verbatim).
 *
 * Each TrajectoryPoint corresponds to one evaluation cycle:
 *   - For cyclic activities (ski, hike): one run/lift cycle
 *   - For steady-state activities (fishing, camping): one 15-min timestep
 *   - For hourly activities (golf): one hour
 * Per Q1b ratified: data reused from calcIntermittentMoisture per-cycle output.
 */
export interface TrajectoryPoint {
  // ── Time ─────────────────────────────────────────────
  /** Seconds from trip start. */
  t: number;
  /** Which segment this point belongs to. */
  segment_id: string;

  // ── Converged body state (PHY-056) ───────────────────
  /** Mean skin temperature, °C, whole-body, converged. */
  T_skin: number;
  /** 3-slice trailing average of T_skin. */
  T_skin_smoothed: number;
  /** Instantaneous rate of skin temperature change, °C/hr. */
  dT_skin_dt: number;
  /** Smoothed rate of skin temperature change, °C/hr. */
  dT_skin_dt_smoothed: number;
  /** Predicted core temperature, °C. */
  T_core: number;
  /** Core temperature rate of change, °C/hr. */
  dT_core_dt: number;
  /** Clothing surface temperature, °C. */
  T_cl: number;
  /** Vasomotor state indicator, W/(m²·K). */
  h_tissue: number;

  // ── Heat balance terms (total-body W) ────────────────
  /** Metabolic heat production. */
  M: number;
  /** External mechanical work. */
  W: number;
  /** Convective heat loss. */
  C: number;
  /** Radiative heat loss. */
  R: number;
  /** Respiratory heat loss. */
  E_resp: number;
  /** Actual skin evaporative heat loss. */
  E_skin: number;
  /** Maximum evaporative capacity. */
  E_max: number;
  /** Required (demand) evaporative heat loss. */
  E_req: number;
  /** Heat storage rate. */
  S: number;
  /** S after shivering compensation (engine-physiology only). */
  S_net: number;
  /** Sweat demand, g/s. */
  SW_required: number;
  /** Shivering heat production, W. CDI uses as signal, not compensation. */
  Q_shiver: number;

  // ── Environmental coefficients ───────────────────────
  /** Effective wind speed, m/s (ambient + ground-speed if applicable). */
  V_effective: number;
  /** Convective heat transfer coefficient, W/(m²·K). */
  h_c: number;
  /** Mass transfer coefficient. */
  h_mass: number;
  /** Ambient air temperature, °C. */
  T_air: number;
  /** Mean radiant temperature, °C. v1: = T_air. */
  T_mrt: number;
  /** Relative humidity, 0–100. Per DEC-024 convention. */
  RH: number;
  /** Ambient vapor pressure, kPa. */
  P_a: number;

  // ── Clothing state ───────────────────────────────────
  /** Effective clothing thermal resistance, m²·K/W. */
  R_clo_effective: number;
  /** Effective clothing evaporative resistance, m²·kPa/W. */
  R_e_cl_effective: number;
  /** Ensemble Woodcock permeability index. */
  im_system: number;
  /** Vapor pressure deficit, kPa. */
  VPD: number;

  // ── Risk metrics ─────────────────────────────────────
  /** Moisture risk, 0–10. Single source of truth: calcIntermittentMoisture. */
  MR: number;
  /** Heat loss risk, 0–10. */
  HLR: number;
  /** Compound danger index, 0–10. Per v1.4 stage detection + progression. */
  CDI: number;
  /** Thermal regime at this point. */
  regime: Regime;
  /** Which pathway is binding at this point. */
  binding_pathway: BindingPathway;

  // ── v1.4 stage-detection fields ──────────────────────
  /** Current clinical stage per CDI v1.4 §4.2. */
  clinical_stage: ClinicalStage;
  /** What drove CDI value: stage floor, progression forecast, or both. */
  cdi_basis: CdiBasis;
  /** Hours to next-worse stage; null at terminal stage. */
  tau_to_next_stage: number | null;
  /** True if Q_shiver > 50W sustained for 5+ min. */
  q_shiver_sustained: boolean;

  // ── τ values (v1.3 retained, used by within-stage ramp) ──
  /** Time to cold core threshold crossing, hr. Null if not applicable. */
  tau_core_cold: number | null;
  /** Time to dexterity threshold crossing, hr. Null if not applicable. */
  tau_dex: number | null;
  /** Time to hot core threshold crossing, hr. Null if not applicable. */
  tau_core_hot: number | null;
  /** Time to impairment, hr. */
  tau_impair: number;

  // ── CM trigger states (per v1.4 §8.3) ────────────────
  cm_trigger: {
    /** T_core ≤ 35.0°C. */
    cold_core: CmTriggerState;
    /** T_skin ≤ 28.0°C. */
    cold_dex: CmTriggerState;
    /** T_core ≥ 38.5°C. */
    heat_core: CmTriggerState;
    /** Q_shiver > 50W sustained 5+ min. */
    shivering_sustained: CmTriggerState;
  };

  // ── Phase context ────────────────────────────────────
  /** Activity phase label (e.g., "run", "lift", "hour_1", "steady"). */
  phase: string;
  /** Venting state if applicable. */
  venting?: VentingState;
  /** EPOC transition state if in post-exertion decay. */
  epoc_state?: EpocState;
  /** Pack thermal modifier state if pack present. */
  pack_state?: PackState;
}

// ============================================================================
// §4.3 — SegmentSummary
// ============================================================================

/**
 * Per-segment aggregation of TrajectoryPoints.
 * Architecture v1.1 §4.3 (verbatim).
 */
export interface SegmentSummary {
  segment_id: string;
  segment_label: string;
  start_t: number;
  end_t: number;

  // Peak metrics over this segment
  peak_MR: number;
  peak_MR_at_t: number;
  peak_HLR: number;
  peak_HLR_at_t: number;
  peak_CDI: number;
  peak_CDI_at_t: number;
  peak_binding_pathway: BindingPathway;
  peak_regime: Regime;
  /** Highest-severity clinical stage observed in segment. NEW v1.1. */
  peak_clinical_stage: ClinicalStage;
  /** What drove peak CDI. NEW v1.1. */
  peak_cdi_basis: CdiBasis;

  /** CM cards fired during this segment. */
  cm_cards_fired: CmCard[];

  // Activity-class specific
  /** Whether this segment is stationary (MET < 2.0). */
  is_stationary: boolean;
  /** Hours of comfortable exposure remaining at current CLO (stationary only). */
  comfort_hours_remaining?: number;
}

// ============================================================================
// §4.4 — CmCard
// ============================================================================

/**
 * Trigger types for Critical Moment cards.
 * Architecture v1.1 §4.4.
 * v1.0 types retained; v1.4 stage-anchored types added.
 */
export type CmTriggerType =
  // Existing v1.0 trigger types
  | "mr_saturation"
  | "cold_core_threshold"
  | "cold_core_projected"
  | "cold_dex_threshold"
  | "cold_dex_projected"
  | "heat_core_threshold"
  | "heat_core_projected"
  | "edge_of_scope"
  // v1.4 stage-anchored trigger types
  | "shivering_sustained"
  | "mild_hypothermia_active"
  | "mild_hypothermia_deteriorating"
  | "heat_exhaustion_active"
  | "heat_exhaustion_deteriorating";

/**
 * Severity tier for CM cards and risk display.
 * Order: Low → Elevated → Moderate → High → Critical.
 * Per Current State Inventory v2 §4.
 */
export type Severity =
  | "low"
  | "elevated"
  | "moderate"
  | "high"
  | "critical"
  | "edge_of_scope";

/**
 * Mitigation action category for a CM card.
 */
export type MitigationType =
  | "moisture"
  | "layer"
  | "shelter"
  | "cool"
  | "dex"
  | "emergency";

/**
 * Critical Moment card.
 * Architecture v1.1 §4.4 (verbatim).
 */
export interface CmCard {
  card_id: string;
  trigger_type: CmTriggerType;
  /** Seconds from trip start when this card fired. */
  fired_at_t: number;
  severity: Severity;
  /** Rendered copy per v1.4 §8.3. Q4b: placeholder in Session 10. */
  copy: string;
  mitigation_type: MitigationType;
  activity_specific_imperative: string;
  /** Which clinical stage triggered this card. NEW v1.1. */
  clinical_stage_context?: ClinicalStage;
}

// ============================================================================
// §4.5 — TripHeadline, PillResult, FourPill, EngineOutput
// ============================================================================

/**
 * Trip-level headline metrics.
 * Architecture v1.1 §4.5 (verbatim).
 */
export interface TripHeadline {
  peak_MR: number;
  peak_HLR: number;
  peak_CDI: number;
  peak_CDI_segment_id: string;
  /** Highest-severity clinical stage reached across all segments. NEW v1.1. */
  peak_clinical_stage: ClinicalStage;
  binding_pathway: BindingPathway;
  regime_mix: {
    cold_fraction: number;
    heat_fraction: number;
    neutral_fraction: number;
  };
  total_duration_hr: number;
  cm_card_count: number;
  /** True if any segment reached CDI 5+ (mild_hypothermia / heat_exhaustion or worse). NEW v1.1. */
  named_impairment_stage_reached: boolean;
  /** True if any segment hit CDI 9.5+. */
  edge_of_scope_triggered: boolean;
}

/**
 * Summary metrics for a single pill's trajectory.
 * Architecture v1.1 §4.5: PillResult.trajectory_summary.
 */
export interface TrajectorySnapshot {
  peak_MR: number;
  peak_HLR: number;
  peak_CDI: number;
  /** NEW v1.1. */
  peak_clinical_stage: ClinicalStage;
  binding_pathway: BindingPathway;
  regime: Regime;
}

/**
 * Pill identifier.
 * Per DEC-013 four-pill structure (TA v6 §28.6).
 */
export type PillId =
  | "your_gear"           // Pill 1: user's ensemble, reactive venting
  | "pacing"              // Pill 2: user's ensemble + thermal pacing
  | "optimal_gear"        // Pill 3: strategy-winner ensemble, reactive venting
  | "best_outcome";       // Pill 4: strategy-winner + thermal pacing

/**
 * Result for a single pill evaluation.
 * Architecture v1.1 §4.5.
 *
 * For stationary activities (MET < 2.0), pills 2 and 4 are replaced
 * by comfort-hour CLO escalation per TA v6 §23.4 / DEC-013.
 */
export interface PillResult {
  pill_id: PillId;
  /** The ensemble evaluated for this pill. */
  ensemble: GearEnsemble;
  /** Full trajectory for this pill's evaluation. */
  trajectory: TrajectoryPoint[];
  /** Per-segment aggregation. */
  segments: SegmentSummary[];
  /** Summary snapshot of trajectory peaks. */
  trajectory_summary: TrajectorySnapshot;
  /**
   * Whether this pill uses thermal pacing (pills 2 and 4).
   * For stationary activities, this is false and comfort_hour_escalation is set instead.
   */
  uses_pacing: boolean;
  /**
   * Comfort-hour CLO escalation tiers (stationary activities only, pills 2 and 4).
   * Per TA v6 §23.4 / DEC-013 activity-class variation.
   * Null for dynamic activities.
   */
  comfort_hour_escalation?: ComfortHourEscalation | null;
}

/**
 * Comfort-hour CLO escalation for stationary activities.
 * Replaces pacing pills when MET < 2.0 (DEC-013).
 * Source: TA v6 §23.4.
 */
export interface ComfortHourEscalation {
  /** Hours of comfort at current CLO. */
  hours_at_current_clo: number;
  /** CLO needed for 1 additional hour of comfort. */
  clo_for_plus_1hr: number;
  /** CLO needed for 2 additional hours of comfort. */
  clo_for_plus_2hr: number;
}

/**
 * Four-pill comparison — the core LayerCraft narrative.
 * Architecture v1.1 §4.5.
 */
export interface FourPill {
  your_gear: PillResult;
  pacing: PillResult;
  optimal_gear: PillResult;
  best_outcome: PillResult;
}

/**
 * IREQ feasibility summary.
 * Architecture v1.1 §4.5: "IREQSummary unchanged."
 * Derived from IREQ Blocks 1–3 (d'Ambrosio 2025, Angelova 2017 validation).
 */
export interface IREQSummary {
  /** IREQ_min in clo for this activity/conditions combination. */
  ireq_min_clo: number;
  /** IREQ_neu in clo. */
  ireq_neu_clo: number;
  /** Duration limited exposure at minimum strain, hours. Null if unlimited (>8h). */
  dle_min_hr: number | null;
  /** Duration limited exposure at neutral, hours. Null if unlimited. */
  dle_neu_hr: number | null;
  /** Metabolic rate used for IREQ computation, W/m². */
  activity_met_w_m2: number;
  /** Whether the user's ensemble meets IREQ_min. */
  user_ensemble_feasible: boolean;
  /** Number of strategy candidates that passed IREQ filter. */
  candidates_passing: number;
  /** Total strategy candidates evaluated. */
  candidates_total: number;
}

/**
 * Strategy selection metadata.
 * Architecture v1.1 §4.5: "StrategyMetadata unchanged."
 */
export interface StrategyMetadata {
  /** Total candidate ensembles considered. */
  candidates_total: number;
  /** Candidates surviving IREQ feasibility filter. */
  candidates_post_ireq: number;
  /** Candidates fully evaluated (post-IREQ, post-any-other-gates). */
  candidates_evaluated: number;
  /** Winning ensemble ID, or null if no viable winner. */
  winner_ensemble_id: string | null;
  /** Peak CDI of the winning ensemble. Null if no winner. */
  winner_peak_cdi: number | null;
  /** Peak clinical stage of the winning ensemble. Null if no winner. */
  winner_peak_stage: ClinicalStage | null;
}

/**
 * Fall-In safety overlay.
 * Architecture v1.1 §4.5: "FallInOverlay unchanged."
 * Giesbrecht 1-10-1 framework + activity-specific awareness cards.
 * Session 10: placeholder returning null (Q4b / §4.3 deferral).
 */
export interface FallInOverlay {
  /** Whether Fall-In analysis applies to this activity. */
  applicable: boolean;
  /** 1-10-1 severity assessment if applicable. */
  severity_score?: number;
  /** Cold shock survival window, minutes. */
  cold_shock_window_min?: number;
  /** Swim failure window, minutes. */
  swim_failure_window_min?: number;
  /** Hypothermia onset window, minutes. */
  hypothermia_window_min?: number;
}

/**
 * Sleep system overlay.
 * Architecture v1.1 §4.5: "SleepSystemOverlay unchanged."
 * Session 10: placeholder returning null (§4.3 deferral).
 */
export interface SleepSystemOverlay {
  /** Whether sleep analysis applies. */
  applicable: boolean;
  /** Required pad R-value for ground insulation. */
  required_pad_r?: number;
  /** Effective bag rating after moisture degradation. */
  effective_bag_rating_f?: number;
  /** Sleeping zone temperatures. */
  zone_temps?: {
    ground_f: number;
    bag_interior_f: number;
    ambient_f: number;
  };
}

/**
 * Top-level engine output.
 * THE canonical data structure per Working Agreement v3 Rule #3.
 * Architecture v1.1 §4.5.
 *
 * evaluate(input: EngineInput): EngineOutput
 */
export interface EngineOutput {
  /** Trip-level headline metrics for the winner ensemble. */
  trip_headline: TripHeadline;
  /** Four-pill comparison. */
  four_pill: FourPill;
  /** IREQ feasibility assessment. */
  ireq_summary: IREQSummary;
  /** Strategy selection metadata. */
  strategy: StrategyMetadata;
  /** Fall-In safety overlay. Null if not applicable or deferred. */
  fall_in: FallInOverlay | null;
  /** Sleep system overlay. Null if not applicable or deferred. */
  sleep_system: SleepSystemOverlay | null;
  /** Engine version identifier for contract compatibility. */
  engine_version: string;
}

// ============================================================================
// §4.6 — Input types
// ============================================================================

/**
 * Segment specification within a trip.
 * Multi-segment trips (e.g., Kirwood) chain segment-end state
 * to next-segment start (Current State Inventory v2 §6).
 */
export interface SegmentSpec {
  segment_id: string;
  segment_label: string;
  /** Activity for this segment (may differ from trip-level). */
  activity_id: string;
  /** Duration of this segment in hours. */
  duration_hr: number;
  /** Weather slices applicable to this segment. */
  weather: WeatherSlice[];
  /** Optional terrain override for this segment. */
  terrain?: string;
  /** Optional snow terrain type. */
  snow_terrain?: string;
  /** Whether a base-layer change occurs at segment start (resets moisture). */
  base_layer_change?: boolean;
}

/**
 * Activity specification.
 * Architecture v1.1 §4.6: "unchanged from v1.0."
 * Derived from LC5 activity parameters and Architecture §1.1 dataflow.
 */
export interface ActivitySpec {
  /** Primary activity identifier (e.g., "skiing", "hiking", "fishing"). */
  activity_id: string;
  /** Total trip duration in hours. */
  duration_hr: number;
  /**
   * Trip segments. Single-segment trips have one entry.
   * Multi-segment trips (Kirwood) have multiple with chained state.
   */
  segments: SegmentSpec[];
  /** Snow terrain type if applicable. */
  snow_terrain?: string;
  /** BC (backcountry) vertical gain in feet if applicable. */
  bc_vertical_gain_ft?: number;
  /** Whether fishing involves wading. */
  fish_wading?: boolean;
  /** Wader type if wading. */
  wader_type?: "breathable" | "neoprene";
  /** Kayak type if paddling. */
  kayak_type?: "sit_on_top" | "sit_inside" | "creek";
  /** Golf cart riding (reduces metabolic rate). */
  golf_cart_riding?: boolean;
  /** Immersion gear tier for water activities. */
  immersion_gear?: string;
}

/**
 * Weather conditions for a time slice.
 * Architecture v1.1 §4.6: "unchanged from v1.0."
 */
export interface WeatherSlice {
  /** Start time of this weather slice, seconds from trip start. */
  t_start: number;
  /** End time of this weather slice, seconds from trip start. */
  t_end: number;
  /** Air temperature, °F. Engine converts to °C internally. */
  temp_f: number;
  /** Relative humidity, 0–100. Per DEC-024 convention. */
  humidity: number;
  /** Wind speed, mph. Engine converts to m/s internally. */
  wind_mph: number;
  /** Precipitation probability, 0–1. */
  precip_probability: number;
  /** Wind direction in degrees (0 = N, 90 = E). Optional. */
  wind_direction_deg?: number;
}

/**
 * Location specification.
 * Architecture v1.1 §4.6: "unchanged from v1.0."
 */
export interface LocationSpec {
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lng: number;
  /** Base elevation in feet. */
  elevation_ft: number;
  /** Trail elevation profile if available (for hiking/running). */
  trail_profile?: TrailElevationPoint[];
}

/**
 * Point in a trail elevation profile.
 * Source: PHY-064 Naismith-Langmuir / Minetti GAP, trail_search.js.
 */
export interface TrailElevationPoint {
  /** Distance from trailhead, miles. */
  distance_mi: number;
  /** Elevation at this point, feet. */
  elevation_ft: number;
}

/**
 * User biometric inputs.
 * Architecture v1.1 §4.6: "unchanged from v1.0."
 * Personalization Golden Rule: describe what the body DOES, never what it IS.
 * Raw inputs here; display uses derived outputs only.
 */
export interface UserBiometrics {
  /** Biological sex (affects thermoregulation physiology). */
  sex: "male" | "female";
  /** Body weight, lbs. */
  weight_lb: number;
  /** Height, inches. Optional (used for DuBois BSA if available). */
  height_in?: number;
  /**
   * Body fat percentage.
   * Sources: (1) wearable smart scale, (2) DoD tape method, (3) Deurenberg BMI fallback.
   */
  body_fat_pct?: number;
  /** VO2max from wearable import (Garmin/Apple/Strava). Optional. */
  vo2max?: number;
  /**
   * Fitness profile derived from wearable data.
   * Affects sweat rate scaling and thermoregulatory efficiency.
   */
  fitness_profile?: FitnessProfile;
  /** Pace multiplier relative to standard activity pace. Default 1.0. */
  pace_mul?: number;
}

/**
 * Fitness profile derived from wearable data.
 * Source: LC5 fitnessProfile parameter.
 */
export interface FitnessProfile {
  /** Sweat efficiency multiplier (trained athletes sweat more efficiently). */
  sweat_efficiency: number;
  /** Metabolic efficiency multiplier. */
  metabolic_efficiency: number;
  /** Acclimatization state (heat-acclimatized individuals sweat earlier). */
  heat_acclimatized: boolean;
}

/**
 * Single gear item with thermal properties.
 * Architecture v1.1 §4.6.
 * Source: gear.js DB schema, Current State Inventory v2 §7.
 */
export interface GearItem {
  /** Unique product identifier from gear DB. */
  product_id: string;
  /** Human-readable product name. */
  name: string;
  /** Body slot this item occupies. */
  slot: GearSlot;
  /** Thermal insulation, clo. */
  clo: number;
  /**
   * Moisture vapor transmission (Woodcock permeability index).
   * im drives evaporation, NOT CLO (Cardinal Rule #2).
   */
  im: number;
  /** Wind resistance rating (0–5 scale). */
  wind_resistance?: number;
  /** Waterproof rating (0–5 scale). */
  waterproof?: number;
  /** Breathability rating. */
  breathability?: number;
  /** Fiber type for moisture buffer computation. */
  fiber?: "synthetic" | "wool" | "cotton" | "down" | "blend";
  /** Layer capacity for moisture buffer, mL. */
  layer_capacity_ml?: number;
  /** Wicking rate. */
  wicking?: number;
  /** Spec confidence tier (5–6 full, 3–4 peer-imputed, 0–2 excluded). */
  spec_confidence?: number;
}

/**
 * Body slot categories.
 */
export type GearSlot =
  | "base"
  | "mid"
  | "insulative"
  | "shell"
  | "footwear"
  | "headgear"
  | "handwear"
  | "legwear"
  | "neck";

/**
 * A complete gear ensemble (layering system).
 * Architecture v1.1 §4.6.
 * Unit of evaluation is the LAYERING SYSTEM, not the individual product.
 */
export interface GearEnsemble {
  /** Unique ensemble identifier. */
  ensemble_id: string;
  /** Human-readable label (e.g., "Your Gear", "Optimal Package"). */
  label?: string;
  /** All gear items in this ensemble. */
  items: GearItem[];
  /**
   * Total ensemble CLO (computed from items via parallel summation method,
   * per Kuklane 2007 validation — AUDIT-IREQ-001 PASSES).
   */
  total_clo: number;
  /**
   * Ensemble im (harmonic mean via calcEnsembleIm).
   * im drives evaporation, NOT CLO (Cardinal Rule #2).
   */
  ensemble_im: number;
}

/**
 * Vent event specification.
 * User-initiated or strategy-recommended venting action.
 */
export interface VentEvent {
  /** Seconds from trip start when vent opens. */
  t_open: number;
  /** Seconds from trip start when vent closes. */
  t_close: number;
  /** Type of venting action. */
  type: "pit_zip" | "chest_zip" | "full_open" | "hood_back" | "cuff_roll";
}

/**
 * Top-level engine input.
 * Architecture v1.1 §4.6.
 *
 * evaluate(input: EngineInput): EngineOutput
 */
export interface EngineInput {
  /** Activity specification. */
  activity: ActivitySpec;
  /** Location specification. */
  location: LocationSpec;
  /** User biometric data. */
  biometrics: UserBiometrics;
  /** User's actual gear ensemble (Pill 1 / Pill 2 evaluation). */
  user_ensemble: GearEnsemble;
  /**
   * Strategy candidate ensembles for Pill 3 / Pill 4 evaluation.
   * Session 10b populates this; Session 10a evaluates user_ensemble only.
   */
  strategy_candidates?: GearEnsemble[];
  /**
   * Vent events for pacing pills (Pill 2, Pill 4).
   * Reactive venting uses engine defaults; proactive venting uses these.
   */
  vent_events?: VentEvent[];
  /**
   * Pack specification if the user is carrying a pack.
   * Drives PHY-054 pack thermal modifier and Pandolf metabolic cost.
   */
  pack?: {
    weight_lb: number;
    panel_type: "mesh" | "foam" | "contact" | "suspended";
  };
  /**
   * Shell wind resistance override.
   * From gear DB shell properties; affects convective boundary layer.
   */
  shell_wind_resistance?: number;
  /**
   * Precipitation probability (0–1).
   * May also come from WeatherSlice; this is a trip-level override.
   */
  precip_probability?: number;
}
