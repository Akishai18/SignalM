# Clustering for Regime Detection (KMeans)
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

def fit_kmeans_regimes(X_norm, k:int, random_state=42):
    """
    Fit KMeans clustering on normalized feature matrix.
    Returns: kmeans, labels (pd.Series, index=X.index)
    """
    model = KMeans(n_clusters=k, random_state=random_state)
    labels = model.fit_predict(X_norm.values)
    return model, pd.Series(labels, index=X_norm.index, name=f'regime_k{k}')


def evaluate_kmeans(X_norm, k_range=[3,4,5,6], random_state=42):
    """
    For each K, fit model, compute inertia and silhouette score.
    Returns dict: K -> { model, labels, inertia, sil }
    """
    results = {}
    for k in k_range:
        model = KMeans(n_clusters=k, random_state=random_state)
        labels = model.fit_predict(X_norm.values)
        inertia = model.inertia_
        sil = None
        # Silhouette only defined if k > 1 and num unique labels > 1
        if k > 1 and np.unique(labels).shape[0] > 1:
            sil = silhouette_score(X_norm, labels)
        results[k] = dict(model=model, labels=labels, inertia=inertia, silhouette=sil)
    return results

