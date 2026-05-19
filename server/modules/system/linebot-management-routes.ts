import type { Express } from "express";
import { eq } from "drizzle-orm";
import type { AppContainer } from "../../app/container";
import { db } from "../../db";
import { env } from "../../shared/config/env";
import { requireRole, requireSession } from "../auth/context";
import { listLineWhitelist } from "./line-whitelist-service";
import { lineFeatureWhitelist } from "@shared/schema";
import { normalizeLineFeatureAccess } from "@shared/system/line-feature-whitelist";
import type {
  LinebotApiReadiness,
  LinebotFacilityRow,
  LinebotManagementFacilitiesDto,
  LinebotManagementOverviewDto,
  LinebotManagementPipelineDto,
  LinebotManagementServicesDto,
  LinebotManagementSourceMode,
  LinebotManagementStatus,
  LinebotManagementWhitelistDto,
  LinebotWhitelistSyncResult,
  LinebotRawCapabilityStatus,
  LinebotServiceRow,
  LinebotWhitelistRow,
} from "@shared/system/linebot-management-contract";

type UpstreamResult = {
  path: string;
  label: string;
  status: LinebotManagementStatus;
  sourceMode?: LinebotManagementSourceMode;
  rawStatus?: string;
  note: string;
  data: unknown;
  lastCheckedAt: string;
};

type ContractCapability = {
  key: string;
  label: string;
  domain: string;
  status: LinebotRawCapabilityStatus;
  enabled: boolean;
  configured: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  staleAfterSeconds: number;
  dependencies: string[];
  counters?: {
    todaySuccess?: number;
    todayError?: number;
  };
  sourceRoutes?: string[];
};

type ContractDomain = {
  key: string;
  label: string;
  status: LinebotRawCapabilityStatus;
  capabilities: ContractCapability[];
};

type ContractFullStatus = {
  generatedAt: string;
  overall: LinebotRawCapabilityStatus;
  summary?: Record<string, number>;
  domains: ContractDomain[];
  events?: Array<{ severity?: string; domain?: string; message?: string; occurredAt?: string }>;
};

type RagicCandidate = {
  lineUserId: string;
  employeeNumber: string | null;
  displayName: string;
  phone: string | null;
  department: string | null;
  source: string;
};

type LineAuthorityUser = {
  lineUserId: string;
  employeeNumber: string | null;
  displayName: string;
  phone: string | null;
  department: string | null;
  status: "active" | "disabled" | "unknown";
  featureAccess: Record<string, boolean>;
  featureSummary: string | null;
};

const nowIso = () => new Date().toISOString();

const jsonRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const firstArray = (...values: unknown[]) => {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

const asText = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value : fallback;

const asNullableText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

const asNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const mapContractStatus = (status: unknown): LinebotManagementStatus => {
  const normalized = String(status ?? "unknown").toLowerCase();
  if (normalized === "healthy") return "ready";
  if (normalized === "failing") return "error";
  if (normalized === "not_configured" || normalized === "disabled") return "waiting_for_400line_api";
  if (["degraded", "stale", "unknown"].includes(normalized)) return "degraded";
  return "error";
};

const isContractFullStatus = (value: unknown): value is ContractFullStatus => {
  const record = jsonRecord(value);
  return typeof record.generatedAt === "string" &&
    typeof record.overall === "string" &&
    Array.isArray(record.domains);
};

const contractCapabilities = (contract: ContractFullStatus, domainKey?: string) =>
  contract.domains
    .filter((domain) => !domainKey || domain.key === domainKey)
    .flatMap((domain) => domain.capabilities.map((capability) => ({ ...capability, domainLabel: domain.label })));

const capabilityMessage = (capability: ContractCapability) => {
  if (capability.lastError) return capability.lastError;
  if (!capability.enabled) return "Capability is disabled in 400LINE monitoring contract.";
  if (!capability.configured) return "Capability is not configured in 400LINE.";
  const ok = capability.counters?.todaySuccess ?? 0;
  const errors = capability.counters?.todayError ?? 0;
  return `status=${capability.status}; todaySuccess=${ok}; todayError=${errors}`;
};

const buildKnownIssues = (contract: ContractFullStatus, domainKey?: string): string[] => {
  const domains = domainKey
    ? contract.domains.filter((domain) => domain.key === domainKey)
    : contract.domains;
  const issues: string[] = [];
  for (const domain of domains) {
    for (const cap of domain.capabilities) {
      if (!cap.enabled) {
        issues.push(`【${cap.label}】功能已停用（disabled）`);
      } else if (cap.status === "failing") {
        const snippet = cap.lastError ? `，錯誤：${cap.lastError.slice(0, 80)}` : "";
        issues.push(`【${cap.label}】運作失敗（failing）${snippet}`);
      } else if (cap.status === "stale") {
        const lastOk = cap.lastSuccessAt
          ? new Date(cap.lastSuccessAt).toLocaleString("zh-TW")
          : "未知";
        issues.push(`【${cap.label}】資料過期（stale），最後成功：${lastOk}`);
      } else if (cap.status === "degraded") {
        const errCount = cap.counters?.todayError ?? 0;
        issues.push(`【${cap.label}】部分異常（degraded），今日錯誤 ${errCount} 次`);
      } else if (!cap.configured) {
        issues.push(`【${cap.label}】尚未設定（not_configured）`);
      }
    }
  }
  return issues;
};

const fetchLinebotJson = async (
  path: string,
  label: string,
  options: { token?: string | null; tokenRequired?: boolean } = {},
): Promise<UpstreamResult> => {
  const lastCheckedAt = nowIso();
  if (options.tokenRequired && !options.token) {
    return {
      path,
      label,
      status: "waiting_for_400line_api",
      note: "Token not configured in local environment.",
      data: null,
      lastCheckedAt,
    };
  }

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
      headers["X-Internal-Token"] = options.token;
      headers["X-API-Key"] = options.token;
    }
    const upstream = await fetch(`${env.lineBotBaseUrl}${path}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return {
        path,
        label,
        status: "waiting_for_400line_api",
        note: `Expected JSON but received ${contentType || "unknown content-type"} with HTTP ${upstream.status}.`,
        data: null,
        lastCheckedAt,
      };
    }
    const data = await upstream.json().catch(() => null);
    return {
      path,
      label,
      status: upstream.ok ? "ready" : "degraded",
      note: upstream.ok ? "Readable JSON endpoint." : `HTTP ${upstream.status}.`,
      data,
      lastCheckedAt,
    };
  } catch (error) {
    return {
      path,
      label,
      status: "error",
      note: error instanceof Error ? error.message : "Unable to reach 400LINE.",
      data: null,
      lastCheckedAt,
    };
  }
};

const readiness = (result: UpstreamResult): LinebotApiReadiness => ({
  method: "GET",
  path: result.path,
  label: result.label,
  status: result.status,
  sourceMode: result.sourceMode,
  rawStatus: result.rawStatus,
  note: result.note,
  lastCheckedAt: result.lastCheckedAt,
});

const waitingReadiness = (path: string, label: string, note = "Endpoint is known but waiting for 400LINE JSON/API repair."): LinebotApiReadiness => ({
  method: "GET",
  path,
  label,
  status: "waiting_for_400line_api",
  sourceMode: "legacy_fallback",
  note,
  lastCheckedAt: nowIso(),
});

const combinedStatus = (items: Array<{ status: LinebotManagementStatus }>): LinebotManagementStatus => {
  if (items.some((item) => item.status === "error")) return "degraded";
  if (items.some((item) => item.status === "ready")) {
    return items.some((item) => item.status !== "ready") ? "degraded" : "ready";
  }
  if (items.some((item) => item.status === "waiting_for_400line_api")) return "waiting_for_400line_api";
  return "error";
};

const fetchContractFullStatus = async (): Promise<UpstreamResult & { contract: ContractFullStatus | null }> => {
  const result = await fetchLinebotJson("/api/internal/monitoring/full-status", "400LINE Capability Monitoring Contract", {
    token: env.lineBotInternalToken,
    tokenRequired: true,
  });
  if (!isContractFullStatus(result.data)) {
    return {
      ...result,
      status: result.status === "waiting_for_400line_api" ? result.status : "waiting_for_400line_api",
      sourceMode: "legacy_fallback",
      note: `${result.note} Falling back to legacy 400LINE API snapshot.`,
      contract: null,
    };
  }

  const overallStatus: LinebotManagementStatus = result.data.overall === "failing" ? "degraded" : mapContractStatus(result.data.overall);
  return {
    ...result,
    status: overallStatus,
    sourceMode: "contract",
    rawStatus: result.data.overall,
    note: result.data.overall === "failing"
      ? `Capability contract readable; overall=${result.data.overall}. 400LINE 自報降級，連線通訊正常。`
      : `Capability contract readable; overall=${result.data.overall}.`,
    contract: result.data,
  };
};

const apiSnapshot = async () => {
  const [
    runtimeHealth,
    adminOverview,
    announcementHealth,
    facilityList,
    interviewUsers,
    serviceStatus,
    serviceSnapshots,
    adminWhitelist,
    internalWhitelist,
    dashboardServicesHealth,
    featureStats,
    taskStats,
    attendanceStats,
    webhookStats,
    messages,
    ragicTest,
    waterQualityReport,
  ] =
    await Promise.all([
      fetchLinebotJson("/health", "LINE Bot runtime"),
      fetchLinebotJson("/api/admin/overview", "Admin 總覽", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/admin/announcements/health", "公告管線健康", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/facility-home/list", "群組 / 館別清單"),
      fetchLinebotJson("/api/admin/interview-users", "面試 / 慎用授權名單", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/internal/service-health", "服務健康總覽", { token: env.lineBotInternalToken, tokenRequired: true }),
      fetchLinebotJson("/api/internal/service-health/snapshots", "服務健康快照", { token: env.lineBotInternalToken, tokenRequired: true }),
      fetchLinebotJson("/api/admin/whitelist", "公告 VIP 白名單", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/internal/announcement-whitelist", "公告 VIP Internal 白名單", { token: env.lineBotInternalToken, tokenRequired: true }),
      fetchLinebotJson("/api/admin/dashboard/services-health", "Dashboard 服務健康", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/admin/dashboard/feature-stats", "群組功能開啟狀態", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/admin/tasks/stats", "交辦任務統計", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/admin/attendance/stats", "GPS / 打卡統計", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/admin/webhook-stats", "Webhook 事件統計", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/admin/messages", "最近 LINE 訊息", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/ragic/test", "Ragic 連線測試", { token: env.lineBotAdminToken, tokenRequired: true }),
      fetchLinebotJson("/api/water-quality/report", "水質 / 天氣報告", { token: env.lineBotAdminToken, tokenRequired: true }),
    ]);

  return {
    runtimeHealth,
    adminOverview,
    announcementHealth,
    facilityList,
    interviewUsers,
    serviceStatus,
    serviceSnapshots,
    adminWhitelist,
    internalWhitelist,
    dashboardServicesHealth,
    featureStats,
    taskStats,
    attendanceStats,
    webhookStats,
    messages,
    ragicTest,
    waterQualityReport,
  };
};

const serviceRows = (snapshot: Awaited<ReturnType<typeof apiSnapshot>>): LinebotServiceRow[] => {
  const serviceData = jsonRecord(snapshot.serviceStatus.data);
  const upstreamServices = firstArray(serviceData.services, serviceData.items);
  if (upstreamServices.length) {
    return upstreamServices.map((item, index) => {
      const record = jsonRecord(item);
      const rawStatus = String(record.status ?? "unknown").toLowerCase();
      const status: LinebotManagementStatus =
        ["healthy", "ok", "up", "ready"].includes(rawStatus)
          ? "ready"
          : ["degraded", "warning"].includes(rawStatus)
            ? "degraded"
            : ["waiting_for_400line_api", "not_connected"].includes(rawStatus)
              ? "waiting_for_400line_api"
              : "error";
      return {
        key: asText(record.key, asText(record.name, `service-${index}`)),
        label: asText(record.name, asText(record.service, `service-${index}`)),
        status,
        message: asText(record.message, asText(record.note, "400LINE service status item.")),
        sourcePath: "/api/internal/service-health",
        lastSyncAt: asText(record.checkedAt, asText(record.lastSyncAt, "")) || null,
      };
    });
  }

  const dashboardServicesData = jsonRecord(snapshot.dashboardServicesHealth.data);
  const dashboardServices = firstArray(dashboardServicesData.services);
  if (dashboardServices.length) {
    return dashboardServices.map((item, index) => {
      const record = jsonRecord(item);
      const rawStatus = String(record.status ?? "unknown").toLowerCase();
      const status: LinebotManagementStatus =
        ["healthy", "ok", "up", "ready", "active"].includes(rawStatus)
          ? "ready"
          : ["degraded", "warning"].includes(rawStatus)
            ? "degraded"
            : rawStatus === "not_configured"
              ? "waiting_for_400line_api"
              : "error";
      return {
        key: asText(record.key, asText(record.service, `dashboard-service-${index}`)),
        label: asText(record.name, asText(record.service, `dashboard-service-${index}`)),
        status,
        rawStatus,
        message: asText(record.message, asText(record.note, `400LINE dashboard service status=${rawStatus}`)),
        sourcePath: "/api/admin/dashboard/services-health",
        lastSyncAt: asNullableText(record.checkedAt) ?? asNullableText(dashboardServicesData.checkedAt),
      };
    });
  }

  const announcement = jsonRecord(snapshot.announcementHealth.data);
  const runtime = jsonRecord(snapshot.runtimeHealth.data);
  const taskStats = jsonRecord(snapshot.taskStats.data);
  const attendanceStats = jsonRecord(snapshot.attendanceStats.data);
  const webhookStats = jsonRecord(snapshot.webhookStats.data);
  const webhookRecent = firstArray(webhookStats.recent);
  const ragic = jsonRecord(snapshot.ragicTest.data);
  const facilityRows = facilityItems(snapshot.facilityList);
  const interview = lineUsers(snapshot.interviewUsers);
  return [
    {
      key: "line-runtime",
      label: "LINE Bot Runtime / KeepAlive",
      status: snapshot.runtimeHealth.status,
      message: snapshot.runtimeHealth.status === "ready"
        ? `runtime=${asText(runtime.status, "unknown")} uptime=${asText(runtime.uptime, "-")}`
        : snapshot.runtimeHealth.note,
      sourcePath: "/health",
      lastSyncAt: asNullableText(runtime.timestamp),
    },
    {
      key: "line-messaging-api",
      label: "LINE Messaging API",
      status: snapshot.webhookStats.status,
      message: webhookRecent.length ? `Recent webhook events: ${webhookRecent.length}` : snapshot.webhookStats.note,
      sourcePath: "/api/admin/webhook-stats",
      lastSyncAt: null,
    },
    {
      key: "announcement-pipeline",
      label: "重要公告管線",
      status: snapshot.announcementHealth.status,
      message: asText(announcement.status, snapshot.announcementHealth.note),
      sourcePath: "/api/admin/announcements/health",
      lastSyncAt: asNullableText(announcement.checkedAt),
    },
    {
      key: "facility-home",
      label: "群組 / 館別資料",
      status: snapshot.facilityList.status,
      message: facilityRows.length ? `Readable facilities: ${facilityRows.length}` : snapshot.facilityList.note,
      sourcePath: "/api/facility-home/list",
      lastSyncAt: null,
    },
    {
      key: "feature-stats",
      label: "群組功能開啟狀態",
      status: snapshot.featureStats.status,
      message: firstArray(jsonRecord(snapshot.featureStats.data).groups).length
        ? `Feature groups: ${firstArray(jsonRecord(snapshot.featureStats.data).groups).length}`
        : snapshot.featureStats.note,
      sourcePath: "/api/admin/dashboard/feature-stats",
      lastSyncAt: null,
    },
    {
      key: "authorization-users",
      label: "面試 / 慎用授權名單",
      status: snapshot.interviewUsers.status,
      message: interview.length ? `400LINE authority users: ${interview.length}` : snapshot.interviewUsers.note,
      sourcePath: "/api/admin/interview-users",
      lastSyncAt: null,
    },
    {
      key: "tasks",
      label: "交辦任務",
      status: snapshot.taskStats.status,
      message: snapshot.taskStats.status === "ready"
        ? `total=${asNumber(taskStats.total) ?? "-"} pending=${asNumber(taskStats.pending) ?? "-"} completion=${asText(taskStats.completionRate, "-")}`
        : snapshot.taskStats.note,
      sourcePath: "/api/admin/tasks/stats",
      lastSyncAt: null,
    },
    {
      key: "attendance",
      label: "GPS / 打卡",
      status: snapshot.attendanceStats.status,
      message: snapshot.attendanceStats.status === "ready"
        ? `todayCheckins=${asNumber(attendanceStats.todayCheckins) ?? 0}; successful=${asNumber(attendanceStats.successful) ?? 0}`
        : snapshot.attendanceStats.note,
      sourcePath: "/api/admin/attendance/stats",
      lastSyncAt: asNullableText(attendanceStats.asOf),
    },
    {
      key: "ragic",
      label: "Ragic 員工資料",
      status: snapshot.ragicTest.status === "ready" && ragic.connected === true ? "ready" : snapshot.ragicTest.status,
      message: asText(ragic.message, snapshot.ragicTest.note),
      sourcePath: "/api/ragic/test",
      lastSyncAt: null,
    },
    {
      key: "water-quality",
      label: "水質 / 天氣報告",
      status: snapshot.waterQualityReport.status,
      message: snapshot.waterQualityReport.status === "ready" ? "水質 / 天氣報告可讀取。" : snapshot.waterQualityReport.note,
      sourcePath: "/api/water-quality/report",
      lastSyncAt: null,
    },
    {
      key: "vip-whitelist",
      label: "公告 VIP 白名單",
      status: snapshot.adminWhitelist.status,
      message: snapshot.adminWhitelist.note,
      sourcePath: "/api/admin/whitelist",
      lastSyncAt: null,
    },
  ];
};

const contractServiceRows = (contract: ContractFullStatus): LinebotServiceRow[] =>
  contractCapabilities(contract).map((capability) => ({
    key: capability.key,
    label: capability.label,
    status: mapContractStatus(capability.status),
    rawStatus: capability.status,
    message: capabilityMessage(capability),
    sourcePath: capability.sourceRoutes?.[0] ?? "/api/internal/monitoring/full-status",
    lastSyncAt: capability.lastSuccessAt ?? capability.lastErrorAt,
  }));

const contractFacilities = (contract: ContractFullStatus): LinebotFacilityRow[] =>
  contractCapabilities(contract, "facility-groups").map((capability) => ({
    id: capability.key,
    name: capability.label,
    groupId: capability.sourceRoutes?.[0] ?? capability.key,
    status: mapContractStatus(capability.status),
    rawStatus: capability.status,
    message: capabilityMessage(capability),
  }));

const contractReadiness = (result: UpstreamResult): LinebotApiReadiness[] => [
  readiness(result),
  {
    method: "GET",
    path: "/api/internal/monitoring/routes",
    label: "400LINE monitoring route contract",
    status: result.status,
    sourceMode: "contract",
    rawStatus: result.rawStatus,
    note: "Read through the full-status contract; route metadata is available from 400LINE.",
    lastCheckedAt: result.lastCheckedAt,
  },
  {
    method: "GET",
    path: "/api/internal/monitoring/dependencies",
    label: "400LINE dependency configured states",
    status: result.status,
    sourceMode: "contract",
    rawStatus: result.rawStatus,
    note: "Read through the full-status contract; dependency states are normalized in 400LINE.",
    lastCheckedAt: result.lastCheckedAt,
  },
];

const facilityItems = (result: UpstreamResult): LinebotFacilityRow[] => {
  const data = jsonRecord(result.data);
  const items = firstArray(result.data, data.items, data.facilities, data.groups, data.list);
  return items.map((item, index) => {
    const record = jsonRecord(item);
    const groupId = asText(record.groupId, asText(record.lineGroupId, asText(record.id, `facility-${index}`)));
    return {
      id: asText(record.id, groupId),
      name: asText(record.name, asText(record.facilityName, asText(record.groupName, "未命名館別"))),
      groupId,
      status: result.status,
      message: result.status === "ready" ? "Facility list loaded from 400LINE." : result.note,
    };
  });
};

const featureAccessFromLineAuthority = (record: Record<string, unknown>) => normalizeLineFeatureAccess({
  interview: record.canInterviewCheck === true || record.canInterviewCheck === "true",
  "caution-query": record.canCautionQuery === true || record.canCautionQuery === "true",
  "staff-lookup": record.canInternalQuery === true || record.canInternalQuery === "true",
  "ai-agent": record.canUseAiAgent === true || record.canUseAiAgent === "true",
});

const summarizeFeatureAccess = (features: Record<string, boolean>) => {
  const labels: Record<string, string> = {
    interview: "面試模組",
    "caution-query": "慎用查詢",
    "staff-lookup": "人員查詢",
    "helper-admin": "小幫手管理",
    "ai-agent": "AI 小幫手",
    "vip-announcement": "VIP 公告",
  };
  return Object.entries(features)
    .filter(([, enabled]) => enabled)
    .map(([key]) => labels[key] ?? key)
    .join(", ") || "未開功能";
};

const lineUsers = (result: UpstreamResult): LineAuthorityUser[] => {
  const data = jsonRecord(result.data);
  return firstArray(result.data, data.items, data.users).map((item) => {
    const record = jsonRecord(item);
    const featureAccess = featureAccessFromLineAuthority(record);
    const status: LineAuthorityUser["status"] = String(record.isActive ?? record.status ?? "active") === "false"
      ? "disabled"
      : asText(record.status, "active") === "disabled"
        ? "disabled"
        : asText(record.status, "active") === "unknown"
          ? "unknown"
          : "active";
    return {
      lineUserId: asText(record.lineUserId, asText(record.userId, "")),
      employeeNumber: asText(record.employeeNumber, "") || null,
      displayName: asText(record.displayName, asText(record.userName, asText(record.name, ""))),
      phone: asText(record.phone, "") || null,
      department: asText(record.department, "") || null,
      status,
      featureAccess,
      featureSummary: summarizeFeatureAccess(featureAccess),
    };
  }).filter((item) => item.lineUserId || item.displayName);
};

const ragicCandidates = async (container: AppContainer): Promise<{ items: RagicCandidate[]; sourceStatus: LinebotManagementStatus; source: string; note: string }> => {
  const cacheSlot = container.services.ragicCache.getEmployees();

  if (cacheSlot.data !== null) {
    return {
      items: cacheSlot.data.map((employee) => ({
        lineUserId: employee.lineUserId ?? employee.userId ?? "",
        employeeNumber: employee.employeeNumber ?? employee.userId ?? null,
        displayName: employee.displayName,
        phone: employee.phone ?? null,
        department: employee.department ?? employee.departments?.join(", ") ?? null,
        source: cacheSlot.source,
      })),
      sourceStatus: "ready",
      source: cacheSlot.source,
      note: `Ragic H01 served from cache (${cacheSlot.data.length} employees, age ${cacheSlot.lastPrimedAt ? Math.round((Date.now() - cacheSlot.lastPrimedAt.getTime()) / 1000) + "s" : "unknown"}).`,
    };
  }

  return {
    items: [],
    sourceStatus: "degraded",
    source: "ragic-cache",
    note: "Ragic employee cache not yet primed; retry shortly.",
  };
};

const normalizeCompare = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, "").toLowerCase();

const fieldMismatches = (
  line: LineAuthorityUser | null,
  ragic: RagicCandidate | null,
  shadow?: Awaited<ReturnType<typeof listLineWhitelist>>["items"][number],
) => {
  const mismatches: string[] = [];
  const source = shadow ?? line;
  if (!source || !ragic) return mismatches;
  if (normalizeCompare(source.displayName) && normalizeCompare(ragic.displayName) && normalizeCompare(source.displayName) !== normalizeCompare(ragic.displayName)) mismatches.push("姓名");
  if (normalizeCompare(source.phone) && normalizeCompare(ragic.phone) && normalizeCompare(source.phone) !== normalizeCompare(ragic.phone)) mismatches.push("電話");
  if (normalizeCompare(source.department) && normalizeCompare(ragic.department) && normalizeCompare(source.department) !== normalizeCompare(ragic.department)) mismatches.push("部門");
  return mismatches;
};

const buildComparisonRows = (
  lineAuthority: LineAuthorityUser[],
  cmsShadow: Awaited<ReturnType<typeof listLineWhitelist>>["items"],
  ragic: RagicCandidate[],
): LinebotWhitelistRow[] => {
  const shadowByLineId = new Map(cmsShadow.map((item) => [item.lineUserId, item]));
  const lineByLineId = new Map(lineAuthority.map((item) => [item.lineUserId, item]));
  const ragicByLineId = new Map(ragic.filter((item) => item.lineUserId).map((item) => [item.lineUserId, item]));
  const ragicByName = new Map(ragic.map((item) => [normalizeCompare(item.displayName), item]));
  const seenRagic = new Set<string>();
  const rows: LinebotWhitelistRow[] = [];

  for (const item of lineAuthority) {
    const shadow = shadowByLineId.get(item.lineUserId);
    const ragicMatchByLineId = ragicByLineId.get(item.lineUserId);
    const ragicMatchByName = ragicByName.get(normalizeCompare(item.displayName));
    const ragicMatch = ragicMatchByLineId ?? ragicMatchByName ?? null;
    if (ragicMatch) seenRagic.add(ragicMatch.employeeNumber ?? ragicMatch.displayName);
    const mismatches = fieldMismatches(item, ragicMatch, shadow);
    const comparisonStatus: LinebotWhitelistRow["comparisonStatus"] =
      !item.lineUserId ? "needs_manual_line_id"
        : shadow && ragicMatch && mismatches.length ? "field_mismatch"
          : shadow && ragicMatch ? "matched"
            : shadow ? "field_mismatch"
              : "line_only";
    rows.push({
      lineUserId: item.lineUserId,
      employeeNumber: ragicMatch?.employeeNumber ?? shadow?.employeeNumber ?? item.employeeNumber,
      displayName: item.displayName || shadow?.displayName || ragicMatch?.displayName || "-",
      phone: ragicMatch?.phone ?? shadow?.phone ?? item.phone,
      department: ragicMatch?.department ?? shadow?.department ?? item.department,
      status: shadow?.status ?? "unknown",
      featureSummary: shadow ? summarizeFeatureAccess(shadow.featureAccess) : item.featureSummary ?? "等待 CMS shadow 對齊",
      diffStatus: shadow ? (shadow.status !== "active" && item.status === "active" ? "status_mismatch" : "both") : "line_only",
      comparisonStatus,
      ragicMatched: Boolean(ragicMatch),
      ragicMatchMode: ragicMatchByLineId ? "lineUserId" : ragicMatchByName ? "displayName" : "none",
      ragicSource: ragicMatch?.source ?? null,
      cmsShadowId: shadow?.id ?? null,
      lineAuthorityStatus: item.status,
      fieldMismatches: mismatches,
      syncable: Boolean(item.lineUserId && ragicMatch && (!shadow || comparisonStatus === "field_mismatch")),
    });
  }

  for (const shadow of cmsShadow) {
    if (lineByLineId.has(shadow.lineUserId)) continue;
    const ragicMatch = ragicByLineId.get(shadow.lineUserId) ?? ragicByName.get(normalizeCompare(shadow.displayName)) ?? null;
    if (ragicMatch) seenRagic.add(ragicMatch.employeeNumber ?? ragicMatch.displayName);
    const mismatches = fieldMismatches(null, ragicMatch, shadow);
    rows.push({
      lineUserId: shadow.lineUserId,
      employeeNumber: ragicMatch?.employeeNumber ?? shadow.employeeNumber,
      displayName: shadow.displayName,
      phone: ragicMatch?.phone ?? shadow.phone,
      department: ragicMatch?.department ?? shadow.department,
      status: shadow.status,
      featureSummary: summarizeFeatureAccess(shadow.featureAccess),
      diffStatus: "cms_shadow_only",
      comparisonStatus: mismatches.length ? "field_mismatch" : "cms_shadow_only",
      ragicMatched: Boolean(ragicMatch),
      ragicMatchMode: ragicMatch?.lineUserId === shadow.lineUserId ? "lineUserId" : ragicMatch ? "displayName" : "none",
      ragicSource: ragicMatch?.source ?? null,
      cmsShadowId: shadow.id,
      lineAuthorityStatus: "unknown",
      fieldMismatches: mismatches,
      syncable: false,
    });
  }

  for (const item of ragic) {
    const key = item.employeeNumber ?? item.displayName;
    if (seenRagic.has(key)) continue;
    if (item.lineUserId && (lineByLineId.has(item.lineUserId) || shadowByLineId.has(item.lineUserId))) continue;
    rows.push({
      lineUserId: item.lineUserId,
      employeeNumber: item.employeeNumber,
      displayName: item.displayName,
      phone: item.phone,
      department: item.department,
      status: "unknown",
      featureSummary: "尚未授權",
      diffStatus: "status_mismatch",
      comparisonStatus: item.lineUserId ? "ragic_only" : "needs_manual_line_id",
      ragicMatched: true,
      ragicMatchMode: item.lineUserId ? "lineUserId" : "displayName",
      ragicSource: item.source,
      cmsShadowId: null,
      lineAuthorityStatus: "unknown",
      fieldMismatches: [],
      syncable: false,
    });
  }

  return rows;
};

const buildWhitelist = async (container: AppContainer, snapshot: Awaited<ReturnType<typeof apiSnapshot>>): Promise<LinebotManagementWhitelistDto> => {
  const generatedAt = nowIso();
  const lineAuthority = lineUsers(snapshot.interviewUsers);
  const cmsShadow = await listLineWhitelist();
  const ragic = await ragicCandidates(container);
  const rows = buildComparisonRows(lineAuthority, cmsShadow.items, ragic.items);

  return {
    generatedAt,
    status: combinedStatus([snapshot.interviewUsers, { status: ragic.sourceStatus }, { status: cmsShadow.storageStatus === "ready" ? "ready" : "degraded" }]),
    sourceMode: "legacy_fallback",
    authority: "400LINE",
    syncMode: "read_only_snapshot",
    summary: {
      lineAuthorityTotal: lineAuthority.length,
      cmsShadowTotal: cmsShadow.items.length,
      ragicTotal: ragic.items.length,
      matched: rows.filter((item) => item.comparisonStatus === "matched").length,
      lineOnly: rows.filter((item) => item.diffStatus === "line_only").length,
      ragicOnly: rows.filter((item) => item.comparisonStatus === "ragic_only").length,
      cmsOnly: rows.filter((item) => item.diffStatus === "cms_shadow_only").length,
      fieldMismatch: rows.filter((item) => item.comparisonStatus === "field_mismatch").length,
      needsManualReview: rows.filter((item) => item.comparisonStatus === "needs_manual_line_id").length,
      syncable: rows.filter((item) => item.syncable).length,
      mismatched: rows.filter((item) => item.diffStatus === "status_mismatch").length,
    },
    items: rows,
    apiReadiness: [
      readiness(snapshot.interviewUsers),
      {
        method: "GET",
        path: "Ragic H01/H02",
        label: "Ragic 人員資料",
        status: ragic.sourceStatus,
        sourceMode: "legacy_fallback",
        note: ragic.note,
        lastCheckedAt: generatedAt,
      },
      readiness(snapshot.adminWhitelist),
      readiness(snapshot.internalWhitelist),
      waitingReadiness("/api/admin/whitelist", "公告 VIP 白名單", "Readiness tracked here; write actions stay out of this shell."),
    ],
    rules: [
      "400LINE is the authority; 400QIAN stores shadow snapshots for comparison.",
      "Ragic lookup order: H01 first, H02 fallback.",
      "Authorized users are never deleted from CMS flows; disable status or expiry revokes access.",
    ],
  };
};

const buildContractWhitelist = (contract: ContractFullStatus, contractResult: UpstreamResult): LinebotManagementWhitelistDto => {
  const capabilities = contractCapabilities(contract, "access-control");
  return {
    generatedAt: contract.generatedAt,
    status: mapContractStatus(contract.overall),
    sourceMode: "contract",
    rawStatus: contract.overall,
    authority: "400LINE",
    syncMode: "read_only_snapshot",
    summary: {
      lineAuthorityTotal: capabilities.reduce((sum, capability) => sum + (capability.counters?.todaySuccess ?? 0), 0),
      cmsShadowTotal: 0,
      ragicTotal: 0,
      matched: 0,
      lineOnly: 0,
      ragicOnly: 0,
      cmsOnly: 0,
      fieldMismatch: 0,
      needsManualReview: 0,
      syncable: 0,
      mismatched: capabilities.filter((capability) => capability.status !== "healthy").length,
    },
    items: [],
    apiReadiness: contractReadiness(contractResult),
    rules: [
      "400LINE full-status is the primary monitoring contract for whitelist/access-control readiness.",
      "Detailed person-level diff remains in legacy fallback until 400LINE exposes a safe read-only list contract.",
      "No secret value is surfaced; only configured/readiness state is displayed.",
    ],
  };
};

const buildContractPipeline = (contract: ContractFullStatus, contractResult: UpstreamResult): LinebotManagementPipelineDto => {
  const capabilities = contractCapabilities(contract, "announcement-pipeline");
  const knownIssues = buildKnownIssues(contract, "announcement-pipeline");
  return {
    generatedAt: contract.generatedAt,
    status: mapContractStatus(contract.domains.find((domain) => domain.key === "announcement-pipeline")?.status ?? contract.overall),
    sourceMode: "contract",
    rawStatus: contract.domains.find((domain) => domain.key === "announcement-pipeline")?.status ?? contract.overall,
    stages: capabilities.map((capability) => ({
      key: capability.key,
      label: capability.label,
      status: mapContractStatus(capability.status),
      rawStatus: capability.status,
      description: capabilityMessage(capability),
      sourcePath: capability.sourceRoutes?.[0] ?? "/api/internal/monitoring/full-status",
    })),
    employeeEntryRule: {
      priority: ["must_read", "high"],
      minimumConfidence: 0.85,
      requiresFacilityOrGroupScope: true,
      requiresDisplayableFilter: true,
      sourceLabels: ["已發布", "高信心候選", "等待審核"],
    },
    counters: {
      candidateCount: capabilities.find((capability) => capability.key.includes("candidate"))?.counters?.todaySuccess ?? null,
      todayProcessed: capabilities.reduce((sum, capability) => sum + (capability.counters?.todaySuccess ?? 0), 0),
      issues: capabilities.filter((capability) => capability.status !== "healthy").length,
    },
    apiReadiness: contractReadiness(contractResult),
    knownIssues: knownIssues.length ? knownIssues : undefined,
  };
};

const syncLineAuthorityToShadow = async (
  container: AppContainer,
  actor: { userId?: string; displayName?: string; activeRole?: string; activeFacility?: string } | undefined,
  lineUserIds?: string[],
): Promise<LinebotWhitelistSyncResult> => {
  const snapshot = await apiSnapshot();
  const lineAuthority = lineUsers(snapshot.interviewUsers);
  const cmsShadow = await listLineWhitelist();
  const ragic = await ragicCandidates(container);
  const rows = buildComparisonRows(lineAuthority, cmsShadow.items, ragic.items);
  const requested = new Set((lineUserIds ?? []).filter(Boolean));
  const targetRows = rows.filter((row) => row.syncable && (!requested.size || requested.has(row.lineUserId)));
  const lineById = new Map(lineAuthority.map((item) => [item.lineUserId, item]));
  const shadowById = new Map(cmsShadow.items.map((item) => [item.lineUserId, item]));
  const ragicByLineId = new Map(ragic.items.filter((item) => item.lineUserId).map((item) => [item.lineUserId, item]));
  const ragicByName = new Map(ragic.items.map((item) => [normalizeCompare(item.displayName), item]));
  const result: LinebotWhitelistSyncResult = {
    generatedAt: nowIso(),
    status: "ready",
    created: 0,
    updated: 0,
    skipped: 0,
    needsManualReview: rows.filter((row) => row.comparisonStatus === "needs_manual_line_id").length,
    errors: 0,
    results: [],
  };

  for (const row of targetRows) {
    const line = lineById.get(row.lineUserId);
    if (!line) {
      result.skipped += 1;
      result.results.push({ lineUserId: row.lineUserId, displayName: row.displayName, action: "skipped", reason: "LINE authority row missing." });
      continue;
    }
    const ragic = ragicByLineId.get(row.lineUserId) ?? ragicByName.get(normalizeCompare(row.displayName));
    if (!ragic) {
      result.skipped += 1;
      result.needsManualReview += 1;
      result.results.push({ lineUserId: row.lineUserId, displayName: row.displayName, action: "skipped", reason: "Ragic H01 match missing." });
      continue;
    }
    const existing = shadowById.get(row.lineUserId);
    const values = {
      lineUserId: row.lineUserId,
      employeeNumber: ragic.employeeNumber,
      displayName: ragic.displayName || line.displayName,
      phone: ragic.phone,
      department: ragic.department,
      status: line.status === "disabled" ? "disabled" : "active",
      featureAccess: line.featureAccess,
      startsAt: null,
      endsAt: null,
      unlimited: true,
      notes: existing?.notes ?? "由 400LINE 管理頁三方比對同步",
      source: "system" as const,
      updatedBy: actor?.userId,
      updatedByName: actor?.displayName,
      updatedAt: new Date(),
    };

    try {
      if (existing) {
        await db.update(lineFeatureWhitelist)
          .set(values)
          .where(eq(lineFeatureWhitelist.id, existing.id));
        result.updated += 1;
        result.results.push({ lineUserId: row.lineUserId, displayName: values.displayName, action: "updated" });
      } else {
        await db.insert(lineFeatureWhitelist)
          .values({
            ...values,
            createdBy: actor?.userId,
            createdByName: actor?.displayName,
          });
        result.created += 1;
        result.results.push({ lineUserId: row.lineUserId, displayName: values.displayName, action: "created" });
      }
    } catch (error) {
      result.errors += 1;
      result.status = "degraded";
      result.results.push({
        lineUserId: row.lineUserId,
        displayName: row.displayName,
        action: "error",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!targetRows.length) {
    result.skipped += 1;
    result.results.push({ lineUserId: "-", displayName: "-", action: "skipped", reason: "No syncable rows." });
  }

  await container.repositories.telemetry.recordAudit({
    actorId: actor?.userId,
    role: actor?.activeRole,
    facilityKey: actor?.activeFacility,
    action: "LINEBOT_WHITELIST_SHADOW_SYNC",
    resource: "system.linebot-management",
    payload: {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      requestedLineUserIds: lineUserIds ?? null,
    },
    resultStatus: result.errors ? "failure" : "success",
  }).catch(() => {});

  return result;
};

export const registerLinebotManagementRoutes = (app: Express, container: AppContainer) => {
  app.get("/api/bff/system/linebot-management/overview", requireSession, requireRole("system"), async (_req, res) => {
    const contractResult = await fetchContractFullStatus();
    if (contractResult.contract) {
      const services = contractServiceRows(contractResult.contract);
      const facilities = contractFacilities(contractResult.contract);
      const readinessItems = contractReadiness(contractResult);
      const knownIssues = buildKnownIssues(contractResult.contract);
      const dto: LinebotManagementOverviewDto = {
        generatedAt: contractResult.contract.generatedAt,
        status: mapContractStatus(contractResult.contract.overall),
        sourceMode: "contract",
        rawStatus: contractResult.contract.overall,
        cards: [
          { label: "健康功能", value: contractResult.contract.summary?.healthy ?? services.filter((item) => item.rawStatus === "healthy").length, status: "ready", hint: "Capabilities reported healthy by 400LINE." },
          { label: "需注意功能", value: services.filter((item) => item.status !== "ready").length, status: services.some((item) => item.status === "error") ? "degraded" : "waiting_for_400line_api", hint: "Degraded, stale, disabled, or not configured capabilities." },
          { label: "服務列", value: services.length, status: combinedStatus(services), hint: "Normalized 400LINE capability rows." },
          { label: "館別 / 群組", value: facilities.length, status: combinedStatus(facilities), hint: "Facility domain capabilities from 400LINE." },
          { label: "來源模式", value: "contract", status: "ready", hint: "Using /api/internal/monitoring/full-status primary contract." },
        ],
        apiReadiness: readinessItems,
        notes: [
          "Using 400LINE Capability Monitoring Contract as the primary source.",
          "If the contract becomes unavailable, this BFF automatically falls back to legacy 400LINE APIs.",
          "No secret value is surfaced; token state is reduced to readiness only.",
        ],
        knownIssues: knownIssues.length ? knownIssues : undefined,
      };
      return res.json(dto);
    }

    const snapshot = await apiSnapshot();
    const services = serviceRows(snapshot);
    const facilities = facilityItems(snapshot.facilityList);
    const users = lineUsers(snapshot.interviewUsers);
    const overview = jsonRecord(snapshot.adminOverview.data);
    const overviewTasks = jsonRecord(overview.tasks);
    const overviewGroups = jsonRecord(overview.groups);
    const servicesHealth = jsonRecord(snapshot.dashboardServicesHealth.data);
    const taskStats = jsonRecord(snapshot.taskStats.data);
    const announcementCounters = jsonRecord(jsonRecord(snapshot.announcementHealth.data).counters);
    const apiReadiness = [
      readiness(snapshot.runtimeHealth),
      readiness(snapshot.adminOverview),
      readiness(snapshot.dashboardServicesHealth),
      readiness(snapshot.announcementHealth),
      readiness(snapshot.facilityList),
      readiness(snapshot.interviewUsers),
      readiness(snapshot.featureStats),
      readiness(snapshot.taskStats),
      readiness(snapshot.attendanceStats),
      readiness(snapshot.webhookStats),
      readiness(snapshot.messages),
      readiness(snapshot.ragicTest),
      readiness(snapshot.waterQualityReport),
      readiness(snapshot.serviceStatus),
      readiness(snapshot.serviceSnapshots),
      readiness(snapshot.adminWhitelist),
      readiness(snapshot.internalWhitelist),
      waitingReadiness("/api/admin/service-status", "服務監控 Admin 端點"),
    ];
    const dto: LinebotManagementOverviewDto = {
      generatedAt: nowIso(),
      status: combinedStatus(apiReadiness),
      sourceMode: "legacy_fallback",
      cards: [
        { label: "可用 API", value: apiReadiness.filter((item) => item.status === "ready").length, status: "ready", hint: "Currently readable JSON endpoints." },
        { label: "等待修復 API", value: apiReadiness.filter((item) => item.status === "waiting_for_400line_api").length, status: "waiting_for_400line_api", hint: "Known endpoints that are missing JSON readiness." },
        { label: "健康服務", value: asNumber(servicesHealth.healthyCount) ?? services.filter((item) => item.status === "ready").length, status: combinedStatus(services), hint: `${asNumber(servicesHealth.totalCount) ?? services.length} services from 400LINE dashboard.` },
        { label: "群組", value: asNumber(overviewGroups.total) ?? facilities.length, status: snapshot.adminOverview.status, hint: "400LINE admin overview groups." },
        { label: "館別", value: facilities.length, status: snapshot.facilityList.status, hint: "Facility list from 400LINE." },
        { label: "授權名單", value: users.length, status: snapshot.interviewUsers.status, hint: "400LINE authority users." },
        { label: "任務總數", value: asNumber(overviewTasks.total) ?? asNumber(taskStats.total) ?? "-", status: snapshot.taskStats.status, hint: `pending=${asNumber(overviewTasks.pending) ?? asNumber(taskStats.pending) ?? "-"}` },
        { label: "公告 24h", value: asNumber(announcementCounters.messages24h) ?? "-", status: snapshot.announcementHealth.status, hint: `candidates=${asNumber(announcementCounters.candidates24h) ?? "-"}` },
      ],
      apiReadiness,
      notes: [
        "This page is read-only and currently uses live 400LINE admin/dashboard JSON endpoints as fallback data.",
        "The future /api/internal/monitoring/full-status contract remains the preferred source once deployed.",
        "No secret value is surfaced; token state is reduced to readiness only.",
      ],
    };
    res.json(dto);
  });

  app.get("/api/bff/system/linebot-management/services", requireSession, requireRole("system"), async (_req, res) => {
    const contractResult = await fetchContractFullStatus();
    if (contractResult.contract) {
      const services = contractServiceRows(contractResult.contract);
      const knownIssues = buildKnownIssues(contractResult.contract);
      const dto: LinebotManagementServicesDto = {
        generatedAt: contractResult.contract.generatedAt,
        status: combinedStatus(services),
        sourceMode: "contract",
        rawStatus: contractResult.contract.overall,
        services,
        apiReadiness: contractReadiness(contractResult),
        knownIssues: knownIssues.length ? knownIssues : undefined,
      };
      return res.json(dto);
    }

    const snapshot = await apiSnapshot();
    const services = serviceRows(snapshot);
    const dto: LinebotManagementServicesDto = {
      generatedAt: nowIso(),
      status: combinedStatus(services),
      sourceMode: "legacy_fallback",
      services,
      apiReadiness: [
        readiness(snapshot.runtimeHealth),
        readiness(snapshot.dashboardServicesHealth),
        readiness(snapshot.serviceStatus),
        readiness(snapshot.serviceSnapshots),
        readiness(snapshot.announcementHealth),
        readiness(snapshot.webhookStats),
        readiness(snapshot.taskStats),
        readiness(snapshot.attendanceStats),
        readiness(snapshot.ragicTest),
        readiness(snapshot.waterQualityReport),
      ],
    };
    res.json(dto);
  });

  app.get("/api/bff/system/linebot-management/facilities", requireSession, requireRole("system"), async (_req, res) => {
    const contractResult = await fetchContractFullStatus();
    if (contractResult.contract) {
      const [contractItems, legacyResult] = await Promise.all([
        Promise.resolve(contractFacilities(contractResult.contract)),
        fetchLinebotJson("/api/facility-home/list", "群組 / 館別清單（legacy）"),
      ]);
      const legacyItems = facilityItems(legacyResult);
      const contractCount = contractItems.length;
      const legacyCount = legacyItems.length;
      const diffNote = contractCount !== legacyCount
        ? `Contract 回報 ${contractCount} 個功能域；legacy /api/facility-home/list 回傳 ${legacyCount} 個館別。差異可能因 contract 使用功能域統計、legacy 使用實際群組清單。`
        : undefined;
      const dto: LinebotManagementFacilitiesDto = {
        generatedAt: contractResult.contract.generatedAt,
        status: combinedStatus(contractItems),
        sourceMode: "contract",
        rawStatus: contractResult.contract.domains.find((domain) => domain.key === "facility-groups")?.status ?? contractResult.contract.overall,
        items: contractItems,
        apiReadiness: [...contractReadiness(contractResult), readiness(legacyResult)],
        contractCount,
        legacyCount,
        diffNote,
      };
      return res.json(dto);
    }

    const snapshot = await apiSnapshot();
    const legacyItems = facilityItems(snapshot.facilityList);
    const dto: LinebotManagementFacilitiesDto = {
      generatedAt: nowIso(),
      status: snapshot.facilityList.status,
      sourceMode: "legacy_fallback",
      items: legacyItems,
      apiReadiness: [readiness(snapshot.facilityList), waitingReadiness("/api/internal/facility-home/:groupId/home", "館別首頁狀態")],
      legacyCount: legacyItems.length,
    };
    res.json(dto);
  });

  app.get("/api/bff/system/linebot-management/whitelist-snapshot", requireSession, requireRole("system"), async (_req, res) => {
    const [contractResult, snapshot] = await Promise.all([fetchContractFullStatus(), apiSnapshot()]);
    const liveWhitelist = await buildWhitelist(container, snapshot);
    const sourceBreakdown = {
      contractStatus: contractResult.contract ? contractResult.contract.overall : "unavailable",
      lineAuthorityTotal: liveWhitelist.summary.lineAuthorityTotal,
      cmsShadowTotal: liveWhitelist.summary.cmsShadowTotal,
      ragicTotal: liveWhitelist.summary.ragicTotal,
      note: contractResult.contract
        ? `Contract 可讀取（overall=${contractResult.contract.overall}）；名單資料從 live 400LINE API 補齊。`
        : "Contract 不可用；全部資料從 live 400LINE API fallback 取得。",
    };
    const knownIssues = contractResult.contract
      ? buildKnownIssues(contractResult.contract, "access-control")
      : [];
    res.json({ ...liveWhitelist, sourceBreakdown, knownIssues: knownIssues.length ? knownIssues : undefined });
  });

  app.get("/api/bff/system/linebot-management/whitelist-comparison", requireSession, requireRole("system"), async (_req, res) => {
    const [contractResult, snapshot] = await Promise.all([fetchContractFullStatus(), apiSnapshot()]);
    const liveWhitelist = await buildWhitelist(container, snapshot);
    const sourceBreakdown = {
      contractStatus: contractResult.contract ? contractResult.contract.overall : "unavailable",
      lineAuthorityTotal: liveWhitelist.summary.lineAuthorityTotal,
      cmsShadowTotal: liveWhitelist.summary.cmsShadowTotal,
      ragicTotal: liveWhitelist.summary.ragicTotal,
      note: contractResult.contract
        ? `Contract 可讀取（overall=${contractResult.contract.overall}）；名單資料從 live 400LINE API 補齊。`
        : "Contract 不可用；全部資料從 live 400LINE API fallback 取得。",
    };
    const knownIssues = contractResult.contract
      ? buildKnownIssues(contractResult.contract, "access-control")
      : [];
    res.json({ ...liveWhitelist, sourceBreakdown, knownIssues: knownIssues.length ? knownIssues : undefined });
  });

  app.post("/api/bff/system/linebot-management/whitelist-sync-shadow", requireSession, requireRole("system"), async (req, res) => {
    const lineUserIds = Array.isArray(req.body?.lineUserIds)
      ? req.body.lineUserIds.map((value: unknown) => String(value).trim()).filter(Boolean)
      : undefined;
    res.json(await syncLineAuthorityToShadow(container, req.workbenchSession ?? undefined, lineUserIds));
  });

  app.get("/api/bff/system/linebot-management/announcement-pipeline", requireSession, requireRole("system"), async (_req, res) => {
    const contractResult = await fetchContractFullStatus();
    if (contractResult.contract) return res.json(buildContractPipeline(contractResult.contract, contractResult));

    const snapshot = await apiSnapshot();
    const health = jsonRecord(snapshot.announcementHealth.data);
    const counters = jsonRecord(health.counters);
    const messages24h = asNumber(counters.messages24h);
    const candidates24h = asNumber(counters.candidates24h);
    const dto: LinebotManagementPipelineDto = {
      generatedAt: nowIso(),
      status: snapshot.announcementHealth.status,
      sourceMode: "legacy_fallback",
      stages: [
        { key: "ingest", label: "1. LINE 群組訊息進入", status: snapshot.announcementHealth.status, description: "Receive group messages from LINE Bot Assistant.", sourcePath: "/api/admin/announcements/health" },
        { key: "keyword", label: "2. 關鍵字 / 結構初篩", status: snapshot.announcementHealth.status, description: "Apply strong keyword, phrase, scope, and noise filters." },
        { key: "ai-pass", label: "3. AI Pass 2 分類", status: snapshot.announcementHealth.status, description: "Gemini/OpenAI classifier assigns confidence and priority." },
        { key: "candidate", label: "4. 候選池與主管審核", status: snapshot.announcementHealth.status, description: "High-confidence candidates enter review/monitoring surfaces." },
        { key: "employee-display", label: "5. 員工端群組重要公告", status: "ready", description: "Displayable high-confidence candidates can surface with source labels." },
      ],
      employeeEntryRule: {
        priority: ["must_read", "high"],
        minimumConfidence: 0.85,
        requiresFacilityOrGroupScope: true,
        requiresDisplayableFilter: true,
        sourceLabels: ["已發布", "高信心候選", "等待審核"],
      },
      counters: {
        candidateCount: candidates24h ?? asNumber(counters.candidateCount ?? counters.candidates),
        todayProcessed: messages24h ?? asNumber(counters.todayProcessed ?? counters.processedToday),
        issues: Array.isArray(health.issues) ? health.issues.length : null,
      },
      apiReadiness: [readiness(snapshot.announcementHealth), waitingReadiness("/api/announcement-candidates", "公告候選資料流")],
    };
    res.json(dto);
  });
};
