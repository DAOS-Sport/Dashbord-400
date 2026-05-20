import type { Express } from "express";
import type { AppContainer } from "../../app/container";
import type {
  ActionCategory,
  ActionMonitoringDto,
  ActionMonitoringRow,
  ActionMonitoringStatus,
  ActionMonitoringSummary,
  ActionMonitoringTrendBucket,
} from "@shared/system/action-monitoring-contract";
import type { AuditLogRecord } from "../telemetry/repository";
import { requireRole, requireSession } from "../auth/context";

const HOUR_MS = 3_600_000;

const statusWeight: Record<ActionMonitoringStatus, number> = {
  error: 0,
  warning: 1,
  not_connected: 2,
  healthy: 3,
};

const ACTION_LABELS: Record<string, string> = {
  OPS_RESET_SESSION: "重置 Session",
  OPS_REFRESH_CACHE: "重整快取",
  OPS_RESEND_NOTIFICATION: "重發通知",
  SYSTEM_CONTROL_CENTER_VIEW: "瀏覽控制中心",
  INSIGHTS_VIEW: "瀏覽行為洞察",
  INSIGHTS_DRILL_DOWN: "下鑽行為洞察",
  WATCHDOG_EVENT_VIEW: "瀏覽 Watchdog Events",
  MODULE_HEALTH_VIEW: "瀏覽模組健康",
  INTEGRATION_STATUS_VIEW: "瀏覽整合狀態",
  LINE_WHITELIST_CREATED: "新增 LINE 白名單",
  LINE_WHITELIST_UPDATED: "更新 LINE 白名單",
  ARCHITECTURE_RELATION_VIEW: "瀏覽功能關係",
  TOPOLOGY_VIEW: "瀏覽 Topology",
  AUDIT_LOG_VIEW: "瀏覽 Audit Log",
};

const categorize = (action: string): ActionCategory => {
  const a = action.toUpperCase();
  if (a.startsWith("OPS_")) return "ops";
  if (a.includes("SESSION") || a.includes("LOGIN") || a.includes("LOGOUT")) return "session";
  if (a.includes("WHITELIST") || a.includes("PERMISSION") || a.includes("CAUTION") || a.includes("ROLE")) return "permission";
  if (a.includes("ANNOUNCEMENT") || a.includes("HANDOVER") || a.includes("NOTIFICATION") || a.includes("DOCUMENT")) return "content";
  if (a.startsWith("SYSTEM_") || a.includes("CONTROL_CENTER") || a.includes("MODULE_HEALTH") || a.includes("WATCHDOG") || a.includes("INTEGRATION")) return "system";
  return "other";
};

const deriveLabel = (action: string): string => {
  const known = ACTION_LABELS[action];
  if (known) return known;
  return action
    .toLowerCase()
    .split("_")
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
};

const isFailure = (rec: AuditLogRecord): boolean => {
  if (!rec.resultStatus) return false;
  const s = rec.resultStatus.toLowerCase();
  if (s === "success" || s === "ok" || s === "completed" || s === "applied") return false;
  return true;
};

const deriveStatus = (failureCount: number, totalCount: number): ActionMonitoringStatus => {
  if (totalCount === 0) return "not_connected";
  const rate = failureCount / totalCount;
  if (rate >= 0.5) return "error";
  if (rate > 0) return "warning";
  return "healthy";
};

const buildTrend = (records: AuditLogRecord[]): ActionMonitoringTrendBucket[] => {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const buckets: ActionMonitoringTrendBucket[] = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * HOUR_MS).toISOString();
    buckets.push({ hour, total: 0, failures: 0 });
  }
  const since = now.getTime() - 23 * HOUR_MS;
  for (const rec of records) {
    const t = new Date(rec.timestamp).getTime();
    if (!Number.isFinite(t) || t < since) continue;
    const idx = Math.floor((t - since) / HOUR_MS);
    if (idx < 0 || idx >= 24) continue;
    buckets[idx].total++;
    if (isFailure(rec)) buckets[idx].failures++;
  }
  return buckets;
};

const buildDto = async (container: AppContainer): Promise<ActionMonitoringDto> => {
  const generatedAt = new Date().toISOString();
  const records = await container.repositories.telemetry.listAuditLogs(1000);
  const cutoff = Date.now() - 24 * HOUR_MS;
  const recent = records.filter((rec) => {
    const t = new Date(rec.timestamp).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });

  const byAction = new Map<string, AuditLogRecord[]>();
  for (const rec of recent) {
    const list = byAction.get(rec.action) ?? [];
    list.push(rec);
    byAction.set(rec.action, list);
  }

  const rows: ActionMonitoringRow[] = Array.from(byAction.entries()).map(([action, items]) => {
    const totalCount = items.length;
    const failureCount = items.filter(isFailure).length;
    const successCount = totalCount - failureCount;
    const sorted = [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const latest = sorted[0];
    return {
      id: action,
      action,
      label: deriveLabel(action),
      category: categorize(action),
      totalCount,
      successCount,
      failureCount,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 1000) / 10 : 100,
      status: deriveStatus(failureCount, totalCount),
      lastActorId: latest?.actorId ?? null,
      lastResultStatus: latest?.resultStatus ?? null,
      lastOccurredAt: latest?.timestamp ?? null,
      trend: buildTrend(items),
    };
  });

  rows.sort((a, b) => {
    const w = statusWeight[a.status] - statusWeight[b.status];
    if (w !== 0) return w;
    return b.totalCount - a.totalCount;
  });

  const summary: ActionMonitoringSummary = {
    totalActions: rows.length,
    totalExecutions: rows.reduce((acc, r) => acc + r.totalCount, 0),
    totalFailures: rows.reduce((acc, r) => acc + r.failureCount, 0),
    healthy: rows.filter((r) => r.status === "healthy").length,
    warning: rows.filter((r) => r.status === "warning").length,
    error: rows.filter((r) => r.status === "error").length,
    notConnected: rows.filter((r) => r.status === "not_connected").length,
    lastUpdatedAt: generatedAt,
  };

  return { generatedAt, summary, rows };
};

export const registerActionMonitoringRoutes = (app: Express, container: AppContainer) => {
  app.get(
    "/api/bff/system/action-monitoring",
    requireSession,
    requireRole("system"),
    async (_req, res) => {
      try {
        const dto = await buildDto(container);
        return res.json(dto);
      } catch (error) {
        return res.status(500).json({
          error: "action-monitoring-failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );
};
