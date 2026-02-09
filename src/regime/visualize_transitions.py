# Visualization functions for regime transitions
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib import dates as mdates
import seaborn as sns
from typing import Dict, Optional


def plot_transition_matrix(
    transition_matrix: pd.DataFrame,
    transition_counts: pd.DataFrame,
    regime_label_map: Optional[Dict] = None,
    save_path: Optional[str] = None,
    figsize=(10, 8)
):
    #Plot transition probability matrix as heatmap.
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    
    # Plot 1: Transition probabilities (heatmap)
    if regime_label_map:
        display_matrix = transition_matrix.copy()
        display_matrix.index = [f"{idx}\n({regime_label_map.get(idx, '')})" for idx in display_matrix.index]
        display_matrix.columns = [f"{idx}\n({regime_label_map.get(idx, '')})" for idx in display_matrix.columns]
    else:
        display_matrix = transition_matrix.copy()
    
    sns.heatmap(
        display_matrix,
        annot=True,
        fmt='.2f',
        cmap='YlOrRd',
        cbar_kws={'label': 'Transition Probability'},
        ax=ax1,
        vmin=0,
        vmax=1
    )
    ax1.set_title('Transition Probability Matrix\n(Rows = FROM, Columns = TO)', fontsize=12, fontweight='bold')
    ax1.set_xlabel('TO Regime', fontsize=11)
    ax1.set_ylabel('FROM Regime', fontsize=11)
    
    # Plot 2: Transition counts (raw numbers)
    if regime_label_map:
        display_counts = transition_counts.copy()
        display_counts.index = [f"{idx}\n({regime_label_map.get(idx, '')})" for idx in display_counts.index]
        display_counts.columns = [f"{idx}\n({regime_label_map.get(idx, '')})" for idx in display_counts.columns]
    else:
        display_counts = transition_counts.copy()
    
    sns.heatmap(
        display_counts,
        annot=True,
        fmt='d',
        cmap='Blues',
        cbar_kws={'label': 'Transition Count'},
        ax=ax2,
        vmin=0
    )
    ax2.set_title('Transition Counts (Raw Numbers)', fontsize=12, fontweight='bold')
    ax2.set_xlabel('TO Regime', fontsize=11)
    ax2.set_ylabel('FROM Regime', fontsize=11)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"✓ Transition matrix plot saved to {save_path}")
    
    return fig


def plot_regime_durations(
    duration_stats: Dict,
    regime_label_map: Optional[Dict] = None,
    save_path: Optional[str] = None,
    figsize=(12, 6)
):
    #Plot regime duration statistics (mean, median, min, max).
    
    regimes = sorted(duration_stats.keys())
    
    # Extract statistics
    means = [duration_stats[r]['mean_days'] for r in regimes]
    medians = [duration_stats[r]['median_days'] for r in regimes]
    mins = [duration_stats[r]['min_days'] for r in regimes]
    maxs = [duration_stats[r]['max_days'] for r in regimes]
    
    # Create labels
    if regime_label_map:
        labels = [f"{r}\n({regime_label_map.get(r, '')})" for r in regimes]
    else:
        labels = [str(r) for r in regimes]
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=figsize)
    
    # Plot 1: Bar chart of mean/median durations
    x = np.arange(len(regimes))
    width = 0.35
    
    ax1.bar(x - width/2, means, width, label='Mean', alpha=0.8, color='steelblue')
    ax1.bar(x + width/2, medians, width, label='Median', alpha=0.8, color='coral')
    ax1.set_xlabel('Regime', fontsize=11)
    ax1.set_ylabel('Duration (Days)', fontsize=11)
    ax1.set_title('Mean and Median Regime Durations', fontsize=12, fontweight='bold')
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, rotation=45, ha='right')
    ax1.legend()
    ax1.grid(True, alpha=0.3, axis='y')
    ax1.axhline(y=21, color='r', linestyle='--', alpha=0.5, label='1 Month Threshold')
    ax1.legend()
    
    # Plot 2: Min/Max range
    ax2.bar(x, maxs, alpha=0.6, color='lightgreen', label='Max Duration')
    ax2.bar(x, mins, alpha=0.8, color='lightcoral', label='Min Duration')
    ax2.set_xlabel('Regime', fontsize=11)
    ax2.set_ylabel('Duration (Days)', fontsize=11)
    ax2.set_title('Min and Max Regime Durations', fontsize=12, fontweight='bold')
    ax2.set_xticks(x)
    ax2.set_xticklabels(labels, rotation=45, ha='right')
    ax2.legend()
    ax2.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"✓ Duration statistics plot saved to {save_path}")
    
    return fig


def plot_transition_timeline(
    regime_labels: pd.Series,
    regime_label_map: Optional[Dict] = None,
    save_path: Optional[str] = None,
    figsize=(14, 6)
):
    #Plot timeline showing regime assignments and transition points.
    
    if isinstance(regime_labels, np.ndarray):
        regime_labels = pd.Series(regime_labels)
    
    if not isinstance(regime_labels.index, pd.DatetimeIndex):
        regime_labels.index = pd.to_datetime(regime_labels.index)
    
    fig, ax = plt.subplots(figsize=figsize)
    
    # Color map for regimes
    unique_regimes = sorted(regime_labels.unique())
    colors = plt.cm.Set3(np.linspace(0, 1, len(unique_regimes)))
    color_map = {regime: colors[i] for i, regime in enumerate(unique_regimes)}
    
    # Plot regime assignments as colored areas
    for i, regime in enumerate(regime_labels):
        if i == 0:
            continue
        prev_regime = regime_labels.iloc[i-1]
        if prev_regime != regime:
            # Transition point - mark with vertical line
            ax.axvline(regime_labels.index[i], color='black', linestyle='--', alpha=0.3, linewidth=0.5)
    
    # Plot regime timeline
    for regime in unique_regimes:
        mask = regime_labels == regime
        regime_dates = regime_labels.index[mask]
        if len(regime_dates) > 0:
            label = f"Regime {regime}"
            if regime_label_map and regime in regime_label_map:
                label = f"Regime {regime} ({regime_label_map[regime]})"
            ax.scatter(regime_dates, [regime] * len(regime_dates), 
                      c=[color_map[regime]], label=label, s=10, alpha=0.6)
    
    # Count transitions
    transitions = (regime_labels != regime_labels.shift()).sum() - 1
    ax.set_title(f'Regime Timeline with Transition Points\n(Total transitions: {transitions})', 
                fontsize=12, fontweight='bold')
    ax.set_xlabel('Date', fontsize=11)
    ax.set_ylabel('Regime', fontsize=11)
    ax.legend(loc='upper left', fontsize=9)
    ax.grid(True, alpha=0.3, axis='x')
    
    # Format x-axis
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
    ax.xaxis.set_major_locator(mdates.YearLocator())
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"✓ Transition timeline plot saved to {save_path}")
    
    return fig


def plot_transition_network(
    transition_matrix: pd.DataFrame,
    duration_stats: Dict,
    regime_label_map: Optional[Dict] = None,
    save_path: Optional[str] = None,
    figsize=(10, 8)
):
    #Plot transition network graph (nodes = regimes, edges = transitions).
    #Node size = average duration, edge width = transition probability
    
    try:
        import networkx as nx
    except ImportError:
        print("Warning: networkx not installed. Skipping network graph.")
        print("Install with: pip install networkx")
        return None
    
    G = nx.DiGraph()
    
    # Add nodes (regimes)
    for regime in transition_matrix.index:
        label = f"Regime {regime}"
        if regime_label_map and regime in regime_label_map:
            label = f"{regime}\n({regime_label_map[regime]})"
        G.add_node(regime, label=label)
    
    # Add edges (transitions) with weights
    for from_regime in transition_matrix.index:
        for to_regime in transition_matrix.columns:
            prob = transition_matrix.loc[from_regime, to_regime]
            if prob > 0.01:  # Only show transitions with >1% probability
                G.add_edge(from_regime, to_regime, weight=prob)
    
    # Layout
    pos = nx.spring_layout(G, k=2, iterations=50)
    
    fig, ax = plt.subplots(figsize=figsize)
    
    # Draw nodes (size based on average duration)
    node_sizes = []
    for regime in G.nodes():
        if regime in duration_stats:
            # Scale duration to node size (min 300, max 3000)
            duration = duration_stats[regime]['mean_days']
            node_size = 300 + (duration / 100) * 500  # Scale appropriately
            node_sizes.append(node_size)
        else:
            node_sizes.append(500)
    
    nx.draw_networkx_nodes(G, pos, node_size=node_sizes, 
                          node_color='lightblue', alpha=0.7, ax=ax)
    
    # Draw edges (width based on transition probability)
    edges = G.edges()
    edge_weights = [G[u][v]['weight'] for u, v in edges]
    edge_widths = [w * 5 for w in edge_weights]  # Scale for visibility
    
    nx.draw_networkx_edges(G, pos, width=edge_widths, alpha=0.6, 
                          edge_color='gray', arrows=True, arrowsize=20, ax=ax)
    
    # Draw labels
    labels = {node: G.nodes[node]['label'] for node in G.nodes()}
    nx.draw_networkx_labels(G, pos, labels, font_size=10, ax=ax)
    
    ax.set_title('Regime Transition Network\n(Node size = Avg Duration, Edge width = Transition Probability)', 
                fontsize=12, fontweight='bold')
    ax.axis('off')
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"✓ Transition network plot saved to {save_path}")
    
    return fig
