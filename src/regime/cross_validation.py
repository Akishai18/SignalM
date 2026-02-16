# Out-of-sample validation for regime detection
# Validates that regime detection generalizes across time periods
import pandas as pd
import numpy as np
from typing import Dict, Tuple, Optional
from datetime import datetime
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def split_data_chronologically(
    regime_labels: pd.Series,
    feature_matrix: pd.DataFrame,
    split_date: Optional[str] = None,
    train_ratio: float = 0.7,
    test_ratio: float = 0.3
) -> Dict:
    #Split data chronologically into train and test sets.
    #Either provide split_date OR train_ratio/test_ratio (must sum to 1.0)
    #
    #Args:
    #    regime_labels: pd.Series with regime labels indexed by date
    #    feature_matrix: pd.DataFrame with features indexed by date
    #    split_date: Optional date string (YYYY-MM-DD) to split on
    #    train_ratio: Ratio of data for training (default 0.7 = 70%)
    #    test_ratio: Ratio of data for testing (default 0.3 = 30%)
    #
    #Returns:
    #    Dict with train/test splits for labels and features
    
    if not isinstance(regime_labels.index, pd.DatetimeIndex):
        regime_labels.index = pd.to_datetime(regime_labels.index)
    
    if not isinstance(feature_matrix.index, pd.DatetimeIndex):
        feature_matrix.index = pd.to_datetime(feature_matrix.index)
    
    # Ensure both have same date range (intersection)
    common_dates = regime_labels.index.intersection(feature_matrix.index)
    regime_labels = regime_labels.loc[common_dates]
    feature_matrix = feature_matrix.loc[common_dates]
    
    # Sort by date
    regime_labels = regime_labels.sort_index()
    feature_matrix = feature_matrix.sort_index()
    
    total_days = len(regime_labels)
    
    # Determine split point
    if split_date:
        # Use explicit split date
        split_date = pd.to_datetime(split_date)
        if split_date not in regime_labels.index:
            # Find closest date
            split_date = regime_labels.index[regime_labels.index <= split_date].max()
            if pd.isna(split_date):
                raise ValueError(f"Split date {split_date} is before all data. Earliest date: {regime_labels.index.min()}")
        split_idx = regime_labels.index.get_loc(split_date) + 1  # +1 to include split_date in train
    else:
        # Use ratio-based split
        if abs(train_ratio + test_ratio - 1.0) > 0.01:
            raise ValueError(f"train_ratio ({train_ratio}) + test_ratio ({test_ratio}) must equal 1.0")
        
        split_idx = int(total_days * train_ratio)
        split_date = regime_labels.index[split_idx]
    
    # Split data
    train_labels = regime_labels.iloc[:split_idx]
    test_labels = regime_labels.iloc[split_idx:]
    
    train_features = feature_matrix.iloc[:split_idx]
    test_features = feature_matrix.iloc[split_idx:]
    
    # Validation
    if len(train_labels) == 0:
        raise ValueError("Train set is empty. Adjust split_date or train_ratio.")
    if len(test_labels) == 0:
        raise ValueError("Test set is empty. Adjust split_date or test_ratio.")
    
    split_info = {
        'split_date': split_date,
        'split_idx': split_idx,
        'train_start': train_labels.index.min(),
        'train_end': train_labels.index.max(),
        'test_start': test_labels.index.min(),
        'test_end': test_labels.index.max(),
        'train_days': len(train_labels),
        'test_days': len(test_labels),
        'train_ratio_actual': len(train_labels) / total_days,
        'test_ratio_actual': len(test_labels) / total_days
    }
    
    return {
        'train_labels': train_labels,
        'test_labels': test_labels,
        'train_features': train_features,
        'test_features': test_features,
        'split_info': split_info
    }


def print_split_summary(split_data: Dict):
    #Print summary of train/test split.
    
    split_info = split_data['split_info']
    train_labels = split_data['train_labels']
    test_labels = split_data['test_labels']
    
    print("\n" + "="*70)
    print("TRAIN/TEST SPLIT SUMMARY")
    print("="*70)
    
    print(f"\nSplit Date: {split_info['split_date'].strftime('%Y-%m-%d')}")
    print(f"\nTrain Set:")
    print(f"  Period: {split_info['train_start'].strftime('%Y-%m-%d')} to {split_info['train_end'].strftime('%Y-%m-%d')}")
    print(f"  Days: {split_info['train_days']} ({split_info['train_ratio_actual']*100:.1f}% of data)")
    print(f"  Years: {split_info['train_days']/252:.1f}")
    print(f"  Unique regimes: {sorted(train_labels.unique().tolist())}")
    print(f"  Regime distribution:")
    for regime, count in train_labels.value_counts().sort_index().items():
        pct = (count / len(train_labels)) * 100
        print(f"    Regime {regime}: {count} days ({pct:.1f}%)")
    
    print(f"\nTest Set:")
    print(f"  Period: {split_info['test_start'].strftime('%Y-%m-%d')} to {split_info['test_end'].strftime('%Y-%m-%d')}")
    print(f"  Days: {split_info['test_days']} ({split_info['test_ratio_actual']*100:.1f}% of data)")
    print(f"  Years: {split_info['test_days']/252:.1f}")
    print(f"  Unique regimes: {sorted(test_labels.unique().tolist())}")
    print(f"  Regime distribution:")
    for regime, count in test_labels.value_counts().sort_index().items():
        pct = (count / len(test_labels)) * 100
        print(f"    Regime {regime}: {count} days ({pct:.1f}%)")
    
    print("\n" + "="*70)
    
    return split_info


def train_test_regime_detection(
    train_features: pd.DataFrame,
    test_features: pd.DataFrame,
    k: int = 4,
    random_state: int = 42
) -> Dict:
    #Train KMeans on training period, apply to test period.
    #Returns dict with train/test regime labels and model
    
    # Normalize features (z-score across time for each feature)
    # Fit scaler on training data, apply to both train and test
    scaler = StandardScaler()
    train_features_norm = pd.DataFrame(
        scaler.fit_transform(train_features),
        index=train_features.index,
        columns=train_features.columns
    )
    test_features_norm = pd.DataFrame(
        scaler.transform(test_features),
        index=test_features.index,
        columns=test_features.columns
    )
    
    # Train KMeans on training data
    train_model = KMeans(n_clusters=k, random_state=random_state)
    train_labels = train_model.fit_predict(train_features_norm.values)
    train_labels = pd.Series(train_labels, index=train_features.index, name='regime')
    
    # Apply trained model to test data
    test_labels = train_model.predict(test_features_norm.values)
    test_labels = pd.Series(test_labels, index=test_features.index, name='regime')
    
    return {
        'train_model': train_model,
        'scaler': scaler,
        'train_labels': train_labels,
        'test_labels': test_labels,
        'train_features_norm': train_features_norm,
        'test_features_norm': test_features_norm
    }


def compare_regime_characteristics(
    train_features: pd.DataFrame,
    train_labels: pd.Series,
    test_features: pd.DataFrame,
    test_labels: pd.Series
) -> Dict:
    #Compare regime characteristics across train and test periods.
    #Returns dict with comparison statistics
    
    # Compute economic monotonicity for both periods
    from regime.evaluate import compute_economic_monotonicity
    
    train_monotonicity = compute_economic_monotonicity(train_features, train_labels)
    test_monotonicity = compute_economic_monotonicity(test_features, test_labels)
    
    # Get feature means per regime for both periods
    train_means = train_monotonicity['means']
    test_means = test_monotonicity['means']
    
    # Ensure both have same regimes (union of regimes)
    all_regimes = sorted(set(train_means.index.tolist() + test_means.index.tolist()))
    
    # Compute differences for each regime
    regime_differences = {}
    for regime in all_regimes:
        if regime in train_means.index and regime in test_means.index:
            # Compute absolute difference in feature means
            diff = (train_means.loc[regime] - test_means.loc[regime]).abs()
            regime_differences[regime] = {
                'mean_abs_diff': diff.mean(),
                'max_abs_diff': diff.max(),
                'train_means': train_means.loc[regime],
                'test_means': test_means.loc[regime],
                'relative_diff_pct': (diff / train_means.loc[regime].abs()).mean() * 100
            }
        elif regime in train_means.index:
            regime_differences[regime] = {
                'status': 'only_in_train',
                'train_means': train_means.loc[regime]
            }
        elif regime in test_means.index:
            regime_differences[regime] = {
                'status': 'only_in_test',
                'test_means': test_means.loc[regime]
            }
    
    # Overall stability metric: average absolute difference across all regimes
    stable_regimes = [r for r in regime_differences.keys() if 'mean_abs_diff' in regime_differences[r]]
    if len(stable_regimes) > 0:
        overall_stability = np.mean([regime_differences[r]['mean_abs_diff'] for r in stable_regimes])
        overall_relative_diff = np.mean([regime_differences[r]['relative_diff_pct'] for r in stable_regimes])
    else:
        overall_stability = np.nan
        overall_relative_diff = np.nan
    
    return {
        'train_monotonicity': train_monotonicity,
        'test_monotonicity': test_monotonicity,
        'regime_differences': regime_differences,
        'overall_stability': overall_stability,
        'overall_relative_diff_pct': overall_relative_diff,
        'stable_regimes': stable_regimes
    }


def check_regime_stability(
    train_labels: pd.Series,
    test_labels: pd.Series,
    comparison_stats: Dict
) -> Dict:
    #Check if regimes are stable across train/test periods.
    #Returns dict with stability metrics and pass/fail
    
    # Check 1: Regime consistency (same regimes appear in both periods)
    train_regimes = set(train_labels.unique())
    test_regimes = set(test_labels.unique())
    common_regimes = train_regimes.intersection(test_regimes)
    only_train = train_regimes - test_regimes
    only_test = test_regimes - train_regimes
    
    regime_consistency = len(common_regimes) / max(len(train_regimes), len(test_regimes))
    
    # Check 2: Feature stability (from comparison_stats)
    feature_stability = comparison_stats['overall_stability']
    relative_diff = comparison_stats['overall_relative_diff_pct']
    
    # Check 3: Regime distribution similarity
    train_dist = train_labels.value_counts(normalize=True).sort_index()
    test_dist = test_labels.value_counts(normalize=True).sort_index()
    
    # Align distributions (fill missing with 0)
    all_regimes = sorted(train_regimes.union(test_regimes))
    train_dist_aligned = pd.Series([train_dist.get(r, 0) for r in all_regimes], index=all_regimes)
    test_dist_aligned = pd.Series([test_dist.get(r, 0) for r in all_regimes], index=all_regimes)
    
    # Compute distribution difference (L1 distance)
    dist_difference = (train_dist_aligned - test_dist_aligned).abs().sum()
    
    # Stability thresholds
    passes_regime_consistency = regime_consistency >= 0.75  # At least 75% of regimes common
    passes_feature_stability = not np.isnan(feature_stability) and relative_diff < 50  # Less than 50% relative difference
    passes_distribution = dist_difference < 0.5  # Distribution difference < 50%
    
    overall_stable = passes_regime_consistency and passes_feature_stability and passes_distribution
    
    return {
        'regime_consistency': regime_consistency,
        'common_regimes': sorted(common_regimes),
        'only_train_regimes': sorted(only_train),
        'only_test_regimes': sorted(only_test),
        'feature_stability': feature_stability,
        'relative_diff_pct': relative_diff,
        'distribution_difference': dist_difference,
        'passes_regime_consistency': passes_regime_consistency,
        'passes_feature_stability': passes_feature_stability,
        'passes_distribution': passes_distribution,
        'overall_stable': overall_stable
    }


def print_cross_period_validation(
    comparison_stats: Dict,
    stability_results: Dict,
    regime_label_map: Optional[Dict] = None
):
    #Print comprehensive cross-period validation results.
    
    print("\n" + "="*70)
    print("CROSS-PERIOD VALIDATION RESULTS")
    print("="*70)
    
    # Regime consistency
    print("\n[1] REGIME CONSISTENCY")
    print("-"*70)
    print(f"Common regimes (appear in both periods): {stability_results['common_regimes']}")
    print(f"Regimes only in train: {stability_results['only_train_regimes']}")
    print(f"Regimes only in test: {stability_results['only_test_regimes']}")
    print(f"Consistency score: {stability_results['regime_consistency']:.2%}")
    print(f"Status: {'✓ PASS' if stability_results['passes_regime_consistency'] else '✗ FAIL'}")
    
    # Feature stability
    print("\n[2] FEATURE STABILITY")
    print("-"*70)
    print(f"Overall feature stability (mean abs diff): {stability_results['feature_stability']:.4f}")
    print(f"Relative difference: {stability_results['relative_diff_pct']:.1f}%")
    print(f"Status: {'✓ PASS' if stability_results['passes_feature_stability'] else '✗ FAIL'}")
    
    # Regime characteristics comparison
    print("\n[3] REGIME CHARACTERISTICS COMPARISON")
    print("-"*70)
    print("Mean feature values per regime (Train vs Test):")
    print()
    
    regime_differences = comparison_stats['regime_differences']
    stable_regimes = comparison_stats['stable_regimes']
    
    if len(stable_regimes) > 0:
        # Get feature columns
        sample_regime = stable_regimes[0]
        feature_cols = regime_differences[sample_regime]['train_means'].index.tolist()
        
        print(f"{'Regime':<15} {'Feature':<25} {'Train':<12} {'Test':<12} {'Diff':<12} {'Diff %':<10}")
        print("-"*90)
        
        for regime in sorted(stable_regimes):
            diff_data = regime_differences[regime]
            train_vals = diff_data['train_means']
            test_vals = diff_data['test_means']
            
            # Show top 3 features with largest differences
            diffs = (train_vals - test_vals).abs()
            top_features = diffs.nlargest(3).index
            
            label = f"{regime} ({regime_label_map.get(regime, '')})" if regime_label_map else str(regime)
            
            for i, feat in enumerate(top_features):
                train_val = train_vals[feat]
                test_val = test_vals[feat]
                diff = abs(train_val - test_val)
                diff_pct = (diff / abs(train_val)) * 100 if train_val != 0 else 0
                
                regime_str = label if i == 0 else ""
                print(f"{regime_str:<15} {feat:<25} {train_val:<12.4f} {test_val:<12.4f} {diff:<12.4f} {diff_pct:<10.1f}")
    
    # Distribution similarity
    print("\n[4] REGIME DISTRIBUTION SIMILARITY")
    print("-"*70)
    print(f"Distribution difference (L1 distance): {stability_results['distribution_difference']:.4f}")
    print(f"Status: {'✓ PASS' if stability_results['passes_distribution'] else '✗ FAIL'}")
    
    # Overall stability
    print("\n[5] OVERALL STABILITY ASSESSMENT")
    print("-"*70)
    print(f"Regime Consistency: {'✓' if stability_results['passes_regime_consistency'] else '✗'}")
    print(f"Feature Stability: {'✓' if stability_results['passes_feature_stability'] else '✗'}")
    print(f"Distribution Similarity: {'✓' if stability_results['passes_distribution'] else '✗'}")
    print()
    print(f"Overall Stability: {'✓ PASS - Regimes are stable across periods' if stability_results['overall_stable'] else '✗ FAIL - Regimes may not generalize'}")
    
    print("\n" + "="*70)
    print("INTERPRETATION:")
    print("  ✓ PASS: Regimes detected in training period generalize to test period")
    print("  ✗ FAIL: Regimes may be period-specific or overfitted")
    print("="*70)
    
    return stability_results
