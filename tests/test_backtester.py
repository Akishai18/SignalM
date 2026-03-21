"""
Manual-verification tests for api/utils/backtester.py.

Every expected value here is hand-calculated from first principles so failures
point directly at which computation broke — no fuzzy "output changed" checks.
"""
import math
import pytest
import pandas as pd
import numpy as np

from api.utils.backtester import (
    run_backtest,
    BacktestValidationError,
    _sharpe,
    _max_drawdown,
    _cagr,
)


# ── Shared fixture helpers ────────────────────────────────────────────────────

DATES_10 = pd.date_range("2020-01-01", periods=10, freq="B")


def _make_returns(
    A: float = 0.01,
    B: float = 0.00,
    SPY: float = 0.005,
    n: int = 10,
) -> pd.DataFrame:
    """
    Deterministic constant-return DataFrame.
    A   = growth asset (+1% by default)
    B   = flat asset   (0% by default, acts as cash)
    SPY = benchmark    (+0.5% by default)
    """
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    return pd.DataFrame({"A": A, "B": B, "SPY": SPY}, index=dates)


def _make_labels(sequence: list[int]) -> pd.Series:
    n = len(sequence)
    dates = pd.date_range("2020-01-01", periods=n, freq="B")
    return pd.Series(sequence, index=dates, name="regime", dtype=int)


# ── Test 1: single regime, 100% A, no costs ───────────────────────────────────
#
# Setup:
#   10 days, regime 0 throughout
#   100% A, A returns 1% every day
#   0 bps transaction costs
#
# Manual calculation:
#   equity[t] = 10000 * 1.01^t
#   equity[10] = 10000 * 1.01^10 = 11046.2212...
#   total_return = 10.462%
#   num_rebalances = 0   (regime never changes)
#   max_drawdown = 0.0   (strictly rising curve)

def test_single_regime_constant_returns_no_cost():
    returns = _make_returns(A=0.01)
    labels = _make_labels([0] * 10)
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}},
        transaction_cost_bps=0,
        initial_value=10_000,
    )

    expected_final = 10_000 * (1.01 ** 10)
    assert math.isclose(result.equity_curve.iloc[-1], expected_final, rel_tol=1e-10)

    # stats are rounded to 4dp — use abs_tol of 0.001 (1/100th of a percent)
    expected_total_ret = (1.01 ** 10 - 1) * 100
    assert math.isclose(result.stats.total_return_pct, expected_total_ret, abs_tol=0.001)

    assert result.stats.num_rebalances == 0
    assert result.stats.max_drawdown_pct == 0.0  # monotonically increasing


# ── Test 2: two regimes, no costs — verify equity at the switch point ─────────
#
# Setup:
#   Days 1-5:  regime 0 → 100% A (+1%/day)
#   Days 6-10: regime 1 → 100% B ( 0%/day, flat)
#   0 bps costs
#
# Manual calculation:
#   After day 5:  10000 * 1.01^5  = 10510.1005...
#   After day 10: unchanged       = 10510.1005...  (B earns 0%)
#   Rebalances: 1  (at day 6, when regime switches 0→1)
#   max_drawdown = 0.0  (equity never falls)

def test_two_regime_switch_no_cost():
    returns = _make_returns(A=0.01, B=0.00)
    labels = _make_labels([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}, 1: {"B": 1.0}},
        transaction_cost_bps=0,
        initial_value=10_000,
    )

    after_switch = 10_000 * (1.01 ** 5)  # exactly here equity stops growing

    # Equity at index 4 (day 5, last day of regime 0)
    assert math.isclose(result.equity_curve.iloc[4], after_switch, rel_tol=1e-10)

    # Equity at index 9 (day 10, last day of regime 1) — unchanged
    assert math.isclose(result.equity_curve.iloc[9], after_switch, rel_tol=1e-10)

    # Exactly one rebalance (day 6)
    assert result.stats.num_rebalances == 1
    assert len(result.rebalance_dates) == 1

    # Max drawdown is zero — equity never falls
    assert result.stats.max_drawdown_pct == 0.0


# ── Test 3: transaction cost deducted once on rebalance day ───────────────────
#
# Setup:
#   Same as Test 2 but with 10 bps (0.001) transaction cost.
#
# Manual calculation:
#   Days 1-5:  100% A at +1%/day → 10000 * 1.01^5
#   Day 6:     regime 1, B earns 0%  MINUS  10bps cost → daily_return = -0.001
#   Days 7-10: 100% B at 0%/day → flat
#
#   equity[day 5] = 10000 * 1.01^5
#   equity[day 6] = equity[day 5] * (1 - 0.001)
#   equity[day 10] = equity[day 6]   (B is flat)
#
#   total_return = (1.01^5 * 0.999) - 1

def test_transaction_cost_deducted_once_on_rebalance():
    returns = _make_returns(A=0.01, B=0.00)
    labels = _make_labels([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}, 1: {"B": 1.0}},
        transaction_cost_bps=10,
        initial_value=10_000,
    )

    expected_day5 = 10_000 * (1.01 ** 5)
    expected_day6 = expected_day5 * (1 - 0.001)   # cost hits on day 6
    expected_final = expected_day6                 # B is flat for days 7-10

    assert math.isclose(result.equity_curve.iloc[4], expected_day5, rel_tol=1e-10)
    assert math.isclose(result.equity_curve.iloc[5], expected_day6, rel_tol=1e-10)
    assert math.isclose(result.equity_curve.iloc[9], expected_final, rel_tol=1e-10)

    expected_total_pct = (1.01 ** 5 * 0.999 - 1) * 100
    assert math.isclose(result.stats.total_return_pct, expected_total_pct, rel_tol=1e-6)

    # Only 1 rebalance — cost applied once, not twice
    assert result.stats.num_rebalances == 1


# ── Test 4: no cost on day 0 even though diff() gives NaN there ───────────────
#
# If iloc[0] guard fails, a cost would be deducted on the very first day,
# making equity[0] < 10000 * 1.01 (instead of exactly equal).

def test_no_cost_on_day_zero():
    returns = _make_returns(A=0.01, B=0.00)
    labels = _make_labels([1, 1, 1, 1, 1, 0, 0, 0, 0, 0])  # starts at regime 1
    result_with_cost = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}, 1: {"B": 1.0}},
        transaction_cost_bps=100,  # large so any accidental charge is obvious
        initial_value=10_000,
    )
    # Day 1: regime 1, 100% B, 0% return → equity should be exactly 10000
    assert math.isclose(result_with_cost.equity_curve.iloc[0], 10_000, rel_tol=1e-10)


# ── Test 5: 100% cash (all-zero weights) → flat equity curve ─────────────────

def test_all_cash_is_flat():
    returns = _make_returns(A=0.05, B=0.02)  # high returns that would show up
    labels = _make_labels([0] * 10)
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {}},          # empty = 100% cash
        transaction_cost_bps=0,
        initial_value=10_000,
    )
    # Every value in equity_curve should equal initial_value
    assert (result.equity_curve == 10_000).all()
    assert result.stats.total_return_pct == 0.0


# ── Test 6: partial weight → remaining goes to cash implicitly ────────────────
#
# Setup:
#   50% A (+1%/day), 50% implicit cash (0%/day)
#   Portfolio daily return = 0.5 * 0.01 + 0.5 * 0.0 = 0.005
#   equity[10] = 10000 * 1.005^10

def test_partial_weight_remainder_is_cash():
    returns = _make_returns(A=0.01, B=0.00)
    labels = _make_labels([0] * 10)
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 0.5}},   # 50% A, 50% implicit cash
        transaction_cost_bps=0,
        initial_value=10_000,
    )
    expected_final = 10_000 * (1.005 ** 10)
    assert math.isclose(result.equity_curve.iloc[-1], expected_final, rel_tol=1e-10)


# ── Test 7: benchmark is independent of strategy ─────────────────────────────
#
# Benchmark = buy-and-hold SPY regardless of regime allocations.
# SPY returns 0.5%/day → benchmark[10] = 10000 * 1.005^10

def test_benchmark_is_spy_buy_and_hold():
    returns = _make_returns(A=0.01, B=0.00, SPY=0.005)
    labels = _make_labels([0] * 10)
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"B": 1.0}},   # strategy holds flat B, benchmark holds SPY
        transaction_cost_bps=0,
        initial_value=10_000,
    )
    expected_bm = 10_000 * (1.005 ** 10)
    assert math.isclose(result.benchmark_curve.iloc[-1], expected_bm, rel_tol=1e-10)
    # Strategy (flat B) should lag benchmark (growing SPY)
    assert result.equity_curve.iloc[-1] < result.benchmark_curve.iloc[-1]


# ── Test 8: max drawdown calculation ─────────────────────────────────────────
#
# Equity: 100, 110, 90, 95
# Peak at 110, trough at 90 → drawdown = (90/110) - 1 = -18.18...%

def test_max_drawdown_known_series():
    equity = pd.Series([100.0, 110.0, 90.0, 95.0])
    expected = (90 / 110) - 1  # = -0.18181...
    assert math.isclose(_max_drawdown(equity), expected, rel_tol=1e-10)


# ── Test 9: Sharpe formula ────────────────────────────────────────────────────
#
# returns = [0.01, 0.01, 0.01, 0.01, 0.01]  (constant 1%)
# std = 0 → Sharpe = 0.0  (guard for zero-std)

def test_sharpe_constant_returns_is_zero():
    constant = pd.Series([0.01] * 20)
    assert _sharpe(constant) == 0.0


def test_sharpe_known_value():
    # returns with known mean and std
    r = pd.Series([0.01, -0.01, 0.02, -0.02, 0.0])
    expected = r.mean() / r.std() * math.sqrt(252)
    assert math.isclose(_sharpe(r), expected, rel_tol=1e-10)


# ── Test 10: validation catches bad inputs ────────────────────────────────────

def test_weights_over_1_raises():
    returns = _make_returns()
    labels = _make_labels([0] * 10)
    with pytest.raises(BacktestValidationError, match="sum to"):
        run_backtest(
            regime_labels=labels,
            asset_returns=returns,
            allocations={0: {"A": 0.7, "B": 0.5}},  # 1.2 > 1.0
            transaction_cost_bps=0,
        )


def test_unknown_ticker_raises():
    returns = _make_returns()
    labels = _make_labels([0] * 10)
    with pytest.raises(BacktestValidationError, match="Unknown assets"):
        run_backtest(
            regime_labels=labels,
            asset_returns=returns,
            allocations={0: {"GOLD": 1.0}},  # GOLD not in returns
            transaction_cost_bps=0,
        )


def test_no_overlapping_dates_raises():
    returns = _make_returns()
    labels = pd.Series(
        [0] * 10,
        index=pd.date_range("2025-01-01", periods=10, freq="B"),  # non-overlapping
        dtype=int,
    )
    with pytest.raises(BacktestValidationError, match="No overlapping"):
        run_backtest(regime_labels=labels, asset_returns=returns, allocations={0: {"A": 1.0}})


# ── Test 11: explicit cash == implicit cash (audit finding) ───────────────────
#
# The engine skips the "cash" ticker when building the alloc_matrix.
# Sending {A: 0.7, cash: 0.2} must produce an identical result to {A: 0.7}
# because in both cases the weight matrix has A=0.7 and everything else=0.
#
# This test locks in that invariant so regressions in cash handling are caught.

def test_explicit_cash_identical_to_implicit_cash():
    returns = _make_returns(A=0.01, B=0.00)
    labels = _make_labels([0] * 10)

    result_implicit = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 0.7}},           # 30% implicit cash
        transaction_cost_bps=0,
    )
    result_explicit = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 0.7, "cash": 0.2}},  # 20% explicit + 10% implicit
        transaction_cost_bps=0,
    )

    # Equity curves must be identical to floating-point precision
    assert (result_implicit.equity_curve == result_explicit.equity_curve).all()
    assert result_implicit.stats.total_return_pct == result_explicit.stats.total_return_pct
    assert result_implicit.stats.sharpe_ratio == result_explicit.stats.sharpe_ratio


# ── Test 12: regime absent from allocations defaults to 100% cash ─────────────
#
# If regime 1 never appears in the allocations dict, those days should earn 0.
# Setup:
#   Days 1-5:  regime 0 → 100% A (+1%/day)
#   Days 6-10: regime 1 → not in allocations → 100% implicit cash (0%/day)
#   0 bps costs
#
# Expected: same as test_two_regime_switch_no_cost — equity flat after day 5.

def test_missing_regime_defaults_to_all_cash():
    returns = _make_returns(A=0.01, B=0.00)
    labels = _make_labels([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}},   # regime 1 intentionally omitted
        transaction_cost_bps=0,
        initial_value=10_000,
    )

    after_switch = 10_000 * (1.01 ** 5)
    assert math.isclose(result.equity_curve.iloc[4], after_switch, rel_tol=1e-10)
    assert math.isclose(result.equity_curve.iloc[9], after_switch, rel_tol=1e-10)
    assert result.stats.num_rebalances == 1


# ── Test 13: multiple rebalances counted correctly ────────────────────────────
#
# Regime sequence alternates every 2 days → 4 switches, 4 rebalances.
# (Day 1 is not counted: iloc[0]=False guard.)

def test_multiple_rebalances_counted_correctly():
    returns = _make_returns(A=0.01, B=0.00)
    labels = _make_labels([0, 0, 1, 1, 0, 0, 1, 1, 0, 0])
    #                       ^-- no cost  ^   ^    ^    ^  = 4 transitions
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}, 1: {"B": 1.0}},
        transaction_cost_bps=0,
        initial_value=10_000,
    )
    assert result.stats.num_rebalances == 4
    assert len(result.rebalance_dates) == 4


# ── Test 14: transaction cost on multiple rebalances compounds correctly ───────
#
# 4 rebalances, 10 bps each.
# Regime 0: A earns 1%/day.  Regime 1: B earns 0%/day.
# [0,0,1,1,0,0,1,1,0,0] → switch at days 3,5,7,9 (1-indexed)
# Each switch incurs one -0.001 deduction on that day's return.

def test_transaction_cost_multiple_rebalances():
    returns = _make_returns(A=0.01, B=0.00)
    labels = _make_labels([0, 0, 1, 1, 0, 0, 1, 1, 0, 0])
    result_no_cost = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}, 1: {"B": 1.0}},
        transaction_cost_bps=0,
    )
    result_with_cost = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}, 1: {"B": 1.0}},
        transaction_cost_bps=10,
    )
    # 4 costs of 10bps → total drag = 4 * 0.001 = 0.4% (approximately, order matters)
    # Cost portfolio must always be <= no-cost portfolio
    assert result_with_cost.equity_curve.iloc[-1] < result_no_cost.equity_curve.iloc[-1]
    assert result_with_cost.stats.num_rebalances == result_no_cost.stats.num_rebalances == 4


# ── Test 15: CAGR formula ─────────────────────────────────────────────────────
#
# Build an equity series that rises from 10000 to 12500 over exactly 126 periods.
# n_years = 126/252 = 0.5
# CAGR = (12500/10000)^(1/0.5) - 1 = 1.25^2 - 1 = 0.5625

def test_cagr_known_value():
    # _cagr computes n_years = len(equity) / 252.
    # 126 points → n_years = 126/252 = 0.5 exactly.
    equity = pd.Series(np.linspace(10_000, 12_500, 126))
    expected_cagr = (12_500 / 10_000) ** (1 / 0.5) - 1   # 1.25^2 - 1 = 0.5625
    assert math.isclose(_cagr(equity), expected_cagr, rel_tol=1e-6)


def test_cagr_empty_or_zero_is_zero():
    assert _cagr(pd.Series([0.0, 0.0])) == 0.0
    assert _cagr(pd.Series(dtype=float)) == 0.0


# ── Test 16: win rate ─────────────────────────────────────────────────────────
#
# win_rate = fraction of days with positive portfolio return.

def test_win_rate_half_positive():
    returns = pd.DataFrame({
        "A":   [0.01, -0.01, 0.01, -0.01, 0.01, -0.01, 0.01, -0.01, 0.01, -0.01],
        "SPY": [0.005] * 10,
    }, index=pd.date_range("2020-01-01", periods=10, freq="B"))
    labels = _make_labels([0] * 10)
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}},
        transaction_cost_bps=0,
    )
    assert math.isclose(result.stats.win_rate_pct, 50.0, abs_tol=0.001)


def test_win_rate_all_positive_is_100():
    returns = _make_returns(A=0.01)  # strictly positive every day
    labels = _make_labels([0] * 10)
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}},
        transaction_cost_bps=0,
    )
    assert math.isclose(result.stats.win_rate_pct, 100.0, abs_tol=0.001)


# ── Test 17: regime breakdown covers all days ─────────────────────────────────
#
# Sum of days across all regime breakdown items must equal total trading days.

def test_regime_breakdown_days_sum_to_total():
    returns = _make_returns()
    labels = _make_labels([0, 0, 1, 1, 2, 2, 3, 3, 0, 1])  # 4 regimes
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}},
        transaction_cost_bps=0,
    )
    total_days = sum(rb.days for rb in result.regime_breakdown)
    assert total_days == len(labels)


def test_regime_breakdown_pct_time_sums_to_100():
    returns = _make_returns()
    labels = _make_labels([0, 0, 1, 1, 2, 2, 3, 3, 0, 1])
    result = run_backtest(
        regime_labels=labels,
        asset_returns=returns,
        allocations={0: {"A": 1.0}},
        transaction_cost_bps=0,
    )
    total_pct = sum(rb.pct_time for rb in result.regime_breakdown)
    assert math.isclose(total_pct, 100.0, abs_tol=0.01)


# ── Test 18: negative transaction_cost_bps raises ────────────────────────────

def test_negative_transaction_cost_raises():
    returns = _make_returns()
    labels = _make_labels([0] * 10)
    with pytest.raises(BacktestValidationError, match="transaction_cost_bps"):
        run_backtest(
            regime_labels=labels,
            asset_returns=returns,
            allocations={0: {"A": 1.0}},
            transaction_cost_bps=-1,
        )
