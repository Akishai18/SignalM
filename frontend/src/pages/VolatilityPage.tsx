import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { VolatilityGauge } from "@/components/dashboard/VolatilityGauge";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { Button } from "@/components/ui/button";
import { Settings2, Download, Play } from "lucide-react";

const VolatilityPage = () => {
  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Volatility <span className="text-gradient">Regimes</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Hidden Markov Model regime detection
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Configure HMM
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="neon" size="sm" className="gap-2">
                <Play className="h-4 w-4" />
                Run Analysis
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <VolatilityGauge value={28.5} label="Current Regime" regime="low" />
          <VolatilityGauge value={52.3} label="30-Day Outlook" regime="medium" />
          <VolatilityGauge value={71.8} label="Stress Scenario" regime="high" />
        </div>

        <TimeSeriesChart />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold mb-4">Regime Transition Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-muted-foreground">From / To</th>
                    <th className="text-center py-2 font-medium text-neon-green">Low Vol</th>
                    <th className="text-center py-2 font-medium text-neon-cyan">Medium</th>
                    <th className="text-center py-2 font-medium text-neon-magenta">High Vol</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b border-border/50">
                    <td className="py-3 font-medium text-neon-green">Low Vol</td>
                    <td className="text-center py-3">0.85</td>
                    <td className="text-center py-3">0.12</td>
                    <td className="text-center py-3">0.03</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 font-medium text-neon-cyan">Medium</td>
                    <td className="text-center py-3">0.25</td>
                    <td className="text-center py-3">0.55</td>
                    <td className="text-center py-3">0.20</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-neon-magenta">High Vol</td>
                    <td className="text-center py-3">0.10</td>
                    <td className="text-center py-3">0.35</td>
                    <td className="text-center py-3">0.55</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold mb-4">Regime Statistics</h3>
            <div className="space-y-4">
              {[
                { regime: "Low Volatility", duration: "45 days avg", probability: 58, color: "neon-green" },
                { regime: "Medium Volatility", duration: "21 days avg", probability: 28, color: "neon-cyan" },
                { regime: "High Volatility", duration: "12 days avg", probability: 14, color: "neon-magenta" },
              ].map((item) => (
                <div key={item.regime} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.regime}</span>
                    <span className="text-muted-foreground">{item.duration}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-${item.color}`}
                      style={{ width: `${item.probability}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {item.probability}% of observations
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default VolatilityPage;
