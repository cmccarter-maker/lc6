# PHY-MICROCLIMATE-VP — Unified Microclimate Vapor Pressure Spec v1 DRAFT

**Status:** DRAFT (authored S25, pending ratification S26)
**Supersedes:** `S22-MICROCLIMATE-VP` and `S21-F2-HARDCODED-SKIN-DEW` tracker items (both HIGH)
**Author session:** S25
**Target implementation:** S27-S28

---

## Abstract

The engine currently uses ambient humidity everywhere it needs a humidity input, including at interfaces that physically see microclimate humidity (the air trapped between skin and innermost garment, or between any two adjacent layers). This spec unifies the correction of two currently-separate tracker items because they share the same underlying missing state: per-layer microclimate vapor pressure (VP).

Implementation introduces one new helper function (`computeMicroclimateVP`) that derives per-interface VP via Magnus and the existing thermal gradient calculation. The resulting VP values are then threaded into the appropriate callsites at `calc_intermittent_moisture.ts` — replacing the hardcoded `_tDewMicro = 29` placeholder (S21-F2) and replacing ambient `humidity` in four callsites that physically see microclimate conditions (S22-MICROCLIMATE-VP).

No thermal-engine signature changes required. Cardinal Rule #8 compliant.

---

## 1. Problem Statement

### 1.1 Two symptoms, one missing state

The engine currently treats microclimate humidity as identical to ambient humidity. This creates two separately-flagged symptoms:

**Symptom A (S21-F2-HARDCODED-SKIN-DEW):** The condensation placement algorithm at `calc_intermittent_moisture.ts:739-761` uses `_tDewMicro = 29` (hardcoded constant, ~29°C) as the dew point that drives condensation distribution across layers. Real microclimate dew point varies continuously with skin temperature, sweat rate, and vapor transport through layers.

**Symptom B (S22-MICROCLIMATE-VP):** The evaporation physics at `calc_intermittent_moisture.ts:657, 671, 688, 702, 735, 808, 809, 971` uses ambient humidity when computing skin-side evaporation rates (`computeEmax`, `iterativeTSkin`) and shell-surface drain rates (`getDrainRate`). Physically, skin evaporation sees microclimate VP, and shell inner surface sees microclimate VP — not ambient.

Both symptoms trace to the same missing state: **per-layer microclimate vapor pressure**.

### 1.2 Why unification matters

If the two tracker items were addressed with separate specs:

- Spec 1 (S21-F2) would compute microclimate VP for condensation placement
- Spec 2 (S22-MICROCLIMATE-VP) would compute microclimate VP for evaporation
- Two separate computations of the same physical quantity, potentially using different formulas
- Code duplication, potential inconsistency, additional maintenance burden

Unification produces:

- One helper function computing microclimate VP per-interface once per cycle
- Both condensation placement AND evaporation consume the same pre-computed VP values
- Physically consistent behavior across the full moisture-transport pipeline
- Single site of truth for the physics

### 1.3 Terminology disambiguation

**Important naming conflict:** The codebase already uses `_localRH`, `_localTemp`, `_localVpd` in the steady-state path (lines 357-403) to mean *elevation-adjusted ambient* values. These have nothing to do with microclimate.

This spec introduces new terminology:
- `_microVP[i]` — microclimate VP at interface `i` (hPa)
- `_microRH[i]` — microclimate RH at interface `i` (0-100)
- `_microTd[i]` — microclimate dew point at interface `i` (°C)

Interface indexing:
- `i = 0` — skin/base interface (innermost microclimate, closest to body)
- `i = 1` — base/mid interface
- `i = 2` — mid/insulation interface
- `i = 3` — insulation/shell interface
- `i = n-1` — shell-inside (outermost microclimate, boundary to ambient)

`_localRH`, `_localTemp` retain their current elevation-adjusted-ambient meaning.

---

## 2. Physical Model

### 2.1 Microclimate VP driving physics

Microclimate VP at any interface is determined by steady-state balance between:
- **Vapor inflow** — from skin (sweat evaporation) or from lower-index layer (via im-limited diffusion)
- **Vapor outflow** — to higher-index layer (via im-limited diffusion) or to ambient (through shell)

At steady state within a cycle, the VP at each interface equilibrates such that net flux is zero across the interface:

```
J_inflow(i) = J_outflow(i)
```

Where each flux is governed by:

```
J = (P_source - P_sink) × transport_coefficient
```

`transport_coefficient` is the reciprocal of the vapor resistance (a function of `im` for the adjacent layer and geometric factors from ISO 7933).

### 2.2 Simplified model for engine implementation

Rather than solve the full per-interface balance equation (computationally expensive and potentially unstable), the engine can use the thermal gradient already computed for condensation placement to derive microclimate VP:

**For each interface i:**

1. **Interface temperature** (already computed in existing code at line 760):
   ```
   T_interface(i) = T_skin - (T_skin - T_ambient) × (R_cumulative_to_i / R_total)
   ```
   Where R is thermal resistance (CLO × 0.155 + air film).

2. **Interface dew point** depends on microclimate position. At steady state with saturated fabric above any given interface, the VP at that interface equals the saturation VP at the next layer's temperature:
   ```
   P_micro(i) = P_sat(T_interface(i+1))   [when fabric above is saturated]
   P_micro(i) = interpolated               [when fabric above has headroom]
   ```

3. **Microclimate RH** for passing to humidity-argument sites:
   ```
   RH_micro(i) = 100 × P_micro(i) / P_sat(T_interface(i))
   ```

### 2.3 Boundary conditions

**Innermost (i=0, skin/base interface):**
- Skin surface is the source. Assuming adequate sweat production:
- `P_micro(0) ≈ P_sat(T_skin)` (saturated at skin temperature)
- This is the VPD source that drives evaporation from skin surface

**Outermost (i=n-1, shell-inside):**
- When shell has vapor headroom (not saturated ambient):
- `P_micro(n-1) = P_ambient + J_shell × R_shell`
- At steady state, the outermost microclimate VP is elevated above ambient by whatever the shell's im-limited transport requires

### 2.4 Why this is the right physics

At **terminal fabric saturation**, this model correctly captures:
- Microclimate RH approaches 100% at skin interface
- Skin-to-microclimate VPD drops to near-zero
- `computeEmax` correctly computes near-zero evaporative ceiling at skin
- Shell drain continues as long as microclimate-to-ambient VPD exists
- Drip (= sweat production − evap) correctly becomes the bottleneck residual

At **sub-saturation conditions**, this model degenerates to approximately current behavior:
- Microclimate VP is close to ambient VP
- `RH_micro ≈ RH_ambient`
- Existing physics continues to work

At **intermediate** conditions (the typical case in multi-hour exertion):
- Microclimate VP sits between skin VP and ambient VP
- Gradient exists at every interface
- Evap and drain rates reflect real transport physics

### 2.5 Citations

- **Magnus formula** (Alduchov & Eskridge 1996) — saturation vapor pressure calculation. Already implemented in `vpd.ts:45` as `vpdRatio` and in `iterativeTSkin` internally.
- **Havenith 2002** (TA reference #11) — Clothing microclimate theory. The concept of microclimate VP as a state variable distinct from ambient VP comes from this work.
- **Gagge & Gonzalez 1996** (TA reference #13) — Vapor pressure gradient as evaporation driver. Specifically identifies microclimate VP as the skin-side driving force, not ambient.
- **Wissler & Havenith 2009** (TA reference #1) — Serial resistance model for multilayer garments. The per-interface VP derivation follows from serial resistance logic already cited.

---

## 3. Current Code Audit (Site-by-Site)

### 3.1 Condensation placement (S21-F2 territory)

**Line 739: `const _tDewMicro = 29;`**
- Hardcoded constant representing microclimate dew point
- Used at 744 for `_condensSeverity` and 761 for per-layer `_undershoot`
- Under-estimates dew point in warm-humid microclimates; over-estimates in cold-dry
- **Replacement:** compute per-layer dew point from microclimate VP via inverse Magnus

**Line 744: `_condensSeverity = Math.max(0, (_tDewMicro - _tMidC) / _tDewMicro);`**
- Uses the hardcoded `_tDewMicro`
- Drives `_netRetention` at line 745
- **Replacement:** use Magnus-derived `_microTd[i]` at the correct interface

**Line 761: `const _undershoot = Math.max(0, _tDewMicro - _tLayerC);`**
- Per-layer condensation trigger
- Uses same hardcoded value across all layers
- **Replacement:** use per-interface `_microTd[i]` matching the layer being evaluated

### 3.2 Skin-side evaporation (S22-MICROCLIMATE-VP territory, evaporation side)

**Line 657: `_iterRun = iterativeTSkin(coreTemp, _TambC, ..., _humFrac * 100, ...)`**
- Run-phase thermal solver called with ambient humidity
- Solver uses this for skin-side VP calculation (its internal Ereq computation)
- **Replacement:** pass `_microRH[0]` (microclimate RH at skin interface)

**Line 671: `_emaxRun = computeEmax(_TskRun, _TambC, _humFrac * 100, ...)`**
- Run-phase E_max computation
- Sets evaporative ceiling that gates sweat production
- **Replacement:** pass `_microRH[0]` (skin-side microclimate RH)

**Line 688: `_iterL = iterativeTSkin(coreTemp, _TambC, ..., _humFrac * 100, ...)`**
- Lift-phase thermal solver
- Same issue as line 657
- **Replacement:** pass `_microRH[0]` for lift-phase conditions

**Line 702: `_emaxL = computeEmax(_TskL, _TambC, _humFrac * 100, ...)`**
- Lift-phase E_max
- Same issue as line 671
- **Replacement:** pass `_microRH[0]` for lift phase

### 3.3 Shell-side drain (S22-MICROCLIMATE-VP territory, drain side)

**Line 735: `_surfacePassHr = getDrainRate(tempF, humidity, windMph, _outerL.im, _totalCLO, _bsa)`**
- Shell surface drain used to compute `_condensHr`
- Uses ambient humidity
- **Replacement:** pass `_microRH[n-1]` (shell-inside microclimate RH) as the humidity argument. This represents the VP at the INNER surface of the shell — the source side of shell drain.

**Line 808: `_runDrainHr = getDrainRate(tempF, humidity, _effectiveWindRun, _outerL.im, _totalCLO, _bsa)`**
- Run-phase shell drain
- **Replacement:** same as 735

**Line 809: `_liftDrainHr = getDrainRate(tempF, humidity, windMph, _outerL.im, _totalCLO, _bsa)`**
- Lift-phase shell drain
- **Replacement:** same as 735

**Line 971: `_fDrainGPerHr = getDrainRate(tempF, humidity, windMph, _fOuter.im, _totalCLO, _bsa)`**
- Fractional-cycle tail drain
- **Replacement:** same as 735

### 3.4 Callsites that should KEEP ambient humidity

**Line 528, 1068: `waderEvapFloor(_phRawEvap, humidity, waderType, fishWading)`**
- Wader evap floor applies to wader-scenario external drainage
- Ambient humidity is correct here
- NO CHANGE

**Line 536, 1071: `hygroAbsorption(tempF, humidity, ensembleIm ?? 0, DEFAULT_REGAIN_POLYESTER)`**
- Ambient vapor absorbing into outermost layer
- Per PHY-HUMID-01 v2 §2.2 Category C — ambient is correct
- NO CHANGE

**Line 663, 695, 913: `computeRespiratoryHeatLoss(..., _humFrac * 100, ...)`**
- Respiration exchanges with ambient air
- Ambient humidity is correct
- NO CHANGE

**Line 840: `_ventedDrainHr = getDrainRate(tempF, humidity, windMph, _ventBaseIm, _ventCLOval, _bsa * _ventArea)`**
- Vent event drain — vent exchanges microclimate with ambient
- During active venting, microclimate approaches ambient
- Ambient humidity is approximately correct for vented periods
- NO CHANGE (may refine in future if vent physics is reviewed)

**Line 830: `_ventHum = humidity > 80 ? 0.7 : ...`**
- Vent effectiveness multiplier
- Ambient is correct (venting delivers ambient conditions to microclimate)
- NO CHANGE

**Line 551: `_Pa_ambient = pSatPa(_TambC) * (humidity / 100)`**
- Explicitly ambient partial pressure
- NO CHANGE

**Line 592: `_humFrac = humidity / 100`**
- Ambient humidity as fraction; consumed downstream
- Keep existing; callsites are changed individually
- NO CHANGE to the definition

### 3.5 Out of scope for this spec

**Line 457: `humMul = 1 + (Math.max(humidity - 40, 0) / 100) * 0.8`**
- Sweat rate humidity staircase
- Flagged as separate concern (`PHY-HUMID-HUMMUL-CAL`)
- Uses ambient humidity — may or may not be correct depending on whether body senses ambient or microclimate for sweat regulation
- **Out of scope.** Defer to PHY-SWEAT-UNIFICATION spec.

**Line 1064: `_lVpd = vpdRatio(tempF, humidity)` (linear path)**
- Linear/steady-state path uses ambient humidity throughout
- Steady-state path is simpler (no per-cycle microclimate evolution)
- Microclimate correction in steady-state path could be a separate smaller spec
- **Out of scope.** Flag for future as `S25-LINEAR-PATH-MICROCLIMATE-VP`.

---

## 4. Proposed Architecture

### 4.1 New helper function

Add to `packages/engine/src/moisture/` (new file or add to existing `calc_intermittent_moisture.ts`):

```typescript
/**
 * Compute per-interface microclimate VP for a layered garment system.
 *
 * At each interface i (between layer i and layer i+1 in the stack, with
 * i=0 being skin/base interface and i=n-1 being shell-inside):
 * - Interface temperature from existing thermal gradient (serial resistance model)
 * - Interface dew point via Magnus formula at steady-state VP
 * - Interface VP balanced between inflow (from skin side) and outflow (to ambient side)
 *
 * Citations:
 * - Alduchov & Eskridge 1996 (Magnus formula)
 * - Havenith 2002 (microclimate as distinct state variable)
 * - Wissler & Havenith 2009 (serial resistance model)
 *
 * @param tSkinC skin temperature (°C)
 * @param tAmbC ambient temperature (°C)
 * @param ambientRH ambient relative humidity (0-100)
 * @param layers per-layer array with im, cap, buffer, fiber properties
 * @param totalCLO ensemble thermal insulation (clo)
 * @param hAir convective coefficient for ambient air (W/m²·K)
 * @returns per-interface microclimate state
 */
export function computeMicroclimateVP(
  tSkinC: number,
  tAmbC: number,
  ambientRH: number,
  layers: GearLayer[],
  totalCLO: number,
  hAir: number,
): MicroclimateState {
  // Returns:
  // {
  //   interfaceTemps: number[],   // °C at each interface
  //   interfaceVP: number[],      // hPa at each interface
  //   interfaceRH: number[],      // % RH at each interface
  //   interfaceTd: number[],      // °C dew point at each interface
  // }
  // Length of each array: layers.length + 1 (n+1 interfaces for n layers)
}
```

### 4.2 Integration point

In `calc_intermittent_moisture.ts`, after thermal solver produces `_TskRun` / `_TskL` but before any humidity-dependent calculation:

```typescript
// Insert after line 657 (_iterRun), before line 671 (_emaxRun)
const _microState_run = computeMicroclimateVP(
  _TskRun,      // skin temperature from solver
  _TambC,       // ambient temperature
  humidity,     // ambient RH
  _layers,      // per-layer state
  _totalCLO,    // ensemble CLO
  _hcRun,       // convective coefficient already computed
);
const _microRH_skin_run = _microState_run.interfaceRH[0];
const _microRH_shell_run = _microState_run.interfaceRH[_layers.length - 1];
const _microTd_run = _microState_run.interfaceTd;

// Same block for lift phase after _iterL
```

### 4.3 Site modifications

**Line 671 (computeEmax run):**
```typescript
// BEFORE:
const _emaxRun = computeEmax(_TskRun, _TambC, _humFrac * 100, ...);
// AFTER:
const _emaxRun = computeEmax(_TskRun, _TambC, _microRH_skin_run, ...);
```

**Line 702 (computeEmax lift):**
```typescript
const _emaxL = computeEmax(_TskL, _TambC, _microRH_skin_lift, ...);
```

**Lines 657 and 688 (iterativeTSkin):** the solver gets microclimate-adjusted RH for Ereq computation. This requires pre-computing microclimate state BEFORE the solver call, which is a bootstrap problem: we need T_skin to compute interface temps, but need microclimate RH for the solver. Solution: iterate once with ambient RH, extract T_skin, compute microclimate, then iterate solver again with corrected RH. Two-pass approach.

**Line 739 (_tDewMicro):**
```typescript
// BEFORE:
const _tDewMicro = 29;
// AFTER:
// Use per-layer microclimate dew point from _microTd array
// _condensSeverity at 744 uses _microTd[appropriate interface]
// _undershoot at 761 uses per-layer _microTd[i]
```

**Lines 735, 808, 809, 971 (getDrainRate):**
```typescript
// BEFORE:
getDrainRate(tempF, humidity, ..., _outerL.im, _totalCLO, _bsa)
// AFTER:
getDrainRate(tempF, _microRH_shell_[phase], ..., _outerL.im, _totalCLO, _bsa)
```

### 4.4 Cardinal Rule compliance

- **Thermal engine signatures unchanged.** `iterativeTSkin`, `computeEmax`, `getDrainRate` receive different numerical values for their RH argument, but the function signatures don't change.
- **All constants traced.** Magnus coefficients (17.27, 237.3, 6.1078) already cited Alduchov & Eskridge 1996. No new constants introduced.
- **No fudges.** Every VP derivation traces to physics: ideal gas law + Magnus + serial resistance model.

---

## 5. Reference Scenarios

### 5.1 S-001: Breck 16°F / 40% RH / 6hr skiing (cold-dry extended exertion)

**Pre-spec engine behavior:**
- Microclimate modeled as ambient (40% RH)
- Skin-to-microclimate VPD overstated
- `computeEmax` produces high evaporative ceiling
- Engine shows ongoing evaporation even at terminal saturation

**Post-spec engine behavior:**
- Microclimate RH climbs to 90-100% as fabric saturates
- `computeEmax` correctly drops toward near-zero at saturation
- Engine shows thermal crisis onset at correct time

**Expected MR shift:** UP (correctly models trapped moisture that was previously being over-evaporated)
**Expected CDI shift:** UP (correctly models heat accumulation when cooling fails)

### 5.2 S-002: Mist Trail to Vernal Fall 72°F / 75% RH / 2hr

**Pre-spec engine behavior:**
- Microclimate ≈ ambient (both moderate)
- Evaporation modeled against 75% RH
- Engine shows moderate evap rate, moderate MR

**Post-spec engine behavior:**
- Microclimate RH climbs to 85-95% under exertion
- Skin-to-microclimate gradient narrows
- Evaporation rate drops somewhat

**Expected MR shift:** Moderate UP
**Expected CDI shift:** Small UP (hot-humid compensation already mostly captured by ambient physics)

### 5.3 S-003: E7 Humid fishing (70°F / 95% RH / 4hr stationary)

**Pre-spec engine behavior:**
- Already near-saturated ambient
- Microclimate nearly equals ambient
- Engine shows low evap, moderate MR

**Post-spec engine behavior:**
- Microclimate reaches 100% RH quickly
- Evaporation drops to near-zero correctly
- Hygroscopic absorption (`_aHygro`) continues to load shell (unchanged by this spec)

**Expected MR shift:** Small UP (microclimate VP fine-tuning)
**Expected CDI shift:** Small UP

### 5.4 S-004: Puffy classification regression (cold-dry stationary fishing -10°F / 40% RH / 5hr)

**Pre-spec engine behavior:**
- Stationary, minimal sweat
- Ambient humidity drives shell drain
- Engine shows low MR, high HLR (correctly identifies cold stress)

**Post-spec engine behavior:**
- Microclimate RH slightly elevated (sweat production is minimal but nonzero)
- Shell drain slightly reduced
- MR slightly UP but should remain low

**Expected MR shift:** Minimal
**Expected CDI shift:** Negligible
**Regression check:** This scenario should NOT produce dramatic changes — confirms spec doesn't break cold-stationary regime.

---

## 6. §10 Gate Requirements

Per LC6 practice, significant physics changes require hand-computed reference scenarios BEFORE implementation proceeds.

Before S27 implementation session can start:

1. **Hand-compute microclimate VP for each S-001 through S-004** using paper-and-Magnus
2. **Hand-compute expected post-spec MR** for each scenario at peak exertion / saturation state
3. **Document expected deltas** from current engine behavior
4. **Ratification review** of both PHY-SHELL-GATE (drafted S23) and PHY-MICROCLIMATE-VP (this spec) together, since they interact at shell im / shell drain / microclimate VP

If hand-computation reveals physics gaps in the spec, revise this spec before coding begins.

---

## 7. Out of Scope / Flagged for Future

### 7.1 Linear/steady-state path

The linear path (`_lVpd`, lines 1060-1095) also uses ambient humidity. Correcting that requires a separate smaller spec because the linear path has simpler per-layer physics. Log as `S25-LINEAR-PATH-MICROCLIMATE-VP` (MEDIUM).

### 7.2 Dynamic microclimate VP (time evolution)

This spec uses steady-state microclimate VP within each cycle. Real microclimate VP has dynamics — it builds up during exertion and drains during rest. A future spec could add microclimate VP as persistent state with time evolution. Expected effect: improves transition physics (high-exertion → rest transitions), but cycle-level steady-state is adequate for most scenarios.

### 7.3 Vent event microclimate reset

Vent events (line 830-852) currently use proportional drain across all layers. A more correct model would reset microclimate VP to near-ambient during active venting. Small refinement, flag for future.

### 7.4 Sweat rate humidity staircase (`humMul`)

Line 457 uses ambient humidity for sweat rate modulation. Whether sweat glands respond to skin-local VP or ambient VP is a physiology question not addressed here. Defer to PHY-SWEAT-UNIFICATION.

### 7.5 Wader microclimate

Wader scenarios have a lower-body microclimate that's potentially very different from upper-body. Wader evap floor is correctly using ambient currently because the drain exits to ambient. Future refinement if wader physics is re-examined.

---

## 8. Implementation Plan

### 8.1 Phase 1: Primitive helper (S27 AM)
- Add `computeMicroclimateVP` function to moisture module
- Unit tests using hand-computed values from reference scenarios S-001 through S-004
- Verify Magnus formula integration matches existing `vpdRatio` conventions

### 8.2 Phase 2: Integration (S27 PM)
- Thread microclimate state through `calc_intermittent_moisture.ts` cyclic path
- Replace hardcoded `_tDewMicro = 29` with per-interface values
- Update callsites at 671, 702, 735, 808, 809, 971
- Solve iterativeTSkin bootstrap via two-pass approach

### 8.3 Phase 3: Validation (S28 AM)
- Run full test suite (expect shifts in adversarial matrix + diagnostic tests)
- For each shifted test, verify direction matches expected
- Update expected values for tests that calibrated against pre-spec behavior
- Add new `s27_microclimate_verify.test.ts` with S-001 through S-004 scenarios

### 8.4 Phase 4: Reference scenario capture (S28 PM)
- Populate `LC6_Planning/reference_scenarios/S-001.md` through `S-004.md` with post-spec engine output
- Mark scenarios as "validated" per registry lifecycle
- Close both tracker items (S21-F2 and S22-MICROCLIMATE-VP) with S27 commit SHA references
- Move items to Section F per Section H ritual

### 8.5 Total estimated effort
- S27: 4-6 hours authoring + integration
- S28: 2-4 hours validation + reference scenarios
- **Approximately 1.5 sessions.** Smaller than originally feared because of unification.

---

## 9. Risks and Mitigations

### 9.1 Risk: iterativeTSkin bootstrap instability

Two-pass approach (solve with ambient, compute microclimate, solve again) could produce oscillations if microclimate feedback is too aggressive.

**Mitigation:** Use convergence check on T_skin change between passes. If >0.2°C change after second pass, do third pass. Bound iteration count at 3 to prevent runaway.

### 9.2 Risk: Unexpected test failures in adversarial matrix

Some adversarial scenarios may shift more than expected if microclimate correction is larger than anticipated.

**Mitigation:** Adversarial matrix is diagnostic-only (no assertions). Shifts will be visible but won't break tests. Review each manually, verify direction.

### 9.3 Risk: Circular dependency with PHY-SHELL-GATE

PHY-SHELL-GATE introduces per-shell-type im values. PHY-MICROCLIMATE-VP uses im for microclimate calculation. Implementation ordering matters.

**Mitigation:** Joint ratification in S26. Implement PHY-SHELL-GATE first (shell type classification is foundational), then PHY-MICROCLIMATE-VP (uses the new im values). Single coordinated change in S27-S28.

### 9.4 Risk: Performance degradation

Per-cycle microclimate VP computation adds overhead. If called thousands of times in sweep tests, may slow tests.

**Mitigation:** Helper function is O(n) in layer count (typically 3-5 layers). Each call is ~10 floating-point operations. Negligible compared to existing O(n²) Washburn wicking loop. Performance should not degrade meaningfully.

---

## 10. Success Criteria

Implementation is successful when:

1. `computeMicroclimateVP` unit tests pass with hand-computed reference values
2. Full test suite passes (644 + new diagnostic tests)
3. Adversarial matrix scenarios show physically-defensible shifts
4. Reference scenarios S-001 through S-004 produce validated output
5. Both `S21-F2-HARDCODED-SKIN-DEW` and `S22-MICROCLIMATE-VP` tracker items closed in single commit
6. Hardcoded `_tDewMicro = 29` eliminated from codebase
7. No new fudge factors introduced
8. Thermal engine signatures unchanged (Cardinal Rule #8 compliance)

---

## 11. Relationship to Other Specs

- **PHY-HUMID-01 v2 (RATIFIED):** §3.2 of that spec called for Magnus-derived per-layer dew point (the S21-F2 line item). This spec implements that requirement with expanded scope.
- **PHY-SHELL-GATE v1 (DRAFT S23):** Shell classification introduces per-shell-type im values that feed into microclimate VP calculation. Joint ratification required.
- **PHY-HUMID-01 v2 §4.1 (SHIPPED S23):** Fudge deletion of `dryAirBonus`/`_localDryBonus` removed ambient-humidity staircases. This spec continues the trend of using real physics instead of calibrated approximations.

---

## 12. Open Questions for Ratification Review

**Q1:** Should microclimate VP be per-layer (n+1 interfaces) or ensemble-level (1 scalar)?
- Spec proposes per-layer for symmetry with existing thermal gradient
- Ensemble-level would be simpler but lose some fidelity
- Recommendation: per-layer; complexity is manageable

**Q2:** How does iterativeTSkin bootstrap converge in edge cases?
- Two-pass approach proposed; may need validation in edge scenarios
- Recommendation: implement with convergence check, revisit if issues observed

**Q3:** Should vent events reset microclimate VP to ambient?
- Current spec leaves vent event microclimate alone (uses ambient in existing vent physics)
- More sophisticated: vent momentarily resets, microclimate rebuilds over subsequent cycles
- Recommendation: out of scope for this spec; flag for future

**Q4:** Does this spec adequately address the E_actual bug concern from S24 discussion?
- `iterativeTSkin` produces `E_actual` capped by `E_max`
- After this spec, E_max correctly reflects skin-to-microclimate VPD
- So E_actual correctly caps sweat-produced cooling at vapor-transport rate
- **Implicit resolution of the "drip overstates cooling" concern from S24.** Worth calling out in ratification review.

---

*End of PHY-MICROCLIMATE-VP v1 DRAFT. Pending ratification S26 per forward plan.*
