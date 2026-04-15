// CDI v1.4 §4.3 — within-stage progression ramp
// Once stage detected, CDI lands within stage's tier range based on time to next-worse-stage threshold.

import type { WithinStageRampInput, WithinStageRampOutput } from '../types.js';
import { STAGE_TIER_RANGES } from './stage_tier_ranges.js';

export function applyWithinStageRamp(
  input: WithinStageRampInput,
): WithinStageRampOutput {
  const { stage, tau_to_next_stage, stage_tau_max } = input;
  const range = STAGE_TIER_RANGES[stage];

  // Terminal stage (severe_hypothermia, heat_stroke, thermal_neutral): CDI = floor (no progression target)
  if (stage_tau_max === null || tau_to_next_stage === null) {
    return {
      cdi: range.floor,
      cdi_basis: 'current_stage',
    };
  }

  // No progression visible (τ far from next stage): CDI at floor
  if (tau_to_next_stage > stage_tau_max) {
    return {
      cdi: range.floor,
      cdi_basis: 'current_stage',
    };
  }

  // Already at or past next stage's threshold: CDI at ceiling
  if (tau_to_next_stage <= 0) {
    return {
      cdi: range.ceiling,
      cdi_basis: 'progression_forecast',
    };
  }

  // Within ramp window: linear interpolation
  const progressionFraction = 1 - tau_to_next_stage / stage_tau_max;
  const cdi = range.floor + progressionFraction * (range.ceiling - range.floor);

  // Basis: progression_forecast if ramp engaged; current_stage if at floor
  const cdi_basis = cdi > range.floor + 0.01 ? 'progression_forecast' : 'current_stage';

  return { cdi, cdi_basis };
}
