#!/usr/bin/env python3
"""
Multi-Index Model Training Pipeline
Trains all 4 prediction models (Markov, HMM, RF, XGBoost) for all 4 indices
Saves trained models as .pkl files for API serving
"""
import pandas as pd
import numpy as np
import os
import sys
import joblib
import warnings
warnings.filterwarnings('ignore')

# Add src to path for regime imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))

from regime.transitions import compute_transition_statistics, compute_transition_matrix
from regime.hmm_predict import fit_hmm_to_regimes, compute_hmm_accuracy
from regime.predict import compute_prediction_accuracy_baseline
from regime.feature_predict import (
    build_prediction_dataset,
    train_all_predictors,
    compute_baseline_accuracy_by_horizon,
    DEFAULT_HORIZONS,
    DEFAULT_LAGS
)
import json


def load_index_data(symbol: str, data_dir: str = 'data') -> dict:
    """Load regime labels and features for a given index.

    Uses market-wide regime labels (same for all indices) combined with
    index-specific features (returns, volatility, momentum, etc.) to give
    each index unique model training data.
    """
    print(f"\n  Loading data for {symbol}...")

    # Get project root (two levels up from this file: src/regime/ -> src/ -> root/)
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    # Regime labels are market-wide (same for all indices)
    regime_labels_path = os.path.join(project_root, 'regime_results', 'regime_labels_k4.csv')
    regime_labels = pd.read_csv(regime_labels_path, index_col=0, parse_dates=True).squeeze()

    # Market-wide PCA features (volatility, correlation, PCA components)
    market_features_path = os.path.join(project_root, 'regime_results', 'regime_features_normalized.csv')
    market_features = pd.read_csv(market_features_path, index_col=0, parse_dates=True)

    # Index-specific features (returns, volatility, momentum, RSI, etc.)
    index_features_path = os.path.join(project_root, 'regime_results', 'indices', f'{symbol.lower()}_features.csv')

    if os.path.exists(index_features_path):
        index_features = pd.read_csv(index_features_path, index_col=0, parse_dates=True)

        # Select useful derived features (not raw prices)
        index_feature_cols = [
            'returns', 'log_returns',
            'vol_21d', 'vol_63d', 'vol_252d',
            'momentum_21d', 'momentum_63d',
            'price_to_sma21', 'price_to_sma50', 'price_to_sma200',
            'sma21_slope', 'sma50_slope',
            'rsi', 'drawdown'
        ]
        available_cols = [c for c in index_feature_cols if c in index_features.columns]
        index_features = index_features[available_cols]

        # Prefix columns with symbol to avoid name conflicts
        index_features.columns = [f'{symbol.lower()}_{col}' for col in index_features.columns]

        # Combine market-wide + index-specific features
        feature_df = market_features.join(index_features, how='inner')
        print(f"    ✓ Combined market features ({market_features.shape[1]} cols) + {symbol} features ({len(available_cols)} cols)")
    else:
        print(f"    ⚠ {symbol}-specific features not found, using market features only")
        feature_df = market_features

    # Align regime labels with features (inner join on dates)
    common_dates = regime_labels.index.intersection(feature_df.index)
    regime_labels = regime_labels.loc[common_dates]
    feature_df = feature_df.loc[common_dates]

    # Drop rows with NaN
    valid_mask = feature_df.notna().all(axis=1)
    regime_labels = regime_labels.loc[valid_mask]
    feature_df = feature_df.loc[valid_mask]

    print(f"    ✓ Loaded {len(regime_labels)} regime labels (market-wide)")
    print(f"    ✓ Loaded {feature_df.shape} feature matrix ({feature_df.shape[1]} features)")
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
    # Get project root if save_dir is relative
    if not os.path.isabs(save_dir):
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        save_dir = os.path.join(project_root, save_dir)

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

    # Save accuracy metrics for API
    if 'accuracies' in models:
        accuracy_path = os.path.join(symbol_dir, 'model_accuracies.json')
        with open(accuracy_path, 'w') as f:
            json.dump(models['accuracies'], f, indent=2)
        print(f"    ✓ Saved accuracy metrics: {accuracy_path}")

    # Save metadata
    metadata = {
        'symbol': symbol.upper(),
        'n_regimes': 4,
        'horizons': list(models['ml']['trained_results'].keys()) if models.get('ml') and models['ml'] is not None else [1, 7, 30],
        'train_date': pd.Timestamp.now().strftime('%Y-%m-%d'),
        'models_trained': list(models.keys())
    }
    metadata_path = os.path.join(symbol_dir, 'metadata.pkl')
    joblib.dump(metadata, metadata_path)
    print(f"    ✓ Saved metadata: {metadata_path}")


def train_index(symbol: str, save_dir: str = 'models', train_ratio: float = 0.7) -> dict:
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
    models['ml'] = train_ml_models(regime_labels, features, train_ratio=train_ratio)

    # 4. Compute accuracy metrics with PROPER train/test split
    print(f"\n    [4/4] Computing Test Accuracies (avoiding data leakage)...")

    n = len(regime_labels)
    train_size = int(n * train_ratio)
    train_labels = regime_labels.iloc[:train_size]
    test_labels = regime_labels.iloc[train_size:]

    print(f"      Train: {len(train_labels)} samples | Test: {len(test_labels)} samples")

    accuracies = []

    # Markov baseline accuracy (1-day horizon only, tested on test set)
    if models['markov'] is not None:
        # Compute transition matrix on TRAINING data only
        train_transition_matrix, _ = compute_transition_matrix(train_labels)

        # Test on TEST data only
        markov_acc = compute_prediction_accuracy_baseline(
            regime_labels=regime_labels,
            transition_matrix=train_transition_matrix,
            test_start_idx=train_size
        )

        print(f"      Markov Chain: {markov_acc['accuracy']:.2%} test accuracy")

        accuracies.append({
            'model_name': 'Markov Chain',
            'horizon_days': 1,
            'train_accuracy': float(markov_acc['accuracy']),
            'test_accuracy': float(markov_acc['accuracy']),
            'mean_confidence': float(markov_acc['mean_confidence'])
        })

    # HMM accuracy (1-day horizon only, tested on test set)
    if models['hmm'] is not None:
        hmm_acc = compute_hmm_accuracy(
            hmm_model=models['hmm']['hmm_model'],
            feature_matrix=features,
            regime_labels=regime_labels,
            test_start_idx=train_size
        )

        print(f"      HMM: {hmm_acc['accuracy']:.2%} test accuracy")

        accuracies.append({
            'model_name': 'HMM',
            'horizon_days': 1,
            'train_accuracy': float(hmm_acc['accuracy']),
            'test_accuracy': float(hmm_acc['accuracy']),
            'mean_confidence': float(hmm_acc['mean_confidence'])
        })

    # ML model accuracies (already computed with proper train/test split)
    if models['ml'] is not None:
        for horizon, horizon_data in models['ml']['trained_results'].items():
            # Random Forest
            if 'random_forest' in horizon_data['models']:
                rf_eval = horizon_data['models']['random_forest']['eval']
                accuracies.append({
                    'model_name': 'Random Forest',
                    'horizon_days': horizon,
                    'train_accuracy': float(rf_eval['accuracy']),
                    'test_accuracy': float(rf_eval['accuracy']),
                    'mean_confidence': float(rf_eval.get('mean_confidence', 0.0))
                })
                print(f"      Random Forest ({horizon}d): {rf_eval['accuracy']:.2%} test accuracy")

            # XGBoost
            if 'xgboost' in horizon_data['models']:
                xgb_eval = horizon_data['models']['xgboost']['eval']
                accuracies.append({
                    'model_name': 'XGBoost',
                    'horizon_days': horizon,
                    'train_accuracy': float(xgb_eval['accuracy']),
                    'test_accuracy': float(xgb_eval['accuracy']),
                    'mean_confidence': float(xgb_eval.get('mean_confidence', 0.0))
                })
                print(f"      XGBoost ({horizon}d): {xgb_eval['accuracy']:.2%} test accuracy")

    models['accuracies'] = accuracies
    print(f"      ✓ Accuracy metrics computed")

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
    # Get project root if models_dir is relative
    if not os.path.isabs(models_dir):
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        models_dir = os.path.join(project_root, models_dir)

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
