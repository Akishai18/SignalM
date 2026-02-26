"""
Update regime analysis with market data (SPY, VIX)
Integrates yfinance data with existing regime labels
"""
import pandas as pd
import numpy as np
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.fetch_market_data import (
    MarketDataFetcher,
    calculate_regime_spy_performance,
    calculate_regime_vix_stats
)


def main():
    """Main pipeline to update regime analysis with market data"""

    print("\n" + "="*70)
    print("REGIME ANALYSIS ENHANCEMENT WITH MARKET DATA")
    print("="*70)

    # Configuration
    REGIME_LABEL_MAP = {
        0: 'Calm',
        1: 'Crisis',
        2: 'Elevated Stress',
        3: 'Transition'
    }

    # Paths
    regime_labels_path = 'regime_results/regime_labels_k4.csv'
    output_dir = 'regime_results'

    # Check if regime labels exist
    if not os.path.exists(regime_labels_path):
        print(f"✗ Error: Regime labels not found at {regime_labels_path}")
        print("  Please run regime clustering first:")
        print("  PYTHONPATH=src python src/regime/run_regime_clustering.py")
        return

    # Load regime labels
    print("\n[Step 1/5] Loading regime labels...")
    regime_labels = pd.read_csv(regime_labels_path, index_col=0, parse_dates=True).squeeze()

    # Remove timezone info for compatibility
    if hasattr(regime_labels.index, 'tz') and regime_labels.index.tz is not None:
        regime_labels.index = regime_labels.index.tz_localize(None)

    print(f"  ✓ Loaded {len(regime_labels)} regime labels")
    print(f"  Date range: {regime_labels.index.min()} to {regime_labels.index.max()}")

    # Fetch market data
    print("\n[Step 2/5] Fetching market data from Yahoo Finance...")
    start_date = regime_labels.index.min().strftime('%Y-%m-%d')
    end_date = regime_labels.index.max().strftime('%Y-%m-%d')

    fetcher = MarketDataFetcher(start_date=start_date, end_date=end_date)
    market_data = fetcher.fetch_all_market_data()

    # Calculate SPY returns
    print("\n[Step 3/5] Calculating SPY returns and statistics...")
    if not market_data['spy'].empty:
        spy_with_returns = fetcher.calculate_spy_returns(market_data['spy'])

        # Remove timezone info for compatibility
        if hasattr(spy_with_returns.index, 'tz') and spy_with_returns.index.tz is not None:
            spy_with_returns.index = spy_with_returns.index.tz_localize(None)

        market_data['spy'] = spy_with_returns
        print(f"  ✓ Calculated returns for {len(spy_with_returns)} days")
    else:
        print("  ✗ SPY data is empty!")
        return

    # Remove timezone from VIX as well
    if not market_data['vix'].empty and hasattr(market_data['vix'].index, 'tz') and market_data['vix'].index.tz is not None:
        market_data['vix'].index = market_data['vix'].index.tz_localize(None)

    # Save market data
    print("\n[Step 4/5] Saving market data...")
    fetcher.save_market_data(market_data, output_dir='data')

    # Calculate regime-conditioned performance
    print("\n[Step 5/5] Analyzing regime-conditioned performance...")

    # SPY performance by regime
    spy_performance = calculate_regime_spy_performance(
        regime_labels=regime_labels,
        spy_data=market_data['spy'],
        regime_label_map=REGIME_LABEL_MAP
    )

    print("\n" + "-"*70)
    print("SPY PERFORMANCE BY REGIME")
    print("-"*70)
    print(spy_performance.to_string(index=False))

    # Save SPY performance
    spy_perf_path = f"{output_dir}/spy_performance_by_regime.csv"
    spy_performance.to_csv(spy_perf_path, index=False)
    print(f"\n  ✓ Saved: {spy_perf_path}")

    # VIX statistics by regime
    if not market_data['vix'].empty:
        vix_stats = calculate_regime_vix_stats(
            regime_labels=regime_labels,
            vix_data=market_data['vix'],
            regime_label_map=REGIME_LABEL_MAP
        )

        print("\n" + "-"*70)
        print("VIX STATISTICS BY REGIME")
        print("-"*70)
        print(vix_stats.to_string(index=False))

        # Save VIX stats
        vix_stats_path = f"{output_dir}/vix_stats_by_regime.csv"
        vix_stats.to_csv(vix_stats_path, index=False)
        print(f"\n  ✓ Saved: {vix_stats_path}")
    else:
        print("\n  ⚠ VIX data is empty, skipping VIX analysis")

    # Create merged regime + SPY + VIX dataset
    print("\n[Bonus] Creating merged regime + market data...")
    merged_data = pd.DataFrame(index=regime_labels.index)
    merged_data['regime'] = regime_labels

    # Add SPY data
    if not market_data['spy'].empty:
        common_dates = regime_labels.index.intersection(market_data['spy'].index)
        merged_data.loc[common_dates, 'spy_close'] = market_data['spy'].loc[common_dates, 'close']
        merged_data.loc[common_dates, 'spy_returns'] = market_data['spy'].loc[common_dates, 'returns']
        merged_data.loc[common_dates, 'spy_vol_252d'] = market_data['spy'].loc[common_dates, 'vol_252d']

    # Add VIX data
    if not market_data['vix'].empty:
        common_dates = regime_labels.index.intersection(market_data['vix'].index)
        merged_data.loc[common_dates, 'vix'] = market_data['vix'].loc[common_dates, 'close']

    # Save merged data
    merged_path = f"{output_dir}/regime_with_market_data.csv"
    merged_data.to_csv(merged_path)
    print(f"  ✓ Saved: {merged_path} ({len(merged_data)} rows)")

    # Summary statistics
    print("\n" + "="*70)
    print("SUMMARY STATISTICS")
    print("="*70)

    total_days = len(regime_labels)
    for regime_id, regime_name in REGIME_LABEL_MAP.items():
        regime_days = (regime_labels == regime_id).sum()
        pct = (regime_days / total_days) * 100

        # Get regime performance
        regime_perf = spy_performance[spy_performance['regime_id'] == regime_id]
        if len(regime_perf) > 0:
            ann_return = regime_perf['annualized_return'].values[0]
            volatility = regime_perf['volatility'].values[0]
            sharpe = regime_perf['sharpe_ratio'].values[0]

            print(f"\n{regime_name} (Regime {regime_id}):")
            print(f"  • {regime_days} days ({pct:.1f}% of time)")
            print(f"  • SPY return: {ann_return:+.1f}% annualized")
            print(f"  • Volatility: {volatility:.1f}%")
            print(f"  • Sharpe ratio: {sharpe:.2f}")

            if not market_data['vix'].empty:
                regime_vix = vix_stats[vix_stats['regime_id'] == regime_id]
                if len(regime_vix) > 0:
                    avg_vix = regime_vix['avg_vix'].values[0]
                    print(f"  • Avg VIX: {avg_vix:.1f}")

    print("\n" + "="*70)
    print("✓ REGIME ENHANCEMENT COMPLETE")
    print("="*70)
    print("\nGenerated files:")
    print(f"  • {spy_perf_path}")
    if not market_data['vix'].empty:
        print(f"  • {vix_stats_path}")
    print(f"  • {merged_path}")
    print(f"  • data/spy_data.csv")
    print(f"  • data/vix_data.csv")


if __name__ == "__main__":
    main()
