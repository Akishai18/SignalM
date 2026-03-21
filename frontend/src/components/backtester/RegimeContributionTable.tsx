import type { RegimeBreakdownItem } from "@/lib/api";

interface Props {
  breakdown: RegimeBreakdownItem[];
}

const REGIME_META: Record<number, { name: string; color: string; dot: string }> = {
  0: { name: "Calm",            color: "text-emerald-500", dot: "bg-emerald-500" },
  1: { name: "Crisis",          color: "text-red-500",     dot: "bg-red-500"     },
  2: { name: "Elevated Stress", color: "text-orange-500",  dot: "bg-orange-500"  },
  3: { name: "Transition",      color: "text-purple-500",  dot: "bg-purple-500"  },
};

function contribColor(pct: number): string {
  if (pct > 5)  return "text-emerald-500";
  if (pct > 0)  return "text-emerald-400";
  if (pct < -5) return "text-red-500";
  if (pct < 0)  return "text-red-400";
  return "text-muted-foreground";
}

export function RegimeContributionTable({ breakdown }: Props) {
  if (breakdown.length === 0) return null;

  // Sort by regime_id for stable display order
  const rows = [...breakdown].sort((a, b) => a.regime_id - b.regime_id);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Regime Contribution</h3>
        <p className="text-xs text-muted-foreground">Per-regime time allocation and return contribution</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pb-2 font-medium text-muted-foreground">Regime</th>
              <th className="text-right pb-2 font-medium text-muted-foreground">Days</th>
              <th className="text-right pb-2 font-medium text-muted-foreground">% Time</th>
              <th className="text-right pb-2 font-medium text-muted-foreground">Avg Daily</th>
              <th className="text-right pb-2 font-medium text-muted-foreground">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = REGIME_META[row.regime_id] ?? {
                name: `Regime ${row.regime_id}`,
                color: "text-foreground",
                dot: "bg-foreground",
              };
              return (
                <tr key={row.regime_id} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                      <span className={`font-medium ${meta.color}`}>{meta.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-foreground">
                    {row.days}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                    {row.pct_time.toFixed(1)}%
                  </td>
                  <td className={`py-2.5 text-right font-mono tabular-nums ${contribColor(row.avg_daily_return_pct)}`}>
                    {row.avg_daily_return_pct >= 0 ? "+" : ""}
                    {row.avg_daily_return_pct.toFixed(3)}%
                  </td>
                  <td className={`py-2.5 text-right font-mono tabular-nums font-semibold ${contribColor(row.total_contribution_pct)}`}>
                    {row.total_contribution_pct >= 0 ? "+" : ""}
                    {row.total_contribution_pct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
