// LC6 thermal engine constants
// All values ported verbatim from LC5 risk_functions.js (locked state, April 2026 audit).
// Per Cardinal Rule #1: every constant traces to a published source or LC5 LOCKED reference.
// Per Cardinal Rule #8: do not modify these without Chat-produced spec amendment.

/**
 * Latent heat of vaporization of water at body temperature.
 * Used to convert evaporative heat loss (W) to sweat mass loss (g/s, g/hr).
 * Source: CRC Handbook of Chemistry and Physics, water at ~33°C.
 * LC5 reference: risk_functions.js line 6 `LC5_L_V = 2430`.
 */
export const L_V_J_PER_G = 2430;

/**
 * Baseline ensemble Woodcock im (moisture permeability index).
 * Reference value for "all-average layers via serial resistance harmonic mean":
 *   1 / (1/0.35 + 1/0.30 + 1/0.20) = 0.089
 * Used so standard gear produces imFactor = 1.0 (backward compatibility with LC5).
 * Source: ISO 9920 / Havenith 2000; LC5 risk_functions.js line 1917.
 */
export const BASELINE_IM = 0.089;

/**
 * Typical ensemble im for users without gear input (PHY-025R).
 * Represents insulated ski jacket (im ~0.14) + basic fleece (im ~0.22)
 * + cotton/basic synthetic (im ~0.25). Harmonic mean ≈ 0.064, rounded to 0.063.
 * 29% below BASELINE_IM — reflects real-world penalty of non-technical gear.
 * LC5 risk_functions.js line 1922.
 */
export const TYPICAL_ENSEMBLE_IM = 0.063;

/**
 * Natural convection minimum airflow (mph equivalent).
 * Body heat creates updraft even in still air. Per PHY-041.
 * LC5 risk_functions.js line 1934.
 */
export const V_BOUNDARY_MPH = 2.0;

/**
 * Minimum retained moisture floor (liters).
 * Physical limit from skin-garment boundary layer, yarn interstices,
 * hygroscopic fiber absorption. Not a fudge factor — physical floor.
 * Per PHY-041. LC5 risk_functions.js line 1937.
 */
export const MIN_RETAINED_LITERS = 0.005;

/**
 * Fabric saturation capacity reference (4-layer max).
 * 0.42 L. Used as denominator in fatigue severity calculations.
 * Per PHY-038 A5. LC5 risk_functions.js line 1942.
 * Per-activity capacity computed via getEnsembleCapacity().
 */
export const FABRIC_CAPACITY_LITERS = 0.42;

/**
 * Hygroscopic absorption scaling constant (L per kPa·im·regain per cycle).
 * Per PHY-032: ambient vapor absorbed by fabric fibers.
 * Replaces applyHumidityFloor with physics-based model via Clausius-Clapeyron + Woodcock im + ASTM D1909.
 * LC5 risk_functions.js line 1945.
 */
export const C_HYGRO = 0.012;

/**
 * Polyester fiber regain coefficient (default).
 * ASTM D1909. Wool ~0.16, cotton ~0.075, polyester ~0.004.
 * LC5 risk_functions.js line 1946.
 */
export const DEFAULT_REGAIN_POLYESTER = 0.004;

/**
 * Per-activity layer count (default gear, not user-specific).
 * Drives ensemble moisture capacity per PHY-038 A5.
 * LC5 risk_functions.js lines 1984-1991.
 */
export const ACTIVITY_LAYER_COUNT: Readonly<Record<string, number>> = {
  skiing: 4, snowboarding: 4, cross_country_ski: 3, snowshoeing: 4,
  day_hike: 3, hiking: 3, backpacking: 3, trail_running: 2, running: 2,
  road_cycling: 3, gravel_biking: 3, mountain_biking: 3,
  climbing: 3, bouldering: 2,
  camping: 4, fishing: 2, golf: 2, hunting: 3,
  kayaking: 2, paddle_boarding: 2, skateboarding: 2, onewheel: 2,
};

/**
 * Magnus formula constants for saturation vapor pressure.
 * Source: Alduchov & Eskridge 1996 — improved accuracy over original Magnus 1844.
 * Used by satVaporPressure().
 */
export const MAGNUS_A = 17.27;
export const MAGNUS_B = 237.3;     // °C
export const MAGNUS_E0_HPA = 6.1078;  // hPa at 0°C

/**
 * VPD reference: 20°C (68°F), 50% RH — standard exercise physiology lab environment
 * where base sweat rates were originally measured (ISO 8996, Parsons 2014).
 * Computed at module-load time in vpd.ts because depends on satVaporPressure.
 */
