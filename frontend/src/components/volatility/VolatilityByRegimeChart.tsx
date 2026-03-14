import { Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useRegimePerformance } from '@/hooks/useRegimeData';

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

const REGIME_ORDER = ['Calm', 'Transition', 'Elevated Stress', 'Crisis'];

export default function VolatilityByRegimeChart() {
  const { data: perfData, isLoading } = useRegimePerformance();

  const chartData = REGIME_ORDER.map(name => {
    const regime = perfData?.find(r => r.regime_name === name);
    return {
      name,
      vol: regime ? +(regime.volatility * 100).toFixed(2) : null,
      vix: regime?.avg_vix != null ? +regime.avg_vix.toFixed(1) : null,
      annReturn: regime ? +(regime.annualized_return * 100).toFixed(2) : null,
      days: regime?.days ?? 0,
    };
  }).filter(r => r.vol != null);

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Volatility & VIX by Regime</h3>
        <p className="text-xs text-muted-foreground">Historical avg realized vol and VIX level per regime</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : chartData.length > 0 ? (
        <>
          <div className="flex gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-8 rounded-sm bg-current opacity-80" style={{ background: 'linear-gradient(90deg, #10b981, #ef4444)' }} />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-slate-400 opacity-50" />
              <span className="text-xs text-muted-foreground">Realized Vol (left)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-slate-500 opacity-30" />
              <span className="text-xs text-muted-foreground">Avg VIX (right)</span>
            </div>
          </div>

          <div className="h-56 cursor-crosshair">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 40, bottom: 5, left: 0 }}
                barCategoryGap="25%"
                barGap={3}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="vol"
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="vix"
                  orientation="right"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border bg-card p-3 shadow-xl text-xs">
                        <div
                          className="font-semibold mb-1.5"
                          style={{ color: REGIME_COLORS[d.name] }}
                        >
                          {d.name}
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Realized Vol</span>
                          <span className="font-mono font-bold">{d.vol?.toFixed(1)}%</span>
                        </div>
                        {d.vix != null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Avg VIX</span>
                            <span className="font-mono font-bold">{d.vix.toFixed(1)}</span>
                          </div>
                        )}
                        {d.annReturn != null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Ann. Return</span>
                            <span
                              className={`font-mono font-bold ${d.annReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                            >
                              {d.annReturn > 0 ? '+' : ''}{d.annReturn.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-border">
                          <span className="text-muted-foreground">Days</span>
                          <span className="font-mono">{d.days.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar yAxisId="vol" dataKey="vol" radius={[4, 4, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell
                      key={entry.name}
                      fill={REGIME_COLORS[entry.name] ?? '#6b7280'}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
                <Bar yAxisId="vix" dataKey="vix" radius={[3, 3, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell
                      key={`vix-${entry.name}`}
                      fill={REGIME_COLORS[entry.name] ?? '#6b7280'}
                      fillOpacity={0.3}
                    />
                  ))}
                </Bar>
              </BarChart>
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
          title="Volatility & VIX by Regime"
          whatItIs="Grouped bars showing the historical average realized volatility (solid, left axis) and average VIX level (faded, right axis) for each of the 4 market regimes."
          whyItMatters="Each regime has a characteristic volatility signature. Crisis regimes have the highest vol — knowing this lets you calibrate position sizing and option pricing benchmarks before a regime is fully established."
          howToRead="Solid bars = annualized realized vol %. Faded bars = avg VIX level. Both metrics should rise together in stress regimes. A large gap between the two in any regime is informative."
          actionableInsight="Use the vol level as a regime-aware position sizing input. In a Crisis regime, target 30-50% smaller positions vs Calm to maintain a consistent risk budget."
        />
      }
    />
  );
}
