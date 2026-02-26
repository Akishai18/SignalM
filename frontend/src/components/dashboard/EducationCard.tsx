/**
 * Education Card Component
 * Shows educational content explaining metrics and charts
 */
import { ReactNode } from "react";
import { GraduationCap, TrendingUp, AlertCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface EducationCardProps {
  title: string;
  whatItIs: string;
  whyItMatters: string;
  howToRead: string;
  actionableInsight?: string;
  variant?: "default" | "neon" | "warning" | "success";
  className?: string;
}

export function EducationCard({
  title,
  whatItIs,
  whyItMatters,
  howToRead,
  actionableInsight,
  variant = "default",
  className,
}: EducationCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-5 h-full",
        "border border-border bg-gradient-to-br from-card to-card/80",
        variant === "neon" && "border-primary/30 bg-gradient-to-br from-primary/5 to-card",
        variant === "warning" && "border-neon-yellow/30 bg-gradient-to-br from-neon-yellow/5 to-card",
        variant === "success" && "border-neon-green/30 bg-gradient-to-br from-neon-green/5 to-card",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        {/* What It Is */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <AlertCircle className="h-4 w-4" />
            <span>What It Is</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed pl-6">
            {whatItIs}
          </p>
        </div>

        {/* Why It Matters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <TrendingUp className="h-4 w-4" />
            <span>Why It Matters</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed pl-6">
            {whyItMatters}
          </p>
        </div>

        {/* How to Read */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Lightbulb className="h-4 w-4" />
            <span>How to Read</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed pl-6">
            {howToRead}
          </p>
        </div>

        {/* Actionable Insight */}
        {actionableInsight && (
          <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
            <p className="text-sm font-medium text-primary">
              💡 {actionableInsight}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
