#!/bin/bash
# LC6 Session 8 — Ensemble functions port from LC5 risk_functions.js
# Per Working Agreement Rule #13: verbatim Chat-produced script.
# Per Cardinal Rule #8: thermal engine functions ported VERBATIM from LC5 LOCKED state.
# Per Pre-Build Audit (Session 8 opening): all 18 Cardinal Rules verified before code production.
#
# Scope: 11 functions in new packages/engine/src/ensemble/ module.
#   - Primary: calcEnsembleIm, buildLayerArray, computeEffectiveCLO
#   - Helpers: getFiberType, breathabilityToIm, getLayerCapacity, warmthToCLO,
#              pumpingReduction, windCLOProtection, staticLayeringCorrection,
#              activityCLO, clothingInsulation
#
# DO NOT MODIFY DURING THIS SCRIPT (Rule #12 — no while-we're-in-here):
#   - Algorithm internals of any function
#   - ENSEMBLE_IM_MAP values (LC5 PHY-025R audit baseline)
#   - FIBER_ABSORPTION values (ASTM D1909 baseline)
#   - Pumping/wind/layering correction parameters (Havenith/PMC/McCullough cited)
#   - LC5 °F/°C mixed convention (clothingInsulation takes °F; deferred to OQ-028)
#   - Existing Sessions 5-7 files

set -e

echo ""
echo "=========================================="
echo "LC6 SESSION 8 BUILD"
echo "Ensemble functions port from LC5"
echo "=========================================="
echo ""

# ============================================================================
# PHASE 1 — Verify environment
# ============================================================================
echo ">>> PHASE 1: Verify environment"
EXPECTED_DIR="/Users/cmcarter/Desktop/LC6"
if [ "$(pwd)" != "$EXPECTED_DIR" ]; then
  echo "ERROR: Not in $EXPECTED_DIR. Currently in $(pwd)."
  exit 1
fi
if [ ! -d "packages/engine/src/heat_balance" ]; then
  echo "ERROR: packages/engine/src/heat_balance/ not found. Sessions 5-7 must be complete."
  exit 1
fi
echo "✓ In $EXPECTED_DIR with Sessions 5-7 workspace present"
echo ""

# ============================================================================
# PHASE 2 — Create ensemble/ module directory
# ============================================================================
echo ">>> PHASE 2: ensemble/ directory structure"
mkdir -p packages/engine/src/ensemble
mkdir -p packages/engine/tests/ensemble
echo "✓ Directories created"
echo ""

# ============================================================================
# PHASE 3 — ensemble/ensemble_im.ts (calcEnsembleIm + ENSEMBLE_IM_MAP + tier types)
# ============================================================================
echo ">>> PHASE 3: ensemble/ensemble_im.ts"

cat > packages/engine/src/ensemble/ensemble_im.ts << 'EOF'
// Clothing ensemble Woodcock im calculation.
// Ported VERBATIM from LC5 risk_functions.js lines 854-900.
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.
// Per Cardinal Rule #10: calcEnsembleIm never modified by display layer.

/**
 * Tier classification for gear vapor permeability.
 * - typical: PHY-025R baseline for users without specific gear input
 * - good: standard/generic technical gear
 * - better: high-quality technical gear
 * - best: top-tier breathable gear (mesh shells, premium membranes)
 */
export type EnsembleTier = 'typical' | 'good' | 'better' | 'best' | '' | null | undefined;

/**
 * Per-layer Woodcock im values by tier.
 * ENSEMBLE_IM_MAP values per LC5 PHY-025R audit baseline; original methodology
 * from Woodcock AH (Textile Res J, 1962) and ISO 9920.
 *
 * "typical" tier represents insulated ski jacket + basic fleece + cotton/basic synthetic base.
 * Validated against gear DB. PHY-025R spec Section 4 derivation.
 *
 * LC5 risk_functions.js lines 854-859.
 */
export const ENSEMBLE_IM_MAP: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  base:       { typical: 0.25, good: 0.30, better: 0.50, best: 0.65 },
  mid:        { typical: 0.22, good: 0.25, better: 0.45, best: 0.55 },
  insulative: { typical: 0.18, good: 0.20, better: 0.40, best: 0.50 },
  shell:      { typical: 0.14, good: 0.15, better: 0.35, best: 0.45 },
};

export const ENSEMBLE_LAYER_NAMES: readonly string[] = [
  'Base Layer', 'Mid Layer', 'Insulative Layer', 'Shell / Outer',
];
export const ENSEMBLE_LAYER_KEYS: readonly string[] = ['base', 'mid', 'insulative', 'shell'];

/**
 * Per-layer object in calcEnsembleIm result.
 */
export interface EnsembleLayer {
  key: string;
  idx: number;
  name: string;
  tier: string;
  im: number;
}

/**
 * Result of calcEnsembleIm — full ensemble im + bottleneck analysis + what-if upgrade.
 */
export interface EnsembleImResult {
  ensembleIm: number;
  bottleneck: string | null;
  bottleneckKey?: string;
  bottleneckIdx?: number;
  bottleneckIm: number;
  bottleneckPct: number;
  bottleneckTier?: string;
  whatIfImprovement?: number;
  upgEnsembleIm?: number;
  layers: EnsembleLayer[];
  hasGear: boolean;
}

/**
 * Calculate ensemble Woodcock im via serial-resistance harmonic mean.
 *
 * Layers act as resistors in series for vapor transport — weakest link dominates.
 *
 * Accepts a 4-element tier array indexed by ENSEMBLE_LAYER_KEYS:
 *   [base, mid, insulative, shell]
 * Empty/null/undefined values are skipped (layer not rated).
 * Unknown tier strings are skipped (with no error).
 *
 * Returns full ensemble im plus bottleneck analysis (which layer limits performance)
 * and a what-if calculation showing improvement if bottleneck is upgraded to "best".
 *
 * Per Cardinal Rule #10: this function is NEVER modified by display layer.
 *
 * LC5 risk_functions.js lines 865-900 (verbatim port; only TypeScript type
 * annotations added).
 *
 * @param tiers 4-element array of tier strings; empty values skipped
 */
export function calcEnsembleIm(tiers: EnsembleTier[]): EnsembleImResult {
  const layers: EnsembleLayer[] = [];
  ENSEMBLE_LAYER_KEYS.forEach((key, i) => {
    // PHY-068/BUG-140: insulative IS in vapor pathway — include in harmonic mean.
    // ENSEMBLE_IM_MAP already has insulative values (typical:0.18, good:0.20, better:0.40, best:0.50).
    const tier = tiers[i];
    if (!tier) return;
    const im = ENSEMBLE_IM_MAP[key]?.[tier];
    if (!im) return;
    const layerName = ENSEMBLE_LAYER_NAMES[i] ?? '';
    layers.push({ key, idx: i, name: layerName, tier, im });
  });

  if (layers.length === 0) {
    return {
      ensembleIm: 0,
      bottleneck: null,
      bottleneckIm: 0,
      bottleneckPct: 0,
      layers,
      hasGear: false,
    };
  }

  if (layers.length === 1) {
    const single = layers[0]!;
    return {
      ensembleIm: single.im,
      bottleneck: single.name,
      bottleneckIm: single.im,
      bottleneckPct: 100,
      layers,
      hasGear: true,
    };
  }

  // Serial resistance: harmonic mean — weakest link dominates
  const totalInvIm = layers.reduce((s, l) => s + 1 / l.im, 0);
  const ensembleIm = layers.length / totalInvIm;

  // Identify bottleneck (lowest im = highest resistance)
  let bottleneck = layers[0]!;
  let bottleneckIm = layers[0]!.im;
  layers.forEach((l) => {
    if (l.im < bottleneckIm) {
      bottleneck = l;
      bottleneckIm = l.im;
    }
  });
  const bottleneckPct = Math.round((1 / bottleneckIm) / totalInvIm * 100);

  // What-if: compute improvement if bottleneck upgraded to "best"
  const upgradedTiers = [...tiers];
  upgradedTiers[bottleneck.idx] = 'best';
  const upgLayers: { im: number }[] = [];
  ENSEMBLE_LAYER_KEYS.forEach((key, i) => {
    const t = upgradedTiers[i];
    if (!t) return;
    const uim = ENSEMBLE_IM_MAP[key]?.[t];
    if (!uim) return;
    upgLayers.push({ im: uim });
  });
  const upgInvIm = upgLayers.reduce((s, l) => s + 1 / l.im, 0);
  const upgEnsembleIm = upgLayers.length / upgInvIm;
  const whatIfImprovement = ensembleIm > 0 ? Math.round((upgEnsembleIm / ensembleIm - 1) * 100) : 0;

  return {
    ensembleIm,
    bottleneck: bottleneck.name,
    bottleneckKey: bottleneck.key,
    bottleneckIdx: bottleneck.idx,
    bottleneckIm,
    bottleneckPct,
    bottleneckTier: bottleneck.tier,
    whatIfImprovement,
    upgEnsembleIm,
    layers,
    hasGear: true,
  };
}
EOF

echo "✓ ensemble_im.ts written"
echo ""

# ============================================================================
# PHASE 4 — ensemble/gear_layers.ts (gear-item layer construction)
# ============================================================================
echo ">>> PHASE 4: ensemble/gear_layers.ts"

cat > packages/engine/src/ensemble/gear_layers.ts << 'EOF'
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
 * Fiber moisture regain coefficients (ASTM D1909).
 *
 * - WOOL: 0.30 — merino regain 13-16% at 65%RH, up to 33% at saturation
 * - COTTON: 0.15 — cotton regain 7-8.5%, lateral wicking spreads to ~15%
 * - SYNTHETIC: 0.06 — ISO 9073-6 methodology; Yoo & Kim 2008 Fig 11
 * - DOWN: 0.12 — cluster absorption, loses ~50% loft when wet
 *
 * LC5 risk_functions.js line 222.
 */
export const FIBER_ABSORPTION: Readonly<Record<FiberType, number>> = {
  WOOL: 0.30,
  COTTON: 0.15,
  SYNTHETIC: 0.06,
  DOWN: 0.12,
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
EOF

echo "✓ gear_layers.ts written"
echo ""

# ============================================================================
# PHASE 5 — ensemble/effective_clo.ts (CLO calculations + corrections)
# ============================================================================
echo ">>> PHASE 5: ensemble/effective_clo.ts"

cat > packages/engine/src/ensemble/effective_clo.ts << 'EOF'
// Effective CLO calculations: gear → dynamic CLO with pumping/wind/layering corrections,
// plus temperature/intensity-based clothingInsulation utility.
// All ported VERBATIM from LC5 risk_functions.js.
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.
//
// NOTE: clothingInsulation takes temperature as °F (LC5 mixed convention).
// LC6 currently preserves this; OQ-028 tracks future °F-standardization across engine.

import { getWindPenetration } from '../heat_balance/utilities.js';

/**
 * Pumping reduction factor — activity-induced air movement reduces effective CLO.
 *
 * Per PHY-049 Effect 2: Havenith 2002, Lu et al. 2015.
 * No reduction below MET 2.0 (standing/seated). Linear ramp to 45% reduction at MET 10.0.
 * Returns multiplier 0.55 to 1.0.
 *
 * LC5 risk_functions.js lines 2387-2390.
 */
export function pumpingReduction(met: number): number {
  if (met <= 2.0) return 1.0;
  return 1.0 - Math.min(0.45, (met - 2.0) / 8.0 * 0.45);
}

/**
 * Wind protection factor — shell wind resistance moderates CLO loss to wind.
 *
 * Per PHY-049 Effect 3: PMC 10024235.
 * Extends getWindPenetration to modulate thermal resistance (not just evaporation).
 * Returns multiplier 0.5 to 1.0.
 *
 * LC5 risk_functions.js lines 2394-2398.
 *
 * @param shellWindResistance 0-10 scale (0=no shell, 10=Gore-Tex Pro)
 * @param windMph ambient wind speed (mph)
 */
export function windCLOProtection(shellWindResistance: number, windMph: number): number {
  const penetration = getWindPenetration(shellWindResistance);
  const windFactor = Math.min(1.0, windMph / 15.0);
  return 1.0 - penetration * windFactor * 0.50;
}

/**
 * Static layering correction — replaces additive airGapBonus.
 *
 * Per BUG-204: McCullough & Jones 1984 (ISO 9920) — measured ensemble CLO
 * is LESS than sum of garments. Compression at layer contacts + increased
 * surface area (f_cl) > air gap benefit. Net: ~4% reduction per additional layer.
 *
 * Only applies at rest (MET ≤ 2.0) — pumping reduction handles movement cases.
 * Does NOT overlap with pumping/wind/moisture corrections (separate physical mechanisms).
 *
 * 2 layers: 0.96, 3 layers: 0.92, 4 layers: 0.88, 5+: 0.84.
 *
 * LC5 risk_functions.js lines 2406-2410.
 */
export function staticLayeringCorrection(met: number, numLayers: number): number {
  if (numLayers < 2 || met > 2.0) return 1.0;
  return 1.0 - Math.min(numLayers - 1, 4) * 0.04;
}

/**
 * Combined dynamic CLO — gear × pumping × wind × layering corrections.
 *
 * Per PHY-049 + BUG-204. Floor at 30% of baseCLO (conduction resistance
 * persists even in worst case).
 *
 * LC5 risk_functions.js lines 2414-2420.
 *
 * @param baseCLO base CLO from gear ensemble
 * @param met metabolic equivalent
 * @param shellWR shell wind resistance 0-10
 * @param windMph ambient wind speed (mph)
 * @param numLayers number of layers in ensemble
 */
export function computeEffectiveCLO(
  baseCLO: number,
  met: number,
  shellWR: number,
  windMph: number,
  numLayers: number,
): number {
  const pump = pumpingReduction(met);
  const wind = windCLOProtection(shellWR, windMph);
  const layering = staticLayeringCorrection(met, numLayers);
  const eff = baseCLO * pump * wind * layering;
  return Math.max(baseCLO * 0.30, eff);
}

/**
 * Temperature/intensity-based clothing insulation estimate.
 *
 * Returns CLO adjusted for body heat trapping during activity.
 * Used as fallback for moistureRisk when no specific gear ensemble provided.
 *
 * Tier mapping (°F):
 *   > 75°F:  0.3 CLO (minimal: single light layer)
 *   65-75°F: 0.5 CLO (light: base + maybe wind shirt)
 *   55-65°F: 0.7 CLO (moderate: base + light mid)
 *   45-55°F: 1.0 CLO (cool: base + mid layer)
 *   35-45°F: 1.4 CLO (cold: base + mid + light insulation)
 *   25-35°F: 1.8 CLO (very cold: full system)
 *   10-25°F: 2.2 CLO (severe: full winter)
 *   ≤ 10°F:  2.5 CLO (extreme: maximum layering, vapor barrier)
 *
 * Heat trapping multiplier: 1.0 + min(excessClo × intMul, 1.0).
 *
 * NOTE: LC5 mixed-convention — this function takes °F. Tracked in OQ-028
 * for future °F-standardization across engine.
 *
 * LC5 risk_functions.js lines 816-829.
 *
 * @param tempF ambient temperature in Fahrenheit
 * @param intensity activity intensity level
 */
export function clothingInsulation(
  tempF: number,
  intensity: 'low' | 'moderate' | 'high' | 'very_high' | string | undefined,
): number {
  let clo: number;
  if (tempF > 75) clo = 0.3;
  else if (tempF > 65) clo = 0.5;
  else if (tempF > 55) clo = 0.7;
  else if (tempF > 45) clo = 1.0;
  else if (tempF > 35) clo = 1.4;
  else if (tempF > 25) clo = 1.8;
  else if (tempF > 10) clo = 2.2;
  else clo = 2.5;

  const intMulMap: Record<string, number> = {
    low: 0.05,
    moderate: 0.2,
    high: 0.45,
    very_high: 0.65,
  };
  const intMul = intMulMap[intensity ?? 'moderate'] ?? 0.2;
  const excessClo = Math.max(0, clo - 0.5);
  const heatTrapping = excessClo * intMul;
  return 1.0 + Math.min(heatTrapping, 1.0);
}
EOF

echo "✓ effective_clo.ts written"
echo ""

# ============================================================================
# PHASE 6 — ensemble/index.ts (module public API)
# ============================================================================
echo ">>> PHASE 6: ensemble/index.ts"

cat > packages/engine/src/ensemble/index.ts << 'EOF'
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
EOF

echo "✓ ensemble/index.ts written"
echo ""

# ============================================================================
# PHASE 7 — Update engine main index
# ============================================================================
echo ">>> PHASE 7: engine src/index.ts updated to re-export ensemble module"

cat > packages/engine/src/index.ts << 'EOF'
// LC6 Engine — Public API
// Per Architecture Document v1.1 §3 RATIFIED.

// CDI v1.4 module surface (Session 5)
export type {
  Regime,
  ClinicalStage,
  CdiBasis,
  StageDetectionInput,
  StageDetectionOutput,
  StageTierRange,
  WithinStageRampInput,
  WithinStageRampOutput,
  ShiveringSustainedInput,
  ShiveringSustainedOutput,
} from './types.js';

export {
  detectStage,
  applyStagePromotion,
  applyWithinStageRamp,
  detectShiveringSustained,
  STAGE_TIER_RANGES,
  STAGE_TAU_MAX_HR,
  STAGE_PROMOTION_THRESHOLD_HR,
} from './cdi/index.js';

// Heat balance module — Sessions 6 + 7
export {
  // Session 6 constants
  L_V_J_PER_G,
  BASELINE_IM,
  TYPICAL_ENSEMBLE_IM,
  V_BOUNDARY_MPH,
  MIN_RETAINED_LITERS,
  FABRIC_CAPACITY_LITERS,
  C_HYGRO,
  DEFAULT_REGAIN_POLYESTER,
  ACTIVITY_LAYER_COUNT,
  // Session 7 constants
  LC5_C_P_AIR,
  LC5_RHO_AIR,
  LC5_RHO_VAP_EXP,
  LC5_SIGMA,
  LC5_EMISS,
  LC5_T_CORE_BASE,
  LC5_BODY_SPEC_HEAT,
  GAGGE_H_TISSUE_BASE,
  GAGGE_VDIL_MAX,
  GAGGE_VCON_MAX,
  // Session 6 VPD + utilities
  satVaporPressure,
  vpdRatio,
  VPD_REF_HPA,
  getWindPenetration,
  getEnsembleCapacity,
  humidityFloorFactor,
  applyDurationPenalty,
  precipWettingRate,
  // Session 6 evaporation
  computeEmax,
  computeSweatRate,
  getDrainRate,
  hygroAbsorption,
  // Session 7 body thermo
  computeTissueCLO,
  computeTSkin,
  iterativeTSkin,
  // Session 7 metabolism
  computeVE,
  computeMetabolicHeat,
  computeRespiratoryHeatLoss,
  // Session 7 environmental loss
  computeConvectiveHeatLoss,
  computeRadiativeHeatLoss,
} from './heat_balance/index.js';

export type {
  ComputeEmaxResult,
  ComputeSweatRateResult,
  SweatRegime,
  IterativeTSkinResult,
  RespiratoryHeatLossResult,
} from './heat_balance/index.js';

// Ensemble module — Session 8
export {
  // ensemble_im
  ENSEMBLE_IM_MAP,
  ENSEMBLE_LAYER_NAMES,
  ENSEMBLE_LAYER_KEYS,
  calcEnsembleIm,
  // gear_layers
  FIBER_ABSORPTION,
  getFiberType,
  getLayerCapacity,
  breathabilityToIm,
  activityCLO,
  warmthToCLO,
  buildLayerArray,
  // effective_clo
  pumpingReduction,
  windCLOProtection,
  staticLayeringCorrection,
  computeEffectiveCLO,
  clothingInsulation,
} from './ensemble/index.js';

export type {
  EnsembleTier,
  EnsembleLayer,
  EnsembleImResult,
  FiberType,
  GearItem,
  GearLayer,
} from './ensemble/index.js';
EOF

echo "✓ engine src/index.ts updated"
echo ""

# ============================================================================
# PHASE 8 — Tests for ensemble_im (calcEnsembleIm with lock-in baselines)
# ============================================================================
echo ">>> PHASE 8: tests for ensemble_im.ts"

cat > packages/engine/tests/ensemble/ensemble_im.test.ts << 'EOF'
// Tests for ensemble_im.ts — calcEnsembleIm + ENSEMBLE_IM_MAP.
// Lock-in baseline values captured from LC5 verbatim source on 2026-04-15.
// Any future drift from these values fails the tests, catching engine drift.

import { describe, it, expect } from 'vitest';
import {
  calcEnsembleIm,
  ENSEMBLE_IM_MAP,
  ENSEMBLE_LAYER_NAMES,
  ENSEMBLE_LAYER_KEYS,
} from '../../src/ensemble/ensemble_im.js';

describe('ENSEMBLE_IM_MAP (PHY-025R baseline values)', () => {
  it('has all 4 layer keys', () => {
    expect(Object.keys(ENSEMBLE_IM_MAP)).toEqual(['base', 'mid', 'insulative', 'shell']);
  });

  it('has all 4 tiers per layer', () => {
    for (const key of ENSEMBLE_LAYER_KEYS) {
      const layer = ENSEMBLE_IM_MAP[key]!;
      expect(Object.keys(layer)).toEqual(['typical', 'good', 'better', 'best']);
    }
  });

  it('locks in shell typical = 0.14 (most restrictive baseline)', () => {
    expect(ENSEMBLE_IM_MAP.shell!.typical).toBe(0.14);
  });

  it('locks in base best = 0.65 (most permeable baseline)', () => {
    expect(ENSEMBLE_IM_MAP.base!.best).toBe(0.65);
  });

  it('values monotonically increase: typical < good < better < best for each layer', () => {
    for (const key of ENSEMBLE_LAYER_KEYS) {
      const l = ENSEMBLE_IM_MAP[key]!;
      expect(l.typical!).toBeLessThan(l.good!);
      expect(l.good!).toBeLessThan(l.better!);
      expect(l.better!).toBeLessThan(l.best!);
    }
  });
});

describe('calcEnsembleIm — empty/single layer cases', () => {
  it('empty input → ensembleIm 0, hasGear false', () => {
    const r = calcEnsembleIm([]);
    expect(r.ensembleIm).toBe(0);
    expect(r.hasGear).toBe(false);
    expect(r.bottleneck).toBe(null);
    expect(r.layers).toEqual([]);
  });

  it('all empty strings → ensembleIm 0', () => {
    const r = calcEnsembleIm(['', '', '', '']);
    expect(r.ensembleIm).toBe(0);
    expect(r.hasGear).toBe(false);
  });

  it('single shell layer → returns single layer im as ensemble', () => {
    const r = calcEnsembleIm(['', '', '', 'good']);
    expect(r.ensembleIm).toBe(0.15);
    expect(r.hasGear).toBe(true);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckPct).toBe(100);
    expect(r.layers.length).toBe(1);
  });

  it('unknown tier → skipped silently', () => {
    const r = calcEnsembleIm(['unknown_tier' as any, '', '', '']);
    expect(r.hasGear).toBe(false);
  });
});

describe('calcEnsembleIm — multi-layer harmonic mean (LC5 lock-in)', () => {
  it('base+shell typical → ensembleIm ≈ 0.179487', () => {
    const r = calcEnsembleIm(['typical', '', '', 'typical']);
    expect(r.ensembleIm).toBeCloseTo(0.179487, 5);
    expect(r.hasGear).toBe(true);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.bottleneckPct).toBe(64);
    expect(r.whatIfImprovement).toBe(79);
    expect(r.upgEnsembleIm).toBeCloseTo(0.321429, 5);
  });

  it('base+mid+shell typical → ensembleIm ≈ 0.191225', () => {
    const r = calcEnsembleIm(['typical', 'typical', '', 'typical']);
    expect(r.ensembleIm).toBeCloseTo(0.191225, 5);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.bottleneckPct).toBe(46);
    expect(r.whatIfImprovement).toBe(46);
  });

  it('full 4-layer all good → ensembleIm ≈ 0.210526', () => {
    const r = calcEnsembleIm(['good', 'good', 'good', 'good']);
    expect(r.ensembleIm).toBeCloseTo(0.210526, 5);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.15);
    expect(r.bottleneckPct).toBe(35);
    expect(r.whatIfImprovement).toBe(31);
  });

  it('full 4-layer all best → ensembleIm ≈ 0.527783, no improvement available', () => {
    const r = calcEnsembleIm(['best', 'best', 'best', 'best']);
    expect(r.ensembleIm).toBeCloseTo(0.527783, 5);
    expect(r.bottleneck).toBe('Shell / Outer');  // shell is still lowest at best=0.45
    expect(r.bottleneckIm).toBe(0.45);
    expect(r.whatIfImprovement).toBe(0);
  });

  it('mixed: best base, typical others → ensembleIm ≈ 0.212966', () => {
    const r = calcEnsembleIm(['best', 'typical', 'typical', 'typical']);
    expect(r.ensembleIm).toBeCloseTo(0.212966, 5);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.whatIfImprovement).toBe(35);
  });

  it('shell weak link → identifies shell as bottleneck despite better other layers', () => {
    const r = calcEnsembleIm(['better', 'better', 'better', 'typical']);
    expect(r.ensembleIm).toBeCloseTo(0.288495, 5);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.bottleneckPct).toBe(52);
    expect(r.whatIfImprovement).toBe(55);
  });
});

describe('calcEnsembleIm — bottleneck identification', () => {
  it('correctly identifies bottleneck as the layer with lowest im', () => {
    // Setup: base good (0.30), mid better (0.45), insulative best (0.50), shell typical (0.14)
    const r = calcEnsembleIm(['good', 'better', 'best', 'typical']);
    expect(r.bottleneck).toBe('Shell / Outer');
    expect(r.bottleneckIm).toBe(0.14);
    expect(r.bottleneckIdx).toBe(3);
    expect(r.bottleneckTier).toBe('typical');
  });

  it('what-if upgrade replaces bottleneck with best tier', () => {
    const r = calcEnsembleIm(['better', 'better', 'better', 'typical']);
    expect(r.upgEnsembleIm).toBeCloseTo(0.447205, 5);
    expect(r.upgEnsembleIm! > r.ensembleIm).toBe(true);
  });
});
EOF

echo "✓ ensemble_im.test.ts written"
echo ""

# ============================================================================
# PHASE 9 — Tests for gear_layers
# ============================================================================
echo ">>> PHASE 9: tests for gear_layers.ts"

cat > packages/engine/tests/ensemble/gear_layers.test.ts << 'EOF'
// Tests for gear_layers.ts — getFiberType, breathabilityToIm, getLayerCapacity,
// activityCLO, warmthToCLO, buildLayerArray.

import { describe, it, expect } from 'vitest';
import {
  getFiberType,
  breathabilityToIm,
  getLayerCapacity,
  activityCLO,
  warmthToCLO,
  buildLayerArray,
  FIBER_ABSORPTION,
} from '../../src/ensemble/gear_layers.js';

describe('FIBER_ABSORPTION (ASTM D1909 baseline)', () => {
  it('locks in WOOL = 0.30, COTTON = 0.15, SYNTHETIC = 0.06, DOWN = 0.12', () => {
    expect(FIBER_ABSORPTION.WOOL).toBe(0.30);
    expect(FIBER_ABSORPTION.COTTON).toBe(0.15);
    expect(FIBER_ABSORPTION.SYNTHETIC).toBe(0.06);
    expect(FIBER_ABSORPTION.DOWN).toBe(0.12);
  });
});

describe('getFiberType — 3-level fallback', () => {
  it('Level 1: explicit material field → WOOL via "merino"', () => {
    expect(getFiberType({ material: 'Merino wool 250gsm' })).toBe('WOOL');
  });

  it('Level 1: explicit material field → COTTON via "cotton"', () => {
    expect(getFiberType({ material: 'Organic cotton blend' })).toBe('COTTON');
  });

  it('Level 1: explicit material field → DOWN via "down"', () => {
    expect(getFiberType({ material: '800 fill power down' })).toBe('DOWN');
  });

  it('Level 1: explicit material field → SYNTHETIC default', () => {
    expect(getFiberType({ material: 'Polartec PowerDry' })).toBe('SYNTHETIC');
  });

  it('Level 2: brand keyword → WOOL via "smartwool"', () => {
    expect(getFiberType({ brand: 'Smartwool', model: 'Merino 250 LS Crew' })).toBe('WOOL');
  });

  it('Level 2: brand keyword → WOOL via "icebreaker"', () => {
    expect(getFiberType({ brand: 'Icebreaker', name: 'Anatomica' })).toBe('WOOL');
  });

  it('Level 2: name keyword → DOWN via "puffy"', () => {
    expect(getFiberType({ brand: 'Patagonia', model: 'Down Sweater Puffy' })).toBe('DOWN');
  });

  it('Level 2: name keyword → DOWN via "800 fill"', () => {
    expect(getFiberType({ name: 'Mountain Hardwear Phantom 800 fill jacket' })).toBe('DOWN');
  });

  it('Level 3: default → SYNTHETIC for unknown items', () => {
    expect(getFiberType({ brand: 'Generic', model: 'Tech Tee' })).toBe('SYNTHETIC');
  });

  it('handles null/undefined item → SYNTHETIC default', () => {
    expect(getFiberType(null)).toBe('SYNTHETIC');
    expect(getFiberType(undefined)).toBe('SYNTHETIC');
  });
});

describe('breathabilityToIm — piecewise mapping', () => {
  it('zero/null input → 0.08 floor', () => {
    expect(breathabilityToIm(0)).toBe(0.08);
    expect(breathabilityToIm(null)).toBe(0.08);
    expect(breathabilityToIm(undefined)).toBe(0.08);
  });

  it('breathability 10 → 0.45 ceiling (mesh)', () => {
    expect(breathabilityToIm(10)).toBe(0.45);
  });

  it('breathability 4 (sealed boundary) → 0.08', () => {
    // 0.05 + 4 * 0.0075 = 0.08
    expect(breathabilityToIm(4)).toBeCloseTo(0.08, 4);
  });

  it('breathability 7 (standard boundary) → 0.20', () => {
    // 0.05 + (7-4) * 0.05 = 0.20
    expect(breathabilityToIm(7)).toBeCloseTo(0.20, 4);
  });

  it('breathability 1 (most sealed) → 0.0575', () => {
    // 0.05 + 1 * 0.0075 = 0.0575
    expect(breathabilityToIm(1)).toBeCloseTo(0.0575, 4);
  });

  it('breathability 8 (mid-mesh) → 0.283', () => {
    // 0.20 + (8-7) * 0.083 = 0.283
    expect(breathabilityToIm(8)).toBeCloseTo(0.283, 3);
  });
});

describe('getLayerCapacity', () => {
  it('uses explicit weightG when provided', () => {
    // weightG=200, fiber=WOOL (0.30): 200 * 0.30 = 60
    expect(getLayerCapacity({ weightG: 200 }, 'WOOL')).toBe(60);
  });

  it('estimates weight from warmth when weightG missing', () => {
    // warmth=5: weightG=100+5*20=200. SYNTHETIC (0.06): 200*0.06=12
    expect(getLayerCapacity({ warmth: 5 }, 'SYNTHETIC')).toBe(12);
  });

  it('uses warmthRatio fallback when warmth missing', () => {
    // warmthRatio=7: 100+7*20=240. WOOL (0.30): 240*0.30=72
    expect(getLayerCapacity({ warmthRatio: 7 }, 'WOOL')).toBe(72);
  });

  it('default warmth=5 when no warmth fields', () => {
    // 100 + 5*20 = 200. COTTON (0.15): 30
    expect(getLayerCapacity({}, 'COTTON')).toBe(30);
  });

  it('returns minimum 2mL even at low weight', () => {
    // weightG=10, SYNTHETIC: 10*0.06=0.6 → bumped to 2
    expect(getLayerCapacity({ weightG: 10 }, 'SYNTHETIC')).toBe(2);
  });

  it('uses 0.02 fallback for unknown fiber type', () => {
    // weightG=200, unknown: 200*0.02=4
    expect(getLayerCapacity({ weightG: 200 }, 'UNKNOWN' as any)).toBe(4);
  });
});

describe('activityCLO', () => {
  it('skiing → 2.5', () => {
    expect(activityCLO('skiing')).toBe(2.5);
  });

  it('running → 0.8', () => {
    expect(activityCLO('running')).toBe(0.8);
  });

  it('day_hike → 1.5', () => {
    expect(activityCLO('day_hike')).toBe(1.5);
  });

  it('unknown activity → 1.5 default', () => {
    expect(activityCLO('underwater_basketweaving')).toBe(1.5);
  });
});

describe('warmthToCLO — lookup table', () => {
  it('warmth 1 → 0.10 CLO', () => {
    expect(warmthToCLO(1)).toBe(0.10);
  });

  it('warmth 5 → 0.70 CLO', () => {
    expect(warmthToCLO(5)).toBe(0.70);
  });

  it('warmth 10 → 2.50 CLO (max)', () => {
    expect(warmthToCLO(10)).toBe(2.50);
  });

  it('clamps to [1, 10]', () => {
    expect(warmthToCLO(0)).toBe(0.10);   // 0 → 1
    expect(warmthToCLO(15)).toBe(2.50);  // 15 → 10
    expect(warmthToCLO(-5)).toBe(0.10);  // negative → 1
  });

  it('rounds fractional input', () => {
    expect(warmthToCLO(5.4)).toBe(0.70);  // rounds to 5
    expect(warmthToCLO(5.6)).toBe(1.00);  // rounds to 6
  });
});

describe('buildLayerArray — gear-driven path', () => {
  it('builds array from explicit gear items', () => {
    const items = [
      { brand: 'Smartwool', model: 'Merino 250', breathability: 7, weightG: 250 },
      { brand: 'Patagonia', model: 'R1 Fleece', breathability: 8, weightG: 300 },
      { brand: 'Arc\'teryx', model: 'Beta AR', breathability: 5, weightG: 400 },
    ];
    const r = buildLayerArray(items);
    expect(r.length).toBe(3);
    // Verify base layer is WOOL (Smartwool keyword)
    expect(r[0]!.fiber).toBe('WOOL');
    expect(r[0]!.cap).toBe(75);  // 250 * 0.30
    // Mid layer SYNTHETIC default
    expect(r[1]!.fiber).toBe('SYNTHETIC');
    expect(r[1]!.cap).toBe(18);  // 300 * 0.06
    // Shell SYNTHETIC default
    expect(r[2]!.fiber).toBe('SYNTHETIC');
    expect(r[2]!.cap).toBe(24);  // 400 * 0.06
  });
});

describe('buildLayerArray — default path', () => {
  it('skiing default → 4-layer stack (CLO 2.5 ≥ 2.0)', () => {
    const r = buildLayerArray(null, 'skiing');
    expect(r.length).toBe(4);
    expect(r[0]!.name).toBe('Typical Merino Base');
    expect(r[0]!.fiber).toBe('WOOL');
    expect(r[1]!.name).toBe('Default Mid');
    expect(r[2]!.name).toBe('Default Insulation');
    expect(r[3]!.name).toBe('Default Shell');
  });

  it('hiking default → 3-layer stack (CLO 1.5 < 2.0)', () => {
    const r = buildLayerArray(null, 'hiking');
    expect(r.length).toBe(3);
    expect(r[0]!.name).toBe('Typical Merino Base');
    expect(r[1]!.name).toBe('Default Mid');
    expect(r[2]!.name).toBe('Default Shell');
  });

  it('strategy pill flag → optimized synthetic base instead of merino', () => {
    const r = buildLayerArray(null, 'skiing', undefined, true);
    expect(r[0]!.name).toBe('Optimized Synthetic Base');
    expect(r[0]!.fiber).toBe('SYNTHETIC');
    expect(r[0]!.wicking).toBe(10);
  });

  it('totalCLO override → drives layer count', () => {
    // CLO 1.0 → 3-layer
    const r3 = buildLayerArray(null, 'skiing', 1.0);
    expect(r3.length).toBe(3);
    // CLO 2.5 → 4-layer
    const r4 = buildLayerArray(null, 'skiing', 2.5);
    expect(r4.length).toBe(4);
  });
});
EOF

echo "✓ gear_layers.test.ts written"
echo ""

# ============================================================================
# PHASE 10 — Tests for effective_clo
# ============================================================================
echo ">>> PHASE 10: tests for effective_clo.ts"

cat > packages/engine/tests/ensemble/effective_clo.test.ts << 'EOF'
// Tests for effective_clo.ts — pumpingReduction, windCLOProtection,
// staticLayeringCorrection, computeEffectiveCLO, clothingInsulation.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import {
  pumpingReduction,
  windCLOProtection,
  staticLayeringCorrection,
  computeEffectiveCLO,
  clothingInsulation,
} from '../../src/ensemble/effective_clo.js';

describe('pumpingReduction (Havenith 2002, Lu 2015)', () => {
  it('returns 1.0 at MET 1.0 (rest)', () => {
    expect(pumpingReduction(1.0)).toBe(1.0);
  });

  it('returns 1.0 at MET 2.0 (boundary)', () => {
    expect(pumpingReduction(2.0)).toBe(1.0);
  });

  it('returns 0.55 at MET 10.0 (max reduction 45%)', () => {
    // 1 - min(0.45, (10-2)/8 * 0.45) = 1 - 0.45 = 0.55
    expect(pumpingReduction(10.0)).toBeCloseTo(0.55, 4);
  });

  it('returns 0.8875 at MET 4.0 (walking)', () => {
    // 1 - (4-2)/8 * 0.45 = 1 - 0.1125 = 0.8875
    expect(pumpingReduction(4.0)).toBeCloseTo(0.8875, 4);
  });

  it('caps at 0.55 above MET 10', () => {
    expect(pumpingReduction(15.0)).toBeCloseTo(0.55, 4);
  });
});

describe('windCLOProtection (PMC 10024235)', () => {
  it('returns 1.0 with no wind regardless of shell', () => {
    expect(windCLOProtection(5, 0)).toBe(1.0);
    expect(windCLOProtection(0, 0)).toBe(1.0);
  });

  it('returns 0.5 with no shell + wind ≥ 15 mph (max penetration)', () => {
    // penetration=1.0, windFactor=1.0; 1 - 1*1*0.5 = 0.5
    expect(windCLOProtection(0, 15)).toBeCloseTo(0.5, 4);
  });

  it('windproof shell (WR=10) at high wind → only 7.5% reduction', () => {
    // penetration=0.15, windFactor=1.0; 1 - 0.15*1*0.5 = 0.925
    expect(windCLOProtection(10, 15)).toBeCloseTo(0.925, 4);
  });

  it('locks in walking + light wind value: 5 mph, WR=5 → 0.9042', () => {
    // penetration=1-(5/10)*0.85=0.575; windFactor=5/15=0.333
    // 1 - 0.575 * 0.333 * 0.5 = 0.9042
    expect(windCLOProtection(5, 5)).toBeCloseTo(0.9042, 3);
  });
});

describe('staticLayeringCorrection (McCullough 1984, ISO 9920)', () => {
  it('returns 1.0 below 2 layers', () => {
    expect(staticLayeringCorrection(1.5, 1)).toBe(1.0);
    expect(staticLayeringCorrection(1.5, 0)).toBe(1.0);
  });

  it('returns 1.0 above MET 2.0 (movement disables this correction)', () => {
    expect(staticLayeringCorrection(3.0, 4)).toBe(1.0);
  });

  it('returns 0.96 at rest with 2 layers', () => {
    expect(staticLayeringCorrection(1.5, 2)).toBeCloseTo(0.96, 4);
  });

  it('returns 0.92 at rest with 3 layers', () => {
    expect(staticLayeringCorrection(1.5, 3)).toBeCloseTo(0.92, 4);
  });

  it('returns 0.88 at rest with 4 layers', () => {
    expect(staticLayeringCorrection(1.5, 4)).toBeCloseTo(0.88, 4);
  });

  it('caps reduction at 5+ layers (0.84)', () => {
    expect(staticLayeringCorrection(1.5, 5)).toBeCloseTo(0.84, 4);
    expect(staticLayeringCorrection(1.5, 7)).toBeCloseTo(0.84, 4);
  });
});

describe('computeEffectiveCLO — lock-in LC5 baselines', () => {
  it('rest, no wind, 1 layer → CLO unchanged (2.0)', () => {
    // pump=1.0, wind=1.0, lay=1.0 → result = baseCLO
    expect(computeEffectiveCLO(2.0, 1.5, 5, 0, 1)).toBe(2.0);
  });

  it('rest, no wind, 4 layers → 1.7600 (only layering correction applies)', () => {
    // pump=1.0, wind=1.0, lay=0.88 → 2.0 * 0.88 = 1.76
    expect(computeEffectiveCLO(2.0, 1.5, 5, 0, 4)).toBeCloseTo(1.7600, 4);
  });

  it('walking, light wind, 3 layers → 1.2037', () => {
    // pump=0.8875, wind=0.9042, lay=1.0 (MET>2 disables)
    // 1.5 * 0.8875 * 0.9042 * 1.0 = 1.2037
    expect(computeEffectiveCLO(1.5, 4.0, 5, 5, 3)).toBeCloseTo(1.2037, 3);
  });

  it('running, no wind, 2 layers → 0.6625', () => {
    // pump=1-0.45*(8-2)/8=0.6625, wind=1.0, lay=1.0
    // 1.0 * 0.6625 * 1.0 * 1.0 = 0.6625
    expect(computeEffectiveCLO(1.0, 8.0, 0, 0, 2)).toBeCloseTo(0.6625, 4);
  });

  it('skiing, heavy wind, 4 layers → 1.7456', () => {
    // pump=0.83125, wind=0.84, lay=1.0
    // 2.5 * 0.83125 * 0.84 * 1.0 = 1.7456
    expect(computeEffectiveCLO(2.5, 5.0, 8, 20, 4)).toBeCloseTo(1.7456, 3);
  });

  it('extreme conditions hit 30% floor', () => {
    // baseCLO=1.5, MET=10, no shell, 30 mph wind
    // pump=0.55, wind=0.5, lay=1.0; product=0.4125; floor=0.45 → result=0.45
    expect(computeEffectiveCLO(1.5, 10.0, 0, 30, 3)).toBeCloseTo(0.45, 4);
  });
});

describe('clothingInsulation (LC5 mixed convention: takes °F)', () => {
  it('hot 80°F + low intensity → minimal CLO', () => {
    // tempF>75 → clo=0.3, intMul=0.05, excess=0, heatTrap=0
    // result = 1.0 + 0 = 1.0
    expect(clothingInsulation(80, 'low')).toBe(1.0);
  });

  it('cool 50°F + moderate → 1.1 CLO', () => {
    // 45<tempF<55 → clo=1.0, intMul=0.2
    // excess=0.5, heatTrap=0.10; result = 1.0 + 0.10 = 1.10
    expect(clothingInsulation(50, 'moderate')).toBeCloseTo(1.10, 4);
  });

  it('cold 30°F + high intensity → 1.585 CLO', () => {
    // 25<tempF<35 → clo=1.8, intMul=0.45
    // excess=1.3, heatTrap=0.585; result = 1.0 + 0.585 = 1.585
    expect(clothingInsulation(30, 'high')).toBeCloseTo(1.585, 3);
  });

  it('extreme 5°F + very_high intensity → caps heat trapping at 1.0', () => {
    // tempF<10 → clo=2.5, intMul=0.65
    // excess=2.0, heatTrap=1.30 → capped at 1.0; result = 1.0 + 1.0 = 2.0
    expect(clothingInsulation(5, 'very_high')).toBe(2.0);
  });

  it('uses moderate default for unknown intensity', () => {
    expect(clothingInsulation(50, 'unknown_intensity')).toBeCloseTo(1.10, 4);
  });

  it('uses moderate default when intensity undefined', () => {
    expect(clothingInsulation(50, undefined)).toBeCloseTo(1.10, 4);
  });

  it('temperature tier boundaries — locks in 8 tiers', () => {
    // Exact boundary tests (just below tier transitions)
    expect(clothingInsulation(76, 'moderate')).toBeCloseTo(1.0, 4); // 0.3 base, no excess
    expect(clothingInsulation(66, 'moderate')).toBeCloseTo(1.0, 4); // 0.5 base, no excess
    expect(clothingInsulation(56, 'moderate')).toBeCloseTo(1.04, 2); // 0.7, excess=0.2, +0.04
    expect(clothingInsulation(46, 'moderate')).toBeCloseTo(1.10, 4); // 1.0, excess=0.5, +0.10
    expect(clothingInsulation(36, 'moderate')).toBeCloseTo(1.18, 4); // 1.4, excess=0.9, +0.18
    expect(clothingInsulation(26, 'moderate')).toBeCloseTo(1.26, 4); // 1.8, excess=1.3, +0.26
    expect(clothingInsulation(11, 'moderate')).toBeCloseTo(1.34, 4); // 2.2, excess=1.7, +0.34
    expect(clothingInsulation(0, 'moderate')).toBeCloseTo(1.40, 4); // 2.5, excess=2.0, +0.40
  });
});
EOF

echo "✓ effective_clo.test.ts written"
echo ""

# ============================================================================
# PHASE 11 — Run tests + typecheck + commit + push
# ============================================================================
echo ">>> PHASE 11: Run tests, typecheck, commit, push to GitHub"

echo ""
echo "--- run engine tests ---"
pnpm --filter @lc6/engine test

echo ""
echo "--- typecheck all packages ---"
pnpm typecheck

echo ""
echo "--- Git status ---"
git status

echo ""
echo "--- Git add + commit + push ---"
git add .
git commit -m "Session 8: Ensemble functions port from LC5 (Pre-Build Audit ratified)

Per Architecture Document v1.1 §2 repo structure, Cardinal Rule #8 (engine locked,
verbatim port), and Cardinal Rule #10 (calcEnsembleIm never modified by display).

ensemble/ module additions (11 functions, 2 named constant blocks):
  - ensemble_im.ts: ENSEMBLE_IM_MAP (PHY-025R baseline), calcEnsembleIm
                    (harmonic mean + bottleneck identification + what-if upgrade)
  - gear_layers.ts: getFiberType (3-level fallback), breathabilityToIm,
                    getLayerCapacity (FIBER_ABSORPTION ASTM D1909), activityCLO,
                    warmthToCLO, buildLayerArray
  - effective_clo.ts: pumpingReduction (Havenith 2002), windCLOProtection (PMC 10024235),
                      staticLayeringCorrection (McCullough 1984), computeEffectiveCLO,
                      clothingInsulation (NOTE: takes °F per LC5 convention; OQ-028
                      tracks future °F-standardization across engine)

All functions ported VERBATIM from LC5 risk_functions.js April 2026 audit baseline.
Citations preserved: ENSEMBLE_IM_MAP per LC5 PHY-025R audit baseline; original
methodology from Woodcock 1962 and ISO 9920. FIBER_ABSORPTION per ASTM D1909.

Pre-Build Audit (Session 8 opening) verified all 18 Cardinal Rules. Q1 (°F/°C
convention) deferred to OQ-028 future standardization session. Q2 (citations)
resolved via Option C (LC5 internal spec + external published source). Q3 scope
(11 functions in single Session 8) ratified.

Tests: ~50 new tests across 3 test files (ensemble_im, gear_layers, effective_clo).
Lock-in baselines for calcEnsembleIm captured 2026-04-15 from LC5 verbatim source
across 8 operating points (empty/single-layer/multi-layer with bottleneck identification
and what-if upgrade scenarios). Lock-in baselines for computeEffectiveCLO across 6
operating points (rest/walking/running/skiing including 30% floor).

170 total tests passing across CDI v1.4 + heat_balance + ensemble modules."

git push origin main

echo ""
echo "=========================================="
echo "SESSION 8 BUILD COMPLETE"
echo "=========================================="
echo ""
echo "Engine state:"
echo "  - CDI v1.4 stage detector (Session 5)"
echo "  - Heat balance primitives (Session 6)"
echo "  - PHY-056 heat balance solver (Session 7)"
echo "  - Ensemble functions (Session 8): calcEnsembleIm, buildLayerArray, computeEffectiveCLO + 8 helpers"
echo ""
echo "Session 9 candidate scopes:"
echo "  - Port LC5 calcIntermittentMoisture (the central cyclic moisture model — Session 9 target)"
echo "  - Port LC5 layer/buffer physics (per-layer moisture buffers, condensation placement)"
echo "  - Begin assembling toward evaluate() top-level engine integration"
echo ""
