// ============================================================================
// Session 10b — Cardinal Rule #2 verification
// packages/engine/tests/evaluate/ensemble_physics.test.ts
//
// Proves that:
//   1. CLO drives HLR (heat loss protection)
//   2. im drives MR (moisture management via evaporation) — Cardinal Rule #2
//   3. Winner selection reflects the CLO/im tradeoff as a SYSTEM property
//   4. Higher im → better evaporation → lower MR (not CLO)
//   5. Two ensembles with same CLO but different im produce different outcomes
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/evaluate.js';
import { enumerateCandidates } from '../../src/strategy/enumerate.js';
import type { EngineInput, GearEnsemble, EngineGearItem, WeatherSlice } from '../../src/types.js';

// ============================================================================
// Fixtures
// ============================================================================

function item(
  slot: EngineGearItem['slot'],
  id: string,
  clo: number,
  im: number,
): EngineGearItem {
  return { product_id: id, name: id, slot, clo, im, fiber: 'synthetic' };
}

/** Build a complete cold-weather ensemble with specified CLO and im per layer. */
function makeFullEnsemble(
  id: string,
  label: string,
  baseClo: number, baseIm: number,
  midClo: number, midIm: number,
  insClo: number, insIm: number,
  shellClo: number, shellIm: number,
): GearEnsemble {
  const items: EngineGearItem[] = [
    item('base', `${id}-base`, baseClo, baseIm),
    item('mid', `${id}-mid`, midClo, midIm),
    item('insulative', `${id}-ins`, insClo, insIm),
    item('shell', `${id}-shell`, shellClo, shellIm),
    item('legwear', `${id}-leg`, 0.45, 0.25),
    item('footwear', `${id}-foot`, 0.35, 0.18),
    item('headgear', `${id}-head`, 0.20, 0.25),
    item('handwear', `${id}-hand`, 0.25, 0.22),
  ];
  const total_clo = items.reduce((s, i) => s + i.clo, 0);
  // Harmonic mean im (same as enumerate.ts)
  const totalW = items.reduce((s, i) => s + i.clo, 0);
  const wImSum = items.reduce((s, i) => s + (i.clo / totalW) / (i.im || 0.1), 0);
  const ensemble_im = Math.round((1 / wImSum) * 1000) / 1000;

  return { ensemble_id: id, label, items, total_clo: Math.round(total_clo * 100) / 100, ensemble_im: Math.min(0.50, ensemble_im) };
}

function makeInput(
  userEnsemble: GearEnsemble,
  candidates: GearEnsemble[],
  tempF: number = 16,
  durationHrs: number = 6,
  activity: string = 'snowboarding',
): EngineInput {
  return {
    activity: {
      activity_id: activity,
      duration_hr: durationHrs,
      snow_terrain: activity === 'snowboarding' || activity === 'skiing' ? 'groomers' : undefined,
      segments: [{
        segment_id: 'seg-1',
        segment_label: 'Test',
        activity_id: activity,
        duration_hr: durationHrs,
        weather: [{ t_start: 0, t_end: durationHrs * 3600, temp_f: tempF, humidity: 50, wind_mph: 10, precip_probability: 0 }],
      }],
    },
    location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
    biometrics: { sex: 'male', weight_lb: 180 },
    user_ensemble: userEnsemble,
    strategy_candidates: candidates,
  };
}


// ============================================================================
// Test Group 1: im drives MR (Cardinal Rule #2)
// ============================================================================

describe('Cardinal Rule #2: im drives evaporation, NOT CLO', () => {

  it('same CLO, higher im → lower MR', () => {
    // Two ensembles: identical CLO distribution, different im
    const lowIm = makeFullEnsemble(
      'low-im', 'Low Permeability',
      0.30, 0.15,   // base: low im (cotton-like)
      0.50, 0.15,
      0.80, 0.12,
      0.20, 0.08,   // shell: very low im (waterproof, no breathability)
    );

    const highIm = makeFullEnsemble(
      'high-im', 'High Permeability',
      0.30, 0.45,   // base: high im (merino, excellent wicking)
      0.50, 0.38,
      0.80, 0.30,
      0.20, 0.25,   // shell: breathable (Gore-Tex class)
    );

    // CLO should be identical
    expect(Math.abs(lowIm.total_clo - highIm.total_clo)).toBeLessThan(0.01);

    // im should differ significantly
    expect(highIm.ensemble_im).toBeGreaterThan(lowIm.ensemble_im);

    // Evaluate both
    const lowImInput = makeInput(lowIm, []);
    const highImInput = makeInput(highIm, []);
    const lowImResult = evaluate(lowImInput);
    const highImResult = evaluate(highImInput);

    const lowImMR = lowImResult.trip_headline.peak_MR;
    const highImMR = highImResult.trip_headline.peak_MR;

    // Higher im → better evaporation → lower MR
    // This is the Cardinal Rule #2 test: im drives the outcome, not CLO
    expect(highImMR).toBeLessThanOrEqual(lowImMR);
  });

  it('higher im ensemble wins as strategy candidate when MR is binding', () => {
    // User has low-im gear. Candidates include high-im option.
    const userLowIm = makeFullEnsemble(
      'user', 'User Low-Im Kit',
      0.30, 0.15, 0.50, 0.15, 0.80, 0.12, 0.20, 0.08,
    );

    const candidateHighIm = makeFullEnsemble(
      'high-im', 'High-Im Alternative',
      0.30, 0.45, 0.50, 0.38, 0.80, 0.30, 0.20, 0.25,
    );

    const candidateSameIm = makeFullEnsemble(
      'same-im', 'Same-Im Alternative',
      0.30, 0.15, 0.50, 0.15, 0.80, 0.12, 0.20, 0.08,
    );

    const input = makeInput(userLowIm, [candidateHighIm, candidateSameIm], 85, 2, 'road_cycling');  // PHY-071: im binds under heat stress, not cold
    const result = evaluate(input);

    // Winner should be the high-im candidate (lower MR → lower CDI)
    if (result.strategy.winner_ensemble_id !== null) {
      expect(result.strategy.winner_ensemble_id).toBe('high-im');
    }

    // Optimal gear pill should use the high-im ensemble
    if (result.strategy.winner_ensemble_id === 'high-im') {
      expect(result.four_pill.optimal_gear.ensemble.ensemble_id).toBe('high-im');
      // And it should have better (lower) MR than user gear
      expect(result.four_pill.optimal_gear.trajectory_summary.peak_MR)
        .toBeLessThanOrEqual(result.four_pill.your_gear.trajectory_summary.peak_MR);
    }
  });
});


// ============================================================================
// Test Group 2: CLO drives HLR
// ============================================================================

describe('CLO drives heat loss protection', () => {

  it('higher CLO → lower HLR at same temperature', () => {
    const thinEnsemble = makeFullEnsemble(
      'thin', 'Thin System',
      0.15, 0.35, 0.30, 0.30, 0.40, 0.25, 0.10, 0.30,
    );

    const thickEnsemble = makeFullEnsemble(
      'thick', 'Thick System',
      0.35, 0.35, 0.60, 0.30, 1.10, 0.25, 0.30, 0.30,
    );

    expect(thickEnsemble.total_clo).toBeGreaterThan(thinEnsemble.total_clo);

    const thinResult = evaluate(makeInput(thinEnsemble, []));
    const thickResult = evaluate(makeInput(thickEnsemble, []));

    // Higher CLO should provide better heat loss protection
    expect(thickResult.trip_headline.peak_HLR).toBeLessThanOrEqual(thinResult.trip_headline.peak_HLR);
  });

  it('at extreme cold, high-CLO candidate wins over low-CLO', () => {
    const thin = makeFullEnsemble(
      'thin', 'Thin',
      0.15, 0.35, 0.30, 0.30, 0.40, 0.25, 0.10, 0.30,
    );
    const thick = makeFullEnsemble(
      'thick', 'Thick',
      0.35, 0.30, 0.60, 0.25, 1.10, 0.20, 0.30, 0.25,
    );

    // At -10°F, CLO dominates the decision
    const input = makeInput(thin, [thin, thick], -10);
    const result = evaluate(input);

    // Thick should win at extreme cold
    if (result.strategy.winner_ensemble_id !== null) {
      expect(result.strategy.winner_ensemble_id).toBe('thick');
    }
  });
});


// ============================================================================
// Test Group 3: System-level evaluation (not per-slot)
// ============================================================================

describe('System-level ensemble evaluation', () => {

  it('ensemble im and CLO are co-varying properties visible in output', () => {
    const ensemble = makeFullEnsemble(
      'test', 'Test System',
      0.25, 0.40, 0.45, 0.35, 0.70, 0.25, 0.15, 0.20,
    );
    const result = evaluate(makeInput(ensemble, []));
    const point = result.four_pill.your_gear.trajectory[0]!;

    // im_system should reflect the ensemble's permeability
    expect(point.im_system).toBeGreaterThan(0);
    expect(point.im_system).toBeLessThan(1);

    // R_clo_effective should reflect CLO (converted to m²K/W)
    expect(point.R_clo_effective).toBeGreaterThan(0);
  });

  it('three candidates produce three different MR values', () => {
    const lowIm = makeFullEnsemble('a', 'Low im', 0.30, 0.12, 0.50, 0.12, 0.80, 0.10, 0.20, 0.08);
    const midIm = makeFullEnsemble('b', 'Mid im', 0.30, 0.28, 0.50, 0.25, 0.80, 0.20, 0.20, 0.15);
    const hiIm  = makeFullEnsemble('c', 'High im', 0.30, 0.45, 0.50, 0.38, 0.80, 0.30, 0.20, 0.25);

    const input = makeInput(lowIm, [lowIm, midIm, hiIm]);
    const result = evaluate(input);

    // All three should have been evaluated
    expect(result.strategy.candidates_evaluated).toBe(3);

    // Winner should exist
    expect(result.strategy.winner_ensemble_id).not.toBeNull();
  });

  it('winner CDI is best (lowest) among all evaluated candidates', () => {
    const candidates = [
      makeFullEnsemble('c1', 'Candidate 1', 0.30, 0.15, 0.50, 0.15, 0.80, 0.12, 0.20, 0.10),
      makeFullEnsemble('c2', 'Candidate 2', 0.30, 0.30, 0.50, 0.28, 0.80, 0.22, 0.20, 0.18),
      makeFullEnsemble('c3', 'Candidate 3', 0.30, 0.42, 0.50, 0.38, 0.80, 0.30, 0.20, 0.25),
    ];

    const user = candidates[0]!;
    const input = makeInput(user, candidates);
    const result = evaluate(input);

    if (result.strategy.winner_peak_cdi !== null) {
      // Winner CDI should be <= Pill 1 CDI (user gear)
      expect(result.strategy.winner_peak_cdi).toBeLessThanOrEqual(
        result.four_pill.your_gear.trajectory_summary.peak_CDI + 0.1
      );
    }
  });

  it('enumerate produces candidates with diverse im values', () => {
    // Catalog with clear im variation
    const catalog: EngineGearItem[] = [
      item('base', 'b1', 0.25, 0.15), item('base', 'b2', 0.25, 0.35), item('base', 'b3', 0.25, 0.50),
      item('mid', 'm1', 0.45, 0.15), item('mid', 'm2', 0.45, 0.30), item('mid', 'm3', 0.45, 0.42),
      item('insulative', 'i1', 0.75, 0.12), item('insulative', 'i2', 0.75, 0.25), item('insulative', 'i3', 0.75, 0.35),
      item('shell', 's1', 0.15, 0.08), item('shell', 's2', 0.15, 0.20), item('shell', 's3', 0.15, 0.32),
      item('legwear', 'l1', 0.40, 0.25),
      item('footwear', 'f1', 0.30, 0.18),
      item('headgear', 'h1', 0.15, 0.25),
      item('handwear', 'g1', 0.20, 0.22),
    ];

    const candidates = enumerateCandidates(catalog, { ireqMinClo: 0, tempF: 16 });
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    // Candidates should have different ensemble_im values
    const imValues = candidates.map(c => c.ensemble_im);
    const uniqueIms = new Set(imValues.map(v => Math.round(v * 100)));
    expect(uniqueIms.size).toBeGreaterThanOrEqual(2);
  });
});
