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

