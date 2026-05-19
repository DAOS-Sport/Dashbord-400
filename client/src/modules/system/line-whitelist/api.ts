import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/client";
import type {
  CautionAuditItem,
  CautionCandidate,
  CautionCreatePayload,
  CautionPermission,
  CautionPermissionDto,
  InterviewUserEntry,
  LineBotServiceSnapshot,
  LineBotServiceStatusDto,
  LineWhitelistCandidateDto,
  LineWhitelistDto,
  LineWhitelistEntry,
  LineWhitelistPayload,
  LineWhitelistSaveResponse,
  VipWhitelistEntry,
} from "@shared/system/line-whitelist-contract";

export type {
  CautionAuditItem,
  CautionCandidate,
  CautionCreatePayload,
  CautionPermission,
  CautionPermissionDto,
  CautionPermissionStatus,
  InterviewUserEntry,
  LineBotServiceItem,
  LineBotServiceSnapshot,
  LineBotServiceStatusDto,
  LineFeature,
  LineWhitelistCandidate,
  LineWhitelistCandidateDto,
  LineWhitelistDto,
  LineWhitelistEntry,
  LineWhitelistPayload,
  LineWhitelistSaveResponse,
  LineWhitelistSourceStatus,
  LineWhitelistStatus,
  VipWhitelistEntry,
} from "@shared/system/line-whitelist-contract";

export const fetchLineWhitelist = () =>
  apiGet<LineWhitelistDto>("/api/bff/system/line-whitelist");

export const searchLineWhitelistCandidates = (query: string) =>
  apiGet<LineWhitelistCandidateDto>(`/api/bff/system/line-whitelist/candidates?q=${encodeURIComponent(query)}`);

export const createLineWhitelistEntry = (payload: LineWhitelistPayload) =>
  apiPost<LineWhitelistSaveResponse>("/api/bff/system/line-whitelist", payload);

export const updateLineWhitelistEntry = (id: number, payload: Partial<LineWhitelistPayload>) =>
  apiPatch<LineWhitelistSaveResponse>(`/api/bff/system/line-whitelist/${id}`, payload);

export const fetchLineBotServiceStatus = () =>
  apiGet<LineBotServiceStatusDto>("/api/bff/system/line-bot/service-status");

export const fetchLineBotServiceStatusSnapshots = () =>
  apiGet<{ items: LineBotServiceSnapshot[] }>("/api/bff/system/line-bot/service-status/snapshots");

export const fetchLineBotVipWhitelist = () =>
  apiGet<VipWhitelistEntry[] | { items: VipWhitelistEntry[] }>("/api/bff/system/line-bot/vip-whitelist");

export const createLineBotVipEntry = (payload: { userId: string; displayName: string }) =>
  apiPost<VipWhitelistEntry>("/api/bff/system/line-bot/vip-whitelist", payload);

export const deleteLineBotVipEntry = (id: string | number) =>
  apiDelete<{ ok: boolean }>(`/api/bff/system/line-bot/vip-whitelist/${encodeURIComponent(String(id))}`);

export const fetchLineBotInterviewUsers = () =>
  apiGet<InterviewUserEntry[] | { items: InterviewUserEntry[] }>("/api/bff/system/line-bot/interview-users");

export type LineBotInterviewUserPayload = {
  userId: string;
  lineUserId?: string;
  userName?: string;
  displayName: string;
  employeeNumber?: string | null;
  phone?: string | null;
  department?: string | null;
  canInterviewCheck?: boolean;
  canCautionQuery?: boolean;
  canInternalQuery?: boolean;
  canUseAiAgent?: boolean;
  isActive?: boolean;
};

export const createLineBotInterviewUser = (payload: LineBotInterviewUserPayload) =>
  apiPost<InterviewUserEntry>("/api/bff/system/line-bot/interview-users", payload);

export const updateLineBotInterviewUser = (userId: string, payload: Partial<LineBotInterviewUserPayload>) =>
  apiPatch<InterviewUserEntry>(`/api/bff/system/line-bot/interview-users/${encodeURIComponent(userId)}`, payload);

export const deleteLineBotInterviewUser = (userId: string) =>
  apiDelete<{ ok: boolean }>(`/api/bff/system/line-bot/interview-users/${encodeURIComponent(userId)}`);

export const fetchCautionPermissions = (params?: { status?: string; dept?: string; q?: string }) => {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.dept) search.set("dept", params.dept);
  if (params?.q) search.set("q", params.q);
  return apiGet<CautionPermissionDto>(`/api/cms/system/caution-permissions${search.toString() ? `?${search}` : ""}`);
};

export const searchCautionCandidates = (query: string) =>
  apiGet<{ items: CautionCandidate[]; sourceStatus: LineWhitelistCandidateDto["sourceStatus"] }>(
    `/api/cms/system/caution-permissions/candidates?q=${encodeURIComponent(query)}`,
  );

export const createCautionPermission = (payload: CautionCreatePayload) =>
  apiPost<CautionPermission>("/api/cms/system/caution-permissions", payload);

export const updateCautionPermissionStatus = (id: number, isActive: boolean) =>
  apiPatch<CautionPermission>(`/api/cms/system/caution-permissions/${id}/status`, { isActive });

export const updateCautionPermissionPeriod = (
  id: number,
  payload: {
    periodType: "unlimited" | "range" | "today_only";
    periodStartAt?: string | null;
    periodEndAt?: string | null;
    changeReason: string;
  },
) => apiPatch<CautionPermission>(`/api/cms/system/caution-permissions/${id}/period`, payload);

export const fetchCautionPermissionAudit = (id: number) =>
  apiGet<{ items: CautionAuditItem[] }>(`/api/cms/system/caution-permissions/${id}/audit`);
