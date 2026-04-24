# S-UI-02b Session Kickoff — Four-Pill Display + Basic Polish

**Session ID:** S-UI-02b
**Authored by:** Chat
**Date:** April 24, 2026
**Branch:** `session-13-phy-humid-v2` (continuing from S-UI-01 close HEAD `6e19cb9`)
**Prerequisite HEAD:** `6e19cb9`
**Estimated duration:** 3-4 hours

---

## Why this session exists

S-UI-01 proved engine-to-browser plumbing — one number renders. Next brick: render all four pills (`your_gear`, `pacing`, `optimal_gear`, `best_outcome`) side-by-side with their headline values, plus honest disclosure that two of them are SEMANTICALLY-STUBBED.

Per SessionA Output A:
- `pacing` is an object-spread of `your_gear` with `uses_pacing: true` flipped — same underlying values
- `best_outcome` is an object-spread of `optimal_gear` with `uses_pacing: true` flipped — same underlying values

The UI must NOT silently render duplicate values across these pairs as if they were independent recommendations. That would be the S31-E pattern (calibrating to ghosts) at the UI layer. Instead: render all four pills, badge the two stubbed pills as "preview", make the SEMANTICALLY-STUBBED state visible.

**Win condition:** `pnpm dev:web` opens browser. Four pill cards visible side-by-side. Each card shows pill name, peak MR/HLR/CDI, regime tag, clinical stage. Pacing and best_outcome cards have a visible "PREVIEW" badge. Color-coded MR values (green/yellow/red tiers). The page looks like a deliberate product surface, not a debug view.

---

## Scope

### In scope

1. **`apps/web/src/App.tsx`** — replace single-card display with four-pill grid layout
2. **`apps/web/src/styles.css`** — new file with basic polish: card styling, typography, color-coded risk tiers, preview badge
3. **`apps/web/src/main.tsx`** — import the new CSS file
4. **Inline color/risk-tier helpers in App.tsx** — small pure functions that map MR/HLR/CDI numbers to color names. No external deps.

### Out of scope

- Interactive input (still hardcoded Breck snowboarding)
- Trajectory chart / time-series visualization
- Per-segment breakdown
- Critical moments / strategy windows
- Tooltips, modals, expanded views
- Mobile-responsive layout (desktop-first; will collapse OK at narrow widths but not optimized)
- Animation
- Dark mode
- Tracker updates (S-UI-02b adds no new tracker items, closes none)
- Tests (no UI tests this session, same as S-UI-01)
- Engine modifications (zero — Cardinal Rule #8 untouched)

---

## Pre-flight (Code executes)

```bash
cd ~/Desktop/LC6-local

# 1. Verify branch state
git status --short
git log --oneline -3
# Expected: HEAD at 6e19cb9 (S-UI-01 close), clean working tree
# (S30 tooling artifacts in working tree are pre-existing, ignore)

# 2. Verify S-UI-01 stack still functional
pnpm --filter @lc6/web typecheck 2>&1 | tail -5
# Expected: 0 errors

pnpm --filter @lc6/engine test 2>&1 | tail -5
# Expected: 736 passed, 7 skipped, 0 failed

# 3. Confirm current apps/web/src state
ls -la apps/web/src/
cat apps/web/src/App.tsx | wc -l
# Expected: main.tsx, App.tsx (no styles.css yet)

# 4. Report back
echo "S-UI-02b pre-flight complete."
```

**Pre-flight gate:** branch clean at `6e19cb9`, web typecheck 0, engine 736/7/0, src/ has main.tsx and App.tsx only.

---

## Phase 1 — Create `apps/web/src/styles.css`

**New file:** `apps/web/src/styles.css`

Content verbatim:

```css
/* ═══════════════════════════════════════════════════════════════════════════
   LayerCraft v6 — basic polish stylesheet (S-UI-02b)
   Scope: four-pill display with risk-tier color coding + preview badges.
   No design system yet; this is a single-screen product surface.
   ═══════════════════════════════════════════════════════════════════════════ */

:root {
  --color-bg: #fafaf8;
  --color-fg: #1a1a1a;
  --color-fg-muted: #6b6b6b;
  --color-card-bg: #ffffff;
  --color-card-border: #e8e8e6;
  --color-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04);

  /* Risk tier colors — used for MR/HLR/CDI value displays.
     Match the LC4 era 5-tier risk palette but UI uses a simplified 3-tier
     mapping (low / elevated / critical) for value chips. */
  --color-tier-low: #2f7d4f;        /* green */
  --color-tier-low-bg: #e8f3ec;
  --color-tier-elevated: #b87a1d;   /* amber */
  --color-tier-elevated-bg: #fbf3e3;
  --color-tier-critical: #b3372f;   /* red */
  --color-tier-critical-bg: #fbe9e7;

  /* Preview badge — for SEMANTICALLY-STUBBED pills */
  --color-preview-fg: #6b5a1d;
  --color-preview-bg: #f6efd0;
  --color-preview-border: #d9c47a;

  /* Layout */
  --spacing-page-padding: 32px;
  --spacing-card-padding: 20px;
  --spacing-card-gap: 16px;
  --radius-card: 8px;
  --radius-badge: 4px;

  /* Typography */
  --font-stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  --font-size-page-title: 28px;
  --font-size-card-title: 14px;
  --font-size-headline-value: 36px;
  --font-size-secondary-value: 18px;
  --font-size-label: 11px;
  --font-size-meta: 12px;
  --font-size-badge: 10px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-stack);
  background-color: var(--color-bg);
  color: var(--color-fg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.page {
  padding: var(--spacing-page-padding);
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 8px;
}

.page-title {
  font-size: var(--font-size-page-title);
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
}

.page-subtitle {
  font-size: 14px;
  color: var(--color-fg-muted);
  margin: 4px 0 0 0;
}

.scenario-meta {
  display: flex;
  gap: 24px;
  margin-top: 24px;
  padding: 12px 16px;
  background-color: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  font-size: var(--font-size-meta);
}

.scenario-meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scenario-meta-label {
  font-size: var(--font-size-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-fg-muted);
}

.scenario-meta-value {
  font-size: var(--font-size-meta);
  font-weight: 500;
}

.pill-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-card-gap);
  margin-top: 24px;
}

@media (max-width: 1024px) {
  .pill-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .pill-grid {
    grid-template-columns: 1fr;
  }
}

.pill-card {
  background-color: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  padding: var(--spacing-card-padding);
  box-shadow: var(--color-card-shadow);
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.pill-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.pill-card-title {
  font-size: var(--font-size-card-title);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-fg-muted);
  margin: 0;
}

.pill-preview-badge {
  display: inline-block;
  font-size: var(--font-size-badge);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 6px;
  background-color: var(--color-preview-bg);
  color: var(--color-preview-fg);
  border: 1px solid var(--color-preview-border);
  border-radius: var(--radius-badge);
  white-space: nowrap;
}

.pill-headline {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pill-headline-label {
  font-size: var(--font-size-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-fg-muted);
}

.pill-headline-value {
  font-size: var(--font-size-headline-value);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}

.pill-headline-value.tier-low {
  color: var(--color-tier-low);
}

.pill-headline-value.tier-elevated {
  color: var(--color-tier-elevated);
}

.pill-headline-value.tier-critical {
  color: var(--color-tier-critical);
}

.pill-secondary-row {
  display: flex;
  gap: 12px;
}

.pill-secondary-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pill-secondary-label {
  font-size: var(--font-size-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-fg-muted);
}

.pill-secondary-value {
  font-size: var(--font-size-secondary-value);
  font-weight: 600;
}

.pill-secondary-value.tier-low {
  color: var(--color-tier-low);
}

.pill-secondary-value.tier-elevated {
  color: var(--color-tier-elevated);
}

.pill-secondary-value.tier-critical {
  color: var(--color-tier-critical);
}

.pill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--color-card-border);
}

.pill-tag {
  font-size: var(--font-size-meta);
  padding: 3px 8px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-badge);
  color: var(--color-fg-muted);
}

.pill-tag.tier-low {
  background-color: var(--color-tier-low-bg);
  color: var(--color-tier-low);
  border-color: transparent;
}

.pill-tag.tier-elevated {
  background-color: var(--color-tier-elevated-bg);
  color: var(--color-tier-elevated);
  border-color: transparent;
}

.pill-tag.tier-critical {
  background-color: var(--color-tier-critical-bg);
  color: var(--color-tier-critical);
  border-color: transparent;
}

.preview-disclosure {
  margin-top: 32px;
  padding: 12px 16px;
  background-color: var(--color-preview-bg);
  border: 1px solid var(--color-preview-border);
  border-radius: var(--radius-card);
  font-size: 13px;
  color: var(--color-preview-fg);
  line-height: 1.5;
}

.preview-disclosure-title {
  font-weight: 600;
  margin-bottom: 4px;
}
```

**Why these design choices:**

- **CSS variables at `:root`** so future polish sessions can adjust palette without rewriting rules
- **3-tier color mapping** (low/elevated/critical) maps engine's 5-tier risk to a simplified UI palette per the "basic polish" scope. Full 5-tier mapping is future polish.
- **Preview badge** colors match LC5-era amber/yellow conventions — visible but not alarming (these aren't errors, they're disclosed-stub status)
- **Grid layout** with desktop-first (4 columns), tablet (2 columns), mobile (1 column) breakpoints. Not exhaustively tested but workable
- **Modest shadows + 1px borders** — product surface, not debug view, but not over-designed

---

## Phase 2 — Update `apps/web/src/main.tsx` to import the CSS

**Target:** `apps/web/src/main.tsx`

**Find:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
```

**Replace with:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './styles.css';
```

One-line addition. Vite handles CSS imports natively.

---

## Phase 3 — Replace `apps/web/src/App.tsx` with four-pill grid

**Target:** `apps/web/src/App.tsx`

**Full replacement** (not a patch — easier to author + verify than diffing):

```typescript
import { evaluate } from '@lc6/engine';
import type {
  EngineInput,
  WeatherSlice,
  GearEnsemble,
  EngineGearItem,
  PillResult,
  ClinicalStage,
} from '@lc6/engine';

// ═══════════════════════════════════════════════════════════════════════════
// Hardcoded test input — Breck snowboarding 16°F 6hrs
// Replicated from packages/engine/tests/evaluate/evaluate.test.ts makeBreckInput.
// S-UI-02+ will replace with user input form.
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
// Risk-tier mapping helpers
// Maps engine's 0-10 risk metrics to 3 UI tiers (low/elevated/critical).
// Aligned with LC4 era 5-tier risk → simplified for "basic polish" UI scope.
// Future polish session can expand to full 5-tier (low/elevated/moderate/high/critical).
// ═══════════════════════════════════════════════════════════════════════════

type RiskTier = 'low' | 'elevated' | 'critical';

function tierForRiskScore(value: number): RiskTier {
  if (value < 3) return 'low';
  if (value < 6) return 'elevated';
  return 'critical';
}

function tierClass(tier: RiskTier): string {
  return `tier-${tier}`;
}

// Stages worth tagging visually as elevated/critical clinical concern.
// Anything other than thermal_neutral is at least "elevated" for tag display.
function tierForClinicalStage(stage: ClinicalStage): RiskTier {
  if (stage === 'thermal_neutral') return 'low';
  if (
    stage === 'severe_hypothermia' ||
    stage === 'mild_hypothermia_deteriorating' ||
    stage === 'heat_stroke' ||
    stage === 'heat_exhaustion_deteriorating'
  ) {
    return 'critical';
  }
  return 'elevated';
}

// Display labels — engine uses snake_case, UI uses Title Case
const PILL_LABELS: Record<PillResult['pill_id'], string> = {
  your_gear: 'Your Gear',
  pacing: 'Pacing',
  optimal_gear: 'Optimal Gear',
  best_outcome: 'Best Outcome',
};

// SEMANTICALLY-STUBBED pills per SessionA Output A.
// These pills are object-spreads of their paired pills with uses_pacing
// flipped — same underlying values, no independent computation yet.
// Future session that wires precognitive_cm → ventEvents will make these real.
const STUBBED_PILL_IDS: ReadonlyArray<PillResult['pill_id']> = [
  'pacing',
  'best_outcome',
];

function isStubbedPill(pillId: PillResult['pill_id']): boolean {
  return STUBBED_PILL_IDS.includes(pillId);
}

// ═══════════════════════════════════════════════════════════════════════════
// PillCard — single pill display
// ═══════════════════════════════════════════════════════════════════════════

interface PillCardProps {
  pill: PillResult;
}

function PillCard({ pill }: PillCardProps) {
  const summary = pill.trajectory_summary;
  const mrTier = tierForRiskScore(summary.peak_MR);
  const hlrTier = tierForRiskScore(summary.peak_HLR);
  const cdiTier = tierForRiskScore(summary.peak_CDI);
  const stageTier = tierForClinicalStage(summary.peak_clinical_stage);
  const stubbed = isStubbedPill(pill.pill_id);

  return (
    <div className="pill-card">
      <div className="pill-card-header">
        <h3 className="pill-card-title">{PILL_LABELS[pill.pill_id]}</h3>
        {stubbed && <span className="pill-preview-badge">Preview</span>}
      </div>

      <div className="pill-headline">
        <span className="pill-headline-label">Peak MR</span>
        <span className={`pill-headline-value ${tierClass(mrTier)}`}>
          {summary.peak_MR.toFixed(1)}
        </span>
      </div>

      <div className="pill-secondary-row">
        <div className="pill-secondary-cell">
          <span className="pill-secondary-label">Peak HLR</span>
          <span className={`pill-secondary-value ${tierClass(hlrTier)}`}>
            {summary.peak_HLR.toFixed(1)}
          </span>
        </div>
        <div className="pill-secondary-cell">
          <span className="pill-secondary-label">Peak CDI</span>
          <span className={`pill-secondary-value ${tierClass(cdiTier)}`}>
            {summary.peak_CDI.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="pill-tags">
        <span className={`pill-tag ${tierClass(stageTier)}`}>
          {summary.peak_clinical_stage.replace(/_/g, ' ')}
        </span>
        <span className="pill-tag">{summary.regime}</span>
        <span className="pill-tag">{summary.binding_pathway}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// App — runs evaluate() once, renders four pills + scenario meta + disclosure
// ═══════════════════════════════════════════════════════════════════════════

export function App() {
  const result = evaluate(BRECK_INPUT);
  const fp = result.four_pill;

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">LayerCraft v6</h1>
        <p className="page-subtitle">
          Engine smoke test — four-pill recommendation surface
        </p>
      </header>

      <div className="scenario-meta">
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Activity</span>
          <span className="scenario-meta-value">Snowboarding</span>
        </div>
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Location</span>
          <span className="scenario-meta-value">Breckenridge</span>
        </div>
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Conditions</span>
          <span className="scenario-meta-value">
            16°F · 45% RH · 10 mph
          </span>
        </div>
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Duration</span>
          <span className="scenario-meta-value">6 hours</span>
        </div>
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Engine</span>
          <span className="scenario-meta-value">{result.engine_version}</span>
        </div>
      </div>

      <div className="pill-grid">
        <PillCard pill={fp.your_gear} />
        <PillCard pill={fp.pacing} />
        <PillCard pill={fp.optimal_gear} />
        <PillCard pill={fp.best_outcome} />
      </div>

      <div className="preview-disclosure">
        <div className="preview-disclosure-title">
          About the Preview pills
        </div>
        Pacing and Best Outcome pills currently mirror the values of Your
        Gear and Optimal Gear respectively. The pacing-aware computation
        (precognitive vent and break scheduling) is in development. Once
        the pacing engine is wired to vent events, these pills will diverge
        from their paired pills with their own trajectory.
      </div>
    </div>
  );
}
```

**Why this structure:**

- **`tierForRiskScore` thresholds (3, 6)** — chosen to match the engine's 4-tier outcome mapping you've used elsewhere (MR<3 green, 3-5 yellow, >5 orange, >7 red). UI's 3-tier collapse: low(<3), elevated(3-5.99), critical(≥6). The collapse from 4→3 is deliberate for "basic polish" scope; full 4-tier display deferred to future polish.
- **`isStubbedPill`** — explicit list, easy to update when pacing/best_outcome become semantically real (just remove from list)
- **`PillCard` as a separate component** — cleaner than inline rendering of all four pills in App's body
- **`replace(/_/g, ' ')` for clinical stage display** — converts `cold_intensifying` to `cold intensifying` for human-readable tags. Rough but works for "basic polish" tier
- **`preview-disclosure` block** — explicit text about what the preview badge means. SessionA Output B's "honest disclosure" pattern at the UI layer

---

## Phase 4 — Verification

### 4.1 Typecheck

```bash
cd ~/Desktop/LC6-local

pnpm --filter @lc6/web typecheck 2>&1 | tail -10
# Expected: 0 errors

pnpm --filter @lc6/engine typecheck 2>&1 | tail -5
# Expected: 8 pre-existing S27 errors (unchanged)

pnpm --filter @lc6/engine test 2>&1 | tail -5
# Expected: 736 passed, 7 skipped, 0 failed (unchanged)
```

### 4.2 Dev server smoke test

```bash
pnpm --filter @lc6/web dev > /tmp/vite_dev_s10b2.log 2>&1 &
VITE_PID=$!
sleep 4

# Server startup
tail -10 /tmp/vite_dev_s10b2.log

# Root HTML
curl -s http://localhost:5173/ > /tmp/vite_root_s10b2.html
head -15 /tmp/vite_root_s10b2.html

# CSS file
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/src/styles.css
# Expected: 200

# main.tsx loads CSS import
curl -s http://localhost:5173/src/main.tsx | grep -E "styles\.css|App" | head -5

# App.tsx transpiles
curl -s http://localhost:5173/src/App.tsx | grep -E "PillCard|FourPill|evaluate" | head -10

kill $VITE_PID 2>/dev/null || pkill -f "vite" 2>/dev/null
sleep 1
```

### 4.3 Browser verification (Christian)

Open `http://localhost:5173/` manually. Expected visual:

1. **Header** — "LayerCraft v6" + subtitle
2. **Scenario meta strip** — horizontal row of 5 labels (Activity / Location / Conditions / Duration / Engine)
3. **Four pill cards in a grid** — Your Gear / Pacing / Optimal Gear / Best Outcome
4. **Preview badges** on Pacing and Best Outcome cards (amber pill, top-right)
5. **Color-coded values** — Peak MR/HLR/CDI in green/amber/red depending on tier
6. **Tag row** at the bottom of each card — clinical stage, regime, binding pathway as small chips, color-tagged for stage
7. **Preview disclosure block** below the grid — amber background, explains the preview state

If you see this with no console errors, win condition met.

---

## Phase 5 — Session close (single commit, no SHA backfill)

S-UI-02b adds no tracker items that self-reference the commit SHA. Single ratification commit suffices.

```bash
cd ~/Desktop/LC6-local

git status --short
# Expected:
#   modified:   apps/web/src/App.tsx
#   modified:   apps/web/src/main.tsx
#   new file:   apps/web/src/styles.css

git add apps/web/src/App.tsx \
        apps/web/src/main.tsx \
        apps/web/src/styles.css

git commit -m "S-UI-02b: four-pill display + basic polish

apps/web extended from S-UI-01's single-card display to a four-pill
grid showing your_gear, pacing, optimal_gear, and best_outcome side-
by-side. Pacing and best_outcome pills are SEMANTICALLY-STUBBED per
SessionA Output A (object-spreads of paired pills with uses_pacing
flipped); both display a 'Preview' badge and the page includes a
disclosure block explaining the stub state.

Visual surface (basic polish tier):
  - 4-column grid (collapses to 2 / 1 at narrower widths)
  - Card-based pill display with light shadows, 1px borders
  - Risk-tier color coding for MR / HLR / CDI values:
      tier-low (<3): green, tier-elevated (3-5.99): amber,
      tier-critical (≥6): red
  - Preview badges on stubbed pills (amber pill chip, top-right)
  - Scenario meta strip (activity, location, conditions, duration,
    engine version) above the pill grid
  - Tag row per card with clinical stage / regime / binding pathway
  - Preview disclosure block below grid explains the stub state
  - System sans-serif font stack; CSS variables at :root for future
    palette adjustments

Engine consumption: imports evaluate(), PillResult, ClinicalStage,
TrajectoryPoint types. result.four_pill rendered as four PillCards;
each pill's trajectory_summary supplies headline values. No engine
modifications; physics untouched.

Files:
  apps/web/src/App.tsx        — replaces single-card with four-pill grid
                                + PillCard component + tier helpers
  apps/web/src/main.tsx       — adds 'import ./styles.css'
  apps/web/src/styles.css     — new, basic polish stylesheet

Out of scope (deferred):
  - Interactive input form (S-UI-02a or later)
  - Trajectory chart (S-UI-02c or later)
  - 5-tier risk display (currently 3-tier collapse for basic polish)
  - Mobile-responsive optimization beyond grid breakpoints
  - Tooltips / expanded views / per-segment breakdown
  - Critical moments / strategy windows surface
  - Tests (no UI tests this session, same as S-UI-01)
  - Tracker items (none added; none closed)

Non-regression: engine test suite unchanged (736 passed, 7 skipped,
0 failed). Web typecheck 0 errors. Engine typecheck unchanged at
S27 baseline.

SEMANTICALLY-STUBBED pacing/best_outcome pills will become real when
precognitive_cm → ventEvents wiring lands. Removing from the
STUBBED_PILL_IDS array in App.tsx will drop the Preview badges at
that point.

Memory #13 preserved: all artifacts Chat-authored, Code-executed
verbatim. Cardinal Rules preserved: no engine physics touched."

git push origin session-13-phy-humid-v2

# Verify push
git log origin/session-13-phy-humid-v2..HEAD --oneline
# Expected: empty (push succeeded)

git log -3 --oneline
# Expected: S-UI-02b close on top, then S-UI-01 close (6e19cb9),
#           then S-UI-01 kickoff (7b2b20b)
```

### Session close receipt

```
S-UI-02b complete. Four-pill display + basic polish landed.

Branch:        session-13-phy-humid-v2 (pushed to origin)
HEAD:          [S-UI-02b commit SHA]
Commits this session: 1

Files changed: 2 modified, 1 new
  apps/web/src/App.tsx        — four-pill grid + PillCard + tier helpers
  apps/web/src/main.tsx       — CSS import added
  apps/web/src/styles.css     — basic polish stylesheet (new)

Visual surface:
  - 4 pill cards in grid (your_gear, pacing, optimal_gear, best_outcome)
  - Preview badges on pacing + best_outcome (SEMANTICALLY-STUBBED disclosure)
  - Risk-tier color coding (3-tier: low/elevated/critical)
  - Scenario meta strip + preview disclosure block

Gates:
  Phase 1 styles.css created: ✓
  Phase 2 main.tsx CSS import: ✓
  Phase 3 App.tsx four-pill grid: ✓
  Phase 4.1 web typecheck: 0 errors ✓
  Phase 4.2 engine typecheck unchanged (S27 baseline): ✓
  Phase 4.3 engine test suite unchanged (736/7/0): ✓
  Phase 4.4 dev server starts + serves CSS + transpiles: ✓
  Phase 4.5 browser visual confirmation (Christian): [confirm/halt]

Test suite: 736 passed, 7 skipped, 0 failed (unchanged)
Engine physics untouched.

Next: S-UI-02a (interactive input form) or S-UI-02c (trajectory chart)
or different direction.
```

---

## Halt conditions

Halt and report immediately if:

1. Pre-flight finds branch state other than HEAD `6e19cb9` clean
2. Phase 1 — styles.css fails to write or has parse errors when Vite loads it
3. Phase 2 — main.tsx CSS import causes typecheck error
4. Phase 3 — App.tsx fails typecheck (most likely failure mode: a type import I named that doesn't exist in `@lc6/engine`'s public API)
5. Phase 4.1 — web typecheck non-zero
6. Phase 4.2 — engine typecheck delta from S27 baseline (would indicate this session somehow touched engine code, which it shouldn't)
7. Phase 4.3 — engine test suite regresses
8. Phase 4.4 — dev server fails to start, CSS doesn't serve, App.tsx doesn't transpile
9. Phase 4.5 — browser shows white screen, red React error overlay, missing pill cards, missing preview badges, color tiers not applying, or any visible NaN/undefined

On halt: capture full error output, do not attempt fixes, report to Chat. Do not modify engine, do not widen scope, do not adjust the design system mid-flight.

---

## Likely failure modes for this session

Based on today's pattern of catching Chat authoring errors:

1. **Type imports I named that aren't exported from `@lc6/engine`'s public API.** I'm importing `PillResult` and `ClinicalStage` from `@lc6/engine` top-level. If those types aren't re-exported through the engine's public entry point, typecheck will fail. Phase 4.1 catches it.
2. **CSS variable typos** — small, recoverable. Vite doesn't typecheck CSS so these surface visually only.
3. **Mismatched class names between App.tsx and styles.css** — App.tsx uses `tier-low` etc.; styles.css needs to define `.pill-headline-value.tier-low` etc. I think I matched them but Phase 4.5 visual confirmation is the gate.
4. **`replace(/_/g, ' ')` on a non-string** — clinical_stage IS a string union, so this is safe. Listed for completeness.
5. **`PillCard` rendering issue if `trajectory_summary` is null/undefined** — I'm not null-checking it. Looking at types.ts line 371, `trajectory_summary` is non-optional on `PillResult`, so it should always exist. Phase 4.5 is the gate if this assumption is wrong.

---

**END S-UI-02b KICKOFF.**
