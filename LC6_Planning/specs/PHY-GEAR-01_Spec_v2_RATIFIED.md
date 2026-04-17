# PHY-GEAR-01 — gear.js → RawGearDB Adapter Spec

**Status:** DRAFT v2 — ratification target (Session 11)
**Author:** Chat
**Supersedes:** DRAFT v1 (amendments A, B, C from Amendment Delta folded in)
**Dependencies:** Working Agreement v3, Architecture Document v1.1 RATIFIED, LC5 `risk_functions.js` (authoritative reference for peer imputation algorithm and immersion physics)
**Scope of this spec:** Session 11 only. Touches the gear adapter and gear type definitions. Does NOT touch the thermal engine (Cardinal Rule #8). Does NOT change the EngineOutput contract in a way that breaks v1.1 (expansion of `GearSlot` union is additive, see §11 Architecture Amendment).

**Changes from DRAFT v1:**
- Amendment A: immersion gear (drysuit, wetsuit) routed to new `immersion` slot instead of `shell`. Full physics deferred to PHY-IMMERSION-01. `GearSlot` union grows 9→12 (not 9→11).
- Amendment B: new §5.7 Calibration Constants Honesty Ledger flagging seven peer-imputation tuning parameters as GAP-tracked LC5-derived heuristics.
- Amendment C: §3.2 (warmthRatio→CLO) and §3.3 (breathability→im) rewritten to flag these as LC5 calibration curves with ISO 9920-consistent endpoints but non-derived interpolation shapes. Two new future specs raised (PHY-GEAR-WARMTH-CAL, PHY-GEAR-BREATH-CAL).

---

## 1. Problem statement

LC6's current gear adapter (`packages/engine/src/gear/adapter.ts`) was built in Session 10 against the ~50-item embedded test DBs in `diagnostic.test.ts` and `real_gear.test.ts`. When the real LC5 `gear.js` (1,627 products across 175+ brands) is passed in, three classes of problem surface:

1. **Structural incompleteness.** The current `RawGearDB` type declares only 7 sub-buckets of gear.js's 12 top-level categories. `upper.insulation`, `lower.pants`, `lower.ski_pants`, `lower.shell_pants`, `lower.bike`, `drysuit`, `wetsuit`, `sleeping_bags`, `sleeping_pads`, and `gear` are all silently dropped. Against the real database this drops ~1,100 products — including the entire insulation category and all ski pants.

2. **Silent physics misrouting.** The adapter hardcodes `fiber: 'synthetic'` for every converted item. With PHY-071 landed (Session 10), the fiber-specific `FIBER_ABSORPTION` coefficients vary by 7× between synthetic, wool, cotton, and down. Hardcoding all items as synthetic silently misroutes every merino base layer and every down puffy into wrong saturation physics.

3. **Missing confidence system.** The documented LC5 confidence tier system (full / reduced / excluded) with peer imputation (strict → relaxed → null) is fully implemented in LC5's `risk_functions.js` but is absent from the LC6 adapter. Products missing thermal attributes currently pass through with midpoint defaults, producing plausible-looking items backed by fictional physics.

**Success criterion:** after this spec is implemented:
- All 1,627 products in gear.js reach the adapter, with correct routing to canonical slots.
- All 7 currently-blocked scenarios in the adversarial matrix produce peak metrics.
- Fiber type is inferred from product text, driving correct PHY-071 physics.
- Products carrying `_confidence` from the scrape pipeline retain that tier; products missing it have it inferred from populated-attribute count.
- Peer imputation fills missing attributes using LC5's strict-→-relaxed algorithm, with median (not mean) for numeric attributes.
- Immersion gear (drysuits, wetsuits) captured inert for future PHY-IMMERSION-01 physics.
- All LC5-derived calibration constants flagged transparently in honesty ledger.
- No changes to thermal engine (Cardinal Rule #8). No changes to EngineOutput contract (Rule #16) beyond additive expansion of `GearSlot` union.

---

## 2. Canonical vocabulary

### 2.1 Engine-level slots (physics layer — 12 values)

The `GearSlot` union in `packages/engine/src/types.ts` expands from 9 to 12 members:

```typescript
export type GearSlot =
  | "base"
  | "mid"
  | "insulative"
  | "shell"
  | "legwear"
  | "footwear"
  | "headgear"
  | "handwear"
  | "neck"
  | "sleeping_bag"   // NEW — manufacturer-rated sleep gear, separate physics
  | "sleeping_pad"   // NEW — R-value-rated sleep gear, separate physics
  | "immersion";     // NEW — drysuits, wetsuits; PHY-IMMERSION-01 physics (deferred)
```

This is an additive change. All existing consumers of `GearSlot` continue to work unchanged. See §11 for Architecture Document amendment.

### 2.2 Source-level subslots (metadata layer — 19 values)

Each `EngineGearItem` produced by the adapter carries a new optional `subslot` metadata field tagging its gear.js source. The engine physics does not read `subslot`; it exists for UI, diagnostics, and the infographic.

```typescript
export type GearSubslot =
  // Upper body
  | "upper_base" | "upper_mid" | "upper_insulative" | "upper_shell"
  // Lower body
  | "lower_base" | "lower_pants" | "lower_insulative" | "lower_ski_shell"
  | "lower_shell" | "lower_bike"
  // Immersion
  | "immersion_drysuit" | "immersion_wetsuit" | "immersion_wader"
  // Extremities (sub-type carried in `type` field of raw item)
  | "footwear" | "headgear" | "handwear" | "neck"
  // Sleep
  | "sleeping_bag" | "sleeping_pad";
```

### 2.3 The mapping table

| gear.js source path | Engine slot | Subslot | User-facing label |
|---|---|---|---|
| `upper.base_layer` | `base` | `upper_base` | "Base layer (top)" |
| `upper.mid_layer` | `mid` | `upper_mid` | "Mid layer" |
| `upper.insulation` | `insulative` | `upper_insulative` | "Insulated jacket / puffy" |
| `upper.shell` | `shell` | `upper_shell` | "Shell / hardshell jacket" |
| `lower.base_layer` | `legwear` | `lower_base` | "Base layer (bottom)" |
| `lower.pants` | `legwear` | `lower_pants` | "Hiking / softshell pants" |
| `lower.insulation` ← NEW | `legwear` | `lower_insulative` | "Insulated pants" |
| `lower.ski_pants` | `legwear` | `lower_ski_shell` | "Ski / shell pants" |
| `lower.shell_pants` | `legwear` | `lower_shell` | "Hardshell pants" |
| `lower.bike` | `legwear` | `lower_bike` | "Cycling shorts / tights" |
| `drysuit` | `immersion` | `immersion_drysuit` | "Drysuit" (deferred physics) |
| `wetsuit` | `immersion` | `immersion_wetsuit` | "Wetsuit" (deferred physics) |
| `footwear` | `footwear` | `footwear` | "Boot / shoe" |
| `headgear` | `headgear` | `headgear` | "Hat / helmet" |
| `handwear` | `handwear` | `handwear` | "Glove / mitten" |
| `sleeping_bags` | `sleeping_bag` | `sleeping_bag` | "Sleeping bag" |
| `sleeping_pads` | `sleeping_pad` | `sleeping_pad` | "Sleeping pad" |
| `gear` | — | — | EXCLUDED (non-thermal accessories) |

**Handling of currently-empty `lower.insulation` bucket.** gear.js does not yet have a `lower.insulation` array. The adapter accepts the key being absent (optional in the `RawGearDB` type) and simply produces zero items from it. This creates a landing slot for future scrapes (Feathered Friends Helios Down Pants, Patagonia DAS Light, Mountain Hardwear Ghost Whisperer Pants, etc.) and for manual re-categorization of existing miscategorized items (currently in `lower.ski_pants`). Data curation is a separate workstream.

**Immersion slot — deferred physics.** Products routed to `immersion` are captured with `spec_confidence: 0` and **excluded from enumeration** in `enumerateCandidates` until PHY-IMMERSION-01 lands. Rationale: neoprene wetsuits and drysuits do not behave as shell garments. LC5 `risk_functions.js` lines 930–953 implements a separate split-body model (`waderSplitIm`, `waderSplitCLO`) that replaces lower-body ensemble physics with material-property table lookup for thickness classes (`neoprene_5mm: {im: 0.00, clo: 1.50}`, etc., per Tikuisis 1997 and ISO 15027). Scoring these through the 6-attribute clothing pipeline is physically wrong. The adapter captures them for eventual PHY-IMMERSION-01 consumption but does not expose them to the clothing ensemble enumerator.

### 2.4 Dead slot

`neck` is in the engine `GearSlot` union but gear.js has no neck category and the enumerator does not require it. It remains in the union for future expansion (buffs, neck gaiters). The adapter produces zero `neck` items.

---

## 3. Attribute translation

### 3.1 The 8 user-facing attributes

| # | gear.js field | Scale | EngineGearItem mapping | Imputable? | Physics role |
|---|---|---|---|---|---|
| 1 | `breathability` | 1–10 | `breathability` (passthrough) + `im` (derived) | yes | Woodcock permeability index |
| 2 | `moisture` | 1–10 | `wicking` | yes | Next-to-skin vapor transport |
| 3 | `windResist` | 1–10 | `wind_resistance` | yes | Convective heat loss reduction |
| 4 | `warmthRatio` | 1–10 | `clo` (piecewise-linear derived) | yes | Insulation |
| 5 | `waterproof` | 0–3 (see §3.4) | `waterproof` (passthrough) | yes | Liquid barrier |
| 6 | `weight` | enum string | (not stored on EngineGearItem) | yes (mode) | Matching-only axis |
| 7 | `tempRange` | [lo, hi] °F | (not stored on EngineGearItem) | no | Peer-matching filter only |
| 8 | `fit` | `{activity: 0–10}` | (used for activity filter) | no | Activity affinity |

**Imputable attribute set** — matches LC5 `risk_functions.js` line 502 exactly:

```typescript
const IMPUTABLE = ["breathability", "windResist", "moisture", "weight", "warmthRatio", "waterproof"];
```

Six attributes. `tempRange` and `fit` are matching-only (not themselves imputed). The documented "8 attributes" and internal "6 imputable" views reconcile here: 8 are scored/displayed; 6 are imputable.

### 3.2 warmthRatio → CLO (LC5 calibration curve, endpoints plausible)

Preserve existing piecewise-linear curve from current adapter:

```typescript
function warmthToCLO(warmthRatio: number): number {
  if (warmthRatio <= 5) return warmthRatio * 0.06;
  if (warmthRatio <= 7) return 0.30 + (warmthRatio - 5) * 0.10;
  return 0.50 + (warmthRatio - 7) * 0.17;
}
```

**Endpoint anchors (plausible against published ranges):**
- warmthRatio 1 → CLO 0.06 (shell with minimal insulation; consistent with ISO 9920 shell Icl ≈ 0.05–0.10)
- warmthRatio 5 → CLO 0.30 (light base layer; no direct published anchor)
- warmthRatio 8 → CLO 0.67 (midweight insulation; consistent with observed products)
- warmthRatio 10 → CLO 1.01 (expedition down; consistent with published down-jacket CLO 0.8–1.2)

**Status:** GAP — endpoints plausible against published ranges; the specific piecewise-linear interpolation shape between endpoints is LC5-derived and not published. Flagged in §5.7 Honesty Ledger.

**Future work:** PHY-GEAR-WARMTH-CAL (low priority) — derive the mapping empirically by measuring CLO of representative products in each warmthRatio tier on a thermal manikin per ISO 15831.

### 3.3 breathability → im (LC5 calibration, ISO 9920-consistent endpoints)

Preserve existing linear curve:

```typescript
function breathabilityToIm(breathability: number): number {
  return 0.05 + (breathability / 10) * 0.40;
}
```

**Endpoint anchors (verified against ISO 9920:2007):**
- breathability=1 → im 0.09 (near-impermeable; ISO 9920 rubber/sealed garment floor ≈ 0)
- breathability=5 → im 0.25 (no direct ISO anchor)
- breathability=8 → im 0.37 (consistent with ISO 9920 "permeable clothing" default ≈ 0.38)
- breathability=10 → im 0.45 (approaches ISO 9920 air layer ≈ 0.5)

**Status:** GAP — endpoints consistent with ISO 9920:2007 published benchmarks; the specific linear-interpolation curve between endpoints is LC5-derived and not published. Flagged in §5.7 Honesty Ledger.

**Future work:** PHY-GEAR-BREATH-CAL (low priority) — derive empirically via Woodcock/Fukazawa measurements on representative products.

### 3.4 waterproof scale reconciliation

gear.js `waterproof` field has a documented 0–3 scale, but **82 entries in footwear and headgear carry values 6–9**. These reflect a boot/helmet membrane-pressure scale that was overloaded onto the same field name.

**Adapter behavior:**
- `waterproof` values 0–3 → passthrough to `EngineGearItem.waterproof`
- `waterproof` values 4–9 → clamp to 3 (treat as "fully waterproof" for thermal purposes)
- Log each clamp event during conversion to surface future curation opportunities

Rationale: the engine's `waterproof` field feeds into liquid-barrier physics that only distinguishes 4 tiers (none / DWR / water-resistant / waterproof). The boot/helmet 0–9 scale's extra granularity isn't physics-meaningful. This is a type-coercion repair, not a calibration decision.

### 3.5 Fiber inference

`EngineGearItem.fiber` is set by text-matching `brand + model + features` (where present) against an ordered priority list:

```typescript
function inferFiber(raw: RawGearItem, subslot: GearSubslot): FiberType {
  const text = `${raw.brand} ${raw.model} ${raw.features ?? ""}`.toLowerCase();

  // Explicit fillType field (sleeping bags have this)
  if ((raw as any).fillType === "down") return "down";
  if ((raw as any).fillType === "synthetic") return "synthetic";

  // Down indicators
  if (/\bdown\b|goose|duck\s+down|\b\d{3}\s*(?:fp|fill\s*power)\b|fillpower|fill\s*power/i.test(text)) {
    return "down";
  }

  // Wool indicators (checked before "merino" since merino is wool)
  if (/merino|\bwool\b|yak\s+wool|alpaca/i.test(text)) return "wool";

  // Cotton indicators
  if (/\bcotton\b|flannel|canvas/i.test(text)) return "cotton";

  // Explicit synthetic indicators (most reliable; cover known brand names)
  if (/polartec|primaloft|coreloft|pertex|capilene|dri-?fit|polyester|nylon|synthetic|thermoball|thinsulate|pl[au]mafill|plumafill/i.test(text)) {
    return "synthetic";
  }

  // Default: shells, wetsuits, immersion gear with no obvious fiber signal
  // (engine treats these as synthetic for FIBER_ABSORPTION purposes)
  return "synthetic";
}
```

**Verification during development:** add a diagnostic that logs fiber distribution by subslot across the full 1,627-product catalog. Expected distribution heuristic (sanity check, not a test assertion):
- `upper_base`, `lower_base`: mostly `wool` (merino dominance) + `synthetic`
- `upper_insulative`: mix of `down` (puffy category) + `synthetic`
- `upper_mid`, `upper_shell`, `lower_*_shell`, `lower_pants`, `lower_bike`: almost entirely `synthetic`
- `immersion_wetsuit`: `synthetic` (neoprene handled as synthetic — though immersion items are inert in Session 11 regardless)
- `sleeping_bag`: split by `fillType` field

If any subslot reports >10% unexpected fiber, flag for manual review — likely points to text patterns the inference missed. This is a diagnostic, not a gate.

### 3.6 Sleep system attributes (separate axis)

Sleep products don't carry the 6 clothing-imputable attributes. They carry:

**Sleeping bags:**
- `tempRange` [lo, hi] °F — general range
- `comfortRating` °F — manufacturer published comfort limit
- `lowerLimit` °F — manufacturer published survival limit
- `fillPower` — for down bags, 500–900+
- `fillType` — "down" or "synthetic"

**Sleeping pads:**
- `rValue` — ISO 11079 / ASTM F3340 thermal resistance, 1.0–10+ range
- `padType` — "inflatable" / "closed-cell foam" / "self-inflating"

These flow through to `EngineGearItem` as optional fields:

```typescript
export interface EngineGearItem {
  // ... existing fields unchanged ...

  // NEW: Sleep system fields (optional, populated only for sleeping_bag / sleeping_pad slots)
  comfort_rating_f?: number;  // sleeping bag comfort limit
  lower_limit_f?: number;     // sleeping bag survival limit
  fill_power?: number;        // down fill power
  r_value?: number;           // pad thermal resistance

  // NEW: Immersion gear field (optional, populated only for immersion slot)
  thickness_mm?: string;      // preserved raw value from gear.js (e.g. "4/3mm", "5mm")

  // NEW: metadata
  subslot?: GearSubslot;      // source bucket classification
  fiber?: FiberType;          // already present; now correctly inferred
}
```

The sleep system overlay (Architecture v1.1 §2, `overlays/sleep_system.ts`) consumes these fields directly. The 6-attribute confidence tier system does NOT apply to sleep gear — a sleeping pad with an `rValue` but no `warmthRatio` is correctly-specified sleep gear, not an under-specified clothing item.

**Sleep-gear confidence tiering:**
- `sleeping_pad` with `rValue` present → `spec_confidence: 8` (full)
- `sleeping_pad` missing `rValue` → excluded (pad with no R-value is unusable)
- `sleeping_bag` with `comfortRating` AND `lowerLimit` present → `spec_confidence: 8`
- `sleeping_bag` with one of (comfortRating, lowerLimit) present → `spec_confidence: 5` (reduced)
- `sleeping_bag` with neither → excluded

No peer imputation for sleep gear — manufacturer-published ratings are the source of truth; imputing R-value from "similar" pads would produce false confidence.

### 3.7 Immersion gear attributes (deferred, captured inert)

Products routed to `slot: "immersion"` (drysuit, wetsuit from gear.js) are captured with minimal transformation:

- `brand`, `model`, `price` — passthrough
- `thickness_mm` — preserved from gear.js `thickness` field ("4/3mm", "5mm", etc.)
- `features` — preserved as descriptive text
- `fit` map — preserved for future activity filtering
- `fiber` — set to `"synthetic"` by inference rules (neoprene handled as synthetic for FIBER_ABSORPTION purposes)
- `spec_confidence: 0` — explicit flag that these are not scored through the clothing pipeline
- All 6 IMPUTABLE attributes: preserved if present in gear.js (most wetsuit entries carry breathability/windResist/etc.), ignored if absent — no imputation attempted

**`enumerateCandidates` must exclude `slot: "immersion"` items.** This is a one-line filter in the strategy enumerator. If an adversarial matrix scenario calls for an immersion product in the future, it fails enumeration with a clear "immersion physics not yet implemented" signal pointing to PHY-IMMERSION-01.

**Future work:** PHY-IMMERSION-01 ports LC5's `WADER_DATA`, `WETSUIT_DATA`, `IMMERSION_SHIELD` tables, `waderSplitIm`, `waderSplitCLO`, `fishWading` activity flag, and split-body 45/55 BSA model. Cardinal Rule #8 work (thermal engine).

---

## 4. Confidence tier system

### 4.1 Tier bands (matches LC5 exactly)

```
specConfidence = number of populated attributes in IMPUTABLE (out of 6)

specConfidence 5–6  → full confidence    (no badge, shown normally)
specConfidence 3–4  → reduced confidence (orange "estimated" badge, behind Expand toggle)
specConfidence 0–2  → excluded           (score = -1, never shown)
```

Sleep gear uses the parallel 2-attribute bands defined in §3.6. Immersion gear uses `spec_confidence: 0` (explicit non-scoring) per §3.7.

### 4.2 Pool-size gate

```typescript
const applyConfidenceTiers = completeItems.length >= 3;
```

where `completeItems` is the subset of items in the category that have all 6 IMPUTABLE attributes populated. If a category has fewer than 3 fully-specified items (footwear, headgear, the `gear` accessories bucket where spec-level detail is scarce by design), tier filtering is bypassed and all items flow through.

### 4.3 Confidence assignment precedence

```
1. If raw item carries `_confidence` from score_products.js (scraped items) → use as-is
2. Else if slot is immersion → spec_confidence: 0 (explicit non-scoring)
3. Else if slot is sleeping_bag or sleeping_pad → apply §3.6 rules
4. Else count populated IMPUTABLE attributes → assign tier band per §4.1
```

### 4.4 `_confidence: 5` duplicate demotion

Port from `score_products.js` line 266: if 3+ items in the same category+subcategory share identical scored attributes, demote all to `_confidence: 5`. Catches the failure mode where AI scoring produces identical scores for distinct products (or where hand-curation copy-pastes entries).

---

## 5. Peer imputation algorithm (port from LC5 risk_functions.js)

### 5.1 Overview

When an item has ≥3 attributes present but is missing some of the 6 IMPUTABLE attributes, attempt to fill the gaps using median values from peer items.

### 5.2 Strict peer match

For each candidate peer (fully-specified item in same category):

**All known attributes of the target must match the peer within tolerance:**

| Attribute | Tolerance | Source |
|---|---|---|
| `weight` | exact match (string enum) | LC5 line 522 |
| `waterproof` | ±1 | LC5 line 523 (see §5.7) |
| `warmthRatio`, `breathability`, `windResist`, `moisture` | ±2.5 | LC5 line 524 (see §5.7) |

**Temperature overlap requirement:** `tempRange` overlap must be ≥40% of target's span (LC5 line 526, see §5.7):

```typescript
const overlap = Math.max(0,
  Math.min(target.tempRange[1], peer.tempRange[1]) -
  Math.max(target.tempRange[0], peer.tempRange[0])
);
const span = target.tempRange[1] - target.tempRange[0] || 1;
return overlap / span >= 0.40;
```

### 5.3 Relaxed peer match (fallback when strict yields <3 peers)

Same 6 attributes, looser tolerances, 60% attribute-agreement threshold:

| Attribute | Tolerance (match counts toward 60% threshold) | Source |
|---|---|---|
| `weight` | exact match | LC5 line 533 |
| `waterproof` | ±2 | LC5 line 534 (see §5.7) |
| `warmthRatio`, `breathability`, `windResist`, `moisture` | ±4 | LC5 line 535 (see §5.7) |

Item is a relaxed peer if `matchCount / knownAttributes.length >= 0.6` (LC5 line 537, see §5.7).

### 5.4 Null fallback (when relaxed still yields <3 peers)

Missing attributes stay `null`. Item retains its reduced-confidence tier. Display layer handles visibility. Minimum peer count of 3 is required for imputation (LC5 line 542, see §5.7).

### 5.5 Imputation formulas (CORRECTING LC5 drift)

LC5's `risk_functions.js` line 549–550 uses **mean** for numeric attributes:
```javascript
if(vals.length)imputed[a]=Math.round((vals.reduce((s,v)=>s+v,0)/vals.length)*10)/10;
```

The LC5 documentation spec (TA, CM Overview, 2026-03-01 sources) calls for **median** — "never mean, to resist outlier distortion."

**PHY-GEAR-01 uses median, matching documented spec:**

```typescript
function medianOf(vals: number[]): number {
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const result = sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
  return Math.round(result * 10) / 10;
}
```

For `weight` (string enum), use **mode** (most frequent peer value). Matches LC5 behavior.

### 5.6 Algorithm reference — pseudocode

```
for each item in items:
  missing = IMPUTABLE filter (item[attr] is null)
  if missing.length == 0:
    set item.specConfidence = 6
    continue

  known = IMPUTABLE filter (item[attr] is not null)
  strictPeers = completeItems.filter(strict match on all known attrs AND 40% temp overlap)

  if strictPeers.length >= 3:
    for each missingAttr:
      if missingAttr === 'weight': item[missingAttr] = mode(strictPeers)
      else: item[missingAttr] = median(strictPeers)
  else:
    relaxedPeers = completeItems.filter(60% match on all known attrs, loose tolerances)
    if relaxedPeers.length >= 3:
      for each missingAttr:
        if missingAttr === 'weight': item[missingAttr] = mode(relaxedPeers)
        else: item[missingAttr] = median(relaxedPeers)
    else:
      // keep missing as null; item stays in reduced-confidence tier

  set item.specConfidence = IMPUTABLE.length - missing.length  // original confirmed count
  set item._imputed = list of attrs that were filled
```

**Minimum peer count is 3.** Below that, imputation is unreliable and we prefer the honest "incomplete" signal to a false estimate.

**Confidence tier uses ORIGINAL confirmed count, not post-imputation count.** An item imputed from 4/6 attributes is still a 4/6 item for display purposes (reduced tier, orange badge). Imputation fills values for the engine; the confidence tier reflects provenance.

### 5.7 Calibration Constants Honesty Ledger

The peer-matching algorithm uses tuning parameters that govern how aggressively the heuristic fills missing data. These are NOT physics constants describing the natural world. They govern a statistical heuristic for handling incomplete product specifications. They come from LC5 `risk_functions.js` as the authoritative reference, but they are not derived from published research.

Per Working Agreement v3 Cardinal Rule #1, they are flagged here as product-design decisions, not physics:

| Constant | Value | Used in | LC5 source | Status |
|---|---|---|---|---|
| Strict-match numeric tolerance | ±2.5 | §5.2 | line 524 | GAP — not physics-derived |
| Strict-match waterproof tolerance | ±1 | §5.2 | line 523 | GAP — not physics-derived |
| Temperature overlap requirement | 40% | §5.2 | line 526 | GAP — not physics-derived |
| Relaxed-match numeric tolerance | ±4 | §5.3 | line 535 | GAP — not physics-derived |
| Relaxed-match waterproof tolerance | ±2 | §5.3 | line 534 | GAP — not physics-derived |
| Relaxed-match agreement threshold | 60% | §5.3 | line 537 | GAP — not physics-derived |
| Minimum peer count | 3 | §5.4 | line 542 + TA documentation | GAP — rationale documented, specific value not derived |
| `warmthRatio → CLO` piecewise breakpoints/slopes | 5, 7, 0.06, 0.10, 0.17 | §3.2 | adapter.ts current | GAP — endpoints plausible, interpolation not derived |
| `breathability → im` linear slope/offset | 0.05, 0.40 | §3.3 | adapter.ts current | GAP — endpoints ISO 9920-consistent, interpolation not derived |

**Why these are not Cardinal Rule #1 violations in spirit:** the peer-matching constants govern a data-imputation safety net, not physics. Imputation operates on items that already lack complete specifications — the alternative is either "exclude the item" or "use category midpoint," both of which are worse than a peer-based estimate. There is no "correct" value of 60%; it is a tradeoff knob. Tighten it (80%) → fewer peers, higher-quality matches; loosen (40%) → more peers, noisier imputation.

**Why they are still flagged:** the spirit of Cardinal Rule #1 is that every number in the codebase should be traceable. These come from LC5 as the reference, but LC5's values themselves aren't traced. The chain ends in "the LC5 author picked these." Honesty requires flagging that chain.

**Future work specs** (all low priority):
- **PHY-GEAR-PEER-CAL** — Derive the seven peer-matching constants empirically. Withhold attributes from fully-specified items in the catalog, run imputation, measure RMSE of predicted vs. withheld values, tune for minimum error. Build a validation harness that reports imputation accuracy as a diagnostic.
- **PHY-GEAR-WARMTH-CAL** — Derive `warmthRatio → CLO` mapping empirically via thermal manikin testing per ISO 15831 on representative products in each warmthRatio tier.
- **PHY-GEAR-BREATH-CAL** — Derive `breathability → im` mapping empirically via Woodcock/Fukazawa measurements on representative products.

Low priority because the current values have produced acceptable results in LC5 across ~1,627 products with no reported incidents, and because deriving them requires significant tooling work relative to the marginal benefit.

---

## 6. Activity-exclusive brand filter

Port from LC5 `risk_functions.js` line 508:

```typescript
const ACTIVITY_EXCLUSIVE: Record<string, string[]> = {
  fishing: ["simms"],
};
```

When filtering the catalog for an activity, any brand listed under a DIFFERENT activity's exclusive list is removed. So for activity `hiking`, Simms products are removed (they are fishing-exclusive). For activity `fishing`, Simms products are kept.

**Rationale:** Simms makes 585 fishing-tagged products in gear.js. Without this filter, a Simms SolarFlex Hoody with `fit.fishing: 10` could still appear as a hiking option if its `fit.hiking` were even marginally populated. The brand positioning and product design semantics ("fishing shirt") make this contextually wrong.

**Extensibility:** this is a data table, not hardcoded logic. Future exclusions (e.g. `{ cycling: ["rapha"], skiing: ["norrøna"] }` if a specific positioning needs it) are additions to this table.

**Case sensitivity:** brand comparison is lowercase-normalized on both sides.

---

## 7. Activity aliasing

Adapter-level alias table to reconcile the 7 adversarial matrix activity IDs against the 20 gear.js `fit` keys:

```typescript
const ACTIVITY_ALIAS: Record<string, string> = {
  day_hike: "hiking",      // adversarial matrix uses "day_hike"; gear.js uses "hiking"
  cycling:  "road_cycling", // UNIVERSAL_GEAR_DB used bare "cycling"; gear.js uses "road_cycling"
};

function resolveActivity(activity: string): string {
  return ACTIVITY_ALIAS[activity] ?? activity;
}
```

Used inside `convertGearDB` when the `activity` filter option is provided — the alias is applied before the `fit[activity]` lookup.

**Why at the adapter, not in scenario definitions:** the adversarial matrix authors write scenarios in their natural language; alias lives at the data-boundary layer. This is the LC4-era conclusion from the Session 2 Cooper Landing taxonomy debate — normalize at data ingress.

---

## 8. Public API changes

### 8.1 `adapter.ts` exports

```typescript
// Unchanged exports (public API preserved)
export { convertGearDB, catalogSummary } from './adapter.js';
export type { RawGearItem, RawGearDB } from './adapter.js';

// NEW exports (additive)
export type { GearSubslot, RawGearSleepItem, RawGearImmersionItem } from './adapter.js';
export { inferFiber } from './adapter.js';       // for test access
export { imputeAttributes } from './adapter.js'; // for test access
```

### 8.2 Expanded `RawGearDB` type

```typescript
export interface RawGearDB {
  upper?: {
    base_layer?: RawGearItem[];
    mid_layer?: RawGearItem[];
    insulation?: RawGearItem[];    // NEW
    shell?: RawGearItem[];
  };
  lower?: {
    base_layer?: RawGearItem[];
    pants?: RawGearItem[];         // NEW
    insulation?: RawGearItem[];    // NEW (currently empty in gear.js)
    ski_pants?: RawGearItem[];     // NEW
    shell_pants?: RawGearItem[];   // NEW
    bike?: RawGearItem[];          // NEW
  };
  drysuit?: RawGearImmersionItem[];  // NEW — routed to immersion slot
  wetsuit?: RawGearImmersionItem[];  // NEW — routed to immersion slot
  footwear?: RawGearItem[];
  headgear?: RawGearItem[];
  handwear?: RawGearItem[];
  gear?: RawGearItem[];              // NEW (input-only; filtered out by adapter)
  sleeping_bags?: RawGearSleepItem[]; // NEW (separate type)
  sleeping_pads?: RawGearSleepItem[]; // NEW
}
```

All fields are optional, including the nested ones — this allows partial DBs (like the embedded test catalogs) to remain structurally valid.

### 8.3 `RawGearSleepItem`

```typescript
export interface RawGearSleepItem extends RawGearItem {
  // Sleeping bag fields
  comfortRating?: number;
  lowerLimit?: number;
  fillPower?: number;
  fillType?: "down" | "synthetic";

  // Sleeping pad fields
  rValue?: number;
  padType?: "inflatable" | "closed-cell foam" | "self-inflating";
  packSize?: string;
}
```

### 8.4 `RawGearImmersionItem`

```typescript
export interface RawGearImmersionItem extends RawGearItem {
  thickness?: string;     // "4/3mm", "5mm", etc.
  features?: string;      // preserved descriptive text
  // 6 IMPUTABLE attrs preserved if present but adapter does NOT impute
}
```

### 8.5 `convertGearDB` signature (unchanged)

```typescript
export function convertGearDB(
  db: RawGearDB,
  options?: {
    activity?: string;
    minFitScore?: number;
    sex?: string;
  },
): EngineGearItem[];
```

Input options are preserved. Output is the flat `EngineGearItem[]` as before, with correctly-routed slots, subslots, fibers, and imputed attributes. Existing callers (`diagnostic.test.ts`, `real_gear.test.ts`, `adversarial_matrix.test.ts`) continue to work without modification.

---

## 9. Test plan

### 9.1 New test file

`packages/engine/tests/gear/gearjs_adapter.test.ts`

### 9.2 Fixtures

- **Full real gear.js** — loaded as `import { G } from '.../reference/lc5_gear.js'` (or equivalent path from repo). Single source of truth for 1,627-product tests.
- **Synthetic minimal DB** — 10-item hand-authored fixture covering one of each slot. Used for unit tests where the full DB is overkill.
- **Under-specified item set** — 5 hand-authored items with deliberately-missing attributes (0–5 of 6 populated) to exercise the confidence tier and imputation paths.

### 9.3 Required assertions

**Structural coverage:**
- Converting full gear.js produces between 1,450 and 1,550 EngineGearItems (1,627 minus `gear` accessories minus any excluded tier items minus immersion items filtered by enumerator; exact count is a diagnostic, not an exact-match assertion — log it and verify it's in range).
- Each of the 11 non-immersion engine slots has ≥1 item after conversion (immersion slot populated but excluded from enumeration).
- Each of the 19 subslots (except `lower_insulative` which is currently empty, and `immersion_wader` which is future) has ≥1 item.

**Per-activity coverage for the 8 matrix activities:**
- For each of {`skiing`, `snowboarding`, `day_hike` (→ `hiking`), `cross_country_ski`, `snowshoeing`, `fishing`, `road_cycling` (and `cycling` alias), `running`, `golf`}:
  - Call `convertGearDB(G, { activity, minFitScore: 5 })`.
  - Assert each of the 8 cold-weather required slots has ≥1 item (for cold-regime activities).
  - Assert each of the 3 warm-weather required slots has ≥1 item (for warm-regime activities).
- Failure here means an adversarial matrix scenario can't enumerate; fix by adjusting alias table or flagging gear.js coverage gap.

**Fiber inference:**
- Smartwool Merino 250 Base Layer → `fiber: "wool"`
- Patagonia Capilene Cool Merino → `fiber: "wool"` (merino precedence over "Capilene" synthetic marker)
- Patagonia Nano Puff Hoody → `fiber: "synthetic"` (PrimaLoft synthetic marker)
- Arc'teryx Cerium LT Hoody → `fiber: "down"` (Cerium is a down line; matched via description)
- Western Mountaineering UltraLite 20 sleeping bag → `fiber: "down"` (via `fillType: "down"`)
- Fiber distribution across full catalog: wool >100 items, down >50 items, synthetic >1,200 items, cotton rare. Log and sanity-check.

**Activity-exclusive brand filter:**
- `convertGearDB(G, { activity: "hiking" })` contains zero Simms products.
- `convertGearDB(G, { activity: "fishing" })` contains Simms products.

**Activity aliasing:**
- `convertGearDB(G, { activity: "day_hike" })` returns the same products as `activity: "hiking"`.
- `convertGearDB(G, { activity: "cycling" })` returns the same products as `activity: "road_cycling"`.

**Confidence tiering:**
- Item with 6/6 IMPUTABLE populated → `spec_confidence: 6`.
- Item with 4/6 populated → `spec_confidence: 4` after imputation fills missing (if peers exist); item stays in reduced tier.
- Item with 2/6 populated → `spec_confidence: 2`, item excluded from output (does not appear in returned array).
- Scraped item with `_confidence: 5` (from score_products.js) → preserved as `spec_confidence: 5`.
- Immersion item → `spec_confidence: 0`.
- Duplicate-demotion: 3+ items with identical slot+subslot+scored-attributes → all demoted to `spec_confidence: 5`.

**Peer imputation:**
- Under-specified item with exactly 4/6 populated, in a category with ≥3 strict-match peers → missing 2 attributes filled with median of strict peers.
- Under-specified item with 4/6 populated, 0 strict peers, ≥3 relaxed peers → missing 2 attributes filled from relaxed peers.
- Under-specified item with 4/6 populated, 0 strict + 0 relaxed peers → missing attributes stay null, item stays in reduced tier.
- Item with 6/6 attributes but in a category with <3 complete items → `applyConfidenceTiers = false`, item passes through without imputation activity.
- Median correctness: 5 peers with warmthRatio values [3, 5, 5, 7, 9] → median 5 (not mean 5.8). Critical test against LC5 mean-drift.
- Mode correctness for weight: 5 peers with weight values ["light", "light", "mid", "ultralight", "light"] → mode "light".

**Waterproof clamping:**
- footwear item with `waterproof: 8` → `waterproof: 3` on output.
- shell item with `waterproof: 3` → `waterproof: 3` passthrough.

**Sleep system:**
- `convertGearDB(G)` produces sleeping_bag and sleeping_pad items.
- Therm-a-Rest NeoAir XTherm NXT (rValue: 7.3) → `r_value: 7.3`, `spec_confidence: 8`.
- Western Mountaineering UltraLite 20 → `comfort_rating_f: 20`, `lower_limit_f: 10`, `fill_power: 850`, `fiber: "down"`, `spec_confidence: 8`.
- Sleeping bag with only `comfortRating` and no `lowerLimit` → `spec_confidence: 5`.

**Immersion gear:**
- `convertGearDB(G)` produces ~30 immersion items (drysuits + wetsuits from gear.js).
- Kokatat Meridian Drysuit → `slot: "immersion"`, `subslot: "immersion_drysuit"`, `spec_confidence: 0`, `thickness_mm` undefined (drysuits don't have thickness).
- NRS Radiant 4/3mm Wetsuit → `slot: "immersion"`, `subslot: "immersion_wetsuit"`, `thickness_mm: "4/3mm"`, `spec_confidence: 0`.
- `enumerateCandidates` excludes immersion items from all candidate ensembles (zero immersion items in any returned ensemble.items array).

**Integration with adversarial matrix:**
- Replace `UNIVERSAL_GEAR_DB` in `adversarial_matrix.test.ts` with `convertGearDB(G, {...})` approach using real gear.js.
- Re-run matrix: all 19 scenarios produce peak metrics (no "NO CANDIDATES ENUMERATED").
- Previously-working 12 scenarios (C1, C2, C4, H3, H5, E1–E5, E7) continue to produce sensible values — specifically, the E2 Breck baseline MR stays in 2.0–3.0 range (regression guard against PHY-071 drift).

**Full suite green:**
- After all PHY-GEAR-01 changes: `npx vitest run` reports all tests passing, count ≥597 (new gear tests add rows, no regressions).

---

## 10. Out of scope for this spec

Explicitly NOT in PHY-GEAR-01:

- Any change to `calcIntermittentMoisture`, `calcEnsembleIm`, `scoreGear`, `quickRisk`, `heatLossRisk`, or any other Cardinal Rule #8 locked function.
- Any change to EngineOutput fields beyond the `GearSlot` union expansion (§11 Architecture Amendment).
- Regional MR reconciliation (upper vs lower body moisture). Captured as OQ-REGIONAL-MR; belongs to a separate spec and session (see §13).
- Immersion gear physics. Captured as PHY-IMMERSION-01; separate spec (see §13).
- Calibration constant derivation (peer-matching, warmth→CLO, breathability→im). Three separate PHY-GEAR-*-CAL future specs (see §5.7 and §13).
- UI / infographic implementation. PHY-INFOGRAPHIC-01 is a separate future spec that will consume the subslot metadata introduced here.
- Data curation: moving misclassified gear.js products into the new `lower.insulation` bucket. Manual task, not adapter concern.
- Extending score_products.js to classify `lower.insulation` at scrape time. Captured as PHY-GEAR-02; separate spec.
- Sleep overlay physics (`overlays/sleep_system.ts` consumption logic). The adapter produces the inputs; overlay consumes them. Overlay already exists per Architecture v1.1 §2.
- Layer 2 pacing, PHY-042 solar, H3 humid running investigation, any other open PHY items.

---

## 11. Architecture Document amendment

This spec requires a formal v1.1 → v1.2 amendment of the LC6 Architecture Document per Working Agreement v3 Rule #16.

**Proposed amendment text** (to be appended to Architecture Document when PHY-GEAR-01 is ratified):

> ### v1.2 changes (Session 11, PHY-GEAR-01)
>
> `GearSlot` union expanded from 9 to 12 members. Added: `sleeping_bag`, `sleeping_pad`, `immersion`. Additive change — no existing consumer is broken.
>
> **Rationale for `sleeping_bag` / `sleeping_pad`:** sleep system products are a distinct thermal class from clothing, with their own attribute set (R-value, comfort rating, lower limit) that doesn't map onto the 6-attribute clothing confidence tier system. Prior to v1.2, these products were not routable through the gear adapter.
>
> **Rationale for `immersion`:** drysuits and wetsuits require split-body physics (upper-body ensemble / lower-body material-property table lookup per Tikuisis 1997 and ISO 15027) that is fundamentally different from clothing ensemble physics. Routing them to `shell` would silently misroute. The dedicated slot captures them for eventual PHY-IMMERSION-01 physics while keeping the clothing enumerator clean. Session 11 captures immersion items inert (excluded from enumeration). PHY-IMMERSION-01 activates them.
>
> `EngineGearItem` gains five optional fields: `comfort_rating_f`, `lower_limit_f`, `fill_power`, `r_value` (populated only for sleep slots), `thickness_mm` (populated only for immersion slot).
>
> `EngineGearItem` gains one optional metadata field: `subslot: GearSubslot` (19-value enum). Does not influence physics; used by UI, diagnostics, and the forthcoming infographic.
>
> `enumerateCandidates` gains a filter that excludes items with `slot: "immersion"` from clothing ensemble enumeration. Zero impact on existing 12/19 adversarial matrix scenarios (none are water immersion).
>
> No changes to EngineOutput. No changes to thermal engine functions.

This amendment is additive across the contract surface. Existing TypeScript consumers compile unchanged; runtime behavior is unchanged for existing slots.

---

## 12. Ratification call

Per Working Agreement v3 §4:

- **Ratified** — Chat produces the surgical script for Code to apply verbatim. Expected deliverables: amended `types.ts`, amended `adapter.ts`, updated `enumerate.ts` (one-line immersion filter), new `gearjs_adapter.test.ts`, updated `adversarial_matrix.test.ts` to consume real gear.js, Architecture Document v1.1 → v1.2 amendment.
- **Ratified with changes** — list changes; Chat applies, bumps to DRAFT v3.
- **More questions** — enumerate.
- **Reject** — return to drawing board.

---

## 13. Open issues raised by this spec

### OQ-REGIONAL-MR — Upper vs lower body MR reconciliation

**Scope:** Separate session. Not PHY-GEAR-01.

LC5 and LC6 engines compute CLO and im as whole-body values (BSA-weighted harmonic means) but moisture accumulates regionally. When upper MR differs materially from lower MR (common case: 4/2 ski kit where upper torso soaks through while legs stay dry), which number does the product surface?

Current EngineOutput emits a single `peak_MR` (Architecture v1.1 §4.3, §4.5).

Three candidate resolutions:
- **Max of regions:** `display_MR = max(MR_upper, MR_lower)`. Conservative, actionable, loses information.
- **BSA-weighted blend:** averages regional MRs weighted by body surface. Masks regional failures. Not recommended.
- **Regional pair as first-class:** EngineOutput emits `peak_MR_upper` and `peak_MR_lower`; each surface decides how to consume. Most information, most complexity, most honest.

Ratification of the regional-pair option would require: EngineOutput contract amendment (Rule #16 formal change), Architecture Document v1.2 → v1.3, TA/ATP updates (v9 sync convention per Rule #18), PHY-070c winner hierarchy review (currently argmin on scalar peak MR), PHY-072 CM trigger review (currently MR_cascade fires on scalar MR), CDI v1.4 input review (MR is a scalar input to CDI composition math), Goldilocks calibration schema review, and `calcIntermittentMoisture` review (does LC6's current implementation actually track upper/lower separately, or is the regional split aggregated before output?).

Infographic design (PHY-INFOGRAPHIC-01 when it lands) depends on this being resolved first.

**Status:** Open. Raised Session 11 during PHY-GEAR-01 design. Captured in this spec and to be added to `LC6_Open_Issues_Ledger.md` upon spec ratification.

### PHY-IMMERSION-01 — Immersion gear physics port

**Scope:** Separate session. Cardinal Rule #8 work (thermal engine).

Port LC5 `risk_functions.js` lines 904–960 and 1270–1310: `WADER_DATA`, `WETSUIT_DATA`, `IMMERSION_SHIELD` tables; `waderSplitIm`, `waderSplitCLO` functions; `fishWading` activity flag; split-body 45/55 BSA model; cold-shock shielding factors.

Activates the `immersion` slot for enumeration and physics. Enables scenarios: kayaking in cold water, fishing while wading, paddleboarding with a wetsuit.

Dependencies: hand-computed verification against LC5 reference scenarios per Cardinal Rule #9 (thermal engine locked).

**Status:** Open. Raised Session 11.

### PHY-GEAR-PEER-CAL — Peer imputation constant derivation

See §5.7. Low priority. Separate session.

### PHY-GEAR-WARMTH-CAL — warmthRatio → CLO empirical derivation

See §3.2 and §5.7. Low priority. Separate session.

### PHY-GEAR-BREATH-CAL — breathability → im empirical derivation

See §3.3 and §5.7. Low priority. Separate session.

### PHY-GEAR-02 — score_products.js lower.insulation classification

Extend `score_products.js classifySubcategory` to emit `lower.insulation` for products matching insulated-pants patterns. Currently the scraper has no lower-body insulation sub-classification. Low priority; the `lower.insulation` bucket works as an empty landing slot for manual curation until scrapes start populating it.

### PHY-GEAR-03 — Data curation sweep

Sweep existing gear.js for misclassified products: any TNF Freedom Insulated or Helly Hansen Legendary Insulated that belongs in `lower.insulation` rather than `lower.ski_pants`, wader products currently in `gear` bucket that should move to a dedicated wader bucket with thermal attributes, etc. Manual editorial task.

---

## Document status

**Version:** DRAFT v2
**Session:** 11 (2026-04-17)
**Supersedes:** DRAFT v1 (amendments A, B, C folded in)
**Dependencies:** Working Agreement v3, Architecture Document v1.1 RATIFIED, LC5 risk_functions.js (authoritative peer imputation and immersion physics reference)
**Awaits:** Christian ratification
**Unblocks upon ratification:** Code session to apply surgical script; adversarial matrix 12/19 → 19/19
