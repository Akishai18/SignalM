import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface RefreshStatus {
  last_refresh_utc: string | null;
  data_through: string | null;
  success?: boolean;
}

async function fetchRefreshStatus(): Promise<RefreshStatus> {
  const res = await fetch(`${API_BASE_URL}/api/refresh/status`);
  if (!res.ok) throw new Error("Failed to fetch refresh status");
  return res.json();
}

export function useRefreshStatus() {
  return useQuery({
    queryKey: ["refresh-status"],
    queryFn: fetchRefreshStatus,
    staleTime: 60 * 60 * 1000,   // treat as fresh for 1 hour
    retry: false,                  // don't retry on failure — badge just won't show
  });
}
