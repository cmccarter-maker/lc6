// PHY-072: Integration test — alarm budget is inviolable end-to-end
// Regardless of gear quality or conditions, EngineOutput never exceeds 3 CMs.

import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/evaluate.js';
import { MAX_CRITICAL_MOMENTS } from '../../src/scheduling/index.js';
import type { EngineInput, GearEnsemble } from '../../src/types.js';

function makeEnsemble(id: string, label: string, totalClo: number, ensembleIm: number): GearEnsemble {
  return {
    ensemble_id: id,
    label,
    items: [
      { slot: 'base', product_id: `${id}-base`, product_name: 'base', warmth: 5, breathability: 7, fiber_primary: 'SYNTHETIC' },
      { slot: 'mid', product_id: `${id}-mid`, product_name: 'mid', warmth: 7, breathability: 7, fiber_primary: 'SYNTHETIC' },
      { slot: 'shell', product_id: `${id}-shell`, product_name: 'shell', warmth: 2, breathability: 5, fiber_primary: 'SYNTHETIC' },
      { slot: 'legwear', product_id: `${id}-leg`, product_name: 'leg', warmth: 5, breathability: 6, fiber_primary: 'SYNTHETIC' },
      { slot: 'footwear', product_id: `${id}-foot`, product_name: 'foot', warmth: 6, breathability: 3, fiber_primary: 'SYNTHETIC' },
      { slot: 'headgear', product_id: `${id}-head`, product_name: 'head', warmth: 5, breathability: 5, fiber_primary: 'SYNTHETIC' },
      { slot: 'handwear', product_id: `${id}-hand`, product_name: 'hand', warmth: 5, breathability: 4, fiber_primary: 'SYNTHETIC' },
    ],
    total_clo: totalClo,
    ensemble_im: ensembleIm,
  };
}

function makeInput(tempF: number, humidity: number, activity: string, durationHrs: number, userCLO: number, userIm: number): EngineInput {
  return {
    activity: {
      activity_id: activity,
      duration_hr: durationHrs,
      date_iso: "2026-02-03",
      segments: [{
        segment_id: 'seg-1',
        segment_label: 'Test',
        activity_id: activity,
        duration_hr: durationHrs,
        weather: [{ t_start: 0, t_end: durationHrs * 3600, temp_f: tempF, humidity, wind_mph: 10, precip_probability: 0 }],
      }],
    },
    location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
    biometrics: { sex: 'male', weight_lb: 180 },
    user_ensemble: makeEnsemble('user', 'User', userCLO, userIm),
    strategy_candidates: [],
  };
}

describe('PHY-072: Critical Moment budget is inviolable end-to-end', () => {
  it('never produces more than 3 CMs (adequate Breck kit)', () => {
    const input = makeInput(16, 40, 'snowboarding', 6, 3.4, 0.28);
    const result = evaluate(input);
    expect(result.critical_moments.length).toBeLessThanOrEqual(MAX_CRITICAL_MOMENTS);
  });

  it('never produces more than 3 CMs (marginal kit at cold)', () => {
    const input = makeInput(10, 40, 'skiing', 6, 2.2, 0.15);
    const result = evaluate(input);
    expect(result.critical_moments.length).toBeLessThanOrEqual(MAX_CRITICAL_MOMENTS);
  });

  it('never produces more than 3 CMs (hot humid cycling)', () => {
    const input = makeInput(90, 75, 'road_cycling', 3, 0.8, 0.30);
    const result = evaluate(input);
    expect(result.critical_moments.length).toBeLessThanOrEqual(MAX_CRITICAL_MOMENTS);
  });

  it('never produces more than 3 CMs (extreme cold)', () => {
    const input = makeInput(-20, 30, 'skiing', 4, 3.8, 0.22);
    const result = evaluate(input);
    expect(result.critical_moments.length).toBeLessThanOrEqual(MAX_CRITICAL_MOMENTS);
  });

  it('produces 3-5 strategy windows regardless of conditions', () => {
    const input = makeInput(16, 40, 'snowboarding', 6, 3.4, 0.28);
    const result = evaluate(input);
    expect(result.strategy_windows.length).toBeGreaterThanOrEqual(3);
    expect(result.strategy_windows.length).toBeLessThanOrEqual(5);
  });

  it('adequate Breck kit produces 0 CMs (silent trust)', () => {
    const input = makeInput(16, 40, 'snowboarding', 6, 3.4, 0.28);
    const result = evaluate(input);
    expect(result.critical_moments).toHaveLength(0);
  });
});
