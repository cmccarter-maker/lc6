// LC6 activities module — public API.
// Session 9a build: split-body models, descent wind, activity profile data.

export {
  WADER_DATA,
  SNOW_SPORT_ZONES,
  waderSplitIm,
  waderSplitCLO,
  snowSportSplitIm,
} from './split_body.js';

export type { WaderEntry, SnowSportZone } from './split_body.js';

export { descentSpeedWind } from './descent.js';
export type { DescentSpeedWindResult } from './descent.js';

export {
  ACTIVITY_SWEAT_PROFILES,
  INTERMITTENT_PHASE_PROFILES,
  GENERIC_GEAR_SCORES_BY_SLOT,
} from './profiles.js';

export type {
  ActivitySweatProfile,
  PhaseDefinition,
  PhaseProfile,
  GearSlotScores,
} from './profiles.js';

// Session 9b — wader evaporation floor
export { waderEvapFloor } from './split_body.js';

// Session 9c — BC phase percentages
export { calcBCPhasePercentages } from './profiles.js';
export type { BCPhasePercentages } from './profiles.js';
