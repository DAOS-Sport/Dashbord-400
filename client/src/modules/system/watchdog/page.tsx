import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, PlugZap, X } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";
import { cn } from "@/lib/utils";
import { fetchApiMonitoring, fetchApiMonitoringDetail } from "../api-monitoring/api";
import type {
  ApiMonitoringRow,
  ApiMonitoringStatus,
  ApiMonitoringTrendBucket,
  ApiMonitoringError,
} from "@shared/system/api-monitoring-contract";

type TabKey = "apis" | "alerts" | "integrations";

interface WatchdogEventDto {
  id: number;
  source: string;
  serviceName: string;
  status: string;
  severity: string;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  observedAt: string;
  createdAt: string;
}

interface IntegrationOverviewDto {
  checkedAt: string;
  adapters: Array<{ name: string; mode: string; configured: boolean }>;
}

const fetchWatchdogEvents = () => apiGet<{ items: WatchdogEventDto[] }>("/api/bff/system/watchdog-events");
const fetchIntegrations = () => apiGet<IntegrationOverviewDto>("/api/bff/system/integration-overview");

const statusToneCard: Record<string, string> = {
  healthy: "bg-emerald-50 text-stitch-on-secondary-container",
  warning: "bg-surface-soft text-text-body",
  error: "bg-surface-soft text-red-600",
  not_connected: "bg-surface-base text-text-body",
  ready: "bg-emerald-50 text-stitch-on-secondary-container",
  degraded: "bg-surface-soft text-text-body",
  telemetry_pending: "bg-surface-soft text-text-body",
  critical: "bg-surface-soft text-red-600",
  info: "bg-blue-50 text-blue-600",
};

const apiStatusRank: Record<ApiMonitoringStatus, number> = {
  error: 0,
  warning: 1,
  not_connected: 2,
  healthy: 3,
};

const apiStatusDotClass = (s: ApiMonitoringStatus) => {
  if (s === "healthy") return "bg-surface-soft";
  if (s === "warning") return "bg-surface-soft";
  if (s === "error") return "bg-red-600";
  return "bg-surface-soft";
};

const tabs: Array<{ id: TabKey; label: string }> = [
  { id: "apis", label: "API 列表" },
  { id: "alerts", label: "Alerts" },
  { id: "integrations", label: "Integrations" },
];

const readTabFromUrl = (): TabKey => {
  if (typeof window === "undefined") return "apis";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tabs.some((t) => t.id === tab) ? (tab as TabKey) : "apis";
};

const payloadText = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
};

function padBuckets(trend: ApiMonitoringTrendBucket[]): ApiMonitoringTrendBucket[] {
  const cells = trend.slice(-24);
  while (cells.length < 24) {
    cells.unshift({ hour: "", total: 0, errors: 0, avgDurationMs: null });
  }
  return cells;
}

function TrendSparkline({ trend }: { trend: ApiMonitoringTrendBucket[] }) {
  const cells = useMemo(() => padBuckets(trend), [trend]);
  const maxTotal = Math.max(...cells.map((c) => c.total), 1);
  const hasData = cells.some((c) => c.total > 0);
  const totalErrors = cells.reduce((s, c) => s + c.errors, 0);
  const totalCalls = cells.reduce((s, c) => s + c.total, 0);
  const errorRatio = totalCalls > 0 ? totalErrors / totalCalls : 0;
  const stroke = !hasData ? "var(--ds-border-emphasis)" : errorRatio >= 0.5 ? "var(--ds-state-priority)" : errorRatio > 0 ? "var(--ds-state-must-read)" : "var(--ds-state-success)";
  const n = cells.length;
  const W = 120, H = 22, padX = 2, padY = 2;
  const w = W - padX * 2, h = H - padY * 2;
  const pts = cells.map((cell, i) => ({
    x: padX + (n <= 1 ? w / 2 : (i / (n - 1)) * w),
    y: padY + h - (cell.total / maxTotal) * h,
    cell,
  }));
  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg width={120} height={22} viewBox="0 0 120 22" aria-label="24h 趨勢折線" className="shrink-0">
      {!hasData ? (
        <line x1={2} y1={11} x2={118} y2={11} stroke="var(--ds-border-emphasis)" strokeWidth="1" strokeDasharray="2 2" />
      ) : (
        <>
          <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.filter((p) => p.cell.errors > 0).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2" fill="var(--ds-state-priority)">
              <title>{`${p.cell.hour ? new Date(p.cell.hour).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""} · ${p.cell.total} 次 · ${p.cell.errors} 錯誤`}</title>
            </circle>
          ))}
        </>
      )}
    </svg>
  );
}

function formatMs(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 10) return `${ms.toFixed(1)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function SystemWatchdogPage() {
  const [tab, setTabState] = useState<TabKey>(() => readTabFromUrl());
  const [selectedEvent, setSelectedEvent] = useState<WatchdogEventDto | null>(null);
  const [selectedApi, setSelectedApi] = useState<ApiMonitoringRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | ApiMonitoringStatus>("connected");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  const apiQuery = useQuery({
    queryKey: ["/api/bff/system/api-monitoring", "watchdog-apis"],
    queryFn: () => fetchApiMonitoring("all"),
    refetchInterval: 15_000,
  });
  const eventsQuery = useQuery({
    queryKey: ["/api/bff/system/watchdog-events"],
    queryFn: fetchWatchdogEvents,
    refetchInterval: 15_000,
  });
  const integrationsQuery = useQuery({
    queryKey: ["/api/bff/system/integration-overview"],
    queryFn: fetchIntegrations,
  });

  const setTab = (next: TabKey) => {
    setTabState(next);
    if (typeof window === "undefined") return;
    const search = next === "apis" ? "" : `?tab=${next}`;
    window.history.replaceState(null, "", `/system/watchdog${search}`);
  };

  const allRows = apiQuery.data?.rows ?? [];
  const availableTypes = useMemo(() => Array.from(new Set(allRows.map((r) => r.type))).sort(), [allRows]);

  const apiRows = useMemo(() => {
    return [...allRows]
      .filter((row) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "connected") return row.status !== "not_connected";
        return row.status === statusFilter;
      })
      .filter((row) => typeFilter === "all" || row.type === typeFilter)
      .filter((row) => {
        if (!keyword.trim()) return true;
        const q = keyword.toLowerCase();
        return row.path.toLowerCase().includes(q) || row.label.toLowerCase().includes(q);
      })
      .sort((a, b) => apiStatusRank[a.status] - apiStatusRank[b.status] || b.totalCount - a.totalCount);
  }, [allRows, statusFilter, typeFilter, keyword]);

  const events = useMemo(() => {
    return (eventsQuery.data?.items ?? []).filter(
      (event) => severityFilter === "all" || event.severity === severityFilter,
    );
  }, [eventsQuery.data?.items, severityFilter]);

  const summary = apiQuery.data?.summary;

  return (
    <RoleShell role="system" title="Watchdog" subtitle="CMS 內部 · API 健康監控">
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="system-watchdog-page">
        <WorkbenchCard className="p-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "min-h-10 rounded-[8px] px-4 text-[13px] font-black transition",
                  tab === item.id ? "bg-primary-navy text-white" : "bg-white text-text-body hover:bg-surface-base",
                )}
                data-testid={`tab-${item.id}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </WorkbenchCard>

        {tab === "apis" ? (
          <WorkbenchCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
              <div>
                <h2 className="text-[16px] font-black text-text-strong">API 健康列表</h2>
                <p className="mt-1 text-[12px] font-bold text-text-body">
                  {summary
                    ? `共 ${(summary.connectedApis ?? 0) + (summary.notConnectedApis ?? 0)} 支 API · 已接線 ${summary.connectedApis ?? 0}（${summary.healthyApis} 正常 / ${summary.warningApis} 注意 / ${summary.errorApis} 錯誤）· 未連線 ${summary.notConnectedApis ?? 0} 支（預設隱藏，可切換篩選）`
                    : "讀取中…"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜尋 path / label"
                  className="h-9 w-44 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold"
                  data-testid="search-api"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "connected" | ApiMonitoringStatus)}
                  className="h-9 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold"
                >
                  <option value="connected">已接線（預設）</option>
                  <option value="all">all status</option>
                  <option value="error">error</option>
                  <option value="warning">warning</option>
                  <option value="healthy">healthy</option>
                  <option value="not_connected">not_connected</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-9 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold"
                >
                  <option value="all">all types</option>
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-surface-soft text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">
                  <tr>
                    <th className="px-4 py-3">狀態</th>
                    <th className="px-4 py-3">Method · Path</th>
                    <th className="px-4 py-3">Label</th>
                    <th className="px-4 py-3 text-right">24h Calls</th>
                    <th className="px-4 py-3 text-right">Errors</th>
                    <th className="px-4 py-3 text-right">Avg</th>
                    <th className="px-4 py-3">趨勢 (24h · 小時)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {apiRows.map((row) => (
                    <ApiRow key={row.id} row={row} onSelect={() => setSelectedApi(row)} />
                  ))}
                  {apiRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[13px] font-bold text-text-body">
                        {apiQuery.isLoading ? "讀取中…" : "無符合條件的 API"}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </WorkbenchCard>
        ) : null}

        {tab === "alerts" ? (
          <div className="space-y-4">
            {/* ── 近 24h API 錯誤 ─────────────────────────────── */}
            <WorkbenchCard className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
                <div>
                  <h2 className="text-[16px] font-black text-text-strong">
                    近 24h API 錯誤
                    {(apiQuery.data?.recentErrors ?? []).length > 0 && (
                      <span className="ml-2 rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-black text-red-600">
                        {apiQuery.data!.recentErrors.length}
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 text-[12px] font-bold text-text-body">來自 API 監控的 4xx / 5xx / timeout / aborted 記錄，未標示已處理。</p>
                </div>
              </div>
              {apiQuery.isLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-[8px] bg-surface-base" />)}
                </div>
              ) : (apiQuery.data?.recentErrors ?? []).length === 0 ? (
                <div className="p-8 text-center text-[13px] font-bold text-text-body">最近 24h 無未解決 API 錯誤 🎉</div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {(apiQuery.data!.recentErrors as ApiMonitoringError[]).slice(0, 30).map((err) => (
                    <div key={err.id} className="grid gap-2 p-4 md:grid-cols-[140px_80px_1fr_120px_100px] md:items-center">
                      <span className="text-[11px] font-bold text-text-body">
                        {new Date(err.occurredAt).toLocaleString("zh-TW")}
                      </span>
                      <span className={cn(
                        "w-fit rounded-[4px] px-1.5 py-0.5 text-[10px] font-black",
                        err.errorType === "5xx" ? "bg-surface-soft text-red-600" :
                        err.errorType === "4xx" ? "bg-surface-soft text-text-body" :
                        err.errorType === "timeout" ? "bg-surface-soft text-text-body" :
                        "bg-slate-100 text-text-body"
                      )}>
                        {err.statusCode || err.errorType}
                      </span>
                      <span className="truncate font-mono text-[12px] font-bold text-text-strong">{err.route}</span>
                      <span className="text-[11px] font-bold text-text-muted">{err.errorType}</span>
                      <span className="text-right font-mono text-[11px] font-bold text-text-muted">{err.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              )}
            </WorkbenchCard>

            {/* ── 系統 Watchdog events ──────────────────────────── */}
            <WorkbenchCard className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
                <div>
                  <h2 className="text-[16px] font-black text-text-strong">
                    系統 Watchdog events
                    {events.length > 0 && (
                      <span className="ml-2 rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-black text-text-body">
                        {events.length}
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 text-[12px] font-bold text-text-body">系統主動偵測或後端寫入的異常事件，點擊可展開 payload。</p>
                </div>
                <select
                  value={severityFilter}
                  onChange={(event) => setSeverityFilter(event.target.value)}
                  className="h-9 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold"
                >
                  <option value="all">all severity</option>
                  <option value="critical">critical</option>
                  <option value="warning">warning</option>
                  <option value="info">info</option>
                </select>
              </div>
              <div className="divide-y divide-border-subtle">
                {eventsQuery.isLoading ? (
                  <div className="space-y-2 p-4">
                    {[1, 2].map((n) => <div key={n} className="h-10 animate-pulse rounded-[8px] bg-surface-base" />)}
                  </div>
                ) : events.length === 0 ? (
                  <div className="p-8 text-center text-[13px] font-bold text-text-body">
                    目前沒有 Watchdog events。系統背景若偵測到異常會自動寫入此處。
                  </div>
                ) : (
                  events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEvent(event)}
                      className="grid w-full gap-2 p-4 text-left hover:bg-surface-soft md:grid-cols-[160px_110px_1fr_160px_140px] md:items-center"
                    >
                      <span className="text-[12px] font-bold text-text-body">{new Date(event.observedAt).toLocaleString("zh-TW")}</span>
                      <span className={cn("w-fit rounded-full px-2 py-1 text-[10px] font-black uppercase", statusToneCard[event.severity] ?? statusToneCard.info)}>{event.severity}</span>
                      <span className="truncate text-[13px] font-black text-text-strong">{event.message ?? event.serviceName}</span>
                      <span className="truncate text-[12px] font-bold text-text-body">{event.serviceName}</span>
                      <span className="truncate text-[12px] font-bold text-text-muted">{event.source}</span>
                    </button>
                  ))
                )}
              </div>
            </WorkbenchCard>
          </div>
        ) : null}

        {tab === "integrations" ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {(integrationsQuery.data?.adapters ?? [
              { name: "Ragic", mode: "pending", configured: false },
              { name: "LINE Bot", mode: "pending", configured: false },
              { name: "Smart Schedule", mode: "pending", configured: false },
              { name: "Gmail", mode: "pending", configured: false },
              { name: "Object Storage", mode: "pending", configured: false },
            ]).map((adapter) => (
              <WorkbenchCard key={adapter.name} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn("grid h-10 w-10 place-items-center rounded-[8px]", adapter.configured ? "bg-emerald-50 text-emerald-600" : "bg-surface-base text-text-body")}>
                      {adapter.configured ? <PlugZap className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-[15px] font-black text-text-strong">{adapter.name}</p>
                      <p className="mt-1 text-[12px] font-bold text-text-body">mode: {adapter.mode}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", adapter.configured ? "bg-emerald-50 text-stitch-on-secondary-container" : "bg-surface-base text-text-body")}>
                    {adapter.configured ? "connected" : "reserved"}
                  </span>
                </div>
                <button type="button" disabled className="mt-5 min-h-9 rounded-[8px] border border-border-default bg-surface-soft px-3 text-[12px] font-black text-text-muted">
                  Test connection（下版啟用）
                </button>
              </WorkbenchCard>
            ))}
          </div>
        ) : null}

        {selectedApi ? (
          <ApiDetailPanel row={selectedApi} onClose={() => setSelectedApi(null)} />
        ) : null}

        {selectedEvent ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-text-strong/30">
            <div className="h-full w-full max-w-[620px] overflow-y-auto bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-text-muted">Watchdog payload</p>
                  <h2 className="mt-1 text-[20px] font-black text-text-strong">{selectedEvent.message ?? selectedEvent.serviceName}</h2>
                </div>
                <button type="button" onClick={() => setSelectedEvent(null)} className="grid h-10 w-10 place-items-center rounded-[8px] border border-border-default">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <dl className="mt-5 grid gap-3 text-[13px]">
                {[
                  ["severity", selectedEvent.severity],
                  ["status", selectedEvent.status],
                  ["source", selectedEvent.source],
                  ["service", selectedEvent.serviceName],
                  ["observedAt", selectedEvent.observedAt],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[8px] bg-surface-soft p-3">
                    <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">{label}</dt>
                    <dd className="mt-1 font-mono text-[12px] font-bold text-text-strong">{value}</dd>
                  </div>
                ))}
              </dl>
              <pre className="mt-5 max-h-[520px] overflow-auto rounded-[8px] bg-primary-navy p-4 text-[12px] leading-5 text-white">{payloadText(selectedEvent.payload)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </RoleShell>
  );
}

function ApiRow({ row, onSelect }: { row: ApiMonitoringRow; onSelect: () => void }) {
  return (
    <tr className="cursor-pointer align-middle transition hover:bg-surface-soft" onClick={onSelect} data-testid={`api-row-${row.id}`}>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-black text-text-strong">
          <span className={cn("h-2 w-2 rounded-full", apiStatusDotClass(row.status))} />
          {row.status}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-[11px] font-bold">
        <span className="mr-2 inline-block rounded-[4px] bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-text-body">{row.method}</span>
        <span className="text-text-strong">{row.path}</span>
      </td>
      <td className="px-4 py-3 text-[12px] font-bold text-text-body">
        {row.label}
        {row.skipped && <span className="ml-2 inline-block rounded-[4px] bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-text-muted" title="已排除計數">略過</span>}
      </td>
      <td className="px-4 py-3 text-right font-mono text-[12px] font-black text-text-strong">{row.totalCount.toLocaleString()}</td>
      <td className="px-4 py-3 text-right font-mono text-[12px] font-black">
        <span className={row.errorCount > 0 ? "text-red-600" : "text-text-muted"}>{row.errorCount}</span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-[12px] font-bold text-text-body">{formatMs(row.avgDurationMs)}</td>
      <td className="px-4 py-3">
        <TrendSparkline trend={row.trend} />
      </td>
    </tr>
  );
}

function LargeTrendSparkline({ trend }: { trend: ApiMonitoringTrendBucket[] }) {
  const cells = useMemo(() => padBuckets(trend), [trend]);
  const maxTotal = Math.max(...cells.map((c) => c.total), 1);
  const hasData = cells.some((c) => c.total > 0);
  const totalErrors = cells.reduce((s, c) => s + c.errors, 0);
  const totalCalls = cells.reduce((s, c) => s + c.total, 0);
  const errorRatio = totalCalls > 0 ? totalErrors / totalCalls : 0;
  const stroke = !hasData ? "var(--ds-border-emphasis)" : errorRatio >= 0.5 ? "var(--ds-state-priority)" : errorRatio > 0 ? "var(--ds-state-must-read)" : "var(--ds-state-success)";
  const W = 320, H = 72, padX = 4, padY = 6, labelH = 14;
  const w = W - padX * 2, h = H - padY * 2 - labelH;
  const n = cells.length;
  const pts = cells.map((cell, i) => ({
    x: padX + (n <= 1 ? w / 2 : (i / (n - 1)) * w),
    y: padY + h - (cell.total / maxTotal) * h,
    cell,
    hour: cell.hour ? new Date(cell.hour).getHours() : null,
  }));
  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const maxDuration = Math.max(...cells.map((c) => c.avgDurationMs ?? 0), 1);
  const hasDuration = cells.some((c) => c.avgDurationMs != null && c.avgDurationMs > 0);
  const durationValidPts = cells
    .map((cell, i) => ({
      x: padX + (n <= 1 ? w / 2 : (i / (n - 1)) * w),
      y: padY + h - ((cell.avgDurationMs ?? 0) / maxDuration) * h,
      valid: cell.avgDurationMs != null,
    }))
    .filter((p) => p.valid);
  const durationPolyline = durationValidPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <div className="space-y-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="rounded-[6px] bg-surface-soft" style={{ height: "80px" }} aria-label="近 24h 每小時趨勢折線">
        {!hasData ? (
          <line x1={padX} y1={(H - labelH) / 2} x2={W - padX} y2={(H - labelH) / 2} stroke="var(--ds-border-emphasis)" strokeWidth="1" strokeDasharray="3 3" />
        ) : (
          <>
            <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {hasDuration && durationValidPts.length > 1 && (
              <polyline points={durationPolyline} fill="none" stroke="var(--ds-state-reminder)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="3 2" opacity="0.8" />
            )}
            {pts.filter((p) => p.cell.errors > 0).map((p, i) => (
              <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill="var(--ds-state-priority)">
                <title>{`${p.hour != null ? String(p.hour).padStart(2, "0") + ":00" : ""} · ${p.cell.total} 次 · ${p.cell.errors} 錯誤${p.cell.avgDurationMs != null ? ` · ${Math.round(p.cell.avgDurationMs)}ms` : ""}`}</title>
              </circle>
            ))}
          </>
        )}
        {pts.filter((_, i) => i % 3 === 0).map((p, i) =>
          p.hour !== null ? (
            <text key={i} x={p.x.toFixed(1)} y={H - 2} textAnchor="middle" fontSize="7" fill="var(--ds-text-muted)" fontFamily="monospace">
              {String(p.hour).padStart(2, "0")}
            </text>
          ) : null,
        )}
      </svg>
      <div className="flex items-center gap-3 text-[10px] font-bold text-text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-[1px] bg-surface-soft" /> 正常</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-[1px] bg-surface-soft" /> 有錯誤</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-[1px] bg-red-600" /> ≥50% 錯誤</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /> 錯誤點</span>
        <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-4 rounded-[1px] bg-surface-soft" style={{ borderTop: "1.5px dashed var(--ds-state-reminder)" }} /> Avg 延遲</span>
      </div>
    </div>
  );
}

function ApiDetailPanel({ row, onClose }: { row: ApiMonitoringRow; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ["/api/bff/system/api-monitoring/detail", row.id, row.projectKey],
    queryFn: () =>
      fetchApiMonitoringDetail(row.projectKey, row.id, {
        route: row.path,
        label: row.label,
        method: row.method,
        status: row.status,
        checkedAt: row.lastCheckedAt,
        durationMs: row.avgDurationMs,
        statusCode: row.statusCode ?? null,
      }),
    retry: 1,
  });

  const detail = detailQuery.data;
  const trend = detail?.hourlyBuckets ?? row.trend;
  const unresolvedErrors = detail?.unresolvedErrorGroups ?? [];
  const recentRecords = detail?.recentRecords ?? [];
  const statusToneText: Record<ApiMonitoringStatus, { label: string; color: string }> = {
    healthy: { label: "正常", color: "text-text-body" },
    warning: { label: "注意", color: "text-text-body" },
    error: { label: "錯誤", color: "text-red-600" },
    not_connected: { label: "未連線", color: "text-text-body" },
  };
  const tone = statusToneText[row.status];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-text-strong/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-[720px] overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-5">
          <div className="flex items-center gap-3">
            <span className={cn("h-2.5 w-2.5 rounded-full", apiStatusDotClass(row.status))} />
            <span className={cn("text-[14px] font-black", tone.color)}>{tone.label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[8px] border border-border-default hover:bg-surface-base"
            data-testid="api-detail-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-black leading-tight text-text-strong">{row.label}</h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-[4px] bg-slate-100 px-2 py-1 text-[11px] font-black text-text-body">{row.method}</span>
              <span className="break-all font-mono text-[12px] font-bold text-text-body">{row.path}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[28px] font-black text-text-strong">{row.totalCount.toLocaleString()}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">CALLS · 24H</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-5">
          <div className="rounded-[8px] border border-border-subtle bg-surface-soft p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">Errors 24h</p>
            <p className={cn("mt-1 font-mono text-[20px] font-black", row.errorCount > 0 ? "text-red-600" : "text-text-strong")}>
              {row.errorCount}
            </p>
          </div>
          <div className="rounded-[8px] border border-border-subtle bg-surface-soft p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">Avg Duration</p>
            <p className="mt-1 font-mono text-[20px] font-black text-text-strong">{formatMs(row.avgDurationMs)}</p>
          </div>
          <div className="rounded-[8px] border border-border-subtle bg-surface-soft p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">未解決 / 已解決</p>
            <p className="mt-1 font-mono text-[20px] font-black text-text-strong">
              {row.unresolvedErrorCount} <span className="text-[14px] text-text-muted">/ {row.resolvedErrorCount}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 px-5 py-5">
          <h3 className="text-[13px] font-black text-text-strong">24h 趨勢 (每小時)</h3>
          <LargeTrendSparkline trend={trend} />
        </div>

        {detailQuery.isLoading ? (
          <div className="px-5 py-3 text-[12px] font-bold text-text-body">讀取詳細資料中…</div>
        ) : (
          <>
            {unresolvedErrors.length > 0 && (
              <div className="border-t border-border-subtle px-5 py-5">
                <h3 className="text-[13px] font-black text-text-strong">未解決錯誤 ({unresolvedErrors.length})</h3>
                <ul className="mt-3 space-y-2">
                  {unresolvedErrors.slice(0, 8).map((g) => (
                    <li key={g.fingerprint} className="rounded-[8px] border border-border-subtle bg-surface-soft p-3 text-[12px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-black text-text-strong">{g.statusCode} · {g.errorType}</span>
                        <span className="font-mono text-[11px] font-bold text-text-muted">{new Date(g.lastOccurredAt).toLocaleString("zh-TW")}</span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] font-bold text-text-body">{g.route}</p>
                      <p className="mt-1 text-[11px] font-bold text-text-body">出現 {g.count} 次{g.avgDurationMs != null ? ` · 平均 ${Math.round(g.avgDurationMs)}ms` : ""}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recentRecords.length > 0 && (
              <div className="border-t border-border-subtle px-5 py-5">
                <h3 className="text-[13px] font-black text-text-strong">最近呼叫 ({recentRecords.length})</h3>
                <ul className="mt-3 space-y-1">
                  {recentRecords.slice(0, 10).map((rec) => (
                    <li key={rec.id} className="flex items-center justify-between gap-2 rounded-[6px] bg-surface-soft px-3 py-2 text-[11px]">
                      <span className={cn("font-mono font-black", rec.errorType ? "text-red-600" : "text-text-body")}>{rec.statusCode}</span>
                      <span className="flex-1 font-mono text-text-body">{rec.durationMs}ms</span>
                      <span className="font-mono text-text-muted">{new Date(rec.occurredAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
