import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertOctagon, ListChecks, Server, X } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchApiMonitoring } from "../api-monitoring/api";
import { fetchActionMonitoring } from "./api";
import type {
  ApiMonitoringDto,
  ApiMonitoringRow,
  ApiMonitoringStatus,
  ApiMonitoringTrendBucket,
} from "@shared/system/api-monitoring-contract";
import type {
  ActionCategory,
  ActionMonitoringRow,
  ActionMonitoringStatus,
  ActionMonitoringTrendBucket,
} from "@shared/system/action-monitoring-contract";

type TabKey = "health" | "errors" | "audit" | "actions";

const tabs: Array<{ id: TabKey; label: string; icon: typeof Server }> = [
  { id: "health", label: "API 健康", icon: Server },
  { id: "errors", label: "最近錯誤", icon: AlertOctagon },
  { id: "audit", label: "操作紀錄", icon: ListChecks },
  { id: "actions", label: "動作監控", icon: Activity },
];

const readTabFromUrl = (): TabKey => {
  if (typeof window === "undefined") return "health";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tabs.some((t) => t.id === tab) ? (tab as TabKey) : "health";
};

const apiStatusDot = (s: ApiMonitoringStatus) => {
  if (s === "healthy") return "bg-surface-soft";
  if (s === "warning") return "bg-surface-soft";
  if (s === "error") return "bg-red-600";
  return "bg-surface-soft";
};

const actionStatusDot = (s: ActionMonitoringStatus) => {
  if (s === "healthy") return "bg-surface-soft";
  if (s === "warning") return "bg-surface-soft";
  if (s === "error") return "bg-red-600";
  return "bg-surface-soft";
};

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  ops: "運維",
  session: "Session",
  permission: "權限",
  content: "內容",
  system: "系統",
  other: "其他",
};

function formatMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 10) return `${ms.toFixed(1)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRelative(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return `${Math.floor(hr / 24)} 天前`;
}

function padApiBuckets(trend: ApiMonitoringTrendBucket[]): ApiMonitoringTrendBucket[] {
  const cells = trend.slice(-24);
  while (cells.length < 24) cells.unshift({ hour: "", total: 0, errors: 0, avgDurationMs: null });
  return cells;
}

function padActionBuckets(trend: ActionMonitoringTrendBucket[]): ActionMonitoringTrendBucket[] {
  const cells = trend.slice(-24);
  while (cells.length < 24) cells.unshift({ hour: "", total: 0, failures: 0 });
  return cells;
}

function TrendSparkline({ points }: { points: { total: number; bad: number; hour: string }[] }) {
  const maxTotal = Math.max(...points.map((c) => c.total), 1);
  const hasData = points.some((c) => c.total > 0);
  const totalBad = points.reduce((s, c) => s + c.bad, 0);
  const totalCalls = points.reduce((s, c) => s + c.total, 0);
  const errorRatio = totalCalls > 0 ? totalBad / totalCalls : 0;
  const stroke = !hasData ? "var(--ds-border-emphasis)" : errorRatio >= 0.5 ? "var(--ds-state-priority)" : errorRatio > 0 ? "var(--ds-state-must-read)" : "var(--ds-state-success)";
  const n = points.length;
  const W = 120, H = 22, padX = 2, padY = 2;
  const w = W - padX * 2, h = H - padY * 2;
  const pts = points.map((p, i) => ({
    x: padX + (n <= 1 ? w / 2 : (i / (n - 1)) * w),
    y: padY + h - (p.total / maxTotal) * h,
    bad: p.bad,
    tip: p.hour
      ? `${new Date(p.hour).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })} · ${p.total} 次 · ${p.bad} 失敗`
      : "無資料",
  }));
  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg width={120} height={22} viewBox="0 0 120 22" aria-label="24h 趨勢折線" className="shrink-0">
      {!hasData ? (
        <line x1={2} y1={11} x2={118} y2={11} stroke="var(--ds-border-emphasis)" strokeWidth="1" strokeDasharray="2 2" />
      ) : (
        <>
          <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.filter((p) => p.bad > 0).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2" fill="var(--ds-state-priority)"><title>{p.tip}</title></circle>
          ))}
        </>
      )}
    </svg>
  );
}

function LargeTrendSparkline({ trend }: { trend: ApiMonitoringTrendBucket[] }) {
  const cells = useMemo(() => padApiBuckets(trend), [trend]);
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
                <title>{`${p.hour != null ? String(p.hour).padStart(2, "0") + ":00" : ""} · ${p.cell.total} 次 · ${p.cell.errors} 錯誤`}</title>
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

function HealthPanel({ data, isLoading }: { data?: ApiMonitoringDto; isLoading: boolean }) {
  const rows = data?.rows ?? [];
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-border-subtle p-4">
        <h2 className="text-[16px] font-black text-text-strong">CMS 內部 API 健康</h2>
        <p className="mt-1 text-[12px] font-bold text-text-body">
          {data
            ? `共 ${data.summary.connectedApis ?? data.summary.totalApis} 支（排除 ${data.summary.notConnectedApis} 未連線）· ${data.summary.healthyApis} 正常 / ${data.summary.warningApis} 注意 / ${data.summary.errorApis} 錯誤`
            : "讀取中…"}
        </p>
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
              <th className="px-4 py-3">趨勢</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <ApiHealthRow key={row.id} row={row} />
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[13px] font-bold text-text-body">
                  {isLoading ? "讀取中…" : "尚無 API 資料"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </WorkbenchCard>
  );
}

function ApiHealthRow({ row }: { row: ApiMonitoringRow }) {
  return (
    <tr className="align-middle hover:bg-surface-soft">
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-black text-text-strong">
          <span className={cn("h-2 w-2 rounded-full", apiStatusDot(row.status))} />
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
        <TrendSparkline points={padApiBuckets(row.trend).map((c) => ({ total: c.total, bad: c.errors, hour: c.hour }))} />
      </td>
    </tr>
  );
}

function ErrorsPanel({ data }: { data?: ApiMonitoringDto }) {
  const errors = data?.recentErrors ?? [];
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-border-subtle p-4">
        <h2 className="text-[16px] font-black text-text-strong">最近錯誤</h2>
        <p className="mt-1 text-[12px] font-bold text-text-body">過去 24 小時內 CMS 內部 API 的錯誤紀錄</p>
      </div>
      <ul className="divide-y divide-border-subtle">
        {errors.map((err) => (
          <li key={err.id} className="grid gap-2 px-4 py-3 md:grid-cols-[80px_1fr_100px_180px] md:items-center">
            <span className={cn("w-fit rounded-[4px] px-2 py-0.5 text-[10px] font-black", err.errorType === "5xx" ? "bg-surface-soft text-red-600" : err.errorType === "4xx" ? "bg-surface-soft text-text-body" : "bg-slate-100 text-text-body")}>
              {err.statusCode || err.errorType}
            </span>
            <span className="truncate font-mono text-[11px] font-bold text-text-strong">{err.route}</span>
            <span className="text-right font-mono text-[11px] font-bold text-text-body">{err.durationMs}ms</span>
            <span className="text-right font-mono text-[10px] font-bold text-text-muted">{new Date(err.occurredAt).toLocaleString("zh-TW")}</span>
          </li>
        ))}
        {!errors.length && (
          <li className="p-8 text-center text-[13px] font-bold text-text-body">過去 24h 無錯誤 🎉</li>
        )}
      </ul>
    </WorkbenchCard>
  );
}

function AuditPanel({ data }: { data?: ApiMonitoringDto }) {
  const events = data?.auditEvents ?? [];
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-border-subtle p-4">
        <h2 className="text-[16px] font-black text-text-strong">操作紀錄</h2>
        <p className="mt-1 text-[12px] font-bold text-text-body">最近 50 筆 audit 事件</p>
      </div>
      <ul className="divide-y divide-border-subtle">
        {events.map((ev) => (
          <li key={ev.id} className="grid gap-2 px-4 py-3 md:grid-cols-[160px_1fr_1fr_120px_160px] md:items-center">
            <span className="font-mono text-[11px] font-bold text-text-body">{new Date(ev.occurredAt).toLocaleString("zh-TW")}</span>
            <span className="block max-w-[160px] truncate rounded-[4px] bg-slate-100 px-2 py-0.5 text-[10px] font-black text-text-body" title={ev.action}>{ev.action}</span>
            <span className="min-w-0 break-all text-[12px] font-bold text-text-strong">{ev.resource}{ev.resourceId ? ` / ${ev.resourceId}` : ""}</span>
            <span className="font-mono text-[11px] font-bold text-text-body">{ev.actorId ?? "system"}</span>
            <span className={cn("text-right text-[11px] font-black", ev.resultStatus && ev.resultStatus.toLowerCase() !== "success" ? "text-red-600" : "text-text-body")}>
              {ev.resultStatus ?? "success"}
            </span>
          </li>
        ))}
        {!events.length && (
          <li className="p-8 text-center text-[13px] font-bold text-text-body">尚無操作紀錄</li>
        )}
      </ul>
    </WorkbenchCard>
  );
}

function ActionsPanel({ onSelect }: { onSelect: (row: ActionMonitoringRow) => void }) {
  const [categoryFilter, setCategoryFilter] = useState<"all" | ActionCategory>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ActionMonitoringStatus>("all");

  const query = useQuery({
    queryKey: ["/api/bff/system/action-monitoring"],
    queryFn: fetchActionMonitoring,
    refetchInterval: 15_000,
  });

  const rows = useMemo(() => {
    const all = query.data?.rows ?? [];
    return all
      .filter((r) => categoryFilter === "all" || r.category === categoryFilter)
      .filter((r) => statusFilter === "all" || r.status === statusFilter);
  }, [query.data?.rows, categoryFilter, statusFilter]);

  const summary = query.data?.summary;

  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
        <div>
          <h2 className="text-[16px] font-black text-text-strong">動作監控</h2>
          <p className="mt-1 text-[12px] font-bold text-text-body">
            {summary
              ? `共 ${summary.totalActions} 類動作 · 24h 執行 ${summary.totalExecutions.toLocaleString()} 次 · 失敗 ${summary.totalFailures} 次`
              : "讀取中…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "all" | ActionCategory)}
            className="h-9 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold"
          >
            <option value="all">all category</option>
            <option value="ops">運維</option>
            <option value="session">Session</option>
            <option value="permission">權限</option>
            <option value="content">內容</option>
            <option value="system">系統</option>
            <option value="other">其他</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | ActionMonitoringStatus)}
            className="h-9 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold"
          >
            <option value="all">all status</option>
            <option value="error">error</option>
            <option value="warning">warning</option>
            <option value="healthy">healthy</option>
            <option value="not_connected">not_connected</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-surface-soft text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">
            <tr>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3">動作</th>
              <th className="px-4 py-3">類別</th>
              <th className="px-4 py-3 text-right">24h 次數</th>
              <th className="px-4 py-3 text-right">成功率</th>
              <th className="px-4 py-3 text-right">失敗</th>
              <th className="px-4 py-3">最近執行</th>
              <th className="px-4 py-3">趨勢</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className="cursor-pointer align-middle transition hover:bg-surface-soft"
                data-testid={`action-row-${row.id}`}
              >
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-[11px] font-black text-text-strong">
                    <span className={cn("h-2 w-2 rounded-full", actionStatusDot(row.status))} />
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-black text-text-strong">{row.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] font-bold text-text-muted">{row.action}</div>
                </td>
                <td className="px-4 py-3 text-[11px] font-bold text-text-body">{CATEGORY_LABEL[row.category]}</td>
                <td className="px-4 py-3 text-right font-mono text-[12px] font-black text-text-strong">{row.totalCount.toLocaleString()}</td>
                <td className={cn("px-4 py-3 text-right font-mono text-[12px] font-black", row.successRate >= 99 ? "text-text-body" : row.successRate >= 80 ? "text-text-body" : "text-red-600")}>
                  {row.successRate}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-[12px] font-black">
                  <span className={row.failureCount > 0 ? "text-red-600" : "text-text-muted"}>{row.failureCount}</span>
                </td>
                <td className="px-4 py-3 text-[11px] font-bold text-text-body">{formatRelative(row.lastOccurredAt)}</td>
                <td className="px-4 py-3">
                  <TrendSparkline points={padActionBuckets(row.trend).map((c) => ({ total: c.total, bad: c.failures, hour: c.hour }))} />
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[13px] font-bold text-text-body">
                  {query.isLoading ? "讀取中…" : "尚無動作資料"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </WorkbenchCard>
  );
}

function ActionDetailPanel({ row, onClose }: { row: ActionMonitoringRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-text-strong/30" onClick={onClose}>
      <div className="h-full w-full max-w-[640px] overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-5">
          <div className="flex items-center gap-3">
            <span className={cn("h-2.5 w-2.5 rounded-full", actionStatusDot(row.status))} />
            <span className="text-[14px] font-black text-text-strong">{row.status}</span>
            <span className="rounded-[4px] bg-slate-100 px-2 py-0.5 text-[10px] font-black text-text-body">{CATEGORY_LABEL[row.category]}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[8px] border border-border-default hover:bg-surface-base"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-black leading-tight text-text-strong">{row.label}</h2>
            <p className="mt-2 break-all font-mono text-[11px] font-bold text-text-body">{row.action}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[28px] font-black text-text-strong">{row.totalCount.toLocaleString()}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">EXEC · 24H</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-5">
          <div className="rounded-[8px] border border-border-subtle bg-surface-soft p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">成功率</p>
            <p className={cn("mt-1 font-mono text-[20px] font-black", row.successRate >= 99 ? "text-text-body" : row.successRate >= 80 ? "text-text-body" : "text-red-600")}>{row.successRate}%</p>
          </div>
          <div className="rounded-[8px] border border-border-subtle bg-surface-soft p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">失敗次數</p>
            <p className={cn("mt-1 font-mono text-[20px] font-black", row.failureCount > 0 ? "text-red-600" : "text-text-strong")}>{row.failureCount}</p>
          </div>
          <div className="rounded-[8px] border border-border-subtle bg-surface-soft p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">最近執行</p>
            <p className="mt-1 text-[14px] font-black text-text-strong">{formatRelative(row.lastOccurredAt)}</p>
          </div>
        </div>

        <div className="space-y-2 px-5 py-5">
          <h3 className="text-[13px] font-black text-text-strong">24h 趨勢 (每小時)</h3>
          <LargeTrendSparkline trend={row.trend.map((c) => ({ hour: c.hour, total: c.total, errors: c.failures, avgDurationMs: null }))} />
        </div>

        <div className="border-t border-border-subtle px-5 py-5">
          <h3 className="text-[13px] font-black text-text-strong">最後一次執行</h3>
          <dl className="mt-3 grid gap-3 text-[12px]">
            <div className="rounded-[8px] bg-surface-soft p-3">
              <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-text-muted">actor</dt>
              <dd className="mt-1 font-mono font-bold text-text-strong">{row.lastActorId ?? "system"}</dd>
            </div>
            <div className="rounded-[8px] bg-surface-soft p-3">
              <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-text-muted">resultStatus</dt>
              <dd className={cn("mt-1 font-mono font-bold", row.lastResultStatus && row.lastResultStatus.toLowerCase() !== "success" ? "text-red-600" : "text-text-body")}>
                {row.lastResultStatus ?? "success"}
              </dd>
            </div>
            <div className="rounded-[8px] bg-surface-soft p-3">
              <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-text-muted">occurredAt</dt>
              <dd className="mt-1 font-mono font-bold text-text-strong">{row.lastOccurredAt ? new Date(row.lastOccurredAt).toLocaleString("zh-TW") : "—"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

export default function SystemCmsMonitoringPage() {
  const [tab, setTabState] = useState<TabKey>(() => readTabFromUrl());
  const [selectedAction, setSelectedAction] = useState<ActionMonitoringRow | null>(null);

  const apiQuery = useQuery({
    queryKey: ["/api/bff/system/api-monitoring", "cms-monitoring"],
    queryFn: () => fetchApiMonitoring("400cms"),
    refetchInterval: 15_000,
    enabled: tab !== "actions",
  });

  const setTab = (next: TabKey) => {
    setTabState(next);
    if (typeof window === "undefined") return;
    const search = next === "health" ? "" : `?tab=${next}`;
    window.history.replaceState(null, "", `/system/cms-monitoring${search}`);
  };

  return (
    <RoleShell role="system" title="CMS 內部監控" subtitle="CMS 內部 · API 健康 + 動作監控">
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="system-cms-monitoring-page">
        <WorkbenchCard className="p-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-[8px] px-4 text-[13px] font-black transition",
                    tab === item.id ? "bg-primary-navy text-white" : "bg-white text-text-body hover:bg-surface-base",
                  )}
                  data-testid={`cms-tab-${item.id}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </WorkbenchCard>

        {tab === "health" ? <HealthPanel data={apiQuery.data} isLoading={apiQuery.isLoading} /> : null}
        {tab === "errors" ? <ErrorsPanel data={apiQuery.data} /> : null}
        {tab === "audit" ? <AuditPanel data={apiQuery.data} /> : null}
        {tab === "actions" ? <ActionsPanel onSelect={setSelectedAction} /> : null}

        {selectedAction ? <ActionDetailPanel row={selectedAction} onClose={() => setSelectedAction(null)} /> : null}
      </div>
    </RoleShell>
  );
}
