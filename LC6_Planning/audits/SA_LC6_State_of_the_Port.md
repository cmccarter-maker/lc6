# SA_LC6_State_of_the_Port

**Session:** SessionA (LC6 State-of-the-Port audit)
**Authored by:** Chat
**Date:** April 23, 2026
**HEAD:** `ccd7995` (post-S31 close, branch `session-13-phy-humid-v2` pushed to origin)
**Test suite state:** 687 passed, 7 skipped, 0 failed (skips per `S31-PHASE-C-REBASELINE`)
**Scope:** Cross-sectional snapshot of LC6 code artifacts with honest port status. Output A of the SessionA kickoff. Catalog only — no proposals, no infrastructure fixes, no spec revisions. Those are Sessions B and C.

---

## 1. Status vocabulary legend

Six statuses from the original SessionA kickoff plus three added during S31 and this session:

| Status | Meaning |
|---|---|
| ACTIVE | Runs and produces verified sensible output. Test coverage exists (direct or sibling-integration). |
| PARTIAL | Runs but has known gaps, underestimation, or missing pieces. |
| SKELETON | File/function exists but body is stub/placeholder. |
| NULL-PLUGGED | Wiring exists but the passed value is hardcoded `null` or default with a TODO marker at the call site. Example: `evaluate.ts:497` `ventEvents: null`. |
| MISSING | Referenced elsewhere (imports, comments, docs) but does not exist. |
| UNKNOWN | Cannot verify from audit alone — needs deeper investigation. |
| SEMANTICALLY-STUBBED | A function runs and returns a value, but the value is an object-spread of another function's output with a flag flipped. Returns plausible-looking output; output is semantically wrong. Example: `evaluate.ts:266-271` `+Pacing` and `Best Outcome` pills are spreads of `Your Gear` and `Optimal Gear` with `uses_pacing: true`. Added during S31 audit. |
| STRUCT-ZERO-PADDED | A function returns a structured object where one or more fields are populated with literal zero / empty-array / trivial placeholder values because the logic to compute them was scoped to a deferred session. Distinct from NULL-PLUGGED (field-set inside a struct vs. one wire). Distinct from SEMANTICALLY-STUBBED (fields never computed vs. spread of another function). Example: `evaluate.ts:605-740` TrajectoryPoint emits ~12 heat-balance fields (`M`, `W`, `C`, `R`, `E_resp`, `E_skin`, `E_max`, `E_req`, `h_c`, `h_mass`, `P_a`, `R_e_cl_effective`, `VPD`) as literal `0` with `TODO-SUPPLEMENTARY` markers. Formalized in SessionA amendment addendum #1. |
| ACTIVE-AT-CALLER-BOUNDARY | A module is not imported by its natural caller but is invoked indirectly via input-parameter construction at the caller's caller. Runs in production but has no unit-level isolation. Example: `strategy/enumerateCandidates` is re-exported publicly from `index.ts:211-212` but not imported inside `evaluate.ts`; strategy enumeration happens upstream and is passed in via `EngineInput.strategy_candidates`. Ad-hoc term used in this audit pending SessionB review. |

**Proposed but not ratified:** `GHOST-PACKAGE` as a sibling to SKELETON for entire-directory-scope placeholder packages (e.g., `@lc6/gear-api`, `@lc6/shared`). Surfaced in this audit; Christian's call at midpoint check-in whether to formalize. Not used in status columns below — those use SKELETON with footnote.

---

## 2. Infrastructure-level findings

Seven findings at the repo/architecture layer, not at the per-module layer.

### 2.1 File-header scope comments are unreliable as completion signal

**Evidence:** `calc_intermittent_moisture.ts:6-7` header says "SESSION 9b SCOPE: Cyclic path only. Steady-state and linear paths stubbed (β1 throw)." Investigation (Step 9b) confirmed both paths are in fact implemented. Linear at `:1338` (self-contained port). Steady-state at `:313` (PHY-039B fallback). Header was never updated after the port landed.

**Implication:** For any engine file, file-header scope statements cannot be trusted as current. SessionA had to read dispatch code to determine completion status. Similar headers may exist in other files that are also stale.

**Related tracker update:** `S9C-HEADER-COMMENT-STALE` (replaces the provisional `S9C-SCOPE-UNRESOLVED` from amendment addendum #1). Text in §6 below.

### 2.2 DRIFT-family pattern reaffirmed — ratified-by-comment-only

**Evidence:** `calc_intermittent_moisture.ts:317` contains the only reference to "PHY-039B" in the engine codebase. No spec file exists at `LC6_Planning/specs/`. No row in the Spec Registry. ~95 lines of live physics (sweat rate, VPD evaporation, drain, cap enforcement, precip wetting, vent events, elevation walking) govern activities that resolve to the steady-state fallback (bouldering, camping, likely climbing, hunting, skateboarding, onewheel, cross_country_ski, golf generic).

**Implication:** This is a DRIFT-4 analog to the pre-S28 PHY-031 situation (physics implemented, cited by comment, spec never written). Second confirmed instance of the pattern. Pattern is recurring, not a one-off.

**Related tracker update:** `PHY-039B-NO-SPEC` MEDIUM. Text in §6 below.

### 2.3 Ghost packages — @lc6/gear-api and @lc6/shared

**Evidence:** Both packages consist of a single `src/index.ts` file exporting only a version constant. Zero consumers across the monorepo. Zero tests. `package.json` declares `"test": "echo ... no tests yet"` as self-documenting no-op. No tracker entries naming scheduling or owner.

| Package | src/index.ts | Consumers | Tests | Intent per header |
|---|---|---|---|---|
| `@lc6/gear-api` | 2 lines, exports `GEAR_API_VERSION = '0.1.0'` | 0 | 0 | "placeholder. Implementation in later session" |
| `@lc6/shared` | 2 lines, exports `SHARED_VERSION = '0.1.0'` | 0 | 0 | "cross-package types placeholder" |

Real implementations of both nominal concerns live inside `@lc6/engine`:
- Gear DB adapter: `packages/engine/src/gear/adapter.ts` (471 lines)
- Cross-package types: `packages/engine/src/types.ts` (653 lines)

**Implication:** Both packages are scaffolded placeholders whose scheduled fill-in is untracked. Indistinguishable from forgotten scaffolding. Pattern candidate for new vocabulary term (`GHOST-PACKAGE`) — deferred to Christian at midpoint.

**Related tracker update:** `GHOST-PACKAGES-AND-MISSING-API` LOW-to-MEDIUM. Text in §6 below.

### 2.4 `apps/api/` is absent, not ghost

**Evidence:** `ls apps/` returns only `web/`. No `apps/api/` directory exists. Not a ghost package (which has scaffolding); this is a pre-scaffolding state. Notable because `@lc6/gear-api`'s name suggests an eventual REST API layer for a UI backend, which would naturally pair with an `apps/api/` — the pair is absent together.

**Implication:** Server/API work is entirely unstarted. If `@lc6/gear-api` is meant to supply that layer, both need simultaneous decision. If not, `@lc6/gear-api` has no clear future purpose.

### 2.5 `apps/web/` framework decision missing — pre-decisional, not deferred

**Evidence:** `apps/web/src/index.ts` is 1 line (single comment, no exports). `package.json` devDependencies contain only `typescript` — no React, no Vue, no Svelte, no framework-of-any-kind. No `next.config`, no `vite.config`, no `webpack.config`. The app has not chosen a framework.

**Implication:** Distinct from `gear-api`/`shared` ghost packages which are at least nominally scoped. `apps/web` has no framework commitment at all. This is upstream of SKELETON — closer to SCAFFOLDED-EMPTY.

**This resolves a latent question from §2.6 below.**

### 2.6 STRUCT-ZERO-PADDED + SEMANTICALLY-STUBBED patterns have no live consumer — latent harm only

**Evidence:** `apps/web` contains zero `@lc6/engine` imports. Zero TrajectoryPoint field reads. Zero pill-rendering references (`pill_id`, `uses_pacing`, `four_pill`). No other consumer exists in the monorepo.

**Implication:** The STRUCT-ZERO-PADDED TrajectoryPoint fields and SEMANTICALLY-STUBBED `+Pacing`/`Best Outcome` pills are emitted by the engine but read by nothing. Latent risk only — when UI work eventually begins, these will display as literal `0 W` / duplicate-MR pills unless the engine pathologies are resolved first. Changes the urgency framing of `S10B-SCOPE-UNRESOLVED` from MEDIUM-with-active-risk to LOW-until-UI-session.

**Related tracker update:** `S10B-SCOPE-UNRESOLVED` severity note. Text in §6 below.

### 2.7 `LC6_Working_Agreement.md` is absent

**Evidence:** Original kickoff §Required-reads listed it conditionally ("if present"). Not present as of HEAD `ccd7995`.

**Implication:** Session protocol (two-agent discipline, Cardinal Rules, halt-and-escalate, tracker canonical) is scattered across memory entries, spec §0 conventions, and ad-hoc session kickoffs. No single governing document. SessionB infrastructure review territory.

---

## 3. Activity dispatch map

First-time-documented in LC6. The engine has three moisture-computation paths dispatched by `profile.type` (or profile absence). This table maps each activity to its actual runtime path.

| Path | Trigger | Location | Activities |
|---|---|---|---|
| cyclic | `profile.type === 'cyclic'` | `calc_intermittent_moisture.ts:503` | All resort ski terrains (groomers, moguls, trees, bowls, park); fishing_shore, fishing_wading (keyed by wading flag); kayaking_creek, kayaking_lake, kayaking_ocean; sup_lake, sup_ocean; golf_walk, golf_cart |
| cyclic (synthesized) | No intermittent profile; activity in `_continuousActivities` at `:297-310` | `:297-310` wraps as `{run 55, rest 5}` `'cyclic'` | day_hike, backpacking, running, mountain_biking, trail_running, hiking |
| linear | `profile.type === 'linear'` | `:1338` (self-contained port, LC5 tail-reference bug explicitly avoided per `:1341-1342` comment) | skiing_bc (backcountry/splitboard); snowshoeing; cross_country_ski presumed (routes through shared linear profile logic) |
| steady-state | `profile === null` after dispatch failure | `:313` (PHY-039B fallback) | bouldering, camping, likely climbing, hunting, skateboarding, onewheel, golf (generic, when no walk/cart distinction) |
| throw | Unknown `profile.type` string | `:1397` `throw new Error('Unknown profile type: ...')` | None currently defined. Defensive guard only. |

**Note on terminology:** Per OQ-029 nomenclature, `'cyclic'` in this context means "duty-cycle modeled" (run/work phases alternating with rest phases), not strictly "lap-based." This is why non-ski continuous activities (day_hike, running) route through cyclic-synthesized with a `{55, 5}` cycle — they're modeled as duty-cycled even though the user isn't doing laps.

**Implication for other audit rows:** The `calc_intermittent_moisture.ts` status is ACTIVE for the cyclic path (S31-verified) and ACTIVE for the linear and steady-state paths (Step 9b verified both are implemented). The stale header comment at `:6-7` is the only evidence of incompleteness, and it is in fact stale per §2.1.

---

## 4. Package tables

Four packages audited. Order: engine (largest, most substantive), then the three placeholder packages.

### 4.1 `packages/engine/` — LC6 thermal physics core

**Snapshot:** 47 source `.ts` files, 51 test `.test.ts` files, 8,788 total source lines. 9 subdirectories + 4 top-level files. LC5 origin: most content ports from the LC5 Babel Block structure (memory #22) into TypeScript subdirectories.

| Module / Subsystem | Status | Evidence | LC5 origin | Gap | Owner session |
|---|---|---|---|---|---|
| `moisture/calc_intermittent_moisture.ts` (1,399 lines) | ACTIVE (all three paths) | S31 Phase C `c553621`; Step 9b confirmed cyclic (`:503`), linear (`:1338`), steady-state (`:313`) all implemented; dispatch map in §3 | LC5 Babel Block 1 risk_functions.js (calcIntermittentMoisture — single source of truth per memory #18) | File-header comment at `:6-7` is stale per §2.1. `S9C-HEADER-COMMENT-STALE`. Line 1158 creek-kayak conditional behind `typeof` guards — safely inactive SKELETON sub-feature. | S31 (cyclic); pre-S31 (linear, steady-state) |
| `moisture/` subsystem (6 src, 5 test) | ACTIVE | S31 spec v1.2 ratified; Phases A/B/C green | LC5 risk_functions.js moisture logic | None beyond the header-stale note | — |
| `evaluate.ts` (1,240 lines) — overall | PARTIAL | `evaluate.ts:10` header: "Session 10a scope: Steps 1-4 … Steps 5-8: placeholders for Session 10b." Three distinct pathological sub-rows below. | LC5 strategy pill construction logic | Session 10b completion unverified; `S10B-SCOPE-UNRESOLVED` | Session 10b (unscheduled) |
| `evaluate.ts` pill construction (`:266-271`) | SEMANTICALLY-STUBBED | Two object-spread-with-flag sites. `+Pacing` pill is `{ ...userResult, pill_id: 'pacing', uses_pacing: true }`. `Best Outcome` pill is `{ ...winnerResult, pill_id: 'best_outcome', uses_pacing: true }`. `uses_pacing: true` flag set but no pacing physics applied. | LC5 4-pill presentation | Latent-only per §2.6. Activates when UI consumes pill outputs. | Future session to close precognition → pacing loop |
| `evaluate.ts:487` ventEvents parameter | NULL-PLUGGED | `ventEvents: null` with TODO-10b marker. Spec v1.2 §11.3 explicitly scopes this as out-of-S31. | N/A (LC5 pacing was different architecture) | Wiring `identifyCriticalMoments` → `ventEvents` is the future session | Future session, same as pill-close |
| `evaluate.ts` TrajectoryPoint fields (`:605-740`) | STRUCT-ZERO-PADDED | ~12 fields emit as literal `0` with TODO-SUPPLEMENTARY markers: `M`, `W`, `C`, `R`, `E_resp`, `E_skin`, `E_max`, `E_req`, `h_c`, `h_mass`, `P_a`, `R_e_cl_effective`, `VPD`. `sweat_rate` at `:609` is `S_heat > 0 ? 0.01 : 0; // crude placeholder`. `T_cl` at `:712` is `T_skin - 2`. `h_tissue` at `:713` is vasoconstriction-conditional 5.0/9.0. | Session 10a deferred to 10b per `:10` header | Latent-only per §2.6. | Session 10b |
| `cdi/` (5 src, 0 direct test) | ACTIVE (indirect coverage) | Imported by `evaluate.ts:65`; called at `:649` `detectStage(stageInput)`. Indirect test coverage via `tests/stage_detector/edge_cases.test.ts` + `tests/vectors/cdi_v14_vectors.test.ts`. | LC5 CDI (Core Dependency Index) — one of three engine outputs MR/HLR/CDI per memory #21 | No dedicated `tests/cdi/` directory despite CDI being 1/3 of the core outputs | Pre-S29 baseline; no dedicated test session |
| `strategy/` (2 src, 0 test) | ACTIVE-AT-CALLER-BOUNDARY | Re-exported publicly from `index.ts:211-212` (`enumerateCandidates`). Not imported by `evaluate.ts` internally. S31 probe test exercised strategy engine via `evaluate()` with `EngineInput.strategy_candidates` pre-populated — enumeration happens at caller boundary. | LC5 strategy engine (Data Block F per memory #22) | No unit tests on public API `enumerateCandidates`. Per `S31-OBSERVATION-WINNER-INVARIANCE`: same winner selected across G1/M2/P5 (different terrain/ambient) — scenario-sensitivity unverified. | Future investigation per tracker item |
| `scheduling/` (2 src, 1 test) | ACTIVE | `precognitive_cm.ts` + `index.ts`. Imported by `evaluate.ts:42`; invoked at `:283` (`identifyCriticalMoments`, `buildStrategyWindows`). PHY-072 landed Session 10. | LC5 precognitive critical moments work | Output is returned on `EngineOutput` (Critical Moments, Strategy Windows) but NOT fed back into engine as `ventEvents` (that's the `:487` null-plug — out-of-S31 per spec v1.2 §11.3) | Future session to close the loop |
| `heat_balance/` (11 src, 13 test) | ACTIVE | Over-tested: 4 test files are function-named rather than file-named integration tests (`dubois_bsa.test.ts` tests `body_thermo.js`; `elev_temp_adj.test.ts` tests `altitude.js`; `magnus_dewpoint.test.ts`; `metabolic_efficiency.test.ts` tests `metabolism.js`). All 11 src files covered. | LC5 Castellani/Fudge/Woodcock/ISO 9920 primitives | Test-file naming convention mismatch with src-file names is minor audit-surface cleanliness only, not a functional gap | — |
| `ireq/` (6 src, 3 test) | ACTIVE | IREQ Block 1 closed April 10, memory #16. Validated vs Angelova 2017 Table 2 (Case 3 PASS 20/20 ±0.1 clo gate). | d'Ambrosio 2025 Appendix B.1/B.2 port | Block 3 (18-activity curves) pending per memory #16. Block 2/3 not yet in LC6. TA/ATP/Overview/slide-deck doc propagation pending. | Future IREQ sessions |
| `activities/` (6 src, 5 test) | ACTIVE | PHY-031 port shipped S29; S31 Phase B added `LINE_MET`, `TRANSITION_MET` to `phy031_constants.ts`. | LC5 activity profiles | None | S29, S31 |
| `ensemble/` (4 src, 3 test) | ACTIVE | S31 probe test exercised `EngineGearItem`/`GearEnsemble` shapes successfully | LC5 ensemble utilities | None | — |
| `gear/` (2 src, 1 test) | ACTIVE | S31 probe test exercised gear attribute lookups | LC5 gear attribute helpers | None | — |
| `types.ts` (653 lines) | ACTIVE (with one SKELETON sub-section) | S31 Phase C added `lunch?`, `otherBreak?` to `CycleOverride`. `:411` comment: "Overlays (placeholders) — Architecture v1.1 §4.5." | LC5 types scattered across Data blocks | Architecture v1.1 §4.5 overlay placeholders — status unverified, likely SKELETON | Future: verify v1.1 §4.5 overlay status |
| `validate.ts` | ACTIVE | S29 Patch 5 added `date_iso` runtime validation. S29-followup commits `1b0c80e` + `78cd56a` fixed missed fixture sites. | LC5 ad-hoc validation | Runtime validation not comprehensive — S31 pre-flight surfaced 26 test fails from one missed fixture. Ongoing coverage gap as validation requirements expand. | Ongoing |
| `index.ts` | ACTIVE | Public API barrel. `:26` cdi re-exports; `:211-212` strategy re-exports. | — | No unit tests expected for a barrel file | — |

**Infrastructure notes for engine package:**
- No dedicated `tests/cdi/` directory despite CDI being a named engine output.
- No unit tests on `strategy/enumerateCandidates` public API — coverage is integration-path only.
- Sessions 9c and 10b are referenced in source comments but have no tracker entries. `S9C-HEADER-COMMENT-STALE` and `S10B-SCOPE-UNRESOLVED` address this.

### 4.2 `packages/gear-api/`

| Module / file | Status | Evidence | LC5 origin | Gap | Owner |
|---|---|---|---|---|---|
| `src/index.ts` | SKELETON¹ | 2 lines total. Sole content: `export const GEAR_API_VERSION = '0.1.0';` with header comment "placeholder. Implementation in later session." Zero consumers across `packages/` + `apps/`. No `tests/` directory. `package.json` declares `"test": "echo 'gear-api: no tests yet'"`. | N/A (new scaffolding, no LC5 port — real gear DB adapter logic lives in `packages/engine/src/gear/adapter.ts`, 471 lines) | Entire package is a namespace placeholder. Zero consumers. The "later session" reference has no tracker entry or visible scheduling. Name suggests a REST API layer for the absent `apps/api/` — unstarted paired work. | Session unknown |

¹ Candidate for proposed `GHOST-PACKAGE` vocabulary term — see §7 midpoint question.

### 4.3 `packages/shared/`

| Module / file | Status | Evidence | LC5 origin | Gap | Owner |
|---|---|---|---|---|---|
| `src/index.ts` | SKELETON¹ | 2 lines total. Sole content: `export const SHARED_VERSION = '0.1.0';` with header comment "cross-package types placeholder." Zero consumers. No `tests/` directory. Same self-documenting `"test": "echo ..."` no-op pattern as gear-api. | N/A (new scaffolding. Actual cross-package types live at `packages/engine/src/types.ts`, 653 lines) | Entire package is a namespace placeholder for "cross-package types." Real cross-package types have settled inside engine and are not being extracted. No scheduling or tracker entry names when or whether the extraction happens. | Session unknown |

¹ Same vocabulary candidate flag as 4.2.

### 4.4 `apps/web/`

| Module / file | Status | Evidence | LC5 origin | Gap | Owner |
|---|---|---|---|---|---|
| `src/index.ts` | SKELETON² (thinnest — pre-decisional) | 1 line. Single comment: "LC6 web app — placeholder. Implementation in later session." No exports. No imports. `package.json` devDependencies: `typescript` only — no React/Vue/Svelte/any framework. No `next.config*`, `vite.config*`, `webpack.config*`. Zero `@lc6/engine` imports. Zero TrajectoryPoint field reads. Zero pill-rendering references. | N/A — pre-port scaffolding. LC5 UI logic in LC5 `phase1_components.jsx` and related Babel blocks not yet ported. | Entire package is a single header comment. Framework decision missing (not deferred — pre-decisional per §2.5). No integration path to the engine. No tracker entry names when or how the UI work starts. | Session unknown |

² Candidate for `SCAFFOLDED-EMPTY` as an even-thinner variant of SKELETON — flagged but not proposed as formal vocabulary; SKELETON with footnote is sufficient for this audit.

---

## 5. Test coverage summary

| Package | src files | test files | Δ | Notes |
|---|---|---|---|---|
| `packages/engine` | 47 | 51 | +4 | Heat-balance over-tested by +2 (function-named integration tests); `cdi/` and `strategy/` under-tested (0 direct) |
| `packages/gear-api` | 1 | 0 | −1 | `"test": "echo ..."` no-op |
| `packages/shared` | 1 | 0 | −1 | `"test": "echo ..."` no-op |
| `apps/web` | 1 | 0 | −1 | No test tooling configured |
| **Total** | **50** | **51** | — | Engine-dominated |

Test volume is essentially engine-only. The three placeholder packages + web app contribute zero tests.

---

## 6. Tracker-item updates

Four updates, with verbatim text for pasting into `LC6_Master_Tracking.md` at SessionA close.

### 6.1 Replace `S9C-SCOPE-UNRESOLVED` (amendment addendum #1) with `S9C-HEADER-COMMENT-STALE`

Original (amendment addendum #1) assumed paths were β1-throwing. Step 9b proved otherwise. Replacement:

> **`S9C-HEADER-COMMENT-STALE`** LOW — `calc_intermittent_moisture.ts:6-7` and `:228-229` header comments claim "β1 throw" for steady-state and linear paths, but both paths are fully implemented (`:313` steady-state PHY-039B, `:1338` linear self-contained port). Session 9c (or an intervening session) landed the work; the file header was never updated. Cleanup: amend header text to reflect current state. **Infrastructure implication:** file-header scope comments proved unreliable in at least one engine file; SessionB consideration of whether scope claims belong in file headers at all. Audit for other stale session-scope headers.

### 6.2 New item — `PHY-039B-NO-SPEC`

> **`PHY-039B-NO-SPEC`** MEDIUM — Steady-state moisture path at `calc_intermittent_moisture.ts:313-~408` is ~95 lines of live physics (sweat rate, VPD evaporation, drain, cap enforcement, precip wetting, vent events, elevation profile walking) labeled `STEADY-STATE FALLBACK (PHY-039B, self-contained)` in a single inline code comment. **No LC6 spec file exists.** No Spec Registry row. DRIFT-4 analog to pre-S28 PHY-031 situation (physics shipped by comment citation only). Serves activities resolving to `profile = null` — at minimum bouldering, camping (from S31 baseline audit); likely also climbing, hunting, skateboarding, onewheel, cross_country_ski, golf (generic). Prioritize for SessionB (or a dedicated `PHY-039B-RATIFICATION` session) given the activity coverage.

### 6.3 Update `S10B-SCOPE-UNRESOLVED` — severity note

Original severity framing in amendment addendum #1 was "If consumed by any live code path, zero-display risk." Step 12 confirmed no current consumer. Amended:

> **`S10B-SCOPE-UNRESOLVED`** LOW-UNTIL-UI — Session 10b scope referenced in `evaluate.ts:10` header comment ("Steps 5-8: placeholders for Session 10b") has no tracker entry and unverified completion status. Symptom: ~12 TrajectoryPoint fields in `evaluate.ts:605-740` return as literal-0 (STRUCT-ZERO-PADDED). **Current status: latent only.** `apps/web` contains zero `@lc6/engine` imports and zero TrajectoryPoint field reads; no other consumer exists in the monorepo. Zero-display risk activates when UI work begins (likely first session that imports engine into `apps/web`). Priority reconsiders at that transition.

### 6.4 New item — `GHOST-PACKAGES-AND-MISSING-API`

> **`GHOST-PACKAGES-AND-MISSING-API`** LOW-TO-MEDIUM — Three related architectural placeholders: (1) `@lc6/gear-api` is a 2-line version-only export with 0 consumers, 0 tests, no scheduling. (2) `@lc6/shared` is the same pattern (2-line version-only, 0 consumers, 0 tests). (3) `apps/api/` directory does not exist at all (not scaffolded). Real implementations of gear-api's nominal concern (gear DB adapter) and shared's (cross-package types) currently live inside `@lc6/engine`. Decide at SessionB or later: fill per original extraction intent, absorb into engine permanently, or delete. Not urgent — no active harm. Pair decision: if `gear-api` is intended as REST API for `apps/api/`, both start together.

---

## 7. Midpoint decisions — resolved

Three decisions posed at SessionA midpoint, resolved by Christian on 2026-04-23. Recorded here for audit traceability.

### 7.1 GHOST-PACKAGE vocabulary formalization — RESOLVED: (b)

Two packages (`@lc6/gear-api`, `@lc6/shared`) + one pre-scaffold absence (`apps/api/`) constitute a pattern distinct from SKELETON. SKELETON within a populated module has a natural owner; GHOST-PACKAGE is entire-directory-scope orphaned work that might not belong in the repo at all.

**Options:**
- **(a)** Formalize `GHOST-PACKAGE` as new vocabulary in SessionA amendment addendum #2
- **(b)** Keep as SKELETON with footnote; address naming at Session B/C
- **(c)** Decide based on whether more instances surface in SessionB's infrastructure review

**Chat recommendation:** (b) for SessionA; defer formal vocabulary decision to SessionB. Three instances is pattern-suggestive but not pattern-saturated. Sub-category naming risks premature vocabulary proliferation.

**Christian decision:** (b). Keep as SKELETON with footnote throughout SessionA. Vocabulary decision deferred to SessionB's infrastructure review.

### 7.2 `FABRICATED-METHODOLOGY` failure category for Output B — RESOLVED: YES

During Step 12 authoring, Chat invented a "≤5 / 5-20 / 20+" file-count decision rule with no justification — same pattern as S31-A's synthesized gear values. Christian caught this mid-turn.

This suggests the `UNRATIFIED-INVENTION` category from the original amendment may not cover non-spec contexts. Chat-invented audit thresholds, process rules, decision trees are the same failure pattern surfaced in a different domain.

**Proposal for Output B:** add `FABRICATED-METHODOLOGY` as a sibling category to `UNRATIFIED-INVENTION`. Former covers process/methodology fabrication; latter covers spec/data fabrication. Both instances from this session:
- S31-A: synthesized gear values (UNRATIFIED-INVENTION — spec domain)
- SA-methodology: invented file-count decision rule (FABRICATED-METHODOLOGY — process domain)

Christian's call on whether to proceed with this distinction in Output B, or fold both under a single umbrella.

**Christian decision:** YES. `FABRICATED-METHODOLOGY` is a distinct category in Output B, sibling to `UNRATIFIED-INVENTION`. Distinction rationale: different remediation paths (methodology fabrication is prevented by read-before-structure discipline; data fabrication is prevented by DB-binding discipline).

### 7.3 S31-B / S31-D consolidation — RESOLVED: CONSOLIDATE

Amendment addendum #1 proposed 5 S31 incidents for Output B (S31-A through S31-E). Two of them — S31-B ("architecture theorizing instead of reading code") and S31-D ("pacing-isn't-in-calcInt claim without reading") — are the same underlying pattern surfaced in adjacent turns. Could consolidate into single incident "S31-BD" or keep separate for pattern-density signal.

**Chat recommendation:** consolidate. Same failure mode, adjacent timing, single fix path (read-before-claim rule). Separate accounting inflates the pattern's apparent frequency without adding signal.

**Christian decision:** CONSOLIDATE. Output B references the consolidated incident as `S31-BD` (architecture theorizing + factual claim without reading code). Four S31 incidents total in Output B: S31-A, S31-BD (consolidated), S31-C, S31-E.

---

## 8. What Output A is NOT

Per kickoff §What-this-session-is-NOT:

- **Not a proposal.** Findings are cataloged; fixes are SessionB and beyond.
- **Not a handoff redesign.** SessionC's job.
- **Not a scope for infrastructure fixes.** SessionB decides what to fix based on Output B's failure patterns.
- **Not a re-opening of S-001.** MR-fidelity work arc is a separate track.
- **Not a rewrite of any spec.** PHY-031-CYCLEMIN-RECONCILIATION v1.2, PHY-031 v1, all others remain ratified as-is.

If Output B authoring surfaces a finding that requires SessionA Output A to be revised, that's a re-open trigger; otherwise Output A is the final SessionA state-of-the-port snapshot at HEAD `ccd7995`.

---

## 9. Handoff to Output B

Output A surfaces four new tracker items; three midpoint decisions resolved per §7. Output B (failure-mode catalog) begins with:

- Four S31-sourced incidents: S31-A, S31-BD (consolidated from prior S31-B + S31-D), S31-C, S31-E
- This session's FABRICATED-METHODOLOGY instance (mid-audit file-count decision rule)
- Incidents from session ledgers, tracker drift items, and prior redirects per kickoff §Output-B-sources

Estimated incident count: 15-20 concrete instances, saturation likely before 30 per OQ4 default.

Output B is Chat-authored verbatim per Memory #13 two-agent discipline. Code receives the finished document and performs file operations only.

---

**END SA_LC6_State_of_the_Port.**
