import { apiGet, apiPatch, apiPost } from "@/shared/api/client";

export type LineFeature = {
  key: string;
  label: string;
  description: string;
};

export type LineWhitelistEntry = {
  id: number;
  lineUserId: string;
  employeeNumber: string | null;
  displayName: string;
  phone: string | null;
  department: string | null;
  status: "active" | "disabled";
  featureAccess: Record<string, boolean>;
  startsAt: string | null;
  endsAt: string | null;
  unlimited: boolean;
  notes: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type LineWhitelistCandidate = {
  lineUserId: string;
  employeeNumber: string;
  displayName: string;
  phone: string;
  department: string;
  title: string;
  source: string;
};

export type LineWhitelistDto = {
  generatedAt: string;
  storageStatus: "ready" | "schema_pending";
  error: string | null;
  features: LineFeature[];
  summary: {
    total: number;
    active: number;
    disabled: number;
    interviewEnabled: number;
  };
  items: LineWhitelistEntry[];
};

export type LineWhitelistCandidateDto = {
  items: LineWhitelistCandidate[];
  sourceStatus: {
    source: string;
    status: string;
    lastSyncAt?: string;
    errorCode?: string;
    fallbackReason?: string;
  };
};

export type LineWhitelistPayload = {
  lineUserId: string;
  employeeNumber?: string | null;
  displayName: string;
  phone?: string | null;
  department?: string | null;
  status?: "active" | "disabled";
  featureAccess: Record<string, boolean>;
  startsAt?: string | null;
  endsAt?: string | null;
  unlimited: boolean;
  notes?: string | null;
};

export const fetchLineWhitelist = () =>
  apiGet<LineWhitelistDto>("/api/bff/system/line-whitelist");

export const searchLineWhitelistCandidates = (query: string) =>
  apiGet<LineWhitelistCandidateDto>(`/api/bff/system/line-whitelist/candidates?q=${encodeURIComponent(query)}`);

export const createLineWhitelistEntry = (payload: LineWhitelistPayload) =>
  apiPost<LineWhitelistEntry>("/api/bff/system/line-whitelist", payload);

export const updateLineWhitelistEntry = (id: number, payload: Partial<LineWhitelistPayload>) =>
  apiPatch<LineWhitelistEntry>(`/api/bff/system/line-whitelist/${id}`, payload);

export type CautionPermissionStatus = "active" | "expiring_soon" | "expired" | "disabled" | "not_yet_effective";

export type CautionPermission = {
  id: number;
  userId: string;
  displayName: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  isActive: boolean;
  status: CautionPermissionStatus;
  permissionStartAt: string | null;
  permissionEndAt: string | null;
  grantedBy: string;
  grantedAt: string;
  note: string | null;
  updatedAt: string;
};

export type CautionPermissionDto = {
  generatedAt: string;
  storageStatus: "ready" | "schema_pending";
  error?: string;
  departments: string[];
  summary: {
    total: number;
    active: number;
    disabled: number;
    expired: number;
    expiringSoon: number;
  };
  items: CautionPermission[];
};

export type CautionCandidate = {
  userId: string;
  employeeNumber: string;
  displayName: string;
  phone: string;
  department: string;
  position: string;
  enabled: boolean;
  source: string;
};

export type CautionAuditItem = {
  id: number;
  permissionId: number;
  action: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  actor: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type CautionCreatePayload = {
  userId: string;
  displayName: string;
  phone?: string | null;
  department?: string | null;
  position?: string | null;
  periodType: "unlimited" | "range" | "today_only";
  periodStartAt?: string | null;
  periodEndAt?: string | null;
  note?: string | null;
};

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
