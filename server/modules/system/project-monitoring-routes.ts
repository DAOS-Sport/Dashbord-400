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

const projectOrder: SystemProjectGroup[] = ["governance", "400cms", "400line", "schedule", "collab-course"];

const projectConfig: Record<SystemProjectGroup, Omit<SystemProjectSummary, "status" | "metrics" | "lastUpdatedAt">> = {
  governance: {
    key: "governance",
    label: "總治理",
    description: "跨專案治理、監控總覽與快速導航。",
    controlCenterHref: "/system",
    monitorHref: "/system/watchdog",
    governanceHref: "/system/governance",
  },
  "400cms": {
    key: "400cms",
    label: "400CMS",
    description: "CMS 控制中心、Watchdog、運維、行為洞察與治理面。",
    controlCenterHref: "/system",
    monitorHref: "/system/400cms/status",
    governanceHref: "/system/governance",
  },
  "400line": {
    key: "400line",
    label: "400LINE",
    description: "400LINE 管理、服務監控與白名單治理。",
    controlCenterHref: "/system/linebot-management",
    monitorHref: "/system/lineXBS-status",
    governanceHref: "/system/line-whitelist",
  },
  schedule: {
    key: "schedule",
    label: "班表系統",
    description: "班表控制中心與服務監控殼，等待正式資料源接入。",
    controlCenterHref: "/system/schedule",
    monitorHref: "/system/schedule/status",
  },
  "collab-course": {
    key: "collab-course",
    label: "偕同課系統",
    description: "偕同課控制中心與服務監控殼，等待正式資料源接入。",
    controlCenterHref: "/system/collab-course",
    monitorHref: "/system/collab-course/status",
  },
};

const projectModuleIds: Record<Exclude<SystemProjectGroup, "governance" | "schedule" | "collab-course">, string[]> = {
  "400cms": ["system-control-center", "system-watchdog", "system-operations", "system-insights", "system-governance", "system-cms-monitoring"],
  "400line": ["linebot-management", "helper-status", "line-whitelist"],
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

const placeholderServices = (projectKey: Extract<SystemProjectGroup, "schedule" | "collab-course">, generatedAt: string): SystemProjectService[] => {
  const label = projectKey === "schedule" ? "班表系統" : "偕同課系統";
  const source = projectKey === "schedule" ? "SMART_SCHEDULE_MANAGER" : "COLLAB_COURSE_SYSTEM";
  return [
    {
      id: `${projectKey}-control-center`,
      label: `${label}控制中心`,
      status: "not_connected",
      message: `${source} 尚未接入 CMS BFF；目前只建立監控殼與導覽契約。`,
      source,
      lastCheckedAt: generatedAt,
    },
    {
      id: `${projectKey}-service-monitoring`,
      label: `${label}服務監控`,
      status: "not_connected",
      message: "等待資料源提供 health/readiness endpoint 後接線。",
      source: `${source}:health`,
      lastCheckedAt: generatedAt,
    },
  ];
};

const buildProjectDetail = (projectKey: SystemProjectGroup, container: AppContainer): SystemProjectDetailDto => {
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
        ? "CMS 已設定 400LINE base URL；詳細健康狀態請看 /system/lineXBS-status 分類監控。"
        : "LINE_BOT_BASE_URL 尚未設定，不能直接確認 400LINE 狀態。",
      source: "LINE_BOT_BASE_URL",
      lastCheckedAt: generatedAt,
    });
    notes = ["400LINE 一律透過 CMS BFF 讀取，不由前端直接呼叫 400LINE。"];
  } else {
    services = placeholderServices(projectKey, generatedAt);
    notes = ["目前是監控殼，不顯示假健康；後續接入資料源後會改由真 endpoint 回報。"];
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
  app.get("/api/bff/system/project-monitoring", requireSession, requireRole("system"), (_req, res) => {
    const items = projectOrder.map((projectKey) => {
      const detail = buildProjectDetail(projectKey, container);
      return {
        key: detail.key,
        label: detail.label,
        description: detail.description,
        status: detail.status,
        controlCenterHref: detail.controlCenterHref,
        monitorHref: detail.monitorHref,
        governanceHref: detail.governanceHref,
        metrics: detail.metrics,
        lastUpdatedAt: detail.lastUpdatedAt,
      };
    });
    const dto: SystemProjectMonitoringDto = { generatedAt: nowIso(), items };
    return res.json(dto);
  });

  app.get("/api/bff/system/project-monitoring/:projectKey", requireSession, requireRole("system"), (req, res) => {
    const projectKey = String(req.params.projectKey ?? "") as SystemProjectGroup;
    if (!projectOrder.includes(projectKey)) {
      return res.status(404).json({ message: "SYSTEM_PROJECT_NOT_FOUND" });
    }
    return res.json(buildProjectDetail(projectKey, container));
  });
};
