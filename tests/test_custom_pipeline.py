"""
Tests for api/utils/custom_pipeline.py
Runs the full analysis pipeline on synthetic price data (no Supabase calls).
"""
import pytest
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock


# ── Synthetic price data ──────────────────────────────────────────────────────

def _make_prices(n_rows=300, n_tickers=5) -> pd.DataFrame:
    dates = pd.date_range("2018-01-01", periods=n_rows, freq="B")
    prices = pd.DataFrame(
        np.random.uniform(100, 300, size=(n_rows, n_tickers)),
        index=dates,
        columns=[f"TICK{i}" for i in range(n_tickers)],
    )
    prices.index.name = "Date"
    return prices


def _make_price_csv(n_rows=300, n_tickers=5) -> bytes:
    return _make_prices(n_rows, n_tickers).reset_index().to_csv(index=False).encode()


# ── _rolling_avg_corr ─────────────────────────────────────────────────────────

def test_rolling_avg_corr_single_ticker():
    from api.utils.custom_pipeline import _rolling_avg_corr
    log_ret = pd.DataFrame({"A": np.random.randn(200)},
                           index=pd.date_range("2020-01-01", periods=200, freq="B"))
    result = _rolling_avg_corr(log_ret, window=63)
    assert (result == 0.0).all()


def test_rolling_avg_corr_multi_ticker():
    from api.utils.custom_pipeline import _rolling_avg_corr
    log_ret = pd.DataFrame(
        np.random.randn(200, 4),
        index=pd.date_range("2020-01-01", periods=200, freq="B"),
        columns=list("ABCD"),
    )
    result = _rolling_avg_corr(log_ret, window=63)
    assert len(result) == 200
    valid = result.dropna()
    assert (valid >= -1).all() and (valid <= 1).all()


# ── _rolling_pca_metrics ──────────────────────────────────────────────────────

def test_rolling_pca_metrics_shape():
    from api.utils.custom_pipeline import _rolling_pca_metrics
    log_ret = pd.DataFrame(
        np.random.randn(200, 5),
        index=pd.date_range("2020-01-01", periods=200, freq="B"),
        columns=list("ABCDE"),
    )
    result = _rolling_pca_metrics(log_ret, window=63)
    assert set(result.columns) >= {"PC1_var", "cum_var_3", "effective_dimension"}
    assert len(result) > 0


def test_rolling_pca_metrics_single_ticker():
    from api.utils.custom_pipeline import _rolling_pca_metrics
    log_ret = pd.DataFrame(
        {"A": np.random.randn(200)},
        index=pd.date_range("2020-01-01", periods=200, freq="B"),
    )
    result = _rolling_pca_metrics(log_ret, window=63)
    assert len(result) > 0
    assert (result["PC1_var"] == 1.0).all()


# ── _compute_performance ──────────────────────────────────────────────────────

def test_compute_performance_keys():
    from api.utils.custom_pipeline import _compute_performance
    prices = _make_prices(200, 2)
    labels = pd.Series(
        np.random.randint(0, 4, 199),
        index=prices.index[1:],
        name="regime",
    )
    result = _compute_performance(labels, prices)
    for r_id in result.values():
        assert "days" in r_id
        assert "sharpe" in r_id
        assert "ann_vol" in r_id
        assert "win_rate" in r_id


# ── Full pipeline (mocked storage) ───────────────────────────────────────────

def test_full_pipeline_completes():
    """Run the full pipeline with mocked storage and verify it reaches 'complete'."""
    written = {}

    def fake_write_json(path, obj):
        written[path] = obj

    def fake_write_csv(path, df):
        written[path] = df

    def fake_read_json(path):
        return written.get(path, {})

    session_id = "test-session-123"
    contents = _make_price_csv(300, 3)

    with patch("api.utils.custom_pipeline.storage") as mock_storage:
        mock_storage.write_json.side_effect = fake_write_json
        mock_storage.write_csv.side_effect = fake_write_csv
        mock_storage.read_json.side_effect = fake_read_json

        from api.utils.custom_pipeline import run_user_analysis
        run_user_analysis(session_id, ".csv", contents)

    status_key = f"{session_id}/results/analysis_status.json"
    assert status_key in written
    assert written[status_key]["status"] == "complete"
    assert written[status_key]["progress_pct"] == 100


def test_pipeline_writes_all_result_files():
    """Verify all expected output files are written to storage."""
    written = {}

    def fake_write_json(path, obj):
        written[path] = obj

    def fake_write_csv(path, df):
        written[path] = df

    def fake_read_json(path):
        return written.get(path, {})

    session_id = "test-session-456"
    contents = _make_price_csv(300, 3)

    with patch("api.utils.custom_pipeline.storage") as mock_storage:
        mock_storage.write_json.side_effect = fake_write_json
        mock_storage.write_csv.side_effect = fake_write_csv
        mock_storage.read_json.side_effect = fake_read_json

        from api.utils.custom_pipeline import run_user_analysis
        run_user_analysis(session_id, ".csv", contents)

    prefix = f"{session_id}/results/"
    expected_files = [
        "analysis_status.json",
        "regime_label_map.json",
        "regime_labels.csv",
        "regime_features.csv",
        "transition_matrix.json",
        "regime_stats.json",
        "predictions.json",
        "dataset_meta.json",
    ]
    for fname in expected_files:
        assert prefix + fname in written, f"Missing: {prefix + fname}"


def test_pipeline_error_writes_error_status():
    """If parsing fails, pipeline should write error status — not crash the thread."""
    written = {}

    def fake_write_json(path, obj):
        written[path] = obj

    session_id = "test-session-err"
    bad_contents = b"this is not valid price data at all"

    with patch("api.utils.custom_pipeline.storage") as mock_storage:
        mock_storage.write_json.side_effect = fake_write_json
        mock_storage.read_json.return_value = {}

        from api.utils.custom_pipeline import run_user_analysis
        run_user_analysis(session_id, ".csv", bad_contents)

    status_key = f"{session_id}/results/analysis_status.json"
    assert written[status_key]["status"] == "error"
    assert "error" in written[status_key]
