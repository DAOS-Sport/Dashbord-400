export type LineFeature = {
  key: string;
  label: string;
  description: string;
};

export type LineWhitelistStatus = "active" | "disabled";

export type LineWhitelistEntry = {
  id: number;
  lineUserId: string;
  employeeNumber: string | null;
  displayName: string;
  phone: string | null;
  department: string | null;
  status: LineWhitelistStatus;
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

export type LineWhitelistSourceStatus = {
  source: string;
  status: string;
  lastSyncAt?: string;
  errorCode?: string;
  fallbackReason?: string;
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
  sourceStatus: LineWhitelistSourceStatus;
};

export type LineWhitelistPayload = {
  lineUserId: string;
  employeeNumber?: string | null;
  displayName: string;
  phone?: string | null;
  department?: string | null;
  status?: LineWhitelistStatus;
  featureAccess: Record<string, boolean>;
  startsAt?: string | null;
  endsAt?: string | null;
  unlimited: boolean;
  notes?: string | null;
};

export type LineWhitelistSyncStatus = {
  status: "synced" | "partial" | "waiting_for_400line_api" | "skipped";
  message: string;
  endpoints: Array<{
    endpoint: string;
    status: "synced" | "waiting_for_400line_api" | "error" | "skipped";
    message: string;
  }>;
};

export type LineWhitelistSaveResponse = LineWhitelistEntry & {
  sync?: LineWhitelistSyncStatus;
};

export type LineBotServiceItem = {
  name?: string;
  service?: string;
  status:
    | "up"
    | "down"
    | "degraded"
    | "unknown"
    | "healthy"
    | "unhealthy"
    | "critical"
    | string;
  latencyMs?: number;
  message?: string;
  note?: string;
  checkedAt?: string;
};

export type LineBotServiceStatusDto = {
  generatedAt?: string;
  checkedAt?: string;
  services?: LineBotServiceItem[];
  [key: string]: unknown;
};

export type LineBotServiceSnapshot = {
  id: string | number;
  createdAt?: string;
  snappedAt?: string;
  checkedAt?: string;
  servicesJson?: LineBotServiceItem[];
  services?: LineBotServiceItem[];
  [key: string]: unknown;
};

export type VipWhitelistEntry = {
  id: string | number;
  userId: string;
  displayName: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type InterviewUserEntry = {
  userId: string;
  lineUserId?: string | null;
  userName?: string | null;
  displayName: string;
  employeeNumber?: string | null;
  phone?: string | null;
  department?: string | null;
  status?: string | null;
  isActive?: boolean | string;
  canInterviewCheck?: boolean | string;
  canCautionQuery?: boolean | string;
  canInternalQuery?: boolean | string;
  canUseAiAgent?: boolean | string;
  createdAt?: string;
  [key: string]: unknown;
};

export type CautionPermissionStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "disabled"
  | "not_yet_effective";

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

export type ImportInterviewResult = {
  total: number;
  matched: number;
  unmatched: number;
  created: number;
  updated: number;
  errors: number;
  results: Array<{
    lineUserId: string;
    userName: string;
    ragicMatch: boolean;
    employeeNumber?: string;
    department?: string;
    phone?: string;
    action: "created" | "updated" | "error";
    error?: string;
  }>;
};
