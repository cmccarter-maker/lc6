# LC6 Code Change Log

---

## Session 11 — PHY-GEAR-01
**Date:** 2026-04-17

**Files modified:**
- packages/engine/src/types.ts (+45 lines additive)
- packages/engine/src/gear/adapter.ts (full rewrite, 470 lines)
- packages/engine/src/gear/index.ts (+8 lines, new exports)
- packages/engine/src/strategy/enumerate.ts (+4 lines, immersion filter)
- packages/engine/tests/evaluate/real_gear.test.ts (fixture alignment)
- packages/engine/tests/evaluate/diagnostic.test.ts (fixture alignment)
- packages/engine/tests/diagnostics/adversarial_matrix.test.ts (real gear wiring)

**Files added:**
- packages/engine/tests/gear/gearjs_adapter.test.ts (~31 assertions)
- packages/engine/reference/lc5_gear.js (1,627 products, ES module)

**Cardinal Rule compliance:**
- #1 (no fudge factors): 9 latent calibration constants flagged in spec §5.7
- #8 (thermal engine locked): zero engine function changes
- #11 (no code without ratified spec): spec v2 ratified before work
- #13 (Chat produces all code): Chat-authored, Code applied verbatim
- #14 (read before proposing): all touched files read pre-spec
- #16 (EngineOutput contract): unchanged; GearSlot expansion additive



## Session 12 — PHY-HUMID-01 ratification (NO CODE CHANGES)
**Date:** 2026-04-17

**Diagnostic session.** No source code modified. No test changes. No commits to
packages/engine/src/.

**Files added (planning only):**
- LC6_Planning/specs/PHY-HUMID-01_Spec_v1_RATIFIED.md (350 lines)

**Files modified (planning only):**
- LC6_Planning/LC6_Spec_Registry.md (PHY-HUMID-01 v1 entry)
- LC6_Planning/LC6_Decision_Registry.md (DEC-PHY-HUMID-01)
- LC6_Planning/LC6_Open_Issues_Ledger.md (6 new entries: OQ-H3-HUMID-LOW-MR + 5 raised specs)
- LC6_Planning/LC6_Session_Ledger.md (Session 12 summary)

**Cardinal Rule compliance:**
- #8: thermal engine untouched
- #11: no code without ratified spec — spec ratified, implementation deferred
- #14: read before proposing — full inventory grep conducted before spec drafting


## Session 12 continued — v2 RATIFIED, v1 SUPERSEDED (NO CODE CHANGES)
**Date:** 2026-04-17

**Audit session continuation.** No source code modified.

**Files added (planning only):**
- LC6_Planning/specs/PHY-HUMID-01_Spec_v2_RATIFIED.md

**Files modified (planning only):**
- LC6_Planning/specs/PHY-HUMID-01_Spec_v1_RATIFIED.md (SUPERSEDED banner added)
- LC6_Planning/LC6_Spec_Registry.md (v1 SUPERSEDED, v2 added)
- LC6_Planning/LC6_Decision_Registry.md (DEC-PHY-HUMID-01-CORRECTION)
- LC6_Planning/LC6_Open_Issues_Ledger.md (EXCESS-CAL cancelled, 2 audit findings)
- LC6_Planning/LC6_Session_Ledger.md (v2 correction entry)

**Cardinal Rule compliance:**
- #1: v1's _excessRetention fudge caught and removed before any code ships
- #8: thermal engine still untouched
- #11: v2 ratified before implementation
- #14: forensic audit traced every moisture input from source to output


## Session 13 — Phase 1 committed; Phase 2+3 held; audit + tracker shipped
**Date:** 2026-04-17

**Committed this session:**
- Phase 1 (e9d56b5): magnusDewPoint + inverseMagnus in vpd.ts + 8 unit tests
  - 628 → 636 tests green
- Session 13 audit close-out (this commit):
  - LC6_Planning/LC6_Master_Tracking.md (359 lines, 52 active items)
  - LC6_Planning/audits/MOISTURE_OUTPUT_AUDIT_S13.md
  - LC6_Planning/specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v0_DRAFT.md
  - Session Ledger, Decision Registry, Spec Registry updates

**NOT committed (working tree preserved):**
- Phase 2: per-layer Magnus dew point in calc_intermittent_moisture.ts (lines 736-744)
- Phase 3: three-category moisture routing (lines 747-825)

**Session 13 discoveries and process lessons:**
- 3 Cardinal Rule #1 fudges caught in perceived_mr.ts
- 3-4 additional calibration constants flagged via Sci Foundations §3.3-3.5 for audit
- Session 13 v1 close-out had silent-skip bug (fuzzy idempotency matched handoff notes)
- User demanded comprehensive tracking: "show me every circle-back item"
- 20+ items were never tracked across memory / ledger / session closures / FUTURE_WORK
- Master Tracking document built from: Open Issues Ledger + Architecture §11 + session
  closures 6-9c + FUTURE_WORK.md + Session 11 handoff + user memory + code TODOs + empty
  directories + Session 13 audit findings
- Memory #30 added prohibiting fuzzy idempotency checks

**Cardinal Rule compliance this session:**
- #1: 3 fudges caught and named (PERCEIVED_WEIGHTS, COMFORT_THRESHOLD uniform,
  7.2 scaling); 4 more flagged from Sci Foundations
- #8: thermal engine still locked (Phase 2+3 held)
- #11: no code without ratified spec (PERCEIVED-MR-REDESIGN is DRAFT)
- #14: audit preceded spec; spec precedes code; trackers precede future sessions


## Session 14 — PHY-PERCEIVED-MR-REDESIGN v1 RATIFIED (no code changes)
**Date:** 2026-04-18

**Files added (planning only):**
- LC6_Planning/specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md (265 lines)

**Files modified (planning only):**
- LC6_Planning/specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v0_DRAFT.md → v0_SUPERSEDED.md (renamed + banner added)
- LC6_Planning/LC6_Spec_Registry.md (v0 → SUPERSEDED, v1 → RATIFIED)
- LC6_Planning/LC6_Decision_Registry.md (DEC-PHY-PERCEIVED-MR-REDESIGN appended)
- LC6_Planning/LC6_Session_Ledger.md (Session 14 entry appended)
- LC6_Planning/LC6_Master_Tracking.md (first reconciliation: 5 B.12 items → F)

**NO source code changes.** Phase 2+3 working-tree edits preserved.

**Forensic review outcomes:**
- Concern #3 (max operator): changed to additive model
- Concern #5 (Rule #3 boundary): new §5 added to spec
- Concern #6 (downstream impact): new §6 — implementation gate
- Concern #7 (test expectations): 4 hand-computed reference scenarios required

**Cardinal Rule compliance:**
- #1: net improvement (3 hidden fudges removed; 1 named calibration tracked)
- #3: single source of truth preserved via computePerceivedMR wrapper
- #11: no code without ratified spec (v1 ratified; implementation Session 15+)
- #14: forensic review preceded ratification (7 concerns raised and addressed)

**Implementation remains BLOCKED** on:
1. Downstream audit of all sessionMR consumers (§6 of spec)
2. Hand-computed reference values for 4 scenarios (§7 of spec)


## Session 15 — REDESIGN implementation WIP (§7 gate halt, no commit)
**Date:** 2026-04-18

**Source code changes (WORKING TREE, NOT COMMITTED):**

1. `packages/engine/src/moisture/perceived_mr.ts` — REPLACED
   - Removed: PERCEIVED_WEIGHTS, COMFORT_THRESHOLD constants, 7.2 output scaling
   - Added: torsoContactArea(bsaM2), comfortThresholdML(bsaM2),
     computeSkinWetnessPerception (@internal), computeEnsembleSaturationLoad
     (@internal)
   - Changed: computePerceivedMR now additive model with BSA parameter
   - Signature: (layers) → (layers, bsaM2). Breaking change.

2. `packages/engine/src/moisture/calc_intermittent_moisture.ts` — MODIFIED
   - Phase 2 + Phase 3 edits preserved from S13 working tree
   - S15 addition: threaded `_bsa` through 3 computePerceivedMR call sites
     (lines 931, 973, 992) via sed edit

3. `packages/engine/tests/moisture/perceived_mr.test.ts` — REPLACED
   - Old imports (PERCEIVED_WEIGHTS, COMFORT_THRESHOLD) no longer exist
   - New test groups: torsoContactArea, comfortThresholdML,
     computeSkinWetnessPerception, computeEnsembleSaturationLoad,
     computePerceivedMR
   - Hand-computed expected values for v1 additive math
   - All 11 new tests pass

**Source code changes NOT COMMITTED per spec §7 gate:**
- Test expectations in `packages/engine/tests/moisture/calc_intermittent_moisture.test.ts`
  were NOT updated. 13 failing snapshot tests remain. Expected values must be
  hand-computed per §7 reference scenarios before updating.

**Planning file changes (THIS COMMIT):**
- LC6_Planning/LC6_Master_Tracking.md (S15 state items in B.12, status block)
- LC6_Planning/LC6_Session_Ledger.md (S15 entry)
- LC6_Planning/LC6_Decision_Registry.md (DEC-S15-GATE-SKIP)
- LC6_Planning/LC6_Code_Change_Log.md (this entry)

**Memory changes:**
- Removed #24 (stale colors file — narrow issue, tracker covers)
- Added #30 (S15 gate lesson)

**Cardinal Rules this session:**
- #11: no code without ratified spec — upheld (working tree, not shipping)
- #14: halted when gate discovered skipped — new corollary via memory #30

**Tests at halt:** 634/647 passing. 13 stale snapshot failures await §7 work.
