// ============================================================================
// @lc6/engine — Public API Types
// packages/engine/src/types.ts
//
// Canonical type definitions for:
//   1. CDI v1.4 stage detection (Session 5)
//   2. evaluate(input: EngineInput): EngineOutput (Session 10a)
//
// Inviolable per Working Agreement v3 Rule #16.
// Shape changes require formal Architecture Document amendment.
//
// Source: LC6 Architecture Document v1.1 RATIFIED (2026-04-14)
// History: Session 5 (CDI types), Session 10a (evaluate contract)
// ============================================================================


// ============================================================================
// SECTION A — Shared enums (used by both CDI and evaluate)
// Architecture v1.1 §4.1
// ============================================================================

/**
 * Thermal regime classification.
 * Derived from heat balance: S < 0 → cold, S > 0 → heat, S ≈ 0 → neutral.
 */
export type Regime = "cold" | "heat" | "neutral";

/**
 * Clinical stage detected per CDI v1.4 §4.2.
 * Cold-side stages anchor to Mayo/WMS/Castellani clinical criteria.
 * Heat-side stages anchor to ACSM 2023 heat illness classification.
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


// ============================================================================
// SECTION B — CDI v1.4 stage detection types (Session 5, preserved verbatim)
// ============================================================================

/**
 * Inputs to clinical stage detection.
 * Per CDI v1.4 §4.2 — first-match priority detection from observable engine state.
 */
export interface StageDetectionInput {
  T_core: number;            // °C, current core temperature
  T_skin: number;            // °C, current mean skin temperature (for context; not used in stage detection in v1.4)
  S: number;                 // W, current heat storage rate (sign determines regime)
  Q_shiver: number;          // W, current shivering heat
  q_shiver_sustained: boolean; // true if Q_shiver > 50W sustained for 5+ min (per shivering_sustained.ts)
  shivering_ceased_involuntarily: boolean; // true if Q_shiver dropped from >100W to <30W while T_core falling
  vasoconstriction_active: boolean; // true if h_tissue below resting baseline by ≥30%
  sweat_rate: number;        // g/s, current sweat rate
  SW_max: number;            // g/s, maximum sweat capacity
  T_core_projected_next_slice: number; // °C, projected T_core at next slice (for projected-crossing detection)
  cognitive_impairment_observed: boolean; // v1.4 §4.2: false in v1; T_core ≥ 40°C is the proxy
}

/**
 * Output of clinical stage detection.
 */
export interface StageDetectionOutput {
  stage: ClinicalStage;
  regime: Regime;
  reasoning: string;        // human-readable explanation of which detection rule matched (for transparency + tests)
}

/**
 * CDI tier ranges per stage. From CDI v1.4 §2.3 corrected scale.
 */
export interface StageTierRange {
  floor: number;
  ceiling: number;
}

/**
 * Inputs to within-stage progression ramp.
 * Per CDI v1.4 §4.3.
 */
export interface WithinStageRampInput {
  stage: ClinicalStage;
  tau_to_next_stage: number | null; // hr; null if at terminal stage (severe_hypothermia, heat_stroke)
  stage_tau_max: number | null;     // hr; null if at terminal stage
}

/**
 * Output of within-stage progression ramp.
 */
export interface WithinStageRampOutput {
  cdi: number;
  cdi_basis: CdiBasis;
}

/**
 * Inputs to sustained-shivering detector.
 * Per CDI v1.4 §4.6.
 */
export interface ShiveringSustainedInput {
  q_shiver_history: number[]; // recent Q_shiver values, most recent last; one entry per slice
  slice_duration_min: number; // minutes per slice; default 15
}

export interface ShiveringSustainedOutput {
  q_shiver_sustained: boolean;
  shivering_ceased_involuntarily: boolean;
}


// ============================================================================
// SECTION C — evaluate() contract types (Session 10a)
// Architecture v1.1 §4.2–§4.6
// ============================================================================

/**
 * Which pathway binds (limits) thermal comfort.
 * Architecture v1.1 §4.2.
 */
export type BindingPathway = "moisture" | "heat_loss" | "compound" | "neutral";

/**
 * CM trigger state for a single threshold.
 * Architecture v1.1 §4.2.
 */
export interface CmTriggerState {
  threshold_crossed: boolean;
  projected_crossing_eta: number | null;
}

/**
 * Venting state at a TrajectoryPoint.
 * Source: TA v6 §28.3.
 */
export interface VentingState {
  active: boolean;
  type?: "pit_zip" | "chest_zip" | "full_open" | "hood_back" | "cuff_roll";
  elapsed_min?: number;
}

/**
 * EPOC transition state (PHY-050).
 * Source: TA v6 §28.4; Børsheim & Bahr 2003.
 */
export interface EpocState {
  active: boolean;
  elapsed_s: number;
  excess_met_w_m2: number;
}

/**
 * Pack thermal modifier state (PHY-054).
 * Source: TA v6 §26.
 */
export interface PackState {
  present: boolean;
  weight_lb: number;
  panel_type: "mesh" | "foam" | "contact" | "suspended";
  blocked_bsa_frac: number;
  chill_flash_active: boolean;
}

/**
 * Per-slice engine output.
 * Architecture v1.1 §4.2 (verbatim).
 * Each TrajectoryPoint maps to one calcIntermittentMoisture per-cycle data point (Q1b).
 */
export interface TrajectoryPoint {
  // ── Time ─────────────────────────────────────────────
  t: number;
  segment_id: string;

  // ── Converged body state (PHY-056) ───────────────────
  T_skin: number;
  T_skin_smoothed: number;
  dT_skin_dt: number;
  dT_skin_dt_smoothed: number;
  T_core: number;
  dT_core_dt: number;
  T_cl: number;
  h_tissue: number;

  // ── Heat balance terms (total-body W) ────────────────
  M: number;
  W: number;
  C: number;
  R: number;
  E_resp: number;
  E_skin: number;
  E_max: number;
  E_req: number;
  S: number;
  S_net: number;
  SW_required: number;
  Q_shiver: number;

  // ── Environmental coefficients ───────────────────────
  V_effective: number;
  h_c: number;
  h_mass: number;
  T_air: number;
  T_mrt: number;
  RH: number;
  P_a: number;

  // ── Clothing state ───────────────────────────────────
  R_clo_effective: number;
  R_e_cl_effective: number;
  im_system: number;
  VPD: number;

  // ── Risk metrics ─────────────────────────────────────
  MR: number;
  HLR: number;
  CDI: number;
  regime: Regime;
  binding_pathway: BindingPathway;

  // ── v1.4 stage-detection fields ──────────────────────
  clinical_stage: ClinicalStage;
  cdi_basis: CdiBasis;
  tau_to_next_stage: number | null;
  q_shiver_sustained: boolean;

  // ── τ values ─────────────────────────────────────────
  tau_core_cold: number | null;
  tau_dex: number | null;
  tau_core_hot: number | null;
  tau_impair: number;

  // ── CM trigger states ────────────────────────────────
  cm_trigger: {
    cold_core: CmTriggerState;
    cold_dex: CmTriggerState;
    heat_core: CmTriggerState;
    shivering_sustained: CmTriggerState;
  };

  // ── Phase context ────────────────────────────────────
  phase: string;
  venting?: VentingState;
  epoc_state?: EpocState;
  pack_state?: PackState;
}

// ── SegmentSummary — Architecture v1.1 §4.3 ────────────

export interface SegmentSummary {
  segment_id: string;
  segment_label: string;
  start_t: number;
  end_t: number;

  peak_MR: number;
  peak_MR_at_t: number;
  peak_HLR: number;
  peak_HLR_at_t: number;
  peak_CDI: number;
  peak_CDI_at_t: number;
  peak_binding_pathway: BindingPathway;
  peak_regime: Regime;
  peak_clinical_stage: ClinicalStage;
  peak_cdi_basis: CdiBasis;

  cm_cards_fired: CmCard[];

  is_stationary: boolean;
  comfort_hours_remaining?: number;
}

// ── CmCard — Architecture v1.1 §4.4 ────────────────────

export type CmTriggerType =
  | "mr_saturation"
  | "cold_core_threshold"
  | "cold_core_projected"
  | "cold_dex_threshold"
  | "cold_dex_projected"
  | "heat_core_threshold"
  | "heat_core_projected"
  | "edge_of_scope"
  | "shivering_sustained"
  | "mild_hypothermia_active"
  | "mild_hypothermia_deteriorating"
  | "heat_exhaustion_active"
  | "heat_exhaustion_deteriorating";

export type Severity =
  | "low" | "elevated" | "moderate" | "high" | "critical" | "edge_of_scope";

export type MitigationType =
  | "moisture" | "layer" | "shelter" | "cool" | "dex" | "emergency";

export interface CmCard {
  card_id: string;
  trigger_type: CmTriggerType;
  fired_at_t: number;
  severity: Severity;
  copy: string;
  mitigation_type: MitigationType;
  activity_specific_imperative: string;
  clinical_stage_context?: ClinicalStage;
}

// ── TripHeadline — Architecture v1.1 §4.5 ──────────────

export interface TripHeadline {
  peak_MR: number;
  peak_HLR: number;
  peak_CDI: number;
  peak_CDI_segment_id: string;
  peak_clinical_stage: ClinicalStage;
  binding_pathway: BindingPathway;
  regime_mix: {
    cold_fraction: number;
    heat_fraction: number;
    neutral_fraction: number;
  };
  total_duration_hr: number;
  cm_card_count: number;
  named_impairment_stage_reached: boolean;
  edge_of_scope_triggered: boolean;
}

// ── PillResult + FourPill — Architecture v1.1 §4.5 ─────

export interface TrajectorySnapshot {
  peak_MR: number;
  peak_HLR: number;
  peak_CDI: number;
  peak_clinical_stage: ClinicalStage;
  binding_pathway: BindingPathway;
  regime: Regime;
}

export type PillId =
  | "your_gear" | "pacing" | "optimal_gear" | "best_outcome";

export interface ComfortHourEscalation {
  hours_at_current_clo: number;
  clo_for_plus_1hr: number;
  clo_for_plus_2hr: number;
}

export interface PillResult {
  pill_id: PillId;
  ensemble: GearEnsemble;
  trajectory: TrajectoryPoint[];
  segments: SegmentSummary[];
  trajectory_summary: TrajectorySnapshot;
  uses_pacing: boolean;
  comfort_hour_escalation?: ComfortHourEscalation | null;
}

export interface FourPill {
  your_gear: PillResult;
  pacing: PillResult;
  optimal_gear: PillResult;
  best_outcome: PillResult;
}

// ── IREQSummary — Architecture v1.1 §4.5 ───────────────

export interface IREQSummary {
  ireq_min_clo: number;
  ireq_neu_clo: number;
  dle_min_hr: number | null;
  dle_neu_hr: number | null;
  activity_met_w_m2: number;
  user_ensemble_feasible: boolean;
  candidates_passing: number;
  candidates_total: number;
}

// ── StrategyMetadata — Architecture v1.1 §4.5 ──────────

export interface StrategyMetadata {
  candidates_total: number;
  candidates_post_ireq: number;
  candidates_evaluated: number;
  winner_ensemble_id: string | null;
  winner_peak_cdi: number | null;
  winner_peak_stage: ClinicalStage | null;
}

// ── Overlays (placeholders) — Architecture v1.1 §4.5 ───

export interface FallInOverlay {
  applicable: boolean;
  severity_score?: number;
  cold_shock_window_min?: number;
  swim_failure_window_min?: number;
  hypothermia_window_min?: number;
}

export interface SleepSystemOverlay {
  applicable: boolean;
  required_pad_r?: number;
  effective_bag_rating_f?: number;
  zone_temps?: {
    ground_f: number;
    bag_interior_f: number;
    ambient_f: number;
  };
}

// ── EngineOutput — THE canonical data structure ─────────
// Working Agreement v3 Rule #3.

export interface EngineOutput {
  trip_headline: TripHeadline;
  four_pill: FourPill;
  ireq_summary: IREQSummary;
  strategy: StrategyMetadata;
  fall_in: FallInOverlay | null;
  sleep_system: SleepSystemOverlay | null;
  engine_version: string;
}


// ============================================================================
// SECTION D — Input types
// Architecture v1.1 §4.6
// ============================================================================

export interface SegmentSpec {
  segment_id: string;
  segment_label: string;
  activity_id: string;
  duration_hr: number;
  weather: WeatherSlice[];
  terrain?: string;
  snow_terrain?: string;
  base_layer_change?: boolean;
}

export interface ActivitySpec {
  activity_id: string;
  duration_hr: number;
  segments: SegmentSpec[];
  snow_terrain?: string;
  bc_vertical_gain_ft?: number;
  fish_wading?: boolean;
  wader_type?: "breathable" | "neoprene";
  kayak_type?: "sit_on_top" | "sit_inside" | "creek";
  golf_cart_riding?: boolean;
  immersion_gear?: string;
}

export interface WeatherSlice {
  t_start: number;
  t_end: number;
  temp_f: number;
  humidity: number;     // 0–100, per DEC-024
  wind_mph: number;
  precip_probability: number;
  wind_direction_deg?: number;
}

export interface LocationSpec {
  lat: number;
  lng: number;
  elevation_ft: number;
  trail_profile?: TrailElevationPoint[];
}

export interface TrailElevationPoint {
  distance_mi: number;
  elevation_ft: number;
}

export interface UserBiometrics {
  sex: "male" | "female";
  weight_lb: number;
  height_in?: number;
  body_fat_pct?: number;
  vo2max?: number;
  fitness_profile?: FitnessProfile;
  pace_mul?: number;
}

export interface FitnessProfile {
  sweat_efficiency: number;
  metabolic_efficiency: number;
  heat_acclimatized: boolean;
}

export type GearSlot =
  | "base" | "mid" | "insulative" | "shell"
  | "footwear" | "headgear" | "handwear" | "legwear" | "neck";

/**
 * Gear item for evaluate() input.
 * NOTE: The ensemble module (Session 8) defines its own GearItem type
 * with a slightly different shape (for internal layer construction).
 * This type is the PUBLIC API input shape. evaluate() maps between them.
 */
export interface EngineGearItem {
  product_id: string;
  name: string;
  slot: GearSlot;
  clo: number;
  im: number;
  wind_resistance?: number;
  waterproof?: number;
  breathability?: number;
  fiber?: "synthetic" | "wool" | "cotton" | "down" | "blend";
  layer_capacity_ml?: number;
  wicking?: number;
  spec_confidence?: number;
}

export interface GearEnsemble {
  ensemble_id: string;
  label?: string;
  items: EngineGearItem[];
  total_clo: number;
  ensemble_im: number;
}

export interface VentEvent {
  t_open: number;
  t_close: number;
  type: "pit_zip" | "chest_zip" | "full_open" | "hood_back" | "cuff_roll";
}

export interface EngineInput {
  activity: ActivitySpec;
  location: LocationSpec;
  biometrics: UserBiometrics;
  user_ensemble: GearEnsemble;
  strategy_candidates?: GearEnsemble[];
  vent_events?: VentEvent[];
  pack?: {
    weight_lb: number;
    panel_type: "mesh" | "foam" | "contact" | "suspended";
  };
  shell_wind_resistance?: number;
  precip_probability?: number;
}
