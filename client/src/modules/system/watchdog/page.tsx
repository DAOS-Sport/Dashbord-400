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
  healthy: "bg-[#eaf8ef] text-[#007166]",
  warning: "bg-[#fff6e7] text-[#9b6a00]",
  error: "bg-[#ffe8eb] text-[#dc2626]",
  not_connected: "bg-[#f3f6fb] text-[#6b7280]",
  ready: "bg-[#eaf8ef] text-[#007166]",
  degraded: "bg-[#fff6e7] text-[#9b6a00]",
  telemetry_pending: "bg-[#fff6e7] text-[#9b6a00]",
  critical: "bg-[#ffe8eb] text-[#dc2626]",
  info: "bg-[#eef5ff] text-[#2f6fe8]",
};

const apiStatusRank: Record<ApiMonitoringStatus, number> = {
  error: 0,
  warning: 1,
  not_connected: 2,
  healthy: 3,
};

const apiStatusDotClass = (s: ApiMonitoringStatus) => {
  if (s === "healthy") return "bg-[#22c55e]";
  if (s === "warning") return "bg-[#f59e0b]";
  if (s === "error") return "bg-[#dc2626]";
  return "bg-[#9ca3af]";
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
  const stroke = !hasData ? "#c8d0da" : errorRatio >= 0.5 ? "#dc2626" : errorRatio > 0 ? "#f59e0b" : "#22c55e";
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
        <line x1={2} y1={11} x2={118} y2={11} stroke="#c8d0da" strokeWidth="1" strokeDasharray="2 2" />
      ) : (
        <>
          <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.filter((p) => p.cell.errors > 0).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2" fill="#dc2626">
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
    refetchInterval: 60_000,
  });
  const eventsQuery = useQuery({
    queryKey: ["/api/bff/system/watchdog-events"],
    queryFn: fetchWatchdogEvents,
    refetchInterval: 30_000,
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
                  tab === item.id ? "bg-[#0d2a50] text-white" : "bg-white text-[#637185] hover:bg-[#f3f6fb]",
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] p-4">
              <div>
                <h2 className="text-[16px] font-black text-[#10233f]">API 健康列表</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">
                  {summary
                    ? `共 ${summary.connectedApis ?? summary.totalApis} 支已接線 · ${summary.healthyApis} 正常 / ${summary.warningApis} 注意 / ${summary.errorApis} 錯誤 · 未連線 ${summary.notConnectedApis} 支（預設隱藏，可切換篩選）`
                    : "讀取中…"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜尋 path / label"
                  className="h-9 w-44 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold"
                  data-testid="search-api"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "connected" | ApiMonitoringStatus)}
                  className="h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold"
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
                  className="h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold"
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
                <thead className="bg-[#f7f9fb] text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">
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
                <tbody className="divide-y divide-[#edf1f6]">
                  {apiRows.map((row) => (
                    <ApiRow key={row.id} row={row} onSelect={() => setSelectedApi(row)} />
                  ))}
                  {apiRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[13px] font-bold text-[#637185]">
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
          <WorkbenchCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] p-4">
              <div>
                <h2 className="text-[16px] font-black text-[#10233f]">Watchdog events</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">點擊 row 可展開 payload、routePath、endpoint 與 correlationId。</p>
              </div>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
                className="h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold"
              >
                <option value="all">all severity</option>
                <option value="critical">critical</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
              </select>
            </div>
            <div className="divide-y divide-[#edf1f6]">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                  className="grid w-full gap-2 p-4 text-left hover:bg-[#fbfcfd] md:grid-cols-[160px_110px_1fr_160px_140px] md:items-center"
                >
                  <span className="text-[12px] font-bold text-[#637185]">{new Date(event.observedAt).toLocaleString("zh-TW")}</span>
                  <span className={cn("w-fit rounded-full px-2 py-1 text-[10px] font-black uppercase", statusToneCard[event.severity] ?? statusToneCard.info)}>{event.severity}</span>
                  <span className="truncate text-[13px] font-black text-[#10233f]">{event.message ?? event.serviceName}</span>
                  <span className="truncate text-[12px] font-bold text-[#637185]">{event.serviceName}</span>
                  <span className="truncate text-[12px] font-bold text-[#8b9aae]">{event.source}</span>
                </button>
              ))}
              {!events.length ? <div className="p-8 text-center text-[13px] font-bold text-[#637185]">目前沒有 Watchdog events。</div> : null}
            </div>
          </WorkbenchCard>
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
                    <div className={cn("grid h-10 w-10 place-items-center rounded-[8px]", adapter.configured ? "bg-[#eaf8ef] text-[#15935d]" : "bg-[#f3f6fb] text-[#6b7280]")}>
                      {adapter.configured ? <PlugZap className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-[15px] font-black text-[#10233f]">{adapter.name}</p>
                      <p className="mt-1 text-[12px] font-bold text-[#637185]">mode: {adapter.mode}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", adapter.configured ? "bg-[#eaf8ef] text-[#007166]" : "bg-[#f3f6fb] text-[#6b7280]")}>
                    {adapter.configured ? "connected" : "reserved"}
                  </span>
                </div>
                <button type="button" disabled className="mt-5 min-h-9 rounded-[8px] border border-[#dfe7ef] bg-[#f7f9fb] px-3 text-[12px] font-black text-[#8b9aae]">
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
          <div className="fixed inset-0 z-50 flex justify-end bg-[#10233f]/30">
            <div className="h-full w-full max-w-[620px] overflow-y-auto bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">Watchdog payload</p>
                  <h2 className="mt-1 text-[20px] font-black text-[#10233f]">{selectedEvent.message ?? selectedEvent.serviceName}</h2>
                </div>
                <button type="button" onClick={() => setSelectedEvent(null)} className="grid h-10 w-10 place-items-center rounded-[8px] border border-[#dfe7ef]">
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
                  <div key={label} className="rounded-[8px] bg-[#fbfcfd] p-3">
                    <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">{label}</dt>
                    <dd className="mt-1 font-mono text-[12px] font-bold text-[#10233f]">{value}</dd>
                  </div>
                ))}
              </dl>
              <pre className="mt-5 max-h-[520px] overflow-auto rounded-[8px] bg-[#0d2a50] p-4 text-[12px] leading-5 text-white">{payloadText(selectedEvent.payload)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </RoleShell>
  );
}

function ApiRow({ row, onSelect }: { row: ApiMonitoringRow; onSelect: () => void }) {
  return (
    <tr className="cursor-pointer align-middle transition hover:bg-[#fbfcfd]" onClick={onSelect} data-testid={`api-row-${row.id}`}>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-black text-[#10233f]">
          <span className={cn("h-2 w-2 rounded-full", apiStatusDotClass(row.status))} />
          {row.status}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-[11px] font-bold">
        <span className="mr-2 inline-block rounded-[4px] bg-[#eef2f6] px-1.5 py-0.5 text-[10px] font-black text-[#536175]">{row.method}</span>
        <span className="text-[#10233f]">{row.path}</span>
      </td>
      <td className="px-4 py-3 text-[12px] font-bold text-[#536175]">{row.label}</td>
      <td className="px-4 py-3 text-right font-mono text-[12px] font-black text-[#10233f]">{row.totalCount.toLocaleString()}</td>
      <td className="px-4 py-3 text-right font-mono text-[12px] font-black">
        <span className={row.errorCount > 0 ? "text-[#dc2626]" : "text-[#8b9aae]"}>{row.errorCount}</span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-[12px] font-bold text-[#536175]">{formatMs(row.avgDurationMs)}</td>
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
  const stroke = !hasData ? "#c8d0da" : errorRatio >= 0.5 ? "#dc2626" : errorRatio > 0 ? "#f59e0b" : "#22c55e";
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
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="rounded-[6px] bg-[#fbfcfd]" style={{ height: "80px" }} aria-label="近 24h 每小時趨勢折線">
        {!hasData ? (
          <line x1={padX} y1={(H - labelH) / 2} x2={W - padX} y2={(H - labelH) / 2} stroke="#c8d0da" strokeWidth="1" strokeDasharray="3 3" />
        ) : (
          <>
            <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {hasDuration && durationValidPts.length > 1 && (
              <polyline points={durationPolyline} fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="3 2" opacity="0.8" />
            )}
            {pts.filter((p) => p.cell.errors > 0).map((p, i) => (
              <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill="#dc2626">
                <title>{`${p.hour != null ? String(p.hour).padStart(2, "0") + ":00" : ""} · ${p.cell.total} 次 · ${p.cell.errors} 錯誤${p.cell.avgDurationMs != null ? ` · ${Math.round(p.cell.avgDurationMs)}ms` : ""}`}</title>
              </circle>
            ))}
          </>
        )}
        {pts.filter((_, i) => i % 3 === 0).map((p, i) =>
          p.hour !== null ? (
            <text key={i} x={p.x.toFixed(1)} y={H - 2} textAnchor="middle" fontSize="7" fill="#8b9aae" fontFamily="monospace">
              {String(p.hour).padStart(2, "0")}
            </text>
          ) : null,
        )}
      </svg>
      <div className="flex items-center gap-3 text-[10px] font-bold text-[#8b9aae]">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-[1px] bg-[#22c55e]" /> 正常</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-[1px] bg-[#f59e0b]" /> 有錯誤</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-[1px] bg-[#dc2626]" /> ≥50% 錯誤</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#dc2626]" /> 錯誤點</span>
        <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-4 rounded-[1px] bg-[#93c5fd]" style={{ borderTop: "1.5px dashed #93c5fd" }} /> Avg 延遲</span>
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
    healthy: { label: "正常", color: "text-[#188249]" },
    warning: { label: "注意", color: "text-[#9b6a00]" },
    error: { label: "錯誤", color: "text-[#dc2626]" },
    not_connected: { label: "未連線", color: "text-[#536175]" },
  };
  const tone = statusToneText[row.status];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#10233f]/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-[720px] overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#edf1f6] p-5">
          <div className="flex items-center gap-3">
            <span className={cn("h-2.5 w-2.5 rounded-full", apiStatusDotClass(row.status))} />
            <span className={cn("text-[14px] font-black", tone.color)}>{tone.label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[8px] border border-[#dfe7ef] hover:bg-[#f3f6fb]"
            data-testid="api-detail-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-black leading-tight text-[#10233f]">{row.label}</h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-[4px] bg-[#eef2f6] px-2 py-1 text-[11px] font-black text-[#536175]">{row.method}</span>
              <span className="break-all font-mono text-[12px] font-bold text-[#536175]">{row.path}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[28px] font-black text-[#10233f]">{row.totalCount.toLocaleString()}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">CALLS · 24H</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-5">
          <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">Errors 24h</p>
            <p className={cn("mt-1 font-mono text-[20px] font-black", row.errorCount > 0 ? "text-[#dc2626]" : "text-[#10233f]")}>
              {row.errorCount}
            </p>
          </div>
          <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">Avg Duration</p>
            <p className="mt-1 font-mono text-[20px] font-black text-[#10233f]">{formatMs(row.avgDurationMs)}</p>
          </div>
          <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">未解決 / 已解決</p>
            <p className="mt-1 font-mono text-[20px] font-black text-[#10233f]">
              {row.unresolvedErrorCount} <span className="text-[14px] text-[#8b9aae]">/ {row.resolvedErrorCount}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 px-5 py-5">
          <h3 className="text-[13px] font-black text-[#10233f]">24h 趨勢 (每小時)</h3>
          <LargeTrendSparkline trend={trend} />
        </div>

        {detailQuery.isLoading ? (
          <div className="px-5 py-3 text-[12px] font-bold text-[#637185]">讀取詳細資料中…</div>
        ) : (
          <>
            {unresolvedErrors.length > 0 && (
              <div className="border-t border-[#edf1f6] px-5 py-5">
                <h3 className="text-[13px] font-black text-[#10233f]">未解決錯誤 ({unresolvedErrors.length})</h3>
                <ul className="mt-3 space-y-2">
                  {unresolvedErrors.slice(0, 8).map((g) => (
                    <li key={g.fingerprint} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3 text-[12px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-black text-[#10233f]">{g.statusCode} · {g.errorType}</span>
                        <span className="font-mono text-[11px] font-bold text-[#8b9aae]">{new Date(g.lastOccurredAt).toLocaleString("zh-TW")}</span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] font-bold text-[#536175]">{g.route}</p>
                      <p className="mt-1 text-[11px] font-bold text-[#637185]">出現 {g.count} 次{g.avgDurationMs != null ? ` · 平均 ${Math.round(g.avgDurationMs)}ms` : ""}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recentRecords.length > 0 && (
              <div className="border-t border-[#edf1f6] px-5 py-5">
                <h3 className="text-[13px] font-black text-[#10233f]">最近呼叫 ({recentRecords.length})</h3>
                <ul className="mt-3 space-y-1">
                  {recentRecords.slice(0, 10).map((rec) => (
                    <li key={rec.id} className="flex items-center justify-between gap-2 rounded-[6px] bg-[#fbfcfd] px-3 py-2 text-[11px]">
                      <span className={cn("font-mono font-black", rec.errorType ? "text-[#dc2626]" : "text-[#188249]")}>{rec.statusCode}</span>
                      <span className="flex-1 font-mono text-[#536175]">{rec.durationMs}ms</span>
                      <span className="font-mono text-[#8b9aae]">{new Date(rec.occurredAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>
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
