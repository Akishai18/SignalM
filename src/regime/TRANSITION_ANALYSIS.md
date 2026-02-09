# Regime Transition Analysis

## Overview

Regime transition analysis studies how markets move between different regimes over time. This module provides comprehensive tools to understand regime dynamics, predict transitions, and validate regime behavior.

## What It Does

### 1. Transition Probability Matrix
- **What**: Computes the probability of transitioning from one regime to another
- **Example**: If we're in "Crisis" regime, what's the probability we'll be in "Calm" next?
- **Output**: Square matrix where entry (i, j) = P(regime_j | regime_i)

### 2. Regime Duration Statistics
- **What**: Analyzes how long each regime typically lasts
- **Metrics**: Mean, median, min, max duration per regime
- **Use Case**: "If we're in Crisis, how long will it last on average?"

### 3. Common Transition Paths
- **What**: Identifies most frequent sequences of regime changes
- **Example**: "Calm → Transition → Crisis" is a common 3-step path
- **Use Case**: Understand typical market evolution patterns

### 4. Transition Network Visualization
- **What**: Graph showing regimes as nodes, transitions as edges
- **Node size**: Average duration in each regime
- **Edge width**: Transition probability
- **Use Case**: Visual understanding of regime dynamics

## Key Functions

### `compute_transition_matrix(regime_labels)`
Computes transition probability matrix from regime sequence.

**Input**: 
- `regime_labels`: pd.Series with regime IDs indexed by date

**Output**: 
- `transition_matrix`: pd.DataFrame with transition probabilities
- `transition_counts`: pd.DataFrame with raw transition counts

### `compute_regime_durations(regime_labels)`
Computes duration statistics for each regime.

**Output**: Dict with mean, median, min, max duration per regime

### `find_common_transition_paths(regime_labels, max_path_length=3)`
Finds most frequent sequences of regime transitions.

**Output**: List of (path, count) tuples, sorted by frequency

### `compute_transition_statistics(regime_labels)`
Comprehensive function that computes all transition statistics.

**Output**: Dict containing:
- `transition_matrix`: Probability matrix
- `transition_counts`: Raw counts
- `durations`: Duration statistics
- `common_paths`: Most frequent paths
- Summary statistics

## Visualization Functions

### `plot_transition_matrix()`
Heatmap showing transition probabilities and counts side-by-side.

### `plot_regime_durations()`
Bar charts showing mean/median and min/max durations per regime.

### `plot_transition_timeline()`
Timeline showing regime assignments with transition points marked.

### `plot_transition_network()`
Network graph with regimes as nodes, transitions as edges (requires networkx).

## Integration

The transition analysis is automatically run as **Step 9** in the regime clustering pipeline:

```python
from regime.run_regime_clustering import run_regime_pipeline

results = run_regime_pipeline(...)
transition_stats = results['transition_stats']
```

## Output Files

When `save_dir` is provided, the following files are generated:

1. **`transition_matrix_k4.csv`**: Transition probability matrix (CSV)
2. **`transition_matrix_k4.png`**: Heatmap visualization
3. **`regime_durations_k4.png`**: Duration statistics charts
4. **`transition_timeline_k4.png`**: Timeline with transition points
5. **`transition_network_k4.png`**: Network graph (if networkx available)

## Interpretation Guide

### Transition Matrix
- **High diagonal values** (e.g., 0.95): Regimes are persistent (tend to stay)
- **High off-diagonal values**: Common transition paths
- **Symmetric transitions**: Some regimes transition bidirectionally

### Duration Statistics
- **Mean duration < 21 days**: Regimes may be too noisy (check persistence diagnostics)
- **Mean duration > 100 days**: Regimes are very stable
- **Large min-max range**: High variability in regime duration

### Common Paths
- **2-step paths**: Direct transitions (e.g., Calm → Crisis)
- **3-step paths**: Typical market evolution (e.g., Calm → Transition → Crisis)
- **High frequency paths**: Most common market cycles

## Example Output

```
[1] TRANSITION PROBABILITY MATRIX
    0 (Calm)    1 (Crisis)  2 (Elevated) 3 (Transition)
0   0.95        0.02        0.02         0.01
1   0.10        0.85        0.03         0.02
2   0.05        0.10        0.80         0.05
3   0.15        0.05        0.10         0.70

[2] REGIME DURATION STATISTICS
Regime        Mean      Median    Min    Max     Total Days  Runs
0 (Calm)      125.3     98.0      21     450     2500        20
1 (Crisis)    45.2      38.0      7      120     450         10
...

[3] MOST COMMON TRANSITION PATHS
  1. 0 (Calm) → 3 (Transition) → 1 (Crisis)  (occurs 8 times)
  2. 1 (Crisis) → 3 (Transition) → 0 (Calm)   (occurs 6 times)
  ...
```

## Use Cases

1. **Risk Management**: "If we're in Crisis, how long will it last?"
2. **Strategy Development**: "What's the most likely next regime?"
3. **Validation**: "Do transitions make economic sense?"
4. **Prediction**: Use transition probabilities for forecasting (next phase)

## Next Steps

This transition analysis sets the foundation for:
- **Regime Prediction**: Use transition probabilities to forecast future regimes
- **HMM Implementation**: Hidden Markov Models for probabilistic regime forecasting
- **Early Warning Systems**: Detect when transitions are likely to occur
