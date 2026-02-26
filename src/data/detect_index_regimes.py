"""
Multi-Index Regime Detection
Detects market regimes for individual indices (SPY, QQQ, DIA, etc.)
Uses index-level features: volatility, returns, momentum, RSI
"""
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.fetch_market_data import MarketDataFetcher
from src.data.index_config import ALL_INDICES, REGIME_LABELS


def calculate_index_features(price_data: pd.DataFrame, window: int = 21) -> pd.DataFrame:
    """
    Calculate regime features from index price data

    Args:
        price_data: DataFrame with OHLCV data
        window: Rolling window for calculations

    Returns:
        DataFrame with regime features
    """
    df = price_data.copy()

    # Returns
    df['returns'] = df['close'].pct_change()
    df['log_returns'] = np.log(df['close'] / df['close'].shift(1))

    # Volatility (multiple windows)
    df['vol_21d'] = df['returns'].rolling(21).std() * np.sqrt(252)
    df['vol_63d'] = df['returns'].rolling(63).std() * np.sqrt(252)
    df['vol_252d'] = df['returns'].rolling(252).std() * np.sqrt(252)

    # Momentum
    df['momentum_21d'] = df['close'] / df['close'].shift(21) - 1
    df['momentum_63d'] = df['close'] / df['close'].shift(63) - 1

    # Moving averages
    df['sma_21'] = df['close'].rolling(21).mean()
    df['sma_50'] = df['close'].rolling(50).mean()
    df['sma_200'] = df['close'].rolling(200).mean()

    # Price relative to MAs
    df['price_to_sma21'] = df['close'] / df['sma_21'] - 1
    df['price_to_sma50'] = df['close'] / df['sma_50'] - 1
    df['price_to_sma200'] = df['close'] / df['sma_200'] - 1

    # Trend strength
    df['sma21_slope'] = df['sma_21'].pct_change(5)
    df['sma50_slope'] = df['sma_50'].pct_change(10)

    # RSI (Relative Strength Index)
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))

    # Drawdown from peak
    df['cummax'] = df['close'].cummax()
    df['drawdown'] = (df['close'] - df['cummax']) / df['cummax']

    return df


def detect_regimes_for_index(
    symbol: str,
    start_date: str = '2012-01-01',
    n_regimes: int = 4
) -> tuple:
    """
    Detect market regimes for a specific index

    Args:
        symbol: Index symbol (e.g., 'SPY', 'QQQ')
        start_date: Start date for analysis
        n_regimes: Number of regimes to detect

    Returns:
        Tuple of (regime_labels, features_df, model, scaler)
    """
    print(f"\n{'='*70}")
    print(f"DETECTING REGIMES FOR {symbol}")
    print(f"{'='*70}")

    # Fetch data
    print(f"\n[1/4] Fetching {symbol} data...")
    fetcher = MarketDataFetcher(start_date=start_date)
    data = fetcher.fetch_symbol(symbol)

    if data.empty:
        raise ValueError(f"No data available for {symbol}")

    # Remove timezone
    if hasattr(data.index, 'tz') and data.index.tz is not None:
        data.index = data.index.tz_localize(None)

    print(f"  ✓ Loaded {len(data)} trading days")

    # Calculate features
    print(f"\n[2/4] Calculating regime features...")
    features_df = calculate_index_features(data)

    # Select features for clustering
    feature_cols = [
        'vol_21d', 'vol_63d', 'vol_252d',
        'momentum_21d', 'momentum_63d',
        'price_to_sma21', 'price_to_sma50', 'price_to_sma200',
        'sma21_slope', 'sma50_slope',
        'rsi', 'drawdown'
    ]

    # Remove NaN rows
    features_for_clustering = features_df[feature_cols].dropna()
    print(f"  ✓ Using {len(feature_cols)} features")
    print(f"  ✓ {len(features_for_clustering)} valid samples")

    # Normalize features
    print(f"\n[3/4] Running K-means clustering (K={n_regimes})...")
    scaler = StandardScaler()
    features_normalized = scaler.fit_transform(features_for_clustering)

    # K-means clustering
    kmeans = KMeans(
        n_clusters=n_regimes,
        random_state=42,
        n_init=50,
        max_iter=500
    )
    regime_labels = kmeans.fit_predict(features_normalized)

    # Create full regime series (with NaN for missing data)
    regime_series = pd.Series(index=features_df.index, dtype='Int64')
    regime_series.loc[features_for_clustering.index] = regime_labels

    print(f"  ✓ Clustering complete")

    # Analyze regimes
    print(f"\n[4/4] Analyzing regimes...")
    for regime_id in range(n_regimes):
        count = (regime_labels == regime_id).sum()
        pct = (count / len(regime_labels)) * 100
        print(f"  Regime {regime_id}: {count} days ({pct:.1f}%)")

    print(f"\n{'='*70}")
    print(f"✓ Regime detection complete for {symbol}")
    print(f"{'='*70}")

    return regime_series, features_df, kmeans, scaler


def save_index_regimes(
    symbol: str,
    regime_labels: pd.Series,
    features_df: pd.DataFrame,
    output_dir: str = 'regime_results/indices'
):
    """Save regime labels and features for an index"""
    os.makedirs(output_dir, exist_ok=True)

    # Save regime labels
    regime_path = f"{output_dir}/{symbol.lower()}_regimes.csv"
    regime_labels.to_csv(regime_path, header=['regime'])
    print(f"  ✓ Saved regimes: {regime_path}")

    # Save features
    features_path = f"{output_dir}/{symbol.lower()}_features.csv"
    features_df.to_csv(features_path)
    print(f"  ✓ Saved features: {features_path}")


def detect_all_indices(indices: list = None, start_date: str = '2012-01-01'):
    """
    Detect regimes for all indices

    Args:
        indices: List of symbols (default: all from config)
        start_date: Start date for analysis
    """
    if indices is None:
        indices = list(ALL_INDICES.keys())

    print("\n" + "="*70)
    print("MULTI-INDEX REGIME DETECTION")
    print("="*70)
    print(f"Analyzing {len(indices)} indices: {', '.join(indices)}\n")

    results = {}

    for symbol in indices:
        try:
            regimes, features, model, scaler = detect_regimes_for_index(
                symbol=symbol,
                start_date=start_date,
                n_regimes=4
            )

            save_index_regimes(symbol, regimes, features)

            results[symbol] = {
                'regimes': regimes,
                'features': features,
                'model': model,
                'scaler': scaler
            }

        except Exception as e:
            print(f"\n  ✗ Failed to process {symbol}: {e}")
            continue

    print("\n" + "="*70)
    print(f"✓ Processed {len(results)}/{len(indices)} indices successfully")
    print("="*70)

    return results


if __name__ == "__main__":
    # Detect regimes for priority indices
    from src.data.index_config import PRIORITY_INDICES

    results = detect_all_indices(
        indices=PRIORITY_INDICES,  # Start with SPY, QQQ, DIA, IWM
        start_date='2012-01-01'
    )

    print("\n✓ Multi-index regime detection complete!")
    print(f"Results saved to: regime_results/indices/")
