# Predictions API Documentation

**Base URL:** `http://localhost:8000`

---

## Overview

The Predictions API provides regime forecasting for market indices using 4 trained ML models:
- **Markov Chain** - Baseline transition probabilities
- **Hidden Markov Model** - Probabilistic state transitions
- **Random Forest** - Ensemble tree classifier
- **XGBoost** - Gradient boosting classifier

**Supported Indices:** SPY, QQQ, DIA, IWM
**Prediction Horizons:** 1-day, 7-day, 30-day

---

## Authentication

No authentication required for local development.

---

## Endpoints

### 1. Get Current Predictions

**GET** `/api/predictions/{symbol}/current`

Get ensemble predictions for all horizons (1d, 7d, 30d).

**Path Parameters:**
- `symbol` (string, required) - Index symbol: SPY, QQQ, DIA, or IWM

**Response:**
```json
{
  "symbol": "SPY",
  "current_regime": 0,
  "current_date": "2024-12-20",
  "predictions": {
    "1d": {
      "horizon_days": 1,
      "ensemble": {
        "model_name": "Ensemble",
        "predicted_regime": 0,
        "predicted_regime_name": "Calm",
        "confidence": 0.996,
        "probabilities": {
          "Calm": 0.996,
          "Crisis": 0.000,
          "Elevated Stress": 0.001,
          "Transition": 0.003
        }
      },
      "individual_models": [
        {
          "model_name": "Markov",
          "predicted_regime": 0,
          "predicted_regime_name": "Calm",
          "confidence": 0.997,
          "probabilities": { ... }
        },
        ...
      ],
      "weights": {
        "markov": 0.25,
        "hmm": 0.25,
        "random_forest": 0.25,
        "xgboost": 0.25
      }
    },
    "7d": { ... },
    "30d": { ... }
  },
  "timestamp": "2026-02-25T23:09:32.412201"
}
```

**Example:**
```bash
curl http://localhost:8000/api/predictions/SPY/current
```

---

### 2. Get Specific Horizon Prediction

**GET** `/api/predictions/{symbol}/horizon/{days}`

Get prediction for a specific time horizon.

**Path Parameters:**
- `symbol` (string, required) - Index symbol
- `days` (integer, required) - Prediction horizon: 1, 7, or 30

**Response:**
```json
{
  "horizon_days": 7,
  "ensemble": {
    "model_name": "Ensemble",
    "predicted_regime": 0,
    "predicted_regime_name": "Calm",
    "confidence": 0.975,
    "probabilities": { ... }
  },
  "individual_models": [ ... ],
  "weights": { ... }
}
```

**Example:**
```bash
curl http://localhost:8000/api/predictions/SPY/horizon/7
```

---

### 3. Get Single Model Prediction

**GET** `/api/predictions/{symbol}/model/{model_name}/horizon/{days}`

Get prediction from a specific model.

**Path Parameters:**
- `symbol` (string, required) - Index symbol
- `model_name` (string, required) - Model: `markov`, `hmm`, `random_forest`, or `xgboost`
- `days` (integer, required) - Prediction horizon: 1, 7, or 30

**Response:**
```json
{
  "model_name": "Random Forest",
  "predicted_regime": 0,
  "predicted_regime_name": "Calm",
  "confidence": 0.91,
  "probabilities": {
    "Calm": 0.91,
    "Crisis": 0.02,
    "Elevated Stress": 0.03,
    "Transition": 0.04
  }
}
```

**Example:**
```bash
curl http://localhost:8000/api/predictions/SPY/model/random_forest/horizon/1
```

---

### 4. Compare Predictions Across Indices

**GET** `/api/predictions/compare`

Get current predictions for all 4 indices at once.

**Response:**
```json
{
  "indices": {
    "SPY": {
      "1d": {
        "predicted_regime": 0,
        "predicted_regime_name": "Calm",
        "confidence": 0.996,
        "probabilities": { ... }
      },
      "7d": { ... },
      "30d": { ... }
    },
    "QQQ": {
      "1d": {
        "predicted_regime": 1,
        "predicted_regime_name": "Crisis",
        "confidence": 0.993,
        "probabilities": { ... }
      },
      ...
    },
    "DIA": { ... },
    "IWM": { ... }
  },
  "timestamp": "2026-02-25T23:09:45.123456"
}
```

**Example:**
```bash
curl http://localhost:8000/api/predictions/compare
```

**Use Case:** Detect regime divergence across market segments (large-cap vs small-cap, tech vs blue-chip).

---

### 5. Get Model Accuracy

**GET** `/api/predictions/{symbol}/accuracy`

Get training accuracy for all models and horizons.

**Path Parameters:**
- `symbol` (string, required) - Index symbol

**Response:**
```json
{
  "symbol": "SPY",
  "horizons": [1, 7, 30],
  "accuracies": [
    {
      "model_name": "Random Forest",
      "horizon_days": 1,
      "train_accuracy": 0.9106,
      "test_accuracy": null,
      "mean_confidence": 0.7665
    },
    {
      "model_name": "XGBoost",
      "horizon_days": 1,
      "train_accuracy": 0.8181,
      "test_accuracy": null,
      "mean_confidence": 0.8831
    },
    ...
  ],
  "best_model_by_horizon": {
    "1": "Markov Chain",
    "7": "XGBoost",
    "30": "Random Forest"
  }
}
```

**Example:**
```bash
curl http://localhost:8000/api/predictions/SPY/accuracy
```

---

### 6. Custom Prediction

**POST** `/api/predictions/{symbol}/custom`

Make predictions with custom feature data (useful for what-if scenarios).

**Path Parameters:**
- `symbol` (string, required) - Index symbol

**Request Body:**
```json
{
  "features": [
    {
      "avg_vol_126": 0.15,
      "avg_correlation": 0.45,
      "effective_dimension": 4.2,
      "pc1_var": 0.35,
      "pc2_var": 0.15,
      "pc3_var": 0.10
    },
    ...  // At least 22 rows for lag features
  ],
  "current_regime": 0  // Optional
}
```

**Response:**
```json
{
  "symbol": "SPY",
  "horizons": {
    "1d": { ... },
    "7d": { ... },
    "30d": { ... }
  },
  "timestamp": "2026-02-25T23:10:00.000000"
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/predictions/SPY/custom \
  -H "Content-Type: application/json" \
  -d '{"features": [...], "current_regime": 0}'
```

---

### 7. Predictions Health Check

**GET** `/api/predictions/health`

Check if prediction models are loaded and available.

**Response:**
```json
{
  "status": "healthy",
  "models_loaded": 4,
  "available_indices": 4,
  "spy_model_files": 10,
  "timestamp": "2026-02-25T23:09:26.490696"
}
```

**Example:**
```bash
curl http://localhost:8000/api/predictions/health
```

---

## Response Schemas

### ModelPrediction

```typescript
{
  model_name: string;           // "Markov", "HMM", "Random Forest", "XGBoost", "Ensemble"
  predicted_regime: number;      // 0-3
  predicted_regime_name: string; // "Calm", "Crisis", "Elevated Stress", "Transition"
  confidence: number;            // 0.0-1.0
  probabilities: {
    [regime_name: string]: number; // Probability for each regime
  };
}
```

### HorizonPrediction

```typescript
{
  horizon_days: number;                // 1, 7, or 30
  ensemble: ModelPrediction;           // Weighted average of all models
  individual_models: ModelPrediction[]; // Predictions from each model
  weights: {
    [model_name: string]: number;      // Weight for each model (default: 0.25 each)
  };
}
```

### Regime Labels

| ID | Name | Description |
|----|------|-------------|
| 0 | Calm | Low volatility, low correlation, high diversification |
| 1 | Crisis | High volatility, high correlation, market stress |
| 2 | Elevated Stress | Moderate volatility, building stress |
| 3 | Transition | Mixed characteristics, regime shifts |

---

## Error Responses

### 404 Not Found
```json
{
  "detail": "No trained models found for {symbol}. Train models first."
}
```

### 400 Bad Request
```json
{
  "detail": "Invalid horizon: {days}. Must be 1, 7, or 30 days."
}
```

### 500 Internal Server Error
```json
{
  "detail": "Prediction failed: {error_message}"
}
```

---

## Usage Examples

### Python

```python
import requests

# Get current predictions
response = requests.get('http://localhost:8000/api/predictions/SPY/current')
data = response.json()

# Extract 1-day prediction
prediction_1d = data['predictions']['1d']['ensemble']
print(f"1-Day Prediction: {prediction_1d['predicted_regime_name']}")
print(f"Confidence: {prediction_1d['confidence']:.2%}")

# Compare all indices
response = requests.get('http://localhost:8000/api/predictions/compare')
comparison = response.json()

for symbol, predictions in comparison['indices'].items():
    regime_1d = predictions['1d']['predicted_regime_name']
    conf_1d = predictions['1d']['confidence']
    print(f"{symbol}: {regime_1d} ({conf_1d:.2%} confidence)")
```

### JavaScript/TypeScript

```typescript
// Get predictions
const response = await fetch('http://localhost:8000/api/predictions/SPY/current');
const data = await response.json();

// Extract ensemble prediction for 7-day horizon
const prediction7d = data.predictions['7d'].ensemble;
console.log(`7-Day Prediction: ${prediction7d.predicted_regime_name}`);
console.log(`Confidence: ${(prediction7d.confidence * 100).toFixed(1)}%`);

// Get model accuracy
const accuracyRes = await fetch('http://localhost:8000/api/predictions/SPY/accuracy');
const accuracyData = await accuracyRes.json();
console.log(`Best model for 7-day: ${accuracyData.best_model_by_horizon[7]}`);
```

### cURL

```bash
# Get 30-day prediction for QQQ
curl http://localhost:8000/api/predictions/QQQ/horizon/30 | jq '.ensemble'

# Compare predictions across all indices
curl http://localhost:8000/api/predictions/compare | jq '.indices | keys[]'

# Get Random Forest prediction for SPY (1-day)
curl http://localhost:8000/api/predictions/SPY/model/random_forest/horizon/1
```

---

## Rate Limiting

No rate limiting in local development. For production deployment, consider:
- Rate limit: 100 requests/minute per IP
- Burst limit: 10 requests/second

---

## Caching

Prediction engines are cached in memory after first load:
- **First request:** ~2-3 seconds (loads models from disk)
- **Subsequent requests:** ~50-200ms (uses cached models)

To clear cache, restart the API server.

---

## Performance

| Endpoint | Avg Response Time | Notes |
|----------|------------------|-------|
| `/current` | 150ms | Loads features and runs 3 predictions |
| `/horizon/{days}` | 60ms | Single horizon prediction |
| `/model/{model}/horizon/{days}` | 40ms | Single model prediction |
| `/compare` | 600ms | Predicts for all 4 indices |
| `/accuracy` | 10ms | Returns cached metadata |

---

## Development

### Start API Server

```bash
# From project root
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Run Tests

```bash
# Test predictions health
curl http://localhost:8000/api/predictions/health

# Test SPY predictions
curl http://localhost:8000/api/predictions/SPY/current | python -m json.tool
```

### API Documentation

Interactive API docs available at:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## Next Steps

### Frontend Integration

```typescript
// Create a service to fetch predictions
export const PredictionsService = {
  async getCurrentPredictions(symbol: string) {
    const response = await fetch(`/api/predictions/${symbol}/current`);
    return response.json();
  },

  async compareIndices() {
    const response = await fetch('/api/predictions/compare');
    return response.json();
  },

  async getModelAccuracy(symbol: string) {
    const response = await fetch(`/api/predictions/${symbol}/accuracy`);
    return response.json();
  }
};
```

### Webhooks (Future)

```json
{
  "event": "regime_change_predicted",
  "symbol": "SPY",
  "from_regime": 0,
  "to_regime": 1,
  "confidence": 0.85,
  "horizon_days": 7,
  "timestamp": "2026-02-25T23:10:00.000000"
}
```

---

## Known Issues

1. **RF/XGBoost Silent Failures:** Random Forest and XGBoost predictions may not appear in ensemble results if feature loading fails. Markov and HMM predictions still work.
   - **Workaround:** Ensure `regime_results/regime_features_normalized.csv` exists with at least 22 recent rows.

2. **Data Staleness:** Predictions use most recent data in CSV files. To update:
   ```bash
   python src/regime/update_regime_data.py
   ```

3. **Index-Specific Models:** Currently using SPY regime labels as fallback for QQQ/DIA/IWM. To train index-specific models:
   ```bash
   python src/regime/train_multi_index_models.py --index QQQ
   ```

---

## Support

For issues or questions:
1. Check `/api/predictions/health` endpoint
2. Verify models exist: `ls -lh models/SPY/`
3. Check server logs for errors
4. Retrain models if needed: `python src/regime/train_multi_index_models.py`

---

**Last Updated:** February 25, 2026
**API Version:** 1.0.0
**Model Version:** Trained on data through 2024-12-20
