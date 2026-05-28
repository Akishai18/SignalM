import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePCAStructureFull } from "@/hooks/useRegimeData";
import RollingPCVarianceChart from "@/components/factors/RollingPCVarianceChart";
import PCScatterChart from "@/components/factors/PCScatterChart";
import TopLoadingsTable from "@/components/factors/TopLoadingsTable";
import PCRegimeScoresChart from "@/components/factors/PCRegimeScoresChart";
import PCTimeSeriesChart from "@/components/factors/PCTimeSeriesChart";
import { Loader2, TrendingUp, Layers, Activity } from "lucide-react";

function StatCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold font-mono" style={{ color }}>
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div
          className="rounded-lg p-2"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

const FactorsPage = () => {
  const { data, isLoading } = usePCAStructureFull();
  const summary = data?.summary;

  return (
    <DashboardLayout>
      <header className="sticky top-14 z-20 border-b border-border bg-card/50 backdrop-blur-sm md:top-0 md:z-30">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              Factor <span className="text-gradient">Analysis</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              PCA decomposition — how market variance is structured across components and regimes
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* Row 1: Stat Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <StatCard
              label="PC1 Variance Explained (current)"
              value={summary ? `${(summary.current_pc1_var * 100).toFixed(1)}%` : "—"}
              sub="Systemic risk factor"
              color="#06b6d4"
              icon={TrendingUp}
            />
            <StatCard
              label="Cumulative Var — Top 3 PCs"
              value={summary ? `${(summary.current_cum_var_3 * 100).toFixed(1)}%` : "—"}
              sub="Explained by PC1 + PC2 + PC3"
              color="#10b981"
              icon={Layers}
            />
            <StatCard
              label="Effective Dimension"
              value={summary ? summary.current_eff_dim.toFixed(2) : "—"}
              sub="Shannon entropy of eigenvalue spectrum"
              color="#8b5cf6"
              icon={Activity}
            />
          </div>
        )}

        {/* Row 2: Rolling PC Variance (full width) */}
        <div>
          <RollingPCVarianceChart />
        </div>

        {/* Row 3: PC Time Series (full width) */}
        <div>
          <PCTimeSeriesChart />
        </div>

        {/* Row 4: Scatter + Regime Scores (50/50) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <PCScatterChart />
          <PCRegimeScoresChart />
        </div>

        {/* Row 4: Top Loadings (full width) */}
        <div>
          <TopLoadingsTable />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FactorsPage;
