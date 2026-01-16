# Standalone script to run regime clustering pipeline
# Usage: python -m regime.run_regime_clustering
# Or: cd src && python regime/run_regime_clustering.py

import sys
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Add parent directory to path to import from src
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from regime.feature_engineering import build_regime_features
from regime.normalize import zscore_time
from regime.cluster import evaluate_kmeans, fit_kmeans_regimes
from regime.evaluate import (
    summarize_clustering_evaluation, 
    compute_regime_persistence,
    diagnose_persistence,
    print_persistence_diagnostics,
    compute_economic_monotonicity,
    print_economic_monotonicity
)
from regime.visualize_regimes import plot_regime_assignments, plot_umap_by_regime

# Try to import from main analysis if available
try:
    import analyze
    from main import run_full_analysis
    USE_MAIN_ANALYSIS = True
except ImportError:
    USE_MAIN_ANALYSIS = False
    print("Note: Running standalone - will load from saved files only")


def run_regime_pipeline(
    pca_metrics_path="../pca_data/rolling_pca_metrics.csv",
    rolling_stats=None,
    k_range=[3, 4, 5, 6],
    final_k=3,
    save_dir=None
):
    #Complete regime clustering pipeline.
    
    print("="*60)
    print("REGIME CLUSTERING PIPELINE")
    print("="*60)
    
    # Step 1: Build regime feature matrix
    print("\n[Step 1] Building regime feature matrix...")
    if rolling_stats is None:
        print("Warning: rolling_stats not provided. Need to load from main analysis or files.")
        print("Run main.py first to get rolling_stats, or provide it here.")
        return None
    
    # Convert relative path to absolute if needed
    if not os.path.isabs(pca_metrics_path):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        pca_metrics_path = os.path.join(script_dir, "..", "..", "pca_data", "rolling_pca_metrics.csv")
        pca_metrics_path = os.path.normpath(pca_metrics_path)
    
    if not os.path.exists(pca_metrics_path):
        print(f"Error: PCA metrics file not found at {pca_metrics_path}")
        print("Please ensure rolling_pca_metrics.csv exists in pca_data/ folder")
        return None
    
    X = build_regime_features(
        rolling_metrics_path=pca_metrics_path,
        rolling_stats=rolling_stats,
        window=252
    )
    print(f"✓ Feature matrix shape: {X.shape}")
    print(f"  Date range: {X.index.min()} to {X.index.max()}")
    print(f"  Features: {list(X.columns)}")
    
    # Step 2: Normalize features
    print("\n[Step 2] Normalizing features (z-score across time)...")
    X_norm = zscore_time(X)
    print(f"✓ Normalized feature matrix shape: {X_norm.shape}")
    
    # Step 3 & 4: Evaluate different K values
    print(f"\n[Step 3 & 4] Evaluating K-means for K = {k_range}...")
    evals = evaluate_kmeans(X_norm, k_range=k_range)
    
    # Print evaluation summary
    summary = summarize_clustering_evaluation(evals)
    print("\n" + "="*60)
    print("CLUSTERING EVALUATION SUMMARY")
    print("="*60)
    print(summary.to_string(index=False))
    print("\nInterpretation:")
    print("  - Lower inertia = better (within-cluster variance)")
    print("  - Higher silhouette = better (separation between clusters)")
    print("  - Higher persistence = more stable regimes")
    print("  - Lower single_day_pct = less day-to-day flipping (better)")
    print("\n💡 PICKING K:")
    print("  → Choose K with: passes_persistence=True AND good interpretability")
    print("  → If multiple K pass, prefer lower K (simpler model)")
    print("  → If none pass, features may be too noisy or need different approach")
    
    # Step 5: Fit final model with chosen K
    print(f"\n[Step 5] Fitting final K-means model with K={final_k}...")
    model, regime_labels = fit_kmeans_regimes(X_norm, k=final_k)
    persistence = compute_regime_persistence(regime_labels)
    
    print(f"✓ Regime assignment complete")
    print(f"  Total dates: {len(regime_labels)}")
    print(f"  Regime distribution:")
    print(regime_labels.value_counts().sort_index().to_string())
    print(f"\n  Mean persistence: {persistence.mean():.2f} days")
    print(f"  Max persistence: {persistence.max()} days")
    
    # Step 6: Diagnose Regime Quality
    print("\n" + "="*60)
    print("STEP 6: REGIME QUALITY DIAGNOSTICS")
    print("="*60)
    
    # 1. Persistence Diagnostics
    print("\n[6.1] Persistence Check...")
    persistence_diag = diagnose_persistence(regime_labels, min_days_threshold=21)
    print_persistence_diagnostics(persistence_diag)
    
    # 2. Economic Monotonicity
    print("\n[6.2] Economic Monotonicity Check...")
    monotonicity = compute_economic_monotonicity(X, regime_labels)
    print_economic_monotonicity(monotonicity)
    
    # 3. UMAP Separation Check
    print("\n[6.3] UMAP Separation Check...")
    # Try to find UMAP embedding
    umap_paths = [
        "../pca_data/umap_embedding.csv",
        "pca_data/umap_embedding.csv",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "pca_data", "umap_embedding.csv")
    ]
    umap_path = None
    for path in umap_paths:
        abs_path = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), path))
        if os.path.exists(abs_path):
            umap_path = abs_path
            break
    
    if umap_path and os.path.exists(umap_path):
        print(f"  Loading UMAP embedding from {umap_path}...")
        try:
            fig_umap = plot_umap_by_regime(None, regime_labels, umap_path=umap_path)
            plt.tight_layout()
            if save_dir:
                plt.savefig(os.path.join(save_dir, f"umap_by_regime_k{final_k}.png"), dpi=300, bbox_inches='tight')
                print(f"  ✓ UMAP plot saved to {save_dir}/umap_by_regime_k{final_k}.png")
            print("  ✓ UMAP visualization generated")
            print("  → Check: Regimes should form contiguous regions, not random salt-and-pepper")
        except Exception as e:
            print(f"  ⚠ Could not generate UMAP plot: {e}")
            fig_umap = None
    else:
        print("  ⚠ UMAP embedding not found. Skipping UMAP visualization.")
        print("  → Run umap_embed.py first to generate UMAP embedding")
        fig_umap = None
    
    # Save results if requested
    if save_dir:
        os.makedirs(save_dir, exist_ok=True)
        regime_labels.to_csv(os.path.join(save_dir, f"regime_labels_k{final_k}.csv"))
        X_norm.to_csv(os.path.join(save_dir, "regime_features_normalized.csv"))
        summary.to_csv(os.path.join(save_dir, "clustering_evaluation.csv"), index=False)
        monotonicity['means'].to_csv(os.path.join(save_dir, f"regime_means_k{final_k}.csv"))
        print(f"\n✓ Results saved to {save_dir}/")
    
    # Visualize
    print("\n[Visualization] Generating regime assignment plot...")
    fig_time, ax = plt.subplots(figsize=(14, 6))
    plot_regime_assignments(X_norm, regime_labels, ax=ax)
    plt.tight_layout()
    
    if save_dir:
        plt.savefig(os.path.join(save_dir, f"regime_assignments_k{final_k}.png"), dpi=300, bbox_inches='tight')
        print(f"✓ Plot saved to {save_dir}/regime_assignments_k{final_k}.png")
    
    # Summary
    print("\n" + "="*60)
    print("REGIME QUALITY SUMMARY")
    print("="*60)
    print(f"Persistence: {'✓ PASS' if persistence_diag['overall_pass'] else '✗ FAIL'}")
    print(f"  - Mean duration: {persistence_diag['mean_persistence_days']:.1f} days")
    print(f"  - Single-day runs: {persistence_diag['single_day_runs_pct']:.1f}%")
    print(f"\nEconomic Separation: Check monotonicity table above")
    print(f"UMAP Separation: {'✓ Generated' if fig_umap else '⚠ Skipped (no UMAP file)'}")
    print("\n" + "="*60)
    
    plt.show()
    
    return {
        'feature_matrix': X,
        'feature_matrix_normalized': X_norm,
        'evaluations': evals,
        'evaluation_summary': summary,
        'final_model': model,
        'regime_labels': regime_labels,
        'persistence': persistence,
        'persistence_diagnostics': persistence_diag,
        'economic_monotonicity': monotonicity,
        'k_used': final_k
    }


if __name__ == "__main__":
    # Option 1: Run with data from main analysis
    if USE_MAIN_ANALYSIS:
        print("Running full analysis first to get rolling_stats...")
        results = run_full_analysis(
            base_path="data",
            generate_plots=False,  # Skip plots for faster execution
            save_plots_dir=None
        )
        rolling_stats = results['rolling_stats']
        
        # Run regime clustering
        regime_results = run_regime_pipeline(
            rolling_stats=rolling_stats,
            k_range=[3, 4, 5, 6],
            final_k=4,
            save_dir="regime_results"
        )
    else:
        # Option 2: Standalone - need to load rolling_stats from files
        print("Standalone mode: Need rolling_stats dict.")
        print("Either:")
        print("  1. Run: python src/main.py (which will call this)")
        print("  2. Or load rolling_stats from saved files")
        print("\nFor now, showing how to use:")
        print("  from regime.run_regime_clustering import run_regime_pipeline")
        print("  results = run_regime_pipeline(rolling_stats=your_rolling_stats_dict)")

