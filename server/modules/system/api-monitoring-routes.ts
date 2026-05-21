import type { Express } from "express";
import { createHash } from "crypto";
import type { AppContainer } from "../../app/container";
import { getModuleDescriptorsByRole } from "@shared/modules";
import type { ModuleDescriptor } from "@shared/modules";
import type {
  ApiMonitoringAuditEvent,
  ApiMonitoringDetailDto,
  ApiMonitoringDto,
  ApiMonitoringError,
  ApiMonitoringErrorGroup,
  ApiMonitoringErrorResolution,
  ApiMonitoringExternalService,
  ApiMonitoringProjectKey,
  ApiMonitoringRequestRecord,
  ApiMonitoringRow,
  ApiMonitoringStatus,
  ApiMonitoringSummary,
  ApiMonitoringTrendBucket,
  ApiMonitoringType,
  ScheduleEndpointProbe,
} from "@shared/system/api-monitoring-contract";
import type { SystemProjectGroup } from "@shared/system/project-monitoring-contract";
import {
  collabCourseApiAuthLabels,
  collabCourseApiCatalog,
  collabCourseApiCategoryLabels,
} from "@shared/system/collab-course-api-catalog";
import type { ApiErrorResolutionRecord, ApiLatencyRecord } from "../telemetry/repository";
import { requireRole, requireSession } from "../auth/context";
import { scheduleHealthService } from "./schedule-health-service";
import { collabCourseApiProbeService } from "./collab-course-api-probe-service";

type MonitorProjectKey = Exclude<SystemProjectGroup, "governance">;

const projectKeys: MonitorProjectKey[] = ["400cms", "400line", "schedule", "collab-course"];

const projectLabels: Record<MonitorProjectKey, string> = {
  "400cms": "400CMS",
  "400line": "400LINE",
  schedule: "排班管理系統",
  "collab-course": "偕同課系統",
};

const projectModuleIds: Record<MonitorProjectKey, string[]> = {
  "400cms": [
    "system-control-center",
    "system-watchdog",
    "system-operations",
    "system-insights",
    "system-governance",
    "system-cms-monitoring",
    "system-monitoring-overview",
    "system-monitoring-400cms",
  ],
  "400line": ["linebot-management", "helper-status", "line-whitelist", "system-monitoring-400line"],
  schedule: ["system-schedule-control", "system-schedule-monitoring", "system-monitoring-schedule"],
  "collab-course": ["system-collab-course-control", "system-collab-course-monitoring", "system-monitoring-collab-course"],
};

const statusRank: Record<ApiMonitoringStatus, number> = {
  error: 0,
  warning: 1,
  healthy: 2,
  not_connected: 3,
};

const nowIso = () => new Date().toISOString();

const normalizeProjectKey = (value: unknown): ApiMonitoringProjectKey => {
  const key = String(value ?? "all");
  return key === "all" || projectKeys.includes(key as MonitorProjectKey) ? key as ApiMonitoringProjectKey : "all";
};

const typeFromPath = (path: string): ApiMonitoringType => {
  if (path.includes("health")) return "health";
  if (path.startsWith("/api/auth")) return "auth";
  if (path.startsWith("/api/bff/system") || path.startsWith("/api/modules")) return "system";
  if (path.startsWith("/api/bff/employee")) return "employee";
  if (path.startsWith("/api/bff/lifeguard") || path.startsWith("/api/work-logs")) return "lifeguard";
  if (path.startsWith("/api/bff/supervisor")) return "supervisor";
  if (path.includes("line") || path.includes("ragic") || path.includes("integrations")) return "external-proxy";
  if (path.startsWith("/api/bff")) return "bff";
  return "legacy";
};

const statusFromHttp = (statusCode: number, durationMs: number): ApiMonitoringStatus => {
  if (statusCode >= 500 || statusCode === 499) return "error";
  if (statusCode >= 400 || durationMs >= 8000) return "warning";
  return "healthy";
};

const apiStatusValues: ApiMonitoringStatus[] = ["healthy", "warning", "error", "not_connected"];

const normalizeApiStatus = (value: unknown): ApiMonitoringStatus | null => {
  const status = String(value ?? "");
  return apiStatusValues.includes(status as ApiMonitoringStatus) ? status as ApiMonitoringStatus : null;
};

const fallbackStatusCode = (status: ApiMonitoringStatus, explicit?: unknown): number => {
  const parsed = Number(explicit);
  if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  if (status === "error") return 499;
  if (status === "warning") return 408;
  if (status === "healthy") return 200;
  return 0;
};

const rollupStatus = (statuses: ApiMonitoringStatus[]): ApiMonitoringStatus => {
  if (!statuses.length) return "not_connected";
  return [...statuses].sort((a, b) => statusRank[a] - statusRank[b])[0] ?? "not_connected";
};

const summarize = (projectKey: ApiMonitoringProjectKey, rows: ApiMonitoringRow[], generatedAt: string): ApiMonitoringSummary => {
  const healthyApis = rows.filter((row) => row.status === "healthy").length;
  const warningApis = rows.filter((row) => row.status === "warning").length;
  const errorApis = rows.filter((row) => row.status === "error").length;
  const notConnectedApis = rows.filter((row) => row.status === "not_connected").length;
  const connectedApis = healthyApis + warningApis + errorApis;
  return {
    projectKey,
    totalApis: connectedApis,
    connectedApis,
    healthyApis,
    warningApis,
    errorApis,
    notConnectedApis,
    skippedApis: notConnectedApis,
    lastUpdatedAt: generatedAt,
  };
};

const hourStart = (date: Date) => {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
};

const errorRecord = (record: ApiLatencyRecord) =>
  record.statusCode >= 400 || record.statusCode === 499 || record.durationMs >= 8000;

const errorType = (record: ApiLatencyRecord): ApiMonitoringError["errorType"] => {
  if (record.statusCode === 499) return "aborted";
  if (record.durationMs >= 8000) return "timeout";
  if (record.statusCode >= 500) return "5xx";
  return "4xx";
};

const errorFingerprint = (
  projectKey: MonitorProjectKey,
  route: string,
  statusCode: number,
  type: ApiMonitoringError["errorType"],
  hour: string,
) => createHash("sha1").update(`${projectKey}|${route}|${statusCode}|${type}|${hour}`).digest("hex");

const resolutionByFingerprint = (resolutions: ApiErrorResolutionRecord[]) =>
  new Map(resolutions.map((resolution) => [resolution.fingerprint, resolution]));

const toResolutionDto = (record?: ApiErrorResolutionRecord): ApiMonitoringErrorResolution => ({
  status: record?.status ?? "open",
  note: record?.note,
  resolvedBy: record?.resolvedBy,
  resolvedAt: record?.resolvedAt,
  updatedAt: record?.updatedAt,
});

const buildErrorGroups = (
  projectKey: MonitorProjectKey,
  route: string,
  records: ApiLatencyRecord[],
  resolutions: Map<string, ApiErrorResolutionRecord>,
): ApiMonitoringErrorGroup[] => {
  const groups = new Map<string, {
    fingerprint: string;
    statusCode: number;
    errorType: ApiMonitoringError["errorType"];
    hour: string;
    records: ApiLatencyRecord[];
  }>();

  records.filter(errorRecord).forEach((record) => {
    const type = errorType(record);
    const hour = hourStart(new Date(record.timestamp)).toISOString();
    const fingerprint = errorFingerprint(projectKey, route, record.statusCode, type, hour);
    const existing = groups.get(fingerprint);
    if (existing) {
      existing.records.push(record);
      return;
    }
    groups.set(fingerprint, {
      fingerprint,
      statusCode: record.statusCode,
      errorType: type,
      hour,
      records: [record],
    });
  });

  return Array.from(groups.values()).map((group) => {
    const sorted = [...group.records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const totalDuration = group.records.reduce((sum, record) => sum + record.durationMs, 0);
    const correlationIds = Array.from(new Set(group.records.map((record) => record.correlationId).filter(Boolean))) as string[];
    return {
      fingerprint: group.fingerprint,
      projectKey,
      route,
      statusCode: group.statusCode,
      errorType: group.errorType,
      hour: group.hour,
      count: group.records.length,
      avgDurationMs: group.records.length ? Math.round(totalDuration / group.records.length) : null,
      firstOccurredAt: sorted[0]?.timestamp ?? group.hour,
      lastOccurredAt: sorted[sorted.length - 1]?.timestamp ?? group.hour,
      correlationIds,
      resolution: toResolutionDto(resolutions.get(group.fingerprint)),
    };
  }).sort((a, b) => {
    const aResolved = a.resolution.status === "resolved";
    const bResolved = b.resolution.status === "resolved";
    if (aResolved !== bResolved) return aResolved ? 1 : -1;
    return new Date(b.lastOccurredAt).getTime() - new Date(a.lastOccurredAt).getTime();
  });
};

const toRequestRecord = (record: ApiLatencyRecord, index: number): ApiMonitoringRequestRecord => ({
  id: `${record.route}:${record.timestamp}:${index}`,
  route: record.route,
  statusCode: record.statusCode,
  durationMs: record.durationMs,
  occurredAt: record.timestamp,
  role: record.role,
  facilityKey: record.facilityKey,
  correlationId: record.correlationId,
  errorType: errorRecord(record) ? errorType(record) : undefined,
});

const recentHourBuckets = () => {
  const end = hourStart(new Date());
  return Array.from({ length: 24 }, (_, index) => {
    const hour = new Date(end);
    hour.setHours(end.getHours() - (23 - index));
    return hour;
  });
};

const buildTrend = (records: ApiLatencyRecord[]): ApiMonitoringTrendBucket[] => {
  const hours = recentHourBuckets();
  const grouped = new Map<string, ApiLatencyRecord[]>();
  records.forEach((record) => {
    const bucket = hourStart(new Date(record.timestamp)).toISOString();
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), record]);
  });

  return hours.map((hour) => {
    const bucket = grouped.get(hour.toISOString()) ?? [];
    const totalDuration = bucket.reduce((sum, record) => sum + record.durationMs, 0);
    return {
      hour: hour.toISOString(),
      total: bucket.length,
      errors: bucket.filter((record) => record.statusCode >= 400 || record.statusCode === 499).length,
      avgDurationMs: bucket.length ? Math.round(totalDuration / bucket.length) : null,
    };
  });
};

const seedRow = (
  projectKey: MonitorProjectKey,
  id: string,
  label: string,
  path: string,
  source: string,
  fallbackStatus: ApiMonitoringStatus,
  method = "GET",
): Omit<ApiMonitoringRow, "trend" | "totalCount" | "errorCount" | "warningCount" | "unresolvedErrorCount" | "resolvedErrorCount" | "avgDurationMs" | "lastCheckedAt" | "statusCode"> => ({
  id,
  projectKey,
  type: typeFromPath(path),
  label,
  method,
  path,
  source,
  status: fallbackStatus,
});

const rowsFromDescriptors = (descriptors: ModuleDescriptor[]): Array<Omit<ApiMonitoringRow, "trend" | "totalCount" | "errorCount" | "warningCount" | "unresolvedErrorCount" | "resolvedErrorCount" | "avgDurationMs" | "lastCheckedAt" | "statusCode">> => {
  const rows: Array<Omit<ApiMonitoringRow, "trend" | "totalCount" | "errorCount" | "warningCount" | "unresolvedErrorCount" | "resolvedErrorCount" | "avgDurationMs" | "lastCheckedAt" | "statusCode">> = [];
  projectKeys.forEach((projectKey) => {
    const moduleIds = new Set(projectModuleIds[projectKey]);
    descriptors
      .filter((descriptor) => moduleIds.has(descriptor.id))
      .forEach((descriptor) => {
        const path = descriptor.bffEndpoint ?? descriptor.apiPrefix;
        if (!path) return;
        rows.push(seedRow(projectKey, `${projectKey}:${descriptor.id}`, descriptor.shortName ?? descriptor.name, path, descriptor.id, "not_connected"));
      });
  });
  return rows;
};

const collabCourseCatalogRows = (): Array<Omit<ApiMonitoringRow, "trend" | "totalCount" | "errorCount" | "warningCount" | "unresolvedErrorCount" | "resolvedErrorCount" | "avgDurationMs" | "lastCheckedAt" | "statusCode">> =>
  collabCourseApiCatalog.map((endpoint) =>
    seedRow(
      "collab-course",
      `collab-course:${endpoint.id}`,
      `${endpoint.label} · ${collabCourseApiAuthLabels[endpoint.auth]}`,
      endpoint.path,
      collabCourseApiCategoryLabels[endpoint.category],
      "not_connected",
      endpoint.method,
    ),
  );

const statusForDb = (container: AppContainer): ApiMonitoringStatus =>
  container.config.databaseUrl ? "healthy" : "warning";

const statusForLine = (container: AppContainer): ApiMonitoringStatus => {
  if (!container.config.lineBotBaseUrl) return "not_connected";
  return container.config.lineBotAdminToken || container.config.lineBotInternalToken ? "healthy" : "warning";
};

const statusForRagic = (container: AppContainer): ApiMonitoringStatus => {
  const ragic = container.services.ragicCache.status();
  return ragic.employees.status === "ok" && ragic.facilities.status === "ok" ? "healthy" : "warning";
};

const healthRows = (container: AppContainer) => [
  seedRow("400cms", "health:api", "API 存活檢查", "/api/health", "CMS", "healthy"),
  seedRow("400cms", "health:db", "DB 健康檢查", "/api/db-health", "DATABASE_URL", statusForDb(container)),
  seedRow("400line", "health:line", "LINE Bot 健康檢查", "/api/line-health", "LINE_BOT_BASE_URL", statusForLine(container)),
  seedRow("400cms", "health:ragic", "Ragic 健康檢查", "/api/ragic-health", "RAGIC_CACHE", statusForRagic(container)),
];

const completeRows = (
  seedRows: ReturnType<typeof rowsFromDescriptors>,
  latencyRecords: ApiLatencyRecord[],
  generatedAt: string,
  resolutions: Map<string, ApiErrorResolutionRecord>,
): ApiMonitoringRow[] => {
  const recordsByRoute = new Map<string, ApiLatencyRecord[]>();
  latencyRecords.forEach((record) => {
    recordsByRoute.set(record.route, [...(recordsByRoute.get(record.route) ?? []), record]);
  });

  return seedRows.map((row) => {
    const records = recordsByRoute.get(row.path) ?? [];
    const latest = records[0];
    const errors = records.filter((record) => record.statusCode >= 500 || record.statusCode === 499);
    const warnings = records.filter((record) => (record.statusCode >= 400 && record.statusCode < 500) || record.durationMs >= 8000);
    const errorGroups = buildErrorGroups(row.projectKey, row.path, records, resolutions);
    const unresolvedErrorCount = errorGroups
      .filter((group) => group.resolution.status !== "resolved")
      .reduce((count, group) => count + group.count, 0);
    const resolvedErrorCount = errorGroups
      .filter((group) => group.resolution.status === "resolved")
      .reduce((count, group) => count + group.count, 0);
    const avgDurationMs = records.length
      ? Math.round(records.reduce((sum, record) => sum + record.durationMs, 0) / records.length)
      : null;
    const runtimeStatus = latest ? statusFromHttp(latest.statusCode, latest.durationMs) : row.status;

    return {
      ...row,
      status: runtimeStatus,
      statusCode: latest?.statusCode ?? null,
      totalCount: records.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      unresolvedErrorCount,
      resolvedErrorCount,
      avgDurationMs,
      lastCheckedAt: latest?.timestamp ?? (row.type === "health" ? generatedAt : null),
      trend: buildTrend(records),
    };
  }).sort((a, b) => {
    if (a.unresolvedErrorCount !== b.unresolvedErrorCount) return b.unresolvedErrorCount - a.unresolvedErrorCount;
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    return a.label.localeCompare(b.label, "zh-Hant");
  });
};

const externalServices = (container: AppContainer, generatedAt: string): ApiMonitoringExternalService[] => {
  const ragic = container.services.ragicCache.status();
  return [
    {
      id: "db",
      label: "DB",
      status: statusForDb(container),
      message: container.config.databaseUrl ? `DATABASE_PROFILE=${container.config.databaseProfile}` : "DATABASE_URL 未設定，目前使用 mock profile。",
      source: "NEON_DATABASE_URL/DATABASE_URL",
      lastCheckedAt: generatedAt,
    },
    {
      id: "line-bot",
      label: "LINE Bot",
      status: statusForLine(container),
      message: container.config.lineBotBaseUrl ? "LINE_BOT_BASE_URL 已設定；token 狀態只顯示 configured/missing。" : "LINE_BOT_BASE_URL 未設定。",
      source: "LINE_BOT_BASE_URL",
      lastCheckedAt: generatedAt,
    },
    {
      id: "ragic",
      label: "Ragic",
      status: statusForRagic(container),
      message: `employees=${ragic.employees.count} (${ragic.employees.source})，facilities=${ragic.facilities.count} (${ragic.facilities.source})`,
      source: "RAGIC_CACHE",
      lastCheckedAt: generatedAt,
    },
    {
      id: "vercel",
      label: "Vercel",
      status: process.env.VERCEL_URL || process.env.VERCEL ? "healthy" : "not_connected",
      message: process.env.VERCEL_URL || process.env.VERCEL ? "偵測到 Vercel runtime env。" : "尚未接 Vercel runtime / APM 資料。",
      source: "VERCEL_URL",
      lastCheckedAt: generatedAt,
    },
    {
      id: "replit",
      label: "Replit",
      status: process.env.REPL_ID || container.config.replitDataBaseUrl ? "healthy" : "warning",
      message: process.env.REPL_ID || container.config.replitDataBaseUrl ? "偵測到 Replit runtime 或資料來源設定。" : "Replit 資料來源目前以 mock/本機模式運作。",
      source: "REPL_ID/REPLIT_DATA_BASE_URL",
      lastCheckedAt: generatedAt,
    },
  ];
};

const filterRows = (rows: ApiMonitoringRow[], projectKey: ApiMonitoringProjectKey) =>
  projectKey === "all" ? rows : rows.filter((row) => row.projectKey === projectKey);

const recentErrors = (records: ApiLatencyRecord[], rows: ApiMonitoringRow[]): ApiMonitoringError[] => {
  const routeSet = new Set(rows.map((row) => row.path));
  return records
    .filter((record) => routeSet.has(record.route))
    .filter((record) => record.statusCode >= 400 || record.statusCode === 499 || record.durationMs >= 8000)
    .slice(0, 50)
    .map((record, index) => ({
      id: `${record.route}:${record.timestamp}:${index}`,
      route: record.route,
      statusCode: record.statusCode,
      durationMs: record.durationMs,
      occurredAt: record.timestamp,
      errorType: errorType(record),
      correlationId: record.correlationId,
    }));
};

type MonitoringDataset = {
  generatedAt: string;
  latencyRecords: ApiLatencyRecord[];
  allRows: ApiMonitoringRow[];
  resolutions: Map<string, ApiErrorResolutionRecord>;
};

const applyCollabCourseProbes = (
  rows: ApiMonitoringRow[],
  probes: Awaited<ReturnType<typeof collabCourseApiProbeService.snapshot>>,
  generatedAt: string,
): ApiMonitoringRow[] =>
  rows.map((row) => {
    if (row.projectKey !== "collab-course") return row;
    const endpointId = row.id.replace("collab-course:", "");
    const probe = probes.get(endpointId);
    if (!probe || probe.status === "not_connected") return row;
    return {
      ...row,
      status: probe.status,
      statusCode: probe.statusCode,
      avgDurationMs: probe.durationMs,
      lastCheckedAt: probe.checkedAt ?? generatedAt,
      totalCount: probe.checkedAt ? 1 : 0,
      errorCount: probe.status === "error" ? 1 : 0,
      warningCount: probe.status === "warning" ? 1 : 0,
      unresolvedErrorCount: probe.status === "error" ? 1 : 0,
      resolvedErrorCount: 0,
      trend: probeTrend(probe),
    };
  });

const buildMonitoringDataset = async (container: AppContainer): Promise<MonitoringDataset> => {
  const generatedAt = nowIso();
  const descriptors = getModuleDescriptorsByRole("system");
  const [latencyRecords, resolutionRecords, collabProbes] = await Promise.all([
    container.repositories.telemetry.listApiLatencyLogs(5000),
    container.repositories.telemetry.listApiErrorResolutions(5000),
    collabCourseApiProbeService.snapshot(),
  ]);
  const resolutions = resolutionByFingerprint(resolutionRecords);
  const descriptorRows = rowsFromDescriptors(descriptors).filter((row) => row.projectKey !== "collab-course");
  const rawRows = completeRows([...healthRows(container), ...descriptorRows, ...collabCourseCatalogRows()], latencyRecords, generatedAt, resolutions);
  const allRows = applyCollabCourseProbes(rawRows, collabProbes, generatedAt);
  return { generatedAt, latencyRecords, allRows, resolutions };
};

const probeTrend = (probe: { status: ApiMonitoringStatus; checkedAt: string | null; durationMs: number | null }): ApiMonitoringTrendBucket[] => {
  const end = hourStart(new Date(probe.checkedAt ?? Date.now()));
  const statusCodeError = probe.status === "error";
  return Array.from({ length: 24 }, (_, index) => {
    const hour = new Date(end);
    hour.setHours(end.getHours() - (23 - index));
    const latest = index === 23 && Boolean(probe.checkedAt);
    return {
      hour: hour.toISOString(),
      total: latest ? 1 : 0,
      errors: latest && statusCodeError ? 1 : 0,
      avgDurationMs: latest ? probe.durationMs : null,
    };
  });
};

const buildSyntheticRow = (
  projectKey: MonitorProjectKey,
  rowId: string,
  label: string,
  method: string,
  route: string,
  records: ApiLatencyRecord[],
  generatedAt: string,
  resolutions: Map<string, ApiErrorResolutionRecord>,
  source = "synthetic",
  fallbackStatus: ApiMonitoringStatus = "not_connected",
): ApiMonitoringRow => {
  const [row] = completeRows([seedRow(projectKey, rowId, label, route, source, fallbackStatus, method)], records, generatedAt, resolutions);
  return row;
};

const recordsFromScheduleProbe = (probe: ScheduleEndpointProbe): ApiLatencyRecord[] => {
  const fallbackStatusCode = probe.status === "error" ? 499 : probe.status === "warning" ? 408 : 200;
  return probe.checkedAt && !probe.isMutating
    ? [{
        timestamp: probe.checkedAt,
        route: probe.path,
        durationMs: probe.durationMs ?? 0,
        statusCode: probe.statusCode ?? fallbackStatusCode,
      }]
    : [];
};

const buildCollabCourseDetailRow = async (
  rowId: string,
  generatedAt: string,
  resolutions: Map<string, ApiErrorResolutionRecord>,
): Promise<{ row: ApiMonitoringRow; records: ApiLatencyRecord[] } | null> => {
  const probes = await collabCourseApiProbeService.snapshot();
  const endpointId = rowId.replace(/^collab-course:/, "");
  const probe = probes.get(endpointId);
  if (!probe) return null;
  const catalogEntry = collabCourseApiCatalog.find((e) => e.id === endpointId);
  if (!catalogEntry) return null;
  const records = recordsFromScheduleProbe(probe);
  const groups = buildErrorGroups("collab-course", probe.path, records, resolutions);
  const row: ApiMonitoringRow = {
    id: rowId,
    projectKey: "collab-course",
    type: typeFromPath(probe.path),
    label: `${catalogEntry.label} · ${collabCourseApiAuthLabels[catalogEntry.auth]}`,
    method: probe.method,
    path: probe.path,
    source: "collabCourseApiProbeService",
    status: probe.status,
    statusCode: probe.statusCode,
    totalCount: records.length,
    errorCount: groups.reduce((count, group) => count + group.count, 0),
    warningCount: probe.status === "warning" ? 1 : 0,
    unresolvedErrorCount: groups
      .filter((group) => group.resolution.status !== "resolved")
      .reduce((count, group) => count + group.count, 0),
    resolvedErrorCount: groups
      .filter((group) => group.resolution.status === "resolved")
      .reduce((count, group) => count + group.count, 0),
    avgDurationMs: probe.durationMs,
    lastCheckedAt: probe.checkedAt ?? generatedAt,
    trend: probeTrend(probe),
  };
  return { row, records };
};

const buildScheduleDetailRow = async (
  rowId: string,
  generatedAt: string,
  resolutions: Map<string, ApiErrorResolutionRecord>,
): Promise<{ row: ApiMonitoringRow; records: ApiLatencyRecord[] } | null> => {
  const block = await scheduleHealthService.snapshot();
  const probe = block.categories.flatMap((category) => category.endpoints).find((endpoint) => endpoint.id === rowId);
  if (!probe) return null;
  const records = recordsFromScheduleProbe(probe);
  const groups = buildErrorGroups("schedule", probe.path, records, resolutions);
  const row: ApiMonitoringRow = {
    id: probe.id,
    projectKey: "schedule",
    type: typeFromPath(probe.path),
    label: probe.label,
    method: probe.method,
    path: probe.path,
    source: "scheduleHealthService",
    status: probe.status,
    statusCode: probe.statusCode,
    totalCount: records.length,
    errorCount: groups.reduce((count, group) => count + group.count, 0),
    warningCount: probe.status === "warning" ? 1 : 0,
    unresolvedErrorCount: groups
      .filter((group) => group.resolution.status !== "resolved")
      .reduce((count, group) => count + group.count, 0),
    resolvedErrorCount: groups
      .filter((group) => group.resolution.status === "resolved")
      .reduce((count, group) => count + group.count, 0),
    avgDurationMs: probe.durationMs,
    lastCheckedAt: probe.checkedAt ?? generatedAt,
    trend: probeTrend(probe),
  };
  return { row, records };
};

const buildDetailDto = async (
  container: AppContainer,
  projectKey: ApiMonitoringProjectKey,
  rowId: string,
  query: { route?: string; label?: string; method?: string; status?: string; checkedAt?: string; durationMs?: string; statusCode?: string },
): Promise<ApiMonitoringDetailDto | null> => {
  const dataset = await buildMonitoringDataset(container);
  const rows = filterRows(dataset.allRows, projectKey);
  let row = rows.find((item) => item.id === rowId);
  let records: ApiLatencyRecord[] = [];
  if (row) {
    const route = row.path;
    records = dataset.latencyRecords.filter((record) => record.route === route);
  }

  if (!row && projectKey === "schedule") {
    const scheduleRow = await buildScheduleDetailRow(rowId, dataset.generatedAt, dataset.resolutions);
    if (scheduleRow) {
      row = scheduleRow.row;
      records = scheduleRow.records;
    }
  }

  if (!row && projectKey === "collab-course") {
    const collabRow = await buildCollabCourseDetailRow(rowId, dataset.generatedAt, dataset.resolutions);
    if (collabRow) {
      row = collabRow.row;
      records = collabRow.records;
    }
  }

  if (!row && projectKey !== "all" && query.route) {
    const route = String(query.route);
    records = dataset.latencyRecords.filter((record) => record.route === route);
    const queryStatus = normalizeApiStatus(query.status) ?? "not_connected";
    if (!records.length && query.checkedAt) {
      const durationMs = Number(query.durationMs);
      records = [{
        timestamp: query.checkedAt,
        route,
        durationMs: Number.isFinite(durationMs) ? Math.max(Math.round(durationMs), 0) : 0,
        statusCode: fallbackStatusCode(queryStatus, query.statusCode),
      }];
    }
    row = buildSyntheticRow(
      projectKey,
      rowId,
      query.label?.trim() || route,
      query.method?.trim() || "GET",
      route,
      records,
      dataset.generatedAt,
      dataset.resolutions,
      "monitoring-detail",
      queryStatus,
    );
  }

  if (!row) return null;

  const groups = buildErrorGroups(row.projectKey, row.path, records, dataset.resolutions);
  const unresolvedErrorGroups = groups.filter((group) => group.resolution.status !== "resolved");
  const resolvedErrorGroups = groups.filter((group) => group.resolution.status === "resolved");

  return {
    generatedAt: dataset.generatedAt,
    projectKey,
    row,
    hourlyBuckets: row.trend,
    unresolvedErrorGroups,
    resolvedErrorGroups,
    recentRecords: records.slice(0, 100).map(toRequestRecord),
  };
};

const findErrorGroup = async (
  container: AppContainer,
  fingerprint: string,
): Promise<ApiMonitoringErrorGroup | ApiErrorResolutionRecord | null> => {
  const dataset = await buildMonitoringDataset(container);
  const scanned = new Set<string>();
  const findIn = (
    projectKey: MonitorProjectKey,
    route: string,
    records: ApiLatencyRecord[],
  ) => {
    const key = `${projectKey}:${route}`;
    if (scanned.has(key)) return null;
    scanned.add(key);
    return buildErrorGroups(projectKey, route, records, dataset.resolutions)
      .find((item) => item.fingerprint === fingerprint) ?? null;
  };

  for (const row of dataset.allRows) {
    const records = dataset.latencyRecords.filter((record) => record.route === row.path);
    const group = findIn(row.projectKey, row.path, records);
    if (group) return group;
  }

  const routes = Array.from(new Set(dataset.latencyRecords.map((record) => record.route)));
  for (const projectKey of projectKeys) {
    for (const route of routes) {
      const records = dataset.latencyRecords.filter((record) => record.route === route);
      const group = findIn(projectKey, route, records);
      if (group) return group;
    }
  }

  const scheduleBlock = await scheduleHealthService.snapshot().catch(() => null);
  for (const probe of scheduleBlock?.categories.flatMap((category) => category.endpoints) ?? []) {
    const group = findIn("schedule", probe.path, recordsFromScheduleProbe(probe));
    if (group) return group;
  }

  return dataset.resolutions.get(fingerprint) ?? null;
};

const buildDto = async (container: AppContainer, projectKey: ApiMonitoringProjectKey): Promise<ApiMonitoringDto> => {
  const { generatedAt, latencyRecords, allRows } = await buildMonitoringDataset(container);
  const rows = filterRows(allRows, projectKey);
  const projectSummaries = projectKeys.map((key) => summarize(key, filterRows(allRows, key), generatedAt));
  const auditEvents: ApiMonitoringAuditEvent[] = (await container.repositories.telemetry.listAuditLogs(50)).map((event) => ({
    id: String(event.id ?? `${event.resource}:${event.timestamp}`),
    actorId: event.actorId,
    role: event.role,
    action: event.action,
    resource: event.resource,
    resourceId: event.resourceId,
    resultStatus: event.resultStatus,
    occurredAt: event.timestamp,
  }));

  const scheduleBlock = projectKey === "schedule" ? await scheduleHealthService.snapshot() : undefined;

  return {
    generatedAt,
    projectKey,
    summary: summarize(projectKey, rows, generatedAt),
    projectSummaries,
    rows,
    healthChecks: rows.filter((row) => row.type === "health"),
    recentErrors: recentErrors(latencyRecords, rows),
    auditEvents,
    externalServices: externalServices(container, generatedAt),
    scheduleBlock,
  };
};

export const registerApiMonitoringRoutes = (app: Express, container: AppContainer) => {
  app.get("/api/health", (_req, res) => {
    return res.json({ status: "healthy", checkedAt: nowIso(), service: "400CMS API" });
  });

  app.get("/api/db-health", (_req, res) => {
    const status = statusForDb(container);
    return res.status(status === "healthy" ? 200 : 503).json({
      status,
      checkedAt: nowIso(),
      databaseProfile: container.config.databaseProfile,
      configured: Boolean(container.config.databaseUrl),
    });
  });

  app.get("/api/line-health", (_req, res) => {
    const status = statusForLine(container);
    return res.status(status === "not_connected" ? 503 : 200).json({
      status,
      checkedAt: nowIso(),
      baseUrlConfigured: Boolean(container.config.lineBotBaseUrl),
      adminTokenConfigured: Boolean(container.config.lineBotAdminToken),
      internalTokenConfigured: Boolean(container.config.lineBotInternalToken),
    });
  });

  app.get("/api/ragic-health", (_req, res) => {
    const status = statusForRagic(container);
    return res.status(status === "healthy" ? 200 : 503).json({
      status,
      checkedAt: nowIso(),
      cache: container.services.ragicCache.status(),
    });
  });

  app.get("/api/bff/system/api-monitoring", requireSession, requireRole("system"), async (req, res) => {
    const projectKey = normalizeProjectKey(req.query.projectKey);
    return res.json(await buildDto(container, projectKey));
  });

  app.get("/api/bff/system/api-monitoring/:rowId/detail", requireSession, requireRole("system"), async (req, res) => {
    const projectKey = normalizeProjectKey(req.query.projectKey);
    const detail = await buildDetailDto(container, projectKey, String(req.params.rowId), {
      route: typeof req.query.route === "string" ? req.query.route : undefined,
      label: typeof req.query.label === "string" ? req.query.label : undefined,
      method: typeof req.query.method === "string" ? req.query.method : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      checkedAt: typeof req.query.checkedAt === "string" ? req.query.checkedAt : undefined,
      durationMs: typeof req.query.durationMs === "string" ? req.query.durationMs : undefined,
      statusCode: typeof req.query.statusCode === "string" ? req.query.statusCode : undefined,
    });
    if (!detail) return res.status(404).json({ message: "API monitoring row not found" });
    return res.json(detail);
  });

  app.patch("/api/bff/system/api-monitoring/error-groups/:fingerprint/status", requireSession, requireRole("system"), async (req, res) => {
    const fingerprint = String(req.params.fingerprint);
    const status = req.body?.status === "resolved" ? "resolved" : req.body?.status === "open" ? "open" : null;
    if (!status) return res.status(400).json({ message: "status must be resolved or open" });
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : undefined;
    const found = await findErrorGroup(container, fingerprint);
    if (!found) return res.status(404).json({ message: "API monitoring error group not found" });

    const resolution = await container.repositories.telemetry.upsertApiErrorResolution({
      fingerprint,
      projectKey: found.projectKey,
      route: found.route,
      statusCode: found.statusCode,
      errorType: found.errorType,
      hour: found.hour,
      status,
      note,
      resolvedBy: status === "resolved" ? req.workbenchSession?.userId : undefined,
      resolvedAt: status === "resolved" ? nowIso() : undefined,
    });

    await container.repositories.telemetry.recordAudit({
      actorId: req.workbenchSession?.userId,
      role: req.workbenchSession?.activeRole,
      facilityKey: req.workbenchSession?.activeFacility,
      action: status === "resolved" ? "API_MONITORING_ERROR_RESOLVED" : "API_MONITORING_ERROR_REOPENED",
      resource: "api_monitoring_error_group",
      resourceId: fingerprint,
      payload: {
        route: found.route,
        statusCode: found.statusCode,
        errorType: found.errorType,
        hour: found.hour,
        note,
      },
      resultStatus: "success",
    });

    return res.json({ resolution });
  });
};
