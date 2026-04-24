# S10B Hand-Computed Trace

**Session:** S10B (TrajectoryPoint heat-balance backfill)
**Date:** April 24, 2026
**HEAD at verification:** [S10B-CLOSE-SHA]
**Purpose:** Verify S10B additions to `IntermittentMoistureResult` and `TrajectoryPoint` do not alter computed values — only expose values already computed internally in `calcIntermittentMoisture`.

---

## Verification principle

S10B is additive. It exposes 17 new optional `perCycle*` arrays on `IntermittentMoistureResult` that read from locals already computed inside the RUN-phase of `calcIntermittentMoisture`'s cyclic path. No physics modified. No new constants beyond documented standard psychrometric values (Lewis factor 16.5 and Gagge mass-transfer denominator 61600, both ASHRAE-standard). `evaluate.ts`'s `buildTrajectory` consumes these arrays to populate TrajectoryPoint fields previously emitted as literal zero.

Hand-comp verification = identity check: each exposed value equals the internal local that computed it. Not a physics re-derivation.

**Non-regression evidence:** Full test suite remained 687 passed / 7 skipped / 0 failed across all 3 Phase implementations (Phase 1 interface additions, Phase 2 engine-layer population, Phase 3 evaluate-layer consumption). Bit-identical for all pre-S10B metrics including sessionMR, trapped, perCycleMR, perCycleTSkin, perCycleCoreTemp, perCycleCIVD, fatigue, peakHeatBalanceW.

---

## Source mapping — internal local → exposed field

All line numbers reference `packages/engine/src/moisture/calc_intermittent_moisture.ts` at HEAD md5 `8f75328ca16087a31db803fcfb3ce98b` (pre-S10B-edits) / HEAD md5 after S10B Phase 2 edits (will differ).

### Core heat-balance terms (RUN-phase snapshot at end of cycle)

| Exposed field | Internal local | Source line | Units |
|---|---|---|---|
| `perCycleM` | `_Qmet` | 966 (`computeMetabolicHeat(_cycleMET, _bodyMassKg)`) | W |
| `perCycleW` | `0` (constant) | — | W (mechanical work; 0 for ski/hike, future non-zero for cycling) |
| `perCycleC` | `_QconvRun` | 967 (`computeConvectiveHeatLoss(...)`) | W |
| `perCycleR` | `_QradRun` | 969 (`computeRadiativeHeatLoss(...)`) | W |
| `perCycleEResp` | `_respRun.total` | 971 (`computeRespiratoryHeatLoss(...)`) | W |
| `perCycleESkin` | `_ediffRun + _srRun.qEvapW` | 974 + 979 (E_diff + sweat-driven latent) | W |
| `perCycleEMax` | `_emaxRun.eMax` | 978 (`computeEmax(...).eMax`) | W |
| `perCycleEReq` | `_eReqRun` | 977 (`Math.max(0, _residRun)`) | W |

### Coefficients and state (RUN-phase)

| Exposed field | Internal local | Source line | Units |
|---|---|---|---|
| `perCycleHc` | `_hcRun` | 962 (`8.3 × √(max(0.5, _windMs + _cycleSpeedWMs))`) | W/m²K |
| `perCycleHMass` | `_hcRun / 61600` | computed in push | m/s (Gagge mass-transfer convention) |
| `perCyclePa` | `_Pa_ambient` | 556 (`pSatPa(_TambC) × (humidity/100)`) | Pa |
| `perCycleReClEffective` | `_Rclo / (_effectiveIm × 16.5)` | computed in push | m²Pa/W (ISO 9920) |
| `perCycleVPD` | `pSatPa(_TskRun) - _Pa_ambient` | computed in push (Magnus formula) | Pa |

### Supplementary replacements for crude placeholders

| Exposed field | Internal local | Source line | Replaces placeholder |
|---|---|---|---|
| `perCycleSweatRate` | `_srRun.sweatGPerHr / 3600` | 979 (`computeSweatRate(...).sweatGPerHr`) | old: `S_heat > 0 ? 0.01 : 0` (g/s) |
| `perCycleTCl` | `_TsurfRun` | 968 (`_TskRun - (T_skin - T_amb) × (R_clo / (R_clo + R_a))`) | old: `T_skin - 2` |
| `perCycleHTissue` | `1 / _Rtissue` | 841 (`computeRtissueFromCIVD(_civdCycle)`) | old: `vasoconstriction ? 5.0 : 9.0` |

### RUN-phase storage (added for first-law verification scope consistency)

| Exposed field | Internal local | Source line | Scope |
|---|---|---|---|
| `perCycleSRun` | `_runNetHeat` | 982 (`_residRun - _srRun.qEvapW`) | RUN-phase only (W) |
| `perCycleHeatStorage` (pre-existing) | `_cycleAvgW` | 988 (cycle-averaged across 4 phases: line/lift/transition/run) | cycle-averaged (W) |

Distinction matters because `perCycleHeatStorage` covers all 4 phases (line + lift + transition + run) per S31's 4-phase decomposition, while `perCycleSRun` captures RUN-phase only. Heat-balance first law `M - W = C + R + E_resp + E_skin + S` requires all terms scoped to the same time window; using `perCycleSRun` for first-law verification is correct, while `perCycleHeatStorage` remains available for cycle-level diagnostic display.

---

## Cycle-0 values for G1/M2/P5 vectors

All values computed by engine at RUN-phase of cycle 0, exposed through S10B's Phase 2 push block at the end of the cycle loop.

### G1 (Ghost Town groomers, Tier 1 fallthrough, snowboarding 8.5hr at 16°F/30%RH/5mph)

| Field | Value | Units |
|---|---|---|
| M | 372.17 | W |
| W | 0 | W |
| C | 158.92 | W |
| R | 27.70 | W |
| E_resp | 86.29 | W |
| E_skin (E_diff + qEvapW) | 61.08 | W |
| S_run | 38.18 | W |

### M2 (Tier 2 moguls, snowboarding 8.5hr at 20°F/45%RH/8mph)

| Field | Value | Units |
|---|---|---|
| M | 372.17 | W |
| W | 0 | W |
| C | 147.44 | W |
| R | 32.55 | W |
| E_resp | 84.07 | W |
| E_skin (E_diff + qEvapW) | 60.54 | W |
| S_run | 47.58 | W |

### P5 (Tier 5 powder Saturday, snowboarding 8.5hr at 18°F/80%RH/3mph, 70% precip)

| Field | Value | Units |
|---|---|---|
| M | 372.17 | W |
| W | 0 | W |
| C | 144.88 | W |
| R | 42.17 | W |
| E_resp | 83.67 | W |
| E_skin (E_diff + qEvapW) | 57.68 | W |
| S_run | 43.77 | W |

**Note on M = 372.17 identical across all three vectors:** all three vectors run snowboarding on moguls or groomers terrain at 'very_high' intensity (per MET table). `_Qmet = computeMetabolicHeat(_cycleMET, _bodyMassKg)` with `_cycleMET = 10` and `_bodyMassKg` from weightLb=170 (77.1 kg) produces identical M. This is correct engine behavior — metabolic heat depends on MET × body mass, not on ambient conditions or terrain microstructure. Environmental differences (temp, humidity, wind) manifest in the loss terms (C, R, E_resp), which do vary across vectors as expected.

---

## First-law residual verification

First law: `M - W = C + R + E_resp + E_skin + S`

For each vector, LHS and RHS use RUN-phase-scoped values only.

| Vector | LHS (M − W) | RHS (C + R + E_resp + E_skin + S_run) | Residual | Tolerance gate |
|---|---|---|---|---|
| G1 | 372.17 | 158.92 + 27.70 + 86.29 + 61.08 + 38.18 = 372.17 | 0.00 | <15 ✓ |
| M2 | 372.17 | 147.44 + 32.55 + 84.07 + 60.54 + 47.58 = 372.18 | 0.01 | <15 ✓ |
| P5 | 372.17 | 144.88 + 42.17 + 83.67 + 57.68 + 43.77 = 372.17 | 0.00 | <15 ✓ |

Residuals within solver precision (0.00-0.01W, at the rounding noise floor of 2-decimal display). No systematic residual. First law closes exactly.

---

## Sign-off

S10B verification complete:
- All 17 new `perCycle*` fields populated from internal locals via identity mapping
- Heat-balance first law closes to within solver precision (0.00-0.01W residual across G1/M2/P5)
- TrajectoryPoint fields consumed via optional chaining from `mr.perCycle*` — no consumer-side composition, only plumbing
- No engine physics modified
- No new constants introduced beyond documented Lewis factor (16.5, ASHRAE) and Gagge mass-transfer denominator (61600, ASHRAE)
- Non-regression: 687 pre-existing tests pass bit-identically
- 49 new probe tests pass (46 original + 3 added for S_run structural verification)

Cardinal Rule #8 preserved: `calcIntermittentMoisture` locks are for physics modification, not additive interface exposure. All additions are additive.
Cardinal Rule #3 (single source of truth) preserved: heat-balance computation remains inside `calcIntermittentMoisture`; `evaluate.ts` only reads.
Cardinal Rule #1 (no fudge factors) preserved: all constants and tolerances traced to published sources or identity checks.

---

## Caught in-flight — amendment-level physics corrections

Two corrections to Chat's original Phase 2 authoring surfaced during Phase 4.2 verification:

1. **`perCycleESkin` was incorrectly defined as `min(E_diff, E_max)` in original kickoff.** Per engine's own `_QpassRun` composition (line 975) and `_runNetHeat` formula (line 982), full skin evaporation is `E_diff + qEvapW` (diffusion + sweat-driven latent). Both channels operate in parallel. Corrected push: `_ESkinTotalW = _ediffRun + _srRun.qEvapW`.

2. **`perCycleEReq` was incorrectly sourced from `_ediffRun` in original kickoff.** E_req should be required evaporation = residual heat after passive losses, which is `_eReqRun = Math.max(0, _residRun)` at line 977. Not E_diff (which is passive insensible diffusion). Corrected push: `_perCycleEReq.push(Math.round(_eReqRun * 100) / 100)`.

Both caught by the first-law residual test failing at ~100W on initial run, diagnosed to the missing qEvapW channel in E_skin plus the E_req/E_diff conflation. Fixes are additive (correct engine locals exposed), not accommodations. First law subsequently closes to 0W.

Pattern: **Chat's initial authoring conflated related-but-distinct engine quantities** (E_diff vs E_skin, E_req vs E_diff). The first-law verification gate was the right mechanism to catch this — the residual signal pointed directly at missing or misattributed channels, which was resolvable by reading engine lines 974-982 carefully.

**Not a FABRICATED-METHODOLOGY incident** (methodology was sound — write the probe, check the residual). **Is a mild variant of** **FIRST-PRINCIPLES-DRIFT** — Chat wrote pushes from memory of the heat-balance structure rather than reading the engine's `_QpassRun` composition directly. Catalog candidate for SessionA failure-mode supplementation; not session-halting.

---

**END S10B HAND-COMP TRACE.**
