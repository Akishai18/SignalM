import { useState } from 'react';
import { Activity, Target, TrendingUp, Zap, AlertTriangle, BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePredictions, useModelAccuracy, useIndicesPredictionsComparison } from '@/hooks/useRegimeData';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import CustomHorizonPredictor from '@/components/predictions/CustomHorizonPredictor';
import TransitionMatrixHeatmap from '@/components/predictions/TransitionMatrixHeatmap';
import RegimeDurationStats from '@/components/predictions/RegimeDurationStats';
import BacktestChart from '@/components/predictions/BacktestChart';
import ConfidenceSparklines from '@/components/predictions/ConfidenceSparklines';
import WhatIfScenario from '@/components/predictions/WhatIfScenario';
import ExportButton from '@/components/predictions/ExportButton';
import { computeWeightedEnsemble } from '@/lib/ensemble';

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

  // Reweighted ensembles (HMM 70%, RF 15%, XGB 15%)
  const ensemble1d = pred1d ? computeWeightedEnsemble(pred1d.individual_models) : null;
  const ensemble7d = pred7d ? computeWeightedEnsemble(pred7d.individual_models) : null;
  const ensemble30d = pred30d ? computeWeightedEnsemble(pred30d.individual_models) : null;

  // Check for regime divergence across indices
  const divergenceDetected = comparisonData && (() => {
    const regimes = Object.values(comparisonData.indices).map((idx: any) => idx['1d']?.predicted_regime);
    return new Set(regimes).size > 1;
  })();

  // Calculate ensemble agreement against reweighted ensemble (excluding Markov)
  const ensembleAgreement = pred1d && ensemble1d ? (() => {
    const filteredModels = pred1d.individual_models.filter(m => !m.model_name.toLowerCase().includes('markov'));
    const agreement = filteredModels.filter(m => m.predicted_regime === ensemble1d.predicted_regime).length;
    return filteredModels.length > 0 ? (agreement / filteredModels.length) * 100 : 0;
  })() : 0;

  // HMM mean confidence averaged across horizons
  const hmmConfidence = (() => {
    if (!accuracyData?.accuracies) return undefined;
    const hmmEntries = accuracyData.accuracies.filter(m => m.model_name.toLowerCase().includes('hmm'));
    if (!hmmEntries.length) return undefined;
    return hmmEntries.reduce((sum, m) => sum + m.mean_confidence, 0) / hmmEntries.length;
  })();

  return (
    <DashboardLayout>
      {/* Sticky Header with Index Selector */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-gradient">SignalM</span> Predictions
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                ML-powered regime forecasting with 3 models
              </p>
            </div>
            <div className="flex items-center gap-2">
              {INDICES.map(({ symbol, name, color }) => (
                <button
                  key={symbol}
                  onClick={() => setSelectedIndex(symbol)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedIndex === symbol
                      ? `${color} text-white shadow-md`
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {symbol}
                  <span className="text-xs ml-1.5 opacity-70 hidden lg:inline">{name}</span>
                </button>
              ))}
              <div className="w-px h-6 bg-border mx-1" />
              <ExportButton selectedIndex={selectedIndex} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* Status Badges */}
        <div className="flex items-center gap-2 justify-end -mb-2">
          {divergenceDetected && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Divergence Detected</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-cyan/10 text-neon-cyan">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">
              {pred1d?.individual_models.filter(m => !m.model_name.toLowerCase().includes('markov')).length || 0} Models Active
            </span>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Model"
            value="HMM"
            change={hmmConfidence ? hmmConfidence * 100 : undefined}
            changeLabel="avg confidence"
            icon={<Target className="h-5 w-5" />}
            variant="neon"
            educational={{
              title: "Primary Model: HMM",
              whatItIs: "Hidden Markov Model — a probabilistic sequence model that treats market regimes as hidden states evolving over time.",
              whyItMatters: "Unlike RF/XGBoost which predict regimes from features alone, HMM explicitly models state transitions: P(next regime | current regime). This means it accounts for where the market is right now, not just what features look like.",
              howToRead: "The percentage shown is HMM's average accuracy across all forecast horizons. Because HMM conditions on the current regime state, it is significantly more responsive during stress periods than tree-based models.",
              actionableInsight: "HMM predictions are most reliable during regime transitions and stress periods. RF/XGBoost tend to anchor toward Calm due to class imbalance in historical data.",
              variant: "neon",
            }}
          />
          <MetricCard
            title="Model Agreement"
            value={`${ensembleAgreement.toFixed(0)}%`}
            changeLabel="models agree on forecast"
            icon={<TrendingUp className="h-5 w-5" />}
            variant={ensembleAgreement >= 75 ? 'success' : 'warning'}
            educational={{
              title: "Model Agreement",
              whatItIs: "The percentage of individual ML models (HMM, Random Forest, XGBoost) that agree with the ensemble's 1-day regime prediction. The ensemble combines all models via weighted voting.",
              whyItMatters: "High agreement (75%+) suggests strong conviction in the forecast direction. Low agreement indicates uncertainty — models are seeing conflicting signals in the data, which itself is valuable information.",
              howToRead: "Green means 75%+ agreement (strong consensus). Yellow/orange means models disagree. 100% means all models predict the same regime.",
              actionableInsight: "When agreement is high, you can be more confident in position sizing. When low, consider reducing exposure or hedging until signals converge.",
              variant: "success",
            }}
          />
          <MetricCard
            title="1-Day Confidence"
            value={ensemble1d ? `${(ensemble1d.confidence * 100).toFixed(1)}%` : '...'}
            changeLabel="ensemble confidence"
            icon={<Activity className="h-5 w-5" />}
            educational={{
              title: "1-Day Confidence",
              whatItIs: "The ensemble model's probability assigned to its predicted regime for the next trading day. This is the weighted average of each model's confidence in the consensus prediction.",
              whyItMatters: "Confidence reflects how certain the combined models are about tomorrow's market regime. Higher confidence means the models' probability distributions are concentrated on one regime rather than spread across several.",
              howToRead: "Values above 60% indicate strong conviction. Values near 25% (for 4 regimes) suggest near-random uncertainty. The confidence bar visually represents this probability.",
              actionableInsight: "Pair high confidence with high agreement for the strongest signals. Low confidence forecasts may warrant a wait-and-see approach.",
            }}
          />
          <MetricCard
            title="Current Regime"
            value={predictionsData?.current_regime !== null ? REGIME_NAMES[predictionsData.current_regime] : '...'}
            changeLabel="as of latest data"
            icon={<BarChart3 className="h-5 w-5" />}
            educational={{
              title: "Current Regime",
              whatItIs: "The market regime identified by the clustering model based on the most recent data. Regimes are: Calm (low vol, steady growth), Crisis (high vol, sharp declines), Elevated Stress (above-average vol), and Transition (regime shift underway).",
              whyItMatters: "The current regime sets the baseline context for all predictions. Knowing where the market is now helps you interpret where models think it's heading and how to position accordingly.",
              howToRead: "Green (Calm) = favorable conditions. Red (Crisis) = defensive positioning needed. Orange (Elevated Stress) = caution. Purple (Transition) = regime change in progress, expect volatility.",
              actionableInsight: "Use the current regime to calibrate your risk exposure. Calm regimes favor growth assets; Crisis regimes favor defensive positions and hedges.",
            }}
          />
        </div>

        {/* Prediction Timeline Cards */}
        <FlipCard
          front={
          <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Forecast Horizons - {selectedIndex}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {/* 1-Day */}
            {pred1d && ensemble1d && (
              <div className={`rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 ${REGIME_BG_COLORS[ensemble1d.predicted_regime_name]}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">1-Day Ahead</div>
                  <div className={`text-2xl font-bold ${REGIME_COLORS[ensemble1d.predicted_regime_name]}`}>
                    {ensemble1d.predicted_regime_name}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Ensemble Confidence</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-neon-cyan to-neon-purple h-2 rounded-full transition-all"
                          style={{ width: `${ensemble1d.confidence * 100}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium">{(ensemble1d.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground mb-2">Individual Models:</div>
                    <div className="space-y-1">
                      {pred1d.individual_models
                        .filter((model) => !model.model_name.toLowerCase().includes('markov'))
                        .map((model, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{model.model_name}</span>
                          <span className={`font-medium ${REGIME_COLORS[model.predicted_regime_name] ?? 'text-foreground'}`}>
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
            {pred7d && ensemble7d && (
              <div className={`rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 ${REGIME_BG_COLORS[ensemble7d.predicted_regime_name]}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">7-Day Ahead</div>
                  <div className={`text-2xl font-bold ${REGIME_COLORS[ensemble7d.predicted_regime_name]}`}>
                    {ensemble7d.predicted_regime_name}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Ensemble Confidence</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-neon-cyan to-neon-purple h-2 rounded-full transition-all"
                          style={{ width: `${ensemble7d.confidence * 100}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium">{(ensemble7d.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground mb-2">Individual Models:</div>
                    <div className="space-y-1">
                      {pred7d.individual_models
                        .filter((model) => !model.model_name.toLowerCase().includes('markov'))
                        .map((model, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{model.model_name}</span>
                          <span className={`font-medium ${REGIME_COLORS[model.predicted_regime_name] ?? 'text-foreground'}`}>
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
            {pred30d && ensemble30d && (
              <div className={`rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 ${REGIME_BG_COLORS[ensemble30d.predicted_regime_name]}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-muted-foreground">30-Day Ahead</div>
                  <div className={`text-2xl font-bold ${REGIME_COLORS[ensemble30d.predicted_regime_name]}`}>
                    {ensemble30d.predicted_regime_name}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Ensemble Confidence</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-neon-cyan to-neon-purple h-2 rounded-full transition-all"
                          style={{ width: `${ensemble30d.confidence * 100}%` }}
                        />
                      </div>
                      <div className="text-sm font-medium">{(ensemble30d.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground mb-2">Individual Models:</div>
                    <div className="space-y-1">
                      {pred30d.individual_models
                        .filter((model) => !model.model_name.toLowerCase().includes('markov'))
                        .map((model, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{model.model_name}</span>
                          <span className={`font-medium ${REGIME_COLORS[model.predicted_regime_name] ?? 'text-foreground'}`}>
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
          }
          back={
            <EducationCard
              title="Forecast Horizons"
              whatItIs="Regime predictions for 3 time horizons: 1-day, 7-day, and 30-day ahead. Each forecast shows the ensemble prediction (weighted vote of HMM, Random Forest, and XGBoost) along with individual model predictions."
              whyItMatters="Different horizons serve different purposes. 1-day forecasts guide short-term tactical decisions (hedging, position sizing). 7-day forecasts help with weekly portfolio rebalancing. 30-day forecasts inform strategic allocation shifts."
              howToRead="The large colored label shows the predicted regime. The confidence bar shows how certain the ensemble is. Below, individual model predictions are color-coded by regime: green = Calm, orange = Elevated Stress, red = Crisis, purple = Transition."
              actionableInsight="When all 3 horizons predict the same regime, the signal is strongest. When short-term and long-term diverge, a regime transition may be underway."
            />
          }
        />

        {/* Multi-Index Comparison */}
        {comparisonData && (
          <FlipCard
            front={
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Multi-Index Comparison
                {divergenceDetected && (
                  <span className="text-sm font-normal text-orange-500">(Divergence Detected!)</span>
                )}
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Object.entries(comparisonData.indices).map(([symbol, data]: [string, any]) => (
                  <div key={symbol} className="rounded-lg border border-border bg-muted/30 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
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
            }
            back={
              <EducationCard
                title="Multi-Index Comparison"
                whatItIs="Side-by-side regime predictions for 4 major indices: SPY (S&P 500), QQQ (NASDAQ-100), DIA (Dow Jones), and IWM (Russell 2000). Each index has its own trained models using index-specific features."
                whyItMatters="Different indices can be in different regimes simultaneously. For example, tech-heavy QQQ may show stress while defensive DIA remains calm. These divergences reveal sector rotation opportunities and cross-market risk signals."
                howToRead="Each index card shows regime predictions for all 3 horizons. When a 'Divergence Detected' badge appears, at least two indices predict different 1-day regimes — this signals cross-market disagreement and potential opportunity."
                actionableInsight="Divergence between indices often precedes major market moves. If large-cap indices (SPY, DIA) show calm while small-caps (IWM) show stress, it may signal deteriorating market breadth."
              />
            }
          />
        )}

        {/* Custom Horizon Prediction - Hero Section */}
        <CustomHorizonPredictor selectedIndex={selectedIndex} />

        {/* Transition Matrix + Duration Stats - Side by Side */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TransitionMatrixHeatmap selectedIndex={selectedIndex} />
          <RegimeDurationStats selectedIndex={selectedIndex} />
        </div>

        {/* Backtest + Confidence Sparklines - Side by Side */}
        <div className="grid gap-6 lg:grid-cols-2">
          <BacktestChart selectedIndex={selectedIndex} />
          <ConfidenceSparklines selectedIndex={selectedIndex} />
        </div>

        {/* What If Scenario Tool */}
        <WhatIfScenario selectedIndex={selectedIndex} />

        {/* Model Accuracy Table */}
        {accuracyData && (
          <FlipCard
            front={
            <div className="rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
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
                    {accuracyData.accuracies.filter(m => [1, 7, 30].includes(m.horizon_days)).map((model, idx) => (
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
            }
            back={
              <EducationCard
                title="Model Performance"
                whatItIs="A detailed breakdown of each ML model's accuracy and confidence across all forecast horizons. Includes all models (HMM, Random Forest, XGBoost, and Markov) for full transparency, even though Markov is excluded from active predictions."
                whyItMatters="Understanding individual model performance helps you assess ensemble reliability. If one model significantly outperforms others, its predictions carry more weight in the ensemble. The table also reveals which horizons are easier or harder to predict."
                howToRead="Accuracy shows the percentage of correct regime predictions during backtesting (70/30 train/test split). Green (>85%) indicates strong performance. Confidence is the average probability the model assigns to its predictions — higher confidence with high accuracy means a well-calibrated model."
                actionableInsight="Compare accuracy across horizons: if 1-day accuracy is high but 30-day is low, trust short-term forecasts more. Models with high accuracy but low confidence may be underconfident — still reliable but conservative in their estimates."
              />
            }
          />
        )}

      </div>
    </DashboardLayout>
  );
};

export default PredictionsPageNew;
