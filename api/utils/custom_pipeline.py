"""
Analysis pipeline for user-uploaded market data.
Runs fresh K-Means (K=4) + Markov Chain + HMM on user price data.
Results are stored in Supabase Storage (via api.utils.storage).
"""
import io
import sys
import json
import tempfile
import traceback
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA

# Ensure project root and src/ are importable
_project_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_project_root))
sys.path.insert(0, str(_project_root / "src"))

from api.utils.file_parser import parse_user_file
from api.utils import storage


# ── Regime name / colour mapping ─────────────────────────────────────────────

VOL_NAMES = {
    0: "Low Volatility",
    1: "Medium-Low",
    2: "Medium-High",
    3: "High Volatility",
}

VOL_COLORS = {
    0: "#10b981",  # green  – low vol
    1: "#8b5cf6",  # purple – medium-low
    2: "#f59e0b",  # amber  – medium-high
    3: "#ef4444",  # red    – high vol
}


# ── Status helper ─────────────────────────────────────────────────────────────

def _update_status(session_id: str, status: str, progress: int,
                   message: str, error: str = None):
    payload = {"status": status, "progress_pct": progress, "message": message}
    if error:
        payload["error"] = error
    storage.write_json(f"{session_id}/results/analysis_status.json", payload)


# ── Entry point ───────────────────────────────────────────────────────────────

def run_user_analysis(session_id: str, ext: str, contents: bytes):
    """
    Entry point called from background thread.
    `contents` is the raw bytes of the uploaded file (already in Supabase,
    but passed directly to avoid a redundant download round-trip).
    """
    try:
        _run(session_id, ext, contents)
    except Exception as exc:
        print(f"[custom_pipeline] ERROR for {session_id}: {traceback.format_exc()}")
        _update_status(session_id, "error", 0, "Analysis failed.", error=str(exc))


def _run(session_id: str, ext: str, contents: bytes):
    # ── Step 1: Parse uploaded file ──────────────────────────────────────────
    _update_status(session_id, "running", 5, "Parsing uploaded file…")

    # Write to a temp file so file_parser can detect format via extension
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        prices = parse_user_file(tmp_path)
    finally:
        import os
        os.unlink(tmp_path)

    n_rows, n_tickers = prices.shape
    tickers = prices.columns.tolist()

    # ── Step 2: Log returns + rolling volatility ─────────────────────────────
    _update_status(session_id, "running", 20, "Computing returns and rolling volatility…")
    log_ret = np.log(prices / prices.shift(1)).dropna()

    windows = [w for w in [21, 63, 126, 252] if w < len(log_ret)]
    if not windows:
        raise ValueError("Insufficient data for volatility windows.")

    vol_frames = {}
    for w in windows:
        rv = log_ret.rolling(w).std() * np.sqrt(252)
        rv.columns = [f"{c}_vol_{w}" for c in log_ret.columns]
        vol_frames[w] = rv

    vol_all = pd.concat(vol_frames.values(), axis=1)

    # ── Step 3: Rolling correlation ──────────────────────────────────────────
    _update_status(session_id, "running", 30, "Computing rolling correlation…")
    corr_window = 63
    if n_tickers >= 2:
        avg_corr = _rolling_avg_corr(log_ret, corr_window)
    else:
        avg_corr = pd.Series(0.0, index=log_ret.index,
                             name=f"avg_pairwise_corr_{corr_window}")

    # ── Step 4: Rolling PCA metrics ──────────────────────────────────────────
    _update_status(session_id, "running", 40, "Computing rolling PCA metrics…")
    pca_metrics = _rolling_pca_metrics(log_ret, window=63)

    # ── Step 5: Assemble feature matrix ──────────────────────────────────────
    _update_status(session_id, "running", 55, "Building feature matrix…")
    feature_window = 126 if 126 in windows else windows[-1]
    vol_cols = [c for c in vol_all.columns if c.endswith(f"_vol_{feature_window}")]
    avg_vol = vol_all[vol_cols].mean(axis=1)
    vol_disp = vol_all[vol_cols].std(axis=1).fillna(0)

    common_idx = (
        avg_vol.dropna().index
        .intersection(avg_corr.dropna().index)
        .intersection(pca_metrics.dropna(how="all").index)
    )

    if len(common_idx) < 63:
        raise ValueError(
            f"Only {len(common_idx)} dates have complete features (need ≥63). "
            "Try uploading more data."
        )

    X = pd.DataFrame({
        f"avg_vol_{feature_window}": avg_vol.loc[common_idx],
        f"vol_dispersion_{feature_window}": vol_disp.loc[common_idx],
        f"avg_pairwise_corr_{corr_window}": avg_corr.loc[common_idx],
        "PC1_var": pca_metrics.loc[common_idx, "PC1_var"],
        "cum_var_3": pca_metrics.loc[common_idx, "cum_var_3"],
        "effective_dimension": pca_metrics.loc[common_idx, "effective_dimension"],
    }).dropna()

    # ── Step 6: Normalize ────────────────────────────────────────────────────
    _update_status(session_id, "running", 65, "Normalizing features…")
    X_norm = X.copy()
    for col in X_norm.columns:
        mean, std = X_norm[col].mean(), X_norm[col].std()
        X_norm[col] = (X_norm[col] - mean) / std if std > 0 else 0.0

    # ── Step 7: K-Means (K=4) ────────────────────────────────────────────────
    _update_status(session_id, "running", 75, "Running K-Means clustering (K=4)…")
    from sklearn.cluster import KMeans
    km = KMeans(n_clusters=4, random_state=42, n_init=10)
    raw_labels = km.fit_predict(X_norm.values)
    labels = pd.Series(raw_labels, index=X_norm.index, name="regime")

    # Order regimes by ascending avg volatility
    vol_col = f"avg_vol_{feature_window}"
    regime_avg_vol = X.loc[X_norm.index, vol_col].groupby(labels).mean()
    vol_rank = regime_avg_vol.rank().astype(int) - 1
    label_map = {int(raw_id): int(vol_rank[raw_id]) for raw_id in regime_avg_vol.index}
    labels = labels.map(label_map)

    regime_label_map = {v: VOL_NAMES[v] for v in sorted(label_map.values())}
    regime_color_map = {v: VOL_COLORS[v] for v in sorted(label_map.values())}

    # Upload regime_label_map.json
    storage.write_json(f"{session_id}/results/regime_label_map.json",
                       {"names": regime_label_map, "colors": regime_color_map})

    # Upload regime_labels.csv
    storage.write_csv(f"{session_id}/results/regime_labels.csv",
                      labels.to_frame("regime"))

    # Upload regime_features.csv
    storage.write_csv(f"{session_id}/results/regime_features.csv", X_norm)

    # ── Step 8: Transition matrix + durations + performance ──────────────────
    _update_status(session_id, "running", 82, "Computing transition matrix…")
    from regime.transitions import compute_transition_matrix, compute_regime_durations
    trans_mat, trans_counts = compute_transition_matrix(labels)
    dur_stats = compute_regime_durations(labels)

    storage.write_json(f"{session_id}/results/transition_matrix.json", {
        "matrix": {str(i): {str(j): float(v) for j, v in row.items()}
                   for i, row in trans_mat.iterrows()},
        "counts": {str(i): {str(j): int(v) for j, v in row.items()}
                   for i, row in trans_counts.iterrows()},
    })

    perf_stats = _compute_performance(labels, prices)
    dur_export = {}
    for r_id, d in dur_stats.items():
        r_name = regime_label_map.get(int(r_id), str(r_id))
        dur_export[str(r_id)] = {
            "name": r_name,
            "mean_days": float(d["mean_days"]),
            "median_days": float(d["median_days"]),
            "min_days": int(d["min_days"]),
            "max_days": int(d["max_days"]),
            "total_days": int(d["total_days"]),
            "total_runs": int(d["total_runs"]),
        }

    storage.write_json(f"{session_id}/results/regime_stats.json", {
        "durations": dur_export,
        "performance": perf_stats,
    })

    # ── Step 9: Predictions ──────────────────────────────────────────────────
    _update_status(session_id, "running", 90, "Generating predictions…")
    from regime.predict import predict_next_regime_baseline
    current_regime = int(labels.iloc[-1])
    preds = {}
    for horizon in [1, 7, 30]:
        p = predict_next_regime_baseline(current_regime, trans_mat, n_steps=horizon)
        preds[f"{horizon}d"] = {
            "horizon_days": horizon,
            "predicted_regime": int(p["predicted_regime"]),
            "predicted_regime_name": regime_label_map.get(int(p["predicted_regime"]), ""),
            "confidence": float(p["confidence"]),
            "probabilities": {str(k): float(v) for k, v in p["probabilities"].items()},
            "model": "markov",
        }

    if len(labels) >= 252:
        try:
            hmm_preds = _fit_hmm_predictions(labels, trans_mat, regime_label_map)
            for key, val in hmm_preds.items():
                preds[key]["hmm"] = val
        except Exception as hmm_exc:
            print(f"[custom_pipeline] HMM failed (skipping): {hmm_exc}")

    storage.write_json(f"{session_id}/results/predictions.json",
                       {"current_regime": current_regime, "predictions": preds})

    # ── Step 10: Update metadata ─────────────────────────────────────────────
    _update_status(session_id, "running", 95, "Saving results…")
    meta = storage.read_json(f"{session_id}/results/dataset_meta.json")
    meta.update({
        "tickers": tickers,
        "row_count": int(n_rows),
        "feature_row_count": len(labels),
        "date_range": {
            "start": str(prices.index.min().date()),
            "end": str(prices.index.max().date()),
        },
        "current_regime": current_regime,
        "current_regime_name": regime_label_map.get(current_regime, ""),
        "regime_distribution": {
            str(r): int((labels == r).sum()) for r in range(4)
        },
    })
    storage.write_json(f"{session_id}/results/dataset_meta.json", meta)

    # ── Done ─────────────────────────────────────────────────────────────────
    _update_status(session_id, "complete", 100, "Analysis complete.")

    # Update user index with final metadata so listing is always fast
    try:
        user_id = meta.get("user_id")
        if user_id:
            storage.upsert_user_index_entry(user_id, {
                "session_id": session_id,
                "dataset_name": meta.get("dataset_name", ""),
                "original_filename": meta.get("original_filename"),
                "created_at": meta.get("created_at", ""),
                "status": "complete",
                "progress_pct": 100,
                "tickers": meta.get("tickers"),
                "date_range": meta.get("date_range"),
                "exists": True,
            })
    except Exception as _idx_exc:
        print(f"[custom_pipeline] Warning: failed to update user index: {_idx_exc}")

    print(f"[custom_pipeline] ✓ {session_id} complete ({len(labels)} feature rows)")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _rolling_avg_corr(log_ret: pd.DataFrame, window: int) -> pd.Series:
    n = len(log_ret.columns)
    if n < 2:
        return pd.Series(0.0, index=log_ret.index,
                         name=f"avg_pairwise_corr_{window}")

    cols = log_ret.columns[:30]
    data = log_ret[cols].values.astype(float)
    n_use = len(cols)
    n_dates = len(log_ret)
    idx = log_ret.index
    triu_i, triu_j = np.triu_indices(n_use, k=1)

    results = np.full(n_dates, np.nan)
    for i in range(window - 1, n_dates):
        w = data[i - window + 1: i + 1]
        valid = ~np.all(np.isnan(w), axis=0)
        w_valid = w[:, valid]
        if w_valid.shape[1] < 2:
            continue
        means = np.nanmean(w_valid, axis=0)
        stds = np.nanstd(w_valid, axis=0)
        stds[stds == 0] = 1.0
        w_std = (w_valid - means) / stds
        corr = np.dot(w_std.T, w_std) / (window - 1)
        nv = w_valid.shape[1]
        ti, tj = np.triu_indices(nv, k=1)
        results[i] = float(np.nanmean(corr[ti, tj]))

    return pd.Series(results, index=idx, name=f"avg_pairwise_corr_{window}")


def _rolling_pca_metrics(log_ret: pd.DataFrame, window: int) -> pd.DataFrame:
    n_tickers = log_ret.shape[1]
    n_components = min(n_tickers, 3)
    records = {}

    for i in range(window - 1, len(log_ret)):
        w_data = log_ret.iloc[i - window + 1: i + 1].dropna(axis=1, how="any")
        if w_data.shape[1] < 1 or w_data.shape[0] < 2:
            continue
        date = log_ret.index[i]
        n_comp_local = min(w_data.shape[1], n_components, w_data.shape[0] - 1)
        if n_comp_local < 1:
            continue
        try:
            pca = PCA(n_components=n_comp_local)
            pca.fit(w_data.values)
            exp_var = pca.explained_variance_ratio_
            pc1_var = float(exp_var[0])
            cum_var_3 = float(exp_var[:3].sum()) if len(exp_var) >= 3 else float(exp_var.sum())
            p = exp_var / exp_var.sum()
            eff_dim = 1.0 / float(np.sum(p ** 2)) if np.sum(p ** 2) > 0 else 1.0
            records[date] = {"PC1_var": pc1_var, "cum_var_3": cum_var_3,
                             "effective_dimension": eff_dim}
        except Exception:
            continue

    if not records:
        return pd.DataFrame({
            "PC1_var": 1.0, "cum_var_3": 1.0, "effective_dimension": 1.0,
        }, index=log_ret.index[window - 1:])

    return pd.DataFrame.from_dict(records, orient="index")


def _compute_performance(labels: pd.Series, prices: pd.DataFrame) -> dict:
    first_ticker = prices.columns[0]
    ret = prices[first_ticker].pct_change().dropna()
    common = labels.index.intersection(ret.index)
    labels_aligned = labels.loc[common]
    ret_aligned = ret.loc[common]

    perf = {}
    for r_id in sorted(labels.unique()):
        mask = labels_aligned == r_id
        r_ret = ret_aligned[mask]
        if len(r_ret) == 0:
            continue
        avg_ret = float(r_ret.mean())
        ann_vol = float(r_ret.std() * np.sqrt(252)) if r_ret.std() > 0 else 0.0
        sharpe = (avg_ret * 252) / ann_vol if ann_vol > 0 else 0.0
        perf[str(r_id)] = {
            "days": int(mask.sum()),
            "pct_time": float(mask.sum() / len(labels_aligned)),
            "avg_daily_return": avg_ret,
            "ann_vol": ann_vol,
            "sharpe": sharpe,
            "win_rate": float((r_ret > 0).mean()),
            "best_day": float(r_ret.max()),
            "worst_day": float(r_ret.min()),
        }
    return perf


def _fit_hmm_predictions(labels: pd.Series, trans_mat: pd.DataFrame,
                          regime_label_map: dict) -> dict:
    from hmmlearn import hmm
    import warnings

    X_seq = labels.values.reshape(-1, 1).astype(float)
    n_states = len(labels.unique())
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = hmm.GaussianHMM(n_components=n_states, covariance_type="full",
                                 n_iter=100, random_state=42)
        model.fit(X_seq)

    current_regime = int(labels.iloc[-1])
    hmm_preds = {}
    for horizon in [1, 7, 30]:
        trans_np = model.transmat_
        t_n = np.linalg.matrix_power(trans_np, horizon)
        current_idx = min(current_regime, n_states - 1)
        probs = t_n[current_idx]
        predicted_state = int(np.argmax(probs))
        hmm_preds[f"{horizon}d"] = {
            "predicted_regime": predicted_state,
            "predicted_regime_name": regime_label_map.get(predicted_state, ""),
            "confidence": float(probs[predicted_state]),
            "probabilities": {str(i): float(p) for i, p in enumerate(probs)},
        }
    return hmm_preds
