# S10B Kickoff Amendment #1 — Line Number + Type Corrections

**Purpose:** Update the original S10B_kickoff.md for the actual current state of `packages/engine/src/moisture/calc_intermittent_moisture.ts` (1,399 lines, md5 `8f75328ca16087a31db803fcfb3ce98b`). Chat initially authored S10B against an earlier 1,118-line version. File grew by 281 lines during S31 (4-phase decomposition + rest-phase integration). Structure intact, line numbers shifted, and one type bug found in the original authoring.

**Applies to:** `LC6_Planning/session_kickoffs/S10B_kickoff.md` sections Pre-flight through Phase 4.
**Does not apply to:** Phase 5 close sequence (file-independent) or halt conditions (file-independent).

**Apply as:** addendum file alongside original at `LC6_Planning/session_kickoffs/S10B_kickoff_amendment_1.md`. Original kickoff retains its structural authority; this amendment supersedes line numbers and the one type fix.

---

## 1. Corrected line numbers for `calc_intermittent_moisture.ts` (1,399 lines)

| Kickoff section | Original line | Actual line | Delta |
|---|---|---|---|
| IntermittentMoistureResult closing brace | ~186 | 188 | +2 |
| Accumulator declaration site (near `_perCycleTSkin`) | ~596 | 601 | +5 |
| Push block (near `_perCycleMR.push`) | ~950 | 1228 | +278 |
| Cyclic return open brace | ~1022 | 1304 | +282 |
| `endingLayers:` return line | ~1054 | 1336 | +282 |
| RUN-phase locals scope | 642-700 | 957-984 | +315 |

All locals named in the original kickoff Phase 2.2 exist at identical names in the updated file. Only positions changed.

---

## 2. Type bug fix in Phase 2.2 pushes

**Original kickoff (incorrect):**
```typescript
_perCycleSweatRate.push(Math.round(_srRun * 100000) / 100000);
```

**Actual shape of `_srRun`:** per file line 979, `_srRun = computeSweatRate(_eReqRun, _emaxRun.eMax)` returns `{sweatGPerHr, qEvapW}` — object, not scalar.

**Unit check:** the TrajectoryPoint interface (from types.ts inspection) defines `SW_required` in g/s. `_srRun.sweatGPerHr` is g/hr. Conversion: divide by 3600.

**Corrected push line (replaces the original):**
```typescript
_perCycleSweatRate.push(Math.round((_srRun.sweatGPerHr / 3600) * 100000) / 100000);
```

Rounding convention preserved (5 decimals at g/s scale). No physics change — `_sweatRateRunGhr = _srRun.sweatGPerHr` is already being used at line 980; we're just exposing the same quantity in g/s units.

---

## 3. Corrected Phase 1 edit location

**Original kickoff said:** append fields after `perStepTrapped?: number[];` at line 185, before closing brace at line 186.

**Actual current state:** `perStepTrapped?: number[];` is at line 187; closing brace `}` is at line 188.

**Updated instruction:**
- Locate `perStepTrapped?: number[];` at line 187
- Immediately after that line (before the `}` at line 188), insert the 16 new optional field declarations from original kickoff Phase 1
- Closing brace stays at what becomes line ~204 after insertion

The content block (16 new optional field declarations) is unchanged from original kickoff Phase 1.

---

## 4. Corrected Phase 2.1 declaration site

**Original kickoff said:** append after `const _perCycleTSkin: number[] = [];` at line 596.

**Actual current state:** that declaration is at line 601.

**Updated instruction:**
- Locate `const _perCycleTSkin: number[] = [];` at line 601
- Immediately after that line, insert the 16 new accumulator declarations from original kickoff Phase 2.1
- Content unchanged; only site line number changes

---

## 5. Corrected Phase 2.2 push site

**Original kickoff said:** append after `_perCycleTSkin.push(Math.round(_TskRun * 10) / 10);` near line 955.

**Actual current state:** that push is at line 1235.

**Updated instruction:**
- Locate `_perCycleTSkin.push(Math.round(_TskRun * 10) / 10);` at line 1235
- Immediately after that line (before the PHY-031-CYCLEMIN-RECONCILIATION comment at line 1237), insert the new push block from original kickoff Phase 2.2
- **Apply the one-line fix from §2 above:** `_perCycleSweatRate.push(Math.round((_srRun.sweatGPerHr / 3600) * 100000) / 100000);`
- All other 15 pushes unchanged from original kickoff Phase 2.2

---

## 6. Corrected Phase 2.3 return site

**Original kickoff said:** insert new return fields before `endingLayers:` at line 1054, before closing `};` at line 1055.

**Actual current state:** `endingLayers:` line is at 1336; closing brace `};` at line 1337.

**Updated instruction:**
- Locate `endingLayers: _layers.map(l => ({ im: l.im, cap: l.cap, buffer: l.buffer, wicking: l.wicking, fiber: l.fiber, name: l.name })),` at line 1336
- Immediately after that line (before the `};` at line 1337), insert the 16 return field lines from original kickoff Phase 2.3
- Content unchanged

---

## 7. Phase 3 (`evaluate.ts`) — no changes

`evaluate.ts` md5 matched Chat's upload (`cad1a046a0b8383543d52cec1f8e9b7b`). All Phase 3 line numbers in the original kickoff remain correct. No amendment needed for Phase 3.

---

## 8. Phase 4 — no changes

Phase 4 is gate/verification code, not location-dependent. Probe test and hand-comp trace doc unchanged.

---

## 9. Phase 5 close sequence — no changes

Commit messages, tracker updates, push protocol all unchanged. Original Phase 5 remains authoritative.

---

## 10. Substantive check — do the new fields still make sense?

Confirmed by re-reading the current file:

- `_Qmet`, `_QconvRun`, `_QradRun`, `_respRun.total`, `_ediffRun`, `_emaxRun.eMax`, `_hcRun`, `_Pa_ambient`, `_Rclo`, `_effectiveIm`, `_srRun`, `_TsurfRun`, `_Rtissue`, `_TskRun` — all exist at identical names, computed within the RUN phase (lines 962-984), in scope at the push site (line 1235).
- The 4-phase loop structure (line/lift/transition/run) added during S31 does not invalidate these locals — they remain RUN-phase quantities, which is the same end-of-cycle convention the original kickoff specified.
- Heat balance first-law residual (`M - W ≈ C + R + E_resp + E_skin + S`) still makes sense. `_cumStorageWmin` accumulates storage across all 4 phases now, but the per-cycle push captures RUN-phase snapshot, consistent with other per-cycle pushes (`_TskRun`, `_TsurfRun` are both RUN-phase values).

Conclusion: substantive S10B design is intact. Only location deltas and the one type bug are affected.

---

## 11. Impact on Phase 4 probe test tolerance

The heat-balance first-law residual `|ε| < 15W` tolerance was set without knowledge that S31's 4-phase loop means `S_heat` in TrajectoryPoint represents cycle-averaged storage across all 4 phases, while `M`/`C`/`R`/`E_resp`/`E_skin` come from RUN-phase only.

**Concern:** if M/C/R/E are RUN-phase values but S is cycle-averaged across all phases, the first-law check `M - W = C + R + E_resp + E_skin + S` may residual more than 15W because the LHS and RHS reference different time windows.

**Mitigation options:**
- **(a)** Widen tolerance to ±30W and document that the 4-phase decomposition averaging adds noise to the first-law check
- **(b)** Expose RUN-phase-only storage from `calc_intermittent_moisture.ts` (new field `perCycleSHeatRun`) so probe test can use matched-scope values
- **(c)** Run the probe test and see what residual actually is; tune based on evidence not speculation

**Chat recommendation: (c).** No fudge factors. If residual is >15W, we diagnose why with the actual numbers in hand, not preemptively widen tolerance. If residual is >15W because of genuine scope mismatch (RUN-phase LHS vs cycle-averaged RHS), we expose the RUN-phase storage as (b) rather than widen tolerance.

**Operational impact:** Phase 4.2 may halt with residual >15W on first run. If it does, halt per kickoff §Halt conditions and report actual residual. Chat then evaluates whether it's (b) scope-mismatch-fixable or a real physics leak.

---

## 12. Execution continuation

After Code reads this amendment:

1. Apply Phase 1 at corrected line 187-188 insertion site
2. Apply Phase 2.1 at corrected line 601 insertion site
3. Apply Phase 2.2 at corrected line 1235 insertion site, with the `_srRun.sweatGPerHr / 3600` fix
4. Apply Phase 2.3 at corrected line 1336 insertion site
5. Phase 3, 4, 5 unchanged from original kickoff

All gates, halt conditions, and commit protocol from original kickoff remain in force.

---

**END S10B KICKOFF AMENDMENT #1.**
