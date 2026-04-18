# LC6 Master Tracking

> **CARDINAL RULE (Memory #30): This file is the canonical source of all open issues, fudge factors, and architectural debt for LC6.** Memory is advisory, this file is canonical. If something isn't here, it isn't tracked.

> **SESSION RITUAL (inviolable):**
> - **OPEN:** `cat LC6_Planning/LC6_Master_Tracking.md | head -100` before any other action. State today's target.
> - **DURING:** Any "defer/flag/later" item added IMMEDIATELY (not at close).
> - **CLOSE:** RECONCILE — review entire Section B and F. Move resolved items B→F. Mark obsolete. Update priority if changed. Run Section G verification grep. Commit tracker as part of session commit.

> **CRITICAL ANTI-PATTERN:** Close-out scripts NEVER use fuzzy idempotency checks. `if "Session 13" not in content:` silently fails when "Session 13" appears in handoff notes from Session 12. Use exact-match grep or explicit overwrite only.

---

## Status as of Session 13 close (pending successful commit)

**Branch:** `session-13-phy-humid-v2` (Phase 1 pushed; Session 13 audit + this tracker not yet committed)
**Working tree dirty:** `packages/engine/src/moisture/calc_intermittent_moisture.ts` (Phase 2+3 edits uncommitted)
**Untracked file:** `v1.3,` (suspicious; investigate before next work)
**Test count:** 636 passing on committed code; Phase 2+3 produces 13 directionally-correct test failures expected after ratification of PHY-PERCEIVED-MR-REDESIGN

**Session 13 silent failures pending repair:**
- `DEC-MOISTURE-OUTPUT-AUDIT` never written to Decision Registry (grep returns 0)
- Session 13 Session Ledger entry never written (fuzzy idempotency match on Session 12 handoff notes)
- `LC6_Planning/specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v0_DRAFT.md` never created
- `LC6_Planning/audits/` directory doesn't exist; `MOISTURE_OUTPUT_AUDIT_S13.md` never copied

All repaired as part of the same commit that writes this tracker.

---

## Section A: Active Specs

| Spec ID | Version | Status | Raised | File | Notes |
|---|---|---|---|---|---|
| PHY-GEAR-01 | v2 | RATIFIED + IMPLEMENTED | S11 | specs/PHY-GEAR-01_Spec_v2_RATIFIED.md | 1,627-product catalog live |
| PHY-HUMID-01 | v2 | RATIFIED, PARTIALLY IMPLEMENTED | S12 | specs/PHY-HUMID-01_Spec_v2_RATIFIED.md | Phase 1 shipped e9d56b5; Phase 2+3 held (working tree dirty) |
| PHY-PERCEIVED-MR-REDESIGN | v0 | DRAFT (to be written) | S13 | specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v0_DRAFT.md | 3 fudge factors in perceived_mr.ts |

---

## Section B: Open Issues — ALL Active Items

### B.1 Architecture Document §11 deferred items (pre-Session 5, mostly unaddressed)

| ID | Priority | Status | Notes |
|---|---|---|---|
| ARCH-FALL-IN-V2 | MEDIUM | Open | Fall-In v2 Redesign Spec — Giesbrecht 1-10-1 + handoff per Architecture §2 `overlays/fall_in.ts` (empty dir) |
| ARCH-T-MRT-V2 | LOW | Open | Full T_mrt radiant temperature model; v1 uses T_mrt = T_air |
| ARCH-GEAR-DB-API-MIGRATION | LOW | Open | Gear DB API migration v1.x — possibly a gear-api backend service (separate from PHY-GEAR-01 adapter) |
| ARCH-Q-SHIVER-SCENARIO-B | MEDIUM | Open | Q_shiver parameter validation against USARIEM SCENARIO-B tables |
| ARCH-OQ-024-LC5-GREP | LOW | Open | Lower-priority LC5 code verification grep |
| ARCH-OQ-027-LC5-GREP | LOW | Open | Lower-priority LC5 code verification grep |

### B.2 Session 4 carryforward (pre-LC6 session closures)

| ID | Priority | Status | Notes |
|---|---|---|---|
| STAGE-TAU-MAX | GAP-FLAGGED | Open | `stage_τ_max` per-stage values; validate via SCENARIO-B + ISO 11079 DLE comparison at engine integration |
| STAGE-PROMOTION-15MIN | LOW | Open | 15-min stage promotion threshold tunability per stage |
| Q-SHIVER-50W-THRESHOLD | LOW | Open | Q_shiver_sustained 50W threshold alternative (percentile-of-Q_shiver_max) |
| HEAT-SIDE-SWEAT-DETECTION | MEDIUM | Open | Heat-side direct sweat-rate stage detection if T_core proves too lagging |

### B.3 Sessions 6-9c build-phase deferrals

| ID | Priority | Status | Notes |
|---|---|---|---|
| OQ-028 | MEDIUM | Open | Standardize all heat-balance and ensemble functions to °F input convention. Dedicated session. |
| OQ-029 | LOW | Open | `type:'cyclic'` → `'phased'` nomenclature reconciliation. Half-session rename + docs. |
| ITER-TSKIN-WARM-REST-NON-CONVERGENCE | LOW | Open (locked-in as expected behavior) | iterativeTSkin warm_rest_light doesn't converge in 8 iterations; whether to investigate or expand maxIter is deferred |

### B.4 Session 11 PHY-GEAR-01 follow-ups

| ID | Priority | Status | Notes |
|---|---|---|---|
| OQ-REGIONAL-MR | HIGH | Open | Upper vs lower body MR reconciliation; blocks PHY-INFOGRAPHIC-01 and affects EngineOutput contract |
| PHY-IMMERSION-01 | LOW | Open | Port LC5 WADER/WETSUIT/IMMERSION_SHIELD tables; activates immersion slot |
| PHY-GEAR-PEER-CAL | LOW (FROZEN) | Open | 7 peer-matching calibration constants empirical derivation |
| PHY-GEAR-WARMTH-CAL | LOW (FROZEN) | Open | warmthRatio→CLO breakpoints per ISO 15831 manikin |
| PHY-GEAR-BREATH-CAL | LOW (FROZEN) | Open | breathability→im slope/offset via Woodcock/Fukazawa |
| PHY-GEAR-02 | LOW | Open | score_products.js lower.insulation classification |
| PHY-GEAR-03 | LOW | Open | Gear catalog curation sweep |

### B.5 Session 12 PHY-HUMID-01 follow-ups

| ID | Priority | Status | Notes |
|---|---|---|---|
| PHY-SWEAT-UNIFICATION | MEDIUM | Open | Replace `rawTempMul` 5-step staircase at calc_intermittent_moisture.ts:453 with Gagge energy balance (fudge factor removal) |
| PHY-GRADE-01 | LOW | Open | Minetti GAP polynomial replacement for `_gradeMul` 4-step staircase at line 378 |
| PHY-HUMID-VENT-REWRITE | LOW | Open | `_ventHum` 3-step staircase at line 825 → VPD-derived effectiveness |
| PHY-HUMID-HUMMUL-CAL | LOW | Open | humMul 40% knee + 0.8 slope empirical validation (Nielsen & Endrusick 1990) |

### B.6 Session 12 forensic audit (Tier 4 constants)

| ID | Priority | Status | Notes |
|---|---|---|---|
| PHY-VENT-CONSTANTS | LOW | Open | `_ventArea=0.15`, `_ventCLOval=0.3`, `_ventDurMin=5` at calc_intermittent_moisture.ts:832-836 — calibration with no citation |

### B.7 Session 13 audit findings

| ID | Priority | Status | Notes |
|---|---|---|---|
| PHY-PR-COVERAGE-VAR | LOW | Open | Activity-specific torso coverage; default 0.54×BSA (long-sleeve, Rule of 9's); schema extension required for Option B |
| PHY-PR-CHILL-WEIGHT | MEDIUM | Open | Ensemble saturation combination weight (placeholder 0.5 in backward-compat wrapper); needs empirical data |
| PHY-EVAP-CAP-0.85 | MEDIUM | Open | Sci Foundations §3.3 0.85 evaporation rate cap; needs audit whether present in LC6 |
| PHY-HUMIDITY-FLOOR | MEDIUM | Open | Sci Foundations §3.4 `MR_floor = max(0, (H-60)/40)×4.0`; needs audit whether present in LC6 |
| PHY-COLD-PENALTY | MEDIUM | Open | Sci Foundations §3.2 `trapped×5 + cold_penalty` with f_suit=2.5; needs audit whether present in LC6 |
| PHY-COMPRESSION-CURVE | MEDIUM | Open | applySaturationCascade 6-cutoff quadratic ease; confirmed calibration, needs spec decision (keep/redesign) |

### B.8 Code-level TODO markers

| Location | Marker | Priority | Notes |
|---|---|---|---|
| evaluate.ts:386-387, 430 | TODO-10b (3 sites) | LOW | candidates_passing/total always 0; VentEvent[] not mapped |
| evaluate.ts:455, 884 | TODO: DEC-013 | MEDIUM | Stationary activity escalation not implemented |
| evaluate.ts:540, 543, 645-673 | TODO-SUPPLEMENTARY (12 sites) | LOW-MEDIUM | Heat balance primitives not populated in steady-state output |

### B.9 Empty-directory scaffolding (Architecture §2 promised, not implemented)

| ID | Priority | Status | Notes |
|---|---|---|---|
| EMPTY-DIR-HEAT-LOSS | LOW | Open | `packages/engine/src/heat_loss/` empty; contents unspecified in Architecture §2 |
| EMPTY-DIR-OVERLAYS | MEDIUM | Open | `packages/engine/src/overlays/` empty; promised `fall_in.ts` + `sleep_system.ts` per Architecture §2 (overlaps ARCH-FALL-IN-V2) |
| EMPTY-DIR-AGGREGATE | LOW | Open | `packages/engine/src/aggregate/` empty; promised `segment.ts` per-segment peak rollup |
| EMPTY-DIR-ACTIVITY-OBSOLETE | TRIVIAL | Open (cleanup) | `packages/engine/src/activity/` empty; superseded by `activities/` (plural) in Session 9a. Delete directory. |

### B.10 User memory architectural items ("must not get lost")

| ID | Priority | Status | Notes |
|---|---|---|---|
| ARCH-LAYER-2-PACING | HIGH | Open | **User flagged "MUST NOT GET LOST"** — precognition/path-optimal pacing within ensemble across time slices. DP over slices for optimal vent/break schedule. (Same item as Architecture §11 "Layer 2 Precognition v2") |
| ARCH-PHASE-1-CORRECTIVE | HIGH | Open | Phase 1-Corrective architecture (IREQ pre-filter → coherent candidate construction → ensemble heat balance). Locked Apr 9 but not yet designed. |
| ARCH-IREQ-BLOCK-2 | HIGH | Open | Port DLE_neu/DLE_min from d'Ambrosio 2025 Appendix B.3/B.4 |
| ARCH-IREQ-BLOCK-3 | MEDIUM | Open | 18-activity IREQ curves |
| PHY-VASO-CITATION | MEDIUM | Open | 33.0°C vasoconstriction threshold in code lacks specific citation (Flouris & Cheung 2008 supports CIVD at mean body temp 35.5°C, not 33.0°C skin) |
| DOC-TA-V7 | MEDIUM | Open | Technical Analysis v7.0 full rewrite with line-by-line citation verification (merges FUTURE_WORK P3) |
| DOC-ATP-V5 | MEDIUM | Open | ATP v5.0 full rewrite with hand-computed expected values (merges FUTURE_WORK P3) |

### B.11 FUTURE_WORK.md unresolved items

| ID | Priority | Status | Notes |
|---|---|---|---|
| PHY-NAN-HARDENING | MEDIUM | Open | Synthetic gear ensembles produce MR=NaN in cyclic path (real gear doesn't hit); defensive boundary hardening (originally FUTURE_WORK P2 + Session 11 handoff OQ #2) |
| UI-CM-DISPLAY | LOW (until UI phase) | Open | PHY-072 critical_moments + strategy_windows never wired to display (FUTURE_WORK P4) |

### B.12 Session 13 state items (to be resolved post-tracker commit)

| ID | Priority | Status | Notes |
|---|---|---|---|
| S13-PHASE-2-3-DIRTY | HIGH | Blocked on PHY-PERCEIVED-MR-REDESIGN ratification | Phase 2+3 edits in working tree; commit with redesign in Session 14 |
| S13-MISSING-SPEC-FILE | HIGH | To fix in close-out | `specs/PHY-PERCEIVED-MR-REDESIGN_Spec_v0_DRAFT.md` never written |
| S13-MISSING-AUDIT-FILE | HIGH | To fix in close-out | `audits/MOISTURE_OUTPUT_AUDIT_S13.md` never copied; `audits/` dir doesn't exist |
| S13-MISSING-DECISION-REG | HIGH | To fix in close-out | `DEC-MOISTURE-OUTPUT-AUDIT` never written (grep -c returns 0) |
| S13-MISSING-SESSION-LEDGER | HIGH | To fix in close-out | Session 13 entry never written (fuzzy idempotency silent skip) |
| UNTRACKED-FILE-V1.3 | LOW | Investigate | `v1.3,` appears in `git status --short`; suspicious filename |

### B.13 LC4 carryforward (LC6 will eventually include UI per Session 13 scope decision)

| ID | Priority | Status | Notes |
|---|---|---|---|
| BUG-132 | LOW | Open (LC4-surfaced) | Bouldering shows 0% saturation — physically correct but uninformative UX |
| BUG-HALFDOME-PERSTEPMR | MEDIUM | Open (LC4-surfaced) | Flat perStepMR on Half Dome trip |
| UI-KIRKWOOD-FIXES | LOW | Open (LC4-surfaced) | Fishing hourly pills, carry indicators, strip MR vs gauge MR mismatch, Step 4 Trip Summary Card |

---

## Section C: Known Fudge Factors / Cardinal Rule #1 Candidates

| Name | File:Line | Value | Status | Spec Addressing |
|---|---|---|---|---|
| PERCEIVED_WEIGHTS | moisture/perceived_mr.ts:15 | [3, 2, 1.5, 1] | FUDGE (direction cited, ratios uncited) | PHY-PERCEIVED-MR-REDESIGN |
| COMFORT_THRESHOLD | moisture/perceived_mr.ts:24 | 40 mL uniform | PARTIALLY CITED (Fukazawa 50g/m² yes; 0.8m² contact area no; not BSA-scaled) | PHY-PERCEIVED-MR-REDESIGN |
| MR output scaling | moisture/perceived_mr.ts:78 | × 7.2 | FUDGE (no citation) | PHY-PERCEIVED-MR-REDESIGN |
| Evaporation rate cap | TBD (audit needed) | 0.85 | CALIBRATION per Sci Foundations §3.3 | PHY-EVAP-CAP-0.85 |
| Humidity floor | TBD (audit needed) | (H-60)/40 × 4.0 | CALIBRATION per Sci Foundations §3.4 | PHY-HUMIDITY-FLOOR |
| Cold penalty | TBD (audit needed) | trapped×5 + (40-T)/10×f_suit | CALIBRATION per Sci Foundations §3.2 | PHY-COLD-PENALTY |
| Saturation cascade curve | moisture/saturation_cascade.ts | 6 cutoff + 6+4×(1-(1-(raw-6)/4)²) | CALIBRATION per Sci Foundations §3.5 | PHY-COMPRESSION-CURVE |
| rawTempMul staircase | moisture/calc_intermittent_moisture.ts:453 | 5-step temperature multiplier | No citation | PHY-SWEAT-UNIFICATION |
| _gradeMul staircase | moisture/calc_intermittent_moisture.ts:378 | 4-step grade multiplier | Minetti replacement pending | PHY-GRADE-01 |
| _ventHum staircase | moisture/calc_intermittent_moisture.ts:825 | 3-step humidity factor | VPD replacement pending | PHY-HUMID-VENT-REWRITE |
| humMul formula | moisture/calc_intermittent_moisture.ts:455 | 1 + max(H-40,0)/100×0.8 | Physiologically grounded; 40% knee + 0.8 slope are calibration | PHY-HUMID-HUMMUL-CAL |
| Vent constants | moisture/calc_intermittent_moisture.ts:832-836 | 0.15, 0.3, 5 | No citation | PHY-VENT-CONSTANTS |
| Vasoconstriction threshold | iterativeTSkin (heat_balance/) | 33.0°C | Citation ambiguity | PHY-VASO-CITATION |

---

## Section D: "Must Not Get Lost" Architectural Items

These are items where user has explicitly or implicitly flagged structural importance. They are NOT fudge factors — they are architectural decisions pending.

| ID | Description | User's words / source |
|---|---|---|
| ARCH-LAYER-2-PACING | Precognition/path-optimal pacing within ensemble across time slices. Engine aggregates peak slice heat balance and rejects on peak — doesn't simulate "vent at N, recover at N+1." Needs DP over slices: given ensemble + trip, find optimal vent/break schedule. | **User explicit: "must not get lost"** |
| ARCH-REGIONAL-MR | Upper vs lower body MR reconciliation. LC6 computes CLO/im as whole-body but moisture accumulates regionally. | Blocks PHY-INFOGRAPHIC-01 + affects EngineOutput contract. |
| ARCH-PHASE-1-CORRECTIVE | System-level evaluation of candidate ensembles via IREQ pre-filter, not per-slot picking. | User memory notes Claude has drifted to per-slot thinking 3+ times; active resistance required. |
| DOC-TA-V7, DOC-ATP-V5 | Line-by-line rewrites verifying every formula matches cited source (not addenda) | FUTURE_WORK P3 + user memory "on the horizon" |

---

## Section E: Work In Progress

### E.1 Dirty Working Tree

- **Branch:** `session-13-phy-humid-v2`
- **Modified:** `packages/engine/src/moisture/calc_intermittent_moisture.ts`
  - Phase 2: per-layer Magnus dew point at lines 736-744
  - Phase 3: three-category moisture routing (_vaporFabricG, _liquidAtSkinG, _ambientVaporG) at lines 747-825
- **Test impact:** 13 directional failures in moisture tests (matched to spec expectation)

### E.2 Branches

- `main` at 773f995 (Session 12 v2 ratification)
- `session-13-phy-humid-v2` at e9d56b5 (Phase 1 Magnus helpers); Phase 2+3 dirty beyond

### E.3 Known stale documents

- `README.md` references `LC6_Architecture_Document_v1.1_RATIFIED.md`; actual file is v1.2

### E.4 Planning docs under review

- `LC6_Decision_Registry.md` — missing Session 13 DEC entry (to fix in close-out)
- `LC6_Session_Ledger.md` — missing Session 13 entry (to fix in close-out)
- `LC6_Spec_Registry.md` — missing PHY-PERCEIVED-MR-REDESIGN draft entry (to fix in close-out)
- `LC6_Code_Change_Log.md` — missing Session 13 entry (to fix in close-out)

---

## Section F: Cancelled / Resolved (Historical Record)

| ID | Resolved | Notes |
|---|---|---|
| PHY-HUMID-EXCESS-CAL | S12 | CANCELLED — v1 `_excessRetention = 0.10` fudge withdrawn in v2; no coefficient to derive |
| PHY-SATURATION-CASCADE-REVIEW | S13 AM | Verdict: calibration per Sci Foundations §3.5, not physics novelty. Output-shaping. Subsumed by PHY-COMPRESSION-CURVE spec. |
| OQ-H3-HUMID-LOW-MR | S12 | DIAGNOSED; fix ratified in PHY-HUMID-01 v2. Validation pending Phase 2+3 commit. |
| FUTURE_WORK Priority 1 (Real Gear DB) | S11 | RESOLVED — PHY-GEAR-01 v2 shipped 1,627-product catalog |
| Activity Parameter Ratification (Architecture §11) | S9a | RESOLVED — ACTIVITY_SWEAT_PROFILES + INTERMITTENT_PHASE_PROFILES + GENERIC_GEAR_SCORES_BY_SLOT shipped with Option C citations |
| Wearable integration v2 (Architecture §11) | Moved | Same as UI-CM-DISPLAY / LC4 UI items; will address when LC6 UI phase begins |
| Goldilocks calibration pipeline (Architecture §11) | Moved | Post-UI-launch item; tracked under DOC-ATP-V5 scope |
| PHY-042 (Architecture §11) | S13 AM | CLOSED — confirmed NOT in LC6 engine source (grep returned 0); was LC5 context only |

---

## Section G: Verification Commands

Run these at any time to prove the tracker is accurate. Every expected ID must appear. If a grep returns 0, the tracker is incomplete.

```bash
cd ~/Desktop/LC6

for ID in \
  PHY-GEAR-01 PHY-HUMID-01 PHY-PERCEIVED-MR-REDESIGN \
  ARCH-FALL-IN-V2 ARCH-T-MRT-V2 ARCH-GEAR-DB-API-MIGRATION \
  ARCH-Q-SHIVER-SCENARIO-B ARCH-OQ-024-LC5-GREP ARCH-OQ-027-LC5-GREP \
  STAGE-TAU-MAX STAGE-PROMOTION-15MIN Q-SHIVER-50W-THRESHOLD \
  HEAT-SIDE-SWEAT-DETECTION \
  OQ-028 OQ-029 ITER-TSKIN-WARM-REST-NON-CONVERGENCE \
  OQ-REGIONAL-MR PHY-IMMERSION-01 PHY-GEAR-PEER-CAL \
  PHY-GEAR-WARMTH-CAL PHY-GEAR-BREATH-CAL PHY-GEAR-02 PHY-GEAR-03 \
  PHY-SWEAT-UNIFICATION PHY-GRADE-01 PHY-HUMID-VENT-REWRITE \
  PHY-HUMID-HUMMUL-CAL PHY-VENT-CONSTANTS \
  PHY-PR-COVERAGE-VAR PHY-PR-CHILL-WEIGHT PHY-EVAP-CAP-0.85 \
  PHY-HUMIDITY-FLOOR PHY-COLD-PENALTY PHY-COMPRESSION-CURVE \
  EMPTY-DIR-HEAT-LOSS EMPTY-DIR-OVERLAYS EMPTY-DIR-AGGREGATE \
  EMPTY-DIR-ACTIVITY-OBSOLETE \
  ARCH-LAYER-2-PACING ARCH-PHASE-1-CORRECTIVE ARCH-IREQ-BLOCK-2 \
  ARCH-IREQ-BLOCK-3 ARCH-REGIONAL-MR PHY-VASO-CITATION \
  DOC-TA-V7 DOC-ATP-V5 \
  PHY-NAN-HARDENING UI-CM-DISPLAY \
  S13-PHASE-2-3-DIRTY S13-MISSING-SPEC-FILE S13-MISSING-AUDIT-FILE \
  S13-MISSING-DECISION-REG S13-MISSING-SESSION-LEDGER \
  UNTRACKED-FILE-V1.3 \
  BUG-132 BUG-HALFDOME-PERSTEPMR UI-KIRKWOOD-FIXES \
  PERCEIVED_WEIGHTS COMFORT_THRESHOLD
do
  COUNT=$(grep -c "$ID" LC6_Planning/LC6_Master_Tracking.md 2>/dev/null)
  if [[ "$COUNT" == "0" || -z "$COUNT" ]]; then
    echo "MISSING: $ID"
  fi
done
echo "(no output above = all IDs present; complete tracker)"
```

---

## Section H: Session Ritual (Inviolable)

### Session OPEN (first action, no exceptions)

```bash
cd ~/Desktop/LC6
cat LC6_Planning/LC6_Master_Tracking.md | head -150
git status --short
git branch --show-current
```

Then state: "Tracker read. Branch: X. Dirty files: Y. Today's target: [specific item from Section B]."

### DURING work

Every time a decision defers/flags/marks-for-later:
1. Stop
2. Add to tracker immediately — Section B (with appropriate subsection) or Section C (if fudge factor) or Section D (if architectural "must not get lost")
3. Now continue

Every time a constant is touched without citation: Section C with file:line.

Every time a question is raised and not immediately resolved: Section B.

### Session CLOSE (reconciliation is mandatory)

1. **Review Section B line by line.** For each item:
   - Still valid? Keep.
   - Resolved by work this session? Move to Section F with resolution note.
   - Obsolete? Move to Section F marked CANCELLED with reason.
   - Superseded by newer item? Reference supersession.
   - Priority changed? Update.

2. **Review Section C line by line.** For each fudge:
   - Addressed by spec this session? Note resolution.
   - Still open? Keep.

3. **Run Section G verification grep.** Every expected ID must return > 0. Any MISSING output means the tracker is incomplete.

4. **Diff the tracker:** `git diff LC6_Planning/LC6_Master_Tracking.md`

5. **Commit the tracker as part of the session commit.** No separate "tracker update" commits — tracker moves with the work.

6. **Push.**

### Scripts: NO FUZZY IDEMPOTENCY CHECKS

Session 13 proved that `if "Session 13" not in content:` silently fails when "Session 13" appears in unrelated handoff notes. Never again.

Use either:
- **Explicit overwrite:** `write_text(new_content)` — write full file content, no "check first"
- **Exact-match grep:** `grep -c "DEC-MOISTURE-OUTPUT-AUDIT-SPECIFIC-UNIQUE-STRING"` — only skip if exact unique marker present
- **User confirmation:** show proposed change, ask "append or skip" before proceeding

---

## Section I: How to Keep This Honest

The tracker's value equals the discipline of updating it. Failure modes to watch:

1. **Claude forgets to update it.** → Session ritual makes it a named required step, not discretion.
2. **User pastes wrong content.** → Section G verification catches missing items.
3. **Script silent skips.** → No fuzzy idempotency checks; explicit write logic only.
4. **Items discussed in chat but never added.** → "Is X tracked?" can be answered by grep. If grep returns 0, it's not tracked.
5. **Reconciliation skipped at close.** → Tracker bloats with resolved items; active signal drowns in noise.
6. **File gets corrupted.** → Version-controlled; git diff shows regressions.

**The discipline:** If it's not in the tracker, it doesn't exist as a tracked concern. Memory (user memory, Claude memory) is advisory. This file is canonical.

**The reconciliation promise:** Every session ends with the tracker accurately reflecting reality. Resolved items get closed. New items get added. Priorities get updated. Nothing drifts silently.

---

*Document created Session 13, 2026-04-17 (pending commit).*
*Triggered by: "we are not moving forward on anything until we know what circle backs are out there and how we intend to track."*
*Section A 3 items, Section B 52 items, Section C 13 items, Section D 4 items, Section F 8 items.*
