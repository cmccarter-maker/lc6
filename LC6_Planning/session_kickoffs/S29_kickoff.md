# S29 Session Kickoff — PHY-031 Engine Port

**Created:** S28 close, April 21, 2026
**Session type:** Code-executed engine port + tests, Chat produces all patches
**Branch:** `session-13-phy-humid-v2` at commit `8e93495` (S28 close) or later
**Reading time:** ~20 minutes before proposing any work

---

## STOP. Before doing anything, read these first:

1. This entire kickoff doc
2. `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` — **the full 616-line spec** (S28 ratified). This is the single source of truth for every value, formula, and verification target in this session.
3. `LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md` — the audit that identified what's missing
4. Top status block of `LC6_Planning/LC6_Master_Tracking.md` through end of Session 28 historical record
5. `LC6_Planning/LC6_Spec_Registry.md` PHY-031 row (post-S28 status: RATIFIED / PARTIAL)

Do NOT start coding, editing, or proposing patches until these 5 reads are complete. Total ~20 minutes. The S28 failure mode — Chat re-deriving ratified work from memory — is specifically dangerous in S29, where the spec has concrete values that must be ported verbatim. Read the spec first.

---

## Why this session exists

PHY-031 is the component cycle model for resort skiing/snowboarding. S27 audit confirmed that LC5's ratified version (Mar 17, 2026) is only 12.5% ported to LC6. Six of eight spec components are missing; the bridge between the component-cycle design and the thermal engine is null-plugged at `evaluate.ts:430` with the comment "No cycle override in 10a."

S28 authored the LC6-canonical spec. S29 executes the port.

This is **the fix for `S26-SYSTEMATIC-MR-UNDERESTIMATION`**. S-001 Breckenridge diagnostic currently produces 36 cycles in a 6-hour session where the spec predicts ~18. Cumulative cold-wet-fabric exposure is ~4× underestimated. Post-port, MR at real ski scenarios is expected to land in a range that matches lived experience (comparable to LC5's Mar 24 Breck moguls 37°F baseline of MR 6.2, 2/13 good runs).

---

## Session scope

**Execute S27 audit Option A: full PHY-031 port.**

### What gets built

Per spec §13 verification criteria:

1. **Constants module.** Declare `DEFAULT_LIFT_MIN`, `TRANSITION_MIN`, `REST_FRACTION` as named constants in a single module. Proposed: `packages/engine/src/activities/phy031_constants.ts`. Values from spec §2.2 verbatim.
2. **Component cycle formula.** Pure helper that accepts `crowdTier`, `terrain`, and returns `{ totalCycles, cycleMin }`. Implements spec §2.1 verbatim. No hidden tuning parameters.
3. **Crowd utility `getCrowdFactor(dateStr, powderFlag)`.** Returns crowd tier 1–6. Handles all 10 holiday windows (spec §5), seasonal + day-of-week fallthrough (spec §6), and powder tier bump (spec §7.2). Thanksgiving window per spec §5.4 (fourth Thursday of November). MLK/Presidents per spec §5.3 helper.
4. **Bridge wiring.** Replace `evaluate.ts:430` hardcoded `cycleOverride: null` with computed override from `getCrowdFactor` + component formula. Remove "No cycle override in 10a" comment.
5. **Ski history parameter.** Add optional `skiHistory: { runsPerDay, hoursPerDay, ridingStyle }` to `calcIntermittentMoisture` signature per spec §8.2. When present, bypasses calendar and uses back-calculated override.
6. **Spec-lock test conversion.** Convert 25 `.todo` items in `packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts` to `.it` as each component lands. S29 binds each `.todo` to the corresponding spec section during port work per S28 kickoff success criterion #5 decision (option a).

### What does NOT get built

- Powder signal source integration (OpenSnow/OnTheSnow/NWS API wiring). Spec §7.3 names the priority order; the actual integration is a separate session. S29 accepts `powderFlag: boolean` as input and trusts the caller.
- Ski history Phases B, C, D (screenshot import, GPX, Strava/Garmin OAuth). Spec §8.3 names these as future scope.
- Resort-specific multiplier (deferred to v2 per Q3).
- User crowd override selector (deferred to v2 per Q2).

---

## Four-scenario verification matrix (RUN AT CLOSE, BEFORE COMMIT)

S29 is verified successful only when post-port outputs pass the 4-scenario matrix. Each scenario has a diagnostic expectation based on spec §13 + LC5 surfaced baselines.

### Scenario 1 — S-001 canonical regression

| Input | Value |
|---|---|
| Location | Breckenridge, CO |
| Conditions | 16°F, 40% RH, 8 mph wind |
| Terrain | groomers |
| Duration | 6 hours |
| Date | 2026-02-03 (Tuesday, Tier 2 weekday) |
| Subject | 170 lb male, default ensemble |

**Expected:**
- Cycle count: **17–19** (spec §13.6; hard verification target)
- Cycle duration: ~20 min (spec §12 worked examples class)
- sessionMR: **unknown target** — this is what we learn. Currently 2.30. Post-port expected meaningfully higher based on 4× cumulative exposure increase. If lands 4–6, diagnosis confirmed. If stays 2–3, second contributor exists. If > 8, port may have overshot.

### Scenario 2 — LC5 parity check

| Input | Value |
|---|---|
| Location | Breckenridge, CO |
| Conditions | 37°F, humidity moderate, wind moderate |
| Terrain | moguls |
| Duration | 6 hours |
| Date | weekday Tier 2 |
| Subject | match LC5 Mar 24 baseline |

**Expected:**
- LC5 Mar 24 locked baseline: **MR 6.2, 2/13 good runs**
- LC6 post-port should land near 6.2 — LC5 had PHY-031 wired; this scenario tests whether LC6 physics + ported PHY-031 produces parity output
- Acceptable range: 5.5–7.0. Outside this range, investigate.

### Scenario 3 — High-moisture stress test

| Input | Value |
|---|---|
| Location | Tahoe (generic) |
| Conditions | 28°F, 70% RH, 15 mph |
| Terrain | bowls |
| Duration | 5 hours |
| Date | weekday Tier 2 |
| Activity | snowboarding |
| Powder flag | true |

**Expected:**
- Weekday powder auto-bumps Tier 2 → Tier 4 Busy per spec §7.2
- Cycle count drops materially from calendar-only baseline
- sessionMR: high — this is a moisture-saturation scenario. LC5 "Tahoe powder 28°F snowboarding 5hrs" baseline from S9b end-to-end lockdown was **sessionMR 7, trapped 0.0948 L, 23 cycles, 3 good runs**. Post-port LC6 should land in similar range given powder bump added to PHY-031.

### Scenario 4 — Holiday window activation

| Input | Value |
|---|---|
| Location | Breckenridge, CO |
| Date | **Friday after Thanksgiving 2026** (Nov 27, 2026) |
| Conditions | 25°F, 50% RH, 5 mph |
| Terrain | groomers |
| Duration | 5 hours |
| Powder flag | false |

**Expected:**
- Calendar resolves to Thanksgiving window #10, Friday = Tier 4 Busy (spec §5.1)
- Tests whether the new S28-ratified Thanksgiving window is correctly wired in `getCrowdFactor`
- Cycle count consistent with Tier 4 (10 min lift line): per spec §12.8 worked example, ~10 cycles for groomers at Tier 5; Tier 4 should produce slightly more (~12–14 cycles)
- No MR target; this is a wiring test, not a physics test

### Matrix close-out reporting

S29 close must report, per scenario, a 4-column table: `{scenario, cycle_count, cycle_min, sessionMR}`. Any scenario failing its expected range halts commit and triggers investigation — do not commit partial passes as "close enough."

---

## Critical context to preserve — DO NOT LOSE

### 1. Cardinal Rule #8 — Thermal engine is LOCKED

`iterativeTSkin`, `computeEmax`, `getDrainRate`, `computeSweatRate`, `calcIntermittentMoisture`, `heatLossRisk`, and energy balance functions are NOT modified without Chat-produced code AND hand-computed verification.

**For S29 specifically:** `calcIntermittentMoisture` is in the touch path — the ski-history parameter is added to its signature per spec §8.2. This IS a Cardinal Rule #8 modification and requires hand-computed verification. The modification is narrow: a new optional parameter that, when present, replaces the calendar-derived `cycleOverride`. No changes to internal physics, sweat/drain/evap primitives, or phase-loop structure.

Chat produces the exact patch. User receives hand-computed trace showing behavior is identical when `skiHistory` is absent (baseline) and overrides cycle count correctly when present. Only then does the patch land.

### 2. Cycle-averaging is forbidden (spec §9)

Any session proposing cycle-averaging, intensity averaging, or any logic that collapses phase distinctions must halt and re-read spec §9. This is the third time this failure mode is explicitly flagged across LC5/LC6 sessions.

PHY-031 produces cycle COUNT and cycle DURATION. It does not produce a cycle-averaged metabolic rate, averaged sweat rate, or any composite. The per-phase engine downstream is responsible for per-phase physics.

### 3. Historical data overrides cycle COUNT, not per-cycle physics (spec §8.1)

When `skiHistory` is provided, it replaces `cycleOverride` directly. MET, sweat rate, cold penalty, evaporative drain, and all thermal-engine primitives remain untouched. Do not "blend" history with calendar. When history is present, history wins entirely.

### 4. Spec values are LOCKED

Every constant, tier value, holiday window, runMin, tier bump, and threshold in the spec is ratified. S29 does not revise any spec value.

If implementation reveals a value produces wrong output (e.g., Scenario 1 MR lands at 2.5 post-port instead of 4–6), the investigation is **upstream** (spec was wrong, calibration needed, or second bug exists) — NOT a quiet in-session tweak to the spec value. Flag to user for next-session scope.

### 5. Powder flag interface

Spec §7.3 names OpenSnow → OnTheSnow → NWS as the signal priority. S29 does **not** wire any of these. `getCrowdFactor` accepts `powderFlag: boolean` as its second argument. The caller is responsible for populating it. In S29, the caller (`evaluate.ts:430` replacement) passes `false` unless a test or debug hook injects otherwise. Powder signal wiring is a future session.

### 6. `GAP-PHY-031-POWDER-THRESHOLD`

Spec §7.4 flags this GAP. S29 does not resolve it — the flag persists in the spec until signal-source wiring begins. When S29 tests scenarios with `powderFlag = true` (Scenario 3), it's because the test harness sets the flag, not because any resort data triggered it.

---

## 8 Cardinal Rules (LOCKED — unchanged from S28)

1. No fudge factors. Every constant traces to (a) published source, (b) derivation, or (c) explicit GAP flag.
2. `im_ensemble` drives evaporation, NOT CLO.
3. Single source of truth = canonical engine output object.
4. No hardcoded constants in display.
5. Wind chill = display only, never model input.
6. No double-dipping.
7. `T_skin` computed from heat balance, never assumed constant.
8. Thermal engine is LOCKED. Env-guarded diagnostic logging is SAFE.

Additional:
- Strategy winner = MR-min subject to feasibility gates. CDI < 4.0 is a safety gate only.
- Microclimate VP reverted (double-counting with `im_ensemble`).
- Helmet rule: NEVER recommend removing helmet.
- Denali safety gate: 15,000 ft.

---

## Two-Agent Discipline (LOCKED)

Chat produces exact patches with verified unique-anchor `old_str` / `new_str`. Code applies verbatim and reports. No improvisation, no scope expansion.

**Failure modes from S28 that WILL happen again without vigilance:**

- **Chat proposes re-derivation from first principles.** Spec §X has a ratified value; Chat tries to "think through" what the value should be. STOP. Quote the spec section number.
- **Chat adopts user off-hand comments as new rules.** User makes a casual comment; Chat silently incorporates it into the patch. STOP. Check the spec. If the comment conflicts with ratified work, report the conflict back to user, do not resolve silently.
- **Chat offers options menu for ratified questions.** "Should runMin be 3, 4, or 5?" is not a question; runMin = 3 is ratified spec §3.1. Do not present options for locked values.
- **Code expands scope.** Chat authorizes patch A; Code applies A + proposes B as "while we're here." STOP. Option A means Option A.

**Critical authorization gates:**

- When Chat produces a patch, Code applies the patch verbatim and pastes confirmation. Code does NOT run additional scenarios, additional greps, or additional file views without Chat's explicit next-step direction.
- When Chat says "run the 4-scenario matrix and paste output," Code runs, pastes, stops. Does not interpret. Chat interprets.
- When a scenario fails its expected range, halt. Do not commit. Do not try alternative approaches.

---

## Expected patch sequence (proposed — subject to Chat final authoring)

Per S29 scope, the port is likely ~6–10 patches in this order. Final sequence is Chat's call at session open after reading actual code state.

1. **Patch: create `phy031_constants.ts`** with `DEFAULT_LIFT_MIN`, `TRANSITION_MIN`, `REST_FRACTION`
2. **Patch: create `getCrowdFactor.ts`** utility — pure function, no side effects, fully unit-tested
3. **Patch: create component-cycle helper** — consumes crowd tier + terrain, returns `{ totalCycles, cycleMin }`
4. **Patch: wire `evaluate.ts:430`** — replace null-plug with computed override. Remove "No cycle override in 10a" comment.
5. **Patch: add `skiHistory` optional parameter to `calcIntermittentMoisture` signature** — Cardinal Rule #8 modification, requires hand-computed verification
6. **Patch: convert spec-lock `.todo` → `.it`** for 25 test cases, bind each to spec section in test comment
7. **Run 4-scenario matrix, report outputs**
8. **If all pass:** commit, push, update tracker + registry
9. **If any fail:** halt, report, do not commit

---

## Open questions for S29 — RESOLVE WITH USER BEFORE CODING

### OQ-S29-1 — Constants module location

Spec §13.1 proposes `packages/engine/src/activities/phy031_constants.ts` OR `heat_balance/constants.ts`. Which? Proposed: new file in `activities/` because constants are activity-specific (resort skiing). Alternative: add to existing heat_balance constants for centralized constant management.

### OQ-S29-2 — `getCrowdFactor` module location

Suggest `packages/engine/src/activities/crowd_factor.ts`. Confirm or redirect.

### OQ-S29-3 — Component-cycle helper location

Same package as `getCrowdFactor`, or separate file? Proposed: same file, different exported function.

### OQ-S29-4 — Spec-lock `.todo` binding format

Each `.todo` converts to `.it` with a comment linking back to the spec section that defines its expected behavior. Format proposal: `// per PHY-031 spec §X.Y`. Confirm or redirect.

### OQ-S29-5 — Hand-computed verification for Cardinal Rule #8 modification

For the `calcIntermittentMoisture` signature change (new `skiHistory` parameter), the hand-computed verification needs to demonstrate: (a) when `skiHistory` is absent, output is bit-identical to pre-change behavior; (b) when `skiHistory` is present, output matches back-calculated cycle override.

Chat produces trace document with test vectors and expected values before Code applies the patch. User confirms trace matches expectation before patch lands. Confirm this process, or redirect.

### OQ-S29-6 — Matrix failure protocol

If Scenario 1 post-port MR lands at (say) 3.5 instead of expected 4–6, is that a:
- (a) Halt and investigate — expected range was wrong, or there's a second physics contributor
- (b) Accept as "close enough" — MR went up from 2.3 to 3.5, diagnosis directionally correct
- (c) Calibration check — spec values correct but engine needs tuning elsewhere

Proposed: (a). Spec §13 is binding. "Close enough" is the failure mode this whole infrastructure exists to prevent. Confirm or redirect.

---

## Success criteria for S29

Session closes cleanly when:

1. All 6 patches land with zero `old_str` mismatches
2. `packages/engine/src/activities/phy031_constants.ts` exists with ratified values
3. `getCrowdFactor(dateStr, powderFlag)` implemented, handles all 10 holiday windows + fallthrough + powder bump
4. Component-cycle helper returns correct `{totalCycles, cycleMin}` for spec §12 worked examples
5. `evaluate.ts:430` no longer null-plugged; "No cycle override in 10a" comment removed
6. `calcIntermittentMoisture` accepts `skiHistory` parameter per spec §8.2; hand-computed trace confirms Cardinal Rule #8 preservation
7. All 25 spec-lock `.todo` items converted to `.it`, each bound to spec section via comment; all 25 pass
8. 4-scenario verification matrix passes all scenarios per expected ranges (§"Four-scenario verification matrix" above)
9. Tracker updated: `S29-APPLIED` marker, new "Status as of Session 29" block, PHY-031 row updated from `RATIFIED (spec) / NOT_IMPLEMENTED (engine)` → `RATIFIED (spec) / ACTIVE (engine)` in Section A and Spec Registry
10. `S26-SYSTEMATIC-MR-UNDERESTIMATION` closed if Scenario 1 and 2 land in expected range
11. Commit clean, pushed, log chain intact

Expected session length: 4–6 hours. Heavier than S28 because actual engine code lands. Cardinal Rule #8 verification adds ~45 min. 4-scenario matrix adds ~30 min at close.

### What S29 is NOT

- NOT modification of any spec value
- NOT powder signal integration
- NOT ski-history Phases B/C/D
- NOT UI work
- NOT resolution of `GAP-PHY-031-POWDER-THRESHOLD`
- NOT preemptive calibration if Scenario 1 fails — that's a separate investigation session

---

## Opening move for S29 Chat

After reading all required material, first message to user:

> "S29 kickoff read complete. Understanding: execute PHY-031 port per spec §13 verification criteria. 6 patches, 4-scenario close-out matrix, Cardinal Rule #8 modification to `calcIntermittentMoisture` requires hand-computed trace. 6 open questions need user input before coding (module locations, binding format, hand-comp verification process, failure protocol). Ready to work through open questions, then produce patch sequence. Which open question first, or should I propose default ordering?"

NOT "let me start with Patch 1" or "I'll figure out open questions inline."

---

## References

### Specs and audits (canonical)
- `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` (S28 ratified, 616 lines)
- `LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md` (S27)
- `LC6_Planning/LC6_Spec_Registry.md` PHY-031 row
- `LC6_Planning/LC6_Master_Tracking.md` Section A PHY-031 row + B.18 S27-DRIFT-3 CLOSED

### Code paths to modify
- `packages/engine/src/evaluate.ts:430` — null-plug target
- `packages/engine/src/moisture/calc_intermittent_moisture.ts:247,297,500-504` — cycleOverride scaffolding already present
- `packages/engine/src/activities/profiles.ts:93-94` — comment acknowledging PHY-031 design intent
- `packages/engine/src/activities/phy031_constants.ts` — NEW (Patch 1)
- `packages/engine/src/activities/crowd_factor.ts` — NEW (Patch 2 + 3)
- `packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts` — convert 25 `.todo` → `.it`

### LC5 reference (read-only for port)
- `packages/engine/reference/lc5_risk_functions.js` (LC5 source of truth; crowd calendar, holiday windows, component cycle formula live here)

### Session history
- `LC6_Planning/session_kickoffs/S28_kickoff.md` (format reference)
- Commit `3a4b4d1` (S28 primary), `8e93495` (S28 SHA backfill)

---

End of S29 kickoff. Next Chat: follow the opening move above.
