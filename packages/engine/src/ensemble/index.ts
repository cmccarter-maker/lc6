// LC6 ensemble module — public API.
// Session 8 build: ensemble im calculations, gear-layer construction, dynamic CLO corrections.

// ensemble_im
export {
  ENSEMBLE_IM_MAP,
  ENSEMBLE_LAYER_NAMES,
  ENSEMBLE_LAYER_KEYS,
  calcEnsembleIm,
} from './ensemble_im.js';

export type {
  EnsembleTier,
  EnsembleLayer,
  EnsembleImResult,
} from './ensemble_im.js';

// gear_layers
export {
  FIBER_ABSORPTION,
  getFiberType,
  getLayerCapacity,
  breathabilityToIm,
  activityCLO,
  warmthToCLO,
  buildLayerArray,
} from './gear_layers.js';

export type {
  FiberType,
  GearItem,
  GearLayer,
} from './gear_layers.js';

// effective_clo
export {
  pumpingReduction,
  windCLOProtection,
  staticLayeringCorrection,
  computeEffectiveCLO,
  clothingInsulation,
} from './effective_clo.js';
