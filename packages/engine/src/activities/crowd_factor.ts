// LC6 PHY-031 Component Cycle Model — crowd factor + cycle duration helpers.
// Pure functions, no side effects, no external dependencies beyond phy031_constants.
//
// Spec reference: LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md
// Consumer: packages/engine/src/evaluate.ts (bridge to calcIntermittentMoisture.cycleOverride)
//
// Per spec §13.1–§13.3:
//   - getCrowdFactor(dateStr, powderFlag): returns crowd tier 1–6
//   - computeCycle(crowdTier, terrain): returns {totalCycles, cycleMin} for a session
//
// Per spec §10.3: no "no date" default path. If dateStr is invalid, throw.
// Per spec §9: this module produces cycle COUNT and cycle DURATION only.
// Per-phase physics is the consumer's responsibility. Cycle-averaging is forbidden.

import {
  DEFAULT_LIFT_MIN,
  TRANSITION_MIN,
  REST_FRACTION,
} from './phy031_constants';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

/** Crowd tier 1–6, maps to lift-line wait per spec §4.1. */
export type CrowdTier = 1 | 2 | 3 | 4 | 5 | 6;

/** Terrain type for resort skiing/snowboarding. Per spec §3.1. */
export type SkiTerrain = 'groomers' | 'moguls' | 'trees' | 'bowls' | 'park';

/** Shape returned by computeCycle. Caller constructs CycleOverride from this. */
export interface CycleResult {
  totalCycles: number;
  cycleMin: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Constants — crowd tier lift-line wait and per-terrain run durations
// ──────────────────────────────────────────────────────────────────────────

/**
 * Lift-line wait by crowd tier (minutes). Per spec §4.1.
 * Tier 1 Ghost Town = 0; Tier 6 Mayhem = 20.
 */
const LIFT_LINE_MIN_BY_TIER: Readonly<Record<CrowdTier, number>> = {
  1: 0,
  2: 2,
  3: 5,
  4: 10,
  5: 15,
  6: 20,
};

/**
 * Per-terrain run duration (minutes) at reference perRunVert = 1000 ft.
 * Per spec §3.1, ported verbatim from LC5 PHY-030/031.
 */
const RUN_MIN_BY_TERRAIN: Readonly<Record<SkiTerrain, number>> = {
  groomers: 3,
  moguls: 7,
  trees: 10,
  bowls: 6,
  park: 4,
};

// ──────────────────────────────────────────────────────────────────────────
// Date utilities
// ──────────────────────────────────────────────────────────────────────────

/** Parse an ISO-8601 date string (YYYY-MM-DD) into a UTC Date. Throws on invalid. */
function parseIsoDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    // Per spec §10.3: no default. Missing date is upstream bug.
    throw new Error(`PHY-031 getCrowdFactor: dateStr required (spec §10.3). Got: ${dateStr}`);
  }
  // Accept YYYY-MM-DD and full ISO timestamps. Normalize to UTC midnight.
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    throw new Error(`PHY-031 getCrowdFactor: dateStr must be ISO-8601 (YYYY-MM-DD). Got: ${dateStr}`);
  }
  // Non-null assertions safe: regex guard above confirms m has 3 capture groups.
  const year = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10) - 1; // JS Date months are 0-indexed
  const day = parseInt(m[3]!, 10);
  const d = new Date(Date.UTC(year, month, day));
  if (isNaN(d.getTime())) {
    throw new Error(`PHY-031 getCrowdFactor: invalid date. Got: ${dateStr}`);
  }
  return d;
}

/** Day of week for a UTC Date. 0=Sun, 1=Mon, ..., 6=Sat. */
function dayOfWeek(d: Date): number {
  return d.getUTCDay();
}

/**
 * Third Monday of (year, month). Per spec §5.3.
 * month is 1-indexed (January = 1).
 */
function getThirdMonday(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = first.getUTCDay(); // 0=Sun ... 6=Sat
  // Offset from day 1 to first Monday:
  //   If day 1 is Sun (0), first Monday is day 2.
  //   If day 1 is Mon (1), first Monday is day 1.
  //   Otherwise, first Monday is day (8 - firstDow + 1) - wait, simpler:
  // First Monday date = 1 + ((1 - firstDow + 7) % 7)
  const firstMondayDate = 1 + ((1 - firstDow + 7) % 7);
  return new Date(Date.UTC(year, month - 1, firstMondayDate + 14));
}

/** Fourth Thursday of November for a given year. Per spec §5.4 (Thanksgiving). */
function getThanksgiving(year: number): Date {
  const first = new Date(Date.UTC(year, 10, 1)); // November = month 10 (0-indexed)
  const firstDow = first.getUTCDay();
  // First Thursday date = 1 + ((4 - firstDow + 7) % 7)
  const firstThursdayDate = 1 + ((4 - firstDow + 7) % 7);
  return new Date(Date.UTC(year, 10, firstThursdayDate + 21));
}

/** Days between two UTC Dates (integer). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 3600 * 1000));
}

// ──────────────────────────────────────────────────────────────────────────
// Crowd tier resolution — holiday windows → fallthrough → powder bump
// ──────────────────────────────────────────────────────────────────────────

/**
 * Resolve baseline crowd tier from date, ignoring powder bump.
 * Order: holiday windows (spec §5) → seasonal + day-of-week fallthrough (spec §6).
 */
function getBaselineTier(d: Date): CrowdTier {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1-indexed
  const day = d.getUTCDate();
  const dow = dayOfWeek(d); // 0=Sun...6=Sat

  // ── Window #1: Christmas Day (Dec 25) — Tier 3 (spec §4.3, §5.1)
  if (month === 12 && day === 25) return 3;

  // ── Window #3: Dec 26 ramp-up — Tier 4
  if (month === 12 && day === 26) return 4;

  // ── Window #2: Dec 27–31 — Tier 6 on Saturday, Tier 5 otherwise
  if (month === 12 && day >= 27 && day <= 31) {
    return dow === 6 ? 6 : 5;
  }

  // ── Window #4: Jan 1 — Tier 5
  if (month === 1 && day === 1) return 5;

  // ── Window #5: Jan 2–3 wind-down — Tier 4
  if (month === 1 && (day === 2 || day === 3)) return 4;

  // ── Window #6: MLK Weekend (third Monday of January, Sat–Mon)
  const mlkMon = getThirdMonday(year, 1);
  const mlkSat = new Date(mlkMon.getTime() - 2 * 24 * 3600 * 1000);
  if (d.getTime() >= mlkSat.getTime() && d.getTime() <= mlkMon.getTime()) {
    return dow === 6 ? 5 : 4; // Sat = 5 Packed; Sun/Mon = 4 Busy
  }

  // ── Window #7: Presidents Day Weekend + Presidents week (Tue–Fri after)
  const presMon = getThirdMonday(year, 2);
  const presSat = new Date(presMon.getTime() - 2 * 24 * 3600 * 1000);
  const presFri = new Date(presMon.getTime() + 4 * 24 * 3600 * 1000);
  if (d.getTime() >= presSat.getTime() && d.getTime() <= presMon.getTime()) {
    return dow === 6 ? 5 : 4; // Sat = 5 Packed; Sun/Mon = 4 Busy
  }
  if (d.getTime() > presMon.getTime() && d.getTime() <= presFri.getTime()) {
    return 3; // Tue–Fri Presidents week = 3 Moderate (school vacationers)
  }

  // ── Window #10: Thanksgiving (Wed–Sun around fourth Thursday of November)
  //    Spec §5.1: Wed 3 / Thu 2 / Fri 4 / Sat 4 / Sun 3.
  const tgThu = getThanksgiving(year);
  const tgOffset = daysBetween(d, tgThu);
  if (tgOffset === -1) return 3; // Wed
  if (tgOffset === 0) return 2; // Thu
  if (tgOffset === 1) return 4; // Fri (Black Friday)
  if (tgOffset === 2) return 4; // Sat
  if (tgOffset === 3) return 3; // Sun

  // ── Window #8: Spring Break (Mar 1 – Apr 7)
  if ((month === 3) || (month === 4 && day <= 7)) {
    return dow === 6 ? 4 : 3; // Sat = 4 Busy; other days = 3 Moderate
  }

  // ── Window #9: Seasonal + day-of-week fallthrough (spec §6)
  const isPeak = isPeakSeason(month, day);
  if (isPeak) {
    // Peak season Dec 20 – Mar 31 (no holiday match): spec §6.1
    if (dow === 6) return 4; // Saturday
    if (dow === 0) return 3; // Sunday
    if (dow === 5) return 3; // Friday
    return 2; // Mon–Thu
  }
  // Early season (Nov 1 – Dec 19) and late season (Apr 1+): spec §6.2
  if (dow === 6) return 3; // Saturday
  if (dow === 0 || dow === 5) return 2; // Sun/Fri
  return 1; // Mon–Thu Ghost Town
}

/** Peak season: Dec 20 – Mar 31 (spec §6.1). */
function isPeakSeason(month: number, day: number): boolean {
  if (month === 12 && day >= 20) return true;
  if (month >= 1 && month <= 3) return true;
  return false;
}

/**
 * Apply powder-day tier bump to baseline. Per spec §7.2.
 * Uses baseline tier + day of week + month to choose the correct bump.
 */
function applyPowderBump(baseline: CrowdTier, d: Date): CrowdTier {
  const dow = dayOfWeek(d);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();

  // Dec 27–31 or already at Mayhem: already at ceiling → stay at 6
  if (baseline === 6) return 6;
  if (month === 12 && day >= 27 && day <= 31) return 6;

  // Early season (Nov 1 – Dec 19, Apr 1+) — limited terrain caps surge
  const early = !isPeakSeason(month, day);
  if (early) {
    if (baseline === 1) return 3; // early-season weekday
    if (baseline === 3) return 4; // early-season weekend
    // Other baselines in early season fall through to general rules below.
  }

  // Holiday weekend Sat (MLK/Presidents already resolved to tier 5 baseline):
  //   → compounds to Mayhem 6
  if (baseline === 5 && dow === 6) return 6;

  // General peak-season rules (spec §7.2 body rows)
  if (baseline === 2) return 4; // Weekday Mon–Thu Quiet → Busy
  if (baseline === 3 && dow === 5) return 5; // Friday Moderate → Packed
  if (baseline === 4 && dow === 6) return 5; // Saturday Busy → Packed
  if (baseline === 3 && dow === 0) return 5; // Sunday Moderate → Packed

  // Default: +1 tier, capped at 6
  return Math.min(6, baseline + 1) as CrowdTier;
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

/**
 * Resolve crowd tier 1–6 from date and powder flag.
 *
 * Per spec §13.3: handles all 10 holiday windows (spec §5), seasonal +
 * day-of-week fallthrough (spec §6), and powder tier bump (spec §7.2).
 *
 * @param dateStr ISO-8601 date (YYYY-MM-DD or full timestamp). Required.
 * @param powderFlag True if signal sources report a powder day. Caller-supplied;
 *                   signal-source wiring (OpenSnow/OnTheSnow/NWS) is future scope (spec §7.3).
 * @throws if dateStr is missing or invalid (spec §10.3 — no default path).
 */
export function getCrowdFactor(dateStr: string, powderFlag: boolean): CrowdTier {
  const d = parseIsoDate(dateStr);
  const baseline = getBaselineTier(d);
  if (!powderFlag) return baseline;
  return applyPowderBump(baseline, d);
}

/**
 * Compute total cycles and cycle duration for a resort-ski session.
 *
 * Per spec §2.1 formula:
 *   cycleMinRaw  = runMin + DEFAULT_LIFT_MIN + liftLineMin(tier) + TRANSITION_MIN
 *   cycleMin     = cycleMinRaw / (1 - REST_FRACTION)
 *   totalCycles  = floor(durationMin / cycleMin)
 *
 * Per spec §9: returns COUNT and DURATION only. Never averages per-phase physics.
 *
 * @param crowdTier  Crowd tier 1–6 (typically from getCrowdFactor).
 * @param terrain    Ski terrain type (determines runMin per spec §3.1).
 * @param durationHr Session length in hours.
 */
export function computeCycle(
  crowdTier: CrowdTier,
  terrain: SkiTerrain,
  durationHr: number,
): CycleResult {
  const runMin = RUN_MIN_BY_TERRAIN[terrain];
  const liftLineMin = LIFT_LINE_MIN_BY_TIER[crowdTier];
  const cycleMinRaw = runMin + DEFAULT_LIFT_MIN + liftLineMin + TRANSITION_MIN;
  const cycleMin = cycleMinRaw / (1 - REST_FRACTION);
  const durationMin = durationHr * 60;
  const effectiveMin = durationMin * (1 - REST_FRACTION);
  // Spec §2.1 uses floor(durationMin / cycleMin). Spec §12 worked examples
  // use effectiveMin / cycleMinRaw which is algebraically equivalent:
  //   durationMin / cycleMin = durationMin / (cycleMinRaw / (1-REST))
  //                          = durationMin × (1-REST) / cycleMinRaw
  //                          = effectiveMin / cycleMinRaw
  // Use the effectiveMin / cycleMinRaw form to match spec §12 worked examples exactly.
  const totalCycles = Math.floor(effectiveMin / cycleMinRaw);
  return { totalCycles, cycleMin };
}
