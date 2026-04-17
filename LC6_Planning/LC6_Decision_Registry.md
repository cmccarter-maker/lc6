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



## DEC-PHY-HUMID-01 — Physics-Derived Moisture Accumulation in Warm/Humid Conditions
**Status:** RATIFIED and PENDING IMPLEMENTATION
**Date:** 2026-04-17 (Session 12)
**Spec:** LC6_Planning/specs/PHY-HUMID-01_Spec_v1_RATIFIED.md
**Implementation target:** Session 13 or later

**Decision:** Replace hardcoded cold-weather reference temperatures in the per-layer
condensation model with Magnus-derived physics values. Add uncompensable excess sweat
retention via skin/ambient vapor pressure ratio. Delete dryAirBonus, _localDryBonus,
and humidityFloorFactor fudge factors — VPD ratio already captures the dry-air
advantage via physics, and humidityFloorFactor is redundant with vpdRatio.

**Diagnostic finding:** Adversarial matrix scenario H3 (75°F / 90% RH / 1.5hr running)
produced MR=0.7 against real 1,627-product gear catalog. Hand-computation shows
E_req ≈ 600W, E_max ≈ 224W, w_req ≈ 2.7 — deeply uncompensable. Model correctly
computed _excessHr ≈ 270 g/hr, but cold-weather condensation placement logic
(_tDewMicro = 29°C hardcoded) suppressed retention to 2.8% at H3's warm ambient.
97% of physically-real excess sweat disappeared from the moisture model.

**Ratification path (accelerated):** draft v0 produced and ratified same session (12)
per Christian's explicit direction. Five open questions resolved at ratification per
spec's recommended resolutions (§11). No code changes this session — implementation
deferred to Session 13 or later.

**Cardinal Rules preserved:**
- #1: dryAirBonus, _localDryBonus, humidityFloorFactor REMOVED as fudge factors.
  _excessRetention 0.10 coefficient flagged as latent calibration (PHY-HUMID-EXCESS-CAL).
- #8: thermal engine locked; no code changes this session.
- #11: no code without ratified spec.
- #16: EngineOutput contract unchanged.

**Follow-up specs raised:**
- PHY-SWEAT-UNIFICATION (replace rawTempMul staircase with Gagge)
- PHY-GRADE-01 (Minetti GAP replacement for _gradeMul)
- PHY-HUMID-VENT-REWRITE (_ventHum physics replacement)
- PHY-HUMID-HUMMUL-CAL (empirical humMul derivation)
- PHY-HUMID-EXCESS-CAL (empirical _excessRetention validation)
