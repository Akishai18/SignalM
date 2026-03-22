"""
Tests for scripts/incremental_fetch.py

All tests use temporary directories with synthetic CSV files — no real data
files and no actual network calls. yfinance is mocked throughout.

Scenarios covered:
  - _last_csv_date:  tz-naive, tz-aware, empty file, missing file
  - fetch_spy:       up-to-date no-op, new rows appended, derived cols recomputed,
                     empty yfinance response, deduplication of overlapping dates
  - fetch_vix:       new rows appended, correct column schema (no capital_gains)
  - fetch_sector:    new rows appended, tz-aware date strings normalized
  - fetch_all:       orchestrator returns one entry per ticker
"""

import math
import sys
import textwrap
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

# ── Make scripts/ importable ─────────────────────────────────────────────────

_SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from incremental_fetch import (  # noqa: E402
    SECTOR_TICKERS,
    _SPY_COL_ORDER,
    _VIX_COL_ORDER,
    _compute_spy_derived,
    _fetch_raw,
    _last_csv_date,
    fetch_all,
    fetch_sector,
    fetch_spy,
    fetch_vix,
)


# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_yf_df(
    dates: list[str],
    ticker: str,
    include_capital_gains: bool = True,
) -> pd.DataFrame:
    """
    Build a synthetic yfinance-style DataFrame with a tz-aware DatetimeIndex.
    Columns use Title Case (as yfinance returns them before our lowercasing).
    """
    n = len(dates)
    idx = pd.DatetimeIndex(dates, tz="America/New_York")
    cols = {
        "Open": [100.0 + i for i in range(n)],
        "High": [105.0 + i for i in range(n)],
        "Low":  [98.0 + i for i in range(n)],
        "Close": [102.0 + i for i in range(n)],
        "Volume": [1_000_000] * n,
        "Dividends": [0.0] * n,
        "Stock Splits": [0.0] * n,
    }
    if include_capital_gains:
        cols["Capital Gains"] = [0.0] * n
    df = pd.DataFrame(cols, index=idx)
    df.index.name = "Date"
    return df


def _write_spy_csv(path: Path, last_date: str, n_rows: int = 5) -> None:
    """Write a minimal spy_data.csv to *path* ending at *last_date*."""
    dates = pd.date_range(end=last_date, periods=n_rows, freq="B")
    close = [100.0 + i for i in range(n_rows)]
    df = pd.DataFrame(
        {
            "open": close,
            "high": [c + 2 for c in close],
            "low":  [c - 2 for c in close],
            "close": close,
            "volume": [1_000_000] * n_rows,
            "dividends": [0.0] * n_rows,
            "stock splits": [0.0] * n_rows,
            "capital gains": [0.0] * n_rows,
            "symbol": ["SPY"] * n_rows,
        },
        index=dates,
    )
    df.index.name = "Date"
    # Compute and attach derived columns so the file matches production schema
    df = _compute_spy_derived(df)
    df = df[[c for c in _SPY_COL_ORDER if c in df.columns]]
    df.to_csv(path)


def _write_vix_csv(path: Path, last_date: str, n_rows: int = 5) -> None:
    dates = pd.date_range(end=last_date, periods=n_rows, freq="B")
    df = pd.DataFrame(
        {
            "open": [20.0] * n_rows,
            "high": [22.0] * n_rows,
            "low":  [18.0] * n_rows,
            "close": [20.0] * n_rows,
            "volume": [0] * n_rows,
            "dividends": [0.0] * n_rows,
            "stock splits": [0.0] * n_rows,
            "symbol": ["^VIX"] * n_rows,
        },
        index=dates,
    )
    df.index.name = "Date"
    df.to_csv(path)


def _write_sector_csv(path: Path, last_date: str, ticker: str = "XLU", n_rows: int = 5) -> None:
    """Write a sector CSV with tz-aware date strings (matching real file format)."""
    dates = pd.date_range(end=last_date, periods=n_rows, freq="B")
    df = pd.DataFrame(
        {
            "open": [30.0 + i for i in range(n_rows)],
            "high": [32.0 + i for i in range(n_rows)],
            "low":  [28.0 + i for i in range(n_rows)],
            "close": [31.0 + i for i in range(n_rows)],
            "volume": [500_000] * n_rows,
            "dividends": [0.0] * n_rows,
            "stock splits": [0.0] * n_rows,
            "capital gains": [0.0] * n_rows,
            "symbol": [ticker] * n_rows,
        },
        index=dates,
    )
    df.index.name = "Date"
    # Simulate tz-aware date strings as stored in real files
    df.index = pd.Index(
        [f"{d.strftime('%Y-%m-%d')} 00:00:00-05:00" for d in dates],
        name="Date",
    )
    df.to_csv(path)


# ── _last_csv_date ────────────────────────────────────────────────────────────

def test_last_csv_date_tz_naive(tmp_path):
    """tz-naive dates (spy/vix format) parsed correctly."""
    p = tmp_path / "spy_data.csv"
    _write_spy_csv(p, "2024-12-19")
    result = _last_csv_date(p)
    assert result == pd.Timestamp("2024-12-19")


def test_last_csv_date_tz_aware_strings(tmp_path):
    """tz-aware date strings (sector format) — only date portion matters."""
    p = tmp_path / "xlu_data.csv"
    (tmp_path / "sectors").mkdir()
    sp = tmp_path / "sectors" / "xlu_data.csv"
    _write_sector_csv(sp, "2024-12-19", "XLU")
    result = _last_csv_date(sp)
    assert result == pd.Timestamp("2024-12-19")


def test_last_csv_date_missing_file(tmp_path):
    result = _last_csv_date(tmp_path / "nonexistent.csv")
    assert result is None


def test_last_csv_date_empty_file(tmp_path):
    p = tmp_path / "empty.csv"
    p.write_text("Date\n")  # header only, no rows
    result = _last_csv_date(p)
    assert result is None


# ── _compute_spy_derived ─────────────────────────────────────────────────────

def test_compute_spy_derived_returns_correct():
    """pct_change() on known prices should match manual calculation."""
    df = pd.DataFrame(
        {"close": [100.0, 102.0, 101.0]},
        index=pd.date_range("2020-01-01", periods=3, freq="B"),
    )
    out = _compute_spy_derived(df)
    assert math.isnan(out["returns"].iloc[0])               # first row → NaN
    assert abs(out["returns"].iloc[1] - 0.02) < 1e-9       # 102/100 - 1
    assert abs(out["returns"].iloc[2] - (-1/102)) < 1e-9   # 101/102 - 1


def test_compute_spy_derived_vol_21d_nan_until_window(tmp_path):
    """
    vol_21d uses rolling(21) on returns, where returns[0] is always NaN.
    So the first non-NaN vol_21d is at index 21 (22nd row), not index 20.
    Indices 0-20 must all be NaN; index 21 must be a real value.
    """
    n = 30
    df = pd.DataFrame(
        {"close": [100.0 + i for i in range(n)]},
        index=pd.date_range("2020-01-01", periods=n, freq="B"),
    )
    out = _compute_spy_derived(df)
    assert out["vol_21d"].iloc[:21].isna().all()
    assert not math.isnan(out["vol_21d"].iloc[21])


def test_compute_spy_derived_trend_50_200_is_bool(tmp_path):
    n = 210
    df = pd.DataFrame(
        {"close": [100.0 + i for i in range(n)]},
        index=pd.date_range("2020-01-01", periods=n, freq="B"),
    )
    out = _compute_spy_derived(df)
    # trend_50_200 must be boolean (or NaN where SMA not yet computable)
    non_null = out["trend_50_200"].dropna()
    assert non_null.dtype == bool or set(non_null.unique()).issubset({True, False})


# ── fetch_spy ─────────────────────────────────────────────────────────────────

def test_fetch_spy_up_to_date_no_op(tmp_path):
    """If last CSV date is yesterday, no yfinance call and rows_added=0."""
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    _write_spy_csv(tmp_path / "spy_data.csv", yesterday)

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        result = fetch_spy(tmp_path)

    mock_ticker.assert_not_called()
    assert result["status"] == "up_to_date"
    assert result["rows_added"] == 0


def test_fetch_spy_appends_new_rows(tmp_path):
    """Stale SPY data gets new rows appended and derived cols recomputed."""
    _write_spy_csv(tmp_path / "spy_data.csv", "2024-12-19")

    new_dates = ["2024-12-20", "2024-12-23"]
    yf_df = _make_yf_df(new_dates, "SPY", include_capital_gains=True)

    mock_hist = MagicMock(return_value=yf_df)
    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = mock_hist
        result = fetch_spy(tmp_path)

    assert result["status"] == "updated"
    assert result["rows_added"] == 2
    assert result["data_through"] == "2024-12-23"

    # Verify file on disk
    saved = pd.read_csv(tmp_path / "spy_data.csv", index_col=0)
    assert "2024-12-20" in saved.index
    assert "2024-12-23" in saved.index
    assert "returns" in saved.columns
    assert "vol_21d" in saved.columns


def test_fetch_spy_no_duplicate_rows(tmp_path):
    """If yfinance returns a date already in the file, it must not be duplicated."""
    _write_spy_csv(tmp_path / "spy_data.csv", "2024-12-19")

    # yfinance returns the existing last date plus one new date
    yf_df = _make_yf_df(["2024-12-19", "2024-12-20"], "SPY")

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=yf_df)
        result = fetch_spy(tmp_path)

    saved = pd.read_csv(tmp_path / "spy_data.csv", index_col=0, parse_dates=True)
    assert saved.index.duplicated().sum() == 0


def test_fetch_spy_empty_yfinance_response_is_noop(tmp_path):
    """If yfinance returns empty DataFrame (holiday/weekend), file is unchanged."""
    _write_spy_csv(tmp_path / "spy_data.csv", "2024-12-19")
    original_size = (tmp_path / "spy_data.csv").stat().st_size

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=pd.DataFrame())
        result = fetch_spy(tmp_path)

    assert result["status"] == "no_new_data"
    assert result["rows_added"] == 0
    assert (tmp_path / "spy_data.csv").stat().st_size == original_size


def test_fetch_spy_derived_cols_recomputed_from_full_history(tmp_path):
    """
    vol_252d at the boundary day must use 252 days of full history,
    not just the new row alone.  This verifies rolling windows cross
    the old/new boundary correctly.
    """
    # Write 260 rows of history ending 2024-12-19
    dates = pd.date_range("2023-12-01", periods=260, freq="B")
    close = [100.0 + i * 0.1 for i in range(260)]
    df = pd.DataFrame(
        {
            "open": close,
            "high": [c + 1 for c in close],
            "low": [c - 1 for c in close],
            "close": close,
            "volume": [1_000_000] * 260,
            "dividends": [0.0] * 260,
            "stock splits": [0.0] * 260,
            "capital gains": [0.0] * 260,
            "symbol": ["SPY"] * 260,
        },
        index=dates,
    )
    df.index.name = "Date"
    df = _compute_spy_derived(df)
    df = df[[c for c in _SPY_COL_ORDER if c in df.columns]]
    df.to_csv(tmp_path / "spy_data.csv")

    last_existing = dates[-1]
    next_day = last_existing + pd.Timedelta(days=3)  # skip weekend
    yf_df = _make_yf_df([next_day.strftime("%Y-%m-%d")], "SPY")

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=yf_df)
        fetch_spy(tmp_path)

    saved = pd.read_csv(tmp_path / "spy_data.csv", index_col=0)
    new_row = saved.iloc[-1]
    # vol_252d should not be NaN — there are >252 rows of history
    assert not math.isnan(new_row["vol_252d"]), (
        "vol_252d should be computable with 261 rows of history"
    )


def test_fetch_spy_column_order_preserved(tmp_path):
    """Saved file must have exactly the canonical column order."""
    _write_spy_csv(tmp_path / "spy_data.csv", "2024-12-19")
    yf_df = _make_yf_df(["2024-12-20"], "SPY")

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=yf_df)
        fetch_spy(tmp_path)

    saved = pd.read_csv(tmp_path / "spy_data.csv", index_col=0)
    present = [c for c in _SPY_COL_ORDER if c in saved.columns]
    assert list(saved.columns[:len(present)]) == present


# ── fetch_vix ─────────────────────────────────────────────────────────────────

def test_fetch_vix_appends_new_rows(tmp_path):
    _write_vix_csv(tmp_path / "vix_data.csv", "2024-12-19")

    # VIX has no Capital Gains column
    yf_df = _make_yf_df(["2024-12-20"], "^VIX", include_capital_gains=False)

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=yf_df)
        result = fetch_vix(tmp_path)

    assert result["status"] == "updated"
    assert result["rows_added"] == 1

    saved = pd.read_csv(tmp_path / "vix_data.csv", index_col=0)
    assert "2024-12-20" in saved.index
    assert "capital gains" not in saved.columns  # VIX never has this


def test_fetch_vix_no_capital_gains_column_even_if_yfinance_returns_it(tmp_path):
    """If yfinance unexpectedly returns capital_gains for VIX, we must drop it."""
    _write_vix_csv(tmp_path / "vix_data.csv", "2024-12-19")
    yf_df = _make_yf_df(["2024-12-20"], "^VIX", include_capital_gains=True)

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=yf_df)
        fetch_vix(tmp_path)

    saved = pd.read_csv(tmp_path / "vix_data.csv", index_col=0)
    assert "capital gains" not in saved.columns


def test_fetch_vix_up_to_date_no_op(tmp_path):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    _write_vix_csv(tmp_path / "vix_data.csv", yesterday)

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        result = fetch_vix(tmp_path)

    mock_ticker.assert_not_called()
    assert result["status"] == "up_to_date"


# ── fetch_sector ──────────────────────────────────────────────────────────────

def test_fetch_sector_appends_new_rows(tmp_path):
    sectors_dir = tmp_path / "sectors"
    sectors_dir.mkdir()
    _write_sector_csv(sectors_dir / "xlu_data.csv", "2024-12-19", "XLU")

    yf_df = _make_yf_df(["2024-12-20"], "XLU")

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=yf_df)
        result = fetch_sector("XLU", tmp_path)

    assert result["status"] == "updated"
    assert result["rows_added"] == 1

    saved = pd.read_csv(sectors_dir / "xlu_data.csv", index_col=0)
    # Date index may be tz-naive after normalization — just check date presence
    assert any("2024-12-20" in str(idx) for idx in saved.index)


def test_fetch_sector_tz_aware_existing_dates_normalized(tmp_path):
    """
    Sector files store dates like '2024-12-19 00:00:00-05:00'.
    After reading + appending, there must be no duplicate date entries.
    """
    sectors_dir = tmp_path / "sectors"
    sectors_dir.mkdir()
    _write_sector_csv(sectors_dir / "xlu_data.csv", "2024-12-19", "XLU")

    # yfinance returns the boundary date + one new date
    yf_df = _make_yf_df(["2024-12-19", "2024-12-20"], "XLU")

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=yf_df)
        fetch_sector("XLU", tmp_path)

    saved = pd.read_csv(sectors_dir / "xlu_data.csv", index_col=0)
    # Normalize index to just dates for dedup check
    parsed_idx = pd.to_datetime(saved.index.astype(str).str[:10])
    assert parsed_idx.duplicated().sum() == 0


def test_fetch_sector_up_to_date_no_op(tmp_path):
    sectors_dir = tmp_path / "sectors"
    sectors_dir.mkdir()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    _write_sector_csv(sectors_dir / "xlu_data.csv", yesterday, "XLU")

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        result = fetch_sector("XLU", tmp_path)

    mock_ticker.assert_not_called()
    assert result["status"] == "up_to_date"


# ── fetch_all ─────────────────────────────────────────────────────────────────

def test_fetch_all_returns_entry_for_every_ticker(tmp_path):
    """Orchestrator must return a result dict entry for SPY, VIX, and all 11 sectors."""
    # Create minimal stale CSV files for every ticker
    _write_spy_csv(tmp_path / "spy_data.csv", "2024-12-19")
    _write_vix_csv(tmp_path / "vix_data.csv", "2024-12-19")
    sectors_dir = tmp_path / "sectors"
    sectors_dir.mkdir()
    for t in SECTOR_TICKERS:
        _write_sector_csv(sectors_dir / f"{t.lower()}_data.csv", "2024-12-19", t)

    new_date = "2024-12-20"
    yf_df_with_cg = _make_yf_df([new_date], "SPY", include_capital_gains=True)
    yf_df_no_cg = _make_yf_df([new_date], "^VIX", include_capital_gains=False)

    def _side_effect(ticker_symbol):
        mock = MagicMock()
        df = yf_df_no_cg if ticker_symbol == "^VIX" else yf_df_with_cg
        mock.history = MagicMock(return_value=df)
        return mock

    with patch("incremental_fetch.yf.Ticker", side_effect=_side_effect):
        results = fetch_all(data_dir=tmp_path)

    expected_tickers = {"SPY", "VIX"} | set(SECTOR_TICKERS)
    assert set(results.keys()) == expected_tickers


def test_fetch_all_all_updated_when_stale(tmp_path):
    """When all files are stale, every ticker should report 'updated'."""
    _write_spy_csv(tmp_path / "spy_data.csv", "2024-12-19")
    _write_vix_csv(tmp_path / "vix_data.csv", "2024-12-19")
    sectors_dir = tmp_path / "sectors"
    sectors_dir.mkdir()
    for t in SECTOR_TICKERS:
        _write_sector_csv(sectors_dir / f"{t.lower()}_data.csv", "2024-12-19", t)

    yf_df = _make_yf_df(["2024-12-20"], "ANY")

    with patch("incremental_fetch.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history = MagicMock(return_value=yf_df)
        results = fetch_all(data_dir=tmp_path)

    for ticker, r in results.items():
        assert r["status"] == "updated", f"{ticker} expected 'updated', got {r['status']}"
