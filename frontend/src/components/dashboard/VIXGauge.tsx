/**
 * VIX Gauge Component
 * Displays current VIX (Volatility Index) level with color-coded risk indicator
 */
import { useVIXCurrent } from "@/hooks/useRegimeData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { FlipCard } from "@/components/ui/flip-card";
import { EducationCard } from "@/components/dashboard/EducationCard";

export function VIXGauge() {
  const { data: vixData, isLoading, isError } = useVIXCurrent();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">VIX Index</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !vixData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">VIX Index</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load VIX data</div>
        </CardContent>
      </Card>
    );
  }

  const vix = vixData.close;

  // VIX thresholds
  const getVIXLevel = (value: number) => {
    if (value < 15) return { label: "Low", color: "text-green-500", bg: "bg-green-500/10" };
    if (value < 25) return { label: "Normal", color: "text-yellow-500", bg: "bg-yellow-500/10" };
    if (value < 35) return { label: "Elevated", color: "text-orange-500", bg: "bg-orange-500/10" };
    return { label: "High", color: "text-red-500", bg: "bg-red-500/10" };
  };

  const level = getVIXLevel(vix);

  const frontContent = (
    <Card className="card-hover hover-border-glow group h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 group-hover:scale-110 group-hover:text-primary transition-all" />
          <span className="group-hover:text-primary transition-colors">VIX Index</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* VIX Value */}
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-bold group-hover:scale-105 transition-transform inline-block">{vix.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1 group-hover:text-primary/70 transition-colors">
                Fear & Greed Indicator
              </div>
            </div>
            <div className={`flex items-center gap-1 ${level.color} group-hover:scale-110 transition-transform`}>
              {vix >= 25 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
            </div>
          </div>

          {/* Risk Level Badge */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${level.bg} ${level.color} group-hover:scale-105 group-hover:shadow-md transition-all`}>
            {level.label} Volatility
          </div>

          {/* VIX Scale */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Calm</span>
              <span>Normal</span>
              <span>Fear</span>
            </div>
            <div className="relative h-2 bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500 rounded-full overflow-hidden">
              {/* VIX position indicator */}
              <div
                className="absolute top-0 h-full w-1 bg-white shadow-lg"
                style={{ left: `${Math.min((vix / 50) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>25</span>
              <span>50+</span>
            </div>
          </div>

          {/* Interpretation */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            {vix < 15 && "Markets are calm. Low fear, stable conditions."}
            {vix >= 15 && vix < 25 && "Normal volatility. Market functioning normally."}
            {vix >= 25 && vix < 35 && "Elevated fear. Markets experiencing stress."}
            {vix >= 35 && "High fear. Significant market turbulence."}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const backContent = (
    <EducationCard
      title="VIX Index (Fear Gauge)"
      whatItIs="The VIX (Volatility Index) measures expected 30-day volatility in the S&P 500. It's calculated from options prices and is often called the 'Fear Gauge' because it rises when investors expect big market swings."
      whyItMatters="VIX tells you how nervous investors are about the near-term future. High VIX = high uncertainty and fear. Low VIX = calm, stable markets. It's a contrarian indicator - extreme fear often signals buying opportunities."
      howToRead={`• VIX < 15: Low volatility, calm markets
• VIX 15-25: Normal volatility
• VIX 25-35: Elevated fear, stress
• VIX > 35: High fear, potential crisis

Current VIX of ${vix.toFixed(2)} indicates ${level.label.toLowerCase()} volatility.`}
      actionableInsight="When VIX spikes above 30, historically the market has often bottomed within weeks. Conversely, VIX below 12 can signal complacency before corrections."
      variant="warning"
    />
  );

  return (
    <FlipCard
      front={frontContent}
      back={backContent}
    />
  );
}
