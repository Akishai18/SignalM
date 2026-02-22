import { cn } from "@/lib/utils";

interface VolatilityGaugeProps {
  value: number; // 0-100
  label: string;
  regime: "low" | "medium" | "high" | "extreme";
}

const regimeConfig = {
  low: {
    color: "from-neon-green to-neon-cyan",
    label: "Low Volatility",
    description: "Markets are calm, correlations stable",
  },
  medium: {
    color: "from-neon-cyan to-neon-yellow",
    label: "Medium Volatility",
    description: "Normal market conditions",
  },
  high: {
    color: "from-neon-yellow to-neon-magenta",
    label: "High Volatility",
    description: "Elevated risk, correlations rising",
  },
  extreme: {
    color: "from-neon-magenta to-destructive",
    label: "Extreme Volatility",
    description: "Crisis regime, correlations spiking",
  },
};

export function VolatilityGauge({ value, label, regime }: VolatilityGaugeProps) {
  const config = regimeConfig[regime];
  const rotation = (value / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{label}</h3>
        <p className="text-sm text-muted-foreground">Current market regime indicator</p>
      </div>

      <div className="relative flex flex-col items-center">
        {/* Gauge background */}
        <div className="relative h-32 w-64 overflow-hidden">
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-32 rounded-t-full",
              "bg-gradient-to-r",
              config.color,
              "opacity-20"
            )}
          />
          
          {/* Gauge segments */}
          <div className="absolute bottom-0 left-0 right-0 h-32">
            <svg viewBox="0 0 200 100" className="w-full h-full">
              {/* Background arc */}
              <path
                d="M 10 100 A 90 90 0 0 1 190 100"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-muted/30"
                strokeLinecap="round"
              />
              {/* Value arc */}
              <path
                d="M 10 100 A 90 90 0 0 1 190 100"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(value / 100) * 283} 283`}
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--neon-green))" />
                  <stop offset="50%" stopColor="hsl(var(--neon-cyan))" />
                  <stop offset="100%" stopColor="hsl(var(--neon-magenta))" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-1000 ease-out"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <div className="h-24 w-1 rounded-t-full bg-gradient-to-t from-primary to-primary/50" />
            <div className="absolute -bottom-1.5 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary shadow-lg glow-cyan" />
          </div>
        </div>

        {/* Value display */}
        <div className="mt-4 text-center">
          <div className="text-4xl font-bold font-mono text-gradient">
            {value.toFixed(1)}
          </div>
          <div
            className={cn(
              "mt-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
              regime === "low" && "bg-neon-green/10 text-neon-green",
              regime === "medium" && "bg-neon-cyan/10 text-neon-cyan",
              regime === "high" && "bg-neon-yellow/10 text-neon-yellow",
              regime === "extreme" && "bg-neon-magenta/10 text-neon-magenta"
            )}
          >
            {config.label}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{config.description}</p>
        </div>
      </div>
    </div>
  );
}
