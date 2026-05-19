import type { EmployeeHomeDto, HandoverItemDto, HandoverListDto, HandoverSummaryDto, ShiftBoardDto } from "@shared/domain/workbench";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/client";
import type { HandoverEntryDTO, QuickLinkDTO } from "@/types/portal";

export interface EmployeeSearchResultDTO {
  id: string;
  type: "announcement" | "handover" | "task" | "shift" | "shortcut" | "document" | "campaign" | "training" | "qna";
  title: string;
  summary: string;
  href: string;
}

export interface EmployeeResourceDTO {
  id: number;
  facilityKey: string;
  category: "event" | "document" | "announcement" | "training";
  subCategory: string | null;
  title: string;
  content: string | null;
  url: string | null;
  imageUrl: string | null;
  eventCategory: string | null;
  eventStartAt: string | null;
  eventEndAt: string | null;
  isPinned: boolean;
  sortOrder: number;
  scheduledAt: string | null;
  createdByEmployeeNumber: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseQnaDTO {
  id: number;
  facilityKey: string;
  question: string;
  answer: string | null;
  category: string | null;
  tags: string[];
  attachments: Array<{
    id: string;
    kind: "image" | "video";
    url: string;
    key: string;
    mime: string;
    originalName: string;
    size: number;
  }>;
  status: "draft" | "published" | "archived";
  reviewStatus: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  isPinned: boolean;
  createdByEmployeeNumber: string | null;
  createdByName: string | null;
  createdByRole: "employee" | "supervisor" | "system" | null;
  updatedBy: string | null;
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

export const fetchEmployeeHome = () => apiGet<EmployeeHomeDto>("/api/bff/employee/home");

export interface EmployeeCourtReservationPreview {
  id?: string | number;
  date: string;
  court: number;
  startTime: string;
  endTime: string;
  customerName?: string | null;
  serviceName?: string | null;
  status?: string | null;
}

export const fetchEmployeeCourtsToday = (school = "xinbei", date: string) =>
  apiGet<EmployeeCourtReservationPreview[]>(`/api/courts/${school}/reservations/${date}`);

export const fetchEmployeeHandoverSummary = () =>
  apiGet<HandoverSummaryDto>("/api/bff/employee/handover/summary");

export const fetchEmployeeHandoverList = (facilityKey?: string) => {
  const params = new URLSearchParams();
  if (facilityKey) params.set("facilityKey", facilityKey);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiGet<HandoverListDto>(`/api/bff/employee/handover/list${suffix}`);
};

export const createEmployeeFrontDeskHandover = (input: {
  facilityKey: string;
  title: string;
  content: string;
  dueDate: string;
  priority?: "low" | "normal" | "high";
  linkedActionType?: string | null;
  linkedActionUrl?: string | null;
}) => apiPost<HandoverItemDto>("/api/handover", input);

export const completeEmployeeFrontDeskHandover = (id: string) =>
  apiPatch<HandoverItemDto>(`/api/handover/${encodeURIComponent(id)}/complete`, {});

export const readEmployeeFrontDeskHandover = (id: string) =>
  apiPatch<HandoverItemDto>(`/api/handover/${encodeURIComponent(id)}/read`, {});

export const replyEmployeeFrontDeskHandover = (id: string, reportNote: string) =>
  apiPatch<HandoverItemDto>(`/api/handover/${encodeURIComponent(id)}/reply`, { reportNote });

export const deleteEmployeeFrontDeskHandover = (id: string) =>
  apiDelete<{ ok: boolean }>(`/api/handover/${encodeURIComponent(id)}`);

export const fetchEmployeeShiftBoard = (facilityKey?: string) => {
  const params = new URLSearchParams();
  if (facilityKey) params.set("facilityKey", facilityKey);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiGet<ShiftBoardDto>(`/api/bff/employee/shifts/today${suffix}`);
};

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
  category: "event" | "document" | "announcement" | "training";
  subCategory?: string | null;
  title: string;
  content?: string;
  url?: string;
  imageUrl?: string | null;
  eventCategory?: string | null;
  eventStartAt?: string | null;
  eventEndAt?: string | null;
  isPinned?: boolean;
  sortOrder?: number;
  scheduledAt?: string | null;
}) => apiPost<EmployeeResourceDTO>("/api/portal/employee-resources", input);

export const fetchEmployeeResources = (facilityKey: string, category?: EmployeeResourceDTO["category"], limit = 100) => {
  const params = new URLSearchParams({ facilityKey, limit: String(limit) });
  if (category) params.set("category", category);
  return apiGet<{ items: EmployeeResourceDTO[] }>(`/api/portal/employee-resources?${params.toString()}`);
};

export const updateEmployeeResource = (id: number, input: Partial<{
  title: string;
  subCategory: string | null;
  content: string | null;
  url: string | null;
  imageUrl: string | null;
  eventCategory: string | null;
  eventStartAt: string | null;
  eventEndAt: string | null;
  isPinned: boolean;
  sortOrder: number;
  scheduledAt: string | null;
}>) => apiPatch<EmployeeResourceDTO>(`/api/portal/employee-resources/${id}`, input);

export const deleteEmployeeResource = (id: number) => apiDelete<{ ok: boolean }>(`/api/portal/employee-resources/${id}`);

export const fetchKnowledgeBaseQna = (facilityKey: string, query?: string, limit = 100) => {
  const params = new URLSearchParams({ facilityKey, limit: String(limit) });
  if (query?.trim()) params.set("q", query.trim());
  return apiGet<{ items: KnowledgeBaseQnaDTO[] }>(`/api/portal/knowledge-base-qna?${params.toString()}`);
};

export const createKnowledgeBaseQna = (input: {
  facilityKey: string;
  question: string;
  answer?: string | null;
  category?: string | null;
  tags?: string[];
  attachments?: KnowledgeBaseQnaDTO["attachments"];
  isPinned?: boolean;
  reviewStatus?: "pending" | "approved" | "rejected";
  reviewNote?: string | null;
}) => apiPost<KnowledgeBaseQnaDTO>("/api/portal/knowledge-base-qna", input);

export const updateKnowledgeBaseQna = (id: number, input: Partial<{
  question: string;
  answer: string | null;
  category: string | null;
  tags: string[];
  attachments: KnowledgeBaseQnaDTO["attachments"];
  isPinned: boolean;
  status: "draft" | "published" | "archived";
  reviewStatus: "pending" | "approved" | "rejected";
  reviewNote: string | null;
}>) => apiPatch<KnowledgeBaseQnaDTO>(`/api/portal/knowledge-base-qna/${id}`, input);

export const uploadKnowledgeBaseQnaMedia = async (facilityKey: string, file: File) => {
  const formData = new FormData();
  formData.append("facilityKey", facilityKey);
  formData.append("file", file);
  const response = await fetch("/api/portal/knowledge-base-qna/media", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "附件上傳失敗" }));
    throw new Error(error.message || "附件上傳失敗");
  }
  return response.json() as Promise<KnowledgeBaseQnaDTO["attachments"][number]>;
};

export const fetchSupervisorQnaReview = (facilityKey?: string, limit = 200) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (facilityKey) params.set("facilityKey", facilityKey);
  return apiGet<{ items: KnowledgeBaseQnaDTO[] }>(`/api/bff/supervisor/qna-review?${params.toString()}`);
};

export const approveKnowledgeBaseQna = (id: number, reviewNote?: string | null) =>
  apiPost<KnowledgeBaseQnaDTO>(`/api/bff/supervisor/qna-review/${id}/approve`, { reviewNote });

export const rejectKnowledgeBaseQna = (id: number, reviewNote?: string | null) =>
  apiPost<KnowledgeBaseQnaDTO>(`/api/bff/supervisor/qna-review/${id}/reject`, { reviewNote });

export const deleteKnowledgeBaseQna = (id: number) => apiDelete<{ ok: boolean }>(`/api/portal/knowledge-base-qna/${id}`);

export const fetchEmployeeQuickLinks = (facilityKey: string) =>
  apiGet<{ items: QuickLinkDTO[] }>(`/api/portal/quick-links?facilityKey=${encodeURIComponent(facilityKey)}`);

export const fetchEmployeeOperationalHandovers = (facilityKey: string) =>
  apiGet<{ items: OperationalHandoverDTO[] }>(`/api/portal/operational-handovers?facilityKey=${encodeURIComponent(facilityKey)}&limit=100`);

export const reportEmployeeOperationalHandover = (id: number, input: { status: "claimed" | "in_progress" | "reported" | "done"; reportNote?: string }) =>
  apiPatch<OperationalHandoverDTO>(`/api/portal/operational-handovers/${id}/report`, input);

export const acknowledgeEmployeeAnnouncement = (id: string, facilityKey: string) =>
  apiPost<{ id: number; announcementId: string; facilityKey: string; userId: string; employeeName: string; acknowledgedAt: string }>(
    `/api/announcements/${encodeURIComponent(id)}/ack`,
    { facilityKey },
  );

export interface AnnouncementOverlayDTO {
  announcementId: string;
  isHidden: boolean;
  pinnedUntil: string | null;
  note: string | null;
  lastModifiedBy: string;
  lastModifiedByName: string | null;
  lastModifiedRole: "employee" | "supervisor" | "system";
  createdAt: string;
  updatedAt: string;
}

export const hideAnnouncementOverlay = (id: string) =>
  apiPost<AnnouncementOverlayDTO>(`/api/announcement-overlays/${encodeURIComponent(id)}/hide`, {});

export const unhideAnnouncementOverlay = (id: string) =>
  apiPost<AnnouncementOverlayDTO>(`/api/announcement-overlays/${encodeURIComponent(id)}/unhide`, {});

export const pinAnnouncementOverlay = (id: string, until: string) =>
  apiPost<AnnouncementOverlayDTO>(`/api/announcement-overlays/${encodeURIComponent(id)}/pin`, { until });

export const unpinAnnouncementOverlay = (id: string) =>
  apiPost<AnnouncementOverlayDTO>(`/api/announcement-overlays/${encodeURIComponent(id)}/unpin`, {});

export const updateAnnouncementOverlayNote = (id: string, note: string | null) =>
  apiPost<AnnouncementOverlayDTO>(`/api/announcement-overlays/${encodeURIComponent(id)}/note`, { note });

export const listHiddenAnnouncementOverlays = () =>
  apiGet<AnnouncementOverlayDTO[]>(`/api/announcement-overlays/hidden`);
