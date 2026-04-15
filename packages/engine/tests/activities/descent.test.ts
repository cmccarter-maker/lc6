// Tests for activities/descent.ts — descentSpeedWind lookup.
// Lock-in baselines from LC5 verbatim source 2026-04-15.

import { describe, it, expect } from 'vitest';
import { descentSpeedWind } from '../../src/activities/descent.js';

describe('descentSpeedWind (PHY-019)', () => {
  it('groomers → 30 mph, turnFactor 0.7', () => {
    expect(descentSpeedWind('groomers')).toEqual({ speed: 30, turnFactor: 0.7 });
  });

  it('moguls → 12 mph, turnFactor 0.5', () => {
    expect(descentSpeedWind('moguls')).toEqual({ speed: 12, turnFactor: 0.5 });
  });

  it('trees → 8 mph, turnFactor 0.45', () => {
    expect(descentSpeedWind('trees')).toEqual({ speed: 8, turnFactor: 0.45 });
  });

  it('bowls → 20 mph, turnFactor 0.6', () => {
    expect(descentSpeedWind('bowls')).toEqual({ speed: 20, turnFactor: 0.6 });
  });

  it('park → 18 mph, turnFactor 0.55', () => {
    expect(descentSpeedWind('park')).toEqual({ speed: 18, turnFactor: 0.55 });
  });

  it('strips skiing_ prefix (PHY-030 unified terrain keys)', () => {
    expect(descentSpeedWind('skiing_groomers')).toEqual({ speed: 30, turnFactor: 0.7 });
    expect(descentSpeedWind('skiing_moguls')).toEqual({ speed: 12, turnFactor: 0.5 });
  });

  it('strips snowboarding_ prefix', () => {
    expect(descentSpeedWind('snowboarding_groomers')).toEqual({ speed: 30, turnFactor: 0.7 });
  });

  it('unknown variant → default { speed: 25, turnFactor: 0.6 }', () => {
    expect(descentSpeedWind('unknown_terrain')).toEqual({ speed: 25, turnFactor: 0.6 });
    expect(descentSpeedWind('skiing_xyz')).toEqual({ speed: 25, turnFactor: 0.6 });
  });

  it('non-string input → default', () => {
    expect(descentSpeedWind(null)).toEqual({ speed: 25, turnFactor: 0.6 });
    expect(descentSpeedWind(undefined)).toEqual({ speed: 25, turnFactor: 0.6 });
  });
});
