import type { EngineInput, GearEnsemble } from '@lc6/engine';

// ═══════════════════════════════════════════════════════════════════════════
// FormState — what InputForm holds in React state
// EngineInput — what evaluate() consumes
// buildEngineInput projects form → engine, supplying defaults for fields
// the form does not expose (location, biometrics, single-segment structure).
// ═══════════════════════════════════════════════════════════════════════════

export interface FormState {
  activity_id: string;
  date_iso: string;        // YYYY-MM-DD
  duration_hr: number;
  temp_f: number;
  humidity: number;        // 0-100
  wind_mph: number;
  precip_probability: number; // 0.0-1.0
  ensemble: GearEnsemble;
}

// Defaults for fields not in the form (S-UI-02d will expose biometrics, etc.)
const DEFAULT_LOCATION = {
  lat: 39.48,
  lng: -106.07,
  elevation_ft: 9600,
};

const DEFAULT_BIOMETRICS: { sex: 'male' | 'female'; weight_lb: number } = {
  sex: 'male',
  weight_lb: 180,
};

export function buildEngineInput(form: FormState): EngineInput {
  // Snow terrain: only set when activity is snow-sport-shaped
  const snowTerrain = isSnowActivity(form.activity_id) ? 'groomers' : undefined;

  return {
    activity: {
      activity_id: form.activity_id,
      duration_hr: form.duration_hr,
      date_iso: form.date_iso,
      ...(snowTerrain ? { snow_terrain: snowTerrain } : {}),
      segments: [
        {
          segment_id: 'seg-1',
          segment_label: `${form.activity_id} segment`,
          activity_id: form.activity_id,
          duration_hr: form.duration_hr,
          weather: [
            {
              t_start: 0,
              t_end: form.duration_hr * 3600,
              temp_f: form.temp_f,
              humidity: form.humidity,
              wind_mph: form.wind_mph,
              precip_probability: form.precip_probability,
            },
          ],
        },
      ],
    },
    location: { ...DEFAULT_LOCATION },
    biometrics: { ...DEFAULT_BIOMETRICS },
    user_ensemble: form.ensemble,
  };
}

function isSnowActivity(activityId: string): boolean {
  return (
    activityId === 'snowboarding' ||
    activityId === 'skiing' ||
    activityId === 'snowshoeing' ||
    activityId === 'backcountry_skiing'
  );
}
