import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CorrelationHeatmap } from "@/components/dashboard/CorrelationHeatmap";
import { Button } from "@/components/ui/button";
import { Download, Filter, Calendar, RefreshCw } from "lucide-react";

const CorrelationPage = () => {
  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Correlation <span className="text-gradient">Matrix</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Analyze cross-asset correlations over time
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="neon" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Compute
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <CorrelationHeatmap />
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-3">Analysis Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Window Size</label>
                  <select className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                    <option>30 days</option>
                    <option>60 days</option>
                    <option>90 days</option>
                    <option>252 days (1Y)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Method</label>
                  <select className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                    <option>Pearson</option>
                    <option>Spearman</option>
                    <option>Kendall</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Return Type</label>
                  <select className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                    <option>Log Returns</option>
                    <option>Simple Returns</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-3">Statistics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mean Correlation</span>
                  <span className="font-mono font-medium">0.47</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Correlation</span>
                  <span className="font-mono font-medium text-neon-cyan">0.72</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Correlation</span>
                  <span className="font-mono font-medium text-neon-magenta">0.12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Std Deviation</span>
                  <span className="font-mono font-medium">0.18</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CorrelationPage;
