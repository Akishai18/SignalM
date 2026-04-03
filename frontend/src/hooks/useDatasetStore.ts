/**
 * Persistent store for user-uploaded datasets.
 * Source of truth is the server (Supabase Storage).
 * localStorage is used as a cache and to track in-progress uploads
 * that haven't been written to storage yet.
 */
import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

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

function storageKey(userId: string) {
  return `signalm_datasets_${userId}`;
}

function readStorage(userId: string): StoredDataset[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStorage(userId: string, datasets: StoredDataset[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(datasets));
}

export function useDatasetStore(userId: string) {
  const [datasets, setDatasets] = useState<StoredDataset[]>(() => readStorage(userId));

  // On mount: fetch all user datasets from the server (source of truth).
  // Merge with localStorage to preserve any in-progress uploads not yet in storage.
  useEffect(() => {
    api.customData
      .listDatasets()
      .then((serverList: any[]) => {
        const serverDatasets: StoredDataset[] = serverList
          .filter((s) => s.exists !== false)
          .map((s) => ({
            session_id: s.session_id,
            dataset_name: s.dataset_name,
            original_filename: s.original_filename,
            created_at: s.created_at,
            status: (s.status as StoredDataset["status"]) ?? "complete",
            progress_pct: s.progress_pct,
            tickers: s.tickers,
            date_range: s.date_range,
          }));

        const serverIds = new Set(serverDatasets.map((d) => d.session_id));

        // Keep local-only entries that are still in-progress (not yet flushed to storage)
        const localOnly = readStorage(userId).filter(
          (d) => !serverIds.has(d.session_id) && (d.status === "pending" || d.status === "running")
        );

        const merged = [...serverDatasets, ...localOnly].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        writeStorage(userId, merged);
        setDatasets(merged);
      })
      .catch(() => {
        // Server unreachable — fall back to localStorage cache, mark all as expired
        const cached = readStorage(userId);
        if (cached.length === 0) return;
        const updated = cached.map((d) => ({ ...d, status: "expired" as const }));
        writeStorage(userId, updated);
        setDatasets(updated);
      });
  }, [userId]);

  const addDataset = useCallback((meta: StoredDataset) => {
    setDatasets((prev) => {
      const next = [meta, ...prev];
      writeStorage(userId, next);
      return next;
    });
  }, [userId]);

  const removeDataset = useCallback(async (session_id: string) => {
    try {
      await api.customData.deleteDataset(session_id);
    } catch {
      // If server already deleted it, ignore
    }
    setDatasets((prev) => {
      const next = prev.filter((d) => d.session_id !== session_id);
      writeStorage(userId, next);
      return next;
    });
  }, [userId]);

  const updateDataset = useCallback(
    (session_id: string, updates: Partial<StoredDataset>) => {
      setDatasets((prev) => {
        const next = prev.map((d) =>
          d.session_id === session_id ? { ...d, ...updates } : d
        );
        writeStorage(userId, next);
        return next;
      });
    },
    [userId]
  );

  return { datasets, addDataset, removeDataset, updateDataset };
}
