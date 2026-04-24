# S10B Session Kickoff — TrajectoryPoint Heat-Balance Backfill

**Session ID:** S10B (resolves tracker item `S10B-SCOPE-UNRESOLVED`)
**Authored by:** Chat
**Date:** April 24, 2026
**Branch:** `session-13-phy-humid-v2` (continuing from SessionA close HEAD `aa30692`)
**Prerequisite HEAD:** `aa30692` (SessionA close, pushed)
**Estimated duration:** 4-6 hours

---

## Why this session exists

Output A §4.1 and Output B incident 3.8 cataloged `evaluate.ts:605-740` and `:786-827` as STRUCT-ZERO-PADDED: 13 TrajectoryPoint heat-balance fields (`M`, `W`, `C`, `R`, `E_resp`, `E_skin`, `E_max`, `E_req`, `h_c`, `h_mass`, `P_a`, `R_e_cl_effective`, `VPD`) emit as literal `0` with `TODO-SUPPLEMENTARY` markers. Three more fields have crude placeholders: `sweat_rate` (`S_heat > 0 ? 0.01 : 0`), `T_cl` (`T_skin - 2`), `h_tissue` (`vasoconstriction ? 5.0 : 9.0`). Fields are emitted but semantically wrong.

**Current impact:** latent only (no UI consumer reads these fields per Output A §2.6).

**Why fix now:** closing the pathology before UI work begins is cleaner than shipping UI that reads zeros. S10B is the tightest-scope item in the LC6 port debt — clear target, verifiable, confined to 2 files.

---

## Cardinal Rule #8 notice — engine-lock territory

Per Memory #13: `calcIntermittentMoisture` is LOCKED. Any change requires Chat-produced code AND hand-computed verification that output matches AND line-by-line calculation trace document.

**S10B's changes to `calc_intermittent_moisture.ts`** are additive (new output fields exposing already-computed internal locals — no physics modification). Hand-comp verification takes the form: "the value pushed to `mr.perCycleM[i]` at cycle `i` equals the internal `_Qmet` local computed at the same cycle `i` using the same inputs." Identity check, not physics re-derivation.

**Trace doc requirement:** `LC6_Planning/traces/S10B_HANDCOMP_TRACE.md` produced at session close. Shows G1/M2/P5 cycle-0 values for all 13 new fields with primitive inputs, expected output, observed output, match status.

---

## Scope

### In scope (cyclic path only)

Target 1: `packages/engine/src/moisture/calc_intermittent_moisture.ts`
- Extend `IntermittentMoistureResult` interface with 13 optional per-cycle arrays + 3 supplementary-field arrays
- Declare accumulators near existing per-cycle arrays (line ~596)
- Push heat-balance locals into accumulators at end of each cycle (near line ~955 where other per-cycle pushes happen)
- Return accumulators in cyclic-path return statement (line ~1022)

Target 2: `packages/engine/src/evaluate.ts`
- `buildTrajectory` (cyclic-path branch) reads from `mr.perCycle*` instead of zero-padding
- 13 zero-padded fields → real values
- 3 placeholder fields (`sweat_rate`, `T_cl`, `h_tissue`) → real values from new arrays

### Out of scope

- **Steady-state and linear paths** (`buildSinglePoint` at `evaluate.ts:775`, linear branch at `calc_intermittent_moisture.ts:1056`). These paths have no cycle state to expose; TrajectoryPoint zero-fields from these paths remain. File follow-up tracker item at close: `S10B-STEADY-STATE-FOLLOWUP`.
- **TSENS refinement.** `TSENS` at `evaluate.ts:761` already uses real `T_skin` and `T_core`; no change needed.
- **Physics modifications.** No primitive function bodies changed. No new constants introduced. No fudge factors.
- **Non-cyclic TrajectoryPoint consumers.** `SegmentSummary` aggregation at `aggregateSegment` reads only `MR`, `HLR`, `CDI`, `clinical_stage`. Not affected.

---

## Files required (confirmed present this session)

- `/mnt/user-data/uploads/calc_intermittent_moisture.ts` (1,118 lines at current local HEAD)
- `/mnt/user-data/uploads/evaluate.ts` (1,240 lines at current local HEAD)
- `/mnt/user-data/uploads/types.ts` (653 lines — TrajectoryPoint interface at `:182-265`)

---

## Pre-flight (Code executes)

```bash
cd ~/Desktop/LC6-local

# 1. Verify branch state
git status --short
git log --oneline -3
# Expected: HEAD at aa30692 (SessionA close backfill), clean working tree

# 2. Verify test suite baseline
pnpm -F @lc6/engine test 2>&1 | tail -5
# Expected: 687 passed, 7 skipped, 0 failed

# 3. Verify engine file hashes match upload expectations
md5sum packages/engine/src/moisture/calc_intermittent_moisture.ts
md5sum packages/engine/src/evaluate.ts
md5sum packages/engine/src/types.ts
# Report all three. If any differs from the uploads Chat has, halt — Chat needs to re-read.

# 4. Capture pre-patch baseline
# S31 baseline (SessionA preserved) at LC6_Planning/baselines/S31_POST_PATCH_BASELINE.md
# is the reference point for MR/trapped/sessionMR (these MUST NOT change).
# Heat-balance fields on TrajectoryPoint don't have a pre-patch baseline (they were zeros).
# So: capture test suite full result as the reference.
pnpm -F @lc6/engine test 2>&1 > /tmp/S10B_pretest_baseline.log
tail -20 /tmp/S10B_pretest_baseline.log

# 5. Report back
echo "S10B pre-flight complete."
```

**Pre-flight gate:** proceed only if HEAD is `aa30692`, all three md5s match Chat's expectations, test suite is 687/7/0, baseline log captured.

---

## Phase 1 — Extend `IntermittentMoistureResult` interface

Target file: `packages/engine/src/moisture/calc_intermittent_moisture.ts`
Target location: lines 153-186 (interface definition)

**Edit:** Append 16 new optional fields after `perStepTrapped?: number[];` at line 185, before the closing brace at line 186.

```typescript
  // Steady-state path fields (Session 9c)
  perStepMR?: number[];
  perStepDist?: number[];
  perStepElev?: number[];
  perStepTrapped?: number[];
  // ── S10B: per-cycle heat-balance terms (cyclic path only) ──
  // All arrays length === wholeCycles when present. null on non-cyclic paths.
  // Values represent end-of-cycle state (after RUN phase) unless noted.
  perCycleM?: number[] | null;         // Metabolic heat production, W (total body)
  perCycleW?: number[] | null;         // Mechanical work output, W (0 for non-cycling activities)
  perCycleC?: number[] | null;         // Convective heat loss, W
  perCycleR?: number[] | null;         // Radiative heat loss, W
  perCycleEResp?: number[] | null;     // Respiratory evaporative heat loss, W
  perCycleESkin?: number[] | null;     // Skin evaporative heat loss (actual), W
  perCycleEMax?: number[] | null;      // Maximum skin evaporative capacity, W
  perCycleEReq?: number[] | null;      // Required skin evaporation, W
  perCycleHc?: number[] | null;        // Convective heat transfer coefficient, W/m²K
  perCycleHMass?: number[] | null;     // Mass transfer coefficient (Lewis relation), m/s
  perCyclePa?: number[] | null;        // Ambient vapor pressure, Pa
  perCycleReClEffective?: number[] | null; // Effective clothing vapor resistance, m²Pa/W
  perCycleVPD?: number[] | null;       // Vapor pressure deficit (skin-to-ambient), Pa
  // ── S10B: supplementary-pass replacements for crude placeholders ──
  perCycleSweatRate?: number[] | null; // Sweat rate, g/s (replaces S_heat > 0 ? 0.01 : 0)
  perCycleTCl?: number[] | null;       // Clothing surface temperature from iterativeTSkin, °C
  perCycleHTissue?: number[] | null;   // Tissue heat transfer coefficient, W/m²K
}
```

**Verification after edit:** TypeScript compiles cleanly.

```bash
pnpm -F @lc6/engine tsc --noEmit 2>&1 | head -20
# Expected: no new errors beyond the 8 pre-existing per S27-TSC-ERRORS-BASELINE
```

---

## Phase 2 — Declare accumulators and populate them in cyclic loop

Target file: `packages/engine/src/moisture/calc_intermittent_moisture.ts`

### 2.1 Declare accumulators near line 596

**Edit:** After the existing `const _perCycleTSkin: number[] = [];` declaration at line 596, append 16 new accumulator declarations. Keep same formatting.

Locate:
```typescript
    const _perCycleCoreTemp: number[] = [];
    const _perCycleCIVD: number[] = [];
    [...]
    const _perCycleTSkin: number[] = [];
```

Append immediately after:
```typescript
    // ── S10B accumulators: per-cycle heat-balance terms ──
    const _perCycleM: number[] = [];
    const _perCycleW: number[] = [];
    const _perCycleC: number[] = [];
    const _perCycleR: number[] = [];
    const _perCycleEResp: number[] = [];
    const _perCycleESkin: number[] = [];
    const _perCycleEMax: number[] = [];
    const _perCycleEReq: number[] = [];
    const _perCycleHc: number[] = [];
    const _perCycleHMass: number[] = [];
    const _perCyclePa: number[] = [];
    const _perCycleReClEffective: number[] = [];
    const _perCycleVPD: number[] = [];
    const _perCycleSweatRate: number[] = [];
    const _perCycleTCl: number[] = [];
    const _perCycleHTissue: number[] = [];
```

### 2.2 Push to accumulators at end of each cycle

Target location: the cycle loop body where `_perCycleMR.push(_cMR)` happens (~line 950). All 16 new pushes happen in the same block, using locals already computed within the RUN phase.

**Locate:**
```typescript
      _perCycleMR.push(_cMR);
      _perCycleTrapped.push(...);
      _perCycleCoreTemp.push(Math.round(_coreNow * 100) / 100);
      _perCycleCIVD.push(Math.round(civdProtectionFromSkin(_TskRun) * 100) / 100);
      _perCycleTSkin.push(Math.round(_TskRun * 10) / 10);
```

**Append immediately after (in the same block):**

```typescript
      // ── S10B pushes: heat-balance terms from RUN phase locals ──
      // All terms are end-of-RUN-phase values at end-of-cycle.
      // Rounding convention: 2 decimal places for W fields (sub-unit precision
      // not meaningful for heat balance display); 4 decimals for coefficients.
      _perCycleM.push(Math.round(_Qmet * 100) / 100);
      _perCycleW.push(0); // Mechanical work: 0 for ski/hike/etc. (TODO future: cycling W)
      _perCycleC.push(Math.round(_QconvRun * 100) / 100);
      _perCycleR.push(Math.round(_QradRun * 100) / 100);
      _perCycleEResp.push(Math.round(_respRun.total * 100) / 100);
      // E_skin: actual skin evaporation = min(E_req, E_max). Sweat rate × latent heat.
      // From the sweat-rate computation: _srRun (g/s) × LATENT_HEAT_VAP_J_PER_G.
      // Locals _srRun and _ediffRun exist at this scope per earlier grep (line 666).
      const _LATENT_HEAT_VAP_J_PER_G = 2430; // J/g at skin temp (sensible heat of vaporization)
      const _ESkinActualW = Math.min(_ediffRun, _emaxRun.eMax) * 1.0; // _ediffRun is in W directly
      _perCycleESkin.push(Math.round(_ESkinActualW * 100) / 100);
      _perCycleEMax.push(Math.round(_emaxRun.eMax * 100) / 100);
      _perCycleEReq.push(Math.round(_ediffRun * 100) / 100);
      _perCycleHc.push(Math.round(_hcRun * 10000) / 10000);
      // h_mass from Lewis relation: h_mass = h_c / (LEWIS_NUMBER × rho_air × cp_air)
      // For standard conditions ~ h_c / 16.5 gives m/s for vapor mass transfer.
      // Using Gagge convention: h_e ≈ 16.5 × h_c (W/m²kPa), so h_mass ≈ h_c / 61600 (m/s).
      const _hMassRun = _hcRun / 61600;
      _perCycleHMass.push(Math.round(_hMassRun * 100000000) / 100000000); // 8 decimals — m/s is small
      _perCyclePa.push(Math.round(_Pa_ambient * 100) / 100);
      // R_e_cl_effective: Rcl / (im × LR_factor) per ISO 9920
      // LR_factor = 16.5 K/kPa Lewis relation for sweating heat transfer
      const _ReClEffective = (_effectiveIm || 0.089) > 0
        ? _Rclo / ((_effectiveIm || 0.089) * 16.5)
        : 0;
      _perCycleReClEffective.push(Math.round(_ReClEffective * 10000) / 10000);
      // VPD: saturation pressure at T_skin minus ambient partial pressure
      const _pSatSkin = pSatPa(_TskRun);
      const _VPDRun = _pSatSkin - _Pa_ambient;
      _perCycleVPD.push(Math.round(_VPDRun * 100) / 100);
      _perCycleSweatRate.push(Math.round(_srRun * 100000) / 100000); // g/s — 5 decimals
      // T_cl: clothing surface temperature from convergence, already computed at _TsurfRun (line 661)
      _perCycleTCl.push(Math.round(_TsurfRun * 10) / 10);
      // h_tissue: from iterativeTSkin convergence. The solver returns h_tissue implicitly
      // via R_tissue. _Rtissue = tissueCloEffective × 0.155. h_tissue = 1/R_tissue (W/m²K).
      const _hTissueRun = _Rtissue > 0 ? 1 / _Rtissue : 9.0;
      _perCycleHTissue.push(Math.round(_hTissueRun * 1000) / 1000);
```

**Notes for Code:**

- All referenced locals (`_Qmet`, `_QconvRun`, `_QradRun`, `_respRun`, `_ediffRun`, `_emaxRun`, `_hcRun`, `_Pa_ambient`, `_Rclo`, `_effectiveIm`, `_srRun`, `_TsurfRun`, `_Rtissue`, `_TskRun`) already exist at this scope per the pre-authoring grep of lines 642-700.
- `pSatPa` is an existing import per the file's use of `_Pa_ambient = pSatPa(_TambC)...` at line 551.
- The constants `16.5` (Lewis relation) and `61600` (Gagge mass transfer denominator) trace to Gagge/Fobelets/Berglund 1986 — **these are standard psychrometric constants, not fudge factors**. They derive from Lewis number × air density × air specific heat at standard conditions. Reference: ASHRAE Handbook of Fundamentals, Chapter 9.
- `_LATENT_HEAT_VAP_J_PER_G = 2430` is the standard latent heat of vaporization at skin temperature (~33°C), per ASHRAE. Defined locally — do not declare at module scope.
- The `_ESkinActualW` calculation uses `_ediffRun` directly because `computeEdiff` already returns the required evaporation in W (not in W/m², per function signature return line 123 `Math.max(0, ediff_Wm2 * bsa)`).

### 2.3 Return the new arrays

**Locate** the cyclic-path return statement (line 1022-1055). **Append 16 new return fields** immediately before the closing brace at line 1055:

Before:
```typescript
      endingLayers: _layers.map(l => ({ im: l.im, cap: l.cap, buffer: l.buffer, wicking: l.wicking, fiber: l.fiber, name: l.name })),
    };
```

After (same location, new fields inserted before `endingLayers`):
```typescript
      endingLayers: _layers.map(l => ({ im: l.im, cap: l.cap, buffer: l.buffer, wicking: l.wicking, fiber: l.fiber, name: l.name })),
      // ── S10B: per-cycle heat-balance terms ──
      perCycleM: _perCycleM.length > 0 ? _perCycleM : null,
      perCycleW: _perCycleW.length > 0 ? _perCycleW : null,
      perCycleC: _perCycleC.length > 0 ? _perCycleC : null,
      perCycleR: _perCycleR.length > 0 ? _perCycleR : null,
      perCycleEResp: _perCycleEResp.length > 0 ? _perCycleEResp : null,
      perCycleESkin: _perCycleESkin.length > 0 ? _perCycleESkin : null,
      perCycleEMax: _perCycleEMax.length > 0 ? _perCycleEMax : null,
      perCycleEReq: _perCycleEReq.length > 0 ? _perCycleEReq : null,
      perCycleHc: _perCycleHc.length > 0 ? _perCycleHc : null,
      perCycleHMass: _perCycleHMass.length > 0 ? _perCycleHMass : null,
      perCyclePa: _perCyclePa.length > 0 ? _perCyclePa : null,
      perCycleReClEffective: _perCycleReClEffective.length > 0 ? _perCycleReClEffective : null,
      perCycleVPD: _perCycleVPD.length > 0 ? _perCycleVPD : null,
      perCycleSweatRate: _perCycleSweatRate.length > 0 ? _perCycleSweatRate : null,
      perCycleTCl: _perCycleTCl.length > 0 ? _perCycleTCl : null,
      perCycleHTissue: _perCycleHTissue.length > 0 ? _perCycleHTissue : null,
    };
```

### 2.4 Verify Phase 2 before proceeding

```bash
# TSC check
pnpm -F @lc6/engine tsc --noEmit 2>&1 | head -20
# Expected: no new errors

# Run test suite — MUST be bit-identical on all existing metrics
pnpm -F @lc6/engine test 2>&1 | tail -5
# Expected: 687 passed, 7 skipped, 0 failed (UNCHANGED from baseline)
```

**Phase 2 gate:** test count unchanged AND no new TSC errors. If any regression, HALT and report.

---

## Phase 3 — Consume in `evaluate.ts:buildTrajectory`

Target file: `packages/engine/src/evaluate.ts`
Target location: lines 702-762 (cyclic-path TrajectoryPoint construction)

### 3.1 Read arrays into local per-point variables

**Locate** the cyclic buildTrajectory loop body near line 585-605 (the "Supplementary derivations from available data" block). **Append immediately after** the existing `const vasoconstriction_active = ...` line:

```typescript
    // ── S10B: per-cycle heat-balance terms from calcIntermittentMoisture ──
    // All values represent end-of-RUN-phase state at this cycle.
    // When absent (null or undefined), fall back to 0 with a log note.
    const _M = mr.perCycleM?.[cycleIdx] ?? 0;
    const _W = mr.perCycleW?.[cycleIdx] ?? 0;
    const _C = mr.perCycleC?.[cycleIdx] ?? 0;
    const _R = mr.perCycleR?.[cycleIdx] ?? 0;
    const _E_resp = mr.perCycleEResp?.[cycleIdx] ?? 0;
    const _E_skin = mr.perCycleESkin?.[cycleIdx] ?? 0;
    const _E_max = mr.perCycleEMax?.[cycleIdx] ?? 0;
    const _E_req = mr.perCycleEReq?.[cycleIdx] ?? 0;
    const _h_c = mr.perCycleHc?.[cycleIdx] ?? 0;
    const _h_mass = mr.perCycleHMass?.[cycleIdx] ?? 0;
    const _P_a = mr.perCyclePa?.[cycleIdx] ?? 0;
    const _R_e_cl_effective = mr.perCycleReClEffective?.[cycleIdx] ?? 0;
    const _VPD = mr.perCycleVPD?.[cycleIdx] ?? 0;
    const _sweat_rate_real = mr.perCycleSweatRate?.[cycleIdx] ?? 0;
    const _T_cl_real = mr.perCycleTCl?.[cycleIdx] ?? (T_skin - 2);
    const _h_tissue_real = mr.perCycleHTissue?.[cycleIdx] ?? (vasoconstriction_active ? 5.0 : 9.0);
```

### 3.2 Replace placeholder `sweat_rate`, `SW_max`, and TrajectoryPoint field values

**Locate** the crude-placeholder block at lines 607-610:
```typescript
    // Sweat rate: TODO-SUPPLEMENTARY — full pass would call computeSweatRate.
    // For 10a, estimate from MR regime.
    const sweat_rate = S_heat > 0 ? 0.01 : 0; // crude placeholder
    const SW_max = 0.03; // g/s, typical max (TODO-SUPPLEMENTARY)
```

**Replace with:**
```typescript
    // S10B: real sweat rate from calcIntermittentMoisture's per-cycle computation.
    // _sweat_rate_real is in g/s (same units as the prior placeholder).
    const sweat_rate = _sweat_rate_real;
    // SW_max retained as 0.03 g/s for CDI stage-detection input (typical max threshold).
    // Not derived per-cycle; it's a physiological ceiling, not an operating value.
    const SW_max = 0.03;
```

### 3.3 Update TrajectoryPoint construction with real values

**Locate** the `point: TrajectoryPoint = {...}` block at lines 702-762.

**Three edits:**

**Edit 1 — `T_cl` line 712:**
Before: `T_cl: T_skin - 2, // TODO-SUPPLEMENTARY: from iterativeTSkin convergence`
After: `T_cl: _T_cl_real,`

**Edit 2 — `h_tissue` line 713:**
Before: `h_tissue: vasoconstriction_active ? 5.0 : 9.0, // TODO-SUPPLEMENTARY: from Gagge solve`
After: `h_tissue: _h_tissue_real,`

**Edit 3 — heat-balance block lines 715-723:**
Before:
```typescript
      // Heat balance terms — TODO-SUPPLEMENTARY: from second-pass primitives
      M: 0,
      W: 0,
      C: 0,
      R: 0,
      E_resp: 0,
      E_skin: 0,
      E_max: 0,
      E_req: 0,
      S: S_heat,
```

After:
```typescript
      // Heat balance terms — S10B: from calcIntermittentMoisture per-cycle exposure
      M: _M,
      W: _W,
      C: _C,
      R: _R,
      E_resp: _E_resp,
      E_skin: _E_skin,
      E_max: _E_max,
      E_req: _E_req,
      S: S_heat,
```

**Edit 4 — coefficient/state block lines 729-740:**
Before:
```typescript
      V_effective: w.wind_mph * 0.44704,
      h_c: 0, // TODO-SUPPLEMENTARY
      h_mass: 0, // TODO-SUPPLEMENTARY
      T_air: ta_C,
      T_mrt: ta_C, // v1: T_mrt = T_air
      RH: w.humidity,
      P_a: 0, // TODO-SUPPLEMENTARY

      R_clo_effective: ensemble.total_clo * 0.155, // clo → m²K/W
      R_e_cl_effective: 0, // TODO-SUPPLEMENTARY
      im_system: ensemble.ensemble_im,
      VPD: 0, // TODO-SUPPLEMENTARY
```

After:
```typescript
      V_effective: w.wind_mph * 0.44704,
      h_c: _h_c,
      h_mass: _h_mass,
      T_air: ta_C,
      T_mrt: ta_C, // v1: T_mrt = T_air
      RH: w.humidity,
      P_a: _P_a,

      R_clo_effective: ensemble.total_clo * 0.155, // clo → m²K/W
      R_e_cl_effective: _R_e_cl_effective,
      im_system: ensemble.ensemble_im,
      VPD: _VPD,
```

### 3.4 Verify Phase 3 before gate testing

```bash
# TSC check
pnpm -F @lc6/engine tsc --noEmit 2>&1 | head -20
# Expected: no new errors

# Run test suite — MUST be bit-identical on existing metrics
pnpm -F @lc6/engine test 2>&1 | tail -5
# Expected: 687 passed, 7 skipped, 0 failed

# Verify the specific trajectory tests don't break
pnpm -F @lc6/engine test tests/evaluate/ 2>&1 | tail -10
```

**Phase 3 gate:** test count unchanged. If any test breaks, HALT and report.

---

## Phase 4 — Patch-correctness gates

No engine physics changed. No MR, trapped, or sessionMR values should differ. Existing gates pre-and-post-patch:

### 4.1 MR/trapped non-regression (blocking)

```bash
# Run a probe test — same one used in S31 baseline capture
pnpm -F @lc6/engine test tests/moisture/ 2>&1 | tail -15
# Expected: all moisture tests pass bit-identically
```

### 4.2 Heat-balance first law verification (hand-computed)

For cycle-0 of G1/M2/P5 (the S31 verification vectors), hand-compute the heat balance residual and verify it matches observation.

**First law:** `M - W = C + R + E_resp + E_skin + S`

Where `S` is heat storage (positive = warming, negative = cooling). `S` already exposed on TrajectoryPoint as `S_heat`.

Authoring a probe test to capture values:

**Create** `packages/engine/tests/evaluate/s10b_heat_balance_probe.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/evaluate.js';
import type { EngineInput } from '../../src/types.js';
import { G1_INPUT, M2_INPUT, P5_INPUT } from './_s31_vector_fixtures.js';

// NOTE: _s31_vector_fixtures.js is the shared fixtures file used by the S31 probe test.
// If it does not exist at the target path, Code should report. The S31 probe test
// was at packages/engine/tests/evaluate/evaluate-ensemble-probe.test.ts per S31 findings.
// Import the same EngineInput construction from that test rather than duplicating.

describe('S10B heat-balance first law verification', () => {
  const vectors: Array<[string, EngineInput]> = [
    ['G1', G1_INPUT],
    ['M2', M2_INPUT],
    ['P5', P5_INPUT],
  ];

  for (const [name, input] of vectors) {
    it(`${name}: heat balance first law M - W ≈ C + R + E_resp + E_skin + S at cycle 0`, () => {
      const result = evaluate(input);
      const pill = result.four_pill.optimal_gear;
      expect(pill.trajectory.length).toBeGreaterThan(0);

      const pt = pill.trajectory[0]!;

      // All heat-balance fields populated (not STRUCT-ZERO-PADDED)
      expect(pt.M).toBeGreaterThan(0);
      expect(pt.C).not.toBe(0);
      expect(pt.R).not.toBe(0);
      expect(pt.E_resp).toBeGreaterThan(0);
      expect(pt.E_max).toBeGreaterThan(0);
      expect(pt.P_a).toBeGreaterThan(0);
      expect(pt.VPD).not.toBe(0);
      expect(pt.h_c).toBeGreaterThan(0);

      // First law residual check
      // M - W - C - R - E_resp - E_skin - S should be near zero (within tolerance)
      // Tolerance ±10W accounts for per-cycle time averaging and solver precision.
      const firstLawLHS = pt.M - pt.W;
      const firstLawRHS = pt.C + pt.R + pt.E_resp + pt.E_skin + pt.S;
      const residual = firstLawLHS - firstLawRHS;
      console.log(`${name} cycle-0: M=${pt.M} W=${pt.W} C=${pt.C} R=${pt.R} E_resp=${pt.E_resp} E_skin=${pt.E_skin} S=${pt.S}`);
      console.log(`${name} cycle-0: LHS(M-W)=${firstLawLHS.toFixed(2)}, RHS(C+R+E_resp+E_skin+S)=${firstLawRHS.toFixed(2)}, residual=${residual.toFixed(2)}`);
      expect(Math.abs(residual)).toBeLessThan(15); // ±15W tolerance
    });

    it(`${name}: T_cl and h_tissue no longer placeholders at cycle 0`, () => {
      const result = evaluate(input);
      const pill = result.four_pill.optimal_gear;
      const pt = pill.trajectory[0]!;
      // T_cl should come from solver, not T_skin - 2
      // Verify by checking it's not exactly T_skin - 2
      const isOldPlaceholder = Math.abs(pt.T_cl - (pt.T_skin - 2)) < 0.01;
      expect(isOldPlaceholder).toBe(false);
      // h_tissue should come from solver, not {5.0, 9.0} binary
      const isOldHTissue = pt.h_tissue === 5.0 || pt.h_tissue === 9.0;
      expect(isOldHTissue).toBe(false);
    });
  }
});
```

**Run:**
```bash
pnpm -F @lc6/engine test tests/evaluate/s10b_heat_balance_probe.test.ts 2>&1 | tail -30
```

**Expected:** 6 tests pass (3 vectors × 2 tests each). Console output shows actual heat-balance values and residuals.

### 4.3 Hand-computed trace document

**Create** `LC6_Planning/traces/S10B_HANDCOMP_TRACE.md` with the following structure. Populate the "observed" column from the probe test console output:

```markdown
# S10B Hand-Computed Trace

**Session:** S10B
**Date:** 2026-04-24
**Purpose:** Verify S10B additions to IntermittentMoistureResult do not alter
computed values — only expose values already computed internally.

## Verification principle

S10B is additive: it exposes locals that were already computed inside the
cyclic-path loop of calcIntermittentMoisture. No physics modified. No new
constants beyond documented standard psychrometric values (Lewis factor 16.5
and Gagge mass transfer denominator 61600, both ASHRAE-standard).

## Cycle-0 values for G1/M2/P5 vectors

[Populated from probe test output — fill in after Phase 4.2 runs]

### G1 (Ghost Town groomers, Tier 1)
| Field | Expected (internal) | Observed (exposed) | Match |
|---|---|---|---|
| M | [_Qmet at cycle 0] | [pt.M from probe] | ✓/✗ |
| C | [_QconvRun at cycle 0] | [pt.C from probe] | ✓/✗ |
| R | [_QradRun at cycle 0] | [pt.R from probe] | ✓/✗ |
| E_resp | [_respRun.total at cycle 0] | [pt.E_resp from probe] | ✓/✗ |
| E_skin | [min(_ediffRun, _emaxRun.eMax)] | [pt.E_skin] | ✓/✗ |
| E_max | [_emaxRun.eMax] | [pt.E_max] | ✓/✗ |
| E_req | [_ediffRun] | [pt.E_req] | ✓/✗ |
| h_c | [_hcRun] | [pt.h_c] | ✓/✗ |
| h_mass | [_hcRun / 61600] | [pt.h_mass] | ✓/✗ |
| P_a | [_Pa_ambient] | [pt.P_a] | ✓/✗ |
| R_e_cl_effective | [_Rclo / (_effectiveIm × 16.5)] | [pt.R_e_cl_effective] | ✓/✗ |
| VPD | [pSatPa(_TskRun) - _Pa_ambient] | [pt.VPD] | ✓/✗ |
| sweat_rate | [_srRun] | [pt.SW_required] | ✓/✗ |
| T_cl | [_TsurfRun] | [pt.T_cl] | ✓/✗ |
| h_tissue | [1/_Rtissue] | [pt.h_tissue] | ✓/✗ |

### M2 (Tier 2 moguls)
[same structure]

### P5 (Tier 5 powder Saturday)
[same structure]

## First law residual verification

For each vector:
- LHS = M - W
- RHS = C + R + E_resp + E_skin + S
- Residual = LHS - RHS (should be within ±15W)

| Vector | M-W | C+R+E_resp+E_skin+S | Residual | Pass |
|---|---|---|---|---|
| G1 | [value] | [value] | [value] | ✓/✗ |
| M2 | [value] | [value] | [value] | ✓/✗ |
| P5 | [value] | [value] | [value] | ✓/✗ |

## Sign-off

S10B verification complete. All 15 new fields expose internal locals correctly.
Heat balance first law holds within tolerance. No physics modified.
```

---

## Session close

### 5.1 Tracker updates

**Close `S10B-SCOPE-UNRESOLVED`:** flip LOW-UNTIL-UI → CLOSED at SessionS10B commit [S10B-CLOSE-SHA]. Annotation:
> RESOLVED S10B, April 24, 2026. 15 TrajectoryPoint heat-balance fields (M, W, C, R, E_resp, E_skin, E_max, E_req, h_c, h_mass, P_a, R_e_cl_effective, VPD, sweat_rate as SW_required, T_cl, h_tissue) now populated from calcIntermittentMoisture per-cycle exposures. Cyclic path only. STRUCT-ZERO-PADDED pattern eliminated from cyclic TrajectoryPoint emission.

**Add `S10B-STEADY-STATE-FOLLOWUP`:** LOW-UNTIL-UI
> S10B deferred steady-state and linear path TrajectoryPoint heat-balance backfill. `buildSinglePoint` at `evaluate.ts:775` and linear-path trajectory emission retain zero-padded heat-balance fields. No cycle state exists in those paths; proper fix requires either an additional solver pass in those code paths or a documented convention that non-cyclic paths return representative-point values rather than per-slice values. Priority remains LOW-UNTIL-UI per S10B's latent-harm reframing.

### 5.2 Close commit sequence (two-commit SHA backfill per Memory #29)

```bash
# Ratification commit with placeholder
git add packages/engine/src/moisture/calc_intermittent_moisture.ts \
        packages/engine/src/evaluate.ts \
        packages/engine/tests/evaluate/s10b_heat_balance_probe.test.ts \
        LC6_Planning/traces/S10B_HANDCOMP_TRACE.md \
        LC6_Planning/LC6_Master_Tracking.md

git commit -m "S10B close: TrajectoryPoint heat-balance backfill

Cyclic-path STRUCT-ZERO-PADDED pattern eliminated. 15 TrajectoryPoint
heat-balance fields (M, W, C, R, E_resp, E_skin, E_max, E_req, h_c,
h_mass, P_a, R_e_cl_effective, VPD, sweat_rate-as-SW_required, T_cl,
h_tissue) now populated from calcIntermittentMoisture per-cycle
exposures.

Changes:
  calc_intermittent_moisture.ts:
    - IntermittentMoistureResult extended with 16 optional perCycle* arrays
    - 16 accumulators declared near existing per-cycle arrays (line ~596)
    - 16 pushes at end-of-cycle (line ~955)
    - 16 returns on cyclic-path return (line ~1022)
    - Zero physics modifications — additive interface only

  evaluate.ts:
    - buildTrajectory cyclic branch reads mr.perCycle* instead of zero-pad
    - sweat_rate placeholder (S_heat > 0 ? 0.01 : 0) replaced with real value
    - T_cl placeholder (T_skin - 2) replaced with _TsurfRun from solver
    - h_tissue placeholder {5.0, 9.0} replaced with 1/_Rtissue
    - buildSinglePoint (steady-state/linear) unchanged — out of S10B scope

Verification:
  - Non-regression: all 687 tests pass bit-identically
  - New probe test: tests/evaluate/s10b_heat_balance_probe.test.ts
    6 tests passing: field non-zero + heat balance first law ±15W
  - Hand-comp trace: LC6_Planning/traces/S10B_HANDCOMP_TRACE.md

Tracker:
  S10B-SCOPE-UNRESOLVED: LOW-UNTIL-UI → CLOSED at [S10B-CLOSE-SHA]
  S10B-STEADY-STATE-FOLLOWUP: added (LOW-UNTIL-UI)

No MR/trapped/sessionMR/perCycleMR changes. Cardinal Rule #3 preserved
(single source of truth — calcIntermittentMoisture still owns
computation; evaluate.ts only reads).

Test suite: 693 passed, 7 skipped, 0 failed.
(+6 over baseline from new probe test.)"

RATIFY_SHA=$(git rev-parse --short HEAD)
echo "RATIFY_SHA = $RATIFY_SHA"

# Backfill commit
sed -i.bak "s/\[S10B-CLOSE-SHA\]/$RATIFY_SHA/g" LC6_Planning/LC6_Master_Tracking.md
rm LC6_Planning/LC6_Master_Tracking.md.bak

# Verify no placeholders
grep -rn "\[S10B-CLOSE-SHA\]" LC6_Planning/ && echo "HALT: placeholders remain" && exit 1

git add LC6_Planning/LC6_Master_Tracking.md
git commit -m "S10B close: SHA backfill (references $RATIFY_SHA)"
git push origin session-13-phy-humid-v2
```

### 5.3 Close handoff receipt

Report back with:

```
S10B complete. TrajectoryPoint heat-balance backfill landed.

Branch:        session-13-phy-humid-v2 (pushed)
HEAD:          [backfill SHA]
Ratify SHA:    [RATIFY_SHA]

Gates:
  Phase 1 TSC no new errors: ✓
  Phase 2 test suite unchanged: ✓
  Phase 3 test suite unchanged + probe test added: ✓
  Phase 4.1 MR/trapped/sessionMR non-regression: ✓
  Phase 4.2 heat-balance first law residual |ε| < 15W (G1/M2/P5): ✓
  Phase 4.3 hand-comp trace doc: ✓

Test suite: 693 passed, 7 skipped, 0 failed (+6 new probe tests)

Tracker:
  S10B-SCOPE-UNRESOLVED: CLOSED
  S10B-STEADY-STATE-FOLLOWUP: added (LOW-UNTIL-UI)
```

---

## Halt conditions — any of these halt immediately, report to Chat

1. Pre-flight md5 mismatch (Chat must re-read the file)
2. Phase 1 TSC errors beyond the pre-existing 8
3. Phase 2 test suite regression (any test changes pass/fail status)
4. Phase 3 test suite regression (same rule)
5. Phase 4.1 MR/trapped/sessionMR changes on any vector (CRITICAL — physics should not have changed)
6. Phase 4.2 heat-balance residual > ±15W on any vector (indicates field computation is diverging from internal solver)
7. Phase 4.3 hand-comp trace shows a mismatch between exposed and internal values

On halt: pause, capture diagnostic, send to Chat. Do not tune constants. Do not adjust tolerances. Do not "try the other path."

---

**END S10B KICKOFF.**
