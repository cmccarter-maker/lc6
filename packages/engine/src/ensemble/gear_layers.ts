// Gear item analysis and layer array construction.
// All ported VERBATIM from LC5 risk_functions.js (April 2026 audit baseline).
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.

/**
 * Fiber type classification.
 * Used to determine moisture absorption behavior per ASTM D1909.
 */
export type FiberType = 'WOOL' | 'COTTON' | 'SYNTHETIC' | 'DOWN';

/**
 * Gear item shape used by buildLayerArray.
 * Loose typing matches LC5 — many fields optional, function uses 3-level fallback.
 */
export interface GearItem {
  material?: string;
  brand?: string;
  model?: string;
  name?: string;
  weightG?: number;
  warmth?: number;
  warmthRatio?: number;
  breathability?: number;
  moisture?: number;
  moistureWicking?: number;
}

/**
 * Per-layer object in buildLayerArray result.
 */
export interface GearLayer {
  im: number;
  cap: number;
  buffer: number;
  wicking: number;
  fiber: FiberType;
  name: string;
}

/**
 * PHY-071: Fiber saturation capacity coefficients.
 *
 * CORRECTED from moisture regain (ASTM D1909 equilibrium values) to
 * SATURATION CAPACITY — the maximum liquid water the fabric retains
 * before drip-off, expressed as fraction of dry weight.
 *
 * These determine per-layer buffer capacity for accumulating liquid sweat.
 * Consumed by getLayerCapacity() to produce cap values used in the
 * saturation cascade model (Yoo & Kim 2008 Fukazawa 40mL threshold).
 *
 * Values per:
 *   - Rossi 2005 (Thermal Manikins and Modelling §9.4)
 *   - Holmer 2005 (Int J Ind Ergonomics 36:1025-1031)
 *   - Das 2007 (Science in Clothing Comfort Ch.6)
 *   - Fukazawa 2003 (fabric absorbency methodology)
 *   - Scheurell 1985 (down cluster degradation at saturation)
 *
 *   SYNTHETIC: 0.40 — polyester/nylon at wet-out (range 0.35-0.50)
 *   WOOL:      0.35 — merino at wet-out (close to regain — wool's advantage)
 *   COTTON:    2.00 — cotton holds ~2x dry weight (Rossi 1.5-2.5 range)
 *   DOWN:      0.60 — clusters at saturation; catastrophic loft loss past this
 *
 * Previous LC5 values were moisture regain (ASTM D1909) — a different
 * physical quantity (equilibrium moisture at 65%RH, not liquid saturation).
 * Using regain where capacity was needed under-reported buffer by ~7x for
 * synthetics, causing systematic false-positive saturation cascades.
 */
export const FIBER_ABSORPTION: Readonly<Record<FiberType, number>> = {
  SYNTHETIC: 0.40,
  WOOL: 0.35,
  COTTON: 2.00,
  DOWN: 0.60,
};

/**
 * Resolve fiber type from gear item using 3-level fallback.
 * Level 1: explicit material field (future scraper)
 * Level 2: keyword scan on brand + model + name
 * Level 3: default to SYNTHETIC
 *
 * LC5 risk_functions.js lines 199-214.
 */
export function getFiberType(item: GearItem | null | undefined): FiberType {
  // Level 1: explicit material field
  if (item?.material) {
    if (/merino|wool/i.test(item.material)) return 'WOOL';
    if (/cotton|denim/i.test(item.material)) return 'COTTON';
    if (/down/i.test(item.material)) return 'DOWN';
    return 'SYNTHETIC';
  }
  // Level 2: keyword scan on brand + model + name
  const hay = ((item?.brand ?? '') + (item?.model ?? '') + (item?.name ?? '')).toLowerCase();
  if (/merino|wool|smartwool|icebreaker/.test(hay)) return 'WOOL';
  if (/cotton|denim|canvas|flannel/.test(hay)) return 'COTTON';
  if (/down|puffy|800.?fill|700.?fill/.test(hay)) return 'DOWN';
  // Level 3: default
  return 'SYNTHETIC';
}

/**
 * Per-layer moisture capacity in mL.
 * Estimated from garment weight × fiber absorption coefficient.
 * If weightG missing, derived from warmth score (100g + 20g per warmth point).
 *
 * Returns minimum 2mL (physical floor — even mesh holds some moisture in interstices).
 *
 * LC5 risk_functions.js lines 225-230.
 */
export function getLayerCapacity(
  item: GearItem | null | undefined,
  fiberType: FiberType,
): number {
  const absorption = FIBER_ABSORPTION[fiberType] ?? 0.02;
  // Estimate garment weight from warmth score if weightG not available
  const warmth = item?.warmthRatio ?? item?.warmth ?? 5;
  const weightG = item?.weightG ?? (100 + warmth * 20);
  return Math.max(2, weightG * absorption);
}

/**
 * Map breathability score (1-10) to per-layer Woodcock im.
 * Soft mapping: B=10 → im=0.45 (mesh), B=7 → im=0.20 (standard), B=4 → im=0.08 (sealed).
 * Piecewise linear: 1-4 → 0.05-0.08, 5-7 → 0.10-0.20, 8-10 → 0.25-0.45.
 *
 * LC5 risk_functions.js lines 234-241.
 */
export function breathabilityToIm(breathScore: number | null | undefined): number {
  if (!breathScore || breathScore <= 0) return 0.08;
  if (breathScore >= 10) return 0.45;
  // Piecewise
  if (breathScore <= 4) return 0.05 + breathScore * 0.0075;
  if (breathScore <= 7) return 0.05 + (breathScore - 4) * 0.05;
  return 0.20 + (breathScore - 7) * 0.083;
}

/**
 * Per-activity default CLO (used when buildLayerArray has no gear items).
 * Returns activity-typical CLO; defaults to 1.5 for unknown activities.
 *
 * LC5 risk_functions.js lines 3882-3889.
 */
export function activityCLO(activity: string): number {
  const map: Record<string, number> = {
    skiing: 2.5, snowboarding: 2.5, cross_country_ski: 1.8,
    running: 0.8, road_cycling: 1.2, gravel_biking: 1.4, mountain_biking: 1.5,
    day_hike: 1.5, hiking: 1.5, backpacking: 1.8, snowshoeing: 2.0,
    bouldering: 1.2, climbing: 1.5, skateboarding: 1.0, onewheel: 1.0,
    camping: 2.0, fishing: 1.8, golf: 1.2, hunting: 1.8,
    kayaking: 1.5, paddle_boarding: 1.0,
  };
  return map[activity] ?? 1.5;
}

/**
 * Map warmth rating (1-10) to CLO units.
 * Lookup table; clamps input to [1, 10].
 *
 * LC5 risk_functions.js lines 2379-2383.
 */
export function warmthToCLO(warmthRating: number): number {
  const map = [0, 0.10, 0.20, 0.30, 0.50, 0.70, 1.00, 1.30, 1.60, 2.00, 2.50];
  const r = Math.max(1, Math.min(10, Math.round(warmthRating)));
  return map[r]!;
}

/**
 * Build per-layer array for the per-layer buffer model.
 *
 * If gearItems provided, builds from actual user gear (using getFiberType/breathabilityToIm/getLayerCapacity).
 * Otherwise builds default layer stack matching activityCLO with stack depth based on CLO threshold:
 *   - CLO ≥ 2.0: 4-layer stack (base + mid + insulation + shell)
 *   - CLO < 2.0: 3-layer stack (base + mid + shell)
 *
 * Strategy pill flag (isStrategyPill) selects optimized synthetic base; otherwise typical merino default.
 *
 * LC5 risk_functions.js lines 247-283.
 *
 * @param gearItems user gear items (optional); when present, builds from actual gear
 * @param activity activity ID; used for default CLO if totalCLO not provided
 * @param totalCLO total CLO override (optional)
 * @param isStrategyPill if true, use optimized strategy base; otherwise user-default merino base
 */
export function buildLayerArray(
  gearItems: GearItem[] | null | undefined,
  activity?: string,
  totalCLO?: number,
  isStrategyPill?: boolean,
): GearLayer[] {
  if (gearItems && gearItems.length > 0) {
    return gearItems.map((item) => {
      const fiber = getFiberType(item);
      return {
        im: breathabilityToIm(item.breathability),
        cap: getLayerCapacity(item, fiber),
        buffer: 0,
        wicking: item.moisture ?? item.moistureWicking ?? 7,
        fiber,
        name: (item.brand ?? '') + ' ' + (item.model ?? item.name ?? ''),
      };
    });
  }

  // Default layer stack — differs by pill type
  const clo = totalCLO ?? activityCLO(activity ?? 'skiing');
  const nLayers = clo >= 2.0 ? 4 : 3; // minimum 3 layers
  const defaults: GearLayer[] = [];

  if (isStrategyPill) {
    // Strategy recommendation: synthetic base, high wicking
    defaults.push({
      im: 0.35,
      cap: getLayerCapacity({ warmth: 5 }, 'SYNTHETIC'),
      buffer: 0,
      wicking: 10,
      fiber: 'SYNTHETIC',
      name: 'Optimized Synthetic Base',
    });
  } else {
    // User default: typical retail merino base
    defaults.push({
      im: 0.25,
      cap: getLayerCapacity({ warmth: 5 }, 'WOOL'),
      buffer: 0,
      wicking: 6,
      fiber: 'WOOL',
      name: 'Typical Merino Base',
    });
  }

  if (nLayers >= 3) {
    // Mid layer: fleece — warmth ~5
    defaults.push({
      im: 0.30,
      cap: getLayerCapacity({ warmth: 5 }, 'SYNTHETIC'),
      buffer: 0,
      wicking: 8,
      fiber: 'SYNTHETIC',
      name: 'Default Mid',
    });
  }

  if (nLayers >= 4) {
    // Insulation — warmth ~7
    defaults.push({
      im: 0.15,
      cap: getLayerCapacity({ warmth: 7 }, 'SYNTHETIC'),
      buffer: 0,
      wicking: 6,
      fiber: 'SYNTHETIC',
      name: 'Default Insulation',
    });
  }

  // Shell: always present
  defaults.push({
    im: 0.12,
    cap: getLayerCapacity({ warmth: 2 }, 'SYNTHETIC'),
    buffer: 0,
    wicking: 4,
    fiber: 'SYNTHETIC',
    name: 'Default Shell',
  });

  return defaults;
}
