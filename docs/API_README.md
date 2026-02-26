# Market Regime API - Quick Start

**FastAPI backend serving regime detection and prediction data**

---

## ✅ Phase 1 Complete: API Layer Built

### What's Been Created

**1. FastAPI Application** ([api/main.py](api/main.py))
- Full REST API serving regime data
- CORS enabled for frontend (localhost:5173)
- Pydantic models for type-safe responses
- Error handling and logging

**2. API Endpoints (10 total)**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/regimes/labels` | GET | All regime labels with metadata |
| `/api/regimes/current` | GET | Current regime state |
| `/api/regimes/history` | GET | Historical regime labels |
| `/api/predictions/forecast` | GET | 1/7/30-day regime forecast |
| `/api/predictions/comparison` | GET | All 4 models accuracy comparison |
| `/api/metrics/summary` | GET | Dashboard summary metrics |
| `/api/features/importance` | GET | Feature importance (RF/XGBoost) |
| `/api/correlations/matrix` | GET | Correlation heatmap data |
| `/api/health` | GET | Detailed health check |

**3. Data Models**
- `RegimeLabel` - Regime metadata (id, name, color, description)
- `CurrentRegime` - Current regime state
- `RegimeHistoryPoint` - Historical regime point
- `PredictionModel` - Model prediction with probabilities
- `DashboardMetrics` - Summary metrics for dashboard
- `FeatureImportance` - Feature importance ranking

---

## 🚀 Running the API

### Start Server
```bash
# From project root
.venv/bin/uvicorn api.main:app --reload --port 8000
```

### Test Endpoints
```bash
# Option 1: Use test script
.venv/bin/python api/test_api.py

# Option 2: Manual curl tests
curl http://localhost:8000/
curl http://localhost:8000/api/regimes/current
curl http://localhost:8000/api/predictions/forecast
curl http://localhost:8000/api/metrics/summary
```

### View API Docs
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## 📊 Sample Responses

### GET `/api/regimes/current`
```json
{
  "regime_id": 0,
  "regime_name": "Calm",
  "confidence": 0.85,
  "days_in_regime": 285,
  "date": "2024-12-31"
}
```

### GET `/api/predictions/forecast`
```json
{
  "current_regime": {...},
  "horizons": [
    {
      "horizon_days": 1,
      "predicted_regime": 0,
      "predicted_regime_name": "Calm",
      "confidence": 0.95,
      "probabilities": {
        "0": 0.95,
        "1": 0.01,
        "2": 0.01,
        "3": 0.03
      }
    },
    ...
  ]
}
```

### GET `/api/metrics/summary`
```json
{
  "avg_correlation": 0.47,
  "vol_dispersion": 0.12,
  "effective_dimension": 4.5,
  "current_regime": "Calm",
  "regime_confidence": 0.85,
  "days_in_regime": 285
}
```

---

## 🎯 What's Working

✅ **All 10 endpoints functional**
✅ **Loads real regime data from CSV files**
✅ **Type-safe responses (Pydantic models)**
✅ **CORS configured for frontend**
✅ **Error handling**
✅ **Auto-generated API docs**

---

## 📝 Current Limitations (To Fix in Later Phases)

⚠️ **Forecast endpoint uses mock predictions**
- Currently returns persistence-based forecast
- **TODO:** Integrate with actual prediction models (Markov, HMM, RF, XGBoost)

⚠️ **Correlation matrix is mocked**
- Currently returns random sector correlations
- **TODO:** Load real sector/stock correlation data

⚠️ **No upload endpoint yet**
- **TODO:** Add POST /api/upload/data for CSV upload

⚠️ **No real-time data**
- Currently serves historical data only
- **TODO:** Add streaming/real-time regime updates

---

## 🔄 Next Steps

### Phase 2: Frontend Integration
1. Create TypeScript API client (`frontend/src/lib/api.ts`)
2. Add TanStack Query hooks
3. Replace mock data in dashboard components
4. Test end-to-end data flow

### Phase 3: Advanced Endpoints
1. Integrate real prediction models
2. Add prediction timeline data
3. Add confusion matrix data
4. Add file upload processing

---

## 🐛 Troubleshooting

**API won't start:**
```bash
# Check dependencies installed
.venv/bin/pip install fastapi uvicorn pydantic python-multipart

# Check data files exist
ls regime_results/regime_labels_k4.csv
ls regime_results/regime_features_normalized.csv
```

**CORS errors in browser:**
- Check frontend URL in `allow_origins` list (default: localhost:5173)
- Verify API is running on port 8000

**Data loading errors:**
- Ensure regime results exist: `ls regime_results/`
- Run regime clustering if missing: `PYTHONPATH=src .venv/bin/python src/regime/run_regime_clustering.py`

---

## 📦 Dependencies

```bash
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
pydantic>=2.6.0
python-multipart>=0.0.9
pandas>=1.3
numpy>=1.21
```

Installed via: `pip install -r requirements.txt`
