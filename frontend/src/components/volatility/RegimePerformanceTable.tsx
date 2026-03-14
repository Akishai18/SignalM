import { Loader2 } from 'lucide-react';
import { useRegimePerformance, useCurrentRegime } from '@/hooks/useRegimeData';

const REGIME_COLORS: Record<string, string> = {
  Calm: '#10b981',
  Crisis: '#ef4444',
  'Elevated Stress': '#f59e0b',
  Transition: '#8b5cf6',
};

const REGIME_ORDER = ['Calm', 'Transition', 'Elevated Stress', 'Crisis'];

function pct(v: number, decimals = 1, sign = false): string {
  const s = (v * 100).toFixed(decimals);
  return sign && v > 0 ? `+${s}%` : `${s}%`;
}

export default function RegimePerformanceTable() {
  const { data: perfData, isLoading } = useRegimePerformance();
  const { data: currentRegime } = useCurrentRegime();

  const rows = REGIME_ORDER
    .map(name => perfData?.find(r => r.regime_name === name))
    .filter(Boolean) as NonNullable<typeof perfData>[number][];

  const hasVix = rows.some(r => r.avg_vix != null);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Full Regime Performance Summary</h3>
        <p className="text-xs text-muted-foreground">
          SPY return &amp; risk statistics per regime — 2012–2024
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Regime</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Days</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">% Time</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ann. Return</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Volatility</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Sharpe</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Win Rate</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Best Day</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Worst Day</th>
                {hasVix && (
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Avg VIX</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(regime => {
                const isCurrent = regime.regime_name === currentRegime?.regime_name;
                const color = REGIME_COLORS[regime.regime_name] ?? '#6b7280';
                const totalDays = rows.reduce((s, r) => s + r.days, 0);
                const timePct = totalDays > 0 ? ((regime.days / totalDays) * 100).toFixed(1) : '—';

                return (
                  <tr
                    key={regime.regime_name}
                    className={`border-b border-border/50 transition-colors ${
                      isCurrent ? 'bg-primary/5' : 'hover:bg-muted/20'
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-medium" style={{ color }}>
                          {regime.regime_name}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                            NOW
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-muted-foreground">
                      {regime.days.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-muted-foreground">
                      {timePct}%
                    </td>
                    <td
                      className={`text-right py-3 px-3 font-mono font-bold ${
                        regime.annualized_return >= 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {pct(regime.annualized_return, 1, true)}
                    </td>
                    <td className="text-right py-3 px-3 font-mono">
                      {pct(regime.volatility)}
                    </td>
                    <td
                      className={`text-right py-3 px-3 font-mono font-bold ${
                        regime.sharpe_ratio >= 1
                          ? 'text-emerald-500'
                          : regime.sharpe_ratio >= 0
                          ? 'text-muted-foreground'
                          : 'text-red-500'
                      }`}
                    >
                      {regime.sharpe_ratio.toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-3 font-mono">
                      {pct(regime.win_rate)}
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-emerald-500">
                      +{(regime.max_daily_gain * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-3 px-3 font-mono text-red-500">
                      {(regime.max_daily_loss * 100).toFixed(2)}%
                    </td>
                    {hasVix && (
                      <td className="text-right py-3 px-3 font-mono text-muted-foreground">
                        {regime.avg_vix?.toFixed(1) ?? '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
