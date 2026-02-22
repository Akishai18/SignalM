import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();

  return (
    <DashboardLayout>
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-gradient">Settings</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your analysis preferences
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button variant="neon" size="sm" className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Appearance */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Theme</label>
              <p className="text-xs text-muted-foreground mb-3">
                Choose your preferred color scheme
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    theme === "light"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="h-12 w-full rounded bg-gradient-to-br from-white to-gray-100 mb-2 border" />
                  <p className="text-sm font-medium">Light</p>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    theme === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="h-12 w-full rounded bg-gradient-to-br from-gray-900 to-gray-800 mb-2" />
                  <p className="text-sm font-medium">Dark</p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis defaults */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Analysis Defaults</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Default Window Size</label>
              <select className="w-full mt-2 px-3 py-2 rounded-lg bg-muted border border-border">
                <option>30 days</option>
                <option>60 days</option>
                <option>90 days</option>
                <option>252 days (1 Year)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Correlation Method</label>
              <select className="w-full mt-2 px-3 py-2 rounded-lg bg-muted border border-border">
                <option>Pearson</option>
                <option>Spearman</option>
                <option>Kendall</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Return Calculation</label>
              <select className="w-full mt-2 px-3 py-2 rounded-lg bg-muted border border-border">
                <option>Log Returns</option>
                <option>Simple Returns</option>
              </select>
            </div>
          </div>
        </div>

        {/* HMM Settings */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Regime Detection (HMM)</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Number of Regimes</label>
              <select className="w-full mt-2 px-3 py-2 rounded-lg bg-muted border border-border">
                <option>2 (Low/High)</option>
                <option>3 (Low/Medium/High)</option>
                <option>4 (Extended)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Lookback Period</label>
              <input
                type="number"
                defaultValue={252}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-muted border border-border font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Days for model training</p>
            </div>
          </div>
        </div>

        {/* Data preferences */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold mb-4">Data Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-refresh data</p>
                <p className="text-xs text-muted-foreground">
                  Automatically fetch latest prices
                </p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cache computations</p>
                <p className="text-xs text-muted-foreground">
                  Store results for faster loading
                </p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition-colors">
                <span className="inline-block h-4 w-4 transform rounded-full bg-foreground/50 transition-transform translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
