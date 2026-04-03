interface Props {
  overview: any;
  durations?: Record<string, any>;   // from transitionsData.durations
  history?: Array<{ date: string; regime: number }>; // from historyData.history
}

export function CustomRegimeOverviewTab({ overview, durations, history }: Props) {
  const {
    current_regime,
    current_regime_name,
    regime_label_map,
    regime_color_map,
    regime_distribution,
    regime_distribution_pct,
    tickers,
    date_range,
    feature_row_count,
  } = overview;

  const totalDays = Object.values(regime_distribution as Record<string, number>).reduce(
    (a, b) => a + b,
    0
  );

  // Compute consecutive days in current regime from history tail
  const daysInCurrentRegime = (() => {
    if (!history || history.length === 0) return null;
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].regime === current_regime) count++;
      else break;
    }
    return count;
  })();

  const currentColor =
    (regime_color_map as Record<string, string>)?.[current_regime] ?? "#6b7280";

  return (
    <div className="space-y-5">
      {/* Dataset notice */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <strong className="text-foreground">Dataset-specific regimes</strong> — These 4 volatility
        regimes were fitted exclusively on your data. They are not the S&amp;P 500 regimes.
      </div>

      {/* Top row: Current regime + key stats */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        {/* Current regime card */}
        <div
          className="rounded-xl border p-5 space-y-3"
          style={{
            borderColor: currentColor + "40",
            background: currentColor + "0d",
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Current Regime
          </p>
          <div className="flex items-center gap-3">
            <div className="h-3.5 w-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentColor }} />
            <h2 className="text-2xl font-bold leading-tight">{current_regime_name}</h2>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Regime {current_regime} · Most recent observation</p>
            {daysInCurrentRegime !== null && (
              <p>
                <span
                  className="font-semibold"
                  style={{ color: currentColor }}
                >
                  {daysInCurrentRegime} day{daysInCurrentRegime !== 1 ? "s" : ""}
                </span>{" "}
                consecutively in this regime
              </p>
            )}
          </div>
        </div>

        {/* Key stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Tickers", value: tickers?.length ?? "—" },
            { label: "Trading Days", value: (feature_row_count ?? 0).toLocaleString() },
            { label: "Start", value: date_range?.start ?? "—" },
            { label: "End", value: date_range?.end ?? "—" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-semibold mt-1 font-mono tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regime distribution */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Regime Distribution</h3>
          <span className="text-xs text-muted-foreground">{totalDays} total days</span>
        </div>

        <div className="space-y-4">
          {Object.entries(regime_label_map as Record<string, string>).map(([rid, name]) => {
            const days = (regime_distribution as Record<string, number>)[rid] ?? 0;
            const pct = (regime_distribution_pct as Record<string, number>)[rid] ?? 0;
            const color = (regime_color_map as Record<string, string>)[rid] ?? "#6b7280";
            const meanDur = durations?.[rid]?.mean_duration ?? durations?.[Number(rid)]?.mean_duration;
            const isActive = Number(rid) === current_regime;

            return (
              <div key={rid} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className={isActive ? "font-semibold" : ""}>{name}</span>
                    {isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                        style={{ borderColor: color + "50", color, background: color + "15" }}>
                        current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    {meanDur != null && (
                      <span className="font-mono">~{Math.round(meanDur)}d avg</span>
                    )}
                    <span className="font-mono tabular-nums">
                      {days}d ({(pct * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ticker list */}
      {tickers && tickers.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Tickers</h3>
            <span className="text-xs text-muted-foreground">{tickers.length} total</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tickers.slice(0, 40).map((t: string) => (
              <span
                key={t}
                className="rounded-md bg-muted px-2 py-1 text-xs font-mono"
              >
                {t}
              </span>
            ))}
            {tickers.length > 40 && (
              <span className="text-xs text-muted-foreground self-center">
                +{tickers.length - 40} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
