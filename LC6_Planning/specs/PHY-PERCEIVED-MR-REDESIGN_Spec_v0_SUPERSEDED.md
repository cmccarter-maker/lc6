# ⚠️ SUPERSEDED — DO NOT USE

**This version superseded by v1 RATIFIED (Session 14, 2026-04-18).**

Original v0 DRAFT used `Math.max(skinWetness, ensembleSat * 0.5)` combination operator.
Forensic review in Session 14 found this underestimates compound discomfort. v0.1 and v1
use additive model: `Math.min(10, skinWetness + ensembleSat * 0.3)`.

See `PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md` for current spec.

Retained for audit trail per Cardinal Rule #14 history discipline.

---

# PHY-PERCEIVED-MR-REDESIGN v0 DRAFT

**Status:** DRAFT — awaiting forensic review before ratification (per Cardinal Rule #14)
**Session raised:** 13 (2026-04-17)
**Ratification target:** Session 14 after user review
**Implementation target:** Session 14+ combined with PHY-HUMID-01 v2 Phase 2+3
**Cardinal Rule territory:** #1 (no fudge factors), #3 (single source of truth for MR), #11 (no code without ratified spec)

## Audit findings requiring this spec

Session 13 moisture-output audit (LC6_Planning/audits/MOISTURE_OUTPUT_AUDIT_S13.md)
identified 3 Cardinal Rule #1 violations in `packages/engine/src/moisture/perceived_mr.ts`:

1. `PERCEIVED_WEIGHTS = [3, 2, 1.5, 1]` — FUDGE (citations justify direction, not ratios)
2. `COMFORT_THRESHOLD = 40` mL uniform — PARTIALLY CITED (Fukazawa 50g/m² yes;
   0.8 m² contact area no; not BSA-scaled)
3. `7.2` MR output scaling — FUDGE (no citation, no derivation)

## Proposed redesign

### Torso contact area (Rule of 9's, AMA medical burns assessment)

Long-sleeve base layer coverage = 54% of BSA
- Torso anterior = 18%
- Torso posterior = 18%
- Both arms (full length) = 18%

```typescript
export function torsoContactArea(bsaM2: number): number {
  // Rule of 9's (AMA medical burns assessment standard)
  // Long-sleeve base layer coverage = 54% of BSA
  // Short-sleeve base = 0.45; sleeveless = 0.36 (tracked as PHY-PR-COVERAGE-VAR)
  return 0.54 * bsaM2;
}

export function comfortThresholdML(bsaM2: number): number {
  // Fukazawa 2003: 50 g/m² skin wetness perception threshold
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
  const avgFill = outerLayers.reduce(
    (s, l) => s + (l.cap > 0 ? Math.min(1, l.buffer / l.cap) : 0),
    0,
  ) / outerLayers.length;
  return 10 * avgFill;
}
```

### Backward-compatibility wrapper

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
  return Math.min(10, Math.max(skinWetness, ensembleSat * 0.5));
}
```

### What's removed

- `PERCEIVED_WEIGHTS` — deleted
- `COMFORT_THRESHOLD = 40` — replaced by `comfortThresholdML(bsaM2)`
- `7.2` output multiplier — deleted (outputs on [0, 10] directly)

### Cardinal Rule #1 accounting

| Constant | Source |
|---|---|
| `50 g/m²` | Fukazawa 2003 — CITED |
| `0.54 × BSA` | Rule of 9's (AMA medical) — CITED |
| `× 0.5` (in wrapper `max`) | LATENT CALIBRATION flagged as PHY-PR-CHILL-WEIGHT |
| `10` scale factor | DERIVED (direct [0,1] → [0,10]) |

**One latent calibration** (the `× 0.5`) is documented and tracked, not hidden.

## Open questions for ratification

- **OQ-PR-A:** 0.54 default assumes long-sleeve base. Parameterize by gear? Tracked as PHY-PR-COVERAGE-VAR.
- **OQ-PR-B:** `× 0.5` combination factor. Empirical data needed. Tracked as PHY-PR-CHILL-WEIGHT.
- **OQ-PR-C:** Deprecate `computePerceivedMR` single output eventually, force 3-output API? Tracked as future follow-up.
- **OQ-PR-D:** Test expectation update strategy. Run PHY-HUMID-01 v2 Phase 2+3 + PERCEIVED-MR-REDESIGN together, capture new values, update tests ONCE.

## Implementation order (Session 14)

1. Forensic review of THIS spec
2. Resolve OQ-PR-A/B/C/D
3. Ratify v1
4. Implement in `packages/engine/src/moisture/perceived_mr.ts`
5. Verify `evaluate.ts:741` CDI computation still works with new output
6. Run full test suite
7. Update test expectations
8. Single commit covering both PHY-HUMID-01 v2 Phase 2+3 AND PERCEIVED-MR-REDESIGN

## Document status

- **Version:** v0 DRAFT
- **Session raised:** 13
- **Ratification target:** Session 14
- **Supersedes:** None
- **Raises:** PHY-PR-COVERAGE-VAR, PHY-PR-CHILL-WEIGHT
