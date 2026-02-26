import { useState } from 'react';
import { Activity, Target, TrendingUp, Zap, AlertTriangle, BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePredictions, useModelAccuracy, useIndicesPredictionsComparison } from '@/hooks/useRegimeData';
import { MetricCard } from '@/components/dashboard/MetricCard';

const REGIME_NAMES = ['Calm', 'Crisis', 'Elevated Stress', 'Transition'];
const REGIME_COLORS = {
  'Calm': 'text-emerald-500',
  'Crisis': 'text-red-500',
  'Elevated Stress': 'text-orange-500',
  'Transition': 'text-purple-500',
};

const REGIME_BG_COLORS = {
  'Calm': 'bg-emerald-500/10 border-emerald-500/20',
  'Crisis': 'bg-red-500/10 border-red-500/20',
  'Elevated Stress': 'bg-orange-500/10 border-orange-500/20',
  'Transition': 'bg-purple-500/10 border-purple-500/20',
};

const INDICES = [
  { symbol: 'SPY', name: 'S&P 500', color: 'bg-blue-500' },
  { symbol: 'QQQ', name: 'NASDAQ-100', color: 'bg-purple-500' },
  { symbol: 'DIA', name: 'Dow Jones', color: 'bg-green-500' },
  { symbol: 'IWM', name: 'Russell 2000', color: 'bg-orange-500' },
];

const PredictionsPageNew = () => {
  const [selectedIndex, setSelectedIndex] = useState('SPY');

  const { data: predictionsData, isLoading: predictionsLoading } = usePredictions(selectedIndex);
  const { data: accuracyData, isLoading: accuracyLoading } = useModelAccuracy(selectedIndex);
  const { data: comparisonData, isLoading: comparisonLoading } = useIndicesPredictionsComparison();

  const isLoading = predictionsLoading || accuracyLoading || comparisonLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading predictions...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const predictions = predictionsData?.predictions;
  const pred1d = predictions?.['1d'];
  const pred7d = predictions?.['7d'];
  const pred30d = predictions?.['30d'];

  // Check for regime divergence across indices
  const divergenceDetected = comparisonData && (() => {
    const regimes = Object.values(comparisonData.indices).map((idx: any) => idx['1d']?.predicted_regime);
    return new Set(regimes).size > 1;
  })();

  // Calculate ensemble agreement
  const ensembleAgreement = pred1d ? (() => {
    const individualPredictions = pred1d.individual_models.map(m => m.predicted_regime);
    const ensemblePrediction = pred1d.ensemble.predicted_regime;
    const agreement = individualPredictions.filter(r => r === ensemblePrediction).length;
    return (agreement / individualPredictions.length) * 100;
  })() : 0;

  // Best model from accuracy data
  const bestModel = accuracyData?.accuracies.reduce((best, current) =>
    current.train_accuracy > (best?.train_accuracy || 0) ? current : best
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-gradient">SignalM</span> Predictions
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                ML-powered regime forecasting with 4 models: Markov, HMM, RF, XGBoost
              </p>
            </div>
            <div className="flex items-center gap-2">
              {divergenceDetected && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Divergence Detected</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-cyan/10 text-neon-cyan">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {pred1d?.individual_models.length || 0} Models Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* Index Selector */}
        <div className="flex gap-2">
          {INDICES.map(({ symbol, name, color }) => (
            <button
              key={symbol}
              onClick={() => setSelectedIndex(symbol)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedIndex === symbol
                  ? `${color} text-white`
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {symbol}
              <span className="text-xs ml-2 opacity-70">{name}</span>
            </button>
          ))}
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Best Model"
            value={bestModel?.model_name || 'Loading...'}
            change={bestModel ? bestModel.train_accuracy * 100 : undefined}
            changeLabel="accuracy"
            icon={<Target className="h-5 w-5" />}
            variant="neon"
          />
          <MetricCard
            title="Model Agreement"
            value={`${ensembleAgreement.toFixed(0)}%`}
            changeLabel="models agree on forecast"
            icon={<TrendingUp className="h-5 w-5" />}
            variant={ensembleAgreement >= 75 ? 'success' : 'warning'}
          />
          <MetricCard
            title="1-Day Confidence"
            value={pred1d ? `${(pred1d.ensemble.confidence * 100).toFixed(1)}%` : '...'}
            changeLabel="ensemble confidence"
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricCard
            title="Current Regime"
            value={predictionsData?.current_regime !== null ? REGIME_NAMES[predictionsData.current_regime] : '...'}
            changeLabel="as of latest data"
            icon={<BarChart3 className="h-5 w-5" />}
          />
        </div>

        {/* Prediction Timeline Cards */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Forecast Horizons - {selectedIndex}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {/* 1-Day */}
            {pred1d && (
              <div className={`rounded-xl border p-6 ${REGIME_BG_COLORS[pred1d.ensemble.predicted_regime_name]}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">1-Day Ahead</div>
                  <div className={`text-2xl font-bold ${REGIME_COLORS[pred1d.ensemble.predicted_regime_name]}`}>
                    {pred1d.ensemble.predicted_regime_name}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Ensemble Confidence</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-neon-cyan to-neon-purple h-2 rounded-full transition-all"
                          style={{ width: `${pred1d.ensemble.confidence * 100}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium">{(pred1d.ensemble.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground mb-2">Individual Models:</div>
                    <div className="space-y-1">
                      {pred1d.individual_models.map((model, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{model.model_name}</span>
                          <span className={`font-medium ${model.predicted_regime === pred1d.ensemble.predicted_regime ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {model.predicted_regime_name} ({(model.confidence * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7-Day */}
            {pred7d && (
              <div className={`rounded-xl border p-6 ${REGIME_BG_COLORS[pred7d.ensemble.predicted_regime_name]}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">7-Day Ahead</div>
                  <div className={`text-2xl font-bold ${REGIME_COLORS[pred7d.ensemble.predicted_regime_name]}`}>
                    {pred7d.ensemble.predicted_regime_name}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Ensemble Confidence</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-neon-cyan to-neon-purple h-2 rounded-full transition-all"
                          style={{ width: `${pred7d.ensemble.confidence * 100}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium">{(pred7d.ensemble.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground mb-2">Individual Models:</div>
                    <div className="space-y-1">
                      {pred7d.individual_models.map((model, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{model.model_name}</span>
                          <span className={`font-medium ${model.predicted_regime === pred7d.ensemble.predicted_regime ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {model.predicted_regime_name} ({(model.confidence * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 30-Day */}
            {pred30d && (
              <div className={`rounded-xl border p-6 ${REGIME_BG_COLORS[pred30d.ensemble.predicted_regime_name]}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">30-Day Ahead</div>
                  <div className={`text-2xl font-bold ${REGIME_COLORS[pred30d.ensemble.predicted_regime_name]}`}>
                    {pred30d.ensemble.predicted_regime_name}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Ensemble Confidence</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-neon-cyan to-neon-purple h-2 rounded-full transition-all"
                          style={{ width: `${pred30d.ensemble.confidence * 100}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium">{(pred30d.ensemble.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground mb-2">Individual Models:</div>
                    <div className="space-y-1">
                      {pred30d.individual_models.map((model, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{model.model_name}</span>
                          <span className={`font-medium ${model.predicted_regime === pred30d.ensemble.predicted_regime ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {model.predicted_regime_name} ({(model.confidence * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Index Comparison */}
        {comparisonData && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📊 Multi-Index Comparison
              {divergenceDetected && (
                <span className="text-sm font-normal text-orange-500">(Divergence Detected!)</span>
              )}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(comparisonData.indices).map(([symbol, data]: [string, any]) => (
                <div key={symbol} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">{symbol}</div>
                  <div className="space-y-2">
                    {['1d', '7d', '30d'].map(horizon => {
                      const pred = data[horizon];
                      return pred ? (
                        <div key={horizon} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{horizon}:</span>
                          <span className={`font-medium ${REGIME_COLORS[pred.predicted_regime_name]}`}>
                            {pred.predicted_regime_name}
                          </span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model Accuracy Table */}
        {accuracyData && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Model Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Model</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Horizon</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Accuracy</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {accuracyData.accuracies.map((model, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium">{model.model_name}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{model.horizon_days}d</td>
                      <td className="py-3 px-4 text-sm text-right">
                        <span className={`font-medium ${model.train_accuracy > 0.85 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {(model.train_accuracy * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-muted-foreground">
                        {(model.mean_confidence * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PredictionsPageNew;
