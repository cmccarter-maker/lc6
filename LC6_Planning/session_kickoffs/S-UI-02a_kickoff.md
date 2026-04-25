# S-UI-02a Session Kickoff — Interactive Input Form (Minimal)

**Session ID:** S-UI-02a
**Authored by:** Chat
**Date:** April 24, 2026
**Branch:** `session-13-phy-humid-v2` (continuing from S-UI-02c close HEAD `7321b79`)
**Prerequisite HEAD:** `7321b79`
**Estimated duration:** 3-4 hours

---

## Why this session exists

S-UI-02c made the trajectory chart user-visible, but the input is still a hardcoded constant: Breck snowboarding 16°F 6hrs. Every refresh shows the same scenario. To use LC6 at all, a user needs to enter their own scenario.

S-UI-02a adds a controlled-input form that constructs the `EngineInput` object dynamically. After this lands, you can change activity / date / duration / weather / gear preset, click Run, and see how the four pills + trajectory chart respond.

**Win condition:** Browser at `http://localhost:5173/` shows a form at the top of the page. Form contains: activity dropdown, date input, duration number input, four weather inputs (temp/humidity/wind/precip), gear preset dropdown, Run button. Click Run → form-derived `EngineInput` flows into `evaluate()` → pill cards and trajectory chart re-render with the new result. Form fields are pre-populated with the current Breck-snowboarding defaults so the initial render matches what S-UI-02c shipped.

---

## Scope

### In scope (minimal form)

1. **`apps/web/src/InputForm.tsx`** — new file. Controlled-input form component with:
   - Activity dropdown (8 hardcoded options)
   - Date input (HTML5 date picker)
   - Duration in hours (number, 0.5–12)
   - Temp °F (number, -40 to 110)
   - Humidity % (number, 0–100)
   - Wind mph (number, 0–50)
   - Precip probability 0.0–1.0 (number, two decimal precision)
   - Gear preset dropdown (4 options: Light / Standard / Heavy / Snowboarding Kit)
   - Run button
   - Visual styling matches existing card aesthetic

2. **`apps/web/src/buildEngineInput.ts`** — new file. Pure helper that takes form state and returns a valid `EngineInput`. Encapsulates default values for fields the form doesn't expose (location lat/lng/elevation, biometrics, single-segment structure).

3. **`apps/web/src/gearPresets.ts`** — new file. Pure helper exposing 4 preset gear ensembles (Light / Standard / Heavy / Snowboarding Kit) as `GearEnsemble` objects.

4. **`apps/web/src/App.tsx`** — convert from static-render to stateful. Use `useState` to hold form state. On Run click, recompute `evaluate(buildEngineInput(formState))` and re-render. Initial state matches the current Breck snowboarding hardcoded input so first render is identical to S-UI-02c.

5. **`apps/web/src/styles.css`** — add form styling (form container, field grid, label/input typography, button)

### Out of scope (deferred to S-UI-02d or later)

- Per-slot gear customization (CLO/im inputs for each of 8 slots) — preset dropdown is enough
- Biometrics inputs (sex, weight) — defaulted to male / 180 lb in `buildEngineInput`
- Lat/lng/elevation inputs — defaulted to Breckenridge coordinates / 9600 ft
- Multi-segment weather (different conditions for different parts of trip) — single segment, single weather slice
- Strategy candidates — none supplied (Optimal Gear continues to fall back to user_ensemble)
- Form validation beyond HTML5 native (browser-native min/max enforcement only)
- Error display when `evaluate()` throws — for S-UI-02a, exceptions bubble to React error boundary as before
- Loading states / progress spinners — `evaluate()` is synchronous and fast enough not to need
- URL-synced form state / shareable links — separate scope
- Form layout responsive optimization beyond CSS grid breakpoints
- Tests
- Tracker updates

### Constraint reminders

- **Engine: zero changes.** S-UI-02a is pure UI work. Cardinal Rule #8 untriggered.
- **Defaults must produce S-UI-02c's exact initial render.** The form's initial state is the Breck snowboarding scenario. First page load before any user interaction looks identical to current.

---

## Pre-flight (Code executes)

```bash
cd ~/Desktop/LC6-local

# 1. Verify branch state
git status --short
git log --oneline -3
# Expected: HEAD at 7321b79 (S-UI-02c close), clean working tree
# (S30 tooling artifacts pre-existing untracked, unchanged)

# 2. Verify S-UI-02c stack still functional
pnpm --filter @lc6/web typecheck 2>&1 | tail -5
# Expected: 0 errors

pnpm --filter @lc6/engine test 2>&1 | tail -5
# Expected: 736 passed, 7 skipped, 0 failed

# 3. Confirm current apps/web/src state
ls -la apps/web/src/
# Expected: App.tsx, main.tsx, styles.css, TrajectoryChart.tsx (4 files)

# 4. Report back
echo "S-UI-02a pre-flight complete."
```

**Pre-flight gate:** branch clean at `7321b79`, web typecheck 0, engine 736/7/0, src/ has 4 files.

---

## Phase 1 — Create `apps/web/src/gearPresets.ts`

**New file:** `apps/web/src/gearPresets.ts`

Exposes 4 preset gear ensembles. Values are derived from existing test-suite ensembles (matches `evaluate.test.ts` Breck and `baselines.test.ts` golf/hiking/cycling — proven to produce sensible engine output).

Content verbatim:

```typescript
import type { GearEnsemble, EngineGearItem } from '@lc6/engine';

// ═══════════════════════════════════════════════════════════════════════════
// Gear preset library
// 4 hardcoded ensembles matching known-good test fixtures.
// All produce valid evaluate() input. S-UI-02d will replace presets with
// per-slot customization once gear DB integration begins.
// ═══════════════════════════════════════════════════════════════════════════

export type GearPresetId =
  | 'snowboarding_standard'
  | 'hiking_light'
  | 'hiking_standard'
  | 'road_cycling';

export interface GearPreset {
  id: GearPresetId;
  label: string;
  description: string;
  ensemble: GearEnsemble;
}

function makeItem(
  productIdSuffix: string,
  slot: EngineGearItem['slot'],
  clo: number,
  im: number,
): EngineGearItem {
  return {
    product_id: `preset-${productIdSuffix}-${slot}`,
    name: `${productIdSuffix} ${slot}`,
    slot,
    clo,
    im,
    fiber: 'synthetic',
  };
}

// Snowboarding standard — matches evaluate.test.ts BRECK_ENSEMBLE
const SNOWBOARDING_STANDARD: GearEnsemble = {
  ensemble_id: 'preset-snowboarding-standard',
  label: 'Snowboarding Standard',
  items: [
    makeItem('snowboarding', 'base', 0.3, 0.4),
    makeItem('snowboarding', 'mid', 0.5, 0.35),
    makeItem('snowboarding', 'insulative', 0.8, 0.25),
    makeItem('snowboarding', 'shell', 0.3, 0.15),
    makeItem('snowboarding', 'legwear', 0.5, 0.3),
    makeItem('snowboarding', 'footwear', 0.4, 0.2),
    makeItem('snowboarding', 'headgear', 0.2, 0.3),
    makeItem('snowboarding', 'handwear', 0.3, 0.25),
  ],
  total_clo: 2.5,
  ensemble_im: 0.25,
};

// Hiking light — for warm-weather day hikes
const HIKING_LIGHT: GearEnsemble = {
  ensemble_id: 'preset-hiking-light',
  label: 'Hiking Light',
  items: [
    makeItem('hike-light', 'base', 0.15, 0.42),
    makeItem('hike-light', 'legwear', 0.25, 0.38),
    makeItem('hike-light', 'footwear', 0.2, 0.30),
    makeItem('hike-light', 'headgear', 0.05, 0.45),
  ],
  total_clo: 0.65,
  ensemble_im: 0.39,
};

// Hiking standard — matches baselines.test.ts HIKING_ENSEMBLE
const HIKING_STANDARD: GearEnsemble = {
  ensemble_id: 'preset-hiking-standard',
  label: 'Hiking Standard',
  items: [
    makeItem('hike-std', 'base', 0.20, 0.40),
    makeItem('hike-std', 'mid', 0.40, 0.35),
    makeItem('hike-std', 'shell', 0.10, 0.30),
    makeItem('hike-std', 'legwear', 0.30, 0.35),
    makeItem('hike-std', 'footwear', 0.30, 0.22),
    makeItem('hike-std', 'headgear', 0.10, 0.35),
  ],
  total_clo: 1.40,
  ensemble_im: 0.33,
};

// Road cycling — matches baselines.test.ts CYCLING_ENSEMBLE
const ROAD_CYCLING: GearEnsemble = {
  ensemble_id: 'preset-road-cycling',
  label: 'Road Cycling',
  items: [
    makeItem('cycle', 'base', 0.10, 0.50),
    makeItem('cycle', 'legwear', 0.10, 0.48),
    makeItem('cycle', 'footwear', 0.10, 0.35),
    makeItem('cycle', 'headgear', 0.03, 0.50),
  ],
  total_clo: 0.33,
  ensemble_im: 0.46,
};

export const GEAR_PRESETS: ReadonlyArray<GearPreset> = [
  {
    id: 'snowboarding_standard',
    label: 'Snowboarding Standard',
    description: '8-layer kit, ~2.5 CLO — winter resort skiing/snowboarding',
    ensemble: SNOWBOARDING_STANDARD,
  },
  {
    id: 'hiking_light',
    label: 'Hiking Light',
    description: '4-layer kit, ~0.65 CLO — warm-weather day hikes',
    ensemble: HIKING_LIGHT,
  },
  {
    id: 'hiking_standard',
    label: 'Hiking Standard',
    description: '6-layer kit, ~1.4 CLO — cool-weather hikes 50-65°F',
    ensemble: HIKING_STANDARD,
  },
  {
    id: 'road_cycling',
    label: 'Road Cycling',
    description: '4-layer kit, ~0.33 CLO — high-output road cycling',
    ensemble: ROAD_CYCLING,
  },
];

export function getPresetById(id: GearPresetId): GearPreset {
  const preset = GEAR_PRESETS.find(p => p.id === id);
  if (!preset) {
    throw new Error(`Unknown gear preset: ${id}`);
  }
  return preset;
}
```

### Phase 1 verification

```bash
cd ~/Desktop/LC6-local

ls -la apps/web/src/gearPresets.ts
# Expected: file exists

pnpm --filter @lc6/web typecheck 2>&1 | tail -5
# Expected: 0 errors (file imports types from @lc6/engine, not yet referenced
# from App.tsx — typecheck passes because the file is well-typed in isolation)
```

**Phase 1 gate:** file created, web typecheck 0 errors.

---

## Phase 2 — Create `apps/web/src/buildEngineInput.ts`

**New file:** `apps/web/src/buildEngineInput.ts`

Pure helper. Form state in, `EngineInput` out. Encapsulates defaults for non-form fields.

Content verbatim:

```typescript
import type { EngineInput, GearEnsemble } from '@lc6/engine';

// ═══════════════════════════════════════════════════════════════════════════
// FormState — what InputForm holds in React state
// EngineInput — what evaluate() consumes
// buildEngineInput projects form → engine, supplying defaults for fields
// the form does not expose (location, biometrics, single-segment structure).
// ═══════════════════════════════════════════════════════════════════════════

export interface FormState {
  activity_id: string;
  date_iso: string;        // YYYY-MM-DD
  duration_hr: number;
  temp_f: number;
  humidity: number;        // 0-100
  wind_mph: number;
  precip_probability: number; // 0.0-1.0
  ensemble: GearEnsemble;
}

// Defaults for fields not in the form (S-UI-02d will expose biometrics, etc.)
const DEFAULT_LOCATION = {
  lat: 39.48,
  lng: -106.07,
  elevation_ft: 9600,
};

const DEFAULT_BIOMETRICS: { sex: 'male' | 'female'; weight_lb: number } = {
  sex: 'male',
  weight_lb: 180,
};

export function buildEngineInput(form: FormState): EngineInput {
  // Snow terrain: only set when activity is snow-sport-shaped
  const snowTerrain = isSnowActivity(form.activity_id) ? 'groomers' : undefined;

  return {
    activity: {
      activity_id: form.activity_id,
      duration_hr: form.duration_hr,
      date_iso: form.date_iso,
      ...(snowTerrain ? { snow_terrain: snowTerrain } : {}),
      segments: [
        {
          segment_id: 'seg-1',
          segment_label: `${form.activity_id} segment`,
          activity_id: form.activity_id,
          duration_hr: form.duration_hr,
          weather: [
            {
              t_start: 0,
              t_end: form.duration_hr * 3600,
              temp_f: form.temp_f,
              humidity: form.humidity,
              wind_mph: form.wind_mph,
              precip_probability: form.precip_probability,
            },
          ],
        },
      ],
    },
    location: { ...DEFAULT_LOCATION },
    biometrics: { ...DEFAULT_BIOMETRICS },
    user_ensemble: form.ensemble,
  };
}

function isSnowActivity(activityId: string): boolean {
  return (
    activityId === 'snowboarding' ||
    activityId === 'skiing' ||
    activityId === 'snowshoeing' ||
    activityId === 'backcountry_skiing'
  );
}
```

### Phase 2 verification

```bash
cd ~/Desktop/LC6-local

pnpm --filter @lc6/web typecheck 2>&1 | tail -5
# Expected: 0 errors
```

**Phase 2 gate:** typecheck 0 errors.

---

## Phase 3 — Create `apps/web/src/InputForm.tsx`

**New file:** `apps/web/src/InputForm.tsx`

Controlled inputs. Single Run button. Calls `onRun` with the assembled `FormState`.

Content verbatim:

```typescript
import { useState } from 'react';
import type { FormState } from './buildEngineInput.js';
import { GEAR_PRESETS, getPresetById } from './gearPresets.js';
import type { GearPresetId } from './gearPresets.js';

// Activity options — hardcoded subset of engine-supported activities.
// Full list lives in engine's ACTIVITY_MET; we surface the most common ones.
// Future polish session can pull dynamically from engine exports.
const ACTIVITY_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'snowboarding', label: 'Snowboarding' },
  { id: 'skiing', label: 'Skiing' },
  { id: 'hiking', label: 'Hiking' },
  { id: 'day_hike', label: 'Day Hike' },
  { id: 'backpacking', label: 'Backpacking' },
  { id: 'trail_running', label: 'Trail Running' },
  { id: 'road_cycling', label: 'Road Cycling' },
  { id: 'golf', label: 'Golf' },
];

interface InputFormProps {
  initialState: FormState;
  onRun: (state: FormState) => void;
}

export function InputForm({ initialState, onRun }: InputFormProps) {
  const [activity, setActivity] = useState(initialState.activity_id);
  const [dateIso, setDateIso] = useState(initialState.date_iso);
  const [durationHr, setDurationHr] = useState(initialState.duration_hr);
  const [tempF, setTempF] = useState(initialState.temp_f);
  const [humidity, setHumidity] = useState(initialState.humidity);
  const [windMph, setWindMph] = useState(initialState.wind_mph);
  const [precipProbability, setPrecipProbability] = useState(initialState.precip_probability);

  // Determine current preset by matching ensemble.ensemble_id to a preset.
  // If initial ensemble is not a preset, default to snowboarding_standard.
  const initialPresetId: GearPresetId =
    (GEAR_PRESETS.find(p => p.ensemble.ensemble_id === initialState.ensemble.ensemble_id)?.id) ??
    'snowboarding_standard';
  const [presetId, setPresetId] = useState<GearPresetId>(initialPresetId);

  function handleRun() {
    const preset = getPresetById(presetId);
    onRun({
      activity_id: activity,
      date_iso: dateIso,
      duration_hr: durationHr,
      temp_f: tempF,
      humidity: humidity,
      wind_mph: windMph,
      precip_probability: precipProbability,
      ensemble: preset.ensemble,
    });
  }

  return (
    <div className="input-form-container">
      <div className="input-form-header">
        <h2 className="input-form-title">Trip Setup</h2>
        <p className="input-form-subtitle">
          Configure activity, conditions, and gear. Click Run to compute.
        </p>
      </div>

      <div className="input-form-grid">
        <div className="form-field">
          <label className="form-label" htmlFor="form-activity">Activity</label>
          <select
            id="form-activity"
            className="form-input"
            value={activity}
            onChange={e => setActivity(e.target.value)}
          >
            {ACTIVITY_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-date">Date</label>
          <input
            id="form-date"
            type="date"
            className="form-input"
            value={dateIso}
            onChange={e => setDateIso(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-duration">Duration (hr)</label>
          <input
            id="form-duration"
            type="number"
            className="form-input"
            min={0.5}
            max={12}
            step={0.5}
            value={durationHr}
            onChange={e => setDurationHr(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-temp">Temp (°F)</label>
          <input
            id="form-temp"
            type="number"
            className="form-input"
            min={-40}
            max={110}
            step={1}
            value={tempF}
            onChange={e => setTempF(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-humidity">Humidity (%)</label>
          <input
            id="form-humidity"
            type="number"
            className="form-input"
            min={0}
            max={100}
            step={1}
            value={humidity}
            onChange={e => setHumidity(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-wind">Wind (mph)</label>
          <input
            id="form-wind"
            type="number"
            className="form-input"
            min={0}
            max={50}
            step={1}
            value={windMph}
            onChange={e => setWindMph(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-precip">Precip prob (0-1)</label>
          <input
            id="form-precip"
            type="number"
            className="form-input"
            min={0}
            max={1}
            step={0.05}
            value={precipProbability}
            onChange={e => setPrecipProbability(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-preset">Gear Preset</label>
          <select
            id="form-preset"
            className="form-input"
            value={presetId}
            onChange={e => setPresetId(e.target.value as GearPresetId)}
          >
            {GEAR_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="input-form-actions">
        <button
          type="button"
          className="form-run-button"
          onClick={handleRun}
        >
          Run
        </button>
      </div>
    </div>
  );
}
```

### Phase 3 verification

```bash
cd ~/Desktop/LC6-local

pnpm --filter @lc6/web typecheck 2>&1 | tail -10
# Expected: 0 errors
```

**Phase 3 gate:** typecheck 0 errors.

**Likely failure mode:** TypeScript may complain about `e.target.value as GearPresetId` cast — it's a runtime-unsafe cast but the union is a finite set of strings the dropdown enforces. If TS rejects, the fix is a guard function. Phase 3 gate catches.

---

## Phase 4 — Update `apps/web/src/App.tsx` to use form state

Convert App from static-render to stateful. Initial state matches current Breck-snowboarding to preserve the S-UI-02c initial render.

**Target file:** `apps/web/src/App.tsx`

**Full replacement.** Content verbatim:

```typescript
import { useState } from 'react';
import { evaluate } from '@lc6/engine';
import type {
  PillResult,
  ClinicalStage,
} from '@lc6/engine';
import { TrajectoryChart } from './TrajectoryChart.js';
import { InputForm } from './InputForm.js';
import { buildEngineInput } from './buildEngineInput.js';
import type { FormState } from './buildEngineInput.js';
import { getPresetById } from './gearPresets.js';

// ═══════════════════════════════════════════════════════════════════════════
// Initial form state — matches S-UI-02c hardcoded Breck snowboarding scenario.
// First render is identical to S-UI-02c output before any user interaction.
// ═══════════════════════════════════════════════════════════════════════════

const INITIAL_FORM_STATE: FormState = {
  activity_id: 'snowboarding',
  date_iso: '2026-02-03',
  duration_hr: 6,
  temp_f: 16,
  humidity: 45,
  wind_mph: 10,
  precip_probability: 0,
  ensemble: getPresetById('snowboarding_standard').ensemble,
};

// ═══════════════════════════════════════════════════════════════════════════
// Risk-tier mapping helpers (unchanged from S-UI-02b)
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

const PILL_LABELS: Record<PillResult['pill_id'], string> = {
  your_gear: 'Your Gear',
  pacing: 'Pacing',
  optimal_gear: 'Optimal Gear',
  best_outcome: 'Best Outcome',
};

const STUBBED_PILL_IDS: ReadonlyArray<PillResult['pill_id']> = [
  'pacing',
  'best_outcome',
];

function isStubbedPill(pillId: PillResult['pill_id']): boolean {
  return STUBBED_PILL_IDS.includes(pillId);
}

// ═══════════════════════════════════════════════════════════════════════════
// PillCard (unchanged from S-UI-02b)
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
// App — stateful container; form drives the engine call
// ═══════════════════════════════════════════════════════════════════════════

export function App() {
  // formState is the source of truth for both form display AND the active result.
  // On Run click, formState updates → useMemo recomputes evaluate() → re-render.
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);

  // Compute fresh on every formState change. evaluate() is pure and fast.
  const result = evaluate(buildEngineInput(formState));
  const fp = result.four_pill;

  // Activity label for scenario meta strip — pulled from form state.
  const activityLabel = formState.activity_id
    .split('_')
    .map(w => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">LayerCraft v6</h1>
        <p className="page-subtitle">
          Engine smoke test — interactive trip configuration
        </p>
      </header>

      <InputForm
        initialState={INITIAL_FORM_STATE}
        onRun={setFormState}
      />

      <div className="scenario-meta">
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Activity</span>
          <span className="scenario-meta-value">{activityLabel}</span>
        </div>
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Date</span>
          <span className="scenario-meta-value">{formState.date_iso}</span>
        </div>
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Conditions</span>
          <span className="scenario-meta-value">
            {formState.temp_f}°F · {formState.humidity}% RH · {formState.wind_mph} mph
          </span>
        </div>
        <div className="scenario-meta-item">
          <span className="scenario-meta-label">Duration</span>
          <span className="scenario-meta-value">{formState.duration_hr} hours</span>
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

      <TrajectoryChart trajectory={fp.your_gear.trajectory} />

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

**Design notes:**
- `useState<FormState>(INITIAL_FORM_STATE)` — single source of truth for both form display and result computation
- `evaluate(buildEngineInput(formState))` runs on every render. React renders are cheap; engine call is fast (single-digit ms). No `useMemo` needed.
- `onRun={setFormState}` — InputForm calls `onRun(newFormState)` on Run click; App's setFormState fires; React re-renders with new computation
- **The form holds its own internal state separate from App's `formState`**. User edits to inputs don't trigger `evaluate()`. Only Run does. This is intentional — keeps the page stable while user is mid-edit and prevents thrashing on every keystroke.
- Scenario meta strip now derives from `formState`, not hardcoded. Reflects whatever the user last ran.
- `engine_version` still reads from result (since that's where it actually lives).

### Phase 4 verification

```bash
cd ~/Desktop/LC6-local

pnpm --filter @lc6/web typecheck 2>&1 | tail -10
# Expected: 0 errors

pnpm --filter @lc6/engine test 2>&1 | tail -5
# Expected: 736 passed, 7 skipped, 0 failed
```

**Phase 4 gate:** web typecheck 0 errors, engine tests unchanged.

---

## Phase 5 — Append form styling to `apps/web/src/styles.css`

**Target:** `apps/web/src/styles.css`

**At the end of the file (after the `.trajectory-chart-empty` rules), append:**

```css
/* ── Input form (S-UI-02a) ─────────────────────────────────────── */

.input-form-container {
  margin-top: 24px;
  padding: 24px;
  background-color: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-card);
  box-shadow: var(--color-card-shadow);
}

.input-form-header {
  margin-bottom: 16px;
}

.input-form-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}

.input-form-subtitle {
  font-size: 13px;
  color: var(--color-fg-muted);
  margin: 4px 0 0 0;
}

.input-form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 1024px) {
  .input-form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .input-form-grid {
    grid-template-columns: 1fr;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: var(--font-size-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-fg-muted);
}

.form-input {
  font-family: inherit;
  font-size: 14px;
  padding: 8px 10px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-badge);
  color: var(--color-fg);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-fg);
}

.input-form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.form-run-button {
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 24px;
  background-color: var(--color-fg);
  color: var(--color-card-bg);
  border: 1px solid var(--color-fg);
  border-radius: var(--radius-badge);
  cursor: pointer;
  letter-spacing: 0.02em;
}

.form-run-button:hover {
  background-color: #2a2a2a;
}

.form-run-button:active {
  background-color: #000000;
}
```

Reuses existing CSS variables. No new variables added. Form styling matches existing card aesthetic (white card with light shadow, modest borders).

---

## Phase 6 — Verification

### 6.1 Typecheck

```bash
cd ~/Desktop/LC6-local

pnpm --filter @lc6/web typecheck 2>&1 | tail -10
# Expected: 0 errors

pnpm --filter @lc6/engine typecheck 2>&1 | tail -5
# Expected: 8 S27 baseline (unchanged)

pnpm --filter @lc6/engine test 2>&1 | tail -5
# Expected: 736 passed, 7 skipped, 0 failed
```

### 6.2 Dev server smoke test

```bash
pnpm --filter @lc6/web dev > /tmp/vite_dev_s10a.log 2>&1 &
VITE_PID=$!
sleep 4

tail -10 /tmp/vite_dev_s10a.log

curl -s -o /dev/null -w "Root HTML: %{http_code}\n" http://localhost:5173/
curl -s -o /dev/null -w "InputForm.tsx: %{http_code}\n" http://localhost:5173/src/InputForm.tsx
curl -s -o /dev/null -w "buildEngineInput.ts: %{http_code}\n" http://localhost:5173/src/buildEngineInput.ts
curl -s -o /dev/null -w "gearPresets.ts: %{http_code}\n" http://localhost:5173/src/gearPresets.ts

# App.tsx contains InputForm import + useState
curl -s http://localhost:5173/src/App.tsx | grep -E "InputForm|useState|setFormState" | head -5

kill $VITE_PID 2>/dev/null || pkill -f "vite" 2>/dev/null
sleep 1
```

### 6.3 Browser visual check (Christian)

Restart dev server in foreground:
```bash
pnpm dev:web
```

Open `http://localhost:5173/`. Expected:

1. **Header** — unchanged
2. **NEW: Trip Setup form** — white card below the header with:
   - Title "Trip Setup" + subtitle
   - 8 input fields in a grid: Activity / Date / Duration / Temp / Humidity / Wind / Precip / Gear Preset
   - Pre-populated with Breck snowboarding values (snowboarding, 2026-02-03, 6 hr, 16°F, 45% humidity, 10 mph wind, 0 precip, Snowboarding Standard)
   - "Run" button at bottom right
3. **Scenario meta strip** — values match form state
4. **Four pill cards** — values match the engine call result for the form's input
5. **Trajectory chart** — line chart for the form's input
6. **Preview disclosure block** — unchanged

**Interaction tests:**
- Change Temp from 16 to 60 → click Run → pill values change, chart shape changes (warm-weather scenario)
- Change Activity to "Hiking" + Gear Preset to "Hiking Light" → click Run → different chart shape (no cycle structure for non-cyclic activity)
- Initial values must match S-UI-02c output (smoke test that defaults are preserved)

If form renders, default values match S-UI-02c, and clicking Run with changed values updates the page → win condition met.

---

## Phase 7 — Session close (single commit, no SHA backfill)

```bash
cd ~/Desktop/LC6-local

# Stop dev server
pkill -f "vite" 2>/dev/null
sleep 1

git status --short
# Expected:
#   modified:   apps/web/src/App.tsx
#   modified:   apps/web/src/styles.css
#   new file:   apps/web/src/InputForm.tsx
#   new file:   apps/web/src/buildEngineInput.ts
#   new file:   apps/web/src/gearPresets.ts

git add apps/web/src/App.tsx \
        apps/web/src/styles.css \
        apps/web/src/InputForm.tsx \
        apps/web/src/buildEngineInput.ts \
        apps/web/src/gearPresets.ts

git commit -m "S-UI-02a: interactive input form (minimal)

apps/web extended from S-UI-02c's hardcoded Breck snowboarding scenario
to a controlled-input form that constructs EngineInput dynamically.
User can change activity, date, duration, weather, and gear preset;
clicking Run re-runs evaluate() and re-renders pills + chart.

Form fields:
  - Activity dropdown (8 hardcoded options: snowboarding, skiing,
    hiking, day_hike, backpacking, trail_running, road_cycling, golf)
  - Date input (HTML5 date picker)
  - Duration in hours (number, 0.5-12)
  - Temp °F (number, -40 to 110)
  - Humidity % (number, 0-100)
  - Wind mph (number, 0-50)
  - Precip probability 0.0-1.0 (number, 0.05 step)
  - Gear preset dropdown (Snowboarding Standard / Hiking Light /
    Hiking Standard / Road Cycling)
  - Run button

Initial form state matches S-UI-02c hardcoded scenario exactly:
snowboarding, 2026-02-03, 6 hr, 16°F, 45% humidity, 10 mph wind,
0 precip, Snowboarding Standard ensemble. First page load before
any user interaction is identical to S-UI-02c output.

Architecture:
  - apps/web/src/gearPresets.ts (new) — 4 hardcoded GearEnsemble
    presets. Values derived from existing test fixtures
    (evaluate.test.ts BRECK_ENSEMBLE, baselines.test.ts golf/
    hiking/cycling). All produce valid evaluate() input.
  - apps/web/src/buildEngineInput.ts (new) — pure helper:
    FormState in, EngineInput out. Encapsulates defaults for
    fields the form does not expose (location: Breckenridge
    coordinates 39.48, -106.07, 9600 ft; biometrics: male, 180 lb).
  - apps/web/src/InputForm.tsx (new) — controlled-input form
    component. Holds its own internal state (no engine recompute
    on each keystroke); calls onRun(formState) only on button click.
  - apps/web/src/App.tsx — converted from static-render to stateful.
    useState holds active form state; on Run, setFormState fires →
    evaluate(buildEngineInput(formState)) recomputes.
  - apps/web/src/styles.css — form container + grid + input + button
    rules appended. Reuses existing CSS variables (no new variables).

Files:
  apps/web/src/App.tsx              — stateful container
  apps/web/src/InputForm.tsx        — new, controlled form component
  apps/web/src/buildEngineInput.ts  — new, FormState → EngineInput projection
  apps/web/src/gearPresets.ts       — new, 4 preset GearEnsembles
  apps/web/src/styles.css           — form styling appended

Out of scope (deferred to S-UI-02d or later):
  - Per-slot gear customization (CLO/im inputs for each of 8 slots)
  - Biometrics inputs (sex, weight) — defaulted to male/180 lb
  - Lat/lng/elevation inputs — defaulted to Breck coordinates
  - Multi-segment weather (different conditions for trip parts)
  - Strategy candidates — Optimal Gear continues to fall back to
    user_ensemble per STRATEGY-FALLBACK-WHEN-NO-CANDIDATES
  - Form validation beyond HTML5 native
  - Error display when evaluate() throws
  - Loading states / progress spinners
  - URL-synced form state / shareable links
  - Tests
  - Tracker updates

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
#   <SHA>  S-UI-02a: interactive input form (minimal)
#   7321b79 S-UI-02c: trajectory chart for your_gear pill
#   84d1956 S-UI-02c kickoff
#   9054088 S-UI-02b: four-pill display + basic polish
#   bd192c0 S-UI-02b-HOTFIX-01
```

---

## Halt conditions

Halt and report immediately if:

1. Pre-flight finds branch state other than HEAD `7321b79` clean
2. Phase 1/2/3 — typecheck error in any new file (most likely failure mode: type signature mismatch in form-control props or `EngineInput` field shape I got wrong)
3. Phase 4 — App.tsx typecheck fails after refactor to stateful (most likely: useState generic, prop shape between App and InputForm, or InputForm usage mismatching its declared props)
4. Phase 6.1 — web typecheck non-zero
5. Phase 6.2 — dev server fails to start, any 4xx/5xx response, App.tsx transpile missing useState/InputForm symbols
6. Phase 6.3 — browser shows white screen, red React error overlay, form fields not rendering, Run button doesn't update display, initial values don't match S-UI-02c, or any console errors

On halt: capture full error output, do not attempt fixes, report to Chat. Do not modify engine.

---

## Likely failure modes

Based on today's authoring error pattern:

1. **Form input type coercion.** I'm using `Number(e.target.value)` for numeric inputs. If user clears the field, `Number('')` returns 0, which silently substitutes 0 for an empty input. Probably fine for S-UI-02a scope but worth knowing. Phase 6.3 visual gate would catch any visible weirdness.

2. **`e.target.value as GearPresetId` cast.** TypeScript may warn about this. If it does, fix is a switch-statement type guard. Phase 3 typecheck catches.

3. **`EngineInput.activity` shape.** I authored against types.ts but didn't explicitly verify every required field. If `validate()` throws in browser at runtime (e.g., I missed a required field), Phase 6.3 visual catches as a red error overlay.

4. **`snow_terrain` conditional.** I conditionally include `snow_terrain` only for snow activities. If the engine requires it absent rather than undefined for non-snow activities, this works (spread doesn't add the key). If the engine has different requirements, Phase 6.3 catches.

5. **CSS for `select` element.** The `.form-input` class targets `<input>` and `<select>`. They render slightly differently in browsers. Visual quirks are non-blocking.

6. **Re-render performance.** `evaluate()` runs on every React render, not just on Run click. Form input changes don't trigger evaluate (they update InputForm's internal state, not App's formState), so this should not thrash. But worth confirming via DevTools Performance tab if anything feels sluggish.

---

**END S-UI-02a KICKOFF.**
