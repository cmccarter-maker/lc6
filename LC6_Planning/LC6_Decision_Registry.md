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


## DEC-PHY-HUMID-01-CORRECTION — Session 12 post-ratification audit caught fudge factor
**Status:** RATIFIED (v2 supersedes v1)
**Date:** 2026-04-17 (Session 12, same session as v1 ratification)
**Supersedes:** DEC-PHY-HUMID-01 (v1 ratification)
**Spec:** LC6_Planning/specs/PHY-HUMID-01_Spec_v2_RATIFIED.md

**Trigger:** After v1 was ratified and pushed (commit c5785c6), Christian
pressed a question that forced a deeper audit: "If the inside of the shell
can back-diffuse into the outermost layer, why is this water not trapped in
the layering system?" This question revealed that v1's proposed
`_excessRetention = 1.0 - _ambientMargin × 0.10` was a fudge factor.

**Forensic audit findings:**

The real bug at H3 is not a missing retention coefficient. It is MISROUTING.
Three categories of moisture are currently treated identically when they
have different physical origins and destinations:

1. `_retainedCondensG` (vapor condensing at thermal boundary) — correctly
   routed via `_condensWeights` and gated by `_netRetention`
2. `_excessHr`, `_liftExcessG`, `_insensibleG` (liquid at skin) — incorrectly
   gated by `_netRetention` AND routed via `_condensWeights`. Both are wrong
   for liquid: gating zeros them at warm ambient, condens-weights misroutes
   them to outer layers. Correct physics: route directly to `_layers[0]`
   (base), let Washburn wicking redistribute outward.
3. `_aHygro` (ambient vapor absorbed from outside) — currently DEAD CODE.
   Computed at line 534 but never applied to layers. Correct physics: route
   directly to `_layers[length-1]` (shell).

**Cardinal Rule #1 corrections:**
- REMOVED `_excessRetention` coefficient entirely (v1's error — never ships)
- CANCELLED PHY-HUMID-EXCESS-CAL follow-up spec (no coefficient to derive)
- All remaining constants cite published sources

**Cardinal Rules preserved:**
- #1: zero new calibration coefficients; the v1 fudge is withdrawn
- #8: thermal engine still untouched this session (audit only)
- #11: v2 ratified before any code is written
- #14: audit was done before proposing — v1's error was caught through
  deeper reading when Christian's question forced it

**Process lesson:** Ratification in the same session as drafting is
acceptable for narrow, well-understood fixes. For physics changes that
touch the core engine, a forensic audit that traces every variable from
source to output should precede ratification. v1's accelerated
ratification bypassed that audit; v2 is the audited spec.

**Follow-up:** Session 13 implements v2. No empirical calibration work
required for PHY-HUMID-EXCESS-CAL (cancelled).


## DEC-MOISTURE-OUTPUT-AUDIT — Session 13 Cardinal Rule #1 audit of MR output pipeline
**Status:** Audit RATIFIED. Spec PHY-PERCEIVED-MR-REDESIGN v0 DRAFT pending review.
**Date:** 2026-04-17 (Session 13)

**Trigger:** During PHY-HUMID-01 v2 Phase 2+3 implementation, user pressed:
"How is `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` not a fudge factor?" Halting Phase 2+3
commit, Session 13 conducted forensic audit of the moisture-output pipeline.

**Audit scope:** `packages/engine/src/moisture/perceived_mr.ts` conversion from per-layer
buffer state to 0-10 perceived MR score. Also cross-referenced against Scientific
Foundations document §3.3-3.5.

**Findings (3 Cardinal Rule #1 violations in perceived_mr.ts):**
1. `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` — FUDGE. Fukazawa 2003 + Zhang 2002 justify that
   skin-adjacent layers matter more (direction), but not the specific ratios.
2. `COMFORT_THRESHOLD = 40 mL` uniform — PARTIALLY CITED. Fukazawa 50 g/m² is cited; the
   implied 0.8 m² contact area is not cited; threshold should scale with user BSA.
3. `7.2` output scaling factor — FUDGE. No citation. Output-shaping calibration that
   determines meaning of every MR threshold downstream.

**Additional findings via Scientific Foundations §3.3-3.5:**
- 0.85 evaporation rate cap (§3.3) — explicit calibration, status in LC6 TBD
- Humidity floor `max(0, (H-60)/40)×4.0` (§3.4) — explicit calibration, status in LC6 TBD
- Cold penalty `trapped×5 + cold_penalty` (§3.2) — explicit calibration, status in LC6 TBD
- Saturation cascade 6-cutoff quadratic ease (§3.5) — CONFIRMED as calibration/compression

**Resolution:**
- Audit RATIFIED and published at LC6_Planning/audits/MOISTURE_OUTPUT_AUDIT_S13.md
- Spec PHY-PERCEIVED-MR-REDESIGN v0 DRAFT written at LC6_Planning/specs/ (holds pending
  forensic review per Cardinal Rule #14)
- Phase 2+3 implementation HELD — test expectations locked to fudge output would lock in
  the fudge. Combined commit with PERCEIVED-MR-REDESIGN in Session 14.
- 5 new open issues added to LC6_Master_Tracking.md Section B.7 and Section C
- Memory rule #30 added: tracking file is canonical, session ritual is inviolable

**Process lesson:** Session 13 v1 close-out script used fuzzy idempotency check
`if "Session 13" not in sl_content` which silently matched Session 12 handoff notes
referencing "Session 13+" and skipped the write. Entries never landed in ledgers.
User challenge surfaced the gap via simple demand: "show me every circle-back item."
Led to construction of LC6_Master_Tracking.md as canonical source and
Memory #30 prohibiting fuzzy idempotency checks.

**Cardinal Rules preserved:**
- #1: 3 fudges named and targeted by spec (not hidden)
- #8: thermal engine not modified (Phase 2+3 held until spec complete)
- #11: no code without ratified spec (DRAFT holds implementation)
- #14: audit preceded spec; spec precedes code

**Applied:** Tracking document, audit doc, DRAFT spec. No code changes.
**Unblocks:** Session 14 combined PHY-HUMID-01 v2 + PHY-PERCEIVED-MR-REDESIGN implementation.


## DEC-PHY-PERCEIVED-MR-REDESIGN — Ratify redesigned perceived MR computation
**Status:** RATIFIED as v1
**Date:** 2026-04-18 (Session 14)
**Spec:** LC6_Planning/specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md
**Audit:** LC6_Planning/audits/MOISTURE_OUTPUT_AUDIT_S13.md
**Supersedes:** v0 DRAFT (Session 13 initial attempt); v0.1 DRAFT (Session 14 interim)

**Context:**
Session 13 audit (DEC-MOISTURE-OUTPUT-AUDIT) caught 3 Cardinal Rule #1 violations in
perceived_mr.ts. v0 DRAFT proposed redesign but had a weakness: max() combination
operator underestimates compound discomfort. Session 14 forensic review identified
7 concerns total. v0.1 addressed them; v1 adds H3 humid-running as 4th hand-computation
reference (the scenario that triggered the original Session 12 investigation).

**Key design decisions locked:**

1. **Rule of 9's for BSA contact area.** 0.54 × BSA for long-sleeve base layer.
   Honestly documented as "physics-adjacent, domain-borrowed from medical burns assessment.
   Accepted as best available estimate until per-product coverage data is available."

2. **Fukazawa 50 g/m² accepted on faith.** Existing code comment citation propagated
   forward. Re-verification against source paper flagged for DOC-TA-V7 pass.

3. **Additive combination operator** (not max). `Math.min(10, skinWetness + ensembleSat * 0.3)`.
   Physical justification: compound discomfort (wet base AND saturated shell) is worse
   than either alone. `× 0.3` is a documented latent calibration (PHY-PR-CHILL-WEIGHT),
   replacing v0's hidden `× 0.5` fudge with a named flag.

4. **Uniform averaging for ensemble saturation.** Zero-calibration simplest choice.
   Layer-specific weighting would re-introduce calibration — the exact thing the audit
   is trying to eliminate.

5. **Cardinal Rule #3 boundary explicit.** `computePerceivedMR` is THE public interface.
   Sub-functions marked `@internal` via comments; code review enforces.

6. **Downstream impact gate (§6).** Implementation blocked on audit of ALL sessionMR
   consumers before commit. CDI multipliers at evaluate.ts:741 are calibrated against
   old 7.2-scaled MR distribution and must be re-evaluated.

7. **4 reference scenarios for hand-computation** (§7): Breck 16°F cold baseline,
   cycling 85°F warm uncompensable, hike 55°F humid middle-ground, H3 75°F/90% RH
   running (the redesign-triggering scenario — MR must be 5-8 post-fix, not 0.7).

**Cardinal Rule accounting:**
- #1: three fudges removed (PERCEIVED_WEIGHTS, 7.2 scaling, uniform 40mL), one named
  calibration remains (0.3 additive factor) with tracker entry
- #3: single source of truth preserved via `computePerceivedMR` wrapper
- #11: no code without ratified spec — v1 ratified before implementation
- #14: forensic review preceded ratification (7 concerns raised and addressed)

**Follow-up specs raised (already in Master Tracking):**
- PHY-PR-COVERAGE-VAR (activity-specific torso coverage)
- PHY-PR-CHILL-WEIGHT (empirical derivation of 0.3 coefficient + layer-specific ensemble weighting)

**Applied: NO CODE CHANGES THIS SESSION.** Spec ratified only. Implementation Session 15+.
**Unblocks:** Session 15+ implementation combined with PHY-HUMID-01 v2 Phase 2+3.


## DEC-S15-GATE-SKIP — Session 15 halted at §7 gate; process lesson captured
**Status:** Process decision (halt + lesson capture)
**Date:** 2026-04-18 (Session 15)

**Context:**
Session 15 set out to implement PHY-PERCEIVED-MR-REDESIGN v1 + PHY-HUMID-01 v2
Phase 2+3 per spec §8. The spec had two blocking gates:
- §6: downstream audit of all sessionMR consumers
- §7: hand-computed reference values for 4 scenarios before test assertion updates

**What happened:**
Session 15 completed §6 partially (audit grep done, 5 consumer sites found) and
implemented the REDESIGN code. When the tests ran with 13 failures in
`calc_intermittent_moisture.test.ts`, the next logical step appeared to be
"update the expected values to match the new engine output." Claude was
proceeding toward this update when user raised the objection:

    "Wait. We know we have issues which need resolved and which result in
    inaccurate results. Are we comparing our expected results to 'locked in'
    results that we now know are incorrect... meaning we are performing an
    iterative solution on a flawed result..."

The failing test values were SNAPSHOTS captured from the pre-REDESIGN engine
(tagged `[PHY-071]`). They were not physics-validated expectations. Updating
them to match the new engine output would have "calibrated new engine to old
fudge outputs" — preserving the 7.2-scaling fudge's influence under a cleaner
surface API. Shipping would have claimed fudge removal while shipping
functionally equivalent fudge-calibrated values.

The §7 gate was designed to prevent exactly this. Claude skipped it by implicit
reasoning ("tests show what shifted, update tests to match"). User halted
before any test values were modified.

**Decision:**
1. Halt Session 15 immediately. No test expectation changes committed.
2. Preserve working tree state for S16 resumption (REDESIGN + Phase 2+3 + bsa
   threading intact).
3. Commit tracker/ledger updates only — capture state and process lesson.
4. Update Memory #30 to capture the lesson: spec §-numbered gates are BLOCKING.
5. S16 must complete §7 properly before any test assertion changes.

**Process lesson:**
Cardinal Rule #14 applied to specs themselves. Specs contain numbered gates
("§X") that are blocking requirements, not advisory sequencing. Skipping a
gate because the next step "looks ready" is a fast path to shipping bad
physics with clean-looking code. If a spec says "complete §X before Y," Y
is blocked until §X produces evidence of completion.

**New tracker item raised:**
- S15-SPEC-SECTION-7-SKIPPED (HIGH, Section B.12)

**Cardinal Rules preserved:**
- #1: fudges removed in REDESIGN implementation (working tree); not shipping
  replacement calibrations yet
- #3: computePerceivedMR still single public source; sub-functions @internal
- #8: thermal engine modifications preserved pending §7 validation
- #11: no code without ratified spec (spec exists; implementation in progress)
- #14: audit preceded spec; spec should have preceded code; halt preserves
  integrity

**Applied:** Memory #30 updated, tracker entries added, ledger entry written.
No source code committed.
**Unblocks:** Session 16 (after §7 hand-computations validate reference scenarios)
