interface Props {
  overview: any;
}

const REGIME_COLORS: Record<number, string> = {
  0: "#10b981",
  1: "#8b5cf6",
  2: "#f59e0b",
  3: "#ef4444",
};

export function CustomRegimeOverviewTab({ overview }: Props) {
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

  return (
    <div className="space-y-6">
      {/* Dataset notice */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <strong className="text-foreground">Dataset-specific regimes</strong> — These 4 volatility
        regimes were fitted exclusively on your data. They are not the S&amp;P 500 regimes.
      </div>

      {/* Current regime card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
          Current Regime
        </p>
        <div className="flex items-center gap-3">
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: regime_color_map?.[current_regime] ?? "#6b7280" }}
          />
          <h2 className="text-2xl font-bold">{current_regime_name}</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Regime {current_regime} · Most recent observation
        </p>
      </div>

      {/* Regime distribution */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Regime Distribution</h3>
        {Object.entries(regime_label_map as Record<string, string>).map(([rid, name]) => {
          const days = (regime_distribution as Record<string, number>)[rid] ?? 0;
          const pct = (regime_distribution_pct as Record<string, number>)[rid] ?? 0;
          const color = (regime_color_map as Record<string, string>)[rid] ?? "#6b7280";
          return (
            <div key={rid} className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span>{name}</span>
                </div>
                <span className="text-muted-foreground">
                  {days} days ({(pct * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Tickers", value: tickers?.length ?? "—" },
          { label: "Trading Days", value: (feature_row_count ?? 0).toLocaleString() },
          { label: "Start", value: date_range?.start ?? "—" },
          { label: "End", value: date_range?.end ?? "—" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-semibold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Ticker list */}
      {tickers && tickers.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <h3 className="font-semibold text-sm">Tickers</h3>
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
