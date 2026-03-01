import { Loader2 } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useRollingCorrelation } from '@/hooks/useRegimeData';

const WINDOW_COLORS: Record<string, string> = {
  corr_21d: '#06b6d4',  // cyan
  corr_63d: '#3b82f6',  // blue
  corr_252d: '#8b5cf6', // purple
};

const WINDOW_LABELS: Record<string, string> = {
  corr_21d: '21d (1M)',
  corr_63d: '63d (3M)',
  corr_252d: '252d (1Y)',
};

export default function RollingCorrelationChart() {
  const { data, isLoading } = useRollingCorrelation();

  const chartData = data?.points ?? [];

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Rolling Average Correlation</h3>
        <p className="text-xs text-muted-foreground">Average pairwise sector correlation over time</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : chartData.length > 0 ? (
        <>
          <div className="flex gap-4 mb-3">
            {Object.entries(WINDOW_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: WINDOW_COLORS[key] }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="h-56 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const date = new Date(d);
                    return `${date.getFullYear().toString().slice(2)}/${String(date.getMonth() + 1).padStart(2, '0')}`;
                  }}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v: number) => v.toFixed(2)}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
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
                            <span style={{ color: p.color }}>{WINDOW_LABELS[p.dataKey as string] ?? p.dataKey}</span>
                            <span className="font-mono">{p.value != null ? (p.value as number).toFixed(4) : 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {Object.entries(WINDOW_COLORS).map(([key, color]) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.05}
                    strokeWidth={2}
                    connectNulls
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: color, fill: 'hsl(var(--card))' }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-56 text-sm text-muted-foreground">
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
          title="Rolling Average Correlation"
          whatItIs="The average pairwise correlation across all 11 sector ETFs, computed on a rolling basis for 21-day, 63-day, and 252-day windows."
          whyItMatters="Rising correlation means the market is moving more in unison — often a sign of stress or herding behavior. Low correlation suggests sector differentiation and healthier markets."
          howToRead="Compare the short (21d) vs long (252d) windows. When the short-term line spikes above the long-term average, it signals a sudden correlation event. Sustained high readings (>0.5) indicate systemic risk."
          actionableInsight="When 21-day correlation rises sharply above 63-day, a regime shift may be underway. This is a leading indicator for crisis regimes."
        />
      }
    />
  );
}
