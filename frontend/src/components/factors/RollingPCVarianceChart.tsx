import { Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { usePCAStructureFull } from '@/hooks/useRegimeData';

const PC_COLORS = { pc1_var: '#06b6d4', pc2_var: '#8b5cf6', pc3_var: '#f59e0b' };
const PC_LABELS = { pc1_var: 'PC1 (Systemic)', pc2_var: 'PC2 (Idiosyncratic)', pc3_var: 'PC3 (Sector)' };

export default function RollingPCVarianceChart() {
  const { data, isLoading } = usePCAStructureFull();
  const points = data?.points ?? [];

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Rolling PC Variance Explained</h3>
        <p className="text-xs text-muted-foreground">Fraction of total market variance explained by each principal component</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : points.length > 0 ? (
        <>
          <div className="flex gap-4 mb-3 flex-wrap">
            {(Object.entries(PC_LABELS) as [keyof typeof PC_COLORS, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PC_COLORS[key] }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <div className="h-56 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-xl text-xs">
                        <div className="font-semibold mb-1.5">{label}</div>
                        {(['pc1_var', 'pc2_var', 'pc3_var'] as const).map(k => (
                          <div key={k} className="flex justify-between gap-4">
                            <span style={{ color: PC_COLORS[k] }}>{PC_LABELS[k]}</span>
                            <span className="font-mono font-bold">{(pt[k] * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-border">
                          <span className="text-muted-foreground">Cumulative (3 PCs)</span>
                          <span className="font-mono font-bold">{(pt.cum_var_3 * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {(['pc1_var', 'pc2_var', 'pc3_var'] as const).map(key => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={PC_COLORS[key]}
                    strokeWidth={key === 'pc1_var' ? 2 : 1.5}
                    dot={false}
                    connectNulls
                    activeDot={{ r: 4, strokeWidth: 2, stroke: PC_COLORS[key], fill: 'hsl(var(--card))' }}
                  />
                ))}
              </LineChart>
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
          title="Rolling PC Variance Explained"
          whatItIs="The fraction of total cross-sectional return variance explained by each of the top 3 principal components, computed on a rolling basis over the dataset."
          whyItMatters="PC1 (systemic) measures how much one common factor drives all stocks — when it rises, diversification is collapsing. PC2 and PC3 capture independent sub-factors. Watching all three shows whether the market is becoming more or less concentrated."
          howToRead="Higher PC1 = more systemic risk. When PC1 spikes and PC2/PC3 fall, everything is moving together. The sum of all three lines = cumulative variance explained by the top 3 components."
          actionableInsight="When PC1 rises above 35%, the market is highly concentrated — a typical crisis or pre-crisis signature. Use this alongside the Correlation page's effective dimension for confirmation."
        />
      }
    />
  );
}
