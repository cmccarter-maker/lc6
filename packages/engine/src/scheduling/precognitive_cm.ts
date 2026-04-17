// PHY-072: Precognitive Critical Moment optimizer
//
// Scans trip trajectory to identify PIVOTAL interventions that prevent
// cumulative damage (primarily MR > 4.0 cascade). Hard budget: max 3 CMs.
//
// Grounded in alarm fatigue research:
//   - Clinical evidence: 80-99% of ICU alarms are false → desensitization
//   - LayerCraft proactive + perception-lag design particularly vulnerable
//   - Every firing must be actionable AND pivotal (transforms trip, not just eases moment)

import type {
  TrajectoryPoint,
  CriticalMoment,
  StrategyWindow,
} from '../types.js';

const MR_CASCADE_THRESHOLD = 4.0;
const CDI_NAMED_IMPAIRMENT = 5;
const TSENS_SUSTAINED_DISCOMFORT = 3.0;

const SEVERITY_CASCADE = 3.0;
const SEVERITY_CDI_IMPAIRMENT = 5.0;
const SEVERITY_DISCOMFORT_SUSTAINED = 1.5;

export const MAX_CRITICAL_MOMENTS = 3;

export function identifyCriticalMoments(
  trajectory: TrajectoryPoint[],
): CriticalMoment[] {
  if (trajectory.length === 0) return [];

  const candidates: CriticalMoment[] = [];

  // Scan 1: MR cascade prevention
  const cascadeCrossIdx = trajectory.findIndex(p => p.MR >= MR_CASCADE_THRESHOLD);
  if (cascadeCrossIdx > 0) {
    const interventionIdx = Math.max(0, cascadeCrossIdx - 1);
    const interventionPoint = trajectory[interventionIdx]!;
    const phasesAfter = trajectory.length - cascadeCrossIdx;

    const peakMrWithout = Math.max(...trajectory.slice(cascadeCrossIdx).map(p => p.MR));
    const peakMrWith = MR_CASCADE_THRESHOLD - 0.2;
    const mrReduction = peakMrWithout - peakMrWith;

    const preventable_damage = mrReduction * phasesAfter * SEVERITY_CASCADE;

    candidates.push({
      t_trigger: interventionPoint.t,
      phase_index: interventionIdx,
      action: 'vent_open',
      message: formatVentMessage(interventionPoint, cascadeCrossIdx, trajectory),
      prevents: 'MR_cascade',
      preventable_damage,
      estimated_effect: {
        mr_reduction: mrReduction,
        cdi_reduction: 0,
        trip_recovered: peakMrWith < MR_CASCADE_THRESHOLD,
      },
    });
  }

  // Scan 2: CDI ≥ 5 prevention
  const impairmentIdx = trajectory.findIndex(p => p.CDI >= CDI_NAMED_IMPAIRMENT);
  if (impairmentIdx > 0) {
    const interventionIdx = Math.max(0, impairmentIdx - 1);
    const interventionPoint = trajectory[interventionIdx]!;
    const phasesAfter = trajectory.length - impairmentIdx;

    const peakCdiWithout = Math.max(...trajectory.slice(impairmentIdx).map(p => p.CDI));
    const peakCdiWith = CDI_NAMED_IMPAIRMENT - 0.5;
    const cdiReduction = peakCdiWithout - peakCdiWith;

    const preventable_damage = cdiReduction * phasesAfter * SEVERITY_CDI_IMPAIRMENT;

    candidates.push({
      t_trigger: interventionPoint.t,
      phase_index: interventionIdx,
      action: 'break',
      message: `Take a 10-minute shelter break before ${formatTime(interventionPoint.t)}. Without this, you enter clinical cold/heat stress territory.`,
      prevents: 'CDI_5_impairment',
      preventable_damage,
      estimated_effect: {
        mr_reduction: 0,
        cdi_reduction: cdiReduction,
        trip_recovered: peakCdiWith < CDI_NAMED_IMPAIRMENT,
      },
    });
  }

  // Scan 3: Sustained discomfort prevention
  const discomfortWindow = findSustainedDiscomfort(trajectory);
  if (discomfortWindow) {
    const interventionIdx = Math.max(0, discomfortWindow.startIdx - 1);
    const interventionPoint = trajectory[interventionIdx]!;
    const phasesAffected = discomfortWindow.endIdx - discomfortWindow.startIdx;

    const peakAbsTsens = Math.max(
      ...trajectory.slice(discomfortWindow.startIdx, discomfortWindow.endIdx)
        .map(p => Math.abs(p.TSENS)),
    );
    const tsensReduction = peakAbsTsens - 2.0;

    const preventable_damage = tsensReduction * phasesAffected * SEVERITY_DISCOMFORT_SUSTAINED;

    const action: CriticalMoment['action'] =
      discomfortWindow.direction === 'hot' ? 'vent_open' : 'layer_adjust';
    const msg = discomfortWindow.direction === 'hot'
      ? `Sustained hot discomfort expected from ${formatTime(interventionPoint.t)}. Plan venting now.`
      : `Sustained cold discomfort expected from ${formatTime(interventionPoint.t)}. Layer up if possible.`;

    candidates.push({
      t_trigger: interventionPoint.t,
      phase_index: interventionIdx,
      action,
      message: msg,
      prevents: 'sustained_discomfort',
      preventable_damage,
      estimated_effect: {
        mr_reduction: 0,
        cdi_reduction: 0,
        trip_recovered: false,
      },
    });
  }

  // Rank by preventable damage; earlier phase wins on tie
  candidates.sort((a, b) => {
    if (Math.abs(a.preventable_damage - b.preventable_damage) > 0.5) {
      return b.preventable_damage - a.preventable_damage;
    }
    return a.phase_index - b.phase_index;
  });

  return candidates.slice(0, MAX_CRITICAL_MOMENTS);
}

export function buildStrategyWindows(
  trajectory: TrajectoryPoint[],
): StrategyWindow[] {
  if (trajectory.length === 0) return [];

  const totalSeconds = trajectory[trajectory.length - 1]!.t;
  const totalHours = totalSeconds / 3600;
  const numWindows = Math.max(3, Math.min(5, Math.ceil(totalHours / 1.5)));
  const windowDurS = totalSeconds / numWindows;

  const windows: StrategyWindow[] = [];
  for (let w = 0; w < numWindows; w++) {
    const tStart = w * windowDurS;
    const tEnd = (w + 1) * windowDurS;
    const points = trajectory.filter(p => p.t >= tStart && p.t < tEnd);
    if (points.length === 0) continue;

    const avgTSENS = points.reduce((s, p) => s + p.TSENS, 0) / points.length;
    const peakMR = Math.max(...points.map(p => p.MR));
    const peakHLR = Math.max(...points.map(p => p.HLR));

    let regime: StrategyWindow['regime'] = 'neutral';
    let message = '';

    if (avgTSENS > 1.0 && peakMR < 3.0) {
      regime = 'running_warm';
      message = 'Running warm during active phases. Crack zippers on runs, zip up between.';
    } else if (avgTSENS < -0.5 && peakHLR > 3.0) {
      regime = 'running_cool';
      message = 'Cool exposure during rest phases. Minimize stationary time; keep moving.';
    } else if (peakMR > 2.5) {
      regime = 'sweat_peak';
      message = 'Peak moisture accumulation window. Use any vent opportunities.';
    } else if (avgTSENS > -0.3 && avgTSENS < 0.3 && peakMR < 2.0) {
      regime = 'neutral';
      message = 'Thermally balanced. Gear handling conditions well.';
    } else {
      regime = 'neutral';
      message = 'Mixed conditions. Gear adequate; normal behavioral management.';
    }

    windows.push({ t_start: tStart, t_end: tEnd, message, regime });
  }

  return windows;
}

function formatTime(seconds: number): string {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  return `${hh}h${mm.toString().padStart(2, '0')}m in`;
}

function formatVentMessage(
  interventionPoint: TrajectoryPoint,
  cascadePhaseIdx: number,
  trajectory: TrajectoryPoint[],
): string {
  const cascadePoint = trajectory[cascadePhaseIdx];
  const cascadePhase = cascadePoint?.phase === 'run' ? `the next run` : 'the next phase';
  return `Open pit zips now (${formatTime(interventionPoint.t)}), before ${cascadePhase}. Without this, your base layer saturates and stays wet for the rest of the trip.`;
}

interface DiscomfortWindow {
  startIdx: number;
  endIdx: number;
  direction: 'hot' | 'cold';
}

function findSustainedDiscomfort(trajectory: TrajectoryPoint[]): DiscomfortWindow | null {
  const THIRTY_MIN_S = 30 * 60;
  let bestWindow: DiscomfortWindow | null = null;
  let bestDuration = 0;

  let runStart = -1;
  let runDirection: 'hot' | 'cold' | null = null;

  for (let i = 0; i < trajectory.length; i++) {
    const p = trajectory[i]!;
    const dir: 'hot' | 'cold' | null =
      p.TSENS > TSENS_SUSTAINED_DISCOMFORT ? 'hot' :
      p.TSENS < -TSENS_SUSTAINED_DISCOMFORT ? 'cold' : null;

    if (dir && dir === runDirection) {
      // continuing
    } else if (dir) {
      runStart = i;
      runDirection = dir;
    } else {
      if (runStart >= 0 && runDirection) {
        const duration = (trajectory[i - 1]!.t - trajectory[runStart]!.t);
        if (duration >= THIRTY_MIN_S && duration > bestDuration) {
          bestWindow = { startIdx: runStart, endIdx: i, direction: runDirection };
          bestDuration = duration;
        }
      }
      runStart = -1;
      runDirection = null;
    }
  }

  if (runStart >= 0 && runDirection) {
    const duration = trajectory[trajectory.length - 1]!.t - trajectory[runStart]!.t;
    if (duration >= THIRTY_MIN_S && duration > bestDuration) {
      bestWindow = { startIdx: runStart, endIdx: trajectory.length, direction: runDirection };
    }
  }

  return bestWindow;
}
