# Feature construction for market regimes
import pandas as pd
import numpy as np

def build_regime_features(
    rolling_metrics_path:str, 
    rolling_stats:dict=None,  
    window:int=126
) -> pd.DataFrame:
    
    #Build regime feature matrix X_t from rolling vol/corr and PCA summaries.
    #Returns DataFrame indexed by date, columns as regime features.
    #Default window=126 (6 months) for more frequent transitions vs 252 (annual).
    
    #Load PCA-like metrics (market structure, from rolling_pca_metrics.csv) 
    pca_metrics = pd.read_csv(rolling_metrics_path, index_col=0, parse_dates=True)
    # Expected columns (or rename in code):
    # 'PC1_var', 'cumulative_var_3', 'effective_dimension', (date as index or column)
    
    # Core Feature Construction 
    if rolling_stats:
        # Use supplied rolling stats dict
        vol = rolling_stats['volatility']
        corr = rolling_stats['correlation']
    else:
        # User should supply proper rolling_stats for their pipeline
        raise ValueError("rolling_stats dict required if not loading from file")

    # Mean volatility and dispersion: rolling window (default 126-day = 6 months)
    vol_cols = [c for c in vol.columns if c.endswith(f'_vol_{window}')]
    if len(vol_cols) == 0:
        # Window not found - try to find closest available window
        available_windows = []
        for col in vol.columns:
            if '_vol_' in col:
                try:
                    w = int(col.split('_vol_')[-1])
                    available_windows.append(w)
                except:
                    pass
        if available_windows:
            closest_window = min(available_windows, key=lambda x: abs(x - window))
            print(f"Warning: Window {window} not found. Using closest available window: {closest_window}")
            vol_cols = [c for c in vol.columns if c.endswith(f'_vol_{closest_window}')]
            window = closest_window  # Update window for correlation lookup
        else:
            raise ValueError(f"No volatility columns found for window {window}. Available windows: {sorted(set(available_windows))}")
    
    if len(vol_cols) == 0:
        raise ValueError(f"No volatility columns found for window {window}")
    
    avg_vol = vol[vol_cols].mean(axis=1, skipna=True)
    vol_dispersion = vol[vol_cols].std(axis=1, skipna=True)

    # Market-aggregated correlation
    corr_col = f'avg_pairwise_corr_{window}'
    avg_pairwise_corr = corr[corr_col] if corr_col in corr.columns else pd.Series(np.nan, index=vol.index)

    # Find intersection of dates between rolling stats and PCA metrics
    # PCA metrics may start later (e.g., 2012) while rolling stats start earlier (e.g., 2011)
    common_dates = avg_vol.index.intersection(pca_metrics.index)
    
    if len(common_dates) == 0:
        raise ValueError(
            f"No overlapping dates between rolling stats ({avg_vol.index.min()} to {avg_vol.index.max()}) "
            f"and PCA metrics ({pca_metrics.index.min()} to {pca_metrics.index.max()})"
        )
    
    print(f"Aligning dates: {len(common_dates)} common dates out of {len(avg_vol)} rolling stats dates")
    print(f"  Rolling stats range: {avg_vol.index.min()} to {avg_vol.index.max()}")
    print(f"  PCA metrics range: {pca_metrics.index.min()} to {pca_metrics.index.max()}")
    print(f"  Common dates range: {common_dates.min()} to {common_dates.max()}")
    
    # Align all series to common dates
    avg_vol = avg_vol.loc[common_dates]
    vol_dispersion = vol_dispersion.loc[common_dates]
    avg_pairwise_corr = avg_pairwise_corr.loc[common_dates]
    pca_metrics = pca_metrics.loc[common_dates]
    
    # Construct the feature DataFrame
    # Handle different possible column names in PCA metrics
    pc1_col = 'PC1_var' if 'PC1_var' in pca_metrics.columns else pca_metrics.columns[0]
    cumvar_col = 'cum_var_3' if 'cum_var_3' in pca_metrics.columns else ('cumulative_var_3' if 'cumulative_var_3' in pca_metrics.columns else None)
    effdim_col = 'eff_dim' if 'eff_dim' in pca_metrics.columns else ('effective_dimension' if 'effective_dimension' in pca_metrics.columns else None)
    
    # Note: Column names use window value for clarity (e.g., avg_vol_126)
    X = pd.DataFrame({
        f'avg_vol_{window}': avg_vol,
        f'vol_dispersion_{window}': vol_dispersion,
        f'avg_pairwise_corr_{window}': avg_pairwise_corr,
        'PC1_var': pca_metrics[pc1_col],
    }, index=common_dates)
    
    # Add optional features if available
    if cumvar_col and cumvar_col in pca_metrics.columns:
        X['cum_var_3'] = pca_metrics[cumvar_col]
    if effdim_col and effdim_col in pca_metrics.columns:
        X['effective_dimension'] = pca_metrics[effdim_col]
    # Optionally: can add time-based filtering for joint completeness
    X.dropna(how='any', inplace=True)
    return X

