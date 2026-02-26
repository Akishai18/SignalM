#!/usr/bin/env python3
"""
Multi-Index Model Training Pipeline
Trains all 4 prediction models (Markov, HMM, RF, XGBoost) for all 4 indices
Saves trained models as .pkl files for API serving
"""
import pandas as pd
import numpy as np
import os
import joblib
import warnings
warnings.filterwarnings('ignore')

from regime.transitions import compute_transition_statistics
from regime.hmm_predict import fit_hmm_to_regimes
from regime.feature_predict import (
    build_prediction_dataset,
    train_all_predictors,
    DEFAULT_HORIZONS,
    DEFAULT_LAGS
)


def load_index_data(symbol: str, data_dir: str = 'data') -> dict:
    """Load regime labels and features for a given index"""
    print(f"\n  Loading data for {symbol}...")

    # Try to load index-specific files
    regime_labels_path = f'regime_results/{symbol.lower()}_regime_labels_k4.csv'
    features_path = f'regime_results/{symbol.lower()}_regime_features_normalized.csv'

    # Fallback to SPY if index-specific files don't exist
    if not os.path.exists(regime_labels_path):
        print(f"    ⚠ {symbol}-specific regime labels not found, using SPY labels")
        regime_labels_path = 'regime_results/regime_labels_k4.csv'

    if not os.path.exists(features_path):
        print(f"    ⚠ {symbol}-specific features not found, using SPY features")
        features_path = 'regime_results/regime_features_normalized.csv'

    # Load data
    regime_labels = pd.read_csv(regime_labels_path, index_col=0, parse_dates=True).squeeze()
    feature_df = pd.read_csv(features_path, index_col=0, parse_dates=True)

    print(f"    ✓ Loaded {len(regime_labels)} regime labels")
    print(f"    ✓ Loaded {feature_df.shape} feature matrix")
    print(f"    ✓ Date range: {regime_labels.index.min()} to {regime_labels.index.max()}")

    return {
        'regime_labels': regime_labels,
        'features': feature_df
    }


def train_markov_model(regime_labels: pd.Series) -> dict:
    """Train Markov chain model (just compute transition matrix)"""
    print("    [1/4] Training Markov Chain...")

    trans_stats = compute_transition_statistics(regime_labels)
    transition_matrix = trans_stats['transition_matrix']

    print(f"      ✓ Computed transition matrix")

    return {
        'model_type': 'markov',
        'transition_matrix': transition_matrix,
        'transition_stats': trans_stats
    }


def train_hmm_model(regime_labels: pd.Series, features: pd.DataFrame) -> dict:
    """Train Hidden Markov Model"""
    print("    [2/4] Training HMM...")

    try:
        hmm_model = fit_hmm_to_regimes(
            regime_labels=regime_labels,
            feature_matrix=features,
            n_regimes=4,
            n_iter=100
        )
        print(f"      ✓ HMM trained (log-likelihood: {hmm_model['log_likelihood']:.2f})")
        return {
            'model_type': 'hmm',
            'hmm_model': hmm_model
        }
    except Exception as e:
        print(f"      ⚠ HMM training failed: {e}")
        return None


def train_ml_models(
    regime_labels: pd.Series,
    features: pd.DataFrame,
    horizons: list = DEFAULT_HORIZONS,
    train_ratio: float = 0.7
) -> dict:
    """Train Random Forest and XGBoost for multiple horizons"""
    print("    [3/4] Training Random Forest & XGBoost...")

    # Build prediction datasets for all horizons
    prediction_data = build_prediction_dataset(
        feature_matrix=features,
        regime_labels=regime_labels,
        horizons=horizons,
        lags=DEFAULT_LAGS,
        include_current_regime=False  # No leakage
    )

    # Train all models
    trained_results = train_all_predictors(
        prediction_data,
        train_ratio=train_ratio,
        rf_params={'n_estimators': 200, 'max_depth': 6},
        xgb_params={'n_estimators': 200, 'max_depth': 4}
    )

    # Print accuracy summary
    for horizon, horizon_data in trained_results.items():
        print(f"\n      {horizon}-Day Horizon:")
        for model_key, model_data in horizon_data['models'].items():
            eval_metrics = model_data['eval']
            acc = eval_metrics['accuracy']
            conf = eval_metrics['mean_confidence']
            model_name = 'Random Forest' if model_key == 'random_forest' else 'XGBoost'
            print(f"        {model_name:15s}: {acc:.2%} accuracy, {conf:.2%} confidence")

    return {
        'model_type': 'ml',
        'trained_results': trained_results,
        'prediction_data': prediction_data
    }


def save_models(symbol: str, models: dict, save_dir: str = 'models'):
    """Save all trained models for a given index"""
    symbol_dir = os.path.join(save_dir, symbol.upper())
    os.makedirs(symbol_dir, exist_ok=True)

    print(f"\n  Saving models to {symbol_dir}/...")

    # Save Markov model
    if 'markov' in models and models['markov'] is not None:
        markov_path = os.path.join(symbol_dir, f'{symbol.lower()}_markov.pkl')
        joblib.dump(models['markov'], markov_path)
        print(f"    ✓ Saved Markov model: {markov_path}")

    # Save HMM model
    if 'hmm' in models and models['hmm'] is not None:
        hmm_path = os.path.join(symbol_dir, f'{symbol.lower()}_hmm.pkl')
        joblib.dump(models['hmm'], hmm_path)
        print(f"    ✓ Saved HMM model: {hmm_path}")

    # Save ML models (RF and XGBoost for each horizon)
    if 'ml' in models and models['ml'] is not None:
        ml_data = models['ml']

        for horizon, horizon_data in ml_data['trained_results'].items():
            # Save Random Forest
            if 'random_forest' in horizon_data['models']:
                rf_model = horizon_data['models']['random_forest']['model']
                rf_path = os.path.join(symbol_dir, f'{symbol.lower()}_rf_h{horizon}.pkl')
                joblib.dump(rf_model, rf_path)
                print(f"    ✓ Saved Random Forest ({horizon}d): {rf_path}")

            # Save XGBoost
            if 'xgboost' in horizon_data['models']:
                xgb_model = horizon_data['models']['xgboost']['model']
                xgb_path = os.path.join(symbol_dir, f'{symbol.lower()}_xgb_h{horizon}.pkl')
                joblib.dump(xgb_model, xgb_path)
                print(f"    ✓ Saved XGBoost ({horizon}d): {xgb_path}")

        # Save feature names (needed for inference)
        feature_names_path = os.path.join(symbol_dir, f'{symbol.lower()}_feature_names.pkl')
        joblib.dump(ml_data['prediction_data']['feature_names'], feature_names_path)
        print(f"    ✓ Saved feature names: {feature_names_path}")

    # Save metadata
    metadata = {
        'symbol': symbol.upper(),
        'n_regimes': 4,
        'horizons': [1, 7, 30],
        'train_date': pd.Timestamp.now().strftime('%Y-%m-%d'),
        'models_trained': list(models.keys())
    }
    metadata_path = os.path.join(symbol_dir, 'metadata.pkl')
    joblib.dump(metadata, metadata_path)
    print(f"    ✓ Saved metadata: {metadata_path}")


def train_index(symbol: str, save_dir: str = 'models') -> dict:
    """Train all models for a single index"""
    print(f"\n{'='*70}")
    print(f"TRAINING MODELS FOR {symbol.upper()}")
    print(f"{'='*70}")

    # Load data
    data = load_index_data(symbol)
    regime_labels = data['regime_labels']
    features = data['features']

    # Train all models
    models = {}

    # 1. Markov
    models['markov'] = train_markov_model(regime_labels)

    # 2. HMM
    models['hmm'] = train_hmm_model(regime_labels, features)

    # 3. ML models (RF + XGBoost)
    models['ml'] = train_ml_models(regime_labels, features)

    # Save models
    save_models(symbol, models, save_dir)

    return models


def train_all_indices(indices: list = None, save_dir: str = 'models'):
    """Train all models for all indices"""
    if indices is None:
        indices = ['SPY', 'QQQ', 'DIA', 'IWM']

    print("\n" + "="*70)
    print("MULTI-INDEX MODEL TRAINING PIPELINE")
    print("="*70)
    print(f"  Indices: {', '.join(indices)}")
    print(f"  Models: Markov, HMM, Random Forest, XGBoost")
    print(f"  Horizons: 1-day, 7-day, 30-day")
    print(f"  Save directory: {save_dir}/")
    print("="*70)

    all_models = {}

    for symbol in indices:
        try:
            models = train_index(symbol, save_dir)
            all_models[symbol] = models
        except Exception as e:
            print(f"\n  ❌ Failed to train models for {symbol}: {e}")
            continue

    # Summary
    print(f"\n{'='*70}")
    print("TRAINING SUMMARY")
    print(f"{'='*70}")

    for symbol, models in all_models.items():
        print(f"\n{symbol.upper()}:")
        for model_type in ['markov', 'hmm', 'ml']:
            if model_type in models and models[model_type] is not None:
                if model_type == 'ml':
                    n_models = len(models[model_type]['trained_results']) * 2  # RF + XGB per horizon
                    print(f"  ✓ ML models: {n_models} (RF + XGBoost x {len(models[model_type]['trained_results'])} horizons)")
                else:
                    print(f"  ✓ {model_type.upper()} model trained")
            else:
                print(f"  ⚠ {model_type.upper()} model failed")

    print(f"\n{'='*70}")
    print(f"✓ All models saved to: {save_dir}/")
    print(f"{'='*70}")

    return all_models


def print_model_inventory(models_dir: str = 'models'):
    """Print inventory of saved models"""
    print(f"\n{'='*70}")
    print("MODEL INVENTORY")
    print(f"{'='*70}")

    if not os.path.exists(models_dir):
        print(f"  ⚠ Models directory not found: {models_dir}")
        return

    indices = [d for d in os.listdir(models_dir)
               if os.path.isdir(os.path.join(models_dir, d)) and not d.startswith('.')]

    if not indices:
        print(f"  ⚠ No model directories found")
        return

    for symbol in sorted(indices):
        symbol_dir = os.path.join(models_dir, symbol)
        model_files = [f for f in os.listdir(symbol_dir) if f.endswith('.pkl')]

        print(f"\n{symbol}:")
        for model_file in sorted(model_files):
            file_path = os.path.join(symbol_dir, model_file)
            file_size = os.path.getsize(file_path) / 1024  # KB
            print(f"  • {model_file:<40} ({file_size:.1f} KB)")

    print(f"\n{'='*70}")


if __name__ == "__main__":
    import sys

    # Parse command-line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == '--inventory':
            # Just print inventory of existing models
            print_model_inventory()
            sys.exit(0)
        elif sys.argv[1] == '--index':
            # Train specific index
            if len(sys.argv) > 2:
                symbol = sys.argv[2].upper()
                train_index(symbol)
            else:
                print("Usage: python train_multi_index_models.py --index SPY")
                sys.exit(1)
        else:
            print(f"Unknown argument: {sys.argv[1]}")
            print("Usage:")
            print("  python train_multi_index_models.py              # Train all indices")
            print("  python train_multi_index_models.py --index SPY  # Train specific index")
            print("  python train_multi_index_models.py --inventory  # Show saved models")
            sys.exit(1)
    else:
        # Train all indices
        all_models = train_all_indices()

        # Print inventory
        print_model_inventory()
