/**
 * TanStack Query hooks for custom dataset endpoints.
 * Status polling is active while analysis is running.
 */
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

function useStatus(sessionId: string) {
  return useQuery({
    queryKey: ["custom", sessionId, "status"],
    queryFn: () => api.customData.getStatus(sessionId),
    refetchInterval: (query) => {
      const data = query.state.data as any;
      const status = data?.status;
      if (status === "complete" || status === "error") return false;
      return 2000;
    },
    enabled: !!sessionId,
  });
}

function useOverview(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ["custom", sessionId, "overview"],
    queryFn: () => api.customData.getOverview(sessionId),
    enabled: !!sessionId && enabled,
  });
}

function useHistory(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ["custom", sessionId, "history"],
    queryFn: () => api.customData.getHistory(sessionId),
    enabled: !!sessionId && enabled,
  });
}

function useTransitions(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ["custom", sessionId, "transitions"],
    queryFn: () => api.customData.getTransitions(sessionId),
    enabled: !!sessionId && enabled,
  });
}

function usePerformance(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ["custom", sessionId, "performance"],
    queryFn: () => api.customData.getPerformance(sessionId),
    enabled: !!sessionId && enabled,
  });
}

function useFeatures(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ["custom", sessionId, "features"],
    queryFn: () => api.customData.getFeatures(sessionId),
    enabled: !!sessionId && enabled,
  });
}

function usePredictions(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ["custom", sessionId, "predictions"],
    queryFn: () => api.customData.getPredictions(sessionId),
    enabled: !!sessionId && enabled,
  });
}

export const useCustomDataset = {
  useStatus,
  useOverview,
  useHistory,
  useTransitions,
  usePerformance,
  useFeatures,
  usePredictions,
};
