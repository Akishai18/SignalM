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
  ReferenceLine,
} from 'recharts';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useRegimePerformance, useCurrentRegime } from '@/hooks/useRegimeData';

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

const REGIME_ORDER = ['Calm', 'Transition', 'Elevated Stress', 'Crisis'];

export default function RegimeRiskReturnChart() {
  const { data: perfData, isLoading } = useRegimePerformance();
  const { data: currentRegime } = useCurrentRegime();

  const chartData = REGIME_ORDER.map(name => {
    const regime = perfData?.find(r => r.regime_name === name);
    return {
      name,
      sharpe: regime ? +regime.sharpe_ratio.toFixed(3) : null,
      winRate: regime ? +(regime.win_rate * 100).toFixed(1) : null,
      annReturn: regime ? +(regime.annualized_return * 100).toFixed(2) : null,
      isCurrent: name === currentRegime?.regime_name,
    };
  }).filter(r => r.sharpe != null);

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Sharpe Ratio & Win Rate by Regime</h3>
        <p className="text-xs text-muted-foreground">Risk-adjusted performance characteristics per regime</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : chartData.length > 0 ? (
        <>
          <div className="flex gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-slate-400 opacity-80" />
              <span className="text-xs text-muted-foreground">Sharpe Ratio (left)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-slate-400 opacity-30" />
              <span className="text-xs text-muted-foreground">Win Rate % (right)</span>
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
                  yAxisId="sharpe"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v.toFixed(1)}
                />
                <YAxis
                  yAxisId="win"
                  orientation="right"
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[40, 60]}
                />
                <ReferenceLine yAxisId="sharpe" y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
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
                          {d.isCurrent && (
                            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-normal">NOW</span>
                          )}
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Sharpe Ratio</span>
                          <span
                            className={`font-mono font-bold ${
                              d.sharpe >= 1 ? 'text-emerald-500' : d.sharpe >= 0 ? 'text-muted-foreground' : 'text-red-500'
                            }`}
                          >
                            {d.sharpe?.toFixed(3)}
                          </span>
                        </div>
                        {d.winRate != null && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Win Rate</span>
                            <span className="font-mono font-bold">{d.winRate.toFixed(1)}%</span>
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
                      </div>
                    );
                  }}
                />
                <Bar yAxisId="sharpe" dataKey="sharpe" radius={[4, 4, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell
                      key={entry.name}
                      fill={REGIME_COLORS[entry.name] ?? '#6b7280'}
                      fillOpacity={entry.isCurrent ? 1 : 0.75}
                      stroke={entry.isCurrent ? 'hsl(var(--primary))' : 'transparent'}
                      strokeWidth={entry.isCurrent ? 1.5 : 0}
                    />
                  ))}
                </Bar>
                <Bar yAxisId="win" dataKey="winRate" radius={[3, 3, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell
                      key={`win-${entry.name}`}
                      fill={REGIME_COLORS[entry.name] ?? '#6b7280'}
                      fillOpacity={0.3}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Current regime callout */}
          {currentRegime && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: REGIME_COLORS[currentRegime.regime_name] }}
                />
                <span className="text-xs text-muted-foreground">
                  Current regime ({currentRegime.regime_name}) highlighted with border
                </span>
              </div>
            </div>
          )}
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
          title="Sharpe Ratio & Win Rate by Regime"
          whatItIs="The historical Sharpe ratio (solid bars, left axis) and daily win rate — fraction of positive return days (faded bars, right axis) — for each of the 4 market regimes."
          whyItMatters="Sharpe ratio shows risk-adjusted return per regime. A negative Sharpe in Crisis means you're being paid negative return for the risk you're taking. Win rate shows how often the market is up on any given day in each regime."
          howToRead="Solid bars = Sharpe ratio (higher is better, negative is bad). Faded bars = % of days with positive SPY return. Bars outlined in white = current regime. Reference line at 0 separates positive vs negative risk-adjusted return."
          actionableInsight="If the current regime has a negative Sharpe, systematic equity exposure is historically unrewarded. This is the regime where defensive positioning (cash, hedges, short vol) historically outperforms."
        />
      }
    />
  );
}
