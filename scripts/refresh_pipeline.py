"""
Daily data refresh orchestrator for SignalM.

Runs the complete daily pipeline in order:
  1. Incremental market data fetch  (SPY, VIX, 11 sector ETFs)
  2. Index regime re-detection      (SPY, QQQ, DIA, IWM — K-Means refit)
  3. Precompute correlations         (sector correlation matrices + rolling)
  4. Precompute transitions          (regime transition matrices per index)
  5. Write refresh status            (data/last_refresh.json)

What is deliberately NOT run daily (too slow / wrong approach):
  - Full 500-stock S&P 500 pipeline  (hours, monthly cadence is fine)
  - Prediction model retraining      (Markov/HMM/RF/XGBoost, not needed daily)
  - update_regime_data.py            (merges SPY+VIX only up to regime_k4 cutoff)
  - precompute_predictions/backtest  (depend on prediction models, not raw data)

Usage:
    python scripts/refresh_pipeline.py          # full pipeline
    python scripts/refresh_pipeline.py --dry-run # report staleness, no writes
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── Path setup ────────────────────────────────────────────────────────────────

# All relative imports in src/ and precompute.py assume cwd == project root.
ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
os.chdir(ROOT)

# Make project packages and scripts/ importable
for _p in (str(ROOT), str(ROOT / "src"), str(SCRIPTS_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

log = logging.getLogger(__name__)

INDICES = ["SPY", "QQQ", "DIA", "IWM"]
STATUS_PATH = ROOT / "data" / "last_refresh.json"


# ── Step helpers ──────────────────────────────────────────────────────────────

def _step(name: str):
    """Context manager / decorator: log start, measure time, catch errors."""
    import contextlib

    @contextlib.contextmanager
    def _ctx():
        print(f"\n{'='*60}")
        print(f"STEP: {name}")
        print(f"{'='*60}")
        t0 = time.time()
        try:
            yield
            elapsed = time.time() - t0
            print(f"✓ {name} completed in {elapsed:.1f}s")
        except Exception as exc:
            elapsed = time.time() - t0
            print(f"✗ {name} FAILED after {elapsed:.1f}s: {exc}")
            log.exception("Step '%s' failed", name)
            raise

    return _ctx()


# ── Step 1: Incremental fetch ─────────────────────────────────────────────────

def run_fetch() -> dict[str, Any]:
    from incremental_fetch import fetch_all
    results = fetch_all(data_dir=ROOT / "data")
    updated = [t for t, r in results.items() if r["status"] == "updated"]
    skipped = [t for t, r in results.items() if r["status"] == "up_to_date"]
    no_data = [t for t, r in results.items() if r["status"] == "no_new_data"]
    total_rows = sum(r.get("rows_added", 0) for r in results.values())

    print(f"\n  Updated : {updated}")
    print(f"  Skipped : {skipped}")
    print(f"  No data : {no_data}")
    print(f"  Total new rows: {total_rows}")

    # Determine the latest date across all tickers
    data_through = max(
        (r["data_through"] for r in results.values() if r.get("data_through") not in (None, "unknown")),
        default="unknown",
    )
    return {"updated": updated, "total_rows_added": total_rows, "data_through": data_through}


# ── Step 2: Index regime re-detection ─────────────────────────────────────────

def run_index_regimes() -> dict[str, Any]:
    """
    Re-run K-Means clustering for each index from scratch using current yfinance data.

    This is intentionally a FULL REFIT (not incremental predict) because:
    - No pre-saved model files exist to call predict() on
    - The existing script has always done a full refit
    - Runtime is ~1-2 min total for 4 indices — acceptable

    Caveat: regime IDs (0-3) may shift between runs. The dashboard displays
    named labels (Calm/Crisis/etc.) which are derived from cluster characteristics
    at render time, not from hard-coded regime IDs. Transition matrices and
    precomputed JSONs are regenerated immediately after, so they stay consistent.
    """
    from src.data.detect_index_regimes import detect_all_indices, save_index_regimes

    results = detect_all_indices(
        indices=INDICES,
        start_date="2012-01-01",
    )

    succeeded = list(results.keys())
    failed = [s for s in INDICES if s not in succeeded]
    print(f"\n  Succeeded: {succeeded}")
    if failed:
        print(f"  Failed   : {failed}")

    # Report new data ranges
    for symbol, data in results.items():
        regimes = data["regimes"].dropna()
        if not regimes.empty:
            print(f"  {symbol}: regime labels through {regimes.index.max().date()}")

    return {"succeeded": succeeded, "failed": failed}


# ── Step 3: Rebuild merged market data ────────────────────────────────────────

def run_rebuild_merged_market_data() -> dict[str, Any]:
    """
    Rebuild regime_with_market_data.csv and the by-regime performance CSVs
    entirely from our already-updated local files — no yfinance call needed.

    Sources:
      data/spy_data.csv                        → spy_close, spy_returns, spy_vol_252d
      data/vix_data.csv                        → vix
      regime_results/indices/spy_regimes.csv   → regime (daily-updated, preferred)
      regime_results/regime_labels_k4.csv      → regime (fallback)

    Outputs:
      regime_results/regime_with_market_data.csv
      regime_results/spy_performance_by_regime.csv
      regime_results/vix_stats_by_regime.csv
    """
    import numpy as np
    import pandas as pd

    REGIME_LABEL_MAP = {0: "Calm", 1: "Crisis", 2: "Elevated Stress", 3: "Transition"}

    # ── Load regime labels ────────────────────────────────────────────────────
    spy_regimes_path = ROOT / "regime_results/indices/spy_regimes.csv"
    k4_path = ROOT / "regime_results/regime_labels_k4.csv"
    if spy_regimes_path.exists():
        regime_labels = pd.read_csv(spy_regimes_path, index_col=0, parse_dates=True).squeeze()
        print(f"  Using SPY index regimes: {spy_regimes_path.name}")
    else:
        regime_labels = pd.read_csv(k4_path, index_col=0, parse_dates=True).squeeze()
        print(f"  Using K4 fallback: {k4_path.name}")
    regime_labels = regime_labels.dropna().astype(int)

    # ── Load SPY data from local CSV ──────────────────────────────────────────
    spy_df = pd.read_csv(ROOT / "data/spy_data.csv", index_col=0)
    spy_df.index = pd.to_datetime(spy_df.index.astype(str).str[:10])
    spy_df.index.name = "Date"

    # ── Load VIX data from local CSV ──────────────────────────────────────────
    vix_df = pd.read_csv(ROOT / "data/vix_data.csv", index_col=0)
    vix_df.index = pd.to_datetime(vix_df.index.astype(str).str[:10])
    vix_df.index.name = "Date"

    # ── Build merged DataFrame ────────────────────────────────────────────────
    merged = pd.DataFrame(index=regime_labels.index)
    merged["regime"] = regime_labels

    common_spy = regime_labels.index.intersection(spy_df.index)
    merged.loc[common_spy, "spy_close"] = spy_df.loc[common_spy, "close"]
    merged.loc[common_spy, "spy_returns"] = spy_df.loc[common_spy, "returns"]
    merged.loc[common_spy, "spy_vol_252d"] = spy_df.loc[common_spy, "vol_252d"]

    common_vix = regime_labels.index.intersection(vix_df.index)
    merged.loc[common_vix, "vix"] = vix_df.loc[common_vix, "close"]

    merged_path = ROOT / "regime_results/regime_with_market_data.csv"
    merged.to_csv(merged_path)
    print(f"  Saved {merged_path.name}: {len(merged)} rows through {merged.index.max().date()}")

    # ── Rebuild spy_performance_by_regime.csv ─────────────────────────────────
    spy_with_returns = spy_df[["close", "returns"]].copy()
    spy_with_returns.columns = ["close", "returns"]
    common = regime_labels.index.intersection(spy_with_returns.index)
    regimes_aligned = regime_labels.loc[common]
    spy_aligned = spy_with_returns.loc[common]

    perf_rows = []
    for regime_id, regime_name in REGIME_LABEL_MAP.items():
        mask = regimes_aligned == regime_id
        ret = spy_aligned.loc[mask, "returns"].dropna()
        if len(ret) == 0:
            continue
        perf_rows.append({
            "regime_id": regime_id,
            "regime_name": regime_name,
            "days": len(ret),
            "avg_daily_return": float(ret.mean()),
            "annualized_return": float(ret.mean() * 252),
            "volatility": float(ret.std() * np.sqrt(252)),
            "sharpe_ratio": float(ret.mean() / ret.std() * np.sqrt(252)) if ret.std() > 0 else 0.0,
            "max_daily_gain": float(ret.max()),
            "max_daily_loss": float(ret.min()),
            "win_rate": float((ret > 0).sum() / len(ret)),
        })

    spy_perf_df = pd.DataFrame(perf_rows)
    spy_perf_path = ROOT / "regime_results/spy_performance_by_regime.csv"
    spy_perf_df.to_csv(spy_perf_path, index=False)
    print(f"  Saved {spy_perf_path.name}: {len(spy_perf_df)} regimes")

    # ── Rebuild vix_stats_by_regime.csv ──────────────────────────────────────
    common_vix_regime = regime_labels.index.intersection(vix_df.index)
    regimes_vix = regime_labels.loc[common_vix_regime]
    vix_series = vix_df.loc[common_vix_regime, "close"]

    vix_rows = []
    for regime_id, regime_name in REGIME_LABEL_MAP.items():
        mask = regimes_vix == regime_id
        rv = vix_series.loc[mask].dropna()
        if len(rv) == 0:
            continue
        vix_rows.append({
            "regime_id": regime_id,
            "regime_name": regime_name,
            "avg_vix": float(rv.mean()),
            "median_vix": float(rv.median()),
            "min_vix": float(rv.min()),
            "max_vix": float(rv.max()),
            "std_vix": float(rv.std()),
        })

    vix_stats_df = pd.DataFrame(vix_rows)
    vix_stats_path = ROOT / "regime_results/vix_stats_by_regime.csv"
    vix_stats_df.to_csv(vix_stats_path, index=False)
    print(f"  Saved {vix_stats_path.name}: {len(vix_stats_df)} regimes")

    return {
        "merged_rows": len(merged),
        "data_through": str(merged.index.max().date()),
    }


# ── Step 4: Precompute correlations ───────────────────────────────────────────

def run_precompute_correlations() -> dict[str, Any]:
    """
    Regenerate sector correlation JSONs from the freshly-updated sector ETF CSVs.
    Skips the PCA structure section (reads from pca_data/ which is from the full
    500-stock pipeline and doesn't change in the daily refresh).
    """
    from precompute import precompute_correlations
    precompute_correlations()
    return {"status": "ok"}


# ── Step 4: Precompute transitions ────────────────────────────────────────────

def run_precompute_transitions() -> dict[str, Any]:
    """
    Regenerate transition matrices for each index using the freshly-updated
    regime labels from step 2.
    """
    from precompute import precompute_transitions
    precompute_transitions()
    return {"status": "ok"}


# ── Step 5: Write refresh status ─────────────────────────────────────────────

def write_status(
    started_at: datetime,
    step_results: dict[str, Any],
    total_elapsed: float,
    success: bool,
) -> None:
    fetch = step_results.get("fetch", {})
    regimes = step_results.get("index_regimes", {})

    status = {
        "last_refresh_utc": started_at.isoformat(),
        "completed_utc": datetime.now(timezone.utc).isoformat(),
        "data_through": fetch.get("data_through", "unknown"),
        "total_rows_added": fetch.get("total_rows_added", 0),
        "tickers_updated": fetch.get("updated", []),
        "index_regimes_succeeded": regimes.get("succeeded", []),
        "index_regimes_failed": regimes.get("failed", []),
        "pipeline_duration_seconds": round(total_elapsed, 1),
        "success": success,
    }

    STATUS_PATH.write_text(json.dumps(status, indent=2, default=str))
    print(f"\n  Status written → {STATUS_PATH}")
    print(f"  data_through = {status['data_through']}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main(dry_run: bool = False) -> bool:
    started_at = datetime.now(timezone.utc)
    t_pipeline = time.time()
    step_results: dict[str, Any] = {}
    success = True

    print("\n" + "=" * 60)
    print("SIGNALM DAILY REFRESH PIPELINE")
    print(f"Started: {started_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 60)

    if dry_run:
        print("\n[DRY RUN] Reporting staleness only — no writes will occur.\n")
        from incremental_fetch import _last_csv_date, SECTOR_TICKERS
        data_dir = ROOT / "data"
        print(f"  SPY:  {_last_csv_date(data_dir / 'spy_data.csv')}")
        print(f"  VIX:  {_last_csv_date(data_dir / 'vix_data.csv')}")
        for t in SECTOR_TICKERS:
            print(f"  {t:5s}: {_last_csv_date(data_dir / 'sectors' / f'{t.lower()}_data.csv')}")
        return True

    # Step 1: Fetch
    try:
        with _step("1 — Incremental market data fetch"):
            step_results["fetch"] = run_fetch()
    except Exception:
        success = False
        print("  Pipeline aborted after fetch failure.")
        write_status(started_at, step_results, time.time() - t_pipeline, success=False)
        return False

    # Step 2: Index regime re-detection
    try:
        with _step("2 — Index regime re-detection (SPY/QQQ/DIA/IWM)"):
            step_results["index_regimes"] = run_index_regimes()
    except Exception:
        # Non-fatal: correlations can still be computed even if regimes fail
        success = False
        step_results["index_regimes"] = {"succeeded": [], "failed": INDICES}
        print("  Continuing with remaining steps despite regime detection failure.")

    # Step 3: Rebuild merged market data (volatility page)
    try:
        with _step("3 — Rebuild merged market data (volatility page)"):
            step_results["merged_market_data"] = run_rebuild_merged_market_data()
    except Exception:
        success = False
        print("  Merged market data rebuild failed — continuing.")

    # Step 4: Precompute correlations
    try:
        with _step("4 — Precompute sector correlations"):
            step_results["correlations"] = run_precompute_correlations()
    except Exception:
        success = False
        print("  Correlation precompute failed — continuing.")

    # Step 5: Precompute transitions
    try:
        with _step("5 — Precompute regime transitions"):
            step_results["transitions"] = run_precompute_transitions()
    except Exception:
        success = False
        print("  Transition precompute failed — continuing.")

    # Step 6: Write status
    total_elapsed = time.time() - t_pipeline
    with _step("6 — Write refresh status"):
        write_status(started_at, step_results, total_elapsed, success)

    print("\n" + "=" * 60)
    print(f"PIPELINE {'COMPLETE' if success else 'COMPLETED WITH ERRORS'}")
    print(f"Total time: {total_elapsed:.0f}s")
    print("=" * 60)

    return success


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SignalM daily refresh pipeline")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report staleness only — no writes, no yfinance calls",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    ok = main(dry_run=args.dry_run)
    sys.exit(0 if ok else 1)
