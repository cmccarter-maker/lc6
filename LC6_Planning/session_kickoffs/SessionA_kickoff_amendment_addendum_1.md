# SessionA Kickoff Amendment — Addendum #1 (Post-Engine-Audit)

**Purpose:** Small additions to `SessionA_kickoff_amendment_post_S31.md` surfaced during SessionA engine-package audit. Scope is strictly vocabulary refinement + two ghost-session investigation items. Does NOT revise any prior SessionA scope decisions.

**Apply as:** amendment-addendum alongside the post-S31 amendment. Not a replacement — both amendments remain active. Original `SessionA_kickoff.md` (S28) + post-S31 amendment + this addendum together constitute SessionA's kickoff package.

---

## 1. Status vocabulary — add STRUCT-ZERO-PADDED

### Insert into §Status-vocabulary-update of the post-S31 amendment, adjacent to SEMANTICALLY-STUBBED

| Status | Meaning |
|---|---|
| STRUCT-ZERO-PADDED | A function returns a structured object where one or more fields are populated with literal zero / empty-array / trivial placeholder values because the logic to compute those fields was scoped to a deferred session. Distinct from NULL-PLUGGED (one deferred parameter or single null-wire, not a field-set inside a returned structure). Distinct from SEMANTICALLY-STUBBED (not an object-spread of another function — the fields were never computed in the first place, only type-initialized). Example: `evaluate.ts:605-740` TrajectoryPoint emits ~12 heat-balance fields (`M`, `W`, `C`, `R`, `E_resp`, `E_skin`, `E_max`, `E_req`, `h_c`, `h_mass`, `P_a`, `R_e_cl_effective`, `VPD`) as literal `0` with `TODO-SUPPLEMENTARY` markers. Downstream consumers reading these fields receive type-valid zeros and cannot distinguish them from real computed values. |

### Detection pattern for remaining package audits

When auditing `packages/gear-api/`, `packages/shared/`, `apps/web/`, grep for:

```bash
# Primary detection
grep -rn "TODO-SUPPLEMENTARY" <package> --include="*.ts"
grep -rn "crude placeholder" <package> --include="*.ts"
grep -rn -E ":\s*0,\s*//.*TODO" <package> --include="*.ts"

# Field-return zero-pad (needs case-by-case read after grep surface)
grep -rn -B1 -A1 -E "return\s*\{" <package> --include="*.ts" | grep -A 20 "return {" | grep -E "^\s+\w+:\s*0,?$"
```

Not every `field: 0` is STRUCT-ZERO-PADDED — legitimate defaults (counters, accumulators initialized to zero) are common. STRUCT-ZERO-PADDED requires both:

1. The field is zero
2. There's a code-adjacent comment (`TODO`, `placeholder`, session-scope deferral, etc.) indicating the zero is not the intended final value

Without comment evidence, flag as UNKNOWN and investigate, don't auto-tag as STRUCT-ZERO-PADDED.

### Three-pattern distinction table (for audit clarity)

| Pattern | Scope | Fix path | Detection signal |
|---|---|---|---|
| NULL-PLUGGED | One parameter or wire | Wire the parameter | `param: null,` with TODO at call site |
| SEMANTICALLY-STUBBED | Function-level output | Compute variant independently | `{ ...other, flag: true }` spread with pill-variant-intent |
| STRUCT-ZERO-PADDED | Fields inside returned struct | Back-fill computation | Zero-initialized fields + deferral comments |

Keep these distinct in Output A cells because they have different fix paths and different infrastructure-prevention needs for Session B.

---

## 2. Ghost-session investigation — new tracker items

Two deferred-scope markers were surfaced in engine source code comments. Neither has a corresponding tracker entry. Both represent completion states unverified for months.

### S10B-SCOPE-UNRESOLVED

**Evidence:**
- `evaluate.ts:8-10` — "Session 10a scope: Steps 1-4 … Steps 5-8: placeholders for Session 10b"
- `evaluate.ts:605-740` — ~12 TrajectoryPoint fields emit as literal zero with TODO-SUPPLEMENTARY markers
- `evaluate.ts:609` — `sweat_rate = S_heat > 0 ? 0.01 : 0; // crude placeholder`
- `evaluate.ts:712-713` — `T_cl`, `h_tissue` with TODO-SUPPLEMENTARY markers

**Status question:** Is Session 10b planned, scoped, deferred indefinitely, or silently abandoned? If any of the STRUCT-ZERO-PADDED fields are consumed by live UI or downstream consumers, zero values are being displayed.

**Tracker entry text (for S31 close or SessionA close):**

> `S10B-SCOPE-UNRESOLVED` MEDIUM — Session 10b scope referenced in `evaluate.ts:10` header comment ("Steps 5-8: placeholders for Session 10b") has no tracker entry and unverified completion status. Symptom: ~12 TrajectoryPoint fields in `evaluate.ts:605-740` return as literal-0 (STRUCT-ZERO-PADDED). Determine whether 10b is planned/deferred/abandoned. If consumed by any live code path, zero-display risk.

### S9C-SCOPE-UNRESOLVED

**Evidence:**
- `calc_intermittent_moisture.ts:6-7` — "SESSION 9b SCOPE: Cyclic path only. Steady-state and linear paths stubbed (β1 throw). Session 9c will port these remaining paths."

**Status question:** Did Session 9c happen? If not, steady-state and linear engine paths throw β1 errors. Risk: if any non-ski activity routes through the linear or steady-state paths (rather than the cyclic path ported in S31), those activities β1-throw at runtime. Non-ski bit-identical test gate at S31 Phase A/B/C passed 11/11, which implies non-ski activities route through cyclic path OR through a path that succeeds in the test suite — but doesn't conclusively confirm Session 9c completed.

**Investigation step (for SessionA execution, adds ~10 min):**

```bash
# Step 9: β1-throw pathway audit
cd ~/Desktop/LC6-local

echo "=== β1 throw sites in calc_intermittent_moisture.ts ==="
grep -n "β1\|beta1\|\"β1\"\|'β1'\|throw new" packages/engine/src/moisture/calc_intermittent_moisture.ts | head -20

echo ""
echo "=== Path-selection logic: where does the function dispatch cyclic vs linear vs steady-state? ==="
grep -n -E "(cyclic|linear|steady.?state|path.*=|mode.*=)" packages/engine/src/moisture/calc_intermittent_moisture.ts | head -30

echo ""
echo "=== Which activity profiles claim linear/steady-state? ==="
grep -rn -iE "(linear|steady.?state|cyclic)" packages/engine/src/activities/ --include="*.ts" | head -20
```

**Tracker entry text (for S31 close or SessionA close):**

> `S9C-SCOPE-UNRESOLVED` MEDIUM — Session 9c scope referenced in `calc_intermittent_moisture.ts:6-7` header comment ("Session 9c will port these remaining paths") has no tracker entry and unverified completion status. Symptom: linear and steady-state path handlers in `calc_intermittent_moisture.ts` may β1-throw when invoked. Non-ski test pass at S31 suggests either cyclic path serves all activities OR paths are routed around. Investigate path dispatch logic and confirm no activity profile is exposed to β1 pathway at runtime.

---

## 3. Per-package audit continuation plan

Remaining packages to audit after `packages/engine/`:

**`packages/gear-api/`** (single-subdirectory package, TBD file count — probably < 10). Small footprint. Likely single-table, one grep-pass. ~10 minutes.

**`packages/shared/`** (2-line placeholder file per opening-move finding). SKELETON candidate. Table row: "SHARED placeholder, 2 lines, 0 real content." ~5 minutes.

**`apps/web/`** (TBD file count — Christian has flagged as largely empty). Expect: skeleton scaffolding, possibly SKELETON-heavy, possibly MISSING files referenced by imports in the engine package. ~20 minutes if it's truly empty; longer if there are actual UI components to audit.

After all four package tables, the "Infrastructure-level findings" section per the post-S31 amendment is authored: ghost sessions, `apps/api/` absence, `LC6_Working_Agreement.md` absence, test-coverage asymmetries, etc.

Then **midpoint check-in with Christian** per OQ5 default (accepted as batch). User reviews Output A before Output B begins.

---

## 4. Amendment changelog

| Amendment | Date | Changes |
|---|---|---|
| Post-S31 (primary amendment) | 2026-04-23 PM | Reference updates, required-reads 6→10, SEMANTICALLY-STUBBED vocabulary, evaluate.ts:487 known NULL-PLUGGED, 5 S31-sourced incidents pre-enumerated, 2 new OQs, 3hr→4hr |
| Addendum #1 (this doc) | 2026-04-23 PM, later | STRUCT-ZERO-PADDED vocabulary entry + detection pattern, three-pattern distinction table, S10B-SCOPE-UNRESOLVED + S9C-SCOPE-UNRESOLVED tracker items with investigation steps |

---

**END ADDENDUM #1.**
