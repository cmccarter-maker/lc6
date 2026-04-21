// ============================================================================
// S-001 iterativeTSkin direct-probe — diagnostic, NOT part of assertion suite
// packages/engine/tests/diagnostics/s001_iterative_tskin_probe.test.ts
//
// PURPOSE: call iterativeTSkin directly with engine-matched cycle-0 inputs
// for S-001 Breckenridge. Read E_req + E_actual from the existing return
// shape (already exposed; no signature or return-type change). Recompute
// the Gagge two-node heat-balance components EXTERNALLY using the same
// formulas + constants the solver uses internally — no engine-file edits.
//
// Goal: isolate which layer of the pipeline produces the 76 mL/hr sweat
// rate observed in the S-001 baseline diagnostic (c423659).
//
// Two probes: run phase (skiing descent, MET=8) and lift phase (MET=1.5).
// Logs inputs, solver result, Gagge decomposition, and external sweat rate.
// No assertions.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { iterativeTSkin, duboisBSA } from '../../src/heat_balance/body_thermo.js';
import { computeEmax, computeSweatRate } from '../../src/heat_balance/evaporation.js';
import {
  GAGGE_MECHANICAL_WORK_FRACTION,
  H_RAD_LINEARIZED,
  LC5_T_CORE_BASE,
} from '../../src/heat_balance/constants.js';
import { descentSpeedWind } from '../../src/activities/descent.js';

describe('S-001 iterativeTSkin direct-probe (cycle 0)', () => {
  it('logs thermal solver state for run + lift phases with Gagge decomposition (no assertions)', () => {
    // ====== S-001 scenario ======
    const TEMP_F = 16;
    const HUMIDITY = 40;           // percent
    const WIND_MPH = 8;
    const WEIGHT_LB = 180;

    // ====== Engine-matched cycle-0 inputs ======
    // Tcore: at cycle 0, _cumStorageWmin = 0 → coreTemp = LC5_T_CORE_BASE = 37.0
    const Tcore = LC5_T_CORE_BASE;
    // TambC: (16 - 32) × 5/9 = -8.89
    const TambC = (TEMP_F - 32) * 5 / 9;
    // BSA: duboisBSA(180) via engine helper
    const bsa = duboisBSA(WEIGHT_LB);
    // Rtissue: engine uses computeRtissueFromCIVD(civdProtectionFromSkin(33.7)) at cycle 0
    //   with the seed T_skin = 33.7 Gagge-neutral. Hard-coded external estimate here
    //   for the probe (0.027 m²·K/W ≈ 18% BF male standard approximation).
    //   THIS IS THE ONE DELIBERATE INPUT DEVIATION FROM ENGINE-MATCHED.
    const Rtissue = 0.027;
    // totalCLO: sum of warmthToCLO(warmthRatio) across 4-layer S-001 ensemble
    //   [base=1.60, mid=1.30, insul=1.30, shell=0.10] = 4.30
    const totalCLO = 4.30;
    // RcloInit: at cycle 0, sat=0, _cloDeg = 1.0 - 0×0.4 = 1.0
    //   → _Rclo = totalCLO × 0.155 × 1.0 = 0.6665
    const RcloInit = totalCLO * 0.155 * 1.0;
    // Wind components:
    //   _windMs = WIND_MPH × 0.44704 = 3.58 m/s (ambient)
    //   _speedWindMs = descentSpeedWind('groomers') × 0.44704 × turnFactor
    //     descentSpeedWind('groomers') = { speed: 30, turnFactor: 0.7 }
    //     = 30 × 0.7 × 0.44704 = 9.39 m/s (descent-derived air speed over body)
    //   Engine at cycle 0 uses _speedWindMs directly (assumes not in warmup).
    //   Run-phase wind = _windMs + _speedWindMs = 3.58 + 9.39 = 12.97 m/s
    //   Lift-phase wind = _windMs alone = 3.58 m/s
    const windMs_ambient = WIND_MPH * 0.44704;
    const dsw = descentSpeedWind('groomers');
    const speedWindMs = dsw.speed * dsw.turnFactor * 0.44704;
    const windMs_run = windMs_ambient + speedWindMs;
    const windMs_lift = windMs_ambient;
    // Rair: 1 / hc, hc = 8.3 × sqrt(max(0.5, windMs))
    const hcRun = 8.3 * Math.sqrt(Math.max(0.5, windMs_run));
    const hcLift = 8.3 * Math.sqrt(Math.max(0.5, windMs_lift));
    const RairRun = 1 / hcRun;
    const RairLift = 1 / hcLift;
    // MET: engine uses _lc5Mets[profile intensity]
    //   skiing run phase intensity = 'high' → MET = 8
    //   lift phase intensity = 'low' → MET = 1.5
    const METrun = 8.0;
    const METlift = 1.5;
    // imEnsemble: engine uses _effectiveIm = snowSportSplitIm(0.22) at runtime.
    //   For diagnostic we pass 0.22 directly (the split produces a related value,
    //   minor deviation from engine-exact). This is second deliberate approximation.
    const imEnsemble = 0.22;
    // bodyFatPct: engine default when no fitnessProfile provided → 20
    //   (documented as currently unused in solver per body_thermo.ts comment,
    //   preserved in signature per LC5 compat)
    const bodyFatPct = 20;

    // ====== Invoke iterativeTSkin for both phases ======
    const runResult = iterativeTSkin(
      Tcore, TambC, Rtissue, RcloInit, RairRun, bsa,
      METrun, windMs_run, HUMIDITY, imEnsemble, bodyFatPct, 8, 0.1,
    );
    const liftResult = iterativeTSkin(
      Tcore, TambC, Rtissue, RcloInit, RairLift, bsa,
      METlift, windMs_lift, HUMIDITY, imEnsemble, bodyFatPct, 6, 0.1,
    );

    // ====== External Gagge decomposition (same formulas the solver uses internally) ======
    // Uses the CONVERGED T_skin from the solver to recompute what went into E_req.

    // -- Run phase --
    const TskRun = runResult.T_skin;
    const Mrun = METrun * 58.2 * bsa;                       // metabolic heat production (W)
    const Wrun = Mrun * GAGGE_MECHANICAL_WORK_FRACTION;     // mechanical work (W)
    const TclRun = TskRun - (TskRun - TambC) * (RcloInit / (RcloInit + RairRun));
    const QconvRun = bsa * hcRun * (TclRun - TambC);
    const QradRun = bsa * H_RAD_LINEARIZED * (TclRun - TambC);
    const ErespRun = 0.017 * Mrun * (5.87 - (HUMIDITY / 100) * 0.611 * Math.exp(17.27 * TambC / (TambC + 237.3)))
                   + 0.0014 * Mrun * (34 - TambC);
    const sumLossesRun = QconvRun + QradRun + ErespRun;
    const netForEvapRun = Math.max(0, (Mrun - Wrun) - sumLossesRun);

    // -- Lift phase --
    const TskLift = liftResult.T_skin;
    const Mlift = METlift * 58.2 * bsa;
    const Wlift = Mlift * GAGGE_MECHANICAL_WORK_FRACTION;
    const TclLift = TskLift - (TskLift - TambC) * (RcloInit / (RcloInit + RairLift));
    const QconvLift = bsa * hcLift * (TclLift - TambC);
    const QradLift = bsa * H_RAD_LINEARIZED * (TclLift - TambC);
    const ErespLift = 0.017 * Mlift * (5.87 - (HUMIDITY / 100) * 0.611 * Math.exp(17.27 * TambC / (TambC + 237.3)))
                    + 0.0014 * Mlift * (34 - TambC);
    const sumLossesLift = QconvLift + QradLift + ErespLift;
    const netForEvapLift = Math.max(0, (Mlift - Wlift) - sumLossesLift);

    // ====== External computeSweatRate via the solver's E_req + fresh E_max ======
    const emaxRun = computeEmax(TskRun, TambC, HUMIDITY, windMs_run, imEnsemble, totalCLO, bsa);
    const emaxLift = computeEmax(TskLift, TambC, HUMIDITY, windMs_lift, imEnsemble, totalCLO, bsa);
    const swRun = computeSweatRate(runResult.E_req, emaxRun.eMax);
    const swLift = computeSweatRate(liftResult.E_req, emaxLift.eMax);

    // ====== Emit diagnostic log ======
    console.log('\n');
    console.log('='.repeat(80));
    console.log('=== iterativeTSkin direct-probe for S-001 cycle 0 ===');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Scenario: ${TEMP_F}°F / ${HUMIDITY}% RH / ${WIND_MPH} mph ambient wind, skiing groomers`);
    console.log(`Weight: ${WEIGHT_LB} lb   BSA: ${bsa.toFixed(3)} m² (duboisBSA)`);
    console.log(`T_amb: ${TambC.toFixed(2)}°C`);
    console.log(`totalCLO: ${totalCLO}   RcloInit: ${RcloInit.toFixed(4)} m²·K/W   Rtissue: ${Rtissue} m²·K/W (external est, 18% BF)`);
    console.log(`descentSpeedWind('groomers'): speed=${dsw.speed} mph, turnFactor=${dsw.turnFactor} → ${speedWindMs.toFixed(2)} m/s effective descent component`);
    console.log(`Engine constants: GAGGE_MECHANICAL_WORK_FRACTION=${GAGGE_MECHANICAL_WORK_FRACTION}   H_RAD_LINEARIZED=${H_RAD_LINEARIZED}`);
    console.log('');

    // ── Run phase ──
    console.log('─'.repeat(80));
    console.log(`─── RUN PHASE (skiing descent, MET=${METrun}) ───`);
    console.log('─'.repeat(80));
    console.log('Inputs:');
    console.log(`  Tcore=${Tcore.toFixed(1)}°C  TambC=${TambC.toFixed(2)}°C  Rtissue=${Rtissue}  RcloInit=${RcloInit.toFixed(4)}  Rair=${RairRun.toFixed(4)}  BSA=${bsa.toFixed(3)}`);
    console.log(`  MET=${METrun}  windMs=${windMs_run.toFixed(2)} m/s (ambient ${windMs_ambient.toFixed(2)} + descent ${speedWindMs.toFixed(2)})`);
    console.log(`  RH=${HUMIDITY}   imEnsemble=${imEnsemble}   bodyFatPct=${bodyFatPct}`);
    console.log(`  hc=${hcRun.toFixed(2)} W/m²·K   he=${(16.5 * hcRun).toFixed(1)} W/m²·kPa (Lewis)`);
    console.log('');
    console.log('Solver result:');
    console.log(`  T_skin:       ${runResult.T_skin.toFixed(2)}°C     T_cl (computed): ${TclRun.toFixed(2)}°C`);
    console.log(`  E_req:        ${runResult.E_req.toFixed(1)} W      E_actual: ${runResult.E_actual.toFixed(1)} W`);
    console.log(`  vasodilation: ${runResult.vasodilation.toFixed(2)} W/(m²·K)   h_tissue: ${runResult.h_tissue.toFixed(2)} W/(m²·K)`);
    console.log(`  iterations:   ${runResult.iterations}   converged: ${runResult.converged}`);
    console.log('');
    console.log('Heat balance decomposition (Gagge two-node, recomputed with same formulas + constants):');
    console.log(`  M  (metabolic):     ${Mrun.toFixed(1)} W    (MET × 58.2 × BSA)`);
    console.log(`  W  (work, 10%):     ${Wrun.toFixed(1)} W    (M × GAGGE_MECHANICAL_WORK_FRACTION)`);
    console.log(`  M − W (net heat):   ${(Mrun - Wrun).toFixed(1)} W`);
    console.log(`  Qconv:              ${QconvRun.toFixed(1)} W    (BSA × hc × (T_cl − T_amb))`);
    console.log(`  Qrad:               ${QradRun.toFixed(1)} W    (BSA × 4.7 × (T_cl − T_amb))`);
    console.log(`  Eresp:              ${ErespRun.toFixed(1)} W    (ISO 7933 respiratory, latent + sensible)`);
    console.log(`  Sum losses:         ${sumLossesRun.toFixed(1)} W`);
    console.log(`  Net for evap:       ${netForEvapRun.toFixed(1)} W    (should match solver E_req=${runResult.E_req.toFixed(1)})`);
    console.log('');
    console.log('External computeSweatRate:');
    console.log(`  inputs: E_req=${runResult.E_req.toFixed(1)}W (from solver), E_max=${emaxRun.eMax.toFixed(1)}W (from computeEmax at solved T_skin)`);
    console.log(`  sweatGPerHr=${swRun.sweatGPerHr.toFixed(0)}   evapGPerHr=${swRun.evapGPerHr.toFixed(0)}   accumGPerHr=${swRun.accumGPerHr.toFixed(0)}`);
    console.log(`  wReq=${swRun.wReq.toFixed(2)}   qEvapW=${swRun.qEvapW.toFixed(1)}   regime=${swRun.regime}`);
    console.log('');

    // ── Lift phase ──
    console.log('─'.repeat(80));
    console.log(`─── LIFT PHASE (stationary on lift, MET=${METlift}) ───`);
    console.log('─'.repeat(80));
    console.log('Inputs:');
    console.log(`  Tcore=${Tcore.toFixed(1)}°C  TambC=${TambC.toFixed(2)}°C  Rtissue=${Rtissue}  RcloInit=${RcloInit.toFixed(4)}  Rair=${RairLift.toFixed(4)}  BSA=${bsa.toFixed(3)}`);
    console.log(`  MET=${METlift}  windMs=${windMs_lift.toFixed(2)} m/s (ambient only, no descent component)`);
    console.log(`  RH=${HUMIDITY}   imEnsemble=${imEnsemble}   bodyFatPct=${bodyFatPct}`);
    console.log(`  hc=${hcLift.toFixed(2)} W/m²·K`);
    console.log('');
    console.log('Solver result:');
    console.log(`  T_skin:       ${liftResult.T_skin.toFixed(2)}°C     T_cl (computed): ${TclLift.toFixed(2)}°C`);
    console.log(`  E_req:        ${liftResult.E_req.toFixed(1)} W      E_actual: ${liftResult.E_actual.toFixed(1)} W`);
    console.log(`  vasodilation: ${liftResult.vasodilation.toFixed(2)} W/(m²·K)   h_tissue: ${liftResult.h_tissue.toFixed(2)} W/(m²·K)`);
    console.log(`  iterations:   ${liftResult.iterations}   converged: ${liftResult.converged}`);
    console.log('');
    console.log('Heat balance decomposition:');
    console.log(`  M  (metabolic):     ${Mlift.toFixed(1)} W`);
    console.log(`  W  (work, 10%):     ${Wlift.toFixed(1)} W`);
    console.log(`  M − W (net heat):   ${(Mlift - Wlift).toFixed(1)} W`);
    console.log(`  Qconv:              ${QconvLift.toFixed(1)} W`);
    console.log(`  Qrad:               ${QradLift.toFixed(1)} W`);
    console.log(`  Eresp:              ${ErespLift.toFixed(1)} W`);
    console.log(`  Sum losses:         ${sumLossesLift.toFixed(1)} W`);
    console.log(`  Net for evap:       ${netForEvapLift.toFixed(1)} W    (should match solver E_req=${liftResult.E_req.toFixed(1)})`);
    console.log('');
    console.log('External computeSweatRate:');
    console.log(`  inputs: E_req=${liftResult.E_req.toFixed(1)}W, E_max=${emaxLift.eMax.toFixed(1)}W`);
    console.log(`  sweatGPerHr=${swLift.sweatGPerHr.toFixed(0)}   regime=${swLift.regime}   wReq=${swLift.wReq.toFixed(2)}`);
    console.log('');

    // ── Sanity guide ──
    console.log('='.repeat(80));
    console.log('Regime guide:');
    console.log('  E_req < 100W:   thermal balance already satisfied — little/no sweat needed');
    console.log('  E_req 100-400W: normal regulation, sweat in compensable range');
    console.log('  E_req > 400W:   uncompensable, heavy sweat expected');
    console.log('');
    console.log('Expected for alpine skiing MET=8 at 16°F with 4.3 CLO ensemble:');
    console.log('  User lived experience: heavy sweat, saturation in 3-5 hr → E_req should be ~300-500W');
    console.log('  S-001 baseline diagnostic (c423659): 76 mL/hr total fluid loss → E_req likely < 100W');
    console.log('='.repeat(80));
    console.log('');

    // No assertions — diagnostic only
    expect(runResult.T_skin).toBeDefined();
  });
});
