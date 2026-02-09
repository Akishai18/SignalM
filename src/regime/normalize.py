# Time-series normalization helpers
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler

def zscore_time(df):
    
    #Z-score normalize **over time (per feature)**. Do NOT use cross-sectional z-score.
    #Returns normalized DataFrame with same shape/index/columns.
    
    out = df.copy()
    for col in out.columns:
        out[col] = (out[col] - out[col].mean()) / out[col].std()
    return out

# Or, with sklearn:
def zscore_time_sklearn(df):
    scaler = StandardScaler()
    arr = scaler.fit_transform(df.values)
    return pd.DataFrame(arr, index=df.index, columns=df.columns)

