import matplotlib.pyplot as plt
import analyze
import display
import visualize


def run_full_analysis(base_path="archive", generate_plots=True, save_plots_dir=None):
    # ===== 1. Load Data =====
    display.print_section("Loading CSV files...")
    stocks_df, companies_df, index_df = analyze.load_all_csvs(base_path=base_path)
    display.print_loading_status("stocks data", stocks_df.shape)
    display.print_loading_status("companies data", companies_df.shape)
    display.print_loading_status("index data", index_df.shape)
    
    # ===== 2. Clean and Structure Data =====
    price_matrix, cleaning_stats = analyze.clean_and_pivot_stock_data(stocks_df)
    display.print_cleaning_stats(
        initial_rows=cleaning_stats['initial_rows'],
        rows_dropped=cleaning_stats['rows_dropped'],
        remaining_rows=cleaning_stats['remaining_rows'],
        unique_symbols=cleaning_stats['unique_symbols'],
        unique_dates=cleaning_stats['unique_dates']
    )
    display.print_price_matrix_info(price_matrix)
    
    # Display price matrix summary
    display.print_dataframe_summary(price_matrix, title="Price Matrix P_{t,i} Summary")
    
    # ===== 3. Convert to Log Returns =====
    log_returns, rows_dropped = analyze.convert_to_log_returns(price_matrix)
    display.print_log_returns_info(log_returns, rows_dropped)
    display.print_dataframe_summary(log_returns, title="Log Returns Matrix R_{t,i} Summary")
    
    # ===== 4. Compute Basic Statistics =====
    mean_returns = analyze.compute_mean_returns(log_returns)
    display.print_statistics_summary(mean_returns, "mean returns", top_n=10)
    
    volatility = analyze.compute_volatility(log_returns)
    display.print_statistics_summary(volatility, "volatility")
    
    skewness = analyze.compute_skewness(log_returns)
    display.print_statistics_summary(skewness, "skewness")
    
    kurtosis = analyze.compute_kurtosis(log_returns)
    display.print_statistics_summary(kurtosis, "kurtosis")
    
    # ===== 5. Display Completion Summary =====
    display.print_completion_summary(price_matrix, log_returns)
    
    # ===== 6. Generate Distribution Plots =====
    if generate_plots:
        display.print_visualization_info("distributions")
        visualize.plot_all_distributions(
            log_returns=log_returns,
            mean_returns=mean_returns,
            volatility=volatility,
            skewness=skewness,
            kurtosis=kurtosis,
            symbol=None,
            save_dir=save_plots_dir
        )
    
    # ===== 7. Compute Rolling Statistics =====
    windows = [21, 63, 252]  # 1 month, 1 quarter, 1 year
    display.print_rolling_stats_info(windows, annualize=True)
    rolling_stats = analyze.compute_rolling_statistics(log_returns, windows=windows, annualize=True)
    display.print_rolling_stats_results(rolling_stats)
    # Note: Rolling correlation is now included in rolling_stats['correlation']
    
    # assemble feature matrix and show column names + shape
    features = analyze.assemble_feature_matrix(rolling_stats, include=['volatility', 'correlation', 'dispersion'])
    display.print_feature_matrix_info(features, sample_columns=60)
    
    # compute correlation matrix of returns and display top pairs + heatmap 
    # compute correlation on log-returns (pairwise overlap), get per-pair sample counts
    corr_df, pair_counts, returns_for_corr = analyze.compute_correlation_matrix(price_matrix, method='pearson', use_log_returns=True)
    display.print_correlation_info(corr_df, pair_counts=pair_counts, top_n=10)

    if generate_plots:
        # create heatmap figure (will be shown later with plt.show() 
        fig_corrmat = visualize.plot_correlation_heatmap(corr_df, figsize=(12, 10))
        if save_plots_dir:
            fig_corrmat.savefig(f"{save_plots_dir}/correlation_heatmap.png", dpi=300, bbox_inches='tight')
            plt.close(fig_corrmat)
        
        display.print_visualization_info("rolling", details=[
            "Volatility Cluster plot",
            "Correlation Spike plot",
            "Rolling Statistics Overview"
        ])
        
        fig_vol = visualize.plot_rolling_volatility_cluster(
            price_matrix=price_matrix,
            rolling_vol_stats=rolling_stats['volatility'],
            symbol=None,
            window=21,
            vol_threshold=0.20
        )
        if save_plots_dir:
            fig_vol.savefig(f"{save_plots_dir}/rolling_volatility_cluster.png", dpi=300, bbox_inches='tight')
            plt.close(fig_vol)
        
        fig_corr = visualize.plot_correlation_spike(rolling_stats['correlation'], windows=windows)
        if save_plots_dir:
            fig_corr.savefig(f"{save_plots_dir}/correlation_spike.png", dpi=300, bbox_inches='tight')
            plt.close(fig_corr)
        
        fig_overview = visualize.plot_rolling_statistics_overview(
            rolling_stats,
            symbol=None,
            windows=windows
        )
        if save_plots_dir:
            fig_overview.savefig(f"{save_plots_dir}/rolling_statistics_overview.png", dpi=300, bbox_inches='tight')
            plt.close(fig_overview)
        
        if not save_plots_dir:
            display.print_all_complete()
            plt.show()
    
    # Return all computed data for further use
    return {
        'price_matrix': price_matrix,
        'log_returns': log_returns,
        'mean_returns': mean_returns,
        'volatility': volatility,
        'skewness': skewness,
        'kurtosis': kurtosis,
        'rolling_stats': rolling_stats,
        'companies_df': companies_df,
        'index_df': index_df
    }


if __name__ == "__main__":
    results = run_full_analysis(
        base_path="data",
        generate_plots=True,
        save_plots_dir=None  
    )

