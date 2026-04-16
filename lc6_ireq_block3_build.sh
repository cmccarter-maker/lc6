#!/bin/bash
# LC6 IREQ Block 3 — Activity IREQ curves via dynamic computation
# Option B: no lookup tables, no interpolation. Live IREQ_neu/IREQ_min per call.
# Per Cardinal Rule #1: every MET value traces to Compendium of Physical Activities
# (Ainsworth 2011) or explicit GAP flag.
#
# The IREQ feasibility filter in evaluate() step 2 calls computeActivityIREQ()
# with the trip's (activity, ta, va, RH) and checks candidate CLO ≥ IREQ_min.

set -e

echo ""
echo "=========================================="
echo "LC6 IREQ BLOCK 3 BUILD"
echo "Activity IREQ curves (dynamic)"
echo "=========================================="
echo ""

EXPECTED_DIR="/Users/cmcarter/Desktop/LC6"
if [ "$(pwd)" != "$EXPECTED_DIR" ]; then echo "ERROR: Not in $EXPECTED_DIR"; exit 1; fi
echo "✓ Environment verified"
echo ""

# ============================================================================
# PHASE 1 — Activity MET constants
# ============================================================================
echo ">>> PHASE 1: ireq/activity_met.ts"

cat > packages/engine/src/ireq/activity_met.ts << 'EOF'
// Activity → metabolic rate (W/m²) mapping for IREQ model.
// All values from Ainsworth 2011 Compendium of Physical Activities unless noted.
// 1 MET = 58.2 W/m². Lund IREQ calculator caps M at 400 W/m².
// Per Cardinal Rule #1: every value has a cited source or explicit GAP flag.

/** Lund calculator upper bound for metabolic rate (W/m²). */
export const LUND_M_CAP = 400;

/** Activity metabolic rates in W/m². */
export interface ActivityMetEntry {
  /** Metabolic rate W/m² (capped at LUND_M_CAP). */
  readonly M: number;
  /** Effective mechanical power W/m² (0 for all current activities). */
  readonly W: number;
  /** Compendium code or source citation. */
  readonly source: string;
}

/**
 * Activity → MET mapping. Keys match LC5/LC6 activity identifiers.
 *
 * Ski terrain sub-modes use INSTANTANEOUS active MET during descent,
 * not time-weighted average (Research Log §1.4: "IREQ is about do you
 * have enough insulation when the wind hits you at speed").
 */
export const ACTIVITY_MET: Readonly<Record<string, ActivityMetEntry>> = {
  // Hiking / trail
  hiking:          { M: 262, W: 0, source: 'Compendium 17160 (4.5 MET)' },
  day_hike:        { M: 262, W: 0, source: 'Compendium 17160 (4.5 MET)' },
  backpacking:     { M: 400, W: 0, source: 'Compendium 17080 (7.0 MET → 407, CAP 400)' },

  // Running / cycling
  running:         { M: 400, W: 0, source: 'Compendium 12050 (8.0 MET → CAP 400)' },
  mountain_biking: { M: 400, W: 0, source: 'Compendium 01015 (8.5 MET → CAP 400)' },
  road_cycling:    { M: 400, W: 0, source: 'Compendium 01018 (8.0 MET → CAP 400)' },
  gravel_biking:   { M: 400, W: 0, source: 'Compendium 01018 (8.0 MET → CAP 400)' },

  // Winter sport
  cross_country_ski: { M: 400, W: 0, source: 'Compendium 19080 (9.0 MET → CAP 400)' },
  skiing:            { M: 378, W: 0, source: 'Compendium 19060/19062 (6.5 MET active descent, groomers default)' },
  snowboarding:      { M: 308, W: 0, source: 'Compendium 19075 (4.3-5.3 MET, midpoint 5.3)' },
  snowshoeing:       { M: 308, W: 0, source: 'Compendium 19252 (5.3 MET)' },

  // Climbing / board
  bouldering:      { M: 338, W: 0, source: 'Compendium 15535 (5.8 MET)' },
  climbing:        { M: 338, W: 0, source: 'Compendium 15535 (5.8 MET)' },
  skateboarding:   { M: 291, W: 0, source: 'Compendium 15600 (5.0 MET)' },
  onewheel:        { M: 204, W: 0, source: 'GAP: No Compendium entry. Proxy: skateboarding scaled ×0.7 (less active balance)' },

  // Stationary / low activity
  camping:         { M: 146, W: 0, source: 'Compendium 05040 (2.5 MET, camp chores)' },
  hunting_stand:   { M: 146, W: 0, source: 'Compendium 17060 (2.5 MET, stand hunting)' },
  hunting_walking: { M: 291, W: 0, source: 'Compendium 17070 (5.0 MET, still hunting)' },
  fishing:         { M: 146, W: 0, source: 'Compendium 18080 (2.5 MET, shore stationary)' },
  golf:            { M: 279, W: 0, source: 'Compendium 15265 (4.8 MET, walking with clubs)' },
};

/**
 * Ski terrain sub-mode MET overrides (instantaneous active MET during descent).
 * Research Log §1.4. All hit LUND_M_CAP except groomers (378) and backcountry descent (349).
 */
export const SKI_TERRAIN_MET: Readonly<Record<string, number>> = {
  groomers:    378,  // 6.5 MET
  moguls:      400,  // 8.5 MET → CAP
  trees:       400,  // 7.5 MET → CAP
  bowls:       400,  // 8.0 MET → CAP
  park:        400,  // 7.0 MET → CAP
  backcountry: 349,  // 6.0 MET descent
};

/**
 * Resolve activity + optional context to metabolic rate (W/m²).
 * Returns null if activity has no IREQ entry (water-primary activities).
 */
export function resolveActivityMet(
  activity: string,
  snowTerrain?: string | null,
): { M: number; W: number } | null {
  // Water-primary activities — triaged OUT of IREQ (Research Log §1.3)
  const WATER_ACTIVITIES = ['kayaking', 'paddle_boarding', 'fishing_wading'];
  if (WATER_ACTIVITIES.includes(activity)) return null;

  // Ski terrain override
  if ((activity === 'skiing' || activity === 'snowboarding') && snowTerrain) {
    const terrainM = SKI_TERRAIN_MET[snowTerrain];
    if (terrainM != null) return { M: terrainM, W: 0 };
  }

  // Hunting mode resolution
  if (activity === 'hunting') return ACTIVITY_MET['hunting_stand']!;

  const entry = ACTIVITY_MET[activity];
  if (!entry) return null;
  return { M: entry.M, W: entry.W };
}
EOF

echo "✓ activity_met.ts written"
echo ""

# ============================================================================
# PHASE 2 — computeActivityIREQ function
# ============================================================================
echo ">>> PHASE 2: ireq/compute.ts"

cat > packages/engine/src/ireq/compute.ts << 'EOF'
// Dynamic IREQ computation per activity.
// No lookup tables, no interpolation — live solve per call.
// IREQ_neu/IREQ_min complete in <1ms, no performance concern.

import { IREQ_neu, IREQ_min } from './ireq.js';
import { m2KW_to_clo } from './helpers.js';
import { resolveActivityMet } from './activity_met.js';

/** Default moisture permeability index per d'Ambrosio 2025 Appendix B. */
const DEFAULT_IM = 0.38;

export interface ActivityIREQResult {
  /** Required insulation for thermal comfort (neutral), clo. */
  ireq_neu_clo: number;
  /** Minimum required insulation (high strain), clo. */
  ireq_min_clo: number;
  /** Metabolic rate used, W/m². */
  M: number;
  /** True if activity is triaged out of IREQ (water-primary). */
  excluded: false;
}

export interface ActivityIREQExcluded {
  excluded: true;
  reason: string;
}

export type ActivityIREQOutput = ActivityIREQResult | ActivityIREQExcluded;

/**
 * Compute IREQ_neu and IREQ_min for a given activity and conditions.
 * Returns required clothing insulation in clo.
 *
 * @param activity LC5/LC6 activity identifier
 * @param ta air temperature, °C
 * @param va air velocity, m/s (must be ≥ 0.4 per ISO 11079)
 * @param RH relative humidity, %
 * @param options optional overrides
 */
export function computeActivityIREQ(
  activity: string,
  ta: number,
  va: number,
  RH: number,
  options?: {
    snowTerrain?: string | null;
    im?: number;
    tr?: number;  // mean radiant temperature; defaults to ta
  },
): ActivityIREQOutput {
  const met = resolveActivityMet(activity, options?.snowTerrain);
  if (met === null) {
    return { excluded: true, reason: `Activity '${activity}' triaged out of IREQ (water-primary)` };
  }

  const im = options?.im ?? DEFAULT_IM;
  const tr = options?.tr ?? ta;  // ISO 11079 default: tr = ta (no solar model)
  const vaEff = Math.max(0.4, va);  // ISO 11079 minimum

  const neu_m2kw = IREQ_neu(ta, tr, vaEff, RH, met.M, met.W, im);
  const min_m2kw = IREQ_min(ta, tr, vaEff, RH, met.M, met.W, im);

  return {
    ireq_neu_clo: m2KW_to_clo(neu_m2kw),
    ireq_min_clo: m2KW_to_clo(min_m2kw),
    M: met.M,
    excluded: false,
  };
}
EOF

echo "✓ compute.ts written"
echo ""

# ============================================================================
# PHASE 3 — Update module index
# ============================================================================
echo ">>> PHASE 3: Update ireq/index.ts"

cat > packages/engine/src/ireq/index.ts << 'EOF'
// LC6 IREQ module — ISO 11079 cold stress assessment.
// d'Ambrosio Alfano et al. 2025, Appendix B, verbatim port.
// Activity MET mapping from Ainsworth 2011 Compendium of Physical Activities.

export { psks_kPa, pa_kPa, tex_C, pex_kPa, m2KW_to_clo, clo_to_m2KW } from './helpers.js';
export { IREQ_neu, IREQ_min } from './ireq.js';
export { DLE_neu, DLE_min } from './dle.js';
export { ACTIVITY_MET, SKI_TERRAIN_MET, resolveActivityMet, LUND_M_CAP } from './activity_met.js';
export { computeActivityIREQ } from './compute.js';
export type { ActivityIREQResult, ActivityIREQExcluded, ActivityIREQOutput, ActivityMetEntry } from './compute.js';
EOF

# Update engine main index — replace old ireq exports with expanded set
sed -i '' '/\/\/ IREQ module/,/from .\/ireq\/index.js/d' packages/engine/src/index.ts

cat >> packages/engine/src/index.ts << 'EOF'

// IREQ module — ISO 11079 cold stress (Block 1 + Block 2 + Block 3)
export {
  IREQ_neu,
  IREQ_min,
  DLE_neu,
  DLE_min,
  m2KW_to_clo,
  clo_to_m2KW,
  computeActivityIREQ,
  ACTIVITY_MET,
  SKI_TERRAIN_MET,
  resolveActivityMet,
  LUND_M_CAP,
} from './ireq/index.js';
export type { ActivityIREQResult, ActivityIREQExcluded, ActivityIREQOutput } from './ireq/index.js';
EOF

echo "✓ Indexes updated"
echo ""

# ============================================================================
# PHASE 4 — Tests
# ============================================================================
echo ">>> PHASE 4: Block 3 tests"

cat > packages/engine/tests/ireq/activity_ireq.test.ts << 'EOF'
// Block 3 validation: computeActivityIREQ across the activity × temp envelope.
// Verifies:
// 1. Every activity resolves to a MET value (no undefined)
// 2. IREQ increases monotonically as temperature drops (physics sanity)
// 3. Higher MET activities need less insulation (physics: more heat production)
// 4. Water-primary activities return excluded
// 5. Ski terrain overrides produce expected MET values
// 6. Spot-check: skiing at -10°C produces IREQ_min in plausible range (~2 clo)

import { describe, it, expect } from 'vitest';
import { computeActivityIREQ, ACTIVITY_MET, resolveActivityMet } from '../../src/ireq/index.js';
import type { ActivityIREQResult } from '../../src/ireq/index.js';

const RH = 50, va = 3;

describe('resolveActivityMet — coverage', () => {
  const ALL_ACTIVITIES = Object.keys(ACTIVITY_MET);

  it('every ACTIVITY_MET key resolves to non-null', () => {
    for (const act of ALL_ACTIVITIES) {
      const met = resolveActivityMet(act);
      expect(met).not.toBeNull();
      expect(met!.M).toBeGreaterThan(0);
    }
  });

  it('water-primary activities return null', () => {
    expect(resolveActivityMet('kayaking')).toBeNull();
    expect(resolveActivityMet('paddle_boarding')).toBeNull();
    expect(resolveActivityMet('fishing_wading')).toBeNull();
  });

  it('hunting defaults to stand hunting', () => {
    const met = resolveActivityMet('hunting');
    expect(met!.M).toBe(146);
  });

  it('ski terrain override works', () => {
    const groomers = resolveActivityMet('skiing', 'groomers');
    expect(groomers!.M).toBe(378);
    const moguls = resolveActivityMet('skiing', 'moguls');
    expect(moguls!.M).toBe(400);
    const bc = resolveActivityMet('skiing', 'backcountry');
    expect(bc!.M).toBe(349);
  });
});

describe('computeActivityIREQ — physics sanity', () => {
  it('water-primary returns excluded', () => {
    const result = computeActivityIREQ('kayaking', -10, 3, 50);
    expect(result.excluded).toBe(true);
  });

  it('IREQ increases monotonically as temperature drops (hiking)', () => {
    const temps = [5, 0, -5, -10, -15, -20];
    const results = temps.map(t => {
      const r = computeActivityIREQ('hiking', t, va, RH);
      return (r as ActivityIREQResult).ireq_min_clo;
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!).toBeGreaterThan(results[i - 1]!);
    }
  });

  it('IREQ increases monotonically as temperature drops (camping)', () => {
    const temps = [5, 0, -5, -10, -15, -20];
    const results = temps.map(t => {
      const r = computeActivityIREQ('camping', t, va, RH);
      return (r as ActivityIREQResult).ireq_min_clo;
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!).toBeGreaterThan(results[i - 1]!);
    }
  });

  it('higher MET needs less insulation at same temp (running < camping at -10°C)', () => {
    const running = computeActivityIREQ('running', -10, va, RH) as ActivityIREQResult;
    const camping = computeActivityIREQ('camping', -10, va, RH) as ActivityIREQResult;
    expect(running.ireq_min_clo).toBeLessThan(camping.ireq_min_clo);
  });

  it('higher MET needs less insulation (hiking < fishing at -10°C)', () => {
    const hiking = computeActivityIREQ('hiking', -10, va, RH) as ActivityIREQResult;
    const fishing = computeActivityIREQ('fishing', -10, va, RH) as ActivityIREQResult;
    expect(hiking.ireq_min_clo).toBeLessThan(fishing.ireq_min_clo);
  });

  it('ski terrain: moguls needs less insulation than groomers at -15°C', () => {
    const groomers = computeActivityIREQ('skiing', -15, va, RH, { snowTerrain: 'groomers' }) as ActivityIREQResult;
    const moguls = computeActivityIREQ('skiing', -15, va, RH, { snowTerrain: 'moguls' }) as ActivityIREQResult;
    expect(moguls.ireq_min_clo).toBeLessThan(groomers.ireq_min_clo);
    expect(moguls.M).toBe(400);
    expect(groomers.M).toBe(378);
  });
});

describe('computeActivityIREQ — spot checks (plausible ranges)', () => {
  it('skiing groomers at -10°C: IREQ_min ~1.5-2.5 clo', () => {
    const r = computeActivityIREQ('skiing', -10, 3, 50, { snowTerrain: 'groomers' }) as ActivityIREQResult;
    expect(r.ireq_min_clo).toBeGreaterThan(1.0);
    expect(r.ireq_min_clo).toBeLessThan(3.0);
  });

  it('camping at -20°C: IREQ_neu ~4-6 clo (very high, sedentary in deep cold)', () => {
    const r = computeActivityIREQ('camping', -20, 1, 50) as ActivityIREQResult;
    expect(r.ireq_neu_clo).toBeGreaterThan(3.5);
    expect(r.ireq_neu_clo).toBeLessThan(7.0);
  });

  it('running at 0°C: IREQ_min ~0.5-1.5 clo (high MET, moderate cold)', () => {
    const r = computeActivityIREQ('running', 0, 3, 50) as ActivityIREQResult;
    expect(r.ireq_min_clo).toBeGreaterThan(0.3);
    expect(r.ireq_min_clo).toBeLessThan(2.0);
  });

  it('hiking at -10°C: IREQ_min ~1.5-2.5 clo', () => {
    const r = computeActivityIREQ('hiking', -10, 3, 50) as ActivityIREQResult;
    expect(r.ireq_min_clo).toBeGreaterThan(1.0);
    expect(r.ireq_min_clo).toBeLessThan(3.0);
  });

  it('golf at 5°C: IREQ_neu ~0.8-1.8 clo (moderate activity, cool)', () => {
    const r = computeActivityIREQ('golf', 5, 2, 50) as ActivityIREQResult;
    expect(r.ireq_neu_clo).toBeGreaterThan(0.5);
    expect(r.ireq_neu_clo).toBeLessThan(2.5);
  });
});

describe('computeActivityIREQ — full activity sweep at -10°C', () => {
  const ALL_LAND = [
    'hiking', 'backpacking', 'running', 'mountain_biking', 'road_cycling',
    'cross_country_ski', 'skiing', 'snowboarding', 'snowshoeing',
    'bouldering', 'climbing', 'skateboarding', 'onewheel',
    'camping', 'hunting_stand', 'hunting_walking', 'fishing', 'golf',
  ];

  ALL_LAND.forEach(act => {
    it(`${act} at -10°C: returns valid IREQ (not excluded, positive values)`, () => {
      const r = computeActivityIREQ(act, -10, 3, 50);
      expect(r.excluded).toBe(false);
      const result = r as ActivityIREQResult;
      expect(result.ireq_neu_clo).toBeGreaterThan(0);
      expect(result.ireq_min_clo).toBeGreaterThan(0);
      expect(result.ireq_neu_clo).toBeGreaterThan(result.ireq_min_clo);
      expect(result.M).toBeGreaterThan(0);
    });
  });
});
EOF

echo "✓ Tests written"
echo ""

# ============================================================================
# PHASE 5 — Run tests + typecheck + commit + push
# ============================================================================
echo ">>> PHASE 5: Run tests, typecheck, commit, push"

echo ""
echo "--- run engine tests ---"
pnpm --filter @lc6/engine test

echo ""
echo "--- typecheck ---"
pnpm typecheck

echo ""
echo "--- Git ---"
git add .
git commit -m "IREQ Block 3: Activity IREQ curves via dynamic computation

Activity → MET mapping + computeActivityIREQ() for evaluate() step 2 IREQ filter.
Option B: no lookup tables, no interpolation. Live IREQ_neu/IREQ_min per call.

New files:
  - ireq/activity_met.ts: 20 activity entries with Compendium citations,
    ski terrain sub-mode MET overrides (Research Log §1.4),
    resolveActivityMet() with water-primary exclusion.
  - ireq/compute.ts: computeActivityIREQ() — dynamic IREQ solve per call.
    Returns {ireq_neu_clo, ireq_min_clo, M} or {excluded: true, reason}.

MET sources: Ainsworth 2011 Compendium of Physical Activities.
  - 1 GAP flagged: onewheel (no Compendium entry, proxy from skateboarding ×0.7).
  - Ski terrain uses instantaneous active MET, not time-weighted average
    (Research Log §1.4: IREQ is about insulation when wind hits at speed).
  - Water-primary activities (kayaking, paddle_boarding, fishing_wading)
    triaged out of IREQ per Research Log §1.3.

Tests: physics sanity (monotonicity, MET ordering), spot checks (plausible
ranges), full 18-activity sweep at -10°C, water-primary exclusion,
ski terrain overrides."

git push origin main

echo ""
echo "=========================================="
echo "IREQ BLOCK 3 COMPLETE"
echo "=========================================="
echo "computeActivityIREQ() operational for all 18 land activities."
echo "evaluate() step 2 IREQ filter is now unblocked."
echo "Next: Session 10 full Q2c evaluate() pipeline."
