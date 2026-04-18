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
