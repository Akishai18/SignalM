"""
Incremental market data updater for SignalM.

Reads each CSV file, detects the last available date, and fetches only new
trading days from yfinance. Three file schemas are handled:

  data/spy_data.csv           SPY, tz-naive dates, has pre-computed derived cols
  data/vix_data.csv           VIX, tz-naive dates, no capital_gains column
  data/sectors/*_data.csv     11 sector ETFs, OHLCV only, tz-aware date strings

Returns a per-ticker summary dict: {ticker: {rows_added, data_through, status}}
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

log = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

SECTOR_TICKERS = [
    "XLB", "XLC", "XLE", "XLF", "XLI",
    "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY",
]

# Consider data "up to date" if it's within this many days of today
_UP_TO_DATE_DAYS = 1


# ── Low-level helpers ─────────────────────────────────────────────────────────

def _last_csv_date(csv_path: Path) -> Optional[pd.Timestamp]:
    """
    Return the latest date in a CSV's first column (the index), tz-naive.
    Returns None if the file does not exist or is empty.
    Handles both tz-naive ('2024-12-19') and tz-aware ('2024-12-19 00:00:00-05:00') strings.
    """
    if not csv_path.exists():
        return None

    # Read only the first column to determine the last date efficiently
    raw = pd.read_csv(csv_path, usecols=[0])
    if raw.empty:
        return None

    date_col = raw.iloc[:, 0].astype(str)
    # First 10 chars are always YYYY-MM-DD regardless of tz suffix
    parsed = pd.to_datetime(date_col.str[:10], errors="coerce").dropna()
    if parsed.empty:
        return None

    return pd.Timestamp(parsed.max().date())


def _fetch_raw(ticker: str, start: date, end: date) -> Optional[pd.DataFrame]:
    """
    Fetch OHLCV from yfinance for the given date range (start inclusive, end exclusive).

    Returns a DataFrame with:
      - tz-naive, date-only DatetimeIndex named "Date"
      - lowercase column names
    Returns None on empty response or error.
    """
    try:
        t = yf.Ticker(ticker)
        df = t.history(
            start=str(start),
            end=str(end),
            interval="1d",
            auto_adjust=False,
        )
    except Exception as exc:
        log.warning("yfinance error fetching %s: %s", ticker, exc)
        return None

    if df is None or df.empty:
        return None

    # Lowercase column names (yfinance returns 'Open', 'Close', 'Stock Splits', etc.)
    df.columns = [c.lower() for c in df.columns]

    # Normalize index to tz-naive, date-only timestamps
    if df.index.tzinfo is not None:
        df.index = df.index.tz_localize(None)
    df.index = df.index.normalize()   # strip any residual time component
    df.index.name = "Date"

    return df


# ── SPY ───────────────────────────────────────────────────────────────────────

def _compute_spy_derived(df: pd.DataFrame) -> pd.DataFrame:
    """
    Recompute all derived columns from close prices on the full dataset.
    Must operate on the full history (not just new rows) so rolling windows
    spanning the old/new boundary are computed correctly.
    """
    df = df.copy()
    df["returns"] = df["close"].pct_change()
    df["log_returns"] = np.log(df["close"] / df["close"].shift(1))
    df["cum_returns"] = (1 + df["returns"]).cumprod() - 1
    df["vol_21d"] = df["returns"].rolling(21).std() * np.sqrt(252)
    df["vol_63d"] = df["returns"].rolling(63).std() * np.sqrt(252)
    df["vol_252d"] = df["returns"].rolling(252).std() * np.sqrt(252)
    df["sma_50"] = df["close"].rolling(50).mean()
    df["sma_200"] = df["close"].rolling(200).mean()
    df["trend_50_200"] = df["sma_50"] > df["sma_200"]
    return df


# Raw OHLCV columns present in spy_data.csv (before derived cols)
_SPY_RAW_COLS = [
    "open", "high", "low", "close", "volume",
    "dividends", "stock splits", "capital gains", "symbol",
]
_SPY_DERIVED_COLS = [
    "returns", "log_returns", "cum_returns",
    "vol_21d", "vol_63d", "vol_252d",
    "sma_50", "sma_200", "trend_50_200",
]
_SPY_COL_ORDER = _SPY_RAW_COLS + _SPY_DERIVED_COLS


def fetch_spy(data_dir: Path) -> dict:
    """
    Incrementally update data/spy_data.csv and recompute all derived columns.

    Returns a result dict: {ticker, rows_added, data_through, status}
    """
    csv_path = data_dir / "spy_data.csv"
    last_date = _last_csv_date(csv_path)
    today = pd.Timestamp(date.today())

    if last_date is not None and last_date >= today - pd.Timedelta(days=_UP_TO_DATE_DAYS):
        return {
            "ticker": "SPY",
            "rows_added": 0,
            "data_through": str(last_date.date()),
            "status": "up_to_date",
        }

    fetch_start = (
        (last_date + pd.Timedelta(days=1)).date()
        if last_date is not None
        else date(2012, 1, 1)
    )
    fetch_end = today.date() + timedelta(days=1)  # yfinance end is exclusive

    new_raw = _fetch_raw("SPY", fetch_start, fetch_end)
    if new_raw is None or new_raw.empty:
        return {
            "ticker": "SPY",
            "rows_added": 0,
            "data_through": str(last_date.date()) if last_date else "unknown",
            "status": "no_new_data",
        }

    # Build new rows with only the raw columns (derived will be recomputed)
    available = [c for c in _SPY_RAW_COLS if c in new_raw.columns]
    new_rows = new_raw[available].copy()
    new_rows["symbol"] = "SPY"

    # Ensure all raw cols present (fill missing with NaN)
    for col in _SPY_RAW_COLS:
        if col not in new_rows.columns:
            new_rows[col] = float("nan")

    # Read the full existing file (needed for rolling window continuity)
    existing = pd.read_csv(csv_path, index_col=0)
    existing.index = pd.to_datetime(existing.index.astype(str).str[:10])
    existing.index.name = "Date"

    # Combine raw base of existing with new rows, dedup, sort
    existing_base = existing[[c for c in _SPY_RAW_COLS if c in existing.columns]]
    combined = pd.concat([existing_base, new_rows])
    combined = combined[~combined.index.duplicated(keep="last")].sort_index()

    # Recompute derived columns on the full combined dataset
    combined = _compute_spy_derived(combined)

    # Restore canonical column order (skip any missing)
    combined = combined[[c for c in _SPY_COL_ORDER if c in combined.columns]]
    combined.to_csv(csv_path)

    return {
        "ticker": "SPY",
        "rows_added": len(new_rows),
        "data_through": str(combined.index.max().date()),
        "status": "updated",
    }


# ── VIX ───────────────────────────────────────────────────────────────────────

# VIX has no 'capital gains' column
_VIX_COL_ORDER = [
    "open", "high", "low", "close", "volume",
    "dividends", "stock splits", "symbol",
]


def fetch_vix(data_dir: Path) -> dict:
    """Incrementally update data/vix_data.csv."""
    csv_path = data_dir / "vix_data.csv"
    last_date = _last_csv_date(csv_path)
    today = pd.Timestamp(date.today())

    if last_date is not None and last_date >= today - pd.Timedelta(days=_UP_TO_DATE_DAYS):
        return {
            "ticker": "VIX",
            "rows_added": 0,
            "data_through": str(last_date.date()),
            "status": "up_to_date",
        }

    fetch_start = (
        (last_date + pd.Timedelta(days=1)).date()
        if last_date is not None
        else date(2012, 1, 1)
    )
    fetch_end = today.date() + timedelta(days=1)

    new_raw = _fetch_raw("^VIX", fetch_start, fetch_end)
    if new_raw is None or new_raw.empty:
        return {
            "ticker": "VIX",
            "rows_added": 0,
            "data_through": str(last_date.date()) if last_date else "unknown",
            "status": "no_new_data",
        }

    available = [c for c in _VIX_COL_ORDER if c in new_raw.columns]
    new_rows = new_raw[available].copy()
    new_rows["symbol"] = "^VIX"

    existing = pd.read_csv(csv_path, index_col=0)
    existing.index = pd.to_datetime(existing.index.astype(str).str[:10])
    existing.index.name = "Date"

    combined = pd.concat([existing, new_rows])
    combined = combined[~combined.index.duplicated(keep="last")].sort_index()
    combined = combined[[c for c in _VIX_COL_ORDER if c in combined.columns]]
    combined.to_csv(csv_path)

    return {
        "ticker": "VIX",
        "rows_added": len(new_rows),
        "data_through": str(combined.index.max().date()),
        "status": "updated",
    }


# ── Sector ETFs ───────────────────────────────────────────────────────────────

_SECTOR_COL_ORDER = [
    "open", "high", "low", "close", "volume",
    "dividends", "stock splits", "capital gains", "symbol",
]


def fetch_sector(ticker: str, data_dir: Path) -> dict:
    """Incrementally update data/sectors/{ticker.lower()}_data.csv."""
    csv_path = data_dir / "sectors" / f"{ticker.lower()}_data.csv"
    last_date = _last_csv_date(csv_path)
    today = pd.Timestamp(date.today())

    if last_date is not None and last_date >= today - pd.Timedelta(days=_UP_TO_DATE_DAYS):
        return {
            "ticker": ticker,
            "rows_added": 0,
            "data_through": str(last_date.date()),
            "status": "up_to_date",
        }

    fetch_start = (
        (last_date + pd.Timedelta(days=1)).date()
        if last_date is not None
        else date(2012, 1, 1)
    )
    fetch_end = today.date() + timedelta(days=1)

    new_raw = _fetch_raw(ticker, fetch_start, fetch_end)
    if new_raw is None or new_raw.empty:
        return {
            "ticker": ticker,
            "rows_added": 0,
            "data_through": str(last_date.date()) if last_date else "unknown",
            "status": "no_new_data",
        }

    available = [c for c in _SECTOR_COL_ORDER if c in new_raw.columns]
    new_rows = new_raw[available].copy()
    new_rows["symbol"] = ticker

    # Read existing, normalizing the tz-aware date strings to tz-naive
    existing = pd.read_csv(csv_path, index_col=0)
    existing.index = pd.to_datetime(existing.index.astype(str).str[:10])
    existing.index.name = "Date"

    combined = pd.concat([existing, new_rows])
    combined = combined[~combined.index.duplicated(keep="last")].sort_index()
    combined = combined[[c for c in _SECTOR_COL_ORDER if c in combined.columns]]
    combined.to_csv(csv_path)

    return {
        "ticker": ticker,
        "rows_added": len(new_rows),
        "data_through": str(combined.index.max().date()),
        "status": "updated",
    }


# ── Orchestrator ──────────────────────────────────────────────────────────────

def fetch_all(data_dir: Optional[Path] = None) -> dict[str, dict]:
    """
    Incrementally update all market data CSVs (SPY, VIX, 11 sector ETFs).

    Args:
        data_dir: Path to the project data/ directory.
                  Defaults to <repo_root>/data relative to this script.

    Returns:
        Dict mapping ticker → result summary dict.
    """
    if data_dir is None:
        # scripts/incremental_fetch.py lives one level below the repo root
        data_dir = Path(__file__).resolve().parent.parent / "data"

    log.info("Incremental fetch starting — data_dir=%s", data_dir)
    results: dict[str, dict] = {}

    results["SPY"] = fetch_spy(data_dir)
    log.info("SPY → %s", results["SPY"]["status"])

    results["VIX"] = fetch_vix(data_dir)
    log.info("VIX → %s", results["VIX"]["status"])

    for ticker in SECTOR_TICKERS:
        results[ticker] = fetch_sector(ticker, data_dir)
        log.info("%s → %s", ticker, results[ticker]["status"])

    updated = sum(1 for r in results.values() if r["status"] == "updated")
    log.info("Done — %d/%d tickers updated", updated, len(results))
    return results


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Incrementally fetch new market data")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="Path to the data/ directory (default: auto-detected from script location)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    args = parser.parse_args()

    logging.basicConfig(level=getattr(logging, args.log_level), format="%(levelname)s %(message)s")

    results = fetch_all(data_dir=args.data_dir)

    print("\n" + "=" * 60)
    print("INCREMENTAL FETCH SUMMARY")
    print("=" * 60)
    for ticker, r in results.items():
        icon = "✓" if r["status"] in ("updated", "up_to_date") else "⚠"
        rows = r.get("rows_added", 0)
        through = r.get("data_through", "?")
        print(f"  {icon} {ticker:6s}  {r['status']:15s}  rows_added={rows:4d}  through={through}")

    total_rows = sum(r.get("rows_added", 0) for r in results.values())
    print(f"\n  Total new rows written: {total_rows}")
