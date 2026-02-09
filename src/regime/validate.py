#Validate regimes against market reality
# Overlay regimes on VIX, drawdowns, and known events
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime

def compute_drawdowns(prices):
    
    #Compute drawdown series from price series.
    #Returns: drawdown (negative values = below peak), peak_date
    
    if isinstance(prices, pd.Series):
        prices = prices.copy()
    else:
        prices = pd.Series(prices)
    
    # Compute running maximum (peak)
    running_max = prices.expanding().max()
    
    # Drawdown = current price / peak - 1 (negative = below peak)
    drawdown = (prices / running_max) - 1
    
    return drawdown, running_max

def load_index_data(index_df):
    
    #Load and prepare index data for validation.
    #Returns: price series indexed by date
    
    # Assume index_df has 'Date' and 'Adj Close' or 'Close' column
    if 'Date' in index_df.columns:
        index_df = index_df.copy()
        index_df['Date'] = pd.to_datetime(index_df['Date'])
        index_df = index_df.set_index('Date')
    
    # Try different column names (including S&P500 with ampersand)
    price_col = None
    for col in ['Adj Close', 'Close', 'Price', 'SP500', 'S&P500', 'S_P500']:
        if col in index_df.columns:
            price_col = col
            break
    
    if price_col is None:
        raise ValueError(f"Could not find price column in index data. Available: {index_df.columns.tolist()}")
    
    prices = index_df[price_col].copy()
    prices = prices.sort_index()
    prices = prices.dropna()
    
    return prices

def get_known_events():
    
    #Return dict of known market events with dates.
    
    events = {
        'GFC Tail End': pd.Timestamp('2010-01-01'),  # Approximate
        '2011 Debt Ceiling': pd.Timestamp('2011-08-01'),
        '2015 China Devaluation': pd.Timestamp('2015-08-11'),
        '2018 Vol Shock': pd.Timestamp('2018-02-05'),
        'COVID-19 Start': pd.Timestamp('2020-03-01'),
        'COVID-19 Peak': pd.Timestamp('2020-03-23'),
        '2022 Inflation Fears': pd.Timestamp('2022-01-01'),
        '2022 Russia-Ukraine': pd.Timestamp('2022-02-24'),
    }
    return events

def plot_regime_validation(
    regime_labels,
    index_prices=None,
    index_df=None,
    save_path=None,
    figsize=(16, 10)
):
    
    #Create comprehensive validation plot overlaying regimes on:
    #1. Index price and drawdowns
    #2. Regime assignments
    #3. Known market events
    

    fig, axes = plt.subplots(3, 1, figsize=figsize, sharex=True)
    
    # Ensure regime_labels is Series with datetime index
    if not isinstance(regime_labels, pd.Series):
        regime_labels = pd.Series(regime_labels)
    
    if not isinstance(regime_labels.index, pd.DatetimeIndex):
        regime_labels.index = pd.to_datetime(regime_labels.index)
    
    regime_labels = regime_labels.sort_index()
    
    # Load index data if needed
    if index_prices is None and index_df is not None:
        index_prices = load_index_data(index_df)
    
    # Align dates
    if index_prices is not None:
        common_dates = regime_labels.index.intersection(index_prices.index)
        if len(common_dates) > 0:
            index_prices = index_prices.loc[common_dates]
            regime_labels = regime_labels.loc[common_dates]
    
    # Plot 1: Index Price and Drawdowns
    ax1 = axes[0]
    if index_prices is not None:
        # Plot price
        ax1_twin = ax1.twinx()
        ax1.plot(index_prices.index, index_prices.values, 'b-', linewidth=1.5, label='S&P 500 Price', alpha=0.7)
        ax1.set_ylabel('Index Price', color='b', fontsize=11)
        ax1.tick_params(axis='y', labelcolor='b')
        
        # Compute and plot drawdowns
        drawdown, _ = compute_drawdowns(index_prices)
        ax1_twin.fill_between(drawdown.index, 0, drawdown.values, alpha=0.3, color='red', label='Drawdown')
        ax1_twin.plot(drawdown.index, drawdown.values, 'r-', linewidth=1, alpha=0.6)
        ax1_twin.set_ylabel('Drawdown', color='r', fontsize=11)
        ax1_twin.tick_params(axis='y', labelcolor='r')
        ax1_twin.set_ylim([min(drawdown.min(), -0.5), 0.05])
        
        ax1.set_title('S&P 500 Price and Drawdowns with Regime Overlay', fontsize=13, fontweight='bold')
    else:
        ax1.text(0.5, 0.5, 'Index data not available', ha='center', va='center', transform=ax1.transAxes)
        ax1.set_title('Regime Validation (Index data not available)', fontsize=13)
    
    # Plot 2: Regime Assignments
    ax2 = axes[1]
    unique_regimes = sorted(regime_labels.unique())
    colors = plt.cm.Set3(np.linspace(0, 1, max(len(unique_regimes), 12)))[:len(unique_regimes)]
    
    for i, regime in enumerate(unique_regimes):
        mask = regime_labels == regime
        ax2.scatter(regime_labels[mask].index, regime_labels[mask].values, c=[colors[i]], 
                   label=f'Regime {regime}', s=15, alpha=0.6, edgecolors='black', linewidths=0.3)
    
    ax2.set_ylabel('Regime Label', fontsize=11)
    ax2.set_title('Regime Assignments Over Time', fontsize=13, fontweight='bold')
    ax2.legend(loc='upper right', fontsize=9, ncol=len(unique_regimes))
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim([min(unique_regimes) - 0.5, max(unique_regimes) + 0.5])
    
    # Plot 3: Known Events Timeline
    ax3 = axes[2]
    events = get_known_events()
    
    # Filter events to date range
    date_range = (regime_labels.index.min(), regime_labels.index.max())
    relevant_events = {k: v for k, v in events.items() if date_range[0] <= v <= date_range[1]}
    
    # Plot vertical lines for events
    for event_name, event_date in relevant_events.items():
        if event_date in regime_labels.index or any(abs((regime_labels.index - event_date).days) < 30):
            # Find closest date in regime_labels
            closest_date = regime_labels.index[np.argmin(np.abs((regime_labels.index - event_date).days))]
            ax3.axvline(closest_date, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
            ax3.text(closest_date, 0.5, event_name, rotation=90, ha='right', va='center', 
                    fontsize=8, bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.5))
    
    ax3.set_ylabel('Events', fontsize=11)
    ax3.set_title('Known Market Events', fontsize=13, fontweight='bold')
    ax3.set_yticks([])
    ax3.grid(True, alpha=0.3, axis='x')
    
    # Format x-axis
    for ax in axes:
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        ax.xaxis.set_major_locator(mdates.YearLocator())
        ax.xaxis.set_minor_locator(mdates.MonthLocator((1, 7)))
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"✓ Validation plot saved to {save_path}")
    
    return fig

def print_regime_event_alignment(regime_labels, window_days=30):
    
    #Print which regimes align with known market events.
    
    events = get_known_events()
    regime_labels = pd.Series(regime_labels).sort_index()
    
    if not isinstance(regime_labels.index, pd.DatetimeIndex):
        regime_labels.index = pd.to_datetime(regime_labels.index)
    
    print("\n" + "="*60)
    print("REGIME-EVENT ALIGNMENT CHECK")
    print("="*60)
    
    date_range = (regime_labels.index.min(), regime_labels.index.max())
    relevant_events = {k: v for k, v in events.items() if date_range[0] <= v <= date_range[1]}
    
    if len(relevant_events) == 0:
        print("No known events in date range")
        return
    
    print(f"\nChecking alignment within ±{window_days} days:")
    print("-"*60)
    
    for event_name, event_date in relevant_events.items():
        # Define event window
        event_window_start = event_date - pd.Timedelta(days=window_days)
        event_window_end = event_date + pd.Timedelta(days=window_days)
        window_mask = (regime_labels.index >= event_window_start) & (regime_labels.index <= event_window_end)
        regimes_in_window = regime_labels[window_mask]
        
        if len(regimes_in_window) == 0:
            print(f"{event_name:25s} ({event_date.strftime('%Y-%m-%d')}):")
            print(f"  → No regime data in window")
            print()
            continue
        
        # Find closest date to event
        time_diffs = pd.Series(
            np.abs((regime_labels.index - event_date).days),
            index=regime_labels.index
        )
        closest_idx = time_diffs.idxmin()
        closest_date = closest_idx
        days_diff = time_diffs.min()
        regime_at_event = regime_labels.loc[closest_date]
        
        # Detect regime transitions within the window
        # A transition is defined as a change from one regime to another
        transitions = []
        if len(regimes_in_window) > 1:
            # Find all regime changes in the window
            # shift() creates NaN for first row, so != marks first row as True
            # We want to find actual transitions, so we look for changes between consecutive dates
            for i in range(1, len(regimes_in_window)):
                prev_date = regimes_in_window.index[i-1]
                curr_date = regimes_in_window.index[i]
                prev_regime = regimes_in_window.iloc[i-1]
                curr_regime = regimes_in_window.iloc[i]
                
                if prev_regime != curr_regime:
                    # This is a transition: prev_regime -> curr_regime at curr_date
                    # Check if this transition is near the event (within window)
                    transition_date = curr_date
                    days_from_event = abs((transition_date - event_date).days)
                    
                    # Transition is already in window (we're iterating over window), so just check distance
                    transitions.append({
                        'from_regime': prev_regime,
                        'to_regime': curr_regime,
                        'date': transition_date,
                        'days_from_event': days_from_event
                    })
        
        # Determine if event triggered a regime transition
        unique_regimes_in_window = sorted(regimes_in_window.unique().tolist())
        has_transition = len(transitions) > 0
        
        # Reframe interpretation: focus on transitions, not just regime at date
        if has_transition:
            # Event triggered a regime change
            status = "✓ ALIGNED"
            print(f"{event_name:25s} ({event_date.strftime('%Y-%m-%d')}):")
            
            # Report the most relevant transition (closest to event)
            if transitions:
                best_transition = min(transitions, key=lambda x: x['days_from_event'])
                print(f"  → Triggered transition: Regime {best_transition['from_regime']} → Regime {best_transition['to_regime']}")
                print(f"  → Transition date: {best_transition['date'].strftime('%Y-%m-%d')} ({best_transition['days_from_event']} days from event)")
            
            if len(transitions) > 1:
                print(f"  → Total transitions in window: {len(transitions)}")
            print(f"  → Regimes in window: {unique_regimes_in_window}")
            print(f"  → {status} (event caused regime change)")
            
        elif days_diff <= window_days:
            # Event is within window but no transition detected
            # This could mean event occurred during a stable regime period
            status = "⚠ PARTIAL"
            regime_duration = (regime_labels == regime_at_event).sum()
            print(f"{event_name:25s} ({event_date.strftime('%Y-%m-%d')}):")
            print(f"  → Event occurred during Regime {regime_at_event} (stable period)")
            print(f"  → Closest date: {closest_date.strftime('%Y-%m-%d')} ({days_diff} days away)")
            print(f"  → Regime {regime_at_event} duration: {regime_duration} days ({regime_duration/252:.1f} years)")
            if len(unique_regimes_in_window) > 1:
                print(f"  → Regimes in window: {unique_regimes_in_window}")
            print(f"  → {status} (no transition detected, event may not have triggered regime change)")
        else:
            # Event is far from any regime data
            status = "⚠ FAR"
            print(f"{event_name:25s} ({event_date.strftime('%Y-%m-%d')}):")
            print(f"  → Closest regime: {regime_at_event} at {closest_date.strftime('%Y-%m-%d')} ({days_diff} days away)")
            print(f"  → {status} (outside ±{window_days} day window)")
        print()
    
    print("="*60)
    print("Interpretation:")
    print("  ✓ ALIGNED: Event triggered a regime transition within ±N days")
    print("  ⚠ PARTIAL: Event occurred during stable regime (no transition detected)")
    print("  ⚠ FAR: Event is far from regime data (outside ±N day window)")
    print("\nKey insight: We check if events CAUSED regime changes, not just")
    print("whether events occurred during a particular regime.")
    print("="*60)

