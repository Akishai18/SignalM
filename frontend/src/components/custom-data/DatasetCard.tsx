import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, AlertCircle, WifiOff, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoredDataset } from "@/hooks/useDatasetStore";

interface Props {
  dataset: StoredDataset;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG = {
  complete: {
    icon: CheckCircle2,
    label: "Complete",
    className: "text-green-400 bg-green-400/10",
  },
  running: {
    icon: Loader2,
    label: "Analyzing…",
    className: "text-amber-400 bg-amber-400/10",
    spin: true,
  },
  pending: {
    icon: Clock,
    label: "Queued",
    className: "text-amber-400 bg-amber-400/10",
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    className: "text-red-400 bg-red-400/10",
  },
  expired: {
    icon: WifiOff,
    label: "Expired",
    className: "text-muted-foreground bg-muted",
  },
};

export function DatasetCard({ dataset, onDelete }: Props) {
  const navigate = useNavigate();
  const cfg = STATUS_CONFIG[dataset.status] ?? STATUS_CONFIG.expired;
  const Icon = cfg.icon;
  const isComplete = dataset.status === "complete";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="font-semibold text-sm truncate">{dataset.dataset_name}</p>
          <p className="text-xs text-muted-foreground truncate">{dataset.original_filename}</p>
        </div>
        <button
          onClick={() => onDelete(dataset.session_id)}
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="Delete dataset"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Status badge */}
      <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cfg.className)}>
        <Icon className={cn("h-3.5 w-3.5", (cfg as any).spin && "animate-spin")} />
        {cfg.label}
      </div>

      {/* Meta */}
      {dataset.tickers && dataset.tickers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {dataset.tickers.length} ticker{dataset.tickers.length !== 1 ? "s" : ""}
          {dataset.date_range && (
            <> · {dataset.date_range.start} → {dataset.date_range.end}</>
          )}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {new Date(dataset.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </p>

      {isComplete && (
        <Button
          variant="neon"
          size="sm"
          className="w-full gap-2"
          onClick={() => navigate(`/upload/${dataset.session_id}`)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View Dashboard
        </Button>
      )}

      {dataset.status === "expired" && (
        <p className="text-xs text-muted-foreground italic">
          Server data lost (restart). Re-upload to analyze again.
        </p>
      )}
    </div>
  );
}
