import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrajectoryPoint } from '@lc6/engine';

// ═══════════════════════════════════════════════════════════════════════════
// TrajectoryChart — line chart of MR / HLR / CDI over time
// Source: result.four_pill.your_gear.trajectory (TrajectoryPoint[])
// X-axis: t (seconds since trip start) → displayed as hours
// Y-axis: 0-10 risk metric range (engine emits 0-10 scale per CDI v1.4)
// ═══════════════════════════════════════════════════════════════════════════

interface TrajectoryChartProps {
  trajectory: TrajectoryPoint[];
}

// Maps trajectory[] to chart-friendly shape with hours rather than seconds.
// Recharts plays best with plain objects; we project to the 4 fields needed.
interface ChartPoint {
  hours: number;
  MR: number;
  HLR: number;
  CDI: number;
}

function projectTrajectory(trajectory: TrajectoryPoint[]): ChartPoint[] {
  return trajectory.map(pt => ({
    hours: pt.t / 3600,
    MR: pt.MR,
    HLR: pt.HLR,
    CDI: pt.CDI,
  }));
}

// Format hours to "Xh Ym" for axis tick display
function formatHourTick(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

export function TrajectoryChart({ trajectory }: TrajectoryChartProps) {
  if (trajectory.length === 0) {
    return (
      <div className="trajectory-chart-empty">
        Trajectory data unavailable for this scenario.
      </div>
    );
  }

  const data = projectTrajectory(trajectory);

  return (
    <div className="trajectory-chart-container">
      <div className="trajectory-chart-header">
        <h2 className="trajectory-chart-title">Trip Trajectory</h2>
        <p className="trajectory-chart-subtitle">
          Risk metrics over the {(data[data.length - 1]?.hours ?? 0).toFixed(1)}-hour trip
        </p>
      </div>
      <div className="trajectory-chart-body">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e6" />
            <XAxis
              dataKey="hours"
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={formatHourTick}
              tick={{ fontSize: 12, fill: '#6b6b6b' }}
              stroke="#6b6b6b"
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 12, fill: '#6b6b6b' }}
              stroke="#6b6b6b"
              label={{
                value: 'Risk score',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: '#6b6b6b' },
              }}
            />
            <Tooltip
              formatter={(value: number) => value.toFixed(2)}
              labelFormatter={(hours: number) => `Time: ${formatHourTick(hours)}`}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e8e8e6',
                borderRadius: 4,
                fontSize: 13,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="MR"
              stroke="#2f7d4f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name="MR (moisture risk)"
            />
            <Line
              type="monotone"
              dataKey="HLR"
              stroke="#b87a1d"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name="HLR (heat loss risk)"
            />
            <Line
              type="monotone"
              dataKey="CDI"
              stroke="#b3372f"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name="CDI (cold danger index)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
