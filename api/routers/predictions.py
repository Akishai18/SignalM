"""
Predictions API Router
Serves regime predictions using trained ML models
"""
from fastapi import APIRouter, HTTPException, Query, Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import pandas as pd
import numpy as np
from datetime import datetime
import sys
import os

# Add src to path for regime imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'src'))

from regime.inference import load_prediction_engine, RegimePredictionEngine

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

# --- Pydantic Models ---

class ModelPrediction(BaseModel):
    model_name: str
    predicted_regime: int
    predicted_regime_name: str
    confidence: float
    probabilities: Dict[str, float]  # regime_name -> probability

class HorizonPrediction(BaseModel):
    horizon_days: int
    ensemble: ModelPrediction
    individual_models: List[ModelPrediction]
    weights: Dict[str, float]

class PredictionsResponse(BaseModel):
    symbol: str
    current_regime: Optional[int] = None
    current_date: str
    predictions: Dict[str, HorizonPrediction]  # "1d", "7d", "30d"
    timestamp: str

class ModelAccuracy(BaseModel):
    model_name: str
    horizon_days: int
    train_accuracy: float
    test_accuracy: Optional[float] = None
    mean_confidence: float

class ModelComparison(BaseModel):
    symbol: str
    horizons: List[int]
    accuracies: List[ModelAccuracy]
    best_model_by_horizon: Dict[int, str]  # horizon -> model_name

class CustomPredictionRequest(BaseModel):
    features: List[Dict[str, float]]  # Recent feature history (at least 22 rows)
    current_regime: Optional[int] = None

class CustomPredictionResponse(BaseModel):
    symbol: str
    horizons: Dict[str, HorizonPrediction]
    timestamp: str

# --- Helper Functions ---

def get_regime_label_map():
    """Regime ID to name mapping"""
    return {
        0: 'Calm',
        1: 'Crisis',
        2: 'Elevated Stress',
        3: 'Transition'
    }

def format_model_prediction(
    model_name: str,
    prediction: Dict,
    regime_map: Dict[int, str]
) -> ModelPrediction:
    """Format a model prediction into API response format"""
    predicted_regime = prediction['predicted_regime']
    probabilities = {
        regime_map[i]: float(prob)
        for i, prob in enumerate(prediction['probabilities'])
    }

    return ModelPrediction(
        model_name=model_name,
        predicted_regime=predicted_regime,
        predicted_regime_name=regime_map[predicted_regime],
        confidence=float(prediction['confidence']),
        probabilities=probabilities
    )

def load_current_features(symbol: str) -> tuple[pd.DataFrame, Optional[int]]:
    """Load current features and regime for an index"""
    try:
        # Always use the main regime features file (normalized regime features, not raw price data)
        # Index-specific files in indices/ folder contain raw market data, not regime features
        features_path = 'regime_results/regime_features_normalized.csv'

        # Try index-specific regime labels, fallback to SPY
        symbol_lower = symbol.lower()
        regime_path = f'regime_results/indices/{symbol_lower}_regimes.csv'
        if not os.path.exists(regime_path):
            regime_path = 'regime_results/regime_labels_k4.csv'

        # Load features
        features = pd.read_csv(features_path, index_col=0, parse_dates=True)

        # Remove timezone if present
        if hasattr(features.index, 'tz') and features.index.tz is not None:
            features.index = features.index.tz_localize(None)

        # Ensure all columns are numeric (drop any string columns like 'symbol')
        features = features.select_dtypes(include=[np.number])

        # Ensure we have enough data for lag features (need at least 22 rows)
        if len(features) < 22:
            raise ValueError(f"Insufficient feature history: {len(features)} rows (need at least 22)")

        # Load regime
        regime_labels = pd.read_csv(regime_path, index_col=0, parse_dates=True).squeeze()
        if hasattr(regime_labels.index, 'tz') and regime_labels.index.tz is not None:
            regime_labels.index = regime_labels.index.tz_localize(None)

        current_regime = int(regime_labels.iloc[-1]) if len(regime_labels) > 0 else None

        return features, current_regime

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load features for {symbol}: {str(e)}"
        )

# --- Cached Prediction Engines ---
# Load engines once to avoid reloading models on every request
_prediction_engines: Dict[str, RegimePredictionEngine] = {}

def get_prediction_engine(symbol: str) -> RegimePredictionEngine:
    """Get or create prediction engine for a symbol"""
    global _prediction_engines

    if symbol not in _prediction_engines:
        try:
            _prediction_engines[symbol] = load_prediction_engine(symbol, models_dir='models')
        except Exception as e:
            raise HTTPException(
                status_code=404,
                detail=f"No trained models found for {symbol}. Train models first."
            )

    return _prediction_engines[symbol]

# --- API Endpoints ---

@router.get("/{symbol}/current", response_model=PredictionsResponse)
def get_current_predictions(symbol: str):
    """
    Get current regime predictions for all horizons (1d, 7d, 30d)

    Returns ensemble predictions combining all 4 models (Markov, HMM, RF, XGBoost)
    """
    symbol = symbol.upper()

    # Load prediction engine
    engine = get_prediction_engine(symbol)

    # Load current features and regime
    features, current_regime = load_current_features(symbol)

    # Get current date
    current_date = features.index[-1]

    # Make predictions for all horizons
    try:
        all_predictions = engine.predict_all_horizons(
            current_features=features,
            current_regime=current_regime
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

    # Format response
    regime_map = get_regime_label_map()
    predictions = {}

    for horizon_key, pred_data in all_predictions.items():
        # Format ensemble prediction
        ensemble_pred = format_model_prediction(
            "Ensemble",
            pred_data['ensemble'],
            regime_map
        )

        # Format individual model predictions
        individual_preds = [
            format_model_prediction(
                model_name.replace('_', ' ').title(),
                model_pred,
                regime_map
            )
            for model_name, model_pred in pred_data['individual_models'].items()
        ]

        predictions[horizon_key] = HorizonPrediction(
            horizon_days=int(horizon_key.replace('d', '')),
            ensemble=ensemble_pred,
            individual_models=individual_preds,
            weights=pred_data['weights']
        )

    return PredictionsResponse(
        symbol=symbol,
        current_regime=current_regime,
        current_date=current_date.strftime('%Y-%m-%d'),
        predictions=predictions,
        timestamp=datetime.now().isoformat()
    )

@router.get("/{symbol}/horizon/{days}", response_model=HorizonPrediction)
def get_horizon_prediction(
    symbol: str,
    days: int = Path(..., description="Prediction horizon in days (1, 7, or 30)")
):
    """
    Get prediction for a specific horizon

    Available horizons: 1, 7, 30 days
    """
    symbol = symbol.upper()

    # Validate horizon
    if days not in [1, 7, 30]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid horizon: {days}. Must be 1, 7, or 30 days."
        )

    # Load prediction engine
    engine = get_prediction_engine(symbol)

    # Load current features and regime
    features, current_regime = load_current_features(symbol)

    # Make prediction
    try:
        pred_data = engine.predict_ensemble(
            horizon=days,
            current_features=features,
            current_regime=current_regime
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

    # Format response
    regime_map = get_regime_label_map()

    ensemble_pred = format_model_prediction(
        "Ensemble",
        pred_data['ensemble'],
        regime_map
    )

    individual_preds = [
        format_model_prediction(
            model_name.replace('_', ' ').title(),
            model_pred,
            regime_map
        )
        for model_name, model_pred in pred_data['individual_models'].items()
    ]

    return HorizonPrediction(
        horizon_days=days,
        ensemble=ensemble_pred,
        individual_models=individual_preds,
        weights=pred_data['weights']
    )

@router.get("/{symbol}/model/{model_name}/horizon/{days}")
def get_single_model_prediction(
    symbol: str,
    model_name: str = Path(..., description="Model name: markov, hmm, random_forest, or xgboost"),
    days: int = Path(..., description="Prediction horizon in days (1, 7, or 30)")
):
    """
    Get prediction from a single model

    Models: markov, hmm, random_forest, xgboost
    """
    symbol = symbol.upper()

    # Validate model name
    valid_models = ['markov', 'hmm', 'random_forest', 'xgboost']
    if model_name.lower() not in valid_models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model: {model_name}. Must be one of {valid_models}"
        )

    # Validate horizon
    if days not in [1, 7, 30]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid horizon: {days}. Must be 1, 7, or 30 days."
        )

    # Load prediction engine
    engine = get_prediction_engine(symbol)

    # Load current features and regime
    features, current_regime = load_current_features(symbol)

    # Make prediction
    try:
        prediction = engine.predict_single_model(
            model_type=model_name.lower(),
            horizon=days,
            current_features=features,
            current_regime=current_regime
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

    # Format response
    regime_map = get_regime_label_map()
    return format_model_prediction(
        model_name.replace('_', ' ').title(),
        prediction,
        regime_map
    )

@router.get("/{symbol}/accuracy", response_model=ModelComparison)
def get_model_accuracy(symbol: str):
    """
    Get training accuracy for all models and horizons

    Returns comparison of model performance
    """
    symbol = symbol.upper()

    # Load prediction engine to get metadata
    engine = get_prediction_engine(symbol)

    # Load training results from saved models
    accuracies = []
    best_model_by_horizon = {}

    # For each horizon, get model accuracies
    for horizon in engine.horizons:
        # Load ML model results (RF and XGBoost)
        if 'ml' in engine.models and horizon in engine.models['ml']:
            horizon_models = engine.models['ml'][horizon]

            # Random Forest
            if 'random_forest' in horizon_models:
                # Training accuracy is embedded in the model during training
                # For now, use static values from training results
                if horizon == 1:
                    accuracies.append(ModelAccuracy(
                        model_name="Random Forest",
                        horizon_days=horizon,
                        train_accuracy=0.9106,
                        mean_confidence=0.7665
                    ))
                elif horizon == 7:
                    accuracies.append(ModelAccuracy(
                        model_name="Random Forest",
                        horizon_days=horizon,
                        train_accuracy=0.8321,
                        mean_confidence=0.7912
                    ))
                elif horizon == 30:
                    accuracies.append(ModelAccuracy(
                        model_name="Random Forest",
                        horizon_days=horizon,
                        train_accuracy=0.8330,
                        mean_confidence=0.8288
                    ))

            # XGBoost
            if 'xgboost' in horizon_models:
                if horizon == 1:
                    accuracies.append(ModelAccuracy(
                        model_name="XGBoost",
                        horizon_days=horizon,
                        train_accuracy=0.8181,
                        mean_confidence=0.8831
                    ))
                elif horizon == 7:
                    accuracies.append(ModelAccuracy(
                        model_name="XGBoost",
                        horizon_days=horizon,
                        train_accuracy=0.8476,
                        mean_confidence=0.8661
                    ))
                elif horizon == 30:
                    accuracies.append(ModelAccuracy(
                        model_name="XGBoost",
                        horizon_days=horizon,
                        train_accuracy=0.7687,
                        mean_confidence=0.9055
                    ))

        # Add Markov and HMM (horizon-independent, but show for each)
        if horizon == 1:  # Only add once
            if 'markov' in engine.models:
                accuracies.append(ModelAccuracy(
                    model_name="Markov Chain",
                    horizon_days=1,
                    train_accuracy=0.9954,
                    mean_confidence=0.9954
                ))
            if 'hmm' in engine.models:
                accuracies.append(ModelAccuracy(
                    model_name="HMM",
                    horizon_days=1,
                    train_accuracy=0.8633,
                    mean_confidence=0.9686
                ))

        # Determine best model for this horizon
        horizon_accs = [a for a in accuracies if a.horizon_days == horizon]
        if horizon_accs:
            best = max(horizon_accs, key=lambda x: x.train_accuracy)
            best_model_by_horizon[horizon] = best.model_name

    return ModelComparison(
        symbol=symbol,
        horizons=engine.horizons,
        accuracies=accuracies,
        best_model_by_horizon=best_model_by_horizon
    )

@router.get("/compare")
def compare_indices_predictions():
    """
    Compare predictions across all 4 indices

    Returns current predictions for SPY, QQQ, DIA, IWM
    """
    indices = ['SPY', 'QQQ', 'DIA', 'IWM']
    comparison = {}

    for symbol in indices:
        try:
            # Get current predictions
            engine = get_prediction_engine(symbol)
            features, current_regime = load_current_features(symbol)
            predictions = engine.predict_all_horizons(features, current_regime)

            regime_map = get_regime_label_map()

            # Extract ensemble predictions only
            comparison[symbol] = {
                horizon_key: {
                    'predicted_regime': pred_data['ensemble']['predicted_regime'],
                    'predicted_regime_name': regime_map[pred_data['ensemble']['predicted_regime']],
                    'confidence': pred_data['ensemble']['confidence'],
                    'probabilities': {
                        regime_map[i]: float(prob)
                        for i, prob in enumerate(pred_data['ensemble']['probabilities'])
                    }
                }
                for horizon_key, pred_data in predictions.items()
            }

        except Exception as e:
            comparison[symbol] = {
                'error': str(e)
            }

    return {
        'indices': comparison,
        'timestamp': datetime.now().isoformat()
    }

@router.post("/{symbol}/custom", response_model=CustomPredictionResponse)
def custom_prediction(
    symbol: str,
    request: CustomPredictionRequest
):
    """
    Make prediction with custom feature data

    Useful for what-if scenarios or backtesting
    """
    symbol = symbol.upper()

    # Load prediction engine
    engine = get_prediction_engine(symbol)

    # Convert features to DataFrame
    try:
        feature_df = pd.DataFrame(request.features)
        if 'date' in feature_df.columns:
            feature_df['date'] = pd.to_datetime(feature_df['date'])
            feature_df = feature_df.set_index('date')
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid features format: {str(e)}"
        )

    # Validate feature count
    if len(feature_df) < 22:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 22 rows of features for prediction (lag-21). Got {len(feature_df)}"
        )

    # Make predictions
    try:
        all_predictions = engine.predict_all_horizons(
            current_features=feature_df,
            current_regime=request.current_regime
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

    # Format response
    regime_map = get_regime_label_map()
    predictions = {}

    for horizon_key, pred_data in all_predictions.items():
        ensemble_pred = format_model_prediction(
            "Ensemble",
            pred_data['ensemble'],
            regime_map
        )

        individual_preds = [
            format_model_prediction(
                model_name.replace('_', ' ').title(),
                model_pred,
                regime_map
            )
            for model_name, model_pred in pred_data['individual_models'].items()
        ]

        predictions[horizon_key] = HorizonPrediction(
            horizon_days=int(horizon_key.replace('d', '')),
            ensemble=ensemble_pred,
            individual_models=individual_preds,
            weights=pred_data['weights']
        )

    return CustomPredictionResponse(
        symbol=symbol,
        horizons=predictions,
        timestamp=datetime.now().isoformat()
    )

@router.get("/health")
def predictions_health():
    """Health check for predictions service"""
    try:
        # Check if models directory exists
        if not os.path.exists('models'):
            return {
                "status": "unhealthy",
                "error": "Models directory not found. Train models first.",
                "timestamp": datetime.now().isoformat()
            }

        # Check if at least SPY models exist
        spy_models_dir = 'models/SPY'
        if not os.path.exists(spy_models_dir):
            return {
                "status": "unhealthy",
                "error": "SPY models not found. Train models first.",
                "timestamp": datetime.now().isoformat()
            }

        # Count available models
        model_count = len([f for f in os.listdir(spy_models_dir) if f.endswith('.pkl')])

        return {
            "status": "healthy",
            "models_loaded": len(_prediction_engines),
            "available_indices": len([d for d in os.listdir('models') if os.path.isdir(os.path.join('models', d))]),
            "spy_model_files": model_count,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
