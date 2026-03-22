import { useRefreshStatus } from "@/hooks/useRefreshStatus";
import { cn } from "@/lib/utils";

export function DataFreshnessBadge({ collapsed }: { collapsed: boolean }) {
  const { data, isError } = useRefreshStatus();

  if (isError || !data?.data_through) return null;

  const dataThrough = new Date(data.data_through);
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - dataThrough.getTime()) / (1000 * 60 * 60 * 24)
  );

  const label = `Data through ${dataThrough.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;

  const colorClass =
    diffDays <= 1
      ? "text-green-500"
      : diffDays <= 5
      ? "text-yellow-500"
      : "text-red-500";

  if (collapsed) {
    return (
      <div
        className={cn("w-2 h-2 rounded-full mx-auto", {
          "bg-green-500": diffDays <= 1,
          "bg-yellow-500": diffDays > 1 && diffDays <= 5,
          "bg-red-500": diffDays > 5,
        })}
        title={label}
      />
    );
  }

  return (
    <div className={cn("text-xs px-1", colorClass)} title={label}>
      {diffDays > 5 ? "Data may be stale" : label}
    </div>
  );
}
