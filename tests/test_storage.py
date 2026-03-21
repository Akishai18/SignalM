"""
Tests for api/utils/storage.py
Uses mocking — does not hit real Supabase (safe to run without credentials).
"""
import json
import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock, patch


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_client():
    """Return a mock Supabase client wired up to storage."""
    client = MagicMock()
    bucket = MagicMock()
    client.storage.from_.return_value = bucket
    return client, bucket


# ── upload_bytes ──────────────────────────────────────────────────────────────

def test_upload_bytes_calls_supabase(mock_client):
    client, bucket = mock_client
    bucket.upload.return_value = MagicMock(error=None)

    with patch("api.utils.storage._client", return_value=client):
        from api.utils.storage import upload_bytes
        upload_bytes("test/path.json", b'{"hello": 1}', "application/json")

    bucket.upload.assert_called_once()
    args = bucket.upload.call_args
    assert args.kwargs["path"] == "test/path.json"
    assert args.kwargs["file"] == b'{"hello": 1}'


def test_upload_bytes_raises_on_error(mock_client):
    client, bucket = mock_client
    err = MagicMock()
    err.error = "Unauthorized"
    bucket.upload.return_value = err

    with patch("api.utils.storage._client", return_value=client):
        from api.utils.storage import upload_bytes
        with pytest.raises(RuntimeError, match="Supabase upload failed"):
            upload_bytes("test/path.json", b"data")


# ── write_json / read_json ────────────────────────────────────────────────────

def test_write_read_json_roundtrip(mock_client):
    client, bucket = mock_client
    payload = {"status": "complete", "progress_pct": 100}
    stored = []

    def fake_upload(**kwargs):
        stored.append(kwargs["file"])
        return MagicMock(error=None)

    bucket.upload.side_effect = fake_upload
    bucket.download.return_value = stored[0] if stored else None

    with patch("api.utils.storage._client", return_value=client):
        from api.utils.storage import write_json
        write_json("session/results/status.json", payload)

    assert len(stored) == 1
    assert json.loads(stored[0]) == payload


# ── path_exists ───────────────────────────────────────────────────────────────

def test_path_exists_true(mock_client):
    client, bucket = mock_client
    bucket.download.return_value = b"some content"

    with patch("api.utils.storage._client", return_value=client):
        from api.utils.storage import path_exists
        assert path_exists("session/results/status.json") is True


def test_path_exists_false(mock_client):
    client, bucket = mock_client
    bucket.download.side_effect = Exception("not found")

    with patch("api.utils.storage._client", return_value=client):
        from api.utils.storage import path_exists
        assert path_exists("session/results/missing.json") is False


# ── write_csv / read_csv ──────────────────────────────────────────────────────

def test_write_csv_uploads_bytes(mock_client):
    client, bucket = mock_client
    bucket.upload.return_value = MagicMock(error=None)

    df = pd.DataFrame({"regime": [0, 1, 2, 0]},
                      index=pd.date_range("2020-01-01", periods=4, freq="B"))
    df.index.name = "Date"

    with patch("api.utils.storage._client", return_value=client):
        from api.utils.storage import write_csv
        write_csv("session/results/regime_labels.csv", df)

    bucket.upload.assert_called_once()
    uploaded_bytes = bucket.upload.call_args.kwargs["file"]
    assert b"regime" in uploaded_bytes


# ── _client raises without env vars ──────────────────────────────────────────

def test_client_raises_without_env_vars():
    with patch.dict("os.environ", {}, clear=True):
        import importlib
        import api.utils.storage as storage_mod
        importlib.reload(storage_mod)
        with pytest.raises(RuntimeError, match="SUPABASE_URL"):
            storage_mod._client()
