// PHY-072: Critical Moment optimizer tests
// Verifies: budget enforcement, pivotal selection, silent trust for adequate gear

import { describe, it, expect } from 'vitest';
import {
  identifyCriticalMoments,
  buildStrategyWindows,
  MAX_CRITICAL_MOMENTS,
} from '../../src/scheduling/index.js';
import type { TrajectoryPoint } from '../../src/types.js';

function pt(t: number, MR: number, HLR: number, CDI: number, TSENS: number,
           phase: 'run' | 'lift' = 'run'): TrajectoryPoint {
  return {
    t, phase, T_core: 36.9, T_skin: 31.0,
    S: 0, MR, HLR, CDI, TSENS,
    clinical_stage: 'thermal_neutral',
    civd_protection: 0.9,
  } as TrajectoryPoint;
}

describe('PHY-072: identifyCriticalMoments', () => {
  it('returns empty array for adequate-gear trajectory (MR < 3, CDI < 4)', () => {
    const trajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < 40; i++) {
      const phase = i % 2 === 0 ? 'run' : 'lift';
      trajectory.push(pt(i * 300, i * 0.05, i % 2 === 0 ? 1.5 : 3.0, 0, i % 2 === 0 ? 1.2 : -0.5, phase));
    }
    const cms = identifyCriticalMoments(trajectory);
    expect(cms).toHaveLength(0);
  });

  it('fires at least ONE CM when MR crosses cascade threshold mid-trip', () => {
    const trajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < 40; i++) {
      const mr = i < 20 ? i * 0.15 : 3.0 + (i - 20) * 0.15;
      trajectory.push(pt(i * 300, mr, 2.0, 0, 1.0));
    }
    const cms = identifyCriticalMoments(trajectory);
    expect(cms.length).toBeGreaterThanOrEqual(1);
    const cascadeCm = cms.find(c => c.prevents === 'MR_cascade');
    expect(cascadeCm).toBeDefined();
    expect(cascadeCm!.action).toBe('vent_open');
    const cascadeCross = trajectory.findIndex(p => p.MR >= 4.0);
    expect(cascadeCm!.phase_index).toBeLessThan(cascadeCross);
  });

  it('enforces hard budget: ≤ 3 CMs even with many issues', () => {
    const trajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < 40; i++) {
      const mr = i < 10 ? i * 0.3 : 4.5 + (i - 10) * 0.05;
      const cdi = i < 25 ? 0 : 5.2;
      const tsens = (i >= 5 && i <= 15) ? 3.5 : 1.0;
      trajectory.push(pt(i * 300, mr, 2.0, cdi, tsens));
    }
    const cms = identifyCriticalMoments(trajectory);
    expect(cms.length).toBeLessThanOrEqual(MAX_CRITICAL_MOMENTS);
    expect(MAX_CRITICAL_MOMENTS).toBe(3);
  });

  it('prioritizes higher-severity interventions (CDI-5 present in output)', () => {
    const trajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < 40; i++) {
      const mr = i < 10 ? 1.0 : 4.2;
      const cdi = i < 15 ? 0 : 5.5;
      const tsens = (i >= 20 && i <= 30) ? 3.5 : 1.0;
      trajectory.push(pt(i * 300, mr, 2.0, cdi, tsens));
    }
    const cms = identifyCriticalMoments(trajectory);
    expect(cms.length).toBeGreaterThan(0);
    const prevents = cms.map(c => c.prevents);
    expect(prevents).toContain('CDI_5_impairment');
  });

  it('handles empty trajectory gracefully', () => {
    expect(identifyCriticalMoments([])).toEqual([]);
  });

  it('does not fire MR-cascade CM when cascade is at phase 0', () => {
    const trajectory: TrajectoryPoint[] = [
      pt(0, 4.5, 2, 0, 1),
      pt(300, 4.6, 2, 0, 1),
    ];
    const cms = identifyCriticalMoments(trajectory);
    expect(cms.find(c => c.prevents === 'MR_cascade')).toBeUndefined();
  });
});

describe('PHY-072: buildStrategyWindows', () => {
  it('produces 3-5 windows for a 6-hour trip', () => {
    const trajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < 72; i++) {
      trajectory.push(pt(i * 300, 1.0, 2.0, 0, 0.5));
    }
    const windows = buildStrategyWindows(trajectory);
    expect(windows.length).toBeGreaterThanOrEqual(3);
    expect(windows.length).toBeLessThanOrEqual(5);
  });

  it('labels running_warm regime when TSENS consistently > 1.0 and MR < 3', () => {
    const trajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < 72; i++) {
      trajectory.push(pt(i * 300, 2.0, 2.0, 0, 1.5));
    }
    const windows = buildStrategyWindows(trajectory);
    expect(windows.some(w => w.regime === 'running_warm')).toBe(true);
  });

  it('labels sweat_peak regime when MR approaches 3', () => {
    const trajectory: TrajectoryPoint[] = [];
    for (let i = 0; i < 72; i++) {
      trajectory.push(pt(i * 300, 2.8, 2.0, 0, 0.2));
    }
    const windows = buildStrategyWindows(trajectory);
    expect(windows.some(w => w.regime === 'sweat_peak')).toBe(true);
  });

  it('handles empty trajectory gracefully', () => {
    expect(buildStrategyWindows([])).toEqual([]);
  });
});
