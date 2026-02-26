# Predictions Implementation Plan

## 📊 Current State Analysis

### What You Have
✅ **4 Model Types:**
1. **Markov (Baseline)** - `src/regime/predict.py` - Transition probability matrix
2. **HMM** - `src/regime/hmm_predict.py` - Hidden Markov Model with emissions
3. **Random Forest** - Visualizations exist, need training script
4. **XGBoost** - Visualizations exist, need training script

✅ **Visualizations Generated:**
- Confusion matrices for all 4 models
- Timeline plots for all 4 models
- Confidence plots (Markov, HMM)

✅ **Data Infrastructure:**
- Regime labels (K=4): Calm, Crisis, Elevated Stress, Transition
- Feature matrix with correlation, volatility, PCA metrics
- Multi-index support (SPY, QQQ, DIA, IWM)

### What's Missing
❌ **Training Scripts:**
- Random Forest training script
- XGBoost training script
- Model persistence (saving/loading .pkl files)
- Multi-index model training loop

❌ **Multi-Horizon Predictions:**
- Currently only 1-day predictions
- Need 7-day and 30-day forecasts
- Need probability distributions over time

❌ **API Endpoints:**
- `/predict/{symbol}` - Current regime + next-day forecast
- `/predict/{symbol}/horizon` - 7-day and 30-day forecasts
- `/predict/{symbol}/custom` - Custom date range predictions

❌ **Frontend Predictions Page:**
- Prediction dashboard
- Model comparison
- Confidence visualization
- Forecast timeline

---

## 🎯 Implementation Plan

### Phase 1: Multi-Index Model Training (Week 1)

#### Goal: Train all 4 models for each of 4 indices

**Step 1.1: Create Unified Training Pipeline**
```python
# src/regime/train_models.py

class RegimeModelTrainer:
    def __init__(self, symbol: str, data_path: str):
        self.symbol = symbol
        self.features = load_features(symbol)
        self.regime_labels = load_regime_labels(symbol)

    def train_all_models(self):
        """Train all 4 models for this index"""
        models = {}

        # 1. Markov (Baseline)
        models['markov'] = self.train_markov()

        # 2. HMM
        models['hmm'] = self.train_hmm()

        # 3. Random Forest
        models['random_forest'] = self.train_random_forest()

        # 4. XGBoost
        models['xgboost'] = self.train_xgboost()

        return models

    def train_random_forest(self):
        """Train Random Forest classifier"""
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import TimeSeriesSplit

        # Features: lagged regime features (lag 1, 5, 21)
        X = self.create_lagged_features(lags=[1, 5, 21])
        y = self.regime_labels

        # Train/test split (time-series aware)
        train_size = int(0.8 * len(X))
        X_train, X_test = X[:train_size], X[train_size:]
        y_train, y_test = y[:train_size], y[train_size:]

        # Hyperparameter tuning
        rf = RandomForestClassifier(
            n_estimators=200,
            max_depth=10,
            min_samples_split=20,
            min_samples_leaf=10,
            class_weight='balanced',
            random_state=42
        )

        rf.fit(X_train, y_train)

        # Evaluate
        train_acc = rf.score(X_train, y_train)
        test_acc = rf.score(X_test, y_test)

        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': X.columns,
            'importance': rf.feature_importances_
        }).sort_values('importance', ascending=False)

        return {
            'model': rf,
            'train_accuracy': train_acc,
            'test_accuracy': test_acc,
            'feature_importance': feature_importance,
            'X_train': X_train,
            'X_test': X_test,
            'y_train': y_train,
            'y_test': y_test
        }

    def train_xgboost(self):
        """Train XGBoost classifier"""
        import xgboost as xgb

        X = self.create_lagged_features(lags=[1, 5, 21])
        y = self.regime_labels

        train_size = int(0.8 * len(X))
        X_train, X_test = X[:train_size], X[train_size:]
        y_train, y_test = y[:train_size], y[train_size:]

        # XGBoost parameters
        xgb_model = xgb.XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            objective='multi:softprob',  # For multi-class with probabilities
            num_class=4,  # 4 regimes
            eval_metric='mlogloss',
            random_state=42
        )

        xgb_model.fit(
            X_train, y_train,
            eval_set=[(X_train, y_train), (X_test, y_test)],
            verbose=False
        )

        train_acc = xgb_model.score(X_train, y_train)
        test_acc = xgb_model.score(X_test, y_test)

        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': X.columns,
            'importance': xgb_model.feature_importances_
        }).sort_values('importance', ascending=False)

        return {
            'model': xgb_model,
            'train_accuracy': train_acc,
            'test_accuracy': test_acc,
            'feature_importance': feature_importance,
            'X_train': X_train,
            'X_test': X_test,
            'y_train': y_train,
            'y_test': y_test
        }

    def create_lagged_features(self, lags=[1, 5, 21]):
        """Create lagged features for ML models"""
        feature_df = self.features.copy()

        # Add lagged versions
        for lag in lags:
            for col in self.features.columns:
                feature_df[f'{col}_lag{lag}'] = self.features[col].shift(lag)

        # Drop NaN rows
        feature_df = feature_df.dropna()

        return feature_df

    def save_models(self, models, save_dir='models'):
        """Save all trained models"""
        import joblib
        os.makedirs(save_dir, exist_ok=True)

        for model_name, model_dict in models.items():
            model_path = f"{save_dir}/{self.symbol}_{model_name}.pkl"
            joblib.dump(model_dict, model_path)
            print(f"✓ Saved {model_name} for {self.symbol} to {model_path}")
```

**Step 1.2: Train Models for All Indices**
```python
# src/regime/train_all_indices.py

def train_all_index_models():
    """Train all 4 models for all 4 indices"""
    indices = ['SPY', 'QQQ', 'DIA', 'IWM']

    all_models = {}

    for symbol in indices:
        print(f"\n{'='*60}")
        print(f"Training models for {symbol}")
        print(f"{'='*60}")

        trainer = RegimeModelTrainer(symbol=symbol, data_path='data')
        models = trainer.train_all_models()
        trainer.save_models(models, save_dir=f'models/{symbol}')

        all_models[symbol] = models

        # Print accuracy summary
        print(f"\n{symbol} Model Accuracies:")
        for model_name, model_dict in models.items():
            if 'test_accuracy' in model_dict:
                print(f"  {model_name:15s}: {model_dict['test_accuracy']:.2%}")

    return all_models

if __name__ == "__main__":
    models = train_all_index_models()
```

**File Structure After Phase 1:**
```
models/
├── SPY/
│   ├── spy_markov.pkl
│   ├── spy_hmm.pkl
│   ├── spy_random_forest.pkl
│   └── spy_xgboost.pkl
├── QQQ/
│   ├── qqq_markov.pkl
│   ├── qqq_hmm.pkl
│   ├── qqq_random_forest.pkl
│   └── qqq_xgboost.pkl
├── DIA/
│   └── ... (same structure)
└── IWM/
    └── ... (same structure)
```

---

### Phase 2: Multi-Horizon Predictions (Week 1-2)

#### Goal: Implement 1-day, 7-day, 30-day forecasts

**Step 2.1: Create Prediction Interface**
```python
# src/regime/forecast.py

class RegimeForecast:
    def __init__(self, symbol: str, models_dir='models'):
        self.symbol = symbol
        self.models = self.load_models(models_dir)

    def predict_next_day(self, current_features: np.ndarray):
        """Predict next-day regime with all 4 models"""
        predictions = {}

        for model_name, model_dict in self.models.items():
            model = model_dict['model']

            if model_name in ['markov', 'hmm']:
                # These use transition matrices
                pred = self.predict_with_markov_hmm(model_name, current_features)
            else:
                # RF and XGBoost use features directly
                pred = model.predict_proba(current_features.reshape(1, -1))[0]

            predictions[model_name] = {
                'predicted_regime': pred.argmax(),
                'probabilities': pred.tolist(),
                'confidence': pred.max()
            }

        return predictions

    def predict_horizon(self, current_features: np.ndarray, horizon: int):
        """Predict regime probabilities for next N days"""
        all_forecasts = {}

        for model_name in self.models.keys():
            if model_name == 'markov':
                # Use matrix powers: P^n
                forecast = self.forecast_markov(horizon)

            elif model_name == 'hmm':
                # Use forward algorithm
                forecast = self.forecast_hmm(current_features, horizon)

            elif model_name in ['random_forest', 'xgboost']:
                # Iterative forecasting with feature updates
                forecast = self.forecast_ml_iterative(
                    model_name, current_features, horizon
                )

            all_forecasts[model_name] = forecast

        return all_forecasts

    def forecast_ml_iterative(self, model_name: str,
                             current_features: np.ndarray,
                             horizon: int):
        """Iterative forecasting for ML models"""
        model = self.models[model_name]['model']

        forecasts = []
        features = current_features.copy()

        for day in range(1, horizon + 1):
            # Predict next regime probabilities
            probs = model.predict_proba(features.reshape(1, -1))[0]
            predicted_regime = probs.argmax()

            forecasts.append({
                'day_ahead': day,
                'predicted_regime': int(predicted_regime),
                'confidence': float(probs.max()),
                'probabilities': probs.tolist()
            })

            # Update features for next iteration
            # (shift lags, update with predicted regime)
            features = self.update_features_with_prediction(
                features, predicted_regime
            )

        return pd.DataFrame(forecasts)

    def ensemble_forecast(self, current_features: np.ndarray, horizon: int):
        """Ensemble forecast: average predictions from all models"""
        all_forecasts = self.predict_horizon(current_features, horizon)

        ensemble = []

        for day in range(1, horizon + 1):
            # Collect probabilities from all models for this day
            day_probs = []

            for model_name, forecast_df in all_forecasts.items():
                day_forecast = forecast_df[forecast_df['day_ahead'] == day].iloc[0]
                day_probs.append(day_forecast['probabilities'])

            # Average probabilities
            avg_probs = np.mean(day_probs, axis=0)
            predicted_regime = avg_probs.argmax()

            ensemble.append({
                'day_ahead': day,
                'predicted_regime': int(predicted_regime),
                'confidence': float(avg_probs.max()),
                'probabilities': avg_probs.tolist()
            })

        return pd.DataFrame(ensemble)
```

**Step 2.2: Evaluation Framework**
```python
# src/regime/evaluate_forecasts.py

def evaluate_forecast_accuracy(symbol: str, horizon: int):
    """Evaluate forecast accuracy at different horizons"""
    forecaster = RegimeForecast(symbol)

    # Get historical data
    features = load_features(symbol)
    labels = load_regime_labels(symbol)

    # Evaluate on test set
    test_start = int(0.8 * len(features))

    results = {
        'markov': [],
        'hmm': [],
        'random_forest': [],
        'xgboost': [],
        'ensemble': []
    }

    for i in range(test_start, len(features) - horizon):
        current_features = features.iloc[i].values
        actual_future_regime = labels.iloc[i + horizon]

        # Get predictions
        predictions = forecaster.predict_horizon(current_features, horizon)

        for model_name, forecast_df in predictions.items():
            day_h_forecast = forecast_df[forecast_df['day_ahead'] == horizon].iloc[0]
            predicted_regime = day_h_forecast['predicted_regime']

            results[model_name].append({
                'correct': predicted_regime == actual_future_regime,
                'confidence': day_h_forecast['confidence']
            })

    # Compute accuracy metrics
    accuracy_summary = {}
    for model_name, preds in results.items():
        accuracy_summary[model_name] = {
            'accuracy': np.mean([p['correct'] for p in preds]),
            'mean_confidence': np.mean([p['confidence'] for p in preds]),
            'n_predictions': len(preds)
        }

    return accuracy_summary
```

---

### Phase 3: API Endpoints (Week 2)

#### Goal: Expose predictions through FastAPI

**Step 3.1: Create Prediction Routes**
```python
# api/routes/predictions.py

from fastapi import APIRouter, HTTPException
from typing import Optional, List
import pandas as pd
from src.regime.forecast import RegimeForecast

router = APIRouter(prefix="/api/v1/predict", tags=["predictions"])

# Cache forecasters (loaded models) to avoid reloading
forecasters = {}

def get_forecaster(symbol: str) -> RegimeForecast:
    if symbol not in forecasters:
        forecasters[symbol] = RegimeForecast(symbol)
    return forecasters[symbol]

@router.get("/{symbol}/next-day")
def predict_next_day(symbol: str):
    """Predict next-day regime for a given index"""
    try:
        forecaster = get_forecaster(symbol.upper())

        # Get current features (most recent date)
        current_features = get_current_features(symbol)

        # Predict with all models
        predictions = forecaster.predict_next_day(current_features)

        return {
            'symbol': symbol.upper(),
            'current_date': get_latest_date(symbol),
            'predictions': predictions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{symbol}/horizon")
def predict_horizon(symbol: str, days: int = 7):
    """Predict regime probabilities for next N days"""
    if days not in [7, 30]:
        raise HTTPException(
            status_code=400,
            detail="Only 7-day and 30-day horizons supported"
        )

    try:
        forecaster = get_forecaster(symbol.upper())
        current_features = get_current_features(symbol)

        # Get forecasts from all models
        forecasts = forecaster.predict_horizon(current_features, days)

        # Also get ensemble forecast
        ensemble = forecaster.ensemble_forecast(current_features, days)
        forecasts['ensemble'] = ensemble

        return {
            'symbol': symbol.upper(),
            'current_date': get_latest_date(symbol),
            'horizon_days': days,
            'forecasts': {
                model: forecast.to_dict('records')
                for model, forecast in forecasts.items()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{symbol}/custom")
def predict_custom_period(
    symbol: str,
    start_date: str,
    end_date: str
):
    """Predict regimes for a custom date range"""
    try:
        forecaster = get_forecaster(symbol.upper())

        # Get features at start_date
        features_at_start = get_features_on_date(symbol, start_date)

        # Calculate horizon (days between start and end)
        horizon = (pd.Timestamp(end_date) - pd.Timestamp(start_date)).days

        if horizon > 90:
            raise HTTPException(
                status_code=400,
                detail="Maximum prediction horizon is 90 days"
            )

        # Get forecasts
        forecasts = forecaster.predict_horizon(features_at_start, horizon)
        ensemble = forecaster.ensemble_forecast(features_at_start, horizon)
        forecasts['ensemble'] = ensemble

        return {
            'symbol': symbol.upper(),
            'start_date': start_date,
            'end_date': end_date,
            'horizon_days': horizon,
            'forecasts': {
                model: forecast.to_dict('records')
                for model, forecast in forecasts.items()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{symbol}/model-comparison")
def compare_models(symbol: str):
    """Compare prediction accuracy across all models"""
    try:
        # Get pre-computed evaluation metrics
        eval_metrics = load_evaluation_metrics(symbol)

        return {
            'symbol': symbol.upper(),
            'evaluation_period': eval_metrics['period'],
            'models': eval_metrics['model_accuracies'],
            'best_model': eval_metrics['best_model']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Phase 4: Frontend Predictions Page (Week 2-3)

#### Goal: Build interactive predictions dashboard

**File Structure:**
```
frontend/src/
├── pages/
│   └── Predictions.tsx          # New predictions page
├── components/
│   └── predictions/
│       ├── ModelSelector.tsx    # Choose which model(s) to view
│       ├── HorizonSelector.tsx  # Choose 1d/7d/30d
│       ├── ForecastChart.tsx    # Timeline with probabilities
│       ├── ModelComparison.tsx  # Compare accuracy across models
│       ├── ConfidenceGauge.tsx  # Show prediction confidence
│       └── PredictionTable.tsx  # Tabular forecast data
└── hooks/
    └── usePredictionData.ts     # React Query hooks for predictions
```

**Key Components:**

1. **Prediction Dashboard Layout:**
```tsx
// src/pages/Predictions.tsx

export function Predictions() {
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [horizon, setHorizon] = useState(7); // 7-day default
  const [selectedModels, setSelectedModels] = useState(['ensemble']);

  const { data: nextDayPred } = useNextDayPrediction(selectedSymbol);
  const { data: horizonPred } = useHorizonPrediction(selectedSymbol, horizon);

  return (
    <DashboardLayout>
      {/* Header */}
      <PredictionsHeader
        symbol={selectedSymbol}
        onSymbolChange={setSelectedSymbol}
      />

      {/* Next-Day Prediction (Hero Card) */}
      <NextDayPredictionCard
        symbol={selectedSymbol}
        prediction={nextDayPred}
      />

      {/* Horizon & Model Selectors */}
      <div className="flex gap-4">
        <HorizonSelector
          selected={horizon}
          onChange={setHorizon}
          options={[7, 30]}
        />
        <ModelSelector
          selected={selectedModels}
          onChange={setSelectedModels}
          models={['markov', 'hmm', 'random_forest', 'xgboost', 'ensemble']}
        />
      </div>

      {/* Forecast Visualization */}
      <ForecastChart
        symbol={selectedSymbol}
        forecasts={horizonPred}
        selectedModels={selectedModels}
        horizon={horizon}
      />

      {/* Model Comparison */}
      <ModelComparisonGrid
        symbol={selectedSymbol}
      />

      {/* Prediction Table */}
      <PredictionTable
        forecasts={horizonPred}
        selectedModels={selectedModels}
      />
    </DashboardLayout>
  );
}
```

2. **Forecast Chart (Time Series with Probabilities):**
- X-axis: Days ahead (1 to horizon)
- Y-axis: Probability (0-100%)
- Multiple lines for each regime (Calm, Crisis, etc.)
- Stacked area chart or line chart
- Confidence bands

3. **Model Comparison:**
- Accuracy metrics table
- Confusion matrices (dropdown to expand)
- Feature importance (for RF/XGBoost)
- Best model recommendation

---

## 📋 Suggested Additional Features

### 1. Regime Transition Matrix Visualization
- Show which regime is most likely to follow current regime
- Interactive network diagram
- Historical transition frequencies

### 2. Custom Date Range Predictions
- User inputs: start date, end date
- System forecasts entire period
- Compare predictions to actuals (if in past)

### 3. Prediction Alerts
- Set alert when predicted regime changes
- Email/SMS notifications
- Threshold-based alerts (e.g., if Crisis probability > 50%)

### 4. Backtesting Interface
- "If I had used these predictions..."
- Strategy performance by regime
- Position sizing recommendations

### 5. Explainability Features
- SHAP values for ML models
- "Why did the model predict Crisis?"
- Feature contribution breakdown

---

## 🔧 Additional Data/APIs Needed

### Current Data Sources
✅ yfinance - Historical price/returns data
✅ CSV files - S&P 500 constituents, regime labels

### Recommended Additional Sources

**1. Real-Time Data (for live predictions):**
- Alpha Vantage API (free tier: 5 calls/min, 500/day)
- Finnhub API (free tier: 60 calls/min)
- Polygon.io (free tier: 5 calls/min)

**2. Alternative Data (improve predictions):**
- **VIX Term Structure** - Quandl/CBOE
  - Forward-looking volatility expectations
  - VIX futures contango/backwardation

- **Put/Call Ratio** - CBOE
  - Options market sentiment
  - Fear gauge alternative to VIX

- **High-Yield Spread** - FRED API
  - Credit market stress indicator
  - Leading indicator for crisis regimes

- **TED Spread** - FRED API
  - Interbank lending stress
  - Liquidity/credit risk measure

**3. News Sentiment (optional enhancement):**
- NewsAPI.org
- Finnhub news sentiment
- Could add as feature: "negative news score" → higher crisis probability

**Example FRED API Integration:**
```python
# src/data/fred_fetcher.py

from fredapi import Fred
import os

fred = Fred(api_key=os.getenv('FRED_API_KEY'))

def get_credit_spread():
    """Get high-yield (BAA) - Treasury (10Y) spread"""
    baa = fred.get_series('BAA')
    dgs10 = fred.get_series('DGS10')
    spread = baa - dgs10
    return spread

def get_ted_spread():
    """Get 3-month LIBOR - 3-month Treasury spread"""
    ted = fred.get_series('TEDRATE')
    return ted
```

---

## 🚀 Implementation Timeline

### Week 1 (Training & Multi-Horizon)
- **Day 1-2:** Create `train_models.py` with RF and XGBoost
- **Day 3:** Train all models for all 4 indices
- **Day 4-5:** Implement multi-horizon forecasting (7d, 30d)
- **Day 6:** Evaluation framework and accuracy metrics
- **Day 7:** Testing and validation

### Week 2 (API & Initial Frontend)
- **Day 1-2:** Create prediction API endpoints
- **Day 3:** Add model caching and optimization
- **Day 4-5:** Build frontend Predictions page structure
- **Day 6:** Implement forecast chart visualization
- **Day 7:** Model selector and horizon selector

### Week 3 (Polish & Advanced Features)
- **Day 1-2:** Model comparison grid and accuracy display
- **Day 3:** Educational modals for predictions
- **Day 4:** Custom date range predictions
- **Day 5:** Ensemble forecast logic
- **Day 6-7:** Testing, bug fixes, polish

---

## 📊 Success Metrics

**Technical:**
- [ ] All 4 models trained for 4 indices (16 total models)
- [ ] Prediction accuracy >60% for 1-day horizon
- [ ] Prediction accuracy >50% for 7-day horizon
- [ ] Prediction accuracy >40% for 30-day horizon
- [ ] API response time <500ms
- [ ] Model loading time <2s

**User Experience:**
- [ ] Clear visual indication of prediction confidence
- [ ] Intuitive model comparison
- [ ] Responsive forecast charts
- [ ] Educational content for each model type
- [ ] Custom date range predictions working

**Business:**
- [ ] Users can trust predictions enough to adjust portfolio
- [ ] Predictions page becomes most-visited page
- [ ] Institutional interest in prediction API access

---

## ⚠️ Known Challenges & Solutions

### Challenge 1: Prediction Accuracy Degradation Over Horizon
**Problem:** Accuracy drops significantly after 7 days
**Solution:**
- Use ensemble methods (average across models)
- Add uncertainty bands to forecast chart
- Show "confidence decay" over time
- Don't over-promise long-term accuracy

### Challenge 2: Regime Shifts Are Hard to Predict
**Problem:** Transition periods are inherently unpredictable
**Solution:**
- Focus on regime persistence (how long will current regime last?)
- Flag "regime uncertainty" when models disagree
- Use transition matrix to show probability of shift
- Provide "early warning" indicators

### Challenge 3: Feature Leakage in ML Models
**Problem:** Using future information in features
**Solution:**
- Only use lagged features (lag ≥ 1)
- Walk-forward validation (no peeking into future)
- Time-series cross-validation splits
- Document feature creation carefully

### Challenge 4: Model Staleness
**Problem:** Models trained on old data become less accurate
**Solution:**
- Implement scheduled retraining (monthly)
- Track prediction accuracy over time
- Alert when accuracy drops below threshold
- Add "model last trained on" timestamp

---

## 🎯 Priority Order

If you need to prioritize, here's the recommended order:

1. **HIGHEST PRIORITY:**
   - Train Random Forest and XGBoost for SPY
   - Implement 7-day forecast for SPY
   - Create `/predict/spy/horizon?days=7` API endpoint
   - Build basic Predictions page with forecast chart

2. **HIGH PRIORITY:**
   - Train models for all 4 indices
   - Implement 30-day forecast
   - Model comparison grid
   - Ensemble forecast logic

3. **MEDIUM PRIORITY:**
   - Custom date range predictions
   - Educational modals for predictions
   - Prediction accuracy tracking
   - Model retraining pipeline

4. **LOW PRIORITY (Future):**
   - Alternative data sources (FRED, options)
   - News sentiment integration
   - SHAP explainability
   - Prediction alerts/notifications

---

## 📝 Next Steps

**Immediate Actions:**
1. Confirm you're happy with this plan
2. I'll create `train_models.py` with RF and XGBoost training
3. Train models for SPY first (prototype)
4. Create basic prediction API endpoint
5. Test end-to-end: train → predict → API → frontend

**Questions for You:**
1. Do you have any additional data sources already (FRED API key, etc.)?
2. What prediction horizon is most important to you? (1d, 7d, or 30d)
3. Should we focus on ensemble predictions or individual models?
4. Any specific features you want to add to ML models?

Let me know if you want me to start implementing Phase 1 (training pipeline)! 🚀
