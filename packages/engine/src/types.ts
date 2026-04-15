// LC6 Engine — Public types
// Per Architecture Document v1.1 §4 RATIFIED
// EngineOutput contract is INVIOLABLE per Cardinal Rule #16.
// This file currently exports only the types needed for CDI v1.4 stage detection.
// Full EngineOutput interface fills in as engine modules are implemented.

export type Regime = "cold" | "heat" | "neutral";

export type ClinicalStage =
  | "thermal_neutral"
  | "cold_compensable"
  | "cold_intensifying"
  | "mild_hypothermia"
  | "mild_hypothermia_deteriorating"
  | "severe_hypothermia"
  | "heat_compensable"
  | "heat_intensifying"
  | "heat_exhaustion"
  | "heat_exhaustion_deteriorating"
  | "heat_stroke";

export type CdiBasis = "current_stage" | "progression_forecast" | "both";

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
