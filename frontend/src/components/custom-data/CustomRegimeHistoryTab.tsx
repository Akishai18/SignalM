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

interface Spell {
  regime: number;
  regime_name: string;
  color: string;
  start: string;
  end: string;
  days: number;
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

  // Compute regime spells from full history
  const spells = useMemo((): Spell[] => {
    if (!history.length) return [];
    const result: Spell[] = [];
    let spell: Spell = {
      regime: history[0].regime,
      regime_name: history[0].regime_name,
      color: history[0].color,
      start: history[0].date,
      end: history[0].date,
      days: 1,
    };
    for (let i = 1; i < history.length; i++) {
      const pt = history[i];
      if (pt.regime === spell.regime) {
        spell.end = pt.date;
        spell.days++;
      } else {
        result.push(spell);
        spell = {
          regime: pt.regime,
          regime_name: pt.regime_name,
          color: pt.color,
          start: pt.date,
          end: pt.date,
          days: 1,
        };
      }
    }
    result.push(spell);
    return result.reverse(); // most recent first
  }, [history]);

  const totalTransitions = spells.length - 1;
  const maxSpellDays = Math.max(...spells.map((s) => s.days), 1);

  return (
    <div className="space-y-5">
      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Regime Timeline</h3>
          <span className="text-xs text-muted-foreground font-mono">
            {history[0]?.date} → {history[history.length - 1]?.date} · {history.length} days
          </span>
        </div>
        <div className="flex h-10 w-full rounded-lg overflow-hidden">
          {displayHistory.map((pt, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: pt.color }}
              title={`${pt.date} — ${pt.regime_name}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 pt-0.5">
          {Object.entries(regimeLabelMap).map(([rid, name]) => (
            <div key={rid} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: regimeColorMap[rid] ?? "#6b7280" }}
              />
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Mean duration stats */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Mean Regime Duration</h3>
          <span className="text-xs text-muted-foreground">
            {totalTransitions} transition{totalTransitions !== 1 ? "s" : ""} total
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {meanDurations.map((d) => (
            <div key={d.rid} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-muted-foreground">{d.name}</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums">{d.mean.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">
                days avg · {d.total_runs} {d.total_runs === 1 ? "run" : "runs"}
              </p>
              {/* relative bar */}
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(d.mean / Math.max(...meanDurations.map(x => x.mean), 1)) * 100}%`,
                    backgroundColor: d.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regime spells */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Regime Spells</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Each contiguous regime run, most recent first</p>
          </div>
          <span className="text-xs text-muted-foreground">{spells.length} spells</span>
        </div>

        <div className="overflow-auto max-h-72">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-left text-muted-foreground border-b border-border text-xs">
                <th className="pb-2 pr-4 font-medium">Regime</th>
                <th className="pb-2 pr-4 font-medium">From</th>
                <th className="pb-2 pr-4 font-medium">To</th>
                <th className="pb-2 pr-4 font-medium">Days</th>
                <th className="pb-2 font-medium w-24">Duration</th>
              </tr>
            </thead>
            <tbody>
              {spells.map((spell, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: spell.color }} />
                      <span className="font-medium text-xs" style={{ color: spell.color }}>
                        {spell.regime_name}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{spell.start}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{spell.end}</td>
                  <td className="py-2 pr-4 text-xs font-semibold tabular-nums">{spell.days}</td>
                  <td className="py-2">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden w-24">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(spell.days / maxSpellDays) * 100}%`,
                          backgroundColor: spell.color,
                        }}
                      />
                    </div>
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
