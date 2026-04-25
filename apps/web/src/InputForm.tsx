import { useState } from 'react';
import type { FormState } from './buildEngineInput.js';
import { GEAR_PRESETS, getPresetById } from './gearPresets.js';
import type { GearPresetId } from './gearPresets.js';

// Activity options — hardcoded subset of engine-supported activities.
// Full list lives in engine's ACTIVITY_MET; we surface the most common ones.
// Future polish session can pull dynamically from engine exports.
const ACTIVITY_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'snowboarding', label: 'Snowboarding' },
  { id: 'skiing', label: 'Skiing' },
  { id: 'hiking', label: 'Hiking' },
  { id: 'day_hike', label: 'Day Hike' },
  { id: 'backpacking', label: 'Backpacking' },
  { id: 'trail_running', label: 'Trail Running' },
  { id: 'road_cycling', label: 'Road Cycling' },
  { id: 'golf', label: 'Golf' },
];

interface InputFormProps {
  initialState: FormState;
  onRun: (state: FormState) => void;
}

export function InputForm({ initialState, onRun }: InputFormProps) {
  const [activity, setActivity] = useState(initialState.activity_id);
  const [dateIso, setDateIso] = useState(initialState.date_iso);
  const [durationHr, setDurationHr] = useState(initialState.duration_hr);
  const [tempF, setTempF] = useState(initialState.temp_f);
  const [humidity, setHumidity] = useState(initialState.humidity);
  const [windMph, setWindMph] = useState(initialState.wind_mph);
  const [precipProbability, setPrecipProbability] = useState(initialState.precip_probability);

  // Determine current preset by matching ensemble.ensemble_id to a preset.
  // If initial ensemble is not a preset, default to snowboarding_standard.
  const initialPresetId: GearPresetId =
    (GEAR_PRESETS.find(p => p.ensemble.ensemble_id === initialState.ensemble.ensemble_id)?.id) ??
    'snowboarding_standard';
  const [presetId, setPresetId] = useState<GearPresetId>(initialPresetId);

  function handleRun() {
    const preset = getPresetById(presetId);
    onRun({
      activity_id: activity,
      date_iso: dateIso,
      duration_hr: durationHr,
      temp_f: tempF,
      humidity: humidity,
      wind_mph: windMph,
      precip_probability: precipProbability,
      ensemble: preset.ensemble,
    });
  }

  return (
    <div className="input-form-container">
      <div className="input-form-header">
        <h2 className="input-form-title">Trip Setup</h2>
        <p className="input-form-subtitle">
          Configure activity, conditions, and gear. Click Run to compute.
        </p>
      </div>

      <div className="input-form-grid">
        <div className="form-field">
          <label className="form-label" htmlFor="form-activity">Activity</label>
          <select
            id="form-activity"
            className="form-input"
            value={activity}
            onChange={e => setActivity(e.target.value)}
          >
            {ACTIVITY_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-date">Date</label>
          <input
            id="form-date"
            type="date"
            className="form-input"
            value={dateIso}
            onChange={e => setDateIso(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-duration">Duration (hr)</label>
          <input
            id="form-duration"
            type="number"
            className="form-input"
            min={0.5}
            max={12}
            step={0.5}
            value={durationHr}
            onChange={e => setDurationHr(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-temp">Temp (°F)</label>
          <input
            id="form-temp"
            type="number"
            className="form-input"
            min={-40}
            max={110}
            step={1}
            value={tempF}
            onChange={e => setTempF(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-humidity">Humidity (%)</label>
          <input
            id="form-humidity"
            type="number"
            className="form-input"
            min={0}
            max={100}
            step={1}
            value={humidity}
            onChange={e => setHumidity(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-wind">Wind (mph)</label>
          <input
            id="form-wind"
            type="number"
            className="form-input"
            min={0}
            max={50}
            step={1}
            value={windMph}
            onChange={e => setWindMph(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-precip">Precip prob (0-1)</label>
          <input
            id="form-precip"
            type="number"
            className="form-input"
            min={0}
            max={1}
            step={0.05}
            value={precipProbability}
            onChange={e => setPrecipProbability(Number(e.target.value))}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="form-preset">Gear Preset</label>
          <select
            id="form-preset"
            className="form-input"
            value={presetId}
            onChange={e => setPresetId(e.target.value as GearPresetId)}
          >
            {GEAR_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="input-form-actions">
        <button
          type="button"
          className="form-run-button"
          onClick={handleRun}
        >
          Run
        </button>
      </div>
    </div>
  );
}
