> **⚠️ SUPERSEDED by v2 — 2026-04-17 (same session, post-audit)**
>
> This spec (v1) was ratified earlier in Session 12 but contained a physics error
> caught during post-ratification forensic audit: the proposed `_excessRetention
> = 1.0 - _ambientMargin × 0.10` was a fudge factor that double-counted E_max's
> ambient effect. Forensic audit determined the correct fix is ROUTING, not
> retention tuning. See PHY-HUMID-01_Spec_v2_RATIFIED.md for the physics-correct
> specification. v1 is retained for audit trail visibility per Cardinal Rule #1.

---

# PHY-HUMID-01 v1 RATIFIED — Physics-Derived Moisture Accumulation in Warm/Humid Conditions

**Status:** RATIFIED 2026-04-17 (Session 12, same session as draft — accelerated path)
**Session raised:** 12 (2026-04-17)
**Session ratified:** 12 (2026-04-17)
**Implementation target:** Session 13 or later
**Supersedes:** None. Amends PHY-048 (per-layer buffer model).
**Cardinal Rule territory:** #8 (thermal engine locked), #1 (no fudge factors), #11 (no code without spec)

**Ratification note:** all five open questions resolved per recommended resolutions. See §11 Ratification record below.

---

## 1. Executive summary

Session 12 diagnosed scenario H3 (75°F / 90% RH / 1.5hr running) producing MR=0.7 against the real 1,627-product gear catalog, with CDI=1.0 classifying `heat_compensable`. Hand-computed physics: `E_req ≈ 600W`, `E_max ≈ 224W`, `w_req ≈ 2.7` — deeply uncompensable, should accumulate ~400g of trapped moisture over 1.5hr. The model correctly identifies the uncompensability and produces `_excessHr ≈ 270 g/hr`, but then routes this excess through a cold-weather-tuned condensation placement model. The model uses hardcoded reference temperatures `_tSkinRetC = 30°C` and `_tDewMicro = 29°C` that suppress retention to ~3% at H3's 23.9°C ambient. 97% of the physically-real excess sweat disappears from the moisture model.

This spec replaces hardcoded reference temperatures with Magnus-derived physics values, removes three confirmed fudge factors (`dryAirBonus`, `_localDryBonus`, `humidityFloorFactor`), flags others as latent calibration requiring separate derivation specs, and fixes H3 without creating new calibration tuning.

**Cardinal Rule #1 honesty:** the current code has 9+ unsourced hardcodes in the warm/humid path. This spec removes or flags every one of them.

---

## 2. Current state — annotated

### 2.1 Cyclic path — calc_intermittent_moisture.ts:730-750

```typescript
// Condensation model (Yoo & Kim 2008)
const _vaporExitHr = Math.min(_srRun.sweatGPerHr, (_emaxRun.eMax / L_V_J_PER_G) * 3600);
_surfacePassHr = getDrainRate(tempF, humidity, windMph, _outerL.im, _totalCLO, _bsa);
const _condensHr = Math.max(0, _vaporExitHr - _surfacePassHr);
const _excessHr = Math.max(0, _srRun.sweatGPerHr - _vaporExitHr);
const _tSkinRetC = 30;                                  // FIXED HARDCODE
const _tDewMicro = 29;                                  // FIXED HARDCODE
const _RcloHalf = _totalCLO * 0.155 * 0.5;
const _RairCond = 1 / (8.3 * Math.sqrt(Math.max(0.5, _windMs)));
const _midFrac = (_totalCLO > 0) ? _RcloHalf / (_totalCLO * 0.155 + _RairCond) : 0.5;
const _tMidC = _TambC + (_tSkinRetC - _TambC) * _midFrac;
const _condensSeverity = Math.max(0, (_tDewMicro - _tMidC) / _tDewMicro);
const _netRetention = 0.40 * _condensSeverity;          // 0.40 from Yoo & Kim, OK
```

**Failure mode at H3 (T_amb = 23.9°C):**
- T_mid ≈ 23.9 + (30 - 23.9) × 0.5 ≈ 27°C
- _condensSeverity = (29 - 27) / 29 = 0.069
- _netRetention = 0.40 × 0.069 = 0.028 (2.8%)
- 97% of _excessHr (270 g/hr) discarded

**Root cause:** `_tDewMicro = 29` is a cold-weather reference. In real physics, the dew point of the microclimate depends on actual ambient T and RH plus skin-side vapor contribution. At 75°F / 90% RH ambient, actual dew point is ~22°C (via Magnus), not 29°C.

### 2.2 Sweat and evap fudge factors

**dryAirBonus (line 447) and _localDryBonus (line 381) — DUPLICATED staircase:**
```typescript
const dryAirBonus = humidity < 20 ? 1.8 : humidity < 30 ? 1.4 : humidity < 40 ? 1.15 : 1.0;
const _localDryBonus = _localRH < 20 ? 1.8 : _localRH < 30 ? 1.4 : _localRH < 40 ? 1.15 : 1.0;
```
No citation. VPD ratio (`vpdRatio`) already captures the dry-air advantage via physics. Double-counting + fudge.

**rawTempMul (line 453), humMul (line 455), _ventHum (line 825), _gradeMul (line 377):** staircases flagged but deferred to separate specs (see §4.2).

**humidityFloorFactor (utilities.ts, PHY-051 cited):**
```typescript
return rh < 70 ? 1.0 : Math.max(0.25, 1.0 - (rh - 70) / 60);
```
Second approximation of what `vpdRatio` already computes. Redundant.

### 2.3 Linear/steady-state path (line 1057-1090)

Uses the same `dryAirBonus` fudge. Same CARDINAL RULE #1 violation.

---

## 3. Physics-derived replacements

### 3.1 Microclimate dew point — computed, not hardcoded

**Current:** `_tDewMicro = 29` (fixed)

**Replacement:** Per-layer dew point via Magnus formula, interpolated between skin-saturated vapor pressure (at T_skin) and ambient vapor pressure.

```typescript
// Helpers in heat_balance/vpd.ts
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

**Per-layer dew point** — interpolate vapor pressure by thermal resistance fraction (per OQ-A resolution):

```typescript
const p_skin_sat = satVaporPressure(_TskRun);  // Magnus at T_skin (saturated microclimate)
const p_amb = satVaporPressure(_TambC) * (humidity / 100);
// For each layer, f_layer = cumulative thermal resistance through layer / total resistance
// p_local(f) = p_skin_sat * (1 - f) + p_amb * f
// T_dew_local = inverseMagnus(p_local)
// T_layer_local = _TskRun - (_TskRun - _TambC) * f
// condensSeverity_local = max(0, (T_dew_local - T_layer_local) / T_dew_local)
```

Alduchov & Eskridge 1996 — same paper cited for existing `satVaporPressure`. Derivation-exact.

### 3.2 T_skin reference — use computed value

**Current:** `_tSkinRetC = 30` (fixed)

**Replacement:** Use `_TskRun` directly — already physics-derived by `iterativeTSkin` in the same cycle.

```typescript
const _tSkinRetC = _TskRun;  // physics-derived, no hardcode
```

### 3.3 Uncompensable excess retention — NEW derivation

**Issue:** `_excessHr` (sweat the body wants to produce but can't evaporate) currently gets gated by `_condensSeverity` — cold-weather condensation logic. In warm conditions `_condensSeverity` ≈ 0, so `_excessHr` disappears from the model.

**Physics reality:** `_excessHr` is by definition sweat that pooled because `E_req > E_max`. It accumulates at skin regardless of whether fabric is cold enough to condense vapor. Retention should be ~1.0 minus a small ambient-diffusion margin.

**Replacement:**
```typescript
const _ambientMargin = Math.max(0, (p_skin_sat - p_amb) / p_skin_sat);
const _excessRetention = 1.0 - _ambientMargin * 0.10;
// Then:
const _fabricInG = (_retainedCondensG + _excessHr * _excessRetention) * (_runMin / 60)
                 + _liftFabricG + _insensibleG;
```

The `0.10` coefficient represents skin-level diffusion escape — the fraction of ambient margin that allows excess sweat to still escape via non-gradient diffusion. Flagged as **PHY-HUMID-EXCESS-CAL** for future empirical derivation (per OQ-C resolution).

**Hand-check for H3:**
- p_skin_sat = 53.2 hPa, p_amb = 26.7 hPa
- _ambientMargin = 0.498
- _excessRetention = 1.0 - 0.498 × 0.10 = 0.950
- 95% of _excessHr (270 g/hr) retained = 256 g/hr
- Over 1.5 hr run phase ≈ 385 g accumulated
- 3-layer synthetic kit cap ≈ 200-240 g (PHY-071 saturation capacity)
- System saturates mid-trip → cascade fires → MR climbs

### 3.4 dryAirBonus / _localDryBonus — DELETE

**Current:** 3-step staircase at both line 447 and line 381.

**Replacement:** Delete both. Evaporation formulas already use `_phVpd = vpdRatio(...)` and `_lVpd = vpdRatio(...)`. The VPD ratio naturally scales evap capacity by actual physics.

**Hand-verification:** at 15% RH vs 50% RH, `vpdRatio` at 20°C returns ~0.85 vs 0.50 (ratio 1.7×). The dryAirBonus added an additional 1.8× on top. The 3× total was physically unjustified.

### 3.5 humidityFloorFactor — DELETE

**Current:** `rh < 70 ? 1.0 : max(0.25, 1.0 - (rh-70)/60)` (utilities.ts, PHY-051).

**Analysis:** PHY-051's cited physics (VPD narrows with RH) is already computed via `vpdRatio`. This function is redundant.

**Replacement:** Delete the function. Callers at `split_body.ts:160` and any imports must be updated to use `vpdRatio(tempF, humidity)` directly (returns a compatible scaling factor).

---

## 4. Scope

### 4.1 IN SCOPE (PHY-HUMID-01 v1 — H3 fix + cleanup, per OQ-E resolution)

1. **New helpers** in `heat_balance/vpd.ts`:
   - `magnusDewPoint(T_C, RH_percent) → T_dew_C`
   - `inverseMagnus(p_hPa) → T_dew_C`

2. **Replace hardcoded constants** in `calc_intermittent_moisture.ts` lines 736-737:
   - `_tSkinRetC = 30` → `_tSkinRetC = _TskRun`
   - `_tDewMicro = 29` → per-layer Magnus interpolation

3. **Add `_excessRetention`** for uncompensable sweat (§3.3).

4. **Delete `dryAirBonus`** (line 447) and `_localDryBonus` (line 381). Update callsites at lines 525 and 1060 to not multiply.

5. **Delete `humidityFloorFactor`** and update callers (split_body.ts:160, imports in calc_intermittent_moisture.ts).

6. **Hand-compute H3 verification:**
   - Expected MR ≥ 3.5 at H3 inputs with real gear
   - No regression of C1-C7 cold scenarios
   - Plausible shifts for H1, H2, H4, H5, E7 (may move slightly due to dryAirBonus removal)

### 4.2 OUT OF SCOPE (separate specs raised)

- **PHY-SWEAT-UNIFICATION** — replace `phaseSweatRate` rawTempMul staircase with Gagge unification
- **PHY-GRADE-01** — Minetti GAP replacement for `_gradeMul` (audit whether already partially implemented per memory note)
- **PHY-HUMID-VENT-REWRITE** — replace `_ventHum` staircase with VPD-derived venting effectiveness
- **PHY-HUMID-HUMMUL-CAL** — empirical derivation of humMul knee/slope
- **PHY-HUMID-EXCESS-CAL** — empirical derivation of the 10% skin-diffusion factor in `_excessRetention`

---

## 5. Hand-computed H3 verification

### 5.1 Input conditions
- T_amb = 75°F = 23.9°C, RH = 90%
- Wind = 3 mph ambient + ~3 m/s running speed = ~4.5 m/s effective
- CLO ensemble = 1.2, im = 0.41, BSA = 1.9 m², Duration = 1.5 hr

### 5.2 Physics chain with PHY-HUMID-01

**Ambient dew point:** T_dew_amb ≈ 22.0°C (Magnus)
**Assumed T_skin:** ≈ 34°C (from iterativeTSkin, hot running)
**p_skin_sat:** 53.2 hPa; **p_amb:** 26.7 hPa
**_ambientMargin:** 0.498; **_excessRetention:** 0.950

**Per-layer chain (3-layer: base, mid, shell):**

| Layer | f | p_local (hPa) | T_dew_local | T_layer | Condens severity |
|---|---|---|---|---|---|
| Base | 0.33 | 44.4 | 31.2°C | 30.7°C | 0.016 (minimal) |
| Mid | 0.67 | 35.4 | 26.9°C | 27.2°C | 0 (no condens) |
| Shell | 1.0 | 26.7 | 22.0°C | 23.9°C | 0 (no condens) |

**Condensation-placement contribution is minimal** at H3 — correct behavior. Warm-humid failure mode is NOT condensation.

**Uncompensable excess:**
- `_excessHr` ≈ 270 g/hr (from existing physics — E_req > E_max)
- `_fabricInG` from excess = 270 × 0.95 × 1.5 = 385 g
- Plus condensation, insensible ≈ 400g total fabric accumulation
- System cap ≈ 240g → cap exceeded → cascade fires

### 5.3 Expected MR

- Base layer saturates (cascade inward-in during earlier cycles also)
- Per `computePerceivedMR`: base absolute load > 40g Fukazawa threshold
- Outer layers at cap
- Weighted MR: 5-7 range

---

## 6. Cardinal Rule compliance

### 6.1 Cardinal Rule #1 (no fudge factors)

| Constant | Before | After | Status |
|---|---|---|---|
| `_tSkinRetC = 30` | Hardcoded | `_TskRun` (physics-derived) | DERIVED |
| `_tDewMicro = 29` | Hardcoded | Per-layer Magnus interpolation | DERIVED |
| `dryAirBonus` staircase | Fudge | Deleted (VPD already handles) | REMOVED |
| `_localDryBonus` staircase | Fudge | Deleted | REMOVED |
| `humidityFloorFactor` | Latent calibration | Deleted (redundant with VPD) | REMOVED |
| `_netRetention` base (0.40) | Yoo & Kim 2008 cited | Unchanged | OK |
| `_excessRetention` (0.10) | N/A — new | Documented + GAP flag | DERIVED + FLAGGED |
| `_ventHum` staircase | Fudge | PHY-HUMID-VENT-REWRITE (separate) | DEFERRED |
| `rawTempMul` staircase | Fudge | PHY-SWEAT-UNIFICATION (separate) | DEFERRED |
| `humMul` linear | Physiologically grounded | Documented + GAP flag | FLAGGED |
| `_gradeMul` staircase | Fudge | PHY-GRADE-01 (separate) | DEFERRED |

### 6.2 Cardinal Rule #8 (thermal engine locked)

All changes require Chat-produced surgical code + hand-computed verification per site.

### 6.3 Cardinal Rule #11 (no code without spec)

Spec status: RATIFIED Session 12. Implementation may proceed.

### 6.4 Cardinal Rule #16 (EngineOutput contract)

No contract changes. All fixes internal.

---

## 7. Test plan

### 7.1 H3 validation (must pass)
H3 inputs → MR ≥ 3.5, CDI ≥ 3.0, stage in {heat_intensifying, heat_exhaustion_detected}.

### 7.2 Non-regression
All 19 adversarial matrix scenarios:
- C1-C7: MR changes ≤ ±0.5
- H1, H2, H4, H5: may change slightly (dryAirBonus removal); must stay qualitatively correct
- E7: may climb (humid low-MET). Still plausible.

### 7.3 Unit tests
`packages/engine/tests/heat_balance/magnus_dewpoint.test.ts`:
- `magnusDewPoint(20, 50) ≈ 9.3°C`
- `magnusDewPoint(30, 80) ≈ 26.2°C`
- `magnusDewPoint(23.9, 90) ≈ 22.0°C` (H3)
- `inverseMagnus(satVaporPressure(15)) ≈ 15°C` (round-trip)

### 7.4 Hand-computed test vectors
Per code change site: input → expected intermediate values → expected final MR (±5%).

---

## 8. (Formerly Open Questions — now RESOLVED at ratification, see §11)

---

## 9. References

- Alduchov & Eskridge 1996 — Magnus formula constants
- Yoo & Kim 2008 — condensation placement at thermal boundary (PHY-048)
- Nielsen & Endrusick 1990 — compensatory sweat elevation
- Minetti 2002 — GAP equation (PHY-GRADE-01 candidate)
- Fukazawa 2003 — 40 mL comfort threshold
- PHY-048 (LayerCraft) — per-layer buffer model
- PHY-039 (LayerCraft) — VPD-based evaporation
- PHY-032 (LayerCraft) — hygroscopic absorption
- PHY-046 (LayerCraft) — Gagge two-node sweat rate

---

## 10. Raised specs (follow-up work)

All raised as candidates for future sessions — no ratification required yet:

- PHY-SWEAT-UNIFICATION
- PHY-GRADE-01
- PHY-HUMID-VENT-REWRITE
- PHY-HUMID-HUMMUL-CAL
- PHY-HUMID-EXCESS-CAL

---

## 11. Ratification record (Session 12, 2026-04-17)

All five open questions resolved per recommended resolutions:

**OQ-A (layer fraction definition):** RESOLVED — thermal-resistance weighted. Per-layer `f_layer = Σ(R_i through layer_i) / R_total`. Consistent with existing `_Rcum` at line 757.

**OQ-B (microclimate RH at skin):** RESOLVED — retain saturated-skin assumption (`p_skin_sat` from Magnus at T_skin). Matches PHY-048 and Gagge. Sedentary-cold microclimate sub-saturation OUT OF SCOPE.

**OQ-C (`_excessRetention` factor):** RESOLVED — `1.0 - _ambientMargin × 0.10`. The `0.10` is accepted latent calibration, flagged PHY-HUMID-EXCESS-CAL for future empirical derivation. Alternative "fully trapped" (0) rejected — would over-saturate cold scenarios.

**OQ-D (hygroAbsorption vs _excessHr):** RESOLVED — confirmed distinct and additive. hygroAbsorption = ambient-to-fabric. _excessHr = sweat-to-skin. No code disambiguation needed.

**OQ-E (scope):** RESOLVED — Option B. H3 fix + dryAirBonus + humidityFloorFactor removal. rawTempMul unification deferred to PHY-SWEAT-UNIFICATION.

**Ratification decision:** Spec RATIFIED. Implementation proceeds via Chat-produced surgical scripts per Cardinal Rule #13, with hand-computed verification per Cardinal Rule #8.

---

## Document status

**Version:** v1 RATIFIED
**Session raised:** 12 (2026-04-17)
**Session ratified:** 12 (2026-04-17)
**Implementation target:** Session 13 or later
**Supersedes:** None
**Amends:** PHY-048 (condensation placement), PHY-039 (deletes duplicate dryAirBonus), PHY-051 (deletes redundant humidityFloorFactor)
**Raises:** PHY-SWEAT-UNIFICATION, PHY-HUMID-VENT-REWRITE, PHY-GRADE-01, PHY-HUMID-HUMMUL-CAL, PHY-HUMID-EXCESS-CAL
