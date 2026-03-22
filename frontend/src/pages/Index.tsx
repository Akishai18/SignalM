import { useState, useEffect } from "react";
import { Activity, TrendingUp, BarChart3, Layers, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CorrelationHeatmap } from "@/components/dashboard/CorrelationHeatmap";
import { VolatilityGauge } from "@/components/dashboard/VolatilityGauge";
import { IndexTimeSeriesChart } from "@/components/dashboard/IndexTimeSeriesChart";
import { FactorExposure } from "@/components/dashboard/FactorExposure";
import { DataStatus } from "@/components/dashboard/DataStatus";
import { VIXGauge } from "@/components/dashboard/VIXGauge";
import { IndexPerformanceCard } from "@/components/dashboard/IndexPerformanceCard";
import { RegimePerformanceTable } from "@/components/dashboard/RegimePerformanceTable";
import { RegimeTimelineWithIndex } from "@/components/dashboard/RegimeTimelineWithIndex";
import { IndexComparisonGrid } from "@/components/dashboard/IndexComparisonGrid";
import { IndexSelector } from "@/components/dashboard/IndexSelector";
import { useDashboardData, useIndexCurrentRegime } from "@/hooks/useRegimeData";
import { formatPercent } from "@/lib/api";

const Index = () => {
  const [selectedIndex, setSelectedIndex] = useState<string>("SPY");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const { currentRegime, metrics, forecast, health, isLoading, isError, error } = useDashboardData();
  const { data: indexRegime } = useIndexCurrentRegime(selectedIndex);

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading regime data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (isError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to Load Data</h2>
            <p className="text-muted-foreground mb-4">
              {error?.message || "Could not connect to the API server"}
            </p>
            <p className="text-sm text-muted-foreground">
              Make sure the API server is running: <code className="bg-muted px-2 py-1 rounded">uvicorn api.main:app --reload</code>
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Get data or use defaults
  const metricsData = metrics.data;
  const regimeData = currentRegime.data;
  const forecastData = forecast.data;
  const healthData = health.data;

  return (
    <DashboardLayout>
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-gradient">SignalM</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Market Signals • Regime Detection & Prediction
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${healthData?.status === 'healthy' ? 'bg-neon-green/10 text-neon-green' : 'bg-destructive/10 text-destructive'}`}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                </span>
                {healthData?.status === 'healthy' ? 'Live' : 'Offline'}
              </div>
              <span className="text-muted-foreground">
                {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} EST
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="p-6 space-y-6">
        {/* Index Comparison Grid - NEW! */}
        <IndexComparisonGrid />

        {/* Metrics row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Current Regime"
            value={regimeData?.regime_name || 'Loading...'}
            change={regimeData ? regimeData.confidence * 100 : undefined}
            changeLabel={`${regimeData?.days_in_regime || 0} days in regime`}
            icon={<Activity className="h-5 w-5" />}
            variant={regimeData?.regime_name === 'Calm' ? 'success' : regimeData?.regime_name === 'Crisis' ? 'warning' : 'default'}
            educational={{
              title: "Current Market Regime",
              whatItIs: "The market regime represents the current state of correlation and volatility patterns detected by our machine learning clustering model. Regimes include Calm (low correlation, normal volatility), Crisis (high correlation, extreme volatility), Elevated Stress (rising correlation), and Transition (regime-switching periods).",
              whyItMatters: "Market behavior changes dramatically across regimes. In Calm regimes, diversification works and individual stock selection matters. In Crisis regimes, 'everything falls together' - correlations spike to 1 and diversification fails. Knowing the current regime helps you adjust risk exposure, hedging, and strategy selection.",
              howToRead: `• Current regime: ${regimeData?.regime_name || 'Loading'}
• Confidence: ${regimeData ? (regimeData.confidence * 100).toFixed(0) : '0'}% - how certain the model is
• Days in regime: ${regimeData?.days_in_regime || 0} - regime persistence

Calm regimes support aggressive positioning. Crisis regimes require defensive hedging. Transitions are the most dangerous - portfolios often experience unexpected losses during regime shifts.`,
              actionableInsight: "When confidence drops below 60% or days-in-regime is very short (< 5 days), the market may be transitioning between regimes. This uncertainty often creates whipsaws and false signals - reduce position sizing until a stable regime emerges.",
              variant: regimeData?.regime_name === 'Calm' ? 'success' : regimeData?.regime_name === 'Crisis' ? 'warning' : 'default',
            }}
          />
          <MetricCard
            title="Average Correlation"
            value={metricsData ? metricsData.avg_correlation.toFixed(2) : '...'}
            changeLabel="cross-sectional"
            icon={<BarChart3 className="h-5 w-5" />}
            variant="neon"
            educational={{
              title: "Average Cross-Sectional Correlation",
              whatItIs: "This metric measures how strongly stocks in the S&P 500 move together on average. It's calculated as the mean pairwise correlation across all stocks. Values range from -1 (perfect opposite movement) to +1 (perfect together movement).",
              whyItMatters: "Correlation tells you how diversified the market really is. Low correlation (0.2-0.4) means sector-specific strategies work and diversification provides real risk reduction. High correlation (>0.6) means macro factors dominate - everything moves together and stock-picking adds little value.",
              howToRead: `• Current value: ${metricsData ? metricsData.avg_correlation.toFixed(2) : 'N/A'}
• Low (<0.3): Highly diversified, stock-specific factors matter
• Normal (0.3-0.5): Healthy market, some co-movement
• High (0.5-0.7): Rising systemic risk, macro dominates
• Extreme (>0.7): Crisis mode, diversification fails

The cross-sectional measurement means we're looking across all stocks at a single point in time, not over time.`,
              actionableInsight: "When average correlation spikes above 0.6, it's a warning that the market is entering a stressed state. Historically, rapid increases in correlation have preceded major drawdowns. Consider reducing leverage and adding market-neutral strategies.",
              variant: "neon",
            }}
          />
          <MetricCard
            title="Volatility Dispersion"
            value={metricsData ? metricsData.vol_dispersion.toFixed(3) : '...'}
            changeLabel="cross-sectional std"
            icon={<Activity className="h-5 w-5" />}
            educational={{
              title: "Volatility Dispersion",
              whatItIs: "Volatility dispersion measures how much individual stock volatilities vary across the market. It's the standard deviation of volatilities across all stocks. High dispersion means stocks have very different risk levels; low dispersion means all stocks are equally volatile.",
              whyItMatters: "Dispersion indicates market complexity and opportunity. High dispersion (>0.15) means stock selection matters - some stocks are much riskier than others, creating opportunities for alpha. Low dispersion (<0.10) means everything is similarly volatile, limiting differentiation and making market-neutral strategies harder.",
              howToRead: `• Current value: ${metricsData ? metricsData.vol_dispersion.toFixed(3) : 'N/A'}
• Low (<0.10): Uniform risk, limited stock-picking edge
• Normal (0.10-0.15): Healthy variation, selection matters
• High (>0.15): Wide dispersion, large alpha opportunities

Cross-sectional std means we measure how much volatilities differ across stocks at one point in time.`,
              actionableInsight: "When dispersion collapses (drops quickly), it often signals that macro factors are overwhelming stock-specific drivers. This is a regime-change warning. When dispersion is high and rising, it's a good environment for long/short equity and stock-picking strategies.",
              variant: "default",
            }}
          />
          <MetricCard
            title="Effective Dimension"
            value={metricsData ? metricsData.effective_dimension.toFixed(1) : '...'}
            changeLabel="PCA eigenvalue diversity"
            icon={<Layers className="h-5 w-5" />}
            educational={{
              title: "Effective Dimension (PCA)",
              whatItIs: "Effective dimension measures how many independent factors drive market movements. We use Principal Component Analysis (PCA) to decompose returns into orthogonal components, then calculate the effective number using eigenvalue diversity. Higher values mean more independent sources of risk.",
              whyItMatters: "This tells you the true dimensionality of market risk. In calm markets, effective dimension might be 8-12 (sector factors, size, value, etc.). In crises, it collapses to 1-2 (just 'risk-on/risk-off'). Low effective dimension means the market is one-dimensional - you can't really diversify.",
              howToRead: `• Current value: ${metricsData ? metricsData.effective_dimension.toFixed(1) : 'N/A'}
• Very Low (<3): Crisis - market is one-dimensional
• Low (3-6): Stressed - few factors dominate
• Normal (6-10): Healthy multi-factor market
• High (>10): Very dispersed, many independent drivers

Calculated using eigenvalue diversity: 1/Σ(λᵢ²) where λᵢ are normalized eigenvalues from PCA.`,
              actionableInsight: "When effective dimension drops below 5, the market is becoming dangerously simple - everything trades on one or two factors. This makes hedging difficult and increases tail risk. Diversification provides little protection. Wait for dimension to recover before adding risk.",
              variant: "default",
            }}
          />
        </div>

        {/* Market Data row - VIX always visible */}
        <VIXGauge />

        {/* Index Selector */}
        <IndexSelector
          selectedIndex={selectedIndex}
          onIndexChange={setSelectedIndex}
        />

        {/* Selected Index Performance */}
        <IndexPerformanceCard symbol={selectedIndex} />

        {/* Charts row - Updated to use selected index */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <IndexTimeSeriesChart symbol={selectedIndex} />
          </div>
          <div>
            <VolatilityGauge
              value={indexRegime ? (indexRegime.regime_id * 25 + 25) : 50}
              label={`${selectedIndex} ${indexRegime?.regime_name || 'Loading'}`}
              regime={
                indexRegime?.regime_name === 'Calm' ? 'low' :
                indexRegime?.regime_name === 'Crisis' ? 'extreme' :
                indexRegime?.regime_name === 'Elevated Stress' ? 'high' :
                'medium'
              }
            />
          </div>
        </div>

        {/* Regime Timeline with Selected Index */}
        <RegimeTimelineWithIndex symbol={selectedIndex} />

        {/* Performance by Regime for Selected Index */}
        <RegimePerformanceTable symbol={selectedIndex} />

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
