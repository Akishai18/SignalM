# Regime Clustering Module

This module implements market regime detection using K-means clustering on aggregated market structure features.

## Quick Start

### Option 1: Run as part of main analysis pipeline

```bash
cd src
python main.py
```

This will automatically run the regime clustering after computing rolling statistics.

### Option 2: Run standalone

```bash
cd src
python -c "from regime.run_regime_clustering import run_regime_pipeline; from main import run_full_analysis; results = run_full_analysis(base_path='data', generate_plots=False); run_regime_pipeline(rolling_stats=results['rolling_stats'], pca_metrics_path='../pca_data/rolling_pca_metrics.csv')"
```

Or in Python:

```python
from regime.run_regime_clustering import run_regime_pipeline
from main import run_full_analysis

# First get rolling stats from main analysis
results = run_full_analysis(base_path="data", generate_plots=False)
rolling_stats = results['rolling_stats']

# Then run regime clustering
regime_results = run_regime_pipeline(
    rolling_stats=rolling_stats,
    pca_metrics_path="../pca_data/rolling_pca_metrics.csv",
    k_range=[3, 4, 5, 6],
    final_k=4,
    save_dir="regime_results"
)
```

## What it does

1. **Builds regime feature matrix** from:
   - Average volatility (252-day)
   - Volatility dispersion (cross-sectional std)
   - Average pairwise correlation
   - PC1 variance (from PCA)
   - Cumulative variance (first 3 PCs)
   - Effective dimension

2. **Normalizes features** (z-score across time)

3. **Evaluates K-means** for K = 3, 4, 5, 6

4. **Fits final model** with chosen K

5. **Step 6: Diagnoses regime quality** (non-negotiable):
   - **Persistence Check**: Average duration > 1 month, no excessive day-to-day flipping
   - **Economic Monotonicity**: Mean feature values per regime (should be clearly separated)
   - **UMAP Separation**: Visual check that regimes form contiguous regions, not salt-and-pepper

6. **Generates visualizations** and saves results

## Output

- Regime labels for each date
- Evaluation metrics (inertia, silhouette, persistence)
- **Persistence diagnostics** (pass/fail checks)
- **Economic monotonicity table** (mean features per regime)
- **UMAP visualization** colored by regime (if UMAP embedding exists)
- Visualization plots
- Saved CSV files (if save_dir provided)

## Picking K

Choose K based on:
1. **Persistence**: `passes_persistence=True` in evaluation summary
2. **Interpretability**: Economic monotonicity table shows clear separation
3. **UMAP**: Regimes form contiguous regions (not random)
4. **Simplicity**: If multiple K pass, prefer lower K

If no K passes persistence checks → features may be too noisy or need different approach.

