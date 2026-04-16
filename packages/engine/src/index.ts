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

// Heat balance module — Sessions 6 + 7 + 9a
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
  // Session 9a body anthropometry
  duboisBSA,
  // Session 9a EPOC + core temp
  epocParams,
  epocTau,
  estimateCoreTemp,
  // Session 9a cold physiology
  civdProtectionFactor,
  shiveringBoost,
  computeHLR,
} from './heat_balance/index.js';

export type {
  ComputeEmaxResult,
  ComputeSweatRateResult,
  SweatRegime,
  IterativeTSkinResult,
  RespiratoryHeatLossResult,
  EpocParamsResult,
} from './heat_balance/index.js';

// Ensemble module — Session 8
export {
  ENSEMBLE_IM_MAP,
  ENSEMBLE_LAYER_NAMES,
  ENSEMBLE_LAYER_KEYS,
  calcEnsembleIm,
  FIBER_ABSORPTION,
  getFiberType,
  getLayerCapacity,
  breathabilityToIm,
  activityCLO,
  warmthToCLO,
  buildLayerArray,
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

// Moisture module — Session 9a
export {
  PERCEIVED_WEIGHTS,
  COMFORT_THRESHOLD,
  computePerceivedMR,
  applySaturationCascade,
} from './moisture/index.js';

export type { PerceivedMRLayer } from './moisture/index.js';

// Activities module — Session 9a
export {
  WADER_DATA,
  SNOW_SPORT_ZONES,
  waderSplitIm,
  waderSplitCLO,
  snowSportSplitIm,
  descentSpeedWind,
  ACTIVITY_SWEAT_PROFILES,
  INTERMITTENT_PHASE_PROFILES,
  GENERIC_GEAR_SCORES_BY_SLOT,
} from './activities/index.js';

export type {
  WaderEntry,
  SnowSportZone,
  DescentSpeedWindResult,
  ActivitySweatProfile,
  PhaseDefinition,
  PhaseProfile,
  GearSlotScores,
} from './activities/index.js';

// Session 9b additions
export {
  calcElevationHumidity,
  altitudeFactors,
  getMetabolicEfficiency,
} from './heat_balance/index.js';

export type { AltitudeFactorsResult } from './heat_balance/index.js';

export {
  waderEvapFloor,
} from './activities/index.js';

export {
  CROSSOVER_LITERS,
  FATIGUE_PER_MIN,
  RECOVERY_PER_MIN,
  MAX_FATIGUE,
  TAU_CLOTHING,
  TAU_COOL,
  GENERIC_LAYER_CAPS,
  calcIntermittentMoisture,
} from './moisture/index.js';

export type { IntermittentMoistureResult } from './moisture/index.js';

// Session 9c
export { sweatRate } from './moisture/index.js';
export { elevTempAdj } from './heat_balance/index.js';
export { calcBCPhasePercentages } from './activities/index.js';
export type { BCPhasePercentages } from './activities/index.js';


// IREQ module — ISO 11079 cold stress (Block 1 + Block 2 + Block 3)
export {
  IREQ_neu,
  IREQ_min,
  DLE_neu,
  DLE_min,
  m2KW_to_clo,
  clo_to_m2KW,
  computeActivityIREQ,
  ACTIVITY_MET,
  SKI_TERRAIN_MET,
  resolveActivityMet,
  LUND_M_CAP,
} from './ireq/index.js';
export type { ActivityIREQResult, ActivityIREQExcluded, ActivityIREQOutput } from './ireq/index.js';
