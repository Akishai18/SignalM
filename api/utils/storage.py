"""
Supabase Storage abstraction for SignalM user datasets.
All user-uploaded files and analysis results live in the 'signalm-datasets' bucket.

Path layout:
  {session_id}/raw/original_upload.{ext}
  {session_id}/results/analysis_status.json
  {session_id}/results/dataset_meta.json
  {session_id}/results/regime_labels.csv
  {session_id}/results/regime_features.csv
  {session_id}/results/regime_label_map.json
  {session_id}/results/transition_matrix.json
  {session_id}/results/regime_stats.json
  {session_id}/results/predictions.json

Env vars required:
  SUPABASE_URL          — project URL (https://xxx.supabase.co)
  SUPABASE_SERVICE_KEY  — service_role secret key (never the anon key)
"""
import io
import json
import os

import pandas as pd
from supabase import create_client, Client

BUCKET = "Datasets"


def _client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set."
        )
    return create_client(url, key)


# ── Low-level byte helpers ────────────────────────────────────────────────────

def upload_bytes(path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    """Upload raw bytes to Supabase Storage (upsert — overwrites existing)."""
    response = _client().storage.from_(BUCKET).upload(
        path=path,
        file=data,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    # supabase-py v2 returns an object, not raises — check for errors explicitly
    if hasattr(response, "error") and response.error:
        raise RuntimeError(f"Supabase upload failed for '{path}': {response.error}")
    print(f"[storage] uploaded: {path} ({len(data)} bytes)")


def download_bytes(path: str) -> bytes:
    """Download a file from Supabase Storage and return raw bytes."""
    response = _client().storage.from_(BUCKET).download(path)
    if isinstance(response, dict) and response.get("error"):
        raise FileNotFoundError(f"Supabase file not found: '{path}': {response['error']}")
    return response


def path_exists(path: str) -> bool:
    """Return True if the file exists in storage."""
    try:
        download_bytes(path)
        return True
    except Exception as e:
        print(f"[storage] path_exists({path}) → False ({e})")
        return False


# ── JSON helpers ──────────────────────────────────────────────────────────────

def write_json(path: str, obj: dict) -> None:
    upload_bytes(path, json.dumps(obj).encode("utf-8"), "application/json")


def read_json(path: str) -> dict:
    return json.loads(download_bytes(path).decode("utf-8"))


# ── CSV / DataFrame helpers ───────────────────────────────────────────────────

def write_csv(path: str, df: pd.DataFrame) -> None:
    buf = io.StringIO()
    df.to_csv(buf)
    upload_bytes(path, buf.getvalue().encode("utf-8"), "text/csv")


def read_csv(path: str, **kwargs) -> pd.DataFrame:
    data = download_bytes(path)
    return pd.read_csv(io.BytesIO(data), **kwargs)


# ── Session management ────────────────────────────────────────────────────────

def delete_session(session_id: str) -> None:
    """Delete every file belonging to a session."""
    storage = _client().storage.from_(BUCKET)
    for folder in ("raw", "results"):
        prefix = f"{session_id}/{folder}"
        try:
            entries = storage.list(prefix) or []
            paths = [f"{prefix}/{e['name']}" for e in entries if e.get("name")]
            if paths:
                storage.remove(paths)
        except Exception:
            pass
