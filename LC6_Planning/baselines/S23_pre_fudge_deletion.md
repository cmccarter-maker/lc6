# Baseline snapshot — pre S23 fudge deletion

**Session:** 23 (2026-04-20)
**Commit state:** a6bd255 (S23 spec + registry + tracker)
**Tests at snapshot:** 643/643 passing

---

## Purpose

Capture engine state before deleting two fudge multipliers. After deletion, we compare output to this baseline to verify the direction and magnitude of physics changes.

---

## What is being deleted

### dryAirBonus

Defined at `packages/engine/src/moisture/calc_intermittent_moisture.ts:451`:

```
const dryAirBonus = humidity < 20 ? 1.8 : humidity < 30 ? 1.4 : humidity < 40 ? 1.15 : 1.0;
```

Used as a multiplier on raw evaporation rate at lines 529 and 1069.

### _localDryBonus

Defined at `packages/engine/src/moisture/calc_intermittent_moisture.ts:385`:

```
const _localDryBonus = _localRH < 20 ? 1.8 : _localRH < 30 ? 1.4 : _localRH < 40 ? 1.15 : 1.0;
```

Used as a multiplier on step-level raw evaporation at line 386.

Both are staircase approximations of VPD narrowing in dry conditions. The canonical `vpdRatio(tempF, humidity)` at `heat_balance/vpd.ts:45` already captures this physics via the Magnus formula. Multiplying `vpdRatio` by these staircases double-counts the dry-air effect.

---

## What is preserved this session

### humidityFloorFactor

Defined at `packages/engine/src/heat_balance/utilities.ts:48`. Used at `packages/engine/src/activities/split_body.ts:160` as an evaporation floor.

PHY-HUMID-01 v2 §4.2 calls this redundant with `vpdRatio`. However, investigation during S23 morning revealed that this function's original purpose was Cooper Landing protection: a stationary fisher at 100% RH where the sweat-only model under-predicts MR. The floor ensured evaporation did not drop to near-zero in saturated ambient conditions.

S22 commit 51885be activated `_aHygro` (ambient hygroscopic absorption routing to shell buffer). This new physics may now handle the Cooper Landing regime properly, making the floor redundant. But this has not been verified.

Deletion deferred pending investigation. Logged as `S22-HUMIDITY-FLOOR-VALIDATION` in tracker Section B.17.

---

## Expected behavioral changes

Deleting the two fudges reduces evaporation in dry-air scenarios. Reduced evaporation means more retained moisture, which means higher MR in those scenarios.

### Fudge activation thresholds

| RH range | dryAirBonus / _localDryBonus value |
|---|---|
| RH < 20% | 1.8 |
| 20 <= RH < 30% | 1.4 |
| 30 <= RH < 40% | 1.15 |
| RH >= 40% | 1.0 (no boost) |

### Impact by RH bracket

- **RH >= 40%:** Zero shift. The fudge returned 1.0 in this range. Most test scenarios live here.
- **RH 30-39%:** Evaporation drops by ~13%. Expect MR shift of 0.1-0.5 units upward.
- **RH 20-29%:** Evaporation drops by ~29%. Expect MR shift of 0.5-1.5 units upward.
- **RH < 20%:** Evaporation drops by ~44%. Expect MR shift of 1.0-2.0 units upward.

---

## Test scenarios most likely to shift

### No expected shift (RH >= 40%)

- `ensemble_physics.test.ts:76` — humidity: 50
- `real_gear.test.ts:166, 205` — humidity: 45
- `s18_smoke.test.ts:72` — humidity: 40 (threshold — depends on < vs <=, verify post-fix)
- `s21_duration_sweep.test.ts:69` — humidity: 40 (threshold)
- `enumerate.test.ts:174` — humidity: 45
- Most `cm_budget.test.ts` scenarios

### Expected minor shift (RH 30-39%)

- `enumerate.test.ts:208` — humidity: 40 (threshold)
- `enumerate.test.ts:250` — humidity: 40 (threshold)
- `real_gear.test.ts:245` — humidity: 40 (threshold)
- `diagnostic.test.ts:259` — humidity: 40 (threshold)

### Expected significant shift (RH below 30%)

- `adversarial_matrix.test.ts` C1 scenario — tempF: -20, humidity: 30, windMph: 8, ski, 4hr
  - Hits `humidity < 30` = false but near boundary; hits `humidity < 40` = true → fudge = 1.15
  - Evap reduction ~13% → expect MR increase 0.2-0.6 units

Note: the adversarial matrix does not include any scenarios below 30% RH, so the worst-case fudge values (1.4 and 1.8) never fire in current test coverage. Test shifts should be modest.

---

## Validation protocol

After the fudge deletion commit:

1. Run the full test suite.
2. For each failing test, document:
   - Scenario conditions (temp, humidity)
   - Baseline value (current assertion)
   - New value (post-deletion output)
   - Delta and direction
3. Verify each delta matches expected direction: **all shifts should be UP** because evaporation is reduced. Any DOWN shift indicates a bug and must be investigated before proceeding.
4. Verify each delta magnitude is reasonable given the RH bracket.
5. Update test assertions with new expected values.
6. Document the full delta table in the test-update commit message.

---

## Sources and rationale

- PHY-HUMID-01 v2 §4.1 specifies deletion of both `dryAirBonus` and `_localDryBonus`.
- PHY-HUMID-01 v2 §4.2 specifies deletion of `humidityFloorFactor`. Deferred per S23 morning investigation.
- `vpdRatio` defined at `packages/engine/src/heat_balance/vpd.ts:45`. Canonical VPD calculation via Magnus formula.
- Magnus formula: Alduchov & Eskridge 1996.
- Original humidity floor design: intended for Cooper Landing stationary fishing scenario. History preserved in Session 11 chat records.

---

## What this baseline does NOT capture

- Explicit per-scenario numeric output from the engine. That would require running the engine against each scenario and capturing sessionMR, per-cycle trajectories, and layer buffer states. Judged excessive for a fudge deletion this bounded.
- Live verification that fudge is currently firing as expected in scenarios. Code reading confirms presence; empirical firing confirmed by the existence of test assertions calibrated against current behavior.

If the post-deletion test suite reveals unexpected shifts, those tests serve as implicit baseline documentation via their current assertion values. We can always reconstruct what the engine was doing by running against a pre-deletion checkout.

---

*End of baseline snapshot.*
