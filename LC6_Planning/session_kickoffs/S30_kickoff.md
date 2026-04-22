# S30 Session Kickoff — PHY-031 CycleMin Reconciliation Spec Authoring

**Created:** Morning after S29 close (April 22, 2026)
**Session type:** Chat-led spec authoring. Zero code. Zero tests. Zero engine touches.
**Branch:** `session-13-phy-humid-v2` at commit `29e0b30` (S29 close). **Unchanged during S30.**
**Reading time:** ~20 minutes before proposing any work

---

## STOP. Before doing anything, read these first:

1. This entire kickoff doc
2. `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` — **the full 616-line spec** (S28 ratified). The cyclemin gap is a mismatch between §2.1 and engine reality; this spec defines "cycleMin" as the thing the engine doesn't fully consume.
3. `LC6_Planning/LC6_Master_Tracking.md` top status block through end of Session 29 — the cyclemin-physics-gap tracker entry is the mandate for this session.
4. `LC6_Planning/LC6_Spec_Registry.md` PHY-031 row — post-S29 status: RATIFIED / PARTIAL with explicit "physics gap discovered" annotation.
5. `LC6_Planning/session_kickoffs/S29_kickoff.md` + S29 commit log (`git log 29e0b30 -3`) — the history of why the gap exists.
6. `packages/engine/src/activities/crowd_factor.ts` — the `computeCycle` function producing `cycleMin` (the variable the engine consumes the count of but not the duration of).
7. `packages/engine/src/moisture/calc_intermittent_moisture.ts` lines 2425–2720 — the phase loop + cycleOverride consumption path (this is what the reconciliation spec describes at a physics level, without authorizing changes to).

Do NOT start drafting the spec until these 7 reads are complete. Total ~20 minutes. The S29 failure mode — Chat chasing implementation before understanding the gap — is exactly the failure this kickoff exists to prevent.

---

## Why this session exists

S29 landed the PHY-031 port successfully at the schema/calendar/validation/test level (31/31 spec-lock tests green, Cardinal Rule #8 honored). The 4-scenario verification matrix then revealed a deeper spec-implementation gap:

**Spec §2.1** defines `cycleMin` as full wall-clock cycle duration — run + lift + line + transition, scaled by `(1 - REST_FRACTION)`. For Tier 2 weekday groomers: **18.75 min per cycle.** For Mayhem Saturday trees: **50 min per cycle.** For Ghost Town groomers: **16.25 min per cycle.** A ~3× spread per session depending on terrain × crowd tier × powder.

**The engine phase loop** in `calc_intermittent_moisture.ts` simulates only `run + lift` durations (~10 min for groomers). When `cycleOverride.totalCycles = N` is supplied, the engine runs N × 10-min physics cycles. The remaining wall-clock time per cycle — the line time, the transition time, the rest time — is never simulated. Up to 80% of session wall-clock time is ghosted.

**Field validation** (user's decade of snowboarding experience): 36 × 10-min cycles in a 6hr groomer day implies 40-50K feet of vertical at the spec's reference 1,000 vft per run. Physically impossible. The user called this out explicitly during S29. The pre-port 36-cycle default looked fine on aggregate numbers but was never physically real.

**S26-SYSTEMATIC-MR-UNDERESTIMATION remains open.** S29 ported the calendar correctly but did not close the regression diagnostic because the physics gap means moisture accumulation and heat loss don't accumulate over the full session — they accumulate over ~20% of it.

This session authors the spec that will tell the next implementation session (Cardinal Rule #8 active) exactly what to build.

---

## Session scope

**Author one document. Markdown. Committed to `LC6_Planning/specs/`.**

### Output: `PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_DRAFT.md`

This is a DRAFT at commit time. Ratification — i.e. rename to `_RATIFIED.md` and Registry row update — happens only after user review confirms every open question resolved and every hand-computed vector accepted.

**Target length:** ~400–700 lines. Roughly matches PHY-031 v1 RATIFIED spec scope.

**Required sections** (numbered; this is the skeleton):

1. **Executive summary** — what the gap is, why it exists, why ratifying this spec matters.
2. **Statement of the gap** — concrete worked examples showing the divergence across 3–5 scenarios (Ghost Town groomers, Tier 2 moguls, Tier 5 powder Saturday, Mayhem Saturday trees, ski-history override). For each: spec-predicted wall-clock cycleMin, engine-simulated phase-loop min, unsimulated gap in minutes and percent.
3. **Dynamic cycleMin taxonomy** — a complete min/max table showing cycleMin variation across all valid combinations of terrain (5) × crowd tier (6) × powder flag (2) = 60 combinations, with the min/max endpoints called out. Makes unambiguous that this is not a constant-to-add.
4. **Phase decomposition rules — the core of the spec.** For a given cycleMin from the calendar path, how is time split between the physics phases. Proposed formula:
   - `run` = `runMin[terrain]` — PHY-031 §3.1 verbatim
   - `lift` = `DEFAULT_LIFT_MIN` — PHY-031 §2.2 constant
   - `line` = `liftLineMin[tier]` — PHY-031 §4.1 per-tier value
   - `transition` = `TRANSITION_MIN` — PHY-031 §2.2 constant
   - Rest is session-level (outside per-cycle loop); see §5 below.
5. **Per-phase physics model.** For each of four phases (run / lift / line / transition):
   - Metabolic rate (MET value) — anchored to Compendium of Physical Activities (Ainsworth 2011)
   - Wind source (ambient / lift-ride speed-added / run-generated speed-added / stationary in ambient)
   - Body state (active sweat production / stationary cooling / drying / shivering threshold)
   - Which thermal-engine primitives apply (evaporation, condensation, convective, radiative)
6. **Session-level rest handling.** Whether `REST_FRACTION` is:
   - Reducing effective session duration (current `computeCycle` arithmetic approach)
   - A separate phase simulated as indoor/outdoor break physics
   - Hybrid (lunch-indoor with fast drying vs outdoor bench break with slow drying)
7. **History-override phase decomposition.** When user supplies `runsPerDay=18, hoursPerDay=6` (cycleMin=20 min from back-calculation), what's the phase split? Three options:
   - Use calendar-implied split for the terrain + inferred default tier
   - Use a fixed "typical" split (e.g., `run=3, lift=7, line=7, transition=3`)
   - Refuse to decompose and treat history as a single "mixed-intensity" opaque cycle (likely violates PHY-031 §9 cycle-averaging prohibition — flag for explicit user call)
8. **Blast-radius inventory.** For each implementation path:
   - Files touched (phase loop, profile definitions, cycleOverride consumer, any callers)
   - Cardinal Rule #8 exposure level (high / medium / low)
   - Existing activities affected (ski only, or hiking/cycling/running also via shared profile machinery)
   - Test files needing update (spec-locks, baselines, fixtures)
   - **§8.5 Non-CycleMin `cycleOverride` field inventory** — catalog of every non-cycleMin field passing through `cycleOverride` (`elevFt`, `perRunVertFt`, `dewPointC`, `strategyLayerIms`, `rawElevProfile`, `baseElevFt`, `totalDistMi`, `tripStyle`, `elevProfile`). For each: defining file/line, consuming file/line, owning spec (PHY-040, PHY-HUMID, etc., or "unknown"), test coverage presence, status (ACTIVE / PARTIAL / UNKNOWN / NULL-PLUGGED). Diagnostic-only — reconciliation spec does NOT re-spec these fields. Purpose: drift-detection and drift-evidence for future audit sessions. If inventory reveals a broken field mid-drafting, halt + flag + open separate tracker item; reconciliation continues on its own scope.
9. **Hand-computed verification vectors.** 3 concrete scenarios with full calculation trace (cycle-by-cycle, phase-by-phase) and expected `sessionMR` values computed by hand from first principles + spec §3 physics. These are the gate for the implementation session — no patch lands without matching these numbers within tolerance.
10. **Open questions for user.** Physics decisions requiring user input before spec ratifies. Expected: 4-8 questions. Resolved concrete-to-abstract, same pattern as S28 PHY-031 authoring.
11. **S-001 regression close criteria.** Specific expected output for the S-001 Breck groomers 16°F Tue 6hr scenario once reconciliation implements. Names the MR range that closes `S26-SYSTEMATIC-MR-UNDERESTIMATION`.
12. **What this spec does NOT do.** Explicit non-goals:
    - Not engine code
    - Not a signature change to `calcIntermittentMoisture`
    - Not a change to any existing PHY-031 spec value (§3.1 terrain times, §4.1 tier waits, §2.2 constants, §5 holiday windows)
    - Not powder-signal wiring (`GAP-PHY-031-POWDER-THRESHOLD` remains future scope)
    - Not the implementation session itself.

---

## What this session is NOT

- Not engine code (spec-authoring only)
- Not test authoring (spec names hand-comp vectors; tests are implementation-session scope)
- Not fixture updates (reconciliation changes behavior; new fixtures come with implementation)
- Not the 4-scenario matrix re-run (blocked until reconciliation implements)
- Not SessionA audit scope (deferred; see §"SessionA status" below)
- Not a modification to any PHY-031 v1 RATIFIED spec value
- Not the pushed state of the branch (still unpushed until reconciliation implements)

---

## Critical context to preserve — DO NOT LOSE

### 1. Cardinal Rule #8 is active for the IMPLEMENTATION session, not this one

S30 itself touches zero code. Zero risk. But the output of S30 authorizes an implementation session that will touch the thermal engine phase-loop semantics — **the highest-risk patch LC6 has faced since PHY-068 ice blockage.** The spec must be thorough enough that Chat in the implementation session can produce a hand-comp trace matching expected vectors before Code applies the patch.

**Test of spec thoroughness:** if implementation-session Chat has to re-derive any physics decision, the spec is insufficient. S30 closes only when every physics decision is named and every vector is computed.

### 2. Spec §2.1 is LOCKED

The reconciliation spec does NOT revise PHY-031 §2.1 cycleMin formula. It does NOT revise §3.1 terrain runMin values. It does NOT revise §4.1 crowd tier lift-line wait values. It does NOT revise §2.2 constants. It does NOT revise §5 holiday windows.

**What S30 does:** specifies how the engine CONSUMES the cycleMin that §2.1 defines. The authority relationship is: PHY-031 v1 RATIFIED defines cycleMin; PHY-031-CYCLEMIN-RECONCILIATION defines how the engine decomposes and simulates it.

If S30 drafting reveals a spec §2.1 value is genuinely wrong, **halt and escalate** — do not silently amend during reconciliation drafting. The user must explicitly authorize any PHY-031 v1 amendment.

### 3. Cycle-averaging remains forbidden (PHY-031 §9)

Reconciliation must preserve phase resolution. The solution to "the engine doesn't simulate line time" is NOT "average metabolism across the cycle." It IS "simulate line phase with its own MET, wind, body state." Any proposed decomposition that collapses phase distinctions halts and re-reads §9.

### 4. Ski-history override is Phase A only

PHY-031 §8.2 Phase A manual-entry history is the only path this spec handles. Phases B–D (screenshot import, GPX, Strava/Garmin) remain future scope. The decomposition question in §7 of the reconciliation spec is limited to: given user-supplied `runsPerDay` + `hoursPerDay`, how does the engine split the back-calculated cycleMin into phases.

### 5. The pre-port 36-cycle behavior was physically wrong

The reconciliation spec should not preserve parity with pre-port numbers. Pre-port output was a 36-cycle artifact of `totalMin / cycleDur` arithmetic that happened to fill the session because 6hr × 60min = 360min = 36 × 10min. The user's field observation (40-50K feet implausible at 36 runs × 1000vft) rejects this as a target.

**The reconciliation closes S-001 to a MR value that matches lived experience**, not to pre-port 2.30 or to post-port 1.50. Neither number is the answer. What the answer IS — that's what the hand-comp vectors in §9 of the reconciliation spec establish.

### 6. SessionA status

SessionA (LC6 state-of-the-port audit) was drafted S28 close, never run. Per user decision at S30 open, SessionA is **held pending S30 close**. Tracker must reflect this explicitly — a drafted-but-unrun session sitting in the `session_kickoffs/` folder without a tracker note is itself a drift risk.

S30 close-out includes adding a one-line tracker entry under "Forward plan" explicitly deferring SessionA until after the S30-implementation chain completes.

---

## 8 Cardinal Rules (LOCKED — unchanged from S29)

1. No fudge factors. Every constant traces to (a) published source, (b) derivation, or (c) explicit GAP flag.
2. `im_ensemble` drives evaporation, NOT CLO.
3. Single source of truth = canonical engine output object.
4. No hardcoded constants in display.
5. Wind chill = display only, never model input.
6. No double-dipping.
7. `T_skin` computed from heat balance, never assumed constant.
8. Thermal engine is LOCKED. Env-guarded diagnostic logging is SAFE.

Additional rules (equally binding):

- Strategy winner = MR-min subject to feasibility gates. CDI < 4.0 is a safety gate only.
- Microclimate VP reverted (double-counting with `im_ensemble`).
- Helmet rule: NEVER recommend removing helmet.
- Denali safety gate: 15,000 ft.

---

## Two-Agent Discipline (LOCKED — unchanged from S29)

Chat authors spec. Code does not apply code changes during this session. Code's role during S30 is limited to:

- Running grep/sed to extract context from files Chat needs to read (e.g., phase profile definitions, evaluate.ts helper, calc_intermittent_moisture.ts consumption logic)
- Pasting raw output verbatim for Chat synthesis

Code NEVER proposes physics decisions. Code NEVER edits code. Code NEVER applies patches. Code NEVER creates files in `packages/`.

Chat NEVER commits the draft spec to `_RATIFIED.md` without explicit user authorization. Ratification happens after every open question resolves and every hand-comp vector is user-accepted.

---

## Open Questions for S30 — RESOLVE WITH USER BEFORE DRAFTING

These are session-level OQs (how to structure the spec), distinct from the physics OQs (§10 of the spec itself) which emerge during drafting.

### OQ-S30-1 — Draft commit cadence

Option A: Draft full spec in one pass, commit once at session close.
Option B: Commit incrementally section by section (§1-3 → review → §4-6 → review → etc.).
Recommendation: **Option B.** Long specs accumulate errors; incremental review catches drift early. S28 drafted PHY-031 in one pass and surfaced 6 OQs only at close, extending the session.

### OQ-S30-2 — Hand-comp vector count and detail level

Option A: 3 vectors with full calculation trace (cycle-by-cycle, phase-by-phase)
Option B: 5 vectors with trace depth inversely proportional to complexity (detail the edge cases, summarize the normals)
Option C: 5 vectors with minimal trace (inputs + expected outputs only, trace is implementation-session scope)
Recommendation: **Option A.** Thoroughness > breadth. The implementation session is highest-risk; hand-comp vectors are the primary gate.

### OQ-S30-3 — Session-level rest handling depth

Option A: Spec §6 picks one rest-handling approach definitively (recommend: session-duration-reduction, same as current `computeCycle` arithmetic).
Option B: Spec §6 presents 2-3 approaches, defers choice to user in OQ block, resolves during drafting.
Recommendation: **Option B.** Rest-handling is user-preference-dependent (indoor lunch vs outdoor bench) and physics-sensitive (drying rate during rest); worth explicit user input.

### OQ-S30-4 — History-override decomposition default

Option A: Spec §7 recommends a default, documents alternatives as GAP
Option B: Spec §7 presents the 3 options, resolves during drafting with user input
Option C: Spec §7 flags as GAP, defers to a future session
Recommendation: **Option B.** History override is spec §8 Phase A scope; resolving in this spec avoids a third spec-authoring session.

### OQ-S30-5 — Interaction with existing PHY-039 / PHY-040 elevation plumbing — RESOLVED PRE-SESSION

`calc_intermittent_moisture.ts` already reads `cycleOverride.elevFt` and `cycleOverride.perRunVertFt` for PHY-040 RECONNECT (lines 2714-2716), plus `dewPointC`, `strategyLayerIms`, and other fields at 2499-2505 + 2714-2717. Does the reconciliation spec touch this, ignore it, or formalize it?

Option A: Out of scope — reconciliation only addresses cycleMin duration, not elevation.
Option B: In scope — reconciliation codifies the full cycleOverride contract including elevation.

**Resolved: A + §8.5 inventory** (user resolution pre-session). Scope stays on cycleMin duration; PHY-040 and other non-cycleMin fields are NOT re-spec'd by reconciliation. BUT §8.5 of the reconciliation spec includes a diagnostic-only inventory of every non-cycleMin field in `cycleOverride` — which file defines each, which file consumes each, which spec owns each, test-coverage status, and ACTIVE/PARTIAL/UNKNOWN/NULL-PLUGGED state. If inventory reveals a broken field during drafting, halt + flag as a separate tracker item; reconciliation continues on its own scope. Purpose: drift-detection and drift-evidence for future audit sessions. Addresses user concern that scope-limiting alone risks hiding a PHY-040-class bug until LC7.

### OQ-S30-6 — When to close

The reconciliation spec is a DRAFT at commit. It ratifies when user accepts every OQ resolution and every hand-comp vector. Clear close criteria:
- All 6+ session-level and physics OQs resolved
- All 3 hand-comp vectors accepted by user with explicit calculation review (per OQ-S30-2 resolution — 3 vectors, full trace)
- §2 gap-statement examples user-confirmed (the user's field experience is the ground truth)
- §12 non-goals explicit and user-confirmed
- Filename renamed from `_DRAFT.md` to `_RATIFIED.md`
- Registry row updated to reference the ratified reconciliation spec
- Tracker `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` status updated from HIGH-open to HIGH-ratified-implementation-pending

Confirm this close criteria, or redirect.

---

## Success criteria for S30

Session closes cleanly when:

1. `LC6_Planning/specs/PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_RATIFIED.md` exists (DRAFT → RATIFIED rename complete), committed, unpushed.
2. All 12 required sections present with user-accepted content.
3. All physics OQs (§10 of the spec) resolved with user input.
4. All 5 hand-comp vectors accepted with calculation review.
5. Registry row for PHY-031 updated to reference reconciliation spec.
6. Tracker updated: `S30-APPLIED` marker, "Status as of Session 30" block, cyclemin-physics-gap status updated, SessionA deferred-pending note added.
7. `S26-SYSTEMATIC-MR-UNDERESTIMATION` close criteria explicitly named (still open until implementation session, but criteria locked).
8. Commit clean. **Still unpushed** — push happens after implementation session closes regression.

Expected session length: 4–6 hours. Heavier than S28 PHY-031 authoring because the physics decomposition questions are harder and the blast radius inventory requires reading engine code carefully.

---

## What S30 is NOT allowed to propose

- Modifications to PHY-031 v1 RATIFIED spec values (§2.1 formula, §2.2 constants, §3.1 terrain runMin, §4.1 tier waits, §5 holiday windows, §7 powder bump table, §8 history back-calc)
- Engine code changes
- Test authoring
- Fixture updates
- Powder signal-source wiring
- Ski-history Phases B/C/D
- Resort-specific efficiency multiplier (PHY-031 §11 defers to v2)
- 4-scenario matrix re-authoring

If Chat finds itself drafting any of the above during S30, that IS an incident — halt, note, redirect.

---

## Opening move for S30 Chat

**All 6 session-level OQs are RESOLVED pre-session** (see §"Open Questions for S30" — each OQ now notes its resolution). Fresh-chat S30 does NOT re-litigate:

- OQ-S30-1: **A** (single commit at session close)
- OQ-S30-2: **A** (3 hand-comp vectors, full calculation trace)
- OQ-S30-3: **B** (spec §6 presents 2-3 rest-handling approaches; user resolves during drafting)
- OQ-S30-4: **B** (spec §7 presents 3 history-override decomposition options; user resolves during drafting)
- OQ-S30-5: **A + §8.5 inventory** (scope stays on cycleMin; non-cycleMin `cycleOverride` fields get diagnostic-only inventory in §8.5 for drift detection)
- OQ-S30-6: **OK** (close criteria as drafted)

Physics OQs (spec §10) emerge during drafting — those go to user when reached.

After reading all 7 required documents above, first message to user:

> "S30 kickoff read complete. Understanding: author PHY-031-CYCLEMIN-RECONCILIATION_Spec_v1_DRAFT.md per 12-section skeleton. Zero code, zero tests, zero engine touches. Spec §2.1 PHY-031 values LOCKED; this spec defines engine consumption, not cycleMin calculation. Session-level OQs pre-resolved (single-commit cadence, 3 hand-comp vectors with full trace, spec §6 and §7 each present options for user resolution during drafting, §8.5 adds non-cycleMin field inventory for drift detection, close criteria as drafted). Proceeding to draft §1 Executive Summary. Any corrections before I begin?"

NOT "let me re-propose the OQs" or "which OQ first."

---

## References

### Spec source material
- `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` — authority for cycleMin definition + all component values
- `LC6_Planning/LC6_Master_Tracking.md` Section A (S29 close block) — cyclemin-gap tracker entry
- `LC6_Planning/LC6_Spec_Registry.md` PHY-031 row — post-S29 status
- `LC6_Planning/session_kickoffs/S29_kickoff.md` — history of why the gap wasn't caught earlier

### Engine code (READ-ONLY during S30 — do not modify)
- `packages/engine/src/activities/crowd_factor.ts` — `computeCycle` produces cycleMin
- `packages/engine/src/activities/phy031_constants.ts` — DEFAULT_LIFT_MIN, TRANSITION_MIN, REST_FRACTION
- `packages/engine/src/evaluate.ts` lines 397-500 — `computeResortCycleOverride` helper, cycleOverride consumer side
- `packages/engine/src/moisture/calc_intermittent_moisture.ts` lines 2425-2720 — phase loop, cycleOverride consumption at 2708-2717
- `packages/engine/src/activities/profiles.ts` lines 93-95 — PHY-031 design-intent comment
- `packages/engine/reference/lc5_risk_functions.js` — LC5 reference (historical context only; LC5 never implemented the full spec either)

### Physics references (anchor hand-comp to published sources)
- Compendium of Physical Activities, Ainsworth et al., 2011 — MET values per phase intensity
- ISO 9920:2007 — ensemble vapor resistance
- Woodcock 1962 — im permeability index
- Havenith 2002 — clothing microclimate theory
- Gagge & Gonzalez 1996 — vapor pressure gradient + evaporative cooling
- Shealy et al. 2023 — descent speed radar data
- Stepan et al. 2023 JSAMS Plus — ski-speed corpus (user upload S27)

### Session history
- `LC6_Planning/session_kickoffs/S28_kickoff.md` — spec-authoring format reference
- `LC6_Planning/session_kickoffs/S29_kickoff.md` — implementation-session format reference (contrast; S30 is spec-authoring)
- Commits `435e321`, `7289e8b`, `29e0b30` (all S29, all unpushed) — current branch state

---

End of S30 kickoff. Next Chat: follow the opening move above.
