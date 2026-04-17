# LC6 Future Work — Post Session 10

## Priority 1: Real Gear DB Integration

**Goal:** Port LC5's `gear.js` (1,627 products, 175+ brands) into LC6's `RawGearDB` format.

**Why it matters:**
- Adversarial matrix currently covers 12/19 scenarios. The other 7 (day_hike, XC ski, snowshoeing, road_cycling, and some fishing/hiking temp ranges) fail enumeration because the embedded test DB lacks full activity fit coverage.
- Real product recommendations require real inventory.
- Every other test (`real_gear.test.ts`, `diagnostic.test.ts`) currently uses tiny hand-typed gear DBs — one proper adapter unlocks all of them.

**Architecture:**
- LC5 `gear.js` is a JavaScript module with a specific structure (brands, slot categories, per-product fields).
- LC6 `RawGearDB` is the TypeScript type the current adapter consumes.
- Need: gear.js parser + field-mapper + validator + tests against sample products.

**Scope estimate:** Focused 1-2 hour session. Parse gear.js structure, map fields to RawGearDB schema, write converter, validate coverage by slot × activity, hook into existing adapter pipeline.

**Deliverables:**
- `packages/engine/src/gear/gearjs_adapter.ts` — converts LC5 gear.js → RawGearDB
- Tests validating coverage for all activities in the adversarial matrix
- Updated adversarial matrix that runs against real products

---

## Priority 2: Engine Hardening — Synthetic Input Robustness

**Goal:** Eliminate `NaN` propagation in calcIntermittentMoisture's cyclic path when gear items are missing fields.

**Why it matters:**
- When I tested the matrix with synthetic ensembles (hand-built gear items without full field coverage), the cyclic trajectory produced `MR=NaN` at every point, which silently passed through `buildTrajectorySnapshot` because `NaN > 0` is false.
- Real gear never hits this because real gear has all fields. But it's a fragility that would bite future dev using the engine API programmatically.
- Also affects anyone (like us) trying to build synthetic test cases — the test output was misleading for 17/19 scenarios before we switched to real gear.

**What to do:**
- Audit calcIntermittentMoisture for unguarded arithmetic with potentially-undefined inputs
- Add default fallbacks for missing weightG, warmthRatio, fiber type
- Add one or two synthetic-input tests that would have caught the NaN issue
- NO Cardinal Rule #8 touching — this is defensive hardening at input boundaries, not touching thermal physics

**Scope estimate:** 1 hour.

---

## Priority 3: Doc Propagation (deferred from earlier)

TA v7.0, ATP v5.0, Overview, slide deck all need PHY-069/070/071/072 additions:
- IREQ ratification summary
- TSENS addition and its role in ranker
- PHY-071 fiber saturation correction (likely the LC5 "demon's den" root cause)
- PHY-072 Critical Moment architecture + alarm fatigue rationale

**Scope:** Full day; treat as separate work stream.

---

## Priority 4: Wire PHY-072 outputs into display layer

Engine produces `critical_moments[]` and `strategy_windows[]` but the Kirkwood/Breck display layers don't yet consume them. Red diamond forced-view CM cards + browseable window blocks need UI scaffolding.

**Scope:** UI design + React components; multi-session effort.
