> **STATUS (Session 17): SUPERSEDED BY REVERSION**
>
> This spec was RATIFIED in Session 14 and partially implemented in Session 15,
> but the implementation was REVERTED in Session 17 per the closure document at
> `LC6_Planning/LC6_REDESIGN_v1_Closure.md`.
>
> The pre-REDESIGN output layer (7.2 output budget + saturation cascade +
> 40 mL comfort threshold) is retained and now documented as calibration
> (not fudge) with inline code comments in `packages/engine/src/moisture/perceived_mr.ts`.
>
> The content below is preserved as historical record of Session 14 ratification.
> Do not implement this spec. See closure doc for rationale.

---

# PHY-PERCEIVED-MR-REDESIGN v1 RATIFIED

**Status:** RATIFIED 2026-04-18 (Session 14)
**Supersedes:** v0 DRAFT (Session 13), v0.1 DRAFT (Session 14)
**Implementation target:** Session 14+ combined with PHY-HUMID-01 v2 Phase 2+3
**Cardinal Rule territory:** #1 (no fudge factors), #3 (single source of truth for MR), #11 (no code without ratified spec), #14 (read before proposing)

## Versioning trail

| Version | Session | Status | Changes |
|---|---|---|---|
| v0 | 13 | DRAFT, SUPERSEDED | Initial redesign: 3 outputs + `max()` combination wrapper |
| v0.1 | 14 | DRAFT, SUPERSEDED | Forensic review addressed 7 concerns; additive operator; explicit §5 boundary + §6 downstream impact |
| v1 | 14 | **RATIFIED** | H3 added as 4th reference scenario for hand-computation gate |

---

## Audit findings this spec addresses

Session 13 moisture-output audit identified 3 Cardinal Rule #1 violations in
`packages/engine/src/moisture/perceived_mr.ts`:

1. `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` — FUDGE (citations justify direction, not ratios)
2. `COMFORT_THRESHOLD = 40` mL uniform — PARTIALLY CITED (Fukazawa 50g/m² yes;
   0.8 m² contact area no; not BSA-scaled)
3. `7.2` MR output scaling — FUDGE (no citation, no derivation)

Audit document: `LC6_Planning/audits/MOISTURE_OUTPUT_AUDIT_S13.md`

---

## Design

### Torso contact area (Rule of 9's, AMA medical burns assessment)

Long-sleeve base layer coverage = 54% of BSA, derived from Rule of 9's:
- Torso anterior = 18%
- Torso posterior = 18%
- Both arms (full length) = 18%

**Honest documentation:** Rule of 9's was developed for burns triage (estimating fluid loss from burned surface area), not for gear physics. We borrow it because it's the accepted medical standard for BSA-by-region partitioning and no better alternative exists for our purposes. A first-principles measurement of actual garment-to-skin contact area per product would be more physics-correct but requires gear-DB-level data not currently available. Flagged as PHY-PR-COVERAGE-VAR for future refinement with activity-specific or gear-specific coverage.

```typescript
export function torsoContactArea(bsaM2: number): number {
  // Rule of 9's (AMA medical burns assessment standard)
  // Long-sleeve base layer coverage = 54% of BSA
  // Short-sleeve base = 0.45; sleeveless = 0.36 (tracked as PHY-PR-COVERAGE-VAR)
  // Accepted as physics-adjacent best available estimate until per-product
  // coverage data is available in the gear DB.
  return 0.54 * bsaM2;
}

export function comfortThresholdML(bsaM2: number): number {
  // Fukazawa 2003: 50 g/m² skin wetness perception threshold
  // Citation propagated from existing LC5/LC6 code comment; not re-verified
  // against source paper in this spec cycle. Re-verification flagged for
  // DOC-TA-V7 citation audit pass.
  return 50 * torsoContactArea(bsaM2);
}
```

### Three physics-derived perception outputs

```typescript
export function computeSkinWetnessPerception(
  baseLayer: PerceivedMRLayer,
  bsaM2: number,
): number {
  const thresh = comfortThresholdML(bsaM2);
  const wetness = Math.min(1, baseLayer.buffer / thresh);
  return 10 * wetness;  // direct [0, 10] mapping, no calibration
}

export function computeEnsembleSaturationLoad(
  outerLayers: PerceivedMRLayer[],
): number {
  if (outerLayers.length === 0) return 0;
  // Uniform average across outer layers is the zero-calibration simplest
  // choice. Physically, shell saturation (blocked vapor path) is more
  // consequential than mid-layer saturation (minor thermal effect), but
  // weighting them differently introduces new calibration coefficients
  // (the exact thing the audit is trying to eliminate). Leaving as uniform
  // avg and flagging for Phase-2 redesign (PHY-PR-CHILL-WEIGHT expansion)
  // when empirical data justifies layer-specific weighting.
  const avgFill = outerLayers.reduce(
    (s, l) => s + (l.cap > 0 ? Math.min(1, l.buffer / l.cap) : 0),
    0,
  ) / outerLayers.length;
  return 10 * avgFill;
}
```

### Backward-compatibility wrapper (additive model)

```typescript
export function computePerceivedMR(
  layers: PerceivedMRLayer[],
  bsaM2: number,
): number {
  if (!layers || layers.length === 0) return 0;
  const base = layers[0]!;
  const others = layers.slice(1);
  const skinWetness = computeSkinWetnessPerception(base, bsaM2);
  const ensembleSat = computeEnsembleSaturationLoad(others);
  // Additive model: compound discomfort (wet skin AND saturated shell) is
  // worse than either alone. 0.3 factor on ensemble saturation is empirical
  // placeholder (tracked as PHY-PR-CHILL-WEIGHT).
  return Math.min(10, skinWetness + ensembleSat * 0.3);
}
```

**Behavioral examples:**

| Skin wetness | Ensemble saturation | Output | Interpretation |
|---|---|---|---|
| 8 | 0 | 8.0 | Wet base, dry shell — base dominates |
| 0 | 10 | 3.0 | Dry base, saturated shell — modest ensemble load signal |
| 5 | 6 | 6.8 | Damp base, damp ensemble — compound effect |
| 8 | 10 | 10.0 | Capped |
| 2 | 4 | 3.2 | Low skin + moderate ensemble |

### What's removed

- `PERCEIVED_WEIGHTS` — deleted
- `COMFORT_THRESHOLD = 40` — replaced by `comfortThresholdML(bsaM2)`
- `7.2` output multiplier — deleted (outputs on [0, 10] directly)

### Cardinal Rule #1 accounting

| Constant | Source | Status |
|---|---|---|
| `50 g/m²` | Fukazawa 2003 | CITED (accepted on faith; verification in DOC-TA-V7) |
| `0.54 × BSA` | Rule of 9's (AMA medical) | CITED (physics-adjacent; domain-borrowed) |
| `× 0.3` (additive combination factor) | LATENT CALIBRATION | Tracked as PHY-PR-CHILL-WEIGHT |
| `10` scale factor | DERIVED (direct [0,1] → [0,10]) | NOT calibration |

**Net change:** three confirmed fudges removed (PERCEIVED_WEIGHTS ratios, 7.2 scaling, uniform 40mL threshold), one documented calibration remains (the 0.3) with explicit tracking entry. Improvement from three hidden fudges to one named flag.

---

## §5 — Single Source of Truth Boundary

Cardinal Rule #3: `calcIntermittentMoisture` → `computePerceivedMR` is THE source for MR.

**Rule #3 enforcement under redesign:**

`computePerceivedMR` remains the ONLY public entry point for MR values. External callers (`evaluate.ts`, display components, strategy winner, CDI computation, four-pill comparison) MUST use `computePerceivedMR`.

The three sub-functions (`computeSkinWetnessPerception`, `computeEnsembleSaturationLoad`) are **internal helpers**. Exported for unit-test access only. NOT for use by external consumers.

If a future session proposes reading sub-functions directly (e.g., "show skin wetness independently in UI"), that requires:
1. Explicit amendment to this spec
2. Justification for why the backward-compat wrapper is insufficient
3. Re-evaluation of Cardinal Rule #3 boundary

**Implementation requirement:** Code comments on the two helper functions will state:
```typescript
// @internal — do not call directly from evaluate/display/CDI code.
// Use computePerceivedMR for all external MR queries.
```

Enforcement is comment-level + code review, not technical.

---

## §6 — Downstream Impact (sessionMR consumers)

Post-redesign, `computePerceivedMR` output distribution changes. This affects every downstream consumer of `sessionMR` values.

**Known consumers (non-exhaustive — implementation session must enumerate fully):**

| File | Line | Consumer | Threshold concern |
|---|---|---|---|
| `packages/engine/src/evaluate.ts` | 739, 741 | `MR` per trajectory point; `CDI: mr.sessionMR > 5 ? mr.sessionMR * 0.8 : mr.sessionMR * 0.5` | CDI multipliers calibrated against OLD 7.2-scaled MR values |
| `packages/engine/src/evaluate.ts` | 744 | `binding_pathway: mr.sessionMR > 3 ? 'moisture' : 'neutral'` | Threshold 3 calibrated against OLD MR |
| (other sites TBD) | — | Risk tier thresholds, pill selection, strategy winner | Implementation session must enumerate |

**Implementation session gate (BLOCKING — not optional):**

Before shipping PERCEIVED-MR-REDESIGN + Phase 2+3:

1. Grep all references across `packages/engine/` to: `sessionMR`, `peak_MR`, `.MR` on engine output, any destructured variable named `MR`
2. For each consumer with a numerical threshold, verify the threshold still discriminates correctly post-redesign
3. Update thresholds OR document why the old threshold is still correct
4. Run full test suite; review failures

**Explicit risk:** The old 7.2 scaling was calibrated so "moderate scenarios" output MR ≈ 4-6. Post-redesign, the distribution shifts. CDI `> 5` threshold in `evaluate.ts:741` was calibrated against old distribution and may fire at the wrong point in the new distribution.

This is a Cardinal Rule #3 enforcement (single source must have coherent interpretation across consumers). Not a "nice to have."

---

## §7 — Hand-computed reference scenarios (TEST EXPECTATION GATE)

Implementation session must produce hand-computed expected MR values for four reference scenarios before updating any test assertions. Engine output must match hand computations within specified tolerance or ONE of them is wrong.

### Scenario 1: Breckenridge 16°F / 40% RH / 3.4 CLO kit / 6hr snowboarding

**Why:** Baseline cold-scenario regression lock; reference for user's primary use case.
- Hand compute: E_req, E_max, sweat production, trapped liquid, vapor condensation, base-layer fill, outer-layer avg fill, skinWetness, ensembleSat, final MR
- Expected to be in MR ≈ 1-3 range (good kit, cold, moisture manageable)

### Scenario 2: Cycling 85°F / 50% RH / thin kit / 2hr flat hard

**Why:** Warm-weather high-exertion validation; tests the uncompensable-sweat → base-layer routing.
- Hand compute: same chain as Breck
- Expected to be in MR ≈ 3-5 range (warm, high exertion, thin kit dumping liquid to base)

### Scenario 3: Hike 55°F / 70% RH / 4hr / moderate pace

**Why:** Cool-humid middle-ground scenario; tests moderate evaporative pathway.
- Hand compute: same chain
- Expected to be in MR ≈ 2-4 range (cool, moderate exertion, good vapor pathway)

### Scenario 4: H3 humid running 75°F / 90% RH / 1.5hr

**Why:** THE scenario that triggered this entire redesign thread. Session 12 adversarial matrix found H3 produced MR=0.7 where physics predicts MR=5-8 due to w_req ≈ 2.7 (deeply uncompensable). If post-redesign engine still produces MR=0.7 for H3, the fix is incomplete.
- Hand compute: E_req ≈ 600W, E_max ≈ 224W, w_req ≈ 2.7 (from Session 12 analysis)
- Expected: MR in 5-8 range post-fix (uncompensable sweat accumulates at skin)

### For each scenario

- Document all intermediate values in a reference table in a markdown file alongside the spec
- Engine output MUST match hand-computed values within specified tolerance (TBD at implementation start)
- If engine differs from hand computation, EITHER engine is wrong OR hand computation is wrong. Both reconciled before ratifying implementation.

### Snapshot assertions (goodRunCount, totalFluidLoss, etc.)

Can be captured from engine output but must be cross-checked against physical plausibility before locking in.

---

## §8 — Implementation order

1. ~~Spec ratified as v1~~ ← DONE (this document)
2. **Downstream audit (§6)** — grep all sessionMR consumers, build consumer table
3. **Hand-compute 4 reference scenarios (§7)** — Breck + cycling + hike + H3
4. **Write code changes** (`packages/engine/src/moisture/perceived_mr.ts`)
5. **Run full test suite** — expect failures in moisture tests + possibly downstream tests
6. **Update test expectations** using hand-computed values as authority
7. **Fix downstream threshold calibrations** where needed (CDI multipliers, risk tiers)
8. **Verify hand-computed reference scenarios match engine output** (correctness gate)
9. **Single commit** covering PERCEIVED-MR-REDESIGN + PHY-HUMID-01 v2 Phase 2+3

Implementation is blocked on §6 downstream audit + §7 hand-computations completing first. These are the Cardinal Rule #14 "read before proposing" gate translated to "verify before coding."

---

## §9 — Open follow-up items (tracked separately)

| ID | Reason for future work | Current location |
|---|---|---|
| PHY-PR-COVERAGE-VAR | Activity-specific torso coverage (short-sleeve vs long-sleeve vs sleeveless) | Master Tracking B.7 |
| PHY-PR-CHILL-WEIGHT | Empirical derivation of 0.3 additive coefficient + possible layer-specific ensemble weighting | Master Tracking B.7 |
| DOC-TA-V7 | Re-verification of Fukazawa 50 g/m² citation against source paper | Master Tracking B.10 |

---

## §10 — Document status

- **Version:** v1 RATIFIED
- **Session ratified:** 14 (2026-04-18)
- **Supersedes:** v0 DRAFT, v0.1 DRAFT
- **Raises:** PHY-PR-COVERAGE-VAR, PHY-PR-CHILL-WEIGHT (both already in Master Tracking B.7)
- **Blocks implementation on:** Downstream audit (§6), hand-computed reference scenarios (§7)
