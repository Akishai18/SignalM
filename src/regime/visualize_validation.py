# Visualization functions for cross-validation and out-of-sample validation
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from typing import Dict, Optional


def plot_train_test_regime_timeline(
    train_labels: pd.Series,
    test_labels: pd.Series,
    split_date: pd.Timestamp,
    regime_label_map: Optional[Dict] = None,
    save_path: Optional[str] = None,
    figsize=(16, 6)
):
    #Plot side-by-side regime timelines for train and test periods.
    
    if not isinstance(train_labels.index, pd.DatetimeIndex):
        train_labels.index = pd.to_datetime(train_labels.index)
    if not isinstance(test_labels.index, pd.DatetimeIndex):
        test_labels.index = pd.to_datetime(test_labels.index)
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=figsize, sharex=True)
    
    # Get unique regimes and color map
    all_regimes = sorted(set(train_labels.unique().tolist() + test_labels.unique().tolist()))
    colors = plt.cm.Set3(np.linspace(0, 1, len(all_regimes)))
    color_map = {regime: colors[i] for i, regime in enumerate(all_regimes)}
    
    # Plot train period
    for regime in all_regimes:
        mask = train_labels == regime
        if mask.any():
            train_dates = train_labels.index[mask]
            label = f"Regime {regime}"
            if regime_label_map and regime in regime_label_map:
                label = f"Regime {regime} ({regime_label_map[regime]})"
            ax1.scatter(train_dates, [regime] * len(train_dates), 
                       c=[color_map[regime]], label=label, s=10, alpha=0.6)
    
    ax1.axvline(split_date, color='red', linestyle='--', linewidth=2, alpha=0.7, label='Split Date')
    ax1.set_ylabel('Regime', fontsize=11)
    ax1.set_title('Training Period Regime Timeline', fontsize=12, fontweight='bold')
    ax1.legend(loc='upper left', fontsize=9, ncol=2)
    ax1.grid(True, alpha=0.3, axis='x')
    ax1.set_yticks(all_regimes)
    
    # Plot test period
    for regime in all_regimes:
        mask = test_labels == regime
        if mask.any():
            test_dates = test_labels.index[mask]
            label = f"Regime {regime}"
            if regime_label_map and regime in regime_label_map:
                label = f"Regime {regime} ({regime_label_map[regime]})"
            ax2.scatter(test_dates, [regime] * len(test_dates), 
                       c=[color_map[regime]], label=label, s=10, alpha=0.6)
    
    ax2.axvline(split_date, color='red', linestyle='--', linewidth=2, alpha=0.7, label='Split Date')
    ax2.set_ylabel('Regime', fontsize=11)
    ax2.set_xlabel('Date', fontsize=11)
    ax2.set_title('Test Period Regime Timeline', fontsize=12, fontweight='bold')
    ax2.legend(loc='upper left', fontsize=9, ncol=2)
    ax2.grid(True, alpha=0.3, axis='x')
    ax2.set_yticks(all_regimes)
    
    # Format x-axis
    for ax in [ax1, ax2]:
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.xaxis.set_major_locator(mdates.YearLocator())
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"✓ Train/test timeline plot saved to {save_path}")
    
    return fig


def plot_transition_matrix_comparison(
    train_transition_matrix: pd.DataFrame,
    test_transition_matrix: pd.DataFrame,
    regime_label_map: Optional[Dict] = None,
    save_path: Optional[str] = None,
    figsize=(16, 6)
):
    #Plot side-by-side comparison of train and test transition matrices.
    
    import seaborn as sns
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=figsize)
    
    # Format labels if available
    if regime_label_map:
        train_display = train_transition_matrix.copy()
        train_display.index = [f"{idx}\n({regime_label_map.get(idx, '')})" for idx in train_display.index]
        train_display.columns = [f"{idx}\n({regime_label_map.get(idx, '')})" for idx in train_display.columns]
        
        test_display = test_transition_matrix.copy()
        test_display.index = [f"{idx}\n({regime_label_map.get(idx, '')})" for idx in test_display.index]
        test_display.columns = [f"{idx}\n({regime_label_map.get(idx, '')})" for idx in test_display.columns]
    else:
        train_display = train_transition_matrix.copy()
        test_display = test_transition_matrix.copy()
    
    # Plot train transition matrix
    sns.heatmap(
        train_display,
        annot=True,
        fmt='.2f',
        cmap='YlOrRd',
        cbar_kws={'label': 'Transition Probability'},
        ax=ax1,
        vmin=0,
        vmax=1
    )
    ax1.set_title('Train Period Transition Matrix', fontsize=12, fontweight='bold')
    ax1.set_xlabel('TO Regime', fontsize=11)
    ax1.set_ylabel('FROM Regime', fontsize=11)
    
    # Plot test transition matrix
    sns.heatmap(
        test_display,
        annot=True,
        fmt='.2f',
        cmap='YlOrRd',
        cbar_kws={'label': 'Transition Probability'},
        ax=ax2,
        vmin=0,
        vmax=1
    )
    ax2.set_title('Test Period Transition Matrix', fontsize=12, fontweight='bold')
    ax2.set_xlabel('TO Regime', fontsize=11)
    ax2.set_ylabel('FROM Regime', fontsize=11)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"✓ Transition matrix comparison plot saved to {save_path}")
    
    return fig


def plot_regime_distribution_comparison(
    train_labels: pd.Series,
    test_labels: pd.Series,
    regime_label_map: Optional[Dict] = None,
    save_path: Optional[str] = None,
    figsize=(12, 6)
):
    #Plot comparison of regime distributions between train and test.
    
    # Compute distributions
    train_dist = train_labels.value_counts(normalize=True).sort_index()
    test_dist = test_labels.value_counts(normalize=True).sort_index()
    
    # Align regimes
    all_regimes = sorted(set(train_labels.unique().tolist() + test_labels.unique().tolist()))
    train_dist_aligned = pd.Series([train_dist.get(r, 0) for r in all_regimes], index=all_regimes)
    test_dist_aligned = pd.Series([test_dist.get(r, 0) for r in all_regimes], index=all_regimes)
    
    # Create labels
    if regime_label_map:
        labels = [f"{r}\n({regime_label_map.get(r, '')})" for r in all_regimes]
    else:
        labels = [str(r) for r in all_regimes]
    
    fig, ax = plt.subplots(figsize=figsize)
    
    x = np.arange(len(all_regimes))
    width = 0.35
    
    ax.bar(x - width/2, train_dist_aligned.values, width, label='Train Period', alpha=0.8, color='steelblue')
    ax.bar(x + width/2, test_dist_aligned.values, width, label='Test Period', alpha=0.8, color='coral')
    
    ax.set_xlabel('Regime', fontsize=11)
    ax.set_ylabel('Proportion', fontsize=11)
    ax.set_title('Regime Distribution Comparison (Train vs Test)', fontsize=12, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=45, ha='right')
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"✓ Regime distribution comparison plot saved to {save_path}")
    
    return fig
