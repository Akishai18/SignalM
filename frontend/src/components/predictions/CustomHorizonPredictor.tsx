import { useState, useCallback } from 'react';
import { Zap, Clock, CheckCircle, AlertTriangle, Loader2, TrendingUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useCustomHorizonPrediction, useRegimeTrajectory } from '@/hooks/useRegimeData';
import RegimeTrajectoryChart from './RegimeTrajectoryChart';

const REGIME_COLORS: Record<string, string> = {
  'Calm': 'text-emerald-500',
  'Crisis': 'text-red-500',
  'Elevated Stress': 'text-orange-500',
  'Transition': 'text-purple-500',
};

const REGIME_BG_COLORS: Record<string, string> = {
  'Calm': 'bg-emerald-500/10 border-emerald-500/20',
  'Crisis': 'bg-red-500/10 border-red-500/20',
  'Elevated Stress': 'bg-orange-500/10 border-orange-500/20',
  'Transition': 'bg-purple-500/10 border-purple-500/20',
};

const REGIME_BAR_COLORS: Record<string, string> = {
  'Calm': 'bg-emerald-500',
  'Crisis': 'bg-red-500',
  'Elevated Stress': 'bg-orange-500',
  'Transition': 'bg-purple-500',
};

// Quick-select presets
const PRESETS = [
  { label: '1D', days: 1 },
  { label: '1W', days: 7 },
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
  { label: '3Y', days: 1095 },
];

interface Props {
  selectedIndex: string;
}

export default function CustomHorizonPredictor({ selectedIndex }: Props) {
  const [days, setDays] = useState(14);
  const [queriedDays, setQueriedDays] = useState<number | null>(null);
  const [showTrajectory, setShowTrajectory] = useState(false);

  const { data, isLoading, isFetching, refetch } = useCustomHorizonPrediction(selectedIndex, days);
  const { data: trajectoryData, isFetching: trajectoryFetching, refetch: refetchTrajectory } = useRegimeTrajectory(selectedIndex, days);

  const handleGenerate = useCallback(() => {
    setQueriedDays(days);
    refetch();
    if (showTrajectory) {
      refetchTrajectory();
    }
  }, [days, refetch, showTrajectory, refetchTrajectory]);

  // Only show results if they match the current queried days
  const showResults = data && queriedDays === days && !isFetching;
  const prediction = data?.prediction;
  const showTrajectoryChart = showTrajectory && trajectoryData && queriedDays === days && !trajectoryFetching;
  const anyLoading = isLoading || isFetching || trajectoryFetching;

  const formatDaysLabel = (d: number) => {
    if (d === 1) return '1 day';
    if (d < 7) return `${d} days`;
    if (d === 7) return '1 week';
    if (d < 30) return `${d} days (~${(d / 7).toFixed(1)} weeks)`;
    if (d === 30) return '1 month';
    if (d < 365) return `${d} days (~${(d / 30).toFixed(1)} months)`;
    if (d === 365) return '1 year';
    if (d < 730) return `${d} days (~${(d / 365).toFixed(1)} years)`;
    if (d === 730) return '2 years';
    if (d < 1095) return `${d} days (~${(d / 365).toFixed(1)} years)`;
    if (d === 1095) return '3 years';
    return `${d} days (~${(d / 365).toFixed(1)} years)`;
  };

  return (
    <FlipCard
      front={
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.03] p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
          {/* Hero Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-3 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Regime Forecasting Engine</h2>
              <p className="text-sm text-muted-foreground">Select a timeframe and generate ML-powered regime predictions for {selectedIndex}</p>
            </div>
          </div>

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Controls */}
            <div className="space-y-5">
              {/* Preset buttons */}
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Quick Select</div>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(({ label, days: presetDays }) => (
                    <button
                      key={presetDays}
                      onClick={() => setDays(presetDays)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        days === presetDays
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Forecast Horizon
                  </span>
                  <span className="text-lg font-bold font-mono text-primary">
                    {formatDaysLabel(days)}
                  </span>
                </div>
                <Slider
                  value={[days]}
                  onValueChange={([v]) => setDays(v)}
                  min={1}
                  max={1095}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 day</span>
                  <span>3 years</span>
                </div>
              </div>

              {/* Trajectory toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setShowTrajectory(!showTrajectory)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    showTrajectory ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      showTrajectory ? 'translate-x-4' : ''
                    }`}
                  />
                </div>
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Show regime trajectory chart
                </span>
              </label>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={anyLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-base transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {anyLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {trajectoryFetching ? 'Computing Trajectory...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    Generate Prediction
                  </>
                )}
              </button>
            </div>

            {/* RIGHT: Results */}
            <div className="min-h-[200px] flex flex-col">
              {/* Empty state */}
              {!anyLoading && !showResults && (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10">
                  <div className="text-center px-6 py-8">
                    <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Select a horizon and click Generate</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Results will appear here</p>
                  </div>
                </div>
              )}

              {/* Loading */}
              {anyLoading && (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-primary/20 bg-primary/[0.02]">
                  <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {trajectoryFetching ? 'Computing trajectory...' : 'Running all models...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Results */}
              {showResults && prediction && !anyLoading && (
                <div className="space-y-4">
                  {/* Ensemble Result Card */}
                  <div className={`rounded-xl border p-5 ${REGIME_BG_COLORS[prediction.ensemble.predicted_regime_name]}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          {formatDaysLabel(prediction.requested_horizon)} Forecast
                        </div>
                        <div className={`text-2xl font-bold ${REGIME_COLORS[prediction.ensemble.predicted_regime_name]}`}>
                          {prediction.ensemble.predicted_regime_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                        <div className="text-xl font-bold font-mono">
                          {(prediction.ensemble.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Confidence bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-neon-cyan to-neon-purple h-2 rounded-full transition-all"
                          style={{ width: `${prediction.ensemble.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Probability Distribution */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="text-sm font-medium mb-3">Regime Probabilities</div>
                    <div className="space-y-2">
                      {Object.entries(prediction.ensemble.probabilities).map(([regime, prob]) => (
                        <div key={regime} className="flex items-center gap-3">
                          <span className={`text-xs font-medium w-28 ${REGIME_COLORS[regime] || 'text-muted-foreground'}`}>
                            {regime}
                          </span>
                          <div className="flex-1 bg-muted/50 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full transition-all ${REGIME_BAR_COLORS[regime] || 'bg-primary'}`}
                              style={{ width: `${(prob as number) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono w-12 text-right">
                            {((prob as number) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Individual Model Breakdown */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="text-sm font-medium mb-3">Individual Model Predictions</div>
                    <div className="space-y-2">
                      {prediction.individual_models.map((model, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{model.model_name}</span>
                            {model.metadata.exact_horizon ? (
                              <span className="flex items-center gap-0.5 text-xs text-emerald-500" title="Using exact horizon">
                                <CheckCircle className="h-3 w-3" />
                                {model.metadata.used_horizon}d
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-xs text-orange-500" title={`Using nearest trained horizon (${model.metadata.used_horizon}d)`}>
                                <AlertTriangle className="h-3 w-3" />
                                ~{model.metadata.used_horizon}d
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${REGIME_COLORS[model.predicted_regime_name]}`}>
                              {model.predicted_regime_name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {(model.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Approximation Notice */}
                  {prediction.individual_models.some(m => !m.metadata.exact_horizon) && (
                    <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        <div className="text-xs text-orange-500">
                          <span className="font-medium">Horizon Approximation: </span>
                          {prediction.individual_models
                            .filter(m => !m.metadata.exact_horizon)
                            .map(m => `${m.model_name} used ${m.metadata.used_horizon}d model`)
                            .join(', ')}
                          {' '}(nearest trained horizon to your {prediction.requested_horizon}d request).
                          HMM uses the exact {prediction.requested_horizon}d horizon.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Trajectory Chart - Full Width Below */}
          {showTrajectoryChart && trajectoryData && (
            <div className="mt-6">
              <RegimeTrajectoryChart
                points={trajectoryData.points}
                maxHorizon={trajectoryData.max_horizon}
              />
            </div>
          )}
        </div>
      }
      back={
        <EducationCard
          title="Regime Forecasting Engine"
          whatItIs="Generate regime predictions for any timeframe from 1 day to 3 years. Uses HMM, Random Forest, and XGBoost combined into a weighted ensemble. For horizons beyond 1 year, only HMM is used as ML models are not reliable at that range."
          whyItMatters="Standard 1/7/30-day horizons don't always match your investment timeframe. Custom predictions let you align regime forecasts with your specific holding period, whether it's a 2-week options expiry or a 6-month strategic allocation."
          howToRead="The ensemble prediction shows the most likely regime with confidence. The probability bars show how likely each regime is. Individual model breakdowns reveal consensus or disagreement. Green checkmarks mean the model used an exact trained horizon; orange warnings mean it used the nearest available."
          actionableInsight="For short horizons (1-7d), predictions tend to be more accurate. For longer horizons (60d+), treat predictions as directional guidance rather than precise forecasts. When all models agree, the signal is strongest."
        />
      }
    />
  );
}
