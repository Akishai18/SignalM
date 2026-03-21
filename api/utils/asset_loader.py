"""
Load and align daily asset returns from local data files.

Public interface
----------------
    available_tickers() -> list[AssetInfo]
    load_asset_returns(tickers, start, end) -> pd.DataFrame

The returned DataFrame has:
  - DatetimeIndex (tz-naive, business-day frequency)
  - One float column per requested ticker (daily simple return, decimal)
  - No NaN rows (rows missing any requested ticker are dropped)
  - "cash" column is always 0.0 (can be requested or used implicitly)
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

# Project root relative to this file: api/utils/ → ../../
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"


# ── Asset registry ────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class AssetInfo:
    ticker: str
    name: str
    category: str   # "equity_index" | "sector_etf" | "cash"


# All tickers the loader knows about.
_REGISTRY: list[AssetInfo] = [
    AssetInfo("SPY",  "SPDR S&P 500 ETF",              "equity_index"),
    AssetInfo("XLB",  "Materials Select Sector SPDR",   "sector_etf"),
    AssetInfo("XLC",  "Communication Services SPDR",    "sector_etf"),
    AssetInfo("XLE",  "Energy Select Sector SPDR",      "sector_etf"),
    AssetInfo("XLF",  "Financial Select Sector SPDR",   "sector_etf"),
    AssetInfo("XLI",  "Industrial Select Sector SPDR",  "sector_etf"),
    AssetInfo("XLK",  "Technology Select Sector SPDR",  "sector_etf"),
    AssetInfo("XLP",  "Consumer Staples SPDR",          "sector_etf"),
    AssetInfo("XLRE", "Real Estate SPDR",               "sector_etf"),
    AssetInfo("XLU",  "Utilities Select Sector SPDR",   "sector_etf"),
    AssetInfo("XLV",  "Health Care Select Sector SPDR", "sector_etf"),
    AssetInfo("XLY",  "Consumer Discretionary SPDR",    "sector_etf"),
    AssetInfo("cash", "Cash (0% return)",               "cash"),
]

_REGISTRY_MAP = {a.ticker: a for a in _REGISTRY}


# ── Per-source loaders ────────────────────────────────────────────────────────

def _load_spy() -> pd.Series:
    """
    SPY already has a pre-computed 'returns' column; use it directly.
    First row is NaN (no prior close); drop it.
    """
    df = pd.read_csv(
        _DATA_DIR / "spy_data.csv",
        parse_dates=["Date"],
        index_col="Date",
        usecols=["Date", "returns"],
    )
    return df["returns"].dropna().rename("SPY")


def _load_sector(ticker: str) -> pd.Series:
    """
    Sector CSVs have OHLCV only; compute simple daily return from close.
    Date strings include a UTC-offset suffix (e.g. '2012-01-03 00:00:00-05:00');
    strip to date only to match SPY's tz-naive index.
    """
    path = _DATA_DIR / "sectors" / f"{ticker.lower()}_data.csv"
    df = pd.read_csv(path, usecols=["Date", "close"])
    df["Date"] = pd.to_datetime(df["Date"].str[:10])
    df = df.set_index("Date").sort_index()
    returns = df["close"].pct_change().dropna()
    return returns.rename(ticker)


# ── Public API ────────────────────────────────────────────────────────────────

def available_tickers() -> list[AssetInfo]:
    """Return metadata for every ticker the loader can serve."""
    return list(_REGISTRY)


def load_asset_returns(
    tickers: list[str],
    start: str | None = None,
    end: str | None = None,
) -> pd.DataFrame:
    """
    Load daily simple returns for the requested tickers.

    Parameters
    ----------
    tickers : list[str]
        Subset of available ticker symbols. "cash" is always valid.
        Duplicate entries are silently deduplicated.
    start : str, optional
        ISO date string. If omitted, uses the earliest available date
        across all requested tickers (i.e. their common start).
    end : str, optional
        ISO date string. If omitted, uses the latest available date.

    Returns
    -------
    pd.DataFrame
        DatetimeIndex × ticker columns, daily simple returns (decimal).
        Rows with any NaN are dropped (inner join on dates).

    Raises
    ------
    ValueError
        If any ticker is unknown or if the resulting DataFrame is empty.
    """
    tickers = list(dict.fromkeys(tickers))  # deduplicate, preserve order

    unknown = [t for t in tickers if t not in _REGISTRY_MAP]
    if unknown:
        valid = sorted(_REGISTRY_MAP)
        raise ValueError(
            f"Unknown ticker(s): {unknown}. "
            f"Available: {valid}"
        )

    series: list[pd.Series] = []
    for ticker in tickers:
        if ticker == "cash":
            continue  # added after alignment (always 0.0)
        elif ticker == "SPY":
            series.append(_load_spy())
        else:
            series.append(_load_sector(ticker))

    if not series:
        # Only "cash" was requested — build a minimal all-zero frame
        # using SPY dates as the calendar anchor
        spy = _load_spy()
        frame = pd.DataFrame(index=spy.index)
    else:
        # Inner join: only keep dates present in ALL requested series
        frame = pd.concat(series, axis=1).dropna()

    # Add cash column last (always 0.0, same index)
    if "cash" in tickers:
        frame["cash"] = 0.0

    # Apply date filters
    if start:
        frame = frame.loc[start:]
    if end:
        frame = frame.loc[:end]

    if frame.empty:
        raise ValueError(
            f"No data in the requested range "
            f"(start={start!r}, end={end!r}) for tickers {tickers}."
        )

    return frame
