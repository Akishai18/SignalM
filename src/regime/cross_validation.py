# Out-of-sample validation for regime detection
# Validates that regime detection generalizes across time periods
import pandas as pd
import numpy as np
from typing import Dict, Tuple, Optional
from datetime import datetime


def split_data_chronologically(
    regime_labels: pd.Series,
    feature_matrix: pd.DataFrame,
    split_date: Optional[str] = None,
    train_ratio: float = 0.7,
    test_ratio: float = 0.3
) -> Dict:
    #Split data chronologically into train and test sets.
    #Either provide split_date OR train_ratio/test_ratio (must sum to 1.0)
    #
    #Args:
    #    regime_labels: pd.Series with regime labels indexed by date
    #    feature_matrix: pd.DataFrame with features indexed by date
    #    split_date: Optional date string (YYYY-MM-DD) to split on
    #    train_ratio: Ratio of data for training (default 0.7 = 70%)
    #    test_ratio: Ratio of data for testing (default 0.3 = 30%)
    #
    #Returns:
    #    Dict with train/test splits for labels and features
    
    if not isinstance(regime_labels.index, pd.DatetimeIndex):
        regime_labels.index = pd.to_datetime(regime_labels.index)
    
    if not isinstance(feature_matrix.index, pd.DatetimeIndex):
        feature_matrix.index = pd.to_datetime(feature_matrix.index)
    
    # Ensure both have same date range (intersection)
    common_dates = regime_labels.index.intersection(feature_matrix.index)
    regime_labels = regime_labels.loc[common_dates]
    feature_matrix = feature_matrix.loc[common_dates]
    
    # Sort by date
    regime_labels = regime_labels.sort_index()
    feature_matrix = feature_matrix.sort_index()
    
    total_days = len(regime_labels)
    
    # Determine split point
    if split_date:
        # Use explicit split date
        split_date = pd.to_datetime(split_date)
        if split_date not in regime_labels.index:
            # Find closest date
            split_date = regime_labels.index[regime_labels.index <= split_date].max()
            if pd.isna(split_date):
                raise ValueError(f"Split date {split_date} is before all data. Earliest date: {regime_labels.index.min()}")
        split_idx = regime_labels.index.get_loc(split_date) + 1  # +1 to include split_date in train
    else:
        # Use ratio-based split
        if abs(train_ratio + test_ratio - 1.0) > 0.01:
            raise ValueError(f"train_ratio ({train_ratio}) + test_ratio ({test_ratio}) must equal 1.0")
        
        split_idx = int(total_days * train_ratio)
        split_date = regime_labels.index[split_idx]
    
    # Split data
    train_labels = regime_labels.iloc[:split_idx]
    test_labels = regime_labels.iloc[split_idx:]
    
    train_features = feature_matrix.iloc[:split_idx]
    test_features = feature_matrix.iloc[split_idx:]
    
    # Validation
    if len(train_labels) == 0:
        raise ValueError("Train set is empty. Adjust split_date or train_ratio.")
    if len(test_labels) == 0:
        raise ValueError("Test set is empty. Adjust split_date or test_ratio.")
    
    split_info = {
        'split_date': split_date,
        'split_idx': split_idx,
        'train_start': train_labels.index.min(),
        'train_end': train_labels.index.max(),
        'test_start': test_labels.index.min(),
        'test_end': test_labels.index.max(),
        'train_days': len(train_labels),
        'test_days': len(test_labels),
        'train_ratio_actual': len(train_labels) / total_days,
        'test_ratio_actual': len(test_labels) / total_days
    }
    
    return {
        'train_labels': train_labels,
        'test_labels': test_labels,
        'train_features': train_features,
        'test_features': test_features,
        'split_info': split_info
    }


def print_split_summary(split_data: Dict):
    #Print summary of train/test split.
    
    split_info = split_data['split_info']
    train_labels = split_data['train_labels']
    test_labels = split_data['test_labels']
    
    print("\n" + "="*70)
    print("TRAIN/TEST SPLIT SUMMARY")
    print("="*70)
    
    print(f"\nSplit Date: {split_info['split_date'].strftime('%Y-%m-%d')}")
    print(f"\nTrain Set:")
    print(f"  Period: {split_info['train_start'].strftime('%Y-%m-%d')} to {split_info['train_end'].strftime('%Y-%m-%d')}")
    print(f"  Days: {split_info['train_days']} ({split_info['train_ratio_actual']*100:.1f}% of data)")
    print(f"  Years: {split_info['train_days']/252:.1f}")
    print(f"  Unique regimes: {sorted(train_labels.unique().tolist())}")
    print(f"  Regime distribution:")
    for regime, count in train_labels.value_counts().sort_index().items():
        pct = (count / len(train_labels)) * 100
        print(f"    Regime {regime}: {count} days ({pct:.1f}%)")
    
    print(f"\nTest Set:")
    print(f"  Period: {split_info['test_start'].strftime('%Y-%m-%d')} to {split_info['test_end'].strftime('%Y-%m-%d')}")
    print(f"  Days: {split_info['test_days']} ({split_info['test_ratio_actual']*100:.1f}% of data)")
    print(f"  Years: {split_info['test_days']/252:.1f}")
    print(f"  Unique regimes: {sorted(test_labels.unique().tolist())}")
    print(f"  Regime distribution:")
    for regime, count in test_labels.value_counts().sort_index().items():
        pct = (count / len(test_labels)) * 100
        print(f"    Regime {regime}: {count} days ({pct:.1f}%)")
    
    print("\n" + "="*70)
    
    return split_info
