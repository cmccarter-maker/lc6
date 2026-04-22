// ============================================================================
// @lc6/engine — Input Validation
// packages/engine/src/validate.ts
//
// Step 1 of the 8-step evaluate() pipeline (Architecture v1.1 §1.1).
// Throws descriptive errors on invalid input.
// Session 10a.
// ============================================================================

import type { EngineInput } from './types.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(`EngineInput validation: ${message}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validate EngineInput. Throws ValidationError on first failure.
 * Pure function — no side effects.
 */
export function validate(input: EngineInput): void {
  if (!input) throw new ValidationError('input is null or undefined');

  // ── Activity ──────────────────────────────────────────
  if (!input.activity) throw new ValidationError('activity is required');
  if (!input.activity.activity_id) throw new ValidationError('activity.activity_id is required');
  if (typeof input.activity.duration_hr !== 'number' || input.activity.duration_hr <= 0) {
    throw new ValidationError('activity.duration_hr must be a positive number');
  }
  // date_iso required per PHY-031 §10.3 — no default path exists.
  // Accepts YYYY-MM-DD or full ISO-8601 timestamps.
  if (typeof input.activity.date_iso !== 'string' || !input.activity.date_iso) {
    throw new ValidationError('activity.date_iso is required (ISO-8601, e.g. "2026-02-03")');
  }
  {
    const m = input.activity.date_iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) {
      throw new ValidationError(
        `activity.date_iso must be ISO-8601 (YYYY-MM-DD). Got: "${input.activity.date_iso}"`
      );
    }
    const y = parseInt(m[1]!, 10);
    const mo = parseInt(m[2]!, 10);
    const d = parseInt(m[3]!, 10);
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (
      isNaN(probe.getTime()) ||
      probe.getUTCFullYear() !== y ||
      probe.getUTCMonth() !== mo - 1 ||
      probe.getUTCDate() !== d
    ) {
      throw new ValidationError(
        `activity.date_iso is not a valid calendar date. Got: "${input.activity.date_iso}"`
      );
    }
  }
  if (!input.activity.segments || input.activity.segments.length === 0) {
    throw new ValidationError('activity.segments must have at least one segment');
  }
  for (const seg of input.activity.segments) {
    if (!seg.segment_id) throw new ValidationError('segment.segment_id is required');
    if (typeof seg.duration_hr !== 'number' || seg.duration_hr <= 0) {
      throw new ValidationError(`segment ${seg.segment_id}: duration_hr must be positive`);
    }
    if (!seg.weather || seg.weather.length === 0) {
      throw new ValidationError(`segment ${seg.segment_id}: at least one weather slice required`);
    }
  }

  // ── Location ──────────────────────────────────────────
  if (!input.location) throw new ValidationError('location is required');
  if (typeof input.location.elevation_ft !== 'number') {
    throw new ValidationError('location.elevation_ft must be a number');
  }
  // Denali safety gate: >= 15,000 ft blocks (DEC-014)
  if (input.location.elevation_ft >= 15000) {
    throw new ValidationError(
      `Elevation ${input.location.elevation_ft} ft exceeds the 15,000 ft safety gate. ` +
      'Expedition-class objectives are explicitly out of scope (DEC-014).'
    );
  }

  // ── Biometrics ────────────────────────────────────────
  if (!input.biometrics) throw new ValidationError('biometrics is required');
  if (input.biometrics.sex !== 'male' && input.biometrics.sex !== 'female') {
    throw new ValidationError('biometrics.sex must be "male" or "female"');
  }
  if (typeof input.biometrics.weight_lb !== 'number' || input.biometrics.weight_lb <= 0) {
    throw new ValidationError('biometrics.weight_lb must be a positive number');
  }
  // Optional ski history — per PHY-031 §8.2. Validates format only when present.
  if (input.biometrics.ski_history) {
    const h = input.biometrics.ski_history;
    if (typeof h.runs_per_day !== 'number' || h.runs_per_day <= 0) {
      throw new ValidationError('biometrics.ski_history.runs_per_day must be a positive number');
    }
    if (typeof h.hours_per_day !== 'number' || h.hours_per_day <= 0) {
      throw new ValidationError('biometrics.ski_history.hours_per_day must be a positive number');
    }
    if (h.riding_style !== undefined &&
        h.riding_style !== 'cruiser' &&
        h.riding_style !== 'mixed' &&
        h.riding_style !== 'charger') {
      throw new ValidationError('biometrics.ski_history.riding_style must be "cruiser", "mixed", or "charger"');
    }
  }

  // ── User ensemble ─────────────────────────────────────
  if (!input.user_ensemble) throw new ValidationError('user_ensemble is required');
  if (!input.user_ensemble.items || input.user_ensemble.items.length === 0) {
    throw new ValidationError('user_ensemble.items must have at least one gear item');
  }
  if (typeof input.user_ensemble.total_clo !== 'number' || input.user_ensemble.total_clo < 0) {
    throw new ValidationError('user_ensemble.total_clo must be a non-negative number');
  }
  if (typeof input.user_ensemble.ensemble_im !== 'number' || input.user_ensemble.ensemble_im <= 0) {
    throw new ValidationError('user_ensemble.ensemble_im must be a positive number');
  }

  // ── Weather slices ────────────────────────────────────
  for (const seg of input.activity.segments) {
    for (const w of seg.weather) {
      if (typeof w.temp_f !== 'number') {
        throw new ValidationError(`segment ${seg.segment_id}: weather.temp_f must be a number`);
      }
      if (typeof w.humidity !== 'number' || w.humidity < 0 || w.humidity > 100) {
        throw new ValidationError(`segment ${seg.segment_id}: weather.humidity must be 0-100 (DEC-024)`);
      }
      if (typeof w.wind_mph !== 'number' || w.wind_mph < 0) {
        throw new ValidationError(`segment ${seg.segment_id}: weather.wind_mph must be non-negative`);
      }
    }
  }
}
