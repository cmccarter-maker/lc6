# S20 Audit — Moisture Capacity Pipeline Analysis

**Session:** 20
**Status:** Findings-only (no code changes)
**Triggered by:** S19-SYSTEM-CAP-PLATEAU investigation — why does MR plateau identically across 14hr and 20hr scenarios?

---

## Executive summary

The plateau observed in S19 (trapped moisture freezing at ~0.311 L, MR at 7.20 raw / 8.0 post-cascade) is **mechanically correct given the current code**, but the code itself has **four distinct issues** that were conflated under "S19-SYSTEM-CAP-PLATEAU." The original single item decomposes into four separate tracker items, each with bounded scope.

**The biggest finding is not the plateau.** It is that the gear adapter does not populate `weightG` for any real product in the 1,627-product catalog, so `getLayerCapacity` hits the `100 + warmth × 20` weight fudge for **every** scenario, not just null-gear tests.

---

## Mechanism analysis

### How per-layer caps are computed

```ts
// packages/engine/src/ensemble/gear_layers.ts:109
export function getLayerCapacity(item, fiberType): number {
  const absorption = FIBER_ABSORPTION[fiberType] ?? 0.02;
  const warmth = item?.warmthRatio ?? item?.warmth ?? 5;
  const weightG = item?.weightG ?? (100 + warmth * 20);
  return Math.max(2, weightG * absorption);
}
```

This is the SINGLE call that determines per-layer moisture capacity for the entire engine. It is called by `buildLayerArray` for both real-gear and null-gear scenarios. Null-gear uses virtual items like `{ warmth: 5 }` — so the physics path is consistent.

### FIBER_ABSORPTION values are NOT regain

```ts
export const FIBER_ABSORPTION = {
  SYNTHETIC: 0.40,
  WOOL: 0.35,
  COTTON: 2.00,
  DOWN: 0.60,
};
```

Textbook molecular regain values:
- Merino wool: ~0.30
- Polyester: ~0.004
- Cotton: ~0.08
- Down: undefined (complex)

The code values are 10-100× higher than regain. They appear to represent **total water retention under saturated wetting** — regain + interstitial liquid + surface film + capillary-held water. This is probably the right quantity for the engine (total fabric water capacity), but the name and the coefficients need citation backing.

### Hand-computed plateau reconciliation

Skiing default ensemble (4 layers, `gearItems=null`):
- Base (merino, warmth=5): 200g × 0.35 = **70 mL cap**
- Mid (synthetic, warmth=5): 200g × 0.40 = **80 mL cap**
- Insulation (synthetic, warmth=7): 240g × 0.40 = **96 mL cap**
- Shell (synthetic, warmth=2): 140g × 0.40 = **56 mL cap**
- **Total: 302 mL**

Observed in S19 long-duration tests: `trapped = 311 mL`. Small difference is base layer filling slightly above 40 mL COMFORT_THRESHOLD but below 70 mL cap. **Math matches.** The plateau is the engine correctly reporting "all layers are at cap."

### MR=7.20 at plateau — hand-computed
At plateau: baseSat=1.0 (>40mL), all other fills=1.0 → num=7.5, MR = 7.2 × 1.0 = **7.20**. Matches observed value exactly.

Post-cascade: `applySaturationCascade(7.20) = 6 + 4 × (1 - (1 - 0.3)²) = 8.04 → rounds to 8.0`. Matches observed sessionMR.

**The plateau is not a bug. Everything below is.**

---

## Finding 1 — `weightG` never populated for real products (HIGH)

`packages/engine/src/gear/adapter.ts` declares `RawGearItem.weight?: string`. Real catalog entries are strings like `"350g"` or `"12 oz"`. The adapter converts `RawGearItem → EngineGearItem` but **never parses these strings into numeric `weightG`**.

Consequence: **every scenario, including real-gear scenarios, hits the `weightG = 100 + warmth × 20` fudge.** Real products' actual weights are not used.

Grep confirms: no call site in `packages/engine/src/` populates `weightG` on a gear item. Only its type declaration and the fallback formula reference it.

**Proposed tracker ID:** `S20-WEIGHT-STRING-PARSE-GAP`
**Priority:** HIGH
**Fix scope:** one focused session — add string-to-grams parser to the gear adapter, populate `weightG` during `RawGearItem → GearItem` conversion, validate against the catalog for edge cases (`"12 oz"`, `"12.5 oz"`, `"350 g"`, `"350g"`, empty values).

---

## Finding 2 — Default weight fudge `100 + warmth × 20`

When `weightG` is missing (currently: always, per Finding 1), the fallback is:
```ts
weightG = 100 + warmth * 20
```

This is a fudge without citation. Warmth score (1-10) does not reliably predict garment weight. A 600g down parka and a 250g high-loft synthetic might have the same warmth score.

Proper fix (after Finding 1 is resolved): query the 1,627-product catalog for median `weightG` per slot (base / mid / insulation / shell) and use slot-specific medians as the fallback. Citation becomes "median of gear DB, N=X per slot."

**Proposed tracker ID:** `S20-DEFAULT-WEIGHT-FUDGE`
**Priority:** MEDIUM
**Fix scope:** one session, depends on Finding 1 being resolved first (so the catalog has real numeric weights to median).

---

## Finding 3 — FIBER_ABSORPTION values need citation

Values [SYNTHETIC: 0.40, WOOL: 0.35, COTTON: 2.00, DOWN: 0.60] are not regain values. They appear to represent total water retention under wetting conditions but lack citation.

Calibration against observed ski-day plateau (302 mL computed vs 311 mL observed) suggests the values are "right flavor" but needs textile science validation. Possible sources: ASTM D4772 water retention method, Havenith multilayer fabric dynamics, Fukazawa fabric water retention studies.

**Proposed tracker ID:** `S20-FIBER-ABSORPTION-VALIDATION`
**Priority:** MEDIUM
**Fix scope:** research-heavy session. Literature review → citation → either retain current values with anchor or propose revised values.

---

## Finding 4 — Post-cap duration penalty ceiling

After all layers saturate, `applyDurationPenalty` is the only mechanism that can push MR higher with time. S19 observed:
- 14 hr sustained saturation: sessionMR = 8.0
- 20 hr sustained saturation: sessionMR = 8.0 (identical)

Duration penalty appears to saturate at the 7.20 → 8.0 cascade transform level. It is not pushing values above 8 regardless of how many hours past cap the simulation runs.

Physiologically: 6 more hours of max-saturation in sub-freezing conditions should carry additional risk (fluid loss, CIVD degradation, thermal fatigue). The MR output is not reflecting it.

**Proposed tracker ID:** `S20-DURATION-PENALTY-CEILING`
**Priority:** MEDIUM
**Fix scope:** investigate `applyDurationPenalty` function body, reason about whether post-cap trajectory should continue rising or whether a separate physiological channel should contribute.

---

## S19-SYSTEM-CAP-PLATEAU closure

Original finding decomposes into:
- **Not a bug** — the plateau mechanism is correct for a fully-saturated ensemble
- **Real issues underneath** — Findings 1-4 above

Recommend: close `S19-SYSTEM-CAP-PLATEAU` as "decomposed into S20-* items, no standalone fix required."

---

## Next-session scope

**S21 target (proposed):** resolve `S20-WEIGHT-STRING-PARSE-GAP`. Add string-to-grams parser to gear adapter, populate `weightG` during conversion, validate against catalog. This is the prerequisite for everything else — until real products have numeric weights, Findings 2-4 investigations are partially blocked.

