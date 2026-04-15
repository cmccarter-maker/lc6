// CDI v1.4 §2.3 — clinical-stage to CDI tier mapping
// Rails alignment: CDI 5–6 = named clinical impairment; CDI 9–10 = clinical emergency
// All thresholds cited in v1.4 §2.4

import type { ClinicalStage, StageTierRange } from '../types.js';

export const STAGE_TIER_RANGES: Record<ClinicalStage, StageTierRange> = {
  thermal_neutral: { floor: 0, ceiling: 0 },

  cold_compensable: { floor: 1, ceiling: 2 },
  cold_intensifying: { floor: 3, ceiling: 4 },
  mild_hypothermia: { floor: 5, ceiling: 6 },
  mild_hypothermia_deteriorating: { floor: 7, ceiling: 8 },
  severe_hypothermia: { floor: 9, ceiling: 10 },

  heat_compensable: { floor: 1, ceiling: 2 },
  heat_intensifying: { floor: 3, ceiling: 4 },
  heat_exhaustion: { floor: 5, ceiling: 6 },
  heat_exhaustion_deteriorating: { floor: 7, ceiling: 8 },
  heat_stroke: { floor: 9, ceiling: 10 },
};

/**
 * Per-stage lookahead window for within-stage progression ramp.
 * Per CDI v1.4 §4.3 table.
 * GAP-flagged: validation target SCENARIO-B + ISO 11079 DLE comparison.
 */
export const STAGE_TAU_MAX_HR: Record<ClinicalStage, number | null> = {
  thermal_neutral: null,

  cold_compensable: 4.0,
  cold_intensifying: 2.0,
  mild_hypothermia: 1.0,
  mild_hypothermia_deteriorating: 0.5,
  severe_hypothermia: null, // terminal stage

  heat_compensable: 4.0,
  heat_intensifying: 2.0,
  heat_exhaustion: 1.0,
  heat_exhaustion_deteriorating: 0.5,
  heat_stroke: null, // terminal stage
};

/**
 * Stage promotion threshold per CDI v1.4 §4.6:
 * If τ_to_next < 15 min for current stage, effective stage promotes to next-worse.
 */
export const STAGE_PROMOTION_THRESHOLD_HR = 0.25; // 15 min
