import type { RegimeAllocations } from "./BacktestConfigurator";

interface Props {
  allocations: RegimeAllocations;
}

const REGIME_NAMES: Record<string, string> = {
  "0": "Calm",
  "1": "Crisis",
  "2": "Elev. Stress",
  "3": "Transition",
};

const REGIME_LABEL_COLORS: Record<string, string> = {
  "0": "text-emerald-500",
  "1": "text-red-500",
  "2": "text-orange-500",
  "3": "text-purple-500",
};

// Distinct fill colors per asset — consistent across all regime bars
const ASSET_COLORS: Record<string, { bg: string; label: string }> = {
  SPY:  { bg: "bg-blue-500",    label: "SPY"  },
  XLU:  { bg: "bg-yellow-500",  label: "XLU"  },
  XLK:  { bg: "bg-cyan-500",    label: "XLK"  },
  XLF:  { bg: "bg-violet-500",  label: "XLF"  },
  XLE:  { bg: "bg-orange-400",  label: "XLE"  },
  cash: { bg: "bg-slate-400",   label: "Cash" },
};

// Merge explicit cash + residual into one segment.
// The engine ignores the "cash" ticker entirely (backtester.py:174) and treats
// unallocated weight as 0% return — so explicit and implicit cash are identical
// in the math. Showing two separate segments would misrepresent that equivalence.
function buildSegments(weights: Record<string, number>): Array<{ asset: string; pct: number }> {
  const segments: Array<{ asset: string; pct: number }> = [];
  let nonCashTotal = 0;

  for (const [asset, decimal] of Object.entries(weights)) {
    if (asset === "cash") continue;
    const pct = decimal * 100;
    if (pct > 0) {
      segments.push({ asset, pct });
      nonCashTotal += pct;
    }
  }

  const explicitCash = (weights["cash"] ?? 0) * 100;
  const totalCash = explicitCash + Math.max(0, 100 - nonCashTotal - explicitCash);
  if (totalCash > 0.01) {
    segments.push({ asset: "cash", pct: totalCash });
  }

  return segments;
}

export function AllocationSummaryBar({ allocations }: Props) {
  const regimeIds = ["0", "1", "2", "3"];

  // Collect all assets that appear (for the legend)
  const usedAssets = new Set<string>();
  for (const weights of Object.values(allocations)) {
    for (const [asset, decimal] of Object.entries(weights)) {
      if ((decimal ?? 0) > 0) usedAssets.add(asset);
    }
  }
  // Always show cash in legend
  usedAssets.add("cash");

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Allocation Summary</h3>
        <p className="text-xs text-muted-foreground">Asset weights per regime (residual = cash)</p>
      </div>

      {/* Stacked bars */}
      <div className="flex flex-col gap-3">
        {regimeIds.map((id) => {
          const weights = allocations[id] ?? {};
          const segments = buildSegments(weights);

          return (
            <div key={id} className="flex items-center gap-3">
              <span className={`w-24 text-xs font-medium flex-shrink-0 ${REGIME_LABEL_COLORS[id]}`}>
                {REGIME_NAMES[id]}
              </span>
              <div className="flex-1 flex h-5 rounded-md overflow-hidden border border-border/50 bg-muted/20">
                {segments.map((seg, i) => {
                  const meta = ASSET_COLORS[seg.asset] ?? { bg: "bg-gray-400", label: seg.asset };
                  return (
                    <div
                      key={`${seg.asset}-${i}`}
                      className={`${meta.bg} flex items-center justify-center transition-all`}
                      style={{ width: `${seg.pct}%` }}
                      title={`${meta.label}: ${seg.pct.toFixed(1)}%`}
                    >
                      {seg.pct >= 8 && (
                        <span className="text-[9px] font-bold text-white/90 leading-none select-none">
                          {seg.pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {Array.from(usedAssets).map((asset) => {
          const meta = ASSET_COLORS[asset] ?? { bg: "bg-gray-400", label: asset };
          return (
            <div key={asset} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-sm flex-shrink-0 ${meta.bg}`} />
              <span className="text-xs text-muted-foreground">{meta.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
