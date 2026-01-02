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