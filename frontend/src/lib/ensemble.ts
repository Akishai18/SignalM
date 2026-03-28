const REGIME_NAMES = ['Calm', 'Crisis', 'Elevated Stress', 'Transition'];

// HMM-dominant weights: HMM 70%, RF 15%, XGB 15%
const ENSEMBLE_WEIGHTS: Record<string, number> = {
  hmm: 0.70,
  'random forest': 0.15,
  xgboost: 0.15,
};

export function computeWeightedEnsemble(individualModels: any[]): any {
  const models = individualModels.filter(
    (m) => !m.model_name.toLowerCase().includes('markov')
  );
  const weightedProbs: Record<string, number> = {};
  let totalWeight = 0;

  models.forEach((model) => {
    const key = Object.keys(ENSEMBLE_WEIGHTS).find((k) =>
      model.model_name.toLowerCase().includes(k)
    );
    const weight = key ? ENSEMBLE_WEIGHTS[key] : 0;
    if (weight === 0) return;
    totalWeight += weight;
    Object.entries(model.probabilities as Record<string, number>).forEach(
      ([regime, prob]) => {
        weightedProbs[regime] = (weightedProbs[regime] || 0) + prob * weight;
      }
    );
  });

  // Normalise in case weights don't sum to exactly 1
  if (totalWeight > 0) {
    Object.keys(weightedProbs).forEach((k) => {
      weightedProbs[k] /= totalWeight;
    });
  }

  let bestRegimeName = '';
  let bestProb = 0;
  Object.entries(weightedProbs).forEach(([regime, prob]) => {
    if (prob > bestProb) {
      bestProb = prob;
      bestRegimeName = regime;
    }
  });

  // Support both name-keyed and index-keyed probability objects
  const regimeName = REGIME_NAMES.includes(bestRegimeName)
    ? bestRegimeName
    : REGIME_NAMES[parseInt(bestRegimeName)] ?? bestRegimeName;

  return {
    model_name: 'Weighted Ensemble',
    predicted_regime: REGIME_NAMES.indexOf(regimeName),
    predicted_regime_name: regimeName,
    confidence: bestProb,
    probabilities: weightedProbs,
  };
}
