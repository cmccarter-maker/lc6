# S-UI-01 Session Kickoff — apps/web Scaffolding + First Engine Render

**Session ID:** S-UI-01
**Authored by:** Chat
**Date:** April 24, 2026
**Branch:** `session-13-phy-humid-v2` (continuing from S10B close HEAD `756b890`)
**Prerequisite HEAD:** `756b890`
**Estimated duration:** 2-3 hours

---

## Why this session exists

LC6 has a working, well-tested thermal engine at `packages/engine/`. 736 tests pass. Physics is verified. **Zero users can access it.** `apps/web/src/index.ts` is a 1-line placeholder. No framework. No component. No render loop. No way to run the engine from a browser.

"LC6 online" — the actual goal of the rebuild — is gated entirely on UI existing. Every engine improvement shipped between now and UI existence ships to no one.

**Win condition for S-UI-01:** You type `pnpm --filter @lc6/web dev`. A browser opens at localhost. You see a number on the page. That number is `result.trip_headline.peak_MR` from a real `evaluate()` call with a hardcoded Breck snowboarding input.

Not polished. Not styled. Not interactive. **One number on a page proving the engine-to-browser plumbing works end-to-end.** This is the first brick.

---

## Scope

### In scope

1. **Framework decision: Vite + React + TypeScript.** Reasoning:
   - Matches LC5 era's React experience (Christian's React fluency carries over)
   - Fast dev loop (Vite HMR vs Next.js SSR overhead we don't need)
   - Minimal config vs Next.js (no routing, no server actions, no edge runtime — we don't need any of those yet)
   - Plain Vite + React SPA is the simplest correct answer for "run engine in browser"

2. **Scaffold `apps/web/`** with:
   - `package.json` — `@lc6/web` with Vite 5, React 18, `@lc6/engine` workspace dep
   - `vite.config.ts` — React plugin, dev server on default port
   - `tsconfig.json` — extends nothing (standalone; will converge with shared config later if needed)
   - `index.html` — minimal entry point
   - `src/main.tsx` — React 18 root mount
   - `src/App.tsx` — one component that calls `evaluate()` and renders the result

3. **Install dependencies** via `pnpm install` at repo root (pnpm workspaces resolve `@lc6/engine` automatically from `packages/engine/`)

4. **Verify dev server runs** (`pnpm --filter @lc6/web dev`). Browser opens. A number appears.

5. **Root `package.json` script addition** — add `"dev:web": "pnpm --filter @lc6/web dev"` for convenience

6. **Commit** the scaffolding as a single ratification commit. No two-commit SHA backfill needed (no tracker updates reference the commit SHA — this is a greenfield session).

### Out of scope

- **Tracker updates.** S-UI-01 adds no new tracker items and closes none. SessionA cataloged `apps/web/` as SKELETON; S-UI-01 begins populating it but doesn't close that status. Leave status updates for a future SessionA-follow-up or infrastructure session.
- **Input forms.** The `evaluate()` input is hardcoded. Interactive input is S-UI-02+.
- **Styling.** No CSS beyond what's necessary for visibility. Black text on white background is fine.
- **Routing.** Single page. No React Router.
- **State management.** No Redux, Zustand, or Context. Local component state only.
- **Tests.** No UI tests. `apps/web/package.json` test script stays `echo 'web: no tests yet'` for now. UI testing strategy is a separate session decision.
- **Gear DB integration.** Hardcoded gear items inline in the component, same pattern as `tests/evaluate/evaluate.test.ts` `makeBreckInput`. Real gear DB consumption is `@lc6/gear-api` territory (itself a ghost package per SessionA).
- **Error handling.** If `evaluate()` throws, let the browser surface the error. No try/catch wrapping for S-UI-01.

### Pre-flight (Code executes)

```bash
cd ~/Desktop/LC6-local

# 1. Verify branch state
git status --short
git log --oneline -3
# Expected: HEAD at 756b890 (S10B close backfill), clean working tree
# plus possibly S30 tooling artifacts untracked (unchanged)

# 2. Verify workspace config present
ls -la package.json pnpm-workspace.yaml
cat pnpm-workspace.yaml
# Expected: packages/* and apps/* entries

# 3. Confirm current apps/web state (should be 2-file placeholder)
ls -la apps/web/
cat apps/web/package.json
cat apps/web/src/index.ts 2>/dev/null
# Expected: package.json @lc6/web 0.1.0, src/index.ts 1-line placeholder

# 4. Confirm engine package identity
cat packages/engine/package.json | head -5
# Expected: "@lc6/engine", "0.1.0"

# 5. Report back
echo "S-UI-01 pre-flight complete."
```

**Pre-flight gate:** branch clean at `756b890`, workspace config present, apps/web exists as placeholder, engine package name is `@lc6/engine`.

---

## Phase 1 — Expand `apps/web/package.json`

**Target file:** `apps/web/package.json`

**Current content:**
```json
{
  "name": "@lc6/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "echo 'web: no tests yet'",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

**Replace with:**
```json
{
  "name": "@lc6/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "echo 'web: no tests yet'",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lc6/engine": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

**Why these versions:**
- React 18.3 — latest stable React 18, matches types. React 19 is available but brings breaking changes we don't need; 18 is the tested-in-production version LC5 era is likely familiar with.
- Vite 5.4 — latest stable
- `@vitejs/plugin-react` 4.3 — matches Vite 5
- `@lc6/engine` as `workspace:*` — pnpm workspace protocol, resolves to local `packages/engine/`

**No other files edited in Phase 1. Run `pnpm install` yet.**

### Phase 1 verification

```bash
cd ~/Desktop/LC6-local
pnpm install 2>&1 | tail -20
# Expected: resolution success, @lc6/engine linked from workspace,
# React + Vite installed into apps/web/node_modules (or hoisted to root)

# Confirm the workspace link worked
ls -la apps/web/node_modules/@lc6/engine 2>/dev/null | head -3
# Expected: symlink pointing to ../../../packages/engine
# (Or, if pnpm hoists: check pnpm ls instead)
pnpm --filter @lc6/web ls --depth 0 2>&1 | head -20
# Expected: lists react, react-dom, @lc6/engine, typescript, vite, etc.

# Report Phase 1 status
```

**Phase 1 gate:** `pnpm install` succeeds, `@lc6/engine` is linked from workspace, no peer-dep warnings severe enough to block.

**Halts if:**
- `pnpm install` fails with dependency resolution errors
- `@lc6/engine` not resolvable from `apps/web`
- Node/pnpm version mismatch against `engines` field in root package.json

---

## Phase 2 — Create `apps/web/tsconfig.json` and `apps/web/vite.config.ts`

### 2.1 Create `apps/web/tsconfig.json`

**New file:** `apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

**Why these settings:**
- `moduleResolution: "bundler"` — Vite's recommended mode; handles `@lc6/engine`'s `.js` import extensions (the engine file tree has `from './validate.js'` patterns that are TypeScript under the hood)
- `jsx: "react-jsx"` — modern React JSX transform (no need to `import React` in every file)
- `strict: true` — matches engine's discipline
- `noEmit: true` — Vite handles output, tsc just typechecks

### 2.2 Create `apps/web/vite.config.ts`

**New file:** `apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
```

Minimal config. Default port 5173 (Vite convention). `strictPort: false` means if 5173 is taken, Vite picks the next available.

### Phase 2 verification

```bash
cd ~/Desktop/LC6-local

# Typecheck should run (won't find errors yet — no src files with React)
pnpm --filter @lc6/web typecheck 2>&1 | tail -5
# Expected: no errors, or "error TS6059" about no input files
#   (harmless — we haven't authored src/App.tsx yet)

# Verify vite.config parses
cat apps/web/vite.config.ts
cat apps/web/tsconfig.json | head -10

# Report Phase 2 status
```

**Phase 2 gate:** files exist, no TS parse errors in config files.

---

## Phase 3 — Create `apps/web/index.html` and `apps/web/src/main.tsx`

### 3.1 Create `apps/web/index.html`

**New file:** `apps/web/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LayerCraft v6</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 3.2 Create `apps/web/src/main.tsx`

**New file:** `apps/web/src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Standard React 18 mount. `StrictMode` on for development double-render check. Import uses `.js` extension per TypeScript convention for ESM modules (Vite handles the `.tsx` lookup).

### 3.3 Remove legacy `apps/web/src/index.ts`

The 2-line placeholder at `apps/web/src/index.ts` is no longer needed — `main.tsx` is the entry point. Remove it.

```bash
rm apps/web/src/index.ts
```

### Phase 3 verification

No running verification in this phase — files are inputs to Phase 4 which does the actual App.tsx authoring and dev-server run. Just confirm files exist:

```bash
ls -la apps/web/src/
# Expected: main.tsx exists, index.ts removed
ls -la apps/web/index.html
# Expected: exists
```

---

## Phase 4 — Create `apps/web/src/App.tsx` — the one component

This is the component that proves the plumbing works. It constructs a hardcoded `EngineInput` (copied from `tests/evaluate/evaluate.test.ts` `makeBreckInput`), calls `evaluate()`, and renders `peak_MR`.

**New file:** `apps/web/src/App.tsx`

```typescript
import { evaluate } from '@lc6/engine';
import type {
  EngineInput,
  WeatherSlice,
  GearEnsemble,
  EngineGearItem,
} from '@lc6/engine';

// ═══════════════════════════════════════════════════════════════════════════
// Hardcoded test input — Breck snowboarding 16°F 6hrs
// Replicated from packages/engine/tests/evaluate/evaluate.test.ts makeBreckInput.
// S-UI-01 scope: prove plumbing. S-UI-02+ will replace with user input form.
// ═══════════════════════════════════════════════════════════════════════════

const COLD_WEATHER: WeatherSlice = {
  t_start: 0,
  t_end: 21600,
  temp_f: 16,
  humidity: 45,
  wind_mph: 10,
  precip_probability: 0,
};

function makeGearItem(
  slot: EngineGearItem['slot'],
  clo: number,
  im: number,
): EngineGearItem {
  return {
    product_id: `test-${slot}`,
    name: `Test ${slot}`,
    slot,
    clo,
    im,
    fiber: 'synthetic',
  };
}

const BRECK_ENSEMBLE: GearEnsemble = {
  ensemble_id: 'breck-test',
  label: 'Breck Snowboarding Kit',
  items: [
    makeGearItem('base', 0.3, 0.4),
    makeGearItem('mid', 0.5, 0.35),
    makeGearItem('insulative', 0.8, 0.25),
    makeGearItem('shell', 0.3, 0.15),
    makeGearItem('legwear', 0.5, 0.3),
    makeGearItem('footwear', 0.4, 0.2),
    makeGearItem('headgear', 0.2, 0.3),
    makeGearItem('handwear', 0.3, 0.25),
  ],
  total_clo: 2.5,
  ensemble_im: 0.25,
};

const BRECK_INPUT: EngineInput = {
  activity: {
    activity_id: 'snowboarding',
    duration_hr: 6,
    date_iso: '2026-02-03',
    snow_terrain: 'groomers',
    segments: [
      {
        segment_id: 'seg-1',
        segment_label: 'Breck Groomers',
        activity_id: 'snowboarding',
        duration_hr: 6,
        weather: [COLD_WEATHER],
      },
    ],
  },
  location: {
    lat: 39.48,
    lng: -106.07,
    elevation_ft: 9600,
  },
  biometrics: {
    sex: 'male',
    weight_lb: 180,
  },
  user_ensemble: BRECK_ENSEMBLE,
};

// ═══════════════════════════════════════════════════════════════════════════
// App component — runs evaluate() once on mount, renders result
// ═══════════════════════════════════════════════════════════════════════════

export function App() {
  // Synchronous call — evaluate() is pure and fast enough to run at render time.
  // If it throws, the error bubbles to React's error boundary (the browser
  // surfaces it). S-UI-01 does NOT wrap in try/catch per scope.
  const result = evaluate(BRECK_INPUT);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 720 }}>
      <h1 style={{ margin: 0 }}>LayerCraft v6</h1>
      <p style={{ color: '#666', marginTop: 4 }}>
        Engine smoke test — Breck snowboarding, 16°F, 6 hours
      </p>

      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 14, color: '#666' }}>Peak MR</div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1 }}>
          {result.trip_headline.peak_MR.toFixed(2)}
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: '#f5f5f5',
          borderRadius: 4,
          fontSize: 13,
          fontFamily: 'monospace',
        }}
      >
        <div>engine_version: {result.engine_version}</div>
        <div>peak_HLR: {result.trip_headline.peak_HLR.toFixed(2)}</div>
        <div>peak_CDI: {result.trip_headline.peak_CDI.toFixed(2)}</div>
        <div>
          peak_clinical_stage: {result.trip_headline.peak_clinical_stage}
        </div>
        <div>
          trajectory length:{' '}
          {result.four_pill.your_gear.trajectory.length} points
        </div>
        <div>
          IREQ feasible:{' '}
          {String(result.ireq_summary.user_ensemble_feasible)}
        </div>
      </div>
    </div>
  );
}
```

**Design notes:**
- Inline styles only. No CSS file. Minimum viable visual.
- Renders `peak_MR` prominently + a diagnostic block with 6 more values (engine_version, peak_HLR, peak_CDI, clinical stage, trajectory length, IREQ feasibility). Gives you enough to confirm the engine actually ran vs. just returning a default.
- `.toFixed(2)` for MR/HLR/CDI display — engine returns numbers with varying precision; 2-decimal display is readable.
- Import from `@lc6/engine` top-level, not `@lc6/engine/src/evaluate.js` — this exercises the package's public API (engine's `package.json` `"main": "./src/index.ts"` resolves `@lc6/engine` to `src/index.ts`).

### Phase 4 verification

```bash
cd ~/Desktop/LC6-local

# Typecheck the web app
pnpm --filter @lc6/web typecheck 2>&1 | tail -10
# Expected: 0 errors

# Typecheck the engine still passes (S-UI-01 didn't touch it, but confirm)
pnpm --filter @lc6/engine typecheck 2>&1 | tail -10
# Expected: 0 errors (same S27 baseline, unchanged)

# Run engine test suite to confirm no regression
pnpm --filter @lc6/engine test 2>&1 | tail -5
# Expected: 736 passed, 7 skipped, 0 failed (unchanged from S10B close)

# START THE DEV SERVER
pnpm --filter @lc6/web dev 2>&1 &
# Expected: "VITE v5.x ready in XXX ms"
#   "➜  Local:   http://localhost:5173/"

# Check it's listening
sleep 3
curl -s http://localhost:5173/ | head -20
# Expected: HTML with <div id="root"></div> and <script src="/src/main.tsx">
```

### Browser verification (manual, Christian)

Open `http://localhost:5173/` in a browser. You should see:

1. **"LayerCraft v6"** header
2. **"Engine smoke test — Breck snowboarding, 16°F, 6 hours"** subtitle
3. **Big number** — peak MR, 2 decimal places
4. **Diagnostic block** with engine_version, peak_HLR, peak_CDI, clinical stage, trajectory length, IREQ feasibility

If you see the number, S-UI-01's win condition is met. LC6 is online in the weakest sense.

If the page errors (white screen, red React error overlay), kill the dev server and report the error. Halt condition.

### Stop the dev server after verification

```bash
# Find and kill the vite process
pkill -f "vite" 2>/dev/null
# Or: find in jobs list
jobs
kill %1
```

---

## Phase 5 — Root `package.json` convenience script

**Target:** root `package.json` (at `~/Desktop/LC6-local/package.json`)

**Find:**
```json
  "scripts": {
    "test": "pnpm -r test",
    "test:engine": "pnpm --filter @lc6/engine test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  },
```

**Replace with:**
```json
  "scripts": {
    "test": "pnpm -r test",
    "test:engine": "pnpm --filter @lc6/engine test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "dev:web": "pnpm --filter @lc6/web dev"
  },
```

Convenience only — lets you run `pnpm dev:web` from the repo root.

### Phase 5 verification

```bash
cd ~/Desktop/LC6-local
pnpm dev:web 2>&1 &
sleep 3
curl -s http://localhost:5173/ | head -5
pkill -f "vite" 2>/dev/null
```

---

## Phase 6 — Session close

### 6.1 Single commit (no SHA backfill needed — no tracker references)

S-UI-01 adds no tracker items that self-reference the commit SHA, so the two-commit backfill pattern doesn't apply. Single commit suffices.

```bash
cd ~/Desktop/LC6-local

# Check what's changed
git status --short

# Expected new/modified files:
#   modified:  apps/web/package.json
#   new file:  apps/web/tsconfig.json
#   new file:  apps/web/vite.config.ts
#   new file:  apps/web/index.html
#   new file:  apps/web/src/main.tsx
#   new file:  apps/web/src/App.tsx
#   deleted:   apps/web/src/index.ts
#   modified:  package.json              (dev:web script added)
#   modified:  pnpm-lock.yaml            (React + Vite deps locked)

git add apps/web/package.json \
        apps/web/tsconfig.json \
        apps/web/vite.config.ts \
        apps/web/index.html \
        apps/web/src/main.tsx \
        apps/web/src/App.tsx \
        apps/web/src/index.ts \
        package.json \
        pnpm-lock.yaml

git commit -m "S-UI-01: apps/web scaffolding + first engine render

LC6 UI layer begins. apps/web was a 2-line placeholder; this session
scaffolds it as a Vite + React + TypeScript single-page app and renders
one engine output (peak_MR) in a browser.

Framework: Vite 5.4 + React 18.3 + TypeScript 5.6.
Entry: apps/web/src/main.tsx → App.tsx.
Engine consumption: imports evaluate() from @lc6/engine (pnpm workspace
link), calls it with hardcoded Breck snowboarding input (copied from
tests/evaluate/evaluate.test.ts makeBreckInput), renders result.trip_
headline.peak_MR + diagnostic block.

Win condition met: pnpm --filter @lc6/web dev serves at localhost:5173,
browser displays peak MR as a number. Plumbing engine-to-browser proven.

Out of scope for S-UI-01 (deferred to S-UI-02+):
  - Interactive input form (hardcoded input for now)
  - Styling / design system
  - Routing
  - State management
  - UI tests
  - Gear DB integration via @lc6/gear-api
  - Error boundaries

Non-regression: engine test suite unchanged (736 passed, 7 skipped,
0 failed). Engine physics untouched.

Files:
  apps/web/package.json       — expanded with React, Vite, @lc6/engine deps
  apps/web/tsconfig.json      — new, strict mode, bundler resolution
  apps/web/vite.config.ts     — new, React plugin
  apps/web/index.html         — new, minimal entry
  apps/web/src/main.tsx       — new, React 18 root mount
  apps/web/src/App.tsx        — new, one component, renders peak_MR
  apps/web/src/index.ts       — removed (legacy 1-line placeholder)
  package.json                — dev:web convenience script added
  pnpm-lock.yaml              — React + Vite deps locked

Memory #13 preserved: all artifacts Chat-authored, Code-executed verbatim.
Cardinal Rules preserved: no engine physics touched; no fudge factors;
single source of truth (engine owns computation, web only renders)."

git push origin session-13-phy-humid-v2
```

### 6.2 Verify push

```bash
git log origin/session-13-phy-humid-v2..HEAD --oneline
# Expected: empty (push succeeded)

git log -3 --oneline
# Expected: S-UI-01 commit on top, then S10B backfill (756b890),
#           then S10B ratification (1450801)
```

---

## Session close receipt

After push, Code reports:

```
S-UI-01 complete. LC6 UI layer begun; peak MR rendering in browser.

Branch:        session-13-phy-humid-v2 (pushed to origin)
HEAD:          [S-UI-01 commit SHA]
Commits this session: 1 (single commit, no SHA backfill needed)

Framework: Vite 5.4 + React 18.3 + TypeScript 5.6
Entry:     http://localhost:5173/ (pnpm dev:web or pnpm --filter @lc6/web dev)

Win condition: peak_MR rendered in browser ✓
  displayed value: [peak_MR from Breck snowboarding 16°F 6hr]
  trajectory length: [X] points
  IREQ feasible: [true/false]

Files added: 6 new, 2 modified, 1 deleted
Test suite: 736 passed, 7 skipped, 0 failed (unchanged)
Engine physics untouched.

Next: S-UI-02 (interactive input form) or infrastructure cleanup.
```

---

## Halt conditions

Halt immediately and report to Chat if any of these occur:

1. **`pnpm install` fails** with unresolvable deps or workspace-link errors
2. **`@lc6/engine` not resolvable** from `apps/web/` after install
3. **Typecheck errors** in `apps/web` beyond missing files (unused imports, type mismatches)
4. **Engine test suite regresses** (any test changes pass/fail status — S-UI-01 must not touch engine physics)
5. **Dev server fails to start** (port conflict beyond `strictPort: false`, Vite config error)
6. **Browser shows red React error overlay** or white screen (import failures, runtime errors in `evaluate()`)
7. **Peak MR displays as `NaN`, `undefined`, or suspicious value** (suggests engine call failed silently)

On halt: capture full error output, pause before any fix attempts, report to Chat. Do not tune constants. Do not expand scope. Do not alter the engine.

---

**END S-UI-01 KICKOFF.**
