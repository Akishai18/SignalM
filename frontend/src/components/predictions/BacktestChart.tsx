import { Loader2 } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useBacktest } from '@/hooks/useRegimeData';

const HORIZON_COLORS = {
  '1d': '#06b6d4', // cyan
  '7d': '#3b82f6', // blue
  '30d': '#8b5cf6', // purple
};

interface Props {
  selectedIndex: string;
}

export default function BacktestChart({ selectedIndex }: Props) {
  const { data, isLoading } = useBacktest(selectedIndex);

  const chartData = data?.points.map(p => ({
    date: p.date,
    '1d': p.rolling_accuracy_1d != null ? p.rolling_accuracy_1d * 100 : null,
    '7d': p.rolling_accuracy_7d != null ? p.rolling_accuracy_7d * 100 : null,
    '30d': p.rolling_accuracy_30d != null ? p.rolling_accuracy_30d * 100 : null,
  })) ?? [];

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Historical Backtest Accuracy</h3>
        <p className="text-xs text-muted-foreground">Rolling 30-day prediction accuracy across horizons</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : chartData.length > 0 ? (
        <>
          {/* Legend */}
          <div className="flex gap-4 mb-3">
            {Object.entries(HORIZON_COLORS).map(([horizon, color]) => (
              <div key={horizon} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">{horizon} horizon</span>
              </div>
            ))}
          </div>

          {/* Summary stats */}
          {data?.summary && (
            <div className="flex gap-4 mb-3">
              {(['1d', '7d', '30d'] as const).map(h => (
                <div key={h} className="text-xs">
                  <span className="text-muted-foreground">{h} avg: </span>
                  <span className="font-mono font-bold" style={{ color: HORIZON_COLORS[h] }}>
                    {(data.summary[`accuracy_${h}`] * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="h-56 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const date = new Date(d);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
                        <div className="font-semibold mb-1.5">{label}</div>
                        {payload.map(p => (
                          <div key={p.dataKey as string} className="flex justify-between gap-4">
                            <span style={{ color: p.color }}>{p.dataKey} accuracy</span>
                            <span className="font-mono">{p.value != null ? `${(p.value as number).toFixed(1)}%` : 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {(['1d', '7d', '30d'] as const).map(h => (
                  <Area
                    key={h}
                    type="monotone"
                    dataKey={h}
                    stroke={HORIZON_COLORS[h]}
                    fill={HORIZON_COLORS[h]}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    connectNulls
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: HORIZON_COLORS[h], fill: 'hsl(var(--card))' }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
          No backtest data available
        </div>
      )}
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="Historical Backtest Accuracy"
          whatItIs="A rolling backtest that replays history: for each past day, the model predicts 1d/7d/30d ahead, then checks if the prediction matched the actual regime. The chart shows 30-day rolling accuracy."
          whyItMatters="Backtesting reveals whether the model's predictions are actually reliable. Consistent 60%+ accuracy is strong for regime prediction. Drops in accuracy may coincide with unusual market events."
          howToRead="Higher lines = better accuracy. Compare horizons: 1d predictions are typically more accurate than 30d. Watch for periods where accuracy drops — these often coincide with regime transitions or black swan events."
          actionableInsight="If recent accuracy is significantly below the historical average, the model may be struggling with current market conditions. Weight predictions less heavily during low-accuracy periods."
        />
      }
    />
  );
}
