import { Activity, TrendingUp, BarChart3, Layers } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CorrelationHeatmap } from "@/components/dashboard/CorrelationHeatmap";
import { VolatilityGauge } from "@/components/dashboard/VolatilityGauge";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { FactorExposure } from "@/components/dashboard/FactorExposure";
import { DataStatus } from "@/components/dashboard/DataStatus";

const Index = () => {
  return (
    <DashboardLayout>
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Market Regime <span className="text-gradient">Dashboard</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                S&P 500 correlation analysis & factor exploration
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-green/10 text-neon-green">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green"></span>
                </span>
                Live
              </div>
              <span className="text-muted-foreground">Dec 29, 2025 • 14:32 EST</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* Metrics row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Average Correlation"
            value="0.47"
            change={8.2}
            changeLabel="vs last month"
            icon={<BarChart3 className="h-5 w-5" />}
            variant="neon"
          />
          <MetricCard
            title="VIX Level"
            value="18.42"
            change={-12.5}
            changeLabel="vs last week"
            icon={<Activity className="h-5 w-5" />}
          />
          <MetricCard
            title="Dominant Factors"
            value="3"
            changeLabel="explaining 87% variance"
            icon={<Layers className="h-5 w-5" />}
          />
          <MetricCard
            title="Market Trend"
            value="Bullish"
            change={4.7}
            changeLabel="YTD return"
            icon={<TrendingUp className="h-5 w-5" />}
            variant="success"
          />
        </div>

        {/* Charts row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TimeSeriesChart />
          </div>
          <div>
            <VolatilityGauge
              value={42.5}
              label="Regime Indicator"
              regime="medium"
            />
          </div>
        </div>

        {/* Analysis row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <CorrelationHeatmap />
          <FactorExposure />
        </div>

        {/* Data status */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DataStatus />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 bg-grid">
            <div className="relative z-10">
              <h3 className="text-lg font-semibold mb-2">Quick Actions</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start exploring market regimes
              </p>
              <div className="space-y-2">
                <button className="w-full text-left px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    📊
                  </div>
                  Run correlation analysis
                </button>
                <button className="w-full text-left px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-neon-green/10 flex items-center justify-center">
                    📁
                  </div>
                  Upload new dataset
                </button>
                <button className="w-full text-left px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-neon-magenta/10 flex items-center justify-center">
                    🔬
                  </div>
                  Factor decomposition
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
