# LC6 Open Issues Ledger

Tracks open questions, deferred work, and future spec candidates.

---

## Session 11 additions (PHY-GEAR-01 ratification, 2026-04-17)

### OQ-REGIONAL-MR — Upper vs lower body MR reconciliation
**Status:** Open. Priority: High (blocks PHY-INFOGRAPHIC-01, affects EngineOutput contract).
**Raised:** Session 11, PHY-GEAR-01 v2 §13.

LC6 engine computes CLO and im as whole-body values (BSA-weighted) but moisture
accumulates regionally. Three candidate resolutions: max-of-regions, BSA-weighted
blend (not recommended), regional-pair-as-first-class. Choice affects EngineOutput,
Architecture v1.2->v1.3, TA/ATP, PHY-070c winner hierarchy, PHY-072 CM triggers,
CDI v1.4 composition, Goldilocks schema, calcIntermittentMoisture.
**Must be resolved before PHY-INFOGRAPHIC-01 design.**

### PHY-IMMERSION-01 — Immersion gear physics port
**Status:** Open. Priority: Low (no immersion scenarios in current matrix).
**Raised:** Session 11, PHY-GEAR-01 v2 §13 and Amendment A.

Port LC5 risk_functions.js lines 904-960 and 1270-1310: WADER_DATA,
WETSUIT_DATA, IMMERSION_SHIELD tables; waderSplitIm, waderSplitCLO functions;
fishWading flag; split-body 45/55 BSA model; cold-shock shielding.
Activates immersion slot for enumeration. Scenarios unblocked: kayaking in
cold water, fishing while wading, paddleboarding with wetsuit.
**Cardinal Rule #8 work** — requires Chat-produced code + hand-computed
verification against LC5 reference scenarios.

### PHY-GEAR-PEER-CAL — Peer imputation calibration derivation
**Status:** Open. Priority: Low.
**Raised:** Session 11, PHY-GEAR-01 v2 §5.7 Honesty Ledger.

Empirically derive the 7 peer-matching tuning constants (strict ±2.5, strict ±1,
40% temp overlap, relaxed ±4, relaxed ±2, 60% match threshold, min-3 peers) by
withholding attributes, running imputation, measuring RMSE, tuning for minimum
error. Build validation harness. Low priority — current LC5 values work
acceptably across 1,627 products.

### PHY-GEAR-WARMTH-CAL — warmthRatio->CLO empirical derivation
**Status:** Open. Priority: Low.
**Raised:** Session 11, PHY-GEAR-01 v2 §3.2 and §5.7.

Derive piecewise-linear breakpoints/slopes empirically via thermal manikin
testing per ISO 15831. Current endpoints are ISO 9920-plausible; interpolation
shape is LC5-derived.

### PHY-GEAR-BREATH-CAL — breathability->im empirical derivation
**Status:** Open. Priority: Low.
**Raised:** Session 11, PHY-GEAR-01 v2 §3.3 and §5.7.

Derive linear slope/offset empirically via Woodcock/Fukazawa measurements.
Current endpoints are ISO 9920-consistent (im=0.09 to 0.45, bracketing published
defaults 0 / 0.38 / 0.5); interpolation shape is LC5-derived.

### PHY-GEAR-02 — score_products.js lower.insulation classification
**Status:** Open. Priority: Low.
**Raised:** Session 11, PHY-GEAR-01 v2 §13.

Extend score_products.js classifySubcategory to emit lower.insulation for
products matching insulated-pants patterns. Currently the scraper has no
lower-body insulation sub-classification. The bucket exists in RawGearDB as
an empty landing slot for manual curation.

### PHY-GEAR-03 — Gear catalog curation sweep
**Status:** Open. Priority: Low.
**Raised:** Session 11, PHY-GEAR-01 v2 §13.

Sweep gear.js for misclassified products: insulated pants in lower.ski_pants
that belong in lower.insulation; wader products in 'gear' bucket that should
move to a dedicated wader bucket with thermal attributes; etc.



## Session 12 additions (PHY-HUMID-01 ratification, 2026-04-17)

### OQ-H3-HUMID-LOW-MR — H3 warm/humid running MR anomaly
**Status:** DIAGNOSED. Fix ratified as PHY-HUMID-01 v1. Pending Session 13+ implementation.

Adversarial matrix H3 (75°F / 90%RH / 1.5hr running) produced MR=0.7 against real
1,627-product gear catalog. Hand-computed physics showed E_req ≈ 600W, E_max ≈ 224W,
w_req ≈ 2.7 — deeply uncompensable, should produce ~400g accumulation. Root cause:
hardcoded _tDewMicro = 29°C + wrong gating of _excessHr through cold-weather
condensation severity. Ratified fix: PHY-HUMID-01 v1.

### PHY-SWEAT-UNIFICATION — Replace rawTempMul staircase with Gagge energy balance
**Status:** Raised Session 12. Priority: Medium (fudge factor removal).

`phaseSweatRate` uses a 5-step temperature multiplier staircase (line 453 of
calc_intermittent_moisture.ts). No citation. The running branch already uses
Gagge energy balance via computeSweatRate — this spec extends that physics path
to all activity phases (lift, steady, fishing, golf, camping).

### PHY-GRADE-01 — Minetti GAP replacement for _gradeMul
**Status:** Raised Session 12. Priority: Low.

4-step staircase at line 377 for grade metabolic multiplier. Minetti 2002
Journal of Applied Physiology provides derived polynomial for gradient running
cost. Audit required to confirm whether partially implemented elsewhere
(memory note: "PHY-064: Naismith-Langmuir (walking), Minetti GAP (running)").

### PHY-HUMID-VENT-REWRITE — _ventHum staircase to VPD-derived effectiveness
**Status:** Raised Session 12. Priority: Low.

3-step staircase at line 825 for venting humidity factor. Replace with
physics-derived:
_ventEffectiveness = max(0, 1 - p_amb_eff / p_micro_pre_vent)

### PHY-HUMID-HUMMUL-CAL — Empirical humMul derivation
**Status:** Raised Session 12. Priority: Low.

humMul (line 455): `1 + max(H-40, 0)/100 × 0.8`. Physiologically grounded
(Nielsen & Endrusick 1990 compensatory sweat) but 40% knee and 0.8 slope are
calibration. Empirical derivation requires controlled compensatory-sweat-rate
experiments vs ambient RH.

### PHY-HUMID-EXCESS-CAL — Validate _excessRetention 0.10 skin-diffusion coefficient
**Status:** Raised Session 12. Priority: Medium.

PHY-HUMID-01 introduces `_excessRetention = 1.0 - _ambientMargin × 0.10`.
The 0.10 coefficient represents skin-level diffusion escape of uncompensable
sweat. Empirical validation via wet-skin vapor transport experiments
(controlled RH, vapor pressure gradient measurements, sweat accumulation
gravimetric tracking).
