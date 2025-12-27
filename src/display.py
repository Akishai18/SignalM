import pandas as pd
import numpy as np


def print_section(title, char="=", width=50):
    # Print a formatted section header.
    print(f"\n{char * width}")
    print(title)
    print(f"{char * width}")


def print_dataframe_summary(df, title="DataFrame Summary", n_rows=5, n_cols=5):
    # Print a summary of a DataFrame.
    print_section(title)
    print(f"\nShape: {df.shape[0]} rows × {df.shape[1]} columns")
    print(f"\nFirst {n_rows} rows and {n_cols} columns:")
    print(df.iloc[:n_rows, :n_cols])
    print(f"\nData types:")
    print(df.dtypes.value_counts())
    print(f"\nMissing values per column (first 10):")
    missing_counts = df.isna().sum()
    print(missing_counts.head(10))
    print(f"\nTotal missing values: {df.isna().sum().sum():,}")
    print(f"Percentage of missing values: {df.isna().sum().sum() / (df.shape[0] * df.shape[1]) * 100:.2f}%")


def print_loading_status(file_path, shape):
    # Print file loading status.
    print(f"Loaded: {file_path}")
    print(f"  Shape: {shape[0]:,} rows × {shape[1]} columns")


def print_cleaning_stats(initial_rows, rows_dropped, remaining_rows, unique_symbols, unique_dates):
    # Print data cleaning statistics.
    print_section("Cleaning and structuring stock data...")
    print(f"Initial rows: {initial_rows:,}")
    print(f"Dropped {rows_dropped:,} rows with missing Adj Close values")
    print(f"Remaining rows: {remaining_rows:,}")
    print(f"Unique symbols: {unique_symbols}")
    print(f"Unique dates: {unique_dates}")


def print_price_matrix_info(price_matrix):
    # Print price matrix information.
    print("\nPivoting data into price matrix...")
    print(f"\nPrice matrix P_{{t,i}} created:")
    print(f"  Shape: {price_matrix.shape[0]} rows (dates) × {price_matrix.shape[1]} columns (symbols)")
    print(f"  Date range: {price_matrix.index.min()} to {price_matrix.index.max()}")
    symbols_preview = price_matrix.columns.tolist()[:10]
    if len(price_matrix.columns) > 10:
        print(f"  Symbols: {symbols_preview}...")
    else:
        print(f"  Symbols: {price_matrix.columns.tolist()}")


def print_log_returns_info(log_returns, rows_dropped):
    # Print log returns information.
    print_section("Converting price matrix to log returns...")
    print(f"Computed log returns: r_{{t,i}} = log(P_{{t,i}} / P_{{t-1,i}})")
    print(f"Dropped {rows_dropped} row(s) with NaN values from differencing")
    print(f"Final shape: {log_returns.shape[0]} rows (dates) × {log_returns.shape[1]} columns (symbols)")


def print_statistics_summary(stat_series, stat_name, top_n=10):
    # Print summary statistics for a pandas Series.
    print_section(f"Calculating {stat_name}...")
    print(f"\nSummary statistics:")
    print(f"  Number of symbols: {len(stat_series)}")
    print(f"  Mean {stat_name} (across all symbols): {stat_series.mean():.6f}")
    print(f"  Median {stat_name}: {stat_series.median():.6f}")
    print(f"  Min {stat_name}: {stat_series.min():.6f} ({stat_series.idxmin()})")
    print(f"  Max {stat_name}: {stat_series.max():.6f} ({stat_series.idxmax()})")
    print(f"  Std dev of {stat_name}: {stat_series.std():.6f}")
    
    if stat_name == "mean returns":
        print(f"\nTop {top_n} symbols by mean return:")
        top = stat_series.nlargest(top_n)
        for symbol, val in top.items():
            print(f"  {symbol}: {val:.6f}")
        
        print(f"\nBottom {top_n} symbols by mean return:")
        bottom = stat_series.nsmallest(top_n)
        for symbol, val in bottom.items():
            print(f"  {symbol}: {val:.6f}")


def print_rolling_stats_info(windows, annualize=True):
    # Print rolling statistics computation info.
    print_section("Computing Rolling Statistics...")
    print(f"Windows: {windows} days")
    if annualize:
        print("Volatility will be annualized (×√252)")


def print_rolling_stats_results(results):
    # Print rolling statistics results.
    for key in results:
        print(f"  {key.capitalize()}: {results[key].shape[0]} rows × {results[key].shape[1]} columns")


def print_completion_summary(price_matrix, log_returns):
    # Print final completion summary.
    print_section("Data Processing Complete!")
    print(f"✓ Price matrix P_{{t,i}}: {price_matrix.shape[0]} dates × {price_matrix.shape[1]} symbols")
    print(f"✓ Log returns matrix R_{{t,i}}: {log_returns.shape[0]} dates × {log_returns.shape[1]} symbols")
    print(f"✓ R ∈ R^{{{log_returns.shape[0]}×{log_returns.shape[1]}}} - ready for quantitative analysis!")
    print("="*50)


def print_visualization_info(plot_type, details=None):
    # Print visualization generation info.
    if plot_type == "distributions":
        print_section("Generating Distribution Plots...")
        print("This will create 5 plots:")
        print("  1️⃣ Histogram of returns")
        print("  2️⃣ KDE (Kernel Density Estimate)")
        print("  3️⃣ Q-Q Plot (Quantile-Quantile)")
        print("  4️⃣ Cross-sectional distributions")
        print("  5️⃣ Time-variation diagnostics")
    elif plot_type == "rolling":
        print_section("Generating Rolling Statistics Visualizations...")
        if details:
            for detail in details:
                print(f"Generating {detail}...")
    print("="*50)


def print_all_complete():
    # Print final completion message.
    print_section("All Analysis Complete!")
    print("Close plot windows to continue or save them using fig.savefig('filename.png')")

