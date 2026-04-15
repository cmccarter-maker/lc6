// Clothing ensemble Woodcock im calculation.
// Ported VERBATIM from LC5 risk_functions.js lines 854-900.
// Per Cardinal Rule #8: do not modify without Chat-produced spec amendment.
// Per Cardinal Rule #10: calcEnsembleIm never modified by display layer.

/**
 * Tier classification for gear vapor permeability.
 * - typical: PHY-025R baseline for users without specific gear input
 * - good: standard/generic technical gear
 * - better: high-quality technical gear
 * - best: top-tier breathable gear (mesh shells, premium membranes)
 */
export type EnsembleTier = 'typical' | 'good' | 'better' | 'best' | '' | null | undefined;

/**
 * Per-layer Woodcock im values by tier.
 * ENSEMBLE_IM_MAP values per LC5 PHY-025R audit baseline; original methodology
 * from Woodcock AH (Textile Res J, 1962) and ISO 9920.
 *
 * "typical" tier represents insulated ski jacket + basic fleece + cotton/basic synthetic base.
 * Validated against gear DB. PHY-025R spec Section 4 derivation.
 *
 * LC5 risk_functions.js lines 854-859.
 */
export const ENSEMBLE_IM_MAP: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  base:       { typical: 0.25, good: 0.30, better: 0.50, best: 0.65 },
  mid:        { typical: 0.22, good: 0.25, better: 0.45, best: 0.55 },
  insulative: { typical: 0.18, good: 0.20, better: 0.40, best: 0.50 },
  shell:      { typical: 0.14, good: 0.15, better: 0.35, best: 0.45 },
};

export const ENSEMBLE_LAYER_NAMES: readonly string[] = [
  'Base Layer', 'Mid Layer', 'Insulative Layer', 'Shell / Outer',
];
export const ENSEMBLE_LAYER_KEYS: readonly string[] = ['base', 'mid', 'insulative', 'shell'];

/**
 * Per-layer object in calcEnsembleIm result.
 */
export interface EnsembleLayer {
  key: string;
  idx: number;
  name: string;
  tier: string;
  im: number;
}

/**
 * Result of calcEnsembleIm — full ensemble im + bottleneck analysis + what-if upgrade.
 */
export interface EnsembleImResult {
  ensembleIm: number;
  bottleneck: string | null;
  bottleneckKey?: string;
  bottleneckIdx?: number;
  bottleneckIm: number;
  bottleneckPct: number;
  bottleneckTier?: string;
  whatIfImprovement?: number;
  upgEnsembleIm?: number;
  layers: EnsembleLayer[];
  hasGear: boolean;
}

/**
 * Calculate ensemble Woodcock im via serial-resistance harmonic mean.
 *
 * Layers act as resistors in series for vapor transport — weakest link dominates.
 *
 * Accepts a 4-element tier array indexed by ENSEMBLE_LAYER_KEYS:
 *   [base, mid, insulative, shell]
 * Empty/null/undefined values are skipped (layer not rated).
 * Unknown tier strings are skipped (with no error).
 *
 * Returns full ensemble im plus bottleneck analysis (which layer limits performance)
 * and a what-if calculation showing improvement if bottleneck is upgraded to "best".
 *
 * Per Cardinal Rule #10: this function is NEVER modified by display layer.
 *
 * LC5 risk_functions.js lines 865-900 (verbatim port; only TypeScript type
 * annotations added).
 *
 * @param tiers 4-element array of tier strings; empty values skipped
 */
export function calcEnsembleIm(tiers: EnsembleTier[]): EnsembleImResult {
  const layers: EnsembleLayer[] = [];
  ENSEMBLE_LAYER_KEYS.forEach((key, i) => {
    // PHY-068/BUG-140: insulative IS in vapor pathway — include in harmonic mean.
    // ENSEMBLE_IM_MAP already has insulative values (typical:0.18, good:0.20, better:0.40, best:0.50).
    const tier = tiers[i];
    if (!tier) return;
    const im = ENSEMBLE_IM_MAP[key]?.[tier];
    if (!im) return;
    const layerName = ENSEMBLE_LAYER_NAMES[i] ?? '';
    layers.push({ key, idx: i, name: layerName, tier, im });
  });

  if (layers.length === 0) {
    return {
      ensembleIm: 0,
      bottleneck: null,
      bottleneckIm: 0,
      bottleneckPct: 0,
      layers,
      hasGear: false,
    };
  }

  if (layers.length === 1) {
    const single = layers[0]!;
    return {
      ensembleIm: single.im,
      bottleneck: single.name,
      bottleneckIm: single.im,
      bottleneckPct: 100,
      layers,
      hasGear: true,
    };
  }

  // Serial resistance: harmonic mean — weakest link dominates
  const totalInvIm = layers.reduce((s, l) => s + 1 / l.im, 0);
  const ensembleIm = layers.length / totalInvIm;

  // Identify bottleneck (lowest im = highest resistance)
  let bottleneck = layers[0]!;
  let bottleneckIm = layers[0]!.im;
  layers.forEach((l) => {
    if (l.im < bottleneckIm) {
      bottleneck = l;
      bottleneckIm = l.im;
    }
  });
  const bottleneckPct = Math.round((1 / bottleneckIm) / totalInvIm * 100);

  // What-if: compute improvement if bottleneck upgraded to "best"
  const upgradedTiers = [...tiers];
  upgradedTiers[bottleneck.idx] = 'best';
  const upgLayers: { im: number }[] = [];
  ENSEMBLE_LAYER_KEYS.forEach((key, i) => {
    const t = upgradedTiers[i];
    if (!t) return;
    const uim = ENSEMBLE_IM_MAP[key]?.[t];
    if (!uim) return;
    upgLayers.push({ im: uim });
  });
  const upgInvIm = upgLayers.reduce((s, l) => s + 1 / l.im, 0);
  const upgEnsembleIm = upgLayers.length / upgInvIm;
  const whatIfImprovement = ensembleIm > 0 ? Math.round((upgEnsembleIm / ensembleIm - 1) * 100) : 0;

  return {
    ensembleIm,
    bottleneck: bottleneck.name,
    bottleneckKey: bottleneck.key,
    bottleneckIdx: bottleneck.idx,
    bottleneckIm,
    bottleneckPct,
    bottleneckTier: bottleneck.tier,
    whatIfImprovement,
    upgEnsembleIm,
    layers,
    hasGear: true,
  };
}
