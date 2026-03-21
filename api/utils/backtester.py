"""
Core vectorized backtesting engine for regime-aware portfolio strategies.

run_backtest() is the single entry point. Everything is fully vectorized —
no Python loops over dates or assets.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd


# ── Result types ──────────────────────────────────────────────────────────────

@dataclass
class BacktestStats:
    total_return_pct: float
    cagr_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    calmar_ratio: float
    win_rate_pct: float
    num_rebalances: int
    benchmark_total_return_pct: float
    benchmark_sharpe: float


@dataclass
class RegimeBreakdown:
    regime_id: int
    days: int
    pct_time: float
    avg_daily_return_pct: float
    total_contribution_pct: float   # sum of portfolio daily returns while in this regime


@dataclass
class BacktestResult:
    equity_curve: pd.Series         # DatetimeIndex → portfolio value ($)
    benchmark_curve: pd.Series      # DatetimeIndex → SPY B&H value ($)
    daily_returns: pd.Series        # DatetimeIndex → daily portfolio return (decimal)
    rebalance_dates: list[str]      # ISO date strings of each rebalance event
    stats: BacktestStats
    regime_breakdown: list[RegimeBreakdown]


# ── Validation ────────────────────────────────────────────────────────────────

class BacktestValidationError(ValueError):
    pass


def _validate_inputs(
    regime_labels: pd.Series,
    asset_returns: pd.DataFrame,
    allocations: dict[int, dict[str, float]],
    transaction_cost_bps: float,
    initial_value: float,
) -> None:
    if not isinstance(regime_labels.index, pd.DatetimeIndex):
        raise BacktestValidationError("regime_labels must have a DatetimeIndex")
    if not isinstance(asset_returns.index, pd.DatetimeIndex):
        raise BacktestValidationError("asset_returns must have a DatetimeIndex")
    if initial_value <= 0:
        raise BacktestValidationError("initial_value must be positive")
    if transaction_cost_bps < 0:
        raise BacktestValidationError("transaction_cost_bps must be >= 0")

    for regime_id, weights in allocations.items():
        if not isinstance(weights, dict):
            raise BacktestValidationError(
                f"Allocations for regime {regime_id} must be a dict of {{ticker: weight}}"
            )
        total = sum(weights.values())
        if total > 1.0 + 1e-9:
            raise BacktestValidationError(
                f"Weights for regime {regime_id} sum to {total:.4f} > 1.0. "
                "Remainder is treated as cash; weights must not exceed 1.0."
            )
        unknown_assets = set(weights.keys()) - set(asset_returns.columns) - {"cash"}
        if unknown_assets:
            raise BacktestValidationError(
                f"Unknown assets in regime {regime_id} allocations: {unknown_assets}. "
                f"Available: {sorted(asset_returns.columns)}"
            )


# ── Statistics helpers ─────────────────────────────────────────────────────────

def _sharpe(daily_returns: pd.Series) -> float:
    """Annualized Sharpe ratio (risk-free rate = 0)."""
    std = daily_returns.std()
    if len(daily_returns) < 2 or std < 1e-10:
        return 0.0
    return float(daily_returns.mean() / std * math.sqrt(252))


def _max_drawdown(equity: pd.Series) -> float:
    """Maximum drawdown as a negative percentage (e.g. -0.35 = -35%)."""
    rolling_max = equity.cummax()
    drawdown = equity / rolling_max - 1
    return float(drawdown.min())


def _cagr(equity: pd.Series) -> float:
    """Compound annual growth rate."""
    n_years = len(equity) / 252
    if n_years <= 0 or equity.iloc[0] <= 0:
        return 0.0
    return float((equity.iloc[-1] / equity.iloc[0]) ** (1 / n_years) - 1)


# ── Core engine ───────────────────────────────────────────────────────────────

def run_backtest(
    regime_labels: pd.Series,
    asset_returns: pd.DataFrame,
    allocations: dict[int, dict[str, float]],
    transaction_cost_bps: float = 10.0,
    initial_value: float = 10_000.0,
    spy_col: str = "SPY",
) -> BacktestResult:
    """
    Run a regime-aware portfolio backtest.

    Parameters
    ----------
    regime_labels : pd.Series
        DatetimeIndex → integer regime id (0-3). Typically daily.
    asset_returns : pd.DataFrame
        DatetimeIndex → daily returns (decimal) per asset column.
        Must include `spy_col` for the benchmark.
    allocations : dict[int, dict[str, float]]
        {regime_id: {asset_ticker: weight}}. Weights must sum <= 1.0.
        Remainder is implicitly allocated to cash (0% return).
        Not all regime ids need to be present; missing ones default to 100% cash.
    transaction_cost_bps : float
        Flat basis-point haircut applied to portfolio return on each rebalance day.
    initial_value : float
        Starting portfolio value in dollars.
    spy_col : str
        Column name in asset_returns to use as the buy-and-hold benchmark.

    Returns
    -------
    BacktestResult
    """
    _validate_inputs(regime_labels, asset_returns, allocations, transaction_cost_bps, initial_value)

    # ── 1. Align on common dates ───────────────────────────────────────────────
    common_idx = regime_labels.index.intersection(asset_returns.index)
    if len(common_idx) == 0:
        raise BacktestValidationError("No overlapping dates between regime_labels and asset_returns")

    labels = regime_labels.loc[common_idx].astype(int)
    returns = asset_returns.loc[common_idx].fillna(0.0)  # flat return on missing days

    # ── 2. Build allocation matrix (n_regimes × n_assets) ─────────────────────
    all_assets = list(returns.columns)
    n_regimes = max(allocations.keys(), default=0) + 1
    n_regimes = max(n_regimes, int(labels.max()) + 1)

    # Default: all cash (zeros)
    alloc_matrix = pd.DataFrame(
        np.zeros((n_regimes, len(all_assets))),
        index=range(n_regimes),
        columns=all_assets,
    )
    for regime_id, weights in allocations.items():
        for ticker, w in weights.items():
            if ticker != "cash" and ticker in alloc_matrix.columns:
                alloc_matrix.loc[regime_id, ticker] = w

    # ── 3. Build per-day weight matrix via vectorized fancy index ──────────────
    # labels.values is a NumPy int array — .loc with an array = O(n) vectorized
    weight_matrix = alloc_matrix.loc[labels.values].copy()
    weight_matrix.index = labels.index  # restore DatetimeIndex

    # ── 4. Daily portfolio return ──────────────────────────────────────────────
    daily_port_ret = (weight_matrix * returns).sum(axis=1)

    # ── 5. Apply transaction cost on rebalance days ────────────────────────────
    rebalance_mask = labels.diff().ne(0).astype(bool)
    rebalance_mask.iloc[0] = False  # initial allocation: no cost on day 0
    cost = transaction_cost_bps / 10_000
    daily_port_ret[rebalance_mask] -= cost

    rebalance_dates = rebalance_mask[rebalance_mask].index.strftime("%Y-%m-%d").tolist()

    # ── 6. Equity curve ────────────────────────────────────────────────────────
    equity_curve = initial_value * (1 + daily_port_ret).cumprod()

    # ── 7. Benchmark: buy-and-hold SPY ─────────────────────────────────────────
    if spy_col not in returns.columns:
        raise BacktestValidationError(
            f"Benchmark column '{spy_col}' not found in asset_returns. "
            f"Available: {list(returns.columns)}"
        )
    benchmark_curve = initial_value * (1 + returns[spy_col]).cumprod()

    # ── 8. Summary statistics ──────────────────────────────────────────────────
    total_ret = float(equity_curve.iloc[-1] / initial_value - 1) * 100
    cagr = _cagr(equity_curve) * 100
    sharpe = _sharpe(daily_port_ret)
    mdd = _max_drawdown(equity_curve) * 100
    calmar = cagr / abs(mdd) if mdd != 0 else 0.0
    win_rate = float((daily_port_ret > 0).mean()) * 100
    bm_total_ret = float(benchmark_curve.iloc[-1] / initial_value - 1) * 100
    bm_sharpe = _sharpe(returns[spy_col])

    stats = BacktestStats(
        total_return_pct=round(total_ret, 4),
        cagr_pct=round(cagr, 4),
        sharpe_ratio=round(sharpe, 4),
        max_drawdown_pct=round(mdd, 4),
        calmar_ratio=round(calmar, 4),
        win_rate_pct=round(win_rate, 4),
        num_rebalances=int(rebalance_mask.sum()),
        benchmark_total_return_pct=round(bm_total_ret, 4),
        benchmark_sharpe=round(bm_sharpe, 4),
    )

    # ── 9. Per-regime breakdown ────────────────────────────────────────────────
    regime_breakdown: list[RegimeBreakdown] = []
    n_total = len(labels)
    for r_id in sorted(labels.unique()):
        mask = labels == r_id
        days = int(mask.sum())
        avg_ret = float(daily_port_ret[mask].mean()) * 100
        contribution = float(daily_port_ret[mask].sum()) * 100
        regime_breakdown.append(RegimeBreakdown(
            regime_id=int(r_id),
            days=days,
            pct_time=round(days / n_total * 100, 2),
            avg_daily_return_pct=round(avg_ret, 4),
            total_contribution_pct=round(contribution, 4),
        ))

    return BacktestResult(
        equity_curve=equity_curve,
        benchmark_curve=benchmark_curve,
        daily_returns=daily_port_ret,
        rebalance_dates=rebalance_dates,
        stats=stats,
        regime_breakdown=regime_breakdown,
    )
