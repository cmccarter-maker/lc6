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

// Heat balance module — Sessions 6 + 7
export {
  // Session 6 constants
  L_V_J_PER_G,
  BASELINE_IM,
  TYPICAL_ENSEMBLE_IM,
  V_BOUNDARY_MPH,
  MIN_RETAINED_LITERS,
  FABRIC_CAPACITY_LITERS,
  C_HYGRO,
  DEFAULT_REGAIN_POLYESTER,
  ACTIVITY_LAYER_COUNT,
  // Session 7 constants
  LC5_C_P_AIR,
  LC5_RHO_AIR,
  LC5_RHO_VAP_EXP,
  LC5_SIGMA,
  LC5_EMISS,
  LC5_T_CORE_BASE,
  LC5_BODY_SPEC_HEAT,
  GAGGE_H_TISSUE_BASE,
  GAGGE_VDIL_MAX,
  GAGGE_VCON_MAX,
  // Session 6 VPD + utilities
  satVaporPressure,
  vpdRatio,
  VPD_REF_HPA,
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
  // Session 6 evaporation
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
  // Session 7 body thermo
  computeTissueCLO,
  computeTSkin,
  iterativeTSkin,
  // Session 7 metabolism
  computeVE,
  computeMetabolicHeat,
  computeRespiratoryHeatLoss,
  // Session 7 environmental loss
  computeConvectiveHeatLoss,
  computeRadiativeHeatLoss,
} from './heat_balance/index.js';

export type {
  ComputeEmaxResult,
  ComputeSweatRateResult,
  SweatRegime,
  IterativeTSkinResult,
  RespiratoryHeatLossResult,
} from './heat_balance/index.js';

// Ensemble module — Session 8
export {
  // ensemble_im
  ENSEMBLE_IM_MAP,
  ENSEMBLE_LAYER_NAMES,
  ENSEMBLE_LAYER_KEYS,
  calcEnsembleIm,
  // gear_layers
  FIBER_ABSORPTION,
  getFiberType,
  getLayerCapacity,
  breathabilityToIm,
  activityCLO,
  warmthToCLO,
  buildLayerArray,
  // effective_clo
  pumpingReduction,
  windCLOProtection,
  staticLayeringCorrection,
  computeEffectiveCLO,
  clothingInsulation,
} from './ensemble/index.js';

export type {
  EnsembleTier,
  EnsembleLayer,
  EnsembleImResult,
  FiberType,
  GearItem,
  GearLayer,
} from './ensemble/index.js';
