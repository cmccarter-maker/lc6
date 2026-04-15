// CDI v1.4 §4.6 — sustained shivering detection
// Q_shiver > 50W sustained for 5+ min = diagnostic signal of mild hypothermia
// Citation: Castellani 2016 distinguishes "thermoregulatory shivering" (sustained)
// from "transient cold response" (brief micro-shivering during transitions).
// GAP: 50W threshold engine-tunable; SCENARIO-B validation pending.

import type { ShiveringSustainedInput, ShiveringSustainedOutput } from '../types.js';

const Q_SHIVER_SUSTAINED_THRESHOLD_W = 50;
const Q_SHIVER_SUSTAINED_DURATION_MIN = 5;
const Q_SHIVER_HIGH_W = 100;     // for cessation detection
const Q_SHIVER_LOW_W = 30;       // for cessation detection

export function detectShiveringSustained(
  input: ShiveringSustainedInput,
): ShiveringSustainedOutput {
  const { q_shiver_history, slice_duration_min } = input;

  // q_shiver_sustained: Q_shiver > 50W continuously for ≥ 5 minutes
  const slicesNeededForSustained = Math.ceil(
    Q_SHIVER_SUSTAINED_DURATION_MIN / slice_duration_min,
  );
  const recentSlices = q_shiver_history.slice(-slicesNeededForSustained);

  const q_shiver_sustained =
    recentSlices.length >= slicesNeededForSustained &&
    recentSlices.every((q) => q > Q_SHIVER_SUSTAINED_THRESHOLD_W);

  // shivering_ceased_involuntarily: Q_shiver was high (>100W), now low (<30W)
  // The caller passes T_core history check separately to confirm "while T_core falling";
  // here we only detect the shivering pattern. T_core context is checked in stage_detector.
  let shivering_ceased_involuntarily = false;
  if (q_shiver_history.length >= 2) {
    const prevSlice = q_shiver_history[q_shiver_history.length - 2]!;
    const currentSlice = q_shiver_history[q_shiver_history.length - 1]!;
    if (prevSlice > Q_SHIVER_HIGH_W && currentSlice < Q_SHIVER_LOW_W) {
      shivering_ceased_involuntarily = true;
    }
  }

  return { q_shiver_sustained, shivering_ceased_involuntarily };
}
