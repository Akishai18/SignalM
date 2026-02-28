#!/usr/bin/env python3
"""
Regime Prediction Inference Module
Loads trained models and makes predictions for any index/horizon
"""
import pandas as pd
import numpy as np
import joblib
import os
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')

from regime.feature_predict import build_prediction_features, DEFAULT_LAGS


class RegimePredictionEngine:
    """
    Production-ready prediction engine for regime forecasting
    Loads all trained models and provides unified prediction interface
    """

    def __init__(self, symbol: str, models_dir: str = 'models'):
        """
        Initialize prediction engine for a given index

        Args:
            symbol: Index symbol (SPY, QQQ, DIA, IWM)
            models_dir: Root directory containing trained models
        """
        self.symbol = symbol.upper()
        self.models_dir = os.path.join(models_dir, self.symbol)

        if not os.path.exists(self.models_dir):
            raise ValueError(f"No models found for {self.symbol} in {models_dir}/")

        # Load metadata
        self.metadata = joblib.load(os.path.join(self.models_dir, 'metadata.pkl'))
        self.n_regimes = self.metadata['n_regimes']
        self.horizons = self.metadata['horizons']

        # Load feature names (needed for ML models)
        feature_names_path = os.path.join(self.models_dir, f'{symbol.lower()}_feature_names.pkl')
        self.feature_names = joblib.load(feature_names_path)

        # Load all models
        self.models = self._load_all_models()

        print(f"✓ Loaded prediction engine for {self.symbol}")
        print(f"  - {len(self.models)} models available")
        print(f"  - Horizons: {self.horizons}")
        print(f"  - Regime count: {self.n_regimes}")

    def _load_all_models(self) -> Dict:
        """Load all trained models from disk"""
        models = {}
        symbol_lower = self.symbol.lower()

        # Load Markov model
        markov_path = os.path.join(self.models_dir, f'{symbol_lower}_markov.pkl')
        if os.path.exists(markov_path):
            models['markov'] = joblib.load(markov_path)

        # Load HMM model
        hmm_path = os.path.join(self.models_dir, f'{symbol_lower}_hmm.pkl')
        if os.path.exists(hmm_path):
            models['hmm'] = joblib.load(hmm_path)

        # Load ML models for each horizon
        models['ml'] = {}
        for horizon in self.horizons:
            models['ml'][horizon] = {}

            # Random Forest
            rf_path = os.path.join(self.models_dir, f'{symbol_lower}_rf_h{horizon}.pkl')
            if os.path.exists(rf_path):
                models['ml'][horizon]['random_forest'] = joblib.load(rf_path)

            # XGBoost
            xgb_path = os.path.join(self.models_dir, f'{symbol_lower}_xgb_h{horizon}.pkl')
            if os.path.exists(xgb_path):
                models['ml'][horizon]['xgboost'] = joblib.load(xgb_path)

        return models

    def predict_single_model(
        self,
        model_type: str,
        horizon: int,
        current_features: pd.DataFrame,
        current_regime: Optional[int] = None
    ) -> Dict:
        """
        Make prediction with a single model

        Args:
            model_type: 'markov', 'hmm', 'random_forest', or 'xgboost'
            horizon: Prediction horizon in days (1, 7, 30)
            current_features: Recent feature history (for ML models)
            current_regime: Current regime label (for Markov/HMM)

        Returns:
            Dict with keys: 'predicted_regime', 'probabilities', 'confidence'
        """

        # Markov Chain prediction
        if model_type == 'markov':
            if current_regime is None:
                raise ValueError("Markov model requires current_regime")

            trans_matrix = self.models['markov']['transition_matrix']

            # Multi-step prediction: P^horizon
            trans_matrix_power = np.linalg.matrix_power(trans_matrix, horizon)
            probs = trans_matrix_power[current_regime, :]
            predicted = int(np.argmax(probs))
            confidence = float(probs[predicted])

            return {
                'predicted_regime': predicted,
                'probabilities': probs.tolist(),
                'confidence': confidence
            }

        # HMM prediction
        elif model_type == 'hmm':
            hmm_model = self.models['hmm']['hmm_model']

            # Use forward algorithm with recent features
            # For simplicity, use last observation to get current state distribution
            # Then apply transition matrix horizon times

            # Get HMM model components
            model_obj = hmm_model['model']
            trans_matrix = model_obj.transmat_

            # If current_regime provided, use it as starting state
            if current_regime is not None:
                state_probs = np.zeros(self.n_regimes)
                state_probs[current_regime] = 1.0
            else:
                # Use stationary distribution
                state_probs = np.ones(self.n_regimes) / self.n_regimes

            # Apply transition matrix horizon times
            for _ in range(horizon):
                state_probs = state_probs @ trans_matrix

            predicted = int(np.argmax(state_probs))
            confidence = float(state_probs[predicted])

            return {
                'predicted_regime': predicted,
                'probabilities': state_probs.tolist(),
                'confidence': confidence
            }

        # Random Forest or XGBoost prediction
        elif model_type in ['random_forest', 'xgboost']:
            if horizon not in self.models['ml']:
                raise ValueError(f"No ML models trained for horizon {horizon}")

            if model_type not in self.models['ml'][horizon]:
                raise ValueError(f"{model_type} not available for horizon {horizon}")

            model = self.models['ml'][horizon][model_type]

            # Build lagged features from current_features
            X_pred = self._build_inference_features(current_features)

            # Make prediction
            predicted = int(model.predict(X_pred)[0])
            probs = model.predict_proba(X_pred)[0]
            confidence = float(probs[predicted])

            return {
                'predicted_regime': predicted,
                'probabilities': probs.tolist(),
                'confidence': confidence
            }

        else:
            raise ValueError(f"Unknown model_type: {model_type}")

    def _build_inference_features(self, current_features: pd.DataFrame) -> pd.DataFrame:
        """
        Build lagged features for ML model inference
        Expects current_features to have at least 21 recent rows (for lag-21)
        """
        # Use the same feature engineering as training
        # This expects current_features to be a time-indexed DataFrame with regime features

        if len(current_features) < max(DEFAULT_LAGS):
            raise ValueError(f"Need at least {max(DEFAULT_LAGS)} rows of recent features for inference")

        # Take most recent row as "current" and build lags
        recent_data = current_features.iloc[-max(DEFAULT_LAGS)-1:]  # Get last 22 rows

        # Build lagged features (same as training)
        # Pass dummy regime_labels since include_current_regime=False
        dummy_labels = pd.Series(0, index=recent_data.index)

        X_pred = build_prediction_features(
            feature_matrix=recent_data,
            regime_labels=dummy_labels,
            lags=DEFAULT_LAGS,
            include_current_regime=False
        )

        # Take only the last row (most recent prediction point)
        X_pred = X_pred.iloc[[-1]]

        # Ensure columns match training feature names
        # Reorder to match training feature order
        X_pred = X_pred[self.feature_names]

        return X_pred

    def predict_ensemble(
        self,
        horizon: int,
        current_features: pd.DataFrame,
        current_regime: Optional[int] = None,
        weights: Optional[Dict[str, float]] = None
    ) -> Dict:
        """
        Ensemble prediction combining all models

        Args:
            horizon: Prediction horizon (1, 7, 30)
            current_features: Recent feature history
            current_regime: Current regime label (optional, improves Markov/HMM)
            weights: Optional dict of model weights, e.g. {'markov': 0.1, 'hmm': 0.2, ...}

        Returns:
            Dict with ensemble prediction and individual model results
        """
        if horizon not in self.horizons:
            raise ValueError(f"Horizon {horizon} not available. Trained horizons: {self.horizons}")

        # Default equal weights
        if weights is None:
            weights = {
                'markov': 0.25,
                'hmm': 0.25,
                'random_forest': 0.25,
                'xgboost': 0.25
            }

        # Get predictions from all models
        predictions = {}
        ensemble_probs = np.zeros(self.n_regimes)

        # Markov
        if 'markov' in self.models and current_regime is not None:
            try:
                pred = self.predict_single_model('markov', horizon, current_features, current_regime)
                predictions['markov'] = pred
                ensemble_probs += np.array(pred['probabilities']) * weights['markov']
            except Exception as e:
                print(f"Warning: Markov prediction failed: {e}")

        # HMM
        if 'hmm' in self.models:
            try:
                pred = self.predict_single_model('hmm', horizon, current_features, current_regime)
                predictions['hmm'] = pred
                ensemble_probs += np.array(pred['probabilities']) * weights['hmm']
            except Exception as e:
                print(f"Warning: HMM prediction failed: {e}")

        # Random Forest
        if 'ml' in self.models and horizon in self.models['ml']:
            if 'random_forest' in self.models['ml'][horizon]:
                try:
                    pred = self.predict_single_model('random_forest', horizon, current_features)
                    predictions['random_forest'] = pred
                    ensemble_probs += np.array(pred['probabilities']) * weights['random_forest']
                except Exception as e:
                    print(f"Warning: Random Forest prediction failed for horizon {horizon}: {e}")
                    import traceback
                    traceback.print_exc()

        # XGBoost
        if 'ml' in self.models and horizon in self.models['ml']:
            if 'xgboost' in self.models['ml'][horizon]:
                try:
                    pred = self.predict_single_model('xgboost', horizon, current_features)
                    predictions['xgboost'] = pred
                    ensemble_probs += np.array(pred['probabilities']) * weights['xgboost']
                except Exception as e:
                    print(f"Warning: XGBoost prediction failed for horizon {horizon}: {e}")
                    import traceback
                    traceback.print_exc()

        # Normalize ensemble probabilities
        if ensemble_probs.sum() > 0:
            ensemble_probs = ensemble_probs / ensemble_probs.sum()

        ensemble_prediction = int(np.argmax(ensemble_probs))
        ensemble_confidence = float(ensemble_probs[ensemble_prediction])

        return {
            'ensemble': {
                'predicted_regime': ensemble_prediction,
                'probabilities': ensemble_probs.tolist(),
                'confidence': ensemble_confidence
            },
            'individual_models': predictions,
            'weights': weights
        }

    DISPLAY_HORIZONS = [1, 7, 30]  # Standard horizons for the main predictions page

    def predict_all_horizons(
        self,
        current_features: pd.DataFrame,
        current_regime: Optional[int] = None
    ) -> Dict:
        """
        Make predictions for standard display horizons (1d, 7d, 30d)

        Returns:
            Dict with keys for each horizon containing ensemble predictions
        """
        results = {}

        for horizon in self.DISPLAY_HORIZONS:
            if horizon in self.horizons:
                results[f'{horizon}d'] = self.predict_ensemble(
                    horizon=horizon,
                    current_features=current_features,
                    current_regime=current_regime
                )

        return results

    def predict_custom_horizon(
        self,
        horizon: int,
        current_features: pd.DataFrame,
        current_regime: Optional[int] = None,
        weights: Optional[Dict[str, float]] = None
    ) -> Dict:
        """
        Predict for any horizon (1-1095 days).
        If horizon matches a trained ML horizon, uses all models with exact horizon.
        For horizons > 365d, only HMM is used (ML models not reliable at that range).
        Otherwise, Markov/HMM use exact horizon; RF/XGBoost use nearest trained horizon.

        Returns:
            Dict with 'ensemble', 'individual_models', 'weights', 'model_metadata'
        """
        # For horizons > 365 days, only use HMM (ML models not reliable)
        hmm_only = horizon > 365

        # Check if this is an exact trained horizon (and within ML range)
        if not hmm_only and horizon in self.horizons:
            result = self.predict_ensemble(
                horizon=horizon,
                current_features=current_features,
                current_regime=current_regime,
                weights=weights
            )
            # Add metadata showing all models used exact horizon
            result['model_metadata'] = {
                name: {'exact_horizon': True, 'used_horizon': horizon}
                for name in ['markov', 'hmm', 'random_forest', 'xgboost']
            }
            return result

        # Custom horizon: Markov/HMM exact, ML nearest (or skipped if hmm_only)
        nearest_ml_horizon = min(self.horizons, key=lambda h: abs(h - horizon)) if not hmm_only else None

        if weights is None:
            weights = {
                'markov': 0.25,
                'hmm': 0.25,
                'random_forest': 0.25,
                'xgboost': 0.25
            }

        predictions = {}
        ensemble_probs = np.zeros(self.n_regimes)

        # Markov - exact horizon
        if 'markov' in self.models and current_regime is not None:
            try:
                pred = self.predict_single_model('markov', horizon, current_features, current_regime)
                predictions['markov'] = pred
                ensemble_probs += np.array(pred['probabilities']) * weights['markov']
            except Exception as e:
                print(f"Warning: Markov prediction failed: {e}")

        # HMM - exact horizon
        if 'hmm' in self.models:
            try:
                pred = self.predict_single_model('hmm', horizon, current_features, current_regime)
                predictions['hmm'] = pred
                ensemble_probs += np.array(pred['probabilities']) * weights['hmm']
            except Exception as e:
                print(f"Warning: HMM prediction failed: {e}")

        # RF - nearest trained horizon (skip for horizons > 365d)
        if not hmm_only and 'ml' in self.models and nearest_ml_horizon in self.models['ml']:
            if 'random_forest' in self.models['ml'][nearest_ml_horizon]:
                try:
                    pred = self.predict_single_model('random_forest', nearest_ml_horizon, current_features)
                    predictions['random_forest'] = pred
                    ensemble_probs += np.array(pred['probabilities']) * weights['random_forest']
                except Exception as e:
                    print(f"Warning: RF prediction failed: {e}")

        # XGBoost - nearest trained horizon (skip for horizons > 365d)
        if not hmm_only and 'ml' in self.models and nearest_ml_horizon in self.models['ml']:
            if 'xgboost' in self.models['ml'][nearest_ml_horizon]:
                try:
                    pred = self.predict_single_model('xgboost', nearest_ml_horizon, current_features)
                    predictions['xgboost'] = pred
                    ensemble_probs += np.array(pred['probabilities']) * weights['xgboost']
                except Exception as e:
                    print(f"Warning: XGBoost prediction failed: {e}")

        # Normalize
        if ensemble_probs.sum() > 0:
            ensemble_probs = ensemble_probs / ensemble_probs.sum()

        ensemble_prediction = int(np.argmax(ensemble_probs))
        ensemble_confidence = float(ensemble_probs[ensemble_prediction])

        return {
            'ensemble': {
                'predicted_regime': ensemble_prediction,
                'probabilities': ensemble_probs.tolist(),
                'confidence': ensemble_confidence
            },
            'individual_models': predictions,
            'weights': weights,
            'model_metadata': {
                'markov': {'exact_horizon': True, 'used_horizon': horizon},
                'hmm': {'exact_horizon': True, 'used_horizon': horizon},
                **({} if hmm_only else {
                    'random_forest': {'exact_horizon': False, 'used_horizon': nearest_ml_horizon},
                    'xgboost': {'exact_horizon': False, 'used_horizon': nearest_ml_horizon},
                }),
            }
        }


def load_prediction_engine(symbol: str, models_dir: str = 'models') -> RegimePredictionEngine:
    """
    Convenience function to load prediction engine for an index

    Args:
        symbol: Index symbol (SPY, QQQ, DIA, IWM)
        models_dir: Root directory containing trained models

    Returns:
        RegimePredictionEngine instance
    """
    return RegimePredictionEngine(symbol=symbol, models_dir=models_dir)


def predict_current_regime(
    symbol: str,
    feature_df: pd.DataFrame,
    current_regime: Optional[int] = None,
    horizons: List[int] = [1, 7, 30],
    models_dir: str = 'models'
) -> Dict:
    """
    High-level convenience function for making predictions

    Args:
        symbol: Index symbol
        feature_df: Recent feature history (at least 22 rows)
        current_regime: Current regime label (optional)
        horizons: List of horizons to predict
        models_dir: Models directory

    Returns:
        Dict with predictions for each horizon
    """
    engine = load_prediction_engine(symbol, models_dir)

    results = {}
    for horizon in horizons:
        results[f'{horizon}d'] = engine.predict_ensemble(
            horizon=horizon,
            current_features=feature_df,
            current_regime=current_regime
        )

    return results


# Example usage
if __name__ == "__main__":
    import sys

    # Demo: Load engine and show available models
    symbol = sys.argv[1] if len(sys.argv) > 1 else 'SPY'

    print(f"\n{'='*70}")
    print(f"REGIME PREDICTION ENGINE DEMO - {symbol}")
    print(f"{'='*70}\n")

    try:
        engine = load_prediction_engine(symbol)

        print(f"\n✓ Engine loaded successfully")
        print(f"  Available models: {list(engine.models.keys())}")
        print(f"  ML horizons: {list(engine.models['ml'].keys())}")

        # Load recent features for demo
        features_path = 'regime_results/regime_features_normalized.csv'
        if os.path.exists(features_path):
            feature_df = pd.read_csv(features_path, index_col=0, parse_dates=True)
            print(f"\n✓ Loaded {len(feature_df)} rows of features")
            print(f"  Date range: {feature_df.index.min()} to {feature_df.index.max()}")

            # Make predictions for all horizons
            print(f"\n{'='*70}")
            print("ENSEMBLE PREDICTIONS")
            print(f"{'='*70}\n")

            regime_labels_path = 'regime_results/regime_labels_k4.csv'
            current_regime = None
            if os.path.exists(regime_labels_path):
                regime_labels = pd.read_csv(regime_labels_path, index_col=0, parse_dates=True).squeeze()
                current_regime = int(regime_labels.iloc[-1])
                print(f"Current regime: {current_regime}")

            predictions = engine.predict_all_horizons(feature_df, current_regime)

            regime_names = ['Calm', 'Crisis', 'Elevated Stress', 'Transition']

            for horizon_key, pred_data in predictions.items():
                ensemble = pred_data['ensemble']
                pred_regime = ensemble['predicted_regime']
                confidence = ensemble['confidence']

                print(f"\n{horizon_key.upper()} Prediction:")
                print(f"  Regime: {pred_regime} ({regime_names[pred_regime]})")
                print(f"  Confidence: {confidence:.2%}")
                print(f"  Probabilities: {[f'{p:.2%}' for p in ensemble['probabilities']]}")

                # Show individual model predictions
                print(f"  Individual models:")
                for model_name, model_pred in pred_data['individual_models'].items():
                    print(f"    {model_name:15s}: Regime {model_pred['predicted_regime']} ({model_pred['confidence']:.2%} conf)")

        else:
            print(f"  ⚠ Feature file not found: {features_path}")
            print(f"    Run main.py first to generate features")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
