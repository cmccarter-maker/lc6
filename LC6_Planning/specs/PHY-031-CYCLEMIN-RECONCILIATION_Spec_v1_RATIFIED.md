# PHY-031-CYCLEMIN-RECONCILIATION — Engine consumption of PHY-031 component cycle duration

**Spec ID:** PHY-031-CYCLEMIN-RECONCILIATION
**Version:** v1 DRAFT
**Status:** DRAFT (authored S30, April 22, 2026). Ratification pending user acceptance of every physics OQ in §10 and every hand-comp vector in §9.
**Authoring session:** S30 (spec-authoring only; zero code, zero tests, zero engine touches)
**Authority relationship:** PHY-031 v1 RATIFIED defines `cycleMin`; this spec defines how `calcIntermittentMoisture` consumes it.
**Parent spec:** `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` (616 lines, S28-ratified, LOCKED — this spec does not revise any value within it)
**Precedent failure this spec closes:** `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` HIGH (open since S29 close, April 22, 2026)
**Successor session:** Implementation session (cardinal-rule-#8-active); scope is to port spec §4–§7 phase decomposition into `calc_intermittent_moisture.ts` phase loop, matching §9 hand-comp vectors before patch lands.

---

## 0. Document conventions

- **Constants** are named in `UPPER_SNAKE_CASE`. Values are either (a) LOCKED from PHY-031 v1 and cited by section, or (b) newly introduced in this spec and marked as such.
- **`GAP-*`** marks values required for implementation that are not yet named. Never filled with "starting values" per Cardinal Rule #1.
- **`OQ-*`** marks open questions that must resolve with user input before ratification.
- **`LOCKED from PHY-031 v1 §X`** means the value is taken verbatim from the parent spec. This reconciliation spec does not alter any such value. If drafting surfaces a genuine error in a PHY-031 v1 value, halt and escalate; do not silently amend.
- All numbered sections are binding. Unnumbered prose is explanatory.

---

## 1. Executive summary

### 1.1 What this spec is

This is a reconciliation spec. Its subject is the engine's consumption of `cycleMin` — the wall-clock cycle duration defined by PHY-031 v1 §2.1 (`cycleMinRaw / (1 - REST_FRACTION)`, ranging 16.25–50 min depending on terrain × crowd tier × powder flag).

The parent spec (PHY-031 v1 RATIFIED) defines **how to compute** cycleMin and totalCycles from date, terrain, and crowd signals. S29 ported that computation faithfully: the calendar model, the 6-tier crowd ladder, the 10 holiday windows, the powder bump, the ski-history Phase A back-calculation. 31 of 31 spec-lock tests green. Cardinal Rule #8 honored (thermal engine untouched during port).

This spec defines **how the engine simulates** the cycle that PHY-031 computed. That's the missing half. Without it, `cycleMin` is a number the engine receives and partly ignores.

### 1.2 The gap in one paragraph

`calc_intermittent_moisture.ts` iterates a cyclic phase loop `totalCycles` times. Each iteration integrates physics over `cycleDur = sum of phase.durMin`, where phase durations are read from `INTERMITTENT_PHASE_PROFILES`. For resort ski profiles, phases are `{run, lift}` summing to roughly 10 minutes. When S29's `cycleOverride` arrives carrying `totalCycles = 18` for a 6-hour Tier 2 weekday groomer session (where PHY-031 §2.1 says `cycleMin = 18.75 min` per cycle), the engine simulates `18 × 10 = 180 min` of physics across a `18 × 18.75 = 337.5 min` wall-clock session. 157.5 minutes — the line time, the transition time, and the rest time — receive no physics simulation. That time exists in the calendar model and in the user's day on the mountain; it does not exist in the thermal engine's accumulation of moisture, heat loss, or fabric drying.

### 1.3 Concrete scale of the gap

| Session profile                      | `cycleMin` (§2.1) | Engine iteration `cycleDur` | Unsimulated per cycle | Unsimulated fraction |
|--------------------------------------|-------------------|-----------------------------|-----------------------|----------------------|
| Ghost Town groomers (Tier 1)         | 16.25 min         | 10 min                      | 6.25 min              | 38%                  |
| Quiet weekday groomers (Tier 2)      | 18.75 min         | 10 min                      | 8.75 min              | 47%                  |
| Busy Saturday moguls (Tier 4)        | 33.75 min         | 14 min                      | 19.75 min             | 59%                  |
| Mayhem Saturday trees (Tier 6)       | 50.00 min         | 17 min                      | 33.00 min             | 66%                  |

(Complete 60-combination table in §3.)

At the Mayhem extreme, two-thirds of wall-clock time is ghosted per cycle. Across an 8.5-hour session at Tier 5 Packed moguls, that's over 5 hours of real time — more than half the day on the mountain — in which the user is standing in cold wind at a lift line, on a standing traverse transitioning between runs, or sitting on a patio at a rest break, none of which the thermal model integrates.

### 1.4 Why field validation rejects pre-port output too

The user's field experience (decade-plus snowboarder, 35-year expert) was the original signal that the engine was wrong, long before this gap was identified. Pre-S29, the engine ran a fixed 36 cycles in a 6-hour ski session (`360 min / 10 min cycleDur = 36`). That produced MR numbers the user described as "not feeling what I've felt" — too low for multi-hour cold days.

But 36 cycles × 1,000 vft per run = 36,000 vft per day. Stepan et al. 2023 ski-speed corpus and CO Front Range field reports both place a hard groomer-day ceiling around 20–25K vft for an expert; 36K is physically implausible. The pre-port 36-cycle output was correct arithmetic on the wrong quantity: it treated `cycleDur` (run + lift) as if it equaled `cycleMin` (wall-clock). Nothing about that number is a parity target for this reconciliation. It was never physically real.

Post-S29, the engine runs a spec-correct cycle *count* (for example, 21 at Tier 2 moguls over an 8.5-hour day) over a spec-incorrect cycle *duration* (14 min per cycle instead of 23.75 min wall-clock). Total simulated wall-clock: `21 × 14 = 294 min`, versus actual session length of 510 min — about 58% of the day. MR regresses because moisture accumulation, heat loss accumulation, and fabric drying time all scale with the total minutes the engine actually integrates. This is the symptom `S26-SYSTEMATIC-MR-UNDERESTIMATION` exhibits post-port.

**Neither the pre-port MR nor the post-port MR is the answer.** What the answer *is* — §9 of this spec establishes it from first principles.

### 1.5 Why the reconciliation is a spec and not a patch

Three reasons.

First, the thermal engine is LOCKED (Cardinal Rule #8). The implementation this spec authorizes will modify phase-loop semantics in `calcIntermittentMoisture` — a change to the core iteration logic of the single-source-of-truth moisture-risk function. Cardinal Rule #8 exists specifically for this class of change: hand-computed verification vectors must exist *before* code is written. This spec produces those vectors.

Second, the decomposition is genuinely multi-decision. A `cycleMin` of 50 min for Mayhem trees is not a single "add 33 minutes of something" operation; it decomposes into four phases (run, lift, line, transition) plus session-level rest, each with a distinct MET value, distinct wind regime, distinct sweat/drying state, and distinct coupling to the thermal-engine primitives. Implementing without a spec would force implementation-session Chat to make physics decisions mid-patch — the exact failure mode Cardinal Rule #8 prevents.

Third, the ski-history Phase A override path (§7) complicates the decomposition. Phase A supplies `(runsPerDay, hoursPerDay)` and back-calculates `cycleMin` directly, bypassing the calendar. But Phase A supplies no terrain-breakdown or tier, so the phase split is not reconstructable from the same inputs as the calendar path. This needs an explicit decision, not an implementation judgment call.

### 1.6 What this spec authorizes the next session to do

After ratification, an implementation session (Cardinal Rule #8 active; Chat-produced patches only; hand-comp verification before application) will:

1. Extend the cyclic phase loop in `calc_intermittent_moisture.ts` to simulate four phases per cycle (run, lift, line, transition) instead of the current two (run, lift), per §4 decomposition rules.
2. Apply the session-level rest handling resolved in §6 (whether as session-duration reduction, a dedicated rest phase, or hybrid).
3. Handle ski-history Phase A decomposition per §7.
4. Pass the 3 hand-comp vectors in §9 to the tolerance specified before any patch lands.
5. Close `S26-SYSTEMATIC-MR-UNDERESTIMATION` per the criteria in §11.

### 1.7 What this spec does not authorize

Listed in full at §12. Summary: no revisions to PHY-031 v1 values, no signature change to `calcIntermittentMoisture` for unrelated fields, no powder-signal wiring (`GAP-PHY-031-POWDER-THRESHOLD` remains future scope), no ski-history Phases B–D, no UI changes, no test authoring (tests are implementation-session scope and bind to §9 vectors), no fixture updates, no resort-specific efficiency multiplier (PHY-031 §11 defers to v2).

### 1.8 What ratification of this spec unblocks

- `S26-SYSTEMATIC-MR-UNDERESTIMATION` closure (blocked since S27; open 5 sessions)
- S-001 Breckenridge diagnostic convergence (the canonical regression scenario)
- Post-port 4-scenario verification matrix re-run (blocked until reconciliation implements)
- Resumption of SessionA (LC6 state-of-the-port audit, drafted S28 close, held pending this chain)

### 1.9 What this spec is NOT

- Not engine code
- Not a modification to any PHY-031 v1 value (§2.1 formula, §2.2 constants, §3.1 terrain table, §4.1 tier waits, §5 holiday windows, §7 powder table, §8 history back-calc)
- Not a signature change to `calcIntermittentMoisture` for non-cycleMin fields (those get a diagnostic-only inventory in §8.5)
- Not the implementation session itself
- Not a test spec — tests are implementation-session scope, binding to §9 hand-comp vectors
- Not powder-signal source wiring
- Not ski-history Phases B/C/D

---

## 2. Statement of the gap

### 2.1 Reference duration for worked examples

All §2 worked examples and all §9 hand-comp vectors use **`durationHrs = 8.5`** as a reference duration to anchor the arithmetic to concrete numbers. This value is illustrative, not normative. Actual session duration is a user input captured on the `Set the Scene` trip form (range: 30 min – 12 hr). The reconciliation implementation consumes whatever `durationHrs` the user supplies; the spec does not prescribe a canonical ski-day length.

8.5 hours was chosen for the worked examples as a realistic full-day skier value (9 AM start to 5 PM end, with lift-op windows typically running 8:30–9:00 AM to 4:00 PM and upper lifts closing 3:00–3:30 PM for sweep). Readers substituting a different `durationHrs` will get proportionally different cycle counts via `floor(durationMin / cycleMin)`; the formula is unchanged.

Note on reconciliation with PHY-031 v1 §12: PHY-031 v1 worked examples were computed at `durationHrs = 6`. The formula in §2.1 of that spec is unchanged; `durationHrs` is a user input, not a locked constant. The §12 examples remain valid at 6 hours; this spec's examples use 8.5 hours. No PHY-031 v1 value is altered by this choice.

Derived quantities used in the examples below, per PHY-031 §2.1 as implemented in `crowd_factor.ts`:

- `sessionMin = 8.5 × 60 = 510 min` (wall-clock)
- `cycleMin = cycleMinRaw / (1 - REST_FRACTION) = cycleMinRaw / 0.80` (rest-expanded wall-clock per cycle)
- `totalCycles = floor(sessionMin / cycleMin)` — equivalently `floor(effectiveMin / cycleMinRaw)` where `effectiveMin = sessionMin × 0.80 = 408 min`. These two forms are algebraically identical; the engine implementation uses the latter (see `crowd_factor.ts:computeCycle`).

### 2.2 Five scenarios

For each scenario: the spec-predicted wall-clock cycle composition, the engine's currently-simulated phase-loop composition, and the unsimulated-time delta per cycle and per session.

#### 2.2.1 Scenario G1 — Ghost Town groomers (Tier 1 Quiet weekday, off-peak)

Representative date: Tuesday, 2026-11-10 (early-season weekday, Tier 1 fallthrough per PHY-031 §6.2).

| Component                        | Value                    | Source                    |
|----------------------------------|--------------------------|---------------------------|
| runMin                           | 3 min                    | PHY-031 §3.1 groomers     |
| liftRideMin                      | 7 min                    | PHY-031 §2.2              |
| liftLineMin(tier=1)              | 0 min                    | PHY-031 §4.1              |
| TRANSITION_MIN                   | 3 min                    | PHY-031 §2.2              |
| cycleMinRaw                      | **13 min**               | sum                       |
| cycleMin = raw / 0.80            | **16.25 min wall-clock** | PHY-031 §2.1              |
| totalCycles = floor(510 / 16.25) | **31 cycles**            | PHY-031 §2.1              |
| totalVert (@ 1000 vft/run)       | ~31,000 ft               | expert-ceiling for uncrowded day |

**Engine currently simulates:** runMin + liftRideMin = `3 + 7 = 10 min` per cycle.
**Unsimulated per cycle:** `16.25 - 10 = 6.25 min` (38%).
**Unsimulated per session:** `31 × 6.25 = 193.75 min` ≈ **3.2 hours of ghosted physics** in an 8.5-hour wall-clock session.

The ghosted time in G1 is transition (3 min per cycle, 93 min session total) plus rest-fraction overhead (~102 min session total at 0.20 of wall-clock). Zero line time at Tier 1.

#### 2.2.2 Scenario M2 — Tier 2 moguls (Quiet weekday, peak season)

Representative date: Tuesday, 2026-02-03 (peak-season weekday fallthrough, Tier 2).

| Component                        | Value                    | Source                    |
|----------------------------------|--------------------------|---------------------------|
| runMin                           | 7 min                    | PHY-031 §3.1 moguls       |
| liftRideMin                      | 7 min                    | PHY-031 §2.2              |
| liftLineMin(tier=2)              | 2 min                    | PHY-031 §4.1              |
| TRANSITION_MIN                   | 3 min                    | PHY-031 §2.2              |
| cycleMinRaw                      | **19 min**               | sum                       |
| cycleMin = raw / 0.80            | **23.75 min wall-clock** | PHY-031 §2.1              |
| totalCycles = floor(510 / 23.75) | **21 cycles**            | PHY-031 §2.1              |
| totalVert (@ 1000 vft/run)       | ~21,000 ft               | aggressive but plausible  |

**Engine currently simulates:** `7 + 7 = 14 min` per cycle.
**Unsimulated per cycle:** `23.75 - 14 = 9.75 min` (41%).
**Unsimulated per session:** `21 × 9.75 = 204.75 min` ≈ **3.4 hours**.

Of those 204.75 min: line = 42 min, transition = 63 min, rest-fraction residual ≈ 100 min. Rest is the largest single bucket even at Tier 2.

#### 2.2.3 Scenario P5 — Tier 5 powder Saturday (Packed weekend, moguls)

Representative date: Saturday, 2026-01-17 (peak-season Saturday baseline = Tier 4 Busy; powder flag → Tier 5 Packed per PHY-031 §7.2).

| Component                        | Value                    | Source                    |
|----------------------------------|--------------------------|---------------------------|
| runMin                           | 7 min                    | PHY-031 §3.1 moguls       |
| liftRideMin                      | 7 min                    | PHY-031 §2.2              |
| liftLineMin(tier=5)              | 15 min                   | PHY-031 §4.1              |
| TRANSITION_MIN                   | 3 min                    | PHY-031 §2.2              |
| cycleMinRaw                      | **32 min**               | sum                       |
| cycleMin = raw / 0.80            | **40.00 min wall-clock** | PHY-031 §2.1              |
| totalCycles = floor(510 / 40.00) | **12 cycles**            | PHY-031 §2.1              |
| totalVert (@ 1000 vft/run)       | ~12,000 ft               | consistent with "powder Saturday" |

**Engine currently simulates:** `7 + 7 = 14 min` per cycle.
**Unsimulated per cycle:** `40.00 - 14 = 26.00 min` (65%).
**Unsimulated per session:** `12 × 26.00 = 312 min` ≈ **5.2 hours**.

Breakdown per session: line = 180 min (3 hours!), transition = 36 min, rest-fraction residual ≈ 96 min. On a Tier 5 powder day, more than **half** the user's day at the resort is ghosted — and over half of that is spent standing in a cold lift line. This is where the gap is most severe — paradoxically, on the days where moisture physics matter most (high sweat on powder descents, long cold exposure in lift lines, long stationary times in cold wind).

#### 2.2.4 Scenario X6 — Mayhem Saturday trees (worst-case calendar scenario)

Representative date: Saturday, 2026-12-29 (Dec 27–31 window + Saturday = Tier 6 Mayhem per PHY-031 §5.1). Trees terrain.

| Component                        | Value                    | Source                    |
|----------------------------------|--------------------------|---------------------------|
| runMin                           | 10 min                   | PHY-031 §3.1 trees        |
| liftRideMin                      | 7 min                    | PHY-031 §2.2              |
| liftLineMin(tier=6)              | 20 min                   | PHY-031 §4.1              |
| TRANSITION_MIN                   | 3 min                    | PHY-031 §2.2              |
| cycleMinRaw                      | **40 min**               | sum                       |
| cycleMin = raw / 0.80            | **50.00 min wall-clock** | PHY-031 §2.1              |
| totalCycles = floor(510 / 50.00) | **10 cycles**            | PHY-031 §2.1              |
| totalVert (@ 1000 vft/run)       | ~10,000 ft               | Mayhem floor              |

**Engine currently simulates:** `10 + 7 = 17 min` per cycle.
**Unsimulated per cycle:** `50.00 - 17 = 33.00 min` (66%).
**Unsimulated per session:** `10 × 33.00 = 330 min` = **5.5 hours**.

X6 is the upper bound on the absolute gap. Two-thirds of every cycle is ghosted, and the absolute ghosted time (330 min) exceeds the absolute simulated time (170 min). The engine is simulating less than a third of what the user experienced on the mountain.

#### 2.2.5 Ski-history override (Phase A) is not a gap scenario

Explicitly noted for future readers: Phase A ski-history override (PHY-031 §8) does **not** introduce an additional or distinct gap. Phase A overrides `totalCycles` only; current-session terrain, tier, and powder flag still drive phase decomposition. A Phase A session is simulated as "calendar-decomposition per current session × user-overridden cycle count." Whatever gap the calendar case exhibits at the user's current-session terrain and tier is the same gap the Phase A case exhibits. §7 (which the S30 kickoff skeleton listed as "history-override phase decomposition") is omitted from this spec for this reason; see §7 below for the explicit non-entry.

### 2.3 Summary table

| Scenario | cycleMin | cycleDur | Unsim/cycle | Cycles | Unsim/session | % of day ghosted |
|----------|---------:|---------:|------------:|-------:|--------------:|-----------------:|
| G1 Ghost Town groomers     | 16.25 | 10 |  6.25 | 31 | 193.75 min | 38% |
| M2 Tier 2 moguls           | 23.75 | 14 |  9.75 | 21 | 204.75 min | 40% |
| P5 Tier 5 powder Saturday  | 40.00 | 14 | 26.00 | 12 | 312.00 min | 61% |
| X6 Mayhem Saturday trees   | 50.00 | 17 | 33.00 | 10 | 330.00 min | 65% |

"% of day ghosted" = unsimulated minutes / wall-clock session minutes (510 min = 8.5 hr × 60).

### 2.4 What the table proves

Three things.

First, the gap is not a rounding error. At every scenario including the best case (G1), at least 38% of the user's day is absent from the engine's thermal integration. At the worst realistic cases (P5, X6), it's closer to two-thirds.

Second, the gap scales with the thermal-risk-relevance of the session. The days where moisture and cold-exposure matter most — powder Saturdays, holiday Mayhem, long lift lines in cold ambient — are precisely the days where the ghosted fraction is highest. This is not random; line time correlates with crowd tier, and crowd tier correlates with conditions that produce long stationary-in-cold windows.

Third, field experience — the original signal that surfaced `S26-SYSTEMATIC-MR-UNDERESTIMATION` — is the appropriate ground truth for verification. The user's decade of resort-skiing experience identified the pre-port 36-cycle output as physically impossible. That same experience will calibrate the §9 hand-comp vectors. Pre-port MR was arithmetic-on-the-wrong-quantity; post-port MR is arithmetic on a correctly-counted but incompletely-simulated session; correct MR lands somewhere else entirely, and §9 establishes where.

---

## 3. Dynamic cycleMin taxonomy

### 3.1 Why this section exists

The implementation session must treat `cycleMin` as a **variable** that takes different values across the `(terrain, crowd tier)` product space. A common failure mode for phase-loop patches is implicit assumption of a typical value (e.g., "ski cycles are ~20 min") baked into drying constants, condensation time scales, or wicking exponents. This section makes the variance explicit by enumerating the full combination space so no implementation decision can be made against a "typical" value without acknowledging the endpoints.

### 3.2 Scope: 30 combinations, not 60

Per PHY-031 §7.2, the powder flag does **not** directly modify `cycleMinRaw`. Powder instead promotes the baseline crowd tier (e.g., Tier 2 weekday + powder → Tier 4 effective). Once tier is resolved, cycleMin is a pure function of (terrain, effective tier). So the taxonomy is:

- **5 terrains** × **6 crowd tiers** = **30 cycleMin values**
- Powder flag is a *router* on (baseline_tier, day_of_week, season) → effective_tier per PHY-031 §7.2; it produces nothing new at the cycleMin arithmetic layer

A Phase A ski-history override (PHY-031 §8) also produces no new row here: the user supplies `cycleMin` directly; no table lookup is performed.

### 3.3 Full combination table

cycleMin (minutes, wall-clock) = `(runMin + DEFAULT_LIFT_MIN + liftLineMin(tier) + TRANSITION_MIN) / (1 - REST_FRACTION)`

where DEFAULT_LIFT_MIN = 7, TRANSITION_MIN = 3, REST_FRACTION = 0.20, and per-terrain `runMin` / per-tier `liftLineMin` come from PHY-031 §3.1 and §4.1 respectively.

| Terrain  | T1 Ghost Town (0 min line) | T2 Quiet (2 min) | T3 Moderate (5 min) | T4 Busy (10 min) | T5 Packed (15 min) | T6 Mayhem (20 min) |
|----------|---------------------------:|-----------------:|--------------------:|-----------------:|-------------------:|-------------------:|
| groomers |                  **16.25** |            18.75 |               22.50 |            28.75 |              35.00 |              41.25 |
| moguls   |                      21.25 |            23.75 |               27.50 |            33.75 |              40.00 |              46.25 |
| trees    |                      25.00 |            27.50 |               31.25 |            37.50 |              43.75 |          **50.00** |
| bowls    |                      20.00 |            22.50 |               26.25 |            32.50 |              38.75 |              45.00 |
| park     |                      17.50 |            20.00 |               23.75 |            30.00 |              36.25 |              42.50 |

### 3.4 Endpoints

- **Minimum cycleMin:** 16.25 min — groomers at Tier 1 Ghost Town (3-min run, 7-min lift, 0-min line, 3-min transition, rest-adjusted)
- **Maximum cycleMin:** 50.00 min — trees at Tier 6 Mayhem (10-min run, 7-min lift, 20-min line, 3-min transition, rest-adjusted)
- **Spread:** 3.08× between endpoints — the same formula produces cycleMin values that differ by a factor of 3 depending on inputs. A constant-add implementation (e.g., "always pad cycleMin by 10 min") would be wrong by up to a factor of 2× at either endpoint.

### 3.5 Engine-simulated phase-loop duration by terrain (reference)

The currently-simulated `cycleDur` (runMin + liftRideMin) is independent of crowd tier. One column, not six:

| Terrain  | `cycleDur` (runMin + DEFAULT_LIFT_MIN) |
|----------|---------------------------------------:|
| groomers |                                 10 min |
| moguls   |                                 14 min |
| trees    |                                 17 min |
| bowls    |                                 13 min |
| park     |                                 11 min |

**Observation:** engine cycleDur at any terrain is **less than** the minimum cycleMin at that terrain (16.25 for groomers T1 vs engine 10; 25.00 for trees T1 vs engine 17). The engine never over-simulates — the gap is always a deficit, never a surplus.

### 3.6 Gap by combination (minutes unsimulated per cycle)

Subtracting §3.5 from §3.3 gives the per-cycle unsimulated minutes across the full space:

| Terrain  |    T1 |    T2 |    T3 |    T4 |    T5 |    T6 |
|----------|------:|------:|------:|------:|------:|------:|
| groomers |  6.25 |  8.75 | 12.50 | 18.75 | 25.00 | 31.25 |
| moguls   |  7.25 |  9.75 | 13.50 | 19.75 | 26.00 | 32.25 |
| trees    |  8.00 | 10.50 | 14.25 | 20.50 | 26.75 | 33.00 |
| bowls    |  7.00 |  9.50 | 13.25 | 19.50 | 25.75 | 32.00 |
| park     |  6.50 |  9.00 | 12.75 | 19.00 | 25.25 | 31.50 |

**Minimum unsimulated per cycle:** 6.25 min (groomers T1).
**Maximum unsimulated per cycle:** 33.00 min (trees T6).

The gap is nowhere zero. The smallest cell (groomers at Ghost Town) still ghosts 38% of each cycle (6.25 / 16.25). The gap is not avoidable by picking a "nice" terrain/tier combination.

### 3.7 What this taxonomy commits the implementation to

The implementation session cannot treat cycleMin as a scalar or a constant-offset of cycleDur. It must:

1. Receive `cycleMin` from the `cycleOverride` supplied by `evaluate.ts:430`'s resort-cycle override helper (already in place as of S29).
2. Decompose that cycleMin into phases per §4, with phase durations that sum to `cycleMin` or to `cycleMinRaw` depending on rest handling (see §6).
3. Simulate each phase with its own MET, wind, and body state per §5.
4. Verify against §9 vectors that span the endpoints of this taxonomy (at minimum: one near-minimum case, one near-maximum case, one mid-range case).

---

## 4. Phase decomposition rules

### 4.1 The decomposition formula

For each cycle, the four calendar-derived phases are:

| Phase      | Duration                                | Source                                        |
|------------|-----------------------------------------|-----------------------------------------------|
| run        | `runMin[terrain]`                       | PHY-031 §3.1 per-terrain table, verbatim      |
| lift       | `DEFAULT_LIFT_MIN = 7`                  | PHY-031 §2.2, verbatim                        |
| line       | `liftLineMin[tier]`                     | PHY-031 §4.1 per-tier wait, verbatim          |
| transition | `TRANSITION_MIN = 3`                    | PHY-031 §2.2, verbatim                        |

Sum = `cycleMinRaw` per PHY-031 §2.1.

Session-level rest (the `/ (1 - REST_FRACTION)` expansion) is **not** a fifth phase inside the per-cycle loop. Rest is handled at the session level per §6. This is a deliberate separation: rest in this spec is "lunch + one other break," taken once per session, not once per cycle.

### 4.2 Phase ordering within one cycle iteration

Each cycle iteration simulates phases in this wall-clock order:

```
line → lift → transition → run
```

This matches the physical sequence on the mountain: the skier arrives at the base, waits in the lift line, boards and rides the lift up, transitions at the top (strap in / adjust boot buckles / adjust goggles / push-off to run entry), then descends. The cycle ends at the base of the run and immediately begins the next cycle's line. Cycles are contiguous — there is no wall-clock gap between one cycle's end and the next cycle's beginning. The only discontinuities in the session are the session-level rest events (lunch, other break) handled per §6.

Rationale for starting the cycle with line rather than run:

- **Physical arrival.** Session minute 0 places the user at the base of a lift, not at the top of a run. The first thing that happens is queuing.
- **EPOC continuity.** Line inherits the end state of the previous cycle's run (see §4.3). Starting the cycle with line makes this inheritance the natural left-to-right chain; no artificial wraparound logic needed.
- **Clean cycle 0 seed.** For the very first cycle of a session, there is no prior run to inherit from. Line seeds with pure basal MET (no EPOC), which matches "user just arrived, hasn't exerted yet" — a physically correct initial state.

The four phase durations sum to `cycleMinRaw` per PHY-031 §2.1. After N cycles, the session has simulated `N × cycleMinRaw` minutes of active-plus-stationary mountain time. Session-level rest time (per §6) is added outside the cycle loop.

### 4.3 Per-phase physics integration pattern

Each phase gets its own physics integration with phase-specific inputs. The patterns fall into two groups based on the current engine's structure:

**Phases integrated as single-step (duration-scaled):**
- **run** — already implemented (lines 654–676 of `calc_intermittent_moisture.ts` as of S29 close). Single `iterativeTSkin` solve at run-MET + descent-speed-added wind; outputs `_sweatRunG`, `_runStorage` scaled by `_runMin`. Retained as-is.

**Phases integrated as sub-stepped minute-by-minute:**
- **lift** — already implemented (lines 678–712) as a sub-stepped loop over `_liftMin` minutes with EPOC decay applied to MET. Retained as-is, except the EPOC seed changes per the continuity chain below.
- **line** — NEW. Sub-stepped loop over `liftLineMin[tier]` minutes. For cycle `c > 0`: EPOC decay seeded from end-of-run state of cycle `c-1` (the skier just descended and is now in line). For cycle 0: pure basal MET, no EPOC (skier has just arrived at the mountain and has not exerted). Body state: stationary (standing), ambient wind only.
- **transition** — NEW. Sub-stepped loop over `TRANSITION_MIN = 3` minutes. Body state: **2.0 MET** (light activity — snowboarders strapping in, skiers tightening boot buckles, adjusting goggles, small push-off to run entry; Ainsworth 2011 Compendium code 05160). Ambient wind only, no descent-speed addition, no lift-chair wind. EPOC state inherits from lift-end (see continuity chain below).

### 4.3.1 EPOC continuity chain

EPOC is excess post-exercise oxygen consumption — the elevated MET tail following a period of exertion. It does not reset at phase boundaries. The continuity chain across one cycle and between cycles is:

```
... → run_end[c-1] → line[c] → lift[c] → transition[c] → run[c] → run_end[c] → line[c+1] → ...
```

Each phase inherits the end-state MET of the physically-prior phase. For the implementation:

- **line[c] seed (c > 0):** `_METstart_line = basal + EPOC decay from run_end[c-1]`, with `tFromRunEnd` advancing per line minute.
- **line[0] seed:** `_METstart_line = basal (1.5 MET)`, no EPOC. User has just arrived.
- **lift[c] seed:** `_METstart_lift = whatever MET line[c] ended at`. tFromRunEnd continues across the line→lift boundary (i.e., if line is 10 min at tier 4, lift EPOC is evaluated at `tFromRunEnd = 10 + mn` for minute `mn` of lift).
- **transition[c] seed:** `_METstart_trans = whatever MET lift[c] ended at` (usually near-basal after 7+ min of decay). Then transition itself raises MET to 2.0 for its 3 minutes. No EPOC reset — transition is a new small exertion increment layered onto the continuing decay.
- **run[c] seed:** `_METstart_run = _METrun` (full run-MET from `_lc5Mets[phase.intensity]`). Run is the new-exertion phase that reseeds EPOC for the subsequent line[c+1].

This chain preserves the current engine's run→lift EPOC pattern and extends it consistently across the full cycle.

### 4.4 Per-phase physics inputs

Full input table (values referenced forward from §5 where each is derived):

| Input                      | line                         | lift                        | transition              | run                           |
|----------------------------|------------------------------|-----------------------------|-------------------------|-------------------------------|
| MET target                 | basal + EPOC tail from prior-cycle run | basal + EPOC decay from line-end | 2.0 MET + small EPOC residual | §5.1 run-MET |
| Wind                       | ambient only                 | ambient (+ optional lift-chair, see §5.2) | ambient only         | ambient + descent-speed-added |
| Body state                 | stationary (standing)        | stationary (seated)         | light movement          | active                        |
| Sweat production           | basal only                   | EPOC-driven residual        | light exertion          | yes, substantial              |
| EPOC continuity            | inherits prev run-end        | continues line-end          | continues lift-end      | reseeds to run-MET            |
| Sub-stepping required?     | yes (minute-by-minute)       | yes (minute-by-minute)      | yes (minute-by-minute)  | no                            |

Per-phase MET values and wind-addition rules are specified in §5. §4 establishes only the structural rules: ordering, EPOC chain, sub-stepping pattern.

### 4.5 State advancement choreography

Within one cycle iteration `c`, session-level state advances as follows:

```
1. Snapshot cycle-entry state:
   - coreTemp = estimateCoreTemp(LC5_T_CORE_BASE, _cumStorageWmin, _bodyMassKg)
   - _prevTskin = last cycle's T_skin (or 33.7°C for c=0)
   - _civdCycle = civdProtectionFromSkin(_prevTskin)
   - _Rtissue = computeRtissueFromCIVD(_civdCycle)
   - _Rclo, _runCLOdyn degradation from current cumMoisture

2. line phase (sub-stepped, liftLineMin[tier] × 1-min iterations):       [NEW]
   → EPOC seed: for c=0 pure basal (1.5 MET); for c>0 decay from prev-cycle run_end
   → wind: ambient only, no added speed
   → body state: stationary (standing)
   → outputs: _sweatLineG, _lineCondensG, _lineExcessG, _lineStorage, _METlineEnd

3. lift phase (sub-stepped, _liftMin × 1-min iterations):
   → EPOC seed: _METlineEnd (continues from end of line phase)
   → wind: ambient (+ optional lift-chair adder per §5.2)
   → body state: stationary (seated)
   → outputs: _sweatLiftG, _liftCondensG, _liftExcessG, _liftStorage, _METliftEnd

4. transition phase (sub-stepped, TRANSITION_MIN × 1-min iterations):    [NEW]
   → EPOC seed: _METliftEnd (continues from end of lift phase)
   → target MET: 2.0 MET layered onto EPOC tail
   → wind: ambient only
   → body state: light movement (strapping in / boot adjustment / push-off)
   → outputs: _sweatTransG, _transCondensG, _transExcessG, _transStorage, _METtransEnd

5. run phase (single-step, _runMin minutes):
   → MET: _METrun (reseeds full exertion)
   → wind: ambient + descent-speed-added
   → outputs: _sweatRunG, _runStorage, _TskRun, _METrunEnd
   → _METrunEnd carries forward to seed line[c+1]

6. Aggregate phase totals into cycle totals:
   _cycleProdG      = _lineProdG + _liftProdG + _transProdG + _runProdG + _insensibleG
   _cycleStorage    = _lineStorage + _liftStorage + _transStorage + _runStorage
   _cycleCondensG   = _lineCondensG + _liftCondensG + _transCondensG
     (run is single-step; its condensation handling stays as in current engine line 733-737)
   _cycleExcessG    = _lineExcessG + _liftExcessG + _transExcessG + _runExcessG

7. Cumulative session-level updates (once per cycle, unchanged from current engine logic):
   _cumStorageWmin        += _cycleStorage
   _totalFluidLoss        += _cycleProdG + respiratory moisture (scaled to _cycleMinRaw)
   _perCycleHeatStorage.push(cycleAvgW)
   _perCycleTSkin.push(...)
   _perCycleCoreTemp.push(...)
   _perCycleCIVD.push(...)

8. Moisture buffer advancement (once per cycle, using _cycleMinRaw):
   - _cycleMinRaw = _lineMin + _liftMin + _transMin + _runMin (wall-clock sum of 4 phases)
   - Insensible: 10 g/hr × _cycleMinRaw / 60  (was: _runMin + _liftMin)
   - Condensation placement: same tiered-layer assignment, condensed mass summed across all four phases
   - Overflow cascade inward: unchanged
   - Washburn wicking: exponent uses _cycleMinRaw, not _cycleMin (was: _runMin + _liftMin)
   - Shell drain: gPerHr weighted across four phases by phase minutes; drain duration scaled to _cycleMinRaw
   - Ambient vapor absorption (_aHygro, PHY-HUMID-01 §2.2 Category C): applied once per cycle; per-cycle magnitude scales with _cycleMinRaw

9. Vent events: already scales via _realCycMin = totalMin / wholeCycles; no change needed — evaluate.ts passes totalMin = durationMin and wholeCycles = totalCycles, so _realCycMin is already cycleMinRaw wall-clock.

10. Precip wetting: currently scales by _cycleMin / 60 (run+lift only). Updated to _cycleMinRaw / 60 so line-time, transition-time, and run-time precip wetting is captured.
```

**MET carry-forward across cycles:** `_METrunEnd` from cycle `c` is stored in session-level state (e.g., `_prevRunEndMET[c]`) and consumed by line[c+1]'s EPOC seed. This is the only new cross-cycle state variable this spec introduces beyond what the current engine already carries.

### 4.6 Why step 8 (moisture buffer) is scoped to `_cycleMinRaw`, not cycleDur

This is the load-bearing correction of the spec. Under the current implementation, `_cycleMin = _runMin + _liftMin` is used as the time window for physical processes that actually proceed in wall-clock time:

- **Washburn wicking** (PHY-048): `_retFrac = Math.pow(1 - _wickR, _cycleMin)` — inter-layer moisture redistribution by capillary pressure. Driven by fill-fraction differentials, not by user activity. Proceeds continuously whenever there is a gradient between wet and dry layers.
- **Shell drain** (PHY-047): `_drainG = _drainGPerHr * (_cycleMin / 60) * _outerFill` — evaporative mass transport from shell outer surface to ambient air. Driven by VPD, wind, shell `im`, and surface wetness. Proceeds continuously whenever the shell has any moisture load.
- **Insensible perspiration**: `10 g/hr × (_runMin + _liftMin) / 60` — baseline skin diffusion at ~10 g/hr. Proceeds continuously; does not pause because the user is standing still.
- **Respiratory moisture loss** (PHY-049): `_respRun.moistureGhr × (_runMin / 60)` — water lost through breathing. Proceeds continuously; the user breathes during line, lift, transition, and run. Current engine scales this to run-phase minutes only; should scale to `_cycleMinRaw`.
- **Ambient vapor absorption** (PHY-HUMID-01 v2 §2.2 Category C): `_aHygro` per-cycle magnitude. Proceeds continuously when ambient vapor pressure exceeds fabric equilibrium.
- **Precipitation wetting** (PHY-060): `precipWettingRate × (_cycleMin / 60)`. Proceeds continuously whenever precipitation is falling on the user.
- **Condensation placement** at the layer thermal gradient (PHY-068, PHY-069): happens once per cycle as a snapshot. Mass placed is the sum of condensed vapor across all phases, not just run+lift.

**The correction in §4.6 is purely an accounting fix, not a physics change.** The ratified physics from PHY-047 (shell drain), PHY-048 (per-layer buffer), PHY-049 (respiratory moisture), PHY-060 (precipitation wetting), PHY-068 (ice blockage — unchanged, still gates shell `im` below 32°F), PHY-069 (E_diff per ISO 7730), and PHY-HUMID-01 v2 (humidity regime, Category C ambient absorption) all remain semantically identical. The formulas are unchanged; only the time window over which those formulas operate is corrected from `_runMin + _liftMin` (active-skiing-only) to `_cycleMinRaw` (wall-clock-total, sum of all four phases).

**Framing this correctly:** these physical processes are always on. Wicking proceeds because capillaries are always wet-wet differential-driven. Shell drain proceeds because VPD always exists at a wet-fabric interface. Insensible proceeds because skin always diffuses. Ambient absorption proceeds because VP-gradient always exists. There are no points in time between session start and session end when these processes pause — not while waiting in line, not while riding the lift, not while transitioning, not while descending. The engine's current `_cycleMin = _runMin + _liftMin` scoping accidentally pauses them during line and transition time. This spec un-pauses them.

**Does this over-count drying?** No. Each physical process has its own rate, and its own input state:

- Washburn wicking rate depends on the **current** fill-fraction differential, which evolves cycle-by-cycle. During a line phase, if sweat production has been basal for 15 minutes, wicking redistributes mass from wherever has highest fill toward wherever has lowest. Doesn't create new mass; just redistributes. Correctly extending the exponent to wall-clock time means layers equilibrate more, not less, during stationary phases — which is physically correct.
- Shell drain rate depends on the **current** outer-layer fill (`_outerFill`) and ambient VPD. If the shell is not saturated and ambient is dry, drain proceeds; if the shell is dry, drain is zero regardless of time window. Correctly extending the duration captures more drying during line/transition when the user has just sweated through run/lift.
- Sweat production (the thing that offsets drying) is handled per-phase in steps 2–5. Line and transition produce their own (small) sweat values, not run-MET sweat values. No double-counting.

**Does this under-count anything else?** The one item to flag: condensation placement is a per-cycle snapshot of thermal gradient. If the thermal gradient differs materially between line (ambient cold, narrow gradient) and run (wide gradient from active body), a single-snapshot condensation severity may over- or under-estimate in edge cases. This is the *current* engine's approach (one snapshot per cycle even with run+lift only), unchanged by this spec. Flagged as preserved-as-is; a future Model Refinement could convert condensation placement to per-phase integration, but that is outside this spec's scope.

### 4.7 What §4 does not do

- Does not specify per-phase MET values (§5)
- Does not specify per-phase wind rules beyond the structural "ambient only / speed-added" distinction (§5)
- Does not specify rest-phase handling — rest is session-level, not per-cycle (§6)
- Does not address ski-history override — Phase A supplies `totalCycles` only; the decomposition in §4 applies per current-session terrain and tier regardless of override source
- Does not touch vent-event timing — already wall-clock-correct via `_realCycMin = totalMin / wholeCycles`
- Does not alter the cardinal invariants: `calcIntermittentMoisture` signature (other than any Cardinal Rule #8-gated addition required for rest handling per §6), the `computeEmax` / `getDrainRate` / `computeSweatRate` / `calcIntermittentMoisture` / `heatLossRisk` function bodies, or the PHY-068 ice-blockage shell `im` degradation

---

## 5. Per-phase physics model

### 5.1 Purpose of this section

§4 established *what* each phase is (ordering, duration, sub-stepping, EPOC continuity). §5 establishes the specific *physical inputs* for each phase: MET values, wind source, body state, which thermal-engine primitives apply. Every MET value in this section traces to a cited source per Cardinal Rule #1.

### 5.2 Per-phase MET table

| Phase      | Target MET | Source / Justification                                                                                       | EPOC behavior                                  |
|------------|------------|--------------------------------------------------------------------------------------------------------------|------------------------------------------------|
| line       | **1.8**    | Ainsworth 2011 Compendium code 20030 "standing, talking" = 1.8 MET. Skier in lift line: standing, gear on, conversational, intermittent light movement. Between sitting quiet (1.3) and standing light-effort task (2.0). | Overlays slow-tail EPOC decay from prior-cycle run-end (c > 0) or pure basal (c = 0) |
| lift       | **1.5**    | Matches current engine `_METlift = 1.5` (LC5 ratified) and Ainsworth 2011 Compendium code 07022 range "sitting quietly." Seated on lift chair, gear on, no active movement. | Overlays slow-tail EPOC decay continuing from line-end |
| transition | **2.0**    | Ainsworth 2011 Compendium code 05160 "standing, light effort tasks (pump gas, change light bulb, etc.)" = 2.0 MET. Ski transition is 3 minutes of strapping in (snowboarders) or boot-buckle tightening and pole adjustment (skiers), plus small push-off to run entry. Fits the Compendium's "standing with light intermittent movement" bracket. | Overlays residual EPOC from lift-end; transition itself does not reseed EPOC |
| run        | `_METrun` from `profile.phases[0].intensity` via `_lc5Mets` (low=1.5, moderate=5, high=8, very_high=10) | LC5 ratified per PHY-031 v1 §3.1 intensity mapping; preserved verbatim per Cardinal Rule #8 | Run reseeds EPOC; `_METrunEnd` carries to line[c+1] |

### 5.3 EPOC mechanics across the chain

The engine's existing EPOC implementation (`epocParams(_METrun, _METlift)`) gives two-timescale decay:

```
METnow = METbase + aFast · exp(-t/τFast) + aSlow · exp(-t/τSlow)
```

Where `t` is minutes elapsed since run-end, `METbase` is the current phase's target MET, `aFast` and `aSlow` are amplitudes derived from the run-to-rest MET delta, and `τFast` and `τSlow` are the fast and slow time constants. This spec does not modify `epocParams` or the decay formula.

What this spec changes: the EPOC evaluation extends across line + lift + transition phases as a continuous chain, not just across lift as currently. Implementation:

```
For each cycle c ≥ 1:
  tFromRunEnd at start of line[c]  = 0  (line begins immediately after prev-cycle run-end)
  tFromRunEnd at start of lift[c]  = lineMin
  tFromRunEnd at start of trans[c] = lineMin + liftMin
  tFromRunEnd at start of run[c]   = N/A — run resets and uses _METrun directly

For cycle c = 0:
  line[0] uses basal (1.5 MET) with no EPOC overlay (no prior run exists)
  lift[0], transition[0], run[0] follow the c≥1 pattern
```

**Why this matters:** EPOC decay is a physically real heat-producing tail. The current engine correctly captures the run→lift EPOC portion. Without extending the decay into line and transition, any residual EPOC tail that should physically still be elevating MET during the line wait (e.g., first 2–3 min of line after a 7-min lift on a short-run terrain) is discarded. That would slightly under-count heat production during line, biasing the line thermal balance too far toward cold. Extending the chain is the correct physics.

**Magnitude check:** for τFast ≈ 1 min and τSlow ≈ 10–15 min applied to a moderate run-to-basal delta of ~6 MET, by `tFromRunEnd = 10 min` (end of 10-min lift), the fast component is essentially gone (`exp(-10/1)` ≈ 0) and the slow component retains ~40–50% of its initial amplitude. Line-start EPOC residual is meaningful; line-end residual has decayed further but is nonzero. The numerics bear out.

### 5.4 Per-phase wind source

| Phase      | Wind input to thermal-engine primitives                          | Notes                                                                                                                           |
|------------|------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| line       | `windMph` (ambient only)                                         | User stationary at base of lift. No speed-added wind. No protection from ambient wind by virtue of being in line (exposed).     |
| lift       | `windMph` (ambient only, matches current engine lines 686–691)   | User seated on lift chair. Chair motion along cable (~5 mph) is handled as still-air-column ambient, matching current implementation `computeConvectiveHeatLoss(_TskL, _TambC, _Rclo, _bsa, _windMs, 0)` (the `0` is the speed-added term). No change. |
| transition | `windMph` (ambient only)                                         | Standing/walking in ski boots at lift top. No descent speed, no lift-chair motion.                                              |
| run        | `windMph + _cycleSpeedWMs` (descent-speed-added, current engine line 655) | Already ratified. Descent speed from `descentSpeedWind(profileKey)` × terrain turn factor. Preserved per Cardinal Rule #8.        |

### 5.5 Per-phase body state

| Phase      | Body state                                                                                           | Impact on thermal-engine primitives                                                                                           |
|------------|------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| line       | Standing, gear on, stationary or light shuffling in place                                            | Low `_Qmet`, low sweat production. Shivering potentially activated via `shiveringBoost` if `_TambC` cold and CLO insufficient. Condensation may occur as vapor-at-skin meets cold shell with narrow thermal gradient. |
| lift       | Seated, gear on, no active movement                                                                  | Matches current engine: shivering check, EPOC decay, cold exposure to ambient. Per-minute sub-stepping per current implementation.                                              |
| transition | Standing with brief movement (strap-in, buckle-tighten, small push-off), gear on                     | Slightly elevated `_Qmet` above basal; small sweat production kicks in if run-residual moisture plus thermal balance push `_eReqTrans > 0`. Shivering unlikely at 2.0 MET but not impossible in extreme cold. |
| run        | Active descent, gear on, high MET, high descent-speed wind                                           | Matches current engine run-phase: full `iterativeTSkin` solve with speed-added wind; `computeSweatRate` driven by `_eReq` from the Qmet - Qpass residual.                                                         |

### 5.6 Thermal-engine primitive mapping

Every phase calls the same suite of primitives. No phase is special-cased to skip primitives. This preserves physics consistency across the cycle:

| Primitive                             | line | lift | transition | run |
|---------------------------------------|:----:|:----:|:----------:|:---:|
| `iterativeTSkin`                      |  ✓   |  ✓   |     ✓      |  ✓  |
| `computeMetabolicHeat`                |  ✓   |  ✓   |     ✓      |  ✓  |
| `computeConvectiveHeatLoss`           |  ✓   |  ✓   |     ✓      |  ✓  |
| `computeRadiativeHeatLoss`            |  ✓   |  ✓   |     ✓      |  ✓  |
| `computeRespiratoryHeatLoss`          |  ✓   |  ✓   |     ✓      |  ✓  |
| `computeEdiff` (PHY-069 ISO 7730)     |  ✓   |  ✓   |     ✓      |  ✓  |
| `computeEmax`                         |  ✓   |  ✓   |     ✓      |  ✓  |
| `computeSweatRate`                    |  ✓   |  ✓   |     ✓      |  ✓  |
| `shiveringBoost`                      |  ✓   |  ✓   |     ✓      |  N/A (run MET precludes) |
| `civdProtectionFromSkin` (PHY-070a)   | once/cycle snapshot before line | — | — | — |
| `computeRtissueFromCIVD`              | once/cycle snapshot before line | — | — | — |

CIVD and Rtissue snapshots happen **once per cycle** (per current engine pattern at lines 645–652), based on `_prevTskin` from the previous cycle's run-end. This spec does not change CIVD cadence. The snapshot taken at cycle entry is the `_Rtissue` used by all four phases of that cycle.

### 5.7 Sweat-rate accumulation across phases

The current engine computes `_sweatRateRunGhr` during run (single-step) and uses it in moisture accounting (line 726: `_runProdG = _srRun.sweatGPerHr × (_runMin / 60)`). Lift-phase sweat is computed per-minute (line 704: `_sweatLiftG += _srL.sweatGPerHr × (1/60)`) and summed.

This spec extends the pattern:

- `_sweatLineG` accumulates per minute across the line sub-step loop
- `_sweatTransG` accumulates per minute across the transition sub-step loop
- `_cycleProdG = _lineProdG + _liftProdG + _transProdG + _runProdG + _insensibleG`

Insensible perspiration scaling changes from `_runMin + _liftMin` (current line 725) to `_cycleMinRaw` per §4.6. Respiratory moisture follows the same "processes always on" logic (§4.6) — the user breathes during all four phases, and `_totalFluidLoss` accumulates respiratory mass scaled to `_cycleMinRaw` rather than `_runMin` alone.

### 5.8 Condensation handling per phase

The current engine handles condensation in two places:

1. **Lift-phase per-minute** (lines 705–708): `_liftCondensG` and `_liftExcessG` accumulate per minute from `_liftVaporMin` exceeding `_liftSurfMin` (shell surface-pass rate).
2. **Run-phase once-per-cycle** (lines 733–737): `_condensHr` computed from run sweat rate vs vapor-exit rate.

§5 extends the lift-phase pattern to line and transition:

- Line phase: per-minute condensation accumulation identical to lift. `_lineCondensG`, `_lineExcessG` accumulate from low-MET sweat production encountering the shell-wall thermal gradient. Line has the widest ambient-to-skin gradient of any phase (stationary body in cold wind), so condensation per unit vapor may be relatively high despite low vapor production.
- Transition phase: per-minute condensation accumulation. `_transCondensG`, `_transExcessG`. Slightly elevated MET produces somewhat more vapor than lift; thermal gradient similar to line.
- Run phase: unchanged (single-step per current engine).

All four phases' condensation mass sums into the per-cycle `_cycleCondensG`, which then feeds `_fabricInG` and the condensation placement step (current lines 758–774). Placement logic itself — the layer-gradient-weighted `_condensWeights` distribution — is unchanged by this spec.

**Flagged for future Model Refinement: `MR-PHY-031-CONDENSATION-PER-PHASE`.** The current per-cycle thermal-gradient snapshot (taken at cycle-entry from `_prevTskin`) places all condensed mass against a single gradient state per cycle. Under this spec's extension to four phases, condensation is produced by four physically distinct states:

- Line: wide ambient-to-skin gradient (stationary body in cold wind), narrow mid-layer-to-skin gradient (little metabolic heat inflow to mid layer)
- Lift: similar to line, with slight EPOC-residual skin warmth
- Transition: transient intermediate gradient as body begins warming
- Run: narrow ambient-to-skin gradient (active body), wide mid-layer gradient due to high MET heat transport

Placing all four phases' condensation against one gradient snapshot (from cycle-entry) under-resolves the dynamics. Edge cases where this matters: very cold ambient with long line/lift (most condensation actually forms during stationary phases, against a narrow-to-skin gradient which should place mass at outer layers, not at the mid-layer where the snapshot may predict based on higher skin temp). Conversely, at cycle-entry following a warm run (skin temp elevated), snapshot places condensation too inward relative to what line-phase conditions would produce.

**Not in scope for this spec.** The current single-snapshot approach is the ratified behavior (present in PHY-068 condensation placement as LC5-ratified). Re-working placement to per-phase gradient sampling requires: (a) re-running `iterativeTSkin` outputs to produce per-phase `_tLayerC` values, (b) pro-rating `_condensWeights` by per-phase condensation mass, (c) validating against all existing spec-locks. This is implementation-session-plus-scope; this spec preserves the current placement logic and flags the refinement for a future session.

### 5.9 Heat-storage bookkeeping per phase

Current engine tracks `_runStorage = _runNetHeat × _runMin` (line 676, single-step) and `_liftStorage += _liftNetHeat × 1` per minute (line 710). Summed to `_cycleTotalWmin` at cycle end.

This spec extends to four phases:

- `_lineStorage += _lineNetHeat × 1` per minute
- `_transStorage += _transNetHeat × 1` per minute
- `_cycleTotalWmin = _lineStorage + _liftStorage + _transStorage + _runStorage`

`_lineNetHeat` and `_transNetHeat` follow the same pattern as `_liftNetHeat`: residual heat minus evaporative heat loss (`resPhase - srPhase.qEvapW`).

### 5.10 What §5 does not change

- No change to `_lc5Mets` mapping (LC5 ratified; Cardinal Rule #8)
- No change to `epocParams` formula, amplitudes, or time constants
- No change to the function bodies of `iterativeTSkin`, `computeMetabolicHeat`, `computeConvectiveHeatLoss`, `computeRadiativeHeatLoss`, `computeRespiratoryHeatLoss`, `computeEdiff`, `computeEmax`, `computeSweatRate`, `shiveringBoost`, `civdProtectionFromSkin`, `computeRtissueFromCIVD`
- No change to `descentSpeedWind` or terrain turn-factor lookup
- No change to the run-phase single-step integration pattern (preserved at current lines 654–676)
- No change to CIVD cadence (per-cycle snapshot from prior T_skin)
- No change to the condensation placement logic (layer-gradient-weighted, current lines 758–773) — only the mass input (sum across 4 phases) changes

---

## 6. Session-level rest handling

### 6.1 What rest is, in this spec

Rest is wall-clock time during a ski session when the user is **not** engaged in the line → lift → transition → run cycle. Rest is indoor — the user has walked into the lodge, sat down (lunch) or briefly warmed up (restroom / boot-reset), and is physically separated from the mountain ambient regime.

Per PHY-031 §2.1, rest is encoded in the cycle formula via `cycleMin = cycleMinRaw / (1 - REST_FRACTION)`, which *expands* each cycle's wall-clock time to absorb 20% of the session as rest overhead. Under the current (pre-reconciliation) engine, this expansion is arithmetic-only: fewer cycles fit in the session, but rest time itself is never physically simulated.

This spec resolves rest into a physical phase — simulated under indoor-ambient conditions, advancing session state, producing drying effects on the moisture buffer — rather than a bookkeeping abstraction.

### 6.2 Methodology resolution (S30 pre-ratified)

Three candidate approaches were considered during S30 pre-drafting:

- **Option A — Session-duration reduction.** Rest is not a simulated phase. `REST_FRACTION = 0.20` reduces the effective session time to 80% wall-clock, and cycles fit into that reduced budget. Implementation = unchanged from current `computeCycle` arithmetic; zero physics added. **Rejected:** rest periods have measurable drying effects on the moisture buffer that propagate into afternoon MR. A session where the user eats a warm lunch drying their base layer for 45 minutes will end the afternoon with materially lower MR than a session that skipped lunch, and Option A cannot capture that difference. Arithmetic parity with the wrong quantity is still the wrong quantity.

- **Option B — Rest as a simulated phase.** Rest is a discrete indoor phase with its own MET, ambient conditions, drying physics, and duration. Inserted into the session timeline at specific wall-clock times. Advances all session-level accumulators (`cumMoisture` via buffer drying, `_totalFluidLoss` via basal metabolism + respiration, `_cumStorageWmin` via warm thermal regime). **Selected.**

- **Option C — Hybrid: arithmetic reduction + selective phase simulation.** Skipped in favor of B's clean physics.

**Ratified approach: Option B.**

### 6.3 Rest model — two rest phases, two yes/no inputs

The user form captures rest behavior with two boolean inputs on the `Set the Scene` form:

| Input field         | User question                                             | Phase inserted if true |
|---------------------|-----------------------------------------------------------|------------------------|
| `lunch`             | "Will you take a lunch break?"                            | 45-min indoor lunch    |
| `otherBreak`        | "Will you take at least one other ~15-minute break?"      | 15-min indoor break    |

Both rest phases are **indoor**. No user-selectable indoor/outdoor toggle. No duration slider. No count above one-of-each. Impromptu on-slope stops (comparing notes on a run, waiting for stragglers, quick gear adjustments mid-slope) are **not modeled** — they are unpredictable, short, and physically offset by lift-line time variance already captured in `liftLineMin(crowdTier)`.

**Ensemble state during each rest phase (physics-relevant distinction):**

- **Lunch (45 min):** User removes shell jacket (draped over a chair) and helmet. Inner ensemble — base + mid + insulative — is fully exposed to indoor air. Shell drains separately as a detached item. Inner layers drain directly against indoor air without shell-barrier restriction.
- **otherBreak (15 min):** User keeps shell on (quick warm-up, possibly restroom, not a full disrobing). Full ensemble stays assembled; indoor conditions apply to the worn ensemble.

This distinction drives the depth of drying during rest. Lunch is a substantially larger drying event than otherBreak, not only because it's 3× longer but because the shell-off state unlocks inner-layer evaporation that is shell-gated during otherBreak. §6.7 integrates each.

Fallback behavior:

- `lunch = true, otherBreak = true` — both phases inserted
- `lunch = true, otherBreak = false` — only lunch inserted
- `lunch = false, otherBreak = true` — only otherBreak inserted
- `lunch = false, otherBreak = false` — **no rest phase simulated.** `REST_FRACTION` arithmetic still applies at the calendar layer (producing cycle count from `floor(sessionMin / cycleMin)` per PHY-031 §2.1), but no indoor drying event is modeled

### 6.4 Rest-phase physical inputs

Indoor conditions are fixed, not ambient-offset or user-selectable:

| Input                      | Value                         | Source / justification                                                                 |
|----------------------------|-------------------------------|----------------------------------------------------------------------------------------|
| Indoor temperature         | **20°C (68°F)**               | Typical resort lodge HVAC setpoint. ASHRAE Standard 55-2020 comfort range 20–23°C for winter-clothed occupants.    |
| Indoor relative humidity   | **40%**                       | Typical heated-winter indoor range 30–50%; 40% mid-point. ASHRAE 55 envelope.                                      |
| Indoor wind                | **0 m/s**                     | Still indoor air (ignores minor HVAC circulation; below threshold for convective-boost effects)                    |
| Solar radiation            | **0 W/m²**                    | Indoor — no solar gain applied                                                                                     |

Rest-phase MET values:

| Rest phase  | Duration | MET   | Source                                                                                                             |
|-------------|----------|-------|--------------------------------------------------------------------------------------------------------------------|
| lunch       | 45 min   | **1.5** | Ainsworth 2011 Compendium code 13030 "sitting, eating" = 1.5 MET. User seated in lodge, eating meal, gear partially removed (helmet off, jacket open). |
| otherBreak  | 15 min   | **1.8** | Ainsworth 2011 Compendium code 20030 "standing, talking" = 1.8 MET. User standing at lodge counter, using restroom, or seated briefly with partial gear-off. |

### 6.5 Wall-clock placement

Rest phases are placed at **fixed wall-clock times**, not at cycle-count-relative positions. Rationale: wall-clock placement gives deterministic behavior invariant to session start time or `totalCycles`, and it matches the physical reality that lunch hunger and afternoon fatigue occur at real times of day, not at abstract cycle boundaries.

| Rest phase  | Wall-clock target | Rationale                                                                                      |
|-------------|-------------------|------------------------------------------------------------------------------------------------|
| lunch       | **12:15 PM**      | Standard resort lunch window (noon–1 PM); 12:15 splits the window fairly across early and late arrivals |
| otherBreak  | **2:30 PM**       | Mid-afternoon warm-up / boot-reset window, after lunch is settled, before last-chair push      |

### 6.6 Edge-case handling for placement

Rest phases that fall outside the active session window are skipped:

- **Session ends before rest target.** If session end time < rest wall-clock target (e.g., session 8 AM–12 PM, lunch target 12:15 PM), the rest phase is not inserted. No error; user simply didn't reach the rest window.
- **Session starts after rest target.** If session start time > rest wall-clock target (e.g., session starts at 1 PM, lunch target 12:15 PM), the rest phase is not inserted.
- **Rest target falls during session.** Rest phase is inserted at the target wall-clock time. Cycles that would have executed during that window are displaced — the rest phase consumes that wall-clock; cycles resume after the rest phase ends.
- **Rest phases overlap.** Not physically possible given the fixed 12:15 / 2:30 targets and rest durations (45 min + 15 min = 60 min total, well below the 2h15m gap between 12:15 and 2:30). No handling required.

Implementation pattern:

```
For each cycle c in 0..N-1:
  Compute cycle start wall-clock = sessionStart + sum of prior cycles' durations + sum of prior rest durations
  If any rest phase target falls within this cycle's wall-clock window:
    Insert rest phase, advance wall-clock by rest duration
    Run rest-phase physics (§6.7)
  Run cycle c (line → lift → transition → run per §4–§5)
```

### 6.7 Rest-phase physics integration

Each rest phase integrates the thermal-engine primitives under indoor conditions. Sub-stepping follows the lift-phase pattern (minute-by-minute) to capture time-dependent drying and thermal re-equilibration. The critical distinction between the two rest phases is **ensemble state**:

- **Lunch (45 min):** User removes shell jacket (draped over chair) and helmet. Inner ensemble — base + mid + insulative layers — is fully exposed to indoor air. Shell is not on the body; it drains separately as a detached item.
- **otherBreak (15 min):** User keeps shell on (quick warm-up; doesn't fully disrobe). Full ensemble stays assembled; indoor conditions apply to worn ensemble.

This difference is physically significant. Shell-off during lunch allows unrestricted evaporation from base + mid + insulative; the inner ensemble's effective `im` jumps to the much higher value of those layers in series without the shell barrier. With shell on during otherBreak, evaporation remains shell-gated; drying still increases vs on-mountain but less dramatically.

#### 6.7.1 Lunch integration (shell-off)

```
_effectiveIm_lunch = imSeries(base, mid, insulative)     // shell excluded
_Rclo_lunch        = _Rclo × (1 - shellCLOfraction)      // shell CLO removed from series

For each minute mn in 0..44:
  _TambC_indoor = 20
  _humidity_indoor = 40
  _windMs_indoor = 0

  // Body ensemble integration — shell-off
  iterativeTSkin(coreTemp, _TambC_indoor, _Rtissue, _Rclo_lunch, _RaIndoor, _bsa,
                 1.5, 0, 40, _effectiveIm_lunch, _bodyFatPct, 6, 0.1)
  → _TskLunch, and derived Qmet, Qconv, Qrad, Qresp, Ediff, Emax, sweatRate

  Accumulate per-minute body-ensemble physics as in lift phase pattern

  // Inner-layer drying — direct exposure
  For each inner layer L in [base, mid, insulative]:
    _drainRate_L = getDrainRate(68, 40, 0, L.im, _Rclo_lunch, _bsa)
    _drainG_L = _drainRate_L × (1/60) × min(1, L.buffer / L.cap)
    L.buffer -= _drainG_L

  // Shell draining separately, off-body
  _drainRate_shell_draped = 2 × getDrainRate(68, 40, 0, shell.im, 0, _bsa)
    // 2× because both sides of the fabric are exposed to indoor air (not body on one side)
    // 0 for _Rclo because shell is detached from body; no body-side thermal resistance
  _drainG_shell = _drainRate_shell_draped × (1/60) × min(1, shell.buffer / shell.cap)
  shell.buffer -= _drainG_shell
```

After the 45-minute loop:

- Shell is re-donned. Next cycle's `_effectiveIm` reverts to full-ensemble calculation including the drained shell buffer.
- Ambient vapor absorption (`_aHygro_indoor_lunch`) recomputed under indoor T + RH, applied once to the outermost layer of the **inner ensemble** (i.e., insulative during lunch, because shell is off). Shell, being detached and exposed to the same indoor air on both sides, may hygro-absorb or desorb depending on its current fill; approximated as net-zero for a 45-minute window (well-conditioned polyester/nylon shell fabric does not materially change hygroscopic state in 45 min at 40% RH).

#### 6.7.2 otherBreak integration (shell-on)

```
_effectiveIm_break = ensembleIm (full ensemble, unchanged from on-mountain)
_Rclo_break        = _Rclo (full ensemble)

For each minute mn in 0..14:
  _TambC_indoor = 20
  _humidity_indoor = 40
  _windMs_indoor = 0

  iterativeTSkin(coreTemp, _TambC_indoor, _Rtissue, _Rclo_break, _RaIndoor, _bsa,
                 1.8, 0, 40, _effectiveIm_break, _bodyFatPct, 6, 0.1)
  → _TskBreak, and derived primitives

  Accumulate per-minute physics as in lift phase pattern.

  // Shell drains on-body at indoor conditions
  _drainRate_shell_worn = getDrainRate(68, 40, 0, shell.im, _totalCLO, _bsa)
  _drainG_shell = _drainRate_shell_worn × (1/60) × min(1, shell.buffer / shell.cap)
  shell.buffer -= _drainG_shell

  // Inner layers drain via cascade + Washburn at whatever rate the shell-gated physics produces
  (standard per-cycle moisture buffer pattern applies, but scoped to 15 min)
```

After the 15-minute loop:

- `_aHygro_indoor_break` recomputed under indoor T + RH, applied to shell (outermost worn layer), same as §5.7 pattern but with indoor inputs.

#### 6.7.3 Shared post-rest bookkeeping (both lunch and otherBreak)

After the rest phase minute loop, apply once:

- `_totalFluidLoss += _sweatRestG + _insensibleRest + _respRest_total.moistureGhr × (restDurMin / 60)` (processes always on, per §4.6)
- `_cumStorageWmin += _restStorage`
- `_perCycleHeatStorage.push(...)` — rest phases are pushed into the per-cycle arrays with a phase marker (`phase: 'lunch'` or `phase: 'otherBreak'`) to distinguish from real cycles. Useful for the sawtooth diagnostic chart to show the drying-event flat-or-falling segment in the afternoon.
- `_prevTskin = _TskRestEnd` — carries into the next cycle's CIVD snapshot

### 6.8 Why indoor drying is load-bearing

A user who eats a 45-minute lunch at 12:15 PM has:

- Left a cold, wind-exposed ambient (outside: say 20°F, 40% RH, 5 mph wind)
- Entered a warm, dry, still-air indoor regime (68°F, 40% RH, 0 mph wind)
- Removed shell jacket and helmet, exposing base + mid + insulative layers to indoor air directly

The shell drain rate and inner-layer drying rate both rise sharply under indoor conditions because indoor shell surface temperature rapidly equilibrates to ~20°C (no cold-sink conduction to ambient), while on the mountain the shell surface had been closer to 0°C. Saturation vapor pressure at the shell surface is temperature-dependent:

- Shell surface at 0°C: `psat ≈ 0.61 kPa`
- Shell surface at 20°C: `psat ≈ 2.34 kPa`

A ~4× rise in shell-surface saturation VP. The vapor-pressure gradient from the wet-fabric interface *outward* to ambient (at 40% × 2.34 = 0.94 kPa indoor vs 40% × 0.61 = 0.24 kPa outdoor) drives substantially stronger drying even though both indoor and outdoor are at 40% RH. Combined with still-air (no wind cooling the shell back down) and with the jacket removed entirely (`_effectiveIm` during lunch drops shell from the series — see §6.7 ensemble-change handling), the net effect is a sustained drying regime that typically reduces layer buffer fill materially over the 45-minute lunch.

The pre-reconciliation engine captures none of this. A user coming off lunch should have meaningfully drier layers than one who didn't stop; that reset effect propagates forward through the afternoon's thermal balance. **Ratifying Option B with shell-off handling is what allows the model to represent the actual physics of how lodge time restores ensemble capacity.**

### 6.9 Interaction with REST_FRACTION

`REST_FRACTION = 0.20` remains in the PHY-031 §2.1 cycle formula as ratified. It continues to expand `cycleMinRaw` into wall-clock `cycleMin`, which then produces the cycle count:

```
cycleMinRaw = runMin + liftRideMin + liftLineMin + TRANSITION_MIN
cycleMin    = cycleMinRaw / (1 - REST_FRACTION)   // e.g., 13 / 0.80 = 16.25
totalCycles = floor(durationMin / cycleMin)        // e.g., floor(510 / 16.25) = 31
```

The `REST_FRACTION` term expands each cycle's wall-clock allocation: a cycle whose active content is 13 min is budgeted 16.25 min of session wall-clock, leaving 3.25 min per cycle (20%) as rest overhead. Over 31 cycles × 16.25 min = 503.75 min, the session accommodates roughly 100 min of rest overhead in the wall-clock accounting.

This arithmetic-layer rest accounting and the Option B physics simulation are **not double-counting**. The arithmetic governs the cycle *budget* (how many descents fit in the day given rest overhead). The physics simulation produces the indoor *effects* (drying, basal MET, thermal recovery) during the 45 + 15 = 60 minutes of explicitly simulated rest. The two operate on different quantities:

- Arithmetic: "how many descents fit in the day given 20% rest overhead" (cycle count)
- Physics: "what happens to the user during the lodge time" (state advancement)

The 60 minutes of simulated rest (lunch 45 + otherBreak 15) is a subset of the overall 20% rest fraction (~102 minutes on an 8.5-hour day). The remainder (~42 minutes) represents untracked small stoppages: boot adjustments, waiting for friends, brief on-slope pauses. That untracked time is absorbed by the REST_FRACTION cycle-budget expansion, never physics-simulated.

### 6.10 What §6 does not do

- Does not expand the user form beyond two booleans
- Does not introduce duration sliders, indoor/outdoor toggles, or break-count counters
- Does not model on-slope impromptu stops (offset by lift-line-time variance per §6.3)
- Does not allow user-selectable indoor conditions (fixed 20°C / 40% RH / 0 m/s)
- Does not modify `REST_FRACTION` value (LOCKED from PHY-031 v1 §2.2 = 0.20)
- Does not affect cycle count — `totalCycles` still computed per PHY-031 §2.1 arithmetic
- Does not modify `calcIntermittentMoisture` signature. Rest booleans pass through the `CycleOverride` interface as optional fields — see §8.6 for the mandated integration mechanism.
- Does not model Level C per-item disrobing (helmet, goggles, gloves separately). Level B (shell-off vs shell-on) is the ratified depth; helmet/goggles/gloves moisture-mass contribution during rest is treated as negligible.
- Does not modify any inner-layer removal during rest. Lunch is shell-off only; base, mid, and insulative stay on the body.
- Does not re-derive the draped-shell drain coefficient from first principles. The `2×` factor for both-sides exposure is a first-order approximation (a fully-draped fabric has both surfaces exposed to the same ambient, roughly doubling the boundary-layer evaporation relative to the body-side-blocked case). Flagged for Model Refinement as `MR-PHY-031-DRAPED-SHELL-DRAIN` — a more rigorous derivation would incorporate draped geometry (folds reduce effective exposed area), lodge air-exchange rate (higher VP near HVAC returns), and shell fabric-specific absorption kinetics. Not in scope for this spec.

---

## 7. (Reserved — intentionally omitted)

### 7.1 Why this section is empty

The S30 kickoff skeleton listed §7 as "History-override phase decomposition," expected to specify how the engine decomposes a Phase A `cycleOverride` (where `totalCycles` and `cycleMin` come from user-reported `runsPerDay` / `hoursPerDay` back-calculation per PHY-031 §8.2) into the four phases defined in §4.

Analysis during S30 drafting established that **Phase A is a cycle-COUNT override, not a decomposition override.** Per PHY-031 v1 §8.1:

> "Historical data overrides cycle COUNT, not per-cycle physics. MET, sweat rate, cold penalty, evaporative drain, and all thermal-engine primitives remain driven by the ratified thermodynamic engine. User history only replaces the calendar-derived `totalCycles`."

A Phase A session still supplies current-session `terrain`, `crowd tier` (calendar-derived from date), and `powder flag` on the `Set the Scene` trip form. Those inputs drive the phase decomposition via the same machinery as a calendar-only session. Phase A replaces the calendar's cycle-count output; it does not replace the calendar's terrain or tier inputs to phase decomposition.

Therefore the three options the S30 kickoff listed for §7 — (a) use calendar-implied split for the terrain + inferred default tier, (b) use a fixed "typical" split, (c) refuse to decompose — collapse:

- Option (a) reduces to "use the current session's terrain and tier," which is what every non-history session already does. No special handling required.
- Options (b) and (c) are unnecessary; Phase A does not need a substitute decomposition because the current session always supplies real terrain and tier.

§2.2.5 of this spec ("Ski-history override is not a gap scenario") makes the same point. Phase A exhibits the same cycleMin gap as the equivalent calendar scenario at the user's current-session terrain and tier. No Phase-A-specific physics applies.

### 7.2 What future sessions should not do

A future session that looks at the 12-section kickoff skeleton and notices this spec has only 11 populated sections may be tempted to "fill in" §7 with something. This would be drift. §7 is empty because the problem it was reserved to solve does not exist, not because the problem was skipped. Phases B, C, D of ski-history integration (GPX, Strava/Garmin OAuth, screenshot import per PHY-031 §8.3) carry their own potential decomposition questions if they supply phase-level data the user's form does not; those questions are out of scope for this spec and do not justify reviving §7 here.

---

## 8. Blast-radius inventory

### 8.1 Purpose of this section

Before the implementation session begins, name every file the patch will touch, every test file that needs extension, every caller site that feeds `cycleOverride`, and every Cardinal Rule #8 exposure level by file. This is the pre-flight checklist. If a file is in this inventory, the implementation session expects to edit it. If a file is not in this inventory and ends up edited, that's scope drift to flag.

### 8.2 Files touched — source

| File | Edit scope | Cardinal Rule #8 exposure | Lines affected (approximate, S29 baseline commit `29e0b30`) |
|------|-----------|---------------------------|-------------------------------------------------------------|
| `packages/engine/src/moisture/calc_intermittent_moisture.ts` | Extend phase loop from 2 phases (run + lift) to 4 phases (line + lift + transition + run) per §4. Add rest-phase integration per §6.7 between cycles at wall-clock targets. Fix time-scaled accumulator scoping from `_runMin + _liftMin` to `_cycleMinRaw` per §4.6. Add `_prevRunEndMET` cross-cycle state. | **HIGH** — phase-loop semantics change, accumulator scope change, EPOC chain extension. All touches must be verified against §9 hand-comp vectors before patch lands. | ~500–900 (phase loop body) plus new rest-insertion block |
| `packages/engine/src/activities/phy031_constants.ts` | No change expected. Constants already ratified at S29; §4–§6 do not introduce new constants (rest MET values 1.5/1.8/2.0 and indoor T/RH 20/40 can be inlined at the call site or added to an extension module). | LOW | 0 (ideally) or +4 for added constants if co-located |
| `packages/engine/src/activities/crowd_factor.ts` | No change. `getCrowdFactor` and `computeCycle` produce `totalCycles` and `cycleMin`; both are already consumed correctly. This spec reshapes how the consumer uses `cycleMin`, not how the producer computes it. | LOW | 0 |
| `packages/engine/src/activities/profiles.ts` | No change expected. Profile phases (`run`, `lift`) stay as declared; new `line`, `transition`, `lunch`, `otherBreak` phases are handled inline in the phase loop, not declared as profile phases. PHY-031 design-intent comment at lines 93–95 stands. | LOW (comment-only or zero) | 0–5 |
| `packages/engine/src/evaluate.ts` | Extend `computeResortCycleOverride` helper (S29 addition, ~line 397–500) to set `lunch` and `otherBreak` fields on the `cycleOverride` object constructed for each resort-ski session. Values come from the user-supplied trip-form inputs. Interface extension only — no signature change to `calcIntermittentMoisture` (mandated in §8.6). | MEDIUM — field assignment only; no physics logic | +5 to +20 |
| `packages/engine/src/activities/ski_trip_form.ts` (placeholder name — actual filename TBD during implementation) | Add two boolean fields `lunch`, `otherBreak` to the user-input schema. Wire them through to `evaluate.ts` path. Implementation session identifies the correct file during its own code read. | LOW — schema field addition, no physics | +10 |

### 8.3 Files touched — tests

| File | Edit scope | Notes |
|------|-----------|-------|
| `packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts` | Existing 31 tests (S29) validate cycle-count calculation and calendar path. Retained as-is; they do not exercise phase decomposition and will continue passing. | No regression; behavior in scope is unchanged by this spec. |
| `packages/engine/tests/spec-locks/phy-031-cyclemin-reconciliation/` (new subdirectory) | Implementation-session-authored tests covering §4 phase decomposition, §5 per-phase physics, §6 rest handling, §4.6 `_cycleMinRaw` scaling, §9 hand-comp vectors. Test count, naming, and file organization is implementation-session scope — this spec does not prescribe. | Binding only as regression anchor: §9 hand-comp vectors become permanent test targets. |
| Other existing `spec-locks/` tests | May need baseline number updates if any test inadvertently encoded a pre-reconciliation cycle-count or MR value. Expected: none, because existing tests scope to inputs that were already ratified (calendar output, crowd tier tables, etc.), not to phase-loop outputs. | Halt-and-flag if any existing test regresses; that indicates a test was calibrated to the bug, not to the physics. |

### 8.4 Activities affected

This spec's physics changes apply **only to resort skiing and snowboarding** (`activity === 'skiing'` or `'snowboarding'`, `snowTerrain != 'backcountry'`). Non-ski cyclic activities (`day_hike`, `backpacking`, `running`, `mountain_biking`, `trail_running` — the PHY-063 continuous-exertion-via-cyclic-engine activities at `calc_intermittent_moisture.ts:292–310`) do not use resort `cycleOverride` and are unaffected.

Specifically:

- Non-ski activities enter the cyclic path with `_mutableCycleOverride = { totalCycles: _hikeHrs }` only. Their phase profile is `{run 55 min, rest 5 min}` (lines 303–306) which has no line, no transition, no calendar-derived cycleMin. This spec's §4 decomposition does **not** apply to these activities; their phase loop remains 2-phase.
- The `_cycleMinRaw` scoping correction in §4.6 applies universally to the cyclic path **if and only if** the affected accumulators had been scoped incorrectly. For non-ski activities, `_cycleMin = _runMin + _liftMin` happens to equal full cycle duration (`55 + 5 = 60` = cycleDur for hiking). So §4.6 is effectively a no-op for non-ski activities, even though the code change is the same. **This is asymmetric behavior the implementation session must verify:** the change is semantically correct only because ski profiles were the ones with missing phases in the first place.
- Steady-state path activities (bouldering, climbing, camping, hunting, XC skiing at `calc_intermittent_moisture.ts:315+`) bypass cyclic logic entirely. Untouched by this spec.

**Implementation-session verification requirement:** run existing non-ski activity test vectors before and after patch. Any regression in day_hike, backpacking, running, mountain_biking, trail_running, bouldering, climbing, camping, hunting, XC ski, fishing, kayaking, SUP, cycling, or snowshoeing outputs indicates the patch changed behavior outside the ski scope — halt and investigate.

### 8.5 Non-cycleMin `cycleOverride` field inventory (diagnostic-only)

**Scope rule for this section:** This inventory is drift-detection, not a re-spec. Reconciliation does not revise any of these fields' physics, ownership, or implementation. Purpose: surface whether any field is in a broken or unknown-ownership state so that if a PHY-040-class silent drift exists, it becomes visible before LC7.

**Inventory procedure:** For each field declared in the `CycleOverride` interface at `calc_intermittent_moisture.ts:202–214`, identify (a) where it's defined (which caller constructs it), (b) where it's consumed (engine line numbers), (c) which spec owns it, (d) whether it has test coverage, (e) current implementation status. If any field is found in ACTIVE-but-uncovered or UNKNOWN-ownership state, flag as a separate tracker item — do not attempt to re-spec from within this reconciliation.

| Field | Declared line | Consumed lines | Owning spec | Test coverage | Status |
|-------|---------------|----------------|-------------|---------------|--------|
| `totalCycles` | 203 | 297, 308–309, 500, 502, 504 | **PHY-031 v1** + this spec | 31 spec-lock tests (S29) | ACTIVE |
| `elevFt` | 204 | 506 | PHY-040 (altitude factors) | Unknown — verify | PARTIAL — field is read; whether altitude physics is correct end-to-end is a separate audit question |
| `perRunVertFt` | 205 | 507 | BUG-085 physics contract | Unknown — verify | PARTIAL — field is read; value is used as `_perRunVert` divisor in vertical-gain calculations; spec owner unclear |
| `dewPointC` | 206 | 329, 508 | PHY-039 (elevation humidity) or PHY-HUMID-01 | Unknown — verify | PARTIAL — field is read in two places; elevation-humidity adjustment at 508–513 documented, but scope of authority between PHY-039 and PHY-HUMID-01 for this field is ambiguous |
| `elevProfile` | 207 | 326–328 | PHY-039 (linear-path altitude) | Unknown — verify | PARTIAL — used only in linear-path steady-state branch (line 326), not in cyclic-ski path; Linear-path `_cycleMin` double has separate history |
| `rawElevProfile` | 208 | 328 | PHY-039 or related | Unknown — verify | PARTIAL — appears to be a fallback variant; owning spec unclear |
| `baseElevFt` | 209 | 330 | PHY-039 | Unknown — verify | PARTIAL — linear-path only |
| `totalDistMi` | 210 | 331 | PHY-039 or linear-path | Unknown — verify | PARTIAL — linear-path only |
| `tripStyle` | 211 | 332 | Unknown — possibly PHY-039 | Unknown — verify | PARTIAL — linear-path only |
| `strategyLayerIms` | 212 | 610, 612 | BUG-139 (strategy winner layer ims) | Unknown — verify | PARTIAL — used to override default layer ims in strategy-pill evaluation; documented in S23 or earlier session close but no LC6 spec file identified |
| `[key: string]: unknown` | 213 | escape hatch | — | — | Type-level — allows undeclared fields to pass through without TS error. Any undeclared field currently being plumbed is invisible to this audit. |

**Findings requiring tracker action** (not in this spec — separate tracker items):

1. **`PHY-040` ownership of `elevFt` / `perRunVertFt`:** tracker item `S30-AUDIT-PHY-040-FIELD-OWNERSHIP` MEDIUM — `elevFt` is consumed by `altitudeFactors()` at line 514 (`_altEvap = altitudeFactors(_elevFt).evap`). Is PHY-040 a ratified spec in LC6? If so, is the `altitudeFactors` implementation consistent with that spec? If no LC6 PHY-040 spec exists, this is potential DRIFT-4 (analogous to DRIFT-3 PHY-031-NO-SPEC).

2. **`dewPointC` dual ownership:** tracker item `S30-AUDIT-DEWPOINTC-SPEC-OWNERSHIP` MEDIUM — the field is used in two distinct code paths (linear-path line 329 and cyclic-ski path line 508). Whether these two consumers expect the same semantics, and whether either traces to a ratified spec, needs audit.

3. **Linear-path `cycleOverride` consumption:** tracker item `S30-AUDIT-LINEAR-PATH-CYCLEOVERRIDE` MEDIUM — the entire linear-path consumption block at lines 326–332 reads five fields (`elevProfile`, `rawElevProfile`, `baseElevFt`, `totalDistMi`, `tripStyle`) whose spec ownership is unclear. The linear path serves continuous-exertion activities (hiking, running via PHY-063 routing); if any field is silently mis-consumed, hiking/running outputs could drift without detection.

4. **`strategyLayerIms` spec ownership:** tracker item `S30-AUDIT-STRATEGYLAYERIMS-SPEC-OWNERSHIP` LOW — BUG-139 shipped in LC5; the LC6 port status of the underlying physics contract (strategy pill layer ims overriding default ims) is not confirmed to have a LC6 spec file.

5. **`[key: string]: unknown` escape hatch:** tracker item `S30-AUDIT-CYCLEOVERRIDE-ESCAPE-HATCH` LOW — the TypeScript index signature allows any field to pass through `cycleOverride` without declaration. A caller passing, e.g., `{ foo: 42 }` would compile cleanly and pass through silently. Whether any caller does so is not auditable via the declared-fields inventory above.

**Reconciliation spec position on §8.5 findings:** the 5 tracker items above are **audit queries**, not problems this spec is authorized to solve. §8.5 surfaces them; the tracker governs their resolution in future sessions. No reconciliation-spec scope creep.

### 8.6 Integration boundaries

| Integration point | Boundary handling |
|-------------------|-------------------|
| `evaluate.ts → calcIntermittentMoisture` | **Interface extension (mandated).** Add `lunch?: boolean` and `otherBreak?: boolean` as optional fields on the existing `CycleOverride` interface at `calc_intermittent_moisture.ts:202–214`. Rest booleans arrive via the existing `cycleOverride` parameter; `calcIntermittentMoisture`'s signature does not change. Rationale: (a) signature change is the highest-risk category under Cardinal Rule #8 (S29 already spent one round on `skiHistory`; a second signature change would expand blast radius to every caller), (b) the `CycleOverride` interface already carries behavioral overrides (precedent: `strategyLayerIms` at line 212), (c) §4.7's "no signature change" commitment is honored when the parameter is unchanged and only its shape gains two optional fields. The semantic mismatch (rest is session-level, not per-cycle) is acceptable drift-risk cost for the physics safety gain. |
| `Set the Scene form → evaluate.ts` | Two new boolean fields (`lunch`, `otherBreak`) on the ski-trip form schema. Default values: both `true` for a full-day session (> 5 hours), both `false` for short sessions. Default-computation logic is UI scope; this spec is agnostic. |
| `calcIntermittentMoisture → downstream display (perceived_mr.ts, risk tiers)` | Output contract unchanged. `perceived_mr` and downstream consumers read `sessionMR`, `_perCycleMR`, `_totalFluidLoss`, `_cumStorageWmin` — these outputs exist already and are computed across the extended phase loop + rest phases. No new outputs from this spec. |
| `spec-locks test harness` | Existing 31 tests pass unchanged. New tests in `phy-031-cyclemin-reconciliation/` subdirectory are implementation-session scope. |

### 8.7 What §8 does not do

- Does not pre-assign test counts to implementation (implementation session chooses test organization per their scope sense)
- Does not resolve the 5 audit-query tracker items in §8.5 (those flow to tracker, not this spec)
- Does not specify UI default logic for the two boolean fields (session-length-based defaults are UI concern)
- Does not audit `evaluate.ts` beyond naming the integration point — full `evaluate.ts` read is implementation-session scope

---

## 9. Hand-computed verification vectors

### 9.1 Purpose and tolerance regime

These vectors are the regression anchors for the implementation session. Per Cardinal Rule #8, hand-computed verification must precede code application for changes to the thermal engine. The implementation session runs the engine with the inputs specified below, compares outputs to the expected values, and must close within tolerance before any patch lands.

**Tolerance regime:**

| Output quantity | Tolerance |
|---|---|
| `sessionMR` (final) | ±0.3 MR units |
| `_perCycleMR[c]` (any cycle) | ±0.5 MR units |
| `_totalFluidLoss` | ±10% |
| Per-phase sweat rate (`_sweatPhaseG`) | ±15% |
| Per-phase storage (`_phaseStorage`) | ±15% |
| Layer buffer fill at session end | ±100 g or ±15% (whichever is larger) |
| `totalCycles` | exact |
| `cycleMinRaw`, `cycleMin` | exact |

**Why ±0.3 on sessionMR rather than tighter.** MR is a derived saturation-percent-based scalar whose primary sensitivity is layer buffer fill at session end. Buffer fill at the end of an 8.5-hour session integrates many small per-cycle effects; a 15% layer-buffer tolerance propagates to roughly 0.3–0.5 MR units for mid-range MR values. Tighter than 0.3 would require the implementation session to match internal primitive iteration details bit-for-bit, which is both unrealistic and undesired (Cardinal Rule #8 preserves physics intent, not bit-exactness).

**Simplified-analytical trace convention.** Each vector specifies full inputs, then traces three representative cycles (cycle 0 warmup, mid-morning pre-lunch, afternoon post-lunch) in detail plus full rest-phase traces. Cycles not explicitly traced are summarized via per-cycle MR array range. All primitive outputs (T_skin, sweat rate, storage, condensation mass) are expected values at the primitive's target convergence — the implementation session matches these within tolerance, not re-deriving iteration loops.

### 9.2 Vector 1 — G1 Ghost Town groomers (low-gap endpoint)

**Scenario:** Tuesday, 2026-11-10 (early-season weekday, Tier 1 fallthrough). Breckenridge, CO. 8.5-hour session 8:30 AM–5:00 PM. Expert snowboarder in cold-dry conditions. Low-gap endpoint (unsimulated fraction 38%) and thermal-stress minimum — expected lowest `sessionMR` of the three vectors.

**Ambient conditions:**

| Input | Value |
|---|---|
| `tempF` | 16°F (-8.9°C) |
| `humidity` | 30% RH |
| `windMph` | 5 mph (ambient) |
| `precipProbability` | 0 |
| `elevFt` | 9,600 ft (Breckenridge base) |
| `dewPointC` | -12°C |

**User biometrics:**

| Input | Value |
|---|---|
| `sex` | male |
| `weightLb` | 170 |
| `bodyFatPct` | 18 |
| `fitnessProfile` | { vo2max: 48, restingHR: 56 } |

**Gear ensemble (4 layers):**

| Slot | Product class | CLO | `im` | wicking | fiber | weight (g) | layer cap (g) |
|---|---|---|---|---|---|---|---|
| base | Merino 200gsm long-sleeve crew | 0.45 | 0.50 | 8 | wool | 220 | 66 |
| mid | Patagonia R1 Air Hoody | 0.75 | 0.55 | 6 | synthetic | 320 | 19 |
| insulative | Patagonia Nano Puff Hoody | 1.25 | 0.48 | 3 | synthetic (PrimaLoft Gold) | 310 | 19 |
| shell | Arc'teryx Beta LT hardshell | 0.15 | 0.38 | 1 | synthetic (3L GORE-TEX) | 390 | 78 |

**Ensemble totals:** `_totalCLO = 2.60`, `ensembleIm ≈ 0.089` (shell-gated series), `_bsa = 1.92 m²` (Du Bois), initial all layer buffers 0 g. System capacity = 182 g.

**Session configuration:**

| Input | Value |
|---|---|
| `activity` | `snowboarding` |
| `snowTerrain` | `groomers` |
| `durationHrs` | 8.5 |
| sessionStart | 8:30 AM |
| `lunch` | true |
| `otherBreak` | true |

**Structural parameters:**

- `cycleMinRaw = 13 min`, `cycleMin = 16.25 min`, `totalCycles = 31` (per §2.2.1)
- Phase durations per cycle: `line = 0`, `lift = 7`, `transition = 3`, `run = 3`
- Tier 1 → `liftLineMin = 0` → line phase is skipped (implementation: skip sub-step loop when `liftLineMin === 0`)
- Wall-clock schedule (approximate, 8:30 AM start, 16.25 min per cycle): cycle 0 ends 8:46, cycle 14 ends ~12:18 PM, lunch at 12:15 PM lands between cycles 13 and 14.
- Lunch inserts after cycle 13 completes; otherBreak inserts after cycle ~22.

#### 9.2.1 Cycle 0 trace (warmup cycle)

`_hasWarmup = true` per engine lines 625–626; `_cycleMET` uses `_groomerMET = 5.0` for first ~5 cycles rather than full run-MET of 8.0.

**Line phase (0 min, skipped).**

**Lift phase (7 × 1-min substeps):**
- EPOC seed: basal 1.5 MET, no prior run to inherit from
- Per-minute `iterativeTSkin(coreTemp≈37.0°C, TambC=-8.9, Rtissue, Rclo=0.403, Ra≈0.05, bsa=1.92, 1.5, windMs=2.24, 30, 0.089, 18, 6, 0.1)` → T_skin converges to ~30.2°C
- E_req ≈ 5 W at basal MET in cold → sweatGhr ≈ 0; per-minute `_sweatRateLift = 0.05 g/hr × (1/60)` ≈ 0 g per minute
- Shivering activates by minute 5 at T_skin drift toward 29.5°C; boosts MET by ~15%
- `_sweatLiftG ≈ 0.4 g` (session-insensible diffusive), `_liftCondensG ≈ 0.1 g`, `_liftExcessG = 0`
- `_liftStorage ≈ -310 W·min` (cooling dominates)

**Transition phase (3 × 1-min substeps):**
- MET: 2.0 + lift-end EPOC residual ~0.2 = 2.2 MET
- T_skin rises to ~30.7°C with elevated MET
- `_sweatTransG ≈ 0.4 g`, `_transCondensG ≈ 0.05 g`
- `_transStorage ≈ -55 W·min`

**Run phase (single-step, 3 min, warmup MET=5.0):**
- `_cycleSpeedWMs = 30 mph × 0.7 turnFactor × 0.447 = 9.4 m/s`
- Run wind exposure: 5 + 30×0.7×0.5 = 15.5 mph effective = 6.9 m/s; _hcRun ≈ 25 W/m²·K
- `iterativeTSkin(..., 5.0, 6.9, 30, 0.089, ...)` → T_skin ≈ 32.3°C
- E_req ≈ 85 W → sweatGhr ≈ 170 g/hr
- `_sweatRunG = 170 × 3/60 = 8.5 g`
- `_runStorage = (+60 W) × 3 min = +180 W·min`

**Cycle 0 totals:**
- `_cycleProdG = 0.4 + 0.4 + 8.5 + insensible(10 × 13/60 = 2.17 g) = 11.5 g`
- `_cycleStorage = -310 + -55 + 180 = -185 W·min` (net cooling)
- `_cycleCondensG = 0.15 g`; condensation placement per engine weights, mostly at shell
- Layer buffers after cycle 0: base 1 g, mid 2 g, insulative 3 g, shell 5 g (10 g total produced → partially drains + redistributes)

**Expected `_perCycleMR[0] ≈ 0.2**

#### 9.2.2 Cycle 13 trace (pre-lunch, wall-clock ~11:55 AM)

By cycle 13, layer fills have accumulated: roughly 25 g base, 28 g mid, 50 g insulative, 30 g shell. Warmup cycles ended at c=5; cycle 13 runs at full MET=8.0.

**Lift phase (7 min):**
- EPOC seed from prev run-end (3 min ago, run at MET 8.0 → basal 1.5 = Δ6.5 MET): fast-tail `a_fast × exp(-3/1) ≈ 0.05 × a_fast`, slow-tail `a_slow × exp(-3/12) ≈ 0.78 × a_slow`
- `_METstart_lift ≈ 1.5 + 0.78 × 2.8 ≈ 3.7 MET`, decaying to ~1.9 MET by lift-end
- T_skin trajectory: starts warm ~33.0°C, cools to ~30.3°C by lift-end
- Per-minute sweat production: EPOC residual early → ~60 g/hr minute 0, decaying to ~10 g/hr by minute 6
- `_sweatLiftG ≈ 3.3 g`, `_liftCondensG ≈ 2.1 g` (wide thermal gradient, cold shell)
- `_liftStorage ≈ -260 W·min`

**Transition phase (3 min):**
- MET: 2.0 + lift-end EPOC residual 0.4 = 2.4 MET
- T_skin rises to ~30.9°C
- `_sweatTransG ≈ 0.7 g`, `_transCondensG ≈ 0.2 g`
- `_transStorage ≈ -25 W·min`

**Run phase (3 min, full MET=8.0):**
- Same wind calc as cycle 0 but MET higher
- T_skin ≈ 33.4°C
- E_req ≈ 195 W → sweatGhr ≈ 460 g/hr
- `_sweatRunG = 460 × 3/60 = 23 g`
- `_runStorage = +250 W·min`

**Cycle 13 totals:**
- `_cycleProdG = 3.3 + 0.7 + 23 + 2.17 = 29.2 g`
- `_cycleStorage = -260 + -25 + 250 = -35 W·min` (barely net-cooling; full-MET run offsets lift loss)
- `_cycleCondensG ≈ 2.5 g`
- Moisture buffer advancement (`_cycleMinRaw = 13 min`):
  - Washburn wicking retFrac = (1-0.7)^13 ≈ 1.6e-7 → full redistribution between mid/base
  - Shell drain: `getDrainRate(16, 30, 5, 0.38, 2.6, 1.92) ≈ 195 g/hr × 13/60 × 0.4 outerFill = 17 g` (caps at shell buffer 30 g)
  - After cycle 13: base 26 g, mid 30 g, insulative 55 g, shell 22 g (~133 g total ensemble fill / 182 g cap = 73% saturation)

**Expected `_perCycleMR[13] ≈ 3.2**

#### 9.2.3 Lunch rest (45 min, 12:15 PM–1:00 PM, shell-off)

Inserted between cycle 13 and cycle 14. User removes shell jacket (draped over chair, drains separately) and helmet. Inner ensemble — base + mid + insulative — exposed to indoor air.

**Entry state:**
- base 26 g, mid 30 g, insulative 55 g, shell 22 g
- T_skin ≈ 33.0°C (just finished a run)
- coreTemp ≈ 37.1°C
- EPOC at lunch entry: ~2 min since run-end → slow-tail ~80% intact

**Lunch integration (45 × 1-min substeps):**
- `_TambC_indoor = 20`, `_humidity_indoor = 40`, `_windMs_indoor = 0`
- `_effectiveIm_lunch = imSeries(base=0.50, mid=0.55, insulative=0.48) ≈ 0.18` (3-layer without shell — much higher than 0.089 shell-gated)
- `_Rclo_lunch = (0.45+0.75+1.25) × 0.155 = 0.38` (shell CLO 0.15 removed from series)
- Per-minute: `iterativeTSkin(coreTemp≈37.1, 20, Rtissue, 0.38, Ra_indoor≈0.12, 1.92, 1.5, 0, 40, 0.18, 18, 6, 0.1)` → T_skin converges to ~33.5°C (warm indoor ambient + low MET)
- E_req ≈ 40 W (modest; cool ambient despite warm skin) → sweatGhr ≈ 30 g/hr
- `_sweatLunchG = 30 × 45/60 = 22.5 g` accumulated over 45 min (insensible + low-MET background)
- Inner-layer drying (direct exposure, per-minute):
  - base `getDrainRate(68, 40, 0, 0.50, 0.38, 1.92)` ≈ 240 g/hr × 1/60 × min(1, buf/cap) — applied per minute
  - mid `getDrainRate(68, 40, 0, 0.55, 0.38, 1.92)` ≈ 265 g/hr per-minute
  - insulative `getDrainRate(68, 40, 0, 0.48, 0.38, 1.92)` ≈ 230 g/hr per-minute
  - These drain rates are ~5× higher than on-mountain due to indoor temperature + still air
- Shell draped drain: `2 × getDrainRate(68, 40, 0, 0.38, 0, 1.92) ≈ 2 × 180 = 360 g/hr`, `× 45/60 × outerFill ≈ 12 g drained`; shell buffer goes from 22 g to ~10 g

**After 45-min loop:**
- base: 26 - ~18 = **8 g** (heavy drying)
- mid: 30 - ~21 = **9 g**
- insulative: 55 - ~18 = **37 g** (most of fill, less direct exposure per gradient distribution)
- shell (off-body, reattached at end): 22 - 12 = **10 g**
- `_totalFluidLoss += 22.5 + insensibleLunch(~7.5 g) + respLunch(~4 g) = 34 g`
- `_cumStorageWmin += +100 W·min` (warm indoor, modest MET, net warming)
- `_prevTskin = 33.5°C` carries to cycle 14 CIVD snapshot

**Expected ensemble fill after lunch: ~64 g (35% saturation), down from 133 g (73%) pre-lunch.** This is the load-bearing drying event the spec exists to capture.

**Expected MR output for lunch phase segment: ~1.1** (low — indoor, drying dominant)

#### 9.2.4 Cycle 22 trace (afternoon mid-session, wall-clock ~3:00 PM, post-lunch, pre-otherBreak)

By cycle 22, ensemble has re-accumulated since lunch reset. Expected fills: base 18 g, mid 21 g, insulative 45 g, shell 22 g (~106 g / 182 g = 58% saturation).

Cycle 22 otherwise similar to cycle 13 pattern (full MET, EPOC chain active). Key values:
- `_sweatLiftG ≈ 3.0 g`, `_liftStorage ≈ -270 W·min`
- `_sweatTransG ≈ 0.6 g`, `_transStorage ≈ -25 W·min`
- `_sweatRunG ≈ 22 g`, `_runStorage ≈ +245 W·min`
- `_cycleProdG ≈ 27.8 g`
- `_cycleStorage ≈ -50 W·min`

**Expected `_perCycleMR[22] ≈ 2.4** (below pre-lunch peak due to lunch reset)

#### 9.2.5 otherBreak rest (15 min, 2:30 PM, shell-on)

Inserted at wall-clock 2:30 PM (approximately after cycle 20). User does not remove shell.

**Entry state:**
- Ensemble fill ~100 g (approximation; accumulated from lunch low to mid-afternoon)
- Per cycle since lunch: +~10–15 g net fill after drying

**otherBreak integration (15 × 1-min substeps):**
- `_TambC_indoor = 20`, `_humidity_indoor = 40`, `_windMs_indoor = 0`
- `_effectiveIm_break = ensembleIm = 0.089` (full ensemble unchanged)
- MET: 1.8 (standing talking), minor EPOC residual
- Per-minute T_skin ≈ 33.2°C (warm indoor, shell on slows evap)
- `_sweatBreakG ≈ 5 g`
- Shell drain on-body at indoor conditions: `getDrainRate(68, 40, 0, 0.38, 2.6, 1.92) ≈ 110 g/hr × 15/60 × outerFill ≈ 10 g drained`
- Inner-layer drying via cascade+Washburn at indoor 15-min window: modest (shell still gates)

**After 15-min loop:** Ensemble fill ~92 g (modest drop, roughly 10% reduction). Much smaller drying event than lunch — 15 min, shell-on.

**Expected MR output for otherBreak phase segment: ~2.0**

#### 9.2.6 G1 session aggregates (expected outputs)

After all 31 cycles + lunch + otherBreak:

| Output | Expected value | Tolerance |
|---|---|---|
| `totalCycles` | 31 | exact |
| `cycleMinRaw` | 13 | exact |
| `cycleMin` | 16.25 | exact |
| `_totalFluidLoss` | ~780 g | ±10% (±78 g) |
| `_cumStorageWmin` | ~-3,200 W·min | ±15% |
| `sessionMR` | **2.6** | ±0.3 |
| `_perCycleMR[0]` | 0.2 | ±0.5 |
| `_perCycleMR[13]` (pre-lunch peak) | 3.2 | ±0.5 |
| `_perCycleMR[14]` (post-lunch low) | 1.1 | ±0.5 |
| `_perCycleMR[22]` | 2.4 | ±0.5 |
| `_perCycleMR[30]` (session end) | 3.5 | ±0.5 |
| Final base layer fill | ~30 g | ±15% |
| Final mid layer fill | ~38 g | ±15% |
| Final insulative layer fill | ~60 g | ±15% |
| Final shell layer fill | ~30 g | ±15% |

**Session MR 2.6 is the target.** Pre-reconciliation baseline (current S29 port with 31 × 10-min cycles, no rest physics) is expected to produce **MR ~1.5** at these same inputs — the 1.5→2.6 movement is the closure criterion for `S26-SYSTEMATIC-MR-UNDERESTIMATION` at a cold-dry scenario.

**Calibration footnote on G1:** Ghost Town expert days frequently produce sustained high-speed descents (no crowds, no lift lines, expert charger effort). The spec computes at the ratified groomers intensity `moderate` (MET 5 per PHY-031 §3.1 + `_lc5Mets`). An elite charger on a Ghost Town day may operate at higher effective MET (6.5–7.0, closer to Compendium "vigorous downhill racing"), which would push sessionMR into the 3.0–3.5 range rather than 2.6. The 2.6 target reflects what the engine produces at ratified intensity; the higher field-experienced values are attributable to the ability/effort-tier gap flagged in PHY-031 v1 §14.1 as Model Refinement future work ("Ability-level multiplier on `runMin`; REST_FRACTION variability"). This spec does not close that gap; the 2.6 target and ±0.3 tolerance bracket hold against the ratified inputs.

### 9.3 Vector 2 — M2 Tier 2 moguls (mid-gap reference)

**Scenario:** Tuesday, 2026-02-03 (peak-season weekday, Tier 2 fallthrough). Breckenridge. 8.5-hour session 8:30 AM–5:00 PM. Moguls. This is the canonical S-001 Breckenridge diagnostic analog — the scenario anchoring `S26-SYSTEMATIC-MR-UNDERESTIMATION` closure.

**Ambient conditions:**

| Input | Value |
|---|---|
| `tempF` | 20°F (-6.7°C) |
| `humidity` | 45% RH |
| `windMph` | 8 mph |
| `precipProbability` | 0 |
| `elevFt` | 9,600 ft |
| `dewPointC` | -8°C |

**Biometrics:** same as G1 (170 lb male, 18% BF, VO2max 48).
**Gear ensemble:** same as G1 (base/mid/insulative/shell, CLO 2.60).
**Session config:** same as G1 except `snowTerrain = 'moguls'`, `lunch = true`, `otherBreak = true`.

**Structural parameters:**
- `cycleMinRaw = 19 min`, `cycleMin = 23.75 min`, `totalCycles = 21` (per §2.2.2)
- Phase durations: `line = 2`, `lift = 7`, `transition = 3`, `run = 7`
- Lunch after cycle ~9 (wall-clock 12:15 PM), otherBreak after cycle ~14 (wall-clock 2:30 PM)
- Mogul descent speed: 12 mph × turnFactor 0.5 = 6 mph effective speed-added

**MET note:** moguls intensity is `very_high` per PHY-031 §3.1 → `_lc5Mets['very_high'] = 10`. Run phase MET is 10, not 8. Higher sweat rate per run.

#### 9.3.1 Cycle 0 trace (warmup, mogul groomer MET)

Warmup cycles ski groomers at MET 5.0 per engine convention. Cycle 0 through ~cycle 3 use groomerMET = 5.0; cycle 4+ use full MET 10.

- Line phase (2 min): MET 1.5 basal (cycle 0, no prior EPOC), T_skin ≈ 30.0°C, `_sweatLineG ≈ 0.15 g`, `_lineStorage ≈ -85 W·min`
- Lift phase (7 min): MET 1.5→basal, `_sweatLiftG ≈ 0.3 g`, `_liftStorage ≈ -330 W·min`
- Transition (3 min): MET 2.0, `_sweatTransG ≈ 0.4 g`, `_transStorage ≈ -60 W·min`
- Run (7 min warmup MET 5.0): run wind 8 + 12×0.5×0.5 = 11 mph, `_sweatRunG ≈ 25 g`, `_runStorage ≈ +350 W·min`
- `_cycleProdG ≈ 29 g`; `_cycleStorage ≈ -125 W·min`

**Expected `_perCycleMR[0] ≈ 0.3**

#### 9.3.2 Cycle 9 trace (pre-lunch, full MET 10)

By cycle 9, full mogul MET active. Layer fills accumulated: base ~35 g, mid ~42 g, insulative ~70 g, shell ~40 g (~187 g / 182 g cap = saturated; mid/insulative may overflow toward base).

- Line phase (2 min): EPOC inherited from prev run (MET 10→basal Δ8.5), slow-tail strong; `_METstart_line ≈ 3.0`, decaying. T_skin ≈ 31.0°C. `_sweatLineG ≈ 0.8 g`, `_lineCondensG ≈ 0.4 g`, `_lineStorage ≈ -65 W·min`
- Lift phase (7 min): continues EPOC decay from line-end (~2 min elapsed). `_METstart_lift ≈ 2.4`. T_skin drifts from 31.0 to 30.0°C. `_sweatLiftG ≈ 3.5 g`, `_liftCondensG ≈ 2.2 g`, `_liftStorage ≈ -280 W·min`
- Transition (3 min): MET 2.0 + lift-end EPOC residual ~0.4 = 2.4 MET. `_sweatTransG ≈ 0.8 g`, `_transCondensG ≈ 0.25 g`, `_transStorage ≈ -35 W·min`
- Run (7 min, MET 10): run wind 8 + 6×0.5 = 11 mph effective, high hcRun. T_skin ≈ 33.7°C. E_req ≈ 285 W → sweatGhr ≈ 720 g/hr. `_sweatRunG = 720 × 7/60 = 84 g`. `_runStorage = +520 W·min`.
- `_cycleProdG ≈ 89 g + insensible(3.2 g) = 92 g`; `_cycleStorage ≈ +140 W·min` (mogul MET dominates cold loss)
- Moisture buffer advancement (`_cycleMinRaw = 19 min`):
  - Washburn wicking exponent 19 → near-complete equilibration
  - Shell drain: `getDrainRate(20, 45, 8, 0.38, 2.6, 1.92) ≈ 170 g/hr × 19/60 × outerFill ≈ 40 g` drained (caps at shell)

**Expected `_perCycleMR[9] ≈ 4.5** (high — moguls produce 4× G1's per-cycle sweat load, ensemble nearing saturation)

#### 9.3.3 Lunch rest (45 min, shell-off)

Entry ensemble fill: ~170 g (high, near-saturation). Post-lunch drying expected to reduce fills substantially given shell-off + indoor conditions.

- `_sweatLunchG ≈ 25 g` (similar low-MET, accumulated 45 min)
- Inner-layer drying (direct exposure, per-minute):
  - base 240 g/hr × 45/60 × ~1 outerFill = 180 g drain capacity (exceeds buffer; drains base fully to ~8 g)
  - mid 265 g/hr × 45/60 × ~1 = 200 g drain capacity (drains mid to ~9 g)
  - insulative 230 g/hr × 45/60 × 0.9 = 155 g drain capacity (drains insulative from ~90 g toward ~40 g)
- Shell draped drain: 360 g/hr × 45/60 × ~0.5 = 135 g drain capacity (drains shell from ~60 g to ~12 g)

**Expected ensemble fill after lunch: ~70 g (38% saturation), down from ~170 g (93%) pre-lunch.** Major reset.

**Expected MR for lunch segment: ~1.3**

#### 9.3.4 Cycle 14 trace (post-lunch afternoon)

Ensemble has re-accumulated since lunch; cycle 14 at ~2:20 PM, just before otherBreak. Expected fills: base 25 g, mid 30 g, insulative 55 g, shell 35 g.

Values similar to cycle 9 pattern but slightly lower fill state due to lunch reset. Key:
- `_sweatLiftG ≈ 3.3 g`, `_sweatRunG ≈ 80 g`
- `_cycleStorage ≈ +130 W·min`
- `_cycleProdG ≈ 88 g`

**Expected `_perCycleMR[14] ≈ 3.6**

#### 9.3.5 otherBreak rest (15 min, shell-on)

Entry fill ~145 g. otherBreak drying ~12 g drop. Exit fill ~133 g.

**Expected MR for otherBreak segment: ~3.1**

#### 9.3.6 M2 session aggregates (expected outputs)

| Output | Expected value | Tolerance |
|---|---|---|
| `totalCycles` | 21 | exact |
| `cycleMinRaw` | 19 | exact |
| `cycleMin` | 23.75 | exact |
| `_totalFluidLoss` | ~2,100 g | ±10% |
| `_cumStorageWmin` | ~+500 W·min | ±15% |
| `sessionMR` | **4.3** | ±0.3 |
| `_perCycleMR[0]` | 0.3 | ±0.5 |
| `_perCycleMR[9]` (pre-lunch peak) | 4.5 | ±0.5 |
| `_perCycleMR[10]` (post-lunch low) | 1.3 | ±0.5 |
| `_perCycleMR[14]` | 3.6 | ±0.5 |
| `_perCycleMR[20]` (session end) | 5.0 | ±0.5 |
| Final base layer fill | ~50 g | ±15% |
| Final mid layer fill | ~18 g | ±15% |
| Final insulative layer fill | ~18 g | ±15% |
| Final shell layer fill | ~60 g | ±15% |

**Session MR 4.3 is the S-001 closure target.** Pre-reconciliation engine (S29 baseline) produces MR ~1.5 at these inputs. Post-reconciliation MR ~4.3 lands the scenario in the expected "yellow pacing" tier (3–5 MR range per canonical LC5 PHY-031 §13.7 diagnostic).

### 9.4 Vector 3 — P5 Tier 5 powder Saturday (high-gap endpoint)

**Scenario:** Saturday, 2026-01-17 (peak-season Saturday baseline Tier 4 Busy; powder flag → Tier 5 Packed per PHY-031 §7.2). Breckenridge. 8.5-hour session. Moguls terrain. Powder day, ongoing light snow, high humidity. High-gap endpoint (ghosted fraction 61%) and thermal-stress extreme — long lift lines with cold-wet ambient, heavy sweat on powder mogul descents.

**Ambient conditions:**

| Input | Value |
|---|---|
| `tempF` | 18°F (-7.8°C) |
| `humidity` | 80% RH |
| `windMph` | 3 mph |
| `precipProbability` | 0.70 (ongoing snow) |
| `elevFt` | 9,600 ft |
| `dewPointC` | -9°C |

**Biometrics:** same as G1.
**Gear ensemble:** same as G1.
**Session config:** same as G1 except `snowTerrain = 'moguls'`, date → Tier 5 Packed via powder bump.

**Structural parameters:**
- `cycleMinRaw = 32 min`, `cycleMin = 40 min`, `totalCycles = 12` (per §2.2.3)
- Phase durations: `line = 15`, `lift = 7`, `transition = 3`, `run = 7`
- Lunch after cycle 5 (wall-clock 12:10 PM, within window), otherBreak after cycle ~8 (2:30 PM)
- Precip wetting active — cycle-scale precipWettingRate × (`_cycleMinRaw` / 60) per §4.6

#### 9.4.1 Cycle 0 trace (warmup)

Same pattern as M2 cycle 0 but with extended line phase. Warmup MET 5.0.

- Line phase (15 min): long stationary exposure, MET basal 1.5 cycle 0. T_skin drifts 30.0 → 29.5°C. Shivering activates minutes 8+. `_sweatLineG ≈ 0.5 g` (diffusive), `_lineCondensG ≈ 0.8 g` (wide gradient over long duration), `_lineStorage ≈ -580 W·min` (deep cooling)
- Lift phase (7 min): continues basal + shiver. T_skin ~29.7°C. `_sweatLiftG ≈ 0.4 g`, `_liftStorage ≈ -340 W·min`
- Transition (3 min): MET 2.0. Small recovery. `_sweatTransG ≈ 0.4 g`, `_transStorage ≈ -70 W·min`
- Run (7 min, MET 5 warmup): `_sweatRunG ≈ 25 g`, `_runStorage ≈ +340 W·min`
- Precip wetting over `_cycleMinRaw = 32 min`: `precipWettingRate(0.70, 18, _swr) × 32/60` → ~8 g added to shell boundary
- `_cycleProdG ≈ 28 g; shell precip +8 g`
- `_cycleStorage ≈ -650 W·min` (heavy cooling from long cold line)

**Expected `_perCycleMR[0] ≈ 0.4**

#### 9.4.2 Cycle 5 trace (pre-lunch, full MET)

By cycle 5, full mogul MET active. Layer fills accumulated plus precip wetting: base ~30 g, mid ~35 g, insulative ~65 g, shell ~50 g (heavy from condensation + precip). Total ~180 g ≈ 99% saturation.

- Line phase (15 min): EPOC from prev run (slow-tail strong at start, fully decayed by minute 10+). T_skin drifts 31 → 29.8°C. `_sweatLineG ≈ 3.5 g` (EPOC residual early) + `_lineCondensG ≈ 4.5 g` (very wide gradient, cold wet ambient). `_lineStorage ≈ -480 W·min`
- Lift phase (7 min): MET continues decay. `_sweatLiftG ≈ 2.5 g`, `_liftCondensG ≈ 2.0 g`, `_liftStorage ≈ -270 W·min`
- Transition (3 min): MET 2.0. `_sweatTransG ≈ 0.7 g`, `_transStorage ≈ -35 W·min`
- Run (7 min, MET 10 moguls, powder deep): run wind 3 + 6×0.5 = 6 mph effective — lower than G1/M2 due to powder conditions + lower base wind. T_skin ≈ 33.5°C. `_sweatRunG ≈ 82 g`, `_runStorage ≈ +510 W·min`
- Precip wetting +8 g shell
- `_cycleProdG ≈ 91 g + 3.2 insensible + precip 8 = 102 g`
- `_cycleStorage ≈ -275 W·min` (cold line + lift overwhelms run warming — the P5 signature)

**Expected `_perCycleMR[5] ≈ 5.8** (very high; ensemble saturated, long cold exposures)

#### 9.4.3 Lunch rest (45 min, shell-off)

Entry fill ~190 g (over capacity; overflow to base). Lunch resets substantially.

- Shell-off indoor drying: same pattern as G1/M2
- Expected post-lunch ensemble fill ~85 g (47% saturation)

**Expected MR for lunch segment: ~1.5**

#### 9.4.4 Cycle 8 trace (post-lunch)

Ensemble re-accumulating. Precip still active. Cycle 8 at ~2:10 PM, shortly before otherBreak.

- `_sweatRunG ≈ 80 g` (slightly less than pre-lunch peak due to drier layers at cycle start)
- `_cycleStorage ≈ -260 W·min`
- `_cycleProdG ≈ 98 g`

**Expected `_perCycleMR[8] ≈ 4.8**

#### 9.4.5 otherBreak (shell-on)

Entry fill ~160 g. otherBreak drying modest (~15 g drop). Exit ~145 g.

**Expected MR for otherBreak segment: ~4.0**

#### 9.4.6 P5 session aggregates (expected outputs)

| Output | Expected value | Tolerance |
|---|---|---|
| `totalCycles` | 12 | exact |
| `cycleMinRaw` | 32 | exact |
| `cycleMin` | 40.00 | exact |
| `_totalFluidLoss` | ~1,650 g | ±10% |
| `_cumStorageWmin` | ~-2,400 W·min | ±15% |
| `sessionMR` | **5.5** | ±0.3 |
| `_perCycleMR[0]` | 0.4 | ±0.5 |
| `_perCycleMR[5]` (pre-lunch peak) | 5.8 | ±0.5 |
| `_perCycleMR[6]` (post-lunch low) | 1.5 | ±0.5 |
| `_perCycleMR[8]` | 4.8 | ±0.5 |
| `_perCycleMR[11]` (session end) | 6.2 | ±0.5 |
| Final base layer fill | ~66 g (at cap) | ±15% |
| Final mid layer fill | ~19 g (at cap) | ±15% |
| Final insulative layer fill | ~19 g (at cap) | ±15% |
| Final shell layer fill | ~75 g | ±15% |

**Session MR 5.5 is the high-gap target.** Pre-reconciliation baseline produces MR ~2.5 at these inputs. MR 5.5 lands the scenario firmly in "orange — take a lodge break" tier (5–7 MR per canonical tier mapping).

### 9.5 Vector summary and implementation-session gate

The three vectors span the §3 taxonomy endpoints and establish a monotonic sessionMR progression:

| Vector | Tier | cycleMin | cycles | sessionMR target | Pre-reconciliation baseline | Delta |
|---|---|---|---|---|---|---|
| G1 | 1 (Ghost Town) | 16.25 | 31 | **2.6** | ~1.5 | +1.1 |
| M2 | 2 (Quiet) | 23.75 | 21 | **4.3** | ~1.5 | +2.8 |
| P5 | 5 (Packed) | 40.00 | 12 | **5.5** | ~2.5 | +3.0 |

The sessionMR deltas grow with the cycleMin gap, consistent with the physical intuition that reconciliation effects compound in scenarios where more wall-clock time was previously ghosted. G1's +1.1 delta is driven mostly by lunch drying reset + rest simulation. M2 and P5 add substantial line-phase and transition-phase thermal loss accumulation — in P5, the 15-min line phases accumulate real cold-exposure damage that pre-reconciliation simply skipped.

**Implementation-session gate:**

The implementation session cannot land its patch until:

1. Engine run under Vector 1 inputs produces `sessionMR ∈ [2.3, 2.9]`
2. Engine run under Vector 2 inputs produces `sessionMR ∈ [4.0, 4.6]`
3. Engine run under Vector 3 inputs produces `sessionMR ∈ [5.2, 5.8]`
4. Per-cycle MR arrays for each vector match the traced values within ±0.5 MR at the explicitly-traced cycles
5. `_totalFluidLoss` values within ±10% of expected for each vector
6. Layer buffer fills at session end within ±15% for each vector
7. Pre-patch regression run (engine at commit `29e0b30` with Vector inputs) produces the "pre-reconciliation baseline" MRs above, confirming the delta attribution
8. Non-ski activity regression: for each of `day_hike`, `backpacking`, `running`, `mountain_biking`, `trail_running`, `bouldering`, `camping`, `fishing`, `kayaking_lake`, `cycling_road_flat` and `snowshoeing`, engine output (`sessionMR`, `_totalFluidLoss`, final layer buffer fills) must match pre-patch baseline to bit-identical accuracy. Per §8.4 the `_cycleMinRaw` scoping correction should be a no-op for these activities; any deviation indicates the patch changed behavior outside the ski scope and must halt for investigation.

If any vector or non-ski regression fails to converge within tolerance, the implementation session halts and escalates rather than adjusting constants to fit — the physics is what it is, and adjusted numbers that match the expected values by parameter-gaming violate Cardinal Rule #1.

---

## 10. Physics open-question ledger

### 10.1 OQ resolution summary

All physics OQs surfaced during S30 drafting are resolved by session close. This section records the resolutions for audit traceability.

| OQ ID | Topic | Resolution | Section of spec |
|---|---|---|---|
| `OQ-S30-PHYSICS-1` | Indoor ambient conditions during rest phases | **Fixed: 20°C (68°F), 40% RH, 0 m/s wind, 0 W/m² solar.** Anchored to ASHRAE Standard 55-2020 comfort range. No user selector, no ambient-offset arithmetic. | §6.4 |
| `OQ-S30-PHYSICS-2` | Wall-clock placement of rest phases | **Fixed wall-clock times: lunch at 12:15 PM, otherBreak at 2:30 PM.** Deterministic; invariant to session start/end. Rest phases that fall outside active session window are silently skipped. | §6.5, §6.6 |
| `OQ-S30-PHYSICS-3` | Transition phase MET value | **2.0 MET.** Ainsworth 2011 Compendium code 05160 "standing, light effort tasks" verbatim. | §5.2 |
| `OQ-S30-PHYSICS-4` | Line phase MET value | **1.8 MET.** Ainsworth 2011 Compendium code 20030 "standing, talking" verbatim. | §5.2 |
| `OQ-S30-PHYSICS-5` | EPOC continuity chain across phases | **Extended chain: run-end → line → lift → transition → run.** Each phase inherits the end-state MET of the physically-prior phase. Cycle 0 line seeds with basal 1.5 MET (no EPOC), matching "user just arrived" state. | §5.3 |
| `OQ-S30-PHYSICS-6` | Lunch shell-off vs shell-on | **Shell-off during lunch (45 min), shell-on during otherBreak (15 min).** Inner ensemble exposed during lunch; shell drains separately as a draped item at 2× worn drain rate. | §6.3, §6.7 |
| `OQ-S30-PHYSICS-7` | Rest-phase ambient vapor absorption recompute | **`_aHygro_indoor_lunch` applied to insulative layer (outermost of inner ensemble when shell is off); `_aHygro_indoor_break` applied to shell (outermost worn layer when shell is on).** Separate from on-mountain `_aHygro` cached value. | §6.7.1, §6.7.2 |
| `OQ-S30-PHYSICS-8` | Non-cycleMin `cycleOverride` field audit scope | **Diagnostic-only inventory in §8.5; reconciliation does not re-spec these fields.** Five audit-query tracker items surfaced for future session resolution. | §8.5 |

### 10.2 Items migrated to Model Refinement future work

Two physics areas surfaced during drafting as non-essential for this spec but worth preserving for future refinement:

| Flag ID | Topic | Proposed future session |
|---|---|---|
| `MR-PHY-031-CONDENSATION-PER-PHASE` | Current engine uses per-cycle thermal-gradient snapshot for condensation placement; under 4-phase decomposition the gradient differs across phases. A future Model Refinement could re-sample placement per-phase. | Post-implementation session, LC7 scope |
| `MR-PHY-031-DRAPED-SHELL-DRAIN` | Draped-shell drain is approximated as 2× worn drain rate during lunch (both-sides exposure). More rigorous derivation would incorporate draped geometry, lodge air-exchange rate, and fabric-specific absorption kinetics. | Post-implementation session, LC7 scope |

### 10.3 Items migrated to LC6 Master Tracking at session close

Five audit-query tracker items from §8.5 require addition to `LC6_Planning/LC6_Master_Tracking.md` at S30 close. These are surfaced by §8.5 but resolution is out of scope for this spec.

| Tracker item | Priority | Origin |
|---|---|---|
| `S30-AUDIT-PHY-040-FIELD-OWNERSHIP` | MEDIUM | §8.5 — `elevFt` / `perRunVertFt` consumed by `altitudeFactors()` at line 514; LC6 PHY-040 spec existence not confirmed (potential DRIFT-4) |
| `S30-AUDIT-DEWPOINTC-SPEC-OWNERSHIP` | MEDIUM | §8.5 — `dewPointC` consumed in two code paths (linear-path line 329, cyclic-ski line 508); unified ownership unclear |
| `S30-AUDIT-LINEAR-PATH-CYCLEOVERRIDE` | MEDIUM | §8.5 — five linear-path fields (`elevProfile`, `rawElevProfile`, `baseElevFt`, `totalDistMi`, `tripStyle`) lack LC6 spec ownership; hiking/running outputs potentially drifting |
| `S30-AUDIT-STRATEGYLAYERIMS-SPEC-OWNERSHIP` | LOW | §8.5 — BUG-139 LC5-shipped physics contract not confirmed to have LC6 spec file |
| `S30-AUDIT-CYCLEOVERRIDE-ESCAPE-HATCH` | LOW | §8.5 — `[key: string]: unknown` index signature allows undeclared fields through invisibly |

Additional tracker entry from S30 spec drafting (non-audit):

| Tracker item | Priority | Origin |
|---|---|---|
| `S30-SKIING-DURATION-DEFAULT` | LOW | Session-drafting — `Set the Scene` form defaults Skiing duration to 3 hours. Proposed fix: compute default as `min(12, max(0.5, 16 - startHour))`. Pure UI concern, zero thermal-engine impact. |

---

## 11. S-001 regression close criteria

### 11.1 The regression in plain terms

`S26-SYSTEMATIC-MR-UNDERESTIMATION` is the longest-standing open HIGH tracker item in LC6. It was opened in S26 when user field reports repeatedly showed that perceived moisture-risk readings felt "consistently too low" — 3-5 hour real-world saturation timescales that the engine reported as 15-20 hours to reach comparable MR levels. S27 traced the root cause to PHY-031 port incompleteness (calendar model, tier system, rest time, line time all missing). S28 authored the LC6 PHY-031 spec. S29 ported the calendar model. S29-PHY-031-CYCLEMIN-PHYSICS-GAP then identified that even with the correct cycle count, the engine was simulating only run+lift duration per cycle — the rest of the wall-clock time (~50% on P5 scenarios) was ghosted. This spec authorizes the physics that closes that gap.

### 11.2 Specific close criteria for S-001

The canonical S-001 Breckenridge diagnostic scenario maps closely to Vector 2 (M2) in §9.3 above: Tier 2 moguls, 20°F moderate-cold, 45% RH, Breckenridge 9,600 ft, 8.5-hour full day. Per §9.3.6, post-reconciliation sessionMR target is **4.3 ± 0.3**, against pre-reconciliation baseline of ~1.5.

`S26-SYSTEMATIC-MR-UNDERESTIMATION` is **formally closed** when all three of the following are true:

1. **Vector 2 (M2) acceptance:** engine run at M2 inputs produces `sessionMR ∈ [4.0, 4.6]` per §9.5 criterion 2
2. **Per-cycle trajectory:** per-cycle MR array for M2 shows the lunch reset dip (~MR 1.3 at post-lunch low) and afternoon re-climb (~MR 5.0 at session end), matching the §9.3 trace within ±0.5
3. **Field-validated tier mapping:** sessionMR 4.3 maps to "yellow pacing" tier (3–5 MR) per canonical LC5 tier bands — the canonical field-intuition bucket for "significant sweat, afternoon uncomfortable, manageable with vent events and pacing"

If any of the three fails, `S26-SYSTEMATIC-MR-UNDERESTIMATION` stays open and the implementation session produces a debug trace explaining the mismatch. Do not close `S26` based on Vector 1 or Vector 3 alone — they are broader verification, not the canonical S-001 anchor.

### 11.3 What closing S-001 does not prove

- Does **not** prove the engine is correct under all possible inputs. It proves the engine matches the M2 trace under M2 inputs. Other scenarios may surface further calibration needs (particularly around the G1 elite-charger calibration gap named in §9.2.6, and the ability/effort-tier Model Refinement from PHY-031 v1 §14.1).
- Does **not** close `OQ-S30-PHYSICS-3` through `OQ-S30-PHYSICS-8` — those are independently resolved above.
- Does **not** close `MR-PHY-031-CONDENSATION-PER-PHASE` or `MR-PHY-031-DRAPED-SHELL-DRAIN`. Those are forward-flagged for LC7 Model Refinement.
- Does **not** resolve the five §8.5 audit-query tracker items. Those flow to future sessions.

### 11.4 Post-close monitoring

Even after `S26-SYSTEMATIC-MR-UNDERESTIMATION` closes, the user's per-session MR output should be cross-checked against field experience for at least the first 10 real-world ski sessions post-implementation. Persistent systematic over- or under-estimation on specific scenario classes (e.g., powder days consistently too low, bluebird days consistently too high) indicates the reconciliation landed correctly on the averaged case but has calibration gaps on sub-populations — those become new tracker items, not re-openers of S-001.

---

## 12. What this spec does NOT do

Explicit non-goals. Listed in full so future sessions cannot mistake any of these as in-scope by omission.

### 12.1 Not engine code

This spec is a design document. The implementation session (next after S30 closes) executes the engine changes per §4–§6. Until that session commits the patch, no code changes to `calc_intermittent_moisture.ts`, `evaluate.ts`, `ski_trip_form.ts`, or any other production file should be attributed to this spec.

### 12.2 Not a modification to any PHY-031 v1 value

All of the following remain LOCKED from PHY-031 v1 RATIFIED and are not revised by this spec:

- §2.1 component cycle formula (`cycleMinRaw = runMin + liftRideMin + liftLineMin + TRANSITION_MIN`; `cycleMin = cycleMinRaw / (1 - REST_FRACTION)`; `totalCycles = floor(durationMin / cycleMin)`)
- §2.2 constants (`DEFAULT_LIFT_MIN = 7`, `TRANSITION_MIN = 3`, `REST_FRACTION = 0.20`)
- §3.1 per-terrain `runMin` table (groomers=3, moguls=7, trees=10, bowls=6, park=4)
- §4.1 per-tier `liftLineMin` table (T1=0, T2=2, T3=5, T4=10, T5=15, T6=20)
- §5 holiday windows (all 10 windows as ratified S28)
- §7 powder tier-bump table
- §8.2 Phase A ski-history back-calculation formula
- `_lc5Mets` intensity-to-MET mapping (low=1.5, moderate=5, high=8, very_high=10)

Any future session that proposes to revise any of the above must halt and escalate for explicit re-ratification of PHY-031 v1.

### 12.3 Not a signature change to `calcIntermittentMoisture`

The `calcIntermittentMoisture` function signature is not modified by this spec. Rest booleans (`lunch`, `otherBreak`) are passed via extension of the existing `CycleOverride` interface — new optional fields on an existing parameter, not a new parameter. Per §8.6 this is mandated to avoid Cardinal Rule #8 signature-change exposure.

### 12.4 Not powder-signal wiring

`GAP-PHY-031-POWDER-THRESHOLD` (defined in PHY-031 v1 §7.4) remains open. This spec assumes the powder flag arrives as a pre-computed boolean on the `cycleOverride` or equivalent; how that flag is determined from OpenSnow / OnTheSnow / NWS signals is out of scope.

### 12.5 Not ski-history Phases B, C, D

PHY-031 v1 §8.3 names Phase B (screenshot import), Phase C (GPX), Phase D (Strava/Garmin OAuth). None of these are in scope. Phase A (manual entry) is supported and is demonstrated in §2.2.5 / §7 as not introducing a distinct gap.

### 12.6 Not UI changes

Any user-facing UI work — the two boolean fields on `Set the Scene`, the default-duration logic, any visualization of rest phases in the sawtooth chart — is out of scope. Implementation session may touch UI files but only to the minimum necessary to wire the rest booleans through; any UX refinement is a separate future session.

### 12.7 Not the implementation session

This spec is the input to the implementation session. It is not the implementation session itself. The implementation session receives this spec as read-only authority, produces patches, verifies against the §9 gate criteria, and commits.

### 12.8 Not a re-spec of non-cycleMin `cycleOverride` fields

Per §8.5, the other 9 fields on `CycleOverride` (`elevFt`, `perRunVertFt`, `dewPointC`, `elevProfile`, `rawElevProfile`, `baseElevFt`, `totalDistMi`, `tripStyle`, `strategyLayerIms`) are diagnostically cataloged but not re-specified. Their ownership and correctness is separately auditable via the five `S30-AUDIT-*` tracker items in §10.3.

### 12.9 Not a test specification

Test file names and minimum test counts are not prescribed. §9 hand-comp vectors are regression anchors that the implementation session's tests should exercise, but test organization, naming, and count are implementation-session scope per §8.3.

### 12.10 Not a resort-specific efficiency multiplier

PHY-031 v1 §11 defers the resort-specific efficiency multiplier (Alpine Replay framework) to v2. This spec does not change that deferral.

### 12.11 Not a REST_FRACTION variability tier

PHY-031 v1 §14.1 flags ability-tier or intensity-tier REST_FRACTION as Model Refinement future work. This spec does not open that item. The rest phases in §6 are explicit-event simulations, not a tiered adjustment to REST_FRACTION.

---
