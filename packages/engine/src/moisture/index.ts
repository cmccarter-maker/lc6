// LC6 moisture module — public API.
// Session 9a build: perceived MR, saturation cascade.

export {
  PERCEIVED_WEIGHTS,
  COMFORT_THRESHOLD,
  computePerceivedMR,
} from './perceived_mr.js';

export type { PerceivedMRLayer } from './perceived_mr.js';

export { applySaturationCascade } from './saturation_cascade.js';
