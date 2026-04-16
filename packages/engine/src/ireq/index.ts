// LC6 IREQ module — ISO 11079 cold stress assessment.
// d'Ambrosio Alfano et al. 2025, Appendix B, verbatim port.
// Activity MET mapping from Ainsworth 2011 Compendium of Physical Activities.

export { psks_kPa, pa_kPa, tex_C, pex_kPa, m2KW_to_clo, clo_to_m2KW } from './helpers.js';
export { IREQ_neu, IREQ_min } from './ireq.js';
export { DLE_neu, DLE_min } from './dle.js';
export { ACTIVITY_MET, SKI_TERRAIN_MET, resolveActivityMet, LUND_M_CAP } from './activity_met.js';
export type { ActivityMetEntry } from './activity_met.js';
export { computeActivityIREQ } from './compute.js';
export type { ActivityIREQResult, ActivityIREQExcluded, ActivityIREQOutput } from './compute.js';
