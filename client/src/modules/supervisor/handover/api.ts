import { apiGet, apiPatch, apiPost } from "@/shared/api/client";
import type { OperationalHandoverDTO } from "@/modules/employee/home/api";

export const fetchSupervisorHandovers = (facilityKey: string) =>
  apiGet<{ items: OperationalHandoverDTO[] }>(`/api/portal/operational-handovers?facilityKey=${encodeURIComponent(facilityKey)}&limit=100`);

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
