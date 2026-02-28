# Feature-based regime prediction using supervised learning
# Predicts future regime from current market features (+ lags)
# Models: Random Forest, XGBoost
# Horizons: 1-day, 7-day, 30-day ahead
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("Warning: scikit-learn not installed. Install with: pip install scikit-learn")

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("Warning: xgboost not installed. Install with: pip install xgboost")


DEFAULT_HORIZONS = [1, 3, 5, 7, 14, 21, 30, 60, 90, 180, 365]
DEFAULT_LAGS = [1, 5, 21]  # 1-day, 1-week, 1-month lags


def build_prediction_features(
    feature_matrix: pd.DataFrame,
    regime_labels: pd.Series,
    lags: List[int] = DEFAULT_LAGS,
    include_current_regime: bool = True
) -> pd.DataFrame:
    # Build an enriched feature matrix for regime prediction.
    # Adds lagged features and rate-of-change to capture trend/momentum.
    # Optionally includes current regime as a feature (valid: it's known at prediction time).

    base_cols = feature_matrix.columns.tolist()
    frames = [feature_matrix.copy()]

    # Lagged feature values: what did the market look like 1/5/21 days ago?
    for lag in lags:
        lagged = feature_matrix.shift(lag)
        lagged.columns = [f"{c}_lag{lag}" for c in base_cols]
        frames.append(lagged)

    # Rate of change vs lag-1 and lag-5: captures regime transitions in progress
    for lag in [1, 5]:
        delta = feature_matrix - feature_matrix.shift(lag)
        delta.columns = [f"{c}_chg{lag}" for c in base_cols]
        frames.append(delta)

    # Current regime as a one-hot feature (known at prediction time, not leakage)
    if include_current_regime:
        aligned_labels = regime_labels.reindex(feature_matrix.index)
        n_regimes = int(aligned_labels.max()) + 1
        for r in range(n_regimes):
            frames.append(pd.Series(
                (aligned_labels == r).astype(float),
                index=feature_matrix.index,
                name=f"is_regime_{r}"
            ).to_frame())

    X = pd.concat(frames, axis=1)
    return X


def build_prediction_dataset(
    feature_matrix: pd.DataFrame,
    regime_labels: pd.Series,
    horizons: List[int] = DEFAULT_HORIZONS,
    lags: List[int] = DEFAULT_LAGS,
    include_current_regime: bool = True
) -> Dict:
    # Build aligned (X, y) pairs for each prediction horizon.
    # X[t] = enriched features at time t
    # y[t] = regime at time t + horizon
    # Drops rows with NaN (from lags or missing future labels).

    X_enriched = build_prediction_features(
        feature_matrix, regime_labels,
        lags=lags,
        include_current_regime=include_current_regime
    )

    datasets = {}
    for h in horizons:
        # Target: regime h days ahead
        y = regime_labels.shift(-h)

        # Align on common valid index (no NaN in X or y)
        common = X_enriched.index.intersection(y.dropna().index)
        X_h = X_enriched.loc[common].dropna()
        y_h = y.loc[X_h.index].astype(int)

        datasets[h] = {'X': X_h, 'y': y_h}

    return {
        'datasets': datasets,
        'feature_names': X_enriched.columns.tolist(),
        'horizons': horizons
    }


def _chronological_split(X: pd.DataFrame, y: pd.Series, train_ratio: float = 0.7):
    # Split time series chronologically (no shuffling).
    n = len(X)
    split_idx = int(n * train_ratio)
    return (
        X.iloc[:split_idx], X.iloc[split_idx:],
        y.iloc[:split_idx], y.iloc[split_idx:]
    )


def fit_random_forest(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    n_estimators: int = 200,
    max_depth: int = 6,
    random_state: int = 42
) -> 'RandomForestClassifier':
    # Fit Random Forest classifier for regime prediction.

    if not SKLEARN_AVAILABLE:
        raise ImportError("scikit-learn not installed")

    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=10,   # Prevent overfitting on small regime subsets
        class_weight='balanced',  # Handle imbalanced regimes (Crisis is rare)
        random_state=random_state,
        n_jobs=-1
    )
    model.fit(X_train, y_train)
    return model


def fit_xgboost(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    n_estimators: int = 200,
    max_depth: int = 4,
    random_state: int = 42
) -> 'xgb.XGBClassifier':
    # Fit XGBoost classifier for regime prediction.

    if not XGBOOST_AVAILABLE:
        raise ImportError("xgboost not installed")

    # XGBoost requires contiguous class labels starting at 0
    model = xgb.XGBClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='mlogloss',
        use_label_encoder=False,
        random_state=random_state,
        verbosity=0
    )
    model.fit(X_train, y_train)
    return model


def evaluate_predictor(
    model,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_name: str = "model"
) -> Dict:
    # Compute accuracy metrics for a fitted classifier.

    y_pred = model.predict(X_test)
    overall_acc = accuracy_score(y_test, y_pred)

    # Per-regime accuracy
    per_regime = {}
    for regime in sorted(y_test.unique()):
        mask = y_test == regime
        if mask.sum() > 0:
            per_regime[int(regime)] = {
                'accuracy': accuracy_score(y_test[mask], y_pred[mask]),
                'count': int(mask.sum())
            }

    # Prediction probabilities (for confidence)
    try:
        y_proba = model.predict_proba(X_test)
        mean_confidence = float(y_proba.max(axis=1).mean())
    except Exception:
        mean_confidence = float('nan')

    return {
        'model_name': model_name,
        'accuracy': overall_acc,
        'total_predictions': len(y_test),
        'correct_predictions': int((y_pred == y_test).sum()),
        'mean_confidence': mean_confidence,
        'per_regime_accuracy': per_regime,
        'y_pred': y_pred,
        'y_test': y_test.values
    }


def get_feature_importances(
    model,
    feature_names: List[str],
    model_name: str,
    top_n: int = 10
) -> pd.DataFrame:
    # Extract top-N feature importances from RF or XGBoost model.

    try:
        importances = model.feature_importances_
        imp_df = pd.DataFrame({
            'feature': feature_names,
            'importance': importances
        }).sort_values('importance', ascending=False).head(top_n).reset_index(drop=True)
        imp_df['model'] = model_name
        return imp_df
    except AttributeError:
        return pd.DataFrame()


def train_all_predictors(
    prediction_data: Dict,
    train_ratio: float = 0.7,
    rf_params: Optional[Dict] = None,
    xgb_params: Optional[Dict] = None
) -> Dict:
    # Train RF and XGBoost for each horizon and evaluate on held-out test period.
    # Returns fitted models, accuracy metrics, and feature importances per horizon.

    rf_params = rf_params or {}
    xgb_params = xgb_params or {}

    results = {}

    for horizon, data in prediction_data['datasets'].items():
        X, y = data['X'], data['y']
        X_train, X_test, y_train, y_test = _chronological_split(X, y, train_ratio)

        horizon_result = {
            'horizon': horizon,
            'train_size': len(X_train),
            'test_size': len(X_test),
            'train_end': X_train.index[-1],
            'test_start': X_test.index[0],
            'models': {}
        }

        # Random Forest
        if SKLEARN_AVAILABLE:
            rf = fit_random_forest(X_train, y_train, **rf_params)
            rf_eval = evaluate_predictor(rf, X_test, y_test, model_name="Random Forest")
            rf_imp = get_feature_importances(
                rf, prediction_data['feature_names'], "Random Forest"
            )
            horizon_result['models']['random_forest'] = {
                'model': rf,
                'eval': rf_eval,
                'importances': rf_imp
            }

        # XGBoost
        if XGBOOST_AVAILABLE:
            xgb_model = fit_xgboost(X_train, y_train, **xgb_params)
            xgb_eval = evaluate_predictor(xgb_model, X_test, y_test, model_name="XGBoost")
            xgb_imp = get_feature_importances(
                xgb_model, prediction_data['feature_names'], "XGBoost"
            )
            horizon_result['models']['xgboost'] = {
                'model': xgb_model,
                'eval': xgb_eval,
                'importances': xgb_imp
            }

        results[horizon] = horizon_result

    return results


def predict_future_regimes(
    trained_results: Dict,
    current_features: pd.DataFrame,
    current_regime: int,
    regime_labels: pd.Series,
    horizons: List[int] = DEFAULT_HORIZONS,
    lags: List[int] = DEFAULT_LAGS
) -> Dict:
    # Predict future regimes for the most recent observation.
    # Builds the enriched feature vector for the current date and applies
    # the trained RF and XGBoost models at each horizon.

    predictions = {}

    for horizon in horizons:
        if horizon not in trained_results:
            continue

        horizon_data = trained_results[horizon]
        preds_for_horizon = {}

        for model_key, model_data in horizon_data['models'].items():
            model = model_data['model']
            try:
                # Predict regime
                y_pred = int(model.predict(current_features)[0])

                # Get probabilities
                try:
                    proba = model.predict_proba(current_features)[0]
                    classes = model.classes_
                    prob_dict = {int(c): float(p) for c, p in zip(classes, proba)}
                    confidence = float(proba.max())
                except Exception:
                    prob_dict = {y_pred: 1.0}
                    confidence = 1.0

                preds_for_horizon[model_key] = {
                    'predicted_regime': y_pred,
                    'confidence': confidence,
                    'probabilities': prob_dict
                }
            except Exception as e:
                preds_for_horizon[model_key] = {'error': str(e)}

        predictions[horizon] = preds_for_horizon

    return predictions


def build_current_feature_vector(
    feature_matrix: pd.DataFrame,
    regime_labels: pd.Series,
    lags: List[int] = DEFAULT_LAGS
) -> pd.DataFrame:
    # Build the enriched feature vector for the most recent date.
    # Replicates the same transformation as build_prediction_features
    # but returns a single-row DataFrame for inference.

    X_full = build_prediction_features(feature_matrix, regime_labels, lags=lags)
    current_date = feature_matrix.index[-1]
    current_row = X_full.loc[[current_date]].dropna(axis=1)

    # Align columns: use only columns present in training (no missing lag columns)
    return current_row


def print_feature_prediction_results(
    trained_results: Dict,
    future_predictions: Dict,
    regime_label_map: Optional[Dict] = None,
    baseline_accuracies: Optional[Dict] = None
):
    # Print formatted results matching the style of other print_ functions.

    label = lambda r: f"Regime {r} ({regime_label_map[r]})" if regime_label_map and r in regime_label_map else f"Regime {r}"

    print("\n" + "=" * 70)
    print("FEATURE-BASED REGIME PREDICTION (Random Forest + XGBoost)")
    print("=" * 70)

    # --- Per-horizon accuracy table ---
    print("\n[1] PREDICTION ACCURACY BY HORIZON")
    print("-" * 70)
    print(f"{'Horizon':<12} {'Model':<18} {'Accuracy':<12} {'vs Baseline':<15} {'Confidence'}")
    print("-" * 70)

    for horizon in sorted(trained_results.keys()):
        hdata = trained_results[horizon]
        baseline_acc = baseline_accuracies.get(horizon) if baseline_accuracies else None

        for model_key, model_data in hdata['models'].items():
            ev = model_data['eval']
            model_name = ev['model_name']
            acc = ev['accuracy']
            conf = ev['mean_confidence']

            if baseline_acc is not None:
                diff = acc - baseline_acc
                vs_str = f"{diff:+.2%}"
            else:
                vs_str = "n/a"

            print(f"{f'{horizon}d ahead':<12} {model_name:<18} {acc:<12.2%} {vs_str:<15} {conf:.2%}")

    # --- Per-regime accuracy breakdown (for 1-day horizon) ---
    if 1 in trained_results:
        print(f"\n[2] PER-REGIME ACCURACY (1-Day Horizon)")
        print("-" * 70)
        print(f"{'Regime':<25} {'RF Accuracy':<15} {'XGB Accuracy':<15} {'Count'}")
        print("-" * 70)

        rf_data = trained_results[1]['models'].get('random_forest', {}).get('eval', {})
        xgb_data = trained_results[1]['models'].get('xgboost', {}).get('eval', {})
        rf_per = rf_data.get('per_regime_accuracy', {})
        xgb_per = xgb_data.get('per_regime_accuracy', {})

        all_regimes = sorted(set(list(rf_per.keys()) + list(xgb_per.keys())))
        for r in all_regimes:
            rf_acc = f"{rf_per[r]['accuracy']:.2%}" if r in rf_per else "n/a"
            xgb_acc = f"{xgb_per[r]['accuracy']:.2%}" if r in xgb_per else "n/a"
            count = rf_per[r]['count'] if r in rf_per else xgb_per.get(r, {}).get('count', '?')
            print(f"{label(r):<25} {rf_acc:<15} {xgb_acc:<15} {count}")

    # --- Top feature importances (1-day horizon) ---
    if 1 in trained_results:
        print(f"\n[3] TOP FEATURE IMPORTANCES (1-Day Horizon)")
        print("-" * 70)

        for model_key in ['random_forest', 'xgboost']:
            mdata = trained_results[1]['models'].get(model_key, {})
            imp_df = mdata.get('importances', pd.DataFrame())
            if imp_df.empty:
                continue

            model_name = mdata['eval']['model_name']
            print(f"\n  {model_name}:")
            for _, row in imp_df.head(8).iterrows():
                bar = "█" * int(row['importance'] * 200)
                print(f"    {row['feature']:<35} {row['importance']:.4f}  {bar}")

    # --- Current date forecast ---
    if future_predictions:
        print(f"\n[4] FORECAST FROM CURRENT DATE")
        print("-" * 70)
        print(f"{'Horizon':<12} {'RF Prediction':<25} {'XGB Prediction':<25} {'RF Conf':<10} {'XGB Conf'}")
        print("-" * 70)

        for horizon in sorted(future_predictions.keys()):
            preds = future_predictions[horizon]
            rf_p = preds.get('random_forest', {})
            xgb_p = preds.get('xgboost', {})

            rf_regime = rf_p.get('predicted_regime')
            xgb_regime = xgb_p.get('predicted_regime')
            rf_label = label(rf_regime) if rf_regime is not None else "n/a"
            xgb_label = label(xgb_regime) if xgb_regime is not None else "n/a"
            rf_conf = f"{rf_p['confidence']:.2%}" if 'confidence' in rf_p else "n/a"
            xgb_conf = f"{xgb_p['confidence']:.2%}" if 'confidence' in xgb_p else "n/a"

            print(f"{f'{horizon}d ahead':<12} {rf_label:<25} {xgb_label:<25} {rf_conf:<10} {xgb_conf}")

        # Probability breakdown for each horizon
        print(f"\n[5] REGIME PROBABILITIES (current → future)")
        print("-" * 70)
        for horizon in sorted(future_predictions.keys()):
            print(f"\n  {horizon}-Day Ahead:")
            for model_key, pred in future_predictions[horizon].items():
                if 'probabilities' not in pred:
                    continue
                model_name = "Random Forest" if model_key == "random_forest" else "XGBoost"
                print(f"    {model_name}:")
                for r, p in sorted(pred['probabilities'].items()):
                    print(f"      {label(r):<30} {p:.2%}")

    print("\n" + "=" * 70)
    print("INTERPRETATION:")
    print("  • Feature-based models use current market features (vol, corr, PCA)")
    print("  • Lagged features (1d/5d/21d) capture regime momentum")
    print("  • 1d accuracy ≈ Markov baseline (regimes persist)")
    print("  • 7d/30d: feature models can outperform Markov on transitions")
    print("  • Low Crisis/Transition accuracy → rare regimes are harder to predict")
    print("=" * 70)


def compute_baseline_accuracy_by_horizon(
    regime_labels: pd.Series,
    transition_matrix: pd.DataFrame,
    horizons: List[int] = DEFAULT_HORIZONS,
    train_ratio: float = 0.7
) -> Dict[int, float]:
    # Compute Markov chain baseline accuracy at each horizon on the test split.
    # Uses matrix power T^h for multi-step transitions.

    n = len(regime_labels)
    test_start = int(n * train_ratio)
    test_labels = regime_labels.iloc[test_start:]
    T = transition_matrix.values
    regimes = transition_matrix.index.tolist()

    results = {}
    for h in horizons:
        T_h = np.linalg.matrix_power(T, h)
        correct = 0
        total = 0
        for i in range(len(test_labels) - h):
            current = int(test_labels.iloc[i])
            actual_next = int(test_labels.iloc[i + h])
            if current in regimes:
                row_idx = regimes.index(current)
                predicted = regimes[int(np.argmax(T_h[row_idx]))]
                correct += (predicted == actual_next)
                total += 1
        results[h] = correct / total if total > 0 else float('nan')

    return results
