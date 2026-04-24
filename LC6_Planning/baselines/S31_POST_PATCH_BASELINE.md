# S31 Post-Patch Baseline (spec v1.2 §9.8)

**Engine HEAD:** c553621 (S31 Phase C)
**Captured:** 2026-04-23
**Purpose:** Reference values for future MR-fidelity work. NOT S31 gate targets.

---

## Ski vectors (optimal_gear pill, real-DB strategy-engine-selected ensemble)

| Vector | Pre-Phase-A sessionMR (HEAD 78cd56a) | Post-Phase-C sessionMR (HEAD c553621) | Δ |
|---|---|---|---|
| G1 Ghost Town groomers | 2.50 | 1.80 | -0.70 |
| M2 Tier 2 moguls | 6.40 | 5.50 | -0.90 |
| P5 Tier 5 powder Saturday | 4.10 | 3.00 | -1.10 |

All three deltas downward. Phase C lunch drying (45 min at 68°F/40%RH, shell off,
im_series ≈ 0.18) dominates Phase B line-phase accumulation for all three vectors
at 8.5hr session durations crossing the 12:15 PM lunch wall-clock.

## Per-cycle MR trajectories (post-Phase-C)

### G1 (cycleMinRaw=13, lunch fires at cycle 15)
[0.1, 0.2, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3,
 0.2,  <- lunch reset dip (cycle 15 post-lunch, -1.1 MR from pre-lunch peak)
 0.3, 0.4, 0.5, 0.6, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.1, 1.2, 1.3, 1.4, 1.5]

### M2 (cycleMinRaw=19, lunch fires at cycle 10)
[0.1, 0.3, 0.4, 1.0, 1.5, 2.1, 2.6, 3.1, 3.6, 4.1,
 0.9,  <- lunch reset dip (cycle 10 post-lunch, -3.2 MR from pre-lunch peak)
 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.4, 4.9, 5.3, 5.5]

### P5 (cycleMinRaw=37, lunch fires at cycle 5)
[0.3, 0.7, 1.4, 2.1, 2.8,
 1.1,  <- lunch reset dip (cycle 5 post-lunch, -1.7 MR from pre-lunch peak)
 1.8, 2.5, 3.1, 3.8, 4.4]

## Non-ski regression (v1.2 §9.5 gated metrics)

All 11 non-ski activities bit-identical on:
- sessionMR
- perCycleMR (full array)
- trapped
- Final layer buffer fills (base, mid, insulative, shell)
- _cumStorageWmin

totalFluidLoss excluded per v1.2 §9.5 footnote; 6 cyclic 2-phase profiles
(day_hike, backpacking, running, mountain_biking, trail_running, fishing)
show physics-consistent respiratory-extension deltas.

## Physics arithmetic sanity — P5 |Δ| = 1.10 MR

- Phase A contribution: respiratory extension, negligible MR impact
  (vapor exits via breath, minimal fabric absorption)
- Phase B contribution: +0.4 MR (20-min line × 11 cycles cold exposure
  accumulation at LINE_MET=1.8, plus 3-min transition × 11 cycles at
  TRANSITION_MET=2.0)
- Phase C contribution: -1.5 MR (indoor lunch drying VPD ~47× stronger
  than outdoor humid-cold, 45 min with shell off, inner layers drain
  ~30-50% of accumulated moisture; post-lunch re-climb over 6 remaining
  cycles adds +2.0 but relative session-end position is below Phase B)
- Net: +0.4 − 1.5 = -1.1 matches observed -1.10.

## Usage

These values are reference points for future work:

- Cross-check against future MR-fidelity work as other open bugs resolve
- Detect regressions in subsequent sessions that inadvertently re-touch
  the reconciled code
- Feed S31-PHASE-C-REBASELINE session with verified post-S31 observed
  values for re-authoring the 7 skipped tests
