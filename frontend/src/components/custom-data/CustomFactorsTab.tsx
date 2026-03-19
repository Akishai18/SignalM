import { useMemo } from "react";

interface FeaturePoint {
  date: string;
  regime: number;
  [key: string]: any;
}

interface Props {
  features: FeaturePoint[];
  regimeColorMap: Record<string, string>;
}

const FEATURE_LABELS: Record<string, string> = {
  avg_vol_126: "Avg Volatility (126d)",
  avg_vol_63: "Avg Volatility (63d)",
  avg_vol_252: "Avg Volatility (252d)",
  vol_dispersion_126: "Vol Dispersion (126d)",
  vol_dispersion_63: "Vol Dispersion (63d)",
  avg_pairwise_corr_63: "Avg Pairwise Correlation (63d)",
  PC1_var: "PC1 Variance Explained",
  cum_var_3: "Cumulative Var (PC1-3)",
  effective_dimension: "Effective Dimension",
};

function FeatureChart({
  data,
  featureKey,
  label,
  regimeColorMap,
}: {
  data: FeaturePoint[];
  featureKey: string;
  label: string;
  regimeColorMap: Record<string, string>;
}) {
  const values = data.map((d) => d[featureKey] as number).filter((v) => v != null && isFinite(v));
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Downsample
  const step = Math.max(1, Math.ceil(data.length / 300));
  const sampled = data.filter((_, i) => i % step === 0);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {min.toFixed(3)} – {max.toFixed(3)}
        </span>
      </div>
      <div className="h-10 flex items-end gap-px w-full">
        {sampled.map((pt, i) => {
          const val = pt[featureKey] as number;
          if (val == null || !isFinite(val)) return null;
          const height = ((val - min) / range) * 100;
          const color = regimeColorMap[String(pt.regime)] ?? "#6b7280";
          return (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${Math.max(2, height)}%`, backgroundColor: color, opacity: 0.8 }}
              title={`${pt.date}: ${val.toFixed(4)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CustomFactorsTab({ features, regimeColorMap }: Props) {
  const featureKeys = useMemo(() => {
    if (features.length === 0) return [];
    return Object.keys(features[0]).filter((k) => k !== "date" && k !== "regime");
  }, [features]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-6">
        <div>
          <h3 className="font-semibold">Feature Time Series</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Bar color = regime at that date. Height = feature value (normalized).
          </p>
        </div>
        {featureKeys.map((key) => (
          <FeatureChart
            key={key}
            data={features}
            featureKey={key}
            label={FEATURE_LABELS[key] ?? key}
            regimeColorMap={regimeColorMap}
          />
        ))}
      </div>

      {/* Feature legend */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h3 className="font-semibold text-sm">Feature Glossary</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {featureKeys.map((k) => (
            <div key={k} className="text-xs">
              <span className="font-mono text-primary">{k}</span>
              <span className="text-muted-foreground ml-2">{FEATURE_LABELS[k] ?? ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
