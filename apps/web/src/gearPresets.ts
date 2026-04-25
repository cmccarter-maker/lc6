import type { GearEnsemble, EngineGearItem } from '@lc6/engine';

// ═══════════════════════════════════════════════════════════════════════════
// Gear preset library
// 4 hardcoded ensembles matching known-good test fixtures.
// All produce valid evaluate() input. S-UI-02d will replace presets with
// per-slot customization once gear DB integration begins.
// ═══════════════════════════════════════════════════════════════════════════

export type GearPresetId =
  | 'snowboarding_standard'
  | 'hiking_light'
  | 'hiking_standard'
  | 'road_cycling';

export interface GearPreset {
  id: GearPresetId;
  label: string;
  description: string;
  ensemble: GearEnsemble;
}

function makeItem(
  productIdSuffix: string,
  slot: EngineGearItem['slot'],
  clo: number,
  im: number,
): EngineGearItem {
  return {
    product_id: `preset-${productIdSuffix}-${slot}`,
    name: `${productIdSuffix} ${slot}`,
    slot,
    clo,
    im,
    fiber: 'synthetic',
  };
}

// Snowboarding standard — matches evaluate.test.ts BRECK_ENSEMBLE
const SNOWBOARDING_STANDARD: GearEnsemble = {
  ensemble_id: 'preset-snowboarding-standard',
  label: 'Snowboarding Standard',
  items: [
    makeItem('snowboarding', 'base', 0.3, 0.4),
    makeItem('snowboarding', 'mid', 0.5, 0.35),
    makeItem('snowboarding', 'insulative', 0.8, 0.25),
    makeItem('snowboarding', 'shell', 0.3, 0.15),
    makeItem('snowboarding', 'legwear', 0.5, 0.3),
    makeItem('snowboarding', 'footwear', 0.4, 0.2),
    makeItem('snowboarding', 'headgear', 0.2, 0.3),
    makeItem('snowboarding', 'handwear', 0.3, 0.25),
  ],
  total_clo: 2.5,
  ensemble_im: 0.25,
};

// Hiking light — for warm-weather day hikes
const HIKING_LIGHT: GearEnsemble = {
  ensemble_id: 'preset-hiking-light',
  label: 'Hiking Light',
  items: [
    makeItem('hike-light', 'base', 0.15, 0.42),
    makeItem('hike-light', 'legwear', 0.25, 0.38),
    makeItem('hike-light', 'footwear', 0.2, 0.30),
    makeItem('hike-light', 'headgear', 0.05, 0.45),
  ],
  total_clo: 0.65,
  ensemble_im: 0.39,
};

// Hiking standard — matches baselines.test.ts HIKING_ENSEMBLE
const HIKING_STANDARD: GearEnsemble = {
  ensemble_id: 'preset-hiking-standard',
  label: 'Hiking Standard',
  items: [
    makeItem('hike-std', 'base', 0.20, 0.40),
    makeItem('hike-std', 'mid', 0.40, 0.35),
    makeItem('hike-std', 'shell', 0.10, 0.30),
    makeItem('hike-std', 'legwear', 0.30, 0.35),
    makeItem('hike-std', 'footwear', 0.30, 0.22),
    makeItem('hike-std', 'headgear', 0.10, 0.35),
  ],
  total_clo: 1.40,
  ensemble_im: 0.33,
};

// Road cycling — matches baselines.test.ts CYCLING_ENSEMBLE
const ROAD_CYCLING: GearEnsemble = {
  ensemble_id: 'preset-road-cycling',
  label: 'Road Cycling',
  items: [
    makeItem('cycle', 'base', 0.10, 0.50),
    makeItem('cycle', 'legwear', 0.10, 0.48),
    makeItem('cycle', 'footwear', 0.10, 0.35),
    makeItem('cycle', 'headgear', 0.03, 0.50),
  ],
  total_clo: 0.33,
  ensemble_im: 0.46,
};

export const GEAR_PRESETS: ReadonlyArray<GearPreset> = [
  {
    id: 'snowboarding_standard',
    label: 'Snowboarding Standard',
    description: '8-layer kit, ~2.5 CLO — winter resort skiing/snowboarding',
    ensemble: SNOWBOARDING_STANDARD,
  },
  {
    id: 'hiking_light',
    label: 'Hiking Light',
    description: '4-layer kit, ~0.65 CLO — warm-weather day hikes',
    ensemble: HIKING_LIGHT,
  },
  {
    id: 'hiking_standard',
    label: 'Hiking Standard',
    description: '6-layer kit, ~1.4 CLO — cool-weather hikes 50-65°F',
    ensemble: HIKING_STANDARD,
  },
  {
    id: 'road_cycling',
    label: 'Road Cycling',
    description: '4-layer kit, ~0.33 CLO — high-output road cycling',
    ensemble: ROAD_CYCLING,
  },
];

export function getPresetById(id: GearPresetId): GearPreset {
  const preset = GEAR_PRESETS.find(p => p.id === id);
  if (!preset) {
    throw new Error(`Unknown gear preset: ${id}`);
  }
  return preset;
}
