import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import { requireRole, requireSession } from "../auth/context";
import { getModuleDescriptorById, getModuleHealth, type ModuleHealthDto } from "@shared/modules";
import type {
  SystemProjectDetailDto,
  SystemProjectGroup,
  SystemProjectMetrics,
  SystemProjectMonitoringDto,
  SystemProjectService,
  SystemProjectStatus,
  SystemProjectSummary,
} from "@shared/system/project-monitoring-contract";
import type { ApiLatencyRecord } from "../telemetry/repository";
import { collabCourseHealthService } from "./collab-course-health-service";
import { smartScheduleProjectHealthService } from "./smart-schedule-project-health-service";

// ── Telemetry-driven enrichment helpers ──────────────────────────────────────

/**
 * Derive a 0-100 uptime score from the current service metrics snapshot.
 * Weights: ready=100, degraded=60, notConnected=50, error=0.
 */
const computeUptimeFromMetrics = (metrics: SystemProjectMetrics): number => {
  const total = metrics.ready + metrics.degraded + metrics.error + metrics.notConnected;
  if (total === 0) return 0;
  const score = metrics.ready * 100 + metrics.degraded * 60 + metrics.notConnected * 50;
  return Math.round((score / (total * 100)) * 1000) / 10;
};

/**
 * Bucket the last 24 h of error / slow records into 8 slots of 3 h each.
 * Index 0 = oldest (21-24h ago), index 7 = most recent (0-3h ago).
 */
const computeErrorBuckets24h = (records: ApiLatencyRecord[]): number[] => {
  const buckets = new Array<number>(8).fill(0);
  const now = Date.now();
  const windowMs = 24 * 3_600_000;
  const bucketMs = windowMs / 8;
  for (const r of records) {
    const isError = r.statusCode >= 400 || r.durationMs >= 8_000;
    if (!isError) continue;
    const age = now - new Date(r.timestamp).getTime();
    if (age < 0 || age >= windowMs) continue;
    const idx = 7 - Math.floor(age / bucketMs);
    buckets[Math.min(Math.max(idx, 0), 7)]++;
  }
  return buckets;
};

/**
 * Generate a human-readable one-liner based on the current project status.
 */
const computeLastActivity = (detail: {
  status: SystemProjectStatus;
  metrics: SystemProjectMetrics;
}): string => {
  const { status, metrics } = detail;
  if (status === "ready") return `全部 ${metrics.ready} 個服務正常`;
  if (status === "error") return `${metrics.error} 個服務異常・需介入`;
  if (status === "degraded") return `${metrics.degraded} 個服務降級`;
  return `${metrics.notConnected} 個服務待接入`;
};

const projectOrder: SystemProjectGroup[] = ["governance", "400cms", "400line", "schedule", "collab-course"];

const projectConfig: Record<SystemProjectGroup, Omit<SystemProjectSummary, "status" | "metrics" | "lastUpdatedAt">> = {
  governance: {
    key: "governance",
    label: "總治理",
    description: "跨專案治理、監控總覽與快速導航。",
    controlCenterHref: "/system/project-overview",
    monitorHref: "/system/watchdog",
    governanceHref: "/system/project-overview",
  },
  "400cms": {
    key: "400cms",
    label: "400CMS",
    description: "CMS 控制中心、Watchdog、運維、行為洞察與跨專案治理總覽。",
    controlCenterHref: "/system",
    monitorHref: "/system/monitoring/400cms",
    governanceHref: "/system/project-overview",
  },
  "400line": {
    key: "400line",
    label: "400LINE",
    description: "400LINE 監控平台、服務監控與白名單治理。",
    controlCenterHref: "/system/monitoring/400line",
    monitorHref: "/system/monitoring/400line",
    governanceHref: "/system/monitoring/400line?tab=whitelist",
  },
  schedule: {
    key: "schedule",
    label: "排班管理系統",
    description: "smart-schedule-manager 健康監控，含主服務與資料庫連線狀態。",
    controlCenterHref: "/system/schedule",
    monitorHref: "/system/monitoring/schedule",
  },
  "collab-course": {
    key: "collab-course",
    label: "偕同課系統",
    description: "swim-scheduler 健康監控，含部署狀態、資料庫連線、LINE 推播與 Ragic 同步。",
    controlCenterHref: "/supervisor/collab-courses",
    monitorHref: "/system/collab-course/status",
  },
};

const projectModuleIds: Record<Exclude<SystemProjectGroup, "governance" | "schedule" | "collab-course">, string[]> = {
  "400cms": ["system-control-center", "system-watchdog", "system-operations", "system-insights", "system-governance", "system-monitoring-400cms", "system-cms-monitoring"],
  "400line": ["system-monitoring-400line", "linebot-management", "helper-status", "line-whitelist"],
};

const nowIso = () => new Date().toISOString();

const mapHealthStatus = (status: ModuleHealthDto["status"]): SystemProjectStatus => {
  if (status === "ready") return "ready";
  if (status === "error") return "error";
  if (status === "not_connected") return "not_connected";
  return "degraded";
};

const rollupStatus = (services: SystemProjectService[]): SystemProjectStatus => {
  if (!services.length) return "not_connected";
  if (services.some((service) => service.status === "error")) return "error";
  if (services.some((service) => service.status === "degraded")) return "degraded";
  if (services.some((service) => service.status === "ready")) {
    return services.every((service) => service.status === "ready") ? "ready" : "degraded";
  }
  return "not_connected";
};

const metricsFromServices = (services: SystemProjectService[]): SystemProjectMetrics => ({
  ready: services.filter((service) => service.status === "ready").length,
  degraded: services.filter((service) => service.status === "degraded").length,
  notConnected: services.filter((service) => service.status === "not_connected").length,
  error: services.filter((service) => service.status === "error").length,
});

const servicesFromModuleHealth = (items: ModuleHealthDto[], moduleIds: string[]): SystemProjectService[] => {
  const selected = items.filter((item) => moduleIds.includes(item.moduleId));
  return selected.map((item) => ({
    id: item.moduleId,
    label: getModuleDescriptorById(item.moduleId)?.shortName ?? getModuleDescriptorById(item.moduleId)?.name ?? item.moduleId,
    status: mapHealthStatus(item.status),
    message: item.issues.length ? item.issues.join("；") : "模組路由、BFF 與 telemetry contract 已登記。",
    source: getModuleDescriptorById(item.moduleId)?.bffEndpoint ?? getModuleDescriptorById(item.moduleId)?.routePath ?? "MODULE_REGISTRY",
    lastCheckedAt: item.lastCheckedAt,
  }));
};

const buildProjectDetail = async (projectKey: SystemProjectGroup, container: AppContainer): Promise<SystemProjectDetailDto> => {
  const generatedAt = nowIso();
  const moduleHealth = getModuleHealth("system");
  const allSystemServices = servicesFromModuleHealth(moduleHealth, moduleHealth.map((item) => item.moduleId));
  let services: SystemProjectService[] = [];
  let notes: string[] = [];

  if (projectKey === "governance") {
    services = allSystemServices;
    notes = [
      "總治理只讀取各父類狀態摘要，不執行重啟、刪除或設定變更。",
      `DATA_SOURCE_MODE=${container.config.dataSourceMode}`,
    ];
  } else if (projectKey === "400cms") {
    services = servicesFromModuleHealth(moduleHealth, projectModuleIds["400cms"]);
    notes = ["400CMS 目前使用 CMS 內部 module registry 與 BFF health contract 作為狀態來源。"];
  } else if (projectKey === "400line") {
    services = servicesFromModuleHealth(moduleHealth, projectModuleIds["400line"]);
    services.push({
      id: "400line-connection",
      label: "400LINE 連線設定",
      status: container.config.lineBotBaseUrl ? "degraded" : "not_connected",
      message: container.config.lineBotBaseUrl
        ? "CMS 已設定 400LINE base URL；詳細健康狀態請看 /system/monitoring/400line 分類監控。"
        : "LINE_BOT_BASE_URL 尚未設定，不能直接確認 400LINE 狀態。",
      source: "LINE_BOT_BASE_URL",
      lastCheckedAt: generatedAt,
    });
    notes = ["400LINE 一律透過 CMS BFF 讀取，不由前端直接呼叫 400LINE。"];
  } else if (projectKey === "schedule") {
    services = await smartScheduleProjectHealthService.getServices();
    const readyCount = services.filter((s) => s.status === "ready").length;
    notes = [
      `資料來源：smart-schedule-manager /api/health`,
      `正常服務數：${readyCount} / ${services.length}`,
      "排班管理系統透過 INTERNAL_API_TOKEN 驗證；API 監控詳見 /system/monitoring/schedule。",
    ];
  } else {
    services = await collabCourseHealthService.getServices();
    const readyCount = services.filter((s) => s.status === "ready").length;
    notes = [
      `資料來源：swim-scheduler /api/deployment-test 與 /api/admin/it-governance`,
      `正常服務數：${readyCount} / ${services.length}`,
      "偕同課系統管理端點使用 SWIM_SCHEDULER_ADMIN_PASSWORD 驗證。",
    ];
  }

  const metrics = metricsFromServices(services);
  return {
    ...projectConfig[projectKey],
    status: rollupStatus(services),
    metrics,
    lastUpdatedAt: generatedAt,
    services,
    notes,
  };
};

export const registerProjectMonitoringRoutes = (app: Express, container: AppContainer) => {
  app.get("/api/bff/system/project-monitoring", requireSession, requireRole("system"), async (_req, res) => {
    const [details, latencyRecords] = await Promise.all([
      Promise.all(projectOrder.map((projectKey) => buildProjectDetail(projectKey, container))),
      container.repositories.telemetry.listApiLatencyLogs(1000).catch((): ApiLatencyRecord[] => []),
    ]);

    const errorBuckets = computeErrorBuckets24h(latencyRecords);

    // Count total error + degraded services across all non-governance projects
    // so the governance card can display an "alertsPending" number.
    const alertsPending = details
      .filter((d) => d.key !== "governance")
      .reduce((sum, d) => sum + d.metrics.error + d.metrics.degraded, 0);

    const items: SystemProjectSummary[] = details.map((detail) => ({
      key: detail.key,
      label: detail.label,
      description: detail.description,
      status: detail.status,
      controlCenterHref: detail.controlCenterHref,
      monitorHref: detail.monitorHref,
      governanceHref: detail.governanceHref,
      metrics: detail.metrics,
      lastUpdatedAt: detail.lastUpdatedAt,
      uptime7d: detail.key !== "governance" ? computeUptimeFromMetrics(detail.metrics) : undefined,
      alertsPending: detail.key === "governance" ? alertsPending : undefined,
      errorsLast24h: errorBuckets,
      lastActivity: computeLastActivity(detail),
    }));

    const dto: SystemProjectMonitoringDto = { generatedAt: nowIso(), items };
    return res.json(dto);
  });

  app.get("/api/bff/system/project-monitoring/:projectKey", requireSession, requireRole("system"), async (req, res) => {
    const projectKey = String(req.params.projectKey ?? "") as SystemProjectGroup;
    if (!projectOrder.includes(projectKey)) {
      return res.status(404).json({ message: "SYSTEM_PROJECT_NOT_FOUND" });
    }
    return res.json(await buildProjectDetail(projectKey, container));
  });
};
