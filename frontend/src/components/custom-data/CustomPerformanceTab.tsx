interface PerformanceRow {
  regime_id: number;
  regime_name: string;
  days: number;
  pct_time: number;
  avg_daily_return: number;
  ann_vol: number;
  sharpe: number;
  win_rate: number;
  best_day: number;
  worst_day: number;
  mean_duration_days?: number;
}

interface Props {
  performance: PerformanceRow[];
  regimeColorMap: Record<string, string>;
}

function pct(v: number, decimals = 2) {
  return `${(v * 100).toFixed(decimals)}%`;
}

function fmt(v: number | undefined, decimals = 2) {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function colorFor(v: number) {
  if (v > 0) return "text-green-400";
  if (v < 0) return "text-red-400";
  return "text-muted-foreground";
}

// Mini inline bar for 0–max normalised value
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function CustomPerformanceTab({ performance, regimeColorMap }: Props) {
  const bestSharpe = performance.reduce((a, b) => (a.sharpe > b.sharpe ? a : b), performance[0]);
  const bestReturn = performance.reduce((a, b) => (a.avg_daily_return > b.avg_daily_return ? a : b), performance[0]);
  const mostTime = performance.reduce((a, b) => (a.pct_time > b.pct_time ? a : b), performance[0]);

  const maxSharpe = Math.max(...performance.map((r) => Math.abs(r.sharpe)));
  const maxWinRate = Math.max(...performance.map((r) => r.win_rate));
  const maxVol = Math.max(...performance.map((r) => r.ann_vol));

  const highlights = [
    {
      label: "Best Sharpe",
      regime: bestSharpe,
      value: fmt(bestSharpe?.sharpe),
      sub: "risk-adjusted return",
    },
    {
      label: "Best Avg Return",
      regime: bestReturn,
      value: bestReturn ? pct(bestReturn.avg_daily_return) + " /day" : "—",
      sub: `~${bestReturn ? pct(bestReturn.avg_daily_return * 252, 1) : "—"} annualised`,
    },
    {
      label: "Most Time Spent",
      regime: mostTime,
      value: mostTime ? pct(mostTime.pct_time, 1) : "—",
      sub: `${mostTime?.days ?? 0} trading days`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Highlight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {highlights.map(({ label, regime, value, sub }) => {
          const color = regime ? (regimeColorMap[String(regime.regime_id)] ?? "#6b7280") : "#6b7280";
          return (
            <div
              key={label}
              className="rounded-xl border bg-card p-4 space-y-2"
              style={{ borderColor: color + "40", background: color + "0d" }}
            >
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="font-semibold text-sm">{regime?.regime_name ?? "—"}</span>
              </div>
              <p className="text-xl font-bold font-mono tabular-nums" style={{ color }}>
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold">Per-Regime Performance</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Based on the first ticker's daily returns. Annualized metrics assume 252 trading days.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Regime</th>
                <th className="px-4 py-3 font-medium text-right">% Time</th>
                <th className="px-4 py-3 font-medium text-right">Avg Daily</th>
                <th className="px-4 py-3 font-medium text-right">Ann. Return</th>
                <th className="px-4 py-3 font-medium text-right">Ann. Vol</th>
                <th className="px-4 py-3 font-medium text-right">Sharpe</th>
                <th className="px-4 py-3 font-medium text-right">Win Rate</th>
                <th className="px-4 py-3 font-medium text-right">Best Day</th>
                <th className="px-4 py-3 font-medium text-right">Worst Day</th>
                <th className="px-4 py-3 font-medium text-right">Avg Dur.</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((row) => {
                const color = regimeColorMap[String(row.regime_id)] ?? "#6b7280";
                const annReturn = row.avg_daily_return * 252;
                return (
                  <tr
                    key={row.regime_id}
                    className="border-t border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    {/* Regime name with colored left accent */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-medium">{row.regime_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="space-y-1">
                        <span>{pct(row.pct_time, 1)}</span>
                        <MiniBar value={row.pct_time} max={1} color={color} />
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${colorFor(row.avg_daily_return)}`}>
                      {pct(row.avg_daily_return)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${colorFor(annReturn)}`}>
                      {pct(annReturn, 1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="space-y-1">
                        <span>{pct(row.ann_vol, 1)}</span>
                        <MiniBar value={row.ann_vol} max={maxVol} color="#6b7280" />
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${colorFor(row.sharpe)}`}>
                      <div className="space-y-1">
                        <span>{fmt(row.sharpe)}</span>
                        <MiniBar value={Math.abs(row.sharpe)} max={maxSharpe} color={row.sharpe >= 0 ? "#4ade80" : "#f87171"} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="space-y-1">
                        <span>{pct(row.win_rate, 1)}</span>
                        <MiniBar value={row.win_rate} max={maxWinRate} color={color} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">{pct(row.best_day)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-400">{pct(row.worst_day)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {row.mean_duration_days != null ? `${row.mean_duration_days.toFixed(1)}d` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
