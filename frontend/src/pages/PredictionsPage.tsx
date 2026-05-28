import { Activity, Target, TrendingUp, Zap } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useModelComparison, useForecast } from "@/hooks/useRegimeData";
import { ModelComparisonTable } from "@/components/predictions/ModelComparisonTable";
import { ForecastHorizons } from "@/components/predictions/ForecastHorizons";
import { MetricCard } from "@/components/dashboard/MetricCard";

const PredictionsPage = () => {
  const { data: modelData, isLoading: modelsLoading } = useModelComparison();
  const { data: forecastData, isLoading: forecastLoading } = useForecast();

  const isLoading = modelsLoading || forecastLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading prediction models...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const bestModel = modelData?.models?.[0];
  const insights = modelData?.insights || [];

  return (
    <DashboardLayout>
      {/* Header */}
      <header className="sticky top-14 z-20 border-b border-border bg-card/50 backdrop-blur-sm md:top-0 md:z-30">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                Regime <span className="text-gradient">Predictions</span>
              </h1>
              <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                Compare 4 prediction models: Markov, HMM, Random Forest, XGBoost
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-neon-cyan/10 px-3 py-1.5 text-neon-cyan">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {modelData?.models?.length || 0} Models
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* Summary Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Best Model"
            value={bestModel?.model_name || 'Loading...'}
            change={bestModel ? bestModel.accuracy * 100 : undefined}
            changeLabel="accuracy"
            icon={<Target className="h-5 w-5" />}
            variant="neon"
          />
          <MetricCard
            title="Model Consensus"
            value={modelData?.models ? `${modelData.models.length}/4` : '...'}
            changeLabel="models agree on predictions"
            icon={<TrendingUp className="h-5 w-5" />}
            variant="success"
          />
          <MetricCard
            title="Average Accuracy"
            value={
              modelData?.models
                ? (
                    modelData.models.reduce((sum, m) => sum + m.accuracy, 0) /
                    modelData.models.length
                  ).toFixed(1) + '%'
                : '...'
            }
            changeLabel="across all models"
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricCard
            title="Predictions Evaluated"
            value={
              modelData?.models?.[0]?.total_predictions.toLocaleString() || '...'
            }
            changeLabel="test period forecasts"
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        {/* Model Comparison Table */}
        <ModelComparisonTable data={modelData} />

        {/* Forecast Horizons */}
        <ForecastHorizons forecast={forecastData} />

        {/* Key Insights */}
        {insights.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">🔍 Key Insights</h3>
            <div className="space-y-3">
              {insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <div className="mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-neon-cyan" />
                  </div>
                  <p className="text-sm text-muted-foreground flex-1">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coming Soon - Prediction Visualizations */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Prediction Timeline</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Predicted vs actual regimes over time
            </p>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
              Coming Soon
            </span>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-neon-green/10 flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-neon-green" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Confusion Matrices</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Per-model classification accuracy
            </p>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PredictionsPage;
