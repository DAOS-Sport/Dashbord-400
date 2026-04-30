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
  linkedActionUrl?: string | null;
}) => apiPost<OperationalHandoverDTO>("/api/portal/operational-handovers", input);

export const updateSupervisorHandover = (id: number, input: Partial<OperationalHandoverDTO>) =>
  apiPatch<OperationalHandoverDTO>(`/api/portal/operational-handovers/${id}`, input);
