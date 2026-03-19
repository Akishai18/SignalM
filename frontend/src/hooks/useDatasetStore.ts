/**
 * Persistent localStorage store for user-uploaded datasets.
 * On mount, validates stored datasets against the server.
 */
import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

const STORAGE_KEY = "signalm_datasets";

export interface StoredDataset {
  session_id: string;
  dataset_name: string;
  original_filename?: string;
  created_at: string;
  status: "pending" | "running" | "complete" | "error" | "expired";
  progress_pct?: number;
  tickers?: string[];
  date_range?: { start: string; end: string };
}

function readStorage(): StoredDataset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStorage(datasets: StoredDataset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(datasets));
}

export function useDatasetStore() {
  const [datasets, setDatasets] = useState<StoredDataset[]>(readStorage);

  // On mount: validate datasets against the server
  useEffect(() => {
    const stored = readStorage();
    if (stored.length === 0) return;
    const ids = stored.map((d) => d.session_id).join(",");
    api.customData
      .listDatasets(ids)
      .then((serverList: any[]) => {
        const updated = stored.map((d) => {
          const serverEntry = serverList.find((s) => s.session_id === d.session_id);
          if (!serverEntry || serverEntry.exists === false) {
            return { ...d, status: "expired" as const };
          }
          return {
            ...d,
            status: (serverEntry.status as StoredDataset["status"]) ?? d.status,
            tickers: serverEntry.tickers ?? d.tickers,
            date_range: serverEntry.date_range ?? d.date_range,
          };
        });
        writeStorage(updated);
        setDatasets(updated);
      })
      .catch(() => {
        // Server unreachable — mark all as expired
        const updated = stored.map((d) => ({ ...d, status: "expired" as const }));
        writeStorage(updated);
        setDatasets(updated);
      });
  }, []);

  const addDataset = useCallback((meta: StoredDataset) => {
    setDatasets((prev) => {
      const next = [meta, ...prev];
      writeStorage(next);
      return next;
    });
  }, []);

  const removeDataset = useCallback(async (session_id: string) => {
    try {
      await api.customData.deleteDataset(session_id);
    } catch {
      // If server already deleted it, ignore
    }
    setDatasets((prev) => {
      const next = prev.filter((d) => d.session_id !== session_id);
      writeStorage(next);
      return next;
    });
  }, []);

  const updateDataset = useCallback(
    (session_id: string, updates: Partial<StoredDataset>) => {
      setDatasets((prev) => {
        const next = prev.map((d) =>
          d.session_id === session_id ? { ...d, ...updates } : d
        );
        writeStorage(next);
        return next;
      });
    },
    []
  );

  return { datasets, addDataset, removeDataset, updateDataset };
}
