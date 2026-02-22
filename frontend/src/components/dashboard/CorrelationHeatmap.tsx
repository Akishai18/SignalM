import { cn } from "@/lib/utils";

// Sample correlation data for visualization
const sectors = ["Tech", "Fin", "Health", "Energy", "Cons", "Ind", "Util", "Mat"];
const correlationData = [
  [1.0, 0.72, 0.45, 0.23, 0.67, 0.54, 0.12, 0.34],
  [0.72, 1.0, 0.38, 0.41, 0.52, 0.61, 0.28, 0.45],
  [0.45, 0.38, 1.0, 0.15, 0.42, 0.33, 0.52, 0.27],
  [0.23, 0.41, 0.15, 1.0, 0.28, 0.47, 0.63, 0.71],
  [0.67, 0.52, 0.42, 0.28, 1.0, 0.58, 0.21, 0.36],
  [0.54, 0.61, 0.33, 0.47, 0.58, 1.0, 0.39, 0.52],
  [0.12, 0.28, 0.52, 0.63, 0.21, 0.39, 1.0, 0.44],
  [0.34, 0.45, 0.27, 0.71, 0.36, 0.52, 0.44, 1.0],
];

function getCorrelationColor(value: number, isDark: boolean = false): string {
  if (value >= 0.7) return isDark ? "bg-neon-cyan/80" : "bg-neon-cyan/70";
  if (value >= 0.5) return isDark ? "bg-neon-green/60" : "bg-neon-green/50";
  if (value >= 0.3) return isDark ? "bg-neon-yellow/50" : "bg-neon-yellow/40";
  return isDark ? "bg-muted/50" : "bg-muted/30";
}

export function CorrelationHeatmap() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sector Correlations</h3>
          <p className="text-sm text-muted-foreground">Rolling 30-day correlation matrix</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-neon-cyan/70" />
            <span className="text-muted-foreground">High (≥0.7)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-neon-green/50" />
            <span className="text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-muted/30" />
            <span className="text-muted-foreground">Low</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header row */}
          <div className="flex">
            <div className="w-14 shrink-0" />
            {sectors.map((sector) => (
              <div
                key={sector}
                className="w-14 shrink-0 text-center text-xs font-medium text-muted-foreground py-2"
              >
                {sector}
              </div>
            ))}
          </div>

          {/* Matrix rows */}
          {correlationData.map((row, i) => (
            <div key={sectors[i]} className="flex">
              <div className="w-14 shrink-0 text-xs font-medium text-muted-foreground flex items-center">
                {sectors[i]}
              </div>
              {row.map((value, j) => (
                <div
                  key={`${i}-${j}`}
                  className={cn(
                    "w-14 h-12 shrink-0 flex items-center justify-center",
                    "text-xs font-mono font-medium transition-all duration-200",
                    "rounded-md m-0.5 cursor-pointer",
                    "hover:scale-105 hover:z-10 hover:shadow-lg",
                    getCorrelationColor(value),
                    i === j && "ring-1 ring-primary/50"
                  )}
                >
                  {value.toFixed(2)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
