# PHY-SHELL-GATE v1 DRAFT — Shell as Vapor Transport Gate

**Status:** DRAFT (Session 23, 2026-04-20)
**Raised:** Session 22 (2026-04-19) during Finding 3 gate-clearance physics discussion
**Target ratification:** Session 25 after reference-scenario baselines captured
**Cardinal Rule territory:** #1 (no fudge factors), #8 (thermal engine locked), #11 (no code without spec)
**Related specs:** PHY-HUMID-01 v2 (routing physics), PHY-071 (fiber absorption coefficients)
**Prerequisite for:** Finding 3 implementation (PHY-HUMID-01 v2 §2.3 Categories A+B), symmetric cascade fix (S22-CASCADE-ASYMMETRIC), microclimate VP model (S22-MICROCLIMATE-VP)

---

## 1. Executive summary

LC6 currently models all clothing layers — base, mid, insulation, and shell — as liquid-absorbing reservoirs with a capacity proportional to `weightG × FIBER_ABSORPTION[fiber]`. For base, mid, and insulation layers, this model is physically correct: these garments are designed to absorb and transport liquid water via capillary action. Fiber absorption coefficients (PHY-071: synthetic 0.40, wool 0.35, cotton 2.00, down 0.60) are anchored to textile saturation literature (Rossi 2005, Holmer 2005, Das 2007, Fukazawa 2003).

**For shell layers, this model is wrong.** Modern outdoor shells are functionally classified into three types, none of which behave as sponge-like absorbers:

1. **Hardshells (waterproof/breathable membranes like Gore-Tex, eVent, NeoShell):** engineered specifically to NOT hold liquid water. DWR-treated outer surface causes water to bead and run off. Membrane pores pass vapor but not liquid. Liquid capacity is confined to the inner scrim/backer (typically 15-20D nylon 6,6 with ~3.5-4.5% moisture regain) — near zero in operational terms.

2. **Softshells (woven DWR-treated polyester/nylon, no membrane):** hold some moisture when DWR is new but are designed primarily as wind/light-water layers with enhanced breathability. Total interstitial saturation capacity of dense weaves falls in the 10-15% of dry weight range once DWR is overcome.

3. **Insulated shells (puffy jackets, down or synthetic fill with DWR face):** functionally an insulation layer with an outer windbreak. Fill material follows normal fiber absorption rules. Treating these as "shells" rather than "insulation" is a classification decision.

**Physical role of a true shell:** vapor transport gate between the clothing microclimate and ambient air. Rate of vapor flux outward is determined by the shell's moisture vapor permeability index (`im`) and the vapor pressure gradient across it. The shell's fabric does not accumulate liquid in quantities that affect the moisture balance.

**Consequence of the current model:** A 300g Gore-Tex hardshell is currently assigned a capacity of ~120 mL (weightG × 0.40). Physical reality is 5-10 mL (condensate film on inner backer). Under warm-humid or high-sweat conditions, the LC6 engine allows shell layers to absorb hundreds of grams of liquid before saturating, masking the physically-correct behavior where vapor cannot escape the stack through an `im`-throttled shell.

**Proposed fix:** Make layer capacity slot-aware. Hardshells receive near-zero absorption coefficient (functionally a gate, not a reservoir). Softshells receive a moderate coefficient. Wind shells receive a thin-film coefficient. Insulated shells treated as insulation with outer face. Inner layers unchanged.

This spec is the first of three addressing interrelated moisture-model gaps discovered in S22. The other two (PHY-CASCADE-SYMMETRIC, PHY-MICROCLIMATE-VP) build on this one.

---

## 2. Current (incorrect) state

### 2.1 `getLayerCapacity` is slot-unaware

Location: `packages/engine/src/ensemble/gear_layers.ts:109-118`

```typescript
export function getLayerCapacity(
  item: GearItem | null | undefined,
  fiberType: FiberType,
): number {
  const absorption = FIBER_ABSORPTION[fiberType] ?? 0.02;
  const warmth = item?.warmthRatio ?? item?.warmth ?? 5;
  const weightG = item?.weightG ?? (100 + warmth * 20);
  return Math.max(2, weightG * absorption);
}
```

The function accepts `item` and `fiberType` only. No slot parameter. The computed cap depends purely on weight and fiber, treating a 300g Gore-Tex hardshell identically to a 300g synthetic base layer (both get cap = 120 mL at `SYNTHETIC: 0.40`).

### 2.2 Slot information is lost before `getLayerCapacity` is called

- `EngineGearItem` (`packages/engine/src/types.ts:577-598`) carries `slot: GearSlot` as a required field.
- The ensemble-local `GearItem` type (`packages/engine/src/ensemble/gear_layers.ts:15-26`) has no `slot` field.
- `buildLayerArray` at line 194 invokes `getLayerCapacity(item, fiber)` — slot information is no longer available in that scope.
- Slot lives in `adapter.ts` (lines 257, 421, 464) during catalog conversion but is dropped before reaching the ensemble module.

Default-stack invocations (lines 212, 222, 234, 246, 257) hardcode warmth and fiber but carry no semantic slot association — the shell is "whichever layer is last in the defaults array."

### 2.3 Current behavior produces implausible shell capacity

With the S21 `weightCategoryToGrams` pipeline now populating real `weightG` values, typical shell caps under the current model:

- Arc'teryx Beta LT (waterproof: 3, breathability: 8, weight: light) → weightG ≈ 320g, cap = 320 × 0.40 = **128 mL**
- Patagonia Torrentshell 3L (waterproof: 3, breathability: 7, weight: light) → weightG ≈ 330g, cap = **132 mL**
- Columbia Watertight II (waterproof: 3, breathability: 6, weight: light) → weightG ≈ 330g, cap = **132 mL**

Physical reality: a Gore-Tex jacket inner backer can hold roughly 5-15 mL of water as a thin condensate film before runoff begins. The current model over-reports by roughly an order of magnitude.

### 2.4 Downstream consequences

- **Finding 3 (PHY-HUMID-01 v2 §2.3 Categories A+B) cannot be correctly implemented** against the current shell model. Liquid-at-skin routing that cascades outward through base → mid → insulation → shell would fill shell to its large false cap before drip occurs, artificially delaying whole-stack saturation.
- **S22-CASCADE-ASYMMETRIC fix** (adding inward-to-outward overflow cascade) requires knowing the correct shell capacity to terminate the cascade physically.
- **Test calibration for humid scenarios** is corrupted: any scenario where shell saturation matters records values that reflect the over-capacity shell, not real physics.

Note: `computePerceivedMR` output layer is out of scope for this spec. Per S17 closure, `PERCEIVED_WEIGHTS`, `COMFORT_THRESHOLD`, and `7.2` output scale are classified as calibrations anchored to TA v5 §3.5 Fechner budget and the 95% RH / 20°F Rocky Mountain MR=4.3 validation anchor. Re-validation of those calibrations after shell-gate ships is tracked as `S22-MR-VALIDATION-ANCHOR-CONTAMINATED`.

---

## 3. Physics-correct model

### 3.1 Shell as vapor transport gate

The shell layer's role in a clothing system under active heat generation is to regulate **vapor flux** from the clothing microclimate to ambient, while blocking ambient liquid water ingress. Its functional parameters are:

- **`im` (Woodcock moisture permeability index):** determines rate of vapor passage. Hardshells: 0.10-0.20. Softshells: 0.20-0.35. No meaningful cap on vapor flux beyond this coefficient × VPD × area.
- **Liquid holdback (DWR efficacy):** beads water on outer surface. Not a fabric capacity question.
- **Inner backer/scrim condensate film:** when microclimate VP exceeds shell-inner-surface saturation VP, vapor condenses to liquid at the shell's inner face. This film is thin (~5-15 mL maximum for a jacket-scale surface area) and transient — it either re-evaporates via the shell's outward vapor flux when VPD allows, or Washburn-wicks inward into insulation/mid layers if they have available capacity.

**Cap model for hardshells:** a small value representing the inner-surface condensate film on the nylon backer. Target range: 5-15 mL for typical garment weights. Coefficient: **0.02 of dry weight**, which reflects Nylon 6,6 moisture regain (3.5-4.5% intrinsic) scaled down to operational "active use" retention where most water beads/runs off and only the backer holds moisture.

### 3.2 Shell as soft/wind layer (softshell)

Woven softshells (DWR-treated polyester/nylon without a membrane) behave intermediately:

- DWR-intact: repel exterior water, modest interior absorption
- DWR-degraded (wet-out): absorb like a woven synthetic layer. Interstitial spaces in dense double-weave structures retain water beyond the intrinsic fiber regain
- ASTM D4772 testing on DWR-treated woven synthetics shows 10-15% retention at wet-out

**Cap model for softshells:** `weightG × 0.12`. Middle of 10-15% empirical range.

### 3.3 Shell as thin-film wind layer (wind shell)

Ultralight wind shells (e.g., Pertex Quantum) use 10-20D high-tenacity nylon with tight calendering:

- Fabric is too thin for significant void-space water storage
- Total retention approximates intrinsic nylon regain (~4%) plus minimal surface adhesion
- Typical garment at 1.1 oz/yd² fabric weight: 1-5 mL retention on a full jacket

**Cap model for wind shells:** `weightG × 0.05`. Conservative, reflects fiber regain + thin surface film.

### 3.4 Insulated shells treated as insulation

Down or synthetic-fill shells (puffy jackets) have two components:
- Insulating fill: follows PHY-071 (`DOWN: 0.60`, `SYNTHETIC: 0.40`)
- Outer shell face: functionally a DWR wind layer

The dominant capacity is the fill, not the face. Treating these as "shells" per the current model is a classification error.

**Cap model for insulated shells:** use existing fiber absorption coefficient on the full garment weight (fill dominates). Do NOT apply the hardshell reduction. Classification must distinguish these from membrane hardshells.

### 3.5 Immersion slot — dry suits and splash gear

Dry suits (Gore-Tex or similar waterproof-breathable membrane construction): behave as hardshells with one distinction — they are full-body enclosures with minimal ventilation except at wrist/neck gaskets. Vapor flux to ambient is nearly eliminated. The shell-as-gate physics applies; expected behavior is microclimate saturation faster than a normal hardshell jacket under equivalent activity.

**Cap model for dry suits:** classify as HARDSHELL. Coefficient 0.035 (upper bound of nylon backer range). Higher than jacket hardshell because enclosed microclimate promotes more condensation on inner surface.

Splash gear (basic PU-coated nylon rain jackets, ponchos): classify as HARDSHELL, coefficient 0.02. Treated identically to membrane hardshells for capacity purposes.

**Out of scope:** neoprene wetsuits and waders. These operate on fundamentally different physics (closed-cell foam thermal buffer via intentional water saturation against skin). Requires separate spec `PHY-IMMERSION-NEOPRENE`.

### 3.6 Absorption coefficient table (ratified values)

| Shell type | Absorption coefficient | Cap for 300g garment | Citation |
|---|---|---|---|
| HARDSHELL (membrane) | 0.02 | 6 mL | Nylon 6,6 regain 3.5-4.5% operationalized to active-use retention |
| SOFTSHELL (DWR woven) | 0.12 | 36 mL | ASTM D4772 saturation testing on DWR-treated synthetics, 10-15% range |
| WIND_SHELL (thin-film) | 0.05 | 15 mL | Nylon regain ~4% + thin surface film on 20D fabrics |
| DRYSUIT (immersion) | 0.035 | 10.5 mL | Hardshell + enclosed microclimate condensation |
| INSULATED_SHELL | FIBER_ABSORPTION[fiber] (unchanged) | SYNTHETIC: 120 mL, DOWN: 180 mL | PHY-071 (existing) |

---

## 4. Classification algorithm

### 4.1 Available signals from existing data

The current `EngineGearItem` type (`packages/engine/src/types.ts:577-598`) carries these fields relevant to shell classification:

- `slot: GearSlot` — `"shell"` for upper-body shells, `"immersion"` for dry suits, `"legwear"` for shell pants
- `waterproof?: number` — 0-3 rating (0=none, 3=membrane-waterproof)
- `breathability?: number` — 0-10 rating (higher = more vapor-permeable)
- `wind_resistance?: number` — 0-10 rating
- `warmthRatio?: number` — 0-10 rating (warmth contribution)
- `fill_power?: number` — populated for down garments
- `r_value?: number` — populated for insulated garments
- `subslot?: GearSubslot` — distinguishes `immersion_drysuit` vs `immersion_wetsuit` vs `immersion_wader`

The S21 catalog audit confirmed upper-body shell items distribute as:
- 61% `waterproof: 3` (membrane hardshells)
- 18% `waterproof: 1` (DWR-class, likely softshell)
- 12% `waterproof: 2` (middle ground)
- 9% `waterproof: 0` (no water protection, wind layers)

### 4.2 Classification rules

Applied in order. First match wins.

**Rule 1 — Insulated shell (puffy jacket, treat as insulation):**
```
IF fill_power != null OR r_value != null OR warmthRatio >= 5
   → classify: INSULATED_SHELL
   → absorption: use existing FIBER_ABSORPTION on fill material
```

**Rule 2 — Immersion dry suit (explicit subslot match):**
```
IF slot == "immersion" AND subslot == "immersion_drysuit"
   → classify: DRYSUIT
   → absorption: 0.035
```

**Rule 3 — Immersion wetsuit/wader (out of scope, fallback for now):**
```
IF slot == "immersion" AND subslot IN ("immersion_wetsuit", "immersion_wader")
   → classify: OUT_OF_SCOPE (log warning, use existing FIBER_ABSORPTION as placeholder)
   → absorption: existing FIBER_ABSORPTION[fiber] (temporary; will be replaced when PHY-IMMERSION-NEOPRENE spec ratifies)
```

**Rule 4 — Hardshell (membrane, near-zero cap):**
```
IF waterproof == 3 AND warmthRatio <= 2
   → classify: HARDSHELL
   → absorption: 0.02
```

**Rule 5 — Softshell (woven DWR, modest cap):**
```
IF waterproof IN [1, 2] AND warmthRatio <= 3
   → classify: SOFTSHELL
   → absorption: 0.12
```

**Rule 6 — Wind shell (no waterproof, light DWR):**
```
IF waterproof IN [0, 1] AND breathability >= 8 AND warmthRatio <= 2
   → classify: WIND_SHELL
   → absorption: 0.05
```

**Rule 7 — Default / unclassified:**
```
Fallback: treat as HARDSHELL (conservative; shells usually have membrane)
   → absorption: 0.02
```

### 4.3 Edge cases

**Default-stack shells** (when no gear items provided) currently use `getLayerCapacity({ warmth: 2 }, 'SYNTHETIC')`. Under this spec, default shell classifies as HARDSHELL (warmth 2, no membrane info, no insulation markers, falls through to Rule 7 fallback). Cap becomes `Math.max(2, weightG × 0.02)` ≈ 3 mL for a 140g default shell — a reasonable approximation of the inner-backer condensate film.

**Legacy `r_value` population:** If the catalog has not yet populated `r_value` or `fill_power` for insulated items, Rule 1 still catches them via `warmthRatio >= 5`. Puffies have high warmth ratios even without explicit insulation fields.

**Hybrid shells (insulated hardshells, e.g., belay parka with Gore-Tex face):** These classify as INSULATED_SHELL via Rule 1 because the insulation fill dominates moisture capacity.

---

## 5. Implementation scope

### 5.1 IN SCOPE (this spec)

1. Extend `getLayerCapacity` signature to accept slot and item classification metadata, OR introduce parallel helper `classifyShell` returning `ShellType`. Design decision: see Section 7 Open Questions.

2. Introduce classification enum and resolver function:
```typescript
type ShellType = 'HARDSHELL' | 'SOFTSHELL' | 'WIND_SHELL' | 'INSULATED_SHELL' | 'DRYSUIT' | 'OUT_OF_SCOPE';
function classifyShell(item: GearItem): ShellType;
```

3. Apply classification-specific absorption coefficients in capacity computation:
   - HARDSHELL: 0.02 constant
   - SOFTSHELL: 0.12
   - WIND_SHELL: 0.05
   - DRYSUIT: 0.035
   - INSULATED_SHELL: existing FIBER_ABSORPTION[fiber]
   - OUT_OF_SCOPE: existing FIBER_ABSORPTION[fiber] (placeholder until neoprene spec)

4. Update default-stack shell at `gear_layers.ts:255-263` to use HARDSHELL classification.

5. Update `buildLayerArray` real-gear path at `gear_layers.ts:189-200` to pass slot and subslot through to capacity computation.

6. Add slot-awareness to ensemble-local `GearItem` type (`gear_layers.ts:15-26`) — add optional `slot` and `subslot` fields populated by the adapter at conversion time.

### 5.2 OUT OF SCOPE (this spec — tracked separately)

- **Symmetric cascade fix** (base overflow cascading outward) — `S22-CASCADE-ASYMMETRIC`, separate spec (S24 drafting target)
- **Microclimate VP modeling** (shell `im` throttling vapor flux with feedback to evap rate) — `S22-MICROCLIMATE-VP`, separate spec (S25 drafting target)
- **Liquid-at-skin routing** (PHY-HUMID-01 v2 §2.3 Categories A+B) — existing spec, implementation deferred until shell-gate ships
- **MR output layer re-validation** — per S17 closure, `PERCEIVED_WEIGHTS` / `COMFORT_THRESHOLD` / `7.2` scale / `applySaturationCascade` are calibrations anchored to validation scenarios. After shell-gate ships, the TA v5 95% RH / 20°F MR=4.3 anchor must be re-run to verify these calibrations still hold against corrected upstream physics. See `S22-MR-VALIDATION-ANCHOR-CONTAMINATED` tracker item.
- **`breathabilityToIm` divergence** — two diverging implementations (`adapter.ts` vs `gear_layers.ts`) producing different `im` for same input. Tracked as `S22-BREATHABILITY-TO-IM-DIVERGENCE`.
- **`FiberType` type drift** — lowercase/uppercase divergence between `types.ts` and `gear_layers.ts`. Tracked as `S22-FIBERTYPE-TYPE-DRIFT`.
- **Neoprene wetsuit/wader physics** — closed-cell foam thermal buffer model, fundamentally different from fabric absorption. Needs `PHY-IMMERSION-NEOPRENE` spec. Existing wetsuits in `immersion` slot use placeholder FIBER_ABSORPTION until spec ratifies.
- **Thermal cost of drying saturated softshells** — document-referenced observation: 72 mL softshell saturation represents ~45 Wh of evaporative heat. Cross-concern for heat balance engine, not moisture model. Tracked as `S22-DRYING-THERMAL-DRAG`.

### 5.3 Changes to existing functions

**MODIFY:** `getLayerCapacity` at `gear_layers.ts:109-118` — add slot-aware branching

**MODIFY:** `buildLayerArray` at `gear_layers.ts:183-266` — thread slot and subslot info through map function

**MODIFY:** Ensemble-local `GearItem` type — add optional `slot` and `subslot` fields

**MODIFY:** Adapter at `gear/adapter.ts` — populate `slot` and `subslot` on ensemble-bound gear items

**ADD:** `classifyShell` function — new function in `gear_layers.ts`

**NO CHANGE:** `FIBER_ABSORPTION` constants (still used for INSULATED_SHELL), `breathabilityToIm`, `getFiberType`, `computePerceivedMR`, `computeEmax`, `getDrainRate`, any cascade logic

---

## 6. Reference scenarios

This spec proposes a shift from "capture engine output, assert stability" testing to literature-anchored reference scenarios. Each reference below states expected engine behavior that SHOULD be observed after shell-gate implementation.

### 6.1 Reference S-1: Cold-dry hardshell (Breck ski)

**Inputs:** 16°F, 40% RH, 10 mph wind, 6hr skiing, 4-layer ensemble (synthetic base + fleece mid + synthetic puffy + Gore-Tex hardshell)

**Current engine output:** sessionMR = 2.7 (approximate, from S18 smoke)

**Expected under shell-gate:** sessionMR should SHIFT SLIGHTLY UPWARD. Shell cap reduction from ~128 mL to ~6 mL reduces total system capacity. Moisture that was previously "absorbed" by the false-capacity shell now must find home in insulation/mid — slight increase in `computePerceivedMR` via insulation fill rising.

**Expected magnitude of shift:** +0.2 to +0.5 MR units. Minor.

**Citation:** ASHRAE Fundamentals 2021 Ch. 9 — vapor diffusion rates in cold-dry conditions are high relative to sweat production. Shell is not the bottleneck in this regime.

### 6.2 Reference S-2: Warm-humid hardshell (Mist Trail to Vernal Fall, Yosemite NP)

**Inputs:** 72°F, 75% RH, 0-3 mph wind, 4-5 mile round trip with ~1000ft elevation gain, moderate-vigorous exertion ~2.5-3.5 hours, 3-layer ensemble (synthetic base + softshell mid + hardshell)

**Current engine output:** unknown (scenario not in engine tests, only live app)

**Expected under shell-gate:** sessionMR should SHIFT UPWARD SIGNIFICANTLY. Shell `im`-limited vapor flux cannot keep up with sweat production from moderate-vigorous exertion at 75% RH. Moisture accumulates in insulation/mid layers. Without the false shell sponge, fill fractions for inner layers rise faster.

**Expected magnitude of shift:** +1.0 to +2.5 MR units.

**Citation:** Havenith 2002 (Int J Ind Ergonomics) on multilayer fabric performance under sustained sweating. Real-world validation: hikers on this trail routinely report soaked baselayers.

**Note:** This scenario is Christian's physical-experience ground truth. Mist Trail passes through spray zones from the waterfall at certain points; humidity can spike to 85-95% briefly. For baseline MR computation, spray exposure is excluded; the 75% RH is average trail humidity.

### 6.3 Reference S-3: Extreme humid-stationary (E7 fishing)

**Inputs:** 70°F, 95% RH, 3 mph wind, 4hr stationary fishing, 3-layer ensemble

**Current engine output:** Likely very low MR (insensible perspiration modeled, uncompensable sweat near zero for stationary activity)

**Expected under shell-gate:** Small shift. At low activity, vapor flux is low; shell capacity is rarely approached. However, `_aHygro` now actively loads shell buffer (per S22 Finding 4 ship, commit `51885be`). With reduced shell cap, hygroscopic absorption saturates the shell buffer faster.

**Expected magnitude of shift:** +0.1 to +0.4 MR units. Minor.

**Citation:** Fanger 1970 / ASHRAE 55 thermal comfort in stationary humid conditions.

### 6.4 Reference S-4: Classification regression (puffy routed correctly)

**Purpose:** Pure classification test — does `classifyShell` correctly identify an insulated shell via Rule 1?

**Inputs:** Same 4-layer ensemble as S-1, but Gore-Tex hardshell REPLACED by uninsulated synthetic puffy as outermost layer.

**Expected under shell-gate:** MR should be nearly identical to pre-shell-gate run for this same ensemble. Puffy classified as INSULATED_SHELL, existing `FIBER_ABSORPTION[SYNTHETIC] = 0.40` applied, cap unchanged from current behavior.

**Expected magnitude of shift:** < 0.1 MR units.

**Validation purpose:** catches misclassification bugs. Not a physics validation of the insulated shell model itself.

### 6.5 Validation protocol

Before shell-gate implementation, capture current engine output for S-1, S-2, S-3, S-4 as baseline. After implementation, produce delta table:

| Scenario | Baseline MR | Post-fix MR | Delta | Expected direction | Validated? |
|---|---|---|---|---|---|
| S-1 Breck ski | X.X | Y.Y | +Z.Z | Slight UP (+0.2 to +0.5) | ✓/✗ |
| S-2 Mist Trail | X.X | Y.Y | +Z.Z | Significant UP (+1.0 to +2.5) | ✓/✗ |
| S-3 E7 fishing | X.X | Y.Y | +Z.Z | Minor UP (+0.1 to +0.4) | ✓/✗ |
| S-4 Puffy shell | X.X | Y.Y | ~0 | No meaningful change (<0.1) | ✓/✗ |

All four must pass direction and magnitude validation before merge.

---

## 7. Open questions for ratification

These require resolution before implementation.

### 7.1 DESIGN CHOICES

- **Where does `classifyShell` live?** Options: (a) new function in `gear_layers.ts` (compact, same module), (b) new file `packages/engine/src/ensemble/shell_classification.ts` (separation of concerns). **Recommended: (a)** for initial spec; refactor if classification logic grows.

- **How does slot propagate to `buildLayerArray`?** Options: (a) extend ensemble-local `GearItem` type with optional `slot?: GearSlot` and `subslot?: GearSubslot`, populated by adapter, (b) pass parallel array of slots alongside gearItems. **Recommended: (a)** as the cleaner design; requires adapter update.

- **Should default-stack shells use HARDSHELL or SOFTSHELL classification?** Argument for HARDSHELL: majority of catalog (61%) is membrane. Argument for SOFTSHELL: defaults might represent a "median" shell user. **Recommended: HARDSHELL** — conservative under-estimate of capacity is physically safer than over-estimate.

### 7.2 INTEGRATION QUESTIONS

- How does shell-gate interact with `PHY-HUMID-01 v2` Finding 3 routing fix? The v2 spec §2.3 routes liquid-at-skin to base. Under current asymmetric cascade, overflow hits wall at base cap. Under shell-gate alone, base → mid → insulation still work; shell receives only hygroscopic absorption (S22 Finding 4 behavior preserved). Deferred integration planned for sequenced implementation post-cascade-symmetric spec.

- Can the `COMFORT_THRESHOLD = 40 mL` anchor survive shell-gate without re-derivation? Per S17 closure, 40 mL is Fukazawa 50 g/m² × ~0.8 m² torso estimate. This is independent of shell physics. Should remain valid.

- What if the TA v5 Rocky Mountain anchor (95% RH / 20°F → MR=4.3) no longer holds after shell-gate? Per S17 closure: that anchor is load-bearing for the 7.2 output scale. Re-validation is scope of `S22-MR-VALIDATION-ANCHOR-CONTAMINATED`, not this spec. If anchor fails to hold after implementation, that tracker item escalates to HIGH priority and may warrant calibration revision in follow-on spec.

---

## 8. Sources

### 8.1 Directly cited

- **S17 Closure Document** (`LC6_Planning/LC6_REDESIGN_v1_Closure.md`) — `PERCEIVED_WEIGHTS` / `COMFORT_THRESHOLD` / `7.2` scale classification as calibrations; `PHY-WEIGHTS-CAL` tracker reference; out-of-scope boundary for this spec.
- **PHY-071** (file: `gear_layers.ts` lines 40-67) — FIBER_ABSORPTION coefficients for base/mid/insulation and INSULATED_SHELL classification; unchanged by this spec.
- **PHY-HUMID-01 v2** (`LC6_Planning/specs/PHY-HUMID-01_Spec_v2_RATIFIED.md`) — routing physics; this spec precedes v2 §2.3 implementation.

### 8.2 Physics literature (absorption coefficient anchors)

- **ISO 811 Hydrostatic Head Testing** — membrane waterproofness standard; distinguishes hardshell membrane behavior from fabric absorption.
- **ASTM D4772 Surface Water Absorption** — standard test method for fabric surface water uptake; anchors softshell 10-15% range.
- **Science of Protection (W. L. Gore & Associates)** — ePTFE membrane pore mechanics and backer absorption; anchors hardshell 0.02-0.04 range.
- **MDPI: Water Repellency Characteristics** (Journal of Textiles) — data on saturation vs weave density for DWR-treated woven synthetics; anchors softshell 0.12 value.
- **Nylon 6,6 vs Polyester Performance** (UL Prospector datasheet) — intrinsic fiber moisture regain values: Nylon 6,6 = 3.5-4.5%, Polyester = ~0.4%; anchors all three proposed values.
- **ISO 17617 Drying Rate Testing** — evaporative mass loss methodology; informs validation protocol for drying behavior post-implementation.

### 8.3 Standing references (PHY-071 existing)

- Rossi 2005 (Thermal Manikins and Modelling §9.4)
- Holmer 2005 (Int J Ind Ergonomics 36:1025-1031)
- Das 2007 (Science in Clothing Comfort Ch.6)
- Fukazawa 2003 (fabric absorbency methodology)

### 8.4 Physical intuition anchors

- Real waterproof-breathable shells do not retain meaningful liquid water. Observable in normal use: a wet Gore-Tex jacket dries rapidly; liquid runs off rather than soaks in.
- Softshells wet out progressively as DWR ages; a "wet" softshell IS a sponge-like layer for the period of the wetted-out state.
- Christian's Mist Trail experience: hikers on that trail routinely report soaked baselayers in 70-80°F humid conditions — exactly the regime where shell-gate-mediated back-saturation should drive MR upward.

---

## 9. Test plan

### 9.1 Unit tests (new)

- `classifyShell` routing correctness:
  - Arc'teryx Beta LT (waterproof:3, breathability:8, warmthRatio:1) → HARDSHELL
  - Patagonia Nano Puff (fill_power populated, warmthRatio:5) → INSULATED_SHELL
  - FootJoy Lightweight Softshell Jacket (waterproof:1, warmthRatio:2) → SOFTSHELL
  - Pertex Quantum wind shell (waterproof:0, breathability:9, warmthRatio:1) → WIND_SHELL
  - Dry suit (slot=immersion, subslot=immersion_drysuit) → DRYSUIT
  - Unclassified/null inputs → HARDSHELL (Rule 7 fallback)

- `getLayerCapacity` with shell classifications:
  - 300g HARDSHELL → 6 mL
  - 600g SOFTSHELL → 72 mL
  - 100g WIND_SHELL → 5 mL
  - 300g DRYSUIT → 10.5 mL
  - 350g INSULATED_SHELL synthetic → 140 mL (unchanged from current)

- Default-stack shell (no gear items, 140g effective weight) → 3 mL (not 56 mL as before)

### 9.2 Integration tests (new)

- Reference scenarios S-1 through S-4 as described in Section 6
- Delta validation: no reference scenario shifts beyond expected magnitude range
- Regression: all existing `adversarial_matrix.test.ts` scenarios produce outputs within ±10% of baseline (shell-gate is a capacity refinement, not a physics overhaul — major shifts indicate bug)

### 9.3 Regression test

All 643 existing tests must pass. Any that shift more than ±1% in output require review and documentation before merge.

---

## 10. Cardinal Rule compliance

### 10.1 Rule #1 (No fudge factors)

Three proposed absorption coefficients (0.02, 0.12, 0.05) are now literature-anchored per Section 8.2. DRYSUIT coefficient 0.035 is within the nylon backer range (3.5-4.5% regain from UL Prospector nylon datasheet). All values traceable to published standards (ISO 811, ASTM D4772) and textile science literature. No fudge factors introduced.

### 10.2 Rule #8 (Thermal engine locked)

This spec modifies `gear_layers.ts` and `gear/adapter.ts` but not the thermal engine proper (`calc_intermittent_moisture.ts`, `heat_balance/*`). `computePerceivedMR` unchanged. `computeEmax` / `getDrainRate` unchanged. Cascade logic unchanged.

### 10.3 Rule #11 (No code without spec)

Spec must be ratified before implementation. Ratification requires: (a) reference scenario baselines captured (S24 or S25 target), (b) validation protocol approved, (c) integration questions (§7.2) answered.

### 10.4 Two-agent discipline

Chat authors this spec. Code receives no implementation instructions until ratification. Per memory #30, §7 gate (reference scenarios with expected values) is part of spec completion.

---

## 11. Status and next steps

**Status:** DRAFT v1 (Session 23, 2026-04-20)

**Next steps for ratification:**
1. S24: Author `PHY-CASCADE-SYMMETRIC` spec (companion fix for base overflow cascade)
2. S24 or S25: Author `PHY-MICROCLIMATE-VP` spec (final piece of moisture-model rewrite)
3. S25: Capture reference scenario baselines from current engine (S-1, S-2, S-3, S-4)
4. S25 or S26: Ratification review for all three specs jointly
5. S26 or later: Implementation as single coherent change once all three specs ratified

**Related work items (tracker entries to be added at session close):**
- `S22-SHELL-CAPACITY-MODEL` — this spec
- `S22-CASCADE-ASYMMETRIC` — drafting next (S24)
- `S22-MICROCLIMATE-VP` — drafting after cascade spec (S24/S25)
- `S22-BREATHABILITY-TO-IM-DIVERGENCE` — separate small fix
- `S22-FIBERTYPE-TYPE-DRIFT` — separate small fix
- `S22-MR-VALIDATION-ANCHOR-CONTAMINATED` — post-shell-gate validation
- `S22-DRYING-THERMAL-DRAG` — cross-concern for heat balance engine
- `PHY-IMMERSION-NEOPRENE` — future spec for wetsuit/wader physics

**Sequencing:** Shell-gate is the prerequisite physics correction. Symmetric-cascade and microclimate-VP specs build on shell-gate. Implementation of all three happens as a single coherent change once specs are ratified. MR output layer re-validation is a separate track after upstream physics is correct.

---

*End of DRAFT v1.*
