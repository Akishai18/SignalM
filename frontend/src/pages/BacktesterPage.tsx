import { useState } from "react";
import { FlaskConical, BarChart2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BacktestConfigurator, type BacktestConfig } from "@/components/backtester/BacktestConfigurator";
import { BacktestSummaryCards } from "@/components/backtester/BacktestSummaryCards";
import { EquityCurveChart } from "@/components/backtester/EquityCurveChart";
import { DrawdownChart } from "@/components/backtester/DrawdownChart";
import { RegimeContributionTable } from "@/components/backtester/RegimeContributionTable";
import { AllocationSummaryBar } from "@/components/backtester/AllocationSummaryBar";
import { useRunBacktest } from "@/hooks/useRunBacktest";
import type { BacktestResult } from "@/lib/api";

// ── Empty state ────────────────────────────────────────────────────────────────

function ResultsPlaceholder() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 text-center px-8">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <BarChart2 className="h-8 w-8 text-primary/60" />
      </div>
      <p className="text-base font-medium text-foreground">Run a backtest to see results</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Configure your per-regime allocations on the left, then click Run Backtest.
      </p>
    </div>
  );
}

// ── Loading state ──────────────────────────────────────────────────────────────

function ResultsLoading() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border border-border bg-card/30 text-center px-8 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      <p className="text-sm font-medium text-foreground">Running backtest…</p>
    </div>
  );
}

// ── Error state ────────────────────────────────────────────────────────────────

function ResultsError({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 text-center px-8 gap-2">
      <p className="text-sm font-semibold text-red-500">Backtest failed</p>
      <p className="text-xs text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}

// ── Results panel ──────────────────────────────────────────────────────────────

function ResultsPanel({ result, config }: { result: BacktestResult; config: BacktestConfig }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Date range badge */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">
          {result.date_range.start} → {result.date_range.end}
        </span>
        <span>{result.tickers_used.join(", ")}</span>
      </div>

      {/* Summary metrics */}
      <BacktestSummaryCards stats={result.stats} />

      {/* Allocation summary */}
      <AllocationSummaryBar allocations={config.allocations} />

      {/* Equity curve */}
      <EquityCurveChart
        equityCurve={result.equity_curve}
        rebalanceDates={result.rebalance_dates}
      />

      {/* Drawdown */}
      <DrawdownChart equityCurve={result.equity_curve} />

      {/* Regime contribution */}
      <RegimeContributionTable breakdown={result.regime_breakdown} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const BacktesterPage = () => {
  const mutation = useRunBacktest();
  // Keep a snapshot of the last submitted config so AllocationSummaryBar can read it
  const [lastConfig, setLastConfig] = useState<BacktestConfig | null>(null);

  function handleRun(config: BacktestConfig) {
    setLastConfig(config);
    mutation.mutate({
      allocations: config.allocations,
      transaction_cost_bps: config.transaction_cost_bps,
      start_date: config.start_date,
      end_date: config.end_date,
    });
  }

  return (
    <DashboardLayout>
      {/* Page header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Regime <span className="text-gradient">Backtester</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Test portfolio strategies driven by regime signals
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-6 p-6 items-start">

        {/* Left panel — configurator (40%) */}
        <div className="w-full lg:w-[40%] lg:sticky lg:top-[73px]">
          <div className="rounded-xl border border-border bg-card p-5">
            <BacktestConfigurator onRun={handleRun} isLoading={mutation.isPending} />
          </div>
        </div>

        {/* Right panel — results (60%) */}
        <div className="w-full lg:w-[60%]">
          {mutation.isPending && <ResultsLoading />}
          {mutation.isError && <ResultsError message={mutation.error?.message ?? "Unknown error"} />}
          {mutation.isSuccess && lastConfig && (
            <ResultsPanel result={mutation.data} config={lastConfig} />
          )}
          {!mutation.isPending && !mutation.isError && !mutation.isSuccess && (
            <ResultsPlaceholder />
          )}
        </div>

      </div>
    </DashboardLayout>
  );
};

export default BacktesterPage;
