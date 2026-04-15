// LC6 heat_balance module — public API.
// Foundational primitives ported from LC5 risk_functions.js (Session 6 build).
// Future sessions add: gagge.ts (iterative solver), terms.ts (M, W, C, R, E_resp, E_skin), coupling.ts (h_tissue).

// Constants
export {
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
} from './constants.js';

// VPD utilities
export { satVaporPressure, vpdRatio, VPD_REF_HPA } from './vpd.js';

// Wind, ensemble, duration, precipitation utilities
export {
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
} from './utilities.js';

// Evaporation primitives
export {
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
} from './evaporation.js';

// Type re-exports
export type { ComputeEmaxResult, ComputeSweatRateResult, SweatRegime } from './evaporation.js';
