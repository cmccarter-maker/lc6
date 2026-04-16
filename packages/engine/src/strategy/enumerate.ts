// ============================================================================
// @lc6/engine — Strategy Candidate Enumeration
// packages/engine/src/strategy/enumerate.ts
//
// Builds coherent layering systems from a gear catalog.
// Architecture v1.1 §2: strategy/enumerate.ts
//
// Design principle: the unit of evaluation is the LAYERING SYSTEM, not the
// individual product. Per-slot pickers are architecturally wrong for
// ensemble questions. This function builds COMPLETE systems and lets
// evaluate() score them as systems.
//
// Session 10b.
// ============================================================================

import type { EngineGearItem, GearEnsemble, GearSlot } from '../types.js';

// ── Required slots for a complete ensemble ──────────────
// Not all slots required for all conditions. Headgear and handwear
// may be omitted in warm weather.
const COLD_REQUIRED_SLOTS: GearSlot[] = ['base', 'mid', 'insulative', 'shell', 'legwear', 'footwear', 'headgear', 'handwear'];
const WARM_REQUIRED_SLOTS: GearSlot[] = ['base', 'shell', 'legwear', 'footwear'];
const MODERATE_REQUIRED_SLOTS: GearSlot[] = ['base', 'mid', 'shell', 'legwear', 'footwear'];

/** Maximum candidates to return (Architecture §1.1 Step 2 filters further). */
const MAX_CANDIDATES = 7;

/** Minimum items per slot to form a candidate. */
const MIN_ITEMS_PER_SLOT = 1;

export interface EnumerateOptions {
  /** IREQ_min in clo — candidates below this are pre-filtered. 0 = no IREQ constraint. */
  ireqMinClo: number;
  /** Temperature regime hint: affects which slots are required. */
  tempF: number;
  /** Activity ID for activity-specific slot requirements. */
  activity?: string;
  /** Maximum candidates to generate. Default 7. */
  maxCandidates?: number;
}

/**
 * Build coherent candidate ensembles from a flat gear catalog.
 *
 * Strategy:
 *   1. Determine required slots from temperature regime
 *   2. Group catalog items by slot
 *   3. Verify coverage (at least 1 item per required slot)
 *   4. Build diverse candidates: warmest, most breathable, balanced, and mixes
 *   5. Compute total_clo and ensemble_im per candidate
 *   6. Pre-filter by IREQ_min
 *   7. Return up to maxCandidates ranked by estimated quality
 *
 * Does NOT call evaluate() — that's the caller's job.
 * Pure function, no side effects.
 */
export function enumerateCandidates(
  catalog: EngineGearItem[],
  options: EnumerateOptions,
): GearEnsemble[] {
  const maxCandidates = options.maxCandidates ?? MAX_CANDIDATES;

  // ── Step 1: Determine required slots ──────────────────
  const requiredSlots = getRequiredSlots(options.tempF, options.activity);

  // ── Step 2: Group by slot ─────────────────────────────
  const bySlot = groupBySlot(catalog, requiredSlots);

  // ── Step 3: Verify coverage ───────────────────────────
  for (const slot of requiredSlots) {
    if (!bySlot[slot] || bySlot[slot]!.length < MIN_ITEMS_PER_SLOT) {
      // Can't build complete ensembles — missing coverage for required slot.
      // Return empty rather than incomplete ensembles.
      return [];
    }
  }

  // ── Step 4: Build diverse candidates ──────────────────
  const rawCandidates: GearEnsemble[] = [];
  let idCounter = 0;

  // Strategy A: Warmest (max CLO per slot)
  const warmest = buildFromRanking(bySlot, requiredSlots, sortByCloDesc, `candidate-${idCounter++}`, 'Warmest System');
  if (warmest) rawCandidates.push(warmest);

  // Strategy B: Most breathable (max im per slot)
  const breathable = buildFromRanking(bySlot, requiredSlots, sortByImDesc, `candidate-${idCounter++}`, 'Most Breathable');
  if (breathable) rawCandidates.push(breathable);

  // Strategy C: Balanced (sort by CLO×im product — best tradeoff)
  const balanced = buildFromRanking(bySlot, requiredSlots, sortByBalanced, `candidate-${idCounter++}`, 'Balanced System');
  if (balanced) rawCandidates.push(balanced);

  // Strategy D: Second-best CLO per slot (if available)
  const secondWarmest = buildFromRanking(bySlot, requiredSlots, sortByCloDesc, `candidate-${idCounter++}`, 'Runner-Up Warm', 1);
  if (secondWarmest && !isDuplicate(rawCandidates, secondWarmest)) rawCandidates.push(secondWarmest);

  // Strategy E: Warm base + breathable shell (mixed strategy)
  const mixed1 = buildMixed(bySlot, requiredSlots, {
    base: sortByCloDesc,
    mid: sortByCloDesc,
    insulative: sortByCloDesc,
    shell: sortByImDesc,     // breathable shell for moisture management
    legwear: sortByCloDesc,
    footwear: sortByCloDesc,
    headgear: sortByCloDesc,
    handwear: sortByCloDesc,
    neck: sortByCloDesc,
  }, `candidate-${idCounter++}`, 'Warm + Breathable Shell');
  if (mixed1 && !isDuplicate(rawCandidates, mixed1)) rawCandidates.push(mixed1);

  // Strategy F: Breathable base + warm outer (moisture-first base)
  const mixed2 = buildMixed(bySlot, requiredSlots, {
    base: sortByImDesc,      // wicking base for moisture management
    mid: sortByImDesc,
    insulative: sortByCloDesc,
    shell: sortByCloDesc,
    legwear: sortByBalanced,
    footwear: sortByCloDesc,
    headgear: sortByCloDesc,
    handwear: sortByCloDesc,
    neck: sortByCloDesc,
  }, `candidate-${idCounter++}`, 'Breathable Base + Warm Outer');
  if (mixed2 && !isDuplicate(rawCandidates, mixed2)) rawCandidates.push(mixed2);

  // Strategy G: Third option per slot if catalog is deep enough
  const third = buildFromRanking(bySlot, requiredSlots, sortByBalanced, `candidate-${idCounter++}`, 'Alternative Balanced', 1);
  if (third && !isDuplicate(rawCandidates, third)) rawCandidates.push(third);

  // ── Step 5-6: Compute metrics and IREQ filter ─────────
  const feasible = rawCandidates.filter(e => e.total_clo >= options.ireqMinClo);

  // ── Step 7: Rank and return ───────────────────────────
  // Sort by total_clo descending (warmest first — evaluate() will determine
  // which actually has lowest CDI via full physics).
  feasible.sort((a, b) => b.total_clo - a.total_clo);

  return feasible.slice(0, maxCandidates);
}


// ============================================================================
// Internal helpers
// ============================================================================

function getRequiredSlots(tempF: number, activity?: string): GearSlot[] {
  // Water activities have different slot requirements
  if (activity === 'kayaking' || activity === 'paddle_boarding') {
    return ['base', 'shell', 'legwear', 'footwear'];
  }
  if (tempF <= 32) return COLD_REQUIRED_SLOTS;
  if (tempF <= 55) return MODERATE_REQUIRED_SLOTS;
  return WARM_REQUIRED_SLOTS;
}

function groupBySlot(
  catalog: EngineGearItem[],
  requiredSlots: GearSlot[],
): Partial<Record<GearSlot, EngineGearItem[]>> {
  const result: Partial<Record<GearSlot, EngineGearItem[]>> = {};
  for (const slot of requiredSlots) {
    result[slot] = catalog.filter(item => item.slot === slot);
  }
  return result;
}

type SortFn = (a: EngineGearItem, b: EngineGearItem) => number;

const sortByCloDesc: SortFn = (a, b) => b.clo - a.clo;
const sortByImDesc: SortFn = (a, b) => b.im - a.im;
const sortByBalanced: SortFn = (a, b) => (b.clo * b.im) - (a.clo * a.im);

/** Build an ensemble by picking the Nth-ranked item per slot using a single sort. */
function buildFromRanking(
  bySlot: Partial<Record<GearSlot, EngineGearItem[]>>,
  requiredSlots: GearSlot[],
  sortFn: SortFn,
  id: string,
  label: string,
  pickIndex: number = 0,
): GearEnsemble | null {
  const items: EngineGearItem[] = [];
  for (const slot of requiredSlots) {
    const candidates = bySlot[slot];
    if (!candidates || candidates.length === 0) return null;
    const sorted = [...candidates].sort(sortFn);
    const idx = Math.min(pickIndex, sorted.length - 1);
    items.push(sorted[idx]!);
  }
  return assembleEnsemble(id, label, items);
}

/** Build an ensemble using different sort strategies per slot. */
function buildMixed(
  bySlot: Partial<Record<GearSlot, EngineGearItem[]>>,
  requiredSlots: GearSlot[],
  strategies: Partial<Record<GearSlot, SortFn>>,
  id: string,
  label: string,
): GearEnsemble | null {
  const items: EngineGearItem[] = [];
  for (const slot of requiredSlots) {
    const candidates = bySlot[slot];
    if (!candidates || candidates.length === 0) return null;
    const sortFn = strategies[slot] ?? sortByBalanced;
    const sorted = [...candidates].sort(sortFn);
    items.push(sorted[0]!);
  }
  return assembleEnsemble(id, label, items);
}

/** Compute ensemble metrics and assemble GearEnsemble. */
function assembleEnsemble(id: string, label: string, items: EngineGearItem[]): GearEnsemble {
  // Total CLO: sum of item CLO (parallel summation — per AUDIT-IREQ-001 validation)
  const total_clo = items.reduce((sum, item) => sum + item.clo, 0);

  // Ensemble im: harmonic mean of item im values (weighted by CLO contribution)
  // This approximates calcEnsembleIm's serial resistance model.
  // The real calcEnsembleIm runs inside evaluate() — this is for pre-filtering only.
  const totalCloWeighted = items.reduce((sum, item) => sum + item.clo, 0);
  let ensemble_im: number;
  if (totalCloWeighted > 0) {
    const weightedImSum = items.reduce((sum, item) => {
      const weight = item.clo / totalCloWeighted;
      return sum + weight / (item.im || 0.1);
    }, 0);
    ensemble_im = Math.round((1 / weightedImSum) * 1000) / 1000;
  } else {
    ensemble_im = 0.38; // Default per d'Ambrosio 2025
  }

  return {
    ensemble_id: id,
    label,
    items,
    total_clo: Math.round(total_clo * 100) / 100,
    ensemble_im: Math.min(0.50, Math.max(0.05, ensemble_im)), // Clamp to physical range
  };
}

/** Check if a candidate is a duplicate of any existing ensemble (same items). */
function isDuplicate(existing: GearEnsemble[], candidate: GearEnsemble): boolean {
  const candidateIds = candidate.items.map(i => i.product_id).sort().join(',');
  return existing.some(e => e.items.map(i => i.product_id).sort().join(',') === candidateIds);
}
