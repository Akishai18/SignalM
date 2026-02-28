import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { TrajectoryPoint } from '@/lib/api';

const REGIME_COLORS: Record<string, string> = {
  'Calm': '#10b981',
  'Crisis': '#ef4444',
  'Elevated Stress': '#f59e0b',
  'Transition': '#8b5cf6',
};

const REGIME_ORDER = ['Calm', 'Transition', 'Elevated Stress', 'Crisis'];

interface Props {
  points: TrajectoryPoint[];
  maxHorizon: number;
}

export default function RegimeTrajectoryChart({ points, maxHorizon }: Props) {
  // Transform data for stacked area chart
  const chartData = points.map(p => ({
    day: p.day,
    regime_name: p.regime_name,
    confidence: p.confidence,
    ...p.probabilities,
  }));

  const formatDay = (day: number) => {
    if (day < 30) return `${day}d`;
    if (day < 365) return `${Math.round(day / 30)}mo`;
    return `${(day / 365).toFixed(1)}y`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold">Regime Trajectory</h4>
        <p className="text-xs text-muted-foreground">
          Predicted regime probabilities from day 1 to {formatDay(maxHorizon)}
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {REGIME_ORDER.map(regime => (
          <div key={regime} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: REGIME_COLORS[regime] }}
            />
            <span className="text-xs text-muted-foreground">{regime}</span>
          </div>
        ))}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDay}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 1]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = points.find(p => p.day === label);
                return (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
                    <div className="font-semibold mb-1.5">Day {label} ({formatDay(label as number)})</div>
                    {point && (
                      <div className="mb-2 text-[10px] text-muted-foreground">
                        Predicted: <span className="font-medium" style={{ color: REGIME_COLORS[point.regime_name] }}>
                          {point.regime_name}
                        </span> ({(point.confidence * 100).toFixed(1)}%)
                      </div>
                    )}
                    <div className="space-y-1">
                      {REGIME_ORDER.map(regime => {
                        const entry = payload.find(p => p.dataKey === regime);
                        if (!entry) return null;
                        return (
                          <div key={regime} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: REGIME_COLORS[regime] }}
                              />
                              <span>{regime}</span>
                            </div>
                            <span className="font-mono">{((entry.value as number) * 100).toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
            {REGIME_ORDER.map(regime => (
              <Area
                key={regime}
                type="monotone"
                dataKey={regime}
                stackId="1"
                fill={REGIME_COLORS[regime]}
                stroke={REGIME_COLORS[regime]}
                fillOpacity={0.7}
                strokeWidth={0}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
