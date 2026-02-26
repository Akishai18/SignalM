"""
FastAPI backend for SignalM
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
    title="SignalM API",
    description="API for market regime detection and prediction",
    version="1.0.0"
)

# Import and include prediction router
try:
    from api.routers.predictions import router as predictions_router
    app.include_router(predictions_router)
    print("✓ Predictions router loaded successfully")
except Exception as e:
    print(f"⚠ Failed to load predictions router: {e}")

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:8080",  # Vite alternative port
        "http://localhost:3000",  # Alternative
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
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

class SPYDataPoint(BaseModel):
    date: str
    close: float
    returns: Optional[float] = None
    vol_252d: Optional[float] = None
    regime: Optional[int] = None

class VIXDataPoint(BaseModel):
    date: str
    close: float
    regime: Optional[int] = None

class RegimePerformance(BaseModel):
    regime_id: int
    regime_name: str
    days: int
    avg_daily_return: float
    annualized_return: float
    volatility: float
    sharpe_ratio: float
    max_daily_gain: float
    max_daily_loss: float
    win_rate: float
    avg_vix: Optional[float] = None

class IndexInfo(BaseModel):
    symbol: str
    name: str
    description: str
    category: str
    color: str

class IndexRegime(BaseModel):
    symbol: str
    name: str
    regime_id: int
    regime_name: str
    date: str
    price: Optional[float] = None
    volatility: Optional[float] = None

class IndexComparison(BaseModel):
    indices: List[IndexRegime]
    timestamp: str

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

def load_spy_data():
    """Load SPY market data"""
    try:
        spy_df = pd.read_csv('data/spy_data.csv', index_col=0, parse_dates=True)
        # Remove timezone if present
        if hasattr(spy_df.index, 'tz') and spy_df.index.tz is not None:
            spy_df.index = spy_df.index.tz_localize(None)
        return spy_df
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="SPY data not found. Run update_regime_data.py first.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load SPY data: {str(e)}")

def load_vix_data():
    """Load VIX market data"""
    try:
        vix_df = pd.read_csv('data/vix_data.csv', index_col=0, parse_dates=True)
        # Remove timezone if present
        if hasattr(vix_df.index, 'tz') and vix_df.index.tz is not None:
            vix_df.index = vix_df.index.tz_localize(None)
        return vix_df
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="VIX data not found. Run update_regime_data.py first.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load VIX data: {str(e)}")

def load_regime_performance():
    """Load regime-conditioned SPY performance"""
    try:
        perf_df = pd.read_csv('regime_results/spy_performance_by_regime.csv')
        vix_df = pd.read_csv('regime_results/vix_stats_by_regime.csv')

        # Merge VIX stats
        merged = perf_df.merge(vix_df[['regime_id', 'avg_vix']], on='regime_id', how='left')
        return merged
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Performance data not found. Run update_regime_data.py first.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load performance data: {str(e)}")

def load_index_regimes(symbol: str):
    """Load regime labels for a specific index"""
    try:
        symbol_lower = symbol.lower()
        regime_path = f'regime_results/indices/{symbol_lower}_regimes.csv'
        regimes = pd.read_csv(regime_path, index_col=0, parse_dates=True).squeeze()

        # Remove timezone if present
        if hasattr(regimes.index, 'tz') and regimes.index.tz is not None:
            regimes.index = regimes.index.tz_localize(None)

        return regimes
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Regime data not found for {symbol}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load regime data for {symbol}: {str(e)}")

def load_index_features(symbol: str):
    """Load features for a specific index"""
    try:
        symbol_lower = symbol.lower()
        features_path = f'regime_results/indices/{symbol_lower}_features.csv'
        features = pd.read_csv(features_path, index_col=0, parse_dates=True)

        # Remove timezone if present
        if hasattr(features.index, 'tz') and features.index.tz is not None:
            features.index = features.index.tz_localize(None)

        return features
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Feature data not found for {symbol}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load features for {symbol}: {str(e)}")

def get_index_config():
    """Get index configuration from config file"""
    try:
        from src.data.index_config import ALL_INDICES
        return ALL_INDICES
    except Exception as e:
        # Fallback to basic config
        return {
            'SPY': {'name': 'S&P 500', 'description': 'Large-cap US stocks', 'category': 'US Equity', 'color': '#0ea5e9'},
            'QQQ': {'name': 'NASDAQ-100', 'description': 'Tech-heavy large-cap', 'category': 'US Equity', 'color': '#8b5cf6'},
            'DIA': {'name': 'Dow Jones', 'description': '30 blue-chip stocks', 'category': 'US Equity', 'color': '#10b981'},
            'IWM': {'name': 'Russell 2000', 'description': 'Small-cap US stocks', 'category': 'US Equity', 'color': '#f59e0b'},
        }

# --- API Endpoints ---

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "SignalM API",
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

# --- Market Data Endpoints ---

@app.get("/api/market/spy/history")
def get_spy_history(limit: Optional[int] = 365):
    """Get SPY historical price and returns data"""
    spy_df = load_spy_data()

    # Load regime labels to add regime column
    try:
        regime_labels, _ = load_regime_data()
        common_dates = spy_df.index.intersection(regime_labels.index)
        spy_df = spy_df.loc[common_dates].copy()
        spy_df['regime'] = regime_labels.loc[common_dates]
    except:
        pass

    # Get last N days
    recent_spy = spy_df.tail(limit)

    history = [
        {
            "date": date.strftime('%Y-%m-%d'),
            "close": float(row['close']),
            "returns": float(row['returns']) if pd.notna(row.get('returns')) else None,
            "vol_252d": float(row['vol_252d']) if pd.notna(row.get('vol_252d')) else None,
            "regime": int(row['regime']) if 'regime' in row and pd.notna(row['regime']) else None
        }
        for date, row in recent_spy.iterrows()
    ]

    return {
        "data": history,
        "count": len(history),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/market/spy/current")
def get_spy_current():
    """Get current SPY price and metrics"""
    spy_df = load_spy_data()
    latest = spy_df.iloc[-1]

    return {
        "date": spy_df.index[-1].strftime('%Y-%m-%d'),
        "close": float(latest['close']),
        "returns": float(latest['returns']) if pd.notna(latest.get('returns')) else None,
        "vol_252d": float(latest['vol_252d']) if pd.notna(latest.get('vol_252d')) else None,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/market/vix/history")
def get_vix_history(limit: Optional[int] = 365):
    """Get VIX historical data"""
    vix_df = load_vix_data()

    # Load regime labels to add regime column
    try:
        regime_labels, _ = load_regime_data()
        common_dates = vix_df.index.intersection(regime_labels.index)
        vix_df = vix_df.loc[common_dates].copy()
        vix_df['regime'] = regime_labels.loc[common_dates]
    except:
        pass

    # Get last N days
    recent_vix = vix_df.tail(limit)

    history = [
        {
            "date": date.strftime('%Y-%m-%d'),
            "close": float(row['close']),
            "regime": int(row['regime']) if 'regime' in row and pd.notna(row['regime']) else None
        }
        for date, row in recent_vix.iterrows()
    ]

    return {
        "data": history,
        "count": len(history),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/market/vix/current")
def get_vix_current():
    """Get current VIX level"""
    vix_df = load_vix_data()
    latest = vix_df.iloc[-1]

    return {
        "date": vix_df.index[-1].strftime('%Y-%m-%d'),
        "close": float(latest['close']),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/regimes/performance", response_model=List[RegimePerformance])
def get_regime_performance():
    """Get SPY performance metrics by regime"""
    perf_df = load_regime_performance()

    performance = [
        RegimePerformance(
            regime_id=int(row['regime_id']),
            regime_name=str(row['regime_name']),
            days=int(row['days']),
            avg_daily_return=float(row['avg_daily_return']),
            annualized_return=float(row['annualized_return']),
            volatility=float(row['volatility']),
            sharpe_ratio=float(row['sharpe_ratio']),
            max_daily_gain=float(row['max_daily_gain']),
            max_daily_loss=float(row['max_daily_loss']),
            win_rate=float(row['win_rate']),
            avg_vix=float(row['avg_vix']) if pd.notna(row.get('avg_vix')) else None
        )
        for _, row in perf_df.iterrows()
    ]

    return performance

@app.get("/api/market/merged")
def get_merged_market_data(limit: Optional[int] = 365):
    """Get merged regime + SPY + VIX data"""
    try:
        merged_df = pd.read_csv('regime_results/regime_with_market_data.csv',
                               index_col=0, parse_dates=True)

        # Get last N days
        recent_data = merged_df.tail(limit)

        data = [
            {
                "date": date.strftime('%Y-%m-%d'),
                "regime": int(row['regime']) if pd.notna(row.get('regime')) else None,
                "spy_close": float(row['spy_close']) if pd.notna(row.get('spy_close')) else None,
                "spy_returns": float(row['spy_returns']) if pd.notna(row.get('spy_returns')) else None,
                "spy_vol_252d": float(row['spy_vol_252d']) if pd.notna(row.get('spy_vol_252d')) else None,
                "vix": float(row['vix']) if pd.notna(row.get('vix')) else None,
            }
            for date, row in recent_data.iterrows()
        ]

        return {
            "data": data,
            "count": len(data),
            "timestamp": datetime.now().isoformat()
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Merged data not found. Run update_regime_data.py first.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load merged data: {str(e)}")

# --- Multi-Index Endpoints ---

@app.get("/api/indices/list", response_model=List[IndexInfo])
def get_indices_list():
    """Get list of all available indices"""
    indices_config = get_index_config()

    return [
        IndexInfo(
            symbol=symbol,
            name=info['name'],
            description=info['description'],
            category=info['category'],
            color=info['color']
        )
        for symbol, info in indices_config.items()
    ]

@app.get("/api/indices/{symbol}/current", response_model=IndexRegime)
def get_index_current_regime(symbol: str):
    """Get current regime for a specific index"""
    symbol_upper = symbol.upper()
    indices_config = get_index_config()

    if symbol_upper not in indices_config:
        raise HTTPException(status_code=404, detail=f"Index {symbol} not found")

    # Load regime data
    regimes = load_index_regimes(symbol_upper)
    features = load_index_features(symbol_upper)

    # Get most recent regime
    current_regime_id = int(regimes.iloc[-1]) if pd.notna(regimes.iloc[-1]) else 0
    current_date = regimes.index[-1]

    # Get price and volatility from features
    latest_features = features.iloc[-1]
    price = float(latest_features.get('close', 0)) if 'close' in latest_features else None
    vol = float(latest_features.get('vol_252d', 0)) if 'vol_252d' in latest_features else None

    regime_name = get_regime_label_map()[current_regime_id]

    return IndexRegime(
        symbol=symbol_upper,
        name=indices_config[symbol_upper]['name'],
        regime_id=current_regime_id,
        regime_name=regime_name,
        date=current_date.strftime('%Y-%m-%d'),
        price=price,
        volatility=vol
    )

@app.get("/api/indices/{symbol}/history")
def get_index_regime_history(symbol: str, limit: Optional[int] = 365):
    """Get historical regimes for a specific index"""
    symbol_upper = symbol.upper()
    indices_config = get_index_config()

    if symbol_upper not in indices_config:
        raise HTTPException(status_code=404, detail=f"Index {symbol} not found")

    # Load regime data
    regimes = load_index_regimes(symbol_upper)
    features = load_index_features(symbol_upper)

    # Get last N days
    recent_regimes = regimes.tail(limit)

    regime_label_map = get_regime_label_map()

    history = [
        {
            "date": date.strftime('%Y-%m-%d'),
            "regime": int(regime) if pd.notna(regime) else None,
            "regime_name": regime_label_map.get(int(regime), 'Unknown') if pd.notna(regime) else None,
            "price": float(features.loc[date, 'close']) if date in features.index and 'close' in features.columns else None
        }
        for date, regime in recent_regimes.items()
    ]

    return {
        "symbol": symbol_upper,
        "name": indices_config[symbol_upper]['name'],
        "data": history,
        "count": len(history),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/indices/comparison", response_model=IndexComparison)
def get_indices_comparison():
    """Get current regimes for all indices"""
    indices_config = get_index_config()
    regime_label_map = get_regime_label_map()

    indices_regimes = []

    for symbol in indices_config.keys():
        try:
            # Load regime data
            regimes = load_index_regimes(symbol)
            features = load_index_features(symbol)

            # Get most recent regime
            current_regime_id = int(regimes.iloc[-1]) if pd.notna(regimes.iloc[-1]) else 0
            current_date = regimes.index[-1]

            # Get price and volatility
            latest_features = features.iloc[-1]
            price = float(latest_features.get('close', 0)) if 'close' in latest_features else None
            vol = float(latest_features.get('vol_252d', 0)) if 'vol_252d' in latest_features else None

            indices_regimes.append(IndexRegime(
                symbol=symbol,
                name=indices_config[symbol]['name'],
                regime_id=current_regime_id,
                regime_name=regime_label_map[current_regime_id],
                date=current_date.strftime('%Y-%m-%d'),
                price=price,
                volatility=vol
            ))

        except Exception as e:
            # Skip indices that don't have data yet
            print(f"Warning: Could not load data for {symbol}: {e}")
            continue

    return IndexComparison(
        indices=indices_regimes,
        timestamp=datetime.now().isoformat()
    )

@app.get("/api/indices/{symbol}/performance", response_model=List[RegimePerformance])
def get_index_regime_performance(symbol: str):
    """Get performance metrics by regime for a specific index"""
    symbol_upper = symbol.upper()
    indices_config = get_index_config()

    if symbol_upper not in indices_config:
        raise HTTPException(status_code=404, detail=f"Index {symbol} not found")

    try:
        # Load regime and feature data
        regimes = load_index_regimes(symbol_upper)
        features = load_index_features(symbol_upper)

        # Merge regimes with features
        df = features.copy()
        df['regime'] = regimes

        # Drop NaN regimes
        df = df.dropna(subset=['regime'])
        df['regime'] = df['regime'].astype(int)

        # Calculate performance metrics for each regime
        regime_label_map = get_regime_label_map()
        performance = []

        for regime_id in sorted(df['regime'].unique()):
            regime_data = df[df['regime'] == regime_id]

            if 'returns' not in regime_data.columns:
                continue

            returns = regime_data['returns'].dropna()
            if len(returns) == 0:
                continue

            # Calculate metrics
            avg_daily_return = returns.mean()
            annualized_return = (1 + avg_daily_return) ** 252 - 1
            volatility = returns.std() * np.sqrt(252)
            sharpe_ratio = annualized_return / volatility if volatility > 0 else 0

            performance.append(RegimePerformance(
                regime_id=regime_id,
                regime_name=regime_label_map.get(regime_id, f"Regime {regime_id}"),
                days=len(regime_data),
                avg_daily_return=float(avg_daily_return),
                annualized_return=float(annualized_return),
                volatility=float(volatility),
                sharpe_ratio=float(sharpe_ratio),
                max_daily_gain=float(returns.max()),
                max_daily_loss=float(returns.min()),
                win_rate=float((returns > 0).sum() / len(returns)),
                avg_vix=None  # VIX is market-wide, not index-specific
            ))

        return performance

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate performance for {symbol}: {str(e)}")

@app.get("/api/indices/{symbol}/merged")
def get_index_merged_data(symbol: str, limit: Optional[int] = 365):
    """Get merged regime + price + VIX data for a specific index"""
    symbol_upper = symbol.upper()
    indices_config = get_index_config()

    if symbol_upper not in indices_config:
        raise HTTPException(status_code=404, detail=f"Index {symbol} not found")

    try:
        # Load regime and feature data for the index
        regimes = load_index_regimes(symbol_upper)
        features = load_index_features(symbol_upper)

        # Load VIX data
        vix_df = load_vix_data()

        # Merge all data
        df = features.copy()
        df['regime'] = regimes

        # Merge with VIX
        df = df.merge(vix_df[['close']], left_index=True, right_index=True, how='left', suffixes=('', '_vix'))
        df = df.rename(columns={'close_vix': 'vix'})

        # Get last N days
        recent_data = df.tail(limit)

        symbol_lower = symbol_upper.lower()
        data = [
            {
                "date": date.strftime('%Y-%m-%d'),
                "regime": int(row['regime']) if pd.notna(row.get('regime')) else None,
                f"{symbol_lower}_close": float(row['close']) if pd.notna(row.get('close')) else None,
                f"{symbol_lower}_returns": float(row['returns']) if pd.notna(row.get('returns')) else None,
                f"{symbol_lower}_vol": float(row['vol_252d']) if pd.notna(row.get('vol_252d')) else None,
                "vix": float(row['vix']) if pd.notna(row.get('vix')) else None,
            }
            for date, row in recent_data.iterrows()
        ]

        return {
            "symbol": symbol_upper,
            "name": indices_config[symbol_upper]['name'],
            "data": data,
            "count": len(data),
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load merged data for {symbol}: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
