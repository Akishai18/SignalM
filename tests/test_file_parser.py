"""
Tests for api/utils/file_parser.py
Covers: CSV wide/long, Excel, JSON, date parsing, numeric coercion, validation.
"""
import io
import pytest
import pandas as pd
import numpy as np
from pathlib import Path
import tempfile
import os

from api.utils.file_parser import parse_user_file, FileParseError


# ── Helpers ───────────────────────────────────────────────────────────────────

def _write_tmp(content: bytes, suffix: str) -> str:
    """Write bytes to a temp file and return the path."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(content)
        return f.name


def _prices_csv(n_rows=100, n_tickers=3, start="2020-01-01") -> bytes:
    """Generate a valid wide-format CSV price file."""
    dates = pd.date_range(start, periods=n_rows, freq="B")
    df = pd.DataFrame(
        np.random.uniform(100, 200, size=(n_rows, n_tickers)),
        index=dates,
        columns=[f"TICK{i}" for i in range(n_tickers)],
    )
    df.index.name = "Date"
    return df.reset_index().to_csv(index=False).encode()


# ── CSV wide format ───────────────────────────────────────────────────────────

def test_csv_wide_basic():
    path = _write_tmp(_prices_csv(100, 3), ".csv")
    try:
        df = parse_user_file(path)
        assert df.shape == (100, 3)
        assert isinstance(df.index, pd.DatetimeIndex)
        assert df.dtypes.apply(lambda d: pd.api.types.is_float_dtype(d)).all()
    finally:
        os.unlink(path)


def test_csv_wide_single_ticker():
    path = _write_tmp(_prices_csv(100, 1), ".csv")
    try:
        df = parse_user_file(path)
        assert df.shape[1] == 1
    finally:
        os.unlink(path)


# ── CSV long format ───────────────────────────────────────────────────────────

def test_csv_long_format():
    dates = pd.date_range("2020-01-01", periods=100, freq="B")
    rows = []
    for d in dates:
        for ticker in ["AAPL", "MSFT"]:
            rows.append({"Date": d.strftime("%Y-%m-%d"), "Symbol": ticker,
                         "Adj Close": round(np.random.uniform(100, 300), 2)})
    csv_bytes = pd.DataFrame(rows).to_csv(index=False).encode()
    path = _write_tmp(csv_bytes, ".csv")
    try:
        df = parse_user_file(path)
        assert set(df.columns) == {"AAPL", "MSFT"}
        assert len(df) == 100
    finally:
        os.unlink(path)


# ── Date format handling ──────────────────────────────────────────────────────

@pytest.mark.parametrize("fmt", [
    "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y%m%d",
])
def test_date_formats(fmt):
    dates = pd.date_range("2020-01-01", periods=100, freq="B")
    df = pd.DataFrame({"Date": [d.strftime(fmt) for d in dates],
                       "PRICE": np.random.uniform(100, 200, 100)})
    path = _write_tmp(df.to_csv(index=False).encode(), ".csv")
    try:
        result = parse_user_file(path)
        assert isinstance(result.index, pd.DatetimeIndex)
        assert len(result) == 100
    finally:
        os.unlink(path)


# ── Numeric coercion ──────────────────────────────────────────────────────────

def test_currency_symbols_stripped():
    dates = pd.date_range("2020-01-01", periods=100, freq="B")
    df = pd.DataFrame({
        "Date": dates.strftime("%Y-%m-%d"),
        "PRICE": [f"${v:.2f}" for v in np.random.uniform(100, 200, 100)],
    })
    path = _write_tmp(df.to_csv(index=False).encode(), ".csv")
    try:
        result = parse_user_file(path)
        assert result["PRICE"].notna().all()
        assert pd.api.types.is_float_dtype(result["PRICE"])
    finally:
        os.unlink(path)


def test_comma_separators_stripped():
    dates = pd.date_range("2020-01-01", periods=100, freq="B")
    df = pd.DataFrame({
        "Date": dates.strftime("%Y-%m-%d"),
        "PRICE": ["1,234.56"] * 100,
    })
    path = _write_tmp(df.to_csv(index=False).encode(), ".csv")
    try:
        result = parse_user_file(path)
        assert (result["PRICE"] == 1234.56).all()
    finally:
        os.unlink(path)


# ── JSON format ───────────────────────────────────────────────────────────────

def test_json_records():
    import json
    dates = pd.date_range("2020-01-01", periods=100, freq="B")
    records = [{"Date": d.strftime("%Y-%m-%d"), "SPY": round(float(v), 2)}
               for d, v in zip(dates, np.random.uniform(200, 400, 100))]
    path = _write_tmp(json.dumps(records).encode(), ".json")
    try:
        df = parse_user_file(path)
        assert len(df) == 100
        assert "SPY" in df.columns
    finally:
        os.unlink(path)


# ── Validation errors ─────────────────────────────────────────────────────────

def test_too_few_rows_raises():
    path = _write_tmp(_prices_csv(30, 2), ".csv")
    try:
        with pytest.raises(FileParseError, match="63 trading days"):
            parse_user_file(path)
    finally:
        os.unlink(path)


def test_negative_prices_raises():
    dates = pd.date_range("2020-01-01", periods=100, freq="B")
    df = pd.DataFrame({"Date": dates.strftime("%Y-%m-%d"),
                       "PRICE": np.random.uniform(-10, -1, 100)})
    path = _write_tmp(df.to_csv(index=False).encode(), ".csv")
    try:
        with pytest.raises(FileParseError, match="Negative prices"):
            parse_user_file(path)
    finally:
        os.unlink(path)


def test_no_date_column_raises():
    df = pd.DataFrame({"A": range(100), "B": range(100)})
    path = _write_tmp(df.to_csv(index=False).encode(), ".csv")
    try:
        with pytest.raises(FileParseError, match="date column"):
            parse_user_file(path)
    finally:
        os.unlink(path)


def test_sparse_tickers_dropped():
    """Tickers with >80% missing values should be dropped, not cause failure."""
    dates = pd.date_range("2020-01-01", periods=100, freq="B")
    prices = np.random.uniform(100, 200, (100, 2))
    df = pd.DataFrame(prices, index=dates, columns=["GOOD", "BAD"])
    # Make BAD 90% NaN
    df.loc[df.index[:90], "BAD"] = np.nan
    df.index.name = "Date"
    path = _write_tmp(df.reset_index().to_csv(index=False).encode(), ".csv")
    try:
        result = parse_user_file(path)
        assert "GOOD" in result.columns
        assert "BAD" not in result.columns
    finally:
        os.unlink(path)
