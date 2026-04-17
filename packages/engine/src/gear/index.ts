// LC6 gear module — adapters for LC5 gear DB.
// PHY-GEAR-01 v2 (Session 11).

export { convertGearDB, catalogSummary, inferFiber, imputeAttributes } from './adapter.js';
export type {
  RawGearItem, RawGearDB, RawGearSleepItem, RawGearImmersionItem,
  ConvertOptions,
} from './adapter.js';
