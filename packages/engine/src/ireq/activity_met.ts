// Activity → metabolic rate (W/m²) mapping for IREQ model.
// All values from Ainsworth 2011 Compendium of Physical Activities unless noted.
// 1 MET = 58.2 W/m². Lund IREQ calculator caps M at 400 W/m².
// Per Cardinal Rule #1: every value has a cited source or explicit GAP flag.

/** Lund calculator upper bound for metabolic rate (W/m²). */
export const LUND_M_CAP = 400;

/** Activity metabolic rates in W/m². */
export interface ActivityMetEntry {
  /** Metabolic rate W/m² (capped at LUND_M_CAP). */
  readonly M: number;
  /** Effective mechanical power W/m² (0 for all current activities). */
  readonly W: number;
  /** Compendium code or source citation. */
  readonly source: string;
}

/**
 * Activity → MET mapping. Keys match LC5/LC6 activity identifiers.
 *
 * Ski terrain sub-modes use INSTANTANEOUS active MET during descent,
 * not time-weighted average (Research Log §1.4: "IREQ is about do you
 * have enough insulation when the wind hits you at speed").
 */
export const ACTIVITY_MET: Readonly<Record<string, ActivityMetEntry>> = {
  // Hiking / trail
  hiking:          { M: 262, W: 0, source: 'Compendium 17160 (4.5 MET)' },
  day_hike:        { M: 262, W: 0, source: 'Compendium 17160 (4.5 MET)' },
  backpacking:     { M: 400, W: 0, source: 'Compendium 17080 (7.0 MET → 407, CAP 400)' },

  // Running / cycling
  running:         { M: 400, W: 0, source: 'Compendium 12050 (8.0 MET → CAP 400)' },
  mountain_biking: { M: 400, W: 0, source: 'Compendium 01015 (8.5 MET → CAP 400)' },
  road_cycling:    { M: 400, W: 0, source: 'Compendium 01018 (8.0 MET → CAP 400)' },
  gravel_biking:   { M: 400, W: 0, source: 'Compendium 01018 (8.0 MET → CAP 400)' },

  // Winter sport
  cross_country_ski: { M: 400, W: 0, source: 'Compendium 19080 (9.0 MET → CAP 400)' },
  skiing:            { M: 378, W: 0, source: 'Compendium 19060/19062 (6.5 MET active descent, groomers default)' },
  snowboarding:      { M: 308, W: 0, source: 'Compendium 19075 (4.3-5.3 MET, midpoint 5.3)' },
  snowshoeing:       { M: 308, W: 0, source: 'Compendium 19252 (5.3 MET)' },

  // Climbing / board
  bouldering:      { M: 338, W: 0, source: 'Compendium 15535 (5.8 MET)' },
  climbing:        { M: 338, W: 0, source: 'Compendium 15535 (5.8 MET)' },
  skateboarding:   { M: 291, W: 0, source: 'Compendium 15600 (5.0 MET)' },
  onewheel:        { M: 204, W: 0, source: 'GAP: No Compendium entry. Proxy: skateboarding scaled ×0.7 (less active balance)' },

  // Stationary / low activity
  camping:         { M: 146, W: 0, source: 'Compendium 05040 (2.5 MET, camp chores)' },
  hunting_stand:   { M: 146, W: 0, source: 'Compendium 17060 (2.5 MET, stand hunting)' },
  hunting_walking: { M: 291, W: 0, source: 'Compendium 17070 (5.0 MET, still hunting)' },
  fishing:         { M: 146, W: 0, source: 'Compendium 18080 (2.5 MET, shore stationary)' },
  golf:            { M: 279, W: 0, source: 'Compendium 15265 (4.8 MET, walking with clubs)' },
};

/**
 * Ski terrain sub-mode MET overrides (instantaneous active MET during descent).
 * Research Log §1.4. All hit LUND_M_CAP except groomers (378) and backcountry descent (349).
 */
export const SKI_TERRAIN_MET: Readonly<Record<string, number>> = {
  groomers:    378,  // 6.5 MET
  moguls:      400,  // 8.5 MET → CAP
  trees:       400,  // 7.5 MET → CAP
  bowls:       400,  // 8.0 MET → CAP
  park:        400,  // 7.0 MET → CAP
  backcountry: 349,  // 6.0 MET descent
};

/**
 * Resolve activity + optional context to metabolic rate (W/m²).
 * Returns null if activity has no IREQ entry (water-primary activities).
 */
export function resolveActivityMet(
  activity: string,
  snowTerrain?: string | null,
): { M: number; W: number } | null {
  // Water-primary activities — triaged OUT of IREQ (Research Log §1.3)
  const WATER_ACTIVITIES = ['kayaking', 'paddle_boarding', 'fishing_wading'];
  if (WATER_ACTIVITIES.includes(activity)) return null;

  // Ski terrain override
  if ((activity === 'skiing' || activity === 'snowboarding') && snowTerrain) {
    const terrainM = SKI_TERRAIN_MET[snowTerrain];
    if (terrainM != null) return { M: terrainM, W: 0 };
  }

  // Hunting mode resolution
  if (activity === 'hunting') return ACTIVITY_MET['hunting_stand']!;

  const entry = ACTIVITY_MET[activity];
  if (!entry) return null;
  return { M: entry.M, W: entry.W };
}
