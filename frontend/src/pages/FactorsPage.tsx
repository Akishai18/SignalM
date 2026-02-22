import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FactorExposure } from "@/components/dashboard/FactorExposure";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const eigenvalues = [
  { factor: 1, value: 4.23, variance: 42.3, cumulative: 42.3 },
  { factor: 2, value: 2.15, variance: 21.5, cumulative: 63.8 },
  { factor: 3, value: 1.34, variance: 13.4, cumulative: 77.2 },
  { factor: 4, value: 0.89, variance: 8.9, cumulative: 86.1 },
  { factor: 5, value: 0.52, variance: 5.2, cumulative: 91.3 },
];

const FactorsPage = () => {
  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Factor <span className="text-gradient">Analysis</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                PCA decomposition & latent factor discovery
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Parameters
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="neon" size="sm" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Compute PCA
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold mb-4">Scree Plot - Eigenvalues</h3>
            <div className="space-y-3">
              {eigenvalues.map((item) => (
                <div key={item.factor} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Factor {item.factor}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-muted-foreground">
                        λ = {item.value.toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-xs px-2 py-0.5 rounded",
                          item.value >= 1
                            ? "bg-neon-green/10 text-neon-green"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.variance.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-green transition-all duration-500"
                      style={{ width: `${item.variance}%` }}
                    />
                    <div
                      className="absolute h-full border-r-2 border-dashed border-neon-magenta/50"
                      style={{ width: `${item.cumulative}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    Cumulative: {item.cumulative.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Kaiser Criterion (λ ≥ 1)</span>
              <span className="font-mono font-semibold text-neon-cyan">3 factors retained</span>
            </div>
          </div>

          <FactorExposure />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Factor Loadings Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 font-medium text-muted-foreground">Asset</th>
                  <th className="text-center py-3 font-medium text-neon-cyan">PC1 (Market)</th>
                  <th className="text-center py-3 font-medium text-neon-green">PC2 (Size)</th>
                  <th className="text-center py-3 font-medium text-neon-magenta">PC3 (Value)</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  { asset: "Technology", pc1: 0.92, pc2: -0.15, pc3: 0.08 },
                  { asset: "Financials", pc1: 0.88, pc2: 0.22, pc3: 0.31 },
                  { asset: "Healthcare", pc1: 0.76, pc2: 0.05, pc3: -0.18 },
                  { asset: "Energy", pc1: 0.65, pc2: 0.45, pc3: 0.52 },
                  { asset: "Consumer", pc1: 0.84, pc2: -0.28, pc3: -0.12 },
                  { asset: "Industrials", pc1: 0.81, pc2: 0.18, pc3: 0.25 },
                ].map((row) => (
                  <tr key={row.asset} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 font-medium font-sans">{row.asset}</td>
                    <td
                      className={cn(
                        "text-center py-3",
                        Math.abs(row.pc1) >= 0.5 && "font-semibold text-neon-cyan"
                      )}
                    >
                      {row.pc1.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        "text-center py-3",
                        Math.abs(row.pc2) >= 0.5 && "font-semibold text-neon-green"
                      )}
                    >
                      {row.pc2.toFixed(2)}
                    </td>
                    <td
                      className={cn(
                        "text-center py-3",
                        Math.abs(row.pc3) >= 0.5 && "font-semibold text-neon-magenta"
                      )}
                    >
                      {row.pc3.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FactorsPage;
