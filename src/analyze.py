import pandas as pd
import numpy as np
import os
import sys
import re


def read_csv_file(file_path=None):
    # Read a CSV file and return a pandas DataFrame.
    if file_path is None:
        if len(sys.argv) > 1:
            file_path = sys.argv[1]
        else:
            file_path = input("Enter the path to the CSV file: ").strip()
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CSV file not found: {file_path}")
    
    try:
        df = pd.read_csv(file_path)
        return df
    except pd.errors.EmptyDataError:
        raise ValueError(f"CSV file '{file_path}' is empty")
    except pd.errors.ParserError as e:
        raise ValueError(f"Error parsing CSV file '{file_path}': {e}")
    except Exception as e:
        raise RuntimeError(f"Error reading CSV file '{file_path}': {e}")


def load_all_csvs(base_path="archive"):
    # Load all three CSV files: stocks, companies, and index.
    stocks_path = os.path.join(base_path, "sp500_stocks.csv")
    companies_path = os.path.join(base_path, "sp500_companies.csv")
    index_path = os.path.join(base_path, "sp500_index.csv")
    
    stocks_df = pd.read_csv(stocks_path)
    companies_df = pd.read_csv(companies_path)
    index_df = pd.read_csv(index_path)
    
    return stocks_df, companies_df, index_df


def clean_and_pivot_stock_data(stocks_df):
    # Clean stock data and pivot into price matrix P_{t,i}.
    df = stocks_df.copy()
    initial_rows = len(df)
    
    df['Date'] = pd.to_datetime(df['Date'])
    
    before_drop = len(df)
    df['Adj Close'] = df['Adj Close'].replace('', np.nan)
    df = df.dropna(subset=['Adj Close'])
    df['Adj Close'] = pd.to_numeric(df['Adj Close'], errors='coerce')
    df = df.dropna(subset=['Adj Close'])
    
    rows_dropped = before_drop - len(df)
    unique_symbols = df['Symbol'].nunique()
    unique_dates = df['Date'].nunique()
    
    price_matrix = df.pivot_table(
        index='Date',
        columns='Symbol',
        values='Adj Close',
        aggfunc='first'
    )
    
    cleaning_stats = {
        'initial_rows': initial_rows,
        'rows_dropped': rows_dropped,
        'remaining_rows': len(df),
        'unique_symbols': unique_symbols,
        'unique_dates': unique_dates
    }
    
    return price_matrix, cleaning_stats


def convert_to_log_returns(price_matrix):
    # Convert price matrix to log returns r_{t,i} = log(P_{t,i} / P_{t-1,i}).
    log_returns = np.log(price_matrix).diff()
    rows_before = len(log_returns)
    log_returns = log_returns.iloc[1:].copy()
    rows_dropped = rows_before - len(log_returns)
    
    return log_returns, rows_dropped


def compute_mean_returns(log_returns):
    # Calculate mean returns for each symbol.
    return log_returns.mean()


def compute_volatility(log_returns):
    # Compute volatility (std) for each symbol.
    return log_returns.std()


def compute_skewness(log_returns):
    # Compute skewness for each symbol.
    return log_returns.skew()


def compute_kurtosis(log_returns):
    # Compute kurtosis for each symbol.
    return log_returns.kurt()


def compute_rolling_statistics(log_returns, windows=[21, 63, 252], annualize=True):
    # Compute rolling statistics over time windows.
    # Returns:
    #   dict: Dictionary containing DataFrames for each metric:
    #       - 'volatility': Rolling volatility for each symbol and window
    #       - 'skewness': Rolling skewness for each symbol and window
    #       - 'kurtosis': Rolling kurtosis for each symbol and window
    #       - 'correlation': Rolling average pairwise correlation for each window
    #       - 'dispersion': Rolling cross-sectional dispersion (one series per window)
    results = {
        'volatility': pd.DataFrame(index=log_returns.index),
        'skewness': pd.DataFrame(index=log_returns.index),
        'kurtosis': pd.DataFrame(index=log_returns.index),
        'correlation': pd.DataFrame(index=log_returns.index),
        'dispersion': pd.DataFrame(index=log_returns.index)
    }
    
    for window in windows:
        # Rolling Volatility (annualized)
        vol = log_returns.rolling(window=window).std()
        if annualize:
            vol = vol * np.sqrt(252)
        vol.columns = [f"{col}_vol_{window}" for col in vol.columns]
        results['volatility'] = pd.concat([results['volatility'], vol], axis=1)
        
        # Rolling Skewness
        skew = log_returns.rolling(window=window).skew()
        skew.columns = [f"{col}_skew_{window}" for col in skew.columns]
        results['skewness'] = pd.concat([results['skewness'], skew], axis=1)
        
        # Rolling Kurtosis
        kurt = log_returns.rolling(window=window).kurt()
        kurt.columns = [f"{col}_kurt_{window}" for col in kurt.columns]
        results['kurtosis'] = pd.concat([results['kurtosis'], kurt], axis=1)
        
        # Rolling Average Pairwise Correlation
        rolling_corr = []
        indices = []
        for i in range(window - 1, len(log_returns)):
            window_data = log_returns.iloc[i - window + 1:i + 1]
            # Drop columns (stocks) that have ANY NaN in this window
            window_data = window_data.dropna(axis=1, how='any')
            
            if window_data.shape[1] < 2:
                rolling_corr.append(np.nan)
                indices.append(log_returns.index[i])
                continue
            
            corr_matrix = window_data.corr().values
            n = corr_matrix.shape[0]
            upper_triangle = corr_matrix[np.triu_indices(n, k=1)]
            avg_corr = np.nanmean(upper_triangle)
            rolling_corr.append(avg_corr)
            indices.append(log_returns.index[i])
        
        corr_df = pd.DataFrame(
            {f'avg_pairwise_corr_{window}': rolling_corr},
            index=indices
        )
        results['correlation'] = pd.concat([results['correlation'], corr_df], axis=1)

        # Rolling Cross-Sectional Dispersion
        # cross-sectional std across symbols at each date, then rolling mean to smooth
        cross_std = log_returns.std(axis=1, skipna=True)
        disp = cross_std.rolling(window=window).mean()
        disp_df = pd.DataFrame({f'dispersion_{window}': disp}, index=disp.index)
        results['dispersion'] = pd.concat([results['dispersion'], disp_df], axis=1)
    
    max_window = max(windows)
    for key in results:
        results[key] = results[key].iloc[max_window:].copy()
    
    return results


def assemble_feature_matrix(rolling_stats, include=['volatility', 'correlation', 'dispersion']):
    # Concatenate selected rolling statistics into one feature matrix.
    # Returns DataFrame indexed by date with columns for each selected feature.
    parts = []
    for name in include:
        if name in rolling_stats and not rolling_stats[name].empty:
            parts.append(rolling_stats[name])
    if not parts:
        return pd.DataFrame()
    # Align indices (intersection) then concat columns
    common_index = parts[0].index
    for p in parts[1:]:
        common_index = common_index.intersection(p.index)
    parts_aligned = [p.loc[common_index] for p in parts]
    feat = pd.concat(parts_aligned, axis=1)
    return feat


def compute_correlation_matrix(price_matrix, method='pearson', use_log_returns=True):
    """
    Compute pairwise correlation matrix of returns with sample counts.

    Args:
        price_matrix: DataFrame indexed by Date, columns = symbols (prices).
        method: correlation method ('pearson' by default).
        use_log_returns: if True compute log returns; else percent returns.

    Returns:
        corr_df: DataFrame NxN correlation matrix (pairwise Pearson by default).
        pair_counts: DataFrame NxN integer matrix with number of overlapping observations used for each pair.
        returns: DataFrame of returns used to compute correlations (aligned).
    Notes:
        - Pandas .corr() uses pairwise deletion automatically, but pair_counts gives the exact sample size per pair.
    """
    if use_log_returns:
        returns = np.log(price_matrix).diff()
    else:
        returns = price_matrix.pct_change()
    # drop first row of NaNs from differencing (keep rest; pairwise will handle remaining NaNs)
    returns = returns.iloc[1:].copy()

    # Correlation matrix (pairwise by pandas)
    corr_df = returns.corr(method=method)

    # Pairwise counts: for columns i,j count overlapping non-null rows
    notnull = returns.notna().astype(int)
    pair_counts = notnull.T.dot(notnull)

    return corr_df, pair_counts, returns


def normalize_features_cross_sectional(features):
    """
    Cross-sectional z-score normalization for feature matrix.

    - Per-symbol groups (detected by regex '(vol|skew|kurt)_{window}') are z-scored across symbols at each date (row-wise).
      Example group: ['AAPL_vol_21', 'MSFT_vol_21', ...] -> for each date compute mean/std across these columns and z-score.
    - Global single-series features like 'avg_pairwise_corr_21' and 'dispersion_21' are standardized across time (column-wise).
    Returns a new DataFrame with same index/columns.
    """
    if features is None or features.empty:
        return features.copy()

    feat = features.copy()
    cols = feat.columns.tolist()

    # Find per-symbol metric groups like *_vol_21, *_skew_63, *_kurt_252
    pattern = re.compile(r'_(vol|skew|kurt)_(\d+)$')
    groups = {}
    singles = []

    for c in cols:
        m = pattern.search(c)
        if m:
            key = f"{m.group(1)}_{m.group(2)}"  # e.g. vol_21
            groups.setdefault(key, []).append(c)
        else:
            singles.append(c)

    # Row-wise z-score each detected group (cross-sectional)
    for key, group_cols in groups.items():
        grp = feat[group_cols]
        mean_row = grp.mean(axis=1)
        std_row = grp.std(axis=1).replace(0, np.nan)  # avoid divide-by-zero
        z = grp.sub(mean_row, axis=0).div(std_row, axis=0).fillna(0)
        feat[group_cols] = z

    # Column-wise standardize remaining single-series features (time-series standardization)
    for c in singles:
        col = feat[c]
        col_mean = col.mean()
        col_std = col.std()
        if pd.isna(col_std) or col_std == 0:
            feat[c] = 0.0
        else:
            feat[c] = (col - col_mean) / col_std

    return feat
