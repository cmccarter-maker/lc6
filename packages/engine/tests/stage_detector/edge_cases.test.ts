// Stage detector edge cases per CDI v1.4 §4.6 + Architecture v1.1 §9.1

import { describe, it, expect } from 'vitest';
import { detectStage, applyStagePromotion, detectShiveringSustained } from '../../src/cdi/index.js';

describe('Sustained shivering detection', () => {
  it('Brief shivering during cold-start transition does NOT trigger sustained', () => {
    // Q_shiver fires for 1 slice (15 min), then drops back
    const result = detectShiveringSustained({
      q_shiver_history: [0, 60, 0],
      slice_duration_min: 15,
    });
    expect(result.q_shiver_sustained).toBe(false);
  });

  it('Sustained shivering (3 slices at 15min = 45min) DOES trigger', () => {
    const result = detectShiveringSustained({
      q_shiver_history: [60, 80, 100],
      slice_duration_min: 15,
    });
    expect(result.q_shiver_sustained).toBe(true);
  });

  it('Shivering at 50W threshold does NOT trigger (must be > 50W)', () => {
    const result = detectShiveringSustained({
      q_shiver_history: [50, 50, 50],
      slice_duration_min: 15,
    });
    expect(result.q_shiver_sustained).toBe(false);
  });

  it('Involuntary shivering cessation detected: high → low transition', () => {
    const result = detectShiveringSustained({
      q_shiver_history: [120, 20],
      slice_duration_min: 15,
    });
    expect(result.shivering_ceased_involuntarily).toBe(true);
  });
});

describe('Stage promotion (15-min rule)', () => {
  it('Promotes mild_hypothermia → mild_hypothermia_deteriorating when τ < 15 min', () => {
    const promoted = applyStagePromotion('mild_hypothermia', 0.1); // 6 min
    expect(promoted).toBe('mild_hypothermia_deteriorating');
  });

  it('Does NOT promote when τ ≥ 15 min', () => {
    const promoted = applyStagePromotion('mild_hypothermia', 0.5); // 30 min
    expect(promoted).toBe('mild_hypothermia');
  });

  it('Does NOT promote terminal stages', () => {
    const promoted = applyStagePromotion('severe_hypothermia', null);
    expect(promoted).toBe('severe_hypothermia');
  });

  it('Promotes heat_exhaustion → heat_exhaustion_deteriorating when τ < 15 min', () => {
    const promoted = applyStagePromotion('heat_exhaustion', 0.2);
    expect(promoted).toBe('heat_exhaustion_deteriorating');
  });
});

describe('Heat stroke proactive detection', () => {
  it('T_core 39.0°C with projected crossing 40°C next slice → heat_stroke', () => {
    const result = detectStage({
      T_core: 39.0,
      T_skin: 35.0,
      S: 250,
      Q_shiver: 0,
      q_shiver_sustained: false,
      shivering_ceased_involuntarily: false,
      vasoconstriction_active: false,
      sweat_rate: 0.95,
      SW_max: 1.0,
      T_core_projected_next_slice: 40.1,
      cognitive_impairment_observed: false,
    });
    expect(result.stage).toBe('heat_stroke');
    expect(result.reasoning).toContain('projected to cross');
  });

  it('Cognitive impairment alone triggers heat_stroke regardless of T_core', () => {
    const result = detectStage({
      T_core: 39.5,
      T_skin: 36.0,
      S: 100,
      Q_shiver: 0,
      q_shiver_sustained: false,
      shivering_ceased_involuntarily: false,
      vasoconstriction_active: false,
      sweat_rate: 0.7,
      SW_max: 1.0,
      T_core_projected_next_slice: 39.6,
      cognitive_impairment_observed: true,
    });
    expect(result.stage).toBe('heat_stroke');
  });
});

describe('Cold severe detection', () => {
  it('T_core 31.5°C → severe_hypothermia', () => {
    const result = detectStage({
      T_core: 31.5,
      T_skin: 25.0,
      S: -200,
      Q_shiver: 30, // shivering ceasing
      q_shiver_sustained: false,
      shivering_ceased_involuntarily: false,
      vasoconstriction_active: true,
      sweat_rate: 0,
      SW_max: 1.0,
      T_core_projected_next_slice: 31.0,
      cognitive_impairment_observed: false,
    });
    expect(result.stage).toBe('severe_hypothermia');
  });

  it('Involuntary shivering cessation → severe_hypothermia', () => {
    const result = detectStage({
      T_core: 33.0, // above 32 threshold
      T_skin: 26.0,
      S: -300,
      Q_shiver: 25,
      q_shiver_sustained: false,
      shivering_ceased_involuntarily: true, // the dispositive signal
      vasoconstriction_active: true,
      sweat_rate: 0,
      SW_max: 1.0,
      T_core_projected_next_slice: 32.8,
      cognitive_impairment_observed: false,
    });
    expect(result.stage).toBe('severe_hypothermia');
  });
});
