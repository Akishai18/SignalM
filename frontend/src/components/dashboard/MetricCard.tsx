import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { FlipCard } from "@/components/ui/flip-card";
import { EducationCard } from "./EducationCard";

interface EducationalContent {
  title: string;
  whatItIs: string;
  whyItMatters: string;
  howToRead: string;
  actionableInsight?: string;
  variant?: "default" | "neon" | "warning" | "success";
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  variant?: "default" | "neon" | "warning" | "success";
  className?: string;
  educational?: EducationalContent;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  variant = "default",
  className,
  educational,
}: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = change === 0;

  const cardContent = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl p-5 transition-all duration-300 cursor-pointer",
        "border border-border bg-card hover-lift hover-glow",
        variant === "neon" && "neon-border hover:glow-cyan",
        variant === "warning" && "border-neon-yellow/30 hover:shadow-neon-yellow/10",
        variant === "success" && "border-neon-green/30 hover:shadow-neon-green/10",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent group-hover:from-primary/10 transition-all duration-300" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">{title}</p>
            <p className="text-3xl font-bold tracking-tight font-mono group-hover:scale-105 transition-transform inline-block">{value}</p>
          </div>
          {icon && (
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary group-hover:bg-primary/20 group-hover:scale-110 transition-all">
              {icon}
            </div>
          )}
        </div>

        {change !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                isPositive && "bg-neon-green/10 text-neon-green",
                isNegative && "bg-destructive/10 text-destructive",
                isNeutral && "bg-muted text-muted-foreground"
              )}
            >
              {isPositive && <TrendingUp className="h-3 w-3" />}
              {isNegative && <TrendingDown className="h-3 w-3" />}
              {isNeutral && <Minus className="h-3 w-3" />}
              <span>{isPositive ? "+" : ""}{change}%</span>
            </div>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // If educational content is provided, wrap in FlipCard
  if (educational) {
    return (
      <FlipCard
        front={cardContent}
        back={
          <EducationCard
            title={educational.title}
            whatItIs={educational.whatItIs}
            whyItMatters={educational.whyItMatters}
            howToRead={educational.howToRead}
            actionableInsight={educational.actionableInsight}
            variant={educational.variant || variant}
          />
        }
      />
    );
  }

  return cardContent;
}
