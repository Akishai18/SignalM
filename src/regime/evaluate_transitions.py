# Transition diagnostics: rare transitions, symmetry, persistence validation
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional


def identify_rare_transitions(
    transition_matrix: pd.DataFrame,
    transition_counts: pd.DataFrame,
    rare_threshold: float = 0.01,
    min_count: int = 2
) -> List[Tuple]:
    #Identify rare transitions (low probability or very few occurrences).
    #Returns list of (from_regime, to_regime, probability, count) tuples
    
    rare_transitions = []
    
    for from_regime in transition_matrix.index:
        for to_regime in transition_matrix.columns:
            prob = transition_matrix.loc[from_regime, to_regime]
            count = transition_counts.loc[from_regime, to_regime]
            
            # Rare if: probability < threshold OR count < min_count
            if prob > 0 and (prob < rare_threshold or count < min_count):
                rare_transitions.append((from_regime, to_regime, prob, count))
    
    # Sort by probability (rarest first)
    rare_transitions.sort(key=lambda x: x[2])
    
    return rare_transitions


def check_transition_symmetry(
    transition_matrix: pd.DataFrame,
    symmetry_threshold: float = 0.1
) -> Dict:
    #Check if transitions are symmetric (bidirectional).
    #Returns dict with symmetric and asymmetric transitions
    
    symmetric_pairs = []
    asymmetric_pairs = []
    
    regimes = transition_matrix.index.tolist()
    
    # Check all pairs (avoid duplicates)
    for i, from_regime in enumerate(regimes):
        for to_regime in regimes[i+1:]:  # Only check upper triangle
            prob_forward = transition_matrix.loc[from_regime, to_regime]
            prob_backward = transition_matrix.loc[to_regime, from_regime]
            
            # Calculate asymmetry: |P(A→B) - P(B→A)|
            asymmetry = abs(prob_forward - prob_backward)
            
            # Both transitions exist (non-zero)
            if prob_forward > 0 or prob_backward > 0:
                if asymmetry < symmetry_threshold:
                    # Symmetric: probabilities are similar
                    symmetric_pairs.append({
                        'from': from_regime,
                        'to': to_regime,
                        'forward_prob': prob_forward,
                        'backward_prob': prob_backward,
                        'asymmetry': asymmetry
                    })
                else:
                    # Asymmetric: one direction is much more likely
                    asymmetric_pairs.append({
                        'from': from_regime,
                        'to': to_regime,
                        'forward_prob': prob_forward,
                        'backward_prob': prob_backward,
                        'asymmetry': asymmetry,
                        'direction': 'forward' if prob_forward > prob_backward else 'backward'
                    })
    
    return {
        'symmetric_pairs': symmetric_pairs,
        'asymmetric_pairs': asymmetric_pairs,
        'n_symmetric': len(symmetric_pairs),
        'n_asymmetric': len(asymmetric_pairs)
    }


def validate_transition_persistence(
    regime_labels: pd.Series,
    transition_matrix: pd.DataFrame
) -> Dict:
    #Validate that transitions are persistent (don't immediately flip back).
    #Checks: if we transition A→B, do we tend to stay in B for a while?
    
    if isinstance(regime_labels, np.ndarray):
        regime_labels = pd.Series(regime_labels)
    
    # Find all transitions
    transitions = []
    for i in range(len(regime_labels) - 1):
        current_regime = regime_labels.iloc[i]
        next_regime = regime_labels.iloc[i + 1]
        if current_regime != next_regime:
            transitions.append({
                'date': regime_labels.index[i + 1],
                'from': current_regime,
                'to': next_regime
            })
    
    # For each transition, check how long we stay in the destination regime
    persistence_after_transition = {}
    
    for trans in transitions:
        trans_key = (trans['from'], trans['to'])
        trans_date = trans['date']
        
        # Find how long we stay in the destination regime
        regime_after = trans['to']
        start_idx = regime_labels.index.get_loc(trans_date)
        
        # Count consecutive days in destination regime
        duration = 0
        for i in range(start_idx, len(regime_labels)):
            if regime_labels.iloc[i] == regime_after:
                duration += 1
            else:
                break
        
        if trans_key not in persistence_after_transition:
            persistence_after_transition[trans_key] = []
        persistence_after_transition[trans_key].append(duration)
    
    # Compute statistics per transition type
    persistence_stats = {}
    for trans_key, durations in persistence_after_transition.items():
        persistence_stats[trans_key] = {
            'mean_duration': np.mean(durations),
            'median_duration': np.median(durations),
            'min_duration': np.min(durations),
            'max_duration': np.max(durations),
            'count': len(durations),
            'single_day_flips': sum(1 for d in durations if d == 1)  # Immediate flip-backs
        }
    
    # Overall validation: check if transitions are persistent
    # Good: mean duration > 21 days (1 month), few single-day flips
    overall_mean = np.mean([stats['mean_duration'] for stats in persistence_stats.values()])
    total_single_day_flips = sum([stats['single_day_flips'] for stats in persistence_stats.values()])
    total_transitions = sum([stats['count'] for stats in persistence_stats.values()])
    pct_single_day = (total_single_day_flips / total_transitions * 100) if total_transitions > 0 else 0
    
    passes_persistence = overall_mean >= 21 and pct_single_day < 10
    
    return {
        'persistence_stats': persistence_stats,
        'overall_mean_duration': overall_mean,
        'total_single_day_flips': total_single_day_flips,
        'pct_single_day_flips': pct_single_day,
        'passes_persistence': passes_persistence
    }


def print_transition_diagnostics(
    transition_matrix: pd.DataFrame,
    transition_counts: pd.DataFrame,
    regime_labels: pd.Series,
    regime_label_map: Optional[Dict] = None,
    rare_threshold: float = 0.01
):
    #Print comprehensive transition diagnostics.
    
    print("\n" + "="*70)
    print("TRANSITION DIAGNOSTICS")
    print("="*70)
    
    # 1. Rare transitions
    print("\n[1] RARE TRANSITIONS")
    print("-"*70)
    print(f"Identifying transitions with probability < {rare_threshold} or count < 2")
    print()
    
    rare_transitions = identify_rare_transitions(
        transition_matrix,
        transition_counts,
        rare_threshold=rare_threshold
    )
    
    if len(rare_transitions) == 0:
        print("  ✓ No rare transitions found (all transitions are common)")
    else:
        print(f"  Found {len(rare_transitions)} rare transition(s):")
        print()
        print(f"  {'From':<15} {'To':<15} {'Probability':<15} {'Count':<10}")
        print("-"*70)
        
        for from_regime, to_regime, prob, count in rare_transitions:
            from_label = f"{from_regime} ({regime_label_map.get(from_regime, '')})" if regime_label_map else str(from_regime)
            to_label = f"{to_regime} ({regime_label_map.get(to_regime, '')})" if regime_label_map else str(to_regime)
            print(f"  {from_label:<15} {to_label:<15} {prob:<15.4f} {count:<10}")
        
        print()
        print("  Interpretation:")
        print("    • Rare transitions may indicate:")
        print("      - Unusual market events")
        print("      - Data quality issues")
        print("      - Regime detection edge cases")
    
    # 2. Transition symmetry
    print("\n[2] TRANSITION SYMMETRY")
    print("-"*70)
    print("Checking if transitions are bidirectional (symmetric)")
    print()
    
    symmetry_results = check_transition_symmetry(transition_matrix)
    
    print(f"  Symmetric pairs: {symmetry_results['n_symmetric']}")
    print(f"  Asymmetric pairs: {symmetry_results['n_asymmetric']}")
    print()
    
    if len(symmetry_results['symmetric_pairs']) > 0:
        print("  Symmetric transitions (bidirectional):")
        print(f"  {'From':<15} {'To':<15} {'P(A→B)':<12} {'P(B→A)':<12} {'Asymmetry':<12}")
        print("-"*70)
        for pair in symmetry_results['symmetric_pairs'][:5]:  # Show top 5
            from_label = f"{pair['from']} ({regime_label_map.get(pair['from'], '')})" if regime_label_map else str(pair['from'])
            to_label = f"{pair['to']} ({regime_label_map.get(pair['to'], '')})" if regime_label_map else str(pair['to'])
            print(f"  {from_label:<15} {to_label:<15} {pair['forward_prob']:<12.4f} {pair['backward_prob']:<12.4f} {pair['asymmetry']:<12.4f}")
        if len(symmetry_results['symmetric_pairs']) > 5:
            print(f"  ... and {len(symmetry_results['symmetric_pairs']) - 5} more")
        print()
    
    if len(symmetry_results['asymmetric_pairs']) > 0:
        print("  Asymmetric transitions (one-way):")
        print(f"  {'From':<15} {'To':<15} {'P(A→B)':<12} {'P(B→A)':<12} {'Direction':<15}")
        print("-"*70)
        for pair in symmetry_results['asymmetric_pairs'][:5]:  # Show top 5
            from_label = f"{pair['from']} ({regime_label_map.get(pair['from'], '')})" if regime_label_map else str(pair['from'])
            to_label = f"{pair['to']} ({regime_label_map.get(pair['to'], '')})" if regime_label_map else str(pair['to'])
            direction_str = f"{from_label}→{to_label}" if pair['direction'] == 'forward' else f"{to_label}→{from_label}"
            print(f"  {from_label:<15} {to_label:<15} {pair['forward_prob']:<12.4f} {pair['backward_prob']:<12.4f} {direction_str:<15}")
        if len(symmetry_results['asymmetric_pairs']) > 5:
            print(f"  ... and {len(symmetry_results['asymmetric_pairs']) - 5} more")
        print()
    
    print("  Interpretation:")
    print("    • Symmetric transitions: Markets can move both ways (e.g., Calm ↔ Transition)")
    print("    • Asymmetric transitions: One-way paths (e.g., Crisis → Recovery, but not reverse)")
    
    # 3. Transition persistence
    print("\n[3] TRANSITION PERSISTENCE VALIDATION")
    print("-"*70)
    print("Validating that transitions are persistent (don't immediately flip back)")
    print()
    
    persistence_results = validate_transition_persistence(regime_labels, transition_matrix)
    
    print(f"  Overall mean duration after transition: {persistence_results['overall_mean_duration']:.1f} days")
    print(f"  Single-day flip-backs: {persistence_results['total_single_day_flips']} ({persistence_results['pct_single_day_flips']:.1f}%)")
    print(f"  Persistence check: {'✓ PASS' if persistence_results['passes_persistence'] else '✗ FAIL'}")
    print()
    
    # Show persistence stats per transition type
    print("  Persistence statistics per transition type:")
    print(f"  {'From':<15} {'To':<15} {'Mean Days':<12} {'Median':<10} {'Single-Day':<12} {'Count':<8}")
    print("-"*70)
    
    for (from_regime, to_regime), stats in sorted(persistence_results['persistence_stats'].items()):
        from_label = f"{from_regime} ({regime_label_map.get(from_regime, '')})" if regime_label_map else str(from_regime)
        to_label = f"{to_regime} ({regime_label_map.get(to_regime, '')})" if regime_label_map else str(to_regime)
        print(f"  {from_label:<15} {to_label:<15} {stats['mean_duration']:<12.1f} {stats['median_duration']:<10.1f} "
              f"{stats['single_day_flips']:<12} {stats['count']:<8}")
    
    print()
    print("  Interpretation:")
    print("    • Mean duration > 21 days: Transitions are persistent (good)")
    print("    • Single-day flips < 10%: Regimes don't immediately flip back (good)")
    print("    • If persistence fails: Regimes may be too noisy or K too large")
    
    print("\n" + "="*70)
    
    return {
        'rare_transitions': rare_transitions,
        'symmetry_results': symmetry_results,
        'persistence_results': persistence_results
    }
