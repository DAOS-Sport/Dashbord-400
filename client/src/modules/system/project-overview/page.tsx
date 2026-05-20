import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock, RefreshCw, TriangleAlert, XCircle, Activity, AlertOctagon, ListChecks } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";
import { cn } from "@/lib/utils";
import { fetchSystemProjectMonitoring } from "../project-monitoring/api";
import { fetchApiMonitoring } from "../api-monitoring/api";
import type { SystemProjectStatus, SystemProjectSummary } from "@shared/system/project-monitoring-contract";
import type { ApiMonitoringError } from "@shared/system/api-monitoring-contract";

interface WatchdogEventDto {
  id: number;
  source: string;
  serviceName: string;
  status: string;
  severity: string;
  message?: string | null;
  observedAt: string;
}

interface RecentAssist {
  id?: number;
  action: string;
  resource: string;
  resultStatus?: string;
  createdAt: string;
}

const fetchWatchdogEvents = () => apiGet<{ items: WatchdogEventDto[] }>("/api/bff/system/watchdog-events");
const fetchRecentAssists = () => apiGet<{ items: RecentAssist[] }>("/api/bff/system/operations/recent-assists?limit=50");

const statusDotClass = (s: SystemProjectStatus) => {
  if (s === "ready") return "bg-[#22c55e]";
  if (s === "degraded") return "bg-[#f59e0b]";
  if (s === "error") return "bg-[#dc2626]";
  return "bg-[#9ca3af]";
};

const statusToneClass = (s: SystemProjectStatus) => {
  if (s === "ready") return "text-[#188249]";
  if (s === "degraded") return "text-[#9b6a00]";
  if (s === "error") return "text-[#dc2626]";
  return "text-[#536175]";
};

const statusLabel = (s: SystemProjectStatus) => {
  if (s === "ready") return "正常";
  if (s === "degraded") return "注意";
  if (s === "error") return "錯誤";
  return "未連線";
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}

const ERROR_TONE: Record<string, string> = {
  "5xx": "text-[#dc2626] bg-[#ffe8eb]",
  "4xx": "text-[#9b6a00] bg-[#fff6e7]",
  "timeout": "text-[#9b6a00] bg-[#fff6e7]",
  "aborted": "text-[#536175] bg-[#eef2f6]",
};

function StatusBanner({
  attention,
  hasError,
  generatedAt,
  isFetching,
  isError,
  onRefresh,
  projectCount,
}: {
  attention: number;
  hasError: boolean;
  generatedAt?: string;
  isFetching: boolean;
  isError: boolean;
  onRefresh: () => void;
  projectCount: number;
}) {
  const ok = attention === 0;
  const bg = ok ? "bg-[#eaf8ef]" : hasError ? "bg-[#ffe8eb]" : "bg-[#fff6e7]";
  const Icon = ok ? CheckCircle2 : hasError ? XCircle : TriangleAlert;
  const iconColor = ok ? "text-[#188249]" : hasError ? "text-[#dc2626]" : "text-[#9b6a00]";
  const text = ok ? "系統運作正常" : hasError ? `需注意 (${attention}) — 含錯誤` : `需注意 (${attention})`;

  return (
    <WorkbenchCard className={cn("flex items-center justify-between gap-4 px-6 py-5", bg)}>
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/80">
          <Icon className={cn("h-6 w-6", iconColor)} />
        </span>
        <div>
          <p className="text-[22px] font-black leading-tight text-[#10233f]">{text}</p>
          <p className="text-[12px] font-bold text-[#637185]">{projectCount} 個父系統 · 30 秒自動更新</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {generatedAt && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#637185]">
            <Clock className="h-3.5 w-3.5" />
            <span>
              最後同步 {new Date(generatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="flex h-8 items-center gap-1.5 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb] disabled:opacity-50"
          data-testid="button-refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          重新整理
        </button>
        {isError && (
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#dc2626]">
            <XCircle className="h-3.5 w-3.5" />
            資料讀取失敗
          </span>
        )}
      </div>
    </WorkbenchCard>
  );
}

function RecentErrorsWidget({ errors, isLoading }: { errors: ApiMonitoringError[]; isLoading: boolean }) {
  const top5 = errors.slice(0, 5);
  return (
    <WorkbenchCard className="flex flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertOctagon className="h-4 w-4 text-[#dc2626]" />
        <h2 className="text-[14px] font-black text-[#10233f]">近 24h 錯誤</h2>
        <span className="rounded-full bg-[#ffe8eb] px-2 py-0.5 text-[11px] font-black text-[#dc2626]">{errors.length}</span>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 animate-pulse rounded-[8px] bg-[#f3f6fb]" />
          ))}
        </div>
      ) : top5.length === 0 ? (
        <p className="rounded-[8px] bg-[#fbfcfd] px-3 py-6 text-center text-[12px] font-bold text-[#637185]">最近 24h 無錯誤 🎉</p>
      ) : (
        <ul className="flex-1 space-y-1.5">
          {top5.map((err) => (
            <li key={err.id}>
              <Link
                href="/system/watchdog?tab=alerts"
                className="group flex items-center gap-3 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-2.5 hover:border-[#c5d0db] hover:bg-white"
                data-testid={`error-row-${err.id}`}
              >
                <span className={cn("inline-flex h-5 shrink-0 items-center rounded-[4px] px-1.5 text-[10px] font-black", ERROR_TONE[err.errorType] ?? "text-[#536175] bg-[#eef2f6]")}>
                  {err.statusCode || err.errorType}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-bold text-[#10233f]">{err.route}</span>
                <span className="shrink-0 text-[10px] font-bold text-[#8b9aae]">{formatRelative(err.occurredAt)}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#c5d0db] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/system/watchdog?tab=alerts"
        className="mt-3 inline-flex items-center gap-1 self-start text-[11px] font-black text-[#5e6e84] hover:text-[#10233f]"
      >
        全部錯誤 →
      </Link>
    </WorkbenchCard>
  );
}

function PendingWidget({
  criticalEvents,
  warningEvents,
  failedOps,
  isLoading,
}: {
  criticalEvents: number;
  warningEvents: number;
  failedOps: number;
  isLoading: boolean;
}) {
  const total = criticalEvents + warningEvents + failedOps;
  const rows = [
    { label: "Critical 告警", count: criticalEvents, tone: "text-[#dc2626] bg-[#ffe8eb]", href: "/system/watchdog?tab=alerts" },
    { label: "Warning 告警", count: warningEvents, tone: "text-[#9b6a00] bg-[#fff6e7]", href: "/system/watchdog?tab=alerts" },
    { label: "失敗 ops 介入", count: failedOps, tone: "text-[#536175] bg-[#eef2f6]", href: "/system/operations?tab=audit" },
  ];

  return (
    <WorkbenchCard className="flex flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[#5e6e84]" />
        <h2 className="text-[14px] font-black text-[#10233f]">需處理</h2>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-black", total > 0 ? "bg-[#fff6e7] text-[#9b6a00]" : "bg-[#eaf8ef] text-[#188249]")}>{total}</span>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 animate-pulse rounded-[8px] bg-[#f3f6fb]" />
          ))}
        </div>
      ) : total === 0 ? (
        <p className="rounded-[8px] bg-[#fbfcfd] px-3 py-6 text-center text-[12px] font-bold text-[#637185]">無待處理項目 ✨</p>
      ) : (
        <ul className="flex-1 space-y-1.5">
          {rows.filter((r) => r.count > 0).map((row) => (
            <li key={row.label}>
              <Link
                href={row.href}
                className="group flex items-center gap-3 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 hover:border-[#c5d0db] hover:bg-white"
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-[12px] font-black", row.tone)}>{row.count}</span>
                <span className="flex-1 text-[13px] font-bold text-[#10233f]">{row.label}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#c5d0db] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WorkbenchCard>
  );
}

function buildHourBuckets(events: WatchdogEventDto[]) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const buckets: Array<{ hour: Date; events: WatchdogEventDto[]; severity: "info" | "warning" | "critical" | "none" }> = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3_600_000);
    buckets.push({ hour, events: [], severity: "none" });
  }
  const sinceMs = now.getTime() - 23 * 3_600_000;
  for (const ev of events) {
    const t = new Date(ev.observedAt).getTime();
    if (Number.isNaN(t) || t < sinceMs) continue;
    const idx = Math.floor((t - sinceMs) / 3_600_000);
    if (idx < 0 || idx >= 24) continue;
    buckets[idx].events.push(ev);
    if (ev.severity === "critical") buckets[idx].severity = "critical";
    else if (ev.severity === "warning" && buckets[idx].severity !== "critical") buckets[idx].severity = "warning";
    else if (ev.severity === "info" && buckets[idx].severity === "none") buckets[idx].severity = "info";
  }
  return buckets;
}

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-[#dc2626]",
  warning: "bg-[#f59e0b]",
  info: "bg-[#60a5fa]",
  none: "bg-[#eef2f6]",
};

function TimelineWidget({ events, isLoading }: { events: WatchdogEventDto[]; isLoading: boolean }) {
  const buckets = useMemo(() => buildHourBuckets(events), [events]);

  return (
    <WorkbenchCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#5e6e84]" />
          <h2 className="text-[14px] font-black text-[#10233f]">24h 狀態變動時間軸</h2>
          <span className="rounded-full bg-[#eef2f6] px-2 py-0.5 text-[11px] font-black text-[#536175]">{events.length} 事件</span>
        </div>
        <Link href="/system/watchdog?tab=alerts" className="text-[11px] font-black text-[#5e6e84] hover:text-[#10233f]">
          完整時間軸 →
        </Link>
      </div>
      {isLoading ? (
        <div className="h-10 animate-pulse rounded-[8px] bg-[#f3f6fb]" />
      ) : (
        <>
          <div className="flex gap-1">
            {buckets.map((b, idx) => {
              const intensity = Math.min(b.events.length, 5);
              const opacityClass = b.severity === "none" ? "" : `opacity-${30 + intensity * 14}`;
              return (
                <div key={idx} className="group relative flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn(
                      "h-8 w-full rounded-[3px] transition",
                      SEVERITY_BG[b.severity],
                      b.events.length > 0 && "hover:ring-2 hover:ring-[#10233f]",
                      opacityClass,
                    )}
                    title={`${b.hour.getHours()}:00 — ${b.events.length} 事件${b.severity !== "none" ? ` (max ${b.severity})` : ""}`}
                    data-testid={`timeline-hour-${idx}`}
                  />
                  {idx % 4 === 0 && (
                    <span className="text-[9px] font-mono font-bold text-[#8b9aae]">{b.hour.getHours().toString().padStart(2, "0")}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] font-bold text-[#8b9aae]">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#dc2626]" /> Critical</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#f59e0b]" /> Warning</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#60a5fa]" /> Info</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#eef2f6]" /> 無事件</span>
          </div>
        </>
      )}
    </WorkbenchCard>
  );
}

function ProjectStrip({ items, isLoading }: { items: SystemProjectSummary[]; isLoading: boolean }) {
  return (
    <WorkbenchCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-black text-[#10233f]">專案速覽</h2>
        <Link href="/system/governance" className="text-[11px] font-black text-[#5e6e84] hover:text-[#10233f]">
          查看治理面 →
        </Link>
      </div>
      {isLoading ? (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="h-8 w-24 animate-pulse rounded-[8px] bg-[#f3f6fb]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const href = item.key === "governance" ? "/system/governance" : item.monitorHref;
            return (
              <Link
                key={item.key}
                href={href}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[#edf1f6] bg-white px-3 py-2 text-[12px] font-black text-[#10233f] hover:border-[#c5d0db] hover:bg-[#f3f6fb]"
                data-testid={`project-strip-${item.key}`}
              >
                <span className={cn("h-2 w-2 rounded-full", statusDotClass(item.status))} />
                <span>{item.label}</span>
                <span className={cn("text-[10px] font-black", statusToneClass(item.status))}>{statusLabel(item.status)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </WorkbenchCard>
  );
}

export default function SystemProjectOverviewPage() {
  const projectsQuery = useQuery({
    queryKey: ["/api/bff/system/project-monitoring"],
    queryFn: fetchSystemProjectMonitoring,
    refetchInterval: 30_000,
  });
  const apiMonQuery = useQuery({
    queryKey: ["/api/bff/system/api-monitoring", "all"],
    queryFn: () => fetchApiMonitoring("all"),
    refetchInterval: 60_000,
    retry: 1,
  });
  const watchdogQuery = useQuery({
    queryKey: ["/api/bff/system/watchdog-events", "project-overview"],
    queryFn: fetchWatchdogEvents,
    refetchInterval: 30_000,
    retry: 1,
  });
  const opsQuery = useQuery({
    queryKey: ["/api/bff/system/operations/recent-assists", "project-overview"],
    queryFn: fetchRecentAssists,
    refetchInterval: 60_000,
    retry: 1,
  });

  const allItems = projectsQuery.data?.items ?? [];
  const items = allItems.filter((i) => i.key !== "governance");
  const generatedAt = projectsQuery.data?.generatedAt;
  const attention = items.filter((i) => i.status === "error" || i.status === "degraded").length;
  const hasError = items.some((i) => i.status === "error");

  const recentErrors = apiMonQuery.data?.recentErrors ?? [];
  const events = watchdogQuery.data?.items ?? [];

  const cutoff = Date.now() - 24 * 3_600_000;
  const recentEvents = events.filter((e) => new Date(e.observedAt).getTime() >= cutoff);
  const criticalCount = recentEvents.filter((e) => e.severity === "critical").length;
  const warningCount = recentEvents.filter((e) => e.severity === "warning").length;
  const recentAssists = opsQuery.data?.items ?? [];
  const failedOps = recentAssists.filter((a) => {
    const t = new Date(a.createdAt).getTime();
    if (Number.isNaN(t) || t < cutoff) return false;
    const status = (a.resultStatus ?? "").toLowerCase();
    return status && status !== "success";
  }).length;

  const handleRefresh = () => {
    projectsQuery.refetch();
    apiMonQuery.refetch();
    watchdogQuery.refetch();
    opsQuery.refetch();
  };

  return (
    <RoleShell role="system" title="IT 首頁" subtitle="IT PROJECT OVERVIEW">
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="system-project-overview-page">
        <StatusBanner
          attention={attention}
          hasError={hasError}
          generatedAt={generatedAt}
          isFetching={projectsQuery.isFetching || apiMonQuery.isFetching || watchdogQuery.isFetching}
          isError={projectsQuery.isError}
          onRefresh={handleRefresh}
          projectCount={items.length}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <RecentErrorsWidget errors={recentErrors} isLoading={apiMonQuery.isLoading} />
          <PendingWidget
            criticalEvents={criticalCount}
            warningEvents={warningCount}
            failedOps={failedOps}
            isLoading={watchdogQuery.isLoading || opsQuery.isLoading}
          />
        </div>

        <TimelineWidget events={recentEvents} isLoading={watchdogQuery.isLoading} />

        <ProjectStrip items={allItems} isLoading={projectsQuery.isLoading} />
      </div>
    </RoleShell>
  );
}
