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
## Status as of Session 23 (PHY-SHELL-GATE spec draft + PHY-HUMID-01 v2 §4.1 fudge deletion shipped)

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
| S21-F2-HARDCODED-SKIN-DEW | HIGH | Open — blocked on §10 gate | Hardcoded `_tSkinRetC=30` / `_tDewMicro=29` at LC6 `calc_intermittent_moisture.ts:740-741` (matches LC5:2790-2791 verbatim). PHY-HUMID-01 v2 §5.1 item 2 + §3.2. Magnus helpers exist in `heat_balance/vpd.ts:70,93` (`magnusDewPoint`, `inverseMagnus`) but never imported. Over-retains in cold-dry, under-retains in warm-humid — biases the trapped-moisture signal that distinguishes heavy from ultralight kits across conditions. Fix per spec §3.2: `_tSkinRetC = _TskRun` (already computed per-cycle); `_tDewMicro` derived per-layer via Magnus. |
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
| S22-CASCADE-ASYMMETRIC | HIGH | Open — spec pending (S24 target) | Overflow cascade at `calc_intermittent_moisture.ts:772-775` runs outer→inner only. When base (index 0) exceeds cap, line 776 silently clamps: excess liquid vanishes from simulation. Physically incorrect — real liquid cascades outward through mid → insulation → shell via capillary action before drip occurs. Fix requires symmetric inward→outward cascade mirroring existing outer→inner cascade. Discovered S22 evening during "layers as sponge" physics discussion. |
| S22-MICROCLIMATE-VP | HIGH | Open — spec pending (S25 target) | When shell `im` throttles vapor flux outward (humid ambient, saturated conditions), microclimate VP inside clothing rises. Rising microclimate VP reduces skin-to-microclimate VPD, which throttles evaporation at skin itself. This feedback loop is not currently modeled — code computes sweat rate and evap rate independently of internal VP state. Affects `computeEmax` during sustained humid activity. Requires tracking microclimate VP as engine state. |
| S22-BREATHABILITY-TO-IM-DIVERGENCE | MEDIUM | Open — small bounded fix | Two diverging implementations of `breathabilityToIm`: `adapter.ts:105-107` (linear: `0.05 + b/10 × 0.40`, b=7 yields im=0.33) vs `gear_layers.ts:127-134` (piecewise: b=7 yields im=0.20). Same gear produces different im depending on code path. Consolidate to single source of truth. |
| S22-FIBERTYPE-TYPE-DRIFT | MEDIUM | Open — small bounded fix | `types.ts:569` defines `FiberType = "synthetic" \| "wool" \| "cotton" \| "down" \| "blend"` (lowercase, 5 values). `gear_layers.ts:9` defines `FiberType = 'WOOL' \| 'COTTON' \| 'SYNTHETIC' \| 'DOWN'` (uppercase, 4 values). Adapter must translate between them. Single source of truth needed. |
| S22-MR-VALIDATION-ANCHOR-CONTAMINATED | MEDIUM | Open — post-shell-gate work | S17 closure designated TA v5 §3.5 95% RH / 20°F Rocky Mountain scenario (MR=4.3) as the validation anchor for the 7.2 output scale. That anchor was produced by an engine with broken upstream physics (shell cap, cascade asymmetry, microclimate VP unmodeled). After shell-gate / cascade / VP specs ship, must re-run this anchor scenario to confirm 7.2 scale still holds. If anchor fails post-fix, upgrade to HIGH and open new spec for MR output layer calibration. |
| S22-DRYING-THERMAL-DRAG | MEDIUM | Open — cross-concern for heat balance engine | Shell research (S23 morning): softshell at 72 mL saturation represents ~45 Wh evaporative heat load. Drying a saturated softshell over 3hr consumes roughly 50% of resting metabolic output (80-100W). Heat balance engine currently does not subtract this thermal cost from user metabolic budget. Not a moisture model fix — affects CDI/HLR calculations downstream. Cross-concern, not blocking shell-gate. |
| S22-PERCEIVED-WEIGHTS-DIRECTION | MEDIUM | Open — revisit post-shell-gate | User argument (S23 morning): `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` encodes Fukazawa-style skin-centric perception, but this misrepresents the physics signal. Base saturation is a binary failure indicator (whole-system saturation has occurred), not a proportional contributor. Weighting base highest makes MR climb gradually with base fill when it should hit max when base crosses threshold. Upgrades existing PHY-WEIGHTS-CAL (S17 classification) from ratio-tuning question to direction-questioning question. Blocked on post-shell-gate re-validation of MR output layer. |
| S22-HUMIDITY-FLOOR-VALIDATION | MEDIUM | Open — investigation needed | `humidityFloorFactor` at `heat_balance/utilities.ts:48` (callsite `split_body.ts:160`) serves as evaporation floor in saturated conditions. PHY-HUMID-01 v2 §4.2 proposed deletion as "redundant with vpdRatio" but S23 morning chat-history review revealed its original purpose was Cooper Landing protection: stationary fisher at 100% RH where sweat-only model under-predicts MR. S22 commit `51885be` activated `_aHygro` routing which may now handle that regime correctly, making the floor redundant. Not verified. Deletion deferred from S23 fudge-deletion commit `39b2846` pending proper investigation. Scope: run Cooper Landing (35°F/100% RH/stationary fishing/6hr) through engine before and after floor deletion to confirm MR behavior is preserved via `_aHygro`. Test file `s23_fudge_deletion_verify.test.ts` can be extended with Cooper Landing scenario. |

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

## Section G: Verification Commands

Run these at any time to prove the tracker is accurate. Every expected ID must appear. If a grep returns 0, the tracker is incomplete.

```bash
cd ~/Desktop/LC6

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
  S20-FIBER-ABSORPTION-VALIDATION S20-DURATION-PENALTY-CEILING
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
cd ~/Desktop/LC6
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
