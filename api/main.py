"""
FastAPI backend for Market Regime Dashboard
Serves regime detection and prediction data to the frontend
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Initialize FastAPI app
app = FastAPI(
    title="Market Regime API",
    description="API for market regime detection and prediction",
    version="1.0.0"
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:3000",  # Alternative
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for API responses
class RegimeLabel(BaseModel):
    id: int
    name: str
    description: str
    color: str

class CurrentRegime(BaseModel):
    regime_id: int
    regime_name: str
    confidence: float
    days_in_regime: int
    date: str

class RegimeHistoryPoint(BaseModel):
    date: str
    regime: int
    regime_name: str

class PredictionModel(BaseModel):
    model_name: str
    accuracy: float
    confidence: float
    predicted_regime: int
    predicted_regime_name: str
    probabilities: Dict[int, float]

class ForecastHorizon(BaseModel):
    horizon_days: int
    models: List[PredictionModel]

class DashboardMetrics(BaseModel):
    avg_correlation: float
    vol_dispersion: float
    effective_dimension: float
    current_regime: str
    regime_confidence: float
    days_in_regime: int

class FeatureImportance(BaseModel):
    feature: str
    importance: float
    rank: int

# --- Helper Functions ---

def load_regime_data():
    """Load regime labels and features"""
    try:
        regime_labels = pd.read_csv('regime_results/regime_labels_k4.csv',
                                    index_col=0, parse_dates=True).squeeze()
        feature_df = pd.read_csv('regime_results/regime_features_normalized.csv',
                                index_col=0, parse_dates=True)
        return regime_labels, feature_df
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load regime data: {str(e)}")

def get_regime_label_map():
    """Regime ID to name mapping"""
    return {
        0: 'Calm',
        1: 'Crisis',
        2: 'Elevated Stress',
        3: 'Transition'
    }

def get_regime_colors():
    """Regime ID to color mapping"""
    return {
        0: '#10b981',  # green (Calm)
        1: '#ef4444',  # red (Crisis)
        2: '#f59e0b',  # orange (Elevated Stress)
        3: '#8b5cf6',  # purple (Transition)
    }

def get_regime_descriptions():
    """Regime ID to description"""
    return {
        0: 'Low volatility, low correlation, high effective dimension',
        1: 'High volatility, high correlation, low effective dimension',
        2: 'Medium volatility, medium correlation',
        3: 'Mixed characteristics, regime shifts'
    }

# --- API Endpoints ---

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Market Regime API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/regimes/labels", response_model=List[RegimeLabel])
def get_regime_labels():
    """Get all regime labels with metadata"""
    label_map = get_regime_label_map()
    colors = get_regime_colors()
    descriptions = get_regime_descriptions()

    return [
        RegimeLabel(
            id=regime_id,
            name=label_map[regime_id],
            description=descriptions[regime_id],
            color=colors[regime_id]
        )
        for regime_id in sorted(label_map.keys())
    ]

@app.get("/api/regimes/current", response_model=CurrentRegime)
def get_current_regime():
    """Get current regime state"""
    regime_labels, _ = load_regime_data()

    # Get most recent regime
    current_regime_id = int(regime_labels.iloc[-1])
    current_date = regime_labels.index[-1]

    # Calculate days in current regime
    days_in_regime = 1
    for i in range(len(regime_labels) - 2, -1, -1):
        if regime_labels.iloc[i] == current_regime_id:
            days_in_regime += 1
        else:
            break

    # Mock confidence for now (will compute from predictions later)
    confidence = 0.85

    regime_name = get_regime_label_map()[current_regime_id]

    return CurrentRegime(
        regime_id=current_regime_id,
        regime_name=regime_name,
        confidence=confidence,
        days_in_regime=days_in_regime,
        date=current_date.strftime('%Y-%m-%d')
    )

@app.get("/api/regimes/history", response_model=List[RegimeHistoryPoint])
def get_regime_history(limit: Optional[int] = 1000):
    """Get historical regime labels"""
    regime_labels, _ = load_regime_data()
    label_map = get_regime_label_map()

    # Get last N points
    recent_labels = regime_labels.tail(limit)

    history = [
        RegimeHistoryPoint(
            date=date.strftime('%Y-%m-%d'),
            regime=int(regime),
            regime_name=label_map[int(regime)]
        )
        for date, regime in recent_labels.items()
    ]

    return history

@app.get("/api/predictions/forecast")
def get_forecast():
    """Get regime predictions for 1/7/30-day horizons"""
    # For now, return mock data - will integrate with prediction models
    current_regime = get_current_regime()

    # Simplified forecast (using persistence as baseline)
    forecast = {
        "current_regime": current_regime.dict(),
        "horizons": [
            {
                "horizon_days": 1,
                "predicted_regime": current_regime.regime_id,
                "predicted_regime_name": current_regime.regime_name,
                "confidence": 0.95,
                "probabilities": {
                    0: 0.95 if current_regime.regime_id == 0 else 0.02,
                    1: 0.95 if current_regime.regime_id == 1 else 0.01,
                    2: 0.95 if current_regime.regime_id == 2 else 0.01,
                    3: 0.95 if current_regime.regime_id == 3 else 0.01,
                }
            },
            {
                "horizon_days": 7,
                "predicted_regime": current_regime.regime_id,
                "predicted_regime_name": current_regime.regime_name,
                "confidence": 0.85,
                "probabilities": {
                    0: 0.85 if current_regime.regime_id == 0 else 0.05,
                    1: 0.85 if current_regime.regime_id == 1 else 0.03,
                    2: 0.85 if current_regime.regime_id == 2 else 0.05,
                    3: 0.85 if current_regime.regime_id == 3 else 0.07,
                }
            },
            {
                "horizon_days": 30,
                "predicted_regime": current_regime.regime_id,
                "predicted_regime_name": current_regime.regime_name,
                "confidence": 0.70,
                "probabilities": {
                    0: 0.70 if current_regime.regime_id == 0 else 0.10,
                    1: 0.70 if current_regime.regime_id == 1 else 0.05,
                    2: 0.70 if current_regime.regime_id == 2 else 0.10,
                    3: 0.70 if current_regime.regime_id == 3 else 0.15,
                }
            }
        ]
    }

    return forecast

@app.get("/api/predictions/comparison")
def get_model_comparison():
    """Get accuracy comparison of all 4 prediction models"""
    # Mock data matching FINDINGS.md results
    return {
        "models": [
            {
                "model_name": "Markov Chain",
                "accuracy": 0.9954,
                "confidence": 0.9954,
                "correct_predictions": 3248,
                "total_predictions": 3263
            },
            {
                "model_name": "Random Forest",
                "accuracy": 0.9106,
                "confidence": 0.7665,
                "correct_predictions": 886,
                "total_predictions": 973
            },
            {
                "model_name": "HMM",
                "accuracy": 0.8633,
                "confidence": 0.9686,
                "correct_predictions": 2817,
                "total_predictions": 3263
            },
            {
                "model_name": "XGBoost",
                "accuracy": 0.8181,
                "confidence": 0.8831,
                "correct_predictions": 796,
                "total_predictions": 973
            }
        ],
        "best_model": "Markov Chain",
        "insights": [
            "Markov baseline is highly competitive due to high regime persistence",
            "Feature-based models (RF/XGBoost) show modest improvement beyond persistence",
            "HMM achieves 86% accuracy inferring state from features alone"
        ]
    }

@app.get("/api/metrics/summary", response_model=DashboardMetrics)
def get_metrics_summary():
    """Get summary metrics for dashboard"""
    _, feature_df = load_regime_data()
    current_regime = get_current_regime()

    # Get most recent features
    latest_features = feature_df.iloc[-1]

    return DashboardMetrics(
        avg_correlation=float(latest_features.get('avg_correlation', 0.47)),
        vol_dispersion=float(latest_features.get('vol_dispersion_126', 0.12)),
        effective_dimension=float(latest_features.get('effective_dimension', 4.5)),
        current_regime=current_regime.regime_name,
        regime_confidence=current_regime.confidence,
        days_in_regime=current_regime.days_in_regime
    )

@app.get("/api/features/importance")
def get_feature_importance(model: str = "random_forest", top_n: int = 10):
    """Get feature importance for a given model"""
    # Mock data from FINDINGS.md
    if model.lower() == "random_forest":
        importances = [
            {"feature": "cum_var_3_lag5", "importance": 0.074, "rank": 1},
            {"feature": "avg_vol_126_lag21", "importance": 0.070, "rank": 2},
            {"feature": "cum_var_3", "importance": 0.058, "rank": 3},
            {"feature": "vol_dispersion_126", "importance": 0.058, "rank": 4},
            {"feature": "effective_dimension_lag5", "importance": 0.052, "rank": 5},
            {"feature": "avg_vol_126", "importance": 0.048, "rank": 6},
            {"feature": "pc1_var_lag21", "importance": 0.045, "rank": 7},
            {"feature": "vol_dispersion_126_lag21", "importance": 0.042, "rank": 8},
        ]
    elif model.lower() == "xgboost":
        importances = [
            {"feature": "vol_dispersion_126", "importance": 0.121, "rank": 1},
            {"feature": "vol_dispersion_126_lag1", "importance": 0.107, "rank": 2},
            {"feature": "effective_dimension_lag21", "importance": 0.090, "rank": 3},
            {"feature": "cum_var_3_lag5", "importance": 0.078, "rank": 4},
            {"feature": "avg_correlation_lag5", "importance": 0.065, "rank": 5},
            {"feature": "pc1_var", "importance": 0.058, "rank": 6},
            {"feature": "avg_vol_126_lag5", "importance": 0.052, "rank": 7},
            {"feature": "effective_dimension", "importance": 0.048, "rank": 8},
        ]
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model: {model}")

    return importances[:top_n]

@app.get("/api/correlations/matrix")
def get_correlation_matrix():
    """Get correlation matrix for sector/factor analysis"""
    # Mock correlation matrix (will replace with real sector data later)
    sectors = ["Technology", "Healthcare", "Financials", "Energy", "Consumer", "Industrials"]

    # Generate symmetric correlation matrix
    np.random.seed(42)
    n = len(sectors)
    corr_matrix = np.random.rand(n, n) * 0.6 + 0.2  # Correlations between 0.2 and 0.8
    corr_matrix = (corr_matrix + corr_matrix.T) / 2  # Make symmetric
    np.fill_diagonal(corr_matrix, 1.0)  # Diagonal = 1

    return {
        "sectors": sectors,
        "matrix": corr_matrix.tolist(),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/health")
def health_check():
    """Detailed health check with data status"""
    try:
        regime_labels, feature_df = load_regime_data()
        return {
            "status": "healthy",
            "data_loaded": True,
            "regime_labels_count": len(regime_labels),
            "features_count": len(feature_df.columns),
            "date_range": {
                "start": regime_labels.index[0].strftime('%Y-%m-%d'),
                "end": regime_labels.index[-1].strftime('%Y-%m-%d')
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
