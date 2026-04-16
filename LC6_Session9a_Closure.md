# LC6 Session 9a Closure

**Produced:** 2026-04-15, end of Session 9a.
**Purpose:** Session 9a ledger closeout per Working Agreement v3 §2; fifth build-phase session; foundational helpers + data structures port preparing for Session 9b/9c calcIntermittentMoisture orchestration; Pre-Build Audit Protocol Step 6 amendment captured.

---

## A. Session 9a final ledger entry

**Paste into `LC6_Session_Ledger.md`:**

```
## Session 9a — 2026-04-15 — Foundational helpers + data structures port from LC5

**Scope as agreed:** Per Pre-Build Audit Q3 ratification (option Q), Session 9a ports 13 foundational helper functions + 7 data structure constants to prepare for Sessions 9b (cyclic path) and 9c (steady-state path) of calcIntermittentMoisture. No orchestration logic this session.

**Final deliverables:**
- 4 new files in heat_balance/ (1 append + 2 new) ports duboisBSA, EPOC + core temp, cold physiology
- 2 new files in moisture/ NEW MODULE (perceived MR + saturation cascade)
- 3 new files in activities/ NEW MODULE (split body + descent + activity profiles)
- engine src/index.ts updated to re-export all new symbols
- 13 functions ported VERBATIM from LC5 (per Cardinal Rule #8)
- 7 named constant blocks (PERCEIVED_WEIGHTS, COMFORT_THRESHOLD, WADER_DATA, SNOW_SPORT_ZONES, ACTIVITY_SWEAT_PROFILES, INTERMITTENT_PHASE_PROFILES, GENERIC_GEAR_SCORES_BY_SLOT)
- 110 new tests (15 epoc + 18 cold_physiology + 10 dubois_bsa + 9 perceived_mr + 7 saturation_cascade + 23 split_body + 9 descent + 19 profiles)
- Total engine tests: 312 passing across 19 test files
- 4/4 packages typecheck clean
- Code pushed to https://github.com/cmccarter-maker/lc6 commit 9e1c876
- OQ-029 opened (cyclic nomenclature reconciliation)

**Inputs read:**
- LC6_Working_Agreement_v3.md (re-read per session protocol; rules 1-18 verbatim audit)
- LC6_Architecture_Document_v1.1_RATIFIED.md (§2 confirmed moisture/ and activities/ as new top-level engine subdirectories)
- LC6_CDI_Derivation_Spec_v1.4_RATIFIED.md (no impact this session — atomic helpers)
- LC6_Session_Ledger.md through Session 8 closure
- LC5 risk_functions.js (already in /mnt/user-data/uploads from Session 6) — function blocks at lines 130-190, 222-309, 839-984, 1409-1594, 2217-2226, 3873-3877; full dependency chain traced
- Sessions 5-8 engine exports inventoried for cross-session import verification (per Pre-Build Audit Step 4)
- LC5 calcIntermittentMoisture (lines 2426-3392) reconnaissance — surface assessment + cyclic vs linear vs steady-state distinction; Christian's question on "cyclic" terminology answered with full LC5 examples; conclusion: LC5 type:'cyclic' = duty-cycle modeling, not lap-based

**Code applied:** Single Chat-produced build script (lc6_session9a_build.sh, ~80 KB, 12 phases) + 1 surgical fix. Built all modules + tests + Git push in single execution per Rule #13.

**Functions ported (all from LC5 risk_functions.js April 2026 audit baseline):**

Heat balance extensions:
- duboisBSA (line 3873) — DuBois & DuBois 1916 BSA estimate from weight (lb) with stratified height lookup
- epocParams (line 130) — Børsheim & Bahr 2003 two-component EPOC model
- epocTau (line 139) — Legacy single-tau EPOC wrapper for CLO floor calculations
- estimateCoreTemp (line 146) — Gagge 1972 core temp from cumulative heat storage
- civdProtectionFactor (line 153) — Flouris & Cheung 2008 vasoconstriction state vs core temp
- shiveringBoost (line 182) — Young et al. 1986 shivering thermogenesis (capped at 2.5 METs Hayward 1975)
- computeHLR (line 163) — Composite heat-loss risk score (base × coreAmp × coldSev × wetness)

Moisture module (NEW):
- computePerceivedMR (line 293) — Fukazawa 2003 + Zhang 2002 skin-weighted layer perception
- applySaturationCascade (line 839) — LC5 v3 curve (linear ≤6, quadratic ease-out 6-10, cap 10)

Activities module (NEW):
- waderSplitIm (line 943) — PHY-052 wader split-body vapor (45% upper + 55% lower)
- waderSplitCLO (line 950) — PHY-052 wader split-body CLO
- snowSportSplitIm (line 975) — PHY-065 snow sport split-body (6 zones: layering 80% + extremities 20%)
- descentSpeedWind (line 1438) — PHY-019 Shealy 2023 descent terrain lookup with sport prefix stripping

**Constants ported (Option C citations applied):**
- PERCEIVED_WEIGHTS [3, 2, 1.5, 1] — Fukazawa 2003 layer perception order
- COMFORT_THRESHOLD 40 mL — Fukazawa 2003 skin wetness perception onset
- WADER_DATA — 10 wader types with im/clo/label per ISO 15027 + manufacturer specs (PHY-052 audit baseline)
- SNOW_SPORT_ZONES — 6 BSA zones per ANSUR II 2012 + Rule of Nines (PHY-065c audit baseline)
- ACTIVITY_SWEAT_PROFILES — 21 activities with sweat rates per Bergh 1992 + ACSM Sawka 2007 + Compendium of Physical Activities (Ainsworth 2011)
- INTERMITTENT_PHASE_PROFILES — 22 phase profiles spanning ski terrain, golf, fishing, kayaking, SUP, road/gravel cycling × flat/hilly, XC ski, snowshoeing, BC ski, snowshoeing, etc. Per Compendium of Physical Activities with explicit MET codes inline
- GENERIC_GEAR_SCORES_BY_SLOT — 8 slots with breathability/moisture/windResist/warmthRatio/waterproof per PHY-025

**Tests passed:**
- Sessions 5-8 (preserved): 202 tests
- Session 9a NEW: 110 tests
  - heat_balance: 15 epoc + 18 cold_physiology + 10 dubois_bsa = 43
  - moisture: 9 perceived_mr + 7 saturation_cascade = 16
  - activities: 23 split_body + 9 descent + 19 profiles = 51
- **Total: 312 tests passing**
- 4/4 packages typecheck clean

**Pre-Build Audit (THIRD formal application; one in-session test fix):**

Conducted written 8-step Cardinal Rule audit before code production. All 18 Cardinal Rules verdicts (13 PASS / 4 N/A / 1 ratification pending). Two open questions raised; both resolved by Christian:
- Q1: Module structure as proposed (8 new files + 1 append) — RATIFIED
- Q2: Open OQ-029 for cyclic nomenclature future reconciliation — RATIFIED

Christian also corrected my reconnaissance error: I had mis-described golf/fishing/non-lapping cycling as "cyclic" in everyday lap-based sense. Real meaning: LC5 type:'cyclic' means "duty-cycle modeled" (work/rest pattern repeating), not literal laps. This produced OQ-029.

**Build outcome: 311/312 tests passing on first run; 312/312 after one surgical fix.**

The single failure: saturation_cascade boundary continuity test asserted applySaturationCascade(6.001) ≈ 6.0005 (my eyeball estimate). Correct value is 6.001999750 (per LC5 verbatim formula). Function output correct; test assertion was physics-intuition error.

**Same class of error as Session 7 computeMetabolicHeat (asserted 772.43, correct 772.232).** Both happened on synthesized "secondary" tests outside the lock-in baseline tables. The 12 lock-in baseline tests (which use captured LC5 output values) all passed first run.

**Surgical fix applied:** Replace 6.0005 with 6.0019997 in test assertion. Single sed command. Test passed.

**Key implementation decisions locked:**
- All 13 functions ported VERBATIM (per Cardinal Rule #8); only TS type annotations added
- All 7 data structures ported with values preserved exactly
- INTERMITTENT_PHASE_PROFILES NOMENCLATURE NOTE inlined in code: "type:'cyclic' means duty-cycle modeled (work/rest), NOT lap-based"
- Module structure: separate `moisture/` and `activities/` directories at engine top level, distinct from `heat_balance/` and `ensemble/` for conceptual clarity
- Cross-session imports verified: BASELINE_IM (Session 6), LC5_BODY_SPEC_HEAT (Session 7) — both exported and named consistently
- BASELINE_IM NOT renamed (stayed as BASELINE_IM, no Session 7-style mismatch)
- Cycle "type" string preserved as 'cyclic' | 'linear' even though OQ-029 may rename to 'phased'/'duty_cycle' later — Cardinal Rule #8 verbatim

**Errors made and fixed in-session:**
1. Saturation_cascade boundary continuity test assertion incorrect (eyeball estimate 6.0005, correct value 6.001999750). Surgical sed fix applied. Discussed root cause (third instance of physics-intuition test assertion error across Sessions 7, 7, 9a).

**Process improvement notes:**

THIRD instance of physics-intuition test assertion error pattern across the project:
- Session 7: computeMetabolicHeat(10, 80) asserted 772.43, correct 772.232
- Session 7: drain rate asserted from physics intuition (caught Session 6)
- Session 9a: applySaturationCascade(6.001) asserted 6.0005, correct 6.001999750

Pattern: when test assertions are written off eyeball intuition rather than from running LC5 source, they get the value wrong. This bypasses the lock-in baseline pattern that has prevented every other test failure in Sessions 6-9a.

The lock-in baseline pattern (run LC5 source, capture output, paste verbatim into test assertion) is 100% reliable when applied. The failure mode is when "secondary tests" (continuity, boundary checks, monotonicity intermediates) get hand-computed instead of source-computed.

**Pre-Build Audit Protocol Step 6 amendment formalized this session:**
"ALL hand-computed test assertions must come from running the LC5 source through the operating point. NO 'this should be approximately X' eyeball assertions allowed, even for 'obviously simple' tests like boundary continuity, monotonicity intermediates, or curve continuity probes. If the test asserts a numeric value, that value must be the actual LC5-source output captured during baseline capture phase."

**Open issues discovered:** None new beyond OQ-029 (formal cyclic nomenclature reconciliation track).

**Open questions remaining:**

NEW from Session 9a:
- OQ-029: LC5 type:'cyclic' terminology reconciliation. Currently means "duty-cycle modeled" (golf, fishing, cycling, kayaking) AND "lap-based" (resort skiing). Consider rename to 'phased' or 'duty_cycle' with subcategories ('lap_based' vs 'duty_cycle') for clarity. Future dedicated session.

Carry-forward from prior sessions:
- OQ-028: Standardize all heat-balance and ensemble functions to °F input convention (Session 8)
- stage_τ_max per-stage values (Session 4 — still GAP-flagged)
- 15-min stage promotion threshold tunability per stage (Session 4)
- Q_shiver_sustained 50W threshold alternative (Session 4)
- Heat-side direct sweat-rate stage detection (Session 4)
- iterativeTSkin warm_rest_light non-convergence (Session 7 — locked-in as expected behavior)

**Inputs NOT read (deferred):**
- LC5 source for calcIntermittentMoisture full body (Session 9b/9c target)
- LC5 layer/buffer condensation placement physics (likely Session 9b inclusion)
- ISO 11079:2007 and ISO 7933:2023 full standard text (paid; not purchased)

**Ratifications received:** Christian ratified Pre-Build Audit Q1 (module structure as proposed) and Q2 (OQ-029 future reconciliation); reconnaissance discussion of cyclic terminology produced clarity that informs all future Session 9b/9c work; verbatim build script run; surgical fix applied as proposed; final push completed.

**Session 9a closure status:** Fully closed. Foundational helpers + data structures complete. Engine contains CDI v1.4 stage detection (Session 5) + heat balance primitives (Session 6) + PHY-056 solver (Session 7) + ensemble functions (Session 8) + 13 helpers + 7 data structure constants (Session 9a). 312 tests passing.

**Next session needs (Session 9b):**
- Working Agreement v3 (re-read per session protocol)
- Session Ledger through Session 9a closure
- LC5 risk_functions.js (already in /mnt/user-data/uploads)
- Christian's opening scope statement
- Pre-Build Audit posted before any code script
- All Session 9a dependencies (helpers + data structures) now exported and available
```

---

## B. Decision Registry — no new DEC entries

Session 9a produced no new ratified decisions (similar to Session 8). All ratification went into Pre-Build Audit Q1/Q2 answers and OQ-029 opening.

OQ-029 may produce DEC-025 in a future cleanup session when the cyclic→phased rename is executed.

---

## C. Open Questions Ledger — OQ-029 added

**Apply to `LC6_Open_Questions.md`:**

```
### OQ-029 — Cyclic terminology reconciliation
- **Opened:** 2026-04-15 (Session 9a, during Christian's question on cyclic activity classification)
- **Discovered by:** Christian during Session 9 reconnaissance — "Explain how cycling, golf and fishing are cyclic events?"
- **Question:** LC5 source uses type:'cyclic' for activities with two distinct behaviors:
  - **True lap-based:** resort skiing, snowboarding (groomers, moguls, trees, bowls, park) — physical loops via lift cycles
  - **Duty-cycle modeled (NOT lap-based):** golf, fishing, kayaking, cycling, MTB, climbing, bouldering — repeating work-rest patterns from Compendium of Physical Activities statistical distributions
  
  The LC5 author chose "cyclic" to mean "modeled with explicit duty cycle" because the engine logic handles both cases identically: per-cycle sweat accumulation + rest-phase recovery. But the everyday English meaning of "cyclic" (lap-based) is misleading.

- **Why deferred this session:** Session 9a was about porting LC5 verbatim (Cardinal Rule #8). Cleanup is non-essential for engine correctness; only affects documentation and future readability.

- **Resolution path (future session):**
  1. Rename PhaseProfile.type from 'cyclic' | 'linear' to 'phased' | 'continuous' OR ('lap_based' | 'duty_cycle' | 'continuous')
  2. Update INTERMITTENT_PHASE_PROFILES naming convention
  3. Add subcategory metadata if differentiating lap vs duty-cycle is useful
  4. Update Working Agreement v3 documentation
  5. New DEC entry (DEC-025 or later) ratifying the rename
  6. Future Architecture Document v1.2 amendment if needed

- **Estimated effort:** Half-session — pure rename + documentation update; no physics changes.

- **Why not now:** Session 9b/9c need to first port the cyclic path orchestration to validate the model works. Renaming during that work would conflate verbatim port with cleanup — a Cardinal Rule #12 violation. Better to do the rename as a focused future session.

- **Current behavior:** Both meanings coexist under 'cyclic' label. Code comments document the distinction. No silent bugs.

- **Related items:** OQ-028 (°F/°C convention) — both are nomenclature/convention cleanups; could potentially be batched into a single "LC6 conventions cleanup" session.

- **Dependencies for opening:** Sessions 9b, 9c complete (so we can rename in one shot across all consumers).
```

---

## D. Pre-Build Audit Protocol Step 6 amendment

The Step 6 (test strategy declaration) amendment formalizes the lesson from the third instance of physics-intuition test assertion error.

### Updated Step 6 — mandatory for Session 9b+:

**Step 6 — Test strategy declaration (AMENDED 2026-04-15 Session 9a):**

For ANY test that asserts a numeric value:

1. **Lock-in pattern is the ONLY method allowed for hand-computed values.** The numeric value MUST come from running the LC5 verbatim source through the same operating point. No "this should be approximately X" eyeball assertions.

2. **Baseline capture phase is mandatory:**
   - BEFORE any test file is written, run a Node.js script reproducing LC5 verbatim source
   - Capture function output across all operating points the tests will assert on
   - Tests then paste those captured values verbatim into `toBeCloseTo` assertions

3. **Boundary continuity tests, monotonicity probes, "obvious" intermediate values** — these are NOT exempt. If the test asserts `f(6.001) ≈ X`, X must come from running the function at 6.001, not from intuition.

4. **Structural tests (typeof, hasProperty, length, key existence)** are still allowed without baseline capture — these don't assert numeric values.

5. **Source-computed reference values from external citations** (e.g., Stefan-Boltzmann at 293K) are allowed but must show the derivation in the test comment.

### Pattern observed across sessions before this amendment:

| Session | In-session fixes | Class of error | Caught by Step 6? |
|---|---|---|---|
| 5 | 2 | Toolchain | Step 4-5 (not test) |
| 6 | 1 | Physics intuition (drain rate) | NO — Session 6 was where this lesson originated |
| 7 | 3 | Hand-math, import naming, LC5 RH bug | Step 6 ONLY for the LC5 RH bug |
| 8 | 0 | None | (audit-clean) |
| 9a | 1 | Physics intuition (saturation cascade) | NO — synthesized continuity test outside baseline table |

After Step 6 amendment: synthesized continuity tests are no longer "outside the baseline table" because EVERY numeric assertion goes through baseline capture.

---

## E. Session 9b preparation

Per Working Agreement v3 §2 session protocol: Session 9b begins with the following pre-defined scope.

### Session 9b candidate scopes

**Recommended: port LC5 calcIntermittentMoisture cyclic path (~610 lines).**

Rationale:
- All Session 9a dependencies now in place (13 helpers + 7 data structures available in engine)
- Cyclic path is the most consequential branch — the path used by skiing/snowboarding/golf/fishing/kayaking/cycling/etc.
- Includes per-cycle iterativeTSkin loop (the heart of MR computation)
- DEC-024 RH compliance: LC5 source has computeRespiratoryHeatLoss called with _humFrac (fraction); LC6 port must convert to _humFrac*100 (percent) at each call site (likely 2-4 sites)

**Alternative — Session 9b1/9b2 split if surface is too large:**

Even with helpers in place, 610 lines is big. Pre-Build Audit may recommend further splitting:
- Session 9b1: Setup + per-cycle iteration scaffolding (no cycle body)
- Session 9b2: Per-cycle body + return assembly

Pre-Build Audit will determine.

### Inputs required at Session 9b start

- Working Agreement v3 (re-read)
- Session Ledger through Session 9a closure
- LC5 risk_functions.js (already in /mnt/user-data/uploads)
- Christian's opening scope statement
- Pre-Build Audit posted before code script (using Step 6 AMENDED — all numeric assertions must come from baseline capture)

### Session 9b does NOT include

- OQ-028 °F-standardization (separate dedicated session)
- OQ-029 cyclic→phased rename (after 9c complete)
- Steady-state path (Session 9c)
- PHY-040 functions (DEC-023 — explicitly excluded)
- Spec revisions (CDI v1.4 and Architecture v1.1 locked unless build-phase discovery forces formal amendment)

---

## F. Session 9a closure summary

**Accomplished:**
- 13 helper functions ported VERBATIM from LC5
- 7 data structure constants ported with Option C citations
- 110 new tests; 312 total passing
- 2 new top-level engine modules created (moisture/, activities/)
- OQ-029 opened for future cyclic→phased nomenclature reconciliation
- Pre-Build Audit Protocol Step 6 amended to prevent physics-intuition test assertions
- Code pushed to GitHub commit 9e1c876

**Process improvements internalized:**
- Step 6 amendment closes the physics-intuition assertion failure mode entirely. No more "I think this is approximately X" assertions allowed.
- Reconnaissance pass (Pre-Build Audit Step 2 standalone) proved valuable: catching the cyclic terminology issue before code production prevented OQ-029 from becoming a build-time fix.
- Module structure decisions (moisture/, activities/ as top-level) maintain clean separation of concerns; Architecture Document v1.1 §2 can be updated at next milestone to formalize.

**Working Agreement v3 compliance audit:**
- Cardinal Rule #1 (no fudge factors): all constants traced via Option C citations + LC5 PHY-numbered audit baselines
- Cardinal Rule #3 (single source of truth): no duplicate physics implementations introduced; epocParams vs epocTau documented as composite vs legacy wrapper
- Cardinal Rule #6 (no double-dipping): computeHLR documented as multiplicative independent factors
- Cardinal Rule #8 (engine locked): 13 functions + 7 data structures ported VERBATIM with values preserved
- Cardinal Rule #11 (no code without ratified spec): Pre-Build Audit ratification preceded code production
- Cardinal Rule #12 (no while-we're-in-here): zero opportunistic changes; cyclic naming preserved per Cardinal Rule #8 even though OQ-029 acknowledges it
- Cardinal Rule #13 (Chat produces all code): single verbatim script + 1 atomic surgical fix
- Cardinal Rule #14 (read before proposing): 13 function bodies + 7 data structures + dependency chain + call sites read
- Cardinal Rule #15 (confirm or push back): two audit questions answered before code; reconnaissance discussion clarified cyclic terminology
- Cardinal Rule #16 (engine output contract inviolable): no EngineOutput changes; new function-local types only
- Cardinal Rule #17 (rogue engine prohibition): all code in @lc6/engine package; boundary enforced

**Engine state after Session 9a:**

| Module | Functions | Tests | Status |
|---|---|---|---|
| cdi/ (Session 5) | 4 | 19 | Complete |
| heat_balance/ (Sessions 6+7+9a) | 26 | 144 | Complete |
| ensemble/ (Session 8) | 11 | 82 | Complete |
| moisture/ (Session 9a NEW) | 3 | 16 | Complete |
| activities/ (Session 9a NEW) | 5 | 51 | Complete |
| **Total** | **49 functions + 32 named constants** | **312 tests** | |

GitHub: cmccarter-maker/lc6, last commit 9e1c876 (Session 9a).

**Session 9b begins when Christian provides the opening scope statement.**
