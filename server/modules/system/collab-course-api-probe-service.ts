import { env } from "../../shared/config/env";
import type { ApiMonitoringStatus, ScheduleEndpointProbe } from "@shared/system/api-monitoring-contract";
import { collabCourseApiCatalog } from "@shared/system/collab-course-api-catalog";

const CACHE_TTL_MS = 30_000;
const PROBE_TIMEOUT_MS = 6_000;

const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

type ProbeSpec = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  catalogPath: string;
  buildUrl: (baseUrl: string) => string;
  auth: "public" | "admin" | "skip";
  isMutating: boolean;
};

const buildProbeSpecs = (): ProbeSpec[] => {
  const today = todayStr();
  return collabCourseApiCatalog.map((endpoint) => {
    const isMutating = endpoint.method !== "GET";
    const hasRunId = endpoint.path.includes(":runId");
    const hasParamNeedingId = endpoint.path.includes(":id") && !endpoint.path.includes("/venues/:id");

    if (isMutating || hasRunId) {
      return {
        id: endpoint.id,
        method: endpoint.method,
        catalogPath: endpoint.path,
        buildUrl: (base: string) => `${base}${endpoint.path}`,
        auth: "skip" as const,
        isMutating: true,
      };
    }

    if (endpoint.auth === "coach-token") {
      return {
        id: endpoint.id,
        method: endpoint.method,
        catalogPath: endpoint.path,
        buildUrl: (base: string) => `${base}${endpoint.path}`,
        auth: "skip" as const,
        isMutating: false,
      };
    }

    const auth = endpoint.auth === "admin" ? "admin" : "public";

    let buildUrl = (base: string) => `${base}${endpoint.path}`;

    if (endpoint.path === "/api/schedules") {
      buildUrl = (base: string) => `${base}/api/schedules?startDate=${today}&endDate=${today}`;
    } else if (endpoint.path === "/api/schedules/:date") {
      buildUrl = (base: string) => `${base}/api/schedules/${today}`;
    } else if (endpoint.path === "/api/conflicts/:date") {
      buildUrl = (base: string) => `${base}/api/conflicts/${today}`;
    } else if (endpoint.path === "/api/statistics") {
      buildUrl = (base: string) => `${base}/api/statistics?startDate=${today}&endDate=${today}`;
    } else if (endpoint.path === "/api/coach-portal/me/:identifier") {
      return {
        id: endpoint.id,
        method: endpoint.method,
        catalogPath: endpoint.path,
        buildUrl: (base: string) => `${base}${endpoint.path}`,
        auth: "skip" as const,
        isMutating: false,
      };
    } else if (hasParamNeedingId) {
      return {
        id: endpoint.id,
        method: endpoint.method,
        catalogPath: endpoint.path,
        buildUrl: (base: string) => `${base}${endpoint.path}`,
        auth: "skip" as const,
        isMutating: false,
      };
    }

    return { id: endpoint.id, method: endpoint.method, catalogPath: endpoint.path, buildUrl, auth, isMutating: false };
  });
};

const probeEndpoint = async (
  spec: ProbeSpec,
  baseUrl: string,
  adminPassword: string | undefined,
): Promise<ScheduleEndpointProbe> => {
  const checkedAt = new Date().toISOString();
  const category = "overview";

  if (spec.auth === "skip" || spec.isMutating) {
    const isMutating = spec.isMutating;
    return {
      id: spec.id,
      category,
      label: spec.id,
      method: spec.method,
      path: spec.catalogPath,
      status: "not_connected",
      statusCode: null,
      durationMs: null,
      checkedAt,
      message: isMutating ? "寫入端點，不主動探活。" : "需要特殊認證，不主動探活。",
      isMutating,
    };
  }

  if (spec.auth === "admin" && !adminPassword) {
    return {
      id: spec.id,
      category,
      label: spec.id,
      method: spec.method,
      path: spec.catalogPath,
      status: "not_connected",
      statusCode: null,
      durationMs: null,
      checkedAt,
      message: "未設定 SWIM_SCHEDULER_ADMIN_PASSWORD，跳過探活。",
      isMutating: false,
    };
  }

  const url = spec.buildUrl(baseUrl);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (spec.auth === "admin" && adminPassword) {
    headers["x-admin-password"] = adminPassword;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal });
    const durationMs = Date.now() - startedAt;
    let status: ApiMonitoringStatus;
    if (res.status >= 200 && res.status < 300) status = "healthy";
    else if (res.status >= 400 && res.status < 500) status = "warning";
    else status = "error";

    return {
      id: spec.id,
      category,
      label: spec.id,
      method: spec.method,
      path: spec.catalogPath,
      status,
      statusCode: res.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      message: res.status >= 200 && res.status < 300 ? `${res.status} OK · ${durationMs}ms` : `HTTP ${res.status}`,
      isMutating: false,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const isTimeout = (err as { name?: string })?.name === "AbortError";
    return {
      id: spec.id,
      category,
      label: spec.id,
      method: spec.method,
      path: spec.catalogPath,
      status: "error",
      statusCode: null,
      durationMs,
      checkedAt: new Date().toISOString(),
      message: isTimeout ? `逾時 (>${PROBE_TIMEOUT_MS}ms)` : `連線失敗：${(err as Error).message ?? "unknown"}`,
      isMutating: false,
    };
  } finally {
    clearTimeout(timer);
  }
};

export type CollabCourseProbeSnapshot = Map<string, ScheduleEndpointProbe>;

const runSnapshot = async (): Promise<CollabCourseProbeSnapshot> => {
  const baseUrl = env.swimSchedulerBaseUrl;
  const adminPassword = env.swimSchedulerAdminPassword;
  const specs = buildProbeSpecs();
  const probes = await Promise.all(specs.map((spec) => probeEndpoint(spec, baseUrl, adminPassword)));
  const map = new Map<string, ScheduleEndpointProbe>();
  probes.forEach((probe) => map.set(probe.id, probe));
  return map;
};

let cachedSnapshot: { data: CollabCourseProbeSnapshot; expiresAt: number } | null = null;
let pendingSnapshot: Promise<CollabCourseProbeSnapshot> | null = null;

export const collabCourseApiProbeService = {
  async snapshot(): Promise<CollabCourseProbeSnapshot> {
    const now = Date.now();
    if (cachedSnapshot && cachedSnapshot.expiresAt > now) return cachedSnapshot.data;
    if (pendingSnapshot) return pendingSnapshot;

    pendingSnapshot = runSnapshot()
      .then((data) => {
        cachedSnapshot = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        return data;
      })
      .finally(() => {
        pendingSnapshot = null;
      });
    return pendingSnapshot;
  },
  reset() {
    cachedSnapshot = null;
    pendingSnapshot = null;
  },
};
