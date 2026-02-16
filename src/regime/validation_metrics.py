# Validation metrics for out-of-sample regime detection
# Computes regime consistency, feature stability, and transition stability
import pandas as pd
import numpy as np
from typing import Dict, Optional
from regime.transitions import compute_transition_statistics


def compute_regime_consistency(
    train_labels: pd.Series,
    test_labels: pd.Series
) -> Dict:
    #Compute regime consistency: same regimes detected in both periods?
    #Returns dict with consistency metrics
    
    train_regimes = set(train_labels.unique())
    test_regimes = set(test_labels.unique())
    common_regimes = train_regimes.intersection(test_regimes)
    only_train = train_regimes - test_regimes
    only_test = test_regimes - train_regimes
    
    # Consistency score: percentage of regimes that appear in both periods
    total_unique_regimes = len(train_regimes.union(test_regimes))
    consistency_score = len(common_regimes) / total_unique_regimes if total_unique_regimes > 0 else 0
    
    # Pass threshold: at least 75% of regimes should be common
    passes = consistency_score >= 0.75
    
    return {
        'consistency_score': consistency_score,
        'common_regimes': sorted(common_regimes),
        'only_train_regimes': sorted(only_train),
        'only_test_regimes': sorted(only_test),
        'train_regimes': sorted(train_regimes),
        'test_regimes': sorted(test_regimes),
        'passes': passes
    }


def compute_feature_stability(
    train_features: pd.DataFrame,
    train_labels: pd.Series,
    test_features: pd.DataFrame,
    test_labels: pd.Series
) -> Dict:
    #Compute feature stability: similar feature values per regime?
    #Returns dict with stability metrics
    
    from regime.evaluate import compute_economic_monotonicity
    
    # Compute monotonicity for both periods
    train_monotonicity = compute_economic_monotonicity(train_features, train_labels)
    test_monotonicity = compute_economic_monotonicity(test_features, test_labels)
    
    train_means = train_monotonicity['means']
    test_means = test_monotonicity['means']
    
    # Find common regimes
    common_regimes = train_means.index.intersection(test_means.index)
    
    if len(common_regimes) == 0:
        return {
            'overall_stability': np.nan,
            'relative_diff_pct': np.nan,
            'per_regime_stability': {},
            'passes': False
        }
    
    # Compute differences for each common regime
    per_regime_stability = {}
    all_diffs = []
    all_relative_diffs = []
    
    for regime in common_regimes:
        train_vals = train_means.loc[regime]
        test_vals = test_means.loc[regime]
        
        # Absolute differences
        abs_diffs = (train_vals - test_vals).abs()
        mean_abs_diff = abs_diffs.mean()
        max_abs_diff = abs_diffs.max()
        
        # Relative differences (percentage)
        relative_diffs = (abs_diffs / train_vals.abs()) * 100
        mean_relative_diff = relative_diffs.mean()
        
        per_regime_stability[regime] = {
            'mean_abs_diff': mean_abs_diff,
            'max_abs_diff': max_abs_diff,
            'mean_relative_diff_pct': mean_relative_diff,
            'train_means': train_vals,
            'test_means': test_vals
        }
        
        all_diffs.append(mean_abs_diff)
        all_relative_diffs.append(mean_relative_diff)
    
    # Overall stability metrics
    overall_stability = np.mean(all_diffs) if all_diffs else np.nan
    overall_relative_diff = np.mean(all_relative_diffs) if all_relative_diffs else np.nan
    
    # Pass threshold: relative difference < 50%
    passes = overall_relative_diff < 50 if not np.isnan(overall_relative_diff) else False
    
    return {
        'overall_stability': overall_stability,
        'relative_diff_pct': overall_relative_diff,
        'per_regime_stability': per_regime_stability,
        'common_regimes': sorted(common_regimes),
        'passes': passes
    }


def compute_transition_stability(
    train_labels: pd.Series,
    test_labels: pd.Series
) -> Dict:
    #Compute transition stability: similar transition probabilities?
    #Returns dict with transition comparison metrics
    
    # Compute transition matrices for both periods
    train_transition_stats = compute_transition_statistics(train_labels)
    test_transition_stats = compute_transition_statistics(test_labels)
    
    train_matrix = train_transition_stats['transition_matrix']
    test_matrix = test_transition_stats['transition_matrix']
    
    # Get all regimes (union)
    all_regimes = sorted(set(train_matrix.index.tolist() + test_matrix.index.tolist()))
    
    # Align matrices (fill missing with 0)
    train_matrix_aligned = pd.DataFrame(0, index=all_regimes, columns=all_regimes)
    test_matrix_aligned = pd.DataFrame(0, index=all_regimes, columns=all_regimes)
    
    for regime in train_matrix.index:
        if regime in train_matrix_aligned.index:
            for to_regime in train_matrix.columns:
                if to_regime in train_matrix_aligned.columns:
                    train_matrix_aligned.loc[regime, to_regime] = train_matrix.loc[regime, to_regime]
    
    for regime in test_matrix.index:
        if regime in test_matrix_aligned.index:
            for to_regime in test_matrix.columns:
                if to_regime in test_matrix_aligned.columns:
                    test_matrix_aligned.loc[regime, to_regime] = test_matrix.loc[regime, to_regime]
    
    # Compute differences
    transition_diff = (train_matrix_aligned - test_matrix_aligned).abs()
    
    # Overall transition stability: mean absolute difference
    # Only consider transitions that exist in at least one period
    mask = (train_matrix_aligned > 0) | (test_matrix_aligned > 0)
    if mask.sum().sum() > 0:
        mean_transition_diff = transition_diff[mask].mean().mean()
        max_transition_diff = transition_diff[mask].max().max()
    else:
        mean_transition_diff = np.nan
        max_transition_diff = np.nan
    
    # Per-regime transition differences
    per_regime_transition_diff = {}
    for regime in all_regimes:
        regime_diffs = transition_diff.loc[regime]
        per_regime_transition_diff[regime] = {
            'mean_diff': regime_diffs.mean(),
            'max_diff': regime_diffs.max(),
            'train_transitions': train_matrix_aligned.loc[regime].to_dict(),
            'test_transitions': test_matrix_aligned.loc[regime].to_dict()
        }
    
    # Pass threshold: mean transition difference < 0.2 (20 percentage points)
    passes = mean_transition_diff < 0.2 if not np.isnan(mean_transition_diff) else False
    
    return {
        'mean_transition_diff': mean_transition_diff,
        'max_transition_diff': max_transition_diff,
        'per_regime_transition_diff': per_regime_transition_diff,
        'train_transition_matrix': train_matrix_aligned,
        'test_transition_matrix': test_matrix_aligned,
        'transition_diff_matrix': transition_diff,
        'passes': passes
    }


def compute_all_validation_metrics(
    train_features: pd.DataFrame,
    train_labels: pd.Series,
    test_features: pd.DataFrame,
    test_labels: pd.Series
) -> Dict:
    #Compute all validation metrics: consistency, feature stability, transition stability.
    #Returns comprehensive validation metrics dict
    
    regime_consistency = compute_regime_consistency(train_labels, test_labels)
    feature_stability = compute_feature_stability(train_features, train_labels, test_features, test_labels)
    transition_stability = compute_transition_stability(train_labels, test_labels)
    
    # Overall pass: all three must pass
    overall_passes = (
        regime_consistency['passes'] and
        feature_stability['passes'] and
        transition_stability['passes']
    )
    
    return {
        'regime_consistency': regime_consistency,
        'feature_stability': feature_stability,
        'transition_stability': transition_stability,
        'overall_passes': overall_passes
    }


def print_validation_metrics_report(
    validation_metrics: Dict,
    regime_label_map: Optional[Dict] = None
):
    #Print comprehensive validation metrics report.
    
    print("\n" + "="*70)
    print("VALIDATION METRICS REPORT")
    print("="*70)
    
    # 1. Regime Consistency
    consistency = validation_metrics['regime_consistency']
    print("\n[1] REGIME CONSISTENCY")
    print("-"*70)
    print(f"Consistency Score: {consistency['consistency_score']:.2%}")
    print(f"Common Regimes: {consistency['common_regimes']}")
    if consistency['only_train_regimes']:
        print(f"Only in Train: {consistency['only_train_regimes']}")
    if consistency['only_test_regimes']:
        print(f"Only in Test: {consistency['only_test_regimes']}")
    print(f"Status: {'✓ PASS' if consistency['passes'] else '✗ FAIL'}")
    
    # 2. Feature Stability
    feature_stab = validation_metrics['feature_stability']
    print("\n[2] FEATURE STABILITY")
    print("-"*70)
    print(f"Overall Stability (mean abs diff): {feature_stab['overall_stability']:.4f}")
    print(f"Relative Difference: {feature_stab['relative_diff_pct']:.1f}%")
    print(f"Common Regimes: {feature_stab['common_regimes']}")
    print(f"Status: {'✓ PASS' if feature_stab['passes'] else '✗ FAIL'}")
    
    # Per-regime feature stability
    if feature_stab['per_regime_stability']:
        print("\n  Per-Regime Feature Stability:")
        print(f"  {'Regime':<15} {'Mean Abs Diff':<15} {'Relative Diff %':<15}")
        print("  " + "-"*45)
        for regime, stats in sorted(feature_stab['per_regime_stability'].items()):
            label = f"{regime} ({regime_label_map.get(regime, '')})" if regime_label_map else str(regime)
            print(f"  {label:<15} {stats['mean_abs_diff']:<15.4f} {stats['mean_relative_diff_pct']:<15.1f}")
    
    # 3. Transition Stability
    transition_stab = validation_metrics['transition_stability']
    print("\n[3] TRANSITION STABILITY")
    print("-"*70)
    print(f"Mean Transition Difference: {transition_stab['mean_transition_diff']:.4f}")
    print(f"Max Transition Difference: {transition_stab['max_transition_diff']:.4f}")
    print(f"Status: {'✓ PASS' if transition_stab['passes'] else '✗ FAIL'}")
    
    # Per-regime transition differences
    if transition_stab['per_regime_transition_diff']:
        print("\n  Per-Regime Transition Differences:")
        print(f"  {'Regime':<15} {'Mean Diff':<15} {'Max Diff':<15}")
        print("  " + "-"*45)
        for regime, stats in sorted(transition_stab['per_regime_transition_diff'].items()):
            label = f"{regime} ({regime_label_map.get(regime, '')})" if regime_label_map else str(regime)
            print(f"  {label:<15} {stats['mean_diff']:<15.4f} {stats['max_diff']:<15.4f}")
    
    # Overall Summary
    print("\n" + "="*70)
    print("OVERALL VALIDATION SUMMARY")
    print("="*70)
    print(f"Regime Consistency: {'✓ PASS' if consistency['passes'] else '✗ FAIL'}")
    print(f"Feature Stability: {'✓ PASS' if feature_stab['passes'] else '✗ FAIL'}")
    print(f"Transition Stability: {'✓ PASS' if transition_stab['passes'] else '✗ FAIL'}")
    print()
    print(f"Overall Validation: {'✓ PASS - Regimes generalize across periods' if validation_metrics['overall_passes'] else '✗ FAIL - Regimes may be period-specific'}")
    print("="*70)
    
    return validation_metrics
