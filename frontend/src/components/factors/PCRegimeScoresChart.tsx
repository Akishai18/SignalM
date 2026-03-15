import { Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ErrorBar,
} from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { usePCARegimeScores } from '@/hooks/useRegimeData';

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

const PC_CONFIGS = [
  { key: 'pc1' as const, label: 'PC1', color: '#06b6d4' },
  { key: 'pc2' as const, label: 'PC2', color: '#8b5cf6' },
  { key: 'pc3' as const, label: 'PC3', color: '#f59e0b' },
];

export default function PCRegimeScoresChart() {
  const { data, isLoading } = usePCARegimeScores();

  const regimes = data?.regimes ?? [];

  // Build chart data: one row per regime, columns for PC1/PC2/PC3 mean ± std
  const chartData = regimes.map(r => ({
    name: r.regime_name,
    color: REGIME_COLORS[r.regime_name] ?? '#6b7280',
    pc1_mean: r.pc1_mean,
    pc1_err: [r.pc1_std, r.pc1_std] as [number, number],
    pc2_mean: r.pc2_mean,
    pc2_err: [r.pc2_std, r.pc2_std] as [number, number],
    pc3_mean: r.pc3_mean,
    pc3_err: [r.pc3_std, r.pc3_std] as [number, number],
    count: r.count,
  }));

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">PC Scores by Regime</h3>
        <p className="text-xs text-muted-foreground">
          Mean PC1/PC2/PC3 score per regime — shows how each regime occupies PC space. Error bars = ±1 std dev.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : chartData.length > 0 ? (
        <>
          <div className="flex gap-4 mb-3 flex-wrap">
            {PC_CONFIGS.map(pc => (
              <div key={pc.key} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pc.color }} />
                <span className="text-xs text-muted-foreground">{pc.label}</span>
              </div>
            ))}
          </div>
          <div className="h-56 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }} barGap={2} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v.toFixed(1)}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = chartData.find(r => r.name === label);
                    return (
                      <div className="rounded-lg border border-border bg-card p-2.5 shadow-xl text-xs">
                        <div className="font-semibold mb-1.5" style={{ color: row?.color }}>
                          {label} ({row?.count} days)
                        </div>
                        {PC_CONFIGS.map(pc => {
                          const mean = row?.[`${pc.key}_mean`] ?? 0;
                          const std = row?.[`${pc.key}_err`]?.[0] ?? 0;
                          return (
                            <div key={pc.key} className="flex justify-between gap-4">
                              <span style={{ color: pc.color }}>{pc.label}</span>
                              <span className="font-mono">
                                {mean.toFixed(2)} ± {std.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {PC_CONFIGS.map(pc => (
                  <Bar
                    key={pc.key}
                    dataKey={`${pc.key}_mean`}
                    name={pc.label}
                    fill={pc.color}
                    fillOpacity={0.75}
                    radius={[3, 3, 0, 0]}
                  >
                    <ErrorBar dataKey={`${pc.key}_err`} width={3} strokeWidth={1.5} stroke={pc.color} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-56 text-sm text-muted-foreground">No data</div>
      )}
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="PC Scores by Regime"
          whatItIs="The average position of each market regime in the principal component space, summarizing where each regime 'lives' along the systemic risk (PC1), idiosyncratic (PC2), and sector (PC3) axes."
          whyItMatters="Crisis regime days should have extreme PC1 scores (high systemic loading). Calm days should cluster near zero. These regime signatures validate that K-Means found meaningful market states, not arbitrary clusters."
          howToRead="Each group of bars = one regime. Height = mean PC score for that component. Error bars show ±1 standard deviation — wider bars = more variable regime. Negative PC1 in Calm means low systemic co-movement."
          actionableInsight="When the current day's PC scores approach the Crisis regime centroid, that's a leading indicator to reduce exposure. The distance between your current position and each regime centroid is a probabilistic regime signal."
        />
      }
    />
  );
}
