# Quick test script for cross-validation
# Run this after running the main regime pipeline

from regime.cross_validation import split_data_chronologically, print_split_summary
import pandas as pd

# Example: Load your regime results
# After running main.py, you'll have regime_labels and feature_matrix
# This is just a template - adjust based on your actual data

# Option 1: If you have results from run_regime_pipeline
# from regime.run_regime_clustering import run_regime_pipeline
# results = run_regime_pipeline(...)
# regime_labels = results['regime_labels']
# feature_matrix = results['feature_matrix']

# Option 2: Load from saved files
# regime_labels = pd.read_csv('regime_results/regime_labels_k4.csv', index_col=0, parse_dates=True)
# feature_matrix = pd.read_csv('regime_results/regime_features_normalized.csv', index_col=0, parse_dates=True)

# Then run the split:
# split_data = split_data_chronologically(
#     regime_labels=regime_labels,
#     feature_matrix=feature_matrix,
#     split_date="2019-01-01"  # Or use train_ratio=0.7, test_ratio=0.3
# )
# print_split_summary(split_data)

print("This is a template. Uncomment and adjust based on your data.")
