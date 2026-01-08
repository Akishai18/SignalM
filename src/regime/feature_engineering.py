# Feature construction for market regimes
import pandas as pd
import numpy as np

def build_regime_features(
    rolling_metrics_path:str, # e.g. '../pca_data/rolling_pca_metrics.csv' or absolute
    rolling_stats:dict=None,  # optional precomputed rolling stats dict (keys: 'volatility', 'correlation', etc)
    window:int=252
) -> pd.DataFrame:
    """
    Build regime feature matrix X_t from rolling vol/corr and PCA summaries.
    Returns DataFrame indexed by date, columns as regime features.
    """
    # ---- Load PCA-like metrics (market structure, from rolling_pca_metrics.csv) ----
    pca_metrics = pd.read_csv(rolling_metrics_path, index_col=0, parse_dates=True)
    # Expected columns (or rename in code):
    # 'PC1_var', 'cumulative_var_3', 'effective_dimension', (date as index or column)
    
    # ---- Core Feature Construction ----
    if rolling_stats:
        # Use supplied rolling stats dict
        vol = rolling_stats['volatility']
        corr = rolling_stats['correlation']
    else:
        # User should supply proper rolling_stats for their pipeline
        raise ValueError("rolling_stats dict required if not loading from file")

    # Mean volatility and dispersion: 252-day window (annual)
    vol_cols = [c for c in vol.columns if c.endswith(f'_vol_{window}')]
    avg_vol_252 = vol[vol_cols].mean(axis=1, skipna=True)
    vol_dispersion_252 = vol[vol_cols].std(axis=1, skipna=True)

    # Market-aggregated correlation
    corr_col = f'avg_pairwise_corr_{window}'
    avg_pairwise_corr_252 = corr[corr_col] if corr_col in corr else pd.Series(np.nan, index=vol.index)

    # Align pca_metrics index with rolling stats index
    pca_metrics = pca_metrics.loc[avg_vol_252.index]
    
    # Construct the feature DataFrame
    X = pd.DataFrame({
        'avg_vol_252': avg_vol_252,
        'vol_dispersion_252': vol_dispersion_252,
        'avg_pairwise_corr_252': avg_pairwise_corr_252,
        'PC1_var': pca_metrics['PC1_var'],
        'cum_var_3': pca_metrics['cumulative_var_3'],
        'effective_dimension': pca_metrics['effective_dimension'],
    }, index=avg_vol_252.index)
    # Optionally: can add time-based filtering for joint completeness
    X.dropna(how='any', inplace=True)
    return X

