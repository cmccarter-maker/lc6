// ============================================================================
// @lc6/engine — Gear DB Adapter
// packages/engine/src/gear/adapter.ts
//
// Converts LC5 gear.js format → EngineGearItem[] for evaluate pipeline.
// This bridges the existing 1,627-product gear DB to the LC6 type system.
//
// Session 10.
// ============================================================================

import type { EngineGearItem, GearSlot } from '../types.js';

/**
 * Raw gear item shape from LC5 gear.js.
 * Fields may be missing for some categories (handwear often lacks warmthRatio).
 */
export interface RawGearItem {
  brand: string;
  model: string;
  price?: number;
  tempRange?: [number, number];
  breathability?: number;   // 1-10
  windResist?: number;      // 1-10
  weight?: string;
  packable?: boolean;
  warmthRatio?: number;     // 1-10
  waterproof?: number;      // 0-3
  moisture?: number;        // 1-10 wicking
  fit?: Record<string, number>;  // activity → score 0-10
  sex?: string;             // "w" for women's, undefined for unisex/men's
  type?: string;
  features?: string;
}

/**
 * Raw gear DB shape from LC5 gear.js (export const G = {...}).
 */
export interface RawGearDB {
  upper: {
    base_layer: RawGearItem[];
    mid_layer: RawGearItem[];
    shell: RawGearItem[];
  };
  lower: {
    base_layer: RawGearItem[];
  };
  footwear: RawGearItem[];
  headgear: RawGearItem[];
  handwear: RawGearItem[];
}

/** Slot mapping from gear DB categories. */
const CATEGORY_TO_SLOT: Record<string, GearSlot> = {
  'upper.base_layer': 'base',
  'upper.mid_layer': 'mid',       // mid + insulative split by warmthRatio
  'upper.shell': 'shell',
  'lower.base_layer': 'legwear',
  'footwear': 'footwear',
  'headgear': 'headgear',
  'handwear': 'handwear',
};

/**
 * warmthRatio (1-10) → CLO approximation.
 * Based on observed LC5 product range:
 *   warmthRatio 1 ≈ 0.05 CLO (shell only, no insulation)
 *   warmthRatio 5 ≈ 0.30 CLO (light base layer)
 *   warmthRatio 8 ≈ 0.60 CLO (midweight insulation)
 *   warmthRatio 10 ≈ 1.00 CLO (expedition down)
 */
function warmthToCLO(warmthRatio: number): number {
  // Piecewise linear: steeper above 7 (insulation jumps)
  if (warmthRatio <= 5) return warmthRatio * 0.06;
  if (warmthRatio <= 7) return 0.30 + (warmthRatio - 5) * 0.10;
  return 0.50 + (warmthRatio - 7) * 0.17;
}

/**
 * breathability (1-10) → im (Woodcock permeability index).
 * Range: 0.05 (impermeable rubber) to 0.50 (mesh).
 */
function breathabilityToIm(breathability: number): number {
  return 0.05 + (breathability / 10) * 0.40;
}

/**
 * Convert the full LC5 gear DB to EngineGearItem[].
 *
 * @param db Raw gear DB (the G object from gear.js)
 * @param options Filter options
 */
export function convertGearDB(
  db: RawGearDB,
  options?: {
    /** Only include items with fit score ≥ threshold for this activity. */
    activity?: string;
    /** Minimum fit score to include. Default 5. */
    minFitScore?: number;
    /** Filter by sex: "m" = unisex only, "w" = women's + unisex, undefined = all. */
    sex?: string;
  },
): EngineGearItem[] {
  const result: EngineGearItem[] = [];
  const minFit = options?.minFitScore ?? 5;
  const activity = options?.activity;
  const sex = options?.sex;

  // Helper: convert one raw item to EngineGearItem
  function convert(raw: RawGearItem, slot: GearSlot, category: string): EngineGearItem | null {
    // Sex filter
    if (sex === 'm' && raw.sex === 'w') return null;
    if (sex === 'w' && raw.sex !== 'w' && raw.sex !== undefined) return null;

    // Activity fit filter
    if (activity && raw.fit) {
      const fitScore = raw.fit[activity] ?? 0;
      if (fitScore < minFit) return null;
    }
    if (activity && !raw.fit) return null;

    // For mid_layer: split into 'mid' vs 'insulative' by warmthRatio
    let effectiveSlot = slot;
    if (category === 'upper.mid_layer' && (raw.warmthRatio ?? 0) >= 8) {
      effectiveSlot = 'insulative';
    }

    const clo = warmthToCLO(raw.warmthRatio ?? 3);
    const im = breathabilityToIm(raw.breathability ?? 5);

    return {
      product_id: `${raw.brand}-${raw.model}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
      name: `${raw.brand} ${raw.model}`,
      slot: effectiveSlot,
      clo: Math.round(clo * 100) / 100,
      im: Math.round(im * 1000) / 1000,
      wind_resistance: raw.windResist ?? 3,
      waterproof: raw.waterproof ?? 0,
      breathability: raw.breathability ?? 5,
      fiber: 'synthetic',
      wicking: raw.moisture ?? 5,
      spec_confidence: 5,
      // Legacy passthrough: calcIntermittentMoisture reads warmthRatio from gear items
      // for dynamic CLO calculations. Without this, _gearCLO = 0 → _baseCLO floors at 0.30.
      warmthRatio: raw.warmthRatio ?? 3,
    } as EngineGearItem;
  }

  // Process each category
  const categories: Array<{ items: RawGearItem[]; slot: GearSlot; key: string }> = [
    { items: db.upper.base_layer, slot: 'base', key: 'upper.base_layer' },
    { items: db.upper.mid_layer, slot: 'mid', key: 'upper.mid_layer' },
    { items: db.upper.shell, slot: 'shell', key: 'upper.shell' },
    { items: db.lower.base_layer, slot: 'legwear', key: 'lower.base_layer' },
    { items: db.footwear, slot: 'footwear', key: 'footwear' },
    { items: db.headgear, slot: 'headgear', key: 'headgear' },
    { items: db.handwear, slot: 'handwear', key: 'handwear' },
  ];

  for (const cat of categories) {
    for (const raw of cat.items) {
      const converted = convert(raw, cat.slot, cat.key);
      if (converted) result.push(converted);
    }
  }

  return result;
}

/**
 * Quick summary of catalog coverage by slot.
 */
export function catalogSummary(items: EngineGearItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.slot] = (counts[item.slot] ?? 0) + 1;
  }
  return counts;
}
