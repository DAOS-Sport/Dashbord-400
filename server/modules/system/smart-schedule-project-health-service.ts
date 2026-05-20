import { env } from "../../shared/config/env";
import type { SystemProjectService } from "@shared/system/project-monitoring-contract";

const CACHE_TTL_MS = 30_000;
const TIMEOUT_MS = 6_000;

type SmartScheduleHealthResponse = {
  ok?: boolean;
  status?: string;
  service?: string;
  environment?: string;
  uptimeSeconds?: number;
  timestamp?: string;
  db?: string;
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

const fetchServices = async (): Promise<SystemProjectService[]> => {
  const baseUrl = env.smartScheduleBaseUrl;
  const token = env.smartScheduleApiToken;
  const now = new Date().toISOString();

  const healthService: SystemProjectService = {
    id: "smart-schedule-health",
    label: "排班管理系統主服務",
    status: "not_connected",
    message: "尚未取得健康狀態",
    source: `${baseUrl}/api/health`,
    lastCheckedAt: now,
  };

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/health`, { headers });

    if (res.ok) {
      const data = (await res.json()) as SmartScheduleHealthResponse;
      const dbOk = data.db === "connected";
      const svcOk = data.ok === true || data.status === "healthy";

      healthService.status = svcOk && dbOk ? "ready" : "degraded";
      healthService.message = [
        svcOk ? "服務正常運行" : `服務狀態：${data.status ?? "unknown"}`,
        dbOk ? "資料庫已連線" : `資料庫：${data.db ?? "unknown"}`,
        data.uptimeSeconds !== undefined
          ? `運行 ${Math.floor(data.uptimeSeconds / 60)} 分鐘`
          : null,
      ]
        .filter(Boolean)
        .join("；");
    } else if (res.status === 401 || res.status === 403) {
      healthService.status = "error";
      healthService.message = `認證失敗 HTTP ${res.status}；請確認 INTERNAL_API_TOKEN 是否正確。`;
    } else {
      healthService.status = "error";
      healthService.message = `健康檢查回傳 HTTP ${res.status}`;
    }
  } catch (err) {
    healthService.status = "error";
    healthService.message =
      (err as { name?: string })?.name === "AbortError"
        ? `連線逾時（>${TIMEOUT_MS}ms）`
        : `連線失敗：${(err as Error).message ?? "unknown"}`;
  }

  const dbService: SystemProjectService = {
    id: "smart-schedule-db",
    label: "排班資料庫連線",
    status: healthService.status === "ready" ? "ready" : healthService.status,
    message:
      healthService.status === "ready"
        ? "資料庫連線正常（來源：/api/health）"
        : `資料庫狀態未確認，主服務健康檢查：${healthService.message}`,
    source: `${baseUrl}/api/health#db`,
    lastCheckedAt: now,
  };

  return [healthService, dbService];
};

let cachedResult: { services: SystemProjectService[]; expiresAt: number } | null = null;
let pendingFetch: Promise<SystemProjectService[]> | null = null;

export const smartScheduleProjectHealthService = {
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
