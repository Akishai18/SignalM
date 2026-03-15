"""
PCA analysis router — factor structure, loadings, component time series, regime scores
"""
from fastapi import APIRouter, HTTPException, Query
import pandas as pd
import numpy as np
from datetime import datetime
import os
import json
import re

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

router = APIRouter(prefix="/api/pca", tags=["pca"])

REGIME_NAMES = {0: "Calm", 1: "Crisis", 2: "Elevated Stress", 3: "Transition"}


def _load_precomputed(filename: str):
    path = os.path.join(_PROJECT_ROOT, "precomputed", f"{filename}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def _load_regime_labels() -> pd.Series:
    df = pd.read_csv(
        os.path.join(_PROJECT_ROOT, "regime_results", "regime_labels_k4.csv"),
        parse_dates=["Date"],
        index_col="Date",
    )
    return df["regime_k4"]


def _load_rolling_metrics() -> pd.DataFrame:
    return pd.read_csv(
        os.path.join(_PROJECT_ROOT, "pca_data", "rolling_pca_metrics.csv"),
        parse_dates=["Date"],
        index_col="Date",
    )


def _load_components() -> pd.DataFrame:
    df = pd.read_csv(
        os.path.join(_PROJECT_ROOT, "pca_data", "pca_components.csv"),
        index_col=0,
    )
    df.index = pd.to_datetime(df.index)
    return df


def _load_loadings() -> pd.DataFrame:
    return pd.read_csv(
        os.path.join(_PROJECT_ROOT, "pca_data", "pca_loadings.csv"),
        index_col=0,
    )


@router.get("/structure")
def get_full_pca_structure():
    """Rolling PC1, PC2, PC3 variance + cumulative variance + effective dimension."""
    cached = _load_precomputed("pca_structure_full")
    if cached:
        return cached

    metrics_path = os.path.join(_PROJECT_ROOT, "pca_data", "rolling_pca_metrics.csv")
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="PCA rolling metrics not found")

    df = _load_rolling_metrics()
    cutoff = df.index[-1] - pd.DateOffset(years=3)
    recent = df[df.index >= cutoff]

    points = [
        {
            "date": d.strftime("%Y-%m-%d"),
            "pc1_var": float(row["PC1_var"]),
            "pc2_var": float(row.get("PC2_var", 0)),
            "pc3_var": float(row.get("PC3_var", 0)),
            "cum_var_3": float(row["cum_var_3"]),
            "effective_dimension": float(row["eff_dim"]),
        }
        for d, row in recent.iterrows()
    ]

    last = df.iloc[-1]
    summary = {
        "current_pc1_var": float(last["PC1_var"]),
        "current_pc2_var": float(last.get("PC2_var", 0)),
        "current_pc3_var": float(last.get("PC3_var", 0)),
        "current_cum_var_3": float(last["cum_var_3"]),
        "current_eff_dim": float(last["eff_dim"]),
    }

    return {"points": points, "summary": summary}


@router.get("/loadings")
def get_pca_loadings(top_n: int = Query(12, ge=5, le=30)):
    """
    Top N features by absolute loading for PC1, PC2, PC3.
    Uses 252-day window features only for clean long-run signal.
    """
    cached = _load_precomputed(f"pca_loadings_top{top_n}")
    if cached:
        return cached

    loadings_path = os.path.join(_PROJECT_ROOT, "pca_data", "pca_loadings.csv")
    if not os.path.exists(loadings_path):
        raise HTTPException(status_code=404, detail="PCA loadings not found")

    loadings = _load_loadings()

    # Filter to 252d window features + correlation/dispersion features
    # This gives cleaner long-run signal (172 stocks + 8 market-level features)
    mask_252 = loadings.index.str.endswith("_vol_252")
    mask_market = ~loadings.index.str.contains(r"_vol_\d+")
    loadings_filtered = loadings[mask_252 | mask_market]

    # Clean feature names for display (strip _vol_252 suffix)
    def clean_name(feat: str) -> str:
        return re.sub(r"_vol_252$", "", feat)

    result = {}
    for pc in ["PC1", "PC2", "PC3"]:
        if pc not in loadings_filtered.columns:
            continue
        top_features = loadings_filtered[pc].abs().nlargest(top_n).index
        result[pc] = [
            {
                "feature": clean_name(feat),
                "raw_feature": feat,
                "loading": float(loadings_filtered.loc[feat, pc]),
            }
            for feat in top_features
        ]

    # Current variance explained from rolling metrics
    metrics_path = os.path.join(_PROJECT_ROOT, "pca_data", "rolling_pca_metrics.csv")
    variance_explained = {}
    if os.path.exists(metrics_path):
        metrics = _load_rolling_metrics()
        last = metrics.iloc[-1]
        variance_explained = {
            "PC1": float(last["PC1_var"]),
            "PC2": float(last.get("PC2_var", 0)),
            "PC3": float(last.get("PC3_var", 0)),
        }

    return {
        "loadings": result,
        "variance_explained": variance_explained,
        "top_n": top_n,
        "total_features": int(len(loadings)),
    }


@router.get("/components")
def get_pca_components():
    """PC1, PC2, PC3 score time series with regime labels — last 3 years."""
    cached = _load_precomputed("pca_components_recent")
    if cached:
        return cached

    comp_path = os.path.join(_PROJECT_ROOT, "pca_data", "pca_components.csv")
    if not os.path.exists(comp_path):
        raise HTTPException(status_code=404, detail="PCA components not found")

    components = _load_components()
    regimes = _load_regime_labels()

    cutoff = components.index[-1] - pd.DateOffset(years=3)
    recent = components[components.index >= cutoff]

    has_pc = {pc: pc in recent.columns for pc in ["PC1", "PC2", "PC3"]}

    points = []
    for d, row in recent.iterrows():
        regime = int(regimes.loc[d]) if d in regimes.index else None
        points.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "pc1": float(row["PC1"]) if has_pc["PC1"] else None,
                "pc2": float(row["PC2"]) if has_pc["PC2"] else None,
                "pc3": float(row["PC3"]) if has_pc["PC3"] else None,
                "regime": regime,
                "regime_name": REGIME_NAMES.get(regime, "Unknown")
                if regime is not None
                else None,
            }
        )

    return {"points": points}


@router.get("/regime-scores")
def get_regime_pca_scores():
    """Average PC1/PC2/PC3 scores per regime over the full history."""
    cached = _load_precomputed("pca_regime_scores")
    if cached:
        return cached

    comp_path = os.path.join(_PROJECT_ROOT, "pca_data", "pca_components.csv")
    if not os.path.exists(comp_path):
        raise HTTPException(status_code=404, detail="PCA components not found")

    components = _load_components()
    regimes = _load_regime_labels()

    common = components.index.intersection(regimes.index)
    comp_aligned = components.loc[common, ["PC1", "PC2", "PC3"]]
    reg_aligned = regimes.loc[common]

    result = []
    for regime_id, name in REGIME_NAMES.items():
        mask = reg_aligned == regime_id
        subset = comp_aligned[mask]
        if len(subset) == 0:
            continue
        result.append(
            {
                "regime_id": regime_id,
                "regime_name": name,
                "count": int(len(subset)),
                "pc1_mean": float(subset["PC1"].mean()),
                "pc1_std": float(subset["PC1"].std()),
                "pc2_mean": float(subset["PC2"].mean()),
                "pc2_std": float(subset["PC2"].std()),
                "pc3_mean": float(subset["PC3"].mean()),
                "pc3_std": float(subset["PC3"].std()),
            }
        )

    return {"regimes": result}


@router.get("/scatter")
def get_pca_scatter(downsample: int = Query(3, ge=1, le=10)):
    """
    PC1 vs PC2 scatter data colored by regime.
    Downsampled every N days for frontend performance.
    """
    cached = _load_precomputed(f"pca_scatter_ds{downsample}")
    if cached:
        return cached

    comp_path = os.path.join(_PROJECT_ROOT, "pca_data", "pca_components.csv")
    if not os.path.exists(comp_path):
        raise HTTPException(status_code=404, detail="PCA components not found")

    components = _load_components()
    regimes = _load_regime_labels()

    common = components.index.intersection(regimes.index)
    has_pc3 = "PC3" in components.columns
    cols = ["PC1", "PC2", "PC3"] if has_pc3 else ["PC1", "PC2"]
    comp_aligned = components.loc[common, cols].iloc[::downsample]
    reg_aligned = regimes.loc[common].iloc[::downsample]

    points = [
        {
            "pc1": float(comp_aligned.loc[d, "PC1"]),
            "pc2": float(comp_aligned.loc[d, "PC2"]),
            "pc3": float(comp_aligned.loc[d, "PC3"]) if has_pc3 else None,
            "regime": int(reg_aligned.loc[d]),
            "regime_name": REGIME_NAMES.get(int(reg_aligned.loc[d]), "Unknown"),
            "date": d.strftime("%Y-%m-%d"),
        }
        for d in comp_aligned.index
    ]

    # Current variance explained
    metrics_path = os.path.join(_PROJECT_ROOT, "pca_data", "rolling_pca_metrics.csv")
    variance_explained = {"PC1": 0.37, "PC2": 0.18, "PC3": 0.10}
    if os.path.exists(metrics_path):
        metrics = _load_rolling_metrics()
        last = metrics.iloc[-1]
        variance_explained = {
            "PC1": float(last["PC1_var"]),
            "PC2": float(last.get("PC2_var", 0)),
            "PC3": float(last.get("PC3_var", 0)),
        }

    return {"points": points, "variance_explained": variance_explained}
