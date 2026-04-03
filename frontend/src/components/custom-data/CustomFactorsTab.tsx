import { useMemo, useRef, useState, useCallback } from "react";

interface FeaturePoint {
  date: string;
  regime: number;
  [key: string]: any;
}

interface Props {
  features: FeaturePoint[];
  regimeColorMap: Record<string, string>;
  regimeLabelMap?: Record<string, string>;
}

const FEATURE_META: Record<string, { label: string; description: string }> = {
  avg_vol_126: {
    label: "Avg Volatility (126d)",
    description: "Mean 6-month rolling volatility across all tickers. Higher = more turbulent market.",
  },
  avg_vol_63: {
    label: "Avg Volatility (63d)",
    description: "Mean 3-month rolling volatility across all tickers.",
  },
  avg_vol_252: {
    label: "Avg Volatility (252d)",
    description: "Mean 1-year rolling volatility across all tickers.",
  },
  vol_dispersion_126: {
    label: "Vol Dispersion (126d)",
    description: "Spread in volatility across tickers. High dispersion = cross-sectional divergence.",
  },
  vol_dispersion_63: {
    label: "Vol Dispersion (63d)",
    description: "Short-term spread in volatility across tickers.",
  },
  avg_pairwise_corr_63: {
    label: "Avg Pairwise Correlation (63d)",
    description: "Average correlation between all ticker pairs over 63 days. Spikes during stress as assets move together.",
  },
  PC1_var: {
    label: "PC1 Variance Explained",
    description: "Fraction of total variance captured by the first principal component. High = market moves dominated by one factor.",
  },
  cum_var_3: {
    label: "Cumulative Var (PC1–3)",
    description: "Variance explained by the top 3 principal components combined.",
  },
  effective_dimension: {
    label: "Effective Dimension",
    description: "Entropy-based measure of how many independent factors drive returns. Low = concentrated risk.",
  },
};

interface HoverState {
  idx: number;
  x: number; // 0–1 fraction across container
}

function FeatureChart({
  data,
  featureKey,
  meta,
  regimeColorMap,
  regimeLabelMap,
}: {
  data: FeaturePoint[];
  featureKey: string;
  meta: { label: string; description: string };
  regimeColorMap: Record<string, string>;
  regimeLabelMap?: Record<string, string>;
}) {
  const values = data.map((d) => d[featureKey] as number).filter((v) => v != null && isFinite(v));
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const latestVal = data[data.length - 1]?.[featureKey] as number | null;

  const regimeAvgs = useMemo(() => {
    const sums: Record<number, number> = {};
    const counts: Record<number, number> = {};
    for (const pt of data) {
      const val = pt[featureKey] as number;
      if (val == null || !isFinite(val)) continue;
      sums[pt.regime] = (sums[pt.regime] ?? 0) + val;
      counts[pt.regime] = (counts[pt.regime] ?? 0) + 1;
    }
    return Object.entries(sums).map(([rid, sum]) => ({
      rid: parseInt(rid),
      avg: sum / counts[parseInt(rid)],
      color: regimeColorMap[rid] ?? "#6b7280",
    }));
  }, [data, featureKey, regimeColorMap]);

  // Downsample
  const step = Math.max(1, Math.ceil(data.length / 300));
  const sampled = useMemo(() => data.filter((_, i) => i % step === 0), [data, step]);

  // Hover state
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(sampled.length - 1, Math.max(0, Math.floor(x * sampled.length)));
    setHover({ idx, x });
  }, [sampled.length]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  const hoveredPt = hover != null ? sampled[hover.idx] : null;
  const hoveredVal = hoveredPt ? (hoveredPt[featureKey] as number) : null;
  const hoveredColor = hoveredPt ? (regimeColorMap[String(hoveredPt.regime)] ?? "#6b7280") : null;
  const hoveredRegimeName = hoveredPt
    ? (regimeLabelMap?.[String(hoveredPt.regime)] ?? `Regime ${hoveredPt.regime}`)
    : null;

  // Tooltip: flip to left side when near right edge
  const tooltipOnLeft = hover != null && hover.x > 0.65;

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <span className="text-sm font-medium">{meta.label}</span>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
        <div className="flex-shrink-0 text-right space-y-0.5">
          {hoveredVal != null ? (
            <p className="text-sm font-mono font-semibold tabular-nums transition-all" style={{ color: hoveredColor ?? undefined }}>
              {hoveredVal.toFixed(3)}
            </p>
          ) : latestVal != null ? (
            <p className="text-sm font-mono font-semibold tabular-nums text-foreground">
              {latestVal.toFixed(3)}
            </p>
          ) : null}
          <p className="text-[10px] text-muted-foreground font-mono">
            {min.toFixed(3)} – {max.toFixed(3)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="relative h-16 flex items-end gap-px w-full cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {sampled.map((pt, i) => {
          const val = pt[featureKey] as number;
          if (val == null || !isFinite(val)) return null;
          const height = ((val - min) / range) * 100;
          const color = regimeColorMap[String(pt.regime)] ?? "#6b7280";
          const isHovered = hover?.idx === i;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-opacity duration-75"
              style={{
                height: `${Math.max(2, height)}%`,
                backgroundColor: color,
                opacity: hover == null ? 0.85 : isHovered ? 1 : 0.35,
                transform: isHovered ? "scaleY(1.05)" : undefined,
                transformOrigin: "bottom",
              }}
            />
          );
        })}

        {/* Crosshair line */}
        {hover != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
            style={{ left: `${hover.x * 100}%` }}
          />
        )}

        {/* Tooltip */}
        {hover != null && hoveredPt && hoveredVal != null && (
          <div
            className="absolute bottom-full mb-2 pointer-events-none z-10"
            style={{
              [tooltipOnLeft ? "right" : "left"]: `${tooltipOnLeft ? (1 - hover.x) * 100 : hover.x * 100}%`,
              transform: tooltipOnLeft ? "translateX(0)" : "translateX(-50%)",
            }}
          >
            <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-xl text-xs whitespace-nowrap">
              <p className="font-mono text-muted-foreground mb-1">{hoveredPt.date}</p>
              <p className="font-semibold font-mono tabular-nums" style={{ color: hoveredColor ?? undefined }}>
                {hoveredVal.toFixed(4)}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hoveredColor ?? undefined }} />
                <span className="text-muted-foreground">{hoveredRegimeName}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Per-regime averages */}
      <div className="flex flex-wrap gap-3 pt-0.5">
        {regimeAvgs.map(({ rid, avg, color }) => (
          <div key={rid} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-mono tabular-nums">{avg.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomFactorsTab({ features, regimeColorMap, regimeLabelMap }: Props) {
  const featureKeys = useMemo(() => {
    if (features.length === 0) return [];
    return Object.keys(features[0]).filter((k) => k !== "date" && k !== "regime");
  }, [features]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Feature Time Series</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hover to inspect · Bar color = regime · Dots below = per-regime average
          </p>
        </div>
        <div className="space-y-3">
          {featureKeys.map((key) => (
            <FeatureChart
              key={key}
              data={features}
              featureKey={key}
              meta={FEATURE_META[key] ?? { label: key, description: "" }}
              regimeColorMap={regimeColorMap}
              regimeLabelMap={regimeLabelMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
