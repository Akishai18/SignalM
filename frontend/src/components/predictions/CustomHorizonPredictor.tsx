import { useState, useCallback } from 'react';
import { Zap, Clock, CheckCircle, AlertTriangle, Loader2, TrendingUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useCustomHorizonPrediction, useRegimeTrajectory } from '@/hooks/useRegimeData';
import RegimeTrajectoryChart from './RegimeTrajectoryChart';

const REGIME_NAMES: Record<number, string> = {
  0: 'Calm',
  1: 'Crisis',
  2: 'Elevated Stress',
  3: 'Transition',
};

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
        <div className="rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Custom Horizon Prediction</h3>
              <p className="text-sm text-muted-foreground">Generate regime forecasts for any timeframe</p>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 mb-6">
            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(({ label, days: presetDays }) => (
                <button
                  key={presetDays}
                  onClick={() => setDays(presetDays)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    days === presetDays
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Forecast Horizon
                </span>
                <span className="text-sm font-semibold font-mono text-primary">
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
                Show regime trajectory
              </span>
            </label>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || isFetching || trajectoryFetching}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {(isLoading || isFetching) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Generate {formatDaysLabel(days)} Prediction for {selectedIndex}
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {(isLoading || isFetching || trajectoryFetching) && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {trajectoryFetching ? 'Computing trajectory...' : 'Running all models...'}
                </p>
              </div>
            </div>
          )}

          {showResults && prediction && (
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

              {/* Trajectory Chart */}
              {showTrajectoryChart && trajectoryData && (
                <RegimeTrajectoryChart
                  points={trajectoryData.points}
                  maxHorizon={trajectoryData.max_horizon}
                />
              )}
            </div>
          )}
        </div>
      }
      back={
        <EducationCard
          title="Custom Horizon Prediction"
          whatItIs="Generate regime predictions for any timeframe from 1 day to 3 years. Uses HMM, Random Forest, and XGBoost combined into a weighted ensemble. For horizons beyond 1 year, only HMM is used as ML models are not reliable at that range."
          whyItMatters="Standard 1/7/30-day horizons don't always match your investment timeframe. Custom predictions let you align regime forecasts with your specific holding period, whether it's a 2-week options expiry or a 6-month strategic allocation."
          howToRead="The ensemble prediction shows the most likely regime with confidence. The probability bars show how likely each regime is. Individual model breakdowns reveal consensus or disagreement. Green checkmarks mean the model used an exact trained horizon; orange warnings mean it used the nearest available."
          actionableInsight="For short horizons (1-7d), predictions tend to be more accurate. For longer horizons (60d+), treat predictions as directional guidance rather than precise forecasts. When all models agree, the signal is strongest."
        />
      }
    />
  );
}
