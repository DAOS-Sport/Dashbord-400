export type LinebotManagementStatus = "ready" | "degraded" | "waiting_for_400line_api" | "error";
export type LinebotManagementSourceMode = "contract" | "legacy_fallback";
export type LinebotRawCapabilityStatus =
  | "healthy"
  | "degraded"
  | "failing"
  | "disabled"
  | "not_configured"
  | "stale"
  | "unknown";

export type LinebotApiReadiness = {
  method: "GET";
  path: string;
  label: string;
  status: LinebotManagementStatus;
  sourceMode?: LinebotManagementSourceMode;
  rawStatus?: LinebotRawCapabilityStatus | string;
  note: string;
  lastCheckedAt: string;
};

export type LinebotManagementCard = {
  label: string;
  value: string | number;
  status: LinebotManagementStatus;
  hint: string;
};

export type LinebotServiceRow = {
  key: string;
  label: string;
  status: LinebotManagementStatus;
  rawStatus?: LinebotRawCapabilityStatus | string;
  message: string;
  sourcePath: string;
  lastSyncAt: string | null;
};

export type LinebotFacilityRow = {
  id: string;
  name: string;
  groupId: string;
  status: LinebotManagementStatus;
  rawStatus?: LinebotRawCapabilityStatus | string;
  message: string;
};

export type LinebotWhitelistRow = {
  lineUserId: string;
  employeeNumber: string | null;
  displayName: string;
  phone: string | null;
  department: string | null;
  status: "active" | "disabled" | "unknown";
  featureSummary: string;
  diffStatus: "both" | "line_only" | "cms_shadow_only" | "status_mismatch";
  comparisonStatus:
    | "matched"
    | "line_only"
    | "ragic_only"
    | "cms_shadow_only"
    | "field_mismatch"
    | "needs_manual_line_id";
  ragicMatched: boolean;
  ragicMatchMode: "lineUserId" | "displayName" | "none";
  ragicSource: string | null;
  cmsShadowId: number | null;
  lineAuthorityStatus: "active" | "disabled" | "unknown";
  fieldMismatches: string[];
  syncable: boolean;
};

export type LinebotPipelineStage = {
  key: string;
  label: string;
  status: LinebotManagementStatus;
  rawStatus?: LinebotRawCapabilityStatus | string;
  description: string;
  sourcePath?: string;
};

export type LinebotWhitelistSourceBreakdown = {
  contractStatus: string;
  lineAuthorityTotal: number;
  cmsShadowTotal: number;
  ragicTotal: number;
  note: string;
};

export type LinebotManagementOverviewDto = {
  generatedAt: string;
  status: LinebotManagementStatus;
  sourceMode: LinebotManagementSourceMode;
  rawStatus?: LinebotRawCapabilityStatus | string;
  cards: LinebotManagementCard[];
  apiReadiness: LinebotApiReadiness[];
  notes: string[];
  knownIssues?: string[];
};

export type LinebotManagementServicesDto = {
  generatedAt: string;
  status: LinebotManagementStatus;
  sourceMode: LinebotManagementSourceMode;
  rawStatus?: LinebotRawCapabilityStatus | string;
  services: LinebotServiceRow[];
  apiReadiness: LinebotApiReadiness[];
  knownIssues?: string[];
};

export type LinebotManagementFacilitiesDto = {
  generatedAt: string;
  status: LinebotManagementStatus;
  sourceMode: LinebotManagementSourceMode;
  rawStatus?: LinebotRawCapabilityStatus | string;
  items: LinebotFacilityRow[];
  apiReadiness: LinebotApiReadiness[];
  contractCount?: number;
  legacyCount?: number;
  diffNote?: string;
};

export type LinebotManagementWhitelistDto = {
  generatedAt: string;
  status: LinebotManagementStatus;
  sourceMode: LinebotManagementSourceMode;
  rawStatus?: LinebotRawCapabilityStatus | string;
  authority: "400LINE";
  syncMode: "read_only_snapshot";
  summary: {
    lineAuthorityTotal: number;
    cmsShadowTotal: number;
    ragicTotal: number;
    matched: number;
    lineOnly: number;
    ragicOnly: number;
    cmsOnly: number;
    fieldMismatch: number;
    needsManualReview: number;
    syncable: number;
    mismatched: number;
  };
  items: LinebotWhitelistRow[];
  apiReadiness: LinebotApiReadiness[];
  rules: string[];
  sourceBreakdown?: LinebotWhitelistSourceBreakdown;
  knownIssues?: string[];
};

export type LinebotWhitelistSyncResult = {
  generatedAt: string;
  status: LinebotManagementStatus;
  created: number;
  updated: number;
  skipped: number;
  needsManualReview: number;
  errors: number;
  results: Array<{
    lineUserId: string;
    displayName: string;
    action: "created" | "updated" | "skipped" | "error";
    reason?: string;
  }>;
};

export type LinebotManagementPipelineDto = {
  generatedAt: string;
  status: LinebotManagementStatus;
  sourceMode: LinebotManagementSourceMode;
  rawStatus?: LinebotRawCapabilityStatus | string;
  stages: LinebotPipelineStage[];
  employeeEntryRule: {
    priority: Array<"must_read" | "high">;
    minimumConfidence: number;
    requiresFacilityOrGroupScope: boolean;
    requiresDisplayableFilter: boolean;
    sourceLabels: string[];
  };
  counters: {
    candidateCount: number | null;
    todayProcessed: number | null;
    issues: number | null;
  };
  apiReadiness: LinebotApiReadiness[];
  knownIssues?: string[];
};
