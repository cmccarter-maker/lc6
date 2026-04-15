// LC6 Engine — Public API
// Per Architecture Document v1.1 §3 RATIFIED.

// CDI v1.4 module surface (Session 5)
export type {
  Regime,
  ClinicalStage,
  CdiBasis,
  StageDetectionInput,
  StageDetectionOutput,
  StageTierRange,
  WithinStageRampInput,
  WithinStageRampOutput,
  ShiveringSustainedInput,
  ShiveringSustainedOutput,
} from './types.js';

export {
  detectStage,
  applyStagePromotion,
  applyWithinStageRamp,
  detectShiveringSustained,
  STAGE_TIER_RANGES,
  STAGE_TAU_MAX_HR,
  STAGE_PROMOTION_THRESHOLD_HR,
} from './cdi/index.js';

// Heat balance primitives (Session 6)
export {
  // Constants
  L_V_J_PER_G,
  BASELINE_IM,
  TYPICAL_ENSEMBLE_IM,
  V_BOUNDARY_MPH,
  MIN_RETAINED_LITERS,
  FABRIC_CAPACITY_LITERS,
  C_HYGRO,
  DEFAULT_REGAIN_POLYESTER,
  ACTIVITY_LAYER_COUNT,
  // VPD
  satVaporPressure,
  vpdRatio,
  VPD_REF_HPA,
  // Utilities
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
  // Evaporation
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
} from './heat_balance/index.js';

export type {
  ComputeEmaxResult,
  ComputeSweatRateResult,
  SweatRegime,
} from './heat_balance/index.js';
