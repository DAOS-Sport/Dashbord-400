import { env } from "../../shared/config/env";
import type { SystemProjectService } from "@shared/system/project-monitoring-contract";

const CACHE_TTL_MS = 30_000;
const TIMEOUT_MS = 6_000;

type DeploymentTestResponse = {
  deployment?: boolean;
  database_connection?: string;
  node_env?: string;
  environment?: string;
  timestamp?: string;
};

type ItGovernanceService = {
  id: string;
  name: string;
  status: string;
  enabled?: boolean;
  configured?: boolean;
  description?: string;
};

type ItGovernanceResponse = {
  generatedAt?: string;
  environment?: string;
  isDeployment?: boolean;
  featureFlags?: Record<string, boolean>;
  services?: ItGovernanceService[];
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const mapServiceStatus = (status: string, enabled?: boolean): SystemProjectService["status"] => {
  if (!enabled) return "not_connected";
  if (status === "ok") return "ready";
  if (status === "degraded" || status === "warning") return "degraded";
  if (status === "disabled") return "not_connected";
  return "error";
};

const fetchServices = async (): Promise<SystemProjectService[]> => {
  const baseUrl = env.swimSchedulerBaseUrl;
  const adminPassword = env.swimSchedulerAdminPassword;
  const now = new Date().toISOString();

  const deploymentService: SystemProjectService = {
    id: "collab-course-deployment",
    label: "偕同課系統部署狀態",
    status: "not_connected",
    message: "尚未取得部署狀態",
    source: `${baseUrl}/api/deployment-test`,
    lastCheckedAt: now,
  };

  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/deployment-test`);
    if (res.ok) {
      const data = (await res.json()) as DeploymentTestResponse;
      const dbOk = data.database_connection === "success";
      deploymentService.status = dbOk ? "ready" : "degraded";
      deploymentService.message = dbOk
        ? `部署正常，資料庫連線成功（${data.environment ?? "production"}）`
        : `部署運行中，但資料庫連線異常：${data.database_connection ?? "unknown"}`;
    } else {
      deploymentService.status = "error";
      deploymentService.message = `部署健康檢查回傳 HTTP ${res.status}`;
    }
  } catch (err) {
    deploymentService.status = "error";
    deploymentService.message =
      (err as { name?: string })?.name === "AbortError"
        ? `連線逾時（>${TIMEOUT_MS}ms）`
        : `連線失敗：${(err as Error).message ?? "unknown"}`;
  }

  const services: SystemProjectService[] = [deploymentService];

  if (!adminPassword) {
    services.push({
      id: "collab-course-it-governance",
      label: "IT 治理總覽",
      status: "not_connected",
      message: "未設定 SWIM_SCHEDULER_ADMIN_PASSWORD，無法拉取子服務狀態。",
      source: `${baseUrl}/api/admin/it-governance`,
      lastCheckedAt: now,
    });
    return services;
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/admin/it-governance`, {
      headers: { "x-admin-password": adminPassword, Accept: "application/json" },
    });

    if (!res.ok) {
      services.push({
        id: "collab-course-it-governance",
        label: "IT 治理總覽",
        status: res.status === 401 || res.status === 403 ? "error" : "degraded",
        message: `IT 治理端點回傳 HTTP ${res.status}`,
        source: `${baseUrl}/api/admin/it-governance`,
        lastCheckedAt: now,
      });
      return services;
    }

    const governance = (await res.json()) as ItGovernanceResponse;
    const subServices = governance.services ?? [];

    for (const svc of subServices) {
      services.push({
        id: `collab-course-svc-${svc.id}`,
        label: svc.name,
        status: mapServiceStatus(svc.status, svc.enabled !== false),
        message: svc.description
          ? `${svc.status === "ok" ? "正常運行" : svc.status}${svc.description ? `；${svc.description}` : ""}`
          : `服務狀態：${svc.status}${svc.configured === false ? "（未設定）" : ""}`,
        source: `${baseUrl}/api/admin/it-governance#${svc.id}`,
        lastCheckedAt: now,
      });
    }

    if (governance.featureFlags) {
      const flags = Object.entries(governance.featureFlags)
        .map(([k, v]) => `${k}=${v ? "✓" : "✗"}`)
        .join("、");
      services.push({
        id: "collab-course-feature-flags",
        label: "功能旗標",
        status: "ready",
        message: flags,
        source: `${baseUrl}/api/admin/it-governance#featureFlags`,
        lastCheckedAt: now,
      });
    }
  } catch (err) {
    services.push({
      id: "collab-course-it-governance",
      label: "IT 治理總覽",
      status: "error",
      message:
        (err as { name?: string })?.name === "AbortError"
          ? `IT 治理端點逾時（>${TIMEOUT_MS}ms）`
          : `連線失敗：${(err as Error).message ?? "unknown"}`,
      source: `${baseUrl}/api/admin/it-governance`,
      lastCheckedAt: now,
    });
  }

  return services;
};

let cachedResult: { services: SystemProjectService[]; expiresAt: number } | null = null;
let pendingFetch: Promise<SystemProjectService[]> | null = null;

export const collabCourseHealthService = {
  async getServices(): Promise<SystemProjectService[]> {
    const now = Date.now();
    if (cachedResult && cachedResult.expiresAt > now) return cachedResult.services;
    if (pendingFetch) return pendingFetch;

    pendingFetch = fetchServices()
      .then((services) => {
        cachedResult = { services, expiresAt: Date.now() + CACHE_TTL_MS };
        return services;
      })
      .finally(() => {
        pendingFetch = null;
      });
    return pendingFetch;
  },
  reset() {
    cachedResult = null;
    pendingFetch = null;
  },
};
