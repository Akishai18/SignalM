"""
Custom Data Upload & Analysis Router
Handles user-uploaded market data: upload, status polling, and result retrieval.
All files stored in Supabase Storage (signalm-datasets bucket).
"""
import io
import json
import uuid
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import sys
import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

# Ensure src/ is importable (for regime.* imports within the pipeline)
_src_path = str(Path(__file__).resolve().parents[2] / "src")
if _src_path not in sys.path:
    sys.path.insert(0, _src_path)

from api.utils import storage

router = APIRouter(prefix="/api/custom", tags=["custom_data"])


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_name: str = Form(...),
):
    """Accept a CSV/Excel/JSON file, kick off background analysis."""
    allowed_ext = {".csv", ".xlsx", ".xls", ".json"}
    ext = Path(file.filename or "upload").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: CSV, Excel, JSON."
        )

    contents = await file.read()
    if len(contents) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 200 MB limit.")

    session_id = str(uuid.uuid4())

    # Upload raw file to Supabase
    raw_path = f"{session_id}/raw/original_upload{ext}"
    storage.upload_bytes(raw_path, contents)

    # Write initial status
    storage.write_json(f"{session_id}/results/analysis_status.json", {
        "status": "pending", "progress_pct": 0, "message": "Queued for analysis…"
    })

    # Write initial metadata
    storage.write_json(f"{session_id}/results/dataset_meta.json", {
        "session_id": session_id,
        "dataset_name": dataset_name,
        "original_filename": file.filename,
        "file_size_bytes": len(contents),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Launch background analysis thread
    t = threading.Thread(
        target=_run_analysis_thread,
        args=(session_id, ext, contents),
        daemon=True,
    )
    t.start()

    return {"session_id": session_id, "status": "pending", "dataset_name": dataset_name}


def _run_analysis_thread(session_id: str, ext: str, contents: bytes):
    try:
        from api.utils.custom_pipeline import run_user_analysis
        run_user_analysis(session_id, ext, contents)
    except Exception as exc:
        import traceback
        print(f"[custom_data] Thread error for {session_id}: {traceback.format_exc()}")
        try:
            storage.write_json(f"{session_id}/results/analysis_status.json", {
                "status": "error", "progress_pct": 0,
                "message": "Analysis failed.", "error": str(exc),
            })
        except Exception:
            pass


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/status")
def get_status(session_id: str):
    path = f"{session_id}/results/analysis_status.json"
    if not storage.path_exists(path):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return storage.read_json(path)


# ── Metadata ──────────────────────────────────────────────────────────────────

@router.get("/{session_id}/meta")
def get_meta(session_id: str):
    path = f"{session_id}/results/dataset_meta.json"
    if not storage.path_exists(path):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return storage.read_json(path)


# ── List datasets ─────────────────────────────────────────────────────────────

@router.get("/list")
def list_datasets(ids: str = ""):
    """Return metadata for all requested session IDs (comma-separated)."""
    if not ids:
        return []
    requested = [i.strip() for i in ids.split(",") if i.strip()]
    results = []
    for sid in requested:
        meta_path = f"{sid}/results/dataset_meta.json"
        status_path = f"{sid}/results/analysis_status.json"
        if not storage.path_exists(meta_path):
            results.append({"session_id": sid, "exists": False})
            continue
        meta = storage.read_json(meta_path)
        if storage.path_exists(status_path):
            status = storage.read_json(status_path)
            meta["status"] = status.get("status", "unknown")
            meta["progress_pct"] = status.get("progress_pct", 0)
        meta["exists"] = True
        results.append(meta)
    return results


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{session_id}")
def delete_dataset(session_id: str):
    if not storage.path_exists(f"{session_id}/results/analysis_status.json"):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    storage.delete_session(session_id)
    return {"deleted": True, "session_id": session_id}


# ── Analysis result helpers ───────────────────────────────────────────────────

def _require_complete(session_id: str) -> str:
    """Raise 404/409 if session doesn't exist or analysis isn't complete.
    Returns session_id for use as storage prefix."""
    status_path = f"{session_id}/results/analysis_status.json"
    if not storage.path_exists(status_path):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    status = storage.read_json(status_path)
    if status.get("status") != "complete":
        raise HTTPException(
            status_code=409,
            detail=f"Analysis not complete (status: {status.get('status')})"
        )
    return session_id


def _read_labels_series(session_id: str) -> pd.Series:
    df = storage.read_csv(f"{session_id}/results/regime_labels.csv",
                          index_col=0, parse_dates=True)
    return df["regime"]


def _read_labels_df(session_id: str) -> pd.DataFrame:
    return storage.read_csv(f"{session_id}/results/regime_labels.csv",
                            index_col=0, parse_dates=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/{session_id}/overview")
def get_overview(session_id: str):
    _require_complete(session_id)
    meta = storage.read_json(f"{session_id}/results/dataset_meta.json")
    label_map = storage.read_json(f"{session_id}/results/regime_label_map.json")
    labels = _read_labels_series(session_id)

    dist = {str(r): int((labels == r).sum()) for r in sorted(labels.unique())}
    pct = {r: int(v) / len(labels) for r, v in dist.items()}

    return {
        "session_id": session_id,
        "dataset_name": meta.get("dataset_name"),
        "tickers": meta.get("tickers", []),
        "row_count": meta.get("row_count"),
        "feature_row_count": meta.get("feature_row_count"),
        "date_range": meta.get("date_range"),
        "current_regime": meta.get("current_regime"),
        "current_regime_name": meta.get("current_regime_name"),
        "regime_label_map": label_map.get("names", {}),
        "regime_color_map": label_map.get("colors", {}),
        "regime_distribution": dist,
        "regime_distribution_pct": pct,
    }


@router.get("/{session_id}/history")
def get_history(session_id: str):
    _require_complete(session_id)
    label_map = storage.read_json(f"{session_id}/results/regime_label_map.json")
    names = {int(k): v for k, v in label_map.get("names", {}).items()}
    colors = {int(k): v for k, v in label_map.get("colors", {}).items()}

    labels_df = _read_labels_df(session_id)
    records = []
    for date, row in labels_df.iterrows():
        r_id = int(row["regime"])
        records.append({
            "date": str(date.date()),
            "regime": r_id,
            "regime_name": names.get(r_id, str(r_id)),
            "color": colors.get(r_id, "#6b7280"),
        })
    return {"history": records}


@router.get("/{session_id}/transitions")
def get_transitions(session_id: str):
    _require_complete(session_id)
    trans_data = storage.read_json(f"{session_id}/results/transition_matrix.json")
    stats = storage.read_json(f"{session_id}/results/regime_stats.json")
    label_map = storage.read_json(f"{session_id}/results/regime_label_map.json")

    return {
        "transition_matrix": trans_data["matrix"],
        "transition_counts": trans_data["counts"],
        "durations": stats.get("durations", {}),
        "regime_label_map": label_map.get("names", {}),
    }


@router.get("/{session_id}/performance")
def get_performance(session_id: str):
    _require_complete(session_id)
    stats = storage.read_json(f"{session_id}/results/regime_stats.json")
    label_map = storage.read_json(f"{session_id}/results/regime_label_map.json")

    names = {str(k): v for k, v in label_map.get("names", {}).items()}
    perf = stats.get("performance", {})
    dur = stats.get("durations", {})

    rows = []
    for r_id, p in perf.items():
        rows.append({
            "regime_id": int(r_id),
            "regime_name": names.get(r_id, r_id),
            **p,
            "mean_duration_days": dur.get(r_id, {}).get("mean_days"),
        })
    return {"performance": rows}


@router.get("/{session_id}/features")
def get_features(session_id: str):
    _require_complete(session_id)
    labels_df = _read_labels_df(session_id)
    features_df = storage.read_csv(f"{session_id}/results/regime_features.csv",
                                   index_col=0, parse_dates=True)

    common_idx = labels_df.index.intersection(features_df.index)
    features_df = features_df.loc[common_idx]
    labels_aligned = labels_df.loc[common_idx, "regime"]

    records = []
    for date, row in features_df.iterrows():
        rec = {"date": str(date.date()), "regime": int(labels_aligned.loc[date])}
        rec.update({k: float(v) for k, v in row.items()})
        records.append(rec)
    return {"features": records}


@router.get("/{session_id}/predictions")
def get_predictions(session_id: str):
    _require_complete(session_id)
    preds = storage.read_json(f"{session_id}/results/predictions.json")
    label_map = storage.read_json(f"{session_id}/results/regime_label_map.json")

    return {
        "current_regime": preds.get("current_regime"),
        "predictions": preds.get("predictions", {}),
        "regime_label_map": label_map.get("names", {}),
        "regime_color_map": label_map.get("colors", {}),
    }


# ── Custom-horizon prediction ─────────────────────────────────────────────────

@router.get("/{session_id}/predict")
def predict_custom_horizon(session_id: str, horizon: int = 30):
    if horizon < 1 or horizon > 1095:
        raise HTTPException(status_code=400, detail="horizon must be 1–1095")

    _require_complete(session_id)
    trans_data = storage.read_json(f"{session_id}/results/transition_matrix.json")
    stored = storage.read_json(f"{session_id}/results/predictions.json")
    label_map = storage.read_json(f"{session_id}/results/regime_label_map.json")

    names = {int(k): v for k, v in label_map.get("names", {}).items()}
    colors = {int(k): v for k, v in label_map.get("colors", {}).items()}
    current_regime = stored.get("current_regime", 0)

    mat_raw = trans_data["matrix"]
    regimes = sorted(int(k) for k in mat_raw.keys())
    trans_df = pd.DataFrame(
        [[mat_raw[str(i)].get(str(j), 0.0) for j in regimes] for i in regimes],
        index=regimes, columns=regimes, dtype=float
    )

    from regime.predict import predict_next_regime_baseline
    p = predict_next_regime_baseline(current_regime, trans_df, n_steps=horizon)

    result = {
        "current_regime": current_regime,
        "horizon": horizon,
        "markov": {
            "predicted_regime": int(p["predicted_regime"]),
            "predicted_regime_name": names.get(int(p["predicted_regime"]), ""),
            "confidence": float(p["confidence"]),
            "probabilities": {str(k): float(v) for k, v in p["probabilities"].items()},
        },
        "regime_label_map": {str(k): v for k, v in names.items()},
        "regime_color_map": {str(k): v for k, v in colors.items()},
    }

    stored_preds = stored.get("predictions", {})
    nearest_key = min(["1d", "7d", "30d"], key=lambda k: abs(int(k[:-1]) - horizon))
    nearest = stored_preds.get(nearest_key, {})
    if nearest.get("hmm"):
        result["hmm"] = nearest["hmm"]
        result["hmm_note"] = f"HMM shown for nearest stored horizon ({nearest_key})"

    return result


@router.get("/{session_id}/predict/trajectory")
def predict_trajectory(session_id: str, horizon: int = 30):
    if horizon < 1 or horizon > 1095:
        raise HTTPException(status_code=400, detail="horizon must be 1–1095")

    _require_complete(session_id)
    trans_data = storage.read_json(f"{session_id}/results/transition_matrix.json")
    stored = storage.read_json(f"{session_id}/results/predictions.json")
    label_map = storage.read_json(f"{session_id}/results/regime_label_map.json")

    names = {int(k): v for k, v in label_map.get("names", {}).items()}
    colors = {int(k): v for k, v in label_map.get("colors", {}).items()}
    current_regime = stored.get("current_regime", 0)

    mat_raw = trans_data["matrix"]
    regimes = sorted(int(k) for k in mat_raw.keys())
    trans_df = pd.DataFrame(
        [[mat_raw[str(i)].get(str(j), 0.0) for j in regimes] for i in regimes],
        index=regimes, columns=regimes, dtype=float
    )

    from regime.predict import predict_next_regime_baseline

    sample_days = _sample_days(horizon, max_points=120)
    points = []
    for day in sample_days:
        p = predict_next_regime_baseline(current_regime, trans_df, n_steps=day)
        points.append({
            "day": day,
            "predicted_regime": int(p["predicted_regime"]),
            "regime_name": names.get(int(p["predicted_regime"]), ""),
            "color": colors.get(int(p["predicted_regime"]), "#6b7280"),
            "confidence": float(p["confidence"]),
            "probabilities": {
                names.get(int(k), str(k)): float(v)
                for k, v in p["probabilities"].items()
            },
        })

    return {
        "current_regime": current_regime,
        "horizon": horizon,
        "points": points,
        "regime_label_map": {str(k): v for k, v in names.items()},
        "regime_color_map": {str(k): v for k, v in colors.items()},
    }


def _sample_days(horizon: int, max_points: int) -> list:
    if horizon <= max_points:
        return list(range(1, horizon + 1))
    step = horizon / max_points
    return sorted(set(max(1, round(i * step)) for i in range(1, max_points + 1)))
