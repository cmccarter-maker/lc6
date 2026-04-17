# LC6 Decision Registry

Canonical record of ratified decisions.

---

## DEC-PHY-GEAR-01 — gear.js -> RawGearDB Adapter
**Status:** RATIFIED and IMPLEMENTED
**Date:** 2026-04-17 (Session 11)
**Spec:** LC6_Planning/specs/PHY-GEAR-01_Spec_v2_RATIFIED.md
**Commits:** 51ead73 (Phase 1 types), 2d091ed (Phase 2 adapter + test fixtures),
de0ed75 (Phase 3 enumerate + tests + matrix wiring)

**Decision:** Port LC5 gear.js corpus (1,627 products, 175+ brands) into LC6's
convertGearDB adapter with full 12-slot GearSlot vocabulary, 19-subslot source
metadata, confidence tier system with LC5 peer-imputation (median-not-mean
correction), fiber inference from brand/model text, activity-exclusive brand
filter, activity aliasing, waterproof clamping, sleep system via separate
confidence axis, and immersion gear captured inert.

**Outcomes delivered:**
- Adversarial matrix: 12/19 -> 19/19 scenarios enumerate against real gear
- Tests: 597 -> 628 (+31 PHY-GEAR-01 tests, no regressions)
- Architecture: v1.1 -> v1.2 (additive GearSlot expansion)
- No thermal engine changes (Cardinal Rule #8 preserved)
- Spec honesty ledger (§5.7) flags 9 LC5-derived calibration constants as
  GAP-tracked, with PHY-GEAR-PEER-CAL/WARMTH-CAL/BREATH-CAL follow-up specs

**Amendments during ratification (v1 -> v2):**
- Amendment A: immersion gear to new slot (not shell); PHY-IMMERSION-01 raised
- Amendment B: Calibration Constants Honesty Ledger (§5.7)
- Amendment C: warmthRatio->CLO and breathability->im flagged as LC5 calibration

**Follow-up specs raised (all deferred, see Open Issues Ledger):**
- PHY-IMMERSION-01 (physics port, low priority)
- PHY-GEAR-PEER-CAL, PHY-GEAR-WARMTH-CAL, PHY-GEAR-BREATH-CAL
- PHY-GEAR-02, PHY-GEAR-03

**Open question raised:** OQ-REGIONAL-MR (high priority, blocks PHY-INFOGRAPHIC-01)

