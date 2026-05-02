import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type {
  WorkLogTodayResponse,
  WorkLogShift,
  WorkLogTaskSource,
} from "@/types/portal";

export function useTodayWorkLog(facilityKey: string, shiftType: WorkLogShift, workDate?: string) {
  const params = new URLSearchParams({ facilityKey, shiftType });
  if (workDate) params.set("workDate", workDate);
  return useQuery<WorkLogTodayResponse>({
    queryKey: ["/api/work-logs/today", { facilityKey, shiftType, workDate: workDate ?? null }],
    queryFn: async () => {
      const r = await fetch(`/api/work-logs/today?${params.toString()}`);
      if (!r.ok) throw new Error("查詢今日工作失敗");
      return r.json();
    },
    enabled: !!facilityKey && !!shiftType,
  });
}

export interface CompleteTaskPayload {
  facilityKey: string;
  workDate: string;
  shiftType: WorkLogShift;
  taskSource: WorkLogTaskSource;
  taskRefId: number;
  taskName: string;
  isCompleted: boolean;
  inputValue?: Record<string, unknown>;
  notes?: string;
}

export function useCompleteTask(facilityKey: string, shiftType: WorkLogShift, workDate?: string) {
  return useMutation({
    mutationFn: async (payload: CompleteTaskPayload) => {
      const res = await apiRequest("POST", "/api/work-logs/tasks/complete", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/today", { facilityKey, shiftType, workDate: workDate ?? null }] });
    },
  });
}

export interface CreateHandoverPayload {
  facilityKey: string;
  workDate: string;
  fromShift: WorkLogShift;
  toShift: WorkLogShift;
  category?: "facility" | "customer" | "safety" | "general";
  content: string;
}

export function useCreateLifeguardHandover(facilityKey: string, shiftType: WorkLogShift, workDate?: string) {
  return useMutation({
    mutationFn: async (payload: CreateHandoverPayload) => {
      const res = await apiRequest("POST", "/api/work-logs/handover", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/today", { facilityKey, shiftType, workDate: workDate ?? null }] });
    },
  });
}

export function useConfirmHandover(facilityKey: string, shiftType: WorkLogShift, workDate?: string) {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/work-logs/handover/${id}/confirm`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/today", { facilityKey, shiftType, workDate: workDate ?? null }] });
    },
  });
}

export interface SaveWaterQualityPayload {
  facilityKey: string;
  workDate: string;
  shiftType: WorkLogShift;
  scheduleId?: number;
  poolName: string;
  scheduledTime?: string;
  measurements: Record<string, string | number>;
  abnormalNote?: string;
  isAbnormal?: boolean;
  photoUrls?: string[];
}

export function useSaveWaterQuality(facilityKey: string, shiftType: WorkLogShift, workDate?: string) {
  return useMutation({
    mutationFn: async (payload: SaveWaterQualityPayload) => {
      const res = await apiRequest("POST", "/api/work-logs/water-quality", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/today", { facilityKey, shiftType, workDate: workDate ?? null }] });
    },
  });
}

export interface SubmitPayload {
  facilityKey: string;
  workDate: string;
  shiftType: WorkLogShift;
}

export function useSubmitDailyReport(facilityKey: string, shiftType: WorkLogShift, workDate?: string) {
  return useMutation({
    mutationFn: async (payload: SubmitPayload) => {
      const res = await apiRequest("POST", "/api/work-logs/submit", payload);
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data?.message ?? "送出失敗") as Error & { missing?: Array<{ source: string; taskName: string }> };
        err.missing = data?.missing;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/today", { facilityKey, shiftType, workDate: workDate ?? null }] });
    },
  });
}
