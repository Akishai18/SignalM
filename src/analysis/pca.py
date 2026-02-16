import numpy as np
import pandas as pd
from sklearn.decomposition import PCA


def run_pca(features, n_components=15, impute_method='zero'):
    #Fit PCA on features (DataFrame: dates x features).

    #Returns:
        #dict with keys:
          #- 'pca': fitted sklearn PCA object
          #- 'components': DataFrame (dates x k) principal component timeseries
          #- 'loadings': DataFrame (features x k) PCA loadings (weights)
          #- 'explained_variance_ratio': ndarray
          #- 'explained_variance': ndarray

    if features is None or features.empty:
        raise ValueError("Features is empty. Run assemble_feature_matrix + normalize_features_cross_sectional first.")

    X = features.copy()
    if impute_method == 'zero':
        X_filled = X.fillna(0.0)
    elif impute_method == 'col_mean':
        X_filled = X.fillna(X.mean())
    else:
        raise ValueError("impute_method must be 'zero' or 'col_mean'")

    pca = PCA(n_components=n_components)
    comps = pca.fit_transform(X_filled.values)  # shape (T, k)

    comps_df = pd.DataFrame(comps, index=X.index, columns=[f"PC{i+1}" for i in range(pca.n_components_)])
    loadings = pd.DataFrame(pca.components_.T, index=X.columns, columns=comps_df.columns)

    return {
        'pca': pca,
        'components': comps_df,
        'loadings': loadings,
        'explained_variance_ratio': pca.explained_variance_ratio_,
        'explained_variance': pca.explained_variance_
    }


def top_loadings_per_pc(loadings, top_n=10):
    #Return dict mapping PC -> dict(top_pos=Series, top_neg=Series)
    
    out = {}
    for pc in loadings.columns:
        s = loadings[pc].sort_values(ascending=False)
        out[pc] = {'top_pos': s.head(top_n), 'top_neg': s.tail(top_n)}
    return out


def rolling_pca_metrics(features, window=252, n_components=10, impute_method='col_mean', normalize_within_window=False):
    # Run PCA on rolling windows of the feature matrix and return time series of PCA metrics.
    # Returns:
    #     DataFrame indexed by window end date with columns:
    #       - PC1_var, PC2_var, PC3_var : explained variance ratio for first 3 PCs
    #       - cum_var_3                : cumulative explained variance for PCs 1..3
    #       - eff_dim                  : effective dimension = (sum λ_i)^2 / sum λ_i^2
    # Notes:
    #     - If a window is too small or PCA fails, metrics for that date are NaN.
    #     - Uses per-window imputation and optional per-window standardization to ensure equal scaling.

    if features is None or features.empty:
        return pd.DataFrame(columns=['PC1_var','PC2_var','PC3_var','cum_var_3','eff_dim'])

    T = len(features)
    if window > T:
        return pd.DataFrame(columns=['PC1_var','PC2_var','PC3_var','cum_var_3','eff_dim'])

    dates = []
    rows = []
    for end_idx in range(window - 1, T):
        win = features.iloc[end_idx - window + 1:end_idx + 1]
        date = win.index[-1]
        dates.append(date)

        # Impute within-window
        if impute_method == 'col_mean':
            Xw = win.fillna(win.mean())
        elif impute_method == 'zero':
            Xw = win.fillna(0.0)
        else:
            raise ValueError("impute_method must be 'col_mean' or 'zero'")

        # normalize within window (column-wise standardize)
        if normalize_within_window:
            col_mean = Xw.mean()
            col_std = Xw.std(ddof=0).replace(0, np.nan)
            Xw = (Xw - col_mean) / col_std
            Xw = Xw.fillna(0.0)

        try:
            k = min(n_components, Xw.shape[1])
            if k < 1:
                raise ValueError("Not enough features in window for PCA")

            pca = PCA(n_components=k)
            pca.fit(Xw.values)  # sklearn centers by default
            evr = pca.explained_variance_ratio_
            # first three explained variance ratios
            pc1 = float(evr[0]) if len(evr) >= 1 else np.nan
            pc2 = float(evr[1]) if len(evr) >= 2 else np.nan
            pc3 = float(evr[2]) if len(evr) >= 3 else np.nan
            cum3 = float(np.nansum(evr[:3]))

            # Effective dimension using PCA's explained_variance_ (spectrum)
            eigs = pca.explained_variance_.astype(float)
            eigs = eigs[eigs > 0]  # drop non-positive numeric noise
            if eigs.size == 0:
                eff_dim = np.nan
            else:
                s1 = eigs.sum()
                s2 = np.sum(eigs * eigs)
                eff_dim = float((s1 * s1) / s2) if s2 != 0 else np.nan

            rows.append({
                'PC1_var': pc1,
                'PC2_var': pc2,
                'PC3_var': pc3,
                'cum_var_3': cum3,
                'eff_dim': eff_dim
            })
        except Exception:
            rows.append({
                'PC1_var': np.nan,
                'PC2_var': np.nan,
                'PC3_var': np.nan,
                'cum_var_3': np.nan,
                'eff_dim': np.nan
            })

    out = pd.DataFrame(rows, index=pd.DatetimeIndex(dates))
    out.index.name = features.index.name or 'Date'
    return out