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
