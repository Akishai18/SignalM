"""
Market data fetching using yfinance
Fetches SPY (S&P 500 ETF), VIX (Volatility Index), and sector ETFs
"""
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')


class MarketDataFetcher:
    """Fetch market data from Yahoo Finance"""

    # Market indices and ETFs
    SYMBOLS = {
        'spy': 'SPY',           # S&P 500 ETF
        'vix': '^VIX',          # CBOE Volatility Index
        'gspc': '^GSPC',        # S&P 500 Index
    }

    # Sector ETFs (SPDR Select Sector)
    SECTOR_ETFS = {
        'xlk': 'XLK',  # Technology
        'xlf': 'XLF',  # Financials
        'xlv': 'XLV',  # Healthcare
        'xle': 'XLE',  # Energy
        'xli': 'XLI',  # Industrials
        'xlc': 'XLC',  # Communication Services
        'xly': 'XLY',  # Consumer Discretionary
        'xlp': 'XLP',  # Consumer Staples
        'xlu': 'XLU',  # Utilities
        'xlre': 'XLRE', # Real Estate
        'xlb': 'XLB',  # Materials
    }

    def __init__(self, start_date: str = '2012-01-01', end_date: Optional[str] = None):
        """
        Initialize fetcher

        Args:
            start_date: Start date for historical data (YYYY-MM-DD)
            end_date: End date for historical data (YYYY-MM-DD), defaults to today
        """
        self.start_date = start_date
        self.end_date = end_date or datetime.now().strftime('%Y-%m-%d')

    def fetch_symbol(self, symbol: str, interval: str = '1d') -> pd.DataFrame:
        """
        Fetch data for a single symbol

        Args:
            symbol: Ticker symbol (e.g., 'SPY', '^VIX')
            interval: Data interval ('1d', '1h', etc.)

        Returns:
            DataFrame with OHLCV data
        """
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(start=self.start_date, end=self.end_date, interval=interval)

            if data.empty:
                print(f"  ⚠ No data returned for {symbol}")
                return pd.DataFrame()

            # Standardize column names
            data.columns = [col.lower() for col in data.columns]

            # Add symbol column
            data['symbol'] = symbol

            return data

        except Exception as e:
            print(f"  ✗ Error fetching {symbol}: {e}")
            return pd.DataFrame()

    def fetch_spy(self) -> pd.DataFrame:
        """Fetch S&P 500 ETF (SPY) data"""
        print("Fetching SPY (S&P 500 ETF)...")
        return self.fetch_symbol(self.SYMBOLS['spy'])

    def fetch_vix(self) -> pd.DataFrame:
        """Fetch VIX (Volatility Index) data"""
        print("Fetching VIX (Volatility Index)...")
        return self.fetch_symbol(self.SYMBOLS['vix'])

    def fetch_sp500_index(self) -> pd.DataFrame:
        """Fetch S&P 500 Index (^GSPC) data"""
        print("Fetching S&P 500 Index (^GSPC)...")
        return self.fetch_symbol(self.SYMBOLS['gspc'])

    def fetch_sector_etfs(self) -> Dict[str, pd.DataFrame]:
        """
        Fetch all sector ETF data

        Returns:
            Dictionary mapping sector name to DataFrame
        """
        print(f"Fetching {len(self.SECTOR_ETFS)} sector ETFs...")
        sector_data = {}

        for sector_name, symbol in self.SECTOR_ETFS.items():
            data = self.fetch_symbol(symbol)
            if not data.empty:
                sector_data[sector_name] = data
                print(f"  ✓ {sector_name.upper()}: {symbol} ({len(data)} rows)")
            else:
                print(f"  ✗ {sector_name.upper()}: {symbol} - no data")

        return sector_data

    def fetch_all_market_data(self) -> Dict[str, pd.DataFrame]:
        """
        Fetch all market data (SPY, VIX, S&P 500, sectors)

        Returns:
            Dictionary with all data
        """
        print("\n" + "="*60)
        print("FETCHING MARKET DATA FROM YAHOO FINANCE")
        print("="*60)
        print(f"Date range: {self.start_date} to {self.end_date}\n")

        data = {}

        # Core indices
        data['spy'] = self.fetch_spy()
        data['vix'] = self.fetch_vix()
        data['sp500'] = self.fetch_sp500_index()

        # Sector ETFs
        data['sectors'] = self.fetch_sector_etfs()

        print("\n" + "="*60)
        print("✓ Market data fetching complete")
        print("="*60)

        return data

    def calculate_spy_returns(self, spy_data: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate SPY returns and rolling statistics

        Args:
            spy_data: SPY price data

        Returns:
            DataFrame with returns and statistics
        """
        df = spy_data.copy()

        # Daily returns
        df['returns'] = df['close'].pct_change()
        df['log_returns'] = np.log(df['close'] / df['close'].shift(1))

        # Cumulative returns
        df['cum_returns'] = (1 + df['returns']).cumprod() - 1

        # Rolling volatility (21-day, 63-day, 252-day)
        df['vol_21d'] = df['returns'].rolling(21).std() * np.sqrt(252)
        df['vol_63d'] = df['returns'].rolling(63).std() * np.sqrt(252)
        df['vol_252d'] = df['returns'].rolling(252).std() * np.sqrt(252)

        # Moving averages
        df['sma_50'] = df['close'].rolling(50).mean()
        df['sma_200'] = df['close'].rolling(200).mean()

        # Trend indicators
        df['trend_50_200'] = df['sma_50'] > df['sma_200']  # Golden cross

        return df

    def save_market_data(self, data: Dict[str, pd.DataFrame], output_dir: str = 'data'):
        """
        Save market data to CSV files

        Args:
            data: Dictionary of DataFrames
            output_dir: Output directory
        """
        import os
        os.makedirs(output_dir, exist_ok=True)

        print(f"\nSaving market data to {output_dir}/...")

        # Save core indices
        for key in ['spy', 'vix', 'sp500']:
            if key in data and not data[key].empty:
                filename = f"{output_dir}/{key}_data.csv"
                data[key].to_csv(filename)
                print(f"  ✓ Saved {filename} ({len(data[key])} rows)")

        # Save sector ETFs
        if 'sectors' in data:
            sector_dir = f"{output_dir}/sectors"
            os.makedirs(sector_dir, exist_ok=True)

            for sector_name, sector_df in data['sectors'].items():
                filename = f"{sector_dir}/{sector_name}_data.csv"
                sector_df.to_csv(filename)
                print(f"  ✓ Saved {filename} ({len(sector_df)} rows)")

        print("\n✓ All market data saved")


def calculate_regime_spy_performance(
    regime_labels: pd.Series,
    spy_data: pd.DataFrame,
    regime_label_map: Dict[int, str]
) -> pd.DataFrame:
    """
    Calculate SPY performance statistics by regime

    Args:
        regime_labels: Series with regime assignments
        spy_data: SPY data with returns
        regime_label_map: Mapping from regime ID to name

    Returns:
        DataFrame with performance stats by regime
    """
    # Align dates
    common_dates = regime_labels.index.intersection(spy_data.index)
    regimes = regime_labels.loc[common_dates]
    spy = spy_data.loc[common_dates]

    results = []

    for regime_id, regime_name in regime_label_map.items():
        mask = regimes == regime_id
        regime_returns = spy.loc[mask, 'returns']

        if len(regime_returns) > 0:
            stats = {
                'regime_id': regime_id,
                'regime_name': regime_name,
                'days': len(regime_returns),
                'avg_daily_return': regime_returns.mean(),
                'annualized_return': regime_returns.mean() * 252,
                'volatility': regime_returns.std() * np.sqrt(252),
                'sharpe_ratio': (regime_returns.mean() / regime_returns.std()) * np.sqrt(252) if regime_returns.std() > 0 else 0,
                'max_daily_gain': regime_returns.max(),
                'max_daily_loss': regime_returns.min(),
                'win_rate': (regime_returns > 0).sum() / len(regime_returns),
            }
            results.append(stats)

    return pd.DataFrame(results)


def calculate_regime_vix_stats(
    regime_labels: pd.Series,
    vix_data: pd.DataFrame,
    regime_label_map: Dict[int, str]
) -> pd.DataFrame:
    """
    Calculate VIX statistics by regime

    Args:
        regime_labels: Series with regime assignments
        vix_data: VIX data
        regime_label_map: Mapping from regime ID to name

    Returns:
        DataFrame with VIX stats by regime
    """
    # Align dates
    common_dates = regime_labels.index.intersection(vix_data.index)
    regimes = regime_labels.loc[common_dates]
    vix = vix_data.loc[common_dates, 'close']

    results = []

    for regime_id, regime_name in regime_label_map.items():
        mask = regimes == regime_id
        regime_vix = vix.loc[mask]

        if len(regime_vix) > 0:
            stats = {
                'regime_id': regime_id,
                'regime_name': regime_name,
                'avg_vix': regime_vix.mean(),
                'median_vix': regime_vix.median(),
                'min_vix': regime_vix.min(),
                'max_vix': regime_vix.max(),
                'std_vix': regime_vix.std(),
            }
            results.append(stats)

    return pd.DataFrame(results)


if __name__ == "__main__":
    # Example usage
    fetcher = MarketDataFetcher(start_date='2012-01-01')

    # Fetch all data
    market_data = fetcher.fetch_all_market_data()

    # Calculate SPY returns
    if not market_data['spy'].empty:
        spy_with_returns = fetcher.calculate_spy_returns(market_data['spy'])
        market_data['spy'] = spy_with_returns

    # Save to files
    fetcher.save_market_data(market_data)

    print("\n✓ Market data fetch complete!")
