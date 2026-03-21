"""
Integration tests for the backtester FastAPI router.

Strategy:
  - Pydantic validation tests (bad dates, weights>1, etc.) need NO mocks — Pydantic
    rejects the request before any data loading happens.
  - Successful-run tests mock `load_asset_returns` and `_load_regime_labels` inside
    the router to avoid requiring real data files on disk.

All tests use a minimal FastAPI app containing only the backtester router so that
failures in other routers (predictions, etc.) don't block these tests.
"""
import math
import pytest
import numpy as np
import pandas as pd
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers.backtester import router as backtester_router
from api.utils.backtester import (
    BacktestResult,
    BacktestStats,
    RegimeBreakdown,
)

# ── Minimal test app ──────────────────────────────────────────────────────────

_app = FastAPI()
_app.include_router(backtester_router)
client = TestClient(_app, raise_server_exceptions=True)


# ── Synthetic data factories ──────────────────────────────────────────────────

def _make_synthetic_returns(n: int = 20) -> pd.DataFrame:
    """Deterministic small return DataFrame with SPY and XLU."""
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    return pd.DataFrame(
        {"SPY": [0.005] * n, "XLU": [0.003] * n},
        index=dates,
    )


def _make_synthetic_labels(n: int = 20) -> pd.Series:
    """Alternating 0/1 labels to exercise rebalance logic."""
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    return pd.Series([i % 2 for i in range(n)], index=dates, name="regime", dtype=int)


def _make_mock_backtest_result() -> BacktestResult:
    """Minimal BacktestResult that satisfies the router's serialization path."""
    n = 20
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    equity = pd.Series(
        [10_000 * (1.005 ** i) for i in range(n)], index=dates, name="value"
    )
    benchmark = pd.Series(
        [10_000 * (1.005 ** i) for i in range(n)], index=dates, name="benchmark"
    )
    daily = pd.Series([0.005] * n, index=dates)
    stats = BacktestStats(
        total_return_pct=10.0,
        cagr_pct=5.0,
        sharpe_ratio=1.5,
        max_drawdown_pct=-2.0,
        calmar_ratio=2.5,
        win_rate_pct=100.0,
        num_rebalances=3,
        benchmark_total_return_pct=9.0,
        benchmark_sharpe=1.4,
    )
    breakdown = [
        RegimeBreakdown(regime_id=0, days=10, pct_time=50.0,
                        avg_daily_return_pct=0.5, total_contribution_pct=5.0),
        RegimeBreakdown(regime_id=1, days=10, pct_time=50.0,
                        avg_daily_return_pct=0.5, total_contribution_pct=5.0),
    ]
    return BacktestResult(
        equity_curve=equity,
        benchmark_curve=benchmark,
        daily_returns=daily,
        rebalance_dates=["2020-01-03", "2020-01-07", "2020-01-11"],
        stats=stats,
        regime_breakdown=breakdown,
    )


# ── Shared mock context for successful run ────────────────────────────────────

def _mock_run_context():
    """
    Returns a context manager stack that patches the two external data dependencies
    inside the router: _load_regime_labels and load_asset_returns.
    """
    from contextlib import ExitStack
    stack = ExitStack()
    stack.enter_context(patch(
        "api.routers.backtester._load_regime_labels",
        return_value=_make_synthetic_labels(),
    ))
    stack.enter_context(patch(
        "api.routers.backtester.load_asset_returns",
        return_value=_make_synthetic_returns(),
    ))
    return stack


# ── GET /api/backtester/assets ────────────────────────────────────────────────

def test_assets_endpoint_returns_200():
    resp = client.get("/api/backtester/assets")
    assert resp.status_code == 200


def test_assets_endpoint_returns_list():
    resp = client.get("/api/backtester/assets")
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) > 0


def test_assets_endpoint_each_item_has_required_fields():
    resp = client.get("/api/backtester/assets")
    for item in resp.json():
        assert "ticker" in item
        assert "name" in item
        assert "category" in item


def test_assets_endpoint_includes_spy_and_cash():
    resp = client.get("/api/backtester/assets")
    tickers = {item["ticker"] for item in resp.json()}
    assert "SPY" in tickers
    assert "cash" in tickers


def test_assets_endpoint_categories_are_valid():
    valid = {"equity_index", "sector_etf", "cash"}
    for item in client.get("/api/backtester/assets").json():
        assert item["category"] in valid


# ── POST /api/backtester/run — Pydantic validation (no mocks needed) ──────────

def test_run_empty_allocations_returns_422():
    resp = client.post("/api/backtester/run", json={
        "allocations": {},
        "transaction_cost_bps": 10,
    })
    assert resp.status_code == 422


def test_run_invalid_date_format_returns_422():
    resp = client.post("/api/backtester/run", json={
        "allocations": {"0": {"SPY": 0.9}},
        "transaction_cost_bps": 10,
        "start_date": "not-a-date",
    })
    assert resp.status_code == 422


def test_run_start_after_end_returns_422():
    resp = client.post("/api/backtester/run", json={
        "allocations": {"0": {"SPY": 0.9}},
        "transaction_cost_bps": 10,
        "start_date": "2021-01-01",
        "end_date":   "2020-01-01",
    })
    assert resp.status_code == 422


def test_run_start_equals_end_is_accepted_by_pydantic():
    # start == end is valid at the Pydantic layer (single-day window).
    # It may return 422 later if the date range has no data, but the
    # model_validator should NOT reject it.
    # We only check that the Pydantic error is NOT the cause.
    resp = client.post("/api/backtester/run", json={
        "allocations": {"0": {"SPY": 0.9}},
        "transaction_cost_bps": 10,
        "start_date": "2020-01-02",
        "end_date":   "2020-01-02",
    })
    # May be 422 from no-data, but not from model_validator
    if resp.status_code == 422:
        detail = resp.json().get("detail", "")
        assert "start_date" not in str(detail).lower() or "before" not in str(detail).lower()


def test_run_null_dates_accepted():
    """null start/end should not raise a Pydantic validation error."""
    with _mock_run_context():
        resp = client.post("/api/backtester/run", json={
            "allocations": {"0": {"SPY": 0.9}},
            "transaction_cost_bps": 10,
            "start_date": None,
            "end_date":   None,
        })
    # Mocked data — should succeed
    assert resp.status_code == 200


def test_run_invalid_regime_key_returns_422():
    """Regime key 'abc' cannot be cast to int — must return 422."""
    with _mock_run_context():
        resp = client.post("/api/backtester/run", json={
            "allocations": {"abc": {"SPY": 0.9}},
            "transaction_cost_bps": 10,
        })
    assert resp.status_code == 422


# ── POST /api/backtester/run — engine validation (mocked data) ────────────────

def test_run_weights_over_1_returns_422():
    """Weights summing to >1.0 must be rejected by the engine validation layer."""
    with _mock_run_context():
        resp = client.post("/api/backtester/run", json={
            "allocations": {"0": {"SPY": 0.7, "XLU": 0.5}},   # 1.2 > 1.0
            "transaction_cost_bps": 10,
        })
    assert resp.status_code == 422


def test_run_unknown_ticker_returns_422():
    """A ticker not in asset_loader must be rejected."""
    with _mock_run_context():
        resp = client.post("/api/backtester/run", json={
            "allocations": {"0": {"GOLD": 1.0}},   # GOLD not in registry
            "transaction_cost_bps": 10,
        })
    # Router filters out "cash" from tickers_needed; GOLD hits load_asset_returns
    assert resp.status_code == 422


# ── POST /api/backtester/run — successful response shape ─────────────────────

_VALID_REQUEST = {
    "allocations": {
        "0": {"SPY": 0.9, "XLU": 0.1},
        "1": {"XLU": 0.8, "SPY": 0.2},
    },
    "transaction_cost_bps": 10,
}


def test_run_returns_200_with_mocked_data():
    with _mock_run_context():
        resp = client.post("/api/backtester/run", json=_VALID_REQUEST)
    assert resp.status_code == 200


def test_run_response_has_required_top_level_fields():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    for field in ("equity_curve", "stats", "regime_breakdown",
                  "rebalance_dates", "tickers_used", "date_range"):
        assert field in body, f"Missing field: {field}"


def test_run_equity_curve_points_have_required_fields():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    assert len(body["equity_curve"]) > 0
    for point in body["equity_curve"]:
        assert "date" in point
        assert "value" in point
        assert "benchmark" in point


def test_run_equity_curve_dates_are_iso_format():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    import re
    iso_pattern = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    for point in body["equity_curve"]:
        assert iso_pattern.match(point["date"]), (
            f"Date {point['date']!r} is not YYYY-MM-DD"
        )


def test_run_stats_has_required_fields():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    stats = body["stats"]
    for field in (
        "total_return_pct", "cagr_pct", "sharpe_ratio", "max_drawdown_pct",
        "calmar_ratio", "win_rate_pct", "num_rebalances",
        "benchmark_total_return_pct", "benchmark_sharpe",
    ):
        assert field in stats, f"Missing stats field: {field}"


def test_run_stats_types_are_numeric():
    with _mock_run_context():
        stats = client.post("/api/backtester/run", json=_VALID_REQUEST).json()["stats"]
    numeric_fields = (
        "total_return_pct", "cagr_pct", "sharpe_ratio", "max_drawdown_pct",
        "calmar_ratio", "win_rate_pct", "benchmark_total_return_pct", "benchmark_sharpe",
    )
    for field in numeric_fields:
        assert isinstance(stats[field], (int, float)), (
            f"stats.{field} should be numeric, got {type(stats[field])}"
        )
    assert isinstance(stats["num_rebalances"], int)


def test_run_regime_breakdown_is_list():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    assert isinstance(body["regime_breakdown"], list)


def test_run_regime_breakdown_items_have_required_fields():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    for item in body["regime_breakdown"]:
        for field in ("regime_id", "days", "pct_time",
                      "avg_daily_return_pct", "total_contribution_pct"):
            assert field in item, f"Missing breakdown field: {field}"


def test_run_date_range_has_start_and_end():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    assert "start" in body["date_range"]
    assert "end"   in body["date_range"]


def test_run_tickers_used_is_list_of_strings():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    assert isinstance(body["tickers_used"], list)
    assert all(isinstance(t, str) for t in body["tickers_used"])


def test_run_rebalance_dates_is_list_of_strings():
    with _mock_run_context():
        body = client.post("/api/backtester/run", json=_VALID_REQUEST).json()
    assert isinstance(body["rebalance_dates"], list)
    assert all(isinstance(d, str) for d in body["rebalance_dates"])


# ── Date range passthrough ────────────────────────────────────────────────────

def test_run_start_date_forwarded_to_label_loader():
    """start_date must be passed through to _load_regime_labels, not dropped."""
    with patch("api.routers.backtester._load_regime_labels",
               return_value=_make_synthetic_labels()) as mock_labels, \
         patch("api.routers.backtester.load_asset_returns",
               return_value=_make_synthetic_returns()):
        client.post("/api/backtester/run", json={
            **_VALID_REQUEST,
            "start_date": "2020-01-01",
            "end_date":   "2020-12-31",
        })
        call_args = mock_labels.call_args
        assert call_args[0][0] == "2020-01-01"  # positional start
        assert call_args[0][1] == "2020-12-31"  # positional end


def test_run_null_start_end_forwarded_as_none():
    """Omitting dates must pass None (not empty string) into the loader."""
    with patch("api.routers.backtester._load_regime_labels",
               return_value=_make_synthetic_labels()) as mock_labels, \
         patch("api.routers.backtester.load_asset_returns",
               return_value=_make_synthetic_returns()):
        client.post("/api/backtester/run", json=_VALID_REQUEST)
        call_args = mock_labels.call_args
        assert call_args[0][0] is None
        assert call_args[0][1] is None


# ── Cash ticker handling in router ───────────────────────────────────────────

def test_cash_excluded_from_tickers_needed():
    """
    The router must not include 'cash' in the tickers passed to load_asset_returns.
    If it did, the loader would raise (since cash is handled as a virtual column).
    """
    with patch("api.routers.backtester._load_regime_labels",
               return_value=_make_synthetic_labels()), \
         patch("api.routers.backtester.load_asset_returns",
               return_value=_make_synthetic_returns()) as mock_loader:
        resp = client.post("/api/backtester/run", json={
            "allocations": {"0": {"SPY": 0.7, "cash": 0.2}},
            "transaction_cost_bps": 10,
        })
    assert resp.status_code == 200
    # cash must not appear in the tickers list passed to load_asset_returns
    actual_tickers = mock_loader.call_args[0][0]
    assert "cash" not in actual_tickers
