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
  if (s === "healthy") return "bg-[#22c55e]";
  if (s === "warning") return "bg-[#f59e0b]";
  if (s === "error") return "bg-[#dc2626]";
  return "bg-[#9ca3af]";
};

const actionStatusDot = (s: ActionMonitoringStatus) => {
  if (s === "healthy") return "bg-[#22c55e]";
  if (s === "warning") return "bg-[#f59e0b]";
  if (s === "error") return "bg-[#dc2626]";
  return "bg-[#9ca3af]";
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

function ApiTrendHeatmap({ trend }: { trend: ApiMonitoringTrendBucket[] }) {
  const cells = useMemo(() => padApiBuckets(trend), [trend]);
  const max = Math.max(...cells.map((c) => c.total), 1);
  return (
    <div className="inline-flex items-end gap-[1px] rounded-[3px] bg-[#fbfcfd] p-1">
      {cells.map((c, i) => {
        const er = c.total > 0 ? c.errors / c.total : 0;
        const intensity = c.total > 0 ? 0.35 + Math.min(c.total / max, 1) * 0.65 : 1;
        const color =
          c.total === 0
            ? "bg-[#e5eaf0]"
            : er >= 0.5
              ? "bg-[#dc2626]"
              : er > 0
                ? "bg-[#f59e0b]"
                : "bg-[#22c55e]";
        const tip = c.hour
          ? `${new Date(c.hour).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })} · ${c.total} 次 · ${c.errors} 錯誤`
          : "無資料";
        return <div key={i} className={cn("h-[22px] w-[5px] rounded-[1px]", color)} style={{ opacity: intensity }} title={tip} />;
      })}
    </div>
  );
}

function ActionTrendHeatmap({ trend }: { trend: ActionMonitoringTrendBucket[] }) {
  const cells = useMemo(() => padActionBuckets(trend), [trend]);
  const max = Math.max(...cells.map((c) => c.total), 1);
  return (
    <div className="inline-flex items-end gap-[1px] rounded-[3px] bg-[#fbfcfd] p-1">
      {cells.map((c, i) => {
        const fr = c.total > 0 ? c.failures / c.total : 0;
        const intensity = c.total > 0 ? 0.35 + Math.min(c.total / max, 1) * 0.65 : 1;
        const color =
          c.total === 0
            ? "bg-[#e5eaf0]"
            : fr >= 0.5
              ? "bg-[#dc2626]"
              : fr > 0
                ? "bg-[#f59e0b]"
                : "bg-[#22c55e]";
        const tip = c.hour
          ? `${new Date(c.hour).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })} · ${c.total} 次 · ${c.failures} 失敗`
          : "無資料";
        return <div key={i} className={cn("h-[22px] w-[5px] rounded-[1px]", color)} style={{ opacity: intensity }} title={tip} />;
      })}
    </div>
  );
}

function HealthPanel({ data, isLoading }: { data?: ApiMonitoringDto; isLoading: boolean }) {
  const rows = data?.rows ?? [];
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-[#edf1f6] p-4">
        <h2 className="text-[16px] font-black text-[#10233f]">CMS 內部 API 健康</h2>
        <p className="mt-1 text-[12px] font-bold text-[#637185]">
          {data
            ? `共 ${data.summary.totalApis} 支 · ${data.summary.healthyApis} 正常 / ${data.summary.warningApis} 注意 / ${data.summary.errorApis} 錯誤`
            : "讀取中…"}
        </p>
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
              <th className="px-4 py-3">趨勢</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f6]">
            {rows.map((row) => (
              <ApiHealthRow key={row.id} row={row} />
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[13px] font-bold text-[#637185]">
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
    <tr className="align-middle hover:bg-[#fbfcfd]">
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-black text-[#10233f]">
          <span className={cn("h-2 w-2 rounded-full", apiStatusDot(row.status))} />
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
      <td className="px-4 py-3"><ApiTrendHeatmap trend={row.trend} /></td>
    </tr>
  );
}

function ErrorsPanel({ data }: { data?: ApiMonitoringDto }) {
  const errors = data?.recentErrors ?? [];
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-[#edf1f6] p-4">
        <h2 className="text-[16px] font-black text-[#10233f]">最近錯誤</h2>
        <p className="mt-1 text-[12px] font-bold text-[#637185]">過去 24 小時內 CMS 內部 API 的錯誤紀錄</p>
      </div>
      <ul className="divide-y divide-[#edf1f6]">
        {errors.map((err) => (
          <li key={err.id} className="grid gap-2 px-4 py-3 md:grid-cols-[80px_1fr_100px_180px] md:items-center">
            <span className={cn("w-fit rounded-[4px] px-2 py-0.5 text-[10px] font-black", err.errorType === "5xx" ? "bg-[#ffe8eb] text-[#dc2626]" : err.errorType === "4xx" ? "bg-[#fff6e7] text-[#9b6a00]" : "bg-[#eef2f6] text-[#536175]")}>
              {err.statusCode || err.errorType}
            </span>
            <span className="truncate font-mono text-[11px] font-bold text-[#10233f]">{err.route}</span>
            <span className="text-right font-mono text-[11px] font-bold text-[#536175]">{err.durationMs}ms</span>
            <span className="text-right font-mono text-[10px] font-bold text-[#8b9aae]">{new Date(err.occurredAt).toLocaleString("zh-TW")}</span>
          </li>
        ))}
        {!errors.length && (
          <li className="p-8 text-center text-[13px] font-bold text-[#637185]">過去 24h 無錯誤 🎉</li>
        )}
      </ul>
    </WorkbenchCard>
  );
}

function AuditPanel({ data }: { data?: ApiMonitoringDto }) {
  const events = data?.auditEvents ?? [];
  return (
    <WorkbenchCard className="overflow-hidden">
      <div className="border-b border-[#edf1f6] p-4">
        <h2 className="text-[16px] font-black text-[#10233f]">操作紀錄</h2>
        <p className="mt-1 text-[12px] font-bold text-[#637185]">最近 50 筆 audit 事件</p>
      </div>
      <ul className="divide-y divide-[#edf1f6]">
        {events.map((ev) => (
          <li key={ev.id} className="grid gap-2 px-4 py-3 md:grid-cols-[160px_120px_1fr_120px_160px] md:items-center">
            <span className="font-mono text-[11px] font-bold text-[#637185]">{new Date(ev.occurredAt).toLocaleString("zh-TW")}</span>
            <span className="rounded-[4px] bg-[#eef2f6] px-2 py-0.5 text-[10px] font-black text-[#536175] w-fit">{ev.action}</span>
            <span className="truncate text-[12px] font-bold text-[#10233f]">{ev.resource}{ev.resourceId ? ` / ${ev.resourceId}` : ""}</span>
            <span className="font-mono text-[11px] font-bold text-[#536175]">{ev.actorId ?? "system"}</span>
            <span className={cn("text-right text-[11px] font-black", ev.resultStatus && ev.resultStatus.toLowerCase() !== "success" ? "text-[#dc2626]" : "text-[#188249]")}>
              {ev.resultStatus ?? "success"}
            </span>
          </li>
        ))}
        {!events.length && (
          <li className="p-8 text-center text-[13px] font-bold text-[#637185]">尚無操作紀錄</li>
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
    refetchInterval: 60_000,
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] p-4">
        <div>
          <h2 className="text-[16px] font-black text-[#10233f]">動作監控</h2>
          <p className="mt-1 text-[12px] font-bold text-[#637185]">
            {summary
              ? `共 ${summary.totalActions} 類動作 · 24h 執行 ${summary.totalExecutions.toLocaleString()} 次 · 失敗 ${summary.totalFailures} 次`
              : "讀取中…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "all" | ActionCategory)}
            className="h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold"
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
            className="h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold"
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
          <thead className="bg-[#f7f9fb] text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">
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
          <tbody className="divide-y divide-[#edf1f6]">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className="cursor-pointer align-middle transition hover:bg-[#fbfcfd]"
                data-testid={`action-row-${row.id}`}
              >
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-[11px] font-black text-[#10233f]">
                    <span className={cn("h-2 w-2 rounded-full", actionStatusDot(row.status))} />
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-black text-[#10233f]">{row.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] font-bold text-[#8b9aae]">{row.action}</div>
                </td>
                <td className="px-4 py-3 text-[11px] font-bold text-[#536175]">{CATEGORY_LABEL[row.category]}</td>
                <td className="px-4 py-3 text-right font-mono text-[12px] font-black text-[#10233f]">{row.totalCount.toLocaleString()}</td>
                <td className={cn("px-4 py-3 text-right font-mono text-[12px] font-black", row.successRate >= 99 ? "text-[#188249]" : row.successRate >= 80 ? "text-[#9b6a00]" : "text-[#dc2626]")}>
                  {row.successRate}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-[12px] font-black">
                  <span className={row.failureCount > 0 ? "text-[#dc2626]" : "text-[#8b9aae]"}>{row.failureCount}</span>
                </td>
                <td className="px-4 py-3 text-[11px] font-bold text-[#536175]">{formatRelative(row.lastOccurredAt)}</td>
                <td className="px-4 py-3"><ActionTrendHeatmap trend={row.trend} /></td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[13px] font-bold text-[#637185]">
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
    <div className="fixed inset-0 z-50 flex justify-end bg-[#10233f]/30" onClick={onClose}>
      <div className="h-full w-full max-w-[640px] overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[#edf1f6] p-5">
          <div className="flex items-center gap-3">
            <span className={cn("h-2.5 w-2.5 rounded-full", actionStatusDot(row.status))} />
            <span className="text-[14px] font-black text-[#10233f]">{row.status}</span>
            <span className="rounded-[4px] bg-[#eef2f6] px-2 py-0.5 text-[10px] font-black text-[#536175]">{CATEGORY_LABEL[row.category]}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[8px] border border-[#dfe7ef] hover:bg-[#f3f6fb]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-black leading-tight text-[#10233f]">{row.label}</h2>
            <p className="mt-2 break-all font-mono text-[11px] font-bold text-[#536175]">{row.action}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[28px] font-black text-[#10233f]">{row.totalCount.toLocaleString()}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">EXEC · 24H</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-5">
          <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">成功率</p>
            <p className={cn("mt-1 font-mono text-[20px] font-black", row.successRate >= 99 ? "text-[#188249]" : row.successRate >= 80 ? "text-[#9b6a00]" : "text-[#dc2626]")}>{row.successRate}%</p>
          </div>
          <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">失敗次數</p>
            <p className={cn("mt-1 font-mono text-[20px] font-black", row.failureCount > 0 ? "text-[#dc2626]" : "text-[#10233f]")}>{row.failureCount}</p>
          </div>
          <div className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">最近執行</p>
            <p className="mt-1 text-[14px] font-black text-[#10233f]">{formatRelative(row.lastOccurredAt)}</p>
          </div>
        </div>

        <div className="space-y-2 px-5 py-5">
          <h3 className="text-[13px] font-black text-[#10233f]">24h 趨勢 (每小時)</h3>
          <ActionTrendHeatmap trend={row.trend} />
          <div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-[#8b9aae]">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#22c55e]" /> 正常</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#f59e0b]" /> 有失敗</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#dc2626]" /> ≥50% 失敗</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[#e5eaf0]" /> 無資料</span>
          </div>
        </div>

        <div className="border-t border-[#edf1f6] px-5 py-5">
          <h3 className="text-[13px] font-black text-[#10233f]">最後一次執行</h3>
          <dl className="mt-3 grid gap-3 text-[12px]">
            <div className="rounded-[8px] bg-[#fbfcfd] p-3">
              <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">actor</dt>
              <dd className="mt-1 font-mono font-bold text-[#10233f]">{row.lastActorId ?? "system"}</dd>
            </div>
            <div className="rounded-[8px] bg-[#fbfcfd] p-3">
              <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">resultStatus</dt>
              <dd className={cn("mt-1 font-mono font-bold", row.lastResultStatus && row.lastResultStatus.toLowerCase() !== "success" ? "text-[#dc2626]" : "text-[#188249]")}>
                {row.lastResultStatus ?? "success"}
              </dd>
            </div>
            <div className="rounded-[8px] bg-[#fbfcfd] p-3">
              <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">occurredAt</dt>
              <dd className="mt-1 font-mono font-bold text-[#10233f]">{row.lastOccurredAt ? new Date(row.lastOccurredAt).toLocaleString("zh-TW") : "—"}</dd>
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
    refetchInterval: 60_000,
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
                    tab === item.id ? "bg-[#0d2a50] text-white" : "bg-white text-[#637185] hover:bg-[#f3f6fb]",
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
