// LC6 Engine — Public API
// Per Architecture Document v1.1 §3 RATIFIED.
// Currently exports CDI v1.4 module surface (Session 5 build).
// Will expand as engine modules implement; full evaluate() is later session.

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
