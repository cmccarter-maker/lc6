// LC6 activity-specific constants: PHY-031 Component Cycle Model (resort skiing/snowboarding)
// Per PHY-031 v1 RATIFIED spec §2.2 — values locked, traceable to LC5 ratified Mar 17, 2026.
// Per Cardinal Rule #1: every constant traces to a published source or LC5 LOCKED reference.
//
// These constants are ACTIVITY-specific (resort skiing/snowboarding cycle model), NOT
// thermal-engine primitives. They are deliberately kept out of heat_balance/constants.ts
// to preserve that file's Cardinal Rule #8 scope (thermal-engine-wide physics only).
//
// Consumed by: activities/crowd_factor.ts (cycle-duration helper)
// Spec reference: LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md §2.2

/**
 * Default lift ride duration (minutes).
 * Western resort high-speed detachable quad average.
 * Sample basis: Breck Falcon SuperChair 6 min; Copper American Flyer 7 min;
 * Vail Eagle Bahn gondola 8 min.
 * Spec: PHY-031 §2.2 (LC5 ratified Mar 17, 2026).
 */
export const DEFAULT_LIFT_MIN = 7;

/**
 * Transition time per cycle (minutes).
 * Covers: dismount from lift + strap-in (snowboard) or boot-tightening (ski)
 * + traverse to run entry + traverse from run exit to lift line.
 * Applied once per cycle.
 * Spec: PHY-031 §2.2 (LC5 ratified Mar 17, 2026).
 */
export const TRANSITION_MIN = 3;

/**
 * Rest fraction — fraction of total session time spent off-cycle.
 * Covers: bathroom breaks, lunch, beer, resting quads, gear adjustments.
 * Applied as effectiveMinutes = durationMin × (1 − REST_FRACTION).
 *
 * Fixed at 0.20 (moderate-intensity population baseline). NOT tiered by ability,
 * intensity, or riding style per spec §2.3 — tiering creates a second free parameter
 * alongside terrain-specific runMin that can be gamed to match any target, violating
 * Cardinal Rule #1 (no fudge factors). Personal calibration is handled via the
 * ski-history override path (spec §8), which replaces cycle count directly rather
 * than tuning REST_FRACTION.
 *
 * Spec: PHY-031 §2.2 (LC5 ratified Mar 17, 2026; confirmed S28).
 */
export const REST_FRACTION = 0.20;
