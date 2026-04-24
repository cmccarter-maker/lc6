# SA_Failure_Mode_Catalog

**Session:** SessionA (LC6 State-of-the-Port audit)
**Authored by:** Chat
**Date:** April 23, 2026
**HEAD:** `ccd7995`
**Scope:** Catalog of documented instances where ratified work was re-proposed, drift went undetected, handoff missed context, or scope crept. Not exhaustive — goal is pattern identification, target ~30 incidents or saturation (5 consecutive incidents producing no new category).

**Companion document:** `SA_LC6_State_of_the_Port.md` (Output A).
**Amendment history:** Post-S31 amendment pre-enumerated 5 S31 incidents. Per SessionA midpoint §7.3, S31-B and S31-D are consolidated here as S31-BD.

---

## 1. Category legend

Categories refined during catalog authoring. Original amendment proposed 9 categories; this catalog confirms usage for the subset that actually surfaces, adds one new category (`FABRICATED-METHODOLOGY`), and notes categories that did not surface (not-observed does not mean not-occurring).

| Category | Pattern | Example trigger |
|---|---|---|
| MEMORY-OVERRIDE | Chat used memory as authoritative when ratified source existed | "Per my memory, X is Y" when tracker/spec says otherwise |
| FIRST-PRINCIPLES-DRIFT | Chat re-derived from scratch what was already derived | Proposing an architecture while the actual code is readable |
| COMMENT-AS-DIRECTIVE | Chat adopted user off-hand comment as new rule when ratified version existed | "You mentioned X earlier" as override of spec |
| SCOPE-CREEP | Chat expanded session scope beyond what kickoff specified | Authoring SessionB artifacts during SessionA |
| UNRATIFIED-INVENTION | Chat filled a data/spec gap with "starting values" instead of flagging GAP | Hand-typed gear values in spec §9 |
| **FABRICATED-METHODOLOGY** | **Chat invented a procedural rule / threshold / decision tree with no derivation, presented as if derived** | **File-count audit-depth tiers (≤5 / 5-20 / 20+)** |
| STALE-CONTEXT | Chat acted on context that was superseded | Treating LC5 screenshots as current LC6 product state |
| DUAL-SOURCE-CONFUSION | Chat worked from one source when another was canonical | Filename says RATIFIED but registry says REVERTED |
| OPTIONS-MENU-DRIFT | Chat proposed A/B/C/D options when ratified answer existed | Posing architectural options when the file is readable |
| RESEARCH-BYPASS | Chat proposed research on a question already answered by cited source | "Let me investigate X" when X is documented in tracker |

Categories in **bold** added during this session. Others are from the post-S31 amendment.

---

## 2. Catalog structure

Incidents are organized chronologically within each session, oldest first. Each incident has:
- **ID:** SessionIncident-letter
- **Session:** S## where the incident occurred
- **Incident:** what Chat proposed or did (one sentence)
- **Ratified source missed:** what document/decision already answered this
- **Handoff gap:** what the session kickoff, memory, or tracker did NOT surface that it should have
- **Category:** one or more pattern tags from §1
- **Time cost estimate:** rough — hours, half-session, or full session
- **Remediation signal:** what infrastructure change (hinting at SessionB scope) would prevent this

---

## 3. Incidents

### 3.1 S31-A — Synthesized gear values in spec §9 verification vectors

- **Session:** S30 (spec authoring) / surfaced in S31 pre-Phase-A
- **Incident:** Spec §9.2 named four real gear SKUs (Merino 200 LS crew, Patagonia R1 Air Hoody, Patagonia Nano Puff Hoody, Arc'teryx Beta LT) but hand-typed per-layer CLO/im/cap values rather than querying the gear DB. Synthesized values produced verification targets (G1 2.6, M2 4.3, P5 5.5) that diverged 2-3× from real-DB engine output.
- **Ratified source missed:** 1,627-product gear DB with real SKUs available by lookup (memory #12). Cardinal Rule #1 requires every value trace to published source, derivation, or explicit GAP. Memory #30 (original V15 lesson, now consolidated into verification-anchors memory) on "calibrating to ghosts."
- **Handoff gap:** No spec-authoring checklist enforces "verification vectors bind to real DB entries." Spec Registry does not validate gear-value provenance during ratification. Memory captured the adjacent V15 lesson but did not surface it automatically during S30 spec authoring.
- **Category:** UNRATIFIED-INVENTION
- **Time cost:** ~4 hours (spec v1 → v1.1 → v1.2 arc, probe test authoring, baseline re-capture)
- **Remediation signal:** spec-authoring checklist or templated spec-verification section with hard requirement "cite product_id, not CLO value."

### 3.2 S31-BD — Architecture theorizing / factual claims without reading code (consolidated)

- **Session:** S31 mid-session, adjacent turns
- **Incident:** When asked "where does `ventEvents` come from?", Chat produced three theoretical architectures (Option X/Y/Z) and debated them, when the answer was readable from `evaluate.ts:487` directly. Earlier in the same session, Chat stated "the engine at HEAD is not computing pacing in `calcIntermittentMoisture`" as factual, when in fact `ventEvents` is a function parameter at `calc_intermittent_moisture.ts:249` consumed at three call sites inside the engine body. Both failures share the same pattern: substitute reasoning for reading.
- **Ratified source missed:** The engine file itself. Both claims resolved by ~3 minutes of file reading.
- **Handoff gap:** No default-to-read-before-theorize rule explicit in working agreement (and `LC6_Working_Agreement.md` does not exist per Output A §2.7). Chat's rhetorical pattern rewards explanation over verification.
- **Category:** FIRST-PRINCIPLES-DRIFT (both halves)
- **Time cost:** ~45 minutes combined
- **Remediation signal:** explicit "read code before reasoning about code" rule, or structural prompt pattern that forces file read before architectural claim.

### 3.3 S31-C — LC5 screenshot misread as current LC6 product state

- **Session:** S31 mid-session
- **Incident:** Christian provided LC5 UI screenshots showing MR 0.5 "Best Outcome" vs MR 6.1 "Your Gear." Chat interpreted these as current LC6 product state and redesigned spec §9 around four-pill verification. Christian intervention: "you do realize that the numbers I gave you in my screen shots are broken, correct?" — the screenshots were from the LC5 buggy era that motivated the LC6 rebuild.
- **Ratified source missed:** Memory context flags LC5 as the pre-LC6-rebuild era with documented MR bugs as the reason for LC6 existence (memory #3, #14, #18). Screenshots timestamped to LC5 file paths should be treated as historical-bug-era unless context says otherwise.
- **Handoff gap:** No explicit rule for "uploaded images should cite their era/version when not obvious." Chat defaulted to treating images as current product state without provenance check.
- **Category:** STALE-CONTEXT
- **Time cost:** ~30 minutes
- **Remediation signal:** image-context-citation rule; or LC-version-tagged filenames in uploads.

### 3.4 S31-E — Verification gate anchored to current-engine output

- **Session:** S30 spec authoring
- **Incident:** Spec §9 v1 authored sessionMR targets (2.6/4.3/5.5) as verification anchors. Even if gear values had been real-DB, these targets would have anchored the S31 implementation gate to the engine's *current* (unverified, multi-bug-affected) output. Same class of error as the V15 "calibrating to ghosts" lesson. Would have silently calibrated S31 patch-correctness criteria to the ghosts of prior-cycle bugs.
- **Ratified source missed:** V15 lesson explicitly captured in memory #30 (now consolidated into verification-anchors): "Spec §-numbered gates are BLOCKING. Must clear with evidence BEFORE the gated step. Never calibrate new engine to old fudge snapshots."
- **Handoff gap:** Memory captured the V15 lesson but did not surface automatically during S30 spec authoring. Chat applied the lesson retroactively after Christian intervention at S31 baseline capture.
- **Category:** UNRATIFIED-INVENTION (subtler form — process-level inference from untrusted data)
- **Time cost:** ~2 hours (spec v1 → v1.1 rewrite of §9 to patch-correctness gates)
- **Remediation signal:** surface the V15 verification-anchor memory automatically whenever a spec defines verification targets; or template spec §9 with explicit "pre-reconciliation baseline captured at commit X" placeholder that cannot be filled without the capture step.

### 3.5 SA-FAB-001 — Invented audit-depth decision rule

- **Session:** SessionA (this session), Step 12 authoring
- **Incident:** When directing Code to audit `apps/web/`, Chat wrote a "decision rule based on output" specifying three file-count tiers (≤5 files → ghost playbook, 5-20 → moderate-depth, 20+ → engine playbook). The numbers had no justification — pulled from Chat's head as plausible-sounding cutoffs. Christian challenged: "Seems like it could be a fudge factor." Chat confirmed: same shape as S31-A synthesis, transplanted into audit methodology. Three-tier framing created illusion of rigor; in practice all three tiers converge on the same underlying audit.
- **Ratified source missed:** No ratified audit methodology existed. But the Cardinal Rule #1 prohibition on "starting values" generalizes beyond data: process rules without derivation are fabricated-methodology. The parallel to spec authoring was not drawn by Chat until Christian pointed it.
- **Handoff gap:** No explicit rule extending "no fudge factors" into process/methodology domain. No incident pattern previously named for methodology fabrication (prior to this catalog).
- **Category:** **FABRICATED-METHODOLOGY** (new)
- **Time cost:** ~15 minutes (caught mid-turn, corrected in next turn)
- **Remediation signal:** formalize no-fudge discipline as applying to methodology/thresholds/decision-trees, not only data/constants. Possibly add Cardinal-Rule-scale prohibition.

### 3.6 S31-CODE-COMPOSITION — Code authoring original artifacts through SessionA

- **Session:** SessionA (this session), Steps 6 through 12
- **Incident:** Code composed row proposals for `gear-api`, `shared`, `apps/web` package tables; drafted tracker item text refinements (`S9C-HEADER-COMMENT-STALE` reframe, `GHOST-PACKAGES-AND-MISSING-API` umbrella item); proposed pattern taxonomy (GHOST-PACKAGE as sub-pattern distinction). Chat accepted these compositions as drafted. Christian caught mid-session: "Why are you not writing and giving to Code? Do we not have rules?" Chat violated Memory #13 ("Code receives ONLY exact surgical code verbatim. Code NEVER works autonomously. Chat produces ALL code. No exceptions."). Chat extended the rule in its own head to mean "engine TypeScript" and treated docs/tables/tracker text as a different category, which is not what the rule says.
- **Ratified source missed:** Memory #13 directly.
- **Handoff gap:** "Code" in Memory #13 was not defined precisely enough to survive re-interpretation. Chat drifted toward "Code composes documentation, Chat composes TypeScript" as a false distinction. No structural guard against this drift.
- **Category:** MEMORY-OVERRIDE (Chat re-interpreted an unambiguous memory entry) + SCOPE-CREEP (Code operated outside its rule-defined scope)
- **Time cost:** soft — each Code composition was individually small but accumulated over ~8 Steps. Call it ~90 minutes of drift time, plus the correction turn.
- **Remediation signal:** Memory #13 rewording to be explicit: "Any repo artifact — code, docs, tables, tracker text, commit messages — Chat writes, Code executes verbatim." Possibly a Cardinal-Rule scale entry.

### 3.7 S31-SPEC-VERSION-CHURN — Spec v1 → v1.1 → v1.2 within single session

- **Session:** S30 authoring + S31 pre-Phase-A rewrites
- **Incident:** PHY-031-CYCLEMIN-RECONCILIATION went from DRAFT → RATIFIED v1 (S30) → RATIFIED v1.1 (S31 pre-Phase-A, §9 rewritten for real gear) → RATIFIED v1.2 (S31 Phase A pre-commit, §9.5 narrowed for respiratory extension). Three ratifications in 24 hours for the same spec. Final v1.2 is correct, but the path to it was expensive.
- **Ratified source missed:** No single source missed — this is a cascade downstream of S31-A (synthesized gear) + S31-E (calibrating to ghosts). But the churn itself is a distinct failure mode worth cataloging.
- **Handoff gap:** No checkpoint between "ratification" and "implementation-phase gate capture" that surfaces authoring errors before ratification locks them in. Ratification treats the moment as final; first implementation-phase run is effectively the validation.
- **Category:** Cascade of S31-A + S31-E, but also OPTIONS-MENU-DRIFT (the v1 → v1.1 transition presented Christian with a/b/c options that were, on examination, artifacts of Chat's own failure to bind real data — not genuine options)
- **Time cost:** ~6 hours combined (two-revision cycle plus kickoff amendment propagation)
- **Remediation signal:** ratification check: "all verification vectors runnable at ratification time" should be a precondition, not a post-condition. Prevents ratifying-before-running.

### 3.8 SESSION-10B-TODO-INVISIBLE — Deferred scope in source comments invisible to tracker

- **Session:** Accumulated across multiple sessions predating S28
- **Incident:** `evaluate.ts:10` header declares "Session 10a scope: Steps 1-4 … Steps 5-8: placeholders for Session 10b." ~12 TrajectoryPoint fields in `:605-740` emit as literal zeros with `TODO-SUPPLEMENTARY` markers. No `S10B-SCOPE-UNRESOLVED` or equivalent tracker entry existed prior to SessionA. The deferred work was invisible to the tracker's Section G grep list. If `apps/web` had been populated, STRUCT-ZERO-PADDED fields would have surfaced as display bugs — but they would not have been pre-surfaced as a tracker concern.
- **Ratified source missed:** Per Memory #29 (session-close discipline): "Memory advisory, tracker canonical." Deferred-scope markers in source should flow to tracker. They didn't.
- **Handoff gap:** No session-close step captures "any new `TODO-NEXT-SESSION` or similar deferred markers added to source during the session." Session 10a closure didn't propagate the 10b deferral to a tracker item.
- **Category:** MEMORY-OVERRIDE (source-comment scope claims treated as authoritative when tracker should have been) + SCOPE-CREEP variant (deferral without owner is a form of scope escape)
- **Time cost:** months of invisibility. Surfaced by SessionA Step 8 only.
- **Remediation signal:** session-close checklist item: "enumerate source-comment deferrals added this session; create tracker items for each."

### 3.9 SESSION-9C-HEADER-STALE — Completed work with stale comment claiming incompleteness

- **Session:** Session 9c (per comment) or intervening. Completion date unknown.
- **Incident:** `calc_intermittent_moisture.ts:6-7` comment states "Steady-state and linear paths stubbed (β1 throw)." Both paths are in fact fully implemented at `:313` (steady-state PHY-039B) and `:1338` (linear self-contained). Session 9c (or intervening) landed the work; the file header was never updated. Audit logic that trusted file headers would conclude work is incomplete. SessionA Step 9 had to read dispatch code to resolve.
- **Ratified source missed:** Tracker has no record of 9c completion. Registry has no entry for PHY-039B. File header contradicts code. Three places the correct state should be visible — all silent or wrong.
- **Handoff gap:** Session close does not enforce file-header-comment update. No convention says file-header scope comments must be current (or must not exist at all).
- **Category:** DUAL-SOURCE-CONFUSION (file header vs actual code) + MEMORY-OVERRIDE (header comment treated as authoritative when dispatch code should have been)
- **Time cost:** One SessionA step (~10 minutes) to resolve. Could have caused significant confusion for any SessionA variant that took headers at face value.
- **Remediation signal:** session-close checklist item: "any file-header scope comment touched this session, update or delete." Or: SessionB infrastructure decision to prohibit file-header scope comments entirely.

### 3.10 PHY-039B-DRIFT-4 — Ratified-by-comment physics with no spec file

- **Session:** Unknown (physics landed in an unidentified session pre-S28)
- **Incident:** `calc_intermittent_moisture.ts:313-~408` is ~95 lines of live steady-state physics labeled `STEADY-STATE FALLBACK (PHY-039B, self-contained)` in a single inline comment. No spec file exists at `LC6_Planning/specs/`. No Spec Registry row. Serves activities resolving to `profile = null` (at minimum bouldering, camping; likely climbing, hunting, skateboarding, onewheel, cross_country_ski, golf generic). This is the second confirmed instance of the DRIFT-family pattern (first was pre-S28 PHY-031 situation).
- **Ratified source missed:** Not a "missed source" — the source doesn't exist. This is the inverse: physics shipped without any ratified design.
- **Handoff gap:** No CI guard or registry validation catches "commit references `PHY-XXX` but no `LC6_Planning/specs/PHY-XXX_Spec_vN_RATIFIED.md` exists." Two confirmed instances (PHY-031 pre-S28, PHY-039B currently) suggest this is recurring.
- **Category:** DUAL-SOURCE-CONFUSION (code cites spec, but spec doesn't exist) + UNRATIFIED-INVENTION (physics implemented without ratified design)
- **Time cost:** unknown accumulated cost — physics has been in production for months without ratification review.
- **Remediation signal:** SessionB infrastructure: grep hook or CI check for `PHY-XXX` comments against `LC6_Planning/specs/` file presence. Or: require all commits touching physics to include the spec file reference.

### 3.11 GHOST-PACKAGES-SCHEDULED-FOR-LATER — Deferred packages without scheduling

- **Session:** Unknown (packages scaffolded pre-S28)
- **Incident:** `@lc6/gear-api` and `@lc6/shared` are 2-line placeholder packages with no consumers, no tests, and header comments "placeholder. Implementation in later session" / "cross-package types placeholder." The "later session" has no tracker scheduling, no owner, no session-name. `apps/api/` is not even scaffolded — pre-scaffolding state. Real implementations of both nominal concerns (gear DB adapter, cross-package types) have settled inside `@lc6/engine` and are not being extracted.
- **Ratified source missed:** Tracker should name scheduling for all placeholder packages. Two packages have been in this state long enough to be forgotten rather than deferred.
- **Handoff gap:** No convention for placeholder packages. If placeholders are a legitimate pattern, they should have a tracker item naming scheduling. If they're not, they shouldn't be committed.
- **Category:** SCOPE-CREEP variant (scaffolding without owner) + UNRATIFIED-INVENTION (placeholder as "plausible future home" without ratified intent)
- **Time cost:** accumulated repo overhead; zero functional cost.
- **Remediation signal:** SessionB decision: fill, absorb, or delete. Architectural rule: placeholder packages require a tracker item naming scheduling and owner.

### 3.12 LC6-WORKING-AGREEMENT-ABSENT — Governing doc doesn't exist

- **Session:** Ambient condition across all LC6 sessions
- **Incident:** Original SessionA kickoff §Required-reads lists `LC6_Planning/LC6_Working_Agreement.md` conditionally ("if present"). It is not present. Session protocol (two-agent discipline, Cardinal Rules, halt-and-escalate, tracker canonical) is scattered across memory entries, spec §0 conventions, and ad-hoc session kickoffs. No single governing document exists.
- **Ratified source missed:** No source to miss — the source doesn't exist.
- **Handoff gap:** Without a working agreement, Chat's re-interpretation of Memory #13 (as in 3.6 above) had no authoritative grounding document to resolve against. Memory alone proved insufficient.
- **Category:** DUAL-SOURCE-CONFUSION variant (no canonical source means any interpretation claims authority)
- **Time cost:** ambient — contributes to multiple incidents above.
- **Remediation signal:** SessionC authors `LC6_Working_Agreement.md`. This is the explicit SessionC deliverable per three-session arc.

---

## 4. Saturation check

Target was ~30 incidents or 5 consecutive producing no new category. After 12 incidents:

**Categories observed:**
- UNRATIFIED-INVENTION (3.1, 3.4 subtler form, 3.10 variant, 3.11 variant)
- FIRST-PRINCIPLES-DRIFT (3.2 consolidated)
- STALE-CONTEXT (3.3)
- **FABRICATED-METHODOLOGY** (3.5 — new category this session)
- MEMORY-OVERRIDE (3.6, 3.8 variant, 3.9 variant)
- SCOPE-CREEP (3.6 second category, 3.8 variant, 3.11 variant)
- OPTIONS-MENU-DRIFT (3.7)
- DUAL-SOURCE-CONFUSION (3.9, 3.10, 3.12)

**Categories proposed in legend but not observed in these 12 incidents:**
- COMMENT-AS-DIRECTIVE
- RESEARCH-BYPASS

**Saturation status:** Last 5 incidents (3.8 through 3.12) all map to categories already observed. Saturation reached at 12. Halting catalog per kickoff §Output-B incident-cap rule.

Absence of COMMENT-AS-DIRECTIVE and RESEARCH-BYPASS in observed incidents does not mean those patterns don't occur in LC6 history. SessionA's incident sample is biased toward S28-S31 history (the most recent + memory-accessible) and may miss older instances. SessionB may surface more.

---

## 5. Pattern observations across the catalog

Three super-patterns connect multiple categories:

### 5.1 Chat substitutes plausible structure for actual derivation

Incidents 3.1, 3.4, 3.5, 3.7 all share this shape. Whether the substitution is data (gear values), process (file-count tiers), anchors (sessionMR targets), or versioning behavior (ratify-before-run), the underlying failure is the same: Chat generates plausible-looking content without grounding it in a verifiable source.

Remediation signal cluster: forcing-function prompts at authoring boundaries (spec §9 must cite product_ids; audit methodology must cite derivation; verification must run before ratification).

### 5.2 Chat substitutes reasoning for reading

Incidents 3.2 (consolidated S31-BD) and to a lesser extent 3.3, 3.9 share this shape. When a fact is readable from a file or an image's provenance, Chat generates architectural speculation or assumption instead.

Remediation signal cluster: read-before-reason default, especially for claims about code or uploaded artifacts.

### 5.3 Deferred scope is invisible unless forced into the tracker

Incidents 3.8, 3.9, 3.10, 3.11 share this shape. Work gets deferred via source comments ("Session 10b will do this"), file headers ("β1 throw"), package placeholders ("later session"), or spec citations ("PHY-039B self-contained") — none of which propagate to the tracker. Deferred work then drifts invisibly for months.

Remediation signal cluster: session-close step that enumerates all deferrals added during the session and creates tracker items for each. Also: no file-header scope comments at all, rely on tracker + spec registry only.

### 5.4 Absence-of-governance amplifies individual failures

Incident 3.12 is the structural backdrop for 3.6 and several others. Without a single canonical working agreement, Memory #13's rule proved vulnerable to re-interpretation. Without ratified spec-authoring conventions, S31-A's synthesis didn't halt at a checkpoint. Without a checklist for session close, 3.8/3.9/3.11's deferrals slipped through.

Remediation signal cluster: this is the explicit SessionC deliverable (handoff-process spec / working agreement). SessionA and SessionB lead into it.

---

## 6. Input to SessionB

Output B's four super-patterns (§5.1 through §5.4) suggest SessionB's infrastructure-review scope should prioritize:

1. **Authoring-boundary forcing functions** — spec templates, audit templates, ratification preconditions (addresses §5.1)
2. **Read-before-reason tooling** — workflow prompts that require file reads before claims-about-code (addresses §5.2)
3. **Deferral-to-tracker automation** — session-close enumeration of source comments containing scope deferrals (addresses §5.3)
4. **Working Agreement authoring** — SessionC primary deliverable, but SessionB may pre-scope its content requirements (addresses §5.4)

SessionB is not bound to these four; Output B is input, not directive. SessionB may add, cut, reshape. This is the handoff per three-session arc.

---

## 7. Tracker items surfaced by this catalog

Four new tracker items implied by the catalog, distinct from Output A's four:

1. **`METHODOLOGY-FUDGE-PROHIBITION`** — LOW-to-MEDIUM — Extend "no fudge factors" Cardinal Rule #1 from data/constants to methodology/thresholds/decision-trees. Candidate Cardinal-Rule-scale entry for SessionC working agreement. Source: incident 3.5.

2. **`MEMORY-13-REWORD`** — LOW — Memory #13 "Code receives ONLY exact surgical code verbatim" proved re-interpretable. Candidate reword: "Any repo artifact — code, docs, tables, tracker text, commit messages — Chat writes, Code executes verbatim." Source: incident 3.6.

3. **`RATIFICATION-PRECONDITION-RUNNABLE`** — MEDIUM — Spec ratification should require "all verification vectors runnable at ratification time" as a precondition. Would have caught S31-A, S31-E at S30 close rather than S31 mid-session. Source: incident 3.7.

4. **`DEFERRAL-TO-TRACKER-AUTOMATION`** — MEDIUM — Session-close checklist item: enumerate source-comment deferrals added during the session; create tracker items for each. Would have prevented S10B-SCOPE-UNRESOLVED and S9C-HEADER-COMMENT-STALE invisibility. Source: incidents 3.8, 3.9, 3.10, 3.11.

---

## 8. What Output B is NOT

Per kickoff §What-this-session-is-NOT:

- **Not a SessionB infrastructure spec.** §6 is input, not scope.
- **Not a Working Agreement.** SessionC's job.
- **Not a Cardinal-Rule modification.** §7.1's proposal is a tracker candidate, not a ratification.
- **Not a comprehensive historical census.** Incidents are pattern-identification sample, not incident-database.
- **Not a personnel review.** "Chat" in incidents refers to the agent role, not the individual instance. Same failure pattern would occur across instances without structural change.

---

## 9. Session close dependencies

SessionA close needs:

1. Both Output A and Output B committed to `LC6_Planning/audits/`
2. Four tracker items from Output A §6 added to `LC6_Master_Tracking.md`
3. Four tracker items from Output B §7 added to `LC6_Master_Tracking.md`
4. Registry updated: no spec ratifications in SessionA, so Registry row changes are limited to tracker pointers (if any)
5. SessionB kickoff drafted with Output B as primary input
6. Commit clean, pushed
7. `S31-APPLIED` marker already present from S31 close; this session does not add an S31-specific marker but does add a `SESSION-A-APPLIED` marker and "Status as of SessionA" block

Close handoff document (authored by Chat, executed by Code) follows this turn.

---

**END SA_Failure_Mode_Catalog.**
