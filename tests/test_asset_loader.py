"""
Tests for api/utils/asset_loader.py.

Unit tests (no I/O): registry shape, unknown-ticker rejection, deduplication.
Integration tests (real file I/O): marked with @pytest.mark.integration and
skipped automatically when the data directory is absent (e.g. CI without data).
"""
import pytest
import pandas as pd
from pathlib import Path

from api.utils.asset_loader import available_tickers, load_asset_returns, AssetInfo

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_SPY_CSV   = _DATA_DIR / "spy_data.csv"
_XLU_CSV   = _DATA_DIR / "sectors" / "xlu_data.csv"

# Skip integration tests when data files are not on disk
needs_data = pytest.mark.skipif(
    not _SPY_CSV.exists(),
    reason="data/spy_data.csv not present — skipping integration tests",
)


# ── Registry (no I/O) ─────────────────────────────────────────────────────────

def test_registry_is_nonempty():
    assert len(available_tickers()) > 0


def test_registry_includes_spy():
    tickers = {a.ticker for a in available_tickers()}
    assert "SPY" in tickers


def test_registry_includes_cash():
    tickers = {a.ticker for a in available_tickers()}
    assert "cash" in tickers


def test_registry_all_categories_valid():
    valid = {"equity_index", "sector_etf", "cash"}
    for asset in available_tickers():
        assert asset.category in valid, (
            f"{asset.ticker} has unexpected category {asset.category!r}"
        )


def test_registry_returns_assetinfo_instances():
    for asset in available_tickers():
        assert isinstance(asset, AssetInfo)
        assert asset.ticker and asset.name and asset.category


def test_registry_no_duplicate_tickers():
    tickers = [a.ticker for a in available_tickers()]
    assert len(tickers) == len(set(tickers)), "Registry contains duplicate tickers"


# ── Unknown ticker / validation (no I/O) ─────────────────────────────────────

def test_unknown_ticker_raises_valueerror():
    with pytest.raises(ValueError, match="Unknown ticker"):
        load_asset_returns(["FAKE_TICKER"])


def test_multiple_unknown_tickers_listed_in_error():
    with pytest.raises(ValueError, match="Unknown ticker"):
        load_asset_returns(["FAKE1", "FAKE2"])


# ── Cash-only (requires SPY calendar as anchor) ───────────────────────────────

@needs_data
def test_cash_only_returns_all_zeros():
    df = load_asset_returns(["cash"])
    assert "cash" in df.columns
    assert (df["cash"] == 0.0).all()
    assert isinstance(df.index, pd.DatetimeIndex)


@needs_data
def test_cash_column_added_alongside_real_ticker():
    df = load_asset_returns(["SPY", "cash"])
    assert "SPY" in df.columns
    assert "cash" in df.columns
    assert (df["cash"] == 0.0).all()
    # SPY returns should vary
    assert df["SPY"].std() > 0


# ── Deduplication (no extra columns when ticker repeated) ────────────────────

@needs_data
def test_duplicate_tickers_deduplicated():
    df = load_asset_returns(["SPY", "SPY"])
    assert list(df.columns) == ["SPY"], (
        "Duplicate ticker should produce a single column"
    )


# ── Real data properties (integration) ───────────────────────────────────────

@needs_data
def test_spy_returns_has_datetimeindex():
    df = load_asset_returns(["SPY"])
    assert isinstance(df.index, pd.DatetimeIndex)


@needs_data
def test_spy_returns_are_decimal_fractions():
    df = load_asset_returns(["SPY"])
    # Daily returns should be small — no day should move ±100% in real history
    assert df["SPY"].abs().max() < 1.0, "Returns must be decimal fractions, not percentages"


@needs_data
def test_spy_returns_no_nulls():
    df = load_asset_returns(["SPY"])
    assert df["SPY"].isna().sum() == 0


@needs_data
def test_spy_returns_index_monotonic():
    df = load_asset_returns(["SPY"])
    assert df.index.is_monotonic_increasing


@needs_data
def test_spy_has_reasonable_history():
    df = load_asset_returns(["SPY"])
    # We expect several years of data — at least 500 trading days
    assert len(df) >= 500


# ── Date filtering ────────────────────────────────────────────────────────────

@needs_data
def test_start_date_clips_index():
    df = load_asset_returns(["SPY"], start="2020-01-01")
    assert df.index[0] >= pd.Timestamp("2020-01-01")


@needs_data
def test_end_date_clips_index():
    df = load_asset_returns(["SPY"], end="2020-12-31")
    assert df.index[-1] <= pd.Timestamp("2020-12-31")


@needs_data
def test_start_and_end_both_clip():
    df = load_asset_returns(["SPY"], start="2020-01-01", end="2020-12-31")
    assert df.index[0] >= pd.Timestamp("2020-01-01")
    assert df.index[-1] <= pd.Timestamp("2020-12-31")
    assert len(df) > 0


@needs_data
def test_impossible_date_range_raises():
    with pytest.raises(ValueError, match="No data"):
        load_asset_returns(["SPY"], start="2099-01-01", end="2099-12-31")


# ── Multi-ticker alignment ────────────────────────────────────────────────────

@needs_data
def test_spy_and_xlu_have_same_index():
    """Inner join means both columns share the same DatetimeIndex."""
    if not _XLU_CSV.exists():
        pytest.skip("XLU data file not present")
    df = load_asset_returns(["SPY", "XLU"])
    assert "SPY" in df.columns
    assert "XLU" in df.columns
    assert df.isna().sum().sum() == 0  # no NaNs after inner join
