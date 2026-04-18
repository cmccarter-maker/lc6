# PHY-HUMID-01 v2 RATIFIED — Physics-Correct Moisture Routing

**Status:** RATIFIED 2026-04-17 (Session 12, supersedes v1)
**Session raised:** 12 (2026-04-17)
**Session ratified:** 12 (2026-04-17)
**Supersedes:** PHY-HUMID-01 v1 (contained `_excessRetention = 0.10` fudge factor)
**Implementation target:** Session 13 or later
**Cardinal Rule territory:** #1 (no fudge factors), #8 (thermal engine locked), #11 (no code without spec), #14 (read before proposing)

---

## 1. Executive summary

PHY-HUMID-01 v1 identified that H3 (75°F / 90% RH / 1.5hr running) produced MR=0.7 when physics predicts 5-8. v1 correctly diagnosed the hardcoded `_tDewMicro = 29°C` and `_tSkinRetC = 30°C` reference temperatures. v1 incorrectly proposed `_excessRetention = 1.0 - _ambientMargin × 0.10` as a retention coefficient — this was a fudge factor that double-counted E_max and had no physics derivation for the `0.10`.

Post-ratification forensic audit (detailed in `/mnt/user-data/outputs/PHY-HUMID-01_Forensic_Audit.md`) determined that **the real bug is MISROUTING, not a missing coefficient.** Three distinct moisture categories are currently treated identically when they have different physical origins and require different destinations.

**v2 spec: three moisture categories, three routing rules, zero calibration coefficients.**

---

## 2. The routing fix

### 2.1 Current (buggy) state

All fabric moisture accumulation flows through `_fabricInG` (line 747):

```typescript
const _fabricInG = (_retainedCondensG + _excessHr * _netRetention) * (_runMin / 60)
                 + _liftFabricG
                 + _insensibleG;
```

Where `_liftFabricG = _liftCondensG × _netRetention + _liftExcessG × _netRetention` (line 745).

Then distributed via `_condensWeights` (line 765):
```typescript
for (let _di = 0; _di < _layers.length; _di++) {
  _layers[_di]!.buffer += _fabricInG * _condensWeights[_di]!;
}
```

**Bug 1:** `_excessHr` and `_liftExcessG` are LIQUID AT SKIN — uncompensable sweat that pooled because `E_req > E_max`. They're currently gated by `_netRetention` (cold-weather condensation severity), which zeros them at warm ambient. Physics: liquid at skin isn't gated by vapor condensation.

**Bug 2:** `_insensibleG` is LIQUID AT SKIN (transepidermal baseline). Currently routed via `_condensWeights` to thermal-gradient layers. Physics: liquid at skin enters the base layer, not outer layers.

**Bug 3:** `_aHygro` (ambient vapor absorbed from outside, line 534) is DEAD CODE. Computed but never applied to any layer or moisture accumulator in the cyclic path. Activities using the cyclic path miss hygroscopic absorption entirely.

### 2.2 Physics-correct routing (v2)

**Three categories, three routing paths:**

**Category A: Vapor in transit that condenses (_retainedCondensG, _liftCondensG)**

Physics: vapor produced at skin travels outward through fabric. Where temperature drops below local dew point, it condenses. Placement depends on thermal gradient.

- Routed via `_condensWeights` (existing, correct)
- Gated by `_netRetention = 0.40 × _condensSeverity` (Yoo & Kim 2008 cited, correct)
- v2: `_condensSeverity` computed per-layer from Magnus-derived dew point (not hardcoded 29°C)

**Category B: Liquid at skin (_excessHr, _liftExcessG, _insensibleG)**

Physics: liquid water at skin contacts base layer via capillary wicking. For clothed subjects, all absorbed into clothing (Kubota et al. 2021: "in clothed subjects, 'dripping' sweat is absorbed by clothing"). Then distributed via Washburn wicking.

- Routed DIRECTLY to `_layers[0].buffer` (base layer)
- NOT gated by `_netRetention`
- Washburn bidirectional wicking (already implemented, lines 775-793) redistributes outward based on fill gradient
- Overflow cascade (inward, already implemented) handles base-cap exceedance

**Category C: Ambient vapor absorbed from outside (_aHygro)**

Physics: ambient water vapor contacts outer fabric surface. Absorbed into fabric via regain coefficient × vapor pressure × fabric permeability. Enters from the outer side.

- Routed DIRECTLY to `_layers[length-1].buffer` (shell/outer)
- Activates currently-dead-code path
- Washburn wicking redistributes inward if outer saturates

### 2.3 Code changes required

Line 745: REPLACE
```typescript
const _liftRetainedG = _liftCondensG * _netRetention + _liftExcessG * _netRetention;
const _liftFabricG = isNaN(_liftRetainedG) ? _liftProdG * 0.35 : _liftRetainedG;
```

WITH:
```typescript
// Separate liquid from vapor in lift phase
const _liftVaporFabricG = _liftCondensG * _netRetention;  // vapor condensation only
const _liftLiquidG = _liftExcessG;                          // liquid at skin — direct to base
```

Line 747: REPLACE
```typescript
const _fabricInG = (_retainedCondensG + _excessHr * _netRetention) * (_runMin / 60) + _liftFabricG + _insensibleG;
```

WITH:
```typescript
// Vapor condensation — routed via _condensWeights, gated by _netRetention
const _vaporFabricG = _retainedCondensG * (_runMin / 60) + _liftVaporFabricG;

// Liquid at skin — routes directly to base layer, no gate
const _liquidAtSkinG = _excessHr * (_runMin / 60) + _liftLiquidG + _insensibleG;

// Ambient hygroscopic — routes directly to shell, no gate
const _ambientVaporG = _aHygro;
```

Line 765: REPLACE
```typescript
for (let _di = 0; _di < _layers.length; _di++) {
  _layers[_di]!.buffer += _fabricInG * _condensWeights[_di]!;
}
```

WITH:
```typescript
// Category A: vapor condensation distributed by thermal gradient
for (let _di = 0; _di < _layers.length; _di++) {
  _layers[_di]!.buffer += _vaporFabricG * _condensWeights[_di]!;
}

// Category B: liquid at skin — directly to base layer
_layers[0]!.buffer += _liquidAtSkinG;

// Category C: ambient hygroscopic — directly to shell
_layers[_layers.length - 1]!.buffer += _ambientVaporG;
```

---

## 3. Dew point derivation (from v1, retained)

### 3.1 Helpers in `heat_balance/vpd.ts`

```typescript
export function magnusDewPoint(T_C: number, RH_percent: number): number {
  const A = 17.27, B = 237.3, E0 = 6.1078;
  const p_amb = E0 * Math.exp(A * T_C / (T_C + B)) * (RH_percent / 100);
  const ln_ratio = Math.log(p_amb / E0);
  return B * ln_ratio / (A - ln_ratio);
}

export function inverseMagnus(p_hPa: number): number {
  const A = 17.27, B = 237.3, E0 = 6.1078;
  const ln_ratio = Math.log(p_hPa / E0);
  return B * ln_ratio / (A - ln_ratio);
}
```

### 3.2 Per-layer dew point in `_condensWeights` computation

Replace lines 736-744 which currently use hardcoded `_tDewMicro = 29` and `_tSkinRetC = 30`:

```typescript
// Physics-derived skin and dew point
const _tSkinRetC = _TskRun;  // from iterativeTSkin — already computed
const _pSkinSatHpa = satVaporPressure(_tSkinRetC);  // Magnus
const _pAmbHpa = satVaporPressure(_TambC) * (humidity / 100);  // Magnus

// Per-layer dew point computation via interpolation
// f_layer = cumulative thermal resistance through layer / total resistance
// p_local(f) = p_skin_sat * (1-f) + p_amb * f
// T_dew_local = inverseMagnus(p_local)
// T_layer_local = T_skin - (T_skin - T_amb) * f
// condensSeverity_local = max(0, (T_dew_local - T_layer_local) / T_dew_local)
```

Then the existing `_condensWeights` loop (lines 752-763) can be updated to use per-layer dew points:

```typescript
_condensWeights = [];
let _cwSum = 0;
for (let _cwi = 0; _cwi < _layers.length; _cwi++) {
  const _layerCLO = _totalCLO / _layers.length;
  _Rcum += _layerCLO * 0.155;
  const _fLayer = _Rcum / _Rtotal;
  const _pLocal = _pSkinSatHpa * (1 - _fLayer) + _pAmbHpa * _fLayer;
  const _tDewLayer = inverseMagnus(_pLocal);
  const _tLayerC = _tSkinRetC - (_tSkinRetC - _TambC) * _fLayer;
  const _undershoot = Math.max(0, _tDewLayer - _tLayerC);
  _condensWeights.push(_undershoot);
  _cwSum += _undershoot;
}
if (_cwSum > 0) {
  for (let _cwi = 0; _cwi < _condensWeights.length; _cwi++) {
    _condensWeights[_cwi] = _condensWeights[_cwi]! / _cwSum;
  }
} else {
  // All layers above dew point — no vapor condensation anywhere (warm humid case)
  // This is correct: _retainedCondensG will still be ~0 via the severity gate
  _condensWeights[_condensWeights.length - 1] = 1.0;
}
```

And `_netRetention` uses a per-layer-averaged severity:

```typescript
// Aggregate condensation severity for _netRetention gate on _retainedCondensG
let _condensSeverityAvg = 0;
for (let _i = 0; _i < _layers.length; _i++) {
  const _layerCLO = _totalCLO / _layers.length;
  // ... recompute per-layer severity
  _condensSeverityAvg += _severity_i;
}
_condensSeverityAvg /= _layers.length;
const _netRetention = 0.40 * _condensSeverityAvg;  // Yoo & Kim 2008
```

(Implementation detail for Session 13: may be cleaner to compute severity-per-layer once in the loop and reuse.)

---

## 4. Deletions (from v1, retained)

### 4.1 Delete `dryAirBonus` (line 447) and `_localDryBonus` (line 381)

3-step staircase. Redundant with `vpdRatio`. VPD formula already captures the physics.

**Callsites updated:** remove `* dryAirBonus` from lines 525 and 1060 evaporation formulas.

### 4.2 Delete `humidityFloorFactor`

`rh < 70 ? 1.0 : max(0.25, 1.0 - (rh-70)/60)` (utilities.ts). Second approximation of VPD narrowing. Redundant with `vpdRatio`.

**Callsites updated:** `split_body.ts:160` and any imports replaced with `vpdRatio(tempF, humidity)`.

---

## 5. Scope

### 5.1 IN SCOPE (v2 implementation)

1. **Add helpers** to `heat_balance/vpd.ts`: `magnusDewPoint`, `inverseMagnus`
2. **Replace hardcodes** at lines 736-737: per-layer Magnus derivation
3. **Fix routing** at lines 745-765: three categories, three paths
4. **Delete fudges:** `dryAirBonus`, `_localDryBonus`, `humidityFloorFactor`
5. **Wire dead code:** `_aHygro` → `_layers[length-1]`
6. **Hand-compute H3 verification:** MR ≥ 3.5 expected, no regression on C1-C7

### 5.2 OUT OF SCOPE (separate specs)

- **PHY-SWEAT-UNIFICATION** — replace `phaseSweatRate` rawTempMul staircase with Gagge (flagged in Open Issues)
- **PHY-GRADE-01** — Minetti GAP replacement (flagged)
- **PHY-HUMID-VENT-REWRITE** — `_ventHum` physics replacement (flagged)
- **PHY-HUMID-HUMMUL-CAL** — empirical humMul derivation (flagged)
- **PHY-STEADY-STATE-LAYERS** — add per-layer model to steady-state path (raised post-audit)
- **PHY-HUMID-DEAD-CODE-CLEANUP** — remove orphaned `phaseData`/`cycleNet` block (raised post-audit)

### 5.3 CANCELLED

- **PHY-HUMID-EXCESS-CAL** — was raised in v1 to derive the `_excessRetention 0.10` coefficient empirically. v2 removes that coefficient entirely (routing fix, not retention tuning). No coefficient to derive.

---

## 6. Hand-computed H3 verification

**H3 inputs:** T_amb = 75°F / 23.9°C, RH = 90%, Wind = 3 mph, Running, 1.5hr, Real gear (CLO=1.2, im=0.41, 3-layer synthetic ensemble)

### 6.1 Sweat physics (from existing Gagge code — unchanged)

- E_req ≈ 600 W
- E_max ≈ 224 W (Magnus VPD × BSA / Resistance at 90% RH)
- w_req ≈ 2.7 (uncompensable)
- Sweat production ≈ 889 g/hr (E_req / L_V × 3600)
- `_vaporExitHr` = `min(sweat, E_max/L_V × 3600)` ≈ 332 g/hr
- `_excessHr` ≈ 557 g/hr (sweat minus vapor exit)

### 6.2 With v2 routing

Per-hour flows:
- Vapor condensation (Category A): near zero at H3 (all layers above dew point → `_netRetention` ≈ 0 correctly)
- Liquid at skin (Category B): 557 + 10 = 567 g/hr → `_layers[0].buffer` directly
- Ambient hygro (Category C): ~30 g/hr → `_layers[length-1].buffer`

### 6.3 Accumulation trajectory

**Base layer (_layers[0]):**
- Cap ≈ 80 g (synthetic 200g piece × 0.40 PHY-071)
- Receiving 567 g/hr from skin
- Saturates in ~9 minutes at cap
- Then overflows inward (but base IS innermost) — clamped to cap at line 772
- Washburn wicks outward when fill > outer fill
- Steady state: base at cap, wicking ~300 g/hr outward, receiving 567 → net 267 g/hr into mid

**Mid layer (_layers[1]):**
- Receives ~267 g/hr via Washburn
- Receives cascade overflow when shell saturates
- Cap ≈ 60-80 g
- Saturates after ~20-30 min

**Shell layer (_outerL):**
- Receives Washburn from mid + 30 g/hr hygro
- `getDrainRate` at 90% RH: p_surf at shell surface temp ≈ 22°C → p_sat ≈ 26 hPa; p_amb = 26.7 × 0.9 ≈ 24 hPa → VPD ≈ 2 hPa
- Drain rate ≈ 15-20 g/hr (severely compromised by saturated ambient)
- Receiving ~100+ g/hr via Washburn + hygro
- Saturates, then overflow cascades inward

**After 1.5 hours:**
- System total production: 889 × 1.5 = 1334 g sweat + vapor loss via breath
- Vapor evap via normal path: 332 × 1.5 = 498 g
- Shell drain: ~25 g
- Respiratory: ~100 g (already tracked in `_totalFluidLoss`)
- Remaining trapped in fabric: ~700-800 g (out of 1334 g)

**Wait — that's way more than system cap allows.** Let me reconsider.

### 6.4 The critical consistency check

System cap = sum of all layer caps = 80 + 80 + 60 ≈ 220 g.

If 700 g is arriving and can't drain, the system saturates quickly and **sweat starts dripping off skin** (the base layer is full, can't accept more). That dripping sweat — physically — falls off the body and is lost from the fabric accumulation model even in clothed subjects (Kubota acknowledges some drip happens at very high sweat rates).

**Implementation note for Session 13:** when `_layers[0].buffer` is at cap AND incoming liquid exceeds what Washburn can wick outward, the excess should be tracked as "drip loss" (a diagnostic but not accumulated). This already happens implicitly via the `Math.min(_layers[0]!.buffer, _layers[0]!.cap)` clamps — the excess is silently discarded.

This is actually CORRECT physics. The silent discard models the drip.

### 6.5 Expected MR at H3

Via `computePerceivedMR`:
- Base layer: full at 80 g >> 40 g Fukazawa threshold → baseSat = 1.0, weighted 3×
- Mid: saturated (60 g / 60 g cap) → fill = 1.0, weighted 2×
- Shell: saturated → fill = 1.0, weighted 1.5×
- Weighted sum: (3×1.0 + 2×1.0 + 1.5×1.0) / (3+2+1.5) = 6.5/6.5 = 1.0
- **MR = 7.2 × 1.0 = 7.2**

**At H3: MR = 7-8 range.** Matches physical intuition of soaked humid runner.

### 6.6 Contrast with v1 (buggy) output

- v1 proposed `_excessRetention ≈ 0.95` at H3 → 557 × 0.95 = 529 g/hr into fabric via condens-weights
- Condens-weights at H3: `_cwSum = 0` (no layer below dew point) → fallback `[0, 0, 1.0]` → 100% to shell
- Shell gets 529 g/hr × 1.5 = 793 g, clamps to shell cap 60 g, overflows inward
- Cascade would eventually saturate base via inward overflow BUT the existing `_excessHr × _netRetention` gate at line 747 zeros `_netRetention` at H3 (condensSeverity = 0)
- Result with v1 STILL: _excessHr × 0 = 0 → excess never enters system → MR stays at 0.7

**v1 didn't actually fix H3.** This is another reason to supersede.

---

## 7. Cardinal Rule compliance (v2)

| Constant | Value | Source | Status |
|---|---|---|---|
| `_tSkinRetC` | `_TskRun` | iterativeTSkin (physics-derived) | ✅ Derived |
| `_tDewMicro` | Per-layer Magnus | Alduchov & Eskridge 1996 | ✅ Derived |
| `_netRetention` base | `0.40 × _condensSeverity` | Yoo & Kim 2008 retention fraction | ✅ Cited |
| Magnus A, B, E0 | 17.27, 237.3, 6.1078 | Alduchov & Eskridge 1996 | ✅ Cited |
| Washburn 0.5 damping | Integration discretization | Not physics tuning | ✅ OK |
| Fiber saturation (0.35, 0.40, 0.60, 2.00) | Rossi 2005 / Holmer / Scheurell / Fukazawa | PHY-071 | ✅ Cited |
| `_excessRetention` | **DELETED** | v1's fudge withdrawn | ✅ Removed |
| `dryAirBonus` | **DELETED** | Redundant with vpdRatio | ✅ Removed |
| `_localDryBonus` | **DELETED** | Redundant with vpdRatio | ✅ Removed |
| `humidityFloorFactor` | **DELETED** | Redundant with vpdRatio | ✅ Removed |

**Zero new calibration coefficients.** All retained constants have published physics sources or are pure implementation (integration step sizes, discretization).

---

## 8. Test plan

### 8.1 Unit tests (new)

`packages/engine/tests/heat_balance/magnus_dewpoint.test.ts`:
- `magnusDewPoint(20, 50) ≈ 9.3°C`
- `magnusDewPoint(30, 80) ≈ 26.2°C`
- `magnusDewPoint(23.9, 90) ≈ 22.0°C` (H3)
- `inverseMagnus(satVaporPressure(15)) ≈ 15°C` (round-trip)

### 8.2 H3 validation

Input: H3 adversarial scenario.
Expected: MR ≥ 3.5 (target 5-8), CDI ≥ 3.0, stage in {heat_intensifying, heat_exhaustion_detected}.

### 8.3 Non-regression

All 19 adversarial matrix scenarios (C1-C7, H1-H5, E1-E7):
- C1-C7: MR changes ≤ ±0.5
- H1, H2, H4, H5: may shift slightly (dryAirBonus removal); must stay qualitatively correct
- E7: may climb (humid low-MET scenario)

### 8.4 Hand-computed test vectors

Per code change site: input → expected intermediate values → expected final MR (±5%).

---

## 9. References

- Alduchov & Eskridge 1996 — Magnus formula constants (already used in LC6 `satVaporPressure`)
- Washburn 1921 — capillary wicking dynamics (PHY-048 basis for Layer model)
- Yoo & Kim 2008 — condensation placement at thermal boundary; 0.40 retention fraction (PHY-048)
- Kubota et al. 2021 (Physiological Reports) — clothed subjects absorb dripping sweat
- Ashworth et al. 2020 — sweat evaporation thermodynamics
- Alber-Wallerström & Holmér 1985 — sweating efficiency (51-87% nude)
- Candas et al. 1979 — skin wettedness and sweat efficiency
- Fukazawa 2003 — 40 mL base-layer comfort threshold
- Havenith 2008 — clothed evaporative cooling efficiency
- PHY-048 (LayerCraft) — per-layer buffer model + saturation cascade
- PHY-071 (LayerCraft) — fiber saturation coefficients
- PHY-032 (LayerCraft) — hygroscopic absorption formula

---

## 10. Session 13 implementation checklist

Before any code edit:
- [ ] Re-read v2 spec completely
- [ ] Verify `_TskRun` is available at line 736 (it is — computed earlier in the cycle loop)
- [ ] Hand-compute test vectors for at least H3, C2 (cold condensation), E7 (humid stationary) before applying any edit
- [ ] Write the Magnus dew point test file FIRST (tests drive implementation)

Implementation order:
1. Add helpers to `vpd.ts` + unit tests
2. Update `_condensWeights` computation (per-layer Magnus)
3. Split `_fabricInG` into 3 categories (A/B/C routing)
4. Update layer-buffer update loop (3 distinct writes)
5. Delete `dryAirBonus`, `_localDryBonus`, `humidityFloorFactor`
6. Update evap formula callsites
7. Run full test suite
8. Run adversarial matrix
9. Hand-verify H3, C2, E7

**Cardinal Rule #8:** every edit requires Chat-produced surgical code + hand-computed verification. Code session applies only exact scripts, no autonomous reasoning.

---

## 11. Supersession record

**This document supersedes PHY-HUMID-01 v1** (same Session 12, 2026-04-17).

v1 ratified earlier in session with five recommended OQ resolutions. Post-ratification forensic audit (driven by Christian's question "why is this water not trapped in the layering system") exposed v1's `_excessRetention = 1.0 - _ambientMargin × 0.10` as a fudge factor.

v1 is retained at `LC6_Planning/specs/PHY-HUMID-01_Spec_v1_RATIFIED.md` with a SUPERSEDED banner, not deleted, so the audit trail shows explicitly:
- What was proposed (v1)
- What was wrong (post-ratification audit finding)
- What the correct physics is (v2)

**Cardinal Rule #1 discipline:** fudge factors caught at any stage get removed, even after ratification. The process works when we're willing to reopen ratified decisions upon finding error.

---

## Document status

**Version:** v2 RATIFIED
**Session raised:** 12 (2026-04-17)
**Session ratified:** 12 (2026-04-17, after forensic audit)
**Supersedes:** PHY-HUMID-01 v1 (same session)
**Implementation target:** Session 13 or later
**Amends:** PHY-048 (routing fix for three moisture categories)
**Raises:** PHY-STEADY-STATE-LAYERS, PHY-HUMID-DEAD-CODE-CLEANUP
**Cancels:** PHY-HUMID-EXCESS-CAL (v1's undefensible coefficient withdrawn)
