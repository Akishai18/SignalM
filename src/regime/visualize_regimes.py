# Visualizations for clustering regime results
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import os
from typing import Dict, Optional, List
from sklearn.metrics import confusion_matrix
import seaborn as sns

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


def plot_prediction_timeline(
    predictions_df: pd.DataFrame,
    actual_regimes: pd.Series,
    model_name: str = "Model",
    regime_label_map: Optional[Dict] = None,
    figsize: tuple = (16, 6),
    highlight_errors: bool = True
):
    """Plot predicted vs actual regime timeline.

    Args:
        predictions_df: DataFrame with 'predicted_regime' column (from accuracy results)
        actual_regimes: Series with actual regime labels (aligned with predictions_df)
        model_name: Name of model for title
        regime_label_map: Optional {regime_id: label} mapping
        figsize: Figure size
        highlight_errors: Whether to highlight prediction errors

    Returns:
        matplotlib figure
    """
    fig, ax = plt.subplots(figsize=figsize)

    # Align data
    common_idx = predictions_df.index.intersection(actual_regimes.index)
    pred = predictions_df.loc[common_idx, 'predicted_regime'].astype(int)
    actual = actual_regimes.loc[common_idx].astype(int)

    # Reset index to avoid Series comparison issues
    pred = pd.Series(pred.values, index=common_idx)
    actual = pd.Series(actual.values, index=common_idx)

    # Get unique regimes for coloring
    all_regimes = sorted(set(list(actual.unique()) + list(pred.unique())))
    n_regimes = len(all_regimes)
    colors = plt.cm.Set3(np.linspace(0, 1, max(n_regimes, 12)))[:n_regimes]
    regime_colors = {r: colors[i] for i, r in enumerate(all_regimes)}

    # Plot actual regime as filled background
    for regime in all_regimes:
        mask = actual == regime
        if mask.sum() > 0:
            label_str = f"Actual: Regime {regime}"
            if regime_label_map and regime in regime_label_map:
                label_str = f"Actual: {regime_label_map[regime]}"
            ax.fill_between(
                common_idx, 0, 1,
                where=mask,
                color=regime_colors[regime],
                alpha=0.3,
                label=label_str,
                transform=ax.get_xaxis_transform()
            )

    # Plot predicted regime as markers
    for regime in all_regimes:
        mask = pred == regime
        if mask.sum() > 0:
            label_str = f"Predicted: Regime {regime}"
            if regime_label_map and regime in regime_label_map:
                label_str = f"Predicted: {regime_label_map[regime]}"
            ax.scatter(
                common_idx[mask],
                [regime] * mask.sum(),
                c=[regime_colors[regime]],
                marker='o',
                s=30,
                alpha=0.8,
                edgecolors='black',
                linewidths=0.5,
                label=label_str,
                zorder=3
            )

    # Highlight prediction errors
    if highlight_errors:
        errors = pred != actual
        if errors.sum() > 0:
            ax.scatter(
                common_idx[errors],
                pred[errors],
                marker='x',
                s=100,
                c='red',
                linewidths=2,
                label=f'Errors ({errors.sum()})',
                zorder=4
            )

    ax.set_xlabel('Date', fontsize=12)
    ax.set_ylabel('Regime', fontsize=12)
    ax.set_yticks(all_regimes)
    if regime_label_map:
        ax.set_yticklabels([regime_label_map.get(r, f"R{r}") for r in all_regimes])

    accuracy = (pred == actual).mean()
    ax.set_title(f'{model_name} - Predicted vs Actual Regimes (Accuracy: {accuracy:.2%})',
                 fontsize=14, fontweight='bold')
    ax.legend(loc='upper left', bbox_to_anchor=(1.02, 1), fontsize=9)
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    return fig


def plot_prediction_confusion_matrix(
    predictions: np.ndarray,
    actuals: np.ndarray,
    model_name: str = "Model",
    regime_label_map: Optional[Dict] = None,
    figsize: tuple = (8, 7)
):
    """Plot confusion matrix for regime predictions.

    Args:
        predictions: Array of predicted regimes
        actuals: Array of actual regimes
        model_name: Name of model for title
        regime_label_map: Optional {regime_id: label} mapping
        figsize: Figure size

    Returns:
        matplotlib figure
    """
    fig, ax = plt.subplots(figsize=figsize)

    # Get unique regimes (sorted)
    all_regimes = sorted(set(list(actuals) + list(predictions)))

    # Compute confusion matrix
    cm = confusion_matrix(actuals, predictions, labels=all_regimes)

    # Normalize by row (actual regime) to get % of each regime predicted correctly
    cm_pct = cm.astype('float') / cm.sum(axis=1, keepdims=True) * 100

    # Create labels
    if regime_label_map:
        labels = [regime_label_map.get(r, f"R{r}") for r in all_regimes]
    else:
        labels = [f"R{r}" for r in all_regimes]

    # Plot heatmap
    sns.heatmap(
        cm_pct,
        annot=True,
        fmt='.1f',
        cmap='Blues',
        xticklabels=labels,
        yticklabels=labels,
        cbar_kws={'label': 'Percentage (%)'},
        ax=ax,
        vmin=0,
        vmax=100
    )

    ax.set_xlabel('Predicted Regime', fontsize=12, fontweight='bold')
    ax.set_ylabel('Actual Regime', fontsize=12, fontweight='bold')

    accuracy = np.diag(cm).sum() / cm.sum()
    ax.set_title(f'{model_name} - Confusion Matrix (Accuracy: {accuracy:.2%})',
                 fontsize=14, fontweight='bold')

    plt.tight_layout()
    return fig


def plot_forecast_probabilities(
    forecast_dict: Dict,
    horizons: List[int],
    regime_label_map: Optional[Dict] = None,
    figsize: tuple = (14, 5)
):
    """Plot regime probability forecasts across multiple horizons.

    Args:
        forecast_dict: {horizon: {'random_forest': {...}, 'xgboost': {...}}}
                       from predict_future_regimes()
        horizons: List of horizons to plot
        regime_label_map: Optional {regime_id: label} mapping
        figsize: Figure size

    Returns:
        matplotlib figure
    """
    n_horizons = len(horizons)
    fig, axes = plt.subplots(1, n_horizons, figsize=figsize, sharey=True)

    if n_horizons == 1:
        axes = [axes]

    # Get all regimes across all forecasts
    all_regimes = set()
    for h in horizons:
        if h in forecast_dict:
            for model_key, pred_data in forecast_dict[h].items():
                if 'probabilities' in pred_data:
                    all_regimes.update(pred_data['probabilities'].keys())
    all_regimes = sorted(all_regimes)

    # Color map
    n_regimes = len(all_regimes)
    colors = plt.cm.Set3(np.linspace(0, 1, max(n_regimes, 12)))[:n_regimes]
    regime_colors = {r: colors[i] for i, r in enumerate(all_regimes)}

    for idx, h in enumerate(horizons):
        ax = axes[idx]

        if h not in forecast_dict:
            ax.text(0.5, 0.5, f'No forecast\nfor {h}d',
                   ha='center', va='center', transform=ax.transAxes)
            ax.set_title(f'{h}-Day Ahead')
            continue

        # Collect probabilities for each model
        model_data = []
        for model_key in ['random_forest', 'xgboost']:
            if model_key in forecast_dict[h]:
                pred = forecast_dict[h][model_key]
                if 'probabilities' in pred:
                    model_name = "RF" if model_key == "random_forest" else "XGB"
                    model_data.append((model_name, pred['probabilities']))

        if not model_data:
            ax.text(0.5, 0.5, 'No data', ha='center', va='center', transform=ax.transAxes)
            ax.set_title(f'{h}-Day Ahead')
            continue

        # Plot grouped bars
        x = np.arange(len(all_regimes))
        width = 0.35

        for i, (model_name, probs) in enumerate(model_data):
            prob_values = [probs.get(r, 0) for r in all_regimes]
            offset = (i - 0.5) * width
            bars = ax.bar(x + offset, prob_values, width,
                         label=model_name, alpha=0.7)

            # Color bars by regime
            for bar, regime in zip(bars, all_regimes):
                bar.set_color(regime_colors[regime])

        # Labels
        if regime_label_map:
            labels = [regime_label_map.get(r, f"R{r}") for r in all_regimes]
        else:
            labels = [f"R{r}" for r in all_regimes]

        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha='right')
        ax.set_ylabel('Probability' if idx == 0 else '')
        ax.set_title(f'{h}-Day Ahead', fontweight='bold')
        ax.set_ylim(0, 1.0)
        ax.grid(True, alpha=0.3, axis='y')
        ax.legend(fontsize=9)

    fig.suptitle('Regime Forecast Probabilities by Horizon',
                 fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    return fig


def plot_confidence_over_time(
    predictions_df: pd.DataFrame,
    model_name: str = "Model",
    figsize: tuple = (16, 5),
    threshold: float = 0.5
):
    """Plot prediction confidence scores over time.

    Low confidence periods indicate model uncertainty and potential regime transitions.

    Args:
        predictions_df: DataFrame with 'confidence' column (from accuracy results)
        model_name: Name of model for title
        figsize: Figure size
        threshold: Confidence threshold to highlight (default 0.5)

    Returns:
        matplotlib figure
    """
    fig, ax = plt.subplots(figsize=figsize)

    dates = predictions_df.index
    confidence = predictions_df['confidence']

    # Plot confidence as line
    ax.plot(dates, confidence, color='steelblue', linewidth=1.5, label='Confidence')

    # Fill below threshold
    ax.fill_between(dates, 0, confidence,
                     where=(confidence < threshold),
                     color='orange', alpha=0.3,
                     label=f'Low Confidence (<{threshold:.0%})')

    # Add threshold line
    ax.axhline(threshold, color='red', linestyle='--', linewidth=1,
               label=f'Threshold ({threshold:.0%})')

    # Add horizontal mean line
    mean_conf = confidence.mean()
    ax.axhline(mean_conf, color='green', linestyle=':', linewidth=1.5,
               label=f'Mean ({mean_conf:.2%})')

    ax.set_xlabel('Date', fontsize=12)
    ax.set_ylabel('Prediction Confidence', fontsize=12)
    ax.set_title(f'{model_name} - Prediction Confidence Over Time',
                 fontsize=14, fontweight='bold')
    ax.set_ylim(0, 1.05)
    ax.legend(loc='best', fontsize=10)
    ax.grid(True, alpha=0.3)

    # Add annotation for low confidence periods
    low_conf_pct = (confidence < threshold).mean()
    ax.text(0.02, 0.98, f'Low confidence periods: {low_conf_pct:.1%} of time',
            transform=ax.transAxes, fontsize=10,
            verticalalignment='top',
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

    plt.tight_layout()
    return fig
