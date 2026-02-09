# Visualizations for clustering regime results
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import os

def plot_regime_assignments(X_norm, regime_labels, ax=None):
    # Plot time series of regime assignments
    if ax is None:
        fig, ax = plt.subplots(figsize=(14, 4))
    regime_labels = pd.Series(regime_labels, index=X_norm.index)
    ax.plot(regime_labels.index, regime_labels.values, '.', markersize=2)
    ax.set_title('Regime Assignment Over Time')
    ax.set_xlabel('Date')
    ax.set_ylabel('Regime label')
    return ax

def plot_centroid_spider(models, X_cols, k: int, ax=None):
    # Plot radar chart/spider chart for regime centroids
    from math import pi
    model = models[k]['model']
    centroids = model.cluster_centers_
    feat_labels = list(X_cols)
    n_features = len(feat_labels)
    if ax is None:
        fig, ax = plt.subplots(subplot_kw=dict(polar=True), figsize=(7, 7))
    for i in range(centroids.shape[0]):
        values = centroids[i, :].tolist()
        values += values[:1]
        angles = [n / float(n_features) * 2 * np.pi for n in range(n_features)]
        angles += angles[:1]
        ax.plot(angles, values, label=f'Regime {i}')
        ax.fill(angles, values, alpha=0.2)
    ax.set_xticks([n / float(n_features) * 2 * np.pi for n in range(n_features)])
    ax.set_xticklabels(feat_labels)
    ax.set_title(f'Regime centroids (K={k})', y=1.10)
    ax.legend()
    return ax

def plot_umap_by_regime(umap_df, regime_labels, umap_path=None, ax=None, figsize=(10, 8)):
    #Plot UMAP embedding colored by regime labels.
    #This is a key diagnostic: regimes should form contiguous regions, not random salt-and-pepper.
    #
    #Note: Disconnected clusters of the same color reflect regime recurrence - similar market
    #structures appearing at different points in time. UMAP preserves local neighborhood structure,
    #not time continuity, so the market can revisit the same regime geometry years apart.
    
    # Load UMAP if path provided
    if umap_df is None and umap_path:
        if os.path.exists(umap_path):
            umap_df = pd.read_csv(umap_path, index_col=0, parse_dates=True)
        else:
            raise FileNotFoundError(f"UMAP embedding not found at {umap_path}")
    
    if umap_df is None:
        raise ValueError("Must provide either umap_df or umap_path")
    
    # Ensure regime_labels is a Series with proper index
    if isinstance(regime_labels, np.ndarray):
        if hasattr(umap_df, 'index'):
            regime_labels = pd.Series(regime_labels, index=umap_df.index[:len(regime_labels)], name='regime')
        else:
            regime_labels = pd.Series(regime_labels, name='regime')
    elif not isinstance(regime_labels, pd.Series):
        regime_labels = pd.Series(regime_labels, name='regime')
    
    # Align indices
    common_idx = umap_df.index.intersection(regime_labels.index)
    if len(common_idx) == 0:
        raise ValueError("No overlapping dates between UMAP embedding and regime labels")
    
    umap_aligned = umap_df.loc[common_idx]
    labels_aligned = regime_labels.loc[common_idx]
    
    # Create plot
    if ax is None:
        fig, ax = plt.subplots(figsize=figsize)
    else:
        fig = ax.figure
    
    # Get unique regimes and assign colors
    unique_regimes = sorted(labels_aligned.unique())
    n_regimes = len(unique_regimes)
    colors = plt.cm.Set3(np.linspace(0, 1, max(n_regimes, 12)))[:n_regimes]
    
    # Plot each regime with different color
    for i, regime in enumerate(unique_regimes):
        mask = labels_aligned == regime
        ax.scatter(
            umap_aligned.loc[mask, 'UMAP1'],
            umap_aligned.loc[mask, 'UMAP2'],
            c=[colors[i]],
            label=f'Regime {regime}',
            s=20,
            alpha=0.6,
            edgecolors='black',
            linewidths=0.5
        )
    
    ax.set_xlabel('UMAP1', fontsize=12)
    ax.set_ylabel('UMAP2', fontsize=12)
    title = ('UMAP Embedding Colored by Regime Labels\n'
             'Disconnected clusters of same color = regime recurrence across time')
    ax.set_title(title, fontsize=12)
    ax.legend(loc='best', fontsize=9)
    ax.grid(True, alpha=0.3)
    
    return fig
