import type { BacktestStats } from "@/lib/api";

interface Props {
  stats: BacktestStats;
}

interface CardDef {
  label: string;
  value: string;
  sub: string;
  valueColor: string;
}

function deltaLabel(strategy: number, benchmark: number): string {
  const diff = strategy - benchmark;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}% vs SPY B&H`;
}

export function BacktestSummaryCards({ stats }: Props) {
  const cards: CardDef[] = [
    {
      label: "Total Return",
      value: `${stats.total_return_pct >= 0 ? "+" : ""}${stats.total_return_pct.toFixed(2)}%`,
      sub: deltaLabel(stats.total_return_pct, stats.benchmark_total_return_pct),
      valueColor: stats.total_return_pct >= 0 ? "text-emerald-500" : "text-red-500",
    },
    {
      label: "Sharpe Ratio",
      value: stats.sharpe_ratio.toFixed(3),
      sub: deltaLabel(stats.sharpe_ratio, stats.benchmark_sharpe),
      valueColor: stats.sharpe_ratio >= 1 ? "text-emerald-500" : stats.sharpe_ratio >= 0.5 ? "text-amber-500" : "text-red-500",
    },
    {
      label: "Max Drawdown",
      // max_drawdown_pct is already negative from the engine (e.g. -34.92)
      value: `${stats.max_drawdown_pct.toFixed(2)}%`,
      sub: `Calmar: ${stats.calmar_ratio.toFixed(3)}`,
      valueColor: "text-red-500",
    },
    {
      label: "Rebalances",
      value: String(stats.num_rebalances),
      sub: `Win rate: ${stats.win_rate_pct.toFixed(1)}%`,
      valueColor: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
          <p className={`text-xl font-bold font-mono tabular-nums ${card.valueColor}`}>
            {card.value}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
