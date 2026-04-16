// Moisture-related constants: fatigue, CLO feedback, layer caps.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * PHY-034: Cumulative insulation degradation — conductivity fatigue accumulator.
 *
 * When M_trapped exceeds CROSSOVER_LITERS, liquid bridges form between fibers
 * (25× air conductivity). Bridges don't fully dissolve when moisture drops —
 * hysteresis + capillary condensation + fiber deformation.
 *
 * ScienceDirect Fig 14.4: synthetic battings lose 40-75% insulation at 50% moisture.
 * Wang & Havenith: 2-8% insulation decrease per perspiration event.
 *
 * Calibration: B2 profile — moguls19F → ~21%, groomers34F → ~6%, fishing → ~11%.
 *
 * LC5 risk_functions.js lines 1957-1961.
 */
export const CROSSOVER_LITERS = 0.10;     // onset of measurable conductivity change
export const FATIGUE_PER_MIN = 0.001;     // calibrated B2
export const RECOVERY_PER_MIN = 0.002;    // asymmetric by design (surface tension hysteresis)
export const MAX_FATIGUE = 0.40;          // cap at 40% (Paramount: fiberglass 20-40% R-value loss)

/**
 * PHY-043: Thermal time constant for CLO feedback in intermittent activities.
 *
 * Havenith (2002): microclimate reaches 63% of steady-state in ~12-20 min
 * for CLO 2.0-3.0. Short run phases (3-10 min) never reach thermal equilibrium.
 *
 * LC5 risk_functions.js line 1965.
 */
export const TAU_CLOTHING = 15; // minutes

/**
 * PHY-043: Microclimate cooling time constant.
 *
 * Insulation slows heat loss during rest/lift phases.
 *
 * LC5 risk_functions.js line 1966.
 */
export const TAU_COOL = 20; // minutes

/**
 * Generic per-layer moisture caps (4-layer reference).
 *
 * Sum = 0.420 L = FABRIC_CAPACITY_LITERS.
 * Used in return assembly for lay saturation display when no per-item gear entered.
 *
 * LC5 risk_functions.js line 1982.
 */
export const GENERIC_LAYER_CAPS: readonly number[] = [0.160, 0.120, 0.080, 0.060];
