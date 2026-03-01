import { Loader2 } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useBacktest } from '@/hooks/useRegimeData';

const HORIZONS = [
  { key: '1d', label: '1-Day', color: '#06b6d4', field: 'confidence_1d' as const },
  { key: '7d', label: '7-Day', color: '#3b82f6', field: 'confidence_7d' as const },
  { key: '30d', label: '30-Day', color: '#8b5cf6', field: 'confidence_30d' as const },
];

interface Props {
  selectedIndex: string;
}

export default function ConfidenceSparklines({ selectedIndex }: Props) {
  const { data, isLoading } = useBacktest(selectedIndex);

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Confidence Over Time</h3>
        <p className="text-xs text-muted-foreground">Model confidence trends for each prediction horizon</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : data?.points.length ? (
        <div className="space-y-3">
          {HORIZONS.map(({ key, label, color, field }) => {
            const chartData = data.points
              .filter(p => p[field] != null)
              .map(p => ({
                date: p.date,
                value: (p[field] as number) * 100,
              }));

            const latest = chartData.length > 0 ? chartData[chartData.length - 1].value : null;
            const avg = chartData.length > 0
              ? chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length
              : null;

            return (
              <div key={key} className="hover:bg-muted/30 rounded-lg transition-colors px-2 -mx-2 py-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      avg: {avg != null ? `${avg.toFixed(1)}%` : 'N/A'}
                    </span>
                    <span className="text-xs font-mono font-bold" style={{ color }}>
                      {latest != null ? `${latest.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="h-16 cursor-crosshair">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                      <Tooltip
                        cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0];
                          return (
                            <div className="rounded-md border border-border bg-card px-2 py-1 shadow text-[10px]">
                              <span className="font-mono">{(point.value as number).toFixed(1)}%</span>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, fill: color, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          No data available
        </div>
      )}
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="Confidence Over Time"
          whatItIs="Sparkline charts showing how the model's confidence in its predictions has changed over the past year. Each chart tracks a different prediction horizon (1d, 7d, 30d)."
          whyItMatters="Confidence trends reveal model certainty. Falling confidence may indicate the market is entering an unusual state the model hasn't seen before. Consistently high confidence suggests clear regime signals."
          howToRead="Higher = more confident predictions. The current value is shown at top-right. Compare to the historical average at the bottom. Spikes or drops in confidence often coincide with market volatility events."
          actionableInsight="Trust predictions more when confidence is above the historical average. When confidence drops significantly, consider waiting for confirmation before acting on regime predictions."
        />
      }
    />
  );
}
