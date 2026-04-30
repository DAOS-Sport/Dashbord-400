import type {
  AnnouncementCandidate,
  AnnouncementCandidateDetail,
  AnnouncementCandidatesResponse,
  AnnouncementFilters,
  AnnouncementSummaryResponse,
} from "@/types/announcement";
import type { SystemAnnouncementDTO } from "@/types/portal";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/client";

const buildQueryString = (filters: AnnouncementFilters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const fetchAnnouncementSummary = () =>
  apiGet<AnnouncementSummaryResponse>("/api/announcement-dashboard/summary");

export const fetchAnnouncementCandidates = (filters: AnnouncementFilters) =>
  apiGet<AnnouncementCandidatesResponse>(`/api/announcement-candidates${buildQueryString(filters)}`);

export const fetchAnnouncementCandidate = (id: number | string) =>
  apiGet<AnnouncementCandidateDetail>(`/api/announcement-candidates/${id}`);

export const approveAnnouncementCandidate = (candidate: AnnouncementCandidate, reviewedBy: string) =>
  apiPost(`/api/announcement-candidates/${candidate.id}/approve`, {
    reviewedBy,
    comment: "由主管工作台核准",
  });

export const rejectAnnouncementCandidate = (candidate: AnnouncementCandidate, reviewedBy: string, reason: string) =>
  apiPost(`/api/announcement-candidates/${candidate.id}/reject`, {
    reviewedBy,
    reason,
  });

export type SupervisorAnnouncementInput = {
  id?: number;
  facilityKey: string;
  title: string;
  content: string;
  announcementType: SystemAnnouncementDTO["announcementType"];
  severity: SystemAnnouncementDTO["severity"];
  isPinned: boolean;
  isActive: boolean;
  publishedAt?: string;
  expiresAt?: string | null;
};

export const fetchSupervisorSystemAnnouncements = (facilityKey: string) =>
  apiGet<{ items: SystemAnnouncementDTO[] }>(`/api/portal/system-announcements?facilityKey=${encodeURIComponent(facilityKey)}&includeInactive=true`);

export const upsertSupervisorSystemAnnouncement = (input: SupervisorAnnouncementInput) => {
  const { id, ...body } = input;
  return id
    ? apiPatch<SystemAnnouncementDTO>(`/api/portal/system-announcements/${id}`, body)
    : apiPost<SystemAnnouncementDTO>("/api/portal/system-announcements", body);
};

export const deleteSupervisorSystemAnnouncement = (id: number) =>
  apiDelete<{ ok: true }>(`/api/portal/system-announcements/${id}`);
