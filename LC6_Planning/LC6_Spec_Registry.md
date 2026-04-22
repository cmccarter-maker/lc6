# LC6 Spec Registry

**Purpose:** Single source of truth for every physics spec's implementation status in LC6. Catches drift between what filename markers say ("RATIFIED") and what the engine actually does ("reverted" / "partially implemented" / "never ported").

**Origin:** S27 — April 21, 2026. Created in response to discovery that PHY-031 (ratified LC5 Mar 17) was only 12.5% ported to LC6 without detection.

**Maintenance rule:** Every session that ratifies, ports, reverts, or supersedes a spec must update this registry in the same commit. Registry is canonical. Filenames are advisory.

---

## Status Vocabulary

Registry uses reality-based status, not filename-based. The two can disagree — that's the point.

| Status | Meaning |
|--------|---------|
| ACTIVE | Ratified, implemented in engine, tests verify semantics |
| PARTIAL | Ratified, partially implemented in engine (some spec items active, others missing) |
| NOT_PORTED | Ratified elsewhere (usually LC5), never ported to LC6 |
| DRAFT | Spec file exists, not yet ratified, no implementation expected yet |
| REVERTED | Was ratified and implemented, later reverted. Filename may still say RATIFIED. |
| SUPERSEDED | Replaced by a newer version. Filename may or may not reflect this. |

---

## Registry

### Ratified specs in LC6 engine scope

| Spec ID | Title | File Status | Reality Status | Implementation | Tests | Last Verified | Drift? |
|---------|-------|-------------|----------------|----------------|-------|---------------|--------|
| PHY-GEAR-01 v2 | Gear thermal properties model | RATIFIED | ACTIVE | packages/engine/src/ensemble/gear_layers.ts (4 refs) | 14 test refs | a8e4988 (S11) | No |
| PHY-HUMID-01 v2 | Humidity regime physics (§4.1 fudge delete + Category C _aHygro) | RATIFIED | PARTIAL | packages/engine/src/moisture/calc_intermittent_moisture.ts (4 refs) | 2 test refs | 773f995 (S12), updated S23 | §2.3 Cat A+B and §3.2 Magnus pending; unified under PHY-MICROCLIMATE-VP per S25 |
| PHY-PERCEIVED-MR-REDESIGN v1 | Perceived MR redesign | RATIFIED (filename) | REVERTED (reality) | packages/engine/src/moisture/perceived_mr.ts (pre-REDESIGN code restored) | 0 test refs | 3ce33fe (S17 revert) | **YES — filename/reality mismatch** |
| PHY-031 | Component Cycle Model (crowd tiers, holiday windows, line + transition + rest) | RATIFIED | PARTIAL | LC6 spec: LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md. Engine (S29): phy031_constants.ts + activities/crowd_factor.ts (getCrowdFactor + computeCycle), ActivitySpec.date_iso required, UserBiometrics.ski_history optional, evaluate.ts:430 null-plug closed via computeResortCycleOverride helper. Cardinal Rule #8 honored (calc_intermittent_moisture.ts untouched). **S29 PHYSICS GAP DISCOVERED:** spec §2.1 cycleMin is full wall-clock cycle time (16.25–50 min depending on terrain + tier + powder) but engine phase loop simulates only run+lift (~10 min). Override supplies totalCycles=N to engine, engine runs N × 10-min physics over session whose wall-clock expects N × cycleMin, under-simulating up to 80% of session time. MR regresses post-port. Blocking S26-SYSTEMATIC-MR-UNDERESTIMATION closure. Tracked as `S29-PHY-031-CYCLEMIN-PHYSICS-GAP` HIGH; reconciliation spec pending. | 31 test refs (spec-locks/phy-031-component-cycle.test.ts; 31/31 green) | 7289e8b (S29) | **Spec values + calendar + schema correct. Engine consumption of cycleMin incomplete. Next action: author PHY-031-CYCLEMIN-RECONCILIATION spec.** |
| PHY-HUMID-01 v1 | Humidity regime physics (legacy, contained _excessRetention=0.10 fudge) | RATIFIED (filename) | SUPERSEDED (reality) | N/A (superseded by v2) | N/A | Superseded by v2 at 773f995 | **YES — filename should be SUPERSEDED** |

### Draft specs (not yet ratified, no implementation expected)

| Spec ID | Title | File Status | Reality Status | Notes | Last Verified |
|---------|-------|-------------|----------------|-------|---------------|
| PHY-MICROCLIMATE-VP v1 | Microclimate vapor pressure (unified PHY-HUMID-01 §2.3 Cat A+B + §3.2 Magnus + S21-F2 hardcoded skin dew) | DRAFT | DRAFT | 591 lines, Cardinal Rule #8 compliant | S25 (863c4ca) |
| PHY-SHELL-GATE v1 | Shell capacity gate at terminal saturation | DRAFT | DRAFT | 484 lines, 10-scenario verification test designed | S23 (39b2846) |

### Superseded specs (historical, for traceability)

| Spec ID | Superseded By | Supersession Commit | Notes |
|---------|---------------|---------------------|-------|
| PHY-GEAR-01 v1 | PHY-GEAR-01 v2 | a8e4988 (S11) | File correctly marked SUPERSEDED |
| PHY-PERCEIVED-MR-REDESIGN v0 | PHY-PERCEIVED-MR-REDESIGN v1 | 79b5623 (S14) | File correctly marked SUPERSEDED. Note: v1 itself later reverted in S17 |

---

## Drift Items Requiring Action

These are immediate cleanup items surfaced by building this registry.

### DRIFT-1: PHY-PERCEIVED-MR-REDESIGN v1 filename lies

**On-disk:** `PHY-PERCEIVED-MR-REDESIGN_Spec_v1_RATIFIED.md`
**Reality:** Ratified at `79b5623` (S14), implementation reverted at `3ce33fe` (S17). Engine runs pre-REDESIGN code.
**Action:** Rename to `PHY-PERCEIVED-MR-REDESIGN_Spec_v1_REVERTED.md`
**Reference:** `LC6_Planning/LC6_REDESIGN_v1_Closure.md` documents the revert
**Priority:** LOW (documentation hygiene, no user impact)
**Tracker item:** `S27-DRIFT-1-PERCEIVED-MR-FILENAME` LOW

### DRIFT-2: PHY-HUMID-01 v1 filename should say SUPERSEDED

**On-disk:** `PHY-HUMID-01_Spec_v1_RATIFIED.md`
**Reality:** Superseded by v2 at `773f995` (S12). v2 file's own body states this.
**Action:** Rename to `PHY-HUMID-01_Spec_v1_SUPERSEDED.md`
**Priority:** LOW (documentation hygiene)
**Tracker item:** `S27-DRIFT-2-HUMID-V1-FILENAME` LOW

### DRIFT-3: PHY-031 has no LC6 spec file — CLOSED S28

**On-disk:** `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` (ratified S28, April 21, 2026, commit `3a4b4d1113264c40a0752aa3ba1e43b43aa866f2`)
**Reality:** Spec RATIFIED in LC6 per S28. Engine implementation remains 12.5% complete — tracked as S29 port target, not spec drift.
**Resolution action (completed S28):** Spec authored from LC5 archive + S27 audit + 6 S28 open-question resolutions. 616 lines, 18 sections. Content covers: component cycle formula, 6-tier crowd calendar, 10 holiday windows (including new Thanksgiving window), powder-day surge with auto-detection, ski history Phase A integration, cycle-averaging Cardinal Rule, 7 worked examples, S29 verification criteria, Model Refinement future-work register.
**Reference:** `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md`
**Priority:** N/A (closed)
**Tracker item:** `S27-DRIFT-3-PHY-031-NO-SPEC` — **CLOSED S28**

---

## Coverage Heat Map

**Of 5 specs with ratification claim:**
- 1 fully working (PHY-GEAR-01 v2) — 20%
- 2 partial (PHY-HUMID-01 v2, PHY-031) — 40%
- 1 reverted but filename says RATIFIED (PHY-PERCEIVED-MR-REDESIGN) — 20%
- 1 stale filename that should be SUPERSEDED (PHY-HUMID-01 v1) — 20%

**1 of 5 (20%) fully aligned; 2 of 5 (40%) ratified-with-known-implementation-gap-tracked; remaining 2 still drifting pending DRIFT-1 and DRIFT-2 cleanup.**

**Test coverage across ratified-claim specs:** 16 total test references (14 from PHY-GEAR-01, 2 from PHY-HUMID-01 v2). Zero test coverage for 3 of the 5 specs.

This pattern explains why PHY-031 drift went undetected for 27 sessions. Without a registry enforcing name ≠ reality checks, spec state drifts invisibly.

---

## Maintenance Protocol

### Adding a new spec

1. Create spec file at `LC6_Planning/specs/<SPEC-ID>_Spec_v<N>_DRAFT.md`
2. Add row to Draft Specs table in this registry
3. Commit both in same commit

### Ratifying a draft

1. Rename file to `<SPEC-ID>_Spec_v<N>_RATIFIED.md`
2. Move row in registry from Draft Specs to Ratified Specs
3. Set Reality Status = ACTIVE once implementation lands (may lag)
4. Link implementation commit SHA
5. Add tests; update test count
6. Commit registry update in same commit as implementation

### Reverting an implementation

1. Update Reality Status in registry to REVERTED
2. Add drift item to cleanup section if filename still says RATIFIED
3. Commit registry update same commit as revert

### Superseding a spec

1. New spec file created as usual
2. Old spec file renamed `_SUPERSEDED.md`
3. Old row moved to Superseded Specs section
4. New row added to Ratified Specs section
5. Commit all changes together

### Session close hygiene

**Every session must:**
- Open: read registry, understand current drift state
- During: record any spec status changes
- Close: commit registry update reflecting all session changes

Registry is canonical. Filenames are advisory. If they disagree, registry is right.

---

## Registry Version History

| Version | Date | Session | Changes |
|---------|------|---------|---------|
| v1 | April 21, 2026 | S27 | Initial registry. Cataloged 7 spec files, identified 3 drift items. |
| v1.1 | April 21, 2026 | S28 | PHY-031 row status: NOT_PORTED → PARTIAL. DRIFT-3 CLOSED (spec ratified). Coverage heat map updated. |

---

End of registry. Next update required when any spec status changes.
