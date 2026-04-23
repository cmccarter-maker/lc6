# S31 Pre-Patch Baseline Capture

**Engine HEAD:** `78cd56a` (engine source file hash matches `4e84e76` baseline — no engine-source changes since S29 port landed)
**Captured:** 2026-04-23 via `pnpm -F @lc6/engine test baseline-capture`
**Test file:** `packages/engine/tests/spec-locks/phy-031-cyclemin-reconciliation/baseline-capture.test.ts`
**Purpose:** PHY-031-CYCLEMIN-RECONCILIATION spec §9.5 criterion #7 regression anchor (delta attribution verification) and criterion #8 non-ski bit-identical regression reference.

---

## Ski vectors (spec §9.2–§9.4)

### G1 — Ghost Town groomers (spec §9.2)

**Inputs:** date 2026-11-10 (Tuesday early-season), `groomers`, `tempF=16`, `humidity=30`, `windMph=5`, `precipProbability=0`, `totalCLOoverride=2.60`, `ensembleIm=0.089`, `durationHrs=8.5`, 170 lb male, 18% BF, VO2max 48.
**CycleOverride derivation:** `crowdTier=1`, `totalCycles=31`, `cycleMin=16.250` min

| Metric | Value |
|---|---|
| sessionMR | **2.2** |
| totalRuns | 31 |
| goodRunCount | 31 |
| yellowRunCount | 0 |
| totalFluidLoss | 401 g |
| fluidLossPerHr | 47 g/hr |
| timeAtCapHrs | 0 |
| peakSaturationFrac | 0.258 |
| peakHeatBalanceW | -10.11 |
| totalHeatBalanceWh | -27.07 |
| fatigue | 0.00047 |
| trapped | 0.112 |

**perCycleMR (31 cycles):** `[0.1, 0.1, 0.2, 0.3, 0.4, 0.4, 0.5, 0.6, 0.7, 0.7, 0.8, 0.9, 1.0, 1.0, 1.1, 1.2, 1.2, 1.3, 1.4, 1.5, 1.5, 1.6, 1.7, 1.7, 1.8, 1.9, 1.9, 2.0, 2.1, 2.1, 2.2]`

**Final layer buffers:**
| Layer | Fiber | Buffer (g) | Cap (g) | Fill % |
|---|---|---|---|---|
| base | WOOL | 16.74 | 77.00 | 21.7% |
| mid | SYNTHETIC | 29.16 | 128.00 | 22.8% |
| insulative | SYNTHETIC | 29.56 | 124.00 | 23.8% |
| shell | SYNTHETIC | 36.91 | 156.00 | 23.7% |

---

### M2 — Tier 2 moguls (spec §9.3, S-001 anchor)

**Inputs:** date 2026-02-03 (Tuesday peak-season), `moguls`, `tempF=20`, `humidity=45`, `windMph=8`, `precipProbability=0`, `totalCLOoverride=2.60`, `ensembleIm=0.089`, `durationHrs=8.5`, biometrics same as G1.
**CycleOverride derivation:** `crowdTier=2`, `totalCycles=21`, `cycleMin=23.750` min

| Metric | Value |
|---|---|
| sessionMR | **6.8** |
| totalRuns | 21 |
| goodRunCount | 9 |
| yellowRunCount | 1 |
| totalFluidLoss | 1,916 g |
| fluidLossPerHr | 225 g/hr |
| timeAtCapHrs | 0 |
| peakSaturationFrac | 0.935 |
| peakHeatBalanceW | +208.27 |
| totalHeatBalanceWh | +681.25 |
| fatigue | 0.094 |
| trapped | 0.412 |

**perCycleMR (21 cycles):** `[0.1, 0.3, 0.4, 0.9, 1.3, 1.8, 2.3, 2.7, 3.2, 3.6, 4.1, 4.5, 4.9, 5.3, 5.4, 5.6, 5.8, 5.9, 6.1, 6.2, 6.4]`

**Final layer buffers:**
| Layer | Fiber | Buffer (g) | Cap (g) | Fill % |
|---|---|---|---|---|
| base | WOOL | 52.62 | 77.00 | 68.3% |
| mid | SYNTHETIC | 101.24 | 128.00 | 79.1% |
| insulative | SYNTHETIC | 114.13 | 124.00 | 92.0% |
| shell | SYNTHETIC | 143.56 | 156.00 | 92.0% |

---

### P5 — Tier 5 powder Saturday (spec §9.4)

**Inputs:** date 2026-01-17 (Saturday peak-season + powder → Tier 6 via bump at HEAD), `moguls`, `tempF=18`, `humidity=80`, `windMph=3`, `precipProbability=0.70`, `totalCLOoverride=2.60`, `ensembleIm=0.089`, `durationHrs=8.5`, biometrics same as G1.
**CycleOverride derivation:** `crowdTier=6`, `totalCycles=11`, `cycleMin=46.250` min

> **Observation:** Spec §9.4 says "Tier 5 Packed via powder bump" with `totalCycles=12, cycleMin=40`. The engine's `getCrowdFactor` at HEAD produces `crowdTier=6` (Mayhem) for Saturday + powder, yielding `totalCycles=11, cycleMin=46.25`. This is a tier-derivation delta between spec narrative ("Tier 5") and engine output ("Tier 6"), flagged for Chat review.

| Metric | Value |
|---|---|
| sessionMR | **4.8** |
| totalRuns | 11 |
| goodRunCount | 8 |
| yellowRunCount | 1 |
| totalFluidLoss | 996 g |
| fluidLossPerHr | 117 g/hr |
| timeAtCapHrs | 0 |
| peakSaturationFrac | 0.570 |
| peakHeatBalanceW | +202.74 |
| totalHeatBalanceWh | +367.39 |
| fatigue | 0.021 |
| trapped | 0.261 |

**perCycleMR (11 cycles):** `[0.2, 0.4, 0.9, 1.4, 1.9, 2.4, 2.9, 3.4, 3.9, 4.3, 4.8]`

**Final layer buffers:**
| Layer | Fiber | Buffer (g) | Cap (g) | Fill % |
|---|---|---|---|---|
| base | WOOL | 34.99 | 77.00 | 45.4% |
| mid | SYNTHETIC | 64.60 | 128.00 | 50.5% |
| insulative | SYNTHETIC | 71.10 | 124.00 | 57.3% |
| shell | SYNTHETIC | 90.18 | 156.00 | 57.8% |

---

## Non-ski activities (spec §9.5 criterion #8 bit-identical regression anchors)

**Common inputs:** `tempF=60`, `humidity=50`, `windMph=5`, `durationHrs=2`, `totalCLOoverride=1.0`, `ensembleIm=0.40`, 170 lb male, 18% BF.

| Activity | sessionMR | totalRuns | totalFluidLoss (g) | fluidLossPerHr | peakSaturationFrac | trapped | Final base / mid / ins / shell fill % |
|---|---|---|---|---|---|---|---|
| day_hike | 0.6 | 2 | 400 | 200 | 0.0971 | 0.0637 | 4.4 / 9.9 / 17.8 / 16.4 |
| backpacking | 0.6 | 2 | 400 | 200 | 0.0971 | 0.0637 | 4.4 / 9.9 / 17.8 / 16.4 |
| running | 0.6 | 2 | 400 | 200 | 0.1270 | 0.0637 | 4.4 / 9.9 / 17.8 / 16.4 |
| mountain_biking | 0.6 | 2 | 400 | 200 | 0.0971 | 0.0637 | 4.4 / 9.9 / 17.8 / 16.4 |
| trail_running | 0.6 | 2 | 400 | 200 | 0.1270 | 0.0637 | 4.4 / 9.9 / 17.8 / 16.4 |
| bouldering | 0 | undef | undef | undef | 0 | 0 | — (no cyclic/linear path) |
| camping | 0 | undef | undef | undef | 0 | 0 | — (no cyclic/linear path) |
| fishing | 0.4 | 9 | 127 | 64 | 0.0842 | 0.0383 | 4.1 / 6.2 / 9.3 / 10.1 |
| kayaking_lake | 0 | undef | undef | undef | 0 | 0 | — (no cyclic/linear path) |
| cycling_road_flat | 0 | undef | undef | undef | 0 | 0 | — (no cyclic/linear path) |
| snowshoeing | 2.0 | undef | undef | undef | 0 | 0.1145 | — (no cyclic/linear path; steady-state path with trapped=0.115, fatigue=0.00101) |

**Observations:**
- PHY-063 continuous activities (day_hike, backpacking, running, mountain_biking, trail_running) route through the cyclic engine with 1-hr cycles → identical output except `peakSaturationFrac` (running and trail_running produce 0.127 vs 0.097 for the others — activity-specific MET/pace factor).
- Three activities (bouldering, camping, kayaking_lake, cycling_road_flat) produce all-zero output — these fall through to a no-op / steady-state path that doesn't populate cyclic metrics.
- fishing: 9 × 13-min cycles over 2hr, sessionMR 0.4.
- snowshoeing: sessionMR 2.0 but undef totalRuns — steady-state path with trapped=0.115.

---

## Spec §9 comparison — ski vectors

Per S31 kickoff §2 user-expected pre-reconciliation sessionMR targets: G1 ~1.5, M2 ~1.5, P5 ~2.5. Tolerance for "baselines match spec assumption": ±0.5.

| Vector | Observed sessionMR | Spec §9 pre-reconciliation target | Δ | Within ±0.5 tolerance? |
|---|---|---|---|---|
| G1 | 2.2 | 1.5 | +0.7 | **NO** |
| M2 | 6.8 | 1.5 | +5.3 | **NO** |
| P5 | 4.8 | 2.5 | +2.3 | **NO** |

**All three ski vectors diverge from spec §9 pre-reconciliation assumption by more than ±0.5.**

### Divergence analysis (Code observations for Chat review)

1. **M2's sessionMR of 6.8 significantly overshoots the spec §9.3 post-reconciliation target of 4.3.** The engine at HEAD is already producing higher MR at these inputs than the reconciliation spec predicts *post*-patch. This suggests one of:
   - The "pre-reconciliation MR ~1.5" assumption in spec §9.3 does not match actual engine behavior at HEAD 78cd56a
   - The spec's reference gear ensemble (`totalCLO=2.60, ensembleIm=0.089`) produces higher saturation in this engine than the spec author's mental model predicted
   - Duration penalty or saturation cascade is amplifying MR over the 8.5-hour session more than spec §9 accounted for

2. **Final layer buffer fills at M2:** base 68%, mid 79%, insulative 92%, shell 92% — ensemble is near-saturation pre-reconciliation, consistent with sessionMR 6.8 (high-saturation regime).

3. **P5 tier mismatch:** spec §9.4 says "Tier 5 Packed via powder bump", engine produces `crowdTier=6`. The powder flag with a Saturday in peak-season (baseline Tier 4 Busy) lands at Tier 6 Mayhem per the engine's `getCrowdFactor` logic. This affects `totalCycles` (12 per spec vs 11 observed) and `cycleMin` (40 per spec vs 46.25 observed).

4. **The S29 4-scenario matrix produced sessionMR 1.50 / 3.90 / 3.00 / 1.00** for S1/S2/S3/S4 scenarios — but those were shorter (6hr) sessions with different inputs (temp, ensemble) and read `peak_MR` from `four_pill.your_gear.trajectory_summary`, not `sessionMR` from `calcIntermittentMoisture`. Metric identity confirmed as a separate concern in `S29-MATRIX-PENDING`.

### Recommended next step

Halt pre-Phase-A and escalate to Chat for review of spec §9 pre-reconciliation expectations. Options:
- **(a)** Spec §9's pre-reconciliation target values are incorrect; baselines as captured become the authoritative pre-patch state.
- **(b)** Baseline-capture inputs or fixture configuration diverge from spec §9.2 in a way that invalidates comparison (e.g., my approximation of `warmthRatio/breathability/moisture` per gear layer doesn't match spec's implicit ensemble model).
- **(c)** Engine state at 78cd56a has genuinely drifted from the state spec §9 was authored against — investigate via bisect against earlier commits.

---

## Engine field mapping notes

- `totalCycles` (spec §9) maps to `totalRuns` in `IntermittentMoistureResult` (observed)
- `cycleMin`, `cycleMinRaw` not exposed on the result object — only the input `cycleOverride` carries them
- `_totalFluidLoss` (spec) maps to `totalFluidLoss` (result) — no underscore prefix in public result
- `_cumStorageWmin` (spec) not found on result; closest field is `totalHeatBalanceWh`
- `_perCycleMR` (spec) maps to `perCycleMR` (result, nullable)
- `_perCycleHeatStorage` (spec) maps to `perCycleHeatStorage` (result, nullable)
- Spec's layer-fill nomenclature `base/mid/insulative/shell` maps to `endingLayers[0..3]` with buffer/cap fields

---

**Ready for Chat review before Phase A proceeds.**
