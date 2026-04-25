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
