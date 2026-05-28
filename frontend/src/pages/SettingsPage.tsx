import { Settings, Sun, Moon, Database, BrainCircuit, TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTheme } from "@/hooks/useTheme";

// ── Theme option card ──────────────────────────────────────────────────────────

function ThemeCard({
  value,
  label,
  preview,
  active,
  onClick,
}: {
  value: string;
  label: string;
  preview: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 rounded-xl border-2 p-3 text-left transition-all ${
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-card/80"
      }`}
    >
      {/* Preview thumbnail */}
      <div className="mb-2.5 h-16 w-full overflow-hidden rounded-lg border border-border/50">
        {preview}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{label}</span>
        {active && (
          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}

// ── About row item ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium font-mono text-foreground">{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();

  return (
    <DashboardLayout>
      {/* Header */}
      <header className="sticky top-14 z-20 border-b border-border bg-card/50 backdrop-blur-sm md:top-0 md:z-30">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                <span className="text-gradient">Settings</span>
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
                Appearance and platform information
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4 md:space-y-5 md:p-6">

        {/* ── Appearance — full width ──────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Appearance</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4 ml-6">
            Stored locally in your browser — persists across sessions.
          </p>

          {/* Theme cards: fixed width, left-aligned — don't stretch full row */}
          <div className="flex gap-3 max-w-sm">
            <ThemeCard
              value="light"
              label="Light"
              active={theme === "light"}
              onClick={() => setTheme("light")}
              preview={
                <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-100 p-2 flex flex-col gap-1">
                  <div className="h-1.5 w-16 rounded-full bg-gray-300" />
                  <div className="flex gap-1 mt-0.5">
                    <div className="h-6 w-6 rounded bg-gray-200" />
                    <div className="flex-1 flex flex-col gap-0.5 justify-center">
                      <div className="h-1 rounded-full bg-gray-300" />
                      <div className="h-1 w-3/4 rounded-full bg-gray-200" />
                    </div>
                  </div>
                  <div className="h-4 w-full rounded bg-gray-200 mt-0.5" />
                </div>
              }
            />
            <ThemeCard
              value="dark"
              label="Dark"
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
              preview={
                <div className="h-full w-full bg-gradient-to-br from-zinc-900 to-zinc-800 p-2 flex flex-col gap-1">
                  <div className="h-1.5 w-16 rounded-full bg-zinc-600" />
                  <div className="flex gap-1 mt-0.5">
                    <div className="h-6 w-6 rounded bg-zinc-700" />
                    <div className="flex-1 flex flex-col gap-0.5 justify-center">
                      <div className="h-1 rounded-full bg-zinc-500" />
                      <div className="h-1 w-3/4 rounded-full bg-zinc-600" />
                    </div>
                  </div>
                  <div className="h-4 w-full rounded bg-zinc-700 mt-0.5" />
                </div>
              }
            />
          </div>
        </div>

        {/* ── Two-column grid for info cards ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Regime Model */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <BrainCircuit className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Regime Model</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4 ml-6">
              Fixed configuration — pre-trained, read-only.
            </p>
            <InfoRow label="Algorithm"     value="K-Means clustering" />
            <InfoRow label="Regimes (K)"   value="4" />
            <InfoRow label="Labels"        value="Calm · Crisis · Elevated Stress · Transition" />
            <InfoRow label="Features"      value="Volatility, correlation, PCA (6 dims)" />
            <InfoRow label="Train / test"  value="70 / 30  chronological split" />
          </div>

          {/* Prediction Models */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Prediction Models</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4 ml-6">
              Four models are pre-trained and served via the API.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Markov Chain",  desc: "Transition matrix · regime sequence" },
                { name: "Hidden Markov", desc: "HMM · probabilistic switching" },
                { name: "Random Forest", desc: "Ensemble · feature importance" },
                { name: "XGBoost",       desc: "Gradient boosting · top accuracy" },
              ].map((model) => (
                <div
                  key={model.name}
                  className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                >
                  <p className="text-xs font-semibold">{model.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{model.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Data Coverage — spans both columns */}
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Data Coverage</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4 ml-6">
              Precomputed from historical market data.
            </p>
            {/* Two-column info grid inside the card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12">
              <div>
                <InfoRow label="Universe"   value="500+ S&P 500 constituents" />
                <InfoRow label="History"    value="2012 – 2024" />
                <InfoRow label="Frequency"  value="Daily" />
                <InfoRow label="Benchmark"  value="SPY  (buy-and-hold)" />
              </div>
              <div>
                <InfoRow label="Sector ETFs" value="XLB · XLC · XLE · XLF · XLI" />
                <InfoRow label=""            value="XLK · XLP · XLRE · XLU · XLV · XLY" />
                <InfoRow label="Indices"     value="SPY · QQQ · DIA · IWM" />
                <InfoRow label="Backtester"  value="Regime-aware · vectorized engine" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
