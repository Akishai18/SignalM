import { Forecast, getRegimeColor, getRegimeName } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Calendar, TrendingUp, Zap } from "lucide-react";

interface ForecastHorizonsProps {
  forecast?: Forecast;
}

export function ForecastHorizons({ forecast }: ForecastHorizonsProps) {
  if (!forecast || !forecast.horizons || forecast.horizons.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No forecast data available</p>
      </div>
    );
  }

  const currentRegime = forecast.current_regime;
  const horizons = forecast.horizons;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-neon-green/10 p-2 text-neon-green">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Regime Forecast</h3>
            <p className="text-sm text-muted-foreground">
              Multi-horizon predictions (1/7/30 days ahead)
            </p>
          </div>
        </div>
      </div>

      {/* Current Regime */}
      <div className="p-5 bg-muted/5 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Current Regime</p>
            <div className="flex items-center gap-3">
              <div
                className="h-4 w-4 rounded-full"
                style={{
                  backgroundColor: getRegimeColor(currentRegime.regime_id),
                }}
              />
              <span className="text-2xl font-bold">
                {currentRegime.regime_name}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Confidence</p>
            <span className="text-2xl font-mono font-semibold text-neon-cyan">
              {(currentRegime.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Duration</p>
            <span className="text-2xl font-mono font-semibold">
              {currentRegime.days_in_regime}d
            </span>
          </div>
        </div>
      </div>

      {/* Forecast Horizons */}
      <div className="p-5">
        <div className="grid gap-6 md:grid-cols-3">
          {horizons.map((horizon) => (
            <div
              key={horizon.horizon_days}
              className="rounded-lg border border-border p-4 bg-card hover:shadow-lg transition-all"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">
                    {horizon.horizon_days}-Day Ahead
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {(horizon.confidence * 100).toFixed(0)}% sure
                </span>
              </div>

              {/* Predicted Regime */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Predicted Regime
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: getRegimeColor(horizon.predicted_regime),
                    }}
                  />
                  <span className="font-semibold">
                    {horizon.predicted_regime_name}
                  </span>
                </div>
              </div>

              {/* Probability Distribution */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Regime Probabilities
                </p>
                {Object.entries(horizon.probabilities)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 3)
                  .map(([regimeId, prob]) => {
                    const id = parseInt(regimeId);
                    const probability = prob as number;
                    return (
                      <div key={regimeId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: getRegimeColor(id) }}
                            />
                            <span>{getRegimeName(id)}</span>
                          </div>
                          <span className="font-mono font-medium">
                            {(probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${probability * 100}%`,
                              backgroundColor: getRegimeColor(id),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Transition Indicator */}
              {horizon.predicted_regime !== currentRegime.regime_id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-neon-yellow">
                    <TrendingUp className="h-3 w-3" />
                    <span className="font-medium">Regime transition expected</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Note */}
      <div className="p-4 bg-muted/5 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          💡 Forecasts based on Markov chain baseline (historical transition probabilities).
          Feature-based models (RF/XGBoost) available for advanced analysis.
        </p>
      </div>
    </div>
  );
}
