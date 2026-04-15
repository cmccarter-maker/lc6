// CDI v1.4 §4.2 — clinical stage detection
// First-match priority: checks proceed in severity order, first match wins.
// Stage thresholds cited per v1.4 §2.4 (Mayo, ACSM 2021/2023, Castellani 2016,
// WMS 2019, Korey Stringer Institute, NIH).

import type {
  StageDetectionInput,
  StageDetectionOutput,
  ClinicalStage,
} from '../types.js';

// Cold thresholds (°C, T_core)
const COLD_T_CORE_SEVERE = 32.0;             // WMS 2019 profound hypothermia
const COLD_T_CORE_MILD_DETERIORATING = 34.0; // CDI v1.4 §4.2
const COLD_T_CORE_INTENSIFYING = 35.5;       // CDI v1.4 §2.3 corrected scale
const COLD_S_THRESHOLD_W = -20;              // active heat loss for cold_compensable

// Heat thresholds (°C, T_core)
const HEAT_T_CORE_STROKE = 40.0;             // ACSM 2023 heat stroke
const HEAT_T_CORE_EXHAUSTION_DETERIORATING = 39.5;
const HEAT_T_CORE_EXHAUSTION = 38.5;         // ACSM heat exhaustion onset
const HEAT_T_CORE_INTENSIFYING = 37.8;       // CDI v1.4 §2.3
const HEAT_S_THRESHOLD_W = 20;
const SWEAT_INTENSIFYING_FRACTION = 0.7;     // sweat > 70% SW_max → intensifying

export function detectStage(input: StageDetectionInput): StageDetectionOutput {
  const {
    T_core,
    S,
    Q_shiver,
    q_shiver_sustained,
    shivering_ceased_involuntarily,
    vasoconstriction_active,
    sweat_rate,
    SW_max,
    T_core_projected_next_slice,
    cognitive_impairment_observed,
  } = input;

  // === Neutral regime ===
  if (Math.abs(S) < 5 && T_core >= 36.5 && T_core <= 37.5 && Q_shiver === 0 && sweat_rate < 0.05) {
    return {
      stage: 'thermal_neutral',
      regime: 'neutral',
      reasoning: 'S near zero, T_core in neutral band, no shivering or significant sweating',
    };
  }

  // === Cold regime (S < 0) ===
  if (S < 0) {
    // Severe hypothermia: T_core ≤ 32°C OR projected ≤ 32°C OR involuntary shivering cessation
    if (T_core <= COLD_T_CORE_SEVERE) {
      return {
        stage: 'severe_hypothermia',
        regime: 'cold',
        reasoning: `T_core ${T_core.toFixed(2)}°C ≤ ${COLD_T_CORE_SEVERE}°C threshold`,
      };
    }
    if (T_core_projected_next_slice <= COLD_T_CORE_SEVERE) {
      return {
        stage: 'severe_hypothermia',
        regime: 'cold',
        reasoning: `T_core projected to cross ${COLD_T_CORE_SEVERE}°C within next slice (currently ${T_core.toFixed(2)}°C, projected ${T_core_projected_next_slice.toFixed(2)}°C)`,
      };
    }
    // Note: shivering_ceased_involuntarily includes T_core-falling check when called from caller context.
    // Here we trust the input flag.
    if (shivering_ceased_involuntarily) {
      return {
        stage: 'severe_hypothermia',
        regime: 'cold',
        reasoning: 'Involuntary shivering cessation detected (Q_shiver dropped from >100W to <30W while T_core falling)',
      };
    }

    // Mild hypothermia deteriorating: T_core < 34°C AND sustained shivering
    if (T_core < COLD_T_CORE_MILD_DETERIORATING && q_shiver_sustained) {
      return {
        stage: 'mild_hypothermia_deteriorating',
        regime: 'cold',
        reasoning: `T_core ${T_core.toFixed(2)}°C < ${COLD_T_CORE_MILD_DETERIORATING}°C with sustained shivering`,
      };
    }

    // Mild hypothermia: sustained shivering (regardless of T_core, per v1.4 §4.2 — Q_shiver is dispositive signal)
    if (q_shiver_sustained) {
      return {
        stage: 'mild_hypothermia',
        regime: 'cold',
        reasoning: `Sustained shivering active (Q_shiver > 50W for 5+ min) — mild hypothermia per Mayo/ACSM clinical staging`,
      };
    }

    // Cold intensifying: T_core < 35.5°C OR transient (non-sustained) shivering
    if (T_core < COLD_T_CORE_INTENSIFYING || (Q_shiver > 0 && !q_shiver_sustained)) {
      return {
        stage: 'cold_intensifying',
        regime: 'cold',
        reasoning: T_core < COLD_T_CORE_INTENSIFYING
          ? `T_core ${T_core.toFixed(2)}°C < ${COLD_T_CORE_INTENSIFYING}°C (approaching shivering threshold)`
          : `Transient shivering detected (Q_shiver > 0, not yet sustained)`,
      };
    }

    // Cold compensable: vasoconstriction active AND active heat loss
    if (vasoconstriction_active && S < COLD_S_THRESHOLD_W) {
      return {
        stage: 'cold_compensable',
        regime: 'cold',
        reasoning: `Vasoconstriction active, heat loss S=${S.toFixed(1)}W; body in compensable cold stress`,
      };
    }

    // Default fallback for cold regime: neutral (shouldn't reach here often)
    return {
      stage: 'thermal_neutral',
      regime: 'neutral',
      reasoning: `Cold regime but no defense response engaged (T_core ${T_core.toFixed(2)}°C, no vasoconstriction, S=${S.toFixed(1)}W)`,
    };
  }

  // === Heat regime (S > 0) ===
  if (S > 0) {
    // Heat stroke: T_core ≥ 40°C OR projected ≥ 40°C within next slice OR cognitive impairment observed
    if (T_core >= HEAT_T_CORE_STROKE) {
      return {
        stage: 'heat_stroke',
        regime: 'heat',
        reasoning: `T_core ${T_core.toFixed(2)}°C ≥ ${HEAT_T_CORE_STROKE}°C heat stroke threshold`,
      };
    }
    if (T_core_projected_next_slice >= HEAT_T_CORE_STROKE) {
      return {
        stage: 'heat_stroke',
        regime: 'heat',
        reasoning: `T_core projected to cross ${HEAT_T_CORE_STROKE}°C within next slice (currently ${T_core.toFixed(2)}°C, projected ${T_core_projected_next_slice.toFixed(2)}°C)`,
      };
    }
    if (cognitive_impairment_observed) {
      return {
        stage: 'heat_stroke',
        regime: 'heat',
        reasoning: 'Cognitive impairment observed during hyperthermia (heat stroke diagnostic criterion)',
      };
    }

    // Heat exhaustion deteriorating: T_core ≥ 39.5°C
    if (T_core >= HEAT_T_CORE_EXHAUSTION_DETERIORATING) {
      return {
        stage: 'heat_exhaustion_deteriorating',
        regime: 'heat',
        reasoning: `T_core ${T_core.toFixed(2)}°C ≥ ${HEAT_T_CORE_EXHAUSTION_DETERIORATING}°C (pre-stroke)`,
      };
    }

    // Heat exhaustion: T_core ≥ 38.5°C
    if (T_core >= HEAT_T_CORE_EXHAUSTION) {
      return {
        stage: 'heat_exhaustion',
        regime: 'heat',
        reasoning: `T_core ${T_core.toFixed(2)}°C ≥ ${HEAT_T_CORE_EXHAUSTION}°C heat exhaustion threshold`,
      };
    }

    // Heat intensifying: T_core ≥ 37.8°C OR sweat rate > 70% SW_max
    const sweatFraction = SW_max > 0 ? sweat_rate / SW_max : 0;
    if (T_core >= HEAT_T_CORE_INTENSIFYING || sweatFraction > SWEAT_INTENSIFYING_FRACTION) {
      return {
        stage: 'heat_intensifying',
        regime: 'heat',
        reasoning: T_core >= HEAT_T_CORE_INTENSIFYING
          ? `T_core ${T_core.toFixed(2)}°C ≥ ${HEAT_T_CORE_INTENSIFYING}°C`
          : `Sweat rate ${(sweatFraction * 100).toFixed(0)}% of SW_max (> 70%)`,
      };
    }

    // Heat compensable: sweating active AND active heat gain
    if (sweat_rate > 0 && S > HEAT_S_THRESHOLD_W) {
      return {
        stage: 'heat_compensable',
        regime: 'heat',
        reasoning: `Sweating active, heat gain S=${S.toFixed(1)}W; body in compensable heat stress`,
      };
    }

    // Default fallback for heat regime
    return {
      stage: 'thermal_neutral',
      regime: 'neutral',
      reasoning: `Heat regime but no defense response engaged (T_core ${T_core.toFixed(2)}°C, sweat ${sweat_rate.toFixed(2)}g/s, S=${S.toFixed(1)}W)`,
    };
  }

  // === S ≈ 0, neither cold nor heat regime ===
  return {
    stage: 'thermal_neutral',
    regime: 'neutral',
    reasoning: `S=${S.toFixed(1)}W in neutral band, no significant heat exchange direction`,
  };
}

/**
 * Per CDI v1.4 §4.6 — stage promotion rule.
 * If τ_to_next < 15 min for current stage, effective stage promotes to next-worse for CDI floor purposes.
 * No chained promotions; this applies once.
 */
export function applyStagePromotion(
  stage: ClinicalStage,
  tau_to_next_hr: number | null,
): ClinicalStage {
  if (tau_to_next_hr === null) return stage; // terminal stage; no promotion
  if (tau_to_next_hr >= 0.25) return stage;  // not within promotion threshold

  const nextStage: Partial<Record<ClinicalStage, ClinicalStage>> = {
    cold_compensable: 'cold_intensifying',
    cold_intensifying: 'mild_hypothermia',
    mild_hypothermia: 'mild_hypothermia_deteriorating',
    mild_hypothermia_deteriorating: 'severe_hypothermia',

    heat_compensable: 'heat_intensifying',
    heat_intensifying: 'heat_exhaustion',
    heat_exhaustion: 'heat_exhaustion_deteriorating',
    heat_exhaustion_deteriorating: 'heat_stroke',
  };

  return nextStage[stage] ?? stage;
}
