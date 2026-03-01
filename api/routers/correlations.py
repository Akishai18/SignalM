"""
Correlation analysis router — sector ETF correlations, rolling metrics, PCA structure
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import pandas as pd
import numpy as np
from datetime import datetime
import os
import json


def _load_precomputed(filename: str):
    """Try to load a precomputed JSON file. Returns dict or None."""
    path = os.path.join('precomputed', f'{filename}.json')
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return None

router = APIRouter(prefix="/api/correlations", tags=["correlations"])

# Sector ETF ticker → display name
SECTOR_MAP = {
    'XLK': 'Technology',
    'XLF': 'Financials',
    'XLV': 'Healthcare',
    'XLE': 'Energy',
    'XLY': 'Consumer Disc',
    'XLI': 'Industrials',
    'XLP': 'Consumer Staples',
    'XLU': 'Utilities',
    'XLB': 'Materials',
    'XLC': 'Communication',
    'XLRE': 'Real Estate',
}

SECTOR_TICKERS = list(SECTOR_MAP.keys())

REGIME_NAMES = {0: 'Calm', 1: 'Crisis', 2: 'Elevated Stress', 3: 'Transition'}


def _load_sector_prices() -> pd.DataFrame:
    """Load all sector ETF close prices into a single DataFrame."""
    frames = {}
    for ticker in SECTOR_TICKERS:
        path = f"data/sectors/{ticker.lower()}_data.csv"
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path, parse_dates=['Date'])
        df['Date'] = pd.to_datetime(df['Date'], utc=True).dt.tz_localize(None)
        df = df.set_index('Date').sort_index()
        frames[ticker] = df['close']
    prices = pd.DataFrame(frames).dropna()
    prices.index = prices.index.normalize()  # strip time component
    return prices


def _load_regime_labels() -> pd.Series:
    """Load regime labels."""
    df = pd.read_csv('regime_results/regime_labels_k4.csv', parse_dates=['Date'], index_col='Date')
    return df['regime_k4']


@router.get("/sector-matrix")
def get_sector_matrix(
    window: int = Query(63, ge=5, le=504),
    method: str = Query('pearson', pattern='^(pearson|spearman|kendall)$'),
):
    """11x11 sector correlation matrix from real ETF data."""
    # Try precomputed first
    cached = _load_precomputed(f'sector_matrix_{window}d_{method}')
    if cached:
        return cached

    prices = _load_sector_prices()

    # Use last `window` trading days of returns
    returns = np.log(prices).diff().iloc[1:]
    if len(returns) < window:
        recent = returns
    else:
        recent = returns.iloc[-window:]

    corr = recent.corr(method=method)

    # Build ordered arrays
    sectors = [SECTOR_MAP[t] for t in SECTOR_TICKERS if t in corr.columns]
    tickers_present = [t for t in SECTOR_TICKERS if t in corr.columns]
    matrix = corr.loc[tickers_present, tickers_present].values

    # Stats (upper triangle only, exclude diagonal)
    n = len(tickers_present)
    upper = matrix[np.triu_indices(n, k=1)]

    return {
        "sectors": sectors,
        "tickers": tickers_present,
        "matrix": matrix.tolist(),
        "stats": {
            "mean": float(np.nanmean(upper)),
            "max": float(np.nanmax(upper)),
            "min": float(np.nanmin(upper)),
            "std": float(np.nanstd(upper)),
        },
        "window": window,
        "method": method,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/rolling")
def get_rolling_correlation():
    """Rolling average pairwise correlation across sector ETFs for 3 windows."""
    cached = _load_precomputed('rolling_correlation')
    if cached:
        return cached

    prices = _load_sector_prices()
    returns = np.log(prices).diff().iloc[1:]

    windows = [21, 63, 252]
    result_points = []

    # Pre-compute rolling correlations for each window
    rolling_data: dict[int, pd.Series] = {}
    for w in windows:
        corrs = []
        dates = []
        for i in range(w - 1, len(returns)):
            chunk = returns.iloc[i - w + 1:i + 1]
            cm = chunk.corr().values
            n = cm.shape[0]
            ut = cm[np.triu_indices(n, k=1)]
            corrs.append(float(np.nanmean(ut)))
            dates.append(returns.index[i])
        rolling_data[w] = pd.Series(corrs, index=dates)

    # Last 3 years
    cutoff = returns.index[-1] - pd.DateOffset(years=3)
    all_dates = sorted(set().union(*(s.index for s in rolling_data.values())))
    all_dates = [d for d in all_dates if d >= cutoff]

    for d in all_dates:
        point = {"date": d.strftime('%Y-%m-%d')}
        for w in windows:
            s = rolling_data[w]
            point[f"corr_{w}d"] = float(s.loc[d]) if d in s.index else None
        result_points.append(point)

    return {"points": result_points}


@router.get("/regime-correlation")
def get_regime_correlation():
    """Avg correlation time series colored by regime."""
    cached = _load_precomputed('regime_correlation')
    if cached:
        return cached

    prices = _load_sector_prices()
    returns = np.log(prices).diff().iloc[1:]
    regimes = _load_regime_labels()

    # 63-day rolling avg pairwise correlation
    w = 63
    corrs = []
    dates = []
    for i in range(w - 1, len(returns)):
        chunk = returns.iloc[i - w + 1:i + 1]
        cm = chunk.corr().values
        n = cm.shape[0]
        ut = cm[np.triu_indices(n, k=1)]
        corrs.append(float(np.nanmean(ut)))
        dates.append(returns.index[i])

    corr_series = pd.Series(corrs, index=dates)

    # Align with regimes
    common = corr_series.index.intersection(regimes.index)
    cutoff = common[-1] - pd.DateOffset(years=3)
    common = common[common >= cutoff]

    points = []
    for d in common:
        r = int(regimes.loc[d])
        points.append({
            "date": d.strftime('%Y-%m-%d'),
            "avg_correlation": float(corr_series.loc[d]),
            "regime": r,
            "regime_name": REGIME_NAMES.get(r, 'Unknown'),
        })

    return {"points": points}


@router.get("/pca-structure")
def get_pca_structure():
    """Rolling PCA metrics — PC1 variance, cumulative variance, effective dimension."""
    cached = _load_precomputed('pca_structure')
    if cached:
        return cached

    path = "pca_data/rolling_pca_metrics.csv"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="PCA metrics not found")
    df = pd.read_csv(path, parse_dates=['Date'], index_col='Date')

    # Last 3 years
    cutoff = df.index[-1] - pd.DateOffset(years=3)
    recent = df[df.index >= cutoff]

    points = [
        {
            "date": d.strftime('%Y-%m-%d'),
            "pc1_var": float(row['PC1_var']),
            "cum_var_3": float(row['cum_var_3']),
            "effective_dimension": float(row['eff_dim']),
        }
        for d, row in recent.iterrows()
    ]

    return {"points": points}


@router.get("/sector-pair-detail")
def get_sector_pair_detail(
    sector1: str = Query('XLK'),
    sector2: str = Query('XLE'),
):
    """Rolling 63-day correlation between two specific sectors."""
    s1 = sector1.upper()
    s2 = sector2.upper()

    # Try precomputed (try both orderings)
    cached = _load_precomputed(f'sector_pair_{s1}_{s2}') or _load_precomputed(f'sector_pair_{s2}_{s1}')
    if cached:
        return cached

    prices = _load_sector_prices()

    if s1 not in prices.columns or s2 not in prices.columns:
        raise HTTPException(status_code=404, detail=f"Sector {s1} or {s2} not found")

    returns = np.log(prices[[s1, s2]]).diff().iloc[1:]
    w = 63
    corrs = returns[s1].rolling(w).corr(returns[s2])
    corrs = corrs.dropna()

    # Last 3 years
    cutoff = corrs.index[-1] - pd.DateOffset(years=3)
    recent = corrs[corrs.index >= cutoff]

    points = [
        {"date": d.strftime('%Y-%m-%d'), "correlation": float(v)}
        for d, v in recent.items()
    ]

    return {
        "sector1": s1,
        "sector1_name": SECTOR_MAP.get(s1, s1),
        "sector2": s2,
        "sector2_name": SECTOR_MAP.get(s2, s2),
        "current_correlation": float(recent.iloc[-1]) if len(recent) > 0 else None,
        "points": points,
    }
