import { cn } from "@/lib/utils";

interface Factor {
  name: string;
  exposure: number;
  contribution: number;
}

const factors: Factor[] = [
  { name: "Market Beta", exposure: 0.95, contribution: 68 },
  { name: "Size Factor", exposure: 0.23, contribution: 12 },
  { name: "Value Factor", exposure: -0.15, contribution: -5 },
  { name: "Momentum", exposure: 0.42, contribution: 18 },
  { name: "Quality", exposure: 0.31, contribution: 7 },
];

export function FactorExposure() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Factor Exposures</h3>
        <p className="text-sm text-muted-foreground">Current portfolio factor loadings</p>
      </div>

      <div className="space-y-4">
        {factors.map((factor) => (
          <div key={factor.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{factor.name}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-muted-foreground">
                  {factor.exposure > 0 ? "+" : ""}{factor.exposure.toFixed(2)}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs px-1.5 py-0.5 rounded",
                    factor.contribution >= 0
                      ? "bg-neon-green/10 text-neon-green"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {factor.contribution > 0 ? "+" : ""}{factor.contribution}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  factor.exposure >= 0
                    ? "bg-gradient-to-r from-neon-cyan to-neon-green"
                    : "bg-gradient-to-r from-destructive to-neon-magenta"
                )}
                style={{
                  width: `${Math.min(Math.abs(factor.exposure) * 100, 100)}%`,
                  marginLeft: factor.exposure < 0 ? "auto" : 0,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Explained Variance</span>
          <span className="font-mono font-semibold text-neon-cyan">87.3%</span>
        </div>
      </div>
    </div>
  );
}
