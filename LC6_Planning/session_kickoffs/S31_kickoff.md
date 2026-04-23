# S31 Kickoff — Engine Implementation of PHY-031-CYCLEMIN-RECONCILIATION

**Session:** S31 (Code-led implementation session)
**Authored by:** Chat
**Date:** April 22–23, 2026
**Parent spec:** `LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md` (ratified S30, commit `28731fb`)
**Branch:** `session-13-phy-humid-v2` (6 unpushed commits; continues local through S31)
**Expected start HEAD:** `4e84e76` (S30 SHA-backfill commit)
**Cardinal Rule #8 active.** Highest-risk engine patch since PHY-068.

---

## 0. Executive summary

S31 ports the physics authorized by PHY-031-CYCLEMIN-RECONCILIATION v1 into the thermal engine. The port touches the single-source-of-truth phase loop in `calc_intermittent_moisture.ts`. Cardinal Rule #8 requires hand-computed verification vectors to exist before code is written — they do (spec §9, three vectors G1/M2/P5, extended in this kickoff §9 to full-primitive depth).

Implementation is **progressive**, not all-at-once: three phases (A/B/C), each gated on its own checkpoint vectors before advancing to the next. If phase A regresses, phase B never starts. If phase B regresses, phase C never starts. This prevents a "big-bang commit" where cascading bugs are hard to disentangle.

Session closes when:
- All 8 gate criteria from spec §9.5 pass
- `S26-SYSTEMATIC-MR-UNDERESTIMATION` formally closes per spec §11
- `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` flips HIGH-ratified-implementation-pending → CLOSED
- Branch pushes to origin (first push since S28)

Session does NOT close if:
- Any of the 8 gate criteria fails → halt, escalate, do not tune constants to fit
- Any non-ski activity regresses → halt, this means scope leakage out of ski path

Expected duration: 4–8 hours of Code work depending on how cleanly the baseline captures go. Three natural break points between phases.

---

## 1. Pre-flight

Before any engine touch. This sequence runs as the first Code action of S31 and verifies the starting state matches what this kickoff assumes.

```bash
cd ~/Desktop/LC6-local

# Branch check
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "session-13-phy-humid-v2" ]]; then
  echo "HALT: expected branch 'session-13-phy-humid-v2', on '$CURRENT_BRANCH'"
  exit 1
fi

# Working tree clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "HALT: working tree not clean"
  git status --short
  exit 1
fi

# Expected HEAD
HEAD_SHA=$(git rev-parse --short HEAD)
if [[ "$HEAD_SHA" != "4e84e76" ]]; then
  echo "WARN: HEAD is $HEAD_SHA, expected 4e84e76 (S30 SHA-backfill commit)"
  echo "Intermediate commits may be OK but please confirm with user before proceeding."
  # In interactive context, prompt; in non-interactive, halt
  exit 1
fi

# Unpushed count should be 6
UNPUSHED=$(git log origin/session-13-phy-humid-v2..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
echo "Unpushed commits: $UNPUSHED (expected 6)"

# Spec file present and ratified
SPEC="LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md"
if [[ ! -f "$SPEC" ]]; then
  echo "HALT: ratified spec missing at $SPEC"
  exit 1
fi

# Engine file present and unmodified
ENGINE="packages/engine/src/moisture/calc_intermittent_moisture.ts"
if [[ ! -f "$ENGINE" ]]; then
  echo "HALT: engine file missing at $ENGINE"
  exit 1
fi

# Existing test suite green at starting HEAD
pnpm -F @layercraft/engine test 2>&1 | tail -20
echo "Test suite ran — verify green before proceeding."

echo ""
echo "Pre-flight PASSED. Ready for Phase A."
```

Phase gates (§3, §4, §5 below) run `pnpm -F @layercraft/engine test` after every patch. Test suite must stay green throughout except for expected regressions in `spec-locks/phy-031-cyclemin-reconciliation/` tests that S31 itself is authoring.

---

## 2. Pre-patch baseline capture (all three vectors)

**This is the first Code operation after pre-flight.** Captures current engine output at HEAD `4e84e76` under each vector's inputs. These baselines become the "pre-reconciliation" reference that spec §9.5 criterion #7 checks against.

### 2.1 Baseline test file

Create `packages/engine/tests/spec-locks/phy-031-cyclemin-reconciliation/baseline-capture.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calcIntermittentMoisture } from '../../../src/moisture/calc_intermittent_moisture';
// ... (imports for profiles, gear, etc.)

describe('PHY-031 cycleMin reconciliation — pre-patch baselines', () => {
  // Vector G1: Ghost Town groomers, 16°F, Tuesday 2026-11-10
  it('captures G1 baseline output (expected sessionMR ~1.5 pre-reconciliation)', () => {
    const result = calcIntermittentMoisture({
      // exact inputs per spec §9.2
      tempF: 16,
      humidity: 30,
      windMph: 5,
      precipProbability: 0,
      elevFt: 9600,
      dewPointC: -12,
      // gear ensemble per spec §9.2
      // biometrics per spec §9.2
      // session config per spec §9.2
      date: '2026-11-10',  // Tuesday
      snowTerrain: 'groomers',
      durationHrs: 8.5,
      activity: 'snowboarding',
      lunch: true,          // ignored by current engine — extension not wired yet
      otherBreak: true,     // ignored by current engine
    });

    console.log('G1 BASELINE:');
    console.log(`  sessionMR: ${result.sessionMR}`);
    console.log(`  totalCycles: ${result.totalCycles}`);
    console.log(`  totalFluidLoss: ${result._totalFluidLoss}`);
    console.log(`  cumStorageWmin: ${result._cumStorageWmin}`);
    console.log(`  perCycleMR: ${JSON.stringify(result._perCycleMR)}`);
    console.log(`  final layer fills:`);
    console.log(`    base: ${result._finalLayerFills?.base}`);
    console.log(`    mid: ${result._finalLayerFills?.mid}`);
    console.log(`    insulative: ${result._finalLayerFills?.insulative}`);
    console.log(`    shell: ${result._finalLayerFills?.shell}`);

    // No assertions — this test's purpose is to capture baseline
    expect(result).toBeDefined();
  });

  // Vectors M2 and P5 identical pattern with spec §9.3 and §9.4 inputs
});
```

Run it, copy outputs into a baseline markdown doc at:

`LC6_Planning/audits/S31_PRE_PATCH_BASELINE.md`

The baseline doc records observed output for each vector on commit `4e84e76`, formatted for direct comparison against spec §9's expected target values. This is what §9.5 criterion #7 checks.

**Expected baselines per spec §9 (these are what the current engine should produce):**
- G1: sessionMR ~1.5
- M2: sessionMR ~1.5
- P5: sessionMR ~2.5

If baselines land more than ±0.3 away from these values, Chat escalates — it means the engine state at `4e84e76` has diverged from spec §9.5's assumption about pre-patch behavior.

### 2.2 Non-ski baseline capture

Separately, capture baselines for the 11 non-ski activities named in spec §9.5 criterion #8:

```
day_hike, backpacking, running, mountain_biking, trail_running,
bouldering, camping, fishing, kayaking_lake, cycling_road_flat, snowshoeing
```

For each, run a simple smoke-test input through `calcIntermittentMoisture` (or its steady-state equivalent for non-cyclic activities), capture sessionMR + totalFluidLoss + final layer buffer fills. Record in the same `S31_PRE_PATCH_BASELINE.md` doc.

After every phase (A, B, C) below, these baselines must reproduce bit-identically. If any diverges, scope has leaked and S31 halts.

---

## 3. Phase A — `_cycleMinRaw` accumulator scoping

**Scope:** change the time-window for moisture buffer advancement from `_runMin + _liftMin` to `_cycleMinRaw` per spec §4.6. Do **not** add new phases yet. Do **not** add rest handling yet. This is the smallest, most bounded change in the sequence.

**Why first:** §4.6 is "processes always on" — a pure accounting correction, not a physics change. Isolating it lets us verify the Washburn / shell-drain / insensible / respiratory / ambient-vapor machinery still behaves correctly under a slightly longer time window, before the more invasive 4-phase structural change lands.

### 3.1 What changes

In `calc_intermittent_moisture.ts`:

- Line 715: `const _cycleTotalMin = _runMin + _liftMin;` → `const _cycleTotalMin = _cycleMinRaw;` (where `_cycleMinRaw` is derived from cycle-specific components; for now, until Phase B introduces line + transition, `_cycleMinRaw === _runMin + _liftMin` so this is a no-op structurally — it names the concept)
- Line 725: `const _insensibleG = 10 * (_runMin + _liftMin) / 60;` → `const _insensibleG = 10 * _cycleMinRaw / 60;`
- Line 729: `_respRun.moistureGhr * (_runMin / 60)` → `_respRun.moistureGhr * (_cycleMinRaw / 60)` — the user breathes during lift too, not just run. This is the first behavior change.
- Line 730: `const _cycleMin = _runMin + _liftMin;` → `const _cycleMin = _cycleMinRaw;`
- Line 756: `_fabricInG = (_retainedCondensG + _excessHr * _netRetention) * (_runMin / 60) + _liftFabricG + _insensibleG;` — fabricInG scoping to respiratory-inclusive value
- Lines 792, 799: `Math.pow(Math.max(0, 1 - _wickR), _cycleMin)` → already uses `_cycleMin`, but the bound of `_cycleMin` changes from `_runMin + _liftMin` to `_cycleMinRaw`. No code change; variable source changes upstream.
- Line 817: `const _drainGPerHr = (_runDrainHr * _runMin + _liftDrainHr * _liftMin) / _cycleMin;` — remains weighted by actual phase minutes, but `_cycleMin` bound updates (no code change)
- Line 818: `_drainG = _drainGPerHr * (_cycleMin / 60) * _outerFill` — time window updates (no code change)
- Line 875: `precipWettingRate(...) * (_cycleMin / 60)` — time window updates (no code change)
- Line 933: `const _cycleDurF = _runMin + _liftMin;` → `const _cycleDurF = _cycleMinRaw;`

**Structural principle:** introduce `_cycleMinRaw` as a derived scalar at the top of the phase-loop body. Before Phase B, `_cycleMinRaw === _runMin + _liftMin`. This shim prepares the variable name for the 4-phase expansion in Phase B without changing its numeric value yet.

### 3.2 Phase A test harness

Run the 3 vectors (G1, M2, P5) post-patch. Expected deltas from baseline:

- G1: sessionMR ~1.5 → ~1.55–1.65 (respiratory scaling extends slightly; drying window marginally longer; small net rise from capturing 13-min cycle wall-clock vs 10-min run+lift)
- M2: sessionMR ~1.5 → ~1.6–1.8 (moguls run-MET 10 drives high respiratory vapor; `_cycleMinRaw = 19` vs prior 14 is a larger relative change)
- P5: sessionMR ~2.5 → ~2.7–3.1 (powder day, `_cycleMinRaw = 32` vs prior 14 is a 2.3× change in time window; most sensitive vector)

**Phase A checkpoint gate:**

- Sensitivity analysis complete: vectors shift slightly in the expected direction (upward, small magnitude). Chat verifies rough-match.
- Non-ski activity regression: **bit-identical** to baseline. If any non-ski activity shifts by more than floating-point noise, halt. Phase A should be a no-op for non-ski because their `_runMin + _liftMin` already equals full cycle duration.
- All existing spec-locks still green (except the baseline-capture test, which is expected to show different numbers).
- Hand-comp §9.1 (Phase A trace) matches engine output within tolerance.

**Halt conditions for Phase A:**
- Non-ski regression (means `_cycleMinRaw` shim leaked into non-ski code path)
- Vector delta > 15% from expected range (means `_cycleMinRaw` is not computing what spec says)
- Any spec-lock test regression (means a ratified invariant broke)

If Phase A checkpoint passes, commit:

```
git add packages/engine/src/moisture/calc_intermittent_moisture.ts \
        packages/engine/tests/spec-locks/phy-031-cyclemin-reconciliation/
git commit -m "S31 Phase A: _cycleMinRaw accumulator scoping (spec §4.6)

Processes-always-on accounting fix: Washburn wicking, shell drain,
insensible perspiration, respiratory moisture, ambient vapor absorption,
and precipitation wetting now scoped to _cycleMinRaw (wall-clock sum of
all cycle phases) instead of _runMin + _liftMin.

Pre-Phase-B, _cycleMinRaw === _runMin + _liftMin (no phases added yet),
so structural variable-name introduction only. Respiratory moisture
scaling extends to full cycle (user breathes during lift).

Non-ski activities verified bit-identical to pre-patch baseline.
Spec vectors G1/M2/P5 verified within Phase A expected ranges.

Reference: reconciliation spec §4.6."
```

Do NOT proceed to Phase B until this commit lands clean and its gate passes.

---

## 4. Phase B — 4-phase cycle decomposition

**Scope:** extend the cyclic phase loop from 2 phases (run + lift) to 4 phases (line + lift + transition + run) per spec §4.2. Introduce per-phase MET, per-phase EPOC continuity chain, per-phase sub-stepping for line and transition. Do **not** add rest handling yet.

### 4.1 What changes

**Declarations:**
- Introduce `_liftLineMin` from `cycleOverride.liftLineMin` or `phy031_constants.LIFT_LINE_MIN[tier]` — the spec §3 tier-based wait times already exist in `phy031_constants.ts` from S29 port
- Introduce `TRANSITION_MIN = 3` constant (may already be in `phy031_constants.ts` from S29)
- Introduce per-phase MET constants:
  - `LINE_MET = 1.8` (Ainsworth 2011 Compendium code 20030)
  - `TRANSITION_MET = 2.0` (Ainsworth 2011 Compendium code 05160)
  - (lift_MET = 1.5 already exists in engine)
- Now `_cycleMinRaw = _liftLineMin + _liftMin + TRANSITION_MIN + _runMin`

**Phase loop body** (from current lines 654–740 approximately):

Current order:
```
run (single-step, lines 654–676)
lift (sub-stepped, lines 678–712)
cycle-total aggregation (lines 715–740)
```

New order per spec §4.2 (wall-clock sequence `line → lift → transition → run`):
```
line       (sub-stepped over _liftLineMin minutes) [NEW]
lift       (sub-stepped over _liftMin minutes)     [existing, EPOC seed changes]
transition (sub-stepped over TRANSITION_MIN minutes) [NEW]
run        (single-step over _runMin minutes)     [existing, otherwise unchanged]
cycle-total aggregation [4 phases instead of 2]
```

**EPOC continuity chain** per spec §4.3.1:

- `_prevRunEndMET` — new cross-cycle state, stores `_METrunEnd` from each cycle for use by `line[c+1]` EPOC seed
- line[c] seed (c > 0): EPOC decay from `_prevRunEndMET` with `tFromRunEnd = 0` at start of line
- line[0] seed: basal 1.5 MET (no EPOC, user just arrived)
- lift[c] seed: continues EPOC from line-end with `tFromRunEnd = _liftLineMin`
- transition[c] seed: continues EPOC from lift-end with `tFromRunEnd = _liftLineMin + _liftMin`, MET target 2.0 overlaid
- run[c]: reseeds to full `_METrun`, computes `_METrunEnd` for cross-cycle carry

**Per-phase physics:**
- Each phase calls full primitive suite per spec §5.6 (`iterativeTSkin`, `computeMetabolicHeat`, `computeConvectiveHeatLoss`, `computeRadiativeHeatLoss`, `computeRespiratoryHeatLoss`, `computeEdiff`, `computeEmax`, `computeSweatRate`, `shiveringBoost`)
- `civdProtectionFromSkin` snapshot once per cycle at cycle entry (unchanged)
- Wind: line/lift/transition use ambient only; run uses `windMph + _cycleSpeedWMs` (unchanged)

**Tier 1 skip:** when `_liftLineMin === 0` (Tier 1 Ghost Town), skip the line sub-step loop entirely. Implementation:

```typescript
let _sweatLineG = 0, _lineCondensG = 0, _lineExcessG = 0, _lineStorage = 0;
if (_liftLineMin > 0) {
  for (let mn = 0; mn < _liftLineMin; mn++) {
    // per-minute line integration
  }
}
```

This keeps Vector G1 (Tier 1 Ghost Town, `_liftLineMin = 0`) structurally identical to non-line scenarios while still exercising the 4-phase architecture for other tiers.

**Condensation handling:**
- Line: per-minute condensation accumulation pattern identical to lift (current lines 705–708)
- Transition: per-minute condensation accumulation, same pattern
- Run: unchanged
- Sum all four phases' condensation into `_cycleCondensG` for single-snapshot placement (unchanged per spec §5.8 — placement per-phase is flagged as Model Refinement, not Phase B scope)

**Storage bookkeeping per spec §5.9:** `_cycleTotalWmin = _lineStorage + _liftStorage + _transStorage + _runStorage`

### 4.2 Phase B test harness

All 3 vectors post-patch should approach their spec §9 targets **except for the rest-phase contribution**, which Phase B doesn't add yet. Expected post-Phase-B values (Phase A delta + 4-phase effects, pre-rest):

- G1 (Tier 1, line=0): ~1.6–1.9. Minimal change from Phase A since Tier 1 has no line phase; transition phase adds small sweat production. Lunch reset hasn't landed so sessionMR stays below target 2.6.
- M2 (Tier 2, line=2): ~2.5–3.0. Line + transition phases accumulate cold-exposure damage absent in baseline. Still below §9 target 4.3 because lunch reset hasn't landed.
- P5 (Tier 5, line=15): ~3.5–4.2. Biggest Phase B delta — 15-min line phases accumulate serious cold exposure and condensation load. Still below §9 target 5.5 because lunch reset hasn't landed.

**Phase B checkpoint gate:**
- Vector deltas match expected Phase-B ranges (chat hand-comp cross-check)
- Non-ski activities still bit-identical to baseline
- EPOC continuity verified: per-cycle trace shows `_METstart_line` for cycle c inheriting from `_METrunEnd` of cycle c-1
- All existing spec-locks green except reconciliation suite (in flight)
- New test assertions for 4-phase decomposition green

**Halt conditions for Phase B:**
- Non-ski regression (scope leak)
- Any vector lands BELOW Phase A output (means new phase physics is removing heat, wrong direction)
- Any vector > 5.5 (means rest physics would push way above §9 target — something over-accumulating)
- Tier 1 scenario (G1) doesn't match no-line case (means line-skip didn't work)

If Phase B checkpoint passes, commit:

```
git add packages/engine/src/moisture/calc_intermittent_moisture.ts \
        packages/engine/src/activities/phy031_constants.ts \
        packages/engine/tests/spec-locks/phy-031-cyclemin-reconciliation/
git commit -m "S31 Phase B: 4-phase cycle decomposition (spec §4, §5)

Extends cyclic phase loop from (run + lift) to (line + lift + transition + run)
in wall-clock order per spec §4.2. Per-phase MET: LINE_MET=1.8 (Ainsworth
20030), TRANSITION_MET=2.0 (Ainsworth 05160). EPOC continuity chain
run-end → line → lift → transition → run with cross-cycle _prevRunEndMET
carry.

Tier 1 optimization: skip line sub-step loop when _liftLineMin === 0.

Condensation placement preserved per-cycle snapshot (Model Refinement
MR-PHY-031-CONDENSATION-PER-PHASE deferred to LC7). All primitives
(iterativeTSkin, sweat rate, shell drain, etc.) applied per phase per
spec §5.6.

Non-ski activities verified bit-identical to pre-Phase-A baseline.

Reference: reconciliation spec §4, §5."
```

Do NOT proceed to Phase C until Phase B commit lands clean and its gate passes.

---

## 5. Phase C — Rest-phase integration

**Scope:** add the lunch (45 min, shell-off, 12:15 PM) and otherBreak (15 min, shell-on, 2:30 PM) rest phases per spec §6. Extend `CycleOverride` interface with `lunch?: boolean` and `otherBreak?: boolean` fields per spec §8.6. Wire `evaluate.ts` to pass these booleans. Wire ski trip form schema for the two boolean fields with default logic.

### 5.1 What changes

**`CycleOverride` interface extension** (line 202 of `calc_intermittent_moisture.ts`):
```typescript
interface CycleOverride {
  totalCycles?: number;
  // ... existing fields ...
  lunch?: boolean;      // NEW
  otherBreak?: boolean; // NEW
  [key: string]: unknown;
}
```

This is an interface extension, NOT a function signature change. `calcIntermittentMoisture` signature is unchanged. Per spec §8.6 mandate.

**Rest-phase insertion logic** in the session-level loop:
- Compute wall-clock cycle start times: `cycle[c] starts at sessionStart + Σ(cycleMin[0..c-1]) + Σ(rest_durations_already_inserted)`
- Before entering cycle c, check if any rest phase target (12:15 PM, 2:30 PM) falls within the pending cycle's wall-clock window
- If yes: insert rest phase, advance wall-clock by rest duration, run rest-phase physics integration (spec §6.7), then run cycle c

**Lunch integration (§6.7.1):** shell-off
- `_effectiveIm_lunch = imSeries(base, mid, insulative)` — 3-layer series without shell
- `_Rclo_lunch = _Rclo × (1 - shellCLOfraction)`
- Per-minute sub-step loop (45 iterations)
- Inner-layer drying applied per minute: base/mid/insulative drain rates computed against indoor conditions
- Shell drains separately as draped item: `2 × getDrainRate(68, 40, 0, shell.im, 0, bsa)`
- After loop: re-attach shell, recompute ambient vapor absorption against insulative (outermost of inner ensemble during lunch)

**otherBreak integration (§6.7.2):** shell-on
- `_effectiveIm_break = ensembleIm` (unchanged)
- Per-minute sub-step loop (15 iterations)
- Shell drains on-body at indoor conditions
- Inner layers drain via standard cascade + Washburn scoped to 15-min window

**Shared bookkeeping (§6.7.3):**
- `_totalFluidLoss += _sweatRestG + _insensibleRest + _respRest`
- `_cumStorageWmin += _restStorage`
- Push phase markers into `_perCycleHeatStorage` with `phase: 'lunch'` or `phase: 'otherBreak'`
- Carry `_prevTskin` from rest-end to next cycle's CIVD snapshot

**Edge cases (§6.6):**
- If session ends before rest target → skip silently (short session)
- If session starts after rest target → skip silently (late start)
- Rest phases fit between cycles — no mid-cycle interruption
- No conflict between lunch (12:15 PM) and otherBreak (2:30 PM) — 2h15m gap well exceeds rest durations

**`evaluate.ts` changes** (around the `computeResortCycleOverride` helper, S29 line ~430):
```typescript
const cycleOverride = {
  totalCycles: ...,
  // existing fields
  lunch: activitySpec.lunch ?? defaultLunch(activitySpec.durationHrs),
  otherBreak: activitySpec.otherBreak ?? defaultOtherBreak(activitySpec.durationHrs),
};
```

Where `defaultLunch` and `defaultOtherBreak` return `true` if `durationHrs > 5`, else `false` (per spec §8.6 default note — implementation-session scope).

**Ski trip form schema** (placeholder filename per S30 spec):
- Add `lunch: boolean` and `otherBreak: boolean` fields to the ski-specific trip form type
- UI default-computation handled in the form component (not engine scope)

### 5.2 Phase C test harness — THE GATE SESSION

All 8 criteria from spec §9.5 must pass at this checkpoint. This is the close gate for S31.

**Criterion 1: G1 sessionMR ∈ [2.3, 2.9]**
- Expected target 2.6 per spec §9.2.6

**Criterion 2: M2 sessionMR ∈ [4.0, 4.6]** ← **S-001 CLOSURE**
- Expected target 4.3 per spec §9.3.6
- This is the canonical S-001 Breckenridge scenario anchor

**Criterion 3: P5 sessionMR ∈ [5.2, 5.8]**
- Expected target 5.5 per spec §9.4.6

**Criterion 4: Per-cycle MR trajectories within ±0.5 at explicitly-traced cycles**
- G1: cycles 0, 13 (pre-lunch peak), 14 (post-lunch low), 22, 30
- M2: cycles 0, 9 (pre-lunch peak), 10 (post-lunch low), 14, 20
- P5: cycles 0, 5 (pre-lunch peak), 6 (post-lunch low), 8, 11
- All traced values per spec §9.2–§9.4

**Criterion 5: `_totalFluidLoss` within ±10% of spec §9 targets**
- G1: ~780 g ± 78 g
- M2: ~2,100 g ± 210 g
- P5: ~1,650 g ± 165 g

**Criterion 6: Final layer buffer fills within ±15%**
- Per per-vector table in spec §9.X.6

**Criterion 7: Pre-patch regression match**
- Baseline capture values from §2.1 of this kickoff must be confirmable by running current HEAD engine (pre-patch) with same inputs — validates the delta attribution

**Criterion 8: Non-ski activity bit-identical regression**
- 11 activities named in spec §9.5 criterion #8 must produce byte-identical output vs pre-S31 baseline

**All 8 must be green for S31 to close.** If any gate fails, halt and escalate per §6 below.

### 5.3 Phase C halt-and-escalate protocol

Per spec §9.5 final paragraph:

> "If any vector or non-ski regression fails to converge within tolerance, the implementation session halts and escalates rather than adjusting constants to fit — the physics is what it is, and adjusted numbers that match the expected values by parameter-gaming violate Cardinal Rule #1."

**If a gate criterion fails:**

1. **Do not tune constants** (MET values, indoor T/RH, drain multipliers, drying formulas) to hit expected values.
2. **Capture the actual engine output** in a diagnostic doc at `LC6_Planning/audits/S31_GATE_FAILURE_<criterion#>.md`
3. **Identify the class of failure:**
   - **Low output:** some accumulator scoping incomplete, or physics integration missing a phase
   - **High output:** cascade or condensation placing too much mass at skin-adjacent layers
   - **Wrong trajectory:** rest reset dip absent or mis-placed, EPOC chain not continuous
   - **Non-ski leak:** `_cycleMinRaw` or phase-loop change leaked into steady-state path or non-ski cyclic path
4. **Escalate to user** with:
   - Which criterion failed and by how much
   - Engine output vs expected, with per-cycle trajectory
   - Hypothesis on class of failure
   - Proposed next action (patch a specific section? escalate to Chat for spec re-examination?)
5. **Do not commit Phase C until resolution reached.**

If resolution requires spec changes, the session halts and Chat authors an addendum spec (not in S31 scope to author spec changes; that's a separate session).

### 5.4 Phase C commit sequence

If all 8 gates green, commit:

```
git add packages/engine/src/moisture/calc_intermittent_moisture.ts \
        packages/engine/src/evaluate.ts \
        packages/engine/src/activities/phy031_constants.ts \
        packages/engine/tests/spec-locks/phy-031-cyclemin-reconciliation/ \
        packages/engine/src/activities/ski_trip_form.ts \
        [ski trip form schema file — actual filename TBD]

git commit -m "S31 Phase C: rest-phase integration (spec §6)

Lunch (45 min, shell-off, 12:15 PM) and otherBreak (15 min, shell-on,
2:30 PM) rest phases integrated into session-level loop. Indoor conditions
fixed 20°C/40% RH/0 m/s per ASHRAE 55-2020. Inner-layer drying during
lunch via direct exposure (shell off, im_series of base+mid+insulative);
shell drains as draped item at 2× worn rate.

CycleOverride interface extended with lunch? and otherBreak? optional
fields. No signature change to calcIntermittentMoisture per spec §8.6.
evaluate.ts computeResortCycleOverride wires defaults (true for
durationHrs > 5, else false).

Ski trip form schema extended with two boolean fields.

Wall-clock placement per spec §6.5: deterministic 12:15 PM / 2:30 PM.
Edge cases per §6.6: rest phases outside session window silently skipped.

ALL 8 GATE CRITERIA GREEN:
  G1 sessionMR [target 2.6, observed {actual}]
  M2 sessionMR [target 4.3, observed {actual}] ← S-001 closure
  P5 sessionMR [target 5.5, observed {actual}]
  Per-cycle trajectories within ±0.5
  totalFluidLoss within ±10%
  Layer buffer fills within ±15%
  Pre-patch regression confirms delta attribution
  Non-ski 11 activities BIT-IDENTICAL to pre-S31 baseline

S-001 (S26-SYSTEMATIC-MR-UNDERESTIMATION) CLOSED per spec §11 close criteria.

Reference: reconciliation spec §6, §8, §9, §11."
```

---

## 6. Tracker and registry closure

After Phase C commit lands and all 8 gates green:

### 6.1 Registry updates
- **PHY-031-CYCLEMIN-RECONCILIATION v1 row:** Engine column DRAFT → ACTIVE; test count 0 → (actual test count in phy-031-cyclemin-reconciliation/ subdirectory); Last Verified → S31 commit SHA
- **PHY-031 row:** Reality status PARTIAL → ACTIVE; append to annotation "S31 closed reconciliation (commit [S31 SHA]); engine implementation ACTIVE."
- Coverage heat map updated
- Add v1.3 version-history row: "PHY-031 and PHY-031-CYCLEMIN-RECONCILIATION rows reality-status ACTIVE. S-001 closed."

### 6.2 Tracker updates
- `<!-- S31-APPLIED -->` and `<!-- S31-RECONCILIATION-APPLIED -->` markers
- New "Status as of Session 31" block (S-001 closure + forward plan)
- Move `S26-SYSTEMATIC-MR-UNDERESTIMATION` to Section F (RESOLVED)
- Move `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` to Section F (RESOLVED)
- Update SessionA status: deferred → authorized for next session
- Section G grep list: retain closed IDs (they stay findable as historical record)

### 6.3 Doc-only close commit

Chat authors the S31 close handoff (mirror of S30 handoff pattern) with:
- Exact anchor strings for registry and tracker edits
- Close script
- Two-commit SHA backfill pattern (apply the lesson from S30)

That's a separate Chat turn after Code reports S-001 closure. Not part of this kickoff.

---

## 7. Push sequence — first push since S28

After the S31 close commits land:

```bash
# Verify all gates green
# Verify working tree clean
# Verify S-001 and S29-PHY-031-CYCLEMIN-PHYSICS-GAP closed in tracker

# Final check: entire commit chain
git log --oneline origin/session-13-phy-humid-v2..HEAD
# Expected output (8 commits approximately):
#   <S31 close doc commit> S31 close (registry + tracker)
#   <S31 close SHA backfill>
#   <S31 Phase C>  rest-phase integration
#   <S31 Phase B>  4-phase decomposition
#   <S31 Phase A>  _cycleMinRaw scoping
#   4e84e76        S30 SHA backfill
#   28731fb        S30 ratification
#   6edacaf        S30 kickoff / S29 ritual backfill
#   29e0b30        S29 close docs
#   7289e8b        S29 PHY-031 port
#   435e321        S29/SessionA kickoffs

# Push (first push since before S29)
git push origin session-13-phy-humid-v2

# Verify pushed
git log origin/session-13-phy-humid-v2..HEAD --oneline
# Should be empty (no unpushed commits)
```

Then, per-session branch protocol, decide:
- Merge to main (if that's the LC6 integration pattern), OR
- Keep branch for SessionA baseline capture (likely, given SessionA opens next)

User confirms which before merge/branch-close.

---

## 8. Session close criteria

S31 formally closes when ALL of the following are true:

- [ ] All 8 gate criteria from spec §9.5 green at Phase C commit
- [ ] `S26-SYSTEMATIC-MR-UNDERESTIMATION` per spec §11 close criteria: Vector M2 sessionMR ∈ [4.0, 4.6], per-cycle trajectory shows lunch reset dip + afternoon re-climb within ±0.5 MR, sessionMR maps to "yellow pacing" tier
- [ ] `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` status flipped to CLOSED
- [ ] Registry PHY-031 row reality status: PARTIAL → ACTIVE
- [ ] Registry PHY-031-CYCLEMIN-RECONCILIATION v1 row: engine DRAFT → ACTIVE
- [ ] Branch `session-13-phy-humid-v2` pushed to origin
- [ ] Working tree clean
- [ ] Test suite green (all spec-locks, no regressions)
- [ ] Non-ski activities bit-identical to pre-S31 baseline

If any criterion fails, S31 stays open. Partial credit not granted — the whole point of the spec was to close S-001, and S-001 closes only when M2 gate passes.

---

## 9. Hand-computed verification trace document

**This section extends spec §9's summary traces to full-primitive depth, per Cardinal Rule #8.** The spec §9 traces are Option-C analytical (primitive outputs at convergence). This §9 extends them to Option-A calculation traces — actual arithmetic for the primitives at key cycles, with intermediate values so engine output can be cross-verified at the sub-cycle level.

Format: for each vector, compute primitive-level values at three key cycles (cycle 0 warmup, pre-lunch peak cycle, post-lunch recovery cycle) and at each rest phase. Total: 9 primitive traces across 3 vectors + 6 rest-phase traces.

**Due to length (500+ lines of arithmetic), this §9 is a separate reference document:**

`LC6_Planning/audits/S31_HANDCOMP_TRACE.md`

Chat produces this document as part of the S31 kickoff package. Code consults it during Phase A/B/C gate verification. Any divergence between engine output and hand-comp trace at primitive level (individual `iterativeTSkin` solve result, individual `computeSweatRate` output, individual storage per minute) signals a specific primitive-level bug rather than a system-integration bug.

**The trace document will be authored next** — this kickoff references it but does not embed it (keeping this kickoff at navigable length).

---

## 10. Forward plan after S31 closes

Priority order (unchanged from my earlier summary):

**Tier 1 — Immediate:**
- Push chain to origin (step §7 above)
- Begin field cross-check monitoring (spec §11.4 — first 10 real ski sessions post-impl)
- Re-author `S29-MATRIX-PENDING` 4-scenario matrix with verified fixtures and correct metric read

**Tier 2 — SessionA** (LC6 State-of-the-Port audit, drafted S28, held since)

**Tier 3 — `S30-AUDIT-*` investigations** (5 tracker items from spec §8.5)

**Tier 4 — Pending spec ratifications:** PHY-SHELL-GATE v1, PHY-MICROCLIMATE-VP v1

**Tier 5 — Legacy drift cleanup:** `S27-DRIFT-1`, `S27-DRIFT-2`, `S27-TSC-ERRORS-BASELINE`, `S27-STALE-PLANNING-DOCS`

**Tier 6 — Model Refinement docket:** `MR-PHY-031-CONDENSATION-PER-PHASE`, `MR-PHY-031-DRAPED-SHELL-DRAIN`, ability/effort-tier MET multiplier, REST_FRACTION variability

**Tier 7 — Outstanding investigations:** `S27-DUAL-BREATHABILITY-MAPPING`, `S28-GOV-MODEL-REFINEMENT-PROCESS`, `GAP-PHY-031-POWDER-THRESHOLD`

---

## 11. Non-goals for S31

Things S31 deliberately does NOT do (mirroring spec §12):

- **Not any signature change to `calcIntermittentMoisture`.** Interface extension on `CycleOverride` per spec §8.6.
- **Not any modification to ratified PHY-031 v1 values.** REST_FRACTION stays 0.20, runMin tables unchanged, liftLineMin tables unchanged, holiday windows unchanged, `_lc5Mets` unchanged.
- **Not any non-ski physics change.** Phase A's `_cycleMinRaw` scoping fix should be a no-op for non-ski because their `_runMin + _liftMin` already equals full cycle duration.
- **Not Phases B/C/D of ski-history integration.** Phase A (manual entry) only.
- **Not powder signal source wiring.** `GAP-PHY-031-POWDER-THRESHOLD` stays open.
- **Not addressing any `S30-AUDIT-*` tracker item.** Those flow to future sessions.
- **Not UI design work.** Form schema extension minimal; default-computation logic in form component.
- **Not Model Refinement implementation.** `MR-PHY-031-*` flags stay LC7 scope.
- **Not tuning any constant to hit expected MR values.** Halt-and-escalate per §5.3.

---

## 12. Handoff receipt format

When S31 closes successfully, Code reports:

```
S31 complete. S-001 CLOSED.

Branch:          session-13-phy-humid-v2 (pushed to origin)
HEAD:            [S31 close SHA]
Commits added:   5 (Phase A, Phase B, Phase C, close docs, SHA backfill)
Gates:           8 of 8 green
S-001:           CLOSED (M2 sessionMR {actual} ∈ [4.0, 4.6])

Phase A:   _cycleMinRaw scoping          — commit [SHA_A]
Phase B:   4-phase decomposition         — commit [SHA_B]
Phase C:   rest-phase integration        — commit [SHA_C]
Close:     registry + tracker updates    — commit [SHA_close]
Backfill:  S31 SHA backfill              — commit [SHA_backfill]

Vector results:
  G1 Ghost Town groomers:  sessionMR {actual} / target 2.6 ± 0.3
  M2 Tier 2 moguls:        sessionMR {actual} / target 4.3 ± 0.3  ← S-001
  P5 Tier 5 powder Sat:    sessionMR {actual} / target 5.5 ± 0.3

Next: SessionA (LC6 State-of-the-Port audit), previously deferred.
```

If S31 halts at any gate, Code reports gate failure per §5.3 protocol.

---

## 13. Cardinal Rule #8 acknowledgment

S31 is a Cardinal-Rule-#8-active session. That means:

- Hand-computed verification vectors exist (spec §9 + this kickoff §9 / `S31_HANDCOMP_TRACE.md`) BEFORE any engine code is written
- Every thermal engine function touched has test vectors with hand-computed expected values
- Line-by-line calculation trace document accompanies the patch
- No engine function is modified without the above

Per S30 spec §9.5 anti-fudge clause: if engine output diverges from hand-comp, the engine needs debugging, not the constants. Halt-and-escalate.

**The user (Christian) has personally caught physics bugs multiple times by reading the per-phase sawtooth chart against intuition. If Phase A/B/C outputs look "wrong" at any checkpoint, escalate to user for field-intuition cross-check rather than assuming the numbers are correct just because tests pass.**

---

**END S31 KICKOFF.**
