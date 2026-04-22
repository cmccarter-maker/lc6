# Session A Kickoff — LC6 State of the Port Audit

**Created:** S28 close, April 21, 2026
**Session type:** Chat-led audit + Code-executed greps
**Sequence position:** First of three infrastructure sessions (A → B → C)
**Branch:** whatever is current; audit produces no code changes
**Reading time:** ~15 minutes before proposing any work

---

## STOP. Before doing anything, read these first:

1. This entire kickoff doc
2. `LC6_Planning/LC6_Master_Tracking.md` — top status block through end of Session 27 historical record (read until "Historical record — Session 26")
3. `LC6_Planning/LC6_Spec_Registry.md` (full file)
4. `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` (full file — this is the most recently ratified spec, useful as a reference for what "done" looks like in the registry)
5. The three most recent session kickoffs: `S28_kickoff.md`, and whichever two preceded it — to see the pattern of what sessions have been doing
6. `LC6_Planning/LC6_Working_Agreement.md` (if present — the governing session protocol)

Do NOT start auditing, greping, or producing tables until these 6 reads are complete. Total ~15 minutes. Skipping reads is the exact failure mode this session exists to catalog — don't demonstrate it in the kickoff.

---

## Why this session exists

Christian's S28 framing, verbatim:

> "What has happened is work arounds, not following rules and suggesting work to replace work that has already been performed. We have lost weeks doing this and I feel we are stagnant... there are multiple items which did not port or are not wired or are not being used as I have been told. Can we look at what was working in LayerCraft 5, what wasn't working, what was identified but not developed, what wasn't scoped but not implemented. All this to say I don't want to continue to re-do work."

S28 itself demonstrated the failure mode in real time — Chat re-proposed ratified LC5 work multiple times despite being handed a kickoff that cited it. User intervention redirected each instance, but each redirect cost time and attention. This audit produces the visibility needed so that pattern can be designed out of the next handoff system.

---

## Session scope

**Produce two documents. Both markdown. Both committed to `LC6_Planning/audits/`.**

### Output A: `SA_LC6_State_of_the_Port.md`

Cross-sectional snapshot of what exists in LC6 today, across all packages, with honest port status. Target format: one table per package.

**Packages to audit (confirm actual list with Code at session open; below is best understanding from S28 context):**

- `packages/engine/` — physics core
- `packages/gear-api/` — gear database adapter
- `apps/web/` — web UI (Christian has flagged this as largely empty)
- `apps/api/` — backend services (if present)
- `packages/engine/tests/` — test coverage as an honesty check on the above

**Status vocabulary (reuse the Spec Registry's vocabulary for consistency):**

| Status | Meaning |
|---|---|
| ACTIVE | Runs and produces verified sensible output. Test coverage exists. |
| PARTIAL | Runs but has known gaps, underestimation, or missing pieces. |
| SKELETON | File/function exists but body is stub/placeholder. |
| NULL-PLUGGED | Wiring exists but the value is hardcoded null/default (like `evaluate.ts:430` pre-S29). |
| MISSING | Referenced elsewhere (imports, comments, docs) but does not exist. |
| UNKNOWN | Cannot verify from audit alone — needs deeper investigation. |

**Table columns (per package):**

| Column | Content |
|---|---|
| Module / file | path relative to package root |
| Status | from vocabulary above |
| Evidence | commit SHA where status can be verified, or test file path, or "audit-only" |
| LC5 origin | was this ported from LC5? If yes, from which file/function? |
| Gap summary | one sentence on what's missing (if PARTIAL/SKELETON/NULL-PLUGGED/MISSING) |
| Owner (session) | which session ported it, or which session is targeted to port it |

**Cap: one page per package.** If a package needs more than a page, bucket by subsystem rather than listing every file.

### Output B: `SA_Failure_Mode_Catalog.md`

Catalog of documented instances where ratified work was re-proposed, drift went undetected, handoff missed context, or scope crept. Not exhaustive — the goal is pattern identification, capped at ~30 incidents.

**Sources to pull from:**

- Session ledgers (every session closure)
- Master Tracking Section B (open items that tracked drift or re-work)
- Spec Registry drift items (S27-DRIFT-1, -2, -3)
- Session handoff docs where Christian had to redirect Chat
- Surfaced chats (via `conversation_search`) for in-session redirects

**Table columns:**

| Column | Content |
|---|---|
| Session | S## where the incident occurred |
| Incident | what Chat proposed or did |
| Ratified source missed | what document/decision already answered this (cite file + section) |
| Handoff gap | what the session kickoff or memory or tracker did NOT surface that it should have |
| Category | pattern tag (see below) |
| Time cost estimate | rough — hours or "half-session" or "full session" |

**Category tags (draft — refine during audit):**

- `MEMORY-OVERRIDE` — Chat used memory as authoritative when ratified source existed
- `FIRST-PRINCIPLES-DRIFT` — Chat re-derived from scratch what was already derived
- `COMMENT-AS-DIRECTIVE` — Chat adopted user off-hand comment as new rule when ratified version existed
- `SCOPE-CREEP` — Chat expanded session scope beyond what kickoff specified
- `UNRATIFIED-INVENTION` — Chat filled a gap with "starting values" instead of flagging GAP
- `STALE-CONTEXT` — Chat acted on context that was superseded (e.g. LC5 post-Cascade-v4 vs LC5 ratified vs LC6)
- `DUAL-SOURCE-CONFUSION` — Chat worked from one source when another was canonical (filename says RATIFIED but registry says REVERTED)
- `OPTIONS-MENU-DRIFT` — Chat proposed A/B/C/D options when ratified answer existed
- `RESEARCH-BYPASS` — Chat proposed research pass on question already answered by cited source

Target: ~30 incidents or until pattern saturates. If five incidents in a row produce no new category, stop — saturation reached.

---

## What this session is NOT

- Not a code change (no engine edits, no test unlocks, no spec authoring beyond the two audit docs)
- Not a new infrastructure proposal (that's Session B)
- Not a redesign of the handoff process (that's Session C)
- Not UI scoping (explicitly deferred by Christian S28 close: *"Not the UI… that is a curiosity and does nothing to further progress currently"*)
- Not a comprehensive incident census (the catalog is for pattern identification, not completeness)

---

## Success criteria for Session A

Session closes cleanly when:

1. `SA_LC6_State_of_the_Port.md` exists at `LC6_Planning/audits/`, committed
2. Every LC6 package has a status table
3. Every row has an Evidence cell populated (no blank or "TBD")
4. `SA_Failure_Mode_Catalog.md` exists at `LC6_Planning/audits/`, committed
5. At least 15 incidents cataloged, pattern saturation reached or 30 hit
6. Tracker updated: `S30-APPLIED` marker, "Status as of Session 30" block, two new references to the audit outputs
7. Session B kickoff drafted with the failure catalog as its primary input
8. Commit clean, pushed, log shows chain intact

Expected session length: 3 hours. Chat spends ~45 min on reads, Code spends ~45 min on greps, Chat spends ~60 min synthesizing, close-out ~30 min.

---

## Critical context to preserve — DO NOT LOSE

### 1. User's non-negotiables

- "Do not let me override work already done" — if user makes a comment that appears to conflict with ratified work, Chat stops, checks the ratified source, reports back, does NOT silently adopt the comment
- Minimize user input — system infers from ambient signals where possible
- No fudge factors — every constant traces to (a) published source, (b) derivation, or (c) explicit GAP flag
- Thermal engine is LOCKED (Cardinal Rule #8) — no touches without Chat-produced code + hand-computed verification

### 2. The three-session arc

- Session A (this one): audit — produces A + B
- Session B (next): review existing infrastructure against B's catalog, decide what to keep/cut/redesign
- Session C (after B): produce new handoff-process spec

Each session produces a deliverable the next session consumes. Do not combine sessions. Do not skip ahead.

### 3. What Session A is NOT allowed to propose

- A new handoff template (Session C's job)
- A new kickoff format (Session C's job)
- Infrastructure changes to Working Agreement, tracker, or registry (Session B's job after catalog review)
- A "ratified values index" (Session C's decision, after Session B)

If Chat finds itself drafting any of the above during Session A, that IS an incident — log it in Output B as SCOPE-CREEP and stop.

### 4. Expected biases to counter

Based on S28's demonstrated failures, Session A's Chat is likely to:

- Over-count ACTIVE modules (optimistic bias)
- Under-count NULL-PLUGGED cases (they're invisible without greps)
- Miss incidents from sessions the Chat doesn't remember well
- Propose fixes during audit (scope creep into Session B territory)

Counter: **Code runs the greps, not Chat.** Chat synthesizes output Code produces. Chat does not speculate on module status without evidence.

---

## 8 Cardinal Rules (LOCKED — unchanged from S28)

1. No fudge factors. Every constant traces to (a) published source, (b) derivation, or (c) explicit GAP flag.
2. `im_ensemble` drives evaporation, NOT CLO.
3. Single source of truth = canonical engine output object.
4. No hardcoded constants in display.
5. Wind chill = display only, never model input.
6. No double-dipping.
7. `T_skin` computed from heat balance, never assumed constant.
8. Thermal engine is LOCKED. Env-guarded diagnostic logging is SAFE.

Additional rules (not numbered, equally binding):

- Strategy winner = MR-min subject to feasibility gates. CDI < 4.0 is a safety gate.
- Microclimate VP reverted (double-counting with `im_ensemble`).
- Helmet rule: NEVER recommend removing helmet.
- Denali safety gate: 15,000 ft.

---

## Two-Agent Discipline (LOCKED — unchanged from S28)

Chat writes exact commands for Code. Code runs them verbatim, reports output, does not proceed without explicit authorization.

**For this session specifically:**

- Chat produces grep/find commands. Code runs them. Code pastes output. Chat synthesizes.
- Chat NEVER writes "these modules are probably ACTIVE" without grep evidence.
- Code NEVER infers status from file presence alone — needs to actually look inside.
- When Chat says "run this grep, STOP and paste output," Code stops and pastes. Does not apply patches. Does not scan additional files. Stops.

---

## Open Questions for Session A — resolve with user BEFORE starting the audit

1. **Scope of packages.** Is the package list above (`engine`, `gear-api`, `apps/web`, `apps/api`) complete? Confirm at session open via Code: `ls ~/Desktop/LC6-local/packages/ ~/Desktop/LC6-local/apps/`.

2. **Test files — count as separate audit row or roll up?** Each engine module has a test file. Option A: audit tests separately (second table column). Option B: roll test status into the module row ("ACTIVE + tested" vs "ACTIVE + 0 tests"). Recommend Option B for conciseness unless user prefers otherwise.

3. **Historical LC5 comparison depth.** Output A has a "LC5 origin" column. Option A: cite by file+function. Option B: also include a "LC5 status at time of port" note (was the LC5 version ACTIVE, already-buggy, newly-revised, etc.). Recommend Option A — depth beyond that is over-scope.

4. **Incident cap for Output B.** 30 stated. Do we hard-stop at 30 or go longer if patterns haven't saturated? Recommend saturation rule wins (stop when 5 incidents in a row produce no new category, even if before 30).

5. **User review at session midpoint.** Long session. Worth scheduling a midpoint check-in where Chat presents Output A's first draft before starting Output B? Or let Chat run straight through and review at close? Recommend midpoint check-in — catches audit bias early.

---

## Opening move for Session A Chat

After reading all 6 required documents above, first message to user:

> "Session A kickoff read complete. Understanding: audit produces Output A (State of the Port, one table per package) + Output B (failure-mode catalog, ~30 incidents). No code changes, no infrastructure proposals, no handoff redesign — those are Sessions B and C. 5 open questions need user input before starting the audit (package list confirmation, test rollup, LC5 depth, incident cap, midpoint checkpoint). Which do you want to tackle first, or should I propose defaults?"

This pattern — state understanding, identify decisions needed, propose path — is the correct Chat opening move. NOT "let me start auditing" or "I'll figure out questions as I go."

---

## References

- `LC6_Planning/LC6_Master_Tracking.md` (canonical tracker)
- `LC6_Planning/LC6_Spec_Registry.md`
- `LC6_Planning/specs/PHY-031_Spec_v1_RATIFIED.md` (most recent ratified spec; template reference)
- `LC6_Planning/session_kickoffs/S28_kickoff.md` (previous kickoff; format reference)
- `LC6_Planning/session_kickoffs/S29_kickoff.md` (if produced during S29)
- `LC6_Planning/audits/S27_PHY-031_PORT_STATUS_AUDIT.md` (audit format reference — not exhaustive, but shows the table-based style)

---

End of Session A kickoff. Next Chat: follow the opening move above.
