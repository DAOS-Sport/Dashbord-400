import type { EmployeeHomeDto } from "@shared/domain/workbench";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/client";
import type { HandoverEntryDTO, QuickLinkDTO } from "@/types/portal";

export interface EmployeeSearchResultDTO {
  id: string;
  type: "announcement" | "handover" | "task" | "shift" | "shortcut" | "document" | "campaign";
  title: string;
  summary: string;
  href: string;
}

export interface EmployeeResourceDTO {
  id: number;
  facilityKey: string;
  category: "event" | "document" | "sticky_note";
  title: string;
  content: string | null;
  url: string | null;
  isPinned: boolean;
  createdByEmployeeNumber: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalHandoverDTO {
  id: number;
  facilityKey: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high";
  status: "pending" | "claimed" | "in_progress" | "reported" | "done" | "cancelled";
  targetDate: string;
  targetShiftLabel: string;
  visibleFrom: string | null;
  dueAt: string | null;
  assigneeEmployeeNumber: string | null;
  assigneeName: string | null;
  claimedByEmployeeNumber: string | null;
  claimedByName: string | null;
  createdByEmployeeNumber: string | null;
  createdByName: string | null;
  reportedByEmployeeNumber: string | null;
  reportedByName: string | null;
  reportNote: string | null;
  linkedActionType: string | null;
  linkedActionUrl: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeTaskDTO {
  id: number;
  facilityKey: string;
  title: string;
  content: string | null;
  priority: "low" | "normal" | "high";
  status: "pending" | "in_progress" | "done" | "cancelled";
  source: "employee" | "supervisor" | "system";
  createdByUserId: string;
  createdByName: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const fetchEmployeeHome = () => apiGet<EmployeeHomeDto>("/api/bff/employee/home");

export const searchEmployeeWorkbench = (query: string, facilityKey?: string) => {
  const params = new URLSearchParams({ q: query });
  if (facilityKey) params.set("facilityKey", facilityKey);
  return apiGet<{ query: string; items: EmployeeSearchResultDTO[] }>(`/api/bff/employee/search?${params.toString()}`);
};

export const fetchEmployeeHandovers = (facilityKey: string) =>
  apiGet<{ items: HandoverEntryDTO[] }>(`/api/portal/handovers?facilityKey=${encodeURIComponent(facilityKey)}&limit=50`);

export const createEmployeeHandover = (facilityKey: string, content: string) =>
  apiPost<HandoverEntryDTO>("/api/portal/handovers", { facilityKey, content, shiftLabel: "員工工作台" });

export const createEmployeeResource = (input: {
  facilityKey: string;
  category: "event" | "document" | "sticky_note";
  title: string;
  content?: string;
  url?: string;
  isPinned?: boolean;
}) => apiPost<EmployeeResourceDTO>("/api/portal/employee-resources", input);

export const updateEmployeeResource = (id: number, input: Partial<{
  title: string;
  content: string | null;
  url: string | null;
  isPinned: boolean;
}>) => apiPatch<EmployeeResourceDTO>(`/api/portal/employee-resources/${id}`, input);

export const deleteEmployeeResource = (id: number) => apiDelete<{ ok: boolean }>(`/api/portal/employee-resources/${id}`);

export const fetchEmployeeQuickLinks = (facilityKey: string) =>
  apiGet<{ items: QuickLinkDTO[] }>(`/api/portal/quick-links?facilityKey=${encodeURIComponent(facilityKey)}`);

export const fetchEmployeeOperationalHandovers = (facilityKey: string) =>
  apiGet<{ items: OperationalHandoverDTO[] }>(`/api/portal/operational-handovers?facilityKey=${encodeURIComponent(facilityKey)}&limit=100`);

export const reportEmployeeOperationalHandover = (id: number, input: { status: "claimed" | "in_progress" | "reported" | "done"; reportNote?: string }) =>
  apiPatch<OperationalHandoverDTO>(`/api/portal/operational-handovers/${id}/report`, input);

export const fetchEmployeeTasks = (facilityKey: string) =>
  apiGet<{ items: EmployeeTaskDTO[] }>(`/api/tasks?facilityKey=${encodeURIComponent(facilityKey)}&limit=100`);

export const createEmployeeTask = (input: {
  facilityKey: string;
  title: string;
  content?: string | null;
  priority: "low" | "normal" | "high";
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  dueAt?: string | null;
}) => apiPost<EmployeeTaskDTO>("/api/tasks", input);

export const updateEmployeeTask = (id: number, input: Partial<{
  title: string;
  content: string | null;
  priority: "low" | "normal" | "high";
  dueAt: string | null;
  status: "pending" | "in_progress" | "done" | "cancelled";
}>) => apiPatch<EmployeeTaskDTO>(`/api/tasks/${id}`, input);

export const updateEmployeeTaskStatus = (id: number, status: "pending" | "in_progress" | "done" | "cancelled") =>
  apiPatch<EmployeeTaskDTO>(`/api/tasks/${id}/status`, { status });

export const deleteEmployeeTask = (id: number) => apiDelete<{ ok: boolean }>(`/api/tasks/${id}`);

export const acknowledgeEmployeeAnnouncement = (id: string, facilityKey: string) =>
  apiPost<{ id: number; announcementId: string; facilityKey: string; userId: string; employeeName: string; acknowledgedAt: string }>(
    `/api/announcements/${encodeURIComponent(id)}/ack`,
    { facilityKey },
  );
