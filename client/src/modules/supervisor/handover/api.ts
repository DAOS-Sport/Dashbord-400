import { apiGet, apiPatch, apiPost } from "@/shared/api/client";
import type { OperationalHandoverDTO } from "@/modules/employee/home/api";

export type SupervisorHandoverItemDTO = OperationalHandoverDTO & { facilityName?: string };

export const fetchSupervisorHandovers = (input: { facilityKey?: string; status?: string; q?: string }) => {
  const params = new URLSearchParams();
  params.set("facilityKey", input.facilityKey || "all");
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.q?.trim()) params.set("q", input.q.trim());
  return apiGet<{
    items: SupervisorHandoverItemDTO[];
    facilities: Array<{ facilityKey: string; facilityName: string }>;
    summaryByFacility: Array<{ facilityKey: string; facilityName: string; open: number; total: number }>;
  }>(`/api/bff/supervisor/handovers?${params.toString()}`);
};

export const createSupervisorHandover = (input: {
  facilityKey: string;
  title: string;
  content: string;
  targetDate?: string;
  targetShiftLabel?: string;
  dueAt?: string | null;
  priority?: "low" | "normal" | "high";
  linkedActionType?: string | null;
  linkedActionUrl?: string | null;
}) => apiPost<OperationalHandoverDTO>("/api/portal/operational-handovers", input);

export const updateSupervisorHandover = (id: number, input: Partial<OperationalHandoverDTO>) =>
  apiPatch<OperationalHandoverDTO>(`/api/portal/operational-handovers/${id}`, input);

export const uploadSupervisorHandoverImage = async (file: File, facilityKey: string): Promise<string> => {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("facilityKey", facilityKey);
  const response = await fetch("/api/handover/image-upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.message === "string" ? payload.message : "圖片上傳失敗");
  }
  if (typeof payload.url !== "string") {
    throw new Error("圖片上傳回傳格式不正確");
  }
  return payload.url;
};
