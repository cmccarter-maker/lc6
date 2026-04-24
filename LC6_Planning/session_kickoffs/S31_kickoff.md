# S31 Kickoff — Engine Implementation of PHY-031-CYCLEMIN-RECONCILIATION v1.1

**Session:** S31 (Code-led implementation session)
**Authored by:** Chat (original v1 on April 22–23, 2026; revised v1.1 during S31 pre-Phase-A, April 23, 2026)
**Parent spec:** `LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.2_RATIFIED.md` (v1.1 revision ratified S31 pre-Phase-A; v1.2 §9.5 narrowed S31 Phase A pre-commit)
**Branch:** `session-13-phy-humid-v2` (unpushed; continues local through S31)
**Expected start HEAD:** post-spec-v1.1-commit SHA (one commit past `617508a` baseline-capture commit)
**Cardinal Rule #8 active.** Highest-risk engine patch since PHY-068.

**Kickoff version history:**

| Version | Date | Session phase | Changes |
|---|---|---|---|
| v1 | 2026-04-23 AM | S31 kickoff authoring | Original. Referenced spec v1 §9 MR targets (G1 2.6 / M2 4.3 / P5 5.5) and §11 S-001 closure criterion tied to M2 ∈ [4.0, 4.6]. |
| v1.1 | 2026-04-23 PM | S31 pre-Phase-A, post probe | Revised after probe at HEAD `78cd56a` revealed spec v1 §9 synthesized targets non-credible. References spec v1.1 patch-correctness gates instead of MR-target gates. S-001 closure decoupled from S31 scope. Pre-Phase-A baselines captured: G1 2.50, M2 6.40, P5 4.10. |

---

## 0. Executive summary

S31 ports the physics authorized by PHY-031-CYCLEMIN-RECONCILIATION v1.1 into the thermal engine. The port touches the single-source-of-truth phase loop in `calc_intermittent_moisture.ts`. Cardinal Rule #8 requires patch-correctness verification to be designed before code is written — v1.1 §9 defines this as structural audit + non-ski bit-identical + trajectory shape + direction-of-change, rather than absolute MR targets.

Implementation is **progressive**, not all-at-once: three phases (A/B/C), each gated on its own checkpoints before advancing to the next. If Phase A regresses, Phase B never starts. If Phase B regresses, Phase C never starts.

**Session closes when:**
- All patch-correctness gates from spec v1.1 §9.4–§9.7 pass
- `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` flips HIGH → CLOSED
- S-001 tracker annotation updated per spec v1.1 §11.2 (S-001 stays open)
- Branch pushes to origin (first push since S28)

**Session does NOT close if:**
- Any structural audit item fails → halt, read code, no constant tuning
- Any non-ski activity regresses → halt, scope leakage
- Any trajectory shape gate fails → halt, physics didn't land as designed
- Any direction-of-change gate fails → halt, reconciliation affecting the wrong thing

**What S31 does NOT do:**
- Close S-001 (`S26-SYSTEMATIC-MR-UNDERESTIMATION`) — stays open per spec v1.1 §11
- Tune constants to hit specific MR values — explicitly prohibited
- Wire the `ventEvents` TODO at `evaluate.ts:487` — out of scope

Expected duration: 4–8 hours of Code work. Three natural break points between phases.

---

## 1. Pre-flight

Before any engine touch. This sequence runs as the first Code action and verifies the starting state matches kickoff assumptions.

```bash
cd ~/Desktop/LC6-local

# Branch check
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "session-13-phy-humid-v2" ]]; then
  echo "HALT: expected branch 'session-13-phy-humid-v2', on '$CURRENT_BRANCH'"
  exit 1
fi

# Working tree status (untracked probe test and some tooling is expected)
git status --short

# Spec v1.2 present (authored by Chat, committed by Code during this session)
SPEC="LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.2_RATIFIED.md"
if [[ ! -f "$SPEC" ]]; then
  echo "HALT: spec v1.2 missing at $SPEC. Author + commit before Phase A."
  exit 1
fi

# Engine file present and untouched (engine hash must still match pre-S31 baseline 4e84e76)
ENGINE="packages/engine/src/moisture/calc_intermittent_moisture.ts"
if [[ ! -f "$ENGINE" ]]; then
  echo "HALT: engine file missing at $ENGINE"
  exit 1
fi
ENGINE_AT_4E84E76=$(git show 4e84e76:"$ENGINE" | git hash-object --stdin)
ENGINE_AT_HEAD=$(git hash-object "$ENGINE")
if [[ "$ENGINE_AT_HEAD" != "$ENGINE_AT_4E84E76" ]]; then
  echo "HALT: engine file hash differs from pre-S31 baseline"
  exit 1
fi
echo "OK: engine file untouched since 4e84e76 baseline"

# Pre-Phase-A baselines file exists (from §2 capture, commit 617508a)
BASELINE="LC6_Planning/baselines/S31_PRE_PATCH_BASELINE.md"
if [[ ! -f "$BASELINE" ]]; then
  echo "HALT: pre-patch baseline doc missing at $BASELINE"
  exit 1
fi

# Existing test suite green
pnpm -F @lc6/engine test 2>&1 | tail -20
echo "Verify: 676 passed, 1 skipped (S29-MATRIX-PENDING skip), 0 failures"

echo ""
echo "Pre-flight PASSED. Ready for Phase A."
```

---

## 2. Pre-Phase-A baseline capture — STATUS: ALREADY DONE

Completed at commit `617508a`. Real-DB optimal_gear ensemble baselines captured via probe test at `packages/engine/tests/probes/s31_ensemble_probe.test.ts`. Observed values:

| Vector | optimal_gear sessionMR (HEAD `78cd56a`) | totalCLO | ensembleIm | Cycles |
|---|---|---|---|---|
| G1 | 2.50 | 4.42 | 0.254 | 31 |
| M2 | 6.40 | 4.42 | 0.254 | 21 |
| P5 | 4.10 | 4.42 | 0.254 | 12 |

**These are spec v1.1 §9.3 reference values, not gate targets.** Phase A/B/C outputs compared against these values in §9.7 direction-of-change gate (relative magnitudes, not absolute equality).

Non-ski baselines captured in the same commit — used by spec v1.2 §9.5 bit-identical regression gate (narrowed to sessionMR, perCycleMR, trapped, _cumStorageWmin, and final layer buffer fills; totalFluidLoss excluded — see spec v1.2 §9.5 footnote).

---

## 3. Phase A — `_cycleMinRaw` accumulator scoping

**Scope:** change the time-window for moisture buffer advancement from `_runMin + _liftMin` to `_cycleMinRaw` per spec v1.1 §4.6. Do **not** add new phases yet. Do **not** add rest handling yet.

**Why first:** §4.6 is "processes always on" — pure accounting correction, not physics change. Isolating it lets the Washburn / shell-drain / insensible / respiratory / ambient-vapor machinery verify under a slightly-longer time window before the 4-phase structural change lands.

### 3.1 What changes

In `calc_intermittent_moisture.ts`:

- Line 715: `const _cycleTotalMin = _runMin + _liftMin;` → `const _cycleTotalMin = _cycleMinRaw;` where `_cycleMinRaw` is a derived scalar introduced at the top of the phase-loop body. Before Phase B, `_cycleMinRaw === _runMin + _liftMin`.
- Line 725: `_insensibleG = 10 * (_runMin + _liftMin) / 60` → `_insensibleG = 10 * _cycleMinRaw / 60`
- Line 729: `_respRun.moistureGhr * (_runMin / 60)` → `_respRun.moistureGhr * (_cycleMinRaw / 60)` — user breathes during lift too (first real behavior change)
- Line 730: `_cycleMin = _runMin + _liftMin` → `_cycleMin = _cycleMinRaw`
- Line 756: update `_fabricInG` to use respiratory-inclusive value
- Line 933: `_cycleDurF = _runMin + _liftMin` → `_cycleDurF = _cycleMinRaw`

**Structural principle:** introduce `_cycleMinRaw` as a derived scalar. Pre-Phase-B, value equals `_runMin + _liftMin`. Shim prepares the name for 4-phase expansion in Phase B.

### 3.2 Phase A checkpoint gate

All three must verify:

1. **Structural audit (§9.4 subset):** grep confirms `_respRun.moistureGhr`, `_insensibleG`, `_fabricInG`, `_cycleTotalMin`, `_cycleMin`, `_cycleDurF` all scope to `_cycleMinRaw`. No rogue `_runMin + _liftMin` concatenations remain in moisture-accounting code paths.

2. **Non-ski regression (spec v1.2 §9.5 narrowed gate):** all 11 activities listed produce bit-identical `sessionMR`, `perCycleMR`, `trapped`, `_cumStorageWmin`, and final layer buffer fills (base, mid, insulative, shell) vs the `S31_PRE_PATCH_BASELINE.md` values. Any single divergence on a gated metric halts. `totalFluidLoss` is explicitly excluded from the bit-identical gate per spec v1.2 §9.5 (line 729 respiratory-scoping extension from `_runMin` to `_cycleMinRaw` shifts totalFluidLoss on cyclic 2-phase profiles — day_hike, backpacking, running, mountain_biking, trail_running, fishing_shore — in a physics-correct way that does not propagate to layer buffers).

3. **Ski direction sanity:** G1/M2/P5 post-Phase-A sessionMR values are logged. No absolute target, but sanity check: no vector changes by more than 20% of its baseline (Phase A alone is a small change; large swings indicate unintended effect).

### 3.3 Phase A halt conditions

- Non-ski regression (means `_cycleMinRaw` shim leaked into non-ski code)
- Any vector shifts by >20% (means `_cycleMinRaw` is computing something unintended)
- grep surfaces a lingering `_runMin + _liftMin` in moisture accounting

### 3.4 Phase A commit

If checkpoint passes:

```bash
git add packages/engine/src/moisture/calc_intermittent_moisture.ts
git commit -m "S31 Phase A: _cycleMinRaw accumulator scoping (spec v1.1 §4.6)

Processes-always-on accounting fix: Washburn wicking, shell drain,
insensible perspiration, respiratory moisture, ambient vapor absorption,
and precipitation wetting now scoped to _cycleMinRaw (wall-clock sum of
all cycle phases) instead of _runMin + _liftMin.

Pre-Phase-B, _cycleMinRaw === _runMin + _liftMin (no phases added yet),
so structural variable-name introduction only. Respiratory moisture
scaling extends to full cycle (user breathes during lift).

Non-ski activities verified bit-identical to pre-patch baseline.
G1/M2/P5 post-Phase-A sessionMR logged (not gated).

Reference: spec v1.1 §4.6."
```

Do NOT proceed to Phase B until this commit lands clean and checkpoint passes.

---

## 4. Phase B — 4-phase cycle decomposition

**Scope:** extend the cyclic phase loop from 2 phases (run + lift) to 4 phases (line + lift + transition + run) per spec v1.1 §4.2. Introduce per-phase MET, per-phase EPOC continuity chain, per-phase sub-stepping. Do NOT add rest handling yet.

### 4.1 What changes

**Declarations:**
- Introduce `_liftLineMin` from `cycleOverride.liftLineMin` or `phy031_constants.LIFT_LINE_MIN[tier]` (tier-based wait times exist from S29 port)
- `TRANSITION_MIN = 3` constant (S29 has this, verify)
- Per-phase MET constants:
  - `LINE_MET = 1.8` (Ainsworth 2011 Compendium code 20030 — lift line stationary standing)
  - `TRANSITION_MET = 2.0` (Ainsworth 2011 Compendium code 05160 — casual walking with equipment)
  - lift_MET = 1.5 (existing)
- `_cycleMinRaw = _liftLineMin + _liftMin + TRANSITION_MIN + _runMin`

**Phase loop body reorder:**

Current: run (lines 654–676), lift (lines 678–712), cycle aggregation (715–740)

New (wall-clock order line → lift → transition → run):
1. Line sub-stepped over `_liftLineMin` minutes [NEW]
2. Lift sub-stepped over `_liftMin` minutes [existing, EPOC seed changes]
3. Transition sub-stepped over `TRANSITION_MIN` minutes [NEW]
4. Run single-step over `_runMin` minutes [existing, otherwise unchanged]
5. 4-phase aggregation [changed from 2]

**EPOC continuity chain per spec v1.1 §4.3.1:**

- `_prevRunEndMET` — new cross-cycle state, stores run-end MET from each cycle
- line[c] seed (c > 0): EPOC decay from `_prevRunEndMET` with `tFromRunEnd = 0`
- line[0] seed: basal 1.5 MET (no EPOC, cycle 0 start)
- lift[c] seed: continues EPOC from line-end, tFromRunEnd = `_liftLineMin`
- transition[c] seed: continues EPOC from lift-end, MET target 2.0 overlaid
- run[c]: reseeds to `_METrun`, computes run-end MET for cross-cycle carry

**Per-phase physics:** each phase calls full primitive suite per spec v1.1 §5.6 (iterativeTSkin, computeMetabolicHeat, computeConvectiveHeatLoss, computeRadiativeHeatLoss, computeRespiratoryHeatLoss, computeEdiff, computeEmax, computeSweatRate, shiveringBoost).

**Tier 1 skip:** when `_liftLineMin === 0` (Tier 1 Ghost Town):
```typescript
let _sweatLineG = 0, _lineCondensG = 0, _lineExcessG = 0, _lineStorage = 0;
if (_liftLineMin > 0) {
  for (let mn = 0; mn < _liftLineMin; mn++) {
    // per-minute line integration
  }
}
```

**Condensation handling:** per-phase accumulation same pattern as lift (lines 705–708). Sum all four phases' condensation into `_cycleCondensG` for single-snapshot placement (§5.8 — per-phase placement is Model Refinement, not Phase B scope).

**Storage bookkeeping per spec v1.1 §5.9:** `_cycleTotalWmin = _lineStorage + _liftStorage + _transStorage + _runStorage`.

### 4.2 Phase B checkpoint gate

1. **Structural audit (§9.4 subset):** verify 4-phase loop is in declared order by code review. Verify per-phase MET constants match spec. Verify EPOC continuity: log `_METstart_line` for cycles 1, 5, 10 of each vector and confirm inheritance from `_prevRunEndMET`. Verify Tier 1 skip active for G1.

2. **Non-ski regression (spec v1.2 §9.5 narrowed gate):** gated metrics (`sessionMR`, `perCycleMR`, `trapped`, `_cumStorageWmin`, final layer buffer fills) still bit-identical vs pre-S31 baseline. Non-ski activities have no line or transition phase in `profiles.ts`, so 4-phase loop code path should never execute for them. `totalFluidLoss` stays offset by the Phase A respiratory extension and is not re-evaluated here.

3. **Ski trajectory shape (§9.6 subset):** per-cycle MR arrays for M2 and P5 show measurably higher values at matching cycle indices than G1's, because M2/P5 have non-zero line phases accumulating cold exposure. If G1 and M2/P5 trajectories are similar despite different line phase durations, Phase B didn't land.

### 4.3 Phase B halt conditions

- Non-ski regression
- G1 trajectory unchanged from Phase A (means line=0 path broken)
- M2 trajectory unchanged from Phase A (means line phase code path not executing)
- EPOC continuity broken (line-start MET not inheriting from prior cycle's run-end)

### 4.4 Phase B commit

```bash
git add packages/engine/src/moisture/calc_intermittent_moisture.ts \
        packages/engine/src/activities/phy031_constants.ts
git commit -m "S31 Phase B: 4-phase cycle decomposition (spec v1.1 §4, §5)

Extends cyclic phase loop from (run + lift) to (line + lift + transition + run)
in wall-clock order per spec v1.1 §4.2. Per-phase MET: LINE_MET=1.8 (Ainsworth
20030), TRANSITION_MET=2.0 (Ainsworth 05160). EPOC continuity chain
run-end → line → lift → transition → run with cross-cycle _prevRunEndMET
carry.

Tier 1 optimization: skip line sub-step loop when _liftLineMin === 0.

Condensation placement preserved per-cycle snapshot (Model Refinement
MR-PHY-031-CONDENSATION-PER-PHASE deferred to LC7). All primitives
(iterativeTSkin, sweat rate, shell drain, etc.) applied per phase per
spec v1.1 §5.6.

Non-ski activities verified bit-identical.
Trajectory shape confirms line-phase accumulation active for M2 and P5.

Reference: spec v1.1 §4, §5."
```

Do NOT proceed to Phase C until Phase B commit lands clean and checkpoint passes.

---

## 5. Phase C — Rest-phase integration

**Scope:** add lunch (45 min, shell-off, 12:15 PM) and otherBreak (15 min, shell-on, 2:30 PM) rest phases per spec v1.1 §6. Extend `CycleOverride` interface with `lunch?: boolean` and `otherBreak?: boolean` per spec v1.1 §8.6. Wire `evaluate.ts` to pass these booleans.

### 5.1 What changes

**`CycleOverride` interface extension** (line 202 of `calc_intermittent_moisture.ts`):
```typescript
interface CycleOverride {
  totalCycles?: number;
  // ... existing fields ...
  lunch?: boolean;      // NEW (spec v1.1 §8.6)
  otherBreak?: boolean; // NEW (spec v1.1 §8.6)
  [key: string]: unknown;
}
```

Interface extension, NOT function signature change. Per spec v1.1 §8.6.

**Rest-phase insertion logic** in session-level loop:
- Compute wall-clock cycle start times: `cycle[c] starts at sessionStart + Σ(cycleMin[0..c-1]) + Σ(rest_durations_inserted)`
- Before entering cycle c, check if any rest phase target (12:15 PM, 2:30 PM) falls within pending cycle's wall-clock window
- If yes: insert rest phase, advance wall-clock by rest duration, run rest-phase physics integration (§6.7), then run cycle c

**Lunch integration (§6.7.1):** shell-off
- `_effectiveIm_lunch = imSeries(base, mid, insulative)` — 3-layer series without shell
- `_Rclo_lunch = _Rclo × (1 - shellCLOfraction)`
- Per-minute sub-step loop (45 iterations)
- Inner-layer drying per minute against indoor conditions
- Shell drains separately as draped item: `2 × getDrainRate(68, 40, 0, shell.im, 0, bsa)`
- After loop: re-attach shell, recompute ambient vapor absorption against insulative

**otherBreak integration (§6.7.2):** shell-on
- `_effectiveIm_break = ensembleIm` (unchanged)
- Per-minute sub-step loop (15 iterations)
- Shell drains on-body at indoor conditions

**Shared bookkeeping (§6.7.3):**
- `_totalFluidLoss += _sweatRestG + _insensibleRest + _respRest`
- `_cumStorageWmin += _restStorage`
- Push phase markers into `_perCycleHeatStorage`
- Carry `_prevTskin` from rest-end to next cycle's CIVD snapshot

**Edge cases (§6.6):**
- Session ends before rest target → skip silently
- Session starts after rest target → skip silently
- Rest phases between cycles, no mid-cycle interruption
- No conflict between lunch 12:15 PM and otherBreak 2:30 PM (2h15m gap)

**`evaluate.ts` changes:**
```typescript
const cycleOverride = {
  totalCycles: ...,
  // existing fields
  lunch: activitySpec.lunch ?? defaultLunch(activitySpec.durationHrs),
  otherBreak: activitySpec.otherBreak ?? defaultOtherBreak(activitySpec.durationHrs),
};
```

Where `defaultLunch(hrs) = hrs > 5`, `defaultOtherBreak(hrs) = hrs > 5`.

**Ski trip form schema:** add `lunch: boolean` and `otherBreak: boolean` to ski-specific trip form type.

### 5.2 Phase C checkpoint — the close gate

All four spec v1.1 §9 gates must pass:

#### 9.4 Structural audit
Verify all 8 items by code review. Specifically for Phase C:
- `CycleOverride` interface has `lunch?` and `otherBreak?`
- No change to `calcIntermittentMoisture` signature
- Rest-phase integration fires at wall-clock 12:15 PM / 2:30 PM
- Default helpers in evaluate.ts return `true` for durationHrs > 5

#### 9.5 Non-ski bit-identical regression (spec v1.2 narrowed)
All 11 non-ski activities: bit-identical to pre-S31 baseline on the gated metrics — `sessionMR`, `perCycleMR`, `trapped`, `_cumStorageWmin`, and final layer buffer fills (base, mid, insulative, shell). `totalFluidLoss` is explicitly excluded per spec v1.2 §9.5 (see footnote there); the Phase A respiratory-scoping offset remains and does not re-appear here. Cycling, running, hiking, etc. have no lunch or otherBreak in their cyclic profiles — the new CycleOverride fields default to `undefined` and rest-phase code path should not execute.

#### 9.6 Per-cycle trajectory shape gates

1. Lunch reset dip visible in G1, M2, P5 per-cycle MR arrays (at approximately cycles 13, 9, 5 respectively)
2. Dip magnitude at least 0.5 MR below pre-lunch peak
3. Post-lunch re-climb occurs (cycles after lunch show renewed MR progression)
4. Line-phase accumulation visible in P5 (per-cycle MR > G1 at matching wall-clock times)
5. EPOC continuity in line-start MET (cycles 1, 5, 10)

#### 9.7 Direction-of-change gates

Compare post-patch G1/M2/P5 sessionMR to §9.3 pre-Phase-A baselines (2.50, 6.40, 4.10):

1. `|ΔP5| > |ΔG1|` — P5 has 15-min line phase, G1 has 0-min; reconciliation compounds more in P5
2. `|ΔG1| < 1.0 MR` — G1 is Tier 1 minimal-change; large swing indicates something unintended
3. At least one vector has `|Δ| > 0.1 MR` — confirms reconciliation physics integrated

### 5.3 Phase C halt-and-escalate protocol

Per spec v1.1 §9.9:

**If any gate fails:**
1. **Do not tune constants** (MET values, indoor T/RH, drain multipliers)
2. **Capture diagnostic** at `LC6_Planning/audits/S31_GATE_FAILURE_<item>.md`
3. **Identify failure class:**
   - Structural: patch didn't land — read code, find mistake
   - Non-ski leak: scope leakage — find where ski code path touched non-ski execution
   - Shape: physics integration wrong — per-phase output unexpected
   - Direction: magnitudes or ordering wrong — reconciliation affecting something unintended
4. **Escalate to user** with:
   - Which gate failed
   - Engine output vs expected pattern
   - Hypothesis on class of failure
   - Proposed next action
5. **Do not commit Phase C** until resolution reached

### 5.4 Phase C commit — successful close

If all gates green:

```bash
git add packages/engine/src/moisture/calc_intermittent_moisture.ts \
        packages/engine/src/evaluate.ts \
        packages/engine/src/activities/phy031_constants.ts \
        [ski trip form schema file]

git commit -m "S31 Phase C: rest-phase integration (spec v1.1 §6)

Lunch (45 min, shell-off, 12:15 PM) and otherBreak (15 min, shell-on,
2:30 PM) rest phases integrated into session-level loop. Indoor conditions
fixed 20°C/40% RH/0 m/s per ASHRAE 55-2020. Inner-layer drying during
lunch via direct exposure (shell off, im_series of base+mid+insulative);
shell drains as draped item at 2× worn rate.

CycleOverride interface extended with lunch? and otherBreak? optional
fields. No signature change to calcIntermittentMoisture per spec v1.1 §8.6.
evaluate.ts computeResortCycleOverride wires defaults (true for
durationHrs > 5).

Ski trip form schema extended.

Wall-clock placement per spec v1.1 §6.5: deterministic 12:15 PM / 2:30 PM.
Edge cases per §6.6: rest phases outside session window silently skipped.

ALL PATCH-CORRECTNESS GATES GREEN:
  §9.4 Structural audit: 8/8 items verified
  §9.5 Non-ski bit-identical: 11/11 activities unchanged
  §9.6 Trajectory shape: lunch dip, re-climb, line accumulation, EPOC all present
  §9.7 Direction-of-change: |ΔP5| > |ΔG1|, |ΔG1| < 1.0, ≥1 vector changed

Post-patch reference values logged to S31_POST_PATCH_BASELINE.md.

S-001 (S26-SYSTEMATIC-MR-UNDERESTIMATION) annotation updated per spec
v1.1 §11.2. S-001 remains open pending broader MR-fidelity work docket.

S29-PHY-031-CYCLEMIN-PHYSICS-GAP CLOSED per spec v1.1 §11.3.

Reference: spec v1.1 §6, §8, §9, §11."
```

---

## 6. Post-Phase-C: reference value logging + tracker closure

After Phase C commit lands:

### 6.1 Log post-patch baselines

Create `LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md`:

```markdown
# S31 Post-Patch Baseline (spec v1.1 §9.8)

**Engine HEAD:** [Phase C commit SHA]
**Captured:** [timestamp]
**Purpose:** Reference values for future MR-fidelity work. NOT S31 gate targets.

## Ski vectors (optimal_gear pill)

| Vector | Pre-Phase-A sessionMR | Post-patch sessionMR | Δ |
|---|---|---|---|
| G1 | 2.50 | [observed] | [computed] |
| M2 | 6.40 | [observed] | [computed] |
| P5 | 4.10 | [observed] | [computed] |

## Per-cycle trajectories

[Full perCycleMR array for each vector]

## Layer buffer final fills

[base, mid, insulative, shell per vector]

## Fluid loss and storage

[totalFluidLoss, cumStorageWmin per vector]

## Non-ski regression reference

All 11 activities unchanged from pre-patch. See S31_PRE_PATCH_BASELINE.md.
```

### 6.2 Registry updates

- **PHY-031-CYCLEMIN-RECONCILIATION v1.1 row:** Engine column DRAFT → ACTIVE; Last Verified → S31 Phase C commit SHA
- **PHY-031 row:** Reality status PARTIAL → ACTIVE; annotate "S31 landed reconciliation physics (commit [SHA]); engine ACTIVE"
- Add v1.3 version-history row: "PHY-031 + PHY-031-CYCLEMIN-RECONCILIATION v1.1 reality-status ACTIVE. S-001 remains open per spec v1.1 §11."

### 6.3 Tracker updates

- `<!-- S31-APPLIED -->` marker
- New "Status as of Session 31" block
- Move `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` to Section F (RESOLVED)
- Update `S-001` annotation per spec v1.1 §11.2 (stays open, annotation updated)
- Update SessionA status: deferred → authorized for next session
- Add new tracker items:
  - `MR-CRITICAL-MOMENTS-BUDGET-TIGHTER` (Model Refinement, surfaced S31)
  - `S31-OBSERVATION-WINNER-INVARIANCE` (strategy engine question, surfaced S31)

### 6.4 Doc-only close commit

Chat authors S31 close handoff (mirror of S30 pattern) with:
- Exact anchor strings for registry and tracker edits
- Close script
- Two-commit SHA backfill pattern (lesson from S30)

Separate Chat turn after Phase C commits. Not part of this kickoff.

---

## 7. Push sequence — first push since S28

After S31 close commits land:

```bash
# Verify all patch-correctness gates green
# Verify working tree clean
# Verify S29-PHY-031-CYCLEMIN-PHYSICS-GAP closed, S-001 annotation updated

# Final check: commit chain
git log --oneline origin/session-13-phy-humid-v2..HEAD

# Push
git push origin session-13-phy-humid-v2
```

Post-push: per-session branch protocol decides merge or keep-branch.

---

## 8. Session close criteria

S31 formally closes when ALL of the following are true:

- [ ] Spec v1.1 authored and committed (then amended to v1.2 pre-Phase-A-commit to narrow §9.5)
- [ ] Phase A commit landed with structural audit pass + non-ski bit-identical on spec v1.2 §9.5 gated metrics
- [ ] Phase B commit landed with structural audit pass + non-ski bit-identical on spec v1.2 §9.5 gated metrics + shape gate for line-phase accumulation
- [ ] Phase C commit landed with ALL §9.4–§9.7 gates pass
- [ ] `S31_POST_PATCH_BASELINE.md` authored with post-patch reference values
- [ ] `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` status flipped to CLOSED
- [ ] `S-001` tracker annotation updated per spec v1.1 §11.2 (stays open)
- [ ] Registry PHY-031 row reality status: PARTIAL → ACTIVE
- [ ] Registry PHY-031-CYCLEMIN-RECONCILIATION v1.1 row: engine DRAFT → ACTIVE
- [ ] New tracker items added: `MR-CRITICAL-MOMENTS-BUDGET-TIGHTER`, `S31-OBSERVATION-WINNER-INVARIANCE`
- [ ] Branch `session-13-phy-humid-v2` pushed to origin
- [ ] Working tree clean
- [ ] Test suite green (676 passed, 1 skipped, 0 failed)

If any criterion fails, S31 stays open. **S-001 closure is NOT a criterion** — that's explicitly out of scope per spec v1.1 §11.

---

## 9. Forward plan after S31 closes

Priority order:

**Tier 1 — Immediate:**
- Push chain to origin (§7)
- Begin field cross-check monitoring (spec v1.1 §11.5 — first 10 real ski sessions post-impl)
- Re-author `S29-MATRIX-PENDING` with verified fixtures + S31 post-patch reference values
- MR-fidelity work arc toward actual S-001 closure (requires resolution of ongoing open bugs; consult `LC6_Master_Tracking.md`)

**Tier 2 — SessionA** (LC6 State-of-the-Port audit, drafted S28, held since)

**Tier 3 — `S30-AUDIT-*` investigations** (5 tracker items from S30 §8.5)

**Tier 4 — Pending spec ratifications:** PHY-SHELL-GATE v1, PHY-MICROCLIMATE-VP v1

**Tier 5 — New tracker items surfaced in S31:**
- `MR-CRITICAL-MOMENTS-BUDGET-TIGHTER` — CM/window budget refinement, post-precognition-pacing closure
- `S31-OBSERVATION-WINNER-INVARIANCE` — strategy engine scenario-sensitivity investigation

**Tier 6 — Model Refinement docket:** LC7 scope items per spec v1.1 §10.2

---

## 10. Non-goals for S31

Things S31 deliberately does NOT do (mirror spec v1.1 §12):

- **NOT close S-001.** Explicit. Per spec v1.1 §11. S-001 stays open with updated annotation.
- **NOT any signature change to `calcIntermittentMoisture`.** Interface extension only.
- **NOT any modification to ratified PHY-031 v1 values.** REST_FRACTION=0.20 stays, runMin tables stay, etc.
- **NOT any non-ski physics change.** §9.5 bit-identical gate enforces.
- **NOT Phases B/C/D of ski-history integration.** Phase A only.
- **NOT powder signal source wiring.**
- **NOT address any `S30-AUDIT-*` item.**
- **NOT UI design work.** Schema extension minimal.
- **NOT Model Refinement implementation.**
- **NOT tune any constant to hit specific MR values.** Halt-and-escalate per §9.9.
- **NOT wire `ventEvents` TODO at evaluate.ts:487.** Pacing loop stays stubbed.
- **NOT verify absolute MR values as gate criteria.** Spec v1.1 §9 is patch-correctness-based.

---

## 11. Handoff receipt format

When S31 closes successfully, Code reports:

```
S31 complete. Reconciliation physics landed per spec v1.1.

Branch:          session-13-phy-humid-v2 (pushed to origin)
HEAD:            [S31 close SHA]
Commits added:   5 (spec v1.1, Phase A, Phase B, Phase C, close docs)
Gates:           §9.4 structural (8/8), §9.5 non-ski (11/11 bit-identical),
                 §9.6 trajectory shape (4/4), §9.7 direction-of-change (3/3)

Phase A:   _cycleMinRaw scoping          — commit [SHA_A]
Phase B:   4-phase decomposition         — commit [SHA_B]
Phase C:   rest-phase integration        — commit [SHA_C]
Close:     registry + tracker updates    — commit [SHA_close]

Reference values (non-gating):
  G1: pre 2.50  → post [actual]  (Δ [computed])
  M2: pre 6.40  → post [actual]  (Δ [computed])
  P5: pre 4.10  → post [actual]  (Δ [computed])

S29-PHY-031-CYCLEMIN-PHYSICS-GAP:  CLOSED
S-001 (S26-SYSTEMATIC-MR-UNDERESTIMATION):  OPEN (per spec v1.1 §11)
                                            annotation updated
New tracker items added:
  MR-CRITICAL-MOMENTS-BUDGET-TIGHTER
  S31-OBSERVATION-WINNER-INVARIANCE

Next: SessionA (LC6 State-of-the-Port audit) + MR-fidelity work arc.
```

If S31 halts at any gate, Code reports gate failure per §5.3 protocol.

---

## 12. Cardinal Rule #8 acknowledgment

S31 is a Cardinal-Rule-#8-active session. Modified for v1.1 framing:

- **Patch-correctness verification designed before code written.** Spec v1.1 §9.4–§9.7.
- **Non-ski bit-identical regression** (§9.5) is a hard physics invariant; verifiable by byte comparison.
- **Shape and direction gates** (§9.6–§9.7) verify the physics integrated correctly without requiring trusted MR reference values.
- **Reference-value logging** (§9.8) records post-patch state for future fidelity work; NOT a gate.

Per spec v1.1 §9.9 anti-fudge clause: if any gate fails, the engine needs debugging, not the constants. Halt-and-escalate.

**The user (Christian) reads per-phase sawtooth charts against field intuition. If post-patch outputs look "wrong" at any checkpoint even when gates pass, escalate for field-intuition cross-check rather than assuming the numbers are correct just because tests pass.**

---

**END S31 KICKOFF v1.1.**
