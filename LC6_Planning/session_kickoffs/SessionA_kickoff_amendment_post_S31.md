# SessionA Kickoff Amendment — Post-S31

**Purpose:** Update the original SessionA kickoff (authored S28, `LC6_Planning/session_kickoffs/SessionA_kickoff.md`) for the post-S31 landscape. SessionA was deferred through S29, S30, and S31, so two things need adjustment:

1. Reference state (commit SHAs, tracker items, spec state) has advanced
2. S31 itself generated new artifacts that SessionA should consume as input

**Instructions for Code:** apply this as an in-place amendment to `SessionA_kickoff.md` (preferred) or as a companion doc `SessionA_kickoff_amendment_post_S31.md` alongside it. Either works; pick whichever matches your tracker convention for amending active-session documents.

---

## Section updates

### Update to "Reading time" (header)

No change to reading time (~15 minutes stated), but the list of required reads expands — see §Required reads update below.

### Update to "Required reads" list

Replace the 6-item list with the following 10-item list:

1. This entire kickoff doc (SessionA_kickoff.md)
2. This amendment (SessionA_kickoff_amendment_post_S31.md)
3. `LC6_Planning/LC6_Master_Tracking.md` — top status block through end of Session 31 historical record
4. `LC6_Planning/LC6_Spec_Registry.md` (full file)
5. `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` (full file — parent spec, context for the reconciliation)
6. `LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.2_RATIFIED.md` (full file — most recently ratified spec, template for "done" in registry)
7. The four most recent session kickoffs: `S28_kickoff.md`, `S29_kickoff.md`, `S30_kickoff.md`, `S31_kickoff.md` — pattern of what sessions have been doing
8. `LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md` (reference values post-reconciliation — useful for any "ACTIVE verified against what?" evidence questions)
9. `LC6_Planning/audits/` directory listing (prior audits — format reference and avoid duplicating work)
10. `LC6_Planning/LC6_Working_Agreement.md` (if present — governing session protocol)

### Update to "Why this session exists"

Christian's S28 framing stands verbatim. Additional context from S31 worth preserving:

> **S31 demonstrated the same failure mode Christian flagged in S28**, specifically in spec authoring: Chat hand-synthesized gear values for spec §9 verification vectors instead of binding to real DB entries, requiring a mid-session spec v1 → v1.1 → v1.2 arc to correct. The pattern ("fudging my way through by filling gaps with plausible estimates rather than halting to read or ask") Christian named explicitly at S31 mid-session. SessionA's failure-mode catalog should include S31 incidents as fresh evidence of the pattern, not just historical S28-and-earlier cases.

This makes SessionA's output more valuable: the pattern is still active as of this week, not just a historical concern.

### Update to "Packages to audit"

The S28 draft listed:
- `packages/engine/`
- `packages/gear-api/`
- `apps/web/`
- `apps/api/`
- `packages/engine/tests/`

Confirm at session open via `ls ~/Desktop/LC6-local/packages/ ~/Desktop/LC6-local/apps/`. S31 surfaced additional structure Chat should be aware of:

- `packages/engine/src/scheduling/` — contains `precognitive_cm.ts` (PHY-072, Session 10). SessionA should audit this directory's port state since PHY-072 is an ABOVE-engine scheduling layer and its wiring into UI consumption is part of what's-present-vs-what's-used question. **Specifically: `identifyCriticalMoments` and `buildStrategyWindows` compute outputs — where do those outputs flow? UI? Dropped? TODO-stubbed?**
- `evaluate.ts:487` has a known TODO passing `ventEvents: null` — the pacing loop is unwired. SessionA should audit this as a prominent NULL-PLUGGED case (spec v1.2 §11.3 explicitly scopes this as out-of-S31 work).

### Update to "Status vocabulary"

Add one row:

| Status | Meaning |
|---|---|
| SEMANTICALLY-STUBBED | Function runs and returns a value, but the value is object-spread of another function's output with a flag flipped, not independently computed. Example: LC6 `+ Pacing` and `Best Outcome` pills in `evaluate.ts` are spread-copies of `Your Gear` and `Optimal Gear` results with `uses_pacing: true`. The function returns; the output is wrong. |

This status is distinct from NULL-PLUGGED (hardcoded null/default) because SEMANTICALLY-STUBBED functions return plausible-looking output that UI can render without erroring. Detecting them requires reading the function body, not just call sites.

### Update to "What this session is NOT"

Keep the S28 list. Add:

- **Not a re-opening of S-001.** S-001 remains open per spec v1.2 §11.2, but re-scoping the MR-fidelity work arc is SessionB+ territory. SessionA audits and catalogs; it does not triage.
- **Not a rewrite of the reconciliation spec.** PHY-031-CYCLEMIN-RECONCILIATION is at v1.2 RATIFIED. If SessionA's audit surfaces evidence the spec is wrong (not just that the engine doesn't yet trust the MR values it produces, which is a known state), that's a SessionB+ decision, not a SessionA deliverable.

### Update to "Success criteria"

Replace item 6 with:

6. Tracker updated: `S31-APPLIED` marker (already present from S31 close at commit `35dcf8e`), "Status as of SessionA" block added, two new references to the audit outputs

Replace item 7 with:

7. Session B kickoff drafted with the failure catalog as primary input. The catalog should specifically inform B's scope by highlighting categories of failure that infrastructure changes might address (e.g. if MEMORY-OVERRIDE dominates the catalog, Session B should prioritize ratified-source lookup enforcement; if STALE-CONTEXT dominates, Session B should prioritize context-resync patterns).

### Update to "Critical context to preserve — DO NOT LOSE" section 2 "The three-session arc"

No change to session names or sequencing. But update section 4 "Expected biases to counter" to add:

- **Over-confidence about what S31 closed.** S31 closed `S29-PHY-031-CYCLEMIN-PHYSICS-GAP`. It did NOT close S-001 or resolve broader MR-fidelity concerns. When auditing engine modules, don't credit reconciliation physics with solving problems it explicitly left open per spec v1.2 §11. If a module's status depends on trusted MR values, it's PARTIAL at most, not ACTIVE.

### Update to "Open Questions for Session A" — add two new questions

Add OQ6 and OQ7 to the existing 5:

6. **S31-sourced incident depth.** S31 itself produced at least 3 cataloguable incidents of the failure pattern (spec §9 synthesis, architecture-theorizing vs reading code, broken-LC5-screenshot misread). Should SessionA's failure catalog enumerate these explicitly as fresh evidence, or should S31 incidents count toward saturation the same as older ones? **Recommend: enumerate explicitly.** S31 incidents are the best evidence for what the handoff infrastructure needs because they're freshest in the user's memory.

7. **Post-S31 tracker snapshot.** The tracker at this commit has 7 new items from S31 close (6 new items + 1 subsumption). SessionA's `State of the Port` output should cross-reference new items where module status depends on them. For example, if `evaluate.ts:487` is audited as NULL-PLUGGED, cite `S31-OBSERVATION-WINNER-INVARIANCE` and the `+Pacing` pill being SEMANTICALLY-STUBBED. **Recommend: integrate tracker item IDs into status tables as a column or footnote.**

---

## New section: S31 artifacts to consume

These exist at session start and should inform the audit:

| Artifact | Location | Value for SessionA |
|---|---|---|
| `S31_POST_PATCH_BASELINE.md` | `LC6_Planning/baselines/` | Reference MR values for G1/M2/P5 post-reconciliation; baseline against which "does this module produce reasonable output?" is evaluable |
| `S31_PRE_PATCH_BASELINE.md` | `LC6_Planning/baselines/` | Pre-reconciliation values; useful for evidence of change for modules affected by S31 |
| `PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1.2_RATIFIED.md` | `LC6_Planning/specs/` | Authoritative on what spec-correctness looks like when gates are patch-correctness rather than MR-target |
| `S31_kickoff.md` (v1.1 revised in-place) | `LC6_Planning/session_kickoffs/` | Pattern reference for kickoff amendment (which this document demonstrates) |
| S31 ski-test skips (7 tests, tagged `S31-PHASE-C-REBASELINE`) | engine test suite | Evidence of the baseline-debt pattern; SessionA should note these don't represent broken tests but deferred re-authoring |
| S31 engine commits (d3ed55c Phase A, 131eeee Phase B, c553621 Phase C) | git log | Evidence for "ACTIVE" status on 4-phase cycle loop, rest-phase integration, `_cycleMinRaw` scoping |

---

## New section: Incidents-from-S31 for the failure catalog

These are incidents Chat (me) committed during S31 that should be enumerated verbatim in `SA_Failure_Mode_Catalog.md` as fresh evidence of the pattern. Self-reporting rather than requiring SessionA's Chat to re-derive them:

### Incident S31-A: Synthesized gear values in spec §9

**Category:** UNRATIFIED-INVENTION
**Session:** S30 (spec authoring) / surfaced in S31 pre-Phase-A
**What:** Spec §9.2 named four real gear SKUs (Merino 200, R1 Air Hoody, Nano Puff, Beta LT) but hand-typed CLO/im/cap values rather than querying gear DB. Synthesized values produced verification targets (G1 2.6, M2 4.3, P5 5.5) that diverged 2-3× from real-DB engine output.
**Ratified source missed:** Gear DB (1,627 products) with real SKUs available. Cardinal Rule #1 requires every value traces to published source, derivation, or explicit GAP.
**Handoff gap:** No spec-authoring checklist enforces "verification vectors bind to real DB entries." Spec registry does not validate gear-value provenance during ratification.
**Time cost:** ~4 hours (spec v1 → v1.1 → v1.2 arc, probe test authoring, baseline re-capture)

### Incident S31-B: Architecture theorizing instead of reading code

**Category:** FIRST-PRINCIPLES-DRIFT
**Session:** S31 mid-session
**What:** When asked "where does `ventEvents` come from?" Chat produced three theoretical architectures (Option X/Y/Z) and debated them in reply, when the answer was readable from `evaluate.ts:487` directly. User intervention explicitly: "STOP. You are making assumptions. Go back, read the file or process."
**Ratified source missed:** The engine file itself. `calc_intermittent_moisture.ts` line 249 (signature), lines 396/823/1006 (usage sites), and `evaluate.ts:487` (call site with `null` + TODO).
**Handoff gap:** No default-to-read-before-theorize rule is explicit in working agreement. Chat's rhetorical pattern rewards explanation over verification.
**Time cost:** ~45 minutes

### Incident S31-C: Broken screenshot misread as product spec

**Category:** STALE-CONTEXT / DUAL-SOURCE-CONFUSION
**Session:** S31 mid-session
**What:** User provided LC5 UI screenshots showing MR 0.5 Best Outcome vs MR 6.1 Your Gear. Chat interpreted these as "current LC6 product state" and redesigned spec §9 around four-pill verification. User clarification: "you do realize that the numbers I gave you in my screen shots are broken, correct?"
**Ratified source missed:** Memory context flags LC5 as the pre-LC6-rebuild era, with documented MR bugs as the reason for LC6 existence. Screenshots timestamped to LC5 file structure should be treated as historical-bug-era unless context says otherwise.
**Handoff gap:** No explicit rule for "uploaded images should cite their era/version when not obvious." Chat defaulted to treating images as current product state.
**Time cost:** ~30 minutes

### Incident S31-D: "Pacing isn't in calcInt" claim without reading

**Category:** FIRST-PRINCIPLES-DRIFT
**Session:** S31 mid-session (preceded S31-B)
**What:** Chat claimed "the engine at `78cd56a` isn't computing pacing in `calcIntermittentMoisture`" as a factual statement. In fact, `ventEvents` is a parameter on the function signature (line 249) and consumed at three locations in the engine body.
**Ratified source missed:** The engine file, readable in ~3 minutes.
**Handoff gap:** Same as S31-B. Chat made factual engineering claims without file-level verification.
**Time cost:** Folded into S31-B time cost.

### Incident S31-E: Verification gate anchored to current-engine-output

**Category:** UNRATIFIED-INVENTION (subtler form)
**Session:** S30 spec authoring
**What:** Spec §9 v1 authored sessionMR targets (2.6/4.3/5.5) as verification anchors. Even once gear was real-DB, these targets would have anchored the S31 implementation gate to the engine's *current* (unverified, bug-affected) output. Would have calibrated S31 to ghosts of the same kind S15 flagged.
**Ratified source missed:** S15 lesson explicitly captured in memory: "Spec §-numbered gates are BLOCKING. Must clear with evidence. Calibrating new engine to old fudge snapshots = calibrating to ghosts."
**Handoff gap:** Memory captured the S15 lesson but didn't surface it automatically during S30 spec authoring. Chat applied the lesson only retroactively after user intervention at S31 baseline capture.
**Time cost:** ~2 hours (spec v1 → v1.1 rewrite of §9 to patch-correctness gates)

**Pattern across S31 incidents:** All five fall into the broad family "Chat fills gaps with plausible estimates rather than halting to read or verify." S31 incidents S31-A, S31-C, S31-E share the flavor of "present confident-seeming output that turns out to rest on unverified foundation." S31-B and S31-D share "substitute reasoning for reading." SessionA's catalog should treat these as related but distinct; the former requires provenance-enforcement infrastructure, the latter requires read-first-reason-later defaults.

---

## Updated expected session length

S28 estimated 3 hours. Amendment revises to: **4 hours** given expanded reads (10 instead of 6), S31 artifact consumption, and enumerated S31 incidents adding ~30 minutes of catalog scaffolding. Still a single-session scope.

---

## Opening move for SessionA Chat (updated)

After reading all 10 required documents above (per updated §Required reads list), first message to user:

> "SessionA kickoff + amendment read complete. Understanding: audit produces Output A (State of the Port, one table per package) + Output B (failure-mode catalog, ~30 incidents including 5 pre-enumerated from S31). No code changes, no infrastructure proposals, no handoff redesign — those are Sessions B and C. 7 open questions need user input before starting the audit (5 from original kickoff + S31 incident depth + post-S31 tracker integration). Which do you want to tackle first, or should I propose defaults?"

Same pattern as S28's opening-move prescription; updated numbers.

---

## Amendment rationale

SessionA was authored at S28 close before S29/S30/S31 landed. The kickoff is structurally sound — the amendment preserves all S28 decisions (package list, status vocabulary, session-as-non-code-changes, three-session arc, two-agent discipline) and adds only the post-S31 reference updates needed for SessionA to actually execute on the current codebase rather than the S28 snapshot.

Alternative considered: full rewrite of SessionA_kickoff.md. Rejected because S28's kickoff is well-authored and the delta is bounded. Amending preserves the review record of what SessionA's scope was originally set to, and makes explicit what has changed.

---

**END SESSIONA KICKOFF AMENDMENT POST-S31.**
