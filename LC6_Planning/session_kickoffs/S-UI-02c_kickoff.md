# S-UI-02c Session Kickoff — Trajectory Chart

**Session ID:** S-UI-02c
**Authored by:** Chat
**Date:** April 24, 2026
**Branch:** `session-13-phy-humid-v2` (continuing from S-UI-02b close HEAD `9054088`)
**Prerequisite HEAD:** `9054088`
**Estimated duration:** 3-4 hours

---

## Why this session exists

S-UI-02b shipped four pill cards showing peak values. Peaks are scalar summaries — they hide the trip's shape. A user looking at peak MR = 0.8 doesn't see whether MR rose steadily, spiked at hour 3, or stayed flat all day.

S10B's per-cycle heat-balance backfill produced trajectory data that was previously zero-padded. That work becomes user-visible only when something renders it.

**Win condition for S-UI-02c:** Browser at `http://localhost:5173/` shows the four pill cards plus a line chart below them. The chart plots MR, HLR, and CDI against time over the 6-hour Breck snowboarding scenario. You can see when risk metrics rise, fall, or stay flat. The chart makes the trip's thermal arc visible.

---

## Scope

### In scope

1. **Add Recharts dependency** to `apps/web/package.json` — lightweight React-native charting library
2. **Create `apps/web/src/TrajectoryChart.tsx`** — single component that takes a trajectory array and renders MR/HLR/CDI as a line chart
3. **Update `apps/web/src/App.tsx`** — render `<TrajectoryChart>` below the four-pill grid using `result.four_pill.your_gear.trajectory`
4. **Update `apps/web/src/styles.css`** — add chart container styling

### Out of scope

- Charts for pacing/optimal_gear/best_outcome (only your_gear has a single canonical trajectory; other pills are stubbed or strategy-dependent)
- T_skin / T_core overlay (worth adding eventually but separate scope)
- Tooltip customization beyond Recharts defaults
- Critical moments / strategy windows annotation
- Phase-of-cycle bands (warmup, lift, run, rest)
- Chart export / download
- Interactivity beyond Recharts default hover tooltips
- Per-segment vs whole-trajectory split (single trajectory render, segments visible only via inferring from the data)
- Color-coded thresholds on chart (e.g., red zone above MR 6) — uniform line colors, defer threshold zones to future polish
- Tests
- Tracker updates

---

## Pre-flight (Code executes)

```bash
cd ~/Desktop/LC6-local

# 1. Verify branch state
git status --short
git log --oneline -3
# Expected: HEAD at 9054088 (S-UI-02b close), clean working tree
# (S30 tooling artifacts pre-existing untracked, unchanged)

# 2. Verify S-UI-02b stack still functional
pnpm --filter @lc6/web typecheck 2>&1 | tail -5
# Expected: 0 errors

pnpm --filter @lc6/engine test 2>&1 | tail -5
# Expected: 736 passed, 7 skipped, 0 failed

# 3. Confirm current apps/web/src state
ls -la apps/web/src/
# Expected: App.tsx, main.tsx, styles.css

# 4. Report back
echo "S-UI-02c pre-flight complete."
```

**Pre-flight gate:** branch clean at `9054088`, web typecheck 0, engine 736/7/0, src/ has App.tsx + main.tsx + styles.css only.

---

## Phase 1 — Add Recharts to `apps/web/package.json`

**Target:** `apps/web/package.json`

**Find** the `dependencies` block:
```json
  "dependencies": {
    "@lc6/engine": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
```

**Replace with:**
```json
  "dependencies": {
    "@lc6/engine": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "recharts": "^2.15.0"
  },
```

Recharts 2.15 is the latest stable as of late 2025 / early 2026. Compatible with React 18.

### Phase 1 verification

```bash
cd ~/Desktop/LC6-local

# Install Recharts
pnpm install 2>&1 | tail -10

# Verify Recharts is resolvable
pnpm --filter @lc6/web ls recharts 2>&1 | head -5
# Expected: recharts@2.15.x listed

# No regression checks needed — package.json edit doesn't affect engine
```

**Phase 1 gate:** `pnpm install` succeeds, recharts resolvable.

**Halts if:** install fails, recharts version conflict with React 18.

---

## Phase 2 — Create `apps/web/src/TrajectoryChart.tsx`

**New file:** `apps/web/src/TrajectoryChart.tsx`

```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrajectoryPoint } from '@lc6/engine';

// ═══════════════════════════════════════════════════════════════════════════
// TrajectoryChart — line chart of MR / HLR / CDI over time
// Source: result.four_pill.your_gear.trajectory (TrajectoryPoint[])
// X-axis: t (seconds since trip start) → displayed as hours
// Y-axis: 0-10 risk metric range (engine emits 0-10 scale per CDI v1.4)
// ═══════════════════════════════════════════════════════════════════════════

interface TrajectoryChartProps {
  trajectory: TrajectoryPoint[];
}

// Maps trajectory[] to chart-friendly shape with hours rather than seconds.
// Recharts plays best with plain objects; we project to the 4 fields needed.
interface ChartPoint {
  hours: number;
  MR: number;
  HLR: number;
  CDI: number;
}

function projectTrajectory(trajectory: TrajectoryPoint[]): ChartPoint[] {
  return trajectory.map(pt => ({
    hours: pt.t / 3600,
    MR: pt.MR,
    HLR: pt.HLR,
    CDI: pt.CDI,
  }));
}

// Format hours to "Xh Ym" for axis tick display
function formatHourTick(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

export function TrajectoryChart({ trajectory }: TrajectoryChartProps) {
  if (trajectory.length === 0) {
    return (
      <div className="trajectory-chart-empty">
        Trajectory data unavailable for this scenario.
      </div>
    );
  }

  const data = projectTrajectory(trajectory);

  return (
    <div className="trajectory-chart-container">
      <div className="trajectory-chart-header">
        <h2 className="trajectory-chart-title">Trip Trajectory</h2>
        <p className="trajectory-chart-subtitle">
          Risk metrics over the {(data[data.length - 1]?.hours ?? 0).toFixed(1)}-hour trip
        </p>
      </div>
      <div className="trajectory-chart-body">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e6" />
            <XAxis
              dataKey="hours"
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={formatHourTick}
              tick={{ fontSize: 12, fill: '#6b6b6b' }}
              stroke="#6b6b6b"
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 12, fill: '#6b6b6b' }}
              stroke="#6b6b6b"
              label={{
                value: 'Risk score',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: '#6b6b6b' },
              }}
            />
            <Tooltip
              formatter={(value: number) => value.toFixed(2)}
              labelFormatter={(hours: number) => `Time: ${formatHourTick(hours)}`}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e8e8e6',
                borderRadius: 4,
                fontSize: 13,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="MR"
              stroke="#2f7d4f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name="MR (moisture risk)"
            />
            <Line
              type="monotone"
              dataKey="HLR"
              stroke="#b87a1d"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name="HLR (heat loss risk)"
            />
            <Line
              type="monotone"
              dataKey="CDI"
              stroke="#b3372f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name="CDI (cold danger index)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

**Design notes:**

- **Imports from `recharts` and `@lc6/engine`.** TrajectoryPoint type is already re-exported through engine's public API (verified S-UI-02b session).
- **`ChartPoint` interface and `projectTrajectory` function** — Recharts works best with simple flat objects. Projecting once per render is fine for trajectory lengths in the range of dozens to low hundreds.
- **X-axis in hours, not seconds.** Engine's `t` is seconds; display in hours since users think in hours. `formatHourTick` produces "0h", "1h 30m", "6h" style labels.
- **Y-axis fixed `[0, 10]`.** All three risk metrics (MR, HLR, CDI) are 0-10 scaled per CDI v1.4 architecture. Fixed domain prevents auto-scaling making different scenarios look misleadingly similar.
- **Three-line palette uses the same risk-tier colors as S-UI-02b** — green for MR (low-tier color), amber for HLR (elevated), red for CDI (critical). This is *labeling* via color, not *meaning* (a risk score of 1 in MR is still "low"). Future polish session may want to reconsider the green-amber-red mapping for risk lines specifically.
- **`type="monotone"`** smoothing — visually smoother than `linear`, but not so smooth it hides cycle structure. If trajectory has noticeable per-cycle bumps, those will still be visible.
- **`dot={false}`** — too many dots clutter the chart at trajectory lengths beyond ~20 points. `activeDot={{ r: 4 }}` shows a dot only on hover.
- **Tooltip** uses Recharts default with custom formatting. Shows the time (in hours) and each metric's value to 2 decimal places.
- **`ResponsiveContainer width="100%" height={320}`** — fills container width, fixed pixel height. Will be visually responsive at narrow viewports without breaking layout.
- **Empty-trajectory guard** at the top — `result.four_pill.your_gear.trajectory.length === 0` shouldn't happen for a valid evaluate() call, but guard gracefully.

---

## Phase 3 — Update `apps/web/src/styles.css`

**Target:** `apps/web/src/styles.css`

**At the end of the file (after the `.preview-disclosure` rules), append:**

```css
/* ── Trajectory chart (S-UI-02c) ─────────────────────────────────── */

.trajectory-chart-container {
  margin-top: 24px;
  padding: 24px;
  background-color: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  box-shadow: var(--color-card-shadow);
}

.trajectory-chart-header {
  margin-bottom: 16px;
}

.trajectory-chart-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}

.trajectory-chart-subtitle {
  font-size: 13px;
  color: var(--color-fg-muted);
  margin: 4px 0 0 0;
}

.trajectory-chart-body {
  width: 100%;
}

.trajectory-chart-empty {
  margin-top: 24px;
  padding: 24px;
  background-color: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  text-align: center;
  color: var(--color-fg-muted);
  font-size: 14px;
}
```

Reuses existing CSS variables (`--color-card-bg`, `--color-card-border`, `--radius-card`, `--color-card-shadow`, `--color-fg-muted`) for visual consistency with the existing pill cards. Adds no new variables.

---

## Phase 4 — Update `apps/web/src/App.tsx`

**Target:** `apps/web/src/App.tsx`

Two edits:

### 4.1 Add import

**Find:**
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
```

**Replace with:**
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
import { TrajectoryChart } from './TrajectoryChart.js';
```

(Adds one import line.)

### 4.2 Render TrajectoryChart in App component

**Find** (in the `App` function's JSX return, the closing of the `pill-grid` div):

```typescript
      <div className="pill-grid">
        <PillCard pill={fp.your_gear} />
        <PillCard pill={fp.pacing} />
        <PillCard pill={fp.optimal_gear} />
        <PillCard pill={fp.best_outcome} />
      </div>

      <div className="preview-disclosure">
```

**Replace with:**
```typescript
      <div className="pill-grid">
        <PillCard pill={fp.your_gear} />
        <PillCard pill={fp.pacing} />
        <PillCard pill={fp.optimal_gear} />
        <PillCard pill={fp.best_outcome} />
      </div>

      <TrajectoryChart trajectory={fp.your_gear.trajectory} />

      <div className="preview-disclosure">
```

(Adds one line — the `<TrajectoryChart>` invocation between the pill grid and the disclosure block.)

**Note:** chart uses `your_gear.trajectory` because that's the single canonical trajectory available. `pacing` and `best_outcome` are SEMANTICALLY-STUBBED (object-spreads of paired pills); their trajectories are the same data. `optimal_gear`'s trajectory may differ from `your_gear`'s in principle, but with no strategy candidates supplied, optimal_gear collapses to user_ensemble (per the `STRATEGY-FALLBACK-WHEN-NO-CANDIDATES` observation from S-UI-02b close). Rendering only your_gear is the honest choice for a smoke test with hardcoded input.

---

## Phase 5 — Verification

### 5.1 Typecheck

```bash
cd ~/Desktop/LC6-local

pnpm --filter @lc6/web typecheck 2>&1 | tail -10
# Expected: 0 errors

pnpm --filter @lc6/engine typecheck 2>&1 | tail -5
# Expected: 8 S27 baseline errors (unchanged)

pnpm --filter @lc6/engine test 2>&1 | tail -5
# Expected: 736 passed, 7 skipped, 0 failed (unchanged)
```

### 5.2 Dev server smoke test

```bash
pnpm --filter @lc6/web dev > /tmp/vite_dev_s10c.log 2>&1 &
VITE_PID=$!
sleep 4

# Server startup
tail -10 /tmp/vite_dev_s10c.log

# Root HTML loads
curl -s http://localhost:5173/ > /tmp/vite_root_s10c.html
head -15 /tmp/vite_root_s10c.html

# TrajectoryChart.tsx serves
curl -s -o /dev/null -w "TrajectoryChart.tsx status: %{http_code}\n" http://localhost:5173/src/TrajectoryChart.tsx

# Recharts module resolves
curl -s -I http://localhost:5173/node_modules/.vite/deps/recharts.js 2>&1 | head -3
# (May 404 if Vite hasn't pre-bundled yet — that's fine, browser will load on demand)

# App.tsx transpiles with TrajectoryChart import
curl -s http://localhost:5173/src/App.tsx | grep -E "TrajectoryChart|trajectory" | head -5

kill $VITE_PID 2>/dev/null || pkill -f "vite" 2>/dev/null
sleep 1
```

### 5.3 Browser verification (Christian)

Restart dev server in foreground:

```bash
pnpm dev:web
```

Open `http://localhost:5173/`. Expected visual:

1. **Header** — "LayerCraft v6" + subtitle (unchanged from S-UI-02b)
2. **Scenario meta strip** — unchanged
3. **Four pill cards** — unchanged from S-UI-02b
4. **Trajectory chart** — NEW. White card below the pill grid with:
   - Title "Trip Trajectory"
   - Subtitle "Risk metrics over the 6.0-hour trip"
   - Line chart with three lines (MR green, HLR amber, CDI red)
   - X-axis labeled in hours (0h, 1h, 2h, ... 6h)
   - Y-axis labeled "Risk score", domain 0-10
   - Legend at bottom
   - Hovering shows a tooltip with the time and three values
5. **Preview disclosure block** — unchanged, now appears below the chart

If you see the chart with three lines and console is clean, win condition met.

---

## Phase 6 — Session close (single commit, no SHA backfill)

```bash
cd ~/Desktop/LC6-local

git status --short
# Expected:
#   modified:   apps/web/package.json
#   modified:   apps/web/src/App.tsx
#   modified:   apps/web/src/styles.css
#   new file:   apps/web/src/TrajectoryChart.tsx
#   modified:   pnpm-lock.yaml

git add apps/web/package.json \
        apps/web/src/App.tsx \
        apps/web/src/styles.css \
        apps/web/src/TrajectoryChart.tsx \
        pnpm-lock.yaml

git commit -m "S-UI-02c: trajectory chart for your_gear pill

apps/web extended from S-UI-02b's four-pill summary to also render
the trajectory time-series. S10B's per-cycle heat-balance backfill
becomes user-visible: MR, HLR, and CDI plotted against trip time
over the 6-hour Breck snowboarding scenario.

Library: Recharts 2.15.x (lightweight React-native charting, fixed
0-10 Y domain, line-chart-only at this scope).

Visual surface:
  - White card below the four-pill grid
  - Title 'Trip Trajectory' + duration subtitle
  - Three lines: MR (green #2f7d4f), HLR (amber #b87a1d), CDI (red #b3372f)
  - X-axis: hours (0h, 1h, 2h, ... formatted by formatHourTick)
  - Y-axis: 'Risk score' label, fixed 0-10 domain
  - Hover tooltip: time + three values to 2 decimal places
  - Legend at bottom of chart
  - Dot-less lines (clutter at trajectory lengths > 20 points);
    activeDot on hover only
  - ResponsiveContainer fills card width, fixed 320px height

Engine consumption: imports TrajectoryPoint type from @lc6/engine,
reads result.four_pill.your_gear.trajectory and projects to
{hours, MR, HLR, CDI} for Recharts. No engine modifications;
physics untouched.

Why your_gear only:
  - your_gear has the canonical trajectory for the user's ensemble
  - pacing/best_outcome are SEMANTICALLY-STUBBED per SessionA
    (object-spreads of paired pills with uses_pacing flipped) —
    same trajectory data, would render identical chart
  - optimal_gear collapses to user_ensemble when no strategy
    candidates supplied (STRATEGY-FALLBACK-WHEN-NO-CANDIDATES,
    observed in S-UI-02b browser check) — same trajectory, same
    chart. Future session adding gear-DB integration will diverge.

Files:
  apps/web/package.json                  — recharts ^2.15.0 added
  apps/web/src/TrajectoryChart.tsx       — new, single component
  apps/web/src/styles.css                — chart container styles appended
  apps/web/src/App.tsx                   — import + render below pill grid
  pnpm-lock.yaml                         — recharts deps locked

Out of scope (deferred):
  - Charts for pacing / optimal_gear / best_outcome (would render
    identical data until those pills become semantically real)
  - T_skin / T_core overlay (separate scope)
  - Threshold zones (red zone above MR=6, etc.) — uniform line
    colors at this polish tier
  - Phase-of-cycle bands (warmup / lift / run / rest)
  - Critical moments / strategy windows annotation
  - Chart export, interactivity beyond hover tooltips
  - Per-segment trajectory split

Non-regression: engine test suite unchanged (736 passed, 7 skipped,
0 failed). Web typecheck 0 errors. Engine typecheck unchanged at
S27 baseline. No engine code touched.

Memory #13 preserved: all artifacts Chat-authored, Code-executed
verbatim. Cardinal Rules preserved: no engine physics touched."

git push origin session-13-phy-humid-v2

# Verify push
git log origin/session-13-phy-humid-v2..HEAD --oneline
# Expected: empty

git log -5 --oneline
# Expected from top:
#   <SHA>  S-UI-02c: trajectory chart for your_gear pill
#   9054088 S-UI-02b: four-pill display + basic polish
#   bd192c0 S-UI-02b-HOTFIX-01: ...
#   33ffe4c S-UI-02b kickoff
#   6e19cb9 S-UI-01 close
```

---

## Halt conditions

Halt and report immediately if:

1. Pre-flight finds branch state other than HEAD `9054088` clean
2. Phase 1 — `pnpm install` fails or recharts unresolvable
3. Phase 2 — TypeScript errors in TrajectoryChart.tsx (most likely failure mode: a Recharts type signature I assumed wrong)
4. Phase 3 — CSS append fails or breaks existing styles
5. Phase 4 — App.tsx fails typecheck after import addition
6. Phase 5.1 — web typecheck non-zero
7. Phase 5.2 — dev server fails to start, TrajectoryChart.tsx doesn't serve, App.tsx doesn't transpile
8. Phase 5.3 — browser shows white screen, red React error overlay, missing chart, console errors, NaN/undefined values, or Recharts-specific render failures

On halt: capture full error output, do not attempt fixes, report to Chat. Do not modify engine.

---

## Likely failure modes

Based on today's session pattern of catching Chat authoring errors:

1. **Recharts API mismatch.** I'm authoring against my recollection of Recharts 2.x API. If the actual API has shifted (e.g., `Tooltip` formatter signature, `Legend` props, `ResponsiveContainer` behavior), Phase 5.1 typecheck catches it. Fix is mechanical — adjust to actual API signature.
2. **TrajectoryPoint not re-exported.** Already verified S-UI-02b session — `TrajectoryPoint` IS in the public API per `packages/engine/src/index.ts` line 142. Should not fail.
3. **CSS variable typo.** I'm using existing variables; if I typo'd one, the chart container just looks unstyled. Phase 5.3 visual catches.
4. **Fixed Y domain `[0, 10]` clips data.** If engine returns risk metrics > 10, the line goes off-chart. Engine's CDI v1.4 spec caps at 10 by design, so should not happen. If it does, halt and we widen the domain or use auto-scaling.
5. **Browser environment quirk like the S-UI-02b `process` issue.** Recharts is React-only and pure-browser; should not have Node-only globals. Possible but unlikely.

---

**END S-UI-02c KICKOFF.**
