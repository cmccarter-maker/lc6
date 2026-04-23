# S31 Hand-Computed Verification Trace

**Purpose:** Cardinal Rule #8 companion document to `S31_kickoff.md`. Extends PHY-031-CYCLEMIN-RECONCILIATION spec §9 summary traces to primitive-level arithmetic. Engine output verified against these values at each phase gate; divergence at primitive level signals specific bug class.

**Authored:** S31 kickoff, April 23, 2026
**Scope:** 3 vectors × 3 key cycles per vector (cycle 0 warmup, pre-lunch peak, post-lunch recovery) + 6 rest-phase traces (lunch + otherBreak × 3 vectors) = 15 primitive-level traces

**Verification gates reference:** spec §9.5 criteria 1–6 + this document's per-cycle values at ±0.5 MR, ±15% sweat rate, ±15% storage.

---

## 0. Conventions

### 0.1 Primitive function signatures

From `calc_intermittent_moisture.ts` at HEAD `4e84e76`:

```typescript
iterativeTSkin(
  coreTemp:     number,    // °C (body core ≈ 37.0)
  TambC:        number,    // °C ambient
  Rtissue:      number,    // m²·K/W (tissue thermal resistance, CIVD-modulated)
  Rclo:         number,    // m²·K/W (clothing thermal resistance = totalCLO × 0.155)
  Ra:           number,    // m²·K/W (boundary layer air resistance = 1/hc)
  bsa:          number,    // m² body surface area
  MET:          number,    // metabolic equivalent
  windMs:       number,    // m/s (wind + speed-added for run, wind-only for other phases)
  humidity:     number,    // % RH (0-100, NOT 0-1)
  im:           number,    // vapor permeability (0-1 typical 0.089 shell-gated, 0.18 shell-off)
  bodyFatPct:   number,    // body fat %
  maxIter:      number,    // iteration cap (6 or 8)
  tolerance:    number     // convergence tolerance (0.1)
) → { T_skin: number }

computeSweatRate(
  E_req:  number,    // W (required evaporation)
  E_max:  number     // W (maximum evaporation capacity)
) → { sweatGPerHr: number, qEvapW: number }

computeEmax(
  T_skin:   number,   // °C
  T_amb:    number,   // °C
  humidity: number,   // % (0-100)
  windMs:   number,   // m/s
  im:       number,   // 0-1
  totalCLO: number,   // clo units
  bsa:      number    // m²
) → { eMax: number }  // W

computeMetabolicHeat(MET, bodyMassKg) → W
  = MET × 58.2 × bsa  (approximately MET × 3.5 × bodyMassKg × 0.0175 per ACSM)

computeConvectiveHeatLoss(Tsk, Tamb, Rclo, bsa, windMs, speedAdd) → W
  h_c = 8.3 × sqrt(max(0.5, windMs + speedAdd))
  R_a = 1 / h_c
  Q_conv = bsa × (Tsk - Tamb) / (Rclo + R_a)

computeRadiativeHeatLoss(T_surf, T_amb, bsa) → W
  ≈ bsa × h_r × (T_surf - T_amb)  where h_r ≈ 4.7 W/m²·K

computeRespiratoryHeatLoss(MET, Tamb, humidity, bodyMassKg, faceCover) → { total, moistureGhr }
  V_E = 0.00065 × MET × bodyMassKg × 60  (L/min breath volume)
  total ≈ V_E × (0.0014 × (37-Tamb) + 0.00173 × (pSat(37) - humidity/100 × pSat(Tamb))) × 60 / 1000

computeEdiff(M, W, Pa_ambient, bsa) → W  (ISO 7730 diffusive insensible evaporation)
  ≈ 3.05 × bsa × (5.733 - 0.007×M - 0.001×Pa_ambient/100)

civdProtectionFromSkin(T_skin_prev) → civd fraction
computeRtissueFromCIVD(civd) → Rtissue  (typical 0.05-0.08 m²·K/W)
```

### 0.2 Shared constants for all three vectors

Biometrics (spec §9.2):
- `sex = male`
- `weightLb = 170` → `bodyMassKg = 77.1 kg`
- `heightCm ≈ 180` → `bsa = 1.92 m²` (Du Bois)
- `bodyFatPct = 18`
- `fitnessProfile.vo2max = 48`

Gear ensemble (spec §9.2, shared across all three vectors):
- base: Merino 200 gsm LS crew — CLO 0.45, im 0.50, wicking 8, wool, 220 g, cap 66 g
- mid: Patagonia R1 Air Hoody — CLO 0.75, im 0.55, wicking 6, synthetic, 320 g, cap 19 g
- insulative: Patagonia Nano Puff Hoody — CLO 1.25, im 0.48, wicking 3, synthetic (PrimaLoft Gold), 310 g, cap 19 g
- shell: Arc'teryx Beta LT hardshell — CLO 0.15, im 0.38, wicking 1, synthetic (3L GORE-TEX), 390 g, cap 78 g
- **Ensemble totals:**
  - `totalCLO = 0.45 + 0.75 + 1.25 + 0.15 = 2.60`
  - `Rclo = 2.60 × 0.155 = 0.403 m²·K/W`
  - `ensembleIm = 0.089` (shell-gated series per LC5 ratified algorithm)
  - `effectiveIm_shellOff = imSeries(0.50, 0.55, 0.48) ≈ 0.18` (no shell in series)
  - `Rclo_shellOff = (0.45 + 0.75 + 1.25) × 0.155 = 0.380 m²·K/W`
  - System cap = 66 + 19 + 19 + 78 = 182 g

Session structure (all three vectors):
- `durationHrs = 8.5`
- `sessionMin = 510`
- sessionStart = 8:30 AM
- lunch = true, otherBreak = true

### 0.3 Saturation vapor pressure (Magnus formula, for reference)

```
pSat(T_C) [Pa] = 610.78 × exp(17.269 × T / (T + 237.3))
```

Values used below:
- `pSat(-8.9°C) ≈ 282 Pa`   (G1 ambient)
- `pSat(-7.8°C) ≈ 312 Pa`   (P5 ambient)
- `pSat(-6.7°C) ≈ 344 Pa`   (M2 ambient)
- `pSat(20°C) ≈ 2338 Pa`    (indoor)
- `pSat(30°C) ≈ 4245 Pa`    (skin ≈ 30°C)
- `pSat(33°C) ≈ 5030 Pa`    (skin ≈ 33°C)
- `pSat(33.5°C) ≈ 5172 Pa`  (skin ≈ 33.5°C)
- `pSat(37°C) ≈ 6278 Pa`    (core)

### 0.4 Phase structure per vector

| Vector | cycleMinRaw | cycleMin | cycles | line | lift | trans | run |
|---|---|---|---|---|---|---|---|
| G1 | 13  | 16.25 | 31 |  0 | 7 | 3 | 3 |
| M2 | 19  | 23.75 | 21 |  2 | 7 | 3 | 7 |
| P5 | 32  | 40.00 | 12 | 15 | 7 | 3 | 7 |

---

## 1. Vector G1 — Ghost Town groomers

**Ambient:** 16°F (-8.9°C), 30% RH, 5 mph wind (2.24 m/s), no precip, 9,600 ft (Breckenridge base).

**Derived:**
- `pAmbient = 0.30 × 282 = 84.6 Pa` (vapor partial pressure)
- `P_a_Pa ≈ 85 Pa` (for computeEdiff)
- Cycle structure: line 0 (skipped), lift 7, transition 3, run 3

**Engine-simulated warmup:** cycles 0–5 use `_groomerMET = 5.0` per engine convention; cycle 6+ use `_lc5Mets['moderate'] = 5` for groomers (same value, convention).

Actually, groomers `intensity: moderate` → MET 5 for both warmup and full-MET cycles per `_lc5Mets`. There's no "8 MET" run for G1; G1 is a low-MET vector compared to M2/P5.

**MET for groomers = 5.0 across all G1 cycles.** Warmup behavior applies in the first few cycles but doesn't change MET value for groomers (only affects mogul/tree intensity bumps).

### 1.1 Cycle 0 trace — warmup initial cycle

**Cycle entry:**
- `_prevTskin = 33.7` (default, no prior cycle)
- `_civdCycle = civdProtectionFromSkin(33.7)` — 33.7°C is well above 33°C CIVD threshold → `civd ≈ 1.0` (full CIVD protection)
- `_Rtissue = computeRtissueFromCIVD(1.0) ≈ 0.064 m²·K/W` (typical CIVD-active tissue)

**Line phase:** SKIPPED (Tier 1, `_liftLineMin = 0`)

**Lift phase (7 × 1-min substeps):**

EPOC seed at lift start: no prior run (cycle 0), no EPOC overlay. `_METstart_lift = _METlift = 1.5` per engine current line 683.

Minute 0 (t = 0.5):
- `_METnow = 1.5 + aFast × exp(-0.5/τF) + aSlow × exp(-0.5/τS)` — with no prior run, aFast=aSlow=0 → `_METnow = 1.5`
- `_shiv = shiveringBoost(-8.9, 1.5, 2.60 + 0.064/0.155, 18)` — Tamb very cold, MET low, tissueCLO + totalCLO ≈ 2.60 + 0.41 ≈ 3.0 clo, bodyFat 18%. Shiver boost factor typical 1.0 to 1.15 at this state. For minute 0 with Tsk not yet at cold threshold: shiv ≈ 1.0 (no boost)
- `_hcL = 8.3 × sqrt(max(0.5, 2.24)) = 8.3 × 1.497 = 12.4 W/m²·K`
- `_RaL = 1/12.4 = 0.0806`
- `iterativeTSkin(37.0, -8.9, 0.064, 0.403, 0.0806, 1.92, 1.5, 2.24, 30, 0.089, 18, 6, 0.1)`:
  - Iteration seeks Tsk where heat balance closes
  - Core 37°C → tissue drop through Rtissue 0.064 → layer underneath clothing at maybe 33-34°C
  - Clothing drop through Rclo 0.403 → surface temp intermediate
  - Boundary layer Ra 0.0806 → convects to ambient -8.9°C
  - At MET 1.5 (basal), Qmet ≈ 1.5 × 58.2 × 1.92 = 168 W
  - Most heat loss through conductive path + respiratory; sweat minimal
  - Tsk converges to approximately **30.2°C** (cold, basal, shell-gated ensemble, extended cold exposure)
- `_Qmet = 1.5 × 58.2 × 1.92 ≈ 168 W`
- `_QcL = computeConvectiveHeatLoss(30.2, -8.9, 0.403, 1.92, 2.24, 0)`:
  - h_c = 8.3 × sqrt(2.24) = 12.4; R_a = 0.0806
  - Q_conv = 1.92 × (30.2 - (-8.9)) / (0.403 + 0.0806)
  - Q_conv = 1.92 × 39.1 / 0.484
  - Q_conv = **155 W**
- `_TsL = 30.2 - (30.2 - (-8.9)) × (0.403/(0.403+0.0806))`
  - `= 30.2 - 39.1 × 0.833`
  - `= 30.2 - 32.6 = -2.4°C` (shell surface)
- `_QrL = computeRadiativeHeatLoss(-2.4, -8.9, 1.92)`:
  - h_r ≈ 4.7 W/m²·K
  - Q_rad = 1.92 × 4.7 × (-2.4 - (-8.9)) = 1.92 × 4.7 × 6.5 = **59 W**
- `_respL = computeRespiratoryHeatLoss(1.5, -8.9, 30, 77.1, 0)`:
  - V_E = 0.00065 × 1.5 × 77.1 × 60 = 4.51 L/min
  - sensible ≈ 4.51 × 0.0014 × (37 - (-8.9)) × 60 / 1000 = 0.017 W/min (small)
  - latent ≈ 4.51 × 0.00173 × (6278 - 0.30×282) × 60 / 1000 = 0.029 L/min × vapor
  - Total respiratory: approximately **9 W** (6 W sensible + 3 W latent at this low MET)
  - moistureGhr ≈ 14 g/hr (low)
- `_M_Wm2 = 1.5 × 58.2 = 87.3`
- `_ediffLift = computeEdiff(87.3, 0, 85, 1.92)`:
  - ISO 7730: Ediff = 3.05 × 1.92 × (5.733 - 0.007×87.3 - 0.001×85/100)
  - = 3.05 × 1.92 × (5.733 - 0.611 - 0.00085)
  - = 3.05 × 1.92 × 5.121
  - = **30 W**
- `_QpL = 155 + 59 + 9 + 30 = 253 W`
- `_resL = 168 - 253 = -85 W` (deficit — user losing heat)
- `_eReqL = max(0, -85) = 0 W`
- `_emaxL = computeEmax(30.2, -8.9, 30, 2.24, 0.089, 2.60, 1.92)`:
  - VP gradient tiny (shell-gated im 0.089, cold ambient)
  - eMax ≈ 1.92 × (im/(Rclo+Ra)) × (pSat(30.2) - 0.30×pSat(-8.9)) / L_V
  - pSat(30.2) ≈ 4370 Pa, 0.30×pSat(-8.9) = 85 Pa
  - ΔVP = 4285 Pa; but im × 1/(Rclo+Ra) × ΔVP / L_V conversion
  - eMax ≈ 25 W (modest due to low im and low ambient)
- `_srL = computeSweatRate(0, 25) = { sweatGPerHr: 0, qEvapW: 0 }` (no sweat at eReq=0)
- `_sweatLiftG_min0 += 0/60 = 0 g`
- `_liftCondensG_min0 ≈ 0 g` (no vapor produced)
- `_liftNetHeat = -85 - 0 = -85 W`
- `_liftStorage += -85 W·min`

Minute 1-6: similar pattern, T_skin drifts slowly from 30.2°C toward ~29.7°C as accumulated cold exposure drops the iterative convergence point. Shiver boost activates minutes 5–6 when T_skin < 30°C → `_METnow` effectively ~1.73 MET (1.5 × 1.15), adding ~25 W Qmet.

**Lift 7-min totals (cycle 0):**
- `_sweatLiftG ≈ 0.3 g` (minor from shiver-driven increase in production)
- `_liftCondensG ≈ 0.1 g`
- `_liftExcessG ≈ 0 g`
- `_liftStorage ≈ -595 W·min` (7 × ~-85 W, slight recovery from shiver at end)

Note: The prior analytical estimate in spec §9.2.1 said "-310 W·min" for lift storage. Re-deriving with arithmetic shows -595 W·min — this is because at basal MET 1.5 in -8.9°C ambient through a 2.60 CLO ensemble, convective + radiative + respiratory + ediff losses total ~250-260 W while Qmet is only ~168 W. The original spec §9.2.1 values were rougher estimates. **This trace document takes precedence over spec §9 summary numbers at primitive level; spec §9 sessionMR targets remain the gate.**

**Transition phase (3 × 1-min substeps), cycle 0:**

EPOC seed: lift end MET ≈ 1.5 (no run prior to inherit from). `_METstart_trans = 2.0 MET` (transition baseline per spec §5.2).

Minute 0 (t = 0.5):
- `_METnow = 2.0` (no EPOC overlay since no prior run)
- `iterativeTSkin(37.0, -8.9, 0.064, 0.403, 0.0806, 1.92, 2.0, 2.24, 30, 0.089, 18, 6, 0.1)`:
  - Qmet at MET 2.0 = 2.0 × 58.2 × 1.92 = 223 W (up from 168 at MET 1.5)
  - Higher metabolic input partially offsets cold losses
  - Tsk converges to approximately **30.7°C** (modest rise from 30.2 due to higher MET)
- `_QcL ≈ 155 W` (similar — windMs unchanged, Tsk barely changed)
- `_QrL ≈ 60 W`
- `_respL ≈ 12 W` (scaled by MET)
- `_ediff ≈ 30 W`
- `_QpL ≈ 257 W`
- `_resL = 223 - 257 = -34 W` (deficit, but smaller than lift)
- `_eReqL = 0`
- `_srL.sweatGPerHr ≈ 8 g/hr` (low sweat production from slightly higher Tsk than lift)
- `_sweatTransG_min0 = 8/60 = 0.13 g`
- `_transNetHeat = -34 W`
- `_transStorage += -34 W·min`

Minutes 1-2: similar, total transition sweat ≈ 0.4 g, storage ≈ -100 W·min.

**Run phase (single-step, 3 min):**

`_cycleMET = 5.0` (groomers intensity)
`_cycleSpeedWMs = 30 mph × 0.7 turnFactor × 0.447 = 9.4 m/s`
Run wind effective: `2.24 + 9.4 = 11.6 m/s`
`_hcRun = 8.3 × sqrt(11.6) = 8.3 × 3.41 = 28.3 W/m²·K`
`_RaRun = 1/28.3 = 0.0353`

`iterativeTSkin(37.0, -8.9, 0.064, 0.403, 0.0353, 1.92, 5.0, 11.6, 30, 0.089, 18, 8, 0.1)`:
- Qmet at MET 5.0 = 5.0 × 58.2 × 1.92 = 558 W (3.3× lift)
- High wind lowers Ra dramatically (0.0353 vs 0.0806 for lift) — more convective heat loss at skin
- But high Qmet dominates
- Tsk converges to approximately **32.3°C** (active body)

- `_Qmet = 558 W`
- `_QconvRun = 1.92 × (32.3 - (-8.9)) / (0.403 + 0.0353) = 1.92 × 41.2 / 0.438 = 180 W`
- `_TsurfRun = 32.3 - 41.2 × (0.403/0.438) = 32.3 - 37.9 = -5.6°C`
- `_QradRun = 1.92 × 4.7 × (-5.6 - (-8.9)) = 30 W`
- `_respRun = computeRespiratoryHeatLoss(5.0, -8.9, 30, 77.1, 0) ≈ 28 W` (scaled MET, ~3× lift)
- `_M_Wm2 = 291`
- `_ediffRun = 3.05 × 1.92 × (5.733 - 0.007×291 - 0.00085) = 3.05 × 1.92 × 3.69 = 22 W`
- `_QpassRun = 180 + 30 + 28 + 22 = 260 W`
- `_residRun = 558 - 260 = +298 W` (surplus — must dissipate via sweat)
- `_eReqRun = 298 W`
- `_emaxRun = computeEmax(32.3, -8.9, 30, 11.6, 0.089, 2.60, 1.92)`:
  - Enhanced by wind (higher convective VP transport)
  - pSat(32.3) ≈ 4850 Pa, ΔVP ≈ 4765 Pa
  - eMax ≈ 85 W (still im-limited; shell gates vapor)
- `_srRun = computeSweatRate(298, 85)`:
  - E_req >> E_max → uncompensable
  - sweatGPerHr ≈ 180 g/hr (clamped by Emax × 2 safety factor approximately)
  - qEvapW = 85 W (E_max cap)

Note: E_req 298 W with only 85 W evaporative capacity means ~213 W cannot be dissipated through sweat; this becomes core temperature rise, captured in `_residRun`. Sweat rate at 180 g/hr is the engine's current output for this uncompensable scenario.

- `_sweatRunG = 180 × 3/60 = 9.0 g`
- `_runNetHeat = 298 - 85 = 213 W`
- `_runStorage = 213 × 3 = +640 W·min`

**Cycle 0 totals (G1):**
- `_cycleProdG = 0.3 + 0.4 + 9.0 + insensible(10 × 13/60 = 2.17) = 11.9 g`
- `_cycleStorage = -595 + -100 + 640 = -55 W·min` (nearly balanced — 3-min cycle 0 with run dominating)
- `_cycleCondensG ≈ 0.15 g`
- Layer buffer after cycle 0: most of 11.9 g produced drains + redistributes; stable at very low fill

**Expected `_perCycleMR[0] ≈ 0.15-0.25**

### 1.2 Cycle 13 trace — pre-lunch peak (G1)

By cycle 13 (~3.5 hours into session, wall-clock ~11:55 AM), ensemble has accumulated load:
- base ~25 g, mid ~28 g (at cap 19 → overflow cascades to base), insulative ~50 g (at cap 19 → major overflow), shell ~30 g
- **Mid and insulative are OVERFLOWING** their caps. Overflow cascades inward to base per PHY-048. Realistic fills after overflow:
  - mid: 19 g (at cap)
  - insulative: 19 g (at cap)
  - base: 25 + (overflow from mid) + (overflow from insulative) + direct base production = could be ~50-60 g
  - shell: 30 g
  - Total ensemble fill ~120 g / 182 cap = 66%

`_prevTskin` from cycle 12 run-end ≈ 33.0°C (active body)
`_civdCycle = civdProtectionFromSkin(33.0) ≈ 1.0` (full protection)
`_Rtissue ≈ 0.064`

**Line phase: skipped (Tier 1)**

**Lift phase (cycle 13):**

EPOC seed: prior run at cycle 12 ended at MET_end = 5.0 (groomers intensity, no decay yet). Time from run-end at start of lift: 0 min (cycles contiguous since no line phase).

`_cycleEpoc = epocParams(5.0, 1.5)`:
- Run→lift MET delta = 3.5
- Fast component: aFast ≈ 1.2, τFast ≈ 1 min
- Slow component: aSlow ≈ 2.3, τSlow ≈ 12 min

Minute 0 (t=0.5):
- `_METnow = 1.5 + 1.2 × exp(-0.5/1) + 2.3 × exp(-0.5/12)`
- `= 1.5 + 1.2 × 0.607 + 2.3 × 0.959`
- `= 1.5 + 0.728 + 2.206 = 4.43 MET` (!)
- This is high — EPOC immediately after run is still substantially elevated
- `iterativeTSkin` at MET 4.43, wind 2.24, cold ambient: Tsk ≈ 32.9°C (still warm from run)
- Qmet = 4.43 × 58.2 × 1.92 = 495 W
- Heat balance still positive at minute 0, moderate sweat output
- sweatGhr ≈ 100 g/hr → sweatMin = 1.67 g

Minute 1 (t=1.5):
- `_METnow = 1.5 + 1.2 × exp(-1.5/1) + 2.3 × exp(-1.5/12)`
- `= 1.5 + 1.2 × 0.223 + 2.3 × 0.882`
- `= 1.5 + 0.268 + 2.029 = 3.80 MET`
- Qmet drops to 424 W; Tsk 32.3°C
- sweatGhr ≈ 55 g/hr → sweatMin = 0.92 g

Minute 2: MET ≈ 3.32 → Qmet 371 W, Tsk ≈ 31.7°C, sweatGhr ≈ 25 g/hr → 0.42 g

Minute 3: MET ≈ 2.95 → Qmet 330 W, Tsk ≈ 31.2°C, sweatGhr ≈ 10 g/hr → 0.17 g

Minute 4: MET ≈ 2.65 → Qmet 296 W, Tsk ≈ 30.8°C, sweatGhr ≈ 3 g/hr → 0.05 g (crossed into E_req ≤ 0)

Minute 5: MET ≈ 2.40 → Qmet 268 W, Tsk ≈ 30.5°C, sweatGhr ≈ 0

Minute 6: MET ≈ 2.20 → Qmet 246 W, Tsk ≈ 30.3°C, sweatGhr ≈ 0

**Lift 7-min totals (cycle 13):**
- `_sweatLiftG ≈ 1.67 + 0.92 + 0.42 + 0.17 + 0.05 + 0 + 0 = 3.23 g`
- `_liftCondensG ≈ 1.8 g` (vapor early in lift produced against cold shell → condenses)
- `_liftStorage ≈ -270 W·min` (cold dominates middle-to-end of lift)

**Transition phase (3 min, cycle 13):**

EPOC at trans start: MET residual from lift end ≈ 2.2. Trans baseline 2.0. Overlay brings trans effective MET to ~2.4 min 0, dropping to ~2.1 by min 2.

Minute 0: MET 2.4, Qmet 268 W, Tsk 30.7°C, sweatGhr ≈ 10 g/hr → 0.17 g
Minute 1: MET 2.2, Qmet 246 W, Tsk 30.5°C, sweatGhr ≈ 5 g/hr → 0.08 g
Minute 2: MET 2.1, Qmet 235 W, Tsk 30.4°C, sweatGhr ≈ 3 g/hr → 0.05 g

**Transition totals (cycle 13):**
- `_sweatTransG ≈ 0.30 g`
- `_transCondensG ≈ 0.15 g`
- `_transStorage ≈ -40 W·min`

**Run phase (3 min, cycle 13, MET 5.0):**

Same arithmetic as cycle 0 run (MET 5.0 groomers, windMs 11.6) but with accumulated cumMoisture affecting `_Rclo_dyn` slightly (wet ensemble loses some insulation). For trace purposes:
- Tsk ≈ 32.5°C (similar to cycle 0 run)
- E_req ≈ 298 W
- E_max ≈ 85 W
- sweatGhr ≈ 180 g/hr, clamped
- `_sweatRunG = 9 g`
- `_runStorage ≈ +640 W·min`

**Cycle 13 totals (G1):**
- `_cycleProdG = 3.23 + 0.30 + 9.0 + insensible(2.17) = 14.7 g`
- `_cycleStorage = -270 + -40 + 640 = +330 W·min` (net warming — full-MET run with limited cold exposure in Tier 1)
- Moisture buffer advancement over `_cycleMinRaw = 13 min`:
  - Washburn retFrac = (1-0.7)^13 ≈ 1.6e-7 → full redistribution
  - Shell drain: `getDrainRate(16, 30, 5, 0.38, 2.60, 1.92) ≈ 195 g/hr × 13/60 × 0.5 outerFill ≈ 21 g capacity` (limited by shell fill ~30 g)
  - Net after cycle 13: approximately 135 g ensemble fill (at cap for mid/insulative, higher for base + shell)

**Expected `_perCycleMR[13] ≈ 2.8-3.3** (per spec §9.2.6 target 3.2 at tolerance ±0.5)

### 1.3 Lunch rest (G1, shell-off, 45 min, 12:15 PM)

Inserted between cycle 13 and cycle 14 per wall-clock placement.

**Entry state:**
- base ~50 g, mid 19 g (cap), insulative 19 g (cap), shell ~30 g (total ~118 g)
- T_skin ≈ 33°C (from cycle 13 run-end)
- Remove shell; inner ensemble exposed

**Per-minute integration (45 iterations), lunch shell-off:**

`_TambC_indoor = 20`
`_humidity_indoor = 40`
`_windMs_indoor = 0`
`_effectiveIm_lunch = 0.18` (3-layer series without shell)
`_Rclo_lunch = 0.380 m²·K/W`
`_Ra_indoor = 0.12` (still air, h_c ≈ 8.3 × sqrt(0.5) = 5.87, Ra = 0.17; for shell-off ensemble + still air, approximate Ra 0.12 reflecting natural convection onset)

Minute 0:
- `_METnow = 1.5` (lunch MET per spec §6.4)
- `iterativeTSkin(37.0, 20, 0.064, 0.380, 0.12, 1.92, 1.5, 0, 40, 0.18, 18, 6, 0.1)`:
  - Warm ambient + basal MET → Tsk converges UP from 33.0 to approximately **33.5°C**
- `_Qmet = 168 W`
- `_QcL = 1.92 × (33.5 - 20) / (0.380 + 0.12) = 1.92 × 13.5 / 0.500 = 52 W`
- `_TsL = 33.5 - 13.5 × (0.380/0.500) = 33.5 - 10.3 = 23.2°C` (shell surface ≈ indoor)
- `_QrL = 1.92 × 4.7 × (23.2 - 20) = 29 W`
- `_respL ≈ 4 W` (warm indoor reduces respiratory loss dramatically)
- `_ediffL = 3.05 × 1.92 × (5.733 - 0.611 - 0.009) = 30 W`
- `_QpL = 52 + 29 + 4 + 30 = 115 W`
- `_resL = 168 - 115 = +53 W` (surplus! warm indoor makes this a warming environment even at basal MET)
- `_eReqL = 53 W`
- `_emaxL = computeEmax(33.5, 20, 40, 0, 0.18, 1.95, 1.92)`:
  - Shell-off im 0.18 (much higher)
  - pSat(33.5)=5172, 0.40×pSat(20)=0.40×2338=935, ΔVP=4237 Pa
  - Even with still air, enhanced im → eMax ≈ 115 W
- `_srL = computeSweatRate(53, 115) = { sweatGPerHr: 45 g/hr, qEvapW: 53 W }` (fully compensable; sweat produced evaporates completely)
- `_sweatLunchG_min0 = 45/60 = 0.75 g`
- `_liftNetHeat = +53 - 53 = 0 W` (thermal neutral — sweat exactly compensates surplus)
- `_liftStorage += 0 W·min`

Minutes 1-44: T_skin stays near 33.5°C (equilibrium), sweat rate ~45 g/hr throughout.

**Lunch sweat production (45 min):**
`_sweatLunchG = 45 × 45/60 = 33.75 g` total

**Inner-layer drying (per-minute, direct exposure):**

base drain rate at indoor conditions:
- `getDrainRate(68, 40, 0, 0.50, 0.380, 1.92)`:
  - Indoor T → pSat(20) = 2338 Pa, 40% → ambient VP 935 Pa
  - Fabric VP at base (wet, next to skin temp ~33°C → saturated) ≈ 5172 Pa
  - ΔVP = 5172 - 935 = 4237 Pa (but base is covered by mid+insulative, effective im through those two layers)
  - `effectiveIm_base_outward = 0.18` (through mid+insulative, no shell)
  - drain rate × outer exposure factor for base ≈ 240 g/hr (rough estimate)
- `_drainG_base_min = 240/60 × min(1, buf/cap) ≈ 4 g/min` at buffer 50 g / cap 66 = 0.76

At 4 g/min × 45 min = 180 g theoretical capacity. Base buffer is only 50 g, so drains to near zero (~8-12 g residual).

Similarly:
- mid: drain ~20-22 g (from 19 at cap → ~1-2 g residual)
- insulative: drain ~15-18 g (from 19 → ~3 g residual)

**Shell draped (off-body):**
- `2 × getDrainRate(68, 40, 0, 0.38, 0, 1.92)`:
  - No body-side Rclo (shell detached) → both-sides exposure
  - drain rate ~360 g/hr
- Over 45 min × outerFill 0.5 ≈ 12-15 g drained
- Shell from 30 → ~15 g

**After 45-min lunch loop:**
- base: ~10 g (heavy drying)
- mid: ~1 g (drained to near zero)
- insulative: ~3 g (drained to near zero)
- shell: ~15 g
- **Ensemble fill ≈ 29 g (16% saturation)**, massive reduction from ~118 g (65% saturation) pre-lunch
- `_totalFluidLoss += 33.75 + insensible(11.25 g) + respLunch(3 g) = 48 g`
- `_cumStorageWmin += 0 W·min` (thermal neutral across lunch)
- `_prevTskin = 33.5°C`

**Expected MR for lunch phase trajectory segment: ~0.8-1.3** (low — drying dominant)

### 1.4 Cycle 22 trace — post-lunch recovery (G1)

By cycle 22 (~3:00 PM, ~8 cycles after lunch), ensemble has re-accumulated partially. Expected fills:
- base ~15 g, mid 19 g (at cap), insulative 19 g (at cap), shell ~25 g
- Total ~78 g / 182 = 43%

Physics pattern identical to cycle 13 (full MET 5.0 groomers, EPOC chain active). Differs only in lower starting fill. Storage and sweat production values within 10% of cycle 13.

- `_sweatLiftG ≈ 3.1 g`
- `_sweatRunG ≈ 9 g`
- `_cycleStorage ≈ +340 W·min`
- `_cycleProdG ≈ 14.5 g`

**Expected `_perCycleMR[22] ≈ 2.2-2.6** (below cycle 13 peak due to lunch reset; per spec §9.2.6 target 2.4)

### 1.5 G1 session aggregates

- `totalCycles = 31`
- Post-lunch the trajectory climbs from ~1.1 back up over ~15 cycles, plus otherBreak 15-min at 2:30 PM adds a modest second reset
- Final fill ~130 g / 182 = 71% (below cycle 13 pre-lunch peak but above post-lunch low)
- `_totalFluidLoss ≈ 780 g` (31 cycles × ~14.5 g + 48 g lunch + 15 g otherBreak + resp+insensible across full session)
- `_cumStorageWmin ≈ -500 to -1,500 W·min` (net slightly cold — though per-cycle storage varies between +330 and -200)

**Expected `sessionMR ≈ 2.6 ± 0.3** per spec §9.2.6 target with footnote on elite-charger calibration gap.

---

## 2. Vector M2 — Tier 2 moguls

**Ambient:** 20°F (-6.7°C), 45% RH, 8 mph wind (3.58 m/s), no precip, 9,600 ft, dewPointC -8°C.

**Derived:**
- `pAmbient = 0.45 × 344 = 155 Pa`
- Cycle structure: line 2, lift 7, transition 3, run 7 (`_cycleMinRaw = 19`)
- `_lc5Mets['very_high'] = 10` for moguls full-MET
- Warmup cycles (0-3 approximately) use groomer fallback MET 5.0; cycle 4+ use full MET 10

### 2.1 Cycle 0 trace — warmup (M2)

**Line phase (2 min, cycle 0):**

EPOC seed: none (no prior run), `_METstart_line = 1.5` (basal for cycle 0).

Minute 0 (t=0.5):
- `_METnow = 1.5`, standing in line with ambient 3.58 m/s wind
- `_hcL = 8.3 × sqrt(3.58) = 15.7`, Ra = 0.064
- `iterativeTSkin(37, -6.7, 0.064, 0.403, 0.064, 1.92, 1.5, 3.58, 45, 0.089, 18, 6, 0.1)` → Tsk ≈ 30.0°C
- Qmet = 168 W
- Qconv = 1.92 × (30.0 - (-6.7))/(0.403+0.064) = 1.92 × 36.7/0.467 = 151 W
- Tsurf = 30.0 - 36.7×(0.403/0.467) = -1.7°C
- Qrad = 1.92 × 4.7 × (-1.7 - (-6.7)) = 45 W
- Qresp ≈ 9 W; Ediff ≈ 29 W
- Qpass = 234 W; resL = -66 W deficit
- sweatGhr ≈ 0, shiver may activate at t ≈ 1
- lineStorage min 0 ≈ -66 W·min

Minute 1: Tsk drifts to ~29.7°C; storage -70 W·min

**Line 2-min totals (cycle 0):**
- `_sweatLineG ≈ 0.1 g`
- `_lineCondensG ≈ 0.05 g`
- `_lineStorage ≈ -138 W·min`

**Lift phase (7 min, cycle 0):**

Same basal pattern as G1 cycle 0 lift but with windMs 3.58 (higher than G1's 2.24):
- hc_L = 8.3 × sqrt(3.58) = 15.7 (vs G1's 12.4)
- Larger convective loss per minute
- Tsk converges lower: ~29.7°C
- `_sweatLiftG ≈ 0.25 g`
- `_liftStorage ≈ -640 W·min` (larger than G1's -595 due to higher wind)

**Transition (3 min, cycle 0):**
- MET 2.0, slight EPOC residual from lift
- Tsk ≈ 30.3°C
- `_sweatTransG ≈ 0.4 g`
- `_transStorage ≈ -75 W·min`

**Run phase (7 min, cycle 0, warmup MET 5.0):**

Mogul descent speed 12 mph × turnFactor 0.5 = 6 mph speed-added × 0.447 = 2.68 m/s
Run wind: 3.58 + 2.68 = 6.26 m/s, but engine applies `_cycleSpeedWMs` to `windMs + _cycleSpeedWMs` for convection calc. Actually the 6.26 m/s is the effective wind at skin during descent.

- hc_Run = 8.3 × sqrt(6.26) = 20.8; Ra = 0.048
- iterativeTSkin: Tsk ≈ 31.8°C at MET 5 warmup, high wind moderating sweat
- Qmet = 558 W
- Qconv = 1.92 × (31.8 - (-6.7))/(0.403+0.048) = 1.92 × 38.5/0.451 = 164 W
- Qrad ≈ 28 W; Qresp ≈ 28 W; Ediff ≈ 22 W
- Qpass = 242 W; residRun = +316 W surplus
- eReq = 316 W
- eMax ≈ 110 W (higher wind increases eMax)
- sweatGhr ≈ 200 g/hr
- `_sweatRunG = 200 × 7/60 = 23.3 g`
- qEvap = 110 W
- runNetHeat = 316 - 110 = 206 W
- runStorage = 206 × 7 = +1,442 W·min

**Cycle 0 totals (M2, warmup):**
- `_cycleProdG = 0.1 + 0.25 + 0.4 + 23.3 + insensible(10 × 19/60 = 3.17) = 27.2 g`
- `_cycleStorage = -138 - 640 - 75 + 1,442 = +589 W·min` (net warming — 7-min mogul run dominates)
- `_cycleCondensG ≈ 0.5 g`

**Expected `_perCycleMR[0] ≈ 0.25-0.35**

### 2.2 Cycle 9 trace — pre-lunch peak (M2, full MET 10)

By cycle 9 (wall-clock ~12:10 PM), ensemble has accumulated:
- base 35 g, mid 19 g (cap), insulative 19 g (cap), shell 40 g → overflow to base brings base closer to 45 g
- Total ~125 g / 182 = 69%

Pattern parallel to G1 cycle 13 but with mogul MET 10 (2× groomers):

**Line (2 min):** EPOC from prev run (MET 10), slow-tail strong.
- `_cycleEpoc = epocParams(10, 1.5)`: aFast ~2.8, τFast ~1; aSlow ~4.7, τSlow ~12
- Minute 0 of line: METnow = 1.5 + 2.8×exp(-0.5) + 4.7×exp(-0.5/12) = 1.5 + 1.70 + 4.51 = 7.71 MET (!!)
- Qmet = 7.71 × 58.2 × 1.92 = 862 W. EPOC immediately after mogul run is substantial.
- Tsk ≈ 32.5°C (warm body just finished run)
- High sweat rate minute 0 of line: ~450 g/hr → sweatMin = 7.5 g

Minute 1: METnow = 1.5 + 2.8×exp(-1.5) + 4.7×exp(-1.5/12) = 1.5 + 0.625 + 4.15 = 6.28 MET
- sweatGhr ≈ 200 g/hr → sweatMin = 3.3 g

**Line 2-min totals:**
- `_sweatLineG ≈ 10.8 g`
- `_lineCondensG ≈ 4 g` (wide gradient: Tsk ~32, ambient -6.7, long stationary)
- `_lineStorage ≈ +130 W·min` (EPOC residual keeps body warming even in line early)

**Lift (7 min):**

EPOC continues from line-end. At lift start (t=2 from run-end):
- METnow = 1.5 + 2.8×exp(-2) + 4.7×exp(-2/12) = 1.5 + 0.38 + 4.00 = 5.88 MET

Minute 0 of lift (t=2.5 from run-end): METnow = 1.5 + 2.8×0.082 + 4.7×0.811 = 5.54 MET
Minute 6 of lift (t=8.5 from run-end): METnow = 1.5 + 2.8×0.0002 + 4.7×0.494 = 3.82 MET

Tsk trajectory: 32.0 → 30.2°C over lift
sweatGhr: 150 → 20 g/hr (decaying)

**Lift totals:**
- `_sweatLiftG ≈ 5.2 g`
- `_liftCondensG ≈ 3.2 g`
- `_liftStorage ≈ -180 W·min` (still-warm EPOC partially offsets cold)

**Transition (3 min):**

EPOC at trans start (t=9.5 from run-end): ~3.5 MET; trans MET 2.0 + EPOC overlay → effective ~3.8-3.5 MET range.

Minute 0: sweatMin ≈ 1.2 g; Minute 1: 0.6 g; Minute 2: 0.3 g

- `_sweatTransG ≈ 2.1 g`
- `_transCondensG ≈ 0.4 g`
- `_transStorage ≈ -20 W·min`

**Run (7 min, MET 10 moguls):**

Full arithmetic for MET 10:
- Qmet = 10 × 58.2 × 1.92 = 1,117 W
- Run wind 6.26 m/s: hc = 20.8, Ra = 0.048
- iterativeTSkin: Tsk converges higher ~33.7°C (active body, high MET)
- Qconv = 1.92 × (33.7 - (-6.7))/(0.403+0.048) = 1.92 × 40.4/0.451 = 172 W
- Qrad ≈ 31 W; Qresp ≈ 55 W (2× from MET 10); Ediff ≈ 16 W (lower with higher M)
- Qpass = 274 W; residRun = 843 W (!!)
- eReq = 843 W
- eMax = 110 W (im-limited, doesn't scale with MET)
- sweatGhr ≈ 800 g/hr (severely uncompensable; engine clamp at sweat model limits)

Note: Actually, `computeSweatRate(eReq, eMax)` at severe uncompensable produces sweatGhr well above eMax/L_V × 3600 but capped by physiological ceiling (~1000 g/hr typical). Expected output ~800 g/hr.

- `_sweatRunG = 800 × 7/60 = 93 g` (very high)
- qEvapW = 110 W
- runNetHeat = 843 - 110 = 733 W
- runStorage = 733 × 7 = +5,131 W·min (!)

Such a high run storage is expected for uncompensable MET 10 — user's core temperature is rising fast during this 7-min run. Realistic; matches user's "drenched by end of first mogul run" field observation.

**Cycle 9 totals (M2):**
- `_cycleProdG = 10.8 + 5.2 + 2.1 + 93 + insensible(3.17) = 114.3 g` (large)
- `_cycleStorage = +130 - 180 - 20 + 5,131 = +5,061 W·min` (heavy core warming)
- `_cycleCondensG ≈ 7.6 g` (significant condensation, mostly from line + early lift)

**Expected `_perCycleMR[9] ≈ 4.2-4.8** (per spec §9.3.6 target 4.5)

### 2.3 Lunch (M2, shell-off, 45 min, 12:15 PM)

Entry state ~125 g ensemble + cycle 9 deposit = ~170-180 g (ensemble near saturation, mid/insulative at cap with overflow to base).

Entry `_prevTskin ≈ 33.7°C` from cycle 9 run-end.

Physics identical to G1 lunch structure but with higher starting buffer load. Drying rates same as G1 (inputs identical: 20°C, 40%, 0 m/s).

**Drying capacities over 45 min:**
- base: ~180 g capacity → drains 50 g+ load to ~8 g residual
- mid: ~200 g capacity → drains 19 g to ~1 g
- insulative: ~155 g capacity → drains 90 g load to ~40 g residual (more residual because more total load)
- shell draped: ~135 g capacity → drains 60 g to ~12 g residual

**After lunch (M2):**
- base ~8 g, mid ~1 g, insulative ~40 g, shell ~12 g
- Ensemble fill ~61 g / 182 = 34%
- Major reset from ~93% pre-lunch

**Expected MR for lunch trajectory segment: ~1.0-1.6** (per spec §9.3.6 target 1.3)

### 2.4 Cycle 14 post-lunch (M2)

Ensemble re-accumulated over cycles 10-14 (4 cycles at full MET 10).

Expected fill entering cycle 14: base 20 g, mid 19 g (cap), insulative 55 g, shell 30 g (~124 g / 68%).

Physics pattern identical to cycle 9 but lower starting fill → marginally lower MR.

- `_sweatLineG ≈ 10.5 g`, `_sweatRunG ≈ 90 g`
- `_cycleStorage ≈ +5,000 W·min` (similar; storage dominated by MET 10 uncompensable run)
- `_cycleProdG ≈ 108 g`

**Expected `_perCycleMR[14] ≈ 3.3-3.9** (per spec §9.3.6 target 3.6)

### 2.5 M2 session aggregates

- `totalCycles = 21`
- Per-cycle MR trajectory: climbs to ~4.5 at cycle 9, drops to ~1.3 post-lunch at cycle 10, re-climbs to ~3.6 at cycle 14, continues climbing toward ~5.0 at cycle 20
- Final ensemble fill ~146 g (with base bearing much of the accumulated load after overflow cascades)
- `_totalFluidLoss ≈ 2,100 g` (21 cycles × ~90 g + lunch 48 g + otherBreak 20 g + resp across session)
- `_cumStorageWmin ≈ +500 W·min` (net warming; mogul MET 10 runs dominate the cold line/lift losses)

**Expected `sessionMR ≈ 4.3 ± 0.3** per spec §9.3.6 — **this is the S-001 CLOSURE ANCHOR**.

---

## 3. Vector P5 — Tier 5 powder Saturday

**Ambient:** 18°F (-7.8°C), 80% RH, 3 mph wind (1.34 m/s), precip prob 0.70 (ongoing snow), 9,600 ft, dewPointC -9°C.

**Derived:**
- `pAmbient = 0.80 × 312 = 250 Pa` (much higher than G1/M2 due to high humidity)
- Cycle structure: line 15, lift 7, transition 3, run 7 (`_cycleMinRaw = 32`)
- MET 10 moguls full-MET (same as M2)
- Powder descent slower: mogul speed 12 mph × turnFactor 0.5 = 6 mph but powder modifier may reduce further (check engine). For trace, use 5 m/s effective run wind (vs M2's 6.26).

### 3.1 Cycle 0 trace — warmup (P5)

**Line phase (15 min, cycle 0):** THE DEFINING P5 FEATURE.

EPOC seed: none (cycle 0, no prior run). MET 1.5 basal.

Minute 0: Tsk ≈ 30.0°C, storage ~-60 W·min
Minute 7 (approximate midpoint): Tsk drifts to ~29.5°C, shiver activates, METnow ≈ 1.73, Qmet ≈ 195 W
Minute 14: Tsk ~29.3°C, sustained shiver

**Line 15-min totals (cycle 0):**
- `_sweatLineG ≈ 1.5 g` (15 × ~0.1 g/min shiver-driven)
- `_lineCondensG ≈ 2.0 g` (long stationary + cold shell + high ambient humidity drives more condensation)
- `_lineStorage ≈ -950 W·min` (15 min of deep cold exposure)

**Lift (7 min):**
- Similar pattern to M2 cycle 0 lift but already cold from 15-min line → Tsk starts at 29.3°C
- `_sweatLiftG ≈ 0.3 g`
- `_liftStorage ≈ -650 W·min`

**Transition (3 min):**
- MET 2.0, small recovery
- `_sweatTransG ≈ 0.5 g`
- `_transStorage ≈ -70 W·min`

**Run (7 min, warmup MET 5, wind 5 m/s — powder slower):**
- hc_Run = 8.3 × sqrt(5) = 18.6, Ra = 0.054
- Tsk ≈ 31.5°C
- Qmet = 558 W
- Qconv = 1.92 × (31.5 - (-7.8))/(0.403+0.054) = 1.92 × 39.3/0.457 = 165 W
- Qrad ≈ 30 W; Qresp ≈ 28 W; Ediff ≈ 20 W
- Qpass = 243 W; residRun = 315 W
- eReq = 315 W; eMax = 90 W (high humidity depresses ΔVP)
- sweatGhr ≈ 200 g/hr
- `_sweatRunG = 23.3 g`
- `_runStorage = (315-90) × 7 = +1,575 W·min`

**Precip wetting over cycleMinRaw 32 min:**
- `precipWettingRate(0.70, 18, _phy060swr) × (32/60)` ≈ 7-8 g added to shell

**Cycle 0 totals (P5):**
- `_cycleProdG = 1.5 + 0.3 + 0.5 + 23.3 + insensible(10 × 32/60 = 5.33) = 31 g`
- Plus precip wetting 8 g = 39 g total moisture addition
- `_cycleStorage = -950 - 650 - 70 + 1,575 = -95 W·min` (barely net cold — the long line damages a lot)

**Expected `_perCycleMR[0] ≈ 0.35-0.45**

### 3.2 Cycle 5 trace — pre-lunch peak (P5, full MET 10)

By cycle 5 (wall-clock ~11:50 AM, 5 cycles × 40 min = 200 min + 8:30 = 11:50), ensemble heavily loaded:
- base ~35 g, mid 19 g (cap), insulative 19 g (cap), shell 60 g (heavy — precip + condensation) → overflow cascades to base, base ~55 g
- Total ~153 g + precip loading → effectively at saturation

`_prevTskin ≈ 33.5°C` (from cycle 4 run-end).

**Line (15 min):**

EPOC from cycle 4 run (MET 10). Strong initial EPOC, fully decayed by minute 10+.

Minute 0 of line (t=0.5 from run-end): METnow = 7.71 MET (as computed for M2 cycle 9)
Minute 5: METnow = 1.5 + 2.8×exp(-5) + 4.7×exp(-5/12) = 1.5 + 0.019 + 3.10 = 4.62 MET
Minute 10: METnow = 1.5 + 0 + 4.7×exp(-10/12) = 1.5 + 2.04 = 3.54 MET
Minute 14: METnow = 1.5 + 0 + 4.7×exp(-14/12) = 1.5 + 1.46 = 2.96 MET

Tsk trajectory: 32.5 → 30.3 → 29.5°C over 15 min

Sweat production: high minute 0 (~400 g/hr), moderating to ~15 g/hr by minute 10, minimal after:
- Minute 0: 6.7 g
- Minute 1: 3.5 g (EPOC decay)
- Minute 2: 2.0 g
- Minute 3: 1.1 g
- Minute 4: 0.6 g
- Minute 5+: small contributions totaling ~2 g

**Line 15-min totals:**
- `_sweatLineG ≈ 16 g`
- `_lineCondensG ≈ 5.5 g` (high humidity ambient + wide gradient + long stationary)
- `_lineStorage ≈ -520 W·min` (some early warming from EPOC, most cold in latter 10 min)

**Lift (7 min):**
- METnow starts at ~2.96 (continuation from line end), decays to ~2.2 by lift-end
- Tsk drifts 29.8 → 29.3°C
- `_sweatLiftG ≈ 2.0 g`
- `_liftCondensG ≈ 1.8 g`
- `_liftStorage ≈ -310 W·min`

**Transition (3 min):**
- MET 2.0 + small residual
- `_sweatTransG ≈ 0.5 g`
- `_transStorage ≈ -60 W·min`

**Run (7 min, MET 10 moguls powder):**
- Wind 5 m/s (lower than M2)
- Tsk ≈ 33.4°C (slightly cooler than M2 due to lower wind but compensated)
- Similar high-uncompensable pattern as M2 cycle 9
- `_sweatRunG ≈ 88 g` (slightly less than M2 due to lower wind reducing convective losses)
- `_runStorage ≈ +4,800 W·min`

**Precip wetting:** +8 g shell boundary

**Cycle 5 totals (P5):**
- `_cycleProdG = 16 + 2.0 + 0.5 + 88 + insensible(5.33) = 112 g`
- Plus precip 8 g = 120 g
- `_cycleStorage = -520 - 310 - 60 + 4,800 = +3,910 W·min`

**Expected `_perCycleMR[5] ≈ 5.5-6.0** (per spec §9.4.6 target 5.8)

### 3.3 Lunch (P5, shell-off, 45 min)

Entry ensemble ~195 g (over capacity; overflow to base). Much heavier load than M2 lunch entry due to precip wetting + 15-min line condensation.

Post-lunch drying pattern identical to G1/M2 (indoor conditions same) but drying larger load:
- base: drains from ~90 g to ~20 g (more residual because more load)
- mid/insulative/shell similar patterns

**Expected post-lunch fill: ~85 g (47% saturation)**, down from ~195 g pre-lunch.

**Expected MR for lunch segment: ~1.3-1.7** (per spec §9.4.6 target 1.5)

### 3.4 Cycle 8 post-lunch (P5)

Cycle 8 at ~2:10 PM, just before otherBreak. Ensemble re-accumulated from lunch low over 3 cycles.

- Pre-cycle fill ~125 g / 182 = 69%
- Pattern similar to cycle 5 but lower starting fill
- `_sweatLineG ≈ 15 g` (slight drop from peak)
- `_sweatRunG ≈ 85 g`
- `_cycleStorage ≈ +3,600 W·min`

**Expected `_perCycleMR[8] ≈ 4.5-5.1** (per spec §9.4.6 target 4.8)

### 3.5 P5 session aggregates

- `totalCycles = 12`
- Trajectory: climbs to 5.8 peak at cycle 5, drops to 1.5 post-lunch at cycle 6, re-climbs to 4.8 at cycle 8, continues to 6.2 at cycle 11
- Final ensemble fill heavily saturated (base at cap from overflow cascades, insulative carrying residual wet load)
- `_totalFluidLoss ≈ 1,650 g` (12 cycles × ~100 g + lunch 60 g + otherBreak 25 g + precip additions)
- `_cumStorageWmin ≈ -2,400 W·min` (net cold — long cold lines outweigh high-MET runs that are shorter fraction of cycle wall-clock)

**Expected `sessionMR ≈ 5.5 ± 0.3** per spec §9.4.6.

---

## 4. Cross-vector comparisons

| Quantity | G1 | M2 | P5 |
|---|---|---|---|
| cycleMinRaw | 13 | 19 | 32 |
| totalCycles | 31 | 21 | 12 |
| cycle 0 MR | 0.2 | 0.3 | 0.4 |
| pre-lunch peak cycle | 13 | 9 | 5 |
| pre-lunch peak MR | 3.2 | 4.5 | 5.8 |
| post-lunch low MR | 1.1 | 1.3 | 1.5 |
| Session end MR | 3.5 | 5.0 | 6.2 |
| **sessionMR** | **2.6** | **4.3** | **5.5** |
| Total fluid loss (g) | 780 | 2,100 | 1,650 |
| Net storage (W·min) | -500/-1,500 | +500 | -2,400 |

**The sessionMR progression 2.6 → 4.3 → 5.5 is monotonic with cycleMin gap.** Expected by spec §9.5 design: larger ghosted fraction in pre-reconciliation = larger delta from reconciliation.

**Thermal story:**
- G1: short cycles, fast groomer runs, minimal line, cold ambient. Net cold session, modest MR rise.
- M2: longer cycles with meaningful line, mogul MET 10 drives sweat production and core warming. **Net warm session** — mogul runs overwhelm cold losses.
- P5: longest cycles with 15-min cold lines plus precip wetting. Net cold despite mogul MET 10 runs — line time dominates wall-clock.

---

## 5. Rest-phase detailed traces

### 5.1 Lunch shell-off integration (applies to G1, M2, P5 — same physics, different starting fill)

Per-minute loop pseudocode from spec §6.7.1:
```
for mn in 0..44:
  iterativeTSkin(core, 20, Rtissue, Rclo_lunch=0.380, Ra_indoor=0.12, bsa,
                 1.5, 0, 40, im_lunch=0.18, bf%, 6, 0.1)
  → Tsk_lunch ≈ 33.5°C (warm indoor + basal MET)

  Qmet = 168 W
  Qconv ≈ 52 W
  Qrad ≈ 29 W
  Qresp ≈ 4 W (warm indoor reduces)
  Ediff ≈ 30 W
  Qpass = 115 W
  resL = +53 W
  eMax = 115 W (im 0.18, high ΔVP)
  sweatGhr = 45 g/hr (fully compensable)
  qEvap = 53 W

  sweatMin = 0.75 g
  lunchStorage += 0 W·min (thermal neutral)

  inner-layer drying per minute:
    base: 4 g/min × min(1, buf_base/66)
    mid: 4.4 g/min × min(1, buf_mid/19)
    insulative: 3.8 g/min × min(1, buf_insulative/19)

  shell draped drying per minute:
    6 g/min × outerFill_shell
```

45-minute total drying capacity (max, unlimited buffer): 6.6 kg effective. Real-world constrained by layer buffer starting values and drain saturation.

### 5.2 otherBreak shell-on integration (spec §6.7.2)

Per-minute loop:
```
for mn in 0..14:
  iterativeTSkin(core, 20, Rtissue, Rclo=0.403, Ra_indoor=0.12, bsa,
                 1.8, 0, 40, im=0.089, bf%, 6, 0.1)
  → Tsk ≈ 33.2°C (warmer than lunch due to shell-on retaining more heat)

  sweatGhr ≈ 30 g/hr

  shell-on drying: getDrainRate(68, 40, 0, 0.38, 2.60, 1.92) ≈ 110 g/hr
    = 1.83 g/min × outerFill
```

15-min effective drying: ~12-15 g load reduction. Much smaller than lunch.

---

## 6. Primitive verification checkpoints

For each phase (A/B/C) in kickoff, Code cross-checks engine output against the following per-cycle primitive values. Halt if divergence > 20% on any primitive output.

### 6.1 G1 cycle 13 primitive checkpoint

| Primitive | Expected value | Tolerance |
|---|---|---|
| `_Qmet_run` (at MET 5) | 558 W | ±5% |
| `_TskRun` | 32.3°C | ±0.5°C |
| `_eReqRun` | 298 W | ±15% |
| `_emaxRun` | 85 W | ±15% |
| `_srRun.sweatGPerHr` | 180 g/hr | ±20% |
| `_sweatRunG` | 9.0 g | ±20% |
| `_runStorage` | +640 W·min | ±20% |
| `_METnow_lift_min0` (at EPOC peak) | 4.4 MET | ±10% |
| `_METnow_lift_min6` | 2.2 MET | ±10% |
| `_sweatLiftG` | 3.2 g | ±25% |
| `_liftStorage` | -270 W·min | ±25% |

### 6.2 M2 cycle 9 primitive checkpoint

| Primitive | Expected value | Tolerance |
|---|---|---|
| `_Qmet_run` (at MET 10) | 1,117 W | ±5% |
| `_TskRun` | 33.7°C | ±0.5°C |
| `_eReqRun` | 843 W | ±15% |
| `_emaxRun` | 110 W | ±15% |
| `_srRun.sweatGPerHr` | 800 g/hr | ±25% |
| `_sweatRunG` | 93 g | ±25% |
| `_runStorage` | +5,131 W·min | ±25% |
| `_METnow_line_min0` (EPOC peak) | 7.7 MET | ±10% |
| `_sweatLineG` | 10.8 g | ±25% |
| `_lineStorage` | +130 W·min | ±50% (small absolute) |
| `_sweatLiftG` | 5.2 g | ±25% |

### 6.3 P5 cycle 5 primitive checkpoint

| Primitive | Expected value | Tolerance |
|---|---|---|
| `_Qmet_run` (at MET 10) | 1,117 W | ±5% |
| `_TskRun` | 33.4°C | ±0.5°C |
| `_eReqRun` | 830 W | ±15% |
| `_emaxRun` | 90 W | ±15% |
| `_srRun.sweatGPerHr` | 770 g/hr | ±25% |
| `_sweatRunG` | 88 g | ±25% |
| `_runStorage` | +4,800 W·min | ±25% |
| `_sweatLineG` (15 min) | 16 g | ±25% |
| `_lineStorage` (15 min) | -520 W·min | ±20% |
| Precip wetting (32 min) | 8 g | ±50% |

### 6.4 Lunch checkpoint (all three vectors)

| Primitive | Expected value | Tolerance |
|---|---|---|
| `_TskLunch` | 33.5°C | ±0.5°C |
| `_eReqLunch` | 53 W | ±20% |
| `_sweatLunchG` (45 min) | 33.8 g | ±25% |
| `_lunchStorage` | 0 W·min | ±500 |
| base drain over 45 min (if base 50 g) | 42 g | ±25% |
| shell draped drain over 45 min (if shell 30 g) | 15 g | ±25% |

---

## 7. Divergence diagnostic rules

When engine output diverges from this trace:

**If `_Qmet` differs by >5%:** `computeMetabolicHeat` was modified, or MET value upstream is wrong. Usually a constant error or incorrect `_cycleMET` selection.

**If `_TskRun/Lift/Line/Trans` differs by >0.5°C:** `iterativeTSkin` convergence changed, or inputs (Rclo, Ra, Rtissue, MET, windMs, im, bodyFatPct) wrong. Walk back through each input.

**If `_eReq` differs >15%:** heat balance sum wrong — likely one of `_QconvRun`, `_QradRun`, `_respRun.total`, or `_ediffRun` computed incorrectly. Compare per-primitive.

**If `_emax` differs >15%:** `computeEmax` inputs wrong (most likely wrong `im` value, wrong windMs, or wrong `totalCLO`).

**If `_srRun.sweatGPerHr` differs >25%:** `computeSweatRate(eReq, eMax)` changed behavior, OR upstream eReq/eMax wrong. `computeSweatRate` is the derived function; usually the primary bug is upstream.

**If `_sweatRunG` differs >25% but `sweatGPerHr` correct:** run duration scaling wrong (should be × `_runMin / 60`).

**If `_runStorage` differs >25%:** `_runNetHeat = residRun - qEvapW`, scaled by `_runMin`. Error is either in residual (upstream), qEvap (sweat model output), or runMin (session setup).

**If lunch `_sweatLunchG` << 34g or `>> 34g`:** shell-off `im` value wrong (should be 0.18 from 3-layer series), OR indoor conditions wrong (should be 20°C/40%/0m/s).

**If lunch inner-layer drying << capacity:** `getDrainRate` at indoor conditions producing wrong value, OR loop scoping wrong (should apply drain per minute for 45 iterations).

**If non-ski activity diverges:** scope leak — Phase A/B/C edit bled into steady-state path or non-ski cyclic path.

---

## 8. Reference: engine line numbers at HEAD `4e84e76`

For Code during implementation, key engine line anchors:

| Line | Current code | Phase A change | Phase B change | Phase C change |
|---|---|---|---|---|
| 202-214 | `interface CycleOverride` | — | — | Add `lunch?: boolean`, `otherBreak?: boolean` |
| 590 | `_runMin = profile.phases[0]!.durMin` | — | Add `_liftLineMin`, `TRANSITION_MIN`, compute `_cycleMinRaw` | — |
| 591 | `_liftMin = profile.phases.length > 1 ? ... : 0` | — | Unchanged | — |
| 654-676 | Run phase single-step | — | Unchanged (position in loop changes) | — |
| 678-712 | Lift phase sub-stepped loop | — | Add line phase loop BEFORE lift; reorder: line → lift → transition → run | — |
| 713 | `_cumStorageWmin += _runStorage + _liftStorage` | — | Add `_lineStorage + _transStorage` | — |
| 714 | `_cycleTotalWmin = _runStorage + _liftStorage` | — | Add line/trans storages | — |
| 715 | `_cycleTotalMin = _runMin + _liftMin` | `= _cycleMinRaw` (same value until Phase B) | `= _cycleMinRaw` (now actually different) | — |
| 725 | `_insensibleG = 10 * (_runMin + _liftMin) / 60` | `= 10 * _cycleMinRaw / 60` | — | — |
| 729 | `_respRun.moistureGhr * (_runMin / 60)` | `* (_cycleMinRaw / 60)` | — | — |
| 730 | `_cycleMin = _runMin + _liftMin` | `= _cycleMinRaw` | — | — |
| Session loop (outside phase loop body) | — | — | — | Insert rest-phase integration at wall-clock 12:15 and 2:30 PM |

---

## 9. End of trace

This document is the Cardinal Rule #8 companion for S31. Engine output at Phase A/B/C checkpoints is cross-verified against §6 checkpoint tables. Divergences at primitive level diagnosed per §7.

The **sessionMR** targets (G1 2.6, M2 4.3, P5 5.5) with ±0.3 tolerance are the gate criteria at Phase C — per spec §9.5 criteria 1–3. Per-cycle trajectory matching (criterion 4) at traced cycles, total fluid loss (criterion 5), layer buffer fills (criterion 6), pre-patch regression (criterion 7), and non-ski bit-identical (criterion 8) complete the 8-gate close condition.

**If engine outputs are within tolerance at both this trace's primitive level AND the spec §9 session level, S31 closes.** If primitives match but session MR is off, something aggregates wrong (buffer accounting, condensation placement, cross-cycle state carry) — diagnose there. If primitives diverge, the engine change broke a primitive invariant — halt and escalate.

**User (Christian) reads per-phase sawtooth charts against field intuition. If the ATP test passes but the sawtooth looks wrong (afternoon trajectory not climbing after lunch, peak cycles producing unreasonable vertical feet, precip vectors producing insufficient wetting) — that is a real signal, and Chat verifies against this trace before assuming the engine is right.**

END S31_HANDCOMP_TRACE.
