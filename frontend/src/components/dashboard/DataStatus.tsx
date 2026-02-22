import { Database, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

interface DataSource {
  name: string;
  status: "connected" | "syncing" | "error";
  lastUpdate: string;
  records: number;
}

const dataSources: DataSource[] = [
  { name: "S&P 500 Prices", status: "connected", lastUpdate: "2 min ago", records: 15847 },
  { name: "VIX Index", status: "connected", lastUpdate: "5 min ago", records: 8234 },
  { name: "Sector ETFs", status: "syncing", lastUpdate: "Syncing...", records: 42156 },
  { name: "Treasury Yields", status: "connected", lastUpdate: "10 min ago", records: 3521 },
];

const statusConfig = {
  connected: {
    icon: CheckCircle2,
    color: "text-neon-green",
    bg: "bg-neon-green/10",
  },
  syncing: {
    icon: RefreshCw,
    color: "text-neon-cyan",
    bg: "bg-neon-cyan/10",
  },
  error: {
    icon: AlertTriangle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
};

export function DataStatus() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Data Sources</h3>
            <p className="text-sm text-muted-foreground">Real-time connection status</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {dataSources.map((source) => {
          const config = statusConfig[source.status];
          const StatusIcon = config.icon;
          
          return (
            <div
              key={source.name}
              className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
            >
              <div className="flex items-center gap-3">
                <div className={cn("rounded-full p-1.5", config.bg)}>
                  <StatusIcon
                    className={cn(
                      "h-4 w-4",
                      config.color,
                      source.status === "syncing" && "animate-spin"
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground">{source.lastUpdate}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-medium">
                  {source.records.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">records</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
