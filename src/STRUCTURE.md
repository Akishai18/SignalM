# Source Code Structure

## Organization

The `src/` directory is organized into logical modules:

```
src/
├── main.py                    # Main entry point - orchestrates entire pipeline
│
├── analysis/                  # Core data analysis functions
│   ├── __init__.py
│   ├── analyze.py            # Data loading, cleaning, statistics, rolling metrics
│   ├── pca.py                # PCA analysis and rolling PCA metrics
│   └── pca_interpretation.py # PCA interpretation utilities
│
├── visualization/             # All plotting and visualization functions
│   ├── __init__.py
│   ├── visualize.py          # General visualization functions (distributions, rolling stats, etc.)
│   └── umap_embed.py         # UMAP embedding and visualization
│
├── utils/                     # Utility functions
│   ├── __init__.py
│   └── display.py             # Console output formatting and printing
│
└── regime/                    # Market regime detection module
    ├── __init__.py
    ├── feature_engineering.py    # Build regime feature matrix
    ├── normalize.py              # Z-score normalization
    ├── cluster.py                 # K-means clustering
    ├── evaluate.py                # Regime quality diagnostics
    ├── transitions.py             # Transition analysis
    ├── evaluate_transitions.py    # Transition diagnostics
    ├── cross_validation.py        # Out-of-sample validation
    ├── validate.py                # Validation against reality (events, VIX, etc.)
    ├── visualize_regimes.py        # Regime-specific visualizations
    ├── visualize_transitions.py    # Transition visualizations
    ├── run_regime_clustering.py   # Main regime pipeline orchestrator
    └── README.md                   # Regime module documentation
```

## Module Responsibilities

### `analysis/`
- **analyze.py**: Data loading, cleaning, log returns, basic statistics, rolling statistics, correlation matrices
- **pca.py**: Principal Component Analysis, rolling PCA metrics
- **pca_interpretation.py**: PCA interpretation and analysis utilities

### `visualization/`
- **visualize.py**: All general plotting functions (distributions, rolling stats, correlation heatmaps)
- **umap_embed.py**: UMAP dimensionality reduction and visualization

### `utils/`
- **display.py**: All console output formatting, printing functions, status messages

### `regime/`
Complete market regime detection pipeline:
- Feature engineering → Normalization → Clustering → Evaluation → Validation
- Transition analysis and diagnostics
- Cross-validation for out-of-sample testing

## Import Examples

```python
# Main analysis functions
from analysis import analyze, pca
from visualization import visualize
from utils import display

# Regime detection
from regime.run_regime_clustering import run_regime_pipeline
```

## Migration Notes

All imports have been updated to use the new module structure:
- `import analyze` → `from analysis import analyze`
- `import display` → `from utils import display`
- `import visualize` → `from visualization import visualize`
- `import pca` → `from analysis import pca`
