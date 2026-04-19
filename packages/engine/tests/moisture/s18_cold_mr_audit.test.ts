// ============================================================================
// S18 COLD MR AUDIT — response curve for cold-weather high-CLO scenarios
// packages/engine/tests/moisture/s18_cold_mr_audit.test.ts
//
// PURPOSE: Christian's hypothesis — MR may be under-reading cold scenarios
// with high CLO. Physics says: cold + high CLO = trapped sweat because
//   (1) CLO feedback → more sweat
//   (2) thick kit → high vapor resistance
//   (3) cold layer boundaries → condensation (Yoo & Kim)
//
// METHOD: call calcIntermittentMoisture DIRECTLY (bypass evaluate() so we
// isolate moisture physics from ensemble selection / strategy winner).
// Fixed conditions (16°F / 40%RH / 8mph / 6hr / skiing groomers).
// Vary CLO × ensembleIm. Watch what MR does.
//
// NOT a pass/fail test. Prints tables for human judgment.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { calcIntermittentMoisture } from '../../src/moisture/calc_intermittent_moisture.js';

describe('S18 Cold MR Audit — CLO x im response curve', () => {

  it('Breck-conditions response matrix', () => {
    const TEMP_F = 16;
    const RH = 40;
    const WIND = 8;
    const DURATION_HR = 6;
    const ACTIVITY = 'skiing';
    const TERRAIN = 'groomers';

    const CLOs = [2.0, 3.0, 3.4, 4.0, 5.0];
    const IMs = [0.10, 0.15, 0.20, 0.25, 0.30];

    console.log('\n');
    console.log('='.repeat(100));
    console.log('S18 COLD MR AUDIT — Breck conditions, varying CLO and ensembleIm');
    console.log(`Fixed: ${TEMP_F}°F, ${RH}% RH, ${WIND} mph, ${DURATION_HR}hr, ${ACTIVITY} on ${TERRAIN}`);
    console.log('='.repeat(100));
    console.log('');
    console.log('sessionMR as function of CLO (rows) and ensembleIm (cols):');
    console.log('');

    // Header
    let header = '  CLO ↓ / im →'.padEnd(16);
    for (const im of IMs) header += im.toFixed(2).padStart(10);
    console.log(header);

    const rows: Array<{clo: number; results: Array<{im: number; mr: number; trapped: number; fluidLoss: number; peakSat: number}>}> = [];

    for (const clo of CLOs) {
      const row: {clo: number; results: Array<{im: number; mr: number; trapped: number; fluidLoss: number; peakSat: number}>} = {clo, results: []};
      let rowStr = ('  CLO=' + clo.toFixed(1)).padEnd(16);

      for (const im of IMs) {
        const r = calcIntermittentMoisture(
          ACTIVITY, TEMP_F, RH, WIND, DURATION_HR,
          'male', 170, 1.0,
          im,           // ensembleIm
          TERRAIN,
          null, false, 0, false, 1.0,
          null, null, 'moderate', null, 3, null, 0,
          clo,          // totalCLOoverride
          null, null, 0, null,
        );
        row.results.push({
          im,
          mr: r.sessionMR,
          trapped: r.trapped,
          fluidLoss: r.totalFluidLoss ?? 0,
          peakSat: r.peakSaturationFrac ?? 0,
        });
        rowStr += r.sessionMR.toFixed(2).padStart(10);
      }
      rows.push(row);
      console.log(rowStr);
    }

    console.log('');
    console.log('─'.repeat(100));
    console.log('DETAIL per cell — trapped (L), totalFluidLoss (mL), peakSaturationFrac:');
    console.log('─'.repeat(100));

    for (const row of rows) {
      console.log(`\nCLO=${row.clo.toFixed(1)}:`);
      for (const cell of row.results) {
        console.log(
          `  im=${cell.im.toFixed(2)}  MR=${cell.mr.toFixed(2)}` +
          `  trapped=${cell.trapped.toFixed(3)}L` +
          `  fluidLoss=${cell.fluidLoss.toFixed(0)}mL` +
          `  peakSat=${(cell.peakSat * 100).toFixed(1)}%`
        );
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('WHAT TO LOOK FOR:');
    console.log('  1. Does MR climb monotonically as CLO increases (at fixed im)?');
    console.log('  2. Does MR climb monotonically as im decreases (at fixed CLO)?');
    console.log('  3. Does MR ever exceed 5 for CLO=5.0 + im=0.10 (extreme case)?');
    console.log('  4. Do trapped/fluidLoss/peakSat scale with MR?');
    console.log('='.repeat(100));

    // Sanity: no NaN, all in range
    for (const row of rows) {
      for (const cell of row.results) {
        expect(Number.isFinite(cell.mr)).toBe(true);
        expect(cell.mr).toBeGreaterThanOrEqual(0);
        expect(cell.mr).toBeLessThanOrEqual(10);
      }
    }
  });

  it('Per-cycle trajectory for one hand-picked worst-case', () => {
    // CLO=5.0, im=0.10 — expected worst case from the matrix above
    const r = calcIntermittentMoisture(
      'skiing', 16, 40, 8, 6,
      'male', 170, 1.0,
      0.10,      // ensembleIm
      'groomers',
      null, false, 0, false, 1.0,
      null, null, 'moderate', null, 3, null, 0,
      5.0,       // totalCLOoverride
      null, null, 0, null,
    );

    console.log('\n');
    console.log('='.repeat(100));
    console.log('PER-CYCLE TRAJECTORY — worst case (CLO=5.0, im=0.10)');
    console.log('='.repeat(100));
    console.log(`sessionMR: ${r.sessionMR}`);
    console.log(`trapped (total): ${r.trapped.toFixed(4)} L`);
    console.log(`totalFluidLoss: ${r.totalFluidLoss?.toFixed(0) ?? 'n/a'} mL`);
    console.log(`peakSaturationFrac: ${((r.peakSaturationFrac ?? 0) * 100).toFixed(1)}%`);
    console.log(`totalRuns: ${r.totalRuns}`);
    console.log(`goodRunCount: ${r.goodRunCount}`);
    console.log(`yellowRunCount: ${r.yellowRunCount}`);
    console.log(`peakHeatBalanceW: ${r.peakHeatBalanceW?.toFixed(1) ?? 'n/a'}W (${r.peakHeatBalanceDirection})`);
    console.log('');
    console.log('Per-cycle MR trajectory:');
    const mrs = r.perCycleMR ?? [];
    const trs = r.perCycleTrapped ?? [];
    for (let i = 0; i < mrs.length; i++) {
      const mr = mrs[i] ?? 0;
      const tr = trs[i] ?? 0;
      const bar = '█'.repeat(Math.min(50, Math.round(mr * 5)));
      console.log(`  cycle ${String(i+1).padStart(2)}: MR=${mr.toFixed(2).padStart(5)}  trap=${tr.toFixed(3)}L  ${bar}`);
    }
    console.log('');
    if (r.endingLayers) {
      console.log('Ending per-layer buffers (buffer / cap = fill%):');
      for (let i = 0; i < r.endingLayers.length; i++) {
        const l = r.endingLayers[i]!;
        const fill = l.cap > 0 ? (l.buffer / l.cap * 100) : 0;
        console.log(`  layer ${i}: buffer=${l.buffer.toFixed(1)}mL  cap=${l.cap.toFixed(1)}mL  fill=${fill.toFixed(1)}%  im=${l.im?.toFixed(3) ?? 'n/a'}`);
      }
    } else {
      console.log('(endingLayers not available)');
    }
    console.log('='.repeat(100));

    expect(Number.isFinite(r.sessionMR)).toBe(true);
  });

});
