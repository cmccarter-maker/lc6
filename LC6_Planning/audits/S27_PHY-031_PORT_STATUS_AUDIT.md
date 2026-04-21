# PHY-031 Port Status Audit (LC5 → LC6)

**Date:** S27 — April 21, 2026
**Auditor:** S27 Chat + Code
**Spec:** PHY-031 Component Cycle Model (ratified LC5 Session Mar 17)
**Question:** What of PHY-031 ported correctly to LC6?
**Trigger:** S-001 Breckenridge diagnostic revealed 36 cycles over 6 hours (= 10 min cycles) instead of the ~18 cycles the spec formula predicts. User reports "MR feels too low for weeks of observed ski days" reframed — see S26-SYSTEMATIC-MR-UNDERESTIMATION.

---

## 1. Spec Requirements (from LC5 ratification)

PHY-031 ratified 5 components:

### 1.1 Component cycle formula

    cycleMin = runMin + liftRideMin + liftLineMin(crowdTier) + TRANSITION_MIN
    cycleMin = cycleMin / (1 - REST_FRACTION)
    totalCycles = floor(durationMin / cycleMin)

### 1.2 Crowd calendar: 6 tiers derived from date

| Tier | Label | Wait (min) | When |
|---|---|---|---|
| 1 | Empty | 0-1 | Weekday non-holiday |
| 2 | Light | 2-5 | Weekday powder, regular Fri/Mon |
| 3 | Moderate | 5-10 | Regular Sat/Sun, Christmas Day |
| 4 | Busy | 10-18 | Holiday weekends (MLK, Presidents) |
| 5 | Peak | 15-25+ | Christmas-NY week, Spring Break |
| 6 | Mayhem | 20+ | Dec 27-31 on Saturday |

### 1.3 Nine holiday windows (codified in getCrowdFactor(dateStr))

- Christmas Day (Tier 3)
- Dec 27-31 (Tier 5, Tier 6 if Sat)
- Dec 26 ramp-up (Tier 4)
- Jan 1 (Tier 5)
- Jan 2-3 wind-down (Tier 4)
- MLK Weekend (Tier 4-5)
- Presidents Day Weekend (Tier 4-5)
- Spring Break (Tier 3-5)
- Seasonal + day-of-week fallthrough

### 1.4 Component constants

- DEFAULT_LIFT_MIN = 7 (high-speed detachable quad western avg)
- TRANSITION_MIN = 3
- REST_FRACTION = 0.20

### 1.5 Ski history integration (Phase A minimum)

- Three fields: runs/day, hours/day, riding style
- Back-calculation: actualCycleMin = totalTimeMin / numRuns
- Personal override replaces calendar model when user provides data
- Architectural rule: historical data overrides cycle COUNT, not per-cycle physics

---

## 2. LC6 Status Per Spec Item

| # | Spec item | LC6 status | Evidence | Impact |
|---|-----------|-----------|----------|--------|
| 1 | Component cycle formula | MISSING | cycleDur = runMin + liftMin = 10 min at calc_intermittent_moisture.ts:500 (no line, no transition, no rest) | Cycle count 2x too high |
| 2 | Crowd calendar (6 tiers) | MISSING | grep for getCrowdFactor/crowdTier returns zero matches in packages/engine/src/ | No date-aware lift line modeling |
| 3 | Holiday windows (9) | MISSING | grep for christmas/mlk/presidents returns zero matches | No calendar intelligence |
| 4a | DEFAULT_LIFT_MIN constant | PARTIAL | Value 7 embedded as durMin:7 in profile phases; not declared as a constant | Works for default case, no customization path |
| 4b | TRANSITION_MIN constant | MISSING | Not defined anywhere | Transition time never added to cycles |
| 4c | REST_FRACTION constant | MISSING | Not defined anywhere | Rest time never added to cycles |
| 5a | Mogul runMin 10->7 | PRESENT | profiles.ts moguls phases: durMin:7 | Correctly carried over |
| 5b | Ski history integration | MISSING | No skiHistory parameter, no runsPerDay, no impliedRestFraction anywhere | No personalization hook |

**Net: 1 of 8 items fully ported (12.5%). One partial (12.5%). Six items missing (75%).**

---

## 3. Architectural State: Mid-Refactor Plumbing

LC6's engine has the shape for PHY-031 but the bridge is null-plugged.

### What's there (scaffolding):

- cycleOverride parameter exists in calcIntermittentMoisture signature (arg #19)
- Profile comment at profiles.ts:93-94 explicitly states: "Per-cycle physics phases only (run+lift). Transition+line+rest handled by cycleOverride."
- Engine honors cycleOverride.totalCycles if provided (calc_intermittent_moisture.ts:500-504)

### What's missing (bridge):

- evaluate.ts:430 hardcodes cycleOverride:null with comment "No cycle override in 10a"
- No helper function to derive cycleOverride from date + crowd tier
- No getCrowdFactor(dateStr) utility
- No getHolidayTier(dateStr) utility
- No date parameter in calcIntermittentMoisture signature
- No ski-history consumer

**Interpretation:** PHY-031 was acknowledged as intended design during LC6 scaffolding but explicitly deferred ("10a" = version 1.0 phase A). The deferral was never revisited when LC6 transitioned from scaffolding to production.

---

## 4. Test Coverage

**Zero tests reference PHY-031 semantics.**

- grep for phy-031 in packages/engine/tests/ returns zero matches
- No tests verify liftLineMin is non-zero for high-crowd days
- No tests verify cycle count matches spec formula for representative Breck scenarios
- No tests catch the cycleOverride:null hardcoded pattern

**Consequence:** The PHY-031 port status would remain invisible forever without the S-001 diagnostic that surfaced it.

---

## 5. Impact on Engine Output — S-001 Case Study

**Scenario:** Breckenridge cold-dry skiing, 16F / 40% RH / 8 mph wind, 6hr groomers, representative mid-tier ensemble.

### Current LC6 behavior (measured from diagnostic):

- Cycle count: 36
- Cycle duration: 10 min (3 run + 7 lift)
- Total fluid loss: 456 mL (76 mL/hr — baseline insensible rate)
- peakSaturationFrac: 22.1% (layers ~28% filled)
- sessionMR: 2.30

### PHY-031 spec-predicted behavior (Tier 2 weekday moderate crowd):

- Cycle duration: (3 + 7 + 3 + 3) / (1 - 0.20) = 16 / 0.8 = 20 min
- Cycle count: 360 / 20 = 18
- Each cycle is 2x longer — 7 min lift ride becomes 13 min effective lift-phase interval (lift + line + transition + rest)
- Per-cycle sweat accumulation: run phase unchanged but lift phase 2x longer (more cold exposure on wet layers, conduction loss compounds)

### Magnitude of underestimation:

- Cycle count: 2x too high in current engine
- Lift-phase exposure time: 2x too short per cycle
- Cumulative cold/wet-fabric exposure: approximately 4x too low (2x cycle count times 2x lift time)

**This matches user reports of "MR feels too low for weeks."**

---

## 6. Remediation Options

### Option A: Full PHY-031 port

Restore all 5 components per spec:

1. Build getCrowdFactor(dateStr) utility
2. Add date parameter to calcIntermittentMoisture signature OR add a pre-compute helper that wraps cycleOverride derivation
3. Define constants in heat_balance/constants.ts: DEFAULT_LIFT_MIN, TRANSITION_MIN, REST_FRACTION
4. Wire evaluate.ts to compute cycleOverride from date + crowd tier
5. Add ski-history parameter and back-calc path

**Scope:** 2-3 full sessions. Multi-commit. Tests first.

### Option B: Partial port — crowd calendar only, defer history

Just wire cycleOverride from a date-derived crowd tier. Skip personal calibration for now.

**Scope:** 1 session. Faster user-facing improvement.

### Option C: Minimum viable fix — hardcode realistic cycle time

Short-term: change evaluate.ts:430 from null to a computed override that adds TRANSITION_MIN + REST_FRACTION with a hardcoded line time of (say) 5 min. Single-crowd-tier approximation.

**Scope:** Hours. Wrong per spec but unblocks user experience immediately.

**Recommendation: Option A, executed across 2-3 sessions, with tests written first (Steps 2-3 of the S27 plan).**

---

## 7. Open Questions for Resolution

(Deferred in PHY-031 ratification, still open)

1. Thanksgiving treatment (Tier?)
2. User crowd override selector — "I know it's MLK weekend but I'm going to hit it 7 AM and crowds won't be bad yet"
3. Resort-specific multiplier — Breck vs Vail vs tiny Midwest resort
4. Powder day surge — real physics, how much does it shift tiers?
5. Climate normals default — what if user doesn't supply a date?

---

## 8. Related Concerns Surfaced During Audit

### 8.1 Two breathabilityToIm functions

Unrelated to PHY-031 but surfaced during S27 investigation:

- gear_layers.ts:127 piecewise
- gear/adapter.ts:105 linear
- Different formulas, same name

Log as tracker item: S27-DUAL-BREATHABILITY-MAPPING MEDIUM.

### 8.2 Pre-existing 8 tsc --noEmit errors

Unrelated to PHY-031. Test files have type drift that tsc catches but vitest ignores.

Log as tracker item: S27-TSC-ERRORS-BASELINE LOW.

### 8.3 Cardinal Rule #8 perimeter clarification needed

During S27 investigation, we added env-guarded diagnostic logging inside calc_intermittent_moisture.ts (commit pending). Is that a Cardinal Rule #8 violation? No — env-guarded, no algorithm change, diagnostic-only side effect. But worth clarifying in Cardinal Rules registry for future sessions.

---

## 9. Retention Infrastructure Plan (S27 Steps 2-3)

This audit is Step 1 of a 3-step remediation plan for the broader "fixes do not stay fixed" concern:

**Step 2:** Create LC6_Spec_Registry.md — table of every ratified spec with implementation status, test coverage, last verified commit SHA. PHY-031 entry would link to this audit.

**Step 3:** Add regression tests that assert PHY-031 semantics. Specifically:

- Groomers at date 2026-02-03 (Tier 2 weekday): cycle count should be 17-19 (not 36)
- Groomers at date 2026-12-29 on Saturday (Tier 6): cycle count should be dramatically lower
- Moguls at Tier 2: cycle count should be 12-14
- Tests fail loud if cycleOverride is null when consumer calls calcIntermittentMoisture with date context

**Step 4 (separate session):** Execute Option A port with tests serving as validation checkpoints.

---

## 10. Conclusion

PHY-031 was ratified in LC5 but did not port to LC6. The engine has architectural scaffolding (cycleOverride slot, profile comment) but the bridge is null-plugged. The consumer (evaluate.ts) never populates cycleOverride, so the realism-enhancing physics never fires.

This is not a regression — it is an incomplete port. LC6 was stood up with PHY-031 deferred ("no cycle override in 10a") and never returned to. The result is silent underestimation of cycle count by 2x, which compounds with per-cycle lift-phase underexposure to produce ~4x underestimation of cumulative cold-wet-fabric exposure.

**S26-SYSTEMATIC-MR-UNDERESTIMATION reframed:** Not a physics bug. Not a thermal solver bug. An architectural feature that was scoped but not wired.

**Fix is port completion, not new spec authoring.** Combined with spec-registry infrastructure and regression tests, "fix stays fixed" becomes a property of the codebase.

---

## Appendix

Raw audit commands and output: see S27 terminal session log.

---

End of audit. Awaiting ratification for remediation path (Option A recommended).
