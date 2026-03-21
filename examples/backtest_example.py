"""
End-to-end reference: loading real data → run_backtest → reading output.

This script is the template the API layer will follow.
Run from the project root:
    python examples/backtest_example.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

# Allow running from project root without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.utils.backtester import run_backtest
from api.utils.asset_loader import load_asset_returns


# ── 1. Load asset returns ─────────────────────────────────────────────────────
# load_asset_returns handles file I/O, tz normalization, and inner-join alignment.
# SPY is required (benchmark). XLU is the defensive tilt.

START, END = "2019-01-01", "2020-12-31"

asset_returns = load_asset_returns(["SPY", "XLU"], start=START, end=END)


# ── 2. Load regime labels ─────────────────────────────────────────────────────
# regime_k4 values:  0=Calm, 1=Crisis, 2=Elevated Stress, 3=Transition
# (labels start ~126 days in due to feature warmup window)

labels_raw = pd.read_csv(
    "regime_results/regime_labels_k4.csv",
    parse_dates=["Date"],
    index_col="Date",
)
regime_labels = labels_raw["regime_k4"].loc[START:END]

print(f"Date range: {asset_returns.index[0].date()} → {asset_returns.index[-1].date()}")
print(f"Trading days: {len(asset_returns)}")
print(f"Regime distribution:\n{regime_labels.value_counts().sort_index()}\n")


# ── 6. Define allocation strategy ────────────────────────────────────────────
# "Crisis Shield": heavy equities in calm, rotate to defensive assets in stress.
#
# Regime 0 — Calm:            90% SPY, 10% XLU
# Regime 1 — Crisis:          20% SPY, 80% XLU
# Regime 2 — Elevated Stress: 60% SPY, 40% XLU
# Regime 3 — Transition:      70% SPY, 30% XLU
#
# Any weight shortfall is implicitly cash (weights sum to exactly 1.0 here).

allocations = {
    0: {"SPY": 0.90, "XLU": 0.10},   # Calm:            risk-on
    1: {"SPY": 0.20, "XLU": 0.80},   # Crisis:          defensive
    2: {"SPY": 0.60, "XLU": 0.40},   # Elevated Stress: cautious
    3: {"SPY": 0.70, "XLU": 0.30},   # Transition:      moderate
}


# ── 7. Run the backtest ───────────────────────────────────────────────────────

result = run_backtest(
    regime_labels=regime_labels,
    asset_returns=asset_returns,
    allocations=allocations,
    transaction_cost_bps=10,     # 10 bps per rebalance
    initial_value=10_000,
)


# ── 8. Read the output ────────────────────────────────────────────────────────

print("=" * 55)
print("BACKTEST RESULTS — Crisis Shield vs SPY Buy-and-Hold")
print("=" * 55)

s = result.stats
print(f"\n{'Metric':<30} {'Strategy':>10} {'SPY B&H':>10}")
print("-" * 52)
print(f"{'Total Return':<30} {s.total_return_pct:>9.2f}% {s.benchmark_total_return_pct:>9.2f}%")
print(f"{'CAGR':<30} {s.cagr_pct:>9.2f}%")
print(f"{'Sharpe Ratio':<30} {s.sharpe_ratio:>10.3f} {s.benchmark_sharpe:>10.3f}")
print(f"{'Max Drawdown':<30} {s.max_drawdown_pct:>9.2f}%")
print(f"{'Calmar Ratio':<30} {s.calmar_ratio:>10.3f}")
print(f"{'Win Rate':<30} {s.win_rate_pct:>9.2f}%")
print(f"{'Rebalances':<30} {s.num_rebalances:>10}")

print(f"\n--- Regime Breakdown ---")
regime_names = {0: "Calm", 1: "Crisis", 2: "Elevated Stress", 3: "Transition"}
for rb in result.regime_breakdown:
    name = regime_names.get(rb.regime_id, f"Regime {rb.regime_id}")
    print(
        f"  {name:<18} "
        f"{rb.days:>4}d ({rb.pct_time:>5.1f}%)  "
        f"avg {rb.avg_daily_return_pct:>+6.3f}%/day  "
        f"contributed {rb.total_contribution_pct:>+6.2f}%"
    )

print(f"\n--- Rebalance dates ({len(result.rebalance_dates)} events) ---")
for d in result.rebalance_dates:
    print(f"  {d}")

print(f"\n--- Equity curve (first 5 + last 5 rows) ---")
ec = result.equity_curve
print(ec.head(5).to_string())
print("  ...")
print(ec.tail(5).to_string())

# This is what the API router will serialize:
print(f"\n--- API-ready payload shape ---")
print(f"  equity_curve:    {len(ec)} rows  →  list of {{date, value}} dicts")
print(f"  benchmark_curve: {len(result.benchmark_curve)} rows")
print(f"  daily_returns:   {len(result.daily_returns)} rows")
print(f"  stats:           BacktestStats dataclass  →  dict")
print(f"  regime_breakdown: {len(result.regime_breakdown)} entries")
