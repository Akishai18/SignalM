import type { BacktestStats } from "@/lib/api";

interface Props {
  stats: BacktestStats;
}

function deltaLabel(strategy: number, benchmark: number): string {
  const diff = strategy - benchmark;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}% vs SPY B&H`;
}

export function BacktestSummaryCards({ stats }: Props) {
  const totalReturnPos = stats.total_return_pct >= 0;
  const sharpeGood = stats.sharpe_ratio >= 1;
  const sharpeMid = stats.sharpe_ratio >= 0.5;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Total Return */}
      <div className="relative rounded-xl border border-border bg-card p-4 overflow-hidden">
        <div className={`absolute inset-0 opacity-[0.04] ${totalReturnPos ? "bg-emerald-500" : "bg-red-500"}`} />
        <p className="relative text-xs text-muted-foreground mb-1.5">Total Return</p>
        <p className={`relative text-2xl font-bold font-mono tabular-nums tracking-tight ${totalReturnPos ? "text-emerald-500" : "text-red-500"}`}>
          {stats.total_return_pct >= 0 ? "+" : ""}{stats.total_return_pct.toFixed(2)}%
        </p>
        <p className="relative text-[10px] text-muted-foreground mt-1.5 leading-tight">
          {deltaLabel(stats.total_return_pct, stats.benchmark_total_return_pct)}
        </p>
      </div>

      {/* Sharpe Ratio */}
      <div className="relative rounded-xl border border-border bg-card p-4 overflow-hidden">
        <div className={`absolute inset-0 opacity-[0.04] ${sharpeGood ? "bg-emerald-500" : sharpeMid ? "bg-amber-500" : "bg-red-500"}`} />
        <p className="relative text-xs text-muted-foreground mb-1.5">Sharpe Ratio</p>
        <p className={`relative text-2xl font-bold font-mono tabular-nums tracking-tight ${sharpeGood ? "text-emerald-500" : sharpeMid ? "text-amber-500" : "text-red-500"}`}>
          {stats.sharpe_ratio.toFixed(3)}
        </p>
        <p className="relative text-[10px] text-muted-foreground mt-1.5 leading-tight">
          {deltaLabel(stats.sharpe_ratio, stats.benchmark_sharpe)}
        </p>
      </div>

      {/* Max Drawdown */}
      <div className="relative rounded-xl border border-border bg-card p-4 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] bg-red-500" />
        <p className="relative text-xs text-muted-foreground mb-1.5">Max Drawdown</p>
        <p className="relative text-2xl font-bold font-mono tabular-nums tracking-tight text-red-500">
          {stats.max_drawdown_pct.toFixed(2)}%
        </p>
        <p className="relative text-[10px] text-muted-foreground mt-1.5 leading-tight">
          Calmar: {stats.calmar_ratio.toFixed(3)}
        </p>
      </div>

      {/* Rebalances */}
      <div className="relative rounded-xl border border-border bg-card p-4 overflow-hidden">
        <p className="text-xs text-muted-foreground mb-1.5">Rebalances</p>
        <p className="text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground">
          {stats.num_rebalances}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
          Win rate: {stats.win_rate_pct.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
