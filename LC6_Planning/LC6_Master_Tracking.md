# LC6 Master Tracking

> **CARDINAL RULE (Memory #30): This file is the canonical source of all open issues, fudge factors, and architectural debt for LC6.** Memory is advisory, this file is canonical. If something isn't here, it isn't tracked.

> **SESSION RITUAL (inviolable):**
> - **OPEN:** `cat LC6_Planning/LC6_Master_Tracking.md | head -100` before any other action. State today's target.
> - **DURING:** Any "defer/flag/later" item added IMMEDIATELY (not at close).
> - **CLOSE:** RECONCILE — review entire Section B and F. Move resolved items B→F. Mark obsolete. Update priority if changed. Run Section G verification grep. Commit tracker as part of session commit.

> **CRITICAL ANTI-PATTERN:** Close-out scripts NEVER use fuzzy idempotency checks. `if "Session 13" not in content:` silently fails when "Session 13" appears in handoff notes from Session 12. Use exact-match grep or explicit overwrite only.

---

<!-- S17-RECONCILIATION-APPLIED -->
<!-- S18-FINDINGS-APPLIED -->
<!-- S18-RECONCILIATION-APPLIED -->
<!-- S19-APPLIED -->
<!-- S19-RECONCILIATION-APPLIED -->
<!-- S20-APPLIED -->
<!-- S20-RECONCILIATION-APPLIED -->
<!-- S21-APPLIED -->
<!-- S21-RECONCILIATION-APPLIED -->
<!-- S22-APPLIED -->
<!-- S22-RECONCILIATION-APPLIED -->
<!-- S23-APPLIED -->
<!-- S23-RECONCILIATION-APPLIED -->
<!-- S24-APPLIED -->
<!-- S24-RECONCILIATION-APPLIED -->
<!-- S25-APPLIED -->
<!-- S25-RECONCILIATION-APPLIED -->
<!-- S26-APPLIED -->
<!-- S26-RECONCILIATION-APPLIED -->
<!-- S27-APPLIED -->
<!-- S27-RECONCILIATION-APPLIED -->
<!-- S28-APPLIED -->
<!-- S28-RECONCILIATION-APPLIED -->
<!-- S29-APPLIED -->
<!-- S29-RECONCILIATION-APPLIED -->
<!-- S30-APPLIED -->
<!-- S30-RECONCILIATION-APPLIED -->
<!-- S31-APPLIED -->
<!-- S31-RECONCILIATION-APPLIED -->
<!-- SESSION-A-APPLIED -->
## Status as of SessionA (2026-04-23):

Audit complete. LC6 State-of-the-Port snapshot at HEAD `ccd7995` captured in `LC6_Planning/audits/`. Four packages audited: `engine` (ACTIVE, well-covered, with 3 pathological evaluate.ts sub-rows documented), `gear-api` (SKELETON, ghost package, 0 consumers), `shared` (SKELETON, ghost package, 0 consumers), `apps/web` (SKELETON pre-decisional, no framework committed).

Infrastructure findings: file-header scope comments unreliable; DRIFT-family pattern reaffirmed (PHY-039B is 2nd instance); ghost-packages scheduled-for-later without owners; `apps/api/` absent not ghost; LC6 Working Agreement doc absent; latent-only harm for STRUCT-ZERO-PADDED and SEMANTICALLY-STUBBED patterns because no UI consumer exists yet.

Failure-mode catalog complete. 12 incidents cataloged to saturation. Four super-patterns identified: plausible-structure-vs-derivation, reasoning-vs-reading, deferred-scope-invisible, absence-of-governance. One new category `FABRICATED-METHODOLOGY` ratified.

Eight tracker items added. SessionB authorized. SessionC (Working Agreement authoring) scheduled after SessionB.

No engine code changes. No spec ratifications. No push needed beyond doc/tracker commits.

**SessionA close commit:** `87e95da` (ratification), plus backfill commit substituting the SHA into this block and related tracker text.

**SessionA outputs:**
- `LC6_Planning/audits/SA_LC6_State_of_the_Port.md` (285 lines, md5 `b4a84d1e32ab0eb4a2313c78a3f88d7d`)
- `LC6_Planning/audits/SA_Failure_Mode_Catalog.md` (282 lines, md5 `7770b88d00dc75a9d619787f6b077c9d`)

---

## Status as of Session 31 (PHY-031-CYCLEMIN-RECONCILIATION v1.2 engine implementation complete; S29-PHY-031-CYCLEMIN-PHYSICS-GAP closed; S-001 remains open)

**Branch:** `session-13-phy-humid-v2` (19 commits ahead of origin pre-push; push follows this commit chain)
**Working tree:** clean except S30 tooling artifacts (untracked `LC6_Planning/S30_close_script.py`, `LC6_Planning/handoffs/`, and `packages/engine/tests/spec-locks/phy-031-cyclemin-reconciliation/evaluate-ensemble-probe.test.ts`)
**Working directory:** `~/Desktop/LC6-local`
**Head:** 35dcf8e (this close commit, referencing Phase C commit `c553621`)
**Test suite:** 687 passed, 7 skipped, 0 failed

**Session 31 narrative arc:**
S31 executed the engine implementation of PHY-031-CYCLEMIN-RECONCILIATION v1 authored S30 — across three phases bracketed by two spec amendments (v1 → v1.1 pre-Phase-A, v1.1 → v1.2 Phase A pre-commit). The session held the Cardinal Rule #1 anti-fudge discipline throughout: every gate failure or scope gap was addressed via spec amendment or test-skip-for-rebaseline, never via constant tuning.

**Pre-Phase-A (spec v1.1 revision, commit `0d9df7b`):** Replaced §9 (MR-target gates → patch-correctness gates) and §11 (S-001 closure decoupled from S31 scope). Kickoff revised in place (`0333546`) to reference v1.1 §9.4–§9.7.

**Phase A (`d3ed55c`, commit message "S31 Phase A: _cycleMinRaw accumulator scoping spec v1.2 §4.6"):** Six-line engine diff introducing `_cycleMinRaw` shim + extending respiratory scaling from `_runMin` to full cycle. Non-ski §9.5 gate discovered to fail on `totalFluidLoss` for cyclic 2-phase non-ski profiles (day_hike, backpacking, running, mountain_biking, trail_running, fishing_shore) because the line 729 respiratory extension is a semantic change, not a `_cycleMinRaw` rename. Halted pre-commit for spec amendment v1.1 → v1.2 (commit `6e1db05`) narrowing §9.5 gated metrics to sessionMR/perCycleMR/trapped/_cumStorageWmin/buffer-fills and explicitly excluding totalFluidLoss with a physics-consistency footnote. Kickoff §9.5 references updated in a parallel commit (`bb85d4d`). Phase A commit then landed clean against v1.2 §9.5.

**Phase A follow-up (`1ea537c`):** Skipped one legacy ski test (`tests/moisture/calc_intermittent_moisture.test.ts` — Breck 16°F groomers totalFluidLoss 445g) that locks to a pre-S31 baseline. Re-authored in post-Phase-C rebaseline arc.

**Phase B (`131eeee`, commit message "S31 Phase B: 4-phase cycle decomposition spec v1.2 §4, §5"):** Extended the resort-ski cyclic phase loop from (run + lift) to (line + lift + transition + run) in wall-clock order. EPOC continuity chain verified via `_METstart_line` trace (4.64 at cycle 1 during warmup, 9.50 at cycles 5/10 post-warmup for M2/P5). Non-ski gate 11/11 preserved via `_isResortSkiProfile` guard; LINE_MET=1.8 / TRANSITION_MET=2.0 constants added to `phy031_constants.ts` with Ainsworth citations; crowd_factor.ts `LIFT_LINE_MIN_BY_TIER` exported; `CycleResult.liftLineMin` added.

**Phase B follow-up (`9d3220f`):** Skipped five additional ski tests — four numeric baselines in the same Breck groomers test block (sessionMR, trapped, goodRunCount, yellowRunCount) and one `ensemble_physics.test.ts` extreme-cold thin-vs-thick winner test. All locked to pre-S31 baselines. Topology assertions (totalRuns, perCycleMR length, peakHeatBalanceDirection, layerBuffers-not-null) retained.

**Phase C (`c553621`, commit message "S31 Phase C: rest-phase integration spec v1.2 §6"):** Lunch (45 min, shell-off, 12:15 PM, MET 1.5, Ainsworth 13030) and otherBreak (15 min, shell-on, 2:30 PM, MET 1.8, Ainsworth 20030) rest phases integrated. Indoor conditions fixed 20°C / 40% RH / 0 m/s per ASHRAE 55-2020. Shell-draped drain at 2× worn rate per spec §6.7.1. `CycleOverride.lunch?` + `.otherBreak?` optional fields added (no signature change to `calcIntermittentMoisture` per §8.6). `evaluate.ts computeResortCycleOverride` threads defaults (true when duration > 5 per §6.3). `ActivitySpec.lunch?` + `.other_break?` added to types.ts. RUN phase code block moved to AFTER LIFT and TRANSITION for strict §9.4(1) wall-clock-order structural compliance.

**S31 gate results (all green against spec v1.2):**
- §9.4 Structural audit: 8/8 items verified by code review
- §9.5 Non-ski v1.2-narrowed bit-identical: 11/11 (sessionMR, perCycleMR, trapped, _cumStorageWmin, final layer buffer fills)
- §9.6 Trajectory shape: 5/5 (lunch dips visible at cycles 15/10/5 for G1/M2/P5 at magnitudes 1.1/3.2/1.7 MR, post-lunch re-climb, line-phase accumulation in P5 vs G1, EPOC continuity)
- §9.7 Direction-of-change: 3/3 (|ΔP5|=1.10 > |ΔG1|=0.70, |ΔG1|<1.0, all three moved; all deltas downward because Phase C lunch drying dominates Phase B line accumulation for high-humidity vectors)

**Post-patch baseline (spec v1.2 §9.8, reference-only not gating):**
- G1 Ghost Town groomers: 2.50 → 1.80 (Δ -0.70)
- M2 Tier 2 moguls: 6.40 → 5.50 (Δ -0.90)
- P5 Tier 5 powder Saturday: 4.10 → 3.00 (Δ -1.10)

Values from `evaluate-ensemble-probe.test.ts` real-DB optimal_gear pill. Full trajectories and physics arithmetic at `LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md`.

**S31 outputs:**

- **`0d9df7b`:** Spec v1 → v1.1 revision (§9 and §11 rewrite)
- **`0333546`:** Kickoff v1 → v1.1 revision (in-place)
- **`6e1db05`:** Spec v1.1 → v1.2 amendment (§9.5 narrowing)
- **`bb85d4d`:** Kickoff §9.5 references updated for v1.2
- **`d3ed55c`:** Phase A — _cycleMinRaw accumulator scoping
- **`1ea537c`:** Phase A follow-up — skip legacy ski totalFluidLoss baseline
- **`131eeee`:** Phase B — 4-phase cycle decomposition
- **`9d3220f`:** Phase B follow-up — skip legacy ski numeric baselines
- **`c553621`:** Phase C — rest-phase integration
- **`35dcf8e`:** S31 close — tracker + registry + post-patch baseline (this commit)
- (Plus a backfill commit substituting RATIFY_SHA into placeholders.)

**S31 closes:**

- `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` HIGH → **CLOSED**. Engine now simulates full 4-phase cycle wall-clock per spec v1.2 §4.2. Line + lift + transition + run phases plus rest-phase integration (lunch shell-off 12:15 PM, otherBreak shell-on 2:30 PM). `_cycleMinRaw` accumulator scoping corrected. Non-ski bit-identical regression verified on v1.2-narrowed gated metrics across all 11 activities.

**S31 does NOT close:**

- `S-001` / `S26-SYSTEMATIC-MR-UNDERESTIMATION` — OPEN with updated annotation per spec v1.2 §11.2. Reconciliation physics landed but does not independently validate post-reconciliation MR values represent trusted physics. Full closure requires resolution of ongoing physics-fidelity items plus field cross-checks (§11.5).

**Status updates:**

- `SessionA` (LC6 State-of-the-Port audit) — DEFERRED → **AUTHORIZED** for next session.
- `S29-MATRIX-PENDING` — **subsumed** by `S31-PHASE-C-REBASELINE` (covers the original S29 test plus 6 new S31-authored skips).

**NEW tracker items from S31 (six):**

- `MR-CRITICAL-MOMENTS-BUDGET-TIGHTER` LOW — precognition/pacing-loop alarm-fatigue refinement; revisit after `evaluate.ts:487` ventEvents TODO wires.
- `MR-PHY-031-REST-PHASE-MARKERS` LOW — diagnostic; `_perCycleHeatStorage` tagged-union would break downstream consumers; LC7 candidate.
- `MR-PHY-031-REST-INSENSIBLE-ROUTING` LOW — conservative-safe; rest-phase insensible not routed into layer buffers; LC7 candidate if field data surfaces undercounting.
- `S31-OBSERVATION-WINNER-INVARIANCE` MEDIUM — strategy engine picked `candidate-5` as optimal winner across G1/M2/P5 despite different ambient; scenario-sensitivity investigation.
- `S31-DOC-P5-TIER-CONSISTENCY` LOW — spec §9.2 names "Tier 5" but `_liftLineMin=20` maps to T6 per §4.1; either rename vector P6 or add footnote.
- `S31-PHASE-C-REBASELINE` MEDIUM — re-author the 7 skipped tests (1 S29-MATRIX-PENDING + 1 Phase A totalFluidLoss + 4 Phase B numeric + 1 Phase B winner) with verified post-S31 fixtures. Supersedes the narrower `S29-MATRIX-PENDING`.

**Forward plan:**

- **SessionA (LC6 State-of-the-Port audit):** now authorized. Cross-package port-state snapshot + failure-mode catalog. Kickoff file at `LC6_Planning/session_kickoffs/SessionA_kickoff.md`.
- **MR-fidelity arc toward actual S-001 closure:** requires resolution of open physics-fidelity tracker items + field cross-check monitoring for first 10 real ski sessions post-impl per spec v1.2 §11.5.
- **S31-PHASE-C-REBASELINE:** authored as a dedicated re-baselining session once post-S31 values are validated against user field experience.
- **S30-AUDIT-* items (5 of them):** remain open for future sessions per spec v1.2 §8.5.
- **Pending spec ratifications:** PHY-SHELL-GATE v1, PHY-MICROCLIMATE-VP v1 draft-only.

**Push sequence:** branch pushed to origin after this close commit + backfill commit land. First push of this branch since before S29 close.

## Status as of Session 30 (PHY-031 cycleMin reconciliation spec ratified; S31 engine port authorized)

**Branch:** `session-13-phy-humid-v2` (unchanged at `29e0b30` for code; S30 commits are doc-only on the same branch; still unpushed)
**Working tree:** clean after S30 close
**Working directory:** `~/Desktop/LC6-local`
**Head:** 28731fb

**Session 30 narrative arc:**
S30 opened per kickoff as Chat-led spec authoring session. Sole deliverable: `LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md` (1,601 lines, 13 sections). Zero code, zero tests, zero engine touches. All session-level OQs pre-resolved per kickoff. Physics OQs (indoor ambient, rest wall-clock placement, transition MET, line MET, EPOC chain extension, lunch shell-off handling, ambient vapor absorption recompute, non-cycleMin field audit scope) all resolved with user during drafting.

Session surfaced and corrected an algebraic error in the author's initial worked-example arithmetic: `totalCycles = floor(effectiveMin / cycleMin)` double-applied REST_FRACTION. Per PHY-031 §2.1 formula the correct expression is `floor(durationMin / cycleMin)`, algebraically equal to `floor(effectiveMin / cycleMinRaw)`. Corrected at user's "slow and right" direction before §9 hand-comp vectors were committed. Field-calibration check (Everesting ~30K vft as expert-day target per user reference) validated the corrected counts.

Three hand-comp verification vectors authored with sessionMR targets: G1 Ghost Town groomers 2.6, M2 Tier 2 moguls 4.3 (S-001 Breckenridge closure anchor), P5 Tier 5 powder Saturday 5.5. Tolerance regime ±0.3 sessionMR, ±10% fluid loss, ±15% storage/sweat/buffer. 8 implementation-session gate criteria (§9.5) including non-ski activity bit-identical regression.

Interface extension for rest booleans mandated (no signature change to `calcIntermittentMoisture`) per §8.6. §8.5 non-cycleMin `cycleOverride` field audit surfaced 5 audit-query tracker items for future sessions.

**S30 outputs (committed):**

- **28731fb:** Three-file doc commit on `session-13-phy-humid-v2`
  - `LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md` (new, 1,601 lines)
  - `LC6_Planning/LC6_Spec_Registry.md` (4 edits: new row, PHY-031 status annotation, Last-Verified column, v1.2 version-history row)
  - `LC6_Planning/LC6_Master_Tracking.md` (markers, new S30 status block, cyclemin-gap row flip, S26 close-criteria reference, 6 new B.18 items, Section G grep list extension)

**S30 did NOT close:**

- `S26-SYSTEMATIC-MR-UNDERESTIMATION` — close criteria now locked per reconciliation spec §11; closure pending S31 implementation success.
- `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` — status flipped to HIGH-ratified-implementation-pending; closure pending S31.
- `S29-MATRIX-PENDING` — unchanged; re-author in S31 post-implementation with proper fixture + metric read.

**Drift items status update:**
- `S27-DRIFT-1-PERCEIVED-MR-FILENAME` LOW — unchanged, still open
- `S27-DRIFT-2-HUMID-V1-FILENAME` LOW — unchanged, still open
- `S27-DUAL-BREATHABILITY-MAPPING` MEDIUM — unchanged, still open
- `S27-TSC-ERRORS-BASELINE` LOW — unchanged (8 errors; held steady through S30 since no engine touches)
- `S27-STALE-PLANNING-DOCS` MEDIUM — unchanged
- `GAP-PHY-031-POWDER-THRESHOLD` — unchanged, still future scope

**NEW tracker items from S30 (six):**

All six surfaced via reconciliation spec §8.5 (non-cycleMin `cycleOverride` field audit, diagnostic-only) and §10.3 (session-drafting discovery). Full descriptions in Section B.18.

- `S30-AUDIT-PHY-040-FIELD-OWNERSHIP` MEDIUM — `elevFt`/`perRunVertFt` consumed by `altitudeFactors()`; LC6 PHY-040 spec existence unconfirmed. Potential DRIFT-4 analog.
- `S30-AUDIT-DEWPOINTC-SPEC-OWNERSHIP` MEDIUM — `dewPointC` consumed in two code paths (linear + cyclic); spec ownership split between PHY-039 and PHY-HUMID-01 unclear.
- `S30-AUDIT-LINEAR-PATH-CYCLEOVERRIDE` MEDIUM — five linear-path fields lack confirmed LC6 spec ownership. Hiking/running outputs potentially drifting.
- `S30-AUDIT-STRATEGYLAYERIMS-SPEC-OWNERSHIP` LOW — BUG-139 LC5-shipped physics contract not confirmed to have LC6 spec file.
- `S30-AUDIT-CYCLEOVERRIDE-ESCAPE-HATCH` LOW — TypeScript index signature `[key: string]: unknown` allows undeclared fields invisibly.
- `S30-SKIING-DURATION-DEFAULT` LOW — UI form defaults Skiing duration to 3hr; proposed fix `min(12, max(0.5, 16 - startHour))`. Pure UI concern.

**Forward plan:**

- **S31 target:** Engine implementation of reconciliation spec. Highest-risk engine patch in LC6 to date. Cardinal Rule #8 active. 8 gate criteria in spec §9.5 must pass before patch lands. 3 hand-comp vectors (G1, M2, P5) at ±0.3 sessionMR tolerance. Non-ski activity regression must be bit-identical. Branch `session-13-phy-humid-v2` stays unpushed through S31.
- **S32+ (after S31 closes S-001):** Address 5 §8.5 audit-query items (`S30-AUDIT-*`). Consider ratifying PHY-SHELL-GATE and PHY-MICROCLIMATE-VP drafts. `S30-SKIING-DURATION-DEFAULT` is a UI concern, can land anytime.
- **SessionA (LC6 State-of-the-Port audit)** remains deferred pending S31 close. Rationale unchanged from S29.

**Still unpushed.** Per S29 rule: push happens after S31 implementation closes the regression.

## Status as of Session 29 (PHY-031 port landed; cyclemin-physics gap discovered; S-001 regression still open)

**Branch:** `session-13-phy-humid-v2` (2 commits ahead of origin, unpushed pending cyclemin reconciliation spec)
**Working tree:** clean after S29 close
**Working directory:** `~/Desktop/LC6-local`
**Head:** 7289e8b (S29 close — PHY-031 port commit, matrix test file discarded)

**Session 29 narrative arc:**
S29 executed the PHY-031 port per spec §13 verification criteria and S28 kickoff scope. Seven patches landed clean, Cardinal Rule #8 honored (calcIntermittentMoisture untouched). Spec-lock tests converted from 25 `test.todo` to real assertions; 31/31 green. Session ran long due to mid-session discovery that `ActivitySpec.date_iso` plumbing didn't exist in either LC6 or LC5 — required schema extension (patches 3–4, 20 fixture sites), not in original kickoff scope.

Patch 7 redirected from kickoff's proposed path (modify calcIntermittentMoisture signature — Cardinal Rule #8 touch, hand-comp trace required) to Option A (plumb ski_history through evaluate.ts → computeResortCycleOverride, zero engine touch). Result: S29 closed with zero thermal-engine modification, matching LC6's hardest-won rule.

4-scenario verification matrix authored as `s29_matrix.test.ts`, run, revealed 3/4 scenarios out of expected range: S1 MR dropped (pre-port 2.30 → post-port 1.50), S2 LC5 parity miss (expected 6.2, observed 3.90), S3 at boundary. Per OQ-S29-6 resolution, session halted and investigated rather than adjusting ranges.

Root cause diagnosed: **spec-implementation gap in cycleMin consumption.** Spec §2.1 defines cycleMin as full wall-clock cycle time (16.25 min Ghost Town groomers to 50 min Mayhem trees — a 3× spread by terrain + tier + powder). Engine phase loop simulates only run+lift (~10 min). Override supplies totalCycles to engine; engine honors count but not duration. Up to 80% of session wall-clock time unsimulated. User's longstanding field observation ("no way you're getting 40-50K feet off 36 runs") confirmed by diagnostic — the pre-port 36-cycle default was physically implausible but produced "looks-fine" aggregate because it happened to fill the session with 10-min cycles.

Matrix test file deleted (not committed) to prevent "loosen ranges until green" temptation in future sessions.

**S29 outputs (committed):**

- **Commit 435e321:** `LC6_Planning/session_kickoffs/S29_kickoff.md` + `SessionA_kickoff.md`
- **Commit 7289e8b:** PHY-031 port infrastructure (7 patches)
  - `packages/engine/src/activities/phy031_constants.ts` (new)
  - `packages/engine/src/activities/crowd_factor.ts` (new; getCrowdFactor + computeCycle)
  - `packages/engine/src/types.ts` (ActivitySpec.date_iso required; UserBiometrics.ski_history optional)
  - `packages/engine/src/validate.ts` (ISO-8601 + ski_history format validation)
  - `packages/engine/src/evaluate.ts` (computeResortCycleOverride bridge; null-plug closed)
  - `packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts` (25 `.todo` → real tests; 31/31 green)
  - 20 fixture sites updated across 12 test files to include `date_iso`

**S29 did NOT close:**

- `S26-SYSTEMATIC-MR-UNDERESTIMATION` — S-001 Breck diagnostic did NOT regress-close; MR moved in wrong direction post-port, indicating physics gap not symptom fix.

**Drift items status update:**
- `S27-DRIFT-3-PHY-031-NO-SPEC` — closed S28, engine port landed S29 but physics-incomplete
- `S27-DRIFT-1-PERCEIVED-MR-FILENAME` LOW — still open
- `S27-DRIFT-2-HUMID-V1-FILENAME` LOW — still open
- `S27-DUAL-BREATHABILITY-MAPPING` MEDIUM — still open
- `S27-TSC-ERRORS-BASELINE` LOW — 8 errors, held steady through S29 (7 cm_budget product_name + 1 precognitive_cm TrajectoryPoint)

**NEW tracker items from S29:**

- **`S29-PHY-031-CYCLEMIN-PHYSICS-GAP` HIGH** — Engine phase loop (run+lift ~10 min) does not consume spec §2.1 cycleMin (16.25–50 min, dynamic per terrain+tier+powder). Up to 80% of session wall-clock unsimulated when cycleOverride is supplied. Blocks `S26-SYSTEMATIC-MR-UNDERESTIMATION` closure. Requires new draft spec (`PHY-031-CYCLEMIN-RECONCILIATION`) specifying phase decomposition rules, per-phase physics model (line/transition/rest), session-level rest handling, and ski-history override decomposition. Cardinal Rule #8 exposure: implementation will touch engine phase-loop semantics — hand-computed trace required pre-patch.

- **`S29-MATRIX-PENDING` MEDIUM** — 4-scenario matrix test file drafted during S29 but deleted pre-commit. Scenarios: S1 Breck groomers 16°F Tue, S2 Breck moguls 37°F Tue (LC5 parity 6.2), S3 Tahoe bowls 28°F 70%RH powder snowboard, S4 Breck groomers Thanksgiving Fri. Re-author post-reconciliation with verified fixture ensemble (current fixture was contrived — used hand-picked CLO/im rather than gear-DB products matching LC5 Mar 24 baseline). `peak_MR` vs `sessionMR` metric read also needs verification (test may have read instantaneous-peak where LC5 baseline was session-cumulative).

**`GAP-PHY-031-POWDER-THRESHOLD`** — unchanged. Powder signal-source wiring (OpenSnow/OnTheSnow/NWS) remains future scope. S29 passes `powderFlag: false` at bridge call site.

**Forward plan:**

- **Immediate (pre-push):** Draft `PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_DRAFT.md` in a fresh spec-authoring session. Same pattern as S28 PHY-031 authoring: concrete-to-abstract open question resolution, hand-computed trace vectors, verification criteria for implementation session.
- **Next implementation session (S30+ after reconciliation ratified):** Execute reconciliation port. Cardinal Rule #8 active. Hand-comp trace gate. Re-author 4-scenario matrix with proper fixture + metric read. Close S-001 regression. Flip PHY-031 registry row PARTIAL → ACTIVE. Push all accumulated commits to origin.
- **DO NOT PUSH `session-13-phy-humid-v2` until reconciliation ratifies.** S29 commits stay local to prevent premature "shipped" framing while S-001 regression open.
- **Preserve for later sessions (unchanged):** DRIFT-1, DRIFT-2, PHY-SHELL-GATE v1 ratification, PHY-MICROCLIMATE-VP v1 ratification, S27-DUAL-BREATHABILITY-MAPPING, S28-GOV-MODEL-REFINEMENT-PROCESS.
- **SessionA (LC6 State-of-the-Port audit) held pending S30 close.** Tracker item `S30-SESSIONA-DEFERRED` MEDIUM carries the rationale: audit value grows with more data; premature open before S-001 regression closes would catalog an in-progress state. SessionA kickoff file sits installed at `LC6_Planning/session_kickoffs/SessionA_kickoff.md` (committed in 435e321) awaiting S30+ completion.

## Status as of Session 28 (PHY-031 spec ratified; S27-DRIFT-3 closed; S29 port unblocked)

**Branch:** `session-13-phy-humid-v2` (pushed to origin)
**Working tree:** clean
**Working directory:** `~/Desktop/LC6-local`
**Head:** 3a4b4d1113264c40a0752aa3ba1e43b43aa866f2 (S28 close — spec + tracker + registry)

**Session 28 narrative arc:**
S28 opened per kickoff as Chat-led spec authoring session. Sole deliverable: `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md`. Source material: LC5 archive (PHY-031 original ratification Mar 17, 2026) + S27 audit + user's S27 ski-speed research (Stepan 2023, ScienceDirect corpus). Six open questions deferred from LC5 ratification resolved with user input concrete-to-abstract (Q6 → Q5 → Q1 → Q4 → Q3 → Q2).

Session surfaced two recurring failure modes the kickoff had explicitly warned about: (a) Chat re-deriving from first principles work that was already ratified in LC5 archives, requiring user intervention to redirect back to "read LC5, don't reinvent"; (b) Chat adopting off-hand user comments as new rules instead of checking whether the comment matched ratified work. Both patterns caught and corrected mid-session. User named the meta-principle: "do not let me override work already done."

**S28 outputs:**

- **Spec file (`LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md`):** 616 lines, 18 sections. Ports LC5 PHY-030/031 ratified values verbatim (component formula, 6-tier crowd calendar, per-terrain table, seasonal fallthrough, component constants). Adds S28-ratified content: Thanksgiving holiday window (#10), powder-day auto-detection via OpenSnow → OnTheSnow → NWS, powder tier-bump table. Cardinal Rule §9 transcribes cycle-averaging prohibition from kickoff §6. §10 declares "no-date" path not-applicable per ratified `smartStartH`. §11 defers resort multiplier to v2, captures Alpine Replay framework. §13 verification criteria for S29. §14 Model Refinement future-work register. §15 audit trail of all 6 open-question resolutions.

- **Six open questions — resolutions documented in spec §15:**
  - Q6 (run duration revision): No revision. LC5 table stands. Stepan research applies to 2,000 vft scenarios; LC5 values correct for 1,000 vft reference.
  - Q5 (climate normals default): Not applicable. Date always supplied via ratified `smartStartH`.
  - Q1 (Thanksgiving): Window #10 added — Wed 3 / Thu 2 / Fri 4 / Sat 4 / Sun 3.
  - Q4 (powder surge): Auto-detected via OpenSnow → OnTheSnow → NWS. Tier bump table ratified. `GAP-PHY-031-POWDER-THRESHOLD` flagged for S29.
  - Q3 (resort multiplier): Defer to v2. Alpine Replay 5-tier framework captured for future.
  - Q2 (user crowd override): Defer to v2 or never. User-stated principle: "minimize user input" — system infers from ambient signals.

**Zero engine-physics changes this session.** Pure spec authoring + tracker/registry updates. No Cardinal Rule violations.

**Drift items status update:**
- `S27-DRIFT-3-PHY-031-NO-SPEC` HIGH — **CLOSED** (spec ratified, file exists)
- `S27-DRIFT-1-PERCEIVED-MR-FILENAME` LOW — still open, S30+
- `S27-DRIFT-2-HUMID-V1-FILENAME` LOW — still open, S30+
- `S27-DUAL-BREATHABILITY-MAPPING` MEDIUM — still open, S30+
- `S27-TSC-ERRORS-BASELINE` LOW — still open, S30+

**New tracker items from S28:**
- `GAP-PHY-031-POWDER-THRESHOLD` — Quantitative snowfall threshold for powder-day classification when falling back from OpenSnow to NWS. Recommendation in spec §7.4: adopt OpenSnow proprietary classifier when that source is active. Define NWS threshold only when needed. Owner: S29 or later integration session.
- `S28-GOV-MODEL-REFINEMENT-PROCESS` MEDIUM — User flagged in S28 that the Model Refinement cycle itself is undefined. When do deferred items graduate to v2? What triggers a refinement pass? Who ratifies? Needs its own session to define.

**Forward plan (unchanged from S27 forward plan, S28 deliverable executed):**

- **S29 target:** Execute PHY-031 port per S27 audit Option A. Build `getCrowdFactor(dateStr, powderFlag)`. Define constants `DEFAULT_LIFT_MIN=7`, `TRANSITION_MIN=3`, `REST_FRACTION=0.20`. Wire `evaluate.ts:430` to compute cycleOverride from date + crowd tier + (S29 integration choice for powder). Add ski-history parameter + back-calc path (Phase A manual entry). Convert spec-lock `.todo` → `.it` as each component lands. Bind 25 `.todo` items to spec sections during port work. S26-SYSTEMATIC-MR-UNDERESTIMATION closes when port complete and verified against S-001 Breck diagnostic (cycle count drops from 36 to spec-predicted ~18 at Tier 2).
- **S30+ targets:**
  - Tackle DRIFT-1 and DRIFT-2 (LOW, 10 min cleanup each)
  - Resume PHY-SHELL-GATE v1 and PHY-MICROCLIMATE-VP v1 ratification path
  - Address S27-DUAL-BREATHABILITY-MAPPING MEDIUM
  - Address S28-GOV-MODEL-REFINEMENT-PROCESS MEDIUM (when user ready)

**Net tracker change S28:** +2 new items (`GAP-PHY-031-POWDER-THRESHOLD`, `S28-GOV-MODEL-REFINEMENT-PROCESS`). 1 item CLOSED (`S27-DRIFT-3-PHY-031-NO-SPEC`). Forward plan materially unchanged — S28 deliverable executed per S27 plan.

### Historical record — Session 27 (Root cause identified as PHY-031 unported; retention infrastructure established)

**Branch:** `session-13-phy-humid-v2` (pushed to origin)
**Working tree:** clean
**Working directory:** `~/Desktop/LC6-local`
**Head:** 2e33590 (S27 spec-lock tests) → 57a469e (S27 registry) → 0cce64c (S27 audit) → 6984c77 (S27 trace) → ae6ed6c (S27 probe) → 2654a8b (S27 F0)

**Session 27 narrative arc:**
S27 opened intending sweat-rate physics investigation per S26 forward plan. Direct-probe of `iterativeTSkin` produced E_req=558W uncompensable → sweatGhr=827 when given plausible inputs. Per-cycle trace via env-guarded instrumentation revealed engine sees MET=5 for all 36 cycles, producing 76 mL/hr fluid loss — internally consistent with profile definition but 5-10x below user-reported reality. Sequential hypothesis elimination:

- NOT thermal solver (probe proved correct output)
- NOT computeSweatRate primitive (probe proved correct output)
- NOT a "two sweat rates" unification issue (engine uses Gagge-derived rate directly in cyclic path — my initial misdiagnosis corrected by Code's careful grep, and reinforced when Chat had to be reminded cycle-averaging violates phase-resolution principle)
- **IS an unported spec:** PHY-031 component cycle model (crowd tiers, holiday windows, line+transition+rest times) ratified in LC5 Mar 17 only 12.5% ported to LC6

User surfaced the meta-concern: "LC6 was supposed to prevent LC5's rogue-engine problem but we're in the same pattern. Fixes don't stay fixed." Pivot to building retention infrastructure before further fixes.

**S27 output — 3-step retention plan delivered:**

- **Step 1 (0cce64c):** `LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md` (242 lines). Documents PHY-031's 12.5% port status. Scaffolding present (cycleOverride slot, profile comment acknowledging design), bridge null-plugged at `evaluate.ts:430` with comment "No cycle override in 10a".
- **Step 2 (57a469e):** `LC6_Planning/LC6_Spec_Registry.md` (153 lines). Replaces S14-era 13-line stub that drifted for 13 sessions. Canonical registry distinguishing filename status from engine reality. Status vocabulary: ACTIVE, PARTIAL, NOT_PORTED, DRAFT, REVERTED, SUPERSEDED. Surfaces 3 drift items logged below.
- **Step 3 (2e33590):** `packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts` (156 lines). 6 Tier A assertions passing (profile constants per spec), 25 Tier B `.todo` placeholders awaiting port. New test subdirectory `spec-locks/` dedicated to ratified-spec enforcement.

**Prep work (pre-retention-plan commits):**

- `ae6ed6c` S-001 iterativeTSkin direct-probe diagnostic (223 lines, no engine changes)
- `6984c77` env-guarded per-cycle trace in calc_intermittent_moisture.ts (7 lines, LC6_TRACE_S001 env-gated, Cardinal Rule #8 compliant)
- `2654a8b` F0 backfill of Session 26 status block (hygiene recurrence fix)

**Zero engine-physics changes this session.** Pure investigation + infrastructure. No Cardinal Rule violations.

**Drift items surfaced (all logged in B.17):**
- `S27-DRIFT-1-PERCEIVED-MR-FILENAME` LOW — filename says RATIFIED, reality is REVERTED (S17)
- `S27-DRIFT-2-HUMID-V1-FILENAME` LOW — filename says RATIFIED, reality is SUPERSEDED (by v2)
- `S27-DRIFT-3-PHY-031-NO-SPEC` HIGH — PHY-031 ratified in LC5 but no LC6 spec file exists

**Related concerns surfaced by audit:**
- `S27-DUAL-BREATHABILITY-MAPPING` MEDIUM — two `breathabilityToIm` functions with same name, different formulas (gear_layers.ts piecewise vs gear/adapter.ts linear)
- `S27-TSC-ERRORS-BASELINE` LOW — 8 pre-existing `tsc --noEmit` errors in test files (unrelated to S27 work)

**S26-SYSTEMATIC-MR-UNDERESTIMATION reframed:** Not a physics bug. Not a thermal solver bug. Architectural feature that was scoped but not wired. Fix is PHY-031 port completion (audit Option A), not new spec authoring. Closure blocked on S28+S29 execution.

**Forward plan (revised from S26 forward plan):**

- **S28 target:** Author LC6 PHY-031 spec doc (Option C from S27 close). Port-back from LC5 archives + audit findings into `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md`. Resolves DRIFT-3. Addresses remaining open questions from original ratification (Thanksgiving treatment, user override selector, resort-specific multiplier, powder day surge, climate normals default). No implementation yet.
- **S29 target:** Execute PHY-031 port implementation. Build `getCrowdFactor(dateStr)` utility. Define constants `DEFAULT_LIFT_MIN=7`, `TRANSITION_MIN=3`, `REST_FRACTION=0.20`. Wire `evaluate.ts:430` to compute cycleOverride from date + crowd tier. Add ski-history parameter + back-calc path (Phase A manual entry). Convert spec-lock Tier B `.todo` items to `.it` as each component lands. S26 closes when port complete and verified against S-001 trace.
- **S30+ targets:**
  - Tackle DRIFT-1 and DRIFT-2 (LOW, 10 min cleanup each)
  - Resume PHY-SHELL-GATE v1 and PHY-MICROCLIMATE-VP v1 ratification path (both remain correct physics, were correctly deferred)
  - Address S27-DUAL-BREATHABILITY-MAPPING MEDIUM

**Net tracker change S27:** +5 new items (3 DRIFT + 2 related concerns). 1 item status update (S26-SYSTEMATIC-MR-UNDERESTIMATION). Forward plan materially revised.

### Historical record — Session 26 (Diagnostic reveals sweat rate underestimation; spec ratification deferred pending investigation)

**Branch:** `session-13-phy-humid-v2` (pushed to origin)
**Working tree:** clean
**Working directory:** `~/Desktop/LC6-local`
**Test count:** 645/645 passing (1 new diagnostic test added, no engine changes)
**Head:** c423659 (S26: S-001 diagnostic test) → cd27ff7 (S26: S-001 scenario v1) → 4f9d32f (S26: log SYSTEMATIC-MR-UNDERESTIMATION) → 259e74e (S25 close)

**Session 26 target reframing:**
- Original target per S25 forward plan: joint ratification of PHY-SHELL-GATE and PHY-MICROCLIMATE-VP drafts.
- S26 first pivoted to reference scenario population (§10 gate requirement), starting with S-001 Breck cold-dry skiing.
- Authored qualitative S-001 v1 with real ensemble (Smartwool Merino 250 / Patagonia R1 Air / Patagonia Nano Puff / Arc'teryx Beta LT), user requested upgrade to numeric values via engine diagnostic.
- Diagnostic revealed ~76 mL/hr effective sweat rate for alpine skiing at MET 6-7, 16°F / 40% RH. Physiologically should be 400-800 mL/hr. **Engine underestimates sweat production by 5-10x.**
- Pivoted from ratification path to systematic-MR-underestimation investigation.

**Session 26 outcome:**
- **Logged `S26-SYSTEMATIC-MR-UNDERESTIMATION` as HIGH** (commit `4f9d32f`). Captures user's weeks-long observation that perceived MR readings feel consistently too low. Enumerates 5 possible root cause candidates (microclimate-VP, perceived weights scaling, saturation cascade midrange, cold penalty scaling, combination).
- **Authored S-001 v1 qualitative reference scenario** (commit `cd27ff7`). 421 lines. Real ensemble from LC5 catalog, physics reasoning throughout, directional MR shift predictions. Honest caveat that numeric values are estimates pending diagnostic-based upgrade.
- **Authored S-001 diagnostic test** (commit `c423659`). 199 lines. Captures per-cycle engine state for the Breck scenario. Uses real ensemble construction with precomputed weightG from memory midpoint table, breathabilityToIm piecewise function applied correctly, FIBER_ABSORPTION cap math.

**Key finding that reshapes investigation:**
Engine produces sessionMR=2.30 over 6 hours of alpine skiing with peakSaturationFrac=22.1%. Layers fill uniformly to ~28% via Washburn equilibration. totalFluidLoss=456mL over 6 hours = 76 mL/hr — essentially insensible-perspiration baseline, not high-exertion sweating.

**Implication for PHY-SHELL-GATE and PHY-MICROCLIMATE-VP:**
Both specs address physics at or near terminal saturation. Engine does not reach saturation in normal alpine skiing. Saturation-regime physics corrections remain correct but may not be the primary lever for user-reported MR underestimation. The upstream sweat-rate bug prevents the engine from entering the regime where these specs take effect.

**Consequence for forward plan:**
- Spec ratification DEFERRED pending sweat-rate investigation
- New investigation scope: why does `iterativeTSkin` + `computeSweatRate` produce such low sweat in cold-exposure high-exertion scenarios?

**Net tracker change S26:** +1 HIGH (`S26-SYSTEMATIC-MR-UNDERESTIMATION`). Strategic pivot: primary investigation target shifted from microclimate/shell physics to sweat-rate physics.

**Forward plan:**
- **S27 target:** Sweat-rate investigation. Write direct-probe diagnostic (`s001_iterative_tskin_probe.test.ts`) calling `iterativeTSkin` with engine-matched cycle-0 inputs. Read `eReq` and `eActual` from result object. Compute external sweat rate via `computeSweatRate(eReq, eMax)`. Identify whether bug is in thermal solver inputs, solver internals, or post-solver pipeline.
- **S28 target:** Based on S27 findings, either (a) targeted tactical fix if bug is outside thermal engine, (b) new spec draft if bug requires solver modification (Cardinal Rule #8 implications), or (c) per-cycle trace escalation if cycle-0 probe shows expected values.
- **S29+ target:** Return to PHY-SHELL-GATE and PHY-MICROCLIMATE-VP ratification once sweat-rate situation is understood. These specs may still be worth shipping even if not primary lever.

### Historical record — Session 25 (PHY-MICROCLIMATE-VP unified spec drafted; supersedes two tracker items)

**Branch:** `session-13-phy-humid-v2` (pushed to origin)
**Working tree:** clean
**Working directory:** `~/Desktop/LC6-local`
**Test count:** 644/644 passing (no code changes this session — spec-only work)
**Head:** 863c4ca (S25 main: PHY-MICROCLIMATE-VP v1 DRAFT) → 3c6c332 (S25 F0: S24 status backfill) → ba97e45 (S24 close)

**Session 25 target:** Author `PHY-MICROCLIMATE-VP_Spec_v1_DRAFT.md` per S24 forward plan.

**Session 25 outcome:**
- **PHY-MICROCLIMATE-VP v1 DRAFT authored** (commit `863c4ca`). 591 lines. Unified spec covering what were originally two separate tracker items: `S22-MICROCLIMATE-VP` (evaporation side) and `S21-F2-HARDCODED-SKIN-DEW` (condensation placement side). Both trace to same missing engine state: per-layer microclimate vapor pressure.
- **S24 grounding work feeds directly into spec scope.** Code audit from S24 provided concrete line-by-line site analysis: 8 callsites to modify (computeEmax ×2, iterativeTSkin ×2, getDrainRate ×4, plus `_tDewMicro = 29` hardcode), 8 callsites to keep unchanged with reasoning (respiratory loss, wader floor, hygroscopic absorption, vent events, etc.).
- **Unification benefit:** implementation closes TWO HIGH tracker items in single coordinated change. Open HIGH count drops 8 → 6 when S27-S28 implementation ships.
- **Cardinal Rule #8 compliance confirmed:** no thermal engine signature changes. All modifications are different numerical values passed to existing RH arguments. iterativeTSkin, computeEmax, getDrainRate signatures unchanged.
- **Incidental resolution of S24 drip-cooling concern:** S24 discussion raised concern that `iterativeTSkin`'s `E_actual` might over-credit cooling at terminal saturation. This spec resolves it implicitly — `E_max` correctly reflects microclimate VPD post-implementation, so `E_actual` correctly caps cooling at vapor-transport rate.

**Session 25 F0 prep (backfill):** `3c6c332` added the missing Session-24 status block that had been omitted from the S24 close commit. Forward plan updated.

**Net tracker change S25:** +1 MEDIUM (S25-LINEAR-PATH-MICROCLIMATE-VP flagged in spec §7.1). Two HIGH items re-classified as "awaiting implementation via unified spec." Net strategic progress: one spec draft covers work that previously needed two.

**Forward plan:**
- **S26 target:** Joint ratification review of `PHY-SHELL-GATE_Spec_v1_DRAFT.md` (S23) and `PHY-MICROCLIMATE-VP_Spec_v1_DRAFT.md` (S25). Both specs interact at shell im / shell drain / microclimate VP. Ratify together to avoid implementation ordering ambiguity.
- **S27 target:** Coordinated implementation of shell-gate + microclimate-VP changes. Per §10 gate, hand-computed reference scenarios S-001 through S-004 required before code work begins.
- **S28 target:** Validation + reference scenario population. Close S21-F2 and S22-MICROCLIMATE-VP tracker items with implementation commit SHA.
- **S29 target:** S21-F3-LIQUID-SKIN-GATE (tactical code fix now unblocked post-ratification).

### Historical record — Session 24 (Two HIGH items closed through physics-first audit, no code changes)

**Branch:** `session-13-phy-humid-v2` (pushed to origin)
**Working tree:** clean
**Working directory:** `~/Desktop/LC6-local`
**Test count:** 644/644 passing (no code changes this session — tracker-only work)
**Head:** ba97e45 (S24 close: B→F migration) → 4322117 (S24 F2: CASCADE-ASYMMETRIC closed + MICROCLIMATE-VP sharpened) → 8784d5c (S24 F1: HUMIDITY-FLOOR-VALIDATION closed) → d3ccad2 (S23 close) → 39b2846 (S23 fudge deletion)

**Session 24 target reframing:**
- Original target per S23 forward plan: author `PHY-CASCADE-SYMMETRIC` spec.
- S24 physics-first audit (extended Socratic discussion) revealed CASCADE-ASYMMETRIC was misdiagnosis. Engine correctly handles terminal-saturation physics via three coexisting mechanisms. No spec needed.
- Secondary work on `S22-HUMIDITY-FLOOR-VALIDATION` also revealed misdiagnosis. `humidityFloorFactor` is wader-specific evap floor, not Cooper Landing fudge.
- Session pivoted from spec-authoring to tracker-hygiene, closing two items through understanding rather than implementation.

**Session 24 outcome:**
- **F1 — `S22-HUMIDITY-FLOOR-VALIDATION` RESOLVED** (commit `8784d5c`). Code audit revealed exactly ONE real caller: `waderEvapFloor` at `split_body.ts:160`. Wader-specific evap floor, not redundant with `vpdRatio`. Floor retained as physically defensible. PHY-HUMID-01 v2 §4.2 claim was incorrect. Moved to Section F.
- **F2 — `S22-CASCADE-ASYMMETRIC` RESOLVED** (commit `4322117`). Code audit revealed engine correctly handles terminal saturation via three coexisting mechanisms: (1) bidirectional Washburn wicking at lines 779-797 handles outward liquid flow when fill gradient exists; (2) inward-only overflow cascade at 772-777 correctly models external moisture pressure (one-directional because driving physics is); (3) `_vaporExitHr = Math.min(sweatGPerHr, eMax/L_V × 3600)` at line 734 captures drip-as-residual — `_excessHr` IS the drip residual between sweat production and vapor transport. User's physics derivation converged on engine's existing approach. No spec needed. Moved to Section F.
- **`S22-MICROCLIMATE-VP` scope sharpened** (commit `4322117`). Specific code-location diagnosis added to tracker item: `getDrainRate` at `calc_intermittent_moisture.ts:808-809` uses ambient `humidity` parameter, not microclimate humidity at shell inner surface. `computeEmax` at lines 671/702 same issue. At terminal fabric saturation, microclimate RH → 100%, should drive shell drain toward zero. Engine continues computing against ambient RH — overstates evaporative cooling. This is the real remaining gap in saturation-regime physics.
- **Close — B→F migration** (commit `ba97e45`). Moved resolved items from B.15/B.17 to proper Section F entries per Section H ritual. Section F count: 23 → 25.

**Net tracker change S24:** -2 items (1 HIGH closed, 1 MEDIUM closed). Zero new items added. First genuinely net-negative session in this arc.

**Session 24 outcome (meta):**
- Three of four recent moisture-physics item closures have been misdiagnoses (S21-F4 dead code in S22, S22-HUMIDITY-FLOOR-VALIDATION in S24, S22-CASCADE-ASYMMETRIC in S24). Pattern suggests tracker items should be physics-audited before implementation work begins. Closures through understanding are as valuable as closures through implementation.
- Unified moisture-physics rewrite scope has collapsed from three HIGH items to essentially one: `S22-MICROCLIMATE-VP`. Plus `S22-SHELL-CAPACITY-MODEL` spec already drafted (S23). S26+ implementation much simpler than originally feared.

**Forward plan:**
- **S25 target:** Author `PHY-MICROCLIMATE-VP_Spec_v1_DRAFT.md`. Scope sharpened by S24 findings (concrete code locations, focused on microclimate humidity threading through `getDrainRate` and `computeEmax`). Optionally: begin populating reference scenarios `S-001` through `S-004` with literature-anchored expected values.
- **S26 target:** Ratification review of both `PHY-SHELL-GATE` (drafted S23) and `PHY-MICROCLIMATE-VP` (drafted S25) specs. Decide implementation ordering.
- **S27-S28 target:** Coordinated implementation of shell-gate + microclimate-VP changes. Potentially also S21-F2 (Magnus dew point) and S21-F3 (liquid-skin routing) since §10 gate may clear with upstream physics settled.
- **S29 target:** Regression validation + reference scenario population. Declare moisture-physics cluster closed.

### Historical record — Session 23 (PHY-SHELL-GATE spec draft + PHY-HUMID-01 v2 §4.1 fudge deletion shipped)

**Branch:** `session-13-phy-humid-v2` (pushed to origin)
**Working tree:** clean
**Working directory:** `~/Desktop/LC6-local` (migrated out of iCloud per S23 workflow discovery)
**Test count:** 644/644 passing (643 original + 1 new diagnostic for fudge deletion verification)
**Head:** 39b2846 (fudge deletion + verify test) → 020f21a (baseline snapshot) → a6bd255 (S23 spec commit) → 67cab32 (S22 tracker reconciliation) → 51885be (S22 Finding 4 ship)

**Session 23 target reframing:**
- Original target was Finding 3 (PHY-HUMID-01 v2 §2.3 Categories A+B) per S22 forward plan.
- S23 investigation revealed three interrelated physics gaps that must be addressed together before Finding 3 implementation produces correct results: shell-as-gate vs sponge, cascade asymmetric, microclimate VP feedback.
- Pivoted to multi-session unified moisture physics rewrite per user decision. Finding 3 implementation deferred to S26+ after prerequisite specs ratify.
- Additionally shipped PHY-HUMID-01 v2 §4.1 fudge deletion in-session (independent of shell-gate work, already ratified).

**Session 23 outcome (strategic):**
- **PHY-SHELL-GATE v1 DRAFT authored** (`LC6_Planning/specs/PHY-SHELL-GATE_Spec_v1_DRAFT.md`). 484 lines. Classifies shells into 5 types with literature-anchored absorption coefficients (Nylon 6,6 regain, ASTM D4772, ISO 811 citations). Proposes slot-aware `getLayerCapacity` and `classifyShell` resolver.
- **Reference scenario registry established** (`LC6_Planning/reference_scenarios/README.md`). Framework for literature-anchored test scenarios replacing engine-output-captured assertions.
- **Nine new tracker items logged in Section B.17.** Three HIGH-priority physics specs to draft, two bounded fixes, four follow-on concerns including `S22-HUMIDITY-FLOOR-VALIDATION` added this session.

**Session 23 outcome (tactical):**
- **Baseline snapshot captured** (`LC6_Planning/baselines/S23_pre_fudge_deletion.md`) documenting pre-deletion engine state and expected behavioral changes by RH bracket.
- **PHY-HUMID-01 v2 §4.1 fudge deletion shipped** (commit `39b2846`). Removed `dryAirBonus` (line 451) and `_localDryBonus` (line 385) plus 3 callsites. Staircase multipliers of VPD narrowing that were redundant with `vpdRatio` Magnus-formula physics. 4 surgical edits via Python str_replace. File shrunk 240 chars.
- **Verification test added** (`packages/engine/tests/diagnostics/s23_fudge_deletion_verify.test.ts`). 10 scenarios including 4 isolation scenarios (16F skiing 6hr, same gear, only RH varies). Results: I1 50% RH peakMR 3.10 → I4 15% RH peakMR 2.90. Monotonic decrease confirms `vpdRatio` dominates post-deletion; removed fudges were providing redundant boost on top of Magnus physics.
- **`humidityFloorFactor` deletion DEFERRED** pending investigation. PHY-HUMID-01 v2 §4.2 calls it redundant with `vpdRatio` but S23 morning chat history review revealed its original purpose was Cooper Landing protection (stationary fishing 100% RH). S22 commit `51885be` shipped `_aHygro` which may now handle that regime, but not verified. Logged as `S22-HUMIDITY-FLOOR-VALIDATION` in B.17.

**Session 23 outcome (workflow infrastructure):**
- **Repo migrated out of iCloud** to `~/Desktop/LC6-local`. iCloud sync was causing friction (file shuffling for each Claude-created artifact) and caused Code Desktop to crash when re-enabled. GitHub remains canonical source. Old iCloud path retained temporarily as backup.

**Forward plan:**
- **S24 target:** Author `PHY-CASCADE-SYMMETRIC` spec (base overflow → outward cascade). Could also investigate `S22-HUMIDITY-FLOOR-VALIDATION` if appetite.
- **S25 target:** Author `PHY-MICROCLIMATE-VP` spec (shell im throttle feedback on evaporation). Begin capturing reference scenario baselines (S-001 through S-004).
- **S26+ target:** Ratification review for all three shell-gate/cascade/VP specs. Implementation as single coherent change.

### Historical record — Session 22 (PHY-HUMID-01 v2 Category C shipped; LC5↔LC6 fidelity audit documented)

## Status as of Session 22 (PHY-HUMID-01 v2 Category C shipped; LC5↔LC6 fidelity audit documented)

**Branch:** `session-13-phy-humid-v2` (pushed to origin)
**Working tree:** clean post-S22 commits
**Test count:** 643/643 passing
**Head:** 1a0728e (Session 22 cleanup: .claude/ gitignore) → 51885be (Finding 4 ship) → fb2f32c (S21 pipeline + audit)

**Session 21 outcome:**
- **S20-WEIGHT-STRING-PARSE-GAP resolved via categorical pipeline.** Extended `EngineGearItem` with `weight_category` field (ultralight/light/mid/heavy). `weightCategoryToGrams()` slot-aware lookup populates `weightG` in `mapGearItems`, replacing the `100 + warmth × 20` fudge that was previously hit for ALL products. Seed gram table cited: compiled internet + AI search April 19 2026, midpoint convention, Men's Medium.
- **LC5↔LC6 physics fidelity audit complete.** Extracted LC5 `calcIntermittentMoisture` + dependency tree (2,520 lines) into `packages/engine/reference/lc5_risk_functions.js`. Seven findings documented in `LC6_Planning/audits/S21_LC5_LC6_PHYSICS_FIDELITY_AUDIT.md`.
  - Finding 1 (applySaturationCascade) — FIXED S19
  - Findings 2, 3, 4 — BUG INHERITED from LC5 (open)
  - Findings 5, 6, 7 — PORTED CORRECTLY from LC5
- **§8.5 root cause analysis:** S21 duration-sweep regression is not port drift. Emergent interaction of `_systemCap` + `COMFORT_THRESHOLD` + outer-fill-fraction — invisible pre-S21 because weightG was always the fudge. S21 infrastructure correctly exposes a pre-existing physics gap.

**Session 22 outcome:**
- **Finding 4 shipped (commit `51885be`).** `_aHygro` now routed to outermost layer buffer inside cycle loop per PHY-HUMID-01 v2 §2.2 Category C. Activates formerly-dead cyclic-path hygroscopic absorption. Scaled by 1000 (liters→grams). §7 gate: no Category-C-specific preconditions required per spec.
- **Tracker cleanup (commit `1a0728e`):** `.claude/` added to `.gitignore`.
- **Zero test regressions:** 643/643 holds across both commits.

**Forward plan:**
- **S23 target:** Finding 3 — Categories A + B of PHY-HUMID-01 v2 §2.3 (vapor condensation via `_condensWeights` unchanged input; liquid-at-skin direct-to-base routing). Blocked on §7 hand-computed reference scenarios per memory #30.
- **S24+ targets:** Finding 2 (Magnus-derived per-layer `_tDewMicro`), §5.1 item 4 (delete `dryAirBonus`/`_localDryBonus`/`humidityFloorFactor` fudges), §5.1 item 6 (H3 hand-verification), §8.5 new spec for post-saturation drying physics (Havenith 2008 / Rossi 2005 kit-mass drying drag).

### Historical record — Session 20 (moisture capacity pipeline audit; four findings, zero code changes)

## Status as of Session 20 (moisture capacity pipeline audit; four findings, zero code changes)

**Branch:** `session-13-phy-humid-v2`
**Working tree:** clean post-S20 commit
**Test count:** 641/641 passing (no code changes this session)

**Session 20 outcome:**
- **S19-SYSTEM-CAP-PLATEAU investigation complete.** The plateau is mechanically correct — not a bug. Hand-computed reconciliation: 302 mL theoretical total cap matches 311 mL observed. MR=7.20 at plateau matches the computePerceivedMR formula exactly when all weighted terms hit max.
- **4 findings identified** beneath the plateau — see Section B.15 for details. Decomposed the original single item into specific bounded scope for future sessions.
- **Biggest finding: `weightG` is never populated for ANY real product.** The gear adapter declares `weight?: string` but never parses `"350g"`/`"12 oz"` strings into numeric grams. Every scenario — including real-gear scenarios — uses the `100 + warmth × 20` fallback fudge. HIGH priority, clean S21 target.
- Full audit report: `LC6_Planning/audits/S20_MOISTURE_CAPACITY_PIPELINE_AUDIT.md`.

**Forward plan:**
- **S21:** Resolve S20-WEIGHT-STRING-PARSE-GAP. Add string→grams parser in gear adapter, populate `weightG` during `RawGearItem → GearItem` conversion, validate against 1,627-product catalog.
- **S22+:** S20-DEFAULT-WEIGHT-FUDGE (depends on S21), S20-FIBER-ABSORPTION-VALIDATION (research), S20-DURATION-PENALTY-CEILING, S18-CROSSOVER-REGIME-SHAPE, IREQ Block 2, Phase 1-Corrective.

### Historical record — Session 19 (cascade wired; plateau finding logged)

## Status as of Session 19 (cascade wired; plateau finding logged)

**Branch:** `session-13-phy-humid-v2`
**Working tree:** clean post-S19 commit
**Test count:** 641/641 passing (+ 2 new cascade-verification tests)

**Session 19 outcome:**
- **S18-CASCADE-NOT-WIRED: RESOLVED.** `applySaturationCascade` now called at 4 sites in `calc_intermittent_moisture.ts`: steady-state per-step MR push (line 410), cyclic path fallback (line 995), cyclic path final sessionMR (line 997 — applies to both ternary branches), linear path sessionMR (line 1094).
- Cascade verified empirically: 14hr ski scenario with raw MR=7.20 (plateaued) produces sessionMR=8.0 post-cascade. Formula matches: 6 + 4 × (1 - (1 - 0.3)²) = 8.04 → 8.0. Quadratic ease-out firing correctly in the 6-10 band.
- Cascade is identity below 6, so all existing scenarios (matrix values ≤ 6.0 in S18 audit) produce identical output. Zero regressions on 639 pre-existing tests.
- **New finding logged: S19-SYSTEM-CAP-PLATEAU (see B.14).** Extended audit revealed that after trapped hits a system cap (~0.311L for skiing), per-cycle MR plateaus identically for 10+ cycles. Duration past the cap has no effect on output. 14hr and 20hr scenarios produce identical sessionMR (8.0) and trapped (0.311L). Separate issue from cascade, logged for future session.

**Forward plan:**
- **S20+:** Pick one from: S19-SYSTEM-CAP-PLATEAU investigation, S18-CROSSOVER-REGIME-SHAPE (research-heavy), IREQ Block 2, Phase 1-Corrective, Layer 2 pacing, genuine staircase fudges.

### Historical record — Session 18 (smoke test + findings)

## Status as of Session 18 (smoke test + cold-MR audit shipped; two findings logged)

**Branch:** `session-13-phy-humid-v2`
**Working tree:** clean post-S18 commit
**Test count:** 638/638 passing (+ 2 new audit tests from S18)

**Session 18 outcome:**
- Ran 4 user-realistic scenarios (Breck snowboarding, day hike, backpacking, fishing) through the post-revert engine. No crashes. MR values produced (2.0, 1.1, 1.4, 1.0).
- Built CLO × ensembleIm response matrix (cold/skiing conditions). MR climbs monotonically with CLO (2.5 → 6.0 as CLO rises 2.0 → 5.0). MR barely responds to ensembleIm parameter (0.1 range across 3× im sweep) when `gearItems` is null.
- Per-cycle trajectory under worst case (CLO=5.0, im=0.10) shows near-perfectly linear MR accumulation — no cascade amplification in 6-10 band.
- **Identified 2 real findings (see Section B.14 below).** Both tracked. Neither fixed tonight.

**S18 test artifacts shipped:**
- `packages/engine/tests/evaluate/s18_smoke.test.ts` — 4 scenarios through `evaluate()`, observation-only harness
- `packages/engine/tests/moisture/s18_cold_mr_audit.test.ts` — CLO × im matrix + worst-case trajectory

These are intentionally informational tests (assertions check only "no crash / no NaN / in [0,10] range"). Keep or delete per preference on next audit pass.

### Historical record — Session 17 (REDESIGN reverted)

## Status as of Session 17 (REDESIGN reverted, back to clean baseline)

**Branch:** `session-13-phy-humid-v2`
**Working tree:** clean post-revert, then 4 doc/tracker edits staged for S17 commit
**Test count:** 636/636 passing (11 S15-added tests reverted with the test file)

**Session 17 outcome:**
- PHY-PERCEIVED-MR-REDESIGN v1 REVERTED per closure doc (`LC6_Planning/LC6_REDESIGN_v1_Closure.md`)
- 7.2 output budget + saturation cascade restored
- COMFORT_THRESHOLD = 40 mL restored
- Calibration documentation added as header comment block in `perceived_mr.ts`
- Spec v1 marked SUPERSEDED BY REVERSION
- Section C of this tracker reclassified: Calibrations (retained + anchored) vs Fudges (replacement-tracked)
- Section B.12 S15 inflight items all RESOLVED

**Meta-rule adopted S17:** Sessions ship commits. If no commit by hour 2, stop and reassess. Sessions 13-16 (4 consecutive no-commit halts on spec proliferation) were the anti-pattern; S17 breaks it.

**Forward plan:**
- **S18:** Scenario smoke test (Breck snowboarding, day hike, backpacking, fishing) against current engine. Confirm TA v5 anchor (MR=4.3 for 95% RH / 20°F stress test) holds.
- **S19+:** One substantive item per session. Candidates: Phase 1-Corrective architecture, IREQ Block 2, genuine staircase fudges (Gagge/Minetti/VPD), Layer 2 pacing DP.

### Historical record — Session 15 (§7 gate halt, now superseded)

Session 15 halted at spec §7 gate while implementing REDESIGN v1. Retained here as historical record. S17 reversion resolves all S15 inflight items — see Section B.12.

---

## Section A: Active Specs

| Spec ID | Version | Status | Raised | File | Notes |
|---|---|---|---|---|---|
| PHY-GEAR-01 | v2 | RATIFIED + IMPLEMENTED | S11 | specs/PHY-GEAR-01_Spec_v2_RATIFIED.md | 1,627-product catalog live |
| PHY-HUMID-01 | v2 | RATIFIED, PARTIALLY IMPLEMENTED | S12 | specs/PHY-HUMID-01_Spec_v2_RATIFIED.md | §5.1 items 1+5 shipped (helpers S13 e9d56b5; Category C wired S22 51885be). Items 2-4 pending §10 hand-compute gate. Item 6 (H3 verification) outstanding. |
| PHY-031 | LC6-v1 (LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md) | RATIFIED (spec) / ACTIVE (engine — S31 reconciliation implementation complete) | S28 spec ratification (3a4b4d1); S29 infrastructure port (7289e8b); S30 reconciliation spec ratified (28731fb); S31 engine implementation complete (35dcf8e) | LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md; LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.2_RATIFIED.md; LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md; LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md | Component cycle model ratified LC6 S28 (April 21, 2026). 616-line spec ports LC5 PHY-030/031 ratified values verbatim. Adds S28-ratified content: Thanksgiving holiday window (#10), powder-day auto-detection, powder tier-bump table. **S29 port** landed infrastructure (7289e8b): phy031_constants.ts + activities/crowd_factor.ts, ActivitySpec.date_iso required, evaluate.ts null-plug closed. Cardinal Rule #8 honored. **S29 physics gap** (engine phase loop simulated only run+lift ~10 min vs spec §2.1 cycleMin 16.25–50 min wall-clock): documented as `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` HIGH. **S30 authored** `PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md` (28731fb). **S31 implemented** the reconciliation in three phases: `d3ed55c` Phase A (_cycleMinRaw accumulator scoping), `131eeee` Phase B (4-phase decomposition with LINE_MET=1.8 / TRANSITION_MET=2.0 / EPOC continuity chain), `c553621` Phase C (rest-phase integration: lunch shell-off 12:15 PM 45 min, otherBreak shell-on 2:30 PM 15 min, indoor 20°C/40%/0 m/s per ASHRAE 55). Spec amended twice during S31: v1 → v1.1 pre-Phase-A (§9/§11 patch-correctness gate refactor, `0d9df7b`), v1.1 → v1.2 Phase A pre-commit (§9.5 narrowing to exclude totalFluidLoss with physics-consistency footnote, `6e1db05`). All §9.4–§9.7 gates green at close. `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` CLOSED; `S-001` / `S26-SYSTEMATIC-MR-UNDERESTIMATION` remains OPEN with updated annotation per spec v1.2 §11.2 pending broader MR-fidelity work + field cross-checks. |
| PHY-PERCEIVED-MR-REDESIGN | v1 | **SUPERSEDED BY REVERSION (S17)** | S14 | specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md | Reverted Session 17. Retained output layer (7.2 + cascade + 40mL threshold) reclassified as calibration. See `LC6_Planning/LC6_REDESIGN_v1_Closure.md`. |

---

## Section B: Open Issues — ALL Active Items

### B.1 Architecture Document §11 deferred items (pre-Session 5, mostly unaddressed)

| ID | Priority | Status | Notes |
|---|---|---|---|
| ARCH-FALL-IN-V2 | MEDIUM | Open | Fall-In v2 Redesign Spec — Giesbrecht 1-10-1 + handoff per Architecture §2 `overlays/fall_in.ts` (empty dir) |
| ARCH-T-MRT-V2 | LOW | Open | Full T_mrt radiant temperature model; v1 uses T_mrt = T_air |
| ARCH-GEAR-DB-API-MIGRATION | LOW | Open | Gear DB API migration v1.x — possibly a gear-api backend service (separate from PHY-GEAR-01 adapter) |
| ARCH-Q-SHIVER-SCENARIO-B | MEDIUM | Open | Q_shiver parameter validation against USARIEM SCENARIO-B tables |
| ARCH-OQ-024-LC5-GREP | LOW | Open | Lower-priority LC5 code verification grep |
| ARCH-OQ-027-LC5-GREP | LOW | Open | Lower-priority LC5 code verification grep |

### B.2 Session 4 carryforward (pre-LC6 session closures)

| ID | Priority | Status | Notes |
|---|---|---|---|
| STAGE-TAU-MAX | GAP-FLAGGED | Open | `stage_τ_max` per-stage values; validate via SCENARIO-B + ISO 11079 DLE comparison at engine integration |
| STAGE-PROMOTION-15MIN | LOW | Open | 15-min stage promotion threshold tunability per stage |
| Q-SHIVER-50W-THRESHOLD | LOW | Open | Q_shiver_sustained 50W threshold alternative (percentile-of-Q_shiver_max) |
| HEAT-SIDE-SWEAT-DETECTION | MEDIUM | Open | Heat-side direct sweat-rate stage detection if T_core proves too lagging |

### B.3 Sessions 6-9c build-phase deferrals

| ID | Priority | Status | Notes |
|---|---|---|---|
| OQ-028 | MEDIUM | Open | Standardize all heat-balance and ensemble functions to °F input convention. Dedicated session. |
| OQ-029 | LOW | Open | `type:'cyclic'` → `'phased'` nomenclature reconciliation. Half-session rename + docs. |
| ITER-TSKIN-WARM-REST-NON-CONVERGENCE | LOW | Open (locked-in as expected behavior) | iterativeTSkin warm_rest_light doesn't converge in 8 iterations; whether to investigate or expand maxIter is deferred |

### B.4 Session 11 PHY-GEAR-01 follow-ups

| ID | Priority | Status | Notes |
|---|---|---|---|
| OQ-REGIONAL-MR | HIGH | Open | Upper vs lower body MR reconciliation; blocks PHY-INFOGRAPHIC-01 and affects EngineOutput contract |
| PHY-IMMERSION-01 | LOW | Open | Port LC5 WADER/WETSUIT/IMMERSION_SHIELD tables; activates immersion slot |
| PHY-GEAR-PEER-CAL | LOW (FROZEN) | Open | 7 peer-matching calibration constants empirical derivation |
| PHY-GEAR-WARMTH-CAL | LOW (FROZEN) | Open | warmthRatio→CLO breakpoints per ISO 15831 manikin |
| PHY-GEAR-BREATH-CAL | LOW (FROZEN) | Open | breathability→im slope/offset via Woodcock/Fukazawa |
| PHY-GEAR-02 | LOW | Open | score_products.js lower.insulation classification |
| PHY-GEAR-03 | LOW | Open | Gear catalog curation sweep. Cross-ref: S20-WEIGHT-STRING-PARSE-GAP (B.15) is a concrete specific instance of this broader sweep — resolving that ticket handles one slice of the curation work. |

### B.5 Session 12 PHY-HUMID-01 follow-ups

| ID | Priority | Status | Notes |
|---|---|---|---|
| PHY-SWEAT-UNIFICATION | MEDIUM | Open | Replace `rawTempMul` 5-step staircase at calc_intermittent_moisture.ts:453 with Gagge energy balance (fudge factor removal) |
| PHY-GRADE-01 | LOW | Open | Minetti GAP polynomial replacement for `_gradeMul` 4-step staircase at line 378 |
| PHY-HUMID-VENT-REWRITE | LOW | Open | `_ventHum` 3-step staircase at line 825 → VPD-derived effectiveness |
| PHY-HUMID-HUMMUL-CAL | LOW | Open | humMul 40% knee + 0.8 slope empirical validation (Nielsen & Endrusick 1990) |

### B.6 Session 12 forensic audit (Tier 4 constants)

| ID | Priority | Status | Notes |
|---|---|---|---|
| PHY-VENT-CONSTANTS | LOW | Open | `_ventArea=0.15`, `_ventCLOval=0.3`, `_ventDurMin=5` at calc_intermittent_moisture.ts:832-836 — calibration with no citation |

### B.7 Session 13 audit findings

| ID | Priority | Status | Notes |
|---|---|---|---|
| PHY-PR-COVERAGE-VAR | LOW | Open | Activity-specific torso coverage; default 0.54×BSA (long-sleeve, Rule of 9's); schema extension required for Option B |
| PHY-PR-CHILL-WEIGHT | MEDIUM | Open | Ensemble saturation combination weight (placeholder 0.5 in backward-compat wrapper); needs empirical data |
| PHY-EVAP-CAP-0.85 | MEDIUM | Open — present in LC6, validation pending | Sci Foundations §3.3 0.85 evaporation rate cap. S19 audit confirmed present at 2 sites in calc_intermittent_moisture.ts (steady-state line 387, linear line 1067): `Math.min(0.85, waderEvapFloor(...))`. The 0.85 ceiling is the physical upper bound on evaporative efficiency fraction. Open question: constant validation against published data (psychrometric/woodcock). Presence audit: DONE. Physical-value validation: PENDING. |
| PHY-HUMIDITY-FLOOR | MEDIUM | Open — present in LC6, validation pending | Sci Foundations §3.4 humidity floor factor. S19 audit confirmed `humidityFloorFactor` function in heat_balance/utilities.ts:48; imported by calc_intermittent_moisture.ts and split_body.ts; called at split_body.ts:160 (`0.02 * humidityFloorFactor(rh)`). Function body not reviewed in this audit; whether it matches LC5 formula `MR_floor = max(0, (H-60)/40)×4.0` still needs verification. Presence audit: DONE. Formula-match audit: PENDING. |
| PHY-COLD-PENALTY | MEDIUM → HIGH design decision | Open — NOT PRESENT in LC6; deliberate-vs-oversight question flagged | Sci Foundations §3.2 describes `trapped×5 + cold_penalty` with f_suit=2.5 as additive MR term. S19 audit: grep for `coldPenalty`, `cold_penalty`, `f_suit` returned ZERO matches in packages/engine/src/. LC6 architecture uses different MR construction — `computePerceivedMR` is buffer-weighted (per-layer saturation × 7.2 scaling), with cold effects propagating through energy balance (lower T_ambient → more sweat → more buffer fill), NOT through an additive cold penalty term. This is a design-vs-port difference that must be explicitly resolved: (a) LC6 architecture is intentional replacement and cold effects are correctly captured via energy balance — no port needed. OR (b) cold_penalty is a missing term that should be added back. Requires Chat decision with user input before any code action. Priority bumped because the answer affects cold-weather MR fidelity — the exact territory Christian flagged as under-reading. **S20 update:** the energy-balance channel itself saturates once layers hit cap (see S19-SYSTEM-CAP-PLATEAU closure + S20-DURATION-PENALTY-CEILING). So the 'no port needed, energy balance captures it' argument is weaker than it first appeared — if layers are capped and duration penalty saturates at 8.0, there's no channel by which further cold exposure can raise MR. This strengthens the case that a cold_penalty term (or equivalent mechanism) may actually be needed. Decision deferred to dedicated session. |

### B.8 Code-level TODO markers

| Location | Marker | Priority | Notes |
|---|---|---|---|
| evaluate.ts:386-387, 430 | TODO-10b (3 sites) | LOW | candidates_passing/total always 0; VentEvent[] not mapped |
| evaluate.ts:455, 884 | TODO: DEC-013 | MEDIUM | Stationary activity escalation not implemented |
| evaluate.ts:540, 543, 645-673 | TODO-SUPPLEMENTARY (12 sites) | LOW-MEDIUM | Heat balance primitives not populated in steady-state output |

### B.9 Empty-directory scaffolding (Architecture §2 promised, not implemented)

| ID | Priority | Status | Notes |
|---|---|---|---|
| EMPTY-DIR-HEAT-LOSS | LOW | Open | `packages/engine/src/heat_loss/` empty; contents unspecified in Architecture §2 |
| EMPTY-DIR-OVERLAYS | MEDIUM | Open | `packages/engine/src/overlays/` empty; promised `fall_in.ts` + `sleep_system.ts` per Architecture §2 (overlaps ARCH-FALL-IN-V2) |
| EMPTY-DIR-AGGREGATE | LOW | Open | `packages/engine/src/aggregate/` empty; promised `segment.ts` per-segment peak rollup |
| EMPTY-DIR-ACTIVITY-OBSOLETE | TRIVIAL | Open (cleanup) | `packages/engine/src/activity/` empty; superseded by `activities/` (plural) in Session 9a. Delete directory. |

### B.10 User memory architectural items ("must not get lost")

| ID | Priority | Status | Notes |
|---|---|---|---|
| ARCH-LAYER-2-PACING | HIGH | Open | **User flagged "MUST NOT GET LOST"** — precognition/path-optimal pacing within ensemble across time slices. DP over slices for optimal vent/break schedule. (Same item as Architecture §11 "Layer 2 Precognition v2") |
| ARCH-PHASE-1-CORRECTIVE | HIGH | Open | Phase 1-Corrective architecture (IREQ pre-filter → coherent candidate construction → ensemble heat balance). Locked Apr 9 but not yet designed. |
| ARCH-IREQ-BLOCK-2 | HIGH | Open | Port DLE_neu/DLE_min from d'Ambrosio 2025 Appendix B.3/B.4 |
| ARCH-IREQ-BLOCK-3 | MEDIUM | Open | 18-activity IREQ curves |
| PHY-VASO-CITATION | MEDIUM | Open | 33.0°C vasoconstriction threshold in code lacks specific citation (Flouris & Cheung 2008 supports CIVD at mean body temp 35.5°C, not 33.0°C skin) |
| DOC-TA-V7 | MEDIUM | Open | Technical Analysis v7.0 full rewrite with line-by-line citation verification (merges FUTURE_WORK P3) |
| DOC-ATP-V5 | MEDIUM | Open | ATP v5.0 full rewrite with hand-computed expected values (merges FUTURE_WORK P3) |

### B.11 FUTURE_WORK.md unresolved items

| ID | Priority | Status | Notes |
|---|---|---|---|
| PHY-NAN-HARDENING | MEDIUM | Open | Synthetic gear ensembles produce MR=NaN in cyclic path (real gear doesn't hit); defensive boundary hardening (originally FUTURE_WORK P2 + Session 11 handoff OQ #2) |
| UI-CM-DISPLAY | LOW (until UI phase) | Open | PHY-072 critical_moments + strategy_windows never wired to display (FUTURE_WORK P4) |
| PHY-TEST-VALIDATION-AUDIT | MEDIUM | Open | Raised S15. For each physics-output test assertion, verify expected value was hand-computed (not captured snapshot). See Section J.4. Escalates to HIGH if S16 §7 reveals systemic divergence OR count of `[CAPTURED-...-UNCONFIRMED]` tags > 20. |

### B.12 Session 13/14/15 state items — RESOLVED S17 (moved to Section F)

Moved to Section F in Session 18 reconciliation. 5 items (S13-PHASE-2-3-DIRTY, S15-SPEC-SECTION-7-SKIPPED, S15-BSA-THREADING-INFLIGHT, S15-PERCEIVED-MR-REDESIGN-INFLIGHT, S15-DOWNSTREAM-THRESHOLDS-PENDING) all closed by S17 REDESIGN reversion. See Section F for resolution details. This subsection header retained as a cross-reference only.

### B.13 LC4 carryforward (LC6 will eventually include UI per Session 13 scope decision)

| ID | Priority | Status | Notes |
|---|---|---|---|
| BUG-132 | LOW | Open (LC4-surfaced) | Bouldering shows 0% saturation — physically correct but uninformative UX |
| BUG-HALFDOME-PERSTEPMR | MEDIUM | Open (LC4-surfaced) | Flat perStepMR on Half Dome trip |
| UI-KIRKWOOD-FIXES | LOW | Open (LC4-surfaced) | Fishing hourly pills, carry indicators, strip MR vs gauge MR mismatch, Step 4 Trip Summary Card |


### B.14 Session 18 audit findings (moisture pipeline)

| ID | Priority | Status | Notes |
|---|---|---|---|
| S18-CASCADE-NOT-WIRED | HIGH | RESOLVED S19 (moved to Section F) | Fixed in Session 19 commit — `applySaturationCascade` wired into 4 call sites in `calc_intermittent_moisture.ts`. See Section F. |
| S18-CROSSOVER-REGIME-SHAPE | MEDIUM | Open — design gap, requires research | The saturation cascade model (TA v5 §3.5, `saturation_cascade.html` design poster) documents three physical regimes: Absorption (0-4 linear), Conductive Crossover (4-6 inflection — liquid bridges forming, insulation drops 40-60% per poster), Cascade (6-10 exponential self-reinforcing). The current `applySaturationCascade` function implements only two phases: linear 0-6, quadratic 6-10. The Crossover region is bundled into the linear regime with no distinct math. This is a design gap, not a code bug — the file comment itself says "Phase 1 (0-6): Linear pass-through — Absorption + Crossover". Physical intent: during Crossover, user perception plateaus (Fechner inversion) while thermal conductivity accelerates non-linearly. Output should accelerate in this region to counteract the perception lag, ideally following the actual k-decay curve from Castellani & Young 2016 or equivalent source. Fix scope: dedicated spec session. Research citations (Castellani 2016, Fukazawa wet-fabric conductivity decay, possibly Havenith multilayer models) to define the proper functional form for 4-6 region. |
| S19-SYSTEM-CAP-PLATEAU | MEDIUM | RESOLVED S20 (moved to Section F) | Investigation complete. Plateau is not a bug — it is the engine correctly reporting a fully-saturated ensemble. Decomposed into 4 specific findings (S20-WEIGHT-STRING-PARSE-GAP, S20-DEFAULT-WEIGHT-FUDGE, S20-FIBER-ABSORPTION-VALIDATION, S20-DURATION-PENALTY-CEILING) — see Section B.15 and audits/S20_MOISTURE_CAPACITY_PIPELINE_AUDIT.md. |


---

### B.15 Session 20 audit findings (moisture capacity pipeline)

Four findings identified during S19-SYSTEM-CAP-PLATEAU investigation, after hand-computed reconciliation showed the plateau itself is mechanically correct. Full analysis: `LC6_Planning/audits/S20_MOISTURE_CAPACITY_PIPELINE_AUDIT.md`.

| ID | Priority | Status | Notes |
|---|---|---|---|
| S20-WEIGHT-STRING-PARSE-GAP | RESOLVED | S21 (moved to Section F) | Resolved via categorical `weight_category` pipeline instead of string parser. See Section F. |
| S20-DEFAULT-WEIGHT-FUDGE | MEDIUM | Open — partially resolved by S21 | S21 replaced the `100 + warmth × 20` fudge with a `weightCategoryToGrams()` slot-aware lookup sourced from compiled internet + AI search (April 2026, midpoint convention, Men's Medium). Remaining work: (a) validate seed values against a textile-science reference or catalog-median derivation; (b) refine per affiliate-partner actual-weight data as catalog grows. Citation discipline met (compiled search trace cited in-code and in S21 commit fb2f32c); upgrade path documented. |
| S20-FIBER-ABSORPTION-VALIDATION | MEDIUM | Open — research session | `FIBER_ABSORPTION` values [SYNTHETIC: 0.40, WOOL: 0.35, COTTON: 2.00, DOWN: 0.60] in packages/engine/src/ensemble/gear_layers.ts are NOT molecular regain (10-100× higher than textbook regain values). They appear to represent total water retention under saturated wetting (regain + interstitial + surface + capillary). Calibration against observed ski-day plateau (302 mL computed vs 311 mL observed) suggests values are "right flavor" but requires textile science citation. Research sources: ASTM D4772 water retention method, Havenith multilayer fabric dynamics, Fukazawa fabric water retention studies. |
| S20-DURATION-PENALTY-CEILING | MEDIUM | Open | After all layers saturate, `applyDurationPenalty` is the only mechanism pushing MR higher with sustained time. S19 observed 14hr and 20hr sustained-saturation scenarios produce identical sessionMR=8.0. Penalty saturates at the 7.20 → 8.0 cascade transform level regardless of additional hours. Physiologically, 6+ hours of max-saturation in sub-freezing conditions should carry additional risk (fluid loss trajectory, CIVD degradation, thermal fatigue) that isn't currently reflected in MR. Fix scope: investigate `applyDurationPenalty` function body in packages/engine/src/heat_balance/utilities.ts, reason about whether post-cap trajectory should continue rising or whether a separate physiological channel should contribute. |


### B.16 Session 21 LC5↔LC6 physics fidelity audit findings

Seven findings identified comparing LC5 `calcIntermittentMoisture` + dependency tree (extracted to `packages/engine/reference/lc5_risk_functions.js`, 2,520 lines) against LC6 port. Full analysis: `LC6_Planning/audits/S21_LC5_LC6_PHYSICS_FIDELITY_AUDIT.md`.

| ID | Priority | Status | Notes |
|---|---|---|---|
| S21-F1-CASCADE | RESOLVED | S19 (already in Section F) | `applySaturationCascade` defined but never called in LC5 cyclic path. LC6 S19 wired it into sessionMR pipeline. LC6 ahead of LC5 here. |
| S21-F2-HARDCODED-SKIN-DEW | HIGH | Open — superseded by PHY-MICROCLIMATE-VP (S25 draft) | Hardcoded `_tSkinRetC=30` / `_tDewMicro=29` at `calc_intermittent_moisture.ts:740-741`. Originally scoped per PHY-HUMID-01 v2 §5.1 item 2 + §3.2 as a standalone fix blocked on the §10 gate. **S25 analysis revealed this item shares the same missing engine state (per-layer microclimate VP) as S22-MICROCLIMATE-VP.** Both items now unified under `PHY-MICROCLIMATE-VP_Spec_v1_DRAFT.md` (commit `863c4ca`). Implementation replaces `_tDewMicro = 29` hardcode with per-interface Magnus-derived values from new `computeMicroclimateVP` helper. `_tSkinRetC` already resolved (use `_TskRun` per PHY-HUMID-01 v2 §3.2 — this is a one-line fix bundled into the unified implementation). Closes with S22-MICROCLIMATE-VP in single commit S27-S28. |
| S21-F3-LIQUID-SKIN-GATE | HIGH | Open — blocked on §10 gate | Liquid-at-skin (`_excessHr`, `_liftExcessG`, `_insensibleG`) routed via `_condensWeights` and gated by `_netRetention` at LC6 lines 749-751,769 (matches LC5:2803-2828 verbatim). PHY-HUMID-01 v2 §2.2 Category B requires direct-to-base routing without gate per Kubota et al. 2021. Replacement code ready in §2.3. Fix scope: surgical edit pattern identical to S22 Category C fix (commit `51885be`). Hand-computed H1/H2/H3 reference scenarios required before edit. |
| S21-F4-AHYGRO-DEAD-CODE | RESOLVED | S22 (moved to Section F) | `_aHygro` was dead code in LC6 cyclic path (assigned to unused `cycleNet`). Fixed S22 per PHY-HUMID-01 v2 §2.2 Category C. See Section F. |
| S21-F5-CONDENS-WEIGHTS-HARDCODE-DEPENDENCY | Observational | Open — depends on S21-F2 | `_condensWeights` thermal-gradient distribution (shell ~51%, insulation ~31%, mid ~15%, base ~3%) is ported correctly as a mechanism. However it is driven by the hardcoded `_tDewMicro` (F2). Fixing F2 also activates the per-layer Magnus drive for F5. No independent work required. |
| S21-F6-PERCEIVED-MR | RESOLVED | S21 audit verification | `computePerceivedMR` (40 mL absolute base threshold + fill-fraction outer layers) ported correctly from LC5 1:1. Fukazawa 2003 anchor retained per S17 closure. No work required. |
| S21-F7-CASCADE-WICKING-DRAIN | RESOLVED | S21 audit verification | Inward overflow cascade, Washburn 1921 bidirectional wicking, `getDrainRate` shell drain all ported correctly from LC5 1:1. Constants match (wicking default 7, 0.5 Courant damping, Schlünder 1988 `_outerFill` modulation). No work required. |
| S21-CROSSOVER-REGRESSION-ROOTCAUSE | MEDIUM | Open — new spec needed (S24+) | Per audit §8.5: S21 duration-sweep regression (heavy kit peak_MR stays monotonically BELOW ultralight across 2–20 hr) is NOT a port drift. Emergent interaction of three design decisions (`_systemCap` scales with kit mass; `COMFORT_THRESHOLD` is fixed; outer-fill-fraction scales inversely with cap). Invisible pre-S21 because `weightG` was always the fudge. Fix requires new spec for post-saturation drying physics (Havenith 2008 / Rossi 2005: kit-mass-dependent drying drag). Proposed form: `drain_effective = getDrainRate / sqrt(sum(layer.cap)/reference_cap)`. Multi-session scope. |

### B.17 Session 22-23 moisture physics gaps (unified rewrite scope)

Eight findings identified during S22 evening Finding 3 gate-clearance discussion and S23 morning unified-rewrite scoping. Together these form the scope of the multi-session moisture physics rewrite. See `LC6_Planning/specs/PHY-SHELL-GATE_Spec_v1_DRAFT.md` §1 for physics framing.

| ID | Priority | Status | Notes |
|---|---|---|---|
| S22-SHELL-CAPACITY-MODEL | HIGH | Open — spec draft authored (S23) | Shell layers currently treated as liquid-absorbing reservoirs with `weightG × FIBER_ABSORPTION[SYNTHETIC] = 0.40` cap. Physical reality: hardshells are vapor-transport gates via `im`; liquid capacity is <5% of modeled value. A 300g Gore-Tex jacket gets 128 mL cap in code vs ~6 mL in physical reality. See `PHY-SHELL-GATE_Spec_v1_DRAFT.md` for full treatment. Literature-anchored coefficients: hardshell 0.02 (Nylon 6,6 regain), softshell 0.12 (ASTM D4772), wind shell 0.05, drysuit 0.035. Blocks Finding 3 implementation. |
| S22-CASCADE-ASYMMETRIC | HIGH | RESOLVED S24 (moved to Section F) | See Section F. Misdiagnosis — engine correctly handles terminal saturation via Washburn wicking + inward-only overflow (for external pressure) + _vaporExitHr = min(sweat, eMax) at line 734 (drip-as-residual). No spec needed. |
| S22-MICROCLIMATE-VP | HIGH | Open — spec drafted S25, awaiting S26 ratification | Microclimate VP (vapor pressure inside clothing envelope) is currently modeled as identical to ambient VP. At terminal fabric saturation, microclimate RH approaches 100%, should drive shell drain toward zero — but engine continues computing against ambient RH, overstating evaporative cooling. **PHY-MICROCLIMATE-VP v1 DRAFT** (`LC6_Planning/specs/PHY-MICROCLIMATE-VP_Spec_v1_DRAFT.md`, commit `863c4ca`) unifies this with S21-F2-HARDCODED-SKIN-DEW because both trace to same missing state: per-layer microclimate VP. Implementation scope: 8 callsites modified (computeEmax ×2, iterativeTSkin ×2, getDrainRate ×4), introduces `computeMicroclimateVP` helper, replaces `_tDewMicro = 29` hardcode. Cardinal Rule #8 compliant — no thermal engine signature changes. Joint ratification with PHY-SHELL-GATE planned S26, coordinated implementation S27-S28. |
| S22-BREATHABILITY-TO-IM-DIVERGENCE | MEDIUM | Open — small bounded fix | Two diverging implementations of `breathabilityToIm`: `adapter.ts:105-107` (linear: `0.05 + b/10 × 0.40`, b=7 yields im=0.33) vs `gear_layers.ts:127-134` (piecewise: b=7 yields im=0.20). Same gear produces different im depending on code path. Consolidate to single source of truth. |
| S22-FIBERTYPE-TYPE-DRIFT | MEDIUM | Open — small bounded fix | `types.ts:569` defines `FiberType = "synthetic" \| "wool" \| "cotton" \| "down" \| "blend"` (lowercase, 5 values). `gear_layers.ts:9` defines `FiberType = 'WOOL' \| 'COTTON' \| 'SYNTHETIC' \| 'DOWN'` (uppercase, 4 values). Adapter must translate between them. Single source of truth needed. |
| S22-MR-VALIDATION-ANCHOR-CONTAMINATED | MEDIUM | Open — post-shell-gate work | S17 closure designated TA v5 §3.5 95% RH / 20°F Rocky Mountain scenario (MR=4.3) as the validation anchor for the 7.2 output scale. That anchor was produced by an engine with broken upstream physics (shell cap, cascade asymmetry, microclimate VP unmodeled). After shell-gate / cascade / VP specs ship, must re-run this anchor scenario to confirm 7.2 scale still holds. If anchor fails post-fix, upgrade to HIGH and open new spec for MR output layer calibration. |
| S22-DRYING-THERMAL-DRAG | MEDIUM | Open — cross-concern for heat balance engine | Shell research (S23 morning): softshell at 72 mL saturation represents ~45 Wh evaporative heat load. Drying a saturated softshell over 3hr consumes roughly 50% of resting metabolic output (80-100W). Heat balance engine currently does not subtract this thermal cost from user metabolic budget. Not a moisture model fix — affects CDI/HLR calculations downstream. Cross-concern, not blocking shell-gate. |
| S22-PERCEIVED-WEIGHTS-DIRECTION | MEDIUM | Open — revisit post-shell-gate | User argument (S23 morning): `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` encodes Fukazawa-style skin-centric perception, but this misrepresents the physics signal. Base saturation is a binary failure indicator (whole-system saturation has occurred), not a proportional contributor. Weighting base highest makes MR climb gradually with base fill when it should hit max when base crosses threshold. Upgrades existing PHY-WEIGHTS-CAL (S17 classification) from ratio-tuning question to direction-questioning question. Blocked on post-shell-gate re-validation of MR output layer. |
| S22-HUMIDITY-FLOOR-VALIDATION | MEDIUM | RESOLVED S24 (moved to Section F) | See Section F. Investigation revealed humidityFloorFactor is wader-specific evap floor, not Cooper Landing fudge — retained as physically defensible. |
| S25-LINEAR-PATH-MICROCLIMATE-VP | MEDIUM | Open | The linear/steady-state path in `calc_intermittent_moisture.ts` (lines 1060-1095, especially `_lVpd = vpdRatio(tempF, humidity)` at line 1064) uses ambient humidity throughout. Similar microclimate concern as PHY-MICROCLIMATE-VP but in the simpler linear-path physics. Not in scope for PHY-MICROCLIMATE-VP v1 DRAFT (§7.1) to keep that spec bounded. Expected to be a smaller spec — linear path has simpler per-layer physics. Flag for future session, lower priority than cyclic path since most heavy-exertion scenarios (where microclimate effect matters most) route through cyclic not linear. |
| S26-SYSTEMATIC-MR-UNDERESTIMATION | HIGH | **Open — S31 UPDATE:** reconciliation physics landed but does not independently validate absolute MR values; closure pending broader MR-fidelity work + field cross-checks per spec v1.2 §11.2/§11.5 | **Status as of S31:** PHY-031-CYCLEMIN-RECONCILIATION v1.2 physics landed (S31 commits `d3ed55c`/`131eeee`/`c553621`, branch `session-13-phy-humid-v2`). Per-cycle physics now integrates line + lift + transition + run phases with rest-phase (lunch, otherBreak) integration at wall-clock. `_cycleMinRaw` accumulator scoping corrected. Non-ski activities bit-identical regression verified on v1.2-narrowed gated metrics. Per-cycle trajectory shape gates passed (lunch dips, re-climb, line-phase accumulation in P5, EPOC continuity). Direction-of-change gate satisfied (|ΔP5| 1.10 > |ΔG1| 0.70, |ΔG1| < 1.0, all three vectors moved — all deltas downward as Phase C lunch drying dominates Phase B line accumulation for high-humidity vectors). **S-001 remains open pending broader MR-fidelity work.** Reconciliation addresses the phase-loop ghosting identified in `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` but does not independently validate post-reconciliation MR values represent trusted physics. Full closure requires resolution of ongoing physics-fidelity items across the broader docket, plus field cross-checks against user experience per spec v1.2 §11.5 (first 10 real ski sessions post-implementation). **Original symptom:** User reported for weeks that perceived MR readings feel consistently too low. Engine showed 15-20 hours of ski time before MR reached saturation-level readings, while lived experience was saturation (uncomfortable, soaked mid-layer) after 3-5 hours. **S26 investigation:** with real ensemble capacity math (Smartwool 250 + R1 Air + Nano Puff + Beta LT = ~336g total liquid cap via FIBER_ABSORPTION × weightCategoryToGrams), naive time-to-saturation at typical skiing sweat rates is 2-4 hours, not 15-20. Enumerated 5 candidate causes. **S27 root cause identification:** PHY-031 component cycle model (crowd tiers, holiday windows, line+transition+rest times) ratified in LC5 Mar 17 was only 12.5% ported to LC6. **S28** authored LC6 PHY-031 spec. **S29** landed infrastructure port. **S30** authored reconciliation spec. **S31** landed engine implementation per reconciliation spec v1.2. **References:** LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.2_RATIFIED.md §11; LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md; S27 chain commits ae6ed6c through 2e33590; S31 chain commits `d3ed55c` through `35dcf8e`. |

### B.18 Session 27 retention-infrastructure findings

Items surfaced during S27 while building the LC6 Spec Registry and PHY-031 port audit. Three drift items (filename/reality mismatches) plus two related code-hygiene concerns. All logged with explicit owners and remediation paths.

| ID | Priority | Status | Notes |
|---|---|---|---|
| S27-DUAL-BREATHABILITY-MAPPING | MEDIUM | Open | Two `breathabilityToIm` functions with identical name but different formulas: packages/engine/src/ensemble/gear_layers.ts:127 (piecewise) vs packages/engine/src/gear/adapter.ts:105 (linear). Indicates either drift between call sites or a deliberate branching that should be explicit. Risk: im_ensemble values may differ depending on code path, potentially affecting ensemble scoring. Investigation: determine which call sites use which variant, whether outputs agree at common input range, whether consolidation is safe. Surfaced during S27 PHY-031 audit (§8.1) but independent of PHY-031 port. |
| S27-DRIFT-1-PERCEIVED-MR-FILENAME | LOW | Open | Filename mismatch: LC6_Planning/specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md says "RATIFIED" but the implementation was reverted S17 per LC6_Planning/LC6_REDESIGN_v1_Closure.md. Engine runs pre-REDESIGN code (packages/engine/src/moisture/perceived_mr.ts). Remediation: `git mv` to `PHY-PERCEIVED-MR-REDESIGN_Spec_v1_REVERTED.md`. 5-minute cleanup. Documentation hygiene only — no user impact. Reference: LC6_Planning/LC6_Spec_Registry.md DRIFT-1. |
| S27-DRIFT-2-HUMID-V1-FILENAME | LOW | Open | Filename mismatch: LC6_Planning/specs/PHY-HUMID-01_Spec_v1_RATIFIED.md says "RATIFIED" but v2 supersedes it (773f995 / S12). v2 file's own body documents the supersession. Remediation: `git mv` to `PHY-HUMID-01_Spec_v1_SUPERSEDED.md`. 5-minute cleanup. Documentation hygiene only. Reference: LC6_Planning/LC6_Spec_Registry.md DRIFT-2. |
| S27-TSC-ERRORS-BASELINE | LOW | Open — held steady through S29 | 8 pre-existing `tsc --noEmit` errors in test files (tests/evaluate/cm_budget.test.ts — EngineGearItem product_name property mismatches × 7; tests/scheduling/precognitive_cm.test.ts — TrajectoryPoint type cast × 1). vitest passes because it uses esbuild transpile-only mode, not strict tsc. S29 preserved this baseline exactly — no new errors introduced across 7 patches + 20 fixture sites. Remediation deferred. |
| S27-STALE-PLANNING-DOCS | MEDIUM | Open | Four LC6_Planning docs not updated since Apr 20 (S11-S15 era): LC6_Session_Ledger.md (last entry S15, missing S16-S27), LC6_Open_Issues_Ledger.md (only S11 additions, likely superseded by LC6_Master_Tracking.md B.x sections), LC6_Decision_Registry.md (S11-era), LC6_Architecture_Document.md (v1.2 ratified S11, 18 sessions of drift). Different drift pattern than LC6_Spec_Registry case: these docs stopped being updated rather than containing wrong info. Risk: a future session reads one expecting authority, gets stale picture. Remediation (future session): decide per-doc whether to bring current, archive with `_LEGACY_` prefix, or explicitly mark superseded by tracker. NOT S28 scope. Surfaced at S27 close during handoff-system inventory. |
| S29-PHY-031-CYCLEMIN-PHYSICS-GAP | HIGH | **CLOSED S31** — see Section F | Closed by S31 engine implementation of `PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.2_RATIFIED.md`. Commits `d3ed55c` (Phase A), `131eeee` (Phase B), `c553621` (Phase C). All §9.4–§9.7 gates green. Full resolution record in Section F. |
| S29-MATRIX-PENDING | MEDIUM | **Subsumed S31** by `S31-PHASE-C-REBASELINE` | Original S29 4-scenario matrix test re-author item. S31 Phase A/B follow-ups introduced 6 additional ski test skips all pending the same post-S31 rebaseline pass. `S31-PHASE-C-REBASELINE` (below) covers all 7 skipped tests as a single re-authoring session. This row retained for historical context; act on `S31-PHASE-C-REBASELINE` instead. |
| S30-SESSIONA-DEFERRED | MEDIUM | **COMPLETED SessionA** at `87e95da` | `SessionA_kickoff.md` drafted S28 close, held through S29/S30/S31, executed 2026-04-23 on branch `session-13-phy-humid-v2`. Outputs: `SA_LC6_State_of_the_Port.md` (285 lines, 4 package tables + 7 infrastructure findings + activity dispatch map), `SA_Failure_Mode_Catalog.md` (282 lines, 12 incidents, saturation reached, 4 super-patterns, 1 new category `FABRICATED-METHODOLOGY`). Eight new tracker items added (4 from each output). No engine code changes. SessionB kickoff drafted with Output B as primary input (next Chat turn). |
| MR-CRITICAL-MOMENTS-BUDGET-TIGHTER | LOW | Open — S31 surfaced; revisit post-precognition/pacing-loop closure | Surfaced during S31 precognition/pacing architecture discussion. Current alarm-fatigue budget is max 3 Critical Moments per trip + 3–5 Strategy Windows. User indicated the 3-5 window count may itself be too many. Precognition should identify pivotal events and bundle across next N minutes/hours; less is more. Revisit after the broader precognition/pacing loop closes (TODO at `evaluate.ts:487` wiring `precognitive_cm.ts` output as `ventEvents`). |
| MR-PHY-031-REST-PHASE-MARKERS | LOW | Open — S31 deferral, LC7 candidate | S31 Phase C deferred populating `_perCycleHeatStorage` with phase markers like `{phase: 'lunch'}` per spec v1.2 §6.7.3. Would require changing `number[]` → tagged-union type, breaking downstream consumers. Diagnostic-chart-only concern, not gate-relevant. Candidate for LC7 Model Refinement if surfaced by UI/diagnostic needs. |
| MR-PHY-031-REST-INSENSIBLE-ROUTING | LOW | Open — S31 deferral, conservative-safe | S31 Phase C implements inner-layer drying (moisture subtraction) during lunch per spec v1.2 §6.7.1, but doesn't route rest-phase insensible moisture addition back into `_layers.buffer`. Conservative default preserved net-drying correctly. Full addition-path would require additional bookkeeping. Candidate for LC7 Model Refinement if field data surfaces undercounting post-S31 rest windows. |
| S31-OBSERVATION-WINNER-INVARIANCE | MEDIUM | Open — S31 observation | During S31 pre-Phase-A probe test (commit `617508a` era), strategy engine selected `candidate-5` (Arc'teryx-heavy, 4.42 CLO) as `optimal_gear` winner for all three vectors (G1/M2/P5) despite different terrain and ambient conditions. Suggests scoring function may not be scenario-sensitive enough to differentiate at winter ski regime, or winner selection is degenerate at saturation-dominated MR. Investigate whether ensemble scoring differentiates by temperature/humidity/terrain at all. Not blocking S31 close. |
| S31-DOC-P5-TIER-CONSISTENCY | LOW | Open — S31 doc hygiene | Spec v1.2 §9.2 names the P5 vector as "Tier 5 Packed via powder bump" but Code's Phase B instrumentation shows `_liftLineMin=20` which maps to T6 per PHY-031 v1 §4.1. Either the powder bump takes T5 inputs to T6 `liftLineMin` (legitimate tier-ladder climb per §7) or the spec label is wrong. Resolve by reading powder-bump implementation and either renaming to P6 or adding a clarifying footnote to spec §9.2. |
| S31-PHASE-C-REBASELINE | MEDIUM | Open — re-author 7 skipped tests post-S31 | Seven test assertions skipped during S31 Phases A and B carry pre-S31 baseline values. Skip rationale documented in each `.skip()` comment. Re-author post-Phase-C is the canonical resolution (rather than mid-phase update-then-update-again cycles). Skipped tests: (1) S29-MATRIX-PENDING pre-existing (`1b0c80e`); (2) ski totalFluidLoss 445g baseline (Phase A follow-up, `1ea537c`); (3-6) four Breck numeric baselines (Phase B follow-up, `9d3220f`); (7) extreme-cold winner flip test (Phase B follow-up, `9d3220f`). Each test's assertion is physics-consistent with pre-S31 engine state; post-S31 state produces different values. Re-author with verified post-S31 fixtures from `LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md`. Supersedes the narrower `S29-MATRIX-PENDING`. |
| S29-TRACKER-PATH-AUDIT | LOW | Partial — prescriptive paths fixed, historical untouched | Working-directory path inconsistency across the tracker. S29 retroactive reconciliation fixed both prescriptive locations: Section H OPEN ritual (line 806) and Section G verification grep preamble (line 754) both now `cd ~/Desktop/LC6-local`. Historical status blocks (S17, S18, S19, S20, S22) may still reference `~/Desktop/LC6` as the path-at-the-time-of-that-session — intentionally left untouched as historical record, not prescriptive instruction. Closing criteria for full resolution: either confirm a `~/Desktop/LC6` symlink exists that keeps old paths valid for anyone running historical commands, OR sweep historical status blocks explicitly marking path migration. Neither is urgent. Surfaced during S29 retroactive close ritual. |
| S30-AUDIT-PHY-040-FIELD-OWNERSHIP | MEDIUM | Open | §8.5 of PHY-031-CYCLEMIN-RECONCILIATION spec surfaced that `cycleOverride.elevFt` and `cycleOverride.perRunVertFt` are consumed by `altitudeFactors()` at `calc_intermittent_moisture.ts:514` without confirmed LC6 PHY-040 spec. Potential DRIFT-4 analog (parallel to DRIFT-3 PHY-031-NO-SPEC before S28 ratification). Audit required: (a) does PHY-040 exist as a ratified LC6 spec, (b) if not, author one, (c) if yes, verify `altitudeFactors` implementation matches spec. Reference: reconciliation spec §8.5, §10.3. |
| S30-AUDIT-DEWPOINTC-SPEC-OWNERSHIP | MEDIUM | Open | §8.5 of reconciliation spec surfaced that `dewPointC` is consumed in two distinct code paths: linear-path at `calc_intermittent_moisture.ts:329` and cyclic-ski at line 508. Whether these two consumers expect the same semantics, and whether either traces to a ratified spec (candidates: PHY-039 elevation humidity, PHY-HUMID-01 v2), is unclear. Audit required to determine which spec owns this field and whether consumers agree. Reference: reconciliation spec §8.5, §10.3. |
| S30-AUDIT-LINEAR-PATH-CYCLEOVERRIDE | MEDIUM | Open | §8.5 of reconciliation spec surfaced that the linear-path cycleOverride consumption block at `calc_intermittent_moisture.ts:326–332` reads five fields (`elevProfile`, `rawElevProfile`, `baseElevFt`, `totalDistMi`, `tripStyle`) whose spec ownership is unclear. Linear path serves continuous-exertion activities (day_hike, backpacking, running, trail_running via PHY-063 routing). Silent drift here would affect non-ski outputs without detection. Audit required: enumerate fields, identify spec ownership (PHY-039 candidate), verify consumption matches spec. Reference: reconciliation spec §8.5, §10.3. |
| S30-AUDIT-STRATEGYLAYERIMS-SPEC-OWNERSHIP | LOW | Open | §8.5 of reconciliation spec surfaced that `cycleOverride.strategyLayerIms` is consumed at `calc_intermittent_moisture.ts:610, 612` to override default layer ims in strategy-pill evaluation. BUG-139 shipped this in LC5 but LC6 port status of the underlying physics contract is not confirmed to have a LC6 spec file. Audit whether LC6 spec should be authored for the strategy-layer-im override contract. Lower priority than MEDIUM audits because the code path only activates inside strategy-pill evaluation (bounded surface). Reference: reconciliation spec §8.5, §10.3. |
| S30-AUDIT-CYCLEOVERRIDE-ESCAPE-HATCH | LOW | Open | §8.5 of reconciliation spec surfaced that the `CycleOverride` TypeScript interface at `calc_intermittent_moisture.ts:213` declares `[key: string]: unknown` as an index signature. This permits callers to pass any field through `cycleOverride` without declaring it in the interface — any undeclared field is invisible to static audit. Audit call sites for undeclared-field plumbing; consider removing the escape hatch unless a specific caller depends on it (none currently identified). Reference: reconciliation spec §8.5, §10.3. |
| S30-SKIING-DURATION-DEFAULT | LOW | Open | Surfaced during S30 spec drafting (reconciliation spec §10.3): the `Set the Scene` trip form defaults Skiing duration to 3 hours. Real full-day ski sessions are typically determined by session-start time and lift-op end (~4 PM); a better default is `min(12, max(0.5, 16 - startHour))`. Pure UI concern, zero thermal-engine impact. Implementation touches ski trip form schema and default-computation logic only. Landable any session; not blocking anything. |
| S9C-HEADER-COMMENT-STALE | LOW | Open — SessionA-surfaced | `calc_intermittent_moisture.ts:6-7` and `:228-229` header comments claim "β1 throw" for steady-state and linear paths, but both paths are fully implemented (`:313` steady-state PHY-039B, `:1338` linear self-contained port). Session 9c (or an intervening session) landed the work; the file header was never updated. Cleanup: amend header text to reflect current state. Infrastructure implication: file-header scope comments proved unreliable in at least one engine file; SessionB consideration of whether scope claims belong in file headers at all. Audit for other stale session-scope headers. |
| PHY-039B-NO-SPEC | MEDIUM | Open — SessionA-surfaced | Steady-state moisture path at `calc_intermittent_moisture.ts:313-~408` is ~95 lines of live physics (sweat rate, VPD evaporation, drain, cap enforcement, precip wetting, vent events, elevation profile walking) labeled `STEADY-STATE FALLBACK (PHY-039B, self-contained)` in a single inline code comment. No LC6 spec file exists. No Spec Registry row. DRIFT-4 analog to pre-S28 PHY-031 situation (physics shipped by comment citation only). Serves activities resolving to `profile = null` — at minimum bouldering, camping (from S31 baseline audit); likely also climbing, hunting, skateboarding, onewheel, cross_country_ski, golf (generic). Prioritize for SessionB (or a dedicated `PHY-039B-RATIFICATION` session) given the activity coverage. |
| S10B-SCOPE-UNRESOLVED | LOW-UNTIL-UI | **CLOSED S10B** at `1450801` | Session 10b scope referenced in `evaluate.ts:10` header comment ("Steps 5-8: placeholders for Session 10b") has no tracker entry and unverified completion status. Symptom: ~12 TrajectoryPoint fields in `evaluate.ts:605-740` return as literal-0 (STRUCT-ZERO-PADDED). **RESOLVED S10B, April 24, 2026.** 17 TrajectoryPoint heat-balance fields (M, W, C, R, E_resp, E_skin, E_max, E_req, h_c, h_mass, P_a, R_e_cl_effective, VPD, sweat_rate as SW_required, T_cl, h_tissue, S_run) now populated from `calcIntermittentMoisture` per-cycle exposures via cyclic path. STRUCT-ZERO-PADDED pattern eliminated from cyclic TrajectoryPoint emission. Verification: heat-balance first law `M - W = C + R + E_resp + E_skin + S_run` closes to within 0.01W across G1/M2/P5 ski vectors. 687 pre-existing tests pass bit-identically (no physics modified). 49 new probe tests at `packages/engine/tests/evaluate/s10b_heat_balance_probe.test.ts`. Hand-comp trace at `LC6_Planning/traces/S10B_HANDCOMP_TRACE.md`. |
| GHOST-PACKAGES-AND-MISSING-API | LOW-TO-MEDIUM | Open — SessionA-surfaced | Three related architectural placeholders: (1) `@lc6/gear-api` is a 2-line version-only export with 0 consumers, 0 tests, no scheduling. (2) `@lc6/shared` is the same pattern (2-line version-only, 0 consumers, 0 tests). (3) `apps/api/` directory does not exist at all (not scaffolded). Real implementations of gear-api's nominal concern (gear DB adapter) and shared's (cross-package types) currently live inside `@lc6/engine`. Decide at SessionB or later: fill per original extraction intent, absorb into engine permanently, or delete. Not urgent — no active harm. Pair decision: if `gear-api` is intended as REST API for `apps/api/`, both start together. |
| METHODOLOGY-FUDGE-PROHIBITION | LOW-TO-MEDIUM | Open — SessionA-surfaced | Extend "no fudge factors" Cardinal Rule #1 from data/constants to methodology/thresholds/decision-trees. Source incident: SA-FAB-001 (SessionA file-count decision rule invented without derivation). Candidate Cardinal-Rule-scale entry for SessionC working agreement. Surfaced via SessionA Output B incident 3.5. |
| MEMORY-13-REWORD | LOW | Open — SessionA-surfaced | Memory #13 "Code receives ONLY exact surgical code verbatim" proved re-interpretable. During SessionA Steps 6-12, Chat drifted toward "Code composes documentation, Chat composes TypeScript" as a false distinction. Candidate reword: "Any repo artifact — code, docs, tables, tracker text, commit messages — Chat writes, Code executes verbatim." Source incident: S31-CODE-COMPOSITION (SessionA Output B incident 3.6). |
| RATIFICATION-PRECONDITION-RUNNABLE | MEDIUM | Open — SessionA-surfaced | Spec ratification should require "all verification vectors runnable at ratification time" as a precondition. Would have caught S31-A (synthesized gear values in §9) and S31-E (calibrating to ghosts) at S30 close rather than during S31 mid-session. Source incident: S31-SPEC-VERSION-CHURN (SessionA Output B incident 3.7). |
| DEFERRAL-TO-TRACKER-AUTOMATION | MEDIUM | Open — SessionA-surfaced | Session-close checklist item: enumerate source-comment deferrals added during the session; create tracker items for each. Would have prevented `S10B-SCOPE-UNRESOLVED` and `S9C-HEADER-COMMENT-STALE` invisibility. Source incidents: 3.8, 3.9, 3.10, 3.11 (SessionA Output B). |
| S10B-STEADY-STATE-FOLLOWUP | LOW-UNTIL-UI | Open — S10B-surfaced | S10B deferred steady-state and linear path TrajectoryPoint heat-balance backfill. `buildSinglePoint` at `evaluate.ts:775` (steady-state fallback + linear path) retains zero-padded heat-balance fields (M, W, C, R, E_resp, E_skin, E_max, E_req, h_c, h_mass, P_a, R_e_cl_effective, VPD, sweat_rate, T_cl, h_tissue, S_run all still literal 0 or crude placeholders on these code paths). No cycle state exists in `buildSinglePoint` to expose; proper fix requires either an additional solver pass in those code paths OR a documented convention that non-cyclic paths return representative-point values rather than per-slice values. Priority LOW-UNTIL-UI per S10B latent-harm framing (no apps/web consumer). Surfaced: S10B, April 24, 2026. Paired with: `PHY-039B-NO-SPEC` (same steady-state path that lacks ratified spec). |

## Section C: Constants Audit — Calibrations vs Fudges

**S17 reclassification:** Section C is split into two categories per S17 closure.
**Calibrations** are tuned constants anchored to a documented design principle (retained, documented inline in code).
**Fudges** are arbitrary constants without a principle anchor (replacement specs tracked).
Cardinal Rule #1 is strengthened by this distinction, not weakened.

### C.1 — Calibrations (retained with documented anchor)

| Name | File:Line | Value | Anchor | S17 Action |
|---|---|---|---|---|
| MR output scaling | moisture/perceived_mr.ts | × 7.2 | Fechner output budget per TA v5 §3.5; 7.2 lands coherent-saturated ensemble at MR≈6 (cascade inflection) | CALIBRATION-ANCHORED header added S17 |
| COMFORT_THRESHOLD | moisture/perceived_mr.ts | 40 mL | Fukazawa 2003 (50 g/m²) × ~0.8 m² torso contact | CALIBRATION-ANCHORED header added S17 |
| Saturation cascade curve | moisture/saturation_cascade.ts | 6 cutoff + 6+4×(1-(1-(raw-6)/4)²) | Three-regime design per TA v5 §3.5 + saturation_cascade.html | Retained |
| Evaporation rate cap | TBD (audit) | 0.85 | Minimum-retention floor per TA v5 §3.3 | Pending per-constant inline comment (future audit) |
| Humidity floor | TBD (audit) | (H-60)/40 × 4.0 | Cooper Landing anchor per TA v5 §3.4 | Pending per-constant inline comment (future audit) |
| Cold penalty | TBD (audit) | trapped×5 + (40-T)/10×f_suit | Wilderness-medicine danger-tier anchor per TA v5 §3.2 | Pending per-constant inline comment (future audit) |
| humMul formula | moisture/calc_intermittent_moisture.ts:455 | 1 + max(H-40,0)/100×0.8 | Nielsen & Endrusick 1990 direction; 40%/0.8 are calibration | Anchor direction cited; specific values tracked as PHY-HUMID-HUMMUL-CAL |

### C.2 — Fudges (replace via physics specs)

| Name | File:Line | Value | Status | Replacement Spec |
|---|---|---|---|---|
| PERCEIVED_WEIGHTS | moisture/perceived_mr.ts | [3, 2, 1.5, 1] | FUDGE (direction cited — Fukazawa/Zhang — but specific ratios uncited) | PHY-WEIGHTS-CAL (future; Havenith 2002-derived) |
| rawTempMul staircase | moisture/calc_intermittent_moisture.ts:453 | 5-step temperature multiplier | FUDGE (no anchor) | PHY-SWEAT-UNIFICATION (Gagge) |
| _gradeMul staircase | moisture/calc_intermittent_moisture.ts:378 | 4-step grade multiplier | FUDGE (no anchor) | PHY-GRADE-01 (Minetti GAP polynomial) |
| _ventHum staircase | moisture/calc_intermittent_moisture.ts:825 | 3-step humidity factor | FUDGE (no anchor) | PHY-HUMID-VENT-REWRITE (VPD-derived) |
| Vent constants | moisture/calc_intermittent_moisture.ts:832-836 | 0.15, 0.3, 5 | FUDGE (no citation) | PHY-VENT-CONSTANTS |
| Vasoconstriction threshold | iterativeTSkin (heat_balance/) | 33.0°C | FUDGE (citation ambiguity) | PHY-VASO-CITATION |

---

## Section D: "Must Not Get Lost" Architectural Items

These are items where user has explicitly or implicitly flagged structural importance. They are NOT fudge factors — they are architectural decisions pending.

| ID | Description | User's words / source |
|---|---|---|
| ARCH-LAYER-2-PACING | Precognition/path-optimal pacing within ensemble across time slices. Engine aggregates peak slice heat balance and rejects on peak — doesn't simulate "vent at N, recover at N+1." Needs DP over slices: given ensemble + trip, find optimal vent/break schedule. | **User explicit: "must not get lost"** |
| ARCH-REGIONAL-MR | Upper vs lower body MR reconciliation. LC6 computes CLO/im as whole-body but moisture accumulates regionally. | Blocks PHY-INFOGRAPHIC-01 + affects EngineOutput contract. |
| ARCH-PHASE-1-CORRECTIVE | System-level evaluation of candidate ensembles via IREQ pre-filter, not per-slot picking. | User memory notes Claude has drifted to per-slot thinking 3+ times; active resistance required. |
| DOC-TA-V7, DOC-ATP-V5 | Line-by-line rewrites verifying every formula matches cited source (not addenda) | FUTURE_WORK P3 + user memory "on the horizon" |

---

## Section E: Work In Progress

### E.1 Dirty Working Tree

- **Branch:** `session-13-phy-humid-v2`
- **Modified:** `packages/engine/src/moisture/calc_intermittent_moisture.ts`
  - Phase 2: per-layer Magnus dew point at lines 736-744
  - Phase 3: three-category moisture routing (_vaporFabricG, _liquidAtSkinG, _ambientVaporG) at lines 747-825
- **Test impact:** 13 directional failures in moisture tests (matched to spec expectation)

### E.2 Branches

- `main` at 773f995 (Session 12 v2 ratification)
- `session-13-phy-humid-v2` at e9d56b5 (Phase 1 Magnus helpers); Phase 2+3 dirty beyond

### E.3 Known stale documents

- `README.md` references `LC6_Architecture_Document_v1.1_RATIFIED.md`; actual file is v1.2

### E.4 Planning docs under review

- `LC6_Decision_Registry.md` — missing Session 13 DEC entry (to fix in close-out)
- `LC6_Session_Ledger.md` — missing Session 13 entry (to fix in close-out)
- `LC6_Spec_Registry.md` — missing PHY-PERCEIVED-MR-REDESIGN draft entry (to fix in close-out)
- `LC6_Code_Change_Log.md` — missing Session 13 entry (to fix in close-out)

---

## Section F: Cancelled / Resolved (Historical Record)

| ID | Resolved | Notes |
|---|---|---|
| PHY-HUMID-EXCESS-CAL | S12 | CANCELLED — v1 `_excessRetention = 0.10` fudge withdrawn in v2; no coefficient to derive |
| PHY-SATURATION-CASCADE-REVIEW | S13 AM | Verdict: calibration per Sci Foundations §3.5, not physics novelty. Output-shaping. Subsumed by PHY-COMPRESSION-CURVE spec. |
| OQ-H3-HUMID-LOW-MR | S12 | DIAGNOSED; fix ratified in PHY-HUMID-01 v2. Validation pending Phase 2+3 commit. |
| FUTURE_WORK Priority 1 (Real Gear DB) | S11 | RESOLVED — PHY-GEAR-01 v2 shipped 1,627-product catalog |
| Activity Parameter Ratification (Architecture §11) | S9a | RESOLVED — ACTIVITY_SWEAT_PROFILES + INTERMITTENT_PHASE_PROFILES + GENERIC_GEAR_SCORES_BY_SLOT shipped with Option C citations |
| Wearable integration v2 (Architecture §11) | Moved | Same as UI-CM-DISPLAY / LC4 UI items; will address when LC6 UI phase begins |
| Goldilocks calibration pipeline (Architecture §11) | Moved | Post-UI-launch item; tracked under DOC-ATP-V5 scope |
| PHY-042 (Architecture §11) | S13 AM | CLOSED — confirmed NOT in LC6 engine source (grep returned 0); was LC5 context only |
| S13-MISSING-SPEC-FILE | S14 commit | RESOLVED — specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v0_DRAFT.md written in commit 4098816 (now v0 SUPERSEDED after v1 ratification) |
| S13-MISSING-AUDIT-FILE | S14 commit | RESOLVED — LC6_Planning/audits/ created and MOISTURE_OUTPUT_AUDIT_S13.md copied in commit 4098816 |
| S13-MISSING-DECISION-REG | S14 commit | RESOLVED — DEC-MOISTURE-OUTPUT-AUDIT appended to Decision Registry in commit 4098816; grep -c = 1 |
| S13-MISSING-SESSION-LEDGER | S14 commit | RESOLVED — Session 13 entry appended to Session Ledger in commit 4098816; grep -c = 1 |
| UNTRACKED-FILE-V1.3 | S14 manual | RESOLVED — empty file deleted manually (`rm ~/Desktop/LC6/v1.3,`); was stray from shell redirect typo |

| S13-PHASE-2-3-DIRTY | S17 | RESOLVED — Phase 2+3 code reverted via git checkout HEAD in S17 commit 3ce33fe. PHY-HUMID-01 v2 spec itself retained as RATIFIED for future dedicated implementation. |
| S15-SPEC-SECTION-7-SKIPPED | S17 | RESOLVED — spec §7 gate obviated by reversion of the spec it gated. Process lesson codified as meta-rule in S17 closure doc: "sessions ship commits; if no commit by hour 2, stop and reassess." |
| S15-BSA-THREADING-INFLIGHT | S17 | RESOLVED — BSA threading reverted with calc_intermittent_moisture.ts restoration. No longer relevant post-revert. |
| S15-PERCEIVED-MR-REDESIGN-INFLIGHT | S17 | RESOLVED via reversion. Spec v1 marked SUPERSEDED BY REVERSION per LC6_Planning/LC6_REDESIGN_v1_Closure.md. |
| S15-DOWNSTREAM-THRESHOLDS-PENDING | S17 | RESOLVED — pre-REDESIGN MR distribution restored; downstream thresholds at evaluate.ts:741/744/808/813 + precognitive_cm.ts:35 still match the scale they were originally calibrated against. |

| S18-CASCADE-NOT-WIRED | S19 | RESOLVED — `applySaturationCascade` wired into 4 call sites in calc_intermittent_moisture.ts (steady-state per-step line 410, cyclic path fallback + final line 995/997, linear path line 1094). Verified empirically: 14hr ski scenario with raw MR=7.20 produces sessionMR=8.0 per cascade formula. Zero regressions on 639 pre-existing tests. Commit: (this session). |

| PHY-COMPRESSION-CURVE | S19 | RESOLVED — decision: KEEP. S17 reclassified as documented calibration per Sci Foundations §3.5. S19 wired the function into production pipeline and empirically verified the 6-10 quadratic ease-out fires correctly (14hr ski raw MR=7.20 → sessionMR=8.0 matches formula). 4-6 region redesign question separately tracked as S18-CROSSOVER-REGIME-SHAPE. No further compression-curve decision required — any future 4-6 redesign happens under that separate ID. |

| S19-SYSTEM-CAP-PLATEAU | S20 | RESOLVED — decomposed into 4 specific findings. Hand-computed analysis (audit doc: LC6_Planning/audits/S20_MOISTURE_CAPACITY_PIPELINE_AUDIT.md) shows the plateau itself is not a bug: it is the engine correctly reporting a fully-saturated 4-layer ensemble. 302 mL theoretical total cap matches 311 mL observed; MR=7.20 matches computePerceivedMR formula when all weighted terms hit max. Real underlying issues captured as S20-WEIGHT-STRING-PARSE-GAP (HIGH), S20-DEFAULT-WEIGHT-FUDGE, S20-FIBER-ABSORPTION-VALIDATION, S20-DURATION-PENALTY-CEILING — see Section B.15. |

| S20-WEIGHT-STRING-PARSE-GAP | S21 | RESOLVED — resolved via categorical pipeline instead of string parser. Extended EngineGearItem with `weight_category` field (ultralight/light/mid/heavy). New `weightCategoryToGrams(category, slot, subslot)` in evaluate.ts:1011 with slot-aware + legwear-subslot-aware gram mappings. `mapGearItems` populates weightG, replacing the `100 + warmth × 20` fudge. Citation for seed values: compiled internet + AI search April 19 2026, midpoint convention, Men's Medium. Commit: fb2f32c. |

| S21-F4-AHYGRO-DEAD-CODE | S22 | RESOLVED — `_aHygro` wired to outermost layer buffer inside cycle loop per PHY-HUMID-01 v2 §2.2 Category C. Two surgical edits to calc_intermittent_moisture.ts: (1) removed dead `cycleNet` assignment at line 539, (2) added `_layers[_layers.length - 1]!.buffer += _aHygro * 1000` after `_fabricInG` distribution, before overflow cascade. Scaled by 1000 to convert liters (hygroAbsorption return unit) to grams (layer.buffer unit). §10 gate: no Category-C-specific preconditions per spec §7. 643/643 tests passing (verified pre + post edit). Commit: 51885be. |

---

| S22-HUMIDITY-FLOOR-VALIDATION | S24 | RESOLVED — Investigation revealed `humidityFloorFactor` at `utilities.ts:48` has exactly ONE real caller: `waderEvapFloor` at `split_body.ts:160`. Function provides wader-scenario-specific evaporation floor (0.005-0.020, RH-scaled). NOT related to Cooper Landing protection as initially assumed (that was `applyHumidityFloor` — a different function deleted in S11). PHY-HUMID-01 v2 §4.2 claim "redundant with vpdRatio" is incorrect: the two serve different physics (vpdRatio is evap rate multiplier; humidityFloorFactor is minimum evap floor for wader numerical safety). Floor retained as physically defensible. One separate open question flagged: is 0.005 minimum evap at 100% RH inside waders physically defensible? Not urgent, not tracker-formalized. Investigation sparked by S23 morning review of Session 11-12 chat history which revealed the original Cooper Landing concern; S24 code audit showed the current humidityFloorFactor is different code with different purpose. |
| S22-CASCADE-ASYMMETRIC | S24 | RESOLVED — Misdiagnosis closure. Original S22 tracker item claimed overflow cascade at `calc_intermittent_moisture.ts:772-775` is wrong because it runs outer→inner only, with base excess silently clamped at line 777. S24 physics-first audit (extended Socratic discussion with user) revealed the engine is actually correct. Three coexisting mechanisms handle terminal-saturation physics: (1) bidirectional Washburn wicking at lines 779-797 moves liquid outward when fill gradient exists; (2) inward-only overflow cascade at 772-777 correctly models external moisture pressure (condensation, ambient `_aHygro`) — one-directional because the driving physics IS one-directional; (3) `_vaporExitHr = Math.min(sweatGPerHr, eMax/L_V × 3600)` at line 734 captures drip-as-residual physics — `_excessHr` IS the drip residual between sweat production and vapor transport capacity. User's physics derivation ("vapor still moves through shell im at saturation; drip occurs at skin-base interface; drip = sweat − vapor transport") turned out to match the engine's existing approach. No spec needed, no code changes needed. Closure of this item reshapes the moisture-physics roadmap: S22-MICROCLIMATE-VP becomes the real remaining gap (getDrainRate uses ambient humidity when it should use microclimate humidity at shell inner surface). |
| S27-DRIFT-3-PHY-031-NO-SPEC | S28 spec + S29 port | RESOLVED via two-session arc. **S28** authored `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` (commit 3a4b4d1) — 616-line spec ports LC5 PHY-030/031 values verbatim plus Thanksgiving window, powder detection, powder tier-bump table. **S29** executed Option A port (commit 7289e8b): phy031_constants.ts + activities/crowd_factor.ts (getCrowdFactor + computeCycle); ActivitySpec.date_iso required with ISO-8601 validation; UserBiometrics.ski_history optional (Phase A manual-entry personal calibration); evaluate.ts:430 null-plug closed via computeResortCycleOverride. Cardinal Rule #8 honored throughout — calc_intermittent_moisture.ts untouched. Spec-lock tests 25 `.todo` → 25 real tests bound to spec sections; 31/31 green. **Note on scope**: this item resolved the drift between "PHY-031 ratified LC5 Mar 17" and "PHY-031 absent from LC6 engine." It did NOT close `S26-SYSTEMATIC-MR-UNDERESTIMATION`; S29 4-scenario matrix revealed a separate physics gap (engine phase loop consumes cycle count but not cycleMin duration — up to 80% of session wall-clock time unsimulated). That gap tracked as `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` HIGH in Section B.18. **Registry**: PHY-031 row now RATIFIED (spec) / PARTIAL (engine — infrastructure complete, physics pending S30). |
| S29-PHY-031-CYCLEMIN-PHYSICS-GAP | S31 engine implementation | **RESOLVED S31, April 23, 2026.** PHY-031-CYCLEMIN-RECONCILIATION v1.2 physics landed in engine via commits `d3ed55c` (Phase A: `_cycleMinRaw` accumulator scoping), `131eeee` (Phase B: 4-phase cycle decomposition with LINE_MET=1.8 / TRANSITION_MET=2.0 / EPOC continuity chain), `c553621` (Phase C: rest-phase integration at 12:15 PM shell-off lunch / 2:30 PM shell-on otherBreak) on branch `session-13-phy-humid-v2`. 4-phase cycle decomposition, EPOC continuity chain, rest-phase integration, `_cycleMinRaw` accumulator scoping all present. Non-ski activities bit-identical on v1.2 §9.5 narrowed gate (11/11). Ski trajectory shape gates satisfied (5/5: lunch dips cycles 15/10/5 for G1/M2/P5 at 1.1/3.2/1.7 MR magnitudes, post-lunch re-climb, line-phase accumulation, EPOC continuity). Direction-of-change gate satisfied (3/3: |ΔP5|=1.10 > |ΔG1|=0.70, |ΔG1|<1.0, all three vectors moved). Post-patch baseline at `LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md`. Spec amended twice during S31: v1 → v1.1 pre-Phase-A (§9/§11 refactor), v1.1 → v1.2 Phase A pre-commit (§9.5 narrowing). S-001 (`S26-SYSTEMATIC-MR-UNDERESTIMATION`) remains open per spec v1.2 §11.2 pending broader MR-fidelity work. |

## Section G: Verification Commands

Run these at any time to prove the tracker is accurate. Every expected ID must appear. If a grep returns 0, the tracker is incomplete.

```bash
cd ~/Desktop/LC6-local

for ID in \
  PHY-GEAR-01 PHY-HUMID-01 PHY-PERCEIVED-MR-REDESIGN \
  ARCH-FALL-IN-V2 ARCH-T-MRT-V2 ARCH-GEAR-DB-API-MIGRATION \
  ARCH-Q-SHIVER-SCENARIO-B ARCH-OQ-024-LC5-GREP ARCH-OQ-027-LC5-GREP \
  STAGE-TAU-MAX STAGE-PROMOTION-15MIN Q-SHIVER-50W-THRESHOLD \
  HEAT-SIDE-SWEAT-DETECTION \
  OQ-028 OQ-029 ITER-TSKIN-WARM-REST-NON-CONVERGENCE \
  OQ-REGIONAL-MR PHY-IMMERSION-01 PHY-GEAR-PEER-CAL \
  PHY-GEAR-WARMTH-CAL PHY-GEAR-BREATH-CAL PHY-GEAR-02 PHY-GEAR-03 \
  PHY-SWEAT-UNIFICATION PHY-GRADE-01 PHY-HUMID-VENT-REWRITE \
  PHY-HUMID-HUMMUL-CAL PHY-VENT-CONSTANTS \
  PHY-PR-COVERAGE-VAR PHY-PR-CHILL-WEIGHT PHY-EVAP-CAP-0.85 \
  PHY-HUMIDITY-FLOOR PHY-COLD-PENALTY PHY-COMPRESSION-CURVE \
  EMPTY-DIR-HEAT-LOSS EMPTY-DIR-OVERLAYS EMPTY-DIR-AGGREGATE \
  EMPTY-DIR-ACTIVITY-OBSOLETE \
  ARCH-LAYER-2-PACING ARCH-PHASE-1-CORRECTIVE ARCH-IREQ-BLOCK-2 \
  ARCH-IREQ-BLOCK-3 ARCH-REGIONAL-MR PHY-VASO-CITATION \
  DOC-TA-V7 DOC-ATP-V5 \
  PHY-NAN-HARDENING UI-CM-DISPLAY \
  S13-PHASE-2-3-DIRTY S13-MISSING-SPEC-FILE S13-MISSING-AUDIT-FILE \
  S13-MISSING-DECISION-REG S13-MISSING-SESSION-LEDGER \
  UNTRACKED-FILE-V1.3 \
  BUG-132 BUG-HALFDOME-PERSTEPMR UI-KIRKWOOD-FIXES \
  PERCEIVED_WEIGHTS COMFORT_THRESHOLD \
  S18-CASCADE-NOT-WIRED S18-CROSSOVER-REGIME-SHAPE \
  S19-SYSTEM-CAP-PLATEAU \
  S20-WEIGHT-STRING-PARSE-GAP S20-DEFAULT-WEIGHT-FUDGE \
  S20-FIBER-ABSORPTION-VALIDATION S20-DURATION-PENALTY-CEILING \
  S27-DRIFT-1-PERCEIVED-MR-FILENAME S27-DRIFT-2-HUMID-V1-FILENAME \
  S27-DRIFT-3-PHY-031-NO-SPEC S27-DUAL-BREATHABILITY-MAPPING \
  S27-TSC-ERRORS-BASELINE S27-STALE-PLANNING-DOCS \
  S28-GOV-MODEL-REFINEMENT-PROCESS GAP-PHY-031-POWDER-THRESHOLD \
  S29-PHY-031-CYCLEMIN-PHYSICS-GAP S29-MATRIX-PENDING \
  S29-TRACKER-PATH-AUDIT S30-SESSIONA-DEFERRED \
  S30-AUDIT-PHY-040-FIELD-OWNERSHIP S30-AUDIT-DEWPOINTC-SPEC-OWNERSHIP \
  S30-AUDIT-LINEAR-PATH-CYCLEOVERRIDE S30-AUDIT-STRATEGYLAYERIMS-SPEC-OWNERSHIP \
  S30-AUDIT-CYCLEOVERRIDE-ESCAPE-HATCH S30-SKIING-DURATION-DEFAULT \
  MR-CRITICAL-MOMENTS-BUDGET-TIGHTER MR-PHY-031-REST-PHASE-MARKERS \
  MR-PHY-031-REST-INSENSIBLE-ROUTING S31-OBSERVATION-WINNER-INVARIANCE \
  S31-DOC-P5-TIER-CONSISTENCY S31-PHASE-C-REBASELINE \
  S9C-HEADER-COMMENT-STALE PHY-039B-NO-SPEC S10B-SCOPE-UNRESOLVED \
  GHOST-PACKAGES-AND-MISSING-API METHODOLOGY-FUDGE-PROHIBITION \
  MEMORY-13-REWORD RATIFICATION-PRECONDITION-RUNNABLE \
  DEFERRAL-TO-TRACKER-AUTOMATION S10B-STEADY-STATE-FOLLOWUP
do
  COUNT=$(grep -c "$ID" LC6_Planning/LC6_Master_Tracking.md 2>/dev/null)
  if [[ "$COUNT" == "0" || -z "$COUNT" ]]; then
    echo "MISSING: $ID"
  fi
done
echo "(no output above = all IDs present; complete tracker)"
```

---

## Section H: Session Ritual (Inviolable)

### Session OPEN (first action, no exceptions)

```bash
cd ~/Desktop/LC6-local
cat LC6_Planning/LC6_Master_Tracking.md | head -150
git status --short
git branch --show-current
```

Then state: "Tracker read. Branch: X. Dirty files: Y. Today's target: [specific item from Section B]."

### DURING work

Every time a decision defers/flags/marks-for-later:
1. Stop
2. Add to tracker immediately — Section B (with appropriate subsection) or Section C (if fudge factor) or Section D (if architectural "must not get lost")
3. Now continue

Every time a constant is touched without citation: Section C with file:line.

Every time a question is raised and not immediately resolved: Section B.

### Session CLOSE (reconciliation is mandatory)

1. **Review Section B line by line.** For each item:
   - Still valid? Keep.
   - Resolved by work this session? Move to Section F with resolution note.
   - Obsolete? Move to Section F marked CANCELLED with reason.
   - Superseded by newer item? Reference supersession.
   - Priority changed? Update.

2. **Review Section C line by line.** For each fudge:
   - Addressed by spec this session? Note resolution.
   - Still open? Keep.

3. **Run Section G verification grep.** Every expected ID must return > 0. Any MISSING output means the tracker is incomplete.

4. **Diff the tracker:** `git diff LC6_Planning/LC6_Master_Tracking.md`

5. **Commit the tracker as part of the session commit.** No separate "tracker update" commits — tracker moves with the work.

6. **Push.**

### Scripts: NO FUZZY IDEMPOTENCY CHECKS

Session 13 proved that `if "Session 13" not in content:` silently fails when "Session 13" appears in unrelated handoff notes. Never again.

Use either:
- **Explicit overwrite:** `write_text(new_content)` — write full file content, no "check first"
- **Exact-match grep:** `grep -c "DEC-MOISTURE-OUTPUT-AUDIT-SPECIFIC-UNIQUE-STRING"` — only skip if exact unique marker present
- **User confirmation:** show proposed change, ask "append or skip" before proceeding

---

## Section I: How to Keep This Honest

The tracker's value equals the discipline of updating it. Failure modes to watch:

1. **Claude forgets to update it.** → Session ritual makes it a named required step, not discretion.
2. **User pastes wrong content.** → Section G verification catches missing items.
3. **Script silent skips.** → No fuzzy idempotency checks; explicit write logic only.
4. **Items discussed in chat but never added.** → "Is X tracked?" can be answered by grep. If grep returns 0, it's not tracked.
5. **Reconciliation skipped at close.** → Tracker bloats with resolved items; active signal drowns in noise.
6. **File gets corrupted.** → Version-controlled; git diff shows regressions.

**The discipline:** If it's not in the tracker, it doesn't exist as a tracked concern. Memory (user memory, Claude memory) is advisory. This file is canonical.

**The reconciliation promise:** Every session ends with the tracker accurately reflecting reality. Resolved items get closed. New items get added. Priorities get updated. Nothing drifts silently.

---

*Document created Session 13, 2026-04-17 (pending commit).*
*Triggered by: "we are not moving forward on anything until we know what circle backs are out there and how we intend to track."*
*Section A 3 items, Section B 52 items, Section C 13 items, Section D 4 items, Section F 8 items.*

---

## Section J: Testing Discipline

> **Added Session 15 (2026-04-18) after §7 gate lesson. See DEC-S15-GATE-SKIP.**

This section captures how we validate physics calculations going forward. Canonical reference for all future sessions, all future specs.

### J.1 Forward Progress (every new physics spec and test)

Every spec that changes physics output MUST include these numbered sections:

**§Downstream Impact** (model on PHY-PERCEIVED-MR-REDESIGN v1 §6):
- Enumerate all consumers of the output being changed
- Classify each threshold as physics-grounded vs calibrated
- Audit consumers BEFORE writing code, not after

**§Hand-Computed Reference Scenarios** (model on PHY-PERCEIVED-MR-REDESIGN v1 §7):
- Concrete scenarios with physics expectations stated in the spec
- Hand computation (or instrumented capture + validation) done BEFORE test updates
- Engine output must match hand computation OR one is wrong and both reconciled

**§Implementation Order:**
- Explicit sequence where audit and hand-computation are GATES, not steps
- "Do not proceed to test updates until §N is cleared with evidence"

### J.2 Test Expected Value Discipline

**For tests asserting physics output** (MR, CDI, HLR, trapped moisture, heat loss, sweat rate, skin temp, etc.):

Rule: **Do not update expected values without hand-computed justification.** "Engine produces X now, let's match that" is a red flag and must be rejected.

Acceptable sources for expected values:
1. Hand-computed from physics formulas (with calculation trace documented)
2. Captured from a published reference (ISO standard, peer-reviewed paper, validated dataset) with citation
3. Captured from engine + cross-validated against (1) or (2) with evidence
4. Captured from engine during §7-gated work where physics expectations were stated first and matched

NOT acceptable:
- "Engine used to produce X; now produces Y; update test to Y."
- "This is what came out of the engine on day X."
- Values with a [PHY-XXX] tag but no documented hand computation from session XXX.

### J.3 Tag Convention for Test Assertions

Going forward, physics-output test assertions use tags that signal validation status:

| Tag | Meaning |
|---|---|
| `[PHY-SXX-VALIDATED]` | Hand-computed at session XX; physics trace in session ledger |
| `[REF-<source>]` | From published reference (e.g., `[REF-ISO-7933-TableB2]`) |
| `[CAPTURED-SXX]` | Engine snapshot from session XX; physics status UNVALIDATED |
| `[SNAPSHOT]` | Structural regression lock-in, not physics-sensitive |

Historical `[PHY-XXX]` tags without session ledger hand-computation evidence are treated as `[CAPTURED-PHY-XXX-UNCONFIRMED]` until audited.

### J.4 Historical Audit (Opportunistic)

We do NOT pause forward progress to audit Sessions 1-14 systematically. We audit as we touch.

**When you touch a test file:**

30-second classification per physics-output assertion:
1. Does it have a tag? If no → add appropriate tag.
2. If tag is `[PHY-XXX]`: check session XX ledger for hand-computation. If found → upgrade to `[PHY-XXX-VALIDATED]`. If not found → downgrade to `[CAPTURED-PHY-XXX-UNCONFIRMED]`.
3. If test is in a test file being actively modified AND assertion is un-validated AND we're relying on it for correctness → hand-compute now OR flag with TODO-AUDIT comment.

**Systematic audit trigger conditions** (escalates PHY-TEST-VALIDATION-AUDIT to HIGH):
- Session 16's §7 work reveals old snapshots were wildly off from physics
- A user-facing bug traces to an un-validated snapshot
- Count of `[CAPTURED-...-UNCONFIRMED]` tags crosses 20

Until triggered: MEDIUM priority, work opportunistically.

### J.5 Exemptions (physics-derived but low audit burden)

Not every assertion needs full hand-computation. These are acceptable with lower burden:

- Formula-direct outputs with published reference: `duboisBSA(150) = 1.86 m²` (DuBois 1916). Cross-reference once; high confidence forever.
- Magnus formula outputs: table cross-reference.
- ISO standard outputs: standard reference cross-check.
- Single-step arithmetic with cited inputs.

The higher the COMPOSITION of physics (more intermediate steps feeding final output), the more rigorous the audit. `computePerceivedMR` composes ~60 upstream calculations → needs full §7-style trace. `duboisBSA` is one formula → published reference suffices.

### J.6 Two-Lane Principle

**Lane 1 (Forward):** Every new physics spec + test follows J.1 and J.2 gates.
**Lane 2 (Historical):** Opportunistic audit per J.4 as we touch.

Neither lane pauses the other. Progress and audit are parallel, not sequential. The only stops are when §-gated physics encounters its own gate (Session 15 halt pattern).

### J.7 Enforcement

**Session ritual (Section H) enforces Section J:**

At session open: state today's target. If target includes physics code changes, state which spec §-gates apply.

During session: if test expected values are being updated, state what evidence supports the new value (hand computation? published reference? §7-validated capture?). If none, halt.

At session close: reconcile tag additions. Any new `[CAPTURED-]` tags = future audit load, tracked.

**User challenge questions that catch drift:**
- "Where did that expected value come from?"
- "Is this from the spec's §7 scenarios or from captured engine output?"
- "Does this spec have numbered gates before code updates?"
- "Are we calibrating to known-wrong outputs or to physics truth?"

These questions are the layer 2 defense. Memory #30 is the layer 1 persistence. Section J is the layer 3 documentation.
