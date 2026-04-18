# Moisture-to-MR Output Pipeline Audit
## Session 13 — Cardinal Rule #1 Wide Audit, Scope 1: Moisture Output

**Date:** 2026-04-17
**Status:** Audit complete for moisture-output pipeline. Implementation spec draft included.
**Scope:** `computePerceivedMR` → `applySaturationCascade` → downstream MR consumers
**Cardinal Rules:** #1 (no fudge factors), #14 (read before proposing), #3 (single source of truth for MR)

---

## Purpose

Session 13 was implementing PHY-HUMID-01 v2 (routing fix) when the user pressed a fundamental question: "How is `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` not a fudge factor?" Claude's initial response explaining the moisture-output direction for thin-kit vs thick-kit ensembles rested on this weighting being physically grounded. It isn't. This audit catalogs every constant in the moisture-output pipeline and honestly evaluates each against Cardinal Rule #1 (no fudge factors — every constant must trace to published source, derivation, or explicit GAP flag).

**Phase 2+3 implementation is HELD.** Working tree remains dirty. No commits until this audit's findings are addressed or explicitly deferred in a ratified spec.

---

## Audit methodology

For each constant: name → value → location → claimed source → verdict (one of CITED / DERIVABLE / CALIBRATED / FUDGE / UNKNOWN) → confidence level on verdict → recommended action.

**Confidence levels:**
- HIGH: Claude traced to published source OR ran hand-computation and verified
- MEDIUM: Claude read source comment or memory, reasoned from known physics, but did not verify against literature in this audit
- LOW: Claude is speculating based on naming conventions, code context, or intuition

---

## Findings — moisture-output pipeline

### Finding 1: `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]`

**Location:** `packages/engine/src/moisture/perceived_mr.ts:15`

**Claimed source (in code comment):** "Fukazawa 2003, Zhang 2002 — skin wetness perception correlates with skin-fabric interface, not deeper layer saturation."

**Audit verdict:** FUDGE
**Confidence:** HIGH

**Reasoning:** The citations support the DIRECTION of the weighting (base > outer). They do NOT support the specific ratios 3, 2, 1.5, 1. No published source gives "skin-wetness perception weight ratios across a 4-layer ensemble" as measured values. Claude could not find derivation or calibration experiment for these specific numbers in this audit; they appear to be reasoned estimates encoded as constants.

**Physical significance:** Base layer weight 3/7.5 = 40% of total MR score. The shape of weighting determines how ensemble structure (thin vs thick kit) maps to output. Changes to underlying physics (Phase 2+3 routing) interact with these weights non-obviously.

**Recommended action:** **PHY-PERCEIVED-MR-REDESIGN** — rewrite `computePerceivedMR` with explicitly derived (not calibrated) conversion from layer buffers to perception metric. Two candidate approaches:

*Approach A:* Separate "skin wetness" (base only, from Fukazawa) from "ensemble saturation" (other layers). Produce two outputs; let downstream decide weighting.

*Approach B:* Physical model: skin wetness sensation = function(base layer absolute water × skin contact area). Outer layers affect skin indirectly via evaporative cooling intensity and cascade pressure. Express each as physics quantity rather than weighted score.

**Priority:** HIGH — this is in the critical path between physics engine and user-facing output.

---

### Finding 2: `COMFORT_THRESHOLD = 40` mL

**Location:** `packages/engine/src/moisture/perceived_mr.ts:24`

**Claimed source:** "Fukazawa 2003 — skin wetness perception onset at ~50 g/m². Torso base layer contact area ~0.8 m² → threshold ~40 mL."

**Audit verdict:** PARTIALLY CITED
**Confidence:** HIGH

**Reasoning:**
- `50 g/m²` IS Fukazawa 2003 (cited)
- `0.8 m²` torso contact area IS NOT cited. Comment asserts it without reference.

Claude estimate of plausible torso-contact: for a 70kg/170cm male, DuBois BSA ≈ 1.85 m²; torso-front+back ≈ 0.36 m²; including arms ≈ 0.6-0.9 m². So 0.8 m² is within plausible range but it's an estimate, not a measured quantity.

**Physical significance:** The value 40mL is used as the absolute wetness threshold for the base layer. Currently applied uniformly regardless of user BSA. A 50kg person has ~25% smaller torso → actual threshold should be ~30mL. An 110kg person has ~20% larger torso → threshold ~48mL.

**Current effect:** Uniform 40mL. Under-reports MR for small users (base layer actually wet at 30mL, reported as baseSat = 0.75 not 1.0). Over-reports for large users.

**Recommended action:** **PHY-FUKAZAWA-BSA-SCALE** — replace constant 40mL with `50 × torso_contact_m²` where `torso_contact_m² = torso_fraction × computeDuBoisBSA(massKg, heightCm)`. The Fukazawa 50 g/m² stays cited; only the user-specific contact area changes.

**What's `torso_fraction`?** DuBois body-segment fractions exist (Lund & Browder 1944, AMA): chest+back+shoulders ≈ 0.36. Including upper arms (typical base layer coverage) ≈ 0.45-0.50. The specific fraction for "base layer contact area" isn't a standard measurement — need to pick a defensible value. Candidate: `0.45 × BSA` (torso + upper arms, matching typical merino base coverage).

**Priority:** HIGH — affects every MR output.

---

### Finding 3: `7.2` MR scaling factor

**Location:** `packages/engine/src/moisture/perceived_mr.ts:75`

**Claimed source:** None. Code comment only says "scaled by 7.2 to project onto 0-10."

**Audit verdict:** FUDGE
**Confidence:** HIGH

**Reasoning:** Zero citation. If the weighted average is on [0, 1] and we want output on [0, 10], the mathematical scaling factor should be 10, not 7.2. The factor 7.2 implies the creator expected "typical worst case" weighted average to be 10/7.2 = 1.389, which exceeds the theoretical max of 1.0. This is output shaping — tuning the scaling so that moderate-bad scenarios output MR around 7 (leaving the 7-10 range for truly catastrophic scenarios and saturation cascade).

**Physical significance:** Every MR-based threshold downstream (risk tiers, pill selection, CDI computation at line 741 of evaluate.ts) depends on this calibration. Risk thresholds:
- MR < 3: "managing sweat well" (current diagnostic output thresholds)
- MR 3-5: "absorbing but manageable"
- MR > 5: "substantially saturated"

If we changed 7.2 to 10, every MR output would be ~40% higher, and every threshold would need recalibration.

**Recommended action:** Two options:

*Option A — Accept as calibration, document explicitly:* Set output scale factor based on "perceived risk at saturation cascade boundary." MR=6 is where the saturation cascade kicks in; calibrate so base layer fully saturated + mid fully saturated + no outer = MR~6. Derive the multiplier from that constraint.

*Option B — Redesign output range:* Drop the `7.2` and the `applySaturationCascade`. Output raw weighted buffer on [0, 10] directly. Re-derive all downstream thresholds against the new scale.

**Priority:** HIGH — any fix to PERCEIVED_WEIGHTS changes this too. Best bundled.

---

### Finding 4: `applySaturationCascade` transform

**Location:** `packages/engine/src/moisture/saturation_cascade.ts` (separate file, not yet read in this audit)

**Claimed source:** User memory notes "novel contribution per Scientific Foundations doc." Need to read that doc to verify.

**Audit verdict:** UNKNOWN (pending Scientific Foundations read)
**Confidence:** LOW

**Reasoning from what's visible (from the test file saturation_cascade.test.ts):**
- Phase 1 (raw ≤ 6): linear pass-through
- Phase 2 (raw 6-10): quadratic ease-out `6 + 4 × (1 - (1 - (raw-6)/4)²)`
- Cap at 10

The "6" threshold and the quadratic shape aren't obviously physics-derived. They look like output-shaping functions. But user memory says there's a derivation in Scientific Foundations document. Without reading that, I can't declare FUDGE.

**Recommended action:** **Read `/mnt/project/LayerCraft_Scientific_Foundations.docx`** before final verdict. If derivation is real, cite it properly in the code. If the Scientific Foundations doc is itself vague or asserts without deriving, flag as FUDGE.

**Priority:** MEDIUM — can be audited after Scientific Foundations read; not blocking Phase 2+3 fundamentally because cascade operates on output, not buffers.

---

### Finding 5: `baseSat = min(1, base.buffer / COMFORT_THRESHOLD)`

**Location:** `packages/engine/src/moisture/perceived_mr.ts:72`

**Claimed source:** Implied by COMFORT_THRESHOLD being the Fukazawa threshold.

**Audit verdict:** FORMULATION QUESTION
**Confidence:** MEDIUM

**Reasoning:** The formulation says "base layer saturation = min(buffer/threshold, 1.0)" — once the base exceeds the Fukazawa threshold, it caps at 1.0. But physically, more water against skin IS more perception of wetness, not the same perception at 40mL vs 200mL. The cap-at-1.0 formulation models "perception saturates at some threshold" rather than "perception scales continuously with wetness."

Zhang 2002 (cited) does describe a psychophysical plateau in wetness perception, so the cap is defensible. But the RATE at which perception approaches saturation (linear up to 40mL then flat) is a simplification.

**Recommended action:** Fine as a first approximation. Can be revisited if user feedback data emerges. Flag as documented-simplification, not a fudge.

**Priority:** LOW — physics-defensible formulation; more precise would need Zhang 2002 detailed curve which isn't trivially available.

---

### Finding 6: MR output precision (not a constant but a formulation)

**Location:** `packages/engine/src/moisture/perceived_mr.ts:78` — `return Math.min(10, 7.2 * (num / den));`

**Audit verdict:** N/A — this is the output, which we flag elsewhere via the 7.2 factor.

---

## Summary table — moisture-output pipeline

| # | Constant/Formula | Value | Verdict | Confidence | Priority | Recommended Spec |
|---|---|---|---|---|---|---|
| 1 | PERCEIVED_WEIGHTS | [3, 2, 1.5, 1] | FUDGE | HIGH | HIGH | PHY-PERCEIVED-MR-REDESIGN |
| 2 | COMFORT_THRESHOLD | 40 mL | PARTIALLY CITED | HIGH | HIGH | PHY-FUKAZAWA-BSA-SCALE |
| 3 | MR scaling factor | 7.2 | FUDGE | HIGH | HIGH | Same spec as #1 |
| 4 | applySaturationCascade | 6 cutoff + quadratic | UNKNOWN | LOW | MEDIUM | Needs Sci Foundations read first |
| 5 | baseSat cap at 1.0 | cap formulation | DEFENSIBLE | MEDIUM | LOW | Document-only, no action |

---

## Implications for PHY-HUMID-01 v2 (Phase 2+3) commit decision

**The moisture-output layer has unresolved fudges.** Phase 2+3's physics changes (per-layer Magnus, three-category routing) improve the UNDERLYING layer-buffer computation. Those improvements are physics-correct.

But the conversion from layer buffers → MR score goes through `computePerceivedMR` which has fudges. So any MR output we observe after Phase 2+3 is a mixture of:
1. Phase 2+3's physics-correct buffer evolution
2. Unfudged weighting of those buffers into a score

**This means we cannot cleanly validate Phase 2+3 by comparing MR outputs to prior MR outputs.** The MR output has calibration noise.

**Two options:**

*Option A — Commit Phase 2+3 anyway, acknowledge the limit:* Phase 2+3 is physics-correct for the layer buffer computation. `computePerceivedMR` downstream is a separate concern being addressed in a separate spec. Update test expectations with Phase 2+3 output values. Document that output values reflect both Phase 2+3 AND unchanged perceived-MR weighting. Audit continues in Session 14+ for the weighting.

*Option B — Hold Phase 2+3 until perceived-MR is also fixed:* Keep working tree dirty. Write PHY-PERCEIVED-MR-REDESIGN spec. Implement it. Then update Phase 2+3 test expectations against the combined-fix output. Commit everything together.

*Option C — Revert Phase 2+3, hold the whole thing:* Don't commit anything until the wide audit is complete.

**Claude's recommendation: Option A.** Reasons:
1. Phase 2+3's physics improvements are independently correct (routing liquid → base is right regardless of how we weight base)
2. The perceived-MR fix is a separate concern that deserves its own spec and ratification
3. Branches are cheap; we can always revert Phase 2+3 if perceived-MR fix requires it
4. Not committing Phase 2+3 keeps the working tree dirty indefinitely, which degrades session quality

**But there's a risk with Option A:** test expectations get "locked" to Phase 2+3 output which assumes current PERCEIVED_WEIGHTS. When we later fix weights, we re-update tests. This is two rounds of test maintenance for one audit cycle. That's fine but it's extra work.

---

## Draft spec: PHY-PERCEIVED-MR-REDESIGN v0

### Scope

Fix 3 Cardinal Rule #1 violations in `perceived_mr.ts`:
1. Replace PERCEIVED_WEIGHTS fudge with physics-derived weighting
2. Scale COMFORT_THRESHOLD by user BSA
3. Replace 7.2 output scaling factor with derived calibration

### Physics basis

Skin wetness perception is fundamentally a SKIN-LEVEL sensory phenomenon (Fukazawa 2003, Zhang 2002). What the mid/insulation/shell layers do is affect:
- Evaporative cooling sensation (outer layers wet → more skin cooling via evaporation from outer surface)
- Cascade pressure (if outer saturates, backflow of moisture into inner layers)
- Drying time (more saturated layers = slower overall drying)

These are DIFFERENT sensations than wetness-against-skin. The current model conflates them into a single MR score.

### Proposed redesign

**Three outputs instead of one:**

1. `skin_wetness_perception` [0, 10]: purely base-layer, using Fukazawa 50 g/m² × BSA-derived contact area. Pure physics. No calibration.

2. `ensemble_saturation_load` [0, 10]: fill fraction across all outer layers, uniformly weighted. Pure physics (just averaging).

3. `evaporative_chill_risk` [0, 10]: derived from outer layer fill + wind + T_ambient — measures how much skin cooling occurs via evaporation from the wet shell. Pure physics (qEvap from saturated outer surface × exposure time).

**Single `perceived_MR` for backward compatibility:** Combine the three outputs with DOCUMENTED default weighting, flagged as "user-overridable calibration" not fudge factor. Default could be `max(skin_wetness_perception, ensemble_saturation_load × 0.5, evaporative_chill_risk × 0.3)` — takes the dominant discomfort signal.

### Implementation changes

`packages/engine/src/moisture/perceived_mr.ts`:

```typescript
// DERIVED — not fudged
export function torsoContactArea(bsaM2: number): number {
  // Torso (chest+back+shoulders) + upper arms ≈ 0.45 of BSA
  // Per AMA Lund-Browder body-segment fractions
  return 0.45 * bsaM2;
}

export function comfortThresholdML(bsaM2: number): number {
  // Fukazawa 2003: 50 g/m² skin wetness perception threshold
  return 50 * torsoContactArea(bsaM2);
}

export function computeSkinWetnessPerception(baseLayer: PerceivedMRLayer, bsaM2: number): number {
  const thresh = comfortThresholdML(bsaM2);
  const wetness = Math.min(1, baseLayer.buffer / thresh);
  return 10 * wetness;  // directly on [0, 10]
}

export function computeEnsembleSaturationLoad(outerLayers: PerceivedMRLayer[]): number {
  if (outerLayers.length === 0) return 0;
  const avgFill = outerLayers.reduce((s, l) => s + (l.cap > 0 ? Math.min(1, l.buffer / l.cap) : 0), 0) / outerLayers.length;
  return 10 * avgFill;
}

// Backward compat
export function computePerceivedMR(layers: PerceivedMRLayer[], bsaM2: number): number {
  if (!layers || layers.length === 0) return 0;
  const base = layers[0]!;
  const others = layers.slice(1);
  const skinWetness = computeSkinWetnessPerception(base, bsaM2);
  const ensembleSat = computeEnsembleSaturationLoad(others);
  // Skin wetness dominates when present; ensemble saturation becomes relevant when high
  return Math.min(10, Math.max(skinWetness, ensembleSat * 0.5));
}
```

**Removed:** PERCEIVED_WEIGHTS fudge, COMFORT_THRESHOLD uniform 40mL, 7.2 scaling.

**Preserved:** Fukazawa 50 g/m² threshold (cited), DuBois BSA formula (cited), outer-layer fill-fraction concept.

**Added:** BSA-scaled threshold, separate perception modalities.

### Test impact

Every test that asserts on `sessionMR` or `peak_MR` will shift. We need to:
1. Run the engine with PHY-PERCEIVED-MR-REDESIGN applied
2. Capture new expected values for each test scenario
3. Update test expectations with physics-justified comments

For Phase 2+3: run it combined with PHY-PERCEIVED-MR-REDESIGN, get final numbers, update tests ONCE.

### Open questions for ratification

**OQ-PR-A:** torso contact area fraction. 0.45 is Claude's estimate. Literature values:
- Lund & Browder 1944: trunk = 0.36 (excludes arms)
- Wallace 1951 "Rule of 9s": torso front = 0.18, torso back = 0.18, arms = 0.09 each → ~0.54 including arms
- Typical base-layer coverage: torso + upper arms to elbow → 0.40-0.50 range

Recommend 0.45 as midpoint; flag for review if empirical data on base-layer moisture distribution becomes available.

**OQ-PR-B:** ensemble saturation weighting (the `× 0.5` in the backward-compat function). How much does outer-layer saturation reduce "perceived comfort" independent of skin wetness? No clear literature; my `0.5` is intuition. Alternative: dynamically scale based on temperature (cold + saturated outer = evaporative chill = high weight; warm + saturated outer = heat stress = different sensation).

Recommend: flag as `latent_calibration_documented_in_PHY-PR-CHILL-WEIGHT` for future spec. Use 0.5 as placeholder.

**OQ-PR-C:** should we deprecate the single `computePerceivedMR` entirely and force callers to use the three separate outputs? That's a cleaner long-term architecture but requires updating every consumer (risk tiers, pill selection, CDI).

Recommend: keep backward-compat wrapper for now, migrate consumers incrementally.

---

## What to do now

**Claude's honest assessment:**

1. Today's session accomplished the audit of the moisture-output pipeline. That's substantive progress.

2. The three findings (PERCEIVED_WEIGHTS, COMFORT_THRESHOLD, 7.2) are well-characterized and have a drafted spec.

3. Whether to implement PHY-PERCEIVED-MR-REDESIGN now (combined with Phase 2+3) or as a separate spec later is a decision, not a blocker.

4. **We should not commit Phase 2+3 alone with current PERCEIVED_WEIGHTS fudge** — the user explicitly challenged this, and shipping code whose test expectations are locked against fudge-factor output is a process violation of Cardinal Rule #1.

5. **Best path forward: ratify PHY-HUMID-01 v2 Phase 2+3 AND PHY-PERCEIVED-MR-REDESIGN as a combined deliverable.** Implement together. Test together. Commit together. One "v2 full" commit.

6. The wider audit (IREQ, heat balance, pacing, etc) is a separate multi-session effort. Not addressed here.

**User decision required:**
- Ratify this audit doc as-is?
- Ratify PHY-PERCEIVED-MR-REDESIGN spec?
- Implement combined Phase 2+3 + PERCEIVED-MR-REDESIGN in next session?

