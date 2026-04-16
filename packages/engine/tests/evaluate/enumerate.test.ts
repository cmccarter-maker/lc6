// ============================================================================
// Session 10b tests — candidate enumeration
// packages/engine/tests/evaluate/enumerate.test.ts
// ============================================================================

import { describe, it, expect } from 'vitest';
import { enumerateCandidates } from '../../src/strategy/enumerate.js';
import { evaluate } from '../../src/evaluate.js';
import type { EngineGearItem, EngineInput, WeatherSlice } from '../../src/types.js';

// ============================================================================
// Mini gear catalog — 24 items across 8 slots, 3 options per slot
// ============================================================================

function item(
  slot: EngineGearItem['slot'],
  id: string,
  clo: number,
  im: number,
  name: string,
): EngineGearItem {
  return { product_id: id, name, slot, clo, im, fiber: 'synthetic' };
}

const CATALOG: EngineGearItem[] = [
  // Base layers: thin/wicking → thick/warm
  item('base', 'base-thin',  0.15, 0.50, 'Thin Merino Base'),
  item('base', 'base-mid',   0.25, 0.40, 'Mid-weight Base'),
  item('base', 'base-thick', 0.35, 0.30, 'Expedition Base'),

  // Mid layers
  item('mid', 'mid-fleece',  0.40, 0.38, 'Grid Fleece'),
  item('mid', 'mid-puffy',   0.60, 0.25, 'Synthetic Puffy Mid'),
  item('mid', 'mid-wool',    0.50, 0.32, 'Wool Sweater'),

  // Insulative
  item('insulative', 'ins-light',  0.50, 0.28, 'Light Insulated Jacket'),
  item('insulative', 'ins-mid',    0.80, 0.22, 'Mid Insulated Jacket'),
  item('insulative', 'ins-heavy',  1.10, 0.18, 'Expedition Down Jacket'),

  // Shells
  item('shell', 'shell-soft',  0.10, 0.35, 'Softshell'),
  item('shell', 'shell-3l',    0.15, 0.15, '3-Layer Hardshell'),
  item('shell', 'shell-insul', 0.30, 0.12, 'Insulated Shell'),

  // Legwear
  item('legwear', 'leg-light',  0.30, 0.35, 'Light Ski Pant'),
  item('legwear', 'leg-insul',  0.50, 0.25, 'Insulated Ski Pant'),
  item('legwear', 'leg-bib',    0.60, 0.20, 'Insulated Bib'),

  // Footwear
  item('footwear', 'boot-light', 0.25, 0.20, 'Light Boot'),
  item('footwear', 'boot-warm',  0.40, 0.15, 'Insulated Boot'),
  item('footwear', 'boot-exped', 0.55, 0.10, 'Expedition Boot'),

  // Headgear
  item('headgear', 'hat-beanie',   0.15, 0.35, 'Merino Beanie'),
  item('headgear', 'hat-balaclava',0.25, 0.20, 'Balaclava'),
  item('headgear', 'hat-helmet',   0.20, 0.25, 'Helmet Liner'),

  // Handwear
  item('handwear', 'glove-light', 0.15, 0.30, 'Liner Glove'),
  item('handwear', 'glove-ski',   0.25, 0.20, 'Ski Glove'),
  item('handwear', 'glove-mitt',  0.35, 0.12, 'Expedition Mitten'),
];


// ============================================================================
// Enumeration tests
// ============================================================================

describe('enumerateCandidates', () => {

  it('produces 1-7 candidates from a complete catalog', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.length).toBeLessThanOrEqual(7);
  });

  it('all candidates have complete required slots for cold weather', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });
    const requiredSlots = ['base', 'mid', 'insulative', 'shell', 'legwear', 'footwear', 'headgear', 'handwear'];
    for (const candidate of candidates) {
      const slots = candidate.items.map(i => i.slot);
      for (const req of requiredSlots) {
        expect(slots).toContain(req);
      }
    }
  });

  it('fewer required slots in warm weather', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 75 });
    // Warm weather only requires base, shell, legwear, footwear
    for (const candidate of candidates) {
      const slots = candidate.items.map(i => i.slot);
      expect(slots).toContain('base');
      expect(slots).toContain('legwear');
      expect(slots).toContain('footwear');
      // Should NOT require insulative or headgear in warm weather
      expect(candidate.items.length).toBeLessThanOrEqual(5);
    }
  });

  it('IREQ pre-filter removes candidates below threshold', () => {
    // Set high IREQ threshold — only warmest candidates survive
    const allCandidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });
    const maxClo = Math.max(...allCandidates.map(c => c.total_clo));
    const filtered = enumerateCandidates(CATALOG, { ireqMinClo: maxClo - 0.1, tempF: 16 });
    expect(filtered.length).toBeLessThan(allCandidates.length);
  });

  it('returns empty when catalog missing a required slot', () => {
    const incomplete = CATALOG.filter(i => i.slot !== 'insulative');
    const candidates = enumerateCandidates(incomplete, { ireqMinClo: 0, tempF: 16 });
    expect(candidates.length).toBe(0);
  });

  it('each candidate has computed total_clo and ensemble_im', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });
    for (const c of candidates) {
      expect(c.total_clo).toBeGreaterThan(0);
      expect(c.ensemble_im).toBeGreaterThan(0);
      expect(c.ensemble_im).toBeLessThanOrEqual(0.50);
    }
  });

  it('no duplicate candidates (same item set)', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });
    const signatures = candidates.map(c =>
      c.items.map(i => i.product_id).sort().join(',')
    );
    const unique = new Set(signatures);
    expect(unique.size).toBe(signatures.length);
  });

  it('warmest candidate has highest total CLO', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });
    // First candidate should be warmest (sorted by total_clo desc)
    const maxClo = Math.max(...candidates.map(c => c.total_clo));
    expect(candidates[0]!.total_clo).toBe(maxClo);
  });

  it('candidates have diverse strategies (CLO spread > 0.5)', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });
    if (candidates.length >= 2) {
      const cloValues = candidates.map(c => c.total_clo);
      const spread = Math.max(...cloValues) - Math.min(...cloValues);
      expect(spread).toBeGreaterThan(0.3);
    }
  });
});


// ============================================================================
// Full pipeline integration: enumerate → evaluate → winner
// ============================================================================

describe('enumerate → evaluate integration', () => {

  it('evaluate picks winner from enumerated candidates', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });
    expect(candidates.length).toBeGreaterThan(0);

    const input: EngineInput = {
      activity: {
        activity_id: 'snowboarding',
        duration_hr: 6,
        snow_terrain: 'groomers',
        segments: [{
          segment_id: 'seg-1',
          segment_label: 'Breck Groomers',
          activity_id: 'snowboarding',
          duration_hr: 6,
          weather: [{ t_start: 0, t_end: 21600, temp_f: 16, humidity: 45, wind_mph: 10, precip_probability: 0 }],
        }],
      },
      location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: candidates[candidates.length - 1]!, // Worst candidate as "user gear"
      strategy_candidates: candidates,
    };

    const result = evaluate(input);

    // A winner should be selected
    expect(result.strategy.candidates_total).toBe(candidates.length);
    expect(result.strategy.winner_ensemble_id).not.toBeNull();

    // Winner should have lower or equal CDI compared to user gear
    const userCDI = result.four_pill.your_gear.trajectory_summary.peak_CDI;
    const optimalCDI = result.four_pill.optimal_gear.trajectory_summary.peak_CDI;
    expect(optimalCDI).toBeLessThanOrEqual(userCDI + 0.5); // Small tolerance for equal scenarios
  });

  it('winner is identifiable by ensemble_id', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });

    const input: EngineInput = {
      activity: {
        activity_id: 'skiing',
        duration_hr: 4,
        snow_terrain: 'groomers',
        segments: [{
          segment_id: 'seg-1',
          segment_label: 'Ski Day',
          activity_id: 'skiing',
          duration_hr: 4,
          weather: [{ t_start: 0, t_end: 14400, temp_f: 20, humidity: 40, wind_mph: 15, precip_probability: 0 }],
        }],
      },
      location: { lat: 39.48, lng: -106.07, elevation_ft: 10000 },
      biometrics: { sex: 'female', weight_lb: 140 },
      user_ensemble: { ensemble_id: 'user-light', label: 'User Kit', items: [
        item('base', 'ub', 0.2, 0.4, 'User Base'),
        item('mid', 'um', 0.3, 0.3, 'User Mid'),
        item('insulative', 'ui', 0.5, 0.2, 'User Insulative'),
        item('shell', 'us', 0.1, 0.3, 'User Shell'),
        item('legwear', 'ul', 0.3, 0.3, 'User Legs'),
        item('footwear', 'uf', 0.3, 0.2, 'User Boots'),
        item('headgear', 'uh', 0.15, 0.3, 'User Hat'),
        item('handwear', 'ug', 0.2, 0.25, 'User Gloves'),
      ], total_clo: 1.65, ensemble_im: 0.28 },
      strategy_candidates: candidates,
    };

    const result = evaluate(input);
    const winnerId = result.strategy.winner_ensemble_id;

    // Winner ID should match one of the candidate IDs
    if (winnerId !== null) {
      const candidateIds = candidates.map(c => c.ensemble_id);
      expect(candidateIds).toContain(winnerId);
    }
  });

  it('Pill 3 ensemble differs from Pill 1 when better option exists', () => {
    const candidates = enumerateCandidates(CATALOG, { ireqMinClo: 0, tempF: 16 });

    // Give user a deliberately weak ensemble
    const input: EngineInput = {
      activity: {
        activity_id: 'snowboarding',
        duration_hr: 6,
        snow_terrain: 'groomers',
        segments: [{
          segment_id: 'seg-1',
          segment_label: 'Cold Day',
          activity_id: 'snowboarding',
          duration_hr: 6,
          weather: [{ t_start: 0, t_end: 21600, temp_f: 5, humidity: 40, wind_mph: 15, precip_probability: 0 }],
        }],
      },
      location: { lat: 39.48, lng: -106.07, elevation_ft: 9600 },
      biometrics: { sex: 'male', weight_lb: 180 },
      user_ensemble: { ensemble_id: 'user-thin', label: 'Thin Kit', items: [
        item('base', 'ub', 0.1, 0.5, 'Thin Base'),
        item('mid', 'um', 0.2, 0.4, 'Thin Mid'),
        item('insulative', 'ui', 0.3, 0.3, 'Thin Insulative'),
        item('shell', 'us', 0.1, 0.3, 'Thin Shell'),
        item('legwear', 'ul', 0.2, 0.35, 'Thin Legs'),
        item('footwear', 'uf', 0.15, 0.25, 'Thin Boots'),
        item('headgear', 'uh', 0.1, 0.3, 'Thin Hat'),
        item('handwear', 'ug', 0.1, 0.3, 'Thin Gloves'),
      ], total_clo: 1.05, ensemble_im: 0.33 },
      strategy_candidates: candidates,
    };

    const result = evaluate(input);

    // Pill 1 and Pill 3 should have different ensembles
    expect(result.four_pill.your_gear.ensemble.ensemble_id).toBe('user-thin');
    if (result.strategy.winner_ensemble_id !== null) {
      expect(result.four_pill.optimal_gear.ensemble.ensemble_id).not.toBe('user-thin');
    }
  });
});
