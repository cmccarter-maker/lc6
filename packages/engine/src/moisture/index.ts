// LC6 moisture module — public API.
// Session 9a build: perceived MR, saturation cascade.

export {
  PERCEIVED_WEIGHTS,
  COMFORT_THRESHOLD,
  computePerceivedMR,
} from './perceived_mr.js';

export type { PerceivedMRLayer } from './perceived_mr.js';

export { applySaturationCascade } from './saturation_cascade.js';

// Session 9b — fatigue + CLO feedback constants
export {
  CROSSOVER_LITERS,
  FATIGUE_PER_MIN,
  RECOVERY_PER_MIN,
  MAX_FATIGUE,
  TAU_CLOTHING,
  TAU_COOL,
  GENERIC_LAYER_CAPS,
} from './constants.js';

// Session 9b — calcIntermittentMoisture (THE single MR source of truth)
export { calcIntermittentMoisture } from './calc_intermittent_moisture.js';
export type { IntermittentMoistureResult } from './calc_intermittent_moisture.js';
