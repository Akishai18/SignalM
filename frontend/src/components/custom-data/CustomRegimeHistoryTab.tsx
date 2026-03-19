import { useMemo } from "react";

interface HistoryPoint {
  date: string;
  regime: number;
  regime_name: string;
  color: string;
}

interface Props {
  history: HistoryPoint[];
  regimeLabelMap: Record<string, string>;
  regimeColorMap: Record<string, string>;
}

export function CustomRegimeHistoryTab({ history, regimeLabelMap, regimeColorMap }: Props) {
  // Downsample for display (max 500 bars)
  const displayHistory = useMemo(() => {
    if (history.length <= 500) return history;
    const step = Math.ceil(history.length / 500);
    return history.filter((_, i) => i % step === 0);
  }, [history]);

  // Compute mean durations per regime
  const meanDurations = useMemo(() => {
    const runs: Record<number, number[]> = {};
    let currentRegime = displayHistory[0]?.regime;
    let runLen = 0;
    for (const pt of displayHistory) {
      if (pt.regime === currentRegime) {
        runLen++;
      } else {
        if (currentRegime !== undefined) {
          runs[currentRegime] = runs[currentRegime] ?? [];
          runs[currentRegime].push(runLen);
        }
        currentRegime = pt.regime;
        runLen = 1;
      }
    }
    if (currentRegime !== undefined && runLen > 0) {
      runs[currentRegime] = runs[currentRegime] ?? [];
      runs[currentRegime].push(runLen);
    }
    return Object.entries(runs).map(([rid, lengths]) => ({
      rid: parseInt(rid),
      name: regimeLabelMap[rid] ?? `Regime ${rid}`,
      color: regimeColorMap[rid] ?? "#6b7280",
      mean: lengths.reduce((a, b) => a + b, 0) / lengths.length,
      total_runs: lengths.length,
    }));
  }, [displayHistory, regimeLabelMap, regimeColorMap]);

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Regime Timeline</h3>
        <p className="text-xs text-muted-foreground">
          {history[0]?.date} → {history[history.length - 1]?.date} ({history.length} days)
        </p>
        <div className="flex h-8 w-full rounded overflow-hidden">
          {displayHistory.map((pt, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: pt.color }}
              title={`${pt.date} — ${pt.regime_name}`}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 pt-1">
          {Object.entries(regimeLabelMap).map(([rid, name]) => (
            <div key={rid} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: regimeColorMap[rid] ?? "#6b7280" }}
              />
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Mean duration stats */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Mean Regime Duration</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {meanDurations.map((d) => (
            <div key={d.rid} className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-muted-foreground">{d.name}</span>
              </div>
              <p className="text-2xl font-bold">{d.mean.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">days avg · {d.total_runs} runs</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent history table */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold">Recent Observations</h3>
        <div className="overflow-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 font-medium">Regime</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().slice(0, 30).map((pt) => (
                <tr key={pt.date} className="border-b border-border/30">
                  <td className="py-1.5 pr-4 text-muted-foreground">{pt.date}</td>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: pt.color }}
                      />
                      {pt.regime_name}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
