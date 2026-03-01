import { Loader2 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { usePCAStructure } from '@/hooks/useRegimeData';

export default function MarketStructureChart() {
  const { data, isLoading } = usePCAStructure();

  const points = data?.points ?? [];

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Market Structure (PCA)</h3>
        <p className="text-xs text-muted-foreground">PC1 variance explained & effective dimension over time</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : points.length > 0 ? (
        <>
          <div className="flex gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
              <span className="text-xs text-muted-foreground">PC1 Var Explained</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="text-xs text-muted-foreground">Effective Dimension</span>
            </div>
          </div>

          <div className="h-56 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
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
                  yAxisId="left"
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: '#06b6d4' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#f97316' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
                        <div className="font-semibold mb-1.5">{label}</div>
                        <div className="flex justify-between gap-4">
                          <span className="text-cyan-500">PC1 Var Explained</span>
                          <span className="font-mono">{(pt.pc1_var * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-cyan-500">Top 3 PCs Cumulative</span>
                          <span className="font-mono">{(pt.cum_var_3 * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-orange-500">Effective Dimension</span>
                          <span className="font-mono">{pt.effective_dimension.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pc1_var"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#06b6d4', fill: 'hsl(var(--card))' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="effective_dimension"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#f97316', fill: 'hsl(var(--card))' }}
                />
              </LineChart>
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
          title="Market Structure (PCA)"
          whatItIs="Principal Component Analysis metrics showing how concentrated market returns are. PC1 variance explained shows how much one factor drives all sectors. Effective dimension estimates the number of independent risk factors."
          whyItMatters="High PC1 = one factor dominates (systemic risk, everything correlated). High effective dimension = diversified market with many independent drivers. During crises, PC1 spikes as everything moves together."
          howToRead="Left axis (cyan) = PC1 variance explained — higher means more concentration. Right axis (orange) = effective dimension — higher means more diversification. They typically move inversely."
          actionableInsight="When PC1 rises above 40% and effective dimension drops below 3.5, the market is highly concentrated. This is a crisis signature and signals reduced diversification benefit."
        />
      }
    />
  );
}
