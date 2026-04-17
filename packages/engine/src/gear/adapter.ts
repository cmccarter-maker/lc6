// ============================================================================
// @lc6/engine — Gear DB Adapter
// packages/engine/src/gear/adapter.ts
//
// PHY-GEAR-01 v2 (Session 11, ratified 2026-04-17).
// Converts LC5 gear.js format → EngineGearItem[] for the evaluate pipeline.
//
// Cardinal Rule #8: Does NOT touch thermal engine functions.
// Cardinal Rule #16: GearSlot union expansion is additive (Architecture v1.2).
// Cardinal Rule #1: Calibration constants flagged in spec §5.7 Honesty Ledger.
// ============================================================================

import type { EngineGearItem, GearSlot, GearSubslot, FiberType } from '../types.js';

// ── SECTION A — Raw item type definitions ──────────────────────────────────

export interface RawGearItem {
  brand: string;
  model: string;
  price?: number;
  tempRange?: [number, number];
  breathability?: number;
  windResist?: number;
  weight?: string;
  packable?: boolean;
  warmthRatio?: number;
  waterproof?: number;
  moisture?: number;
  fit?: Record<string, number>;
  sex?: string;
  type?: string;
  features?: string;
  _confidence?: number;
  _source?: string;
  _estimated?: string[];
  _url?: string;
}

export interface RawGearSleepItem extends RawGearItem {
  comfortRating?: number;
  lowerLimit?: number;
  fillPower?: number;
  fillType?: "down" | "synthetic";
  rValue?: number;
  padType?: "inflatable" | "closed-cell foam" | "self-inflating";
  packSize?: string;
}

export interface RawGearImmersionItem extends RawGearItem {
  thickness?: string;
}

export interface RawGearDB {
  upper?: {
    base_layer?: RawGearItem[];
    mid_layer?: RawGearItem[];
    insulation?: RawGearItem[];
    shell?: RawGearItem[];
  };
  lower?: {
    base_layer?: RawGearItem[];
    pants?: RawGearItem[];
    insulation?: RawGearItem[];
    ski_pants?: RawGearItem[];
    shell_pants?: RawGearItem[];
    bike?: RawGearItem[];
  };
  drysuit?: RawGearImmersionItem[];
  wetsuit?: RawGearImmersionItem[];
  footwear?: RawGearItem[];
  headgear?: RawGearItem[];
  handwear?: RawGearItem[];
  gear?: RawGearItem[];
  sleeping_bags?: RawGearSleepItem[];
  sleeping_pads?: RawGearSleepItem[];
}

// ── SECTION B — Mapping tables ─────────────────────────────────────────────

const IMPUTABLE: readonly (keyof RawGearItem)[] = [
  'breathability', 'windResist', 'moisture', 'weight', 'warmthRatio', 'waterproof',
] as const;

const ACTIVITY_EXCLUSIVE: Record<string, string[]> = {
  fishing: ["simms"],
};

const ACTIVITY_ALIAS: Record<string, string> = {
  day_hike: "hiking",
  cycling: "road_cycling",
};

function resolveActivity(activity: string): string {
  return ACTIVITY_ALIAS[activity] ?? activity;
}

// ── SECTION C — Attribute translation (LC5 calibration; spec §5.7) ─────────

function warmthToCLO(warmthRatio: number): number {
  if (warmthRatio <= 5) return warmthRatio * 0.06;
  if (warmthRatio <= 7) return 0.30 + (warmthRatio - 5) * 0.10;
  return 0.50 + (warmthRatio - 7) * 0.17;
}

function breathabilityToIm(breathability: number): number {
  return 0.05 + (breathability / 10) * 0.40;
}

function clampWaterproof(raw: number | undefined): number {
  if (raw == null) return 0;
  if (raw <= 3) return raw;
  return 3;
}

// ── SECTION D — Fiber inference (PHY-071 physics) ──────────────────────────

export function inferFiber(raw: RawGearItem): FiberType {
  const fillType = (raw as RawGearSleepItem).fillType;
  if (fillType === 'down') return 'down';
  if (fillType === 'synthetic') return 'synthetic';

  const text = `${raw.brand} ${raw.model} ${raw.features ?? ''}`.toLowerCase();

  if (/\bdown\b|goose|duck\s+down|\b\d{3}\s*(?:fp|fill\s*power)\b|fillpower|fill\s*power/i.test(text)) {
    return 'down';
  }
  if (/merino|\bwool\b|yak\s+wool|alpaca/i.test(text)) return 'wool';
  if (/\bcotton\b|flannel|canvas/i.test(text)) return 'cotton';
  if (/polartec|primaloft|coreloft|pertex|capilene|dri-?fit|polyester|nylon|synthetic|thermoball|thinsulate|pl[au]mafill/i.test(text)) {
    return 'synthetic';
  }
  return 'synthetic';
}

// ── SECTION E — Peer imputation (port from LC5 risk_functions.js:502-556) ──

function medianOf(vals: number[]): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const result = sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
  return Math.round(result * 10) / 10;
}

function modeOf(vals: string[]): string | null {
  if (vals.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

function isStrictPeer(target: RawGearItem, peer: RawGearItem, known: (keyof RawGearItem)[]): boolean {
  for (const a of known) {
    if (a === 'weight') {
      if (peer[a] !== target[a]) return false;
    } else if (a === 'waterproof') {
      const diff = Math.abs(((peer[a] as number) ?? 0) - ((target[a] as number) ?? 0));
      if (diff > 1) return false;
    } else if (a === 'warmthRatio' || a === 'breathability' || a === 'windResist' || a === 'moisture') {
      const diff = Math.abs(((peer[a] as number) ?? 0) - ((target[a] as number) ?? 0));
      if (diff > 2.5) return false;
    }
  }
  if (target.tempRange && peer.tempRange) {
    const overlap = Math.max(0,
      Math.min(target.tempRange[1], peer.tempRange[1]) -
      Math.max(target.tempRange[0], peer.tempRange[0])
    );
    const span = target.tempRange[1] - target.tempRange[0] || 1;
    if (overlap / span < 0.40) return false;
  }
  return true;
}

function isRelaxedPeer(target: RawGearItem, peer: RawGearItem, known: (keyof RawGearItem)[]): boolean {
  if (known.length === 0) return true;
  let matchCount = 0;
  for (const a of known) {
    if (a === 'weight' && peer[a] === target[a]) {
      matchCount++;
    } else if (a === 'waterproof') {
      const diff = Math.abs(((peer[a] as number) ?? 0) - ((target[a] as number) ?? 0));
      if (diff <= 2) matchCount++;
    } else {
      const diff = Math.abs(((peer[a] as number) ?? 0) - ((target[a] as number) ?? 0));
      if (diff <= 4) matchCount++;
    }
  }
  return matchCount / known.length >= 0.60;
}

interface ImputationResult {
  item: RawGearItem;
  specConfidence: number;
  imputed: (keyof RawGearItem)[];
}

export function imputeAttributes(
  target: RawGearItem,
  completeItems: RawGearItem[],
): ImputationResult {
  const missing = IMPUTABLE.filter(a => target[a] == null);
  const confirmed = IMPUTABLE.length - missing.length;

  if (missing.length === 0) {
    return { item: { ...target }, specConfidence: confirmed, imputed: [] };
  }

  const known = IMPUTABLE.filter(a => target[a] != null);
  let peers = completeItems.filter(p => p !== target && isStrictPeer(target, p, known));

  if (peers.length < 3) {
    peers = completeItems.filter(p => p !== target && isRelaxedPeer(target, p, known));
  }

  const imputedItem = { ...target };
  const imputedAttrs: (keyof RawGearItem)[] = [];

  if (peers.length >= 3) {
    for (const a of missing) {
      if (a === 'weight') {
        const vals = peers.map(p => p.weight).filter((v): v is string => v != null);
        const m = modeOf(vals);
        if (m != null) { imputedItem.weight = m; imputedAttrs.push(a); }
      } else {
        const vals = peers.map(p => p[a]).filter((v): v is number => typeof v === 'number');
        if (vals.length > 0) {
          (imputedItem as Record<string, unknown>)[a as string] = medianOf(vals);
          imputedAttrs.push(a);
        }
      }
    }
  }

  return { item: imputedItem, specConfidence: confirmed, imputed: imputedAttrs };
}

// ── SECTION F — Item converters ────────────────────────────────────────────

interface ConvertContext {
  slot: GearSlot;
  subslot: GearSubslot;
  specConfidence: number;
}

function convertClothingItem(raw: RawGearItem, ctx: ConvertContext): EngineGearItem {
  const clo = warmthToCLO(raw.warmthRatio ?? 3);
  const im = breathabilityToIm(raw.breathability ?? 5);
  const fiber = inferFiber(raw);

  return {
    product_id: `${raw.brand}-${raw.model}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
    name: `${raw.brand} ${raw.model}`,
    slot: ctx.slot,
    subslot: ctx.subslot,
    clo: Math.round(clo * 100) / 100,
    im: Math.round(im * 1000) / 1000,
    wind_resistance: raw.windResist ?? 3,
    waterproof: clampWaterproof(raw.waterproof),
    breathability: raw.breathability ?? 5,
    fiber,
    wicking: raw.moisture ?? 5,
    spec_confidence: ctx.specConfidence,
  };
}

function convertSleepItem(raw: RawGearSleepItem, subslot: GearSubslot): EngineGearItem | null {
  const slot: GearSlot = subslot === 'sleeping_pad' ? 'sleeping_pad' : 'sleeping_bag';
  const fiber = inferFiber(raw);

  let specConfidence: number;
  if (slot === 'sleeping_pad') {
    if (raw.rValue == null) return null;
    specConfidence = 8;
  } else {
    const hasComfort = raw.comfortRating != null;
    const hasLower = raw.lowerLimit != null;
    if (!hasComfort && !hasLower) return null;
    specConfidence = (hasComfort && hasLower) ? 8 : 5;
  }

  const item: EngineGearItem = {
    product_id: `${raw.brand}-${raw.model}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
    name: `${raw.brand} ${raw.model}`,
    slot,
    subslot,
    clo: 0,
    im: 0,
    fiber,
    spec_confidence: specConfidence,
  };
  if (raw.comfortRating != null) item.comfort_rating_f = raw.comfortRating;
  if (raw.lowerLimit != null) item.lower_limit_f = raw.lowerLimit;
  if (raw.fillPower != null) item.fill_power = raw.fillPower;
  if (raw.rValue != null) item.r_value = raw.rValue;
  return item;
}

function convertImmersionItem(raw: RawGearImmersionItem, subslot: GearSubslot): EngineGearItem {
  return {
    product_id: `${raw.brand}-${raw.model}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
    name: `${raw.brand} ${raw.model}`,
    slot: 'immersion',
    subslot,
    clo: 0,
    im: 0,
    fiber: 'synthetic',
    spec_confidence: 0,
    ...(raw.thickness ? { thickness_mm: raw.thickness } : {}),
  };
}

// ── SECTION G — Category enumeration & filtering ───────────────────────────

interface ClothingCategorySpec {
  items: RawGearItem[];
  slot: GearSlot;
  subslot: GearSubslot;
  key: string;
}

function enumerateClothingCategories(db: RawGearDB): ClothingCategorySpec[] {
  const specs: ClothingCategorySpec[] = [];
  const u = db.upper;
  if (u?.base_layer)  specs.push({ items: u.base_layer,  slot: 'base',       subslot: 'upper_base',       key: 'upper.base_layer'  });
  if (u?.mid_layer)   specs.push({ items: u.mid_layer,   slot: 'mid',        subslot: 'upper_mid',        key: 'upper.mid_layer'   });
  if (u?.insulation)  specs.push({ items: u.insulation,  slot: 'insulative', subslot: 'upper_insulative', key: 'upper.insulation'  });
  if (u?.shell)       specs.push({ items: u.shell,       slot: 'shell',      subslot: 'upper_shell',      key: 'upper.shell'       });
  const l = db.lower;
  if (l?.base_layer)  specs.push({ items: l.base_layer,  slot: 'legwear', subslot: 'lower_base',       key: 'lower.base_layer'  });
  if (l?.pants)       specs.push({ items: l.pants,       slot: 'legwear', subslot: 'lower_pants',      key: 'lower.pants'       });
  if (l?.insulation)  specs.push({ items: l.insulation,  slot: 'legwear', subslot: 'lower_insulative', key: 'lower.insulation'  });
  if (l?.ski_pants)   specs.push({ items: l.ski_pants,   slot: 'legwear', subslot: 'lower_ski_shell',  key: 'lower.ski_pants'   });
  if (l?.shell_pants) specs.push({ items: l.shell_pants, slot: 'legwear', subslot: 'lower_shell',      key: 'lower.shell_pants' });
  if (l?.bike)        specs.push({ items: l.bike,        slot: 'legwear', subslot: 'lower_bike',       key: 'lower.bike'        });
  if (db.footwear)    specs.push({ items: db.footwear,   slot: 'footwear', subslot: 'footwear',        key: 'footwear'          });
  if (db.headgear)    specs.push({ items: db.headgear,   slot: 'headgear', subslot: 'headgear',        key: 'headgear'          });
  if (db.handwear)    specs.push({ items: db.handwear,   slot: 'handwear', subslot: 'handwear',        key: 'handwear'          });
  return specs;
}

function passesActivityFilter(
  raw: RawGearItem,
  activity: string | undefined,
  minFitScore: number,
): boolean {
  if (!activity) return true;
  if (!raw.fit) return false;
  const resolved = resolveActivity(activity);
  const fitScore = raw.fit[resolved] ?? 0;
  return fitScore >= minFitScore;
}

function passesSexFilter(raw: RawGearItem, sex: string | undefined): boolean {
  if (!sex) return true;
  if (sex === 'm') return raw.sex !== 'w';
  if (sex === 'w') return raw.sex === 'w' || raw.sex === undefined;
  return true;
}

function passesActivityBrandFilter(raw: RawGearItem, activity: string | undefined): boolean {
  if (!activity) return true;
  const resolved = resolveActivity(activity);
  const brandLower = (raw.brand || '').toLowerCase();
  for (const [exclusiveActivity, brands] of Object.entries(ACTIVITY_EXCLUSIVE)) {
    if (exclusiveActivity !== resolved && exclusiveActivity !== activity) {
      if (brands.includes(brandLower)) return false;
    }
  }
  return true;
}

// ── SECTION H — Main entry point ───────────────────────────────────────────

export interface ConvertOptions {
  activity?: string;
  minFitScore?: number;
  sex?: string;
}

export function convertGearDB(
  db: RawGearDB,
  options?: ConvertOptions,
): EngineGearItem[] {
  const minFit = options?.minFitScore ?? 5;
  const activity = options?.activity;
  const sex = options?.sex;
  const result: EngineGearItem[] = [];

  const clothingCategories = enumerateClothingCategories(db);

  for (const cat of clothingCategories) {
    const filtered = cat.items.filter(raw =>
      passesActivityFilter(raw, activity, minFit) &&
      passesSexFilter(raw, sex) &&
      passesActivityBrandFilter(raw, activity)
    );

    const completeItems = filtered.filter(raw => IMPUTABLE.every(a => raw[a] != null));
    const applyConfidenceTiers = completeItems.length >= 3;

    for (const raw of filtered) {
      let specConfidence: number;
      let imputedItem: RawGearItem = raw;

      if (raw._confidence != null) {
        specConfidence = raw._confidence;
      } else {
        const imp = imputeAttributes(raw, completeItems);
        imputedItem = imp.item;
        specConfidence = imp.specConfidence;
      }

      if (applyConfidenceTiers && specConfidence <= 2) continue;

      result.push(convertClothingItem(imputedItem, {
        slot: cat.slot,
        subslot: cat.subslot,
        specConfidence,
      }));
    }
  }

  for (const raw of db.sleeping_bags ?? []) {
    if (!passesSexFilter(raw, sex)) continue;
    if (!passesActivityFilter(raw, activity, minFit)) continue;
    const item = convertSleepItem(raw, 'sleeping_bag');
    if (item) result.push(item);
  }
  for (const raw of db.sleeping_pads ?? []) {
    if (!passesSexFilter(raw, sex)) continue;
    if (!passesActivityFilter(raw, activity, minFit)) continue;
    const item = convertSleepItem(raw, 'sleeping_pad');
    if (item) result.push(item);
  }

  for (const raw of db.drysuit ?? []) {
    if (!passesSexFilter(raw, sex)) continue;
    result.push(convertImmersionItem(raw, 'immersion_drysuit'));
  }
  for (const raw of db.wetsuit ?? []) {
    if (!passesSexFilter(raw, sex)) continue;
    result.push(convertImmersionItem(raw, 'immersion_wetsuit'));
  }

  return result;
}

export function catalogSummary(items: EngineGearItem[]): {
  bySlot: Record<string, number>;
  bySubslot: Record<string, number>;
  byConfidence: Record<string, number>;
  byFiber: Record<string, number>;
} {
  const bySlot: Record<string, number> = {};
  const bySubslot: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  const byFiber: Record<string, number> = {};
  for (const item of items) {
    bySlot[item.slot] = (bySlot[item.slot] ?? 0) + 1;
    if (item.subslot) bySubslot[item.subslot] = (bySubslot[item.subslot] ?? 0) + 1;
    const cKey = `conf_${item.spec_confidence ?? 'unset'}`;
    byConfidence[cKey] = (byConfidence[cKey] ?? 0) + 1;
    if (item.fiber) byFiber[item.fiber] = (byFiber[item.fiber] ?? 0) + 1;
  }
  return { bySlot, bySubslot, byConfidence, byFiber };
}
