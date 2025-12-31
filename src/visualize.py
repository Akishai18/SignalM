import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

# Set style for better-looking plots
try:
    plt.style.use('seaborn-v0_8-darkgrid')
except OSError:
    try:
        plt.style.use('seaborn-darkgrid')
    except OSError:
        plt.style.use('ggplot')
sns.set_palette("husl")


def plot_histogram_returns(log_returns, symbol=None, bins=50, figsize=(12, 6)):
    # 1️⃣ Histogram of returns
    # Visualizes the empirical distribution of log returns.
    # Shows: shape, symmetry, fat tails, outliers
    fig, ax = plt.subplots(figsize=figsize)
    
    if symbol is not None and symbol in log_returns.columns:
        # Plot specific symbol
        returns = log_returns[symbol].dropna()
        title = f"Histogram of Returns: {symbol}"
    else:
        # Plot all returns pooled
        returns = log_returns.values.flatten()
        returns = returns[~np.isnan(returns)]
        title = "Histogram of Returns (All Symbols Pooled)"
    
    # Plot histogram
    ax.hist(returns, bins=bins, density=True, alpha=0.7, edgecolor='black', label='Empirical Distribution')
    
    # Overlay normal distribution for comparison
    mu, sigma = returns.mean(), returns.std()
    x = np.linspace(returns.min(), returns.max(), 100)
    normal_dist = stats.norm.pdf(x, mu, sigma)
    ax.plot(x, normal_dist, 'r-', linewidth=2, label=f'Normal(μ={mu:.4f}, σ={sigma:.4f})')
    
    ax.set_xlabel('Log Returns', fontsize=12)
    ax.set_ylabel('Density', fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    # Add statistics text
    stats_text = f'Mean: {mu:.6f}\nStd: {sigma:.6f}\nSkew: {stats.skew(returns):.4f}\nKurtosis: {stats.kurtosis(returns):.4f}'
    ax.text(0.02, 0.98, stats_text, transform=ax.transAxes, 
            verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    return fig


def plot_kde_returns(log_returns, symbol=None, figsize=(12, 6)):
    # KDE (Kernel Density Estimate)
    # Smoothed version of histogram, easier to compare vs normal distribution.
    # Makes fat tails and skewness more obvious.
    fig, ax = plt.subplots(figsize=figsize)
    
    if symbol is not None and symbol in log_returns.columns:
        returns = log_returns[symbol].dropna()
        title = f"KDE of Returns: {symbol}"
    else:
        returns = log_returns.values.flatten()
        returns = returns[~np.isnan(returns)]
        title = "KDE of Returns (All Symbols Pooled)"
    
    # Plot KDE
    sns.kdeplot(data=returns, ax=ax, label='Empirical KDE', linewidth=2)
    
    # Overlay normal distribution
    mu, sigma = returns.mean(), returns.std()
    x = np.linspace(returns.min(), returns.max(), 100)
    normal_dist = stats.norm.pdf(x, mu, sigma)
    ax.plot(x, normal_dist, 'r--', linewidth=2, label=f'Normal(μ={mu:.4f}, σ={sigma:.4f})')
    
    ax.set_xlabel('Log Returns', fontsize=12)
    ax.set_ylabel('Density', fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    return fig


def plot_qq_returns(log_returns, symbol=None, figsize=(10, 10)):
    # Q-Q Plot (Quantile-Quantile plot)
    # Compares empirical quantiles vs theoretical normal quantiles.
    # If points lie on straight line → close to normal.
    # Curvature in tails → fat tails
    fig, ax = plt.subplots(figsize=figsize)
    
    if symbol is not None and symbol in log_returns.columns:
        returns = log_returns[symbol].dropna()
        title = f"Q-Q Plot: {symbol}"
    else:
        returns = log_returns.values.flatten()
        returns = returns[~np.isnan(returns)]
        title = "Q-Q Plot (All Symbols Pooled)"
    
    # Create Q-Q plot
    stats.probplot(returns, dist="norm", plot=ax)
    
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    
    # Add reference line
    ax.plot([ax.get_xlim()[0], ax.get_xlim()[1]], 
            [ax.get_ylim()[0], ax.get_ylim()[1]], 
            'r--', linewidth=1, alpha=0.5, label='Perfect Normal')
    ax.legend()
    
    plt.tight_layout()
    return fig


def plot_cross_sectional_distributions(log_returns, mean_returns=None, volatility=None, 
                                       skewness=None, kurtosis=None, figsize=(15, 10)):
    # Distribution of Summary Statistics (Cross-Sectional)
    # Plots distributions of mean returns, volatility, skewness, kurtosis across all symbols.
    # Helps identify: structural differences, outliers, patterns.

    # Compute statistics if not provided
    if mean_returns is None:
        mean_returns = log_returns.mean()
    if volatility is None:
        volatility = log_returns.std()
    if skewness is None:
        skewness = log_returns.skew()
    if kurtosis is None:
        kurtosis = log_returns.kurt()
    
    fig, axes = plt.subplots(2, 2, figsize=figsize)
    fig.suptitle('Cross-Sectional Distribution of Summary Statistics', fontsize=16, fontweight='bold')
    
    # Plot 1: Mean Returns
    axes[0, 0].hist(mean_returns, bins=50, edgecolor='black', alpha=0.7)
    axes[0, 0].axvline(mean_returns.mean(), color='r', linestyle='--', linewidth=2, label=f'Mean: {mean_returns.mean():.6f}')
    axes[0, 0].set_xlabel('Mean Return', fontsize=11)
    axes[0, 0].set_ylabel('Frequency', fontsize=11)
    axes[0, 0].set_title('Distribution of Mean Returns', fontsize=12, fontweight='bold')
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)
    
    # Plot 2: Volatility
    axes[0, 1].hist(volatility, bins=50, edgecolor='black', alpha=0.7, color='orange')
    axes[0, 1].axvline(volatility.mean(), color='r', linestyle='--', linewidth=2, label=f'Mean: {volatility.mean():.6f}')
    axes[0, 1].set_xlabel('Volatility (Std Dev)', fontsize=11)
    axes[0, 1].set_ylabel('Frequency', fontsize=11)
    axes[0, 1].set_title('Distribution of Volatility', fontsize=12, fontweight='bold')
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)
    
    # Plot 3: Skewness
    axes[1, 0].hist(skewness, bins=50, edgecolor='black', alpha=0.7, color='green')
    axes[1, 0].axvline(skewness.mean(), color='r', linestyle='--', linewidth=2, label=f'Mean: {skewness.mean():.4f}')
    axes[1, 0].axvline(0, color='k', linestyle=':', linewidth=1, label='Symmetric (0)')
    axes[1, 0].set_xlabel('Skewness', fontsize=11)
    axes[1, 0].set_ylabel('Frequency', fontsize=11)
    axes[1, 0].set_title('Distribution of Skewness', fontsize=12, fontweight='bold')
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)
    
    # Plot 4: Kurtosis
    axes[1, 1].hist(kurtosis, bins=50, edgecolor='black', alpha=0.7, color='purple')
    axes[1, 1].axvline(kurtosis.mean(), color='r', linestyle='--', linewidth=2, label=f'Mean: {kurtosis.mean():.4f}')
    axes[1, 1].axvline(0, color='k', linestyle=':', linewidth=1, label='Normal (0)')
    axes[1, 1].set_xlabel('Kurtosis', fontsize=11)
    axes[1, 1].set_ylabel('Frequency', fontsize=11)
    axes[1, 1].set_title('Distribution of Kurtosis', fontsize=12, fontweight='bold')
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    return fig


def plot_time_variation_diagnostics(log_returns, window=252, symbol=None, figsize=(15, 10)):
    # Time-Variation Diagnostics
    # Plots rolling volatility and distribution of returns in different periods.
    # Reveals: volatility clustering, regime-like behavior (calm vs turbulent).
    fig, axes = plt.subplots(2, 2, figsize=figsize)
    fig.suptitle('Time-Variation Diagnostics', fontsize=16, fontweight='bold')
    
    if symbol is not None and symbol in log_returns.columns:
        returns = log_returns[symbol]
        title_suffix = f": {symbol}"
    else:
        # Use mean return across all symbols
        returns = log_returns.mean(axis=1)
        title_suffix = " (Mean Across All Symbols)"
    
    # Plot 1: Rolling Volatility
    rolling_vol = returns.rolling(window=window).std() * np.sqrt(252)  # Annualized
    axes[0, 0].plot(rolling_vol.index, rolling_vol.values, linewidth=1.5)
    axes[0, 0].axhline(rolling_vol.mean(), color='r', linestyle='--', 
                       label=f'Mean: {rolling_vol.mean():.4f}')
    axes[0, 0].set_xlabel('Date', fontsize=11)
    axes[0, 0].set_ylabel('Rolling Volatility (Annualized)', fontsize=11)
    axes[0, 0].set_title(f'Rolling Volatility (Window={window}){title_suffix}', fontsize=12, fontweight='bold')
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)
    axes[0, 0].tick_params(axis='x', rotation=45)
    
    # Plot 2: Returns Over Time
    axes[0, 1].plot(returns.index, returns.values, alpha=0.6, linewidth=0.5)
    axes[0, 1].axhline(0, color='k', linestyle='-', linewidth=1)
    axes[0, 1].axhline(returns.mean(), color='r', linestyle='--', 
                       label=f'Mean: {returns.mean():.6f}')
    axes[0, 1].set_xlabel('Date', fontsize=11)
    axes[0, 1].set_ylabel('Log Returns', fontsize=11)
    axes[0, 1].set_title(f'Returns Over Time{title_suffix}', fontsize=12, fontweight='bold')
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)
    axes[0, 1].tick_params(axis='x', rotation=45)
    
    # Plot 3: Distribution by Period (Split into halves)
    mid_point = len(returns) // 2
    first_half = returns.iloc[:mid_point].dropna()
    second_half = returns.iloc[mid_point:].dropna()
    
    axes[1, 0].hist(first_half, bins=50, alpha=0.6, label=f'First Half (n={len(first_half)})', 
                    edgecolor='black', density=True)
    axes[1, 0].hist(second_half, bins=50, alpha=0.6, label=f'Second Half (n={len(second_half)})', 
                    edgecolor='black', density=True)
    axes[1, 0].set_xlabel('Log Returns', fontsize=11)
    axes[1, 0].set_ylabel('Density', fontsize=11)
    axes[1, 0].set_title('Distribution Comparison: First vs Second Half', fontsize=12, fontweight='bold')
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)
    
    # Plot 4: Rolling Mean Return
    rolling_mean = returns.rolling(window=window).mean()
    axes[1, 1].plot(rolling_mean.index, rolling_mean.values, linewidth=1.5, color='green')
    axes[1, 1].axhline(returns.mean(), color='r', linestyle='--', 
                       label=f'Overall Mean: {returns.mean():.6f}')
    axes[1, 1].axhline(0, color='k', linestyle=':', linewidth=1)
    axes[1, 1].set_xlabel('Date', fontsize=11)
    axes[1, 1].set_ylabel('Rolling Mean Return', fontsize=11)
    axes[1, 1].set_title(f'Rolling Mean Return (Window={window}){title_suffix}', fontsize=12, fontweight='bold')
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3)
    axes[1, 1].tick_params(axis='x', rotation=45)
    
    plt.tight_layout()
    return fig


def plot_all_distributions(log_returns, mean_returns=None, volatility=None, 
                           skewness=None, kurtosis=None, symbol=None, 
                           save_dir=None, figsize_dict=None):
    # Convenience function to generate all 5 distribution plots.
    if figsize_dict is None:
        figsize_dict = {
            'histogram': (12, 6),
            'kde': (12, 6),
            'qq': (10, 10),
            'cross_sectional': (15, 10),
            'time_variation': (15, 10)
        }
    
    print("\n" + "="*50)
    print("Generating Distribution Plots...")
    print("="*50)
    
    # Compute statistics if not provided (needed for cross-sectional plot)
    if mean_returns is None:
        mean_returns = log_returns.mean()
    if volatility is None:
        volatility = log_returns.std()
    if skewness is None:
        skewness = log_returns.skew()
    if kurtosis is None:
        kurtosis = log_returns.kurt()
    
    # Generate all plots
    print("\n1️⃣ Generating Histogram...")
    fig1 = plot_histogram_returns(log_returns, symbol=symbol, figsize=figsize_dict['histogram'])
    if save_dir:
        fig1.savefig(f"{save_dir}/1_histogram_returns.png", dpi=300, bbox_inches='tight')
        plt.close(fig1)
    
    print("2️⃣ Generating KDE Plot...")
    fig2 = plot_kde_returns(log_returns, symbol=symbol, figsize=figsize_dict['kde'])
    if save_dir:
        fig2.savefig(f"{save_dir}/2_kde_returns.png", dpi=300, bbox_inches='tight')
        plt.close(fig2)
    
    print("3️⃣ Generating Q-Q Plot...")
    fig3 = plot_qq_returns(log_returns, symbol=symbol, figsize=figsize_dict['qq'])
    if save_dir:
        fig3.savefig(f"{save_dir}/3_qq_plot.png", dpi=300, bbox_inches='tight')
        plt.close(fig3)
    
    print("4️⃣ Generating Cross-Sectional Distributions...")
    fig4 = plot_cross_sectional_distributions(log_returns, mean_returns, volatility, 
                                               skewness, kurtosis, figsize=figsize_dict['cross_sectional'])
    if save_dir:
        fig4.savefig(f"{save_dir}/4_cross_sectional_distributions.png", dpi=300, bbox_inches='tight')
        plt.close(fig4)
    
    print("5️⃣ Generating Time-Variation Diagnostics...")
    fig5 = plot_time_variation_diagnostics(log_returns, symbol=symbol, figsize=figsize_dict['time_variation'])
    if save_dir:
        fig5.savefig(f"{save_dir}/5_time_variation_diagnostics.png", dpi=300, bbox_inches='tight')
        plt.close(fig5)
    
    if not save_dir:
        print("\nAll plots generated! Close the plot windows to continue.")
        plt.show()
    else:
        print(f"\nAll plots saved to {save_dir}/")
    
    return fig1, fig2, fig3, fig4, fig5


def plot_rolling_volatility_cluster(price_matrix, rolling_vol_stats, symbol=None, 
                                     window=21, vol_threshold=0.20, figsize=(15, 10)):
    # Visualization A: The Volatility Cluster
    # Plot: Price on top panel
    # Plot: Rolling Volatility on bottom panel
    # Highlight: Areas where Volatility > threshold (High Volatility Regimes)
    fig, axes = plt.subplots(2, 1, figsize=figsize, sharex=True)
    fig.suptitle('Volatility Cluster Analysis', fontsize=16, fontweight='bold')
    
    if symbol is not None and symbol in price_matrix.columns:
        prices = price_matrix[symbol]
        vol_col = f"{symbol}_vol_{window}"
        title_suffix = f": {symbol}"
        if vol_col not in rolling_vol_stats.columns:
            raise ValueError(f"Volatility column {vol_col} not found")
        volatility = rolling_vol_stats[vol_col]
    else:
        # Use market average (mean price and mean volatility)
        prices = price_matrix.mean(axis=1)
        # For volatility, average across all symbols for this window
        # Use skipna=True (default but explicit) to handle NaN values properly
        vol_cols = [col for col in rolling_vol_stats.columns if f"_vol_{window}" in col]
        if len(vol_cols) > 0:
            volatility = rolling_vol_stats[vol_cols].mean(axis=1, skipna=True)
        else:
            raise ValueError(f"No volatility columns found for window={window}")
        title_suffix = " (Market Average)"
    
    # Align indices
    common_idx = prices.index.intersection(volatility.index)
    prices = prices.loc[common_idx]
    volatility = volatility.loc[common_idx]
    
    # Plot 1: Price
    axes[0].plot(prices.index, prices.values, linewidth=1.5, color='black')
    axes[0].set_ylabel('Price', fontsize=12)
    axes[0].set_title(f'Price{title_suffix}', fontsize=13, fontweight='bold')
    axes[0].grid(True, alpha=0.3)
    
    # Plot 2: Rolling Volatility
    axes[1].plot(volatility.index, volatility.values, linewidth=1.5, color='blue', label=f'{window}-Day Rolling Volatility')
    axes[1].axhline(vol_threshold, color='red', linestyle='--', linewidth=2, 
                    label=f'High Vol Threshold ({vol_threshold*100:.0f}%)')
    
    # Highlight high volatility regions
    high_vol_mask = volatility > vol_threshold
    axes[1].fill_between(volatility.index, 0, volatility.values, 
                         where=high_vol_mask, alpha=0.3, color='red', label='High Volatility Regime')
    
    axes[1].set_xlabel('Date', fontsize=12)
    axes[1].set_ylabel('Volatility (Annualized)', fontsize=12)
    axes[1].set_title(f'Rolling Volatility (Window={window}){title_suffix}', fontsize=13, fontweight='bold')
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)
    
    # Add statistics
    stats_text = f'Mean Vol: {volatility.mean():.4f}\nMax Vol: {volatility.max():.4f}\nHigh Vol Days: {high_vol_mask.sum()}'
    axes[1].text(0.02, 0.98, stats_text, transform=axes[1].transAxes,
                verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    return fig


def plot_correlation_spike(rolling_corr_df, windows=[21, 63, 252], figsize=(14, 8)):
    # Visualization B: The Correlation Spike
    # Plot: Average correlation of assets over time for multiple windows
    # Insight: Spikes indicate market stress (diversification fails)
    fig, ax = plt.subplots(figsize=figsize)
    
    colors = ['blue', 'green', 'orange', 'red', 'purple']
    
    # Plot correlation for each window
    for i, window in enumerate(windows):
        col_name = f'avg_pairwise_corr_{window}'
        if col_name in rolling_corr_df.columns:
            corr_series = rolling_corr_df[col_name]
            ax.plot(corr_series.index, corr_series.values, linewidth=1.5, 
                   color=colors[i % len(colors)], label=f'Window={window} days', alpha=0.8)
            
            # Add mean line for the longest window
            if window == max(windows):
                mean_corr = corr_series.mean()
                ax.axhline(mean_corr, color=colors[i % len(colors)], linestyle='--', 
                          linewidth=1.5, alpha=0.5, label=f'Mean (w={window}): {mean_corr:.3f}')
    
    # Highlight high correlation regions (>0.7 typically indicates stress)
    high_corr_threshold = 0.7
    ax.axhline(high_corr_threshold, color='orange', linestyle=':', linewidth=2, 
               label=f'Stress Threshold ({high_corr_threshold})', alpha=0.7)
    
    # Fill area above threshold (use the longest window for this)
    longest_window = max(windows)
    longest_col = f'avg_pairwise_corr_{longest_window}'
    if longest_col in rolling_corr_df.columns:
        corr_series = rolling_corr_df[longest_col]
        high_corr_mask = corr_series > high_corr_threshold
        ax.fill_between(corr_series.index, high_corr_threshold, corr_series.values,
                       where=high_corr_mask, alpha=0.2, color='red', label='High Correlation (Stress)')
    
    ax.set_xlabel('Date', fontsize=12)
    ax.set_ylabel('Average Pairwise Correlation', fontsize=12)
    ax.set_title('Rolling Average Pairwise Correlation (Market Interconnectedness)', 
                fontsize=14, fontweight='bold')
    ax.set_ylim([0, 1])
    ax.legend(loc='best')
    ax.grid(True, alpha=0.3)
    
    # Add statistics for longest window
    if longest_col in rolling_corr_df.columns:
        corr_series = rolling_corr_df[longest_col]
        mean_corr = corr_series.mean()
        high_corr_mask = corr_series > high_corr_threshold
        stats_text = f'Window {longest_window}:\nMean: {mean_corr:.3f}\nMax: {corr_series.max():.3f}\nMin: {corr_series.min():.3f}\nHigh Corr Days: {high_corr_mask.sum()}'
        ax.text(0.02, 0.98, stats_text, transform=ax.transAxes,
               verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    return fig


def plot_rolling_statistics_overview(rolling_stats, symbol=None, windows=[21, 63, 252], figsize=(16, 16)):
    # Plot comprehensive overview of all rolling statistics including correlation.
    # Create 4 subplots: volatility, skewness, kurtosis, correlation
    fig, axes = plt.subplots(4, 1, figsize=figsize, sharex=True)
    fig.suptitle(f'Rolling Statistics Overview{" - " + symbol if symbol else ""}', 
                 fontsize=16, fontweight='bold')
    
    colors = ['blue', 'green', 'orange', 'red', 'purple']
    
    # Plot Volatility
    ax = axes[0]
    for i, window in enumerate(windows):
        if symbol:
            col = f"{symbol}_vol_{window}"
        else:
            # Use first available column for this window
            vol_cols = [c for c in rolling_stats['volatility'].columns if f"_vol_{window}" in c]
            if len(vol_cols) > 0:
                col = vol_cols[0]
            else:
                continue
        
        if col in rolling_stats['volatility'].columns:
            data = rolling_stats['volatility'][col]
            ax.plot(data.index, data.values, linewidth=1.5, color=colors[i % len(colors)],
                   label=f'Volatility (w={window})')
    
    ax.set_ylabel('Volatility (Annualized)', fontsize=12)
    ax.set_title('Rolling Volatility', fontsize=13, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    # Plot Skewness
    ax = axes[1]
    for i, window in enumerate(windows):
        if symbol:
            col = f"{symbol}_skew_{window}"
        else:
            skew_cols = [c for c in rolling_stats['skewness'].columns if f"_skew_{window}" in c]
            if len(skew_cols) > 0:
                col = skew_cols[0]
            else:
                continue
        
        if col in rolling_stats['skewness'].columns:
            data = rolling_stats['skewness'][col]
            ax.plot(data.index, data.values, linewidth=1.5, color=colors[i % len(colors)],
                   label=f'Skewness (w={window})')
    
    ax.axhline(0, color='black', linestyle=':', linewidth=1)
    ax.set_ylabel('Skewness', fontsize=12)
    ax.set_title('Rolling Skewness', fontsize=13, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    # Plot Kurtosis
    ax = axes[2]
    for i, window in enumerate(windows):
        if symbol:
            col = f"{symbol}_kurt_{window}"
        else:
            kurt_cols = [c for c in rolling_stats['kurtosis'].columns if f"_kurt_{window}" in c]
            if len(kurt_cols) > 0:
                col = kurt_cols[0]
            else:
                continue
        
        if col in rolling_stats['kurtosis'].columns:
            data = rolling_stats['kurtosis'][col]
            ax.plot(data.index, data.values, linewidth=1.5, color=colors[i % len(colors)],
                   label=f'Kurtosis (w={window})')
    
    ax.axhline(0, color='black', linestyle=':', linewidth=1, label='Normal (0)')
    ax.set_ylabel('Kurtosis', fontsize=12)
    ax.set_title('Rolling Kurtosis', fontsize=13, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    # Plot Correlation
    ax = axes[3]
    for i, window in enumerate(windows):
        col = f'avg_pairwise_corr_{window}'
        if col in rolling_stats['correlation'].columns:
            data = rolling_stats['correlation'][col]
            ax.plot(data.index, data.values, linewidth=1.5, color=colors[i % len(colors)],
                   label=f'Avg Correlation (w={window})', alpha=0.8)
    
    # Add stress threshold
    ax.axhline(0.7, color='orange', linestyle=':', linewidth=1, label='Stress Threshold (0.7)')
    ax.set_xlabel('Date', fontsize=12)
    ax.set_ylabel('Average Pairwise Correlation', fontsize=12)
    ax.set_title('Rolling Average Pairwise Correlation', fontsize=13, fontweight='bold')
    ax.set_ylim([0, 1])
    ax.legend()
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    return fig


def plot_correlation_heatmap(corr_df, figsize=(12, 10), cmap='RdBu_r', center=0.0, mask_upper=True):
    # Heatmap of correlation matrix. By default masks the upper triangle.
    fig, ax = plt.subplots(figsize=figsize)
    if mask_upper:
        mask = np.triu(np.ones_like(corr_df, dtype=bool))
    else:
        mask = None

    sns.heatmap(
        corr_df,
        mask=mask,
        cmap=cmap,
        center=center,
        vmax=1.0,
        vmin=-1.0,
        square=False,
        linewidths=0.25,
        cbar_kws={"shrink": 0.5},
        ax=ax
    )
    ax.set_title('Correlation Matrix of Returns', fontsize=14, fontweight='bold')
    plt.tight_layout()
    return fig


def plot_pca_variance(explained_variance_ratio, figsize=(8, 4)):
    """
    Bar: explained variance ratio per PC. Line: cumulative variance.
    Returns matplotlib Figure.
    """
    evr = np.asarray(explained_variance_ratio, dtype=float)
    cum = np.cumsum(evr)
    fig, ax = plt.subplots(figsize=figsize)
    ax.bar(np.arange(1, len(evr) + 1), evr, alpha=0.75, label='Explained variance ratio')
    ax.plot(np.arange(1, len(evr) + 1), cum, color='C1', marker='o', label='Cumulative variance')
    ax.set_xlabel('Principal Component')
    ax.set_ylabel('Explained variance')
    ax.set_title('PCA Explained Variance')
    ax.set_xticks(np.arange(1, len(evr) + 1))
    ax.grid(alpha=0.3)
    ax.legend()
    plt.tight_layout()
    return fig


def plot_pca_components_time_series(components_df, pcs=[1, 2, 3], figsize=(12, 5)):
    """
    Plot time series for PC1..PC3 (pcs is 1-based list).
    components_df: DataFrame indexed by date with columns like 'PC1','PC2',...
    Returns matplotlib Figure.
    """
    fig, ax = plt.subplots(figsize=figsize)
    for pc in pcs:
        col = f"PC{pc}"
        if col in components_df.columns:
            ax.plot(components_df.index, components_df[col], label=col, linewidth=1.2)
    ax.set_xlabel('Date')
    ax.set_ylabel('Component value')
    ax.set_title('PCA Components Time Series')
    ax.legend()
    ax.grid(alpha=0.25)
    plt.tight_layout()
    return fig

