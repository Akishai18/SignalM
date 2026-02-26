import { cn } from "@/lib/utils";
import { useFeatureImportance } from "@/hooks/useRegimeData";
import { FlipCard } from "@/components/ui/flip-card";
import { EducationCard } from "./EducationCard";

// Feature name mappings for better readability
const FEATURE_LABELS: Record<string, string> = {
  'cum_var_3_lag5': 'Cumulative Variance (3 PCs, 5d lag)',
  'avg_vol_126_lag21': 'Avg Volatility (126d, 21d lag)',
  'cum_var_3': 'Cumulative Variance (3 PCs)',
  'vol_dispersion_126': 'Volatility Dispersion (126d)',
  'effective_dimension_lag5': 'Effective Dimension (5d lag)',
  'avg_vol_126': 'Average Volatility (126d)',
  'pc1_var_lag21': 'PC1 Variance (21d lag)',
  'vol_dispersion_126_lag21': 'Vol Dispersion (126d, 21d lag)',
  'avg_correlation_lag5': 'Avg Correlation (5d lag)',
  'effective_dimension': 'Effective Dimension',
};

function formatFeatureName(feature: string): string {
  return FEATURE_LABELS[feature] || feature;
}

export function FactorExposure() {
  const { data, isLoading } = useFeatureImportance('random_forest', 5);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading feature importance...</p>
          </div>
        </div>
      </div>
    );
  }

  const features = data || [];
  const totalImportance = features.reduce((sum, f) => sum + f.importance, 0);

  const frontContent = (
    <div className="rounded-xl border border-border bg-card p-5 hover-border-glow group">
      <div className="mb-4">
        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">Top Feature Importances</h3>
        <p className="text-sm text-muted-foreground">Random Forest regime predictors (1-day horizon)</p>
      </div>

      <div className="space-y-4">
        {features.map((feature) => (
          <div key={feature.feature} className="space-y-2 hover-lift cursor-pointer px-2 py-1 -mx-2 rounded-lg">
            <div className="flex items-center justify-between text-sm gap-2">
              <span className="font-medium hover:text-primary transition-colors flex-1 min-w-0" title={feature.feature}>
                {formatFeatureName(feature.feature)}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-muted-foreground text-xs hover:text-primary transition-colors">
                  Rank #{feature.rank}
                </span>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green hover:bg-neon-green/20 hover:scale-105 transition-all">
                  {(feature.importance * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden group-hover:shadow-md transition-shadow">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-neon-cyan to-neon-green hover:shadow-lg"
                style={{
                  width: `${Math.min(feature.importance * 100 * 10, 100)}%`, // Scale for visibility
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Top {features.length} Features</span>
          <span className="font-mono font-semibold text-neon-cyan">
            {(totalImportance * 100).toFixed(1)}% cumulative
          </span>
        </div>
      </div>
    </div>
  );

  const backContent = (
    <EducationCard
      title="Feature Importance (ML Model)"
      whatItIs="This chart shows which market statistics are most important for predicting tomorrow's market regime using our Random Forest machine learning model. Higher importance means the feature has more influence on regime predictions."
      whyItMatters="Understanding which features drive regime changes helps you know what to watch. If lagged volatility is most important, it means past volatility predicts future regime shifts. If PCA variance is key, it means the correlation structure matters more than individual stock movements."
      howToRead={`• Each bar shows relative importance (scaled 10x for visibility)
• Top features have the most predictive power
• Lagged features (lag5, lag21) use historical data to predict the future
• Cumulative variance (cum_var) measures how much market movement is explained by top principal components
• Volatility dispersion measures how much individual stocks vary in their volatility

Top ${features.length} features explain ${(totalImportance * 100).toFixed(1)}% of the model's decision-making process.`}
      actionableInsight="If volatility-based features dominate, the model relies on recent turbulence to predict regimes. If correlation features lead, the model watches how assets move together. This tells you what early warning signals matter most."
      variant="neon"
    />
  );

  return <FlipCard front={frontContent} back={backContent} />;
}
