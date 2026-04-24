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
