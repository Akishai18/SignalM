import { useState, useCallback } from 'react';
import { Zap, Loader2, ArrowRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { FlipCard } from '@/components/ui/flip-card';
import { EducationCard } from '@/components/dashboard/EducationCard';
import { useWhatIfPrediction } from '@/hooks/useRegimeData';

const REGIME_COLORS: Record<string, string> = {
  'Calm': 'text-emerald-500',
  'Crisis': 'text-red-500',
  'Elevated Stress': 'text-orange-500',
  'Transition': 'text-purple-500',
};

const REGIME_BG: Record<string, string> = {
  'Calm': 'bg-emerald-500/10 border-emerald-500/20',
  'Crisis': 'bg-red-500/10 border-red-500/20',
  'Elevated Stress': 'bg-orange-500/10 border-orange-500/20',
  'Transition': 'bg-purple-500/10 border-purple-500/20',
};

const SLIDERS = [
  { key: 'vol_delta' as const, label: 'Volatility', min: -50, max: 300, step: 10, unit: '%', riskUp: true },
  { key: 'corr_delta' as const, label: 'Correlation', min: -50, max: 200, step: 10, unit: '%', riskUp: true },
  { key: 'returns_delta' as const, label: 'Returns Shock', min: -10, max: 10, step: 0.5, unit: '%', riskUp: false },
  { key: 'drawdown_delta' as const, label: 'Drawdown', min: -30, max: 0, step: 1, unit: '%', riskUp: false },
  { key: 'momentum_delta' as const, label: 'Momentum', min: -50, max: 50, step: 5, unit: '%', riskUp: false },
];

interface Props {
  selectedIndex: string;
}

type Params = { vol_delta: number; corr_delta: number; returns_delta: number; drawdown_delta: number; momentum_delta: number };

export default function WhatIfScenario({ selectedIndex }: Props) {
  const [params, setParams] = useState<Params>({
    vol_delta: 0, corr_delta: 0, returns_delta: 0, drawdown_delta: 0, momentum_delta: 0,
  });

  const { data, isFetching, refetch } = useWhatIfPrediction(selectedIndex, params);

  const handleRun = useCallback(() => { refetch(); }, [refetch]);

  const hasChanges = Object.values(params).some(v => v !== 0);

  const handlePreset = (preset: Partial<Params>) => {
    setParams({ vol_delta: 0, corr_delta: 0, returns_delta: 0, drawdown_delta: 0, momentum_delta: 0, ...preset });
  };

  const frontContent = (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.03] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">"What If" Scenario Tool</h3>
          <p className="text-xs text-muted-foreground">
            Stress-test with HMM, RF & XGBoost (feature-sensitive models)
          </p>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider self-center mr-1">Presets:</span>
        <button onClick={() => handlePreset({ vol_delta: 150, corr_delta: 100, returns_delta: -5, drawdown_delta: -15 })}
          className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
          Market Crash
        </button>
        <button onClick={() => handlePreset({ vol_delta: 50, corr_delta: 30, returns_delta: -2 })}
          className="px-2 py-1 rounded text-[10px] font-medium bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors">
          Mild Stress
        </button>
        <button onClick={() => handlePreset({ vol_delta: -30, corr_delta: -20, returns_delta: 3, momentum_delta: 20 })}
          className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors">
          Bull Rally
        </button>
        <button onClick={() => handlePreset({})}
          className="px-2 py-1 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Controls */}
        <div className="space-y-3">
          {SLIDERS.map(({ key, label, min, max, step, riskUp }) => {
            const val = params[key];
            const isRisky = riskUp ? val > 0 : val < 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-mono font-bold ${isRisky ? 'text-red-500' : val !== 0 ? 'text-emerald-500' : ''}`}>
                    {val > 0 ? '+' : ''}{val}%
                  </span>
                </div>
                <Slider
                  value={[val]}
                  onValueChange={([v]) => setParams(p => ({ ...p, [key]: v }))}
                  min={min}
                  max={max}
                  step={step}
                />
              </div>
            );
          })}

          <button
            onClick={handleRun}
            disabled={isFetching || !hasChanges}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-sm transition-all hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isFetching ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running Scenario...</>
            ) : (
              <><Zap className="h-4 w-4" /> Run Scenario</>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="min-h-[200px] flex flex-col">
          {!data && !isFetching && (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10">
              <div className="text-center px-4 py-6">
                <Zap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Adjust sliders or pick a preset, then Run</p>
              </div>
            </div>
          )}

          {isFetching && (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-primary/20 bg-primary/[0.02]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {data && !isFetching && (
            <div className="space-y-3">
              {/* Baseline vs Scenario */}
              <div className="flex items-center gap-3">
                <div className={`flex-1 rounded-lg border p-3 ${REGIME_BG[data.baseline.predicted_regime_name] ?? ''}`}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Baseline</div>
                  <div className={`text-lg font-bold ${REGIME_COLORS[data.baseline.predicted_regime_name] ?? ''}`}>
                    {data.baseline.predicted_regime_name}
                  </div>
                  <div className="text-xs font-mono">{(data.baseline.confidence * 100).toFixed(1)}%</div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className={`flex-1 rounded-lg border p-3 ${REGIME_BG[data.scenario.predicted_regime_name] ?? ''}`}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Scenario</div>
                  <div className={`text-lg font-bold ${REGIME_COLORS[data.scenario.predicted_regime_name] ?? ''}`}>
                    {data.scenario.predicted_regime_name}
                  </div>
                  <div className="text-xs font-mono">{(data.scenario.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              {data.baseline.predicted_regime_name !== data.scenario.predicted_regime_name && (
                <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2 text-center">
                  <span className="text-xs text-orange-500 font-medium">
                    Regime shift detected under this scenario!
                  </span>
                </div>
              )}

              {/* Per-model breakdown */}
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium mb-2">Per-Model Results</div>
                <div className="space-y-1.5">
                  {data.scenario_models.map((scenModel, i) => {
                    const baseModel = data.baseline_models[i];
                    return (
                      <div key={scenModel.model_name} className="flex items-center justify-between text-xs">
                        <span className="font-medium w-28">{scenModel.model_name}</span>
                        <div className="flex items-center gap-2">
                          {baseModel && (
                            <span className={`${REGIME_COLORS[baseModel.predicted_regime_name] ?? ''}`}>
                              {baseModel.predicted_regime_name}
                            </span>
                          )}
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className={`font-bold ${REGIME_COLORS[scenModel.predicted_regime_name] ?? ''}`}>
                            {scenModel.predicted_regime_name}
                          </span>
                          <span className="text-muted-foreground font-mono">
                            {(scenModel.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Probability comparison */}
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-xs font-medium mb-2">Probability Shift</div>
                <div className="space-y-1.5">
                  {Object.entries(data.scenario.probabilities).map(([regime, scenProb]) => {
                    const baseProb = data.baseline.probabilities[regime] ?? 0;
                    const diff = (scenProb as number) - baseProb;
                    return (
                      <div key={regime} className="flex items-center gap-2 text-xs">
                        <span className={`w-24 ${REGIME_COLORS[regime] ?? ''}`}>{regime}</span>
                        <span className="font-mono w-12 text-right">{((scenProb as number) * 100).toFixed(1)}%</span>
                        <span className={`font-mono text-[10px] ${diff > 0.001 ? 'text-red-400' : diff < -0.001 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                          ({diff > 0 ? '+' : ''}{(diff * 100).toFixed(1)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <FlipCard
      front={frontContent}
      back={
        <EducationCard
          title="What If Scenario Tool"
          whatItIs="A stress-testing tool that adjusts market features (volatility, correlation, returns, drawdown, momentum) and re-runs the feature-sensitive models: HMM (uses emission probabilities to sense feature changes), Random Forest, and XGBoost. Markov is excluded since it only uses transition probabilities."
          whyItMatters="Understanding how sensitive regime predictions are to market changes helps you prepare for different scenarios. If a small volatility increase flips the regime from Calm to Elevated Stress, the current market state may be fragile."
          howToRead="Compare Baseline (current features) vs Scenario (adjusted features). The per-model breakdown shows how each ML model reacts. Use presets for common scenarios or fine-tune individual sliders."
          actionableInsight="Try the 'Market Crash' preset to stress-test current conditions. If the regime stays Calm even under extreme stress, the current state is robust. If it flips easily, consider defensive positioning."
        />
      }
    />
  );
}
