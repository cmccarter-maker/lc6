# S-DEPLOY-01 Session Kickoff — Netlify Production Deploy (lc6alpha)

**Session ID:** S-DEPLOY-01
**Authored by:** Chat
**Date:** April 24, 2026
**Branch:** `session-13-phy-humid-v2` (continuing from S-UI-02a close HEAD `705f2ae`)
**Prerequisite HEAD:** `705f2ae`
**Estimated duration:** 30-45 minutes

---

## Why this session exists

LC6 has a working interactive UI. Anyone with the codebase can run `pnpm dev:web` and see four pills, a trajectory chart, and an interactive form. **Anyone without the codebase cannot.** Showing LC6 to anyone — friend, advisor, prospective user — currently requires them to clone the repo and run a dev server. That's not a real product surface; it's a developer demo.

Netlify deploy puts LC6 at a stable URL behind a password gate. After tonight, you can share `https://lc6alpha.netlify.app` (or whatever Netlify assigns) plus the password, and someone gets the actual app. That's the bar between "code project" and "thing you can show people."

**Win condition:** `https://lc6alpha.netlify.app` (or the assigned URL) prompts for a password. Enter password → LC6 loads in the browser. Form pre-populated with Breck snowboarding defaults. Click Run with different inputs → page updates correctly. Console clean. The deployment is real and stable; closing the browser and reopening still works.

---

## Scope

### In scope

1. **Build verification (local).** Run `pnpm --filter @lc6/web build` to verify the production bundle compiles cleanly. This exercises a different code path than `pnpm dev` (TypeScript strict-mode emission, asset bundling, tree-shaking).

2. **Production-build smoke test (local).** After build, serve `apps/web/dist/` locally with a simple static server and verify the app renders identically to the dev-server output. Catches build-time issues before deploy.

3. **Browser-side deploy via Netlify drag-drop.** Christian drags `apps/web/dist/` onto the Netlify drop zone. Site name: `lc6alpha`. URL: `https://lc6alpha.netlify.app` (or Netlify-assigned random subdomain if `lc6alpha` is taken).

4. **Password protection setup.** Configure site-level password protection in the Netlify dashboard (browser-side, ~1 min). Same password as existing `layercraftbeta` deployment, or new password — Christian's choice.

5. **Live URL smoke test.** Christian opens the deployed URL, enters password, verifies the app loads and is interactive. Test the form (change a few inputs, click Run, verify pills + chart update).

6. **Optional: commit deployment artifact.** If we want a record of what was deployed, the build output's commit SHA can be embedded in the bundle. **Skipping this for tonight** — adds scope without changing the deploy outcome.

### Out of scope

- **CI/CD via GitHub integration.** A future deploy session would connect the LC6 repo to Netlify so pushes auto-deploy. Tonight is manual drag-drop only.
- **`netlify.toml` build configuration.** Required only if Netlify is doing the build server-side. We're building locally and uploading the output, so no Netlify build config needed.
- **CLI authentication / `netlify deploy`.** Browser drag-drop is sufficient for tonight; CLI saves time on subsequent deploys but adds setup overhead now.
- **Custom domain.** `lc6alpha.netlify.app` is fine for tonight. Custom domain (e.g., `alpha.layercraft.app`) is a separate browser-side configuration session.
- **Build optimization.** Whatever Vite produces by default is fine. No code-splitting tuning, no manual chunk strategy, no bundle-analyzer pass.
- **Engine modifications.** Zero. Cardinal Rule #8 untriggered.
- **UI changes.** Zero. We deploy what's already in `705f2ae`.
- **Tracker updates.** Tracker hygiene is a separate session (Option B from earlier discussion).

---

## Pre-flight (Code executes)

```bash
cd ~/Desktop/LC6-local

# 1. Verify branch state
git status --short
git log --oneline -3
# Expected: HEAD at 705f2ae (S-UI-02a close), clean working tree
# (S30 tooling artifacts pre-existing untracked — unchanged)

# 2. Verify the build script exists in apps/web/package.json
grep -A 1 '"build"' apps/web/package.json
# Expected: "build": "tsc && vite build"

# 3. Confirm we don't have a stale apps/web/dist/ from a prior build
ls -la apps/web/dist 2>&1 | head -5
# Expected: "No such file or directory" OR an old dist that we'll overwrite

# 4. Verify pnpm has all deps installed
pnpm --filter @lc6/web ls --depth 0 2>&1 | head -20
# Expected: react, react-dom, vite, recharts, @lc6/engine all listed

# 5. Report back
echo "S-DEPLOY-01 pre-flight complete."
```

**Pre-flight gate:** branch clean at `705f2ae`, build script present, deps installed.

**Halts if:**
- Branch is not at `705f2ae` clean
- Build script missing or different than expected
- Deps not installed (run `pnpm install` if so)

---

## Phase 1 — Production build

```bash
cd ~/Desktop/LC6-local

# Run the production build for apps/web
pnpm --filter @lc6/web build 2>&1 | tee /tmp/lc6_build.log
```

### What the build does

`apps/web/package.json` defines `"build": "tsc && vite build"`:

1. **`tsc` step** — typechecks the apps/web codebase under strict mode (the same typecheck we've been running, but now in a build context). With `noEmit: true` in `apps/web/tsconfig.json`, this produces no output files; it only fails if there are type errors.

2. **`vite build` step** — bundles `apps/web/src/main.tsx` and all transitive imports (including `@lc6/engine` from the workspace) into static files in `apps/web/dist/`. Output is HTML, JS chunks, CSS, and a manifest.

### Phase 1 verification

```bash
# Build output should exist
ls -la apps/web/dist/
# Expected: index.html, assets/ subdirectory with .js and .css files
# Typical output is 1 HTML file + 3-6 JS/CSS files in assets/

# Index.html should reference bundled assets
cat apps/web/dist/index.html
# Expected: <link> tag for CSS, <script type="module"> tag for JS,
# both pointing to /assets/index-<hash>.{js,css}

# Bundle size check (informational, not a gate)
du -sh apps/web/dist/
# Expected: something in the 500KB-2MB range. Recharts is heavy;
# React 18 is moderate; LC6 engine is moderate. 1MB-ish is reasonable.

# More detailed file listing
find apps/web/dist -type f -exec ls -lh {} \; 2>&1 | head -10
```

### Phase 1 gate

**Passes if:**
- `pnpm --filter @lc6/web build` exits 0
- `apps/web/dist/` exists with `index.html` and `assets/` subdirectory
- `index.html` references bundled CSS and JS
- No TypeScript errors during `tsc` step

**Halts if:**
- TypeScript errors (likely failure modes documented in §Likely failure modes below)
- Vite bundle errors (rare but possible — usually import resolution issues)
- Empty `dist/` or missing `index.html`

---

## Phase 2 — Local production-build smoke test

The bundle compiled — but does it actually work in the browser? `pnpm dev` and `vite build` exercise different code paths. We verify the production bundle locally before uploading anything to Netlify.

```bash
cd ~/Desktop/LC6-local

# Simple static server using Vite's preview command
# This serves the production build (apps/web/dist/) on port 4173 by default
pnpm --filter @lc6/web preview > /tmp/vite_preview.log 2>&1 &
PREVIEW_PID=$!
sleep 4

# Server startup
tail -10 /tmp/vite_preview.log
# Expected: "Local: http://localhost:4173/" (Vite's default preview port)

# HTTP smoke
curl -s -o /dev/null -w "Root HTML: %{http_code}\n" http://localhost:4173/
# Expected: 200

# Verify production bundle contains expected symbols (transpiled)
curl -s http://localhost:4173/ > /tmp/prod_root.html
grep -E '<script|<link.*rel="stylesheet"' /tmp/prod_root.html | head -5
# Expected: <script type="module" src="/assets/index-<hash>.js"></script>
# Expected: <link rel="stylesheet" href="/assets/index-<hash>.css">

# Get the JS bundle URL and verify it loads
JS_URL=$(grep -oE '/assets/index-[^"]*\.js' /tmp/prod_root.html | head -1)
curl -s -o /dev/null -w "JS bundle ($JS_URL): %{http_code}\n" "http://localhost:4173$JS_URL"
# Expected: 200

# Verify the JS bundle contains expected LC6 symbols (transpiled, possibly minified)
curl -s "http://localhost:4173$JS_URL" | grep -oE "(evaluate|TrajectoryChart|InputForm|peak_MR)" | sort -u | head -10
# Expected: at least 'evaluate' and 'peak_MR' visible (some symbols may be minified)

# Stop preview server
kill $PREVIEW_PID 2>/dev/null || pkill -f "vite preview" 2>/dev/null
sleep 1
echo "Preview server stopped."
```

### Phase 2 browser visual (Christian)

Restart preview in foreground for browser check:

```bash
pnpm --filter @lc6/web preview
```

Open `http://localhost:4173/`. Expected:
- Identical to dev-server output (header, form pre-populated with Breck defaults, four pill cards, trajectory chart, preview disclosure)
- Console clean (no errors related to bundling, missing assets, etc.)
- Form Run button works (interaction test)

**This is the critical pre-deploy gate.** If preview matches dev, the production bundle is good. If preview differs from dev (missing styles, broken interactions, console errors), HALT. The bundle has issues that need fixing before deployment.

After visual check, stop preview:
```bash
# Ctrl+C to stop the foreground preview server
```

### Phase 2 gate

**Passes if:**
- Vite preview serves at localhost:4173
- HTML, CSS, JS all return 200
- Christian's browser check confirms visual + interactive parity with dev server
- Console clean

**Halts if:**
- Preview server fails to start
- Any 4xx/5xx response on bundled assets
- Browser shows visual differences from dev (missing CSS = Vite asset path issue, broken layout = CSS bundling issue, blank page = JS error)
- Console errors

---

## Phase 3 — Netlify deploy (browser-side, Christian)

Code's role in this phase is minimal — Christian executes via the Netlify UI. Code stages the deployment artifact and waits.

```bash
cd ~/Desktop/LC6-local

# Verify dist/ is the artifact to deploy
ls -la apps/web/dist/
# Confirm: index.html + assets/ are present

# Reveal the dist/ folder in Finder for drag-and-drop
open apps/web/dist/
# (macOS specific. Opens Finder window showing dist/ contents.)
```

### Christian's steps in Netlify UI

The screenshot you showed earlier was the "Let's create your new project" page. Path:

1. **In Netlify UI**, scroll to the **"Upload your project files"** section at the bottom (the drag-drop zone)
2. **Drag the `apps/web/dist/` folder** from the Finder window onto the drop zone
3. Netlify uploads, builds (no build server-side needed since dist is already built), and deploys
4. Netlify auto-assigns a URL like `random-name-abc1234.netlify.app`
5. **Rename the site** to `lc6alpha`:
   - Click into the new project
   - Site configuration → Site details → Site information → "Change site name"
   - Enter `lc6alpha` (Netlify will tell you if taken; try `lc6preview`, `layercraft6`, etc.)
   - URL becomes `https://lc6alpha.netlify.app`

### Christian's password configuration

After site is renamed:

1. **Site configuration → Access control → Visitor access**
2. Enable **Site password** (Pro feature — confirmed available based on your account showing existing password-protected sites)
3. Set the password (same as `layercraftbeta` for consistency, or a new one — your choice)
4. Save

### Live URL smoke (Christian)

1. Open `https://lc6alpha.netlify.app` in a fresh browser tab (or incognito to verify password gate works for someone without your session cookies)
2. Password prompt appears
3. Enter password
4. LC6 loads
5. Verify: header, form with Breck defaults, four pill cards (0.8 / 5.5 / 3.7), trajectory chart, preview disclosure, console clean
6. Interaction test: change Temp 16 → 80, Activity → Hiking, Gear Preset → Hiking Light, click Run. Verify pills + chart update.

If all of that works, **win condition met**.

---

## Phase 4 — Session close (single commit, no SHA backfill)

S-DEPLOY-01 produces no code changes — the deployment is a side effect of building from the existing tree at `705f2ae`. There's nothing to commit at the code level.

**However**, we should commit a deployment receipt for tracking. This is a small markdown file recording what was deployed when, to which URL, with which engine version.

### 4.1 Create `LC6_Planning/deployments/S-DEPLOY-01_receipt.md`

**Content (Christian fills in URL and date after the deploy):**

```markdown
# S-DEPLOY-01 Deployment Receipt

**Session:** S-DEPLOY-01
**Date:** April 24, 2026 (or April 25 after midnight — fill in actual deploy date)
**Source commit:** 705f2ae (S-UI-02a close)
**Engine version:** 0.10.0-alpha (per result.engine_version in browser)
**Deploy method:** Netlify drag-drop (browser-side)
**Site:** lc6alpha (or actual site name if lc6alpha was taken)
**URL:** https://lc6alpha.netlify.app/ (fill in actual URL)
**Password protection:** Enabled (site-level)
**Build:** Local Vite production build (apps/web/dist/)
**Bundle size:** [fill in from Phase 1 output, e.g., "1.2MB"]

## What's deployed

- LayerCraft v6 alpha — interactive smoke-test surface
- Four-pill recommendation display (your_gear, pacing, optimal_gear, best_outcome)
- Trajectory chart (MR / HLR / CDI over trip duration)
- Interactive input form (activity, date, duration, weather, gear preset)
- Initial state: Breck snowboarding 16°F 6hr scenario

## Known limitations on this deploy

- Pacing and Best Outcome pills display Preview badges (SEMANTICALLY-STUBBED
  per SessionA — object-spreads of paired pills, no independent computation)
- Optimal Gear collapses to user_ensemble (no strategy candidates supplied;
  STRATEGY-FALLBACK-WHEN-NO-CANDIDATES tracker item)
- 4 hardcoded gear presets (Snowboarding Standard, Hiking Light, Hiking
  Standard, Road Cycling) — no per-slot customization, no gear DB
- 8 hardcoded activity options
- Defaults for biometrics (male, 180 lb), location (Breckenridge coords),
  and trip structure (single segment, single weather slice)

## Session arc context

This deploy captures the state after a single working day's session arc:
S10B (engine TrajectoryPoint heat-balance backfill) → S-UI-01 (apps/web
scaffolding) → S-UI-02b (four-pill display) → S-UI-02c (trajectory chart)
→ S-UI-02a (interactive input form) → S-DEPLOY-01 (this deploy).

Engine state: 736 passed, 7 skipped, 0 failed. No regressions through arc.
```

### 4.2 Commit the receipt

```bash
cd ~/Desktop/LC6-local

mkdir -p LC6_Planning/deployments

# Christian creates LC6_Planning/deployments/S-DEPLOY-01_receipt.md
# with content above (Chat-authored verbatim), filling in actual values
# from the deploy

# After Christian fills in URL/date, commit
git add LC6_Planning/deployments/S-DEPLOY-01_receipt.md

git commit -m "S-DEPLOY-01: Netlify production deploy of LC6 alpha

LC6 deployed to Netlify at https://lc6alpha.netlify.app/ (or actual
URL — see receipt). Site password-protected.

Source: 705f2ae (S-UI-02a close)
Method: Local Vite production build (pnpm --filter @lc6/web build),
        browser-side drag-drop upload to Netlify
Bundle: apps/web/dist/ (~1MB-ish, Recharts + React + LC6 engine)

What's live:
  - Interactive input form (activity, date, duration, weather, gear preset)
  - Four-pill recommendation display with preview badges on stubbed pills
  - Trajectory chart (MR / HLR / CDI over trip duration)
  - Honest disclosure block explaining stubbed state
  - Engine evaluate() running in browser (process.env guard from
    S-UI-02b-HOTFIX-01 confirmed working in production bundle)

No code changes in this commit — just the deployment receipt at
LC6_Planning/deployments/S-DEPLOY-01_receipt.md.

Non-regression: source tree unchanged from 705f2ae. Engine test
suite still 736 passed, 7 skipped, 0 failed.

Memory #13 preserved: receipt artifact Chat-authored, Code-executed.
Cardinal Rules preserved: no engine physics touched."

git push origin session-13-phy-humid-v2
```

---

## Halt conditions

Halt and report immediately if:

1. **Pre-flight finds branch state other than `705f2ae` clean.** Working tree should be clean — if there are uncommitted changes from another session, that's a problem.

2. **Phase 1 build fails** with TypeScript errors, Vite bundle errors, or empty output. See §Likely failure modes below for specific failure types.

3. **Phase 2 preview server doesn't match dev server output.** This is the critical pre-deploy gate. If the production bundle has bugs that dev mode doesn't catch, deploying will ship those bugs to the URL.

4. **Phase 3 Netlify deploy fails** with upload errors, site name conflicts that don't resolve with retries, or password configuration not taking effect. Most of these are Netlify UI issues solvable browser-side.

5. **Live URL smoke test fails:** site doesn't load, password gate doesn't work, app renders differently than localhost preview did.

On halt: capture full error output (build logs, browser console, network tab), do not attempt fixes that go outside the scope of this kickoff. Engine code stays untouched.

---

## Likely failure modes

Based on today's session pattern of catching authoring errors plus the specific risks of a first-time production build:

1. **TypeScript errors on `tsc` step that didn't appear in dev.** Vite's dev server uses esbuild for fast transpilation, which is less strict than TypeScript's `tsc`. Possible failures:
   - Unused-import warnings becoming errors
   - Strict null checks flagging code paths dev tolerated
   - `as` casts that worked in dev being flagged as runtime-unsafe
   
   **Fix path:** typically a 1-3 line surgical patch. Halt, paste the error, I author the fix.

2. **Vite bundle resolution errors for `@lc6/engine`.** The pnpm workspace symlink resolves at dev time; build time may need an extra hint. Failure mode: "Cannot resolve module '@lc6/engine'" or similar at bundle stage.
   
   **Fix path:** add `optimizeDeps.include` or `resolve.alias` to vite.config.ts. Halt, paste error.

3. **CSS not bundling correctly.** If `import './styles.css'` in main.tsx doesn't resolve at build time, the production bundle will load but be unstyled.
   
   **Fix path:** verify `import './styles.css'` is in main.tsx (it is, from S-UI-02b). If issue persists, may need vite.config.ts adjustment.

4. **Recharts import issues at build time.** Recharts has historically had ESM/CJS interop quirks. Tree-shaking may strip something we need.
   
   **Fix path:** verify Recharts version (2.15.x) supports tree-shaking for the `LineChart` / `XAxis` / etc. components we use. If not, switch to broader namespace import. Halt, paste build output.

5. **Bundle size unreasonably large** (>5MB). Suggests something is being bundled that shouldn't be — possibly engine source being inlined when it should be tree-shaken. Not a halt, but flag for follow-up.

6. **Netlify rejects the upload.** Possible causes: file count too high, file size too large, malformed file structure. The `dist/` folder should be small (<10 files, <2MB). Unlikely failure.

7. **Site name `lc6alpha` already taken.** Netlify will tell us at the rename step. Pick a different name (`lc6preview`, `layercraft6`, `lcv6alpha`, etc.).

8. **Password protection fails to apply.** Possible if account is unexpectedly on Free tier. Christian can confirm Pro status from billing dashboard if needed. Worst case: deploy proceeds without password tonight, password added in a follow-up.

9. **Live URL works but renders differently than localhost preview.** This would be a Netlify CDN / asset-serving issue rather than a build issue. Rare but possible. Halt, capture browser console + network tab.

---

## Edge case: what if the build fails repeatedly?

If Phase 1 fails twice with different errors after my surgical patches, **stop and revert to Option B (tracker hygiene) for tonight.** A failing production build at midnight is the wrong session shape. Try the deploy again tomorrow with a fresh head.

This isn't a real likelihood — Vite + React + TypeScript + Recharts is a well-trodden stack. But planning for the failure case keeps tonight's session from spiraling.

---

**END S-DEPLOY-01 KICKOFF.**
