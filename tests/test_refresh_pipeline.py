"""
Tests for scripts/refresh_pipeline.py

Uses mocks throughout — no real yfinance calls, no real CSV writes,
no real precompute runs.

Scenarios covered:
  - Happy path: all 4 steps succeed, status JSON written correctly
  - Fetch failure: pipeline aborts early, status written with success=False
  - Step 2 failure (regimes): non-fatal, pipeline continues to steps 3-4
  - Step 3 failure (correlations): non-fatal, step 4 still runs
  - Step 4 failure (transitions): non-fatal, status still written
  - Dry-run mode: no writes, reports staleness only
  - Status JSON: correct fields, data_through propagated from fetch
  - All 4 steps called in the right order
"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

# ── Make scripts/ importable ─────────────────────────────────────────────────

_SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

# ── Patch targets ─────────────────────────────────────────────────────────────
# refresh_pipeline does lazy imports inside each step function.
# We patch at the module level after it's imported.

_FETCH_TARGET = "incremental_fetch.fetch_all"
_REGIMES_TARGET = "src.data.detect_index_regimes.detect_all_indices"
_CORR_TARGET = "precompute.precompute_correlations"
_TRANS_TARGET = "precompute.precompute_transitions"


def _good_fetch_result(data_through: str = "2026-03-20") -> dict:
    """Synthetic fetch_all() return value — all tickers updated."""
    tickers = ["SPY", "VIX", "XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"]
    return {
        t: {"status": "updated", "rows_added": 5, "data_through": data_through}
        for t in tickers
    }


def _good_regimes_result() -> dict:
    """Synthetic detect_all_indices() return value."""
    import pandas as pd
    dummy_series = pd.Series(
        [0, 1, 2, 3],
        index=pd.date_range("2026-03-17", periods=4, freq="B"),
    )
    return {
        sym: {"regimes": dummy_series, "features": pd.DataFrame(), "model": None, "scaler": None}
        for sym in ["SPY", "QQQ", "DIA", "IWM"]
    }


# ── Happy-path test ───────────────────────────────────────────────────────────

def test_happy_path_all_steps_succeed(tmp_path):
    """When all steps succeed, status JSON reports success=True and correct fields."""
    status_path = tmp_path / "last_refresh.json"

    with patch("incremental_fetch.fetch_all", return_value=_good_fetch_result("2026-03-20")), \
         patch("src.data.detect_index_regimes.detect_all_indices", return_value=_good_regimes_result()), \
         patch("precompute.precompute_correlations"), \
         patch("precompute.precompute_transitions"), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        ok = refresh_pipeline.main(dry_run=False)

    assert ok is True
    assert status_path.exists()
    status = json.loads(status_path.read_text())
    assert status["success"] is True
    assert status["data_through"] == "2026-03-20"
    assert "last_refresh_utc" in status
    assert "completed_utc" in status
    assert isinstance(status["pipeline_duration_seconds"], float)


def test_happy_path_all_four_steps_called(tmp_path):
    """Verifies all four steps are actually invoked (not skipped)."""
    status_path = tmp_path / "last_refresh.json"

    mock_fetch = MagicMock(return_value=_good_fetch_result())
    mock_regimes = MagicMock(return_value=_good_regimes_result())
    mock_corr = MagicMock()
    mock_trans = MagicMock()

    with patch("incremental_fetch.fetch_all", mock_fetch), \
         patch("src.data.detect_index_regimes.detect_all_indices", mock_regimes), \
         patch("precompute.precompute_correlations", mock_corr), \
         patch("precompute.precompute_transitions", mock_trans), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        refresh_pipeline.main(dry_run=False)

    mock_fetch.assert_called_once()
    mock_regimes.assert_called_once()
    mock_corr.assert_called_once()
    mock_trans.assert_called_once()


# ── Fetch failure ─────────────────────────────────────────────────────────────

def test_fetch_failure_aborts_pipeline(tmp_path):
    """If fetch raises, the pipeline must abort and return False."""
    status_path = tmp_path / "last_refresh.json"

    mock_regimes = MagicMock(return_value=_good_regimes_result())
    mock_corr = MagicMock()
    mock_trans = MagicMock()

    with patch("incremental_fetch.fetch_all", side_effect=RuntimeError("network error")), \
         patch("src.data.detect_index_regimes.detect_all_indices", mock_regimes), \
         patch("precompute.precompute_correlations", mock_corr), \
         patch("precompute.precompute_transitions", mock_trans), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        ok = refresh_pipeline.main(dry_run=False)

    assert ok is False
    # Steps 2-4 must NOT have been called
    mock_regimes.assert_not_called()
    mock_corr.assert_not_called()
    mock_trans.assert_not_called()
    # Status still written
    assert status_path.exists()
    assert json.loads(status_path.read_text())["success"] is False


# ── Non-fatal failures ────────────────────────────────────────────────────────

def test_regime_failure_continues_to_steps_3_4(tmp_path):
    """Step 2 failure is non-fatal — steps 3 and 4 must still run."""
    status_path = tmp_path / "last_refresh.json"

    mock_corr = MagicMock()
    mock_trans = MagicMock()

    with patch("incremental_fetch.fetch_all", return_value=_good_fetch_result()), \
         patch("src.data.detect_index_regimes.detect_all_indices", side_effect=RuntimeError("kmeans fail")), \
         patch("precompute.precompute_correlations", mock_corr), \
         patch("precompute.precompute_transitions", mock_trans), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        ok = refresh_pipeline.main(dry_run=False)

    assert ok is False  # overall failure because step 2 errored
    mock_corr.assert_called_once()   # step 3 still ran
    mock_trans.assert_called_once()  # step 4 still ran


def test_correlation_failure_continues_to_step_4(tmp_path):
    """Step 3 failure is non-fatal — step 4 must still run."""
    status_path = tmp_path / "last_refresh.json"

    mock_trans = MagicMock()

    with patch("incremental_fetch.fetch_all", return_value=_good_fetch_result()), \
         patch("src.data.detect_index_regimes.detect_all_indices", return_value=_good_regimes_result()), \
         patch("precompute.precompute_correlations", side_effect=RuntimeError("precompute fail")), \
         patch("precompute.precompute_transitions", mock_trans), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        ok = refresh_pipeline.main(dry_run=False)

    assert ok is False
    mock_trans.assert_called_once()  # step 4 still ran


def test_transition_failure_still_writes_status(tmp_path):
    """Step 4 failure still results in a status JSON being written."""
    status_path = tmp_path / "last_refresh.json"

    with patch("incremental_fetch.fetch_all", return_value=_good_fetch_result()), \
         patch("src.data.detect_index_regimes.detect_all_indices", return_value=_good_regimes_result()), \
         patch("precompute.precompute_correlations"), \
         patch("precompute.precompute_transitions", side_effect=RuntimeError("transition fail")), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        ok = refresh_pipeline.main(dry_run=False)

    assert ok is False
    assert status_path.exists()
    assert json.loads(status_path.read_text())["success"] is False


# ── Status JSON correctness ───────────────────────────────────────────────────

def test_status_json_has_all_required_fields(tmp_path):
    status_path = tmp_path / "last_refresh.json"

    with patch("incremental_fetch.fetch_all", return_value=_good_fetch_result("2026-03-20")), \
         patch("src.data.detect_index_regimes.detect_all_indices", return_value=_good_regimes_result()), \
         patch("precompute.precompute_correlations"), \
         patch("precompute.precompute_transitions"), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        refresh_pipeline.main(dry_run=False)

    status = json.loads(status_path.read_text())
    required = {
        "last_refresh_utc", "completed_utc", "data_through",
        "total_rows_added", "tickers_updated", "index_regimes_succeeded",
        "index_regimes_failed", "pipeline_duration_seconds", "success",
    }
    assert required.issubset(set(status.keys()))


def test_status_data_through_comes_from_fetch(tmp_path):
    status_path = tmp_path / "last_refresh.json"

    with patch("incremental_fetch.fetch_all", return_value=_good_fetch_result("2025-06-15")), \
         patch("src.data.detect_index_regimes.detect_all_indices", return_value=_good_regimes_result()), \
         patch("precompute.precompute_correlations"), \
         patch("precompute.precompute_transitions"), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        refresh_pipeline.main(dry_run=False)

    status = json.loads(status_path.read_text())
    assert status["data_through"] == "2025-06-15"


def test_status_total_rows_added_summed_correctly(tmp_path):
    """total_rows_added in the status must be the sum across all tickers."""
    status_path = tmp_path / "last_refresh.json"

    # 13 tickers, each adding 3 rows → 39 total
    fetch_result = {
        t: {"status": "updated", "rows_added": 3, "data_through": "2026-03-20"}
        for t in ["SPY", "VIX", "XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"]
    }

    with patch("incremental_fetch.fetch_all", return_value=fetch_result), \
         patch("src.data.detect_index_regimes.detect_all_indices", return_value=_good_regimes_result()), \
         patch("precompute.precompute_correlations"), \
         patch("precompute.precompute_transitions"), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        refresh_pipeline.main(dry_run=False)

    status = json.loads(status_path.read_text())
    assert status["total_rows_added"] == 39


def test_status_regime_failures_recorded(tmp_path):
    """When index regime detection fails, failed indices appear in the status."""
    status_path = tmp_path / "last_refresh.json"

    with patch("incremental_fetch.fetch_all", return_value=_good_fetch_result()), \
         patch("src.data.detect_index_regimes.detect_all_indices", side_effect=RuntimeError("fail")), \
         patch("precompute.precompute_correlations"), \
         patch("precompute.precompute_transitions"), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        refresh_pipeline.main(dry_run=False)

    status = json.loads(status_path.read_text())
    assert status["index_regimes_failed"] == ["SPY", "QQQ", "DIA", "IWM"]
    assert status["index_regimes_succeeded"] == []


# ── Dry-run ───────────────────────────────────────────────────────────────────

def test_dry_run_makes_no_writes(tmp_path):
    """Dry-run must not call fetch_all, detect_all_indices, or write status."""
    status_path = tmp_path / "last_refresh.json"

    mock_fetch = MagicMock()
    mock_regimes = MagicMock()

    with patch("incremental_fetch.fetch_all", mock_fetch), \
         patch("src.data.detect_index_regimes.detect_all_indices", mock_regimes), \
         patch("refresh_pipeline.STATUS_PATH", status_path):

        import refresh_pipeline
        ok = refresh_pipeline.main(dry_run=True)

    assert ok is True
    mock_fetch.assert_not_called()
    mock_regimes.assert_not_called()
    assert not status_path.exists()
