// CDI v1.4 — public CDI computation entry
// Orchestrates stage detection + within-stage ramp + sustained shivering detection.

export { detectStage, applyStagePromotion } from './stage_detector.js';
export { applyWithinStageRamp } from './within_stage_ramp.js';
export { detectShiveringSustained } from './shivering_sustained.js';
export { STAGE_TIER_RANGES, STAGE_TAU_MAX_HR, STAGE_PROMOTION_THRESHOLD_HR } from './stage_tier_ranges.js';
