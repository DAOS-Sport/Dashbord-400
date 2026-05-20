import { env } from "../../shared/config/env";
import type {
  ApiMonitoringScheduleCategory,
  ApiMonitoringStatus,
  ScheduleEndpointProbe,
  ScheduleMonitoringBlock,
} from "@shared/system/api-monitoring-contract";

type EndpointSpec = {
  id: string;
  category: ApiMonitoringScheduleCategory;
  label: string;
  method: "GET" | "POST";
  path: string;
  query?: () => Record<string, string>;
  isMutating?: boolean;
};

const CACHE_TTL_MS = 30_000;
const PROBE_TIMEOUT_MS = 5_000;

const todayInTaipei = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

const endpointSpecs: EndpointSpec[] = [
  {
    id: "overview",
    category: "overview",
    label: "系統總覽",
    method: "GET",
    path: "/api/internal/admin/overview",
  },
  {
    id: "schedules-today",
    category: "schedules",
    label: "今日班表",
    method: "GET",
    path: "/api/internal/schedules/today",
    query: () => ({ facilityKey: "A" }),
  },
  {
    id: "export-schedules",
    category: "export",
    label: "班表匯出",
    method: "GET",
    path: "/api/internal/export/schedules",
    query: () => {
      const day = todayInTaipei();
      return { from: day, to: day, limit: "1" };
    },
  },
  {
    id: "export-employees",
    category: "export",
    label: "員工清單匯出",
    method: "GET",
    path: "/api/internal/export/employees",
    query: () => ({ limit: "1" }),
  },
  {
    id: "export-venues",
    category: "export",
    label: "館別清單",
    method: "GET",
    path: "/api/internal/export/venues",
  },
  {
    id: "export-shifts",
    category: "export",
    label: "班別範本清單",
    method: "GET",
    path: "/api/internal/export/shifts",
  },
  {
    id: "export-changes",
    category: "export",
    label: "排班異動紀錄",
    method: "GET",
    path: "/api/internal/export/changes",
    query: () => {
      const day = todayInTaipei();
      return { from: day, to: day, limit: "1" };
    },
  },
  {
    id: "export-snapshot",
    category: "export",
    label: "完整快照",
    method: "GET",
    path: "/api/internal/export/snapshot",
    query: () => ({ limit: "1" }),
  },
  {
    id: "trigger-weekly",
    category: "trigger",
    label: "手動觸發每週排班同步",
    method: "POST",
    path: "/api/internal/trigger-weekly-schedule",
    isMutating: true,
  },
];

const categoryLabels: Record<ApiMonitoringScheduleCategory, string> = {
  overview: "系統總覽",
  schedules: "即時班表",
  export: "資料匯出",
  trigger: "同步觸發",
};

const authHeaders = (token: string): Record<string, string> => ({
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
  "X-Internal-Token": token,
  "X-API-Key": token,
});

const buildUrl = (baseUrl: string, spec: EndpointSpec): string => {
  const url = new URL(spec.path, baseUrl);
  const query = spec.query?.();
  if (query) {
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  return url.toString();
};

const statusFromResponse = (statusCode: number): ApiMonitoringStatus => {
  if (statusCode >= 200 && statusCode < 300) return "healthy";
  if (statusCode >= 400 && statusCode < 500) return "warning";
  return "error";
};

const probeMessage = (statusCode: number, durationMs: number): string => {
  if (statusCode >= 200 && statusCode < 300) return `${statusCode} OK · ${durationMs}ms`;
  if (statusCode === 401 || statusCode === 403) return `${statusCode} 認證失敗`;
  if (statusCode >= 400 && statusCode < 500) return `${statusCode} 用戶端錯誤`;
  if (statusCode >= 500) return `${statusCode} 伺服器錯誤`;
  return `HTTP ${statusCode}`;
};

const probe = async (baseUrl: string, token: string, spec: EndpointSpec): Promise<ScheduleEndpointProbe> => {
  if (spec.isMutating) {
    return {
      id: spec.id,
      category: spec.category,
      label: spec.label,
      method: spec.method,
      path: spec.path,
      status: "not_connected",
      statusCode: null,
      durationMs: null,
      checkedAt: new Date().toISOString(),
      message: "寫入端點，不主動探活；請於需要時手動觸發。",
      isMutating: true,
    };
  }

  const url = buildUrl(baseUrl, spec);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: spec.method,
      headers: authHeaders(token),
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    return {
      id: spec.id,
      category: spec.category,
      label: spec.label,
      method: spec.method,
      path: spec.path,
      status: statusFromResponse(response.status),
      statusCode: response.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      message: probeMessage(response.status, durationMs),
      isMutating: false,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const aborted = (error as { name?: string } | undefined)?.name === "AbortError";
    return {
      id: spec.id,
      category: spec.category,
      label: spec.label,
      method: spec.method,
      path: spec.path,
      status: "error",
      statusCode: null,
      durationMs,
      checkedAt: new Date().toISOString(),
      message: aborted
        ? `逾時 (>${PROBE_TIMEOUT_MS}ms)`
        : `連線失敗：${(error as Error).message ?? "unknown"}`,
      isMutating: false,
    };
  } finally {
    clearTimeout(timer);
  }
};

const groupByCategory = (probes: ScheduleEndpointProbe[]): ScheduleMonitoringBlock["categories"] => {
  const order: ApiMonitoringScheduleCategory[] = ["overview", "schedules", "export", "trigger"];
  return order.map((key) => ({
    key,
    label: categoryLabels[key],
    endpoints: probes.filter((item) => item.category === key),
  }));
};

const summarize = (probes: ScheduleEndpointProbe[]): ScheduleMonitoringBlock["summary"] => ({
  healthy: probes.filter((p) => p.status === "healthy").length,
  warning: probes.filter((p) => p.status === "warning").length,
  error: probes.filter((p) => p.status === "error").length,
  notConnected: probes.filter((p) => p.status === "not_connected").length,
});

const placeholderBlock = (baseUrl: string | null, tokenConfigured: boolean, reason: string): ScheduleMonitoringBlock => {
  const probes: ScheduleEndpointProbe[] = endpointSpecs.map((spec) => ({
    id: spec.id,
    category: spec.category,
    label: spec.label,
    method: spec.method,
    path: spec.path,
    status: "not_connected",
    statusCode: null,
    durationMs: null,
    checkedAt: null,
    message: reason,
    isMutating: Boolean(spec.isMutating),
  }));
  return {
    baseUrl,
    tokenConfigured,
    summary: summarize(probes),
    categories: groupByCategory(probes),
  };
};

let cachedSnapshot: { block: ScheduleMonitoringBlock; expiresAt: number } | null = null;
let pendingFetch: Promise<ScheduleMonitoringBlock> | null = null;

const fetchSnapshot = async (): Promise<ScheduleMonitoringBlock> => {
  const baseUrl = env.smartScheduleBaseUrl ?? null;
  const token = env.smartScheduleApiToken ?? null;

  if (!baseUrl) {
    return placeholderBlock(null, Boolean(token), "尚未設定 SMART_SCHEDULE_BASE_URL");
  }
  if (!token) {
    return placeholderBlock(baseUrl, false, "尚未設定 SMART_SCHEDULE_API_TOKEN / INTERNAL_API_TOKEN");
  }

  const probes = await Promise.all(endpointSpecs.map((spec) => probe(baseUrl, token, spec)));
  return {
    baseUrl,
    tokenConfigured: true,
    summary: summarize(probes),
    categories: groupByCategory(probes),
  };
};

export const scheduleHealthService = {
  async snapshot(): Promise<ScheduleMonitoringBlock> {
    const now = Date.now();
    if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
      return cachedSnapshot.block;
    }
    if (pendingFetch) return pendingFetch;

    pendingFetch = fetchSnapshot()
      .then((block) => {
        cachedSnapshot = { block, expiresAt: Date.now() + CACHE_TTL_MS };
        return block;
      })
      .finally(() => {
        pendingFetch = null;
      });
    return pendingFetch;
  },
  reset() {
    cachedSnapshot = null;
    pendingFetch = null;
  },
};

export type ScheduleHealthService = typeof scheduleHealthService;
