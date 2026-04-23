# PHY-031-CYCLEMIN-RECONCILIATION v1.1 — §9 and §11 Revision

**This document is the authoritative source for §9 and §11 of PHY-031-CYCLEMIN-RECONCILIATION starting at v1.1.** Apply these replacements to `PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md` via the patch-application instructions at the end of this document. The resulting file is `PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.1_RATIFIED.md`.

---

## Changelog entry (to be inserted at spec top)

```
## Version history

| Version | Date | Session | Changes |
|---|---|---|---|
| v1 RATIFIED | 2026-04-22 | S30 | Original ratification. Hand-authored §9 verification vectors with synthesized gear values produced MR targets (G1 2.6, M2 4.3, P5 5.5) that were not DB-backed. §11 closure criterion for S-001 anchored to synthesized M2 target 4.3. |
| v1.1 RATIFIED | 2026-04-23 | S31 (pre-Phase-A) | §9 re-authored as patch-correctness gate. §11 restructured: S31 lands reconciliation physics but does NOT close S-001. Removed: MR-target gate criteria anchored to synthesized or current-engine values. Added: structural audit gate, non-ski bit-identical regression (retained), per-cycle shape gates, direction-of-change gate, reference-value logging (non-gating). Rationale: current-engine MR values are not trusted references given open bug docket; closure criteria tied to patch correctness rather than absolute MR values. Preserves Cardinal Rule #1 by refusing to calibrate against values of unverified provenance. |
```

---

## Replacement for §9 (replaces lines 982–1463 of v1)

```
## 9. Implementation gate criteria (patch-correctness-based)

### 9.1 Purpose and framing

The S30 draft of this section authored numeric sessionMR targets (G1 2.6, M2 4.3, P5 5.5) derived from analytical hand-comp against a synthesized gear ensemble. During S31 pre-Phase-A baseline capture, two problems surfaced:

1. **Gear ensemble problem.** The §9.2 gear specification hand-typed per-layer CLO/im/cap values rather than binding to real gear-DB entries. Observed engine output against real DB ensembles (strategy-engine-selected optimal_gear) produced sessionMR values far outside the synthesized targets.

2. **Reference-value problem.** Even with real gear, "current engine output" is not a trusted physics reference. LC6 has multiple open tracker items affecting MR (ongoing fidelity work tracked in `LC6_Master_Tracking.md`). Anchoring closure criteria to observed current-engine values implicitly calibrates new gates to an unverified physics stack — the same pattern S15 flagged as "calibrating to ghosts."

This revision decouples the implementation-session gate from absolute sessionMR values. The gate tests whether the **patch itself** is correct — whether the 4-phase loop landed, whether rest phases integrate at wall-clock, whether non-ski activities are untouched, whether the per-cycle trajectory shape matches expectation. Absolute MR values are recorded as reference points for future work, not as pass/fail conditions.

This is an honest scope given LC6's current physics-fidelity state. S31 ships the reconciliation cleanly; broader MR-trustworthiness is a multi-session arc.

### 9.2 Verification ensembles

Three vectors defined by ambient conditions + terrain (unchanged from v1):

**Vector G1 (Ghost Town groomers):** 16°F (-8.9°C), 30% RH, 5 mph wind, no precip, 9,600 ft, dewPointC -12, Tier 1 crowd, Tuesday 2026-11-10, snowboarding moguls=false groomers=true, 8.5-hr session, lunch=true, otherBreak=true.

**Vector M2 (Tier 2 moguls):** 20°F (-6.7°C), 45% RH, 8 mph wind, no precip, 9,600 ft, dewPointC -8, Tier 2 crowd, mid-week 2026-02-03, snowboarding moguls, 8.5-hr session, lunch=true, otherBreak=true.

**Vector P5 (Tier 5 powder Saturday):** 18°F (-7.8°C), 80% RH, 3 mph wind, precip probability 0.70 (ongoing snow), 9,600 ft, dewPointC -9, Tier 5 crowd (Saturday + powder bump), 2026-02-07, snowboarding moguls, 8.5-hr session, lunch=true, otherBreak=true.

**Ensemble sourcing (revised):** all three vectors run against the ensemble returned by `four_pill.optimal_gear` from `evaluate()` at the current HEAD. This is a real-DB-backed ensemble selected by the strategy engine, reproducible by invocation. No hand-typed per-layer values. The specific product IDs selected by the strategy engine may drift as the strategy engine evolves; this spec does not pin product IDs — it pins the invocation ("use whatever optimal_gear the strategy engine selects at run time").

Biometrics (unchanged): male, 170 lb, 77.1 kg, BSA 1.92 m², body fat 18%, VO2max 48.

### 9.3 Pre-Phase-A baselines (reference values, non-gating)

Captured at HEAD `78cd56a` (S29-followup state, pre-S31 engine changes) by the probe test at `packages/engine/tests/probes/s31_ensemble_probe.test.ts`:

| Vector | optimal_gear sessionMR | Ensemble totalCLO | Ensemble im |
|---|---|---|---|
| G1 | 2.50 | 4.42 | 0.254 |
| M2 | 6.40 | 4.42 | 0.254 |
| P5 | 4.10 | 4.42 | 0.254 |

**These values are reference points for future work, not S31 gate targets.** Their primary purpose is delta attribution: once S31 lands, engine output at new HEAD is compared to these baselines to confirm the patch produced change in the expected direction and relative magnitude (see §9.6).

Note: strategy engine selected `candidate-5` as optimal winner for all three vectors in the probe. Winner-selection scenario-sensitivity is flagged for post-S31 investigation (tracker item `S31-OBSERVATION-WINNER-INVARIANCE`) but does not block S31.

### 9.4 Implementation-session gate: structural audit

The patch is structurally correct when all of the following are verifiable by code review against `calc_intermittent_moisture.ts`:

1. **4-phase cycle loop lands in declared order** (line → lift → transition → run), per spec §4.2. Verified by reading the phase-loop body of `calc_intermittent_moisture.ts` and confirming the four phases appear in wall-clock order.

2. **Per-phase MET values match spec §5.2.** Line uses LINE_MET=1.8 (Ainsworth 20030), transition uses TRANSITION_MET=2.0 (Ainsworth 05160), lift uses existing `_METlift`=1.5, run uses `_cycleMET` from `_lc5Mets`. Constants appear in `phy031_constants.ts` (or inlined with citation).

3. **EPOC continuity chain connects phases.** Cross-phase state variable `_prevRunEndMET` carries from run-end of cycle `c-1` into line-start of cycle `c`. Within cycle `c`, each phase's EPOC seed inherits from the prior phase's end MET. Verified by reading the EPOC computation at each phase boundary.

4. **Tier 1 line-phase skip is present.** When `_liftLineMin === 0`, the line sub-step loop is skipped entirely (not iterated with zero iterations — actually skipped for efficiency and for verification that Tier 1 behavior is unchanged except via other reconciliation effects).

5. **`_cycleMinRaw` accumulator scoping correct.** Verify by grep that `_respRun.moistureGhr`, insensible perspiration, Washburn wicking, shell drain, ambient vapor absorption, and precipitation wetting all scope to `_cycleMinRaw`, not `_runMin + _liftMin`. Per spec §4.6.

6. **Rest-phase integration inserted at wall-clock.** When `cycleOverride.lunch === true` and session duration crosses 12:15 PM: lunch rest (45 min, shell-off, `im_series` of base+mid+insulative=0.18, `Rclo_shellOff`=0.380, indoor 20°C/40%/0 m/s per ASHRAE 55) fires between the appropriate cycles. Same for `cycleOverride.otherBreak === true` at 2:30 PM (15 min, shell-on, existing ensembleIm, 15-min shorter window).

7. **CycleOverride interface extension.** `lunch?: boolean` and `otherBreak?: boolean` fields appear on the `CycleOverride` interface at `calc_intermittent_moisture.ts:202-214`. No change to the `calcIntermittentMoisture` function signature (Cardinal Rule #8 preservation).

8. **evaluate.ts wiring.** `evaluate.ts:computeResortCycleOverride` passes the two booleans through. Default values computed via a helper — `true` when `durationHrs > 5`, else `false`.

**Gate criterion:** all 8 structural items verified by code review. Any missing item halts.

### 9.5 Implementation-session gate: non-ski regression (retained from v1)

For each of the 11 activities listed below, the patch must produce **bit-identical output** vs pre-patch baseline at HEAD `78cd56a`:

`day_hike`, `backpacking`, `running`, `mountain_biking`, `trail_running`, `bouldering`, `camping`, `fishing`, `kayaking_lake`, `cycling_road_flat`, `snowshoeing`.

For each activity, bit-identical means `sessionMR`, `totalFluidLoss`, `_cumStorageWmin`, and final layer buffer fills (base, mid, insulative, shell) are equal to the pre-patch baseline captured in `S31_PRE_PATCH_BASELINE.md` to full floating-point precision.

**Rationale:** the `_cycleMinRaw` scoping correction is a no-op for these activities (their `_runMin + _liftMin` already equals full cycle duration, having no line or transition phase). Any observed divergence indicates the patch leaked into code paths outside the ski cyclic loop and must halt for investigation.

**Gate criterion:** all 11 activities bit-identical. Any single byte-level divergence halts.

### 9.6 Implementation-session gate: per-cycle trajectory shape

Post-patch engine output for G1/M2/P5 is checked for expected *shape patterns* rather than absolute MR values:

1. **Lunch reset dip is visible.** Per-cycle MR array shows a downward dip at the cycle where lunch fires (approximately cycle 13 G1, cycle 9 M2, cycle 5 P5, depending on exact wall-clock timing per §6.5). Dip magnitude is at least 0.5 MR below the pre-lunch peak — confirms lunch integration fires and impacts state.

2. **Post-lunch re-climb occurs.** Cycles after lunch show a renewed climb in MR — confirms state integration continued after the rest phase rather than ending the trajectory early.

3. **Line-phase accumulation visible in P5.** P5's per-cycle MR trajectory shows measurably higher per-cycle MR than G1's at equivalent cycle indices (or equivalent wall-clock times if cycle counts differ) — confirms the 15-min line phase adds cold-exposure load that G1 (line=0) does not experience.

4. **EPOC continuity present.** First-minute MET in each cycle's line phase (cycles c>0) exceeds the line baseline 1.8 MET, showing EPOC inheritance from prior run. Verified by logging `_METstart_line` for cycles 1, 5, 10 of each vector.

**Gate criterion:** all 4 shape patterns observed. Missing any indicates reconciliation physics didn't land as designed.

### 9.7 Implementation-session gate: direction-of-change

Post-patch sessionMR compared to §9.3 pre-Phase-A baselines:

1. **P5 changes more than G1 in absolute magnitude.** Because P5 has a 15-min line phase and G1 has 0-min line phase, reconciliation effects compound more in P5. `|ΔP5| > |ΔG1|` is the physics-required ordering.

2. **G1 direction is modest (|ΔG1| < 1.0 MR).** G1 is Tier 1, line=0, minimal new cold-exposure accumulation. Dominant effects are small (`_cycleMinRaw` respiratory scaling, insensible scope extension, lunch reset). Large G1 delta signals something unintended.

3. **At least one vector moves.** If sessionMR is unchanged across all three vectors, the reconciliation physics did not meaningfully integrate. Halt.

**Gate criterion:** all 3 direction constraints satisfied. This is a coarse gate — it does NOT require specific MR values, only that the shape of change matches physics expectation.

### 9.8 Reference-value logging (non-gating)

After all four gates (§9.4, §9.5, §9.6, §9.7) pass, the following values are captured to `LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md` as reference points for future work:

| Vector | Pre-Phase-A sessionMR | Post-patch sessionMR | Δ |
|---|---|---|---|
| G1 | 2.50 | [captured] | [computed] |
| M2 | 6.40 | [captured] | [computed] |
| P5 | 4.10 | [captured] | [computed] |

Plus full `perCycleMR` arrays, final layer buffer fills, `_totalFluidLoss`, `_cumStorageWmin` for each vector.

**These values are NOT gate criteria.** They are reference points for:

- Comparing against future MR-fidelity work as other open bugs resolve
- Detecting regressions in subsequent sessions that inadvertently re-touch the reconciled code
- Feeding the `S29-MATRIX-PENDING` re-author session with verified post-S31 observed values

### 9.9 Halt-and-escalate protocol (unchanged philosophy, revised triggers)

The implementation session halts and escalates rather than tuning constants when:

- Any §9.4 structural audit item is missing or incorrect
- Any §9.5 non-ski activity diverges bit-identically
- Any §9.6 shape pattern is absent post-patch
- Any §9.7 direction-of-change constraint is violated

The physics is what it is. The patch either landed or it didn't. If it didn't, the fix is to read the code and find the mistake — not adjust per-phase MET, not retune EPOC parameters, not scale constants to hit target values. Per Cardinal Rule #1.
```

---

## Replacement for §11 (replaces lines 1511–1540 of v1)

```
## 11. S-001 tracker annotation

### 11.1 S-001 status after S31

`S26-SYSTEMATIC-MR-UNDERESTIMATION` (tracker alias S-001) is the longest-standing open HIGH tracker item in LC6. It was opened when user field reports indicated perceived moisture-risk readings felt "consistently too low." S27 traced the root cause partially to PHY-031 port incompleteness. S28 authored the PHY-031 spec. S29 ported the calendar/tier/cycle-count infrastructure. S30 authored this spec to close the remaining physics gap: the engine was simulating only run+lift duration per cycle, ghosting the rest of wall-clock time.

**S31 lands the reconciliation physics authorized by this spec (§4–§6). S31 does NOT close S-001.**

The original §11 (v1) tied S-001 closure to specific M2 sessionMR values anchored to synthesized gear. Revisions to §9 for v1.1 acknowledged that absolute MR targets cannot be credibly authored against the current engine state, because current MR values themselves are affected by ongoing physics-fidelity work beyond just the cycleMin reconciliation gap. Closing S-001 against a specific MR value would calibrate closure to an unverified physics stack.

### 11.2 Updated S-001 tracker annotation

Post-S31, the S-001 tracker entry in `LC6_Master_Tracking.md` carries the following annotation:

> **S-001 status as of S31:** PHY-031-CYCLEMIN-RECONCILIATION v1.1 physics landed (S31 commit [SHA], branch session-13-phy-humid-v2). Per-cycle physics now integrates line + lift + transition + run phases with rest-phase (lunch, otherBreak) integration at wall-clock. `_cycleMinRaw` accumulator scoping corrected. Non-ski activities bit-identical regression verified. Per-cycle trajectory shape gates passed.
>
> **S-001 remains open pending broader MR-fidelity work.** Reconciliation addresses the phase-loop ghosting identified in S29-PHY-031-CYCLEMIN-PHYSICS-GAP but does not independently validate that post-reconciliation MR values represent trusted physics. Full closure requires resolution of ongoing physics-fidelity tracker items (consult `LC6_Master_Tracking.md` for current docket) and field cross-checks against user experience.

### 11.3 What S31 closure DOES close

- `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` (status HIGH → CLOSED: reconciliation physics landed)
- PHY-031 registry row reality-status: PARTIAL → ACTIVE
- PHY-031-CYCLEMIN-RECONCILIATION v1.1 registry row engine column: DRAFT → ACTIVE
- Phase-loop scope-expansion risk at line 487 (ventEvents passed as null): not addressed by S31, stays TODO for separate future session per the explicit S31 non-goal

### 11.4 What S31 closure does NOT close

- **S-001** (`S26-SYSTEMATIC-MR-UNDERESTIMATION`): stays open with annotation above
- `S29-MATRIX-PENDING` re-author: post-S31, with verified fixtures + observed values from §9.8 reference log
- `S30-AUDIT-*` tracker items (5 audit-queries): flow to future sessions
- `MR-PHY-031-CONDENSATION-PER-PHASE`, `MR-PHY-031-DRAPED-SHELL-DRAIN`: LC7 Model Refinement
- `MR-CRITICAL-MOMENTS-BUDGET-TIGHTER` (new, S31-sourced): 3-5 strategy windows / ≤3 CMs may need tightening; revisit after precognition/pacing loop closes
- `S31-OBSERVATION-WINNER-INVARIANCE` (new, S31-sourced): strategy engine selects same optimal winner across G1/M2/P5 despite different ambient; investigate post-S31

### 11.5 Post-S31 field cross-check protocol

Even without S-001 closure, post-S31 engine output should be cross-checked against user field experience for the first 10 real-world ski sessions. Systematic over- or under-estimation on specific scenario classes become new tracker items informing the broader MR-fidelity work, not re-openers of S29-PHY-031-CYCLEMIN-PHYSICS-GAP (which IS closed by S31).
```

---

## Patch-application instructions

```bash
cd ~/Desktop/LC6-local

# 1. Copy v1 as v1.1 base
cp LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md \
   LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.1_RATIFIED.md

# 2. Remove v1 file (superseded)
git rm LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md

# 3. In the v1.1 file:
#    - Update header: "Version: v1 RATIFIED" → "Version: v1.1 RATIFIED"
#    - Add "## Version history" table near top (after §0 Conventions) with the changelog entry above
#    - Replace §9 (lines ~982–1463 of the v1 file) with §9 replacement block above
#    - Replace §11 (lines ~1511–1540 of the v1 file) with §11 replacement block above

# 4. Verify section numbering still contiguous (§1–§16, no gaps, no duplicates)
grep -n "^## [0-9]" LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.1_RATIFIED.md

# 5. Commit
git add LC6_Planning/specs/
git commit -m "S31 pre-Phase-A: spec v1.1 — §9 and §11 revision

Supersedes PHY-031-CYCLEMIN-RECONCILIATION v1 RATIFIED (S30, commit 28731fb).

§9 restructured from MR-target gate to patch-correctness gate:
  §9.4 structural audit (8 items, code-review verifiable)
  §9.5 non-ski bit-identical regression (retained from v1)
  §9.6 per-cycle trajectory shape gates (4 patterns)
  §9.7 direction-of-change gate (3 constraints)
  §9.8 reference-value logging (non-gating)
  §9.9 halt-and-escalate (revised triggers)

§11 restructured:
  - S-001 closure DECOUPLED from S31 scope
  - S31 closes S29-PHY-031-CYCLEMIN-PHYSICS-GAP (reconciliation landed)
  - S-001 stays open with updated annotation pointing at
    broader MR-fidelity work docket
  - New tracker items flagged:
    MR-CRITICAL-MOMENTS-BUDGET-TIGHTER (design refinement)
    S31-OBSERVATION-WINNER-INVARIANCE (strategy-engine question)

Rationale: current-engine MR values are not trusted references given
open bug docket. Closure criteria tied to patch correctness (did it
land, does it not regress, does it change things in the right direction)
rather than absolute MR values of unverified provenance. Preserves
Cardinal Rule #1 by refusing to calibrate against ghosts.

Pre-Phase-A baselines recorded in §9.3 from S31 probe at HEAD 78cd56a:
  G1 optimal_gear sessionMR 2.50
  M2 optimal_gear sessionMR 6.40
  P5 optimal_gear sessionMR 4.10

These are reference points, NOT gate targets. Post-patch values logged
to S31_POST_PATCH_BASELINE.md as a new reference point for future work."
```
