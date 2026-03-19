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
  return "";
}

export function CustomPerformanceTab({ performance, regimeColorMap }: Props) {
  return (
    <div className="space-y-6">
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
                <th className="px-4 py-3 font-medium text-right">Days</th>
                <th className="px-4 py-3 font-medium text-right">% Time</th>
                <th className="px-4 py-3 font-medium text-right">Avg Daily Ret</th>
                <th className="px-4 py-3 font-medium text-right">Ann Vol</th>
                <th className="px-4 py-3 font-medium text-right">Sharpe</th>
                <th className="px-4 py-3 font-medium text-right">Win Rate</th>
                <th className="px-4 py-3 font-medium text-right">Best Day</th>
                <th className="px-4 py-3 font-medium text-right">Worst Day</th>
                <th className="px-4 py-3 font-medium text-right">Avg Duration</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((row) => {
                const color = regimeColorMap[String(row.regime_id)] ?? "#6b7280";
                return (
                  <tr
                    key={row.regime_id}
                    className="border-t border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-medium">{row.regime_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{row.days.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{pct(row.pct_time, 1)}</td>
                    <td className={`px-4 py-3 text-right ${colorFor(row.avg_daily_return)}`}>
                      {pct(row.avg_daily_return)}
                    </td>
                    <td className="px-4 py-3 text-right">{pct(row.ann_vol, 1)}</td>
                    <td className={`px-4 py-3 text-right ${colorFor(row.sharpe)}`}>
                      {fmt(row.sharpe)}
                    </td>
                    <td className="px-4 py-3 text-right">{pct(row.win_rate, 1)}</td>
                    <td className="px-4 py-3 text-right text-green-400">{pct(row.best_day)}</td>
                    <td className="px-4 py-3 text-right text-red-400">{pct(row.worst_day)}</td>
                    <td className="px-4 py-3 text-right">
                      {row.mean_duration_days != null
                        ? `${row.mean_duration_days.toFixed(1)}d`
                        : "—"}
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
