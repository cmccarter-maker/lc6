# PHY-PERCEIVED-MR-REDESIGN v1 — Session 17 Closure

**Status:** REVERTED — superseded by documented calibration of existing output layer
**Closure session:** 17 (2026-04-18 evening)
**Supersedes v1 RATIFIED:** Session 14 ratification stands in the historical record; this closure reclassifies the implementation path.

---

## Decision

PHY-PERCEIVED-MR-REDESIGN v1 is reverted. The pre-REDESIGN output layer is restored:

- `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` — reinstated
- `COMFORT_THRESHOLD = 40` mL — reinstated
- `× 7.2` output scaling — reinstated
- `applySaturationCascade` — reinstated
- BSA threading through `calc_intermittent_moisture.ts` — reverted

Tests: 636/636 passing (S15's 11 new REDESIGN-specific tests reverted with the file).

---

## Rationale

Session 13's moisture-output audit (`audits/MOISTURE_OUTPUT_AUDIT_S13.md`) correctly identified that the `7.2` multiplier and `40 mL` threshold lack inline code citations. The audit's *conclusion* — that these are fudge factors to be eliminated — treated the absence of inline documentation as proof of arbitrariness. That conclusion was wrong.

The 7.2 factor is a **calibration constant anchored to a documented design principle**: Fechner's Law applied to wetness perception. The saturation cascade (Technical Analysis v5 §3.5, saturation_cascade.html) describes three regimes:

| Score | Regime | Physical meaning |
|---|---|---|
| 0–4 | Absorption | Linear, manageable; fabric near rated insulation |
| 4–6 | Crossover | Liquid bridges forming; insulation drops 40–60%; perception lagging |
| 6–10 | Cascade | Fabric phase-transitioned to conductor; self-reinforcing; perception plateaus while danger accelerates |

The 7.2 factor enforces the output budget that keeps normal-bad scenarios in the 0–6 band and reserves 6–10 for the cascade. Removing it (as REDESIGN v1 did) causes any meaningful uncompensable sweating to pin MR at 10 regardless of severity.

**Shipped-behavior validation anchor:** TA v5 documents that a deliberate stress test (95% RH at 20°F in Rocky Mountain NP) produces MR=4.3 — explicitly moderate, not critical, because Clausius-Clapeyron limits absolute moisture at cold temperatures. This anchor is the design target. REDESIGN v1 would have pushed this scenario into the 7–10 range.

## What the audit got right (retained)

- `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` is a fudge. The direction (base > outer) is cited; the specific ratios are not. **Tracked as PHY-WEIGHTS-CAL (MEDIUM).** Future redesign may derive these from Havenith 2002 microclimate work; not blocking.
- `COMFORT_THRESHOLD = 40 mL` uses a plausible torso-contact estimate (~0.8 m²) without explicit derivation. **Tracked as PHY-COMFORT-THRESHOLD-CAL (LOW).** Fukazawa 50 g/m² × torso fraction derivation should be added as code comment; no physics change.
- Lack of inline code comments explaining the 7.2 anchor was a real documentation gap. **Fixed in the revert commit** via explanatory comments in `perceived_mr.ts`.

## What the REDESIGN got wrong (not pursuing further)

- Treated the output layer as physics rather than psychophysics. A 0–10 risk score is inherently a perceptual mapping; pure physics gives buffers in mL and heat in W.
- Removed Fechner-based output budgeting without replacing the principle. Result: any meaningful sweating saturates at MR=10.
- Introduced a BSA-scaled comfort threshold without validating the downstream distribution.
- Created a cliff: skin wetness saturates at buffer ≥ 54g, with no differentiation between "slightly over" and "catastrophically over."

## Artifacts retained from Sessions 13–16

- **Master Tracking (`LC6_Master_Tracking.md`):** keep, canonical
- **Section J (Testing Discipline):** keep, applies to new physics tests
- **Session 13 audit (`audits/MOISTURE_OUTPUT_AUDIT_S13.md`):** keep as historical record
- **PHY-PERCEIVED-MR-REDESIGN v1 spec:** mark SUPERSEDED with this closure
- **PHY-HUMID-01 Phase 1 (commit e9d56b5):** shipped, unchanged
- **PHY-HUMID-01 v2 spec (Phase 2+3):** reverted code only; spec itself stays RATIFIED for future dedicated implementation session

## Calibration constants — post-revert classification

Per S16 plan, Section C of Master Tracking splits into two categories. The following are **calibrations** (retained with documentation), not **fudges** (requiring removal):

| Constant | File | Anchor |
|---|---|---|
| `× 7.2` output scale | `perceived_mr.ts` | Fechner/cascade budget per TA v5 §3.5 |
| `COMFORT_THRESHOLD = 40 mL` | `perceived_mr.ts` | Fukazawa 50 g/m² × ~0.8 m² torso contact |
| `0.85` evaporation cap | TBD (audit) | Minimum-retention physical reality floor |
| `trapped×5 + cold_penalty` | TBD (audit) | Wilderness-medicine danger-tier anchoring |
| `(H-60)/40 × 4.0` humidity floor | TBD (audit) | Cooper Landing anchor |
| Saturation cascade curve | `saturation_cascade.ts` | Three-regime design per TA v5 §3.5 |

And these remain **fudges** (genuinely arbitrary, specs will be written for physics replacements):

| Constant | File:Line | Replacement path |
|---|---|---|
| `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` | `perceived_mr.ts` | PHY-WEIGHTS-CAL (future spec; Havenith-derived) |
| `rawTempMul` 5-step staircase | `calc_intermittent_moisture.ts:453` | PHY-SWEAT-UNIFICATION (Gagge) |
| `_gradeMul` 4-step staircase | `calc_intermittent_moisture.ts:378` | PHY-GRADE-01 (Minetti) |
| `_ventHum` 3-step staircase | `calc_intermittent_moisture.ts:825` | PHY-HUMID-VENT-REWRITE (VPD) |

## Process lessons

Three patterns caused Sessions 13–16 to halt repeatedly without shipping:

1. **Conflating fudge and calibration.** Every 0–10 risk scale involves calibration. The rule is not "eliminate all calibration"; it is "document every calibration and distinguish from fudges." Cardinal Rule #1 is strengthened by this distinction, not weakened.

2. **Mid-session spec creation.** Sessions 13–16 created a spec, revised it twice, ratified it, and began implementation — all inside the rolling code-change work. Spec work should happen in dedicated sessions that do not touch code.

3. **Halt-audit-halt loops without shipped commits.** Four consecutive sessions produced no code commit. The meta-rule going forward: **if a session hasn't shipped a commit by hour 2, stop and reassess.**

## Forward plan

- **Session 17 (this):** Revert + document. Ship.
- **Session 18:** Smoke test 4 scenarios (Breck snowboarding, day hike, backpacking, fishing). Do they produce sensible MR values? Confirm TA v5 anchor (MR=4.3 extreme-humidity stress test) still holds.
- **Session 19+:** Pick one substantive work item per session from: Phase 1-Corrective architecture, IREQ Block 2, genuine staircase fudges (Gagge/Minetti/VPD replacements), Layer 2 pacing DP.

---

*End of closure.*
