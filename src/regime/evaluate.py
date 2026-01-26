# Evaluation/persistence metrics for regime identification
import pandas as pd
import numpy as np

def compute_regime_persistence(labels: pd.Series) -> pd.Series:
    
    #iven a series of regime labels (indexed by date),
    #return a Series of persistence lengths (number of consecutive days in each regime) for each regime id.
    
    if isinstance(labels, np.ndarray):
        labels = pd.Series(labels)
    runs = labels.ne(labels.shift()).cumsum()
    persistence = labels.groupby(runs).transform('size')
    return persistence

def diagnose_persistence(labels: pd.Series, min_days_threshold=21):
    
    #Diagnose regime persistence quality.
    #Returns dict with diagnostics and passes/fails.
    
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
    
    #Print formatted persistence diagnostics.
    
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
    
    #Compute mean feature values per regime (economic monotonicity check).
    #Returns DataFrame with regimes as rows, features as columns.
    
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

def label_regimes_by_function(monotonicity_dict):
    """
    Map numeric regime IDs to descriptive labels based on economic characteristics.
    Returns dict mapping numeric ID -> descriptive label.
    """
    means = monotonicity_dict['means']
    counts = monotonicity_dict['counts']
    
    # Identify regime characteristics
    # Regime with highest vol + highest corr + lowest eff_dim = Crisis
    # Regime with lowest vol + lowest corr + highest eff_dim = Calm
    # Others = Transition/Elevated
    
    vol_col = [c for c in means.columns if 'avg_vol' in c.lower()][0]
    corr_col = [c for c in means.columns if 'corr' in c.lower()][0]
    effdim_col = [c for c in means.columns if 'effective' in c.lower() or 'eff_dim' in c.lower()][0]
    
    # Score each regime: higher = more crisis-like
    crisis_scores = {}
    for regime in means.index:
        vol_rank = means.loc[regime, vol_col]  # Higher vol = more crisis
        corr_rank = means.loc[regime, corr_col]  # Higher corr = more crisis
        effdim_rank = -means.loc[regime, effdim_col]  # Lower eff_dim = more crisis (negate)
        # Normalize and combine
        crisis_scores[regime] = vol_rank + corr_rank + effdim_rank
    
    # Sort by crisis score
    sorted_regimes = sorted(crisis_scores.items(), key=lambda x: x[1], reverse=True)
    
    # Label: highest score = Crisis, lowest = Calm, middle = Transition/Elevated
    labels = {}
    if len(sorted_regimes) == 3:
        labels[sorted_regimes[0][0]] = "Crisis"
        labels[sorted_regimes[1][0]] = "Transition"
        labels[sorted_regimes[2][0]] = "Calm"
    elif len(sorted_regimes) == 4:
        labels[sorted_regimes[0][0]] = "Crisis"
        labels[sorted_regimes[1][0]] = "Elevated Stress"
        labels[sorted_regimes[2][0]] = "Transition"
        labels[sorted_regimes[3][0]] = "Calm"
    else:
        # Generic labeling
        labels[sorted_regimes[0][0]] = "Crisis"
        labels[sorted_regimes[-1][0]] = "Calm"
        for i, (regime, _) in enumerate(sorted_regimes[1:-1], 1):
            labels[regime] = f"Transition {i}"
    
    return labels

def print_semantic_regime_labels(monotonicity_dict):
    #Print detailed semantic characteristics for human labeling.
    #Shows feature values and suggests semantic labels based on patterns.
    means = monotonicity_dict['means']
    counts = monotonicity_dict['counts']
    
    # Get feature column names
    vol_col = [c for c in means.columns if 'avg_vol' in c.lower()][0]
    corr_col = [c for c in means.columns if 'corr' in c.lower()][0]
    effdim_col = [c for c in means.columns if 'effective' in c.lower() or 'eff_dim' in c.lower()][0]
    pc1_col = [c for c in means.columns if 'pc1' in c.lower()][0]
    
    print("\n" + "="*70)
    print("STEP 7: SEMANTIC REGIME LABELING (Human-in-the-loop)")
    print("="*70)
    print("\nDetailed characteristics per regime:")
    print("-"*70)
    
    for regime in sorted(means.index):
        vol_val = means.loc[regime, vol_col]
        corr_val = means.loc[regime, corr_col]
        effdim_val = means.loc[regime, effdim_col]
        pc1_val = means.loc[regime, pc1_col]
        count = counts[regime]
        
        # Determine relative positions
        vol_rank = (means[vol_col] < vol_val).sum()  # Lower rank = lower vol
        corr_rank = (means[corr_col] < corr_val).sum()
        effdim_rank = (means[effdim_col] > effdim_val).sum()  # Higher rank = lower eff_dim
        pc1_rank = (means[pc1_col] < pc1_val).sum()
        
        # Build semantic description
        vol_desc = "low" if vol_rank == 0 else ("high" if vol_rank == len(means) - 1 else "moderate")
        corr_desc = "low" if corr_rank == 0 else ("high" if corr_rank == len(means) - 1 else "moderate")
        effdim_desc = "high" if effdim_rank == 0 else ("low" if effdim_rank == len(means) - 1 else "moderate")
        pc1_desc = "low" if pc1_rank == 0 else ("high" if pc1_rank == len(means) - 1 else "moderate")
        
        print(f"\nRegime {regime}:")
        print(f"  Sample size: {count} days ({count/252:.1f} years)")
        print(f"  Characteristics:")
        print(f"    • Volatility: {vol_desc} ({vol_val:.3f})")
        print(f"    • Correlation: {corr_desc} ({corr_val:.3f})")
        print(f"    • Effective Dimension: {effdim_desc} ({effdim_val:.2f})")
        print(f"    • PC1 Variance: {pc1_desc} ({pc1_val:.3f})")
        
        # Suggest semantic label
        if vol_rank == len(means) - 1 and corr_rank == len(means) - 1 and effdim_rank == len(means) - 1:
            suggested = "Crisis / Risk-Off"
        elif vol_rank == 0 and corr_rank == 0 and effdim_rank == 0:
            suggested = "Calm / Diversified"
        elif vol_rank > len(means) // 2 and corr_rank > len(means) // 2:
            suggested = "Elevated Stress / Transition"
        elif vol_rank < len(means) // 2 and corr_rank < len(means) // 2:
            suggested = "Post-Crisis Normalization / Recovery"
        else:
            suggested = "Transition / Moderate Stress"
        
        print(f"  → Suggested Label: {suggested}")
    
    print("\n" + "-"*70)
    print("⚠️  Labels come after statistics, not before.")
    print("   Review characteristics above and assign semantic labels based on:")
    print("   - Economic interpretation")
    print("   - Historical context")
    print("   - Your research question")
    print("="*70)
    
    return means

def print_economic_monotonicity(monotonicity_dict, use_descriptive_labels=True):
    
    #Print formatted economic monotonicity table.
    
    means = monotonicity_dict['means']
    stds = monotonicity_dict['stds']
    counts = monotonicity_dict['counts']
    
    # Get descriptive labels if requested
    regime_labels = None
    if use_descriptive_labels:
        try:
            regime_labels = label_regimes_by_function(monotonicity_dict)
        except:
            regime_labels = None
    
    print("\n" + "="*60)
    print("ECONOMIC MONOTONICITY CHECK")
    print("="*60)
    print("\nMean feature values per regime:")
    
    # Display with descriptive labels if available
    if regime_labels:
        means_display = means.copy()
        means_display.index = [f"{idx} ({regime_labels[idx]})" for idx in means_display.index]
        print(means_display.to_string())
    else:
        print(means.to_string())
    
    print("\n\nRegime sample sizes:")
    for regime, count in counts.items():
        label_str = f" ({regime_labels[regime]})" if regime_labels and regime in regime_labels else ""
        print(f"  Regime {regime}{label_str}: {count} days ({count/252:.1f} years)")
    
    print("\n" + "-"*60)
    print("INTERPRETATION:")
    print("  If regimes are clearly separated in this table → clustering succeeded")
    print("  If values are similar across regimes → clustering may have failed")
    print("  Look for:")
    print("    - Distinct volatility levels per regime")
    print("    - Different correlation patterns")
    print("    - Varying PC1 variance (market mode dominance)")
    print("    - Different effective dimensions (diversification)")
    if regime_labels:
        print(f"\n  Regime Labels: {regime_labels}")
    print("="*60)
    
    return regime_labels

def summarize_clustering_evaluation(evals: dict):
    
    #Prints/returns a summary table of inertia, silhouette score, and mean/max regime persistence for each K.
    
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

