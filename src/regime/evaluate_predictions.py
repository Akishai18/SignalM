# Comprehensive prediction evaluation and comparison
# Compares Markov baseline, HMM, Random Forest, and XGBoost across multiple metrics
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from sklearn.metrics import precision_score, recall_score, f1_score


def compute_transition_detection_metrics(
    predictions: pd.Series,
    actuals: pd.Series,
    regime_labels: pd.Series
) -> Dict:
    # Evaluate models on detecting regime transitions (not exact regime prediction).
    # Binary classification: did a transition occur at time t?

    # Identify actual transitions
    actual_transitions = (regime_labels != regime_labels.shift(1)).astype(int)

    # Identify predicted transitions (when predicted regime != previous actual regime)
    predicted_transitions = pd.Series(0, index=predictions.index)
    for i in range(1, len(predictions)):
        idx = predictions.index[i]
        prev_idx = predictions.index[i-1]
        if idx in regime_labels.index and prev_idx in regime_labels.index:
            if predictions.loc[idx] != regime_labels.loc[prev_idx]:
                predicted_transitions.loc[idx] = 1

    # Align indices
    common_idx = actual_transitions.index.intersection(predicted_transitions.index)
    actual_trans_aligned = actual_transitions.loc[common_idx]
    pred_trans_aligned = predicted_transitions.loc[common_idx]

    # Remove first element (no previous regime to compare)
    if len(actual_trans_aligned) > 0:
        actual_trans_aligned = actual_trans_aligned.iloc[1:]
        pred_trans_aligned = pred_trans_aligned.iloc[1:]

    if len(actual_trans_aligned) == 0:
        return {
            'precision': np.nan,
            'recall': np.nan,
            'f1_score': np.nan,
            'n_actual_transitions': 0,
            'n_predicted_transitions': 0
        }

    # Compute metrics
    try:
        precision = precision_score(actual_trans_aligned, pred_trans_aligned, zero_division=0)
        recall = recall_score(actual_trans_aligned, pred_trans_aligned, zero_division=0)
        f1 = f1_score(actual_trans_aligned, pred_trans_aligned, zero_division=0)
    except Exception:
        precision = recall = f1 = np.nan

    return {
        'precision': precision,
        'recall': recall,
        'f1_score': f1,
        'n_actual_transitions': int(actual_trans_aligned.sum()),
        'n_predicted_transitions': int(pred_trans_aligned.sum())
    }


def compute_early_warning_metric(
    predictions_df: pd.DataFrame,
    regime_labels: pd.Series,
    horizon_days: int = 30
) -> Dict:
    # Measure how many days before a transition each model predicts it.
    # For each actual transition, look back H days and check if prediction changed.

    # Find transition dates
    transitions = []
    for i in range(1, len(regime_labels)):
        if regime_labels.iloc[i] != regime_labels.iloc[i-1]:
            transitions.append({
                'date': regime_labels.index[i],
                'from_regime': int(regime_labels.iloc[i-1]),
                'to_regime': int(regime_labels.iloc[i])
            })

    if len(transitions) == 0:
        return {
            'mean_days_early': np.nan,
            'median_days_early': np.nan,
            'detection_rate': 0.0,
            'n_transitions': 0
        }

    days_early = []
    detected_count = 0

    for trans in transitions:
        trans_date = trans['date']
        from_regime = trans['from_regime']
        to_regime = trans['to_regime']

        # Look back up to horizon_days
        lookback_dates = regime_labels.index[regime_labels.index < trans_date][-horizon_days:]

        detected = False
        for i, date in enumerate(reversed(lookback_dates)):
            if date not in predictions_df.index:
                continue

            pred_regime = predictions_df.loc[date, 'predicted_regime']

            # Did the model predict the new regime while still in old regime?
            if pred_regime == to_regime and regime_labels.loc[date] == from_regime:
                days_before = (trans_date - date).days
                days_early.append(days_before)
                detected = True
                detected_count += 1
                break

    if len(days_early) == 0:
        return {
            'mean_days_early': 0.0,
            'median_days_early': 0.0,
            'detection_rate': 0.0,
            'n_transitions': len(transitions),
            'n_detected': 0
        }

    return {
        'mean_days_early': float(np.mean(days_early)),
        'median_days_early': float(np.median(days_early)),
        'detection_rate': detected_count / len(transitions),
        'n_transitions': len(transitions),
        'n_detected': detected_count
    }


def compare_all_predictors(
    regime_labels: pd.Series,
    transition_matrix: pd.DataFrame,
    hmm_accuracy_results: Optional[Dict] = None,
    rf_accuracy_results: Optional[Dict] = None,
    xgb_accuracy_results: Optional[Dict] = None,
    markov_accuracy_results: Optional[Dict] = None
) -> pd.DataFrame:
    # Consolidate accuracy metrics from all prediction methods into a comparison table.

    methods = []

    # Markov baseline
    if markov_accuracy_results:
        methods.append({
            'method': 'Markov Chain',
            'accuracy': markov_accuracy_results.get('accuracy', np.nan),
            'mean_confidence': markov_accuracy_results.get('mean_confidence', np.nan),
            'total_predictions': markov_accuracy_results.get('total_predictions', 0),
            'correct_predictions': markov_accuracy_results.get('correct_predictions', 0)
        })

    # HMM
    if hmm_accuracy_results:
        methods.append({
            'method': 'HMM (feature-inferred)',
            'accuracy': hmm_accuracy_results.get('accuracy', np.nan),
            'mean_confidence': hmm_accuracy_results.get('mean_confidence', np.nan),
            'total_predictions': hmm_accuracy_results.get('total_predictions', 0),
            'correct_predictions': hmm_accuracy_results.get('correct_predictions', 0)
        })

    # Random Forest
    if rf_accuracy_results:
        methods.append({
            'method': 'Random Forest',
            'accuracy': rf_accuracy_results.get('accuracy', np.nan),
            'mean_confidence': rf_accuracy_results.get('mean_confidence', np.nan),
            'total_predictions': rf_accuracy_results.get('total_predictions', 0),
            'correct_predictions': rf_accuracy_results.get('correct_predictions', 0)
        })

    # XGBoost
    if xgb_accuracy_results:
        methods.append({
            'method': 'XGBoost',
            'accuracy': xgb_accuracy_results.get('accuracy', np.nan),
            'mean_confidence': xgb_accuracy_results.get('mean_confidence', np.nan),
            'total_predictions': xgb_accuracy_results.get('total_predictions', 0),
            'correct_predictions': xgb_accuracy_results.get('correct_predictions', 0)
        })

    if len(methods) == 0:
        return pd.DataFrame()

    df = pd.DataFrame(methods)
    df = df.sort_values('accuracy', ascending=False).reset_index(drop=True)
    return df


def print_prediction_comparison(
    comparison_df: pd.DataFrame,
    regime_label_map: Optional[Dict] = None,
    title: str = "PREDICTION METHOD COMPARISON"
):
    # Print formatted comparison of all prediction methods.

    if comparison_df.empty:
        print("\n⚠ No prediction results to compare")
        return

    print("\n" + "="*70)
    print(title)
    print("="*70)

    print(f"\n{'Method':<30} {'Accuracy':<12} {'Confidence':<12} {'Correct/Total'}")
    print("-"*70)

    for _, row in comparison_df.iterrows():
        method = row['method']
        acc = row['accuracy']
        conf = row['mean_confidence']
        correct = int(row['correct_predictions'])
        total = int(row['total_predictions'])

        print(f"{method:<30} {acc:<12.2%} {conf:<12.2%} {correct}/{total}")

    print("\n" + "="*70)
    print("KEY INSIGHTS:")
    print("="*70)

    # Identify best model
    best_idx = comparison_df['accuracy'].idxmax()
    best_model = comparison_df.loc[best_idx, 'method']
    best_acc = comparison_df.loc[best_idx, 'accuracy']

    print(f"  Best Model: {best_model} ({best_acc:.2%} accuracy)")

    # Check if Markov baseline is competitive
    markov_row = comparison_df[comparison_df['method'] == 'Markov Chain']
    if not markov_row.empty:
        markov_acc = markov_row.iloc[0]['accuracy']
        if markov_acc >= best_acc - 0.05:  # Within 5pp
            print(f"  ⚠  Markov baseline is competitive ({markov_acc:.2%})")
            print(f"     → Regime persistence is high; complex models add little value")

    # Check model agreement
    if len(comparison_df) > 1:
        acc_std = comparison_df['accuracy'].std()
        if acc_std < 0.05:
            print(f"  ✓ Models agree (σ = {acc_std:.1%})")
        else:
            print(f"  ⚠ Models disagree (σ = {acc_std:.1%})")
            print(f"     → Feature-based models may be learning different patterns")

    print("="*70)


def evaluate_per_regime_performance(
    all_accuracy_results: Dict[str, Dict],
    regime_label_map: Optional[Dict] = None
) -> pd.DataFrame:
    # Compare per-regime accuracy across all methods.
    # Returns DataFrame with rows = regimes, columns = methods.

    regime_comparison = {}

    for method_name, results in all_accuracy_results.items():
        per_regime = results.get('per_regime_accuracy', {})
        for regime, stats in per_regime.items():
            if regime not in regime_comparison:
                regime_comparison[regime] = {}
            regime_comparison[regime][method_name] = stats.get('accuracy', np.nan)

    if len(regime_comparison) == 0:
        return pd.DataFrame()

    df = pd.DataFrame(regime_comparison).T

    # Add regime labels if available
    if regime_label_map:
        df.index = [f"{r} ({regime_label_map.get(r, '')})" for r in df.index]

    return df


def print_per_regime_comparison(
    per_regime_df: pd.DataFrame,
    title: str = "PER-REGIME ACCURACY COMPARISON"
):
    # Print per-regime accuracy comparison across methods.

    if per_regime_df.empty:
        print("\n⚠ No per-regime data to compare")
        return

    print("\n" + "="*70)
    print(title)
    print("="*70)

    print(f"\n{per_regime_df.to_string()}")

    print("\n" + "="*70)
    print("INTERPRETATION:")
    print("="*70)

    # Find hardest regime to predict
    mean_acc_per_regime = per_regime_df.mean(axis=1)
    hardest_regime = mean_acc_per_regime.idxmin()
    hardest_acc = mean_acc_per_regime.min()

    print(f"  Hardest regime: {hardest_regime} (avg {hardest_acc:.2%} accuracy)")

    # Find regime where methods disagree most
    std_per_regime = per_regime_df.std(axis=1)
    most_disagreement = std_per_regime.idxmax()
    disagreement_std = std_per_regime.max()

    if disagreement_std > 0.10:
        print(f"  Most disagreement: {most_disagreement} (σ = {disagreement_std:.2%})")
        print(f"     → Models learn different patterns for this regime")

    print("="*70)


def summarize_prediction_evaluation(
    regime_labels: pd.Series,
    comparison_df: pd.DataFrame,
    per_regime_df: pd.DataFrame,
    transition_metrics: Optional[Dict[str, Dict]] = None
) -> Dict:
    # Create a summary dict of all evaluation metrics for saving/reporting.

    summary = {
        'overall_comparison': comparison_df.to_dict('records') if not comparison_df.empty else [],
        'per_regime_comparison': per_regime_df.to_dict() if not per_regime_df.empty else {},
        'transition_detection': transition_metrics or {},
        'n_total_observations': len(regime_labels),
        'n_unique_regimes': int(regime_labels.nunique()),
        'regime_distribution': regime_labels.value_counts().to_dict()
    }

    return summary


def print_transition_detection_summary(
    transition_metrics: Dict[str, Dict],
    title: str = "TRANSITION DETECTION PERFORMANCE"
):
    # Print transition detection metrics (precision/recall on regime changes).

    if not transition_metrics:
        print("\n⚠ No transition detection metrics available")
        return

    print("\n" + "="*70)
    print(title)
    print("="*70)

    print(f"\n{'Method':<25} {'Precision':<12} {'Recall':<12} {'F1-Score':<12} {'Detected/Total'}")
    print("-"*70)

    for method, metrics in transition_metrics.items():
        precision = metrics.get('precision', np.nan)
        recall = metrics.get('recall', np.nan)
        f1 = metrics.get('f1_score', np.nan)
        n_detected = metrics.get('n_predicted_transitions', 0)
        n_total = metrics.get('n_actual_transitions', 0)

        print(f"{method:<25} {precision:<12.2%} {recall:<12.2%} {f1:<12.2%} {n_detected}/{n_total}")

    print("\n" + "="*70)
    print("INTERPRETATION:")
    print("="*70)
    print("  • Precision: Of predicted transitions, how many were correct?")
    print("  • Recall: Of actual transitions, how many were predicted?")
    print("  • F1-Score: Harmonic mean of precision and recall")
    print("  • High precision + low recall → conservative (misses transitions)")
    print("  • Low precision + high recall → aggressive (false alarms)")
    print("="*70)
