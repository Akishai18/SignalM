/**
 * Index Performance Card Component
 * Displays current price and performance metrics for any index
 */
import { useIndexCurrentRegime } from "@/hooks/useRegimeData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { FlipCard } from "@/components/ui/flip-card";
import { EducationCard } from "@/components/dashboard/EducationCard";

interface IndexPerformanceCardProps {
  symbol: string;
}

export function IndexPerformanceCard({ symbol }: IndexPerformanceCardProps) {
  const { data: indexData, isLoading, isError } = useIndexCurrentRegime(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !indexData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load data</div>
        </CardContent>
      </Card>
    );
  }

  const { price, volatility, name } = indexData;
  const displayPrice = price || 0;
  const displayVol = volatility || 0;

  // Mock daily return - in production, calculate from features
  const dailyReturn = 0; // TODO: Add to API response
  const isPositive = dailyReturn >= 0;

  const frontContent = (
    <Card className="card-hover hover-border-glow group h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4 group-hover:scale-110 group-hover:text-primary transition-all" />
          <span className="group-hover:text-primary transition-colors">{symbol} ({name})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Current Price */}
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-bold group-hover:scale-105 transition-transform inline-block">
                ${displayPrice.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 group-hover:text-primary/70 transition-colors">
                Latest Close
              </div>
            </div>
            <div className={`flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'} group-hover:scale-110 transition-transform`}>
              {isPositive ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">
                {isPositive ? '+' : ''}{(dailyReturn * 100).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div>
              <div className="text-xs text-muted-foreground">Daily Change</div>
              <div className={`text-lg font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{(dailyReturn * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Volatility (252d)</div>
              <div className="text-lg font-semibold">
                {(displayVol * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Volatility Indicator */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Volatility</span>
              <span>{displayVol < 0.15 ? 'Low' : displayVol < 0.25 ? 'Normal' : 'High'}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  displayVol < 0.15
                    ? 'bg-green-500'
                    : displayVol < 0.25
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min((displayVol / 0.5) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Update Time */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            As of {indexData.date}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const backContent = (
    <EducationCard
      title={`${symbol} Performance Metrics`}
      whatItIs={`This card shows the current price and volatility metrics for ${name}. It tracks the latest closing price and annualized volatility (252-day rolling standard deviation of returns).`}
      whyItMatters="Price shows current valuation, while volatility measures how much the index swings up and down. High volatility means more risk but also more opportunity. Together, they help you understand both the level and stability of the market."
      howToRead={`• Price: Current close is $${displayPrice.toFixed(2)}
• Volatility: ${(displayVol * 100).toFixed(1)}% annualized
• Low vol (<15%): Stable, predictable
• Normal vol (15-25%): Typical market
• High vol (>25%): Increased risk/opportunity

Volatility shows as ${displayVol < 0.15 ? 'Low' : displayVol < 0.25 ? 'Normal' : 'High'} - indicating ${displayVol < 0.15 ? 'calm, stable conditions' : displayVol < 0.25 ? 'typical market behavior' : 'elevated risk and uncertainty'}.`}
      actionableInsight={`When volatility spikes, it often creates buying opportunities for long-term investors. When it drops too low (<12%), markets may be complacent before a correction.`}
      variant="neon"
    />
  );

  return (
    <FlipCard
      front={frontContent}
      back={backContent}
    />
  );
}
