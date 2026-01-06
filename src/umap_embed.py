import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# prefer explicit import for compatibility
try:
    import umap.umap_ as umap
except Exception:
    import umap  # fallback


def run_umap(pca_components, pcs=5, n_components=2, n_neighbors=30, min_dist=0.1, random_state=42):
    #Run UMAP on PCA component time series.

   # Returns:
       # umap_df: DataFrame indexed by date with UMAP coordinates (UMAP1, UMAP2[, UMAP3]).

    if pca_components is None or pca_components.empty:
        raise ValueError("pca_components is empty")

    # select PC1..PC{pcs}
    available = [c for c in pca_components.columns if c.upper().startswith("PC")]
    available_sorted = sorted(available, key=lambda x: int(x.lstrip("PC").lstrip("pc")))
    use = available_sorted[:pcs]
    if not use:
        raise ValueError("No PC columns found (expect 'PC1','PC2',...)")

    X = pca_components[use].copy()

    # standardize each PC column over time (z-score)
    col_mean = X.mean()
    col_std = X.std().replace(0, 1.0)
    Xs = (X - col_mean) / col_std

    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric='euclidean',
        random_state=random_state
    )
    embedding = reducer.fit_transform(Xs.values)

    cols = [f"UMAP{i+1}" for i in range(n_components)]
    umap_df = pd.DataFrame(embedding, index=X.index, columns=cols)
    return umap_df


def plot_umap_colored(umap_df, color_by=None, cmap='viridis', s=8, figsize=(8, 6), title=None):
    #Scatter UMAP 2D embedding.

    if umap_df is None or umap_df.empty:
        raise ValueError("umap_df empty")
    if 'UMAP1' not in umap_df.columns or 'UMAP2' not in umap_df.columns:
        raise ValueError("umap_df must contain UMAP1 and UMAP2 for 2D plotting")

    fig, ax = plt.subplots(figsize=figsize)
    if color_by is None:
        color_by = np.arange(len(umap_df))
        cmap = 'viridis'
    else:
        # align series
        if isinstance(color_by, pd.Series):
            color_by = color_by.reindex(umap_df.index).values
        else:
            color_by = np.asarray(color_by)
    sc = ax.scatter(umap_df['UMAP1'], umap_df['UMAP2'], c=color_by, cmap=cmap, s=s, alpha=0.9, linewidths=0)
    cb = fig.colorbar(sc, ax=ax)
    cb.ax.tick_params(labelsize=8)
    ax.set_xlabel('UMAP1')
    ax.set_ylabel('UMAP2')
    if title:
        ax.set_title(title)
    else:
        ax.set_title('UMAP embedding (2D)')
    plt.tight_layout()
    return fig


def save_embedding_and_plots(umap_df, rolling_metrics=None, out_dir="pca_data"):
    #Save embedding CSV and three plots:
       # - UMAP colored by time
       # - UMAP colored by PC1_var
       # - UMAP colored by eff_dim 

    os.makedirs(out_dir, exist_ok=True)
    emb_path = os.path.join(out_dir, "umap_embedding.csv")
    umap_df.to_csv(emb_path)

    # plot colored by time
    fig_time = plot_umap_colored(umap_df, color_by=None, cmap='viridis', title='UMAP colored by time')
    fig_time.savefig(os.path.join(out_dir, "umap_by_time.png"), dpi=300, bbox_inches='tight')
    plt.close(fig_time)

    if rolling_metrics is not None:
        # align metrics to embedding
        metrics = rolling_metrics.reindex(umap_df.index)
        if 'PC1_var' in metrics.columns:
            fig_p1 = plot_umap_colored(umap_df, color_by=metrics['PC1_var'], cmap='inferno', title='UMAP colored by PC1 variance')
            fig_p1.savefig(os.path.join(out_dir, "umap_by_pc1_var.png"), dpi=300, bbox_inches='tight')
            plt.close(fig_p1)
        if 'eff_dim' in metrics.columns:
            fig_eff = plot_umap_colored(umap_df, color_by=metrics['eff_dim'], cmap='plasma', title='UMAP colored by effective dimension')
            fig_eff.savefig(os.path.join(out_dir, "umap_by_eff_dim.png"), dpi=300, bbox_inches='tight')
            plt.close(fig_eff)

    return emb_path


if __name__ == "__main__":

    base_dir = "pca_data"
    comps_path = os.path.join(base_dir, "pca_components.csv")
    metrics_path = os.path.join(base_dir, "rolling_pca_metrics.csv")
    if not os.path.exists(comps_path):
        comps_path = "pca_components.csv"
    if not os.path.exists(metrics_path):
        metrics_path = "pca_data/rolling_pca_metrics.csv" if os.path.exists("pca_data/rolling_pca_metrics.csv") else "rolling_pca_metrics.csv"

    if not os.path.exists(comps_path):
        raise SystemExit(f"pca components file not found: {comps_path}")

    pca_comps = pd.read_csv(comps_path, index_col=0, parse_dates=True)
    rolling_metrics = pd.read_csv(metrics_path, index_col=0, parse_dates=True) if os.path.exists(metrics_path) else None

    umap_df = run_umap(pca_comps, pcs=5, n_components=2, n_neighbors=30, min_dist=0.1, random_state=42)
    out = save_embedding_and_plots(umap_df, rolling_metrics=rolling_metrics, out_dir=base_dir)
    print(f"Saved UMAP embedding -> {out} and plots in {base_dir}/")