# LC6 Architecture Document v1.2

**Status:** RATIFIED 2026-04-17. Updated incorporating PHY-GEAR-01 v2 (gear.js adapter). Supersedes v1.1 (RATIFIED 2026-04-14).

**Changes from v1.0:**

| Area | v1.0 | v1.1 |
|---|---|---|
| **CDI dependency** | CDI v1.3 RATIFIED | **CDI v1.4 RATIFIED** |
| **TrajectoryPoint fields** | CDI/regime/binding_pathway only | **+ clinical_stage, cdi_basis, tau_to_next_stage, q_shiver_sustained_flag** |
| **CmCard trigger types** | 10 trigger types | **+ shivering_sustained, mild_hypothermia_active, heat_exhaustion_active** (separate from threshold-only triggers); reorganized for clarity |
| **§9 Test strategy** | 7 v1.3 test vectors | **7 v1.4 test vectors** with stage detection verification |
| **Engine module structure** | cdi/ subdirectory | + cdi/stage_detector.ts, cdi/within_stage_ramp.ts |

The interface change is purely additive at the EngineOutput contract level. v1.0's existing fields are unchanged. Display components reading v1.0 contract will still function; new components can read the new fields.

---

## Authoritative inputs

- Working Agreement v3 (Cardinal Rules #1, #3, #5, #6, #8, #9, #14, #16, #17)
- Heat Balance Variables v1
- **CDI Derivation Spec v1.4 RATIFIED** — clinical-stage anchoring, within-stage progression, stage detection logic
- Current State Inventory v2
- Infrastructure Decision Analyses v2
- Decision Registry (DEC-018 CDI v1.3; DEC-019 forthcoming for v1.4)
- Fall-In v2 Conceptual Groundwork

---

## 1. Architecture overview

### 1.1 Dataflow

```
┌──────────────┐
│  User Input  │   activity, weather, location, biometrics, gear
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│   Input Store (Zustand)  │   DEC-006: input slices
└──────┬───────────────────┘
       │  (single effect, debounced 200ms)
       ▼
┌──────────────────────────┐
│  assembleEngineInput()   │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│       packages/engine       (workspace package, DEC-009)     │
│                                                              │
│   evaluate(input) → EngineOutput                             │
│                                                              │
│   1. Validate                                                │
│   2. IREQ feasibility filter                                 │
│   3. For each ensemble (user + strategy candidates):         │
│      - Per-slice PHY-056 Gagge solve                         │
│      - Per-slice clinical stage detection (v1.4 §4.2)        │
│      - Per-slice within-stage τ progression (v1.4 §4.3)      │
│      - Per-slice CDI = floor + ramp (v1.4 §4.5)              │
│      - Per-slice CM trigger evaluation                       │
│   4. Per-segment aggregation                                 │
│   5. Strategy winner: argmin_ensemble peak_CDI + IREQ gate   │
│   6. Four-pill comparison                                    │
│   7. Overlays (Fall-In, sleep system)                        │
│   8. Assemble EngineOutput                                   │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Engine Output Slice     │   DEC-006: single slice, set by effect only
│  store.engineOutput      │
└──────┬───────────────────┘
       │  (pure reads)
       ▼
┌─────────────────────────────────────────────────────┐
│   Display Components (React)                        │
│   - CDIGauge, ThreeCurveDashboard, CM Cards         │
│   - Four-pill comparison, gear lists                │
│   - Strategy windows, trip summary                  │
│                                                     │
│   Components NEVER compute physics.                 │
│   Components NEVER call evaluate() directly.        │
└─────────────────────────────────────────────────────┘
```

### 1.2 Key properties (unchanged from v1.0)

1. **Single source of truth** (Cardinal Rule #3): `store.engineOutput` is THE canonical data structure.
2. **Single engine call site** (DEC-006 D): One effect in the store wires input changes to `evaluate()`.
3. **Package boundary enforces rogue engine prohibition** (DEC-009, Cardinal Rule #17).
4. **Engine is a pure function**: `evaluate(input: EngineInput): EngineOutput`. No side effects.
5. **TypeScript on the engine surface** (DEC-005).
6. **Build simplicity** (DEC-004): esbuild bundles single deployable artifact.

---

## 2. Repository structure

```
lc6/
├── packages/
│   ├── engine/                      # THE engine (DEC-009)
│   │   ├── src/
│   │   │   ├── index.ts                 # Public API entry
│   │   │   ├── types.ts                 # All public types (see §4)
│   │   │   ├── evaluate.ts              # Top-level pure function
│   │   │   ├── validate.ts
│   │   │   ├── heat_balance/            # PHY-056 Gagge + balance terms
│   │   │   │   ├── index.ts
│   │   │   │   ├── gagge.ts             # Iterative solver
│   │   │   │   ├── terms.ts             # M, W, C, R, E_resp, E_skin
│   │   │   │   └── coupling.ts          # h_tissue, vasomotor
│   │   │   ├── moisture/
│   │   │   │   └── intermittent.ts      # calcIntermittentMoisture (LOCKED LC5)
│   │   │   ├── heat_loss/
│   │   │   ├── cdi/                     # NEW STRUCTURE per v1.4
│   │   │   │   ├── index.ts             # public CDI computation entry
│   │   │   │   ├── stage_detector.ts    # v1.4 §4.2 clinical stage detection
│   │   │   │   ├── within_stage_ramp.ts # v1.4 §4.3 progression ramp
│   │   │   │   ├── shivering_sustained.ts  # Q_shiver > 50W for 5+ min detection
│   │   │   │   └── cm_triggers.ts       # CM card trigger evaluation
│   │   │   ├── ireq/
│   │   │   │   └── engine.ts            # d'Ambrosio 2025 Appendix B port
│   │   │   ├── ensemble/
│   │   │   │   ├── index.ts
│   │   │   │   ├── harmonic_mean.ts     # calcEnsembleIm (LOCKED LC5)
│   │   │   │   ├── degradation.ts       # TA v6 §2.5 wetPenalty
│   │   │   │   └── pack.ts              # PHY-054 pack thermal
│   │   │   ├── activity/
│   │   │   │   ├── parameters.ts
│   │   │   │   └── stationary.ts        # MET < 2.0 (DEC-013)
│   │   │   ├── strategy/
│   │   │   │   ├── enumerate.ts
│   │   │   │   └── winner.ts            # argmin peak_CDI with IREQ gate
│   │   │   ├── overlays/
│   │   │   │   ├── fall_in.ts           # Giesbrecht 1-10-1 + handoff
│   │   │   │   └── sleep_system.ts
│   │   │   └── aggregate/
│   │   │       └── segment.ts           # Per-segment peak rollup
│   │   ├── tests/
│   │   │   ├── vectors/                 # Seven v1.4 test vectors
│   │   │   ├── stage_detector/          # Stage detection edge cases
│   │   │   ├── regression/              # LC5 scenarios
│   │   │   ├── fall_in/
│   │   │   └── external/                # Tikuisis, ISO 11079, ISO 7933, Mayo, Korey Stringer
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── gear-api/                    # Thin gear DB query layer
│   │   └── (unchanged from v1.0)
│   │
│   └── shared/                      # Cross-package types
│       └── (unchanged)
│
├── apps/
│   └── web/                         # Display app
│       └── (unchanged from v1.0)
│
├── pnpm-workspace.yaml
├── esbuild.config.mjs
├── package.json
└── tsconfig.base.json
```

`cdi/` subdirectory expanded to make stage detection and progression ramp explicit modules. Public API (`@lc6/engine` exports) unchanged at the package boundary.

---

## 3. Engine package public API

Unchanged from v1.0 at the export level. The TypeScript types in §4 grow with new fields, but the import surface stays the same:

```typescript
// From @lc6/engine
export { evaluate } from './evaluate';
export type {
  EngineInput, EngineOutput,
  TrajectoryPoint, SegmentSummary,
  CmCard, CmTriggerState,
  PillResult, FourPill, IREQSummary,
  FallInOverlay, SleepSystemOverlay,
  StrategyMetadata,
  Regime, BindingPathway,
  ClinicalStage, CdiBasis,           // NEW in v1.1
  ActivitySpec, WeatherSlice, LocationSpec,
  UserBiometrics, GearEnsemble, GearItem,
} from './types';
```

---

## 4. Canonical engine output object

This is the architectural centerpiece. Inviolable per Working Agreement v3 Rule #16. Once ratified, shape changes require formal amendment.

**Changes from v1.0:** TrajectoryPoint adds four fields (`clinical_stage`, `cdi_basis`, `tau_to_next_stage`, `q_shiver_sustained`). CmCard `trigger_type` union adds three values. SegmentSummary adds `peak_clinical_stage`. All other types unchanged.

### 4.1 New enums

```typescript
type ClinicalStage =
  | "thermal_neutral"
  | "cold_compensable"              // CDI 1–2: vasoconstriction, no shivering
  | "cold_intensifying"             // CDI 3–4: heavy vasoconstriction, T_core 35.5–36.5
  | "mild_hypothermia"              // CDI 5–6: shivering active, T_core 32–35
  | "mild_hypothermia_deteriorating" // CDI 7–8: sustained vigorous shivering, T_core dropping toward 32
  | "severe_hypothermia"            // CDI 9–10: shivering ceased OR T_core ≤ 32 OR projected ≤ 32
  | "heat_compensable"              // CDI 1–2: sweating, T_core ≤ 37.8
  | "heat_intensifying"             // CDI 3–4: heavy sweating, T_core 37.8–38.5
  | "heat_exhaustion"               // CDI 5–6: heavy sweating + dizziness, T_core 38.5–39.5
  | "heat_exhaustion_deteriorating" // CDI 7–8: T_core 39.5+, pre-CNS-impairment
  | "heat_stroke";                  // CDI 9–10: T_core ≥ 40 OR projected ≥ 40 within next slice

type CdiBasis = "current_stage" | "progression_forecast" | "both";
```

### 4.2 TrajectoryPoint — per-slice (UPDATED)

```typescript
interface TrajectoryPoint {
  // ── Time ─────────────────────────────────────────────
  t: number;                          // seconds from trip start
  segment_id: string;
  
  // ── Converged body state (PHY-056) ───────────────────
  T_skin: number;                     // °C, whole-body mean, converged
  T_skin_smoothed: number;            // 3-slice trailing average
  dT_skin_dt: number;                 // °C/hr instantaneous
  dT_skin_dt_smoothed: number;        // °C/hr smoothed
  T_core: number;                     // °C, predicted
  dT_core_dt: number;                 // °C/hr (NEW: needed for stage progression)
  T_cl: number;                       // °C, clothing surface
  h_tissue: number;                   // W/(m²·K) vasomotor state
  
  // ── Heat balance terms (total-body W) ────────────────
  M: number;
  W: number;
  C: number;
  R: number;
  E_resp: number;
  E_skin: number;
  E_max: number;
  E_req: number;
  S: number;                          // heat storage rate
  S_net: number;                      // S after shivering compensation (engine-physiology only)
  SW_required: number;                // g/s sweat demand
  Q_shiver: number;                   // W shivering heat (engine-physiology; CDI uses Q_shiver as signal, not as compensation)
  
  // ── Environmental coefficients ───────────────────────
  V_effective: number;                // m/s
  h_c: number;
  h_mass: number;
  T_air: number;
  T_mrt: number;                      // v1: = T_air
  RH: number;
  P_a: number;
  
  // ── Clothing state ───────────────────────────────────
  R_clo_effective: number;
  R_e_cl_effective: number;
  im_system: number;
  VPD: number;
  
  // ── Risk metrics ─────────────────────────────────────
  MR: number;                         // moisture risk 0–10
  HLR: number;                        // heat loss risk 0–10
  CDI: number;                        // 0–10 per v1.4 stage detection + progression
  regime: Regime;
  binding_pathway: BindingPathway;
  
  // ── NEW v1.4 stage-detection fields ──────────────────
  clinical_stage: ClinicalStage;      // current stage detected per v1.4 §4.2
  cdi_basis: CdiBasis;                // what drove CDI value: stage floor alone, progression forecast, or both
  tau_to_next_stage: number | null;   // hr; projected time to next-worse stage; null if at terminal stage (severe_hypothermia or heat_stroke)
  q_shiver_sustained: boolean;        // true if Q_shiver > 50W sustained for 5+ min (the diagnostic signal)
  
  // ── τ values (v1.3 retained for transparency, used by within-stage ramp) ──
  tau_core_cold: number | null;
  tau_dex: number | null;
  tau_core_hot: number | null;
  tau_impair: number;
  
  // ── CM trigger states (per v1.4 §8.3) ────────────────
  cm_trigger: {
    cold_core: CmTriggerState;          // T_core ≤ 35.0°C
    cold_dex: CmTriggerState;           // T_skin ≤ 28.0°C
    heat_core: CmTriggerState;          // T_core ≥ 38.5°C
    shivering_sustained: CmTriggerState; // NEW: Q_shiver > 50W sustained 5+ min (separate from T_core trigger)
  };
  
  // ── Phase context ────────────────────────────────────
  phase: string;
  venting?: VentingState;
  epoc_state?: EpocState;
  pack_state?: PackState;
}

interface CmTriggerState {
  threshold_crossed: boolean;
  projected_crossing_eta: number | null;  // hr until projected; null if not in next-slice window
}

// VentingState, EpocState, PackState unchanged from v1.0
```

### 4.3 SegmentSummary (UPDATED)

```typescript
interface SegmentSummary {
  segment_id: string;
  segment_label: string;
  start_t: number;
  end_t: number;
  
  // Peak metrics over this segment
  peak_MR: number;
  peak_MR_at_t: number;
  peak_HLR: number;
  peak_HLR_at_t: number;
  peak_CDI: number;
  peak_CDI_at_t: number;
  peak_binding_pathway: BindingPathway;
  peak_regime: Regime;
  peak_clinical_stage: ClinicalStage;        // NEW: highest-severity stage observed in segment
  peak_cdi_basis: CdiBasis;                  // NEW
  
  // CM cards fired during this segment
  cm_cards_fired: CmCard[];
  
  // Activity-class specific
  is_stationary: boolean;
  comfort_hours_remaining?: number;
}
```

### 4.4 CmCard (UPDATED)

```typescript
interface CmCard {
  card_id: string;
  trigger_type:
    // Existing v1.0 trigger types
    | "mr_saturation"
    | "cold_core_threshold"
    | "cold_core_projected"
    | "cold_dex_threshold"
    | "cold_dex_projected"
    | "heat_core_threshold"
    | "heat_core_projected"
    | "edge_of_scope"
    // NEW v1.4 stage-anchored trigger types (replace v1.0's "cdi_compound" / "cdi_only")
    | "shivering_sustained"             // Q_shiver > 50W sustained; signals mild hypothermia
    | "mild_hypothermia_active"         // CDI in 5–6 range, cold side
    | "mild_hypothermia_deteriorating"  // CDI in 7–8 range, cold side
    | "heat_exhaustion_active"          // CDI in 5–6 range, heat side
    | "heat_exhaustion_deteriorating";  // CDI in 7–8 range, heat side
  fired_at_t: number;
  severity: "low" | "elevated" | "moderate" | "high" | "critical" | "edge_of_scope";
  copy: string;                       // rendered per v1.4 §8.3
  mitigation_type: "moisture" | "layer" | "shelter" | "cool" | "dex" | "emergency";
  activity_specific_imperative: string;
  clinical_stage_context?: ClinicalStage;  // NEW: which stage triggered this card (for display + analytics)
}
```

### 4.5 EngineOutput, TripHeadline, FourPill, etc.

Unchanged from v1.0 except:

```typescript
interface TripHeadline {
  peak_MR: number;
  peak_HLR: number;
  peak_CDI: number;
  peak_CDI_segment_id: string;
  peak_clinical_stage: ClinicalStage;        // NEW
  binding_pathway: BindingPathway;
  regime_mix: { cold_fraction: number; heat_fraction: number; neutral_fraction: number };
  total_duration_hr: number;
  cm_card_count: number;
  named_impairment_stage_reached: boolean;   // NEW: any segment reached CDI 5+ (mild_hypothermia or heat_exhaustion or worse)
  edge_of_scope_triggered: boolean;          // any segment hit CDI 9.5+
}
```

`PillResult.trajectory_summary` adds `peak_clinical_stage: ClinicalStage`.

`StrategyMetadata` unchanged.

`IREQSummary, FallInOverlay, SleepSystemOverlay` unchanged.

### 4.6 Input types

Unchanged from v1.0 entirely. EngineInput, ActivitySpec, WeatherSlice, LocationSpec, UserBiometrics, GearEnsemble — none affected by v1.4 spec change.

---

## 5. Display app architecture

### 5.1 Component hierarchy (unchanged from v1.0)

```
<App>
├── <InputPages>                     // Pages 1-3, ported from LC5
└── <Results>                        // Page 4; Bento grid
    ├── <Hero>                       // headline CDI + clinical_stage badge
    ├── <ThreeCurveDashboard>        // CDI curve with stage-transition styling
    ├── <CriticalMomentStrip>        // CM cards including new stage-anchored types
    ├── <FourPillComparison>
    ├── <GearPanel>
    ├── <RunStrip>
    ├── <CascadeMeter>
    ├── <FallInCard>                 // conditional
    ├── <StrategyWindows>
    ├── <CampPanel>                  // conditional
    └── <EdgeOfScopeBanner>          // conditional, CDI ≥ 9.5
```

New display affordance: clinical_stage badges. Hero shows current stage name alongside CDI number ("Mild Hypothermia, CDI 5"). CDI curve in dashboard styles by stage (transition from yellow to orange to red as stage worsens).

### 5.2 Store shape (unchanged from v1.0)

Zustand store with input slices, engine output slice (set by effect only), UI slice. Engine effect debounces 200ms.

### 5.3 Engine effect (unchanged from v1.0)

Single call site for `evaluate()`. Hash-based cache. Components never call directly.

### 5.4 Display component examples (UPDATED)

```typescript
// Hero with CDI + clinical stage badge
function Hero() {
  const headline = useLC6Store(s => s.engineOutput?.trip_headline);
  if (!headline) return <Skeleton />;
  
  return (
    <HeroFrame>
      <CDIGauge value={headline.peak_CDI} tier={cdiToTier(headline.peak_CDI)} />
      <StageBadge stage={headline.peak_clinical_stage} />
      {headline.named_impairment_stage_reached && (
        <ImpairmentBanner stage={headline.peak_clinical_stage} />
      )}
    </HeroFrame>
  );
}

// CM cards rendering with stage context
function CriticalMomentCards() {
  const segments = useLC6Store(s => s.engineOutput?.segments);
  if (!segments) return null;
  
  const allCards = segments.flatMap(s =>
    s.cm_cards_fired.map(c => ({ ...c, segment_label: s.segment_label }))
  );
  
  // Edge-of-scope takes priority
  const edge = allCards.find(c => c.trigger_type === "edge_of_scope");
  if (edge) return <EdgeOfScopeBanner card={edge} />;
  
  // Stage-anchored cards take next priority
  const stageCards = allCards.filter(c =>
    c.trigger_type === "mild_hypothermia_active"
    || c.trigger_type === "mild_hypothermia_deteriorating"
    || c.trigger_type === "heat_exhaustion_active"
    || c.trigger_type === "heat_exhaustion_deteriorating"
    || c.trigger_type === "shivering_sustained"
  );
  
  const otherCards = allCards.filter(c => !stageCards.includes(c));
  
  return (
    <CardList>
      {stageCards.map(c => (
        <StageCard
          key={c.card_id}
          severity={c.severity}
          stage={c.clinical_stage_context}
          copy={c.copy}
          segment={c.segment_label}
        />
      ))}
      {otherCards.map(c => (
        <CmCard key={c.card_id} {...c} />
      ))}
    </CardList>
  );
}

function cdiToTier(cdi: number): "low" | "elevated" | "moderate" | "high" | "critical" {
  if (cdi <= 2) return "low";
  if (cdi <= 4) return "elevated";
  if (cdi <= 6) return "moderate";
  if (cdi <= 8) return "high";
  return "critical";
}
```

---

## 6. Shared contracts (unchanged from v1.0)

§6.1 Gear API, §6.2 Weather API, §6.3 Storage API — no changes from v1.0.

---

## 7. Build pipeline (unchanged from v1.0)

esbuild per DEC-004; pnpm workspace; single bundle to `dist/`.

---

## 8. Deploy (unchanged from v1.0)

Two Netlify sites (dev, prod) per DEC-008.

---

## 9. Test strategy

### 9.1 Engine tests (Vitest in `packages/engine/tests/`)

**Unit tests** per module:
- `heat_balance/gagge.test.ts` — iterative solver convergence
- `cdi/stage_detector.test.ts` — **NEW: clinical stage detection edge cases** (Q_shiver onset/cessation, T_core threshold crossings, stage promotion at 15-min threshold)
- `cdi/within_stage_ramp.test.ts` — **NEW: progression ramp linearity within tier ranges**
- `cdi/shivering_sustained.test.ts` — **NEW: 50W/5min detection, transient suppression**
- `cdi/cm_triggers.test.ts` — threshold and projected-crossing logic with new stage-anchored cards
- `moisture/intermittent.test.ts` — calcIntermittentMoisture invariants (PORTED LC5)
- `ireq/engine.test.ts` — Appendix B validation (PORTED LC5)
- `ensemble/harmonic_mean.test.ts` — im_system (PORTED)

**Integration tests — the seven v1.4 test vectors** (per CDI v1.4 §5):
- Vector 1 (cold benign) → CDI 1.33 Low, stage = cold_compensable, basis = progression_forecast
- Vector 2 (wet shivering) → **CDI 5.0 Moderate, stage = mild_hypothermia, basis = current_stage** (the canary)
- Vector 3 (wet-cold compound) → CDI 5.0 Moderate, stage = mild_hypothermia
- Vector 4 (extreme wet-cold) → CDI 7.0 High, stage = mild_hypothermia_deteriorating (promoted)
- Vector 5 (heat cyclist) → CDI 3.79 Elevated, stage = heat_intensifying
- Vector 6 (heat past threshold) → CDI 9.13 Critical, stage = heat_stroke (projected)
- Vector 7 (neutral) → CDI 0, stage = thermal_neutral

Pass/fail tolerance: ±0.1 on CDI; clinical_stage must match exactly; cdi_basis must match exactly; CM trigger counts must match.

**Stage detection edge cases** (new test class):
- Brief shivering during cold-start transition (first 2 min) → does NOT promote to mild_hypothermia
- Sustained shivering (Q_shiver 100W for 6 min) → promotes to mild_hypothermia at minute 5
- Shivering cessation with T_core stable (user warmed up) → does NOT trigger severe_hypothermia
- Shivering cessation with T_core falling (involuntary exhaustion) → DOES trigger severe_hypothermia
- 15-min stage promotion: τ_to_next < 15 min → effective stage promotes, CDI floor jumps
- Heat stroke projection: T_core trajectory crossing 40°C within next slice → stage promotes from heat_exhaustion_deteriorating to heat_stroke

**Regression tests** — LC5 scenarios per v1.4 §7.1:
- Breckenridge snowboarding 16°F 6h → 1–2 Low, no shivering
- Kirwood multi-segment Wed/Thu wind reversal → per-segment stage tracking
- Cooper Landing fishing → 1–3 Low/Elevated (vasoconstriction, no shivering)
- Half Dome → 1–3 Low throughout
- Hot cycling 90°F humid → stage trajectory through compensable → intensifying → potentially exhaustion

**Fall-In regression** — v1.4 §7.2:
- 6 scenarios with stage detection on post-event hike-out
- Validates that immersion → shivering → mild_hypothermia stage detection fires immediately

**External validation** — v1.4 §7.3:
- Mayo / WMS clinical staging consistency
- ACSM 2023 heat illness staging consistency
- Tikuisis 1995 Fig 3 (within-stage progression in cold)
- ISO 11079 DLE_min Annex A
- ISO 7933 PHS Annex (Dlim_Tre38)
- USARIEM SCENARIO-B (Q_shiver_sustained 50W/5min validation)

### 9.2 Display tests (React Testing Library)

- Skeleton when engineOutput === null
- Stage badge renders for every clinical_stage enum value
- StageCard renders correctly for each new trigger type
- ImpairmentBanner appears when named_impairment_stage_reached === true
- EdgeOfScopeBanner takes precedence over other cards

### 9.3 E2E tests (Playwright)

Unchanged from v1.0 list, plus:
- Vector 2 simulation: input wet user in cold conditions → UI shows "Mild Hypothermia, CDI 5" with active CM card
- Vector 6 simulation: input cyclist in extreme heat → UI shows projected heat stroke warning before T_core actually reaches 40°C

### 9.4 Test run expectations

Same as v1.0: engine unit + integration < 5s; engine regression + external < 30s; display < 20s; E2E < 5min.

---

## 10. Regime boundaries — what's in and what's out

Unchanged from v1.0.

### 10.1 Engine ONLY:
All physics, all CDI/MR/HLR, all stage detection, all τ and threshold evaluation, strategy winner selection, ensemble enumeration, IREQ feasibility, overlay physics.

### 10.2 Display ONLY:
Rendering, user input, weather fetching, storage, router, animations, copy template rendering.

### 10.3 Forbidden everywhere:
- Parallel physics outside engine (Cardinal Rule #17)
- Display calling evaluate() directly
- Engine doing fetch / storage / DOM
- Hardcoded thermal constants in display
- Wind chill as engine input

---

## 11. Open items deferred post-Architecture

Unchanged from v1.0:
- Fall-In v2 Redesign Spec (Session 6+)
- Activity Parameter Ratification (separate session)
- Layer 2 Precognition v2
- PHY-042 solar v2
- Full T_mrt model v2
- Wearable integration v2
- Goldilocks calibration pipeline post-v1
- Gear DB API migration v1.x
- Q_shiver parameter validation against SCENARIO-B (engine build phase)
- OQ-024 and OQ-027 LC5 code greps

Plus from v1.4:
- `stage_τ_max` per-stage values are GAP-flagged; SCENARIO-B + ISO 11079 DLE comparison validates at engine build phase
- 15-min stage promotion threshold tunable per stage if SCENARIO-B suggests differentiation
- Q_shiver_sustained 50W threshold could become percentile-of-Q_shiver_max if SCENARIO-B suggests
- Heat-side direct sweat-rate stage detection (if T_core proves too lagging)

---

## 12. Architecture compliance audit — Working Agreement v3

| Rule | Architecture satisfaction |
|---|---|
| **#1 — No fudge factors** | CDI v1.4 stage thresholds all cited (Mayo, ACSM 2021, ACSM 2023, Castellani 2016, WMS 2019, Korey Stringer Institute, NIH); Q_shiver_sustained threshold cited; `stage_τ_max` GAP-flagged with SCENARIO-B validation target |
| **#2 — im drives evaporation** | Engine output carries `im_system`, `R_e_cl_effective`; MR computed via ensemble im |
| **#3 — Single source of truth** | `EngineOutput` is canonical; single `evaluate()` call site; single `_setEngineOutput` setter |
| **#4 — No hardcoded constants in display** | Display reads stage thresholds, CDI tier mapping, copy templates from engine output; no inline thermal numbers |
| **#5 — Wind chill display only** | Not an engine input; wind speed enters via h_c |
| **#6 — No double-dipping** | MR and HLR flow through |S| exactly once; v1.4 strengthens this — Q_shiver no longer compensates |S| in CDI math (it's a stage signal) |
| **#7 — T_skin computed, never assumed** | T_skin is converged on every TrajectoryPoint via PHY-056 |
| **#8 — Thermal engine locked** | Engine modules port LC5 validated state; changes require Chat-produced code + hand-computed verification |
| **#9 — System-level winner evaluation** | `argmin_ensemble peak_CDI` with IREQ gate; v1.4 makes this stronger because peak_CDI now penalizes ensembles that drive named clinical impairment stages |
| **#10 — scoreGear / calcEnsembleIm / quickRisk never modified by display** | Engine package boundary enforced |
| **#11 — No code without ratified spec** | Session 5 build only after this Architecture Document v1.1 ratifies |
| **#12 — No while-we're-in-here changes** | Scope is Architecture Document only |
| **#13 — Chat produces all code** | Session 5 follows discipline |
| **#14 — Read before proposing** | Architecture v1.1 built from ratified inputs (CDI v1.4) |
| **#15 — Confirm or push back** | Open questions in §13 |
| **#16 — Engine output contract inviolable** | §4 contract; v1.0 → v1.1 changes are additive, no removal or rename of existing fields |
| **#17 — Rogue engine prohibition** | Enforced by package boundary per DEC-009 |
| **#18 — v9 doc sync** | TA v6 §3.3 and §28 stale; CDI v1.4 is authoritative until v9 sync |

---

## 13. Open questions for ratification

1. **Engine output v1.1 additions (§4) — clinical_stage enum, cdi_basis enum, tau_to_next_stage, q_shiver_sustained on TrajectoryPoint; peak_clinical_stage on SegmentSummary; new trigger types on CmCard; named_impairment_stage_reached on TripHeadline.** Acceptable as additive changes that don't break v1.0 contract?

2. **CmCard `trigger_type` reorganization** — v1.0 had `cdi_compound` / `cdi_and_mr` / `cdi_only` triggers; v1.1 replaces these with stage-anchored triggers (`mild_hypothermia_active`, `heat_exhaustion_active`, `shivering_sustained`, etc.). This is a slight breaking change for any future code expecting v1.0 trigger_type strings — but no display code yet exists, so no actual break. Acceptable?

3. **Engine module structure (§2) cdi/ subdirectory expanded** — `stage_detector.ts`, `within_stage_ramp.ts`, `shivering_sustained.ts` as separate modules. Acceptable, or do you want them inlined into a single `cdi/index.ts`?

4. **Stage badge UI affordance (§5.4)** — Hero shows clinical_stage as a named badge alongside CDI ("Mild Hypothermia, CDI 5"). CDI curve styles transitions between stages. Acceptable as design intent for build phase, or should this be deferred to a separate UX spec?

5. **Same as v1.0:** repo structure, store shape, single effect debounce pattern, test gating. Carried forward unchanged.

---

## 14. Ratification

Standard responses per Working Agreement v3 §4.

- **Ratified** — Session 5 build phase begins. First build deliverable TBD per Session 5 opening scope.
- **Ratified with changes** — list changes; Chat applies, bumps to v1.2.
- **More questions** — enumerate.
- **Reject** — return to drawing board.

Once ratified, this document is the authoritative architecture spec for LC6 v1. EngineOutput in §4 is inviolable per Rule #16 until formal amendment.

---

## 15. v1.2 amendment (Session 11, PHY-GEAR-01 ratified 2026-04-17)

**Changes from v1.1:**

### 1. GearSlot union expanded from 9 to 12 members

Added: `sleeping_bag`, `sleeping_pad`, `immersion`. Purely additive - no existing consumer is broken.

**Rationale for `sleeping_bag` / `sleeping_pad`:** sleep products have their own attribute set (R-value per ISO 11079 / ASTM F3340, comfort rating, lower limit, fill power) that does not map onto the 6-attribute clothing confidence tier system. They flow through the adapter on a separate 2-attribute confidence axis (see PHY-GEAR-01 v2 section 3.6) and are consumed by `overlays/sleep_system.ts`.

**Rationale for `immersion`:** drysuits and wetsuits require split-body physics (upper 45% BSA normal ensemble + lower 55% BSA material-property table lookup per Tikuisis 1997, ISO 15027) fundamentally different from clothing ensemble physics. Routing them to `shell` would silently misroute - `im: 0.00` for neoprene is a material fact, not a breathability score. The dedicated `immersion` slot captures these products for eventual PHY-IMMERSION-01 physics. Session 11 captures inert (`spec_confidence: 0`, excluded from `enumerateCandidates` via defensive filter). PHY-IMMERSION-01 activates the slot when immersion scenarios come into scope.

### 2. GearSubslot type added (19-value enum)

Source-level metadata tagging which gear.js bucket an item came from. Does NOT influence physics - exists for UI, diagnostics, and the forthcoming infographic (PHY-INFOGRAPHIC-01).

Members: `upper_base`, `upper_mid`, `upper_insulative`, `upper_shell`, `lower_base`, `lower_pants`, `lower_insulative`, `lower_ski_shell`, `lower_shell`, `lower_bike`, `immersion_drysuit`, `immersion_wetsuit`, `immersion_wader`, `footwear`, `headgear`, `handwear`, `neck`, `sleeping_bag`, `sleeping_pad`.

### 3. EngineGearItem gains six optional fields

| Field | Type | Slot | Source |
|---|---|---|---|
| `subslot` | `GearSubslot` | any | adapter routing metadata |
| `thickness_mm` | `string` | `immersion` | raw gear.js `thickness` field |
| `comfort_rating_f` | `number` | `sleeping_bag` | manufacturer-published |
| `lower_limit_f` | `number` | `sleeping_bag` | manufacturer-published |
| `fill_power` | `number` | `sleeping_bag` | down fill power 500-900+ |
| `r_value` | `number` | `sleeping_pad` | ISO 11079 thermal resistance |

### 4. FiberType extracted as named exported type

Previously inline on `EngineGearItem.fiber`. Now a named type alias:

```typescript
export type FiberType = "synthetic" | "wool" | "cotton" | "down" | "blend";
```

Enables the adapter's `inferFiber` function to have a typed return. No behavioral change.

### 5. enumerateCandidates gains a defensive filter

Single line at function entry excludes `slot: "immersion"` items from clothing ensemble enumeration. Filter is defensive - immersion slot is not in any required-slots list anyway, but explicit exclusion protects against future edits that might add immersion to required-slots by mistake.

### 6. catalogSummary return shape changed

From flat `{ slot: count, ... }` to structured `{ bySlot, bySubslot, byConfidence, byFiber }`. More useful for diagnostics and the forthcoming infographic. Callers need to update: `summary['base']` -> `summary.bySlot['base']`. Existing test fixtures updated in commit 2d091ed.

### 7. Cardinal Rule verification

- **#8 (thermal engine locked):** zero changes to `calcIntermittentMoisture`, `calcEnsembleIm`, `heatLossRisk`, `scoreGear`, `quickRisk`.
- **#16 (EngineOutput contract):** unchanged. `GearSlot` union expansion is additive.
- **#1 (no fudge factors):** PHY-GEAR-01 v2 section 5.7 Honesty Ledger flags 9 LC5-derived calibration constants (7 peer-imputation tuning parameters + `warmthRatio->CLO` + `breathability->im` interpolation shapes). Follow-up specs: PHY-GEAR-PEER-CAL, PHY-GEAR-WARMTH-CAL, PHY-GEAR-BREATH-CAL.

### 8. Open question raised: OQ-REGIONAL-MR

LC6 engine computes CLO and im as whole-body BSA-weighted values but moisture accumulates regionally. When upper MR differs materially from lower MR (common case: 4/2 ski kit), `EngineOutput.peak_MR` currently emits a single scalar. Three candidate resolutions: max-of-regions, BSA-weighted blend (not recommended), regional-pair-as-first-class. Resolution affects EngineOutput contract (Rule #16 formal amendment), so OQ-REGIONAL-MR must be scoped and decided before PHY-INFOGRAPHIC-01 design. High priority. Captured in `LC6_Open_Issues_Ledger.md`.

### 9. Commit chain (Session 11)

- `bd8402d` - Session 11 setup (spec v2 ratified, planning dir, reference gear.js)
- `51ead73` - Phase 1: types.ts (GearSlot 9->12, GearSubslot, FiberType, +6 fields)
- `2d091ed` - Phase 2+2.5: adapter.ts full rewrite + test fixture alignment
- `de0ed75` - Phase 3: enumerate immersion filter + gearjs_adapter tests + matrix wiring
- `80ece9e` - Phase 4: ledger updates

**Test progression:** 597/597 -> 628/628 (+31 new, no regressions)

**Adversarial matrix:** 12/19 -> 19/19 scenarios enumerate against real 1,627-product gear catalog.

---

## Document status

**Version:** v1.2 RATIFIED
**Session:** 11 (2026-04-17) - amendment for PHY-GEAR-01
**Supersedes:** v1.1 (now historical, integrated into v1.2)
**Ratification:** Complete (Christian, Session 11)
**Depends on:** CDI Spec v1.4 RATIFIED, Heat Balance Variables v1, PHY-GEAR-01 v2 RATIFIED, DEC-004 through DEC-010, DEC-018, DEC-019, DEC-PHY-GEAR-01
**Unblocks:** Session 12 (H3 humid running, OQ-REGIONAL-MR scoping)
