import { ModelComparison } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Target } from "lucide-react";

interface ModelComparisonTableProps {
  data?: ModelComparison;
}

export function ModelComparisonTable({ data }: ModelComparisonTableProps) {
  if (!data || !data.models || data.models.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No model data available</p>
      </div>
    );
  }

  const models = data.models;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Model Performance Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Test period accuracy (chronological 70/30 split)
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                Rank
              </th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                Model
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                Accuracy
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                Confidence
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                Correct
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                Total
              </th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                Performance
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map((model, idx) => {
              const isFirst = idx === 0;
              const accuracyPercent = (model.accuracy * 100).toFixed(2);
              const confidencePercent = (model.confidence * 100).toFixed(2);

              return (
                <tr
                  key={model.model_name}
                  className={cn(
                    "border-b border-border transition-colors hover:bg-muted/30",
                    isFirst && "bg-neon-cyan/5"
                  )}
                >
                  {/* Rank */}
                  <td className="p-4">
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm",
                        isFirst
                          ? "bg-neon-cyan/20 text-neon-cyan"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {idx + 1}
                      {isFirst && <Trophy className="h-3 w-3 ml-0.5" />}
                    </div>
                  </td>

                  {/* Model Name */}
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.model_name}</span>
                      {isFirst && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan font-medium">
                          Best
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Accuracy */}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-mono font-semibold text-lg">
                        {accuracyPercent}%
                      </span>
                    </div>
                  </td>

                  {/* Confidence */}
                  <td className="p-4 text-right">
                    <span className="font-mono text-sm text-muted-foreground">
                      {confidencePercent}%
                    </span>
                  </td>

                  {/* Correct Predictions */}
                  <td className="p-4 text-right">
                    <span className="font-mono text-sm text-neon-green">
                      {model.correct_predictions.toLocaleString()}
                    </span>
                  </td>

                  {/* Total Predictions */}
                  <td className="p-4 text-right">
                    <span className="font-mono text-sm text-muted-foreground">
                      {model.total_predictions.toLocaleString()}
                    </span>
                  </td>

                  {/* Performance Bar */}
                  <td className="p-4">
                    <div className="w-32 ml-auto">
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isFirst
                              ? "bg-gradient-to-r from-neon-cyan to-neon-green"
                              : "bg-gradient-to-r from-primary to-primary/50"
                          )}
                          style={{ width: `${model.accuracy * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-right mt-1">
                        {accuracyPercent}%
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="p-4 bg-muted/10 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>Best Model: <strong className="text-foreground">{data.best_model}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>
              Avg Accuracy:{" "}
              <strong className="text-foreground">
                {(
                  (models.reduce((sum, m) => sum + m.accuracy, 0) / models.length) *
                  100
                ).toFixed(2)}
                %
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
