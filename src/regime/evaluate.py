# Evaluation/persistence metrics for regime identification
import pandas as pd
import numpy as np

def compute_regime_persistence(labels: pd.Series) -> pd.Series:
    """
    Given a series of regime labels (indexed by date),
    return a Series of persistence lengths (number of consecutive days in each regime) for each regime id.
    """
    if isinstance(labels, np.ndarray):
        labels = pd.Series(labels)
    runs = labels.ne(labels.shift()).cumsum()
    persistence = labels.groupby(runs).transform('size')
    return persistence

def diagnose_persistence(labels: pd.Series, min_days_threshold=21):
    """
    Diagnose regime persistence quality.
    Returns dict with diagnostics and passes/fails.
    """
    if isinstance(labels, np.ndarray):
        labels = pd.Series(labels, name='regime')
    elif not isinstance(labels, pd.Series):
        labels = pd.Series(labels, name='regime')
    
    persistence = compute_regime_persistence(labels)
    
    # Count regime switches (transitions)
    switches = (labels != labels.shift()).sum() - 1  # -1 because first row is always True
    
    # Compute statistics per regime run
    runs = labels.ne(labels.shift()).cumsum()
    run_lengths = labels.groupby(runs).size()
    
    # Average persistence
    mean_persistence = persistence.mean()
    
    # Percentage of runs that are single-day (day-to-day flipping)
    single_day_runs = (run_lengths == 1).sum()
    pct_single_day = (single_day_runs / len(run_lengths)) * 100 if len(run_lengths) > 0 else 0
    
    # Check if average > 1 month (21 trading days)
    passes_min_duration = mean_persistence >= min_days_threshold
    
    # Check if too much day-to-day flipping (< 10% single-day runs is acceptable)
    passes_no_flipping = pct_single_day < 10.0
    
    diagnostics = {
        'mean_persistence_days': mean_persistence,
        'median_persistence_days': persistence.median(),
        'min_persistence_days': persistence.min(),
        'max_persistence_days': persistence.max(),
        'total_regime_switches': switches,
        'single_day_runs_count': single_day_runs,
        'single_day_runs_pct': pct_single_day,
        'total_runs': len(run_lengths),
        'passes_min_duration': passes_min_duration,
        'passes_no_flipping': passes_no_flipping,
        'overall_pass': passes_min_duration and passes_no_flipping
    }
    
    return diagnostics

def print_persistence_diagnostics(diagnostics):
    """
    Print formatted persistence diagnostics.
    """
    print("\n" + "="*60)
    print("PERSISTENCE DIAGNOSTICS")
    print("="*60)
    print(f"Mean persistence: {diagnostics['mean_persistence_days']:.2f} days")
    print(f"Median persistence: {diagnostics['median_persistence_days']:.2f} days")
    print(f"Min/Max persistence: {diagnostics['min_persistence_days']:.0f} / {diagnostics['max_persistence_days']:.0f} days")
    print(f"\nRegime switches: {diagnostics['total_regime_switches']}")
    print(f"Single-day runs: {diagnostics['single_day_runs_count']} ({diagnostics['single_day_runs_pct']:.1f}%)")
    print(f"Total regime runs: {diagnostics['total_runs']}")
    
    print("\n" + "-"*60)
    print("QUALITY CHECKS:")
    print(f"  ✓ Average duration > 1 month (21 days): {'PASS' if diagnostics['passes_min_duration'] else 'FAIL'}")
    print(f"    ({diagnostics['mean_persistence_days']:.1f} days vs 21 days threshold)")
    print(f"  ✓ No excessive day-to-day flipping (<10%): {'PASS' if diagnostics['passes_no_flipping'] else 'FAIL'}")
    print(f"    ({diagnostics['single_day_runs_pct']:.1f}% single-day runs)")
    print(f"\n  Overall: {'✓ PASS' if diagnostics['overall_pass'] else '✗ FAIL'}")
    print("="*60)

def compute_economic_monotonicity(X: pd.DataFrame, regime_labels: pd.Series):
    """
    Compute mean feature values per regime (economic monotonicity check).
    Returns DataFrame with regimes as rows, features as columns.
    """
    if isinstance(regime_labels, np.ndarray):
        regime_labels = pd.Series(regime_labels, index=X.index, name='regime')
    
    # Align indices
    common_idx = X.index.intersection(regime_labels.index)
    X_aligned = X.loc[common_idx]
    labels_aligned = regime_labels.loc[common_idx]
    
    # Group by regime and compute means
    regime_means = X_aligned.groupby(labels_aligned).mean()
    regime_means.index.name = 'Regime'
    
    # Also compute standard deviations for context
    regime_stds = X_aligned.groupby(labels_aligned).std()
    regime_stds.index.name = 'Regime'
    
    return {
        'means': regime_means,
        'stds': regime_stds,
        'counts': labels_aligned.value_counts().sort_index()
    }

def print_economic_monotonicity(monotonicity_dict):
    """
    Print formatted economic monotonicity table.
    """
    means = monotonicity_dict['means']
    stds = monotonicity_dict['stds']
    counts = monotonicity_dict['counts']
    
    print("\n" + "="*60)
    print("ECONOMIC MONOTONICITY CHECK")
    print("="*60)
    print("\nMean feature values per regime:")
    print(means.to_string())
    
    print("\n\nRegime sample sizes:")
    for regime, count in counts.items():
        print(f"  Regime {regime}: {count} days ({count/252:.1f} years)")
    
    print("\n" + "-"*60)
    print("INTERPRETATION:")
    print("  If regimes are clearly separated in this table → clustering succeeded")
    print("  If values are similar across regimes → clustering may have failed")
    print("  Look for:")
    print("    - Distinct volatility levels per regime")
    print("    - Different correlation patterns")
    print("    - Varying PC1 variance (market mode dominance)")
    print("    - Different effective dimensions (diversification)")
    print("="*60)

def summarize_clustering_evaluation(evals: dict):
    """
    Prints/returns a summary table of inertia, silhouette score, and mean/max regime persistence for each K.
    """
    rows = []
    for k, d in evals.items():
        labs = d['labels']
        if isinstance(labs, np.ndarray):
            labs = pd.Series(labs)
        pers = compute_regime_persistence(labs)
        diag = diagnose_persistence(labs)
        rows.append({
            'K': k,
            'inertia': d['inertia'],
            'silhouette': d['silhouette'] if d['silhouette'] is not None else np.nan,
            'mean_persistence': pers.mean(),
            'max_persistence': pers.max(),
            'single_day_pct': diag['single_day_runs_pct'],
            'passes_persistence': diag['overall_pass']
        })
    return pd.DataFrame(rows)

