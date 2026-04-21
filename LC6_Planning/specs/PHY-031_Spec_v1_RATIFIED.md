# PHY-031 — Component Cycle Model for Resort Skiing / Snowboarding

**Spec ID:** PHY-031
**Version:** v1 RATIFIED
**Status:** RATIFIED (spec), NOT_IMPLEMENTED (engine — S29 target)
**Date ratified:** April 21, 2026 (Session 28)
**Original LC5 ratification:** March 17, 2026
**Supersedes:** LC5 PHY-031 (implemented in LC5, 12.5% ported to LC6 per S27 audit)
**Source material:** LC5 PHY-030/031 ratified handoff docs (Mar 16–17, 2026); `S27_PHY-031_PORT_STATUS_AUDIT.md`; S28 user-resolved open questions

---

## 0. Document conventions

- **Constants** are named in `UPPER_SNAKE_CASE` and locked to values in this spec. Changes require explicit re-ratification.
- **`GAP`** marks values that are known-missing and must be named + sourced by S29 or later. Never filled with "starting values" per Cardinal Rule #1.
- **Sources** are cited by author/year or document identifier inline. Full reference list in §16.
- All numbered sections are binding. Unnumbered prose is explanatory.

---

## 1. Executive summary

### 1.1 What PHY-031 is

PHY-031 is the component cycle model for resort skiing and snowboarding. It computes **how many runs a skier completes in a session** and **how long each cycle (run + lift + line + transition + rest) actually takes**, as a function of date, terrain, resort geometry, and weather-derived crowd conditions. The output (cycle count and cycle duration) feeds the thermal engine's phase-resolved moisture and heat-loss calculations via `cycleOverride` in `calcIntermittentMoisture`.

### 1.2 Why it exists

Prior to PHY-031, the resort ski model treated every session as a uniform sequence of fixed-duration cycles regardless of day, crowd, or conditions. This produced the same cycle count for a Ghost Town Tuesday and a Mayhem-tier Dec 30 Saturday. Real-world skier-reported vertical per day varies by **2.5×** across crowd conditions at the same resort on the same terrain — a range the thermal model cannot capture without a crowd-aware cycle formula.

### 1.3 Port status in LC6

S27 audit (`S27_PHY-031_PORT_STATUS_AUDIT.md`) found:

- 1 of 8 spec items fully ported (12.5%): mogul `runMin: 10 → 7`
- 1 of 8 partial (`DEFAULT_LIFT_MIN = 7` embedded in profiles.ts phases, not declared as constant)
- 6 of 8 missing: component cycle formula, crowd calendar, holiday windows, `TRANSITION_MIN`, `REST_FRACTION`, ski history integration

Architectural scaffolding exists (`cycleOverride` parameter in `calcIntermittentMoisture`, profile comment at `profiles.ts:93-94` acknowledging the design). The bridge is null-plugged at `evaluate.ts:430` with comment "No cycle override in 10a."

**This spec closes `S27-DRIFT-3-PHY-031-NO-SPEC`. Implementation is S29 scope.**

### 1.4 What this spec is NOT

- Not engine code
- Not a modification to `profiles.ts` run/lift durations
- Not a build of `getCrowdFactor` utility
- Not wiring of `evaluate.ts:430`
- Not a test unlock for `spec-locks/phy-031-component-cycle.test.ts`

All of the above are S29.

---

## 2. Component cycle formula (LOCKED)

### 2.1 The formula

```
cycleMinRaw = runMin + liftRideMin + liftLineMin(crowdTier) + TRANSITION_MIN
cycleMin    = cycleMinRaw / (1 - REST_FRACTION)
totalCycles = floor(durationMin / cycleMin)
```

Where:

- `runMin` — descent time for the chosen terrain (see §3)
- `liftRideMin` — lift ride duration, defaulting to `DEFAULT_LIFT_MIN`
- `liftLineMin(crowdTier)` — wait time derived from date → crowd tier (see §4–§7)
- `TRANSITION_MIN` — transition time at top and bottom of run (dismount, strap in, traverse to run entry, traverse to lift line)
- `REST_FRACTION` — fraction of total session time spent off-cycle (bathroom, eating, resetting, fixing gear, breaks)

### 2.2 Component constants (LOCKED)

| Constant | Value | Source |
|---|---|---|
| `DEFAULT_LIFT_MIN` | 7 | Western resort high-speed detachable quad average (LC5 ratified Mar 17). Sample: Breck Falcon SuperChair 6 min; Copper American Flyer 7 min; Vail Eagle Bahn gondola 8 min. |
| `TRANSITION_MIN` | 3 | LC5 ratified Mar 17. Covers dismount + strap-in (snowboard) or boot-tightening (ski) + traverse to run entry + traverse to lift line. |
| `REST_FRACTION` | 0.20 | LC5 ratified Mar 17, confirmed S28. Represents 20% of total session time off-cycle (bathroom, lunch, beer, resting quads, gear resets). |

### 2.3 Rest fraction is fixed, not user-tiered

`REST_FRACTION = 0.20` is a single moderate-intensity value. The spec does **not** tier it by ability, intensity, or riding style. Rationale:

- Tiering REST_FRACTION creates a second free parameter alongside terrain-specific `runMin` that can be gamed to match any target output, violating Cardinal Rule #1 (no fudge factors).
- Population-level rest behavior clusters near 20%. An expert charger may run at 0.10; a casual family day at 0.40. Both are edge cases.
- The ski-history personal-calibration path (§8) overrides cycle COUNT directly via back-calculation. When a user has history, they don't need a tiered REST_FRACTION; they have their actual cycle time.

**S28 decision:** Keep `REST_FRACTION = 0.20` fixed. Flag REST_FRACTION variability as Model Refinement future work (§14).

### 2.4 Worked-example applicability

Worked examples in §12 assume `perRunVert = 1000 ft` (reference case — ratified LC5 Mar 17). Real per-run vertical varies by lift geometry per BUG-085 physics contract (lift vertical rise is terrain-independent, resort-specific). When `perRunVert` differs from 1000 ft, cycle counts and total-vert outputs scale accordingly; the cycle-time formula itself is unchanged.

---

## 3. Per-terrain run durations (LOCKED from LC5)

### 3.1 Terrain table

Values ported verbatim from LC5 PHY-030 (ratified Mar 16) + LC5 PHY-031 (ratified Mar 17):

| Terrain | `runMin` | Intensity | Descent speed (mph) | Turn factor | Status |
|---|---|---|---|---|---|
| groomers | 3 | moderate | 30 | 0.7 | LC5 ratified |
| moguls | 7 | very_high | 12 | 0.5 | LC5 PHY-030 revision (was 10) |
| trees | 10 | high | 8 | 0.45 | LC5 ratified |
| bowls | 6 | high | 20 | 0.6 | LC5 ratified |
| park | 4 | moderate | 18 | 0.55 | LC5 ratified |

### 3.2 Sources

- **Compendium of Physical Activities (Ainsworth et al., 2011):** MET values per terrain intensity bucket.
- **SkiTalk, AlpineZone, TGR forum aggregates:** Run-time distributions across Western/Eastern resort populations.
- **Shealy et al. 2023 radar data:** Descent speed measurements by terrain.
- **Stepan et al. 2023 JSAMS Plus (N=4,164 observations):** Average 34.9 km/h across all abilities; advanced 44.5 ± 11.7 km/h; most-difficult slopes (21–30°) 42.6 km/h. **Validates LC5 groomer `runMin = 3` for the reference `perRunVert = 1000 ft` case** (3–5 min per 1,000 vft at advanced pace per Stepan → 3–5 min at 1,000 vft).
- **ScienceDirect ski biomechanics corpus:** Speed and grade relationships.

### 3.3 Q6 resolution (S28)

User's S27 ski-speed research (Stepan, ScienceDirect) suggested groomer runs may be 6–10 min for advanced skiers. Resolution: the 6–10 min figure corresponds to ~2,000 vft lifts (Peak 8 top-to-base scenario), not the LC5-ratified `perRunVert = 1000 ft` reference case. At 1,000 vft, Stepan's advanced-pace 3–5 min per 1,000 vft is consistent with LC5's `runMin = 3`. No revision needed. Per-terrain table stands as LC5-ratified.

### 3.4 Cross-check with user field experience

35-year expert snowboarder reports 50K-vert groomer days are **nearly impossible** even under max-effort conditions (no stops, eat on lift). Formula produces ~29K vft for Tier 1 max-effort scenario (see §12.5) — consistent with field ceiling rather than forum-aspirational 50K figures. Forum "big day" figures of 40–50K are attributed to gondola/tram days, tracking-app GPS drift, or 8+ hour sessions rather than typical 6-hour Western lift-served days.

---

## 4. Crowd calendar — 6 tiers (LOCKED)

### 4.1 Tier table

Values ported verbatim from LC5 PHY-031 ratified Mar 17:

| Tier | Label | `liftLineMin` (wait) | Typical conditions |
|---|---|---|---|
| 1 | Ghost Town | 0 min | Early/late season weekdays; April Tuesday |
| 2 | Quiet | 2 min | Peak season Mon–Thu; early/late season Fri/Sun |
| 3 | Moderate | 5 min | Peak season Fri/Sun; spring break weekdays; **Christmas Day** (counter-intuitive) |
| 4 | Busy | 10 min | Peak season Saturday; MLK/Presidents Sun/Mon; spring break Saturday |
| 5 | Packed | 15 min | Dec 27–31 (non-Sat); MLK/Presidents Saturday; Jan 1 |
| 6 | Mayhem | 20 min | Dec 27–31 falling on Saturday |

### 4.2 Sources (verified LC5 research)

- Vail Resorts press release Mar 2025: 3% of lift waits exceed 10 min at properties
- SkiTalk data: Baker weekdays "ski-on, ski-off"; Stevens Pass weekends 5–10 min
- Copper Mountain Saturday data
- Whistler Blackcomb operational data
- Mammoth Mountain "20 min lines" peak reports
- PeakRankings operational commentary

### 4.3 Why Christmas Day is Tier 3 (not 5 or 6)

Empirical observation: families stay home on Christmas Day itself. Peak Christmas-week traffic is Dec 26 onward. Christmas morning ski sessions are consistently reported as moderate, not packed — many "destination" visitors spend Dec 25 with family indoors.

---

## 5. Holiday windows — 10 windows (UPDATED S28 — added Thanksgiving)

Codified in `getCrowdFactor(dateStr)` at S29 implementation time.

### 5.1 Window list

| # | Window | Day | Tier | Source |
|---|---|---|---|---|
| 1 | Christmas Day (Dec 25) | — | 3 | LC5 ratified |
| 2 | Dec 27–31 | Non-Saturday | 5 | LC5 ratified |
| 2 | Dec 27–31 | Saturday | 6 | LC5 ratified |
| 3 | Dec 26 ramp-up | — | 4 | LC5 ratified |
| 4 | Jan 1 | — | 5 | LC5 ratified |
| 5 | Jan 2–3 wind-down | — | 4 | LC5 ratified |
| 6 | MLK Weekend | Sat | 5 | LC5 ratified ("famously packed") |
| 6 | MLK Weekend | Sun/Mon | 4 | LC5 ratified |
| 7 | Presidents Day Weekend | Sat | 5 | LC5 ratified |
| 7 | Presidents Day Weekend | Sun/Mon | 4 | LC5 ratified |
| 7 | Presidents week | Tue–Fri | 3 | LC5 ratified (school vacationers) |
| 8 | Spring Break (Mar 1 – Apr 7) | Sat | 4 | LC5 ratified |
| 8 | Spring Break (Mar 1 – Apr 7) | Other | 3 | LC5 ratified |
| **10** | **Thanksgiving — Wed** | — | **3** | **S28 ratified (travel day arrivals)** |
| **10** | **Thanksgiving — Thu** | — | **2** | **S28 ratified (families indoors)** |
| **10** | **Thanksgiving — Fri ("Black Friday")** | — | **4** | **S28 ratified (first big ski day)** |
| **10** | **Thanksgiving — Sat** | — | **4** | **S28 ratified** |
| **10** | **Thanksgiving — Sun** | — | **3** | **S28 ratified (departure)** |
| 9 | Seasonal + day-of-week | — | fallthrough | See §6 |

### 5.2 Q1 resolution (S28)

Pattern matches MLK/Presidents holiday-weekend shape. Thanksgiving Friday as "first big ski day" for many destination visitors, analogous to holiday Saturday behavior elsewhere in the calendar. Thanksgiving Thursday treated as Quiet (analogous to Christmas Day) — families are with family, not at the mountain.

### 5.3 MLK / Presidents Day date computation

Third Monday of January / February respectively. Weekend window = Saturday (Mon − 2) through Monday.

```
function getThirdMonday(year, month):
  d = Date(year, month - 1, 1)
  first = d.getDay()
  firstMon = first <= 1 ? (1 - first + 1) : (8 - first + 1)
  return Date(year, month - 1, firstMon + 14)
```

### 5.4 Thanksgiving date computation

Fourth Thursday of November.

---

## 6. Seasonal + day-of-week fallthrough (LOCKED from LC5)

When the date does not match a named holiday window, use the fallthrough table.

### 6.1 Peak season (Dec 20 – Mar 31, no holiday match)

| Day | Tier | Wait | Note |
|---|---|---|---|
| Saturday | 4 | 10 min | January Saturdays consistently crowded |
| Sunday | 3 | 5 min | Less than Saturday |
| Friday | 3 | 5 min | Destination arrivals |
| Mon–Thu | 2 | 2 min | The golden window |

### 6.2 Early season (Nov 1 – Dec 19) and late season (Apr 1+)

| Day | Tier | Wait | Note |
|---|---|---|---|
| Saturday | 3 | 5 min | Limited terrain concentrates crowds |
| Sun/Fri | 2 | 2 min | — |
| Mon–Thu | 1 | 0 min | Ghost Town |

---

## 7. Powder day surge (NEW in S28)

### 7.1 Rationale

Powder days produce predictable, significant crowd shifts driven by local "powder hounds" skipping work (weekday) or amplifying existing weekend traffic. Per Ski Utah, Facebook industry data, and Reddit community consensus:

- Weekday powder day: "locals' weekend" — morning surge (9–11 AM), tapers quickly afterward
- Friday powder day: approaches weekend levels ("second most packed day of the week")
- Weekend powder day: surge on top of already-busy weekend, often doubling/tripling normal traffic
- Holiday + powder: compounds existing holiday tier

### 7.2 Tier bump table (LOCKED)

Applied to the baseline tier after all other calendar logic has resolved:

| Baseline day | Baseline tier | With powder | Rationale |
|---|---|---|---|
| Weekday Mon–Thu | 2 Quiet | **→ 4 Busy** | Locals' weekend, feels like busy weekend AM |
| Friday | 3 Moderate | **→ 5 Packed** | Friday powder approaches weekend levels |
| Saturday | 4 Busy | **→ 5 Packed** | Weekend surge (doubling traffic) |
| Sunday | 3 Moderate | **→ 5 Packed** | Weekend surge |
| Holiday weekend Sat (MLK/Presidents) | 5 Packed | **→ 6 Mayhem** | Compounds holiday |
| Christmas week (Dec 27–31) | 5–6 | **→ 6 Mayhem** | Already at ceiling |
| Early season weekday | 1 Ghost Town | **→ 3 Moderate** | Limited terrain caps surge |
| Early season weekend | 3 Moderate | **→ 4 Busy** | Limited terrain caps surge |

**Net pattern:** +2 tiers on most days, +1 when already at ceiling or in early season.

### 7.3 Signal source (LOCKED priority, GAP on threshold)

Model auto-detects powder day from external snow data. **User is not asked.** Priority order:

1. **OpenSnow** (primary) — daily expert analysis, 10-day forecasts, "powder alerts" for specific resorts
2. **OnTheSnow** (secondary) — 24–48 hour current snow reports, webcam integration, 2,000+ resorts
3. **NWS quantitative precipitation forecast** (fallback) — for any resort without OpenSnow/OnTheSnow coverage

### 7.4 Powder-day classification threshold

**`GAP-PHY-031-POWDER-THRESHOLD`** — To be specified in S29 (or later integration session) when signal source wiring begins. Industry rough threshold is ≥6 in overnight, but OpenSnow has its own proprietary "powder alert" logic. Recommendation: adopt OpenSnow's classifier directly when that source is active; define a quantitative threshold only when falling back to NWS.

### 7.5 Storm-day crowd suppression — NOT modeled v1

Per Q4 research: *"tourists may stay away due to difficult driving conditions, occasionally leaving the mountain to dedicated locals by midday."* This storm-in-progress suppression effect opposes the powder-day surge and is real, but requires driving-hazard data (chain laws, pass closures, ongoing snowfall rate) that v1 does not ingest. **Flagged as Model Refinement** (§14).

### 7.6 Within-day temporal variation — NOT modeled v1

Powder day morning surge (9–11 AM) with afternoon taper on weekdays is real. Current PHY-031 assigns one crowd tier per session, not per hour. **Flagged as Model Refinement** (§14).

---

## 8. Ski history integration — Phase A minimum viable (LOCKED design)

### 8.1 Architectural rule (CRITICAL)

**Historical data overrides cycle COUNT, not per-cycle physics.** MET, sweat rate, cold penalty, evaporative drain, and all thermal-engine primitives remain driven by the ratified thermodynamic engine. User history only replaces the calendar-derived `totalCycles`.

Rationale: the thermal engine is locked (Cardinal Rule #8). Personal calibration is a cycle-count input, not a physics override.

### 8.2 Phase A: manual entry (v1 scope)

Three fields:

1. `runsPerDay` — user-reported runs completed in a typical session at this resort
2. `hoursPerDay` — session duration those runs were completed over
3. `ridingStyle` — {cruiser, mixed, charger} (informational; does not modify cycle count)

Back-calculation:

```
actualCycleMin = (hoursPerDay * 60) / runsPerDay
cycleOverride  = { totalCycles: runsPerDay, cycleMin: actualCycleMin }
```

When `cycleOverride` is provided, the calendar model is bypassed entirely. User history is the single source of truth.

### 8.3 Phases B–D (future scope)

| Phase | Source | Feasibility (from S17 research) |
|---|---|---|
| B | Screenshot import (EpicMix, Slopes end-of-day summaries); AI extracts numbers | MEDIUM |
| C | GPX file import; per-run decomposition via GPS + gradient | MEDIUM |
| D | Strava / Garmin OAuth integrations | HIGH (both have public REST APIs + ski activity type) |
| — | Apple Health | MEDIUM (HealthKit on-device; needs native wrapper) |
| — | Slopes | LOW (export-only, no API) |
| — | EpicMix / Ikon | LOW (walled gardens) |

Phases B–D not in v1. Named here so S29 has the implementation roadmap.

### 8.4 Cold-start behavior

New users with no history use the calendar model (§2–§7) as-is. History override activates only when user has explicitly provided data. No averaging, no blending — calendar until history exists, then history.

---

## 9. CARDINAL RULE — Cycle-averaging is forbidden

### 9.1 The rule

**The human body does not average.** PHY-031's outputs (`totalCycles`, `cycleMin`) feed into `calcIntermittentMoisture` which operates on **per-phase resolution**, not cycle-averaged metabolic output.

Every phase of every cycle is experienced separately:
- **Run phase:** body as furnace — thermal surplus, high MET, peak sweat production
- **Lift phase:** body as cooling object — thermal deficit, near-basal MET, no sweat production, potential condensation

### 9.2 What cycle-averaging destroys

1. **Thermal deficits that compound.** Two ensembles (A: lift-phase HL −25W; B: lift-phase HL −55W) both show cycle-averaged storage ≈ 0, but B accumulates 1,080 W·min more cold over 36 lifts.
2. **Moisture-thermal coupling.** Wet base layer from cycle 10 worsens cycle 20 lift deficit via increased fabric thermal conductivity.
3. **Perception timing.** User feels the last 2 min of a 7-min lift (when chill peaks), not the average.
4. **Ensemble differentiation.** Averaging makes all ensembles look the same.
5. **Physics regulation boundaries.** Vasoconstriction thresholds, vasodilation activation, shivering onset all depend on instantaneous state, not averaged state.

### 9.3 Why it matters for PHY-031 specifically

PHY-031 exists to produce **accurate cycle counts** so that phase-resolved physics runs the correct number of times. If a future session is tempted to "simplify" by averaging cycle output to a single metabolic number, PHY-031's entire purpose is defeated. This is why `calcIntermittentMoisture` uses `perPhaseMR[]`, `perPhaseHL[]`, `_cumStorageWmin` — phase resolution, always.

### 9.4 Enforcement

Any session proposing cycle-averaging (or any logic that collapses phase distinctions) must halt and re-read this section. Documented to have recurred ≥3 times across LC5/LC6 sessions; flagged in S28 kickoff as a persistent failure mode.

---

## 10. No-date path — NOT APPLICABLE in v1

### 10.1 Why there is no "no date" default

Per LC5 ratified `smartStartH()` protocol: user always has a date.

- **Today:** next hour (capped 8 PM, falls back to 8 AM after 9 PM)
- **Future date, skiing/snowboarding:** 9 AM
- **Future date, other activities:** 8 AM

The UI either defaults the date to "today" or the user picks a future date. **"No date supplied" is not a reachable state.**

### 10.2 Q5 resolution (S28)

The LC5 Mar 17 doc proposed "Tier 3 default when no date supplied." **This proposal is rescinded.** It was a defensive default for a path that does not exist.

### 10.3 Implementation note for S29

Do not build a `getDefaultTier()` or equivalent fallback for missing dates. If `dateStr` is ever null/undefined in a call path that reaches `getCrowdFactor`, that is a bug upstream, not a case to default.

---

## 11. Resort-specific multiplier — NOT in v1

### 11.1 Q3 resolution (S28)

Defer to v2. v1 applies the single calendar model uniformly across all resorts. Consistent with LC5 Mar 17 Phase 1 design intent.

### 11.2 Alpine Replay framework (captured for v2)

Data source: Alpine Replay "Top 30 Vertical Drop to Lift Time Ratio" (2014–2015 season). Empirical observation: 50%+ variance between highest-efficiency (Revelstoke) and lowest-efficiency (Mt. Hood Meadows) resorts.

| Tier | Resorts | Normalized diff | Implied active % (groomers) |
|---|---|---|---|
| 1 High Efficiency | Revelstoke, Snowbird, Jackson Hole, Beaver Creek, Sun Valley | +15% to +50% | 22–28% |
| 2 Above Average | Mt. Rose, Whistler, Stowe, Keystone, Steamboat, Snowmass | +5% to +15% | 20–24% |
| 3 Average | Hunter, Loon, Vail, Copper, Schweitzer, Snowbasin | −5% to +5% | 18–22% |
| 4 Below Average | Crystal, Whiteface, Okemo, Lake Louise, Telluride, Stratton | −10% to −5% | 16–20% |
| 5 Low Efficiency | Northstar, Marmot Basin, Canyons, Durango, Brighton, Mammoth, Mt. Hood Meadows | −15% to −10% | 14–18% |

Proposed formula for v2:
```
active% = baseActive% × (1 + resortEfficiencyModifier)
```
Where `resortEfficiencyModifier` ranges −0.15 (Tier 5) to +0.25 (Tier 1).

### 11.3 Why deferred

- Adds a resort-identification dependency (which resort is the user at?) that v1 crowd inference doesn't require
- Alpine Replay data is ~10 years old; recalibration may be warranted before implementation
- The calendar model alone produces the dominant crowd variance (2.5× spread). Resort efficiency adds a second-order refinement

---

## 12. Worked examples

All examples assume `perRunVert = 1000 ft` reference.

### 12.1 Moguls, Feb Tuesday (Tier 2 Quiet)

| Component | Value | Source |
|---|---|---|
| Lift ride | 7 min | `DEFAULT_LIFT_MIN` |
| Lift line | 2 min | Tier 2 Quiet |
| Run descent | 7 min | Moguls `runMin` |
| Transition | 3 min | `TRANSITION_MIN` |
| Cycle raw | 19 min | sum |
| Rest overhead | 20% | `REST_FRACTION` |
| Effective session minutes | 288 | 360 × (1 − 0.20) |
| **Total cycles** | **15** | floor(288 / 19) |
| Total vert | ~15,000 ft | 15 × 1,000 |

### 12.2 Moguls, Jan Saturday (Tier 4 Busy)

Cycle raw: 7 + 10 + 7 + 3 = 27 min. Effective: 288 min. **Cycles: 10.** Vert: ~10,000 ft. Busy Saturday = 33% less vert than Quiet Tuesday.

### 12.3 Moguls, Dec 29 Saturday (Tier 6 Mayhem)

Cycle raw: 7 + 20 + 7 + 3 = 37 min. Effective: 288 min. **Cycles: 7.** Vert: ~7,000 ft. Mayhem = 53% less vert than Quiet Tuesday.

### 12.4 Groomers, Feb Tuesday (Tier 2 Quiet)

Cycle raw: 7 + 2 + 3 + 3 = 15 min. Effective: 288 min. **Cycles: 19.** Vert: ~19,000 ft. 1.3× more than Tier 2 moguls (same tier, shorter runs).

### 12.5 Groomers, max-effort Tier 1 Ghost Town (field-ceiling check)

Expert charger, max-effort, no stops, eat on lift. Use `REST_FRACTION = 0.10` as adversarial-low rather than ratified 0.20.

Cycle raw: 7 + 0 + 3 + 3 = 13 min. Effective: 360 × 0.90 = 324 min. **Cycles: 24.** Vert: ~24,000 ft.

At ratified `REST_FRACTION = 0.20`: Cycles = floor(288 / 13) = 22. Vert: ~22,000 ft.

**Both well below the "50K" forum figure**, consistent with 35-year expert snowboarder field report that 50K groomer days are "nearly impossible." This validates PHY-031 does not produce aspirational ceiling outputs.

### 12.6 Weekday powder day (Tuesday, powder auto-detected)

Baseline Tier 2 Quiet → powder bump → **Tier 4 Busy.** Moguls.

Cycle raw: 7 + 10 + 7 + 3 = 27 min. Effective: 288 min. **Cycles: 10.** Vert: ~10,000 ft. Same output as a Jan Saturday — locals' weekend pattern captured.

### 12.7 Weekend powder day (Saturday, powder auto-detected)

Baseline Tier 4 Busy → powder bump → **Tier 5 Packed.** Moguls.

Cycle raw: 7 + 15 + 7 + 3 = 32 min. Effective: 288 min. **Cycles: 9.** Vert: ~9,000 ft.

### 12.8 Thanksgiving Friday (Black Friday powder day)

Baseline Tier 4 Busy (Thanksgiving Fri S28 ratified) → powder bump → **Tier 5 Packed.** Groomers.

Cycle raw: 7 + 15 + 3 + 3 = 28 min. Effective: 288 min. **Cycles: 10.** Vert: ~10,000 ft.

---

## 13. Verification criteria for S29 implementation

Implementation in S29 is verified against this spec when:

### 13.1 Constants declared

`DEFAULT_LIFT_MIN`, `TRANSITION_MIN`, `REST_FRACTION` declared as named constants in a single module (proposed: `packages/engine/src/activities/phy031_constants.ts` or `heat_balance/constants.ts`). Values match §2.2 exactly.

### 13.2 Formula implemented

`cycleMin = (runMin + liftRideMin + liftLineMin(tier) + TRANSITION_MIN) / (1 - REST_FRACTION)`. `totalCycles = floor(durationMin / cycleMin)`. Implemented as a pure helper function, takes crowd tier and terrain as inputs, returns cycle count and cycle minutes.

### 13.3 Crowd utility built

`getCrowdFactor(dateStr, powderFlag)` returns crowd tier 1–6. Handles all 10 holiday windows + fallthrough + powder bump.

### 13.4 Bridge wired

`evaluate.ts:430` hardcoded `cycleOverride: null` replaced with computed override from `getCrowdFactor` + component formula. Comment "No cycle override in 10a" removed.

### 13.5 Ski history parameter added

`calcIntermittentMoisture` signature accepts optional `skiHistory: { runsPerDay, hoursPerDay, ridingStyle }` or equivalent. When present, bypasses calendar and uses back-calculated override.

### 13.6 Test targets

`packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts` contains 25 `.todo` placeholders as of S27 (commit 2e33590). S29 converts `.todo` → `.it` as each component lands. **S28 does not bind `.todo` items to sections of this spec — S29 has both the spec and the test file in its context and performs the binding during port work** (per S28 kickoff success criterion #5, resolved as option (a)).

Minimum verification scenarios (for S29):

- Groomers at 2026-02-03 (Tier 2 weekday): cycle count 17–19 (not 36)
- Groomers at 2026-12-29 (Saturday in Dec 27–31 = Tier 6): cycle count dramatically lower
- Moguls at Tier 2: cycle count 12–14 (per §12.1)
- Thanksgiving Friday: cycle count matches §12.8
- Weekday powder Tuesday: cycle count matches §12.6

### 13.7 Diagnostic anchoring

S-001 Breckenridge diagnostic (16°F cold-dry, 6 hr groomers, mid-tier ensemble) must show cycle count drop from current 36 to spec-predicted 18 at Tier 2. This is the canonical regression target.

---

## 14. Future work — Model Refinement

Items deferred from S28 open-question resolutions. Each is documented so future sessions have the starting point rather than rediscovering.

### 14.1 Signals to add to crowd-tier inference (v2+)

- **Storm-day crowd suppression** (§7.5): bad driving → reduced destination traffic. Needs chain law, pass closure, or real-time snowfall rate data.
- **Bluebird-day surge**: clear day after storm often packs more than the storm day itself. Signal: clear sky + prior-day snowfall.
- **Extreme cold suppression**: −20°F Tuesday may thin even powder hounds. Signal: forecast low.
- **Local events calendar**: ski races (FIS, regional, club), festivals (Vail Snow Daze, Jackson Pow Wow, etc.), closing day / pond skim / beer league. Signal source TBD.
- **Within-day temporal variation** (§7.6): morning surge vs afternoon taper, especially on weekday powder days.
- **Ability-level multiplier on `runMin`**: C′ variant from Q6 scoping. If LC6 ever collects ability level.
- **REST_FRACTION variability**: ability-tier, intensity-tier, or session-type-tier.

### 14.2 Features deferred from S28

- **User crowd override selector**: full or lower-only variants (Q2). Deferred per "minimize user input" principle.
- **Resort-specific efficiency multiplier**: Alpine Replay framework (§11.2) (Q3).
- **Ski history Phases B, C, D**: screenshot import, GPX import, Strava/Garmin OAuth (§8.3).

### 14.3 Governance gap — Model Refinement process itself

The refinement cycle for PHY-031 (and LC6 physics more broadly) is currently undefined. **When do deferred items graduate to v2 scope? What triggers a refinement pass? Who ratifies?** Flagged by user in S28 as needing its own session to define. **Not S28 scope.**

---

## 15. S28 open-question resolution audit trail

Six open questions entered S28 deferred from LC5 PHY-031 ratification and S27 audit. All resolved.

| Q | Topic | Resolution | Rationale |
|---|---|---|---|
| Q6 | Run duration revision | No revision — LC5 table stands | User's Stepan research applies to 2,000 vft scenarios; LC5 values correct for 1,000 vft reference. No unit error. |
| Q5 | Climate normals default | Not applicable — date always supplied | `smartStartH` protocol ratified; "no date" path unreachable |
| Q1 | Thanksgiving treatment | Window #10 added: Wed 3 / Thu 2 / Fri 4 / Sat 4 / Sun 3 | Mirrors MLK/Presidents pattern; Thursday = Christmas Day logic (families indoors) |
| Q4 | Powder day surge | Auto-detected via OpenSnow → OnTheSnow → NWS; tier bump table ratified; threshold `GAP` | User provided industry research; "minimize user input" principle |
| Q3 | Resort-specific multiplier | Defer to v2; Alpine Replay framework captured | Matches LC5 Phase 1 design intent |
| Q2 | User crowd override | Defer to v2; infer from ambient signals | "Minimize user input" principle; Tight v1 signal scope |

Ordering resolved concrete-to-abstract: Q6 → Q5 → Q1 → Q4 → Q3 → Q2.

---

## 16. References

### LC6 Planning
- `LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md` (S27, commit 0cce64c)
- `LC6_Planning/LC6_Spec_Registry.md` (S27, commit 57a469e)
- `LC6_Planning/LC6_Master_Tracking.md` (canonical tracker)
- `LC6_Planning/session_kickoffs/S28_kickoff.md`

### LC5 source (physics of record)
- LC5 PHY-030 ratified handoff, March 16, 2026 (terrain parameters + BUG-085 per-run vert fix)
- LC5 PHY-031 ratified handoff, March 17, 2026 (component cycle + crowd calendar)
- `packages/engine/reference/lc5_risk_functions.js` (LC5 source of truth)
- `packages/engine/src/activities/profiles.ts:93-94` (comment acknowledging PHY-031 design intent)
- `packages/engine/src/moisture/calc_intermittent_moisture.ts:247,297,500-504` (cycleOverride scaffolding)
- `packages/engine/src/evaluate.ts:430` (null-plug target for S29)

### LC6 tests
- `packages/engine/tests/spec-locks/phy-031-component-cycle.test.ts` (S27, 6 Tier A + 25 Tier B `.todo`)

### Ski physiology and operations
- Compendium of Physical Activities, Ainsworth et al., 2011 (MET values per terrain)
- Shealy et al., 2023 (descent speed radar data)
- Stepan et al., 2023, *JSAMS Plus* (N=4,164 observation ski-speed corpus; user upload S27)
- ScienceDirect ski biomechanics corpus (advanced-pace reference, 3–5 min per 1,000 vft)
- SkiTalk forum aggregates (daily vertical distributions)
- AlpineZone tracker data (25% active / 40% lift / 35% rest)
- TGR forums (resort-specific big-day figures)
- Vail Resorts press release, March 2025 (3% of lift waits exceed 10 min)
- PeakRankings operational commentary
- Alpine Replay Top 30 Vertical Drop to Lift Time Ratio, 2014–2015 season (user upload March 10, 2026)

### Powder-day crowd behavior
- Ski Utah, industry research on weekday "locals' weekend" behavior (user upload S28)
- Facebook ski-community industry research on weekend powder surge (user upload S28)
- Reddit community consensus on weekday vs weekend powder-day patterns (user upload S28)

### Powder detection data sources (for S29 wiring)
- OpenSnow (primary) — daily expert analysis, 10-day forecasts, powder alerts
- OnTheSnow (secondary) — 24–48 hour current reports, webcams, 2,000+ resorts
- NWS quantitative precipitation forecast (fallback)

### User-provided scenarios
- 35-year expert snowboarder field report: 50K groomer day "nearly impossible" even at max effort (S28)
- Breckenridge Peak 10 Falcon SuperChair worked examples (S16, S20, S-001)

---

## 17. Document status

| Field | Value |
|---|---|
| **Version** | v1 RATIFIED |
| **Ratified** | Session 28, April 21, 2026 |
| **Ratified by** | User (Christian) + Chat |
| **File Status** | RATIFIED |
| **Reality Status** | NOT_IMPLEMENTED (engine — S29 target) |
| **Supersedes** | LC5 PHY-031 (Mar 17, 2026) — never ported to LC6 |
| **Next action** | S29 — execute Option A port per S27 audit §6 |
| **Unblocks** | `S26-SYSTEMATIC-MR-UNDERESTIMATION`, `S27-DRIFT-3-PHY-031-NO-SPEC` |

---

End of PHY-031 Spec v1 RATIFIED.
