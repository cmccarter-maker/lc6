# S28 Session Kickoff — PHY-031 Spec Port

**Created:** S27 close, April 21, 2026
**Session type:** Chat-led spec authoring
**Branch:** `session-13-phy-humid-v2` at commit `3bcd853` or later
**Reading time:** ~15 minutes before proposing any work

---

## STOP. Before doing anything, read these first:

1. This entire kickoff doc
2. Top status block of `LC6_Planning/LC6_Master_Tracking.md` (read until "Historical record — Session 26" — that's the boundary)
3. `LC6_Planning/LC6_Spec_Registry.md` (full file, ~150 lines)
4. `LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md` (full file, 242 lines)

Do NOT start drafting, planning, or proposing work until these 4 reads are complete. Total ~15 minutes. This prevents repeating the mistakes cataloged below.

---

## Session scope

**Author `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md`.**

One deliverable. Spec doc only. NO implementation. NO engine changes. Implementation is S29's job.

Source material:
- LC5 archive (PHY-031 original ratification Mar 17, 2026)
- `LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md` (the audit that triggered this port)
- User's research (ski speed data, crowd tier research, holiday calendar)

Expected length: 600-1000 lines, comparable to PHY-HUMID-01_Spec_v2_RATIFIED.md

---

## Critical context to preserve — DO NOT LOSE

These are the specific items that took research or reasoning you cannot easily recreate. If the new Chat loses track of these, weeks of work are lost again.

### 1. Component cycle formula (PHY-031 core)

Constants (ratified LC5):
- `DEFAULT_LIFT_MIN = 7` (high-speed detachable quad western avg)
- `TRANSITION_MIN = 3`
- `REST_FRACTION = 0.20`

Per-terrain run durations (ratified LC5):
- Groomers: 3 min (though user's S27 research suggests 6-10 min for advanced skiers — see "open questions" below)
- Moguls: 7 min (corrected from 10 in LC5 PHY-030 revision)
- Trees: 10 min
- Bowls: 6 min
- Park: 4 min

### 2. Crowd calendar — 6 tiers

| Tier | Label | Wait (min) | When |
|------|-------|------------|------|
| 1 | Empty | 0-1 | Weekday non-holiday, non-powder |
| 2 | Light | 2-5 | Weekday powder, regular Fri/Mon |
| 3 | Moderate | 5-10 | Regular Sat/Sun, holiday Fri/Mon, **Christmas Day** |
| 4 | Busy | 10-18 | Holiday weekends (MLK, Presidents) |
| 5 | Peak | 15-25+ | Christmas-New Year's week, Spring Break |
| 6 | Mayhem | 20+ | Dec 27-31 falling on Saturday |

### 3. Nine holiday windows codified in `getCrowdFactor(dateStr)`

1. Christmas Day (Tier 3 — counter-intuitive, families often skip ski day)
2. Dec 27-31 (Tier 5, Tier 6 if Saturday)
3. Dec 26 ramp-up (Tier 4)
4. Jan 1 (Tier 5)
5. Jan 2-3 wind-down (Tier 4)
6. MLK Weekend (Tier 4-5, Saturday being peak)
7. Presidents Day Weekend (Tier 4-5)
8. Spring Break (Tier 3-5 depending on day)
9. Seasonal + day-of-week fallthrough

Sources (verified in LC5 research):
- Vail Resorts press release Mar 2025: 3% of lift waits exceed 10 min
- SkiTalk data: Baker weekdays "ski-on, ski-off"; Stevens Pass weekends 5-10 min
- Copper Mountain Saturday data
- Whistler data
- Mammoth "20 min lines" peak
- PeakRankings commentary

### 4. Ski history integration — personal calibration

**Architectural rule (critical):** Historical data overrides cycle COUNT, not per-cycle physics. MET, sweat rate, cold penalty remain driven by the thermodynamic engine.

Three phases:
- **Phase A (minimum viable):** Three manual-entry fields: runs/day, hours/day, riding style. Back-calculate `actualCycleMin = totalTimeMin / numRuns`. Personal override replaces calendar model.
- **Phase B:** Screenshot import (EpicMix, Slopes end-of-day summaries). AI extracts numbers.
- **Phase C:** GPX file import. Per-run decomposition via GPS + gradient.
- **Phase D:** Strava/Garmin OAuth integrations.

Data source feasibility (from S17 research):
- Strava API: HIGH (public REST, OAuth, ski activity type)
- Garmin Connect: HIGH (vert/runs/time/HR)
- Apple Health: MEDIUM (HealthKit on-device only, needs native wrapper)
- Slopes: LOW (export-only, no API)
- EpicMix/Ikon: LOW (walled gardens)

### 5. The ski-speed research user provided in S27

From user's S27 uploaded research (ScienceDirect + Stepan et al. 2023 JSAMS Plus):

**Advanced skiers on groomers:**
- 3-5 min per 1,000 vft
- Speed 44.5 ± 11.7 km/h (≈27-28 mph)
- 8,000-10,000 vft/hr on high-speed lifts (big-day pace)

**All-observations study (Stepan 2023):**
- Average across 4,164 observations: 34.9 km/h
- Advanced: 44.5 km/h
- "Most difficult" slopes (21-30°): 42.6 km/h

**Implication for Breckenridge realistic cycle:**
- Peak 8 top-to-base ~2,000 vft
- Advanced descent: 6-10 min (not 3)
- Lift ride on 6-pack: 4-6 min (not 7)
- Cycle total: 16-27 min (not 10)
- 18 cycles in 6 hours (not 36)

**This research is WHY the current engine shows 36 cycles when reality is ~18.** It validates the PHY-031 component cycle formula against lived experience.

### 6. Cycle-averaging is forbidden — NEVER do it in analysis

**The human body does not average.** It experiences each phase separately:
- Run phase: body as furnace, thermal surplus
- Lift phase: body as cooling object, thermal deficit

Cycle-averaging destroys:
1. Thermal deficits that compound (Ensemble A -25W vs B -55W both show cycle-avg S≈0, but B accumulates 1,080 W·min more cold over 36 lifts)
2. Moisture-thermal coupling (wet layer from cycle 10 worsens cycle 20 lift deficit)
3. Perception timing (user feels the last 2 min of a 7-min lift, not the average)
4. Ensemble differentiation (averaging makes all ensembles look the same)
5. Physics regulation boundaries (vasoconstriction thresholds, vasodilation activation)

**This is WHY** `calcIntermittentMoisture` has `perPhaseMR[]`, `perPhaseHL[]`, `_cumStorageWmin`. Phase resolution, always.

If new Chat starts computing "cycle-averaged metabolic output is X watts," STOP. Reread this section.

---

## 8 Cardinal Rules (LOCKED — no session may violate without explicit re-ratification)

1. **No fudge factors.** Every constant traces to (a) published source, (b) derivation, or (c) explicit GAP flag. Never fill gaps with "starting values."
2. **`im_ensemble` drives evaporation, NOT CLO.**
3. **Single source of truth = canonical engine output object.**
4. **No hardcoded constants in display.**
5. **Wind chill = display only, never model input.**
6. **No double-dipping.**
7. **`T_skin` computed from heat balance, never assumed constant.**
8. **Thermal engine is LOCKED.** `iterativeTSkin`, `computeEmax`, `getDrainRate`, `computeSweatRate`, `calcIntermittentMoisture`, `heatLossRisk`, and energy balance functions are NOT MODIFIED without Chat-produced code AND hand-computed verification. Env-guarded diagnostic logging (e.g. `if (process.env.VAR) console.log(...)`) is SAFE and does NOT violate Rule #8.

Additional physics-derived rules (not numbered but equally binding):
- **Strategy winner = MR-min (not CDI)** subject to feasibility gates. CDI < 4.0 is a safety gate only.
- **Microclimate VP reverted** — `im_ensemble` already includes skin-to-ambient gradient from ISO 9920.
- **Helmet rule:** NEVER recommend removing helmet. Manage heat via vents.
- **Denali safety gate:** 15,000 ft (not 20,000). Catches Kilimanjaro, Elbrus, Aconcagua.

---

## Two-Agent Discipline (LOCKED)

Chat writes exact code. Code applies verbatim. Every deviation has caused problems.

**Chat's responsibilities:**
- Analyze, spec, author specs, QA physics, design tests
- Produce exact patches with byte-exact `old_str` and `new_str`
- Never ask Code to interpret "approximately here" or "somewhere near line X"
- Read actual code before writing scripts — never assume `gearDB` shape or function existence
- Pick a direction instead of presenting options menus (exception: explicit user decision points)
- Verify before acting — if a diagnosis feels fast, slow down

**Code's responsibilities:**
- Apply Chat-produced scripts verbatim, nothing more
- Run verification commands and REPORT output, do NOT proceed to next action without explicit authorization
- Never expand scope ("add 1" must not become "add 1 + 2 extras for completeness")
- Never modify files outside Chat's specified scope
- Flag ambiguity instead of guessing

**Critical authorization gates:**
- When Chat says "verify with grep, then STOP and wait for authorization," Code runs grep, pastes output, stops. Does not proceed to apply the patch.
- When Chat authorizes Option A, Code does Option A only. Not A+B for completeness.
- When in doubt, ask.

**Failure modes documented from S27 that WILL happen again without vigilance:**

- **Chat proposes unification specs from memory without reading code.** Caught today when Chat was about to author PHY-SWEAT-UNIFICATION; user intervention forced Code grep that revealed the "two sweat rates" hypothesis was wrong. New Chat: read code before spec authoring.
- **Chat cycle-averages metabolic output.** Caught 3 times across sessions. User has said "third time I've had this conversation." New Chat: phase-resolution only.
- **Chat makes fast diagnoses, is wrong, user must correct.** Pattern repeats. New Chat: slow down, verify, test hypothesis before concluding.
- **Code applies patches without explicit authorization.** Happened today (S27 commit 6984c77 trace instrumentation applied before Chat said "apply"). New Chat + Code: strict gate discipline.
- **Code expands scope from Option A to Option B.** Happened today in PATCH 4 (Section A rows). Chat authorized 1 new row; Code proposed 3. New Chat + Code: Option A means Option A.

---

## 5 Open Questions from PHY-031 ratification — RESOLVE WITH USER BEFORE DRAFTING SPEC

These were deferred in LC5 and are still open. Do NOT auto-decide. Ask user explicitly, get answer, record in spec.

1. **Thanksgiving treatment** — What tier? (Ski resorts typically busy Wed-Sun; suggest Tier 3-4 weekday, Tier 4-5 weekend)
2. **User crowd override selector** — Should user be able to say "I know it's MLK weekend but I'll hit lifts at 7 AM before crowds" and override the default? If yes, where does that go in the UI?
3. **Resort-specific multiplier** — Breckenridge crowd behavior differs from tiny Midwest resort. Is this in scope for v1? If yes, what's the signal (resort size? destination vs local?)?
4. **Powder day surge** — When the resort reports fresh snow, crowds shift up 1-2 tiers. Is this modeled? How does powder-day status reach the engine?
5. **Climate normals default** — If user doesn't supply a date, what crowd tier is assumed? (Proposal: Tier 2 Light as optimistic default, with user notification)

**Also from user's S27 research (new question for PHY-031 v1):**

6. **Run duration revision** — User's ski speed research suggests groomer runs are 6-10 min for advanced skiers (not 3 min as in LC5 PHY-031). Does the LC6 PHY-031 spec revise these values? Or hold 3 min as "intermediate" and add a "vigorous groomers" terrain variant? Or make run duration user-selectable via riding style input?

---

## Known drift items (from S27 B.18) — DO NOT accidentally touch or recreate

- **S27-DRIFT-1-PERCEIVED-MR-FILENAME** (LOW): Rename `PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md` → `_REVERTED.md`. 5-minute cleanup. NOT S28 scope.
- **S27-DRIFT-2-HUMID-V1-FILENAME** (LOW): Rename `PHY-HUMID-01_Spec_v1_RATIFIED.md` → `_SUPERSEDED.md`. 5-minute cleanup. NOT S28 scope.
- **S27-DUAL-BREATHABILITY-MAPPING** (MEDIUM): Two `breathabilityToIm` functions with different formulas. Independent of PHY-031. NOT S28 scope.
- **S27-TSC-ERRORS-BASELINE** (LOW): 8 pre-existing tsc errors in test files. Independent. NOT S28 scope.

These are tracked. Don't forget they exist, but don't touch them in S28.

**Also flagged:** Several LC6_Planning docs appear stale (LC6_Session_Ledger.md, LC6_Open_Issues_Ledger.md, LC6_Decision_Registry.md, LC6_Architecture_Document.md — all last touched Apr 20, missing S16-S27 entries). This is a separate drift pattern from the Spec Registry case. User deferred handling to later session. Do not use those docs as authoritative. The tracker + registry + audits are canonical.

---

## Success criteria for S28

Session is complete when:

1. File exists: `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md`
2. Spec content sourced from LC5 archive + S27 audit + this kickoff's critical context
3. All 6 open questions resolved with user input (not auto-decided)
4. Spec includes verification criteria that the S29 implementation can be tested against
5. Spec includes references to the spec-lock tests at `packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts` — the 25 `.todo` placeholders map to spec sections
6. Tracker updated:
   - Add `S28-APPLIED` marker
   - New "Status as of Session 28" block
   - `S27-DRIFT-3-PHY-031-NO-SPEC` status → CLOSED (replaced by new spec file)
   - PHY-031 row in Section A updated: `NOT_PORTED` → `RATIFIED (spec), NOT_IMPLEMENTED (engine, S29 target)`
7. Spec Registry updated: PHY-031 row status + file path + last verified commit SHA
8. S28 close commit clean, pushed, log shows chain intact

Expected session length: 2-4 hours depending on how long the 6 open questions take to resolve.

**What S28 is NOT:**
- NOT implementation of any engine code
- NOT modifying profiles.ts run/lift durations
- NOT building `getCrowdFactor` utility
- NOT unlocking spec-lock `.todo` tests
- NOT wiring `evaluate.ts:430`

All of that is S29.

---

## Opening move for S28 Chat

After reading all required material, first message to user should be:

> "S28 kickoff read complete. Understanding: author LC6 PHY-031 spec doc based on LC5 archive + S27 audit + user's ski speed research. 6 open questions need user input before drafting. Ready to work through the open questions, then structure the spec. Which question do you want to tackle first, or should I propose a default ordering?"

This pattern — state understanding, identify decisions needed, propose path — is the correct Chat opening move. NOT "let me start drafting" or "I'll figure out the open questions as I go."

---

## References

- LC6_Planning/LC6_Master_Tracking.md (canonical tracker)
- LC6_Planning/LC6_Spec_Registry.md (PHY-031 row in NOT_PORTED status)
- LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md (full audit)
- packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts (lock tests with 25 .todo)
- packages/engine/src/activities/profiles.ts:93-94 (comment acknowledging PHY-031 design)
- packages/engine/src/moisture/calc_intermittent_moisture.ts:247,297,500-504 (cycleOverride scaffolding)
- packages/engine/src/evaluate.ts:430 (the null-plug line)
- LC5 archives: lc5_risk_functions.js in packages/engine/reference/ (physics source of truth)

---

End of S28 kickoff. Next Chat: follow the opening move above.
