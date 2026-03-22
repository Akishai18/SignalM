"""
Backtester API Router
Exposes two endpoints:
  GET  /api/backtester/assets  — list tradeable tickers
  POST /api/backtester/run     — run a regime-aware portfolio backtest
"""
from __future__ import annotations

import dataclasses
from datetime import date
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator, model_validator

from api.utils.asset_loader import available_tickers, load_asset_returns, AssetInfo
from api.utils.backtester import run_backtest, BacktestValidationError

router = APIRouter(prefix="/api/backtester", tags=["backtester"])

# Prefer the daily-updated SPY index regime labels (kept current by refresh_pipeline.py).
# Fall back to the 500-stock K4 labels when the index file is absent.
_SPY_INDEX_LABELS_PATH = Path("regime_results/indices/spy_regimes.csv")
_LABELS_PATH = (
    _SPY_INDEX_LABELS_PATH
    if _SPY_INDEX_LABELS_PATH.exists()
    else Path("regime_results/regime_labels_k4.csv")
)


# ── Pydantic models ───────────────────────────────────────────────────────────

class AssetResponse(BaseModel):
    ticker: str
    name: str
    category: str


class BacktestRequest(BaseModel):
    allocations: dict[str, dict[str, float]]
    # Keys are string regime ids ("0"–"3"); values are {ticker: weight}.
    # Weights per regime must sum <= 1.0. Remainder is implicit cash.
    # Example: {"0": {"SPY": 0.9, "XLU": 0.1}, "1": {"XLU": 0.8, "SPY": 0.2}}

    transaction_cost_bps: float = 10.0
    start_date: Optional[str] = None   # ISO date e.g. "2019-01-01"; None = full history
    end_date:   Optional[str] = None   # ISO date e.g. "2020-12-31"; None = latest

    @field_validator("allocations")
    @classmethod
    def allocations_not_empty(cls, v: dict) -> dict:
        if not v:
            raise ValueError("allocations must define at least one regime.")
        return v

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def valid_iso_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid date '{v}'. Expected ISO format YYYY-MM-DD.")
        return v

    @model_validator(mode="after")
    def start_before_end(self) -> "BacktestRequest":
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError(
                f"start_date ({self.start_date}) must be before end_date ({self.end_date})."
            )
        return self


class EquityCurvePoint(BaseModel):
    date: str
    value: float
    benchmark: float


class BacktestStatsResponse(BaseModel):
    total_return_pct: float
    cagr_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    calmar_ratio: float
    win_rate_pct: float
    num_rebalances: int
    benchmark_total_return_pct: float
    benchmark_sharpe: float


class RegimeBreakdownItem(BaseModel):
    regime_id: int
    days: int
    pct_time: float
    avg_daily_return_pct: float
    total_contribution_pct: float


class BacktestResponse(BaseModel):
    equity_curve: list[EquityCurvePoint]
    stats: BacktestStatsResponse
    regime_breakdown: list[RegimeBreakdownItem]
    rebalance_dates: list[str]
    tickers_used: list[str]
    date_range: dict[str, str]


# ── Helper: load regime labels ────────────────────────────────────────────────

def _load_regime_labels(
    start: Optional[str],
    end: Optional[str],
) -> pd.Series:
    """
    Load main S&P 500 regime labels.
    Follows the same pattern as predictions.py: index_col=0, parse_dates=True, squeeze.
    """
    if not _LABELS_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Regime labels file not found: {_LABELS_PATH}",
        )
    df = pd.read_csv(_LABELS_PATH, index_col=0, parse_dates=True)
    if df.shape[1] != 1:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Regime labels file has unexpected shape: "
                f"expected 1 data column, got {df.shape[1]}."
            ),
        )
    labels = df.iloc[:, 0].dropna()   # drop warmup-period NaN rows
    if start:
        labels = labels.loc[start:]
    if end:
        labels = labels.loc[:end]
    if labels.empty:
        raise HTTPException(
            status_code=422,
            detail=(
                f"No regime labels found in range "
                f"{start or 'start'} → {end or 'end'}."
            ),
        )
    return labels


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/assets", response_model=list[AssetResponse])
def get_assets():
    """List all tickers available for use in backtest allocations."""
    return [
        AssetResponse(ticker=a.ticker, name=a.name, category=a.category)
        for a in available_tickers()
    ]


@router.post("/run", response_model=BacktestResponse)
def run_backtest_endpoint(request: BacktestRequest):
    """
    Run a regime-aware portfolio backtest.

    Allocations are indexed by string regime id ("0"–"3"). Any regime not
    specified defaults to 100% cash. Weights per regime must sum to <= 1.0;
    the remainder is automatically treated as cash.
    """
    # Convert string regime keys → int
    try:
        allocations = {int(k): v for k, v in request.allocations.items()}
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Allocation keys must be integer regime IDs (e.g. '0', '1').",
        )

    # Collect all tickers needed; SPY is always required for the benchmark
    tickers_needed = {"SPY"}
    for weights in allocations.values():
        tickers_needed.update(t for t in weights if t != "cash")

    # Load data — let ValueError/BacktestValidationError propagate to handler below
    try:
        asset_returns = load_asset_returns(
            sorted(tickers_needed),
            start=request.start_date,
            end=request.end_date,
        )
        regime_labels = _load_regime_labels(request.start_date, request.end_date)
        result = run_backtest(
            regime_labels=regime_labels,
            asset_returns=asset_returns,
            allocations=allocations,
            transaction_cost_bps=request.transaction_cost_bps,
        )
    except HTTPException:
        raise  # re-raise 404/500 from _load_regime_labels
    except (BacktestValidationError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    if result.equity_curve.empty:
        raise HTTPException(
            status_code=422,
            detail="No overlapping dates between assets and regime labels.",
        )

    # Align equity and benchmark by index before serializing
    curves = pd.DataFrame({
        "value":     result.equity_curve,
        "benchmark": result.benchmark_curve,
    })
    equity_points = [
        EquityCurvePoint(
            date=d.strftime("%Y-%m-%d"),
            value=round(float(row["value"]), 4),
            benchmark=round(float(row["benchmark"]), 4),
        )
        for d, row in curves.iterrows()
    ]

    return BacktestResponse(
        equity_curve=equity_points,
        stats=BacktestStatsResponse(**dataclasses.asdict(result.stats)),
        regime_breakdown=[
            RegimeBreakdownItem(**dataclasses.asdict(rb))
            for rb in result.regime_breakdown
        ],
        rebalance_dates=result.rebalance_dates,
        tickers_used=sorted(tickers_needed),
        date_range={
            "start": result.equity_curve.index[0].strftime("%Y-%m-%d"),
            "end":   result.equity_curve.index[-1].strftime("%Y-%m-%d"),
        },
    )
