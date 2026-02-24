/**
 * Index Selector Component
 * Allows users to switch between different market indices
 */
import { useState } from "react";
import { cn } from "@/lib/utils";

interface IndexSelectorProps {
  selectedIndex: string;
  onIndexChange: (index: string) => void;
}

const INDICES = [
  { symbol: "SPY", name: "S&P 500", color: "#0ea5e9" },
  { symbol: "QQQ", name: "NASDAQ-100", color: "#8b5cf6" },
  { symbol: "DIA", name: "Dow Jones", color: "#10b981" },
  { symbol: "IWM", name: "Russell 2000", color: "#f59e0b" },
];

export function IndexSelector({ selectedIndex, onIndexChange }: IndexSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm hover-border-glow">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-muted-foreground">
          Viewing:
        </div>
        <div className="text-sm font-semibold">
          Market Analysis
        </div>
      </div>

      {/* Index Tabs */}
      <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/30">
        {INDICES.map((index) => {
          const isSelected = selectedIndex === index.symbol;
          return (
            <button
              key={index.symbol}
              onClick={() => onIndexChange(index.symbol)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                "hover:scale-105 active:scale-95",
                isSelected
                  ? "bg-card shadow-md text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
              style={{
                borderLeft: isSelected ? `3px solid ${index.color}` : "none",
              }}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-bold">{index.symbol}</span>
                <span className="text-xs opacity-70">{index.name}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
