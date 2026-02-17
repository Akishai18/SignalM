# Regime prediction methods
# Predicts future regime transitions using various approaches
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from regime.transitions import compute_transition_matrix


def predict_next_regime_baseline(
    current_regime: int,
    transition_matrix: pd.DataFrame,
    n_steps: int = 1
) -> Dict:
    #Baseline prediction: Simple Markov chain using historical transition probabilities.
    #Given current regime, predict next regime(s) using transition probability matrix.

    if current_regime not in transition_matrix.index:
        raise ValueError(f"Current regime {current_regime} not found in transition matrix")
    
    # Get transition probabilities from current regime
    transition_probs = transition_matrix.loc[current_regime]
    
    if n_steps == 1:
        # Single step: return transition probabilities directly
        predicted_regime = transition_probs.idxmax()
        confidence = transition_probs.max()
        
        return {
            'predicted_regime': predicted_regime,
            'confidence': confidence,
            'probabilities': transition_probs.to_dict(),
            'n_steps': 1
        }
    else:
        # Multi-step: use matrix multiplication (Markov chain)
        # P(n steps) = P^n (transition matrix raised to power n)
        transition_matrix_np = transition_matrix.values
        transition_matrix_n_steps = np.linalg.matrix_power(transition_matrix_np, n_steps)
        
        # Get probabilities from current regime row
        current_regime_idx = transition_matrix.index.get_loc(current_regime)
        n_step_probs = pd.Series(
            transition_matrix_n_steps[current_regime_idx],
            index=transition_matrix.index
        )
        
        predicted_regime = n_step_probs.idxmax()
        confidence = n_step_probs.max()
        
        return {
            'predicted_regime': predicted_regime,
            'confidence': confidence,
            'probabilities': n_step_probs.to_dict(),
            'n_steps': n_steps
        }


def predict_regime_sequence_baseline(
    current_regime: int,
    transition_matrix: pd.DataFrame,
    horizon: int = 30
) -> pd.DataFrame:
    #Predict regime sequence over a horizon using baseline Markov chain.
    #Returns DataFrame with predicted regime probabilities for each day ahead.

    predictions = []
    
    for day in range(1, horizon + 1):
        pred = predict_next_regime_baseline(current_regime, transition_matrix, n_steps=day)
        
        row = {
            'day_ahead': day,
            'predicted_regime': pred['predicted_regime'],
            'confidence': pred['confidence']
        }
        
        # Add individual regime probabilities
        for regime, prob in pred['probabilities'].items():
            row[f'prob_regime_{regime}'] = prob
        
        predictions.append(row)
    
    return pd.DataFrame(predictions)


def compute_prediction_accuracy_baseline(
    regime_labels: pd.Series,
    transition_matrix: pd.DataFrame,
    test_start_idx: Optional[int] = None
) -> Dict:
    #Compute prediction accuracy of baseline method on historical data.
    #For each day, predict next regime and compare to actual.
    
    if test_start_idx is None:
        test_start_idx = 0
    
    predictions = []
    actuals = []
    
    # For each day in test period, predict next regime
    for i in range(test_start_idx, len(regime_labels) - 1):
        current_regime = regime_labels.iloc[i]
        actual_next_regime = regime_labels.iloc[i + 1]
        
        try:
            pred = predict_next_regime_baseline(current_regime, transition_matrix, n_steps=1)
            predicted_regime = pred['predicted_regime']
            confidence = pred['confidence']
            
            predictions.append({
                'date': regime_labels.index[i],
                'current_regime': current_regime,
                'predicted_regime': predicted_regime,
                'actual_regime': actual_next_regime,
                'correct': predicted_regime == actual_next_regime,
                'confidence': confidence
            })
            actuals.append(actual_next_regime)
        except (ValueError, KeyError):
            # Skip if regime not in transition matrix
            continue
    
    if len(predictions) == 0:
        return {
            'accuracy': np.nan,
            'total_predictions': 0,
            'correct_predictions': 0,
            'mean_confidence': np.nan
        }
    
    pred_df = pd.DataFrame(predictions)
    
    # Compute accuracy metrics
    accuracy = pred_df['correct'].mean()
    mean_confidence = pred_df['confidence'].mean()
    
    # Per-regime accuracy
    per_regime_accuracy = {}
    for regime in pred_df['current_regime'].unique():
        regime_mask = pred_df['current_regime'] == regime
        if regime_mask.sum() > 0:
            per_regime_accuracy[regime] = {
                'accuracy': pred_df.loc[regime_mask, 'correct'].mean(),
                'count': regime_mask.sum()
            }
    
    return {
        'accuracy': accuracy,
        'total_predictions': len(predictions),
        'correct_predictions': pred_df['correct'].sum(),
        'mean_confidence': mean_confidence,
        'per_regime_accuracy': per_regime_accuracy,
        'predictions_df': pred_df
    }


def print_baseline_prediction(
    current_regime: int,
    transition_matrix: pd.DataFrame,
    regime_label_map: Optional[Dict] = None,
    horizon: int = 30
):
    #Print baseline prediction results in formatted output.
    
    print("\n" + "="*70)
    print("BASELINE REGIME PREDICTION (Markov Chain)")
    print("="*70)
    
    current_label = f"Regime {current_regime}"
    if regime_label_map and current_regime in regime_label_map:
        current_label = f"Regime {current_regime} ({regime_label_map[current_regime]})"
    
    print(f"\nCurrent Regime: {current_label}")
    print(f"Prediction Horizon: {horizon} days ahead")
    print("\n" + "-"*70)
    
    # Next day prediction
    next_day_pred = predict_next_regime_baseline(current_regime, transition_matrix, n_steps=1)
    next_label = f"Regime {next_day_pred['predicted_regime']}"
    if regime_label_map and next_day_pred['predicted_regime'] in regime_label_map:
        next_label = f"Regime {next_day_pred['predicted_regime']} ({regime_label_map[next_day_pred['predicted_regime']]})"
    
    print(f"\n[1] Next Day Prediction:")
    print(f"  Predicted Regime: {next_label}")
    print(f"  Confidence: {next_day_pred['confidence']:.2%}")
    print(f"\n  All Transition Probabilities:")
    for regime, prob in sorted(next_day_pred['probabilities'].items()):
        label = f"Regime {regime}"
        if regime_label_map and regime in regime_label_map:
            label = f"Regime {regime} ({regime_label_map[regime]})"
        print(f"    {label:<30} {prob:.2%}")
    
    # Horizon prediction sequence
    if horizon > 1:
        print(f"\n[2] {horizon}-Day Horizon Prediction Sequence:")
        print("-"*70)
        print(f"{'Day':<6} {'Predicted Regime':<25} {'Confidence':<12} {'Top 2 Probabilities':<30}")
        print("-"*70)
        
        sequence = predict_regime_sequence_baseline(current_regime, transition_matrix, horizon=horizon)
        
        for _, row in sequence.iterrows():
            day = int(row['day_ahead'])
            pred_regime = int(row['predicted_regime'])
            conf = row['confidence']
            
            pred_label = f"Regime {pred_regime}"
            if regime_label_map and pred_regime in regime_label_map:
                pred_label = f"Regime {pred_regime} ({regime_label_map[pred_regime]})"
            
            # Get top 2 probabilities
            probs = {k.replace('prob_regime_', ''): v for k, v in row.items() if k.startswith('prob_regime_')}
            sorted_probs = sorted(probs.items(), key=lambda x: x[1], reverse=True)
            top2_str = ", ".join([f"R{int(r)}:{v:.2%}" for r, v in sorted_probs[:2]])
            
            print(f"{day:<6} {pred_label:<25} {conf:<12.2%} {top2_str:<30}")
    
    print("\n" + "="*70)
    print("INTERPRETATION:")
    print("  • Baseline method uses historical transition probabilities")
    print("  • Assumes regime transitions follow Markov property (memoryless)")
    print("  • High confidence = regime is very persistent (likely to stay)")
    print("  • Low confidence = regime is likely to transition")
    print("="*70)
    
    return next_day_pred


def print_prediction_accuracy(
    accuracy_results: Dict,
    regime_label_map: Optional[Dict] = None
):
    #Print prediction accuracy results.
    
    print("\n" + "="*70)
    print("BASELINE PREDICTION ACCURACY")
    print("="*70)
    
    print(f"\nOverall Accuracy: {accuracy_results['accuracy']:.2%}")
    print(f"Total Predictions: {accuracy_results['total_predictions']}")
    print(f"Correct Predictions: {accuracy_results['correct_predictions']}")
    print(f"Mean Confidence: {accuracy_results['mean_confidence']:.2%}")
    
    if accuracy_results['per_regime_accuracy']:
        print("\nPer-Regime Accuracy:")
        print(f"{'Regime':<25} {'Accuracy':<15} {'Count':<10}")
        print("-"*50)
        for regime, stats in sorted(accuracy_results['per_regime_accuracy'].items()):
            label = f"Regime {regime}"
            if regime_label_map and regime in regime_label_map:
                label = f"Regime {regime} ({regime_label_map[regime]})"
            print(f"{label:<25} {stats['accuracy']:<15.2%} {stats['count']:<10}")
    
    print("\n" + "="*70)
    print("INTERPRETATION:")
    print("  • Accuracy > 50%: Better than random (good for K=4)")
    print("  • Accuracy > 70%: Very good (regimes are predictable)")
    print("  • Low accuracy: Regimes may be too noisy or transitions too complex")
    print("="*70)
    
    return accuracy_results
