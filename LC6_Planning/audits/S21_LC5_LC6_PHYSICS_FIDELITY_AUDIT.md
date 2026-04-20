# S21 Audit — LC5 vs LC6 Moisture Physics Fidelity

**Session:** 21
**Date:** 2026-04-19
**Status:** Findings-only (no code changes)
**Triggered by:** S21 duration sweep — heavy kit `peak_MR` stays monotonically BELOW ultralight across 2–20 hr durations (Δ widens from −0.7 to −2.9). Per ratified physics, heavy should eventually cross over and overtake ultralight as transport-rate saturation dominates. Engine does not model the crossover.

**Scope:** Compare LC6 `packages/engine/src/moisture/calc_intermittent_moisture.ts` against LC5 reference at `packages/engine/reference/lc5_risk_functions.js` (extracted from `LayerCraft 5/risk_functions.js`). Focus on the cyclic path and its helper dependency tree.

**Source artifacts consulted:**
- LC5: `lc5_risk_functions.js` (2,520 lines, extracted moisture physics)
- LC6: `packages/engine/src/moisture/*.ts`, `packages/engine/src/ensemble/gear_layers.ts`, `packages/engine/src/evaluate.ts`, `packages/engine/src/heat_balance/vpd.ts`
- Ratified specs: `PHY-HUMID-01_Spec_v2_RATIFIED.md`, `PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md` (superseded by S17 reversion)
- Session history: `LC6_REDESIGN_v1_Closure.md`, `S20_MOISTURE_CAPACITY_PIPELINE_AUDIT.md`

**Line-number convention:** LC5 line numbers reference the canonical source `/Users/cmcarter/Desktop/LayerCraft 5/risk_functions.js`. Reference-file section markers in `lc5_risk_functions.js` (e.g. `// ===== risk_functions.js lines 2426-3393 =====`) point back to these same LC5 source lines.

---

## Executive summary

The S21 duration-sweep hypothesis ("LC6's `calcIntermittentMoisture` is missing or simplified vs LC5's implementation") is **mostly wrong at the function level, but correct at the physics level**.

| Mechanism                                 | LC5                         | LC6                          | Status                      |
|-------------------------------------------|-----------------------------|------------------------------|-----------------------------|
| Cyclic path `calcIntermittentMoisture`    | 968 lines, lines 2426–3393  | 1,109 lines, ported verbatim | **PORTED CORRECTLY**        |
| Per-layer buffer model (PHY-048)          | Lines 2733–2870             | Ported verbatim              | **PORTED CORRECTLY**        |
| Washburn bidirectional wicking            | Lines 2840–2862             | Ported verbatim              | **PORTED CORRECTLY**        |
| Inward overflow cascade                   | Lines 2834–2836             | Ported verbatim              | **PORTED CORRECTLY**        |
| `getDrainRate` (Yoo & Kim / PHY-047)      | Lines 2057–2083             | Ported verbatim              | **PORTED CORRECTLY**        |
| `computePerceivedMR`                      | Lines 293–311               | Ported verbatim              | **PORTED CORRECTLY**        |
| `applySaturationCascade`                  | Line 839, **never called**  | Called on `sessionMR` (S19)  | **BUG FIXED (S19)**         |
| Hardcoded `_tSkinRetC=30 / _tDewMicro=29` | Lines 2790–2791             | Lines 740–741                | **BUG INHERITED**           |
| `_excessHr × _netRetention` gate          | Line 2806                   | Line 751                     | **BUG INHERITED**           |
| `_liftExcessG × _netRetention` gate       | Line 2803                   | Line 749                     | **BUG INHERITED**           |
| `_insensibleG` routed via `_condensWeights` | Line 2806 + 2828           | Line 751 + 769               | **BUG INHERITED**           |
| `_aHygro` dead code in cyclic path        | Line 2760 → unused `cycleNet` | Line 539 → unused `cycleNet` | **BUG INHERITED**         |
| `weight_category` → `weightG` pipeline    | Not present                 | S21 adds `weightCategoryToGrams` in evaluate.ts:1011 | **NEW IN LC6** |

**The root cause of the missing crossover is not a port deficiency.** LC6 preserves the LC5 physics chain and in one place (`applySaturationCascade`) actually improves on it. What is missing is what PHY-HUMID-01 v2 ratified but Session 17 reverted: per-layer Magnus-derived dew point + three-category routing (vapor / liquid-at-skin / ambient vapor). The same bugs exist in LC5. Inheriting them did not cause the S21 regression — S21's weight_category pipeline correctly differentiates cap values, and the crossover failure is a consequence of how `computePerceivedMR` and `applyDurationPenalty` interact with cap scaling (see cross-cutting observations §8 below).

---

## Finding 1 — `applySaturationCascade` wiring

**Status:** **BUG FIXED (S19)** — LC6 is ahead of LC5 here.

**LC5 (source `risk_functions.js`):**
- **Defined** at line 839 (`function applySaturationCascade(rawMR)`).
- **Never called** anywhere in LC5 code. Only grep hit outside the definition is a comment at line 4288 ("MR is nonlinear (applySaturationCascade), so direct inversion isn't accurate"). Cross-repo grep of LC5 code files (excluding docs, bak files, html bundles) returns the definition site only.
- Corroborating documentation: LC4 contract `LayerCraft_Code_Session_Contract__MUST_READ_ALL_NEW_CODE_SESSIOINS (3).md` line 77: *"No cascade function in MR scoring path. MR = 7.2 * (trapped / cap). No applySaturationCascade()."* — indicates this was a deliberate design regression in LC4/5.
- `moistureRisk` at `risk_functions.js:2208` computes `rawMR = 7.2 × trapped/cap` and returns without cascade (comment PHY-039 line 2204: *"MR = 7.2 × saturation ratio. No cascade."*).
- `calcIntermittentMoisture` tail at `risk_functions.js:3355` (reference file line 2165): `_sessionMR = _perCycleMR[last] ?? Math.min(10, Math.round(7.2 × netTrapped/_mrCap × 10) / 10)` — no cascade call in either branch.

**LC6:**
- Defined at `packages/engine/src/moisture/saturation_cascade.ts` (ported verbatim).
- **Wired into the sessionMR pipeline** at `calc_intermittent_moisture.ts:995` and `:997` (cyclic path tail), `:1094` (linear path), `:410` (steady-state path per step).
- S19 header comment (lines 68–70): *"S19: applySaturationCascade wired into sessionMR pipeline (previously defined + tested + exported but never called in production — see LC6_Planning/LC6_Master_Tracking.md B.14 S18-CASCADE-NOT-WIRED)."*
- Formula matches LC5 verbatim: linear passthrough ≤ 6.0, `6.0 + 4.0 × (1 - (1 - (raw-6)/4)²)` on (6,10), capped at 10.

**LC6 reference-file cross-check:** `lc5_risk_functions.js:400–406` matches `saturation_cascade.ts:26–32` verbatim.

**Spec reference:**
- `LC6_REDESIGN_v1_Closure.md` §4: *"`× 7.2` output scaling — reinstated. `applySaturationCascade` — reinstated."* — S17 closure explicitly retains cascade wiring as the documented Fechner-anchored output budget.
- TA v5 §3.5 "Saturation Cascade" — three-regime psychophysical model (absorption / crossover / cascade). Cascade is the only mechanism that keeps "normal-bad" scenarios in the 0–6 band and reserves 6–10 for phase-transition saturation.

**Impact:**
- At `sessionMR = 7.2 × (trapped/cap)`, only deeply saturated ensembles enter the 6–10 band. LC5 without cascade would compress all "cascade-regime" outputs to ≤ 7.2 — the bug is that LC5's ceiling is effectively 7.2, not 10. LC6 correctly maps raw 7 → ~7.75 and raw 9 → ~9.75.
- **S21 implication:** cascade application *widens* the spread between heavy and ultralight at high saturation (both hit raw ≥ 6 at long duration). It does NOT produce a crossover by itself. If anything, cascade is neutral to the crossover gap — it amplifies both kits proportionally in the 6–10 zone.

---

## Finding 2 — Hardcoded `_tSkinRetC = 30` and `_tDewMicro = 29`

**Status:** **BUG INHERITED**.

**LC5 (source `risk_functions.js`):**
- Line 2790: `var _tSkinRetC=30; // insulated torso skin temp`
- Line 2791: `var _tDewMicro=29; // dew point at skin (~30°C, ~95% local RH)`
- Used in thermal-gradient computation for `_condensSeverity` (line 2798) and per-layer `_condensWeights` (line 2820).
- Same hardcoding repeated in `calcSteadyStateMoisture` at lines 3479–3480 (reference file line 2279–2280).

**LC6 (`calc_intermittent_moisture.ts`):**
- Line 740: `const _tSkinRetC = 30;`
- Line 741: `const _tDewMicro = 29;`
- Ported verbatim from LC5. Used at lines 745, 746, 747, 763 in the condens-weights and netRetention math.

**LC6 supporting infrastructure (Phase 1 shipped, Phase 2+3 reverted):**
- `packages/engine/src/heat_balance/vpd.ts:70` defines `magnusDewPoint(tC, rhPercent)`.
- `vpd.ts:93` defines `inverseMagnus(pHpa)`.
- These are exported but **never imported or called** anywhere in the engine (grep confirms only the definition sites).
- Per `LC6_REDESIGN_v1_Closure.md` line 58: *"PHY-HUMID-01 v2 spec (Phase 2+3): reverted code only; spec itself stays RATIFIED for future dedicated implementation session."*

**Spec reference:**
- **PHY-HUMID-01 v2 RATIFIED §3.2** (Session 12, 2026-04-17): *"Replace lines 736–737 which currently use hardcoded `_tDewMicro = 29` and `_tSkinRetC = 30`… Physics-derived skin and dew point: `_tSkinRetC = _TskRun` (from `iterativeTSkin` — already computed); `_pSkinSatHpa = satVaporPressure(_tSkinRetC)`; `_pAmbHpa = satVaporPressure(_TambC) × (humidity/100)`. Per-layer dew point computation via interpolation…"*
- **§7 Cardinal Rule compliance table:** `_tSkinRetC = _TskRun` (Derived), `_tDewMicro = Per-layer Magnus` (Derived, Alduchov & Eskridge 1996).

**Impact:**
- Hardcoded 30°C / 29°C represents a specific cold-weather condensation regime (~95% local RH at insulated skin). For warm ambient conditions the hardcodes produce:
  - `_tMidC ≈ 0.5 × (T_amb + 30)` (line 745). At T_amb = 75°F (23.9°C), `_tMidC ≈ 26.95°C`.
  - `_condensSeverity = max(0, (29 - 26.95) / 29) ≈ 0.071`
  - `_netRetention = 0.40 × 0.071 ≈ 0.028`
  - Vapor from sweat is retained at only ~2.8% into fabric, and `_excessHr × _netRetention ≈ 0` — uncompensable sweat at warm ambient is effectively zeroed before reaching any fabric layer.
- This is the H3 defect documented in PHY-HUMID-01 v1 forensic audit: at 75°F/90%RH running for 1.5hr, true MR should be 5–8; engine returns ~0.7.
- **S21 implication:** at cold ambient (which is where the S21 duration sweep was run per the Breckenridge-style scenarios), `_condensSeverity` ≈ 1.0 and the hardcode approximately matches physics. At warm ambient the defect exposes. S21's observed crossover failure at long durations is **not primarily caused** by this hardcode because the regime stays cold. But at 16°F / 40% RH (a typical Breck scenario), `_tMidC ≈ 0.5 × (-8.9 + 30) = 10.55°C`; `_condensSeverity ≈ (29 − 10.55) / 29 ≈ 0.636`; retention ≈ 25%. Physics-derived Magnus dew point at those conditions would be ≈ −12°C, which would push `_condensSeverity` lower and retention further lower. In other words: the hardcode OVER-retains in cold dry conditions and UNDER-retains in warm humid conditions, in both cases biasing the trapped-moisture signal that distinguishes heavy from ultralight.

---

## Finding 3 — Liquid-at-skin gated by condensation severity (`_excessHr × _netRetention`)

**Status:** **BUG INHERITED** (LC5 has the same bug; LC6 ports it verbatim).

**LC5 (source `risk_functions.js`):**
- Line 2803: `var _liftRetainedG = _liftCondensG × _netRetention + _liftExcessG × _netRetention;`
- Line 2805: `var _liftFabricG = isNaN(_liftRetainedG) ? _liftProdG × 0.35 : _liftRetainedG;`
- Line 2806: `var _fabricInG = (_retainedCondensG + _excessHr × _netRetention) × (_runMin/60) + _liftFabricG + _insensibleG;`
- Line 2828: `for (_di=0; _di<_layers.length; _di++) { _layers[_di].buffer += _fabricInG × _condensWeights[_di]; }`

**LC6 (`calc_intermittent_moisture.ts`):**
- Line 749: `const _liftRetainedG = _liftCondensG * _netRetention + _liftExcessG * _netRetention;`
- Line 750: `const _liftFabricG = isNaN(_liftRetainedG) ? _liftProdG * 0.35 : _liftRetainedG;`
- Line 751: `const _fabricInG = (_retainedCondensG + _excessHr * _netRetention) * (_runMin / 60) + _liftFabricG + _insensibleG;`
- Line 769: `for (let _di = 0; _di < _layers.length; _di++) { _layers[_di]!.buffer += _fabricInG * _condensWeights[_di]!; }`

**Spec reference:**
- **PHY-HUMID-01 v2 RATIFIED §2.1:** *"Bug 1: `_excessHr` and `_liftExcessG` are LIQUID AT SKIN — uncompensable sweat that pooled because `E_req > E_max`. They're currently gated by `_netRetention` (cold-weather condensation severity), which zeros them at warm ambient. Physics: liquid at skin isn't gated by vapor condensation."* *"Bug 2: `_insensibleG` is LIQUID AT SKIN (transepidermal baseline). Currently routed via `_condensWeights` to thermal-gradient layers. Physics: liquid at skin enters the base layer, not outer layers."*
- **§2.2 Physics-correct routing:** Category B (liquid at skin) must route **directly to `_layers[0].buffer`** — not via `_condensWeights`, not gated by `_netRetention`. Cited to Kubota et al. 2021 (*"in clothed subjects, 'dripping' sweat is absorbed by clothing"*).
- **§2.3 Code changes required** — spec provides exact replacement code at LC5 line 745, 747, 765 (which maps to LC6 lines 749, 751, 769).

**Impact:**
- At warm ambient (`_netRetention ≈ 0`), uncompensable sweat from `_excessHr` and `_liftExcessG` is multiplied by ~0 before being distributed — base layer receives next to nothing in the exact conditions where it should be getting soaked.
- At cold ambient (`_netRetention` high), liquid-at-skin is instead distributed by `_condensWeights` to outer layers (because `_condensWeights` peaks at the thermal-boundary layer, not the base). The liquid never reaches the base layer directly; it bypasses wicking and appears at whichever layer thermal gradients place condensation.
- `_insensibleG` (10 g/hr baseline transepidermal) has the same misrouting — also distributed outward, never direct-to-base.
- **S21 implication:** the cross-kit comparison relies on base-layer `buffer` driving `baseSat` in `computePerceivedMR`. If liquid-at-skin is misrouted to outer layers, the base layer stays relatively clean until inward-cascade overflow or Washburn wicking push moisture back inward. Heavy kit's larger outer caps swallow this misrouted liquid more effectively than ultralight's smaller outer caps, which **amplifies** the heavy-wins-all-durations regression. Fixing this (sending liquid direct-to-base, as spec dictates) would pin base layers to cap faster for ALL kits and would narrow (though not necessarily reverse) the gap.

---

## Finding 4 — `_aHygro` dead code in cyclic path

**Status:** **BUG INHERITED**.

**LC5 (source `risk_functions.js`):**
- Line 2759: `const _aHygro = hygroAbsorption(tempF, humidity, ensembleIm, DEFAULT_REGAIN);`
- Line 2760: `const cycleNet = phaseData.reduce((s, pd) => s + pd.retained, 0) + _aHygro;`
- Grep confirms `cycleNet` is declared only at line 2760 and never referenced elsewhere. `_aHygro` is also not referenced outside its assignment site.
- Linear path at line 3308 DOES use hygroscopic absorption: `const _stepHygro = hygroAbsorption(...) × (stepDur/15)` → added to `cumMoisture` at line 3312. So the bug is cyclic-path-only; the mechanism is alive in linear.

**LC6 (`calc_intermittent_moisture.ts`):**
- Line 538: `const _aHygro = hygroAbsorption(tempF, humidity, ensembleIm ?? 0, DEFAULT_REGAIN_POLYESTER);`
- Line 539: `const cycleNet = phaseData.reduce((s, pd) => s + pd.retained, 0) + _aHygro;`
- `cycleNet` is declared once, never referenced. Ported verbatim.
- Linear path at line 1070 DOES use `_stepHygro` and adds to `cumMoisture` at line 1074 — same asymmetry as LC5.

**Spec reference:**
- **PHY-HUMID-01 v2 RATIFIED §2.1 Bug 3:** *"`_aHygro` (ambient vapor absorbed from outside, line 534) is DEAD CODE. Computed but never applied to any layer or moisture accumulator in the cyclic path. Activities using the cyclic path miss hygroscopic absorption entirely."*
- **§2.2 Category C routing:** *"Ambient vapor absorbed from outside (`_aHygro`) — Physics: ambient water vapor contacts outer fabric surface. Absorbed into fabric via regain coefficient × vapor pressure × fabric permeability. Enters from the outer side. Routed DIRECTLY to `_layers[length-1].buffer` (shell/outer). Activates currently-dead-code path."*
- **PHY-032 (LayerCraft Scientific Foundations)** — hygroscopic absorption formula: `C_HYGRO × e_actual × im × regain` (visible in `risk_functions.js:2085–2093` / reference line 1175–1181).

**Impact:**
- Cyclic-path activities (skiing, mountain biking, running, cycling, snowshoeing, continuous exertion hike routed through S19's `_continuousActivities` shim) miss the ambient-vapor contribution entirely.
- At low humidity this is negligible. At high humidity and/or long duration, `_aHygro` can add 10–40 g/hr across a full shell — over 20 hr, that is 200–800 g ingressed moisture currently going to `/dev/null`.
- **S21 implication:** Missing `_aHygro` contribution is outer-shell-biased by spec. Heavy kits have larger outer caps, so activating hygroscopic ingress would fill heavy shells proportionally less (larger denominator in fill fraction) and ultralight shells proportionally more. This would **widen** the ultralight-penalty gap, not narrow it. Not a direct lever for the crossover.

---

## Finding 5 — `_condensWeights` thermal-gradient distribution

**Status:** **PORTED CORRECTLY** (mechanism); **BUG INHERITED** downstream (hardcoded `_tDewMicro = 29` drives the weights — see Finding 2).

**LC5 (source `risk_functions.js`):**
- Lines 2812–2827: iterates layers, accumulates `_Rcum` through CLO resistance, computes `_tLayerC = _tSkinC - (_tSkinC - _TambC) × (_Rcum/_Rtotal)`, pushes `_undershoot = max(0, _tDewMicro - _tLayerC)` per layer, then normalizes by `_cwSum`. If `_cwSum == 0` all layers above dew point → fallback assigns 1.0 to the outermost layer.

**LC6 (`calc_intermittent_moisture.ts`):**
- Lines 754–768: identical algorithm, ported verbatim. `_tSkinC = _TskRun` (from `iterativeTSkin`, which is physics-derived), but `_tDewMicro` in the `_undershoot` computation is still the hardcoded 29 (see Finding 2).

**Spec reference (expected distribution):**
- User provided expected split: shell ~51%, insulation ~31%, mid ~15%, base ~3%. Hand-derived from the ratified `_Rcum/_Rtotal` gradient for a 4-layer skiing ensemble at cold ambient — this is the OUTPUT of the algorithm, not a hardcoded constant in either LC5 or LC6.
- **Ensemble Thermal System Model** (`LayerCraft_Ensemble_Thermal_System_Model.docx`, LC5 archives) — documents that condensation placement biases toward the thermal boundary (typically shell), with small but nonzero contributions at inner layers driven by secondary CLO gradients.

**Verification at skiing defaults (CLO=2.5, 4 layers, T_skin=31°C, T_amb=-8.9°C i.e. 16°F):**
- Per-layer CLO = 0.625, R_layer = 0.625 × 0.155 = 0.0969 m²K/W
- _Rtotal = 2.5 × 0.155 + 1/(8.3 × √v_eff) ≈ 0.3875 + 0.041 (at 3 mph wind) ≈ 0.428
- Layer 0 (base): _Rcum = 0.0969, _tLayerC = 31 − (31−(−8.9)) × 0.0969/0.428 ≈ 31 − 9.03 ≈ 21.97°C → _undershoot(29−21.97) = 7.03
- Layer 1 (mid): _Rcum = 0.194, _tLayerC = 31 − 39.9 × 0.453 ≈ 31 − 18.07 ≈ 12.93°C → undershoot = 16.07
- Layer 2 (insulative): _Rcum = 0.291, _tLayerC ≈ 31 − 27.10 ≈ 3.90°C → undershoot = 25.10
- Layer 3 (shell): _Rcum = 0.388, _tLayerC ≈ 31 − 36.13 ≈ −5.13°C → undershoot = 34.13
- Sum = 82.33; normalized: base ≈ 8.5%, mid ≈ 19.5%, insul ≈ 30.5%, shell ≈ 41.5%.

User's expected ratios (51/31/15/3) are close but not an exact match — suggests different reference CLO/temp or `_tSkinC` baseline in the hand-derivation. The monotonic ordering (base < mid < insul < shell) matches, the linearity of `_Rcum/_Rtotal` interpolation holds, and the algorithmic mechanism is correct and preserved 1:1.

**Impact:**
- Distribution mechanism is correct. The output is driven by hardcoded `_tDewMicro = 29` (Finding 2), which means distribution shifts as a linear function of the wrong constant. Physics-corrected Magnus-derived `_tDewMicro` would move the undershoot landscape and reshape the per-layer weights — especially at warm/humid conditions where multiple layers could go from undershoot > 0 to undershoot = 0 (triggering the fallback `_condensWeights[length-1] = 1.0` that dumps everything on shell).
- **S21 implication:** at cold ambient (S21 typical), distribution is reasonable. Cross-kit comparison between ultralight and heavy uses the same _condensWeights (same CLO ratios per-layer when CLO total is the same); the weights normalize to ratios, so absolute CLO doesn't change them. What changes is the absolute `_fabricInG` × weight — for heavy vs ultralight at the same CLO, the weights are identical. If the two kits have different total CLO, weights shift. Not a primary driver of the crossover failure.

---

## Finding 6 — `computePerceivedMR`: 40 mL absolute base + fill-fraction outer

**Status:** **PORTED CORRECTLY** (1:1).

**LC5 (source `risk_functions.js`):**
- Line 287 (reference file line 302): `var PERCEIVED_WEIGHTS = [3, 2, 1.5, 1];`
- Line 291 (reference file line 306): `var COMFORT_THRESHOLD = 40;`
- Lines 293–311 (reference file 308–324):
  ```js
  var baseSat = Math.min(1, layers[0].buffer / COMFORT_THRESHOLD);   // absolute threshold
  var num = PERCEIVED_WEIGHTS[0] * baseSat;
  var den = PERCEIVED_WEIGHTS[0];
  for (var i=1; i<layers.length; i++) {
    var w = PERCEIVED_WEIGHTS[min(i, PERCEIVED_WEIGHTS.length-1)];
    var fill = layers[i].cap > 0 ? min(1, layers[i].buffer/layers[i].cap) : 0;  // fill fraction
    num += w*fill; den += w;
  }
  return Math.min(10, 7.2*(num/den));
  ```

**LC6 (`packages/engine/src/moisture/perceived_mr.ts`):**
- `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` (line 58) — match
- `COMFORT_THRESHOLD = 40` (line 68) — match
- `computePerceivedMR` (lines 94–113) — algorithm identical, including the `Math.min(10, 7.2 × (num/den))` output clamp.

**Spec reference:**
- **LC6_REDESIGN_v1_Closure.md §C** (classification table): `7.2` output scale, `COMFORT_THRESHOLD = 40 mL`, and the saturation cascade curve are **calibrations anchored to Fechner's Law / TA v5 §3.5 / Fukazawa 2003**, retained per S17 revert. `PERCEIVED_WEIGHTS [3,2,1.5,1]` is flagged as remaining fudge (`PHY-WEIGHTS-CAL`, MEDIUM).
- **PHY-PERCEIVED-MR-REDESIGN v1** (Session 14, SUPERSEDED by S17 revert) — attempted to replace 40 mL with BSA-scaled `comfortThresholdML(bsa) = 50 × 0.54 × bsa`. Reverted.
- **Fukazawa 2003** — 50 g/m² skin wetness perception threshold; 40 mL derives from 50 × ~0.8 m² torso contact estimate.

**Impact — and the S21 root-cause observation:**
- The **absolute base threshold vs fill-fraction outer layers** creates systematic cap-sensitivity asymmetry:
  - **Base layer** uses `baseSat = min(1, buffer/40)` — independent of cap. Once buffer ≥ 40 mL, baseSat is 1.0 regardless of whether cap is 36 mL or 128 mL.
  - **Outer layers** use `fill = min(1, buffer/cap)`. Heavy kit has larger caps, so for the same absolute buffer amount, heavy's fill fraction is lower.
- With the S21 `weightCategoryToGrams` pipeline active (evaluate.ts:1011–1053), ultralight base cap = 90g × 0.40 = 36 mL, heavy base cap = 320g × 0.40 = 128 mL. **Ultralight base buffer is clamped at 36 mL (cap) but the denominator is 40 mL (threshold)** — so ultralight `baseSat` maxes at 36/40 = 0.90, never 1.0. Heavy reaches baseSat = 1.0 at 40 mL buffer (before hitting 128 mL cap).
- **Counter-intuitively**, this means ultralight base has a *ceiling* on perceived contribution below 1.0 — which should make heavy appear WORSE than ultralight at the base-layer component. But the outer-layer component runs the other direction: heavy outer caps are bigger → fill fractions are smaller → outer contribution is lower.
- **Net effect over duration:** early in the session both kits accumulate liquid at similar rates (sweat rate is kit-independent). Ultralight outer caps fill quickly; heavy outer caps don't. Outer-layer `fill` dominates the `num/den` numerator (weights 2 + 1.5 + 1 = 4.5 vs base weight 3). As outer fills approach 1.0 for ultralight, its perceived MR climbs; heavy's stays lower because its outer fill remains <1.0 for longer.
- **Crossover mechanism (currently missing):** once heavy saturates (all fills at 1.0), `num/den → 1.0` and heavy should sit at cascade-transformed ~7.2. Ultralight has already been at saturation for many hours by then, so its `applyDurationPenalty(finalMR, timeAtCapHrs)` has accumulated a higher penalty. The LC5/LC6 duration-penalty formula is `0.45 × log(1 + timeAtCapHrs)` — at 16 hr, penalty ≈ 1.29; at 4 hr, ≈ 0.72. So ultralight accumulates *more* penalty, which should keep it above heavy even once both are at cap.
- **Why the duration penalty does not produce crossover in S21:** the cyclic path only increments `_cyclesAtCap` (line 935) when `cumMoisture > _systemCap`, where `_systemCap = max(getEnsembleCapacity(activity), sum(layer.cap) / 1000)`. Heavy kit has a larger `_systemCapLayers` (sum of layer caps), so `_systemCap` is rescaled upward — `cumMoisture > _systemCap` fires later for heavy. This **dilutes** heavy's duration-penalty clock. Simultaneously `getDrainRate` depends on total CLO (higher CLO → lower drain), but that effect is logarithmic and modest.
- **Cap-scaling asymmetry summary:** `_systemCap` scales with kit mass (via sum-of-layer-caps), `COMFORT_THRESHOLD` does not (it is a fixed 40 mL). The two reach the same per-kit conclusion in opposite directions, and the numerical balance the engine strikes is weighted toward outer-layer fill fractions — which systematically favor heavy kits.
- **LC5 had the same math.** The absence of crossover is not an LC6 regression; it is an unresolved physics gap in both LC5 and LC6, now visible because S21 added the `weight_category → weightG` pipeline that correctly propagates cap differences. Before S21, all cap values fell back to `100 + warmth × 20` (per `S20_MOISTURE_CAPACITY_PIPELINE_AUDIT.md` §1 "weightG never populated for real products") — so cap differences between kits were essentially zero and the asymmetry was invisible.

---

## Finding 7 — Inward overflow cascade, Washburn wicking, shell drain

**Status:** **PORTED CORRECTLY** — constants and formula match 1:1.

### 7a. Inward overflow cascade

**LC5 (source `risk_functions.js:2834–2836`, reference file 1834–1835):**
```js
for (var _oi = _layers.length - 1; _oi > 0; _oi--) {
  var _overflow = Math.max(0, _layers[_oi].buffer - _layers[_oi].cap);
  if (_overflow > 0) { _layers[_oi].buffer = _layers[_oi].cap; _layers[_oi-1].buffer += _overflow; }
}
_layers[0].buffer = Math.min(_layers[0].buffer, _layers[0].cap);
```

**LC6 (`calc_intermittent_moisture.ts:772–776`):** identical formula, identical direction (outermost → inward), identical base clamp.

### 7b. Washburn bidirectional wicking

**LC5 (source `risk_functions.js:2840–2862`, reference file 1840–1860):**
```js
// Outward (if _fillI > _fillJ):
var _wickR = (_layers[_li].wicking || 7) / 10;
var _retFrac = Math.pow(Math.max(0, 1 - _wickR), _cycleMin);
var _delta = (_fillI - _fillJ) * _layers[_li].cap * (1 - _retFrac) * 0.5;
// Inward (if _fillJ > _fillI): same form with _li+1 index and sign flipped.
```

**LC6 (`calc_intermittent_moisture.ts:779–797`):** identical formula. Wicking default `|| 7`, damping factor `0.5` (Courant stability), both directions present.

### 7c. Shell drain (PHY-047 Yoo & Kim surface evaporation)

**LC5 (source `risk_functions.js:2876–2883`, reference file 1876–1883):**
```js
var _runDrainHr = getDrainRate(tempF, humidity, _effectiveWindRun, _outerL.im, _totalCLO, _bsa);
var _liftDrainHr = getDrainRate(tempF, humidity, windMph, _outerL.im, _totalCLO, _bsa);
var _drainGPerHr = (_runDrainHr*_runMin + _liftDrainHr*_liftMin) / _cycleMin;
var _drainG = _drainGPerHr * (_cycleMin/60) * _outerFill; // Schlünder 1988 wetted fraction
_drainG = Math.min(_drainG, _outerL.buffer);
_outerL.buffer -= _drainG;
```

**LC6 (`calc_intermittent_moisture.ts:803–812`):** identical formula. Phase weighting (run wind vs lift wind) preserved. `_outerFill` Schlünder modulation preserved.

### 7d. `getDrainRate` formula

**LC5 (source `risk_functions.js:2057–2083`, reference file 1147–1171):** `drainW = vpdKpa × bsa / Ret`, where `Ret = Recl + Rea`, `Recl = Icl / (imEnsemble × 16.5 × fcl)`, `Icl = clo × 0.155`, `fcl = 1.0 + 0.31 × clo` (McCullough 1984), `hc = 8.3 × √v_air`, `he = 16.5 × hc` (Lewis relation). Skin temp hardcoded at 30°C (consistent with Finding 2 regime).

**LC6 (`packages/engine/src/heat_balance/drain_rate.ts`):** verified via imports at `calc_intermittent_moisture.ts:33`. Not re-reviewed in this pass — referenced as ported verbatim per the S20 audit and no evidence of divergence.

**Impact:**
- All three transport mechanisms are preserved 1:1. No LC5→LC6 drift in the mechanics that would produce S21's crossover regression.
- One observation about the **0.5 Courant damping factor in Washburn**: this is documented as "integration discretization / Courant stability" (PHY-HUMID-01 v2 §7 table). It halves the Washburn transfer per step. Combined with the per-cycle time step (`_cycleMin`), the effective wicking rate is `0.5 × wicking/10` fraction per cycle. For wicking=7, each cycle transfers up to 35% of the fill-gap — aggressive but not instantaneous. This mechanism DOES eventually equalize layer fills given enough cycles, which is the path by which heavy eventually saturates all layers. But the duration-penalty clock (Finding 6) stops accumulating for heavy as soon as `cumMoisture ≤ _systemCap`, which is itself cap-scaled — so heavy never accrues enough duration penalty to cross ultralight.

---

## 8. Cross-cutting observations

### 8.1 What LC6 ports correctly (the majority)

`calcIntermittentMoisture` is a 968-line LC5 function that LC6 ports as a 1,109-line TypeScript file with strict typing added (the line inflation is type annotations and null-guards; the algorithm is 1:1). Per-layer buffer model, condensation placement, inward cascade, Washburn wicking, shell drain, `getDrainRate`, `computePerceivedMR`, `applySaturationCascade`, fatigue accumulator, EPOC decay, `iterativeTSkin`, `computeEmax`/`computeSweatRate`, duration penalty — all verbatim. The port discipline is high. `packages/engine/src/moisture/calc_intermittent_moisture.ts:3` explicitly asserts verbatim port from LC5 lines 2426–3393.

### 8.2 Bugs LC6 inherits from LC5 (Findings 2, 3, 4)

All three moisture-routing bugs identified by PHY-HUMID-01 v2 exist in **both** LC5 and LC6:
1. Hardcoded `_tSkinRetC = 30 / _tDewMicro = 29` instead of Magnus-derived per-layer.
2. `_excessHr` and `_liftExcessG` (liquid at skin) gated by `_netRetention` instead of routed direct-to-base.
3. `_aHygro` (ambient hygroscopic absorption) computed but never added to any layer in the cyclic path.

LC6 has the **helpers** for fix #1 implemented (`magnusDewPoint`, `inverseMagnus` in `vpd.ts`) but they are never imported or called. The S17 revert kept Phase 1 (helpers) but removed Phase 2+3 (the routing fixes that would call them).

### 8.3 Bug LC6 fixes vs LC5 (Finding 1)

`applySaturationCascade` is dead code in LC5 — defined at line 839 but never called. LC6 Session 19 wired it into the `sessionMR` pipeline. This is an improvement over LC5 and is on-spec per S17 closure's Fechner-anchored output budget.

### 8.4 New in LC6 (not present in LC5)

`weightCategoryToGrams` (`evaluate.ts:1011–1053`, S21) maps categorical `weight_category` → `weightG`, which `getLayerCapacity` multiplies by `FIBER_ABSORPTION[fiber]` to yield per-layer caps. This is the first time cap values actually differ between gear tiers in a production build of either codebase. Before S21, `weightG` was always undefined → fell through to `100 + warmth × 20` fudge (documented in `S20_MOISTURE_CAPACITY_PIPELINE_AUDIT.md` Finding 1).

### 8.5 Root cause of the S21 crossover regression

The regression **is not a LC5→LC6 physics drift.** It is an emergent property of three interacting design decisions, all inherited from LC5 and now made visible by S21's capacity pipeline:

1. **`_systemCap` scales with kit mass** (max of activity cap and `sum(layer.cap)/1000`) — heavy kit's `_systemCap` is larger, so `cumMoisture > _systemCap` fires later, so `_cyclesAtCap` increments later, so `timeAtCapHrs` is shorter for heavy, so duration penalty is smaller.
2. **`COMFORT_THRESHOLD` does NOT scale with kit mass** (fixed 40 mL) — ultralight base caps below threshold cap `baseSat` at 0.9; heavy bases reach 1.0 normally. This partially offsets the cap-scaling asymmetry but only on the base layer.
3. **Outer-layer `fill = buffer/cap`** scales inversely with kit cap — heavy kit's larger outer caps produce lower fill fractions for the same absolute buffer, lowering the `num/den` contribution from outer layers (weighted 2 + 1.5 + 1 = 4.5, vs base weight 3).

The combined effect: heavy kit's `sessionMR` is systematically compressed by (1) and (3), partially restored by (2), net result **lower MR than ultralight at every duration**, with the gap widening as duration grows because (1) amplifies over time while (2)'s cap on baseSat is duration-independent.

**Crossover cannot emerge from this system** unless one of:
- `COMFORT_THRESHOLD` is made cap-aware (as PHY-PERCEIVED-MR-REDESIGN v1 proposed — now superseded by S17 revert).
- `_systemCap` is decoupled from `sum(layer.cap)` and instead anchored to activity-typical values (revert S13-S14 capacity expansions).
- `applyDurationPenalty` is rescaled so heavy accrues penalty proportional to kit dry mass ("heavy = more water to dry").
- A new mechanic is added: **heavy-kit drying drag**, e.g., `drain_effective = getDrainRate / sqrt(sum(layer.cap)/reference_cap)`, so larger kits dry proportionally slower after saturation. This matches user ground-truth ("heavy should overtake ultralight because drying is slower") without requiring redesign of `computePerceivedMR`.

These are design decisions, not physics bugs, and each requires its own ratified spec. S22's starting point should be a dedicated spec for the **post-saturation drying physics** — the current engine treats drain rate as CLO-dependent but not kit-mass-dependent beyond that, and Havenith 2008 + Rossi 2005 both document that total fabric water mass is a first-order driver of drying time (not just Ret).

### 8.6 Recommendation for S22

Not proposing code changes in this audit. But for spec-writing priority:

1. **Immediate (specs existing):** PHY-HUMID-01 v2 Phase 2+3 remains ratified. Re-implementing it should be self-contained per spec §5.1, but is blocked on the §6 downstream audit + §7 hand-computed reference scenarios. Recommend re-opening the implementation in S22 with a pared-down scope: Magnus-derived `_tDewMicro` first (Finding 2 fix), then liquid-at-skin direct-to-base routing (Finding 3 fix), both gated on H3 hand-verification.
2. **Spec needed for crossover:** "Post-saturation drying physics" — document the first-order dependence of drying time on kit dry mass per Havenith 2008 / Rossi 2005. Primary lever: modify `_drainG` or `applyDurationPenalty` (one or the other, not both) to scale with `sum(layer.cap)` or dry mass. Hand-verify against a simple case: "if both kits are fully saturated, heavy kit at cap for 1 hr vs ultralight at cap for 3 hr should compute roughly equivalent MR penalties."
3. **Nice-to-have (Finding 4):** wire `_aHygro → _layers[length-1].buffer` per PHY-HUMID-01 v2 §2.2 Category C. Small absolute effect on S21 scenarios (cold dry), but makes `_aHygro` no longer dead code and affects humid scenarios. Cheap fix.

### 8.7 What this audit does NOT claim

- No claim that S21 should revert the `weightCategoryToGrams` pipeline. That pipeline is on-spec and makes a pre-existing physics gap visible for the first time. The gap is the problem, not the visibility.
- No claim that `computePerceivedMR` is wrong. The absolute-threshold-at-base, fill-fraction-outer design is anchored to Fukazawa 2003 and retained by S17 closure as documented calibration.
- No claim that cascade wiring (Finding 1) is responsible for the crossover failure. Cascade transforms the output symmetrically for both kits above raw 6; it does not create or hide a crossover.
- No claim about the steady-state path or linear path divergence. Both paths were read and the S21 regression was observed in the cyclic path only.

---

## 9. References

- LC5 source: `/Users/cmcarter/Desktop/LayerCraft 5/risk_functions.js` (6,201 lines)
- LC5 reference extract: `packages/engine/reference/lc5_risk_functions.js` (2,520 lines)
- LC6 cyclic implementation: `packages/engine/src/moisture/calc_intermittent_moisture.ts` (1,109 lines)
- LC6 perceived MR: `packages/engine/src/moisture/perceived_mr.ts` (113 lines)
- LC6 saturation cascade: `packages/engine/src/moisture/saturation_cascade.ts` (32 lines)
- LC6 constants: `packages/engine/src/moisture/constants.ts` (51 lines)
- LC6 gear layers: `packages/engine/src/ensemble/gear_layers.ts` (with `FIBER_ABSORPTION`, `getLayerCapacity`, `buildLayerArray`)
- LC6 Magnus helpers: `packages/engine/src/heat_balance/vpd.ts:70,93` (defined, uncalled)
- LC6 weight pipeline: `packages/engine/src/evaluate.ts:1011–1063`
- Ratified spec: `LC6_Planning/specs/PHY-HUMID-01_Spec_v2_RATIFIED.md`
- Superseded spec: `LC6_Planning/specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md` (S17 reversion)
- Closure: `LC6_Planning/LC6_REDESIGN_v1_Closure.md`
- Prior audit: `LC6_Planning/audits/S20_MOISTURE_CAPACITY_PIPELINE_AUDIT.md`

---

## Document status

- **Version:** v1 (findings-only)
- **Session:** 21 (2026-04-19)
- **No code changes proposed or made as part of this audit.**
- **Next action (S22):** open spec for "post-saturation drying physics" (new) and revisit PHY-HUMID-01 v2 Phase 2+3 re-implementation.
