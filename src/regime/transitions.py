# Regime transition analysis
# Analyzes how regimes transition over time: probabilities, durations, paths
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional


def compute_transition_matrix(regime_labels: pd.Series) -> pd.DataFrame:
    #Compute transition probability matrix from regime sequence.
    #Returns DataFrame where entry (i, j) = P(regime_j | regime_i)
    #i.e., probability of transitioning TO regime j GIVEN we're IN regime i
    
    if isinstance(regime_labels, np.ndarray):
        regime_labels = pd.Series(regime_labels)
    
    # Get unique regimes
    regimes = sorted(regime_labels.unique())
    n_regimes = len(regimes)
    
    # Initialize transition count matrix
    transition_counts = pd.DataFrame(
        0, 
        index=regimes, 
        columns=regimes,
        dtype=int
    )
    
    # Count transitions: for each day, check if next day is different
    for i in range(len(regime_labels) - 1):
        current_regime = regime_labels.iloc[i]
        next_regime = regime_labels.iloc[i + 1]
        transition_counts.loc[current_regime, next_regime] += 1
    
    # Convert counts to probabilities (row-normalize)
    # Each row sums to 1: probability of transitioning to any regime from current regime
    transition_matrix = transition_counts.div(transition_counts.sum(axis=1), axis=0)
    
    # Fill NaN with 0 (if a regime never appears, transitions are 0)
    transition_matrix = transition_matrix.fillna(0)
    
    return transition_matrix, transition_counts


def compute_regime_durations(regime_labels: pd.Series) -> Dict:
    #Compute statistics about how long regimes last.
    #Returns dict with mean, median, min, max duration per regime
    
    if isinstance(regime_labels, np.ndarray):
        regime_labels = pd.Series(regime_labels)
    
    # Identify regime runs (consecutive days in same regime)
    runs = regime_labels.ne(regime_labels.shift()).cumsum()
    run_lengths = regime_labels.groupby(runs).size()
    run_regimes = regime_labels.groupby(runs).first()
    
    # Compute statistics per regime
    regimes = sorted(regime_labels.unique())
    duration_stats = {}
    
    for regime in regimes:
        regime_runs = run_lengths[run_regimes == regime]
        if len(regime_runs) > 0:
            duration_stats[regime] = {
                'mean_days': regime_runs.mean(),
                'median_days': regime_runs.median(),
                'min_days': regime_runs.min(),
                'max_days': regime_runs.max(),
                'std_days': regime_runs.std(),
                'total_runs': len(regime_runs),
                'total_days': regime_runs.sum()
            }
        else:
            duration_stats[regime] = {
                'mean_days': 0,
                'median_days': 0,
                'min_days': 0,
                'max_days': 0,
                'std_days': 0,
                'total_runs': 0,
                'total_days': 0
            }
    
    return duration_stats


def find_common_transition_paths(regime_labels: pd.Series, max_path_length: int = 3) -> List[Tuple]:
    #Find most common sequences of regime transitions.
    #Example: Calm -> Transition -> Crisis is a 3-step path
    
    if isinstance(regime_labels, np.ndarray):
        regime_labels = pd.Series(regime_labels)
    
    # Find all transitions (where regime changes)
    transitions = []
    for i in range(len(regime_labels) - 1):
        if regime_labels.iloc[i] != regime_labels.iloc[i + 1]:
            transitions.append((i, regime_labels.iloc[i], regime_labels.iloc[i + 1]))
    
    # Find paths of length 2, 3, etc.
    path_counts = {}
    
    for path_len in range(2, max_path_length + 1):
        for i in range(len(transitions) - path_len + 1):
            # Extract path: sequence of regimes
            path = [transitions[i][1]]  # Start regime
            for j in range(path_len):
                path.append(transitions[i + j][2])  # End regime of each transition
            
            path_tuple = tuple(path)
            path_counts[path_tuple] = path_counts.get(path_tuple, 0) + 1
    
    # Sort by frequency
    sorted_paths = sorted(path_counts.items(), key=lambda x: x[1], reverse=True)
    
    return sorted_paths


def compute_transition_statistics(regime_labels: pd.Series) -> Dict:
    #Compute comprehensive transition statistics.
    #Returns dict with transition matrix, durations, and summary stats
    
    transition_matrix, transition_counts = compute_transition_matrix(regime_labels)
    durations = compute_regime_durations(regime_labels)
    common_paths = find_common_transition_paths(regime_labels, max_path_length=3)
    
    # Count total change points (where regime changes from previous day)
    # Note: shift() makes first row NaN, so (NaN != value) = True, hence we subtract 1
    total_change_points = (regime_labels != regime_labels.shift()).sum() - 1
    
    # Count regime switches (actual transitions to a DIFFERENT regime)
    # This is the sum of all off-diagonal entries in transition_counts
    regime_switches = 0
    for from_regime in transition_counts.index:
        for to_regime in transition_counts.columns:
            if from_regime != to_regime:  # Only count transitions to different regime
                regime_switches += transition_counts.loc[from_regime, to_regime]
    
    # Count self-transitions (staying in same regime) - diagonal entries
    self_transitions = 0
    for regime in transition_matrix.index:
        self_transitions += transition_counts.loc[regime, regime]
    
    # Total transitions = switches + self-transitions (should equal number of day pairs)
    total_transitions = regime_switches + self_transitions
    
    stats = {
        'transition_matrix': transition_matrix,
        'transition_counts': transition_counts,
        'durations': durations,
        'common_paths': common_paths,
        'total_days': len(regime_labels),
        'total_transitions': total_transitions,
        'regime_switches': regime_switches,
        'unique_regimes': sorted(regime_labels.unique().tolist()),
        'n_regimes': len(regime_labels.unique())
    }
    
    return stats


def print_transition_analysis(transition_stats: Dict, regime_label_map: Optional[Dict] = None):
    #Print formatted transition analysis results.
    
    print("\n" + "="*70)
    print("REGIME TRANSITION ANALYSIS")
    print("="*70)
    
    transition_matrix = transition_stats['transition_matrix']
    transition_counts = transition_stats['transition_counts']
    durations = transition_stats['durations']
    common_paths = transition_stats['common_paths']
    
    # Print transition probability matrix
    print("\n[1] TRANSITION PROBABILITY MATRIX")
    print("-"*70)
    print("Rows = FROM regime, Columns = TO regime")
    print("Values = Probability of transitioning TO column regime FROM row regime")
    print()
    
    # Format with regime labels if available
    if regime_label_map:
        display_matrix = transition_matrix.copy()
        display_matrix.index = [f"{idx} ({regime_label_map.get(idx, '')})" for idx in display_matrix.index]
        display_matrix.columns = [f"{idx} ({regime_label_map.get(idx, '')})" for idx in display_matrix.columns]
        print(display_matrix.to_string())
    else:
        print(transition_matrix.to_string())
    
    # Print transition counts (raw numbers)
    print("\n[2] TRANSITION COUNTS (Raw Numbers)")
    print("-"*70)
    if regime_label_map:
        display_counts = transition_counts.copy()
        display_counts.index = [f"{idx} ({regime_label_map.get(idx, '')})" for idx in display_counts.index]
        display_counts.columns = [f"{idx} ({regime_label_map.get(idx, '')})" for idx in display_counts.columns]
        print(display_counts.to_string())
    else:
        print(transition_counts.to_string())
    
    # Print regime durations
    print("\n[3] REGIME DURATION STATISTICS")
    print("-"*70)
    print(f"{'Regime':<15} {'Mean':<10} {'Median':<10} {'Min':<8} {'Max':<8} {'Total Days':<12} {'Runs':<8}")
    print("-"*70)
    
    for regime in sorted(durations.keys()):
        d = durations[regime]
        label_str = f" ({regime_label_map.get(regime, '')})" if regime_label_map else ""
        print(f"{regime}{label_str:<15} {d['mean_days']:<10.1f} {d['median_days']:<10.1f} "
              f"{d['min_days']:<8} {d['max_days']:<8} {d['total_days']:<12} {d['total_runs']:<8}")
    
    # Print most common transition paths
    print("\n[4] MOST COMMON TRANSITION PATHS")
    print("-"*70)
    print("Top 10 most frequent regime sequences:")
    print()
    
    for i, (path, count) in enumerate(common_paths[:10], 1):
        path_str = " → ".join([str(r) for r in path])
        if regime_label_map:
            path_str = " → ".join([f"{r} ({regime_label_map.get(r, '')})" for r in path])
        print(f"  {i:2d}. {path_str:<50} (occurs {count} times)")
    
    # Print summary statistics
    print("\n[5] SUMMARY STATISTICS")
    print("-"*70)
    print(f"Total days analyzed: {transition_stats['total_days']}")
    print(f"Number of unique regimes: {transition_stats['n_regimes']}")
    print(f"Total regime transitions: {transition_stats['total_transitions']}")
    print(f"Regime switches (to different regime): {transition_stats['regime_switches']}")
    print(f"Average days per transition: {transition_stats['total_days'] / max(transition_stats['total_transitions'], 1):.1f}")
    
    # Print interpretation
    print("\n" + "="*70)
    print("INTERPRETATION:")
    print("  • High diagonal values → Regimes are persistent (tend to stay)")
    print("  • High off-diagonal values → Common transition paths")
    print("  • Mean duration < 21 days → Regimes may be too noisy")
    print("  • Common paths reveal typical market evolution patterns")
    print("="*70)
    
    return transition_stats
