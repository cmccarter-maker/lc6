// LC6 heat_balance module — public API.
// Sessions 6-7 cumulative exports.
// Future sessions add: gagge.ts (full Gagge integration), terms.ts (additional balance terms), coupling.ts.

// Constants (Sessions 6 + 7)
export {
  // Session 6
  L_V_J_PER_G,
  BASELINE_IM,
  TYPICAL_ENSEMBLE_IM,
  V_BOUNDARY_MPH,
  MIN_RETAINED_LITERS,
  FABRIC_CAPACITY_LITERS,
  C_HYGRO,
  DEFAULT_REGAIN_POLYESTER,
  ACTIVITY_LAYER_COUNT,
  MAGNUS_A,
  MAGNUS_B,
  MAGNUS_E0_HPA,
  // Session 7 — PHY-056 atmospheric/physical constants
  LC5_C_P_AIR,
  LC5_RHO_AIR,
  LC5_RHO_VAP_EXP,
  LC5_SIGMA,
  LC5_EMISS,
  LC5_T_CORE_BASE,
  LC5_BODY_SPEC_HEAT,
  // Session 7 — Gagge two-node parameters
  GAGGE_H_TISSUE_BASE,
  GAGGE_VDIL_MAX,
  GAGGE_VCON_MAX,
  GAGGE_VCON_THRESHOLD_C,
  GAGGE_VCON_SLOPE,
  GAGGE_MECHANICAL_WORK_FRACTION,
  CLOTHING_AREA_FACTOR_SLOPE,
  H_RAD_LINEARIZED,
} from './constants.js';

// Session 6 — VPD utilities
export { satVaporPressure, vpdRatio, VPD_REF_HPA } from './vpd.js';

// Session 6 — Wind, ensemble, duration, precipitation utilities
export {
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
} from './utilities.js';

// Session 6 — Evaporation primitives
export {
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
} from './evaporation.js';

// Session 7 — Body thermo (T_skin solver)
export {
  computeTissueCLO,
  computeTSkin,
  iterativeTSkin,
} from './body_thermo.js';

// Session 7 — Metabolism (M, VE, respiratory)
export {
  computeVE,
  computeMetabolicHeat,
  computeRespiratoryHeatLoss,
} from './metabolism.js';

// Session 7 — Environmental loss (convective, radiative)
export {
  computeConvectiveHeatLoss,
  computeRadiativeHeatLoss,
} from './env_loss.js';

// Type re-exports
export type { ComputeEmaxResult, ComputeSweatRateResult, SweatRegime } from './evaporation.js';
export type { IterativeTSkinResult } from './body_thermo.js';
export type { RespiratoryHeatLossResult } from './metabolism.js';

// Session 9a — body anthropometry
export { duboisBSA } from './body_thermo.js';

// Session 9a — EPOC + core temp
export {
  epocParams,
  epocTau,
  estimateCoreTemp,
} from './epoc.js';
export type { EpocParamsResult } from './epoc.js';

// Session 9a — cold physiology
export {
  civdProtectionFactor,
  shiveringBoost,
  computeHLR,
} from './cold_physiology.js';

// Session 9b — altitude helpers
export { calcElevationHumidity, altitudeFactors } from './altitude.js';
export type { AltitudeFactorsResult } from './altitude.js';

// Session 9b — metabolic efficiency
export { getMetabolicEfficiency } from './metabolism.js';

// Session 9c — lapse rate
export { elevTempAdj } from './altitude.js';
