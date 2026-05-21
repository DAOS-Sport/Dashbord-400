import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { fetchApiMonitoring, fetchApiMonitoringDetail, updateApiMonitoringErrorGroupStatus } from "./api";
import {
  fetchLinebotManagementFacilities,
  fetchLinebotManagementOverview,
  fetchLinebotManagementPipeline,
  fetchLinebotManagementServices,
  fetchLinebotManagementWhitelist,
} from "../linebot-management/api";
import { LineWhitelistManagementPanel } from "../line-whitelist/page";
import { fetchLineXbsStatus } from "../project-monitoring/api";
import type {
  ApiMonitoringProjectKey,
  ApiMonitoringAuditEvent,
  ApiMonitoringDetailDto,
  ApiMonitoringErrorGroup,
  ApiMonitoringError,
  ApiMonitoringRequestRecord,
  ApiMonitoringRow,
  ApiMonitoringScheduleCategory,
  ApiMonitoringStatus,
  ApiMonitoringTrendBucket,
  ScheduleEndpointProbe,
  ScheduleMonitoringBlock,
} from "@shared/system/api-monitoring-contract";
import type { LinebotApiReadiness, LinebotManagementCard, LinebotManagementStatus } from "@shared/system/linebot-management-contract";

/* ============================================================
 * Design Tokens
 * 統一管理顏色、字重、間距,避免散落在每個 className 裡。
 * ============================================================ */

const tone = {
  // 文字層級(由深到淺)
  ink: "text-slate-900",         // 主要資料 / 標題
  inkSoft: "text-slate-600",     // 次要說明
  inkFaint: "text-slate-400",    // 標籤 / 時間 / hint
  // 互動性
  accent: "text-teal-700",
  link: "text-slate-900 hover:text-teal-700",
};

const statusToken = {
  healthy: {
    label: "正常",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    stroke: "#10b981",
    text: "text-emerald-700",
  },
  warning: {
    label: "警告",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
    stroke: "#f59e0b",
    text: "text-amber-700",
  },
  error: {
    label: "異常",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
    stroke: "#e11d48",
    text: "text-rose-700",
  },
  idle: {
    label: "未連線",
    dot: "bg-slate-300",
    chip: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-400/20",
    stroke: "#94a3b8",
    text: "text-slate-500",
  },
} as const;

type StatusKey = keyof typeof statusToken;

const apiStatusToToken = (status: ApiMonitoringStatus): StatusKey => {
  if (status === "healthy") return "healthy";
  if (status === "warning") return "warning";
  if (status === "error") return "error";
  return "idle";
};

const lineStatusToToken = (status: LinebotManagementStatus): StatusKey => {
  if (status === "ready") return "healthy";
  if (status === "degraded") return "warning";
  if (status === "waiting_for_400line_api") return "idle";
  return "error";
};

const lineStatusToApiStatus = (status: LinebotManagementStatus): ApiMonitoringStatus => {
  if (status === "ready") return "healthy";
  if (status === "degraded") return "warning";
  if (status === "waiting_for_400line_api") return "not_connected";
  return "error";
};

const lineStatusLabel = (status: LinebotManagementStatus) => {
  if (status === "ready") return "正常";
  if (status === "degraded") return "注意";
  if (status === "waiting_for_400line_api") return "等待 API";
  return "錯誤";
};

/* ============================================================
 * Reusable presentational components
 * ============================================================ */

const typeLabels: Record<string, string> = {
  health: "健康檢查",
  bff: "BFF API",
  auth: "登入 / 身分",
  system: "System",
  employee: "員工端",
  lifeguard: "救生端",
  supervisor: "主管端",
  "external-proxy": "外部服務",
  legacy: "Legacy",
};

const lineTabs = [
  { key: "overview", label: "總覽", icon: Bot },
  { key: "services", label: "服務監控", icon: Server },
  { key: "facilities", label: "群組/館別", icon: Users },
  { key: "whitelist", label: "白名單", icon: ListChecks },
  { key: "permissions", label: "權限", icon: ShieldCheck },
  { key: "pipeline", label: "公告管線", icon: Bell },
  { key: "readiness", label: "API Readiness", icon: RadioTower },
] as const;

type LineTabKey = typeof lineTabs[number]["key"];

const baseMonitoringTabs = [
  { key: "health", label: "API 健康狀態", icon: Server },
  { key: "errors", label: "最近錯誤", icon: AlertTriangle },
  { key: "audit", label: "操作紀錄", icon: ListChecks },
] as const;

type BaseMonitoringTabKey = typeof baseMonitoringTabs[number]["key"];
type MonitoringSummary = {
  totalApis: number;
  healthyApis: number;
  warningApis: number;
  errorApis: number;
};
type MonitoringTab<Key extends string> = {
  key: Key;
  label: string;
  icon: LucideIcon;
};

const readLineTabFromUrl = (): LineTabKey => {
  if (typeof window === "undefined") return "overview";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return lineTabs.some((item) => item.key === tab) ? (tab as LineTabKey) : "overview";
};

const readBaseMonitoringTabFromUrl = (): BaseMonitoringTabKey => {
  if (typeof window === "undefined") return "health";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return baseMonitoringTabs.some((item) => item.key === tab)
    ? (tab as BaseMonitoringTabKey)
    : "health";
};

function LineStatusBadge({ status }: { status: LinebotManagementStatus }) {
  const token = lineStatusToToken(status);
  const t = statusToken[token];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        t.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {lineStatusLabel(status)}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn("text-[10.5px] font-semibold uppercase tracking-[0.14em]", tone.inkFaint)}>
      {children}
    </p>
  );
}

/** GitHub list style sparkline,每列固定尺寸並以 X 標記錯誤 bucket */
function TrendSparkline({ buckets }: { buckets: ApiMonitoringTrendBucket[] }) {
  const width = 180;
  const height = 44;
  const baselineY = 32;
  const emptyTitle = "最近 24 小時尚未累積 API 流量";
  const activeBuckets = buckets.filter((b) => b.total > 0 || b.errors > 0);
  if (!activeBuckets.length) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-[180px]" role="img" aria-label={emptyTitle}>
        <title>{emptyTitle}</title>
        <line
          x1="8"
          y1={baselineY}
          x2={width - 8}
          y2={baselineY}
          stroke="#dbe5ef"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
      </svg>
    );
  }

  const maxValue = Math.max(...buckets.map((b) => Math.max(b.total, b.errors)), 1);
  const padX = 8;
  const padTop = 7;
  const padBottom = 9;
  const step = (width - padX * 2) / Math.max(1, buckets.length - 1);

  const points = buckets.map((bucket, index) => {
    const value = Math.max(bucket.total, bucket.errors);
    const x = Math.round(padX + index * step);
    const y = Math.round(height - padBottom - (value / maxValue) * (height - padTop - padBottom));
    return { x, y, bucket };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const accent = statusToken.healthy.stroke;
  const errorStroke = statusToken.error.stroke;
  const pointTitle = (bucket: ApiMonitoringTrendBucket) =>
    `${new Date(bucket.hour).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })} · ${bucket.total} calls · ${bucket.errors} errors · avg ${bucket.avgDurationMs ?? "-"}ms`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-[180px]" role="img" aria-label="最近 24 小時 API 趨勢">
      <line x1={padX} y1={baselineY} x2={width - padX} y2={baselineY} stroke="#e2e8f0" strokeWidth="1" />
      <path d={linePath} fill="none" stroke={accent} strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        const hasErr = p.bucket.errors > 0;
        if (!isLast && !hasErr) return null;
        if (hasErr) {
          return (
            <g key={p.bucket.hour} transform={`translate(${p.x} ${p.y})`}>
              <title>{pointTitle(p.bucket)}</title>
              <line x1="-4" y1="-4" x2="4" y2="4" stroke={errorStroke} strokeWidth="1.7" strokeLinecap="round" />
              <line x1="-4" y1="4" x2="4" y2="-4" stroke={errorStroke} strokeWidth="1.7" strokeLinecap="round" />
            </g>
          );
        }
        return (
          <circle
            key={p.bucket.hour}
            cx={p.x}
            cy={p.y}
            r="1.8"
            fill={accent}
            stroke="#fff"
            strokeWidth="1"
          >
            <title>{pointTitle(p.bucket)}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/** 頂部 4 個 KPI 卡片,左側 accent stripe 顯示語意 */
function KpiCard({
  label,
  value,
  Icon,
  accent,
}: {
  label: string;
  value: number;
  Icon: LucideIcon;
  accent: "ink" | "healthy" | "warning" | "error";
}) {
  const accentClass = {
    ink: "before:bg-slate-300",
    healthy: "before:bg-emerald-500",
    warning: "before:bg-amber-500",
    error: "before:bg-rose-500",
  }[accent];
  const valueClass = {
    ink: "text-slate-900",
    healthy: "text-emerald-700",
    warning: "text-amber-700",
    error: "text-rose-700",
  }[accent];

  return (
    <WorkbenchCard
      className={cn(
        "relative overflow-hidden p-4 pl-5",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        accentClass,
      )}
    >
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <Icon className={cn("h-4 w-4", tone.inkFaint)} />
      </div>
      <p className={cn("mt-2 text-[28px] font-semibold leading-none tabular-nums", valueClass)}>
        {value}
      </p>
    </WorkbenchCard>
  );
}

/** 400LINE 能力概覽 KPI 欄（取代通用 4 格計數） */
function LineCapabilityKpiBar({
  cards,
  isLoading,
  isError,
}: {
  cards: LinebotManagementCard[];
  isLoading: boolean;
  isError: boolean;
}) {
  const accentFor = (status: LinebotManagementStatus) => {
    const token = lineStatusToToken(status);
    return {
      healthy: "before:bg-emerald-500",
      warning: "before:bg-amber-500",
      error: "before:bg-rose-500",
      idle: "before:bg-slate-300",
    }[token];
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <WorkbenchCard
            key={i}
            className="relative overflow-hidden p-4 pl-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-slate-200"
          >
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-7 w-12 animate-pulse rounded bg-slate-100" />
          </WorkbenchCard>
        ))}
      </div>
    );
  }

  if (isError || !cards.length) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {["健康功能", "需注意功能", "服務列", "館別/群組"].map((label) => (
          <WorkbenchCard
            key={label}
            className="relative overflow-hidden p-4 pl-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-slate-200"
          >
            <div className="flex items-center justify-between">
              <SectionLabel>{label}</SectionLabel>
              <Server className={cn("h-4 w-4", tone.inkFaint)} />
            </div>
            <p className={cn("mt-2 text-[28px] font-semibold leading-none tabular-nums", tone.inkFaint)}>—</p>
          </WorkbenchCard>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3",
        cards.length >= 5 ? "md:grid-cols-5" : "md:grid-cols-4",
      )}
    >
      {cards.map((card) => {
        const token = lineStatusToToken(card.status);
        const t = statusToken[token];
        return (
          <WorkbenchCard
            key={card.label}
            className={cn(
              "relative overflow-hidden p-4 pl-5",
              "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
              accentFor(card.status),
            )}
          >
            <div className="flex items-center justify-between">
              <SectionLabel>{card.label}</SectionLabel>
              <span className={cn("inline-flex h-1.5 w-1.5 rounded-full", t.dot)} />
            </div>
            <p className={cn("mt-2 text-[28px] font-semibold leading-none tabular-nums", t.text)}>
              {card.value}
            </p>
            <p className={cn("mt-1 truncate text-[11px]", tone.inkFaint)}>{card.hint}</p>
          </WorkbenchCard>
        );
      })}
    </div>
  );
}

function MonitoringTopShell<Key extends string>({
  summary,
  kpiSlot,
  tabs,
  activeTab,
  onSelectTab,
  children,
}: {
  summary: MonitoringSummary | undefined;
  kpiSlot?: React.ReactNode;
  tabs: ReadonlyArray<MonitoringTab<Key>>;
  activeTab: Key;
  onSelectTab: (key: Key) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      {kpiSlot !== undefined ? (
        kpiSlot
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard label="API 總數" value={summary?.totalApis ?? 0} Icon={Server} accent="ink" />
          <KpiCard label="正常" value={summary?.healthyApis ?? 0} Icon={ShieldCheck} accent="healthy" />
          <KpiCard label="警告" value={summary?.warningApis ?? 0} Icon={AlertTriangle} accent="warning" />
          <KpiCard label="異常" value={summary?.errorApis ?? 0} Icon={XCircle} accent="error" />
        </div>
      )}

      <WorkbenchCard className="overflow-hidden p-0">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectTab(item.key)}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium transition",
                  active ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-slate-900" />}
              </button>
            );
          })}
        </div>
        <div className="bg-slate-50/40 p-5">{children}</div>
      </WorkbenchCard>
    </div>
  );
}

type MonitoringRowViewModel = {
  status: ApiMonitoringStatus;
  label: string;
  method: string;
  path: string;
  totalCount: number;
  unresolvedErrorCount?: number;
  avgDurationMs: number | null;
  trend: ApiMonitoringTrendBucket[];
  onOpenDetail?: () => void;
};

function MonitoringApiRow({
  status,
  label,
  method,
  path,
  totalCount,
  unresolvedErrorCount = 0,
  avgDurationMs,
  trend,
  onOpenDetail,
}: MonitoringRowViewModel) {
  const token = statusToken[apiStatusToToken(status)];
  const isSlowAvg = avgDurationMs !== null && avgDurationMs >= 1000;
  const Wrapper = onOpenDetail ? "button" : "div";

  return (
    <Wrapper
      type={onOpenDetail ? "button" : undefined}
      onClick={onOpenDetail}
      className={cn(
        "grid w-full grid-cols-[88px_minmax(0,1fr)_120px_180px] items-center gap-4 border-b border-slate-100 px-5 py-3 text-left last:border-b-0",
        onOpenDetail ? "cursor-pointer transition hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-slate-900/10" : "hover:bg-slate-50/60",
      )}
    >
      {/* status */}
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", token.dot)} />
        <span className={cn("text-[11px] font-medium", token.text)}>{token.label}</span>
      </div>

      {/* label + method + path */}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className={cn("truncate text-[13px] font-semibold", tone.ink)}>{label}</p>
          {unresolvedErrorCount > 0 ? (
            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
              未處理 {unresolvedErrorCount}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px]">
          <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[10px] font-semibold text-slate-600">
            {method}
          </span>
          <span className="truncate font-mono text-slate-500">{path}</span>
        </p>
      </div>

      {/* metrics(有 label 不靠位置記憶) */}
      <div className="text-right">
        <p className={cn("text-[13px] font-semibold tabular-nums", tone.ink)}>
          {totalCount.toLocaleString()}
        </p>
        <p className="text-[10.5px] uppercase tracking-wide text-slate-400">
          calls · 24h
        </p>
        <p
          className={cn(
            "mt-1 text-[11px] font-medium tabular-nums",
            isSlowAvg ? "text-amber-700" : "text-slate-500",
          )}
        >
          {avgDurationMs === null ? "—" : `${avgDurationMs} ms`}
        </p>
      </div>

      {/* trend */}
      <div className="justify-self-end">
        <TrendSparkline buckets={trend} />
      </div>
    </Wrapper>
  );
}

/** API 列表的 row,改成有明確 column header 的表格樣式 */
function ApiRow({ row, onOpenDetail }: { row: ApiMonitoringRow; onOpenDetail?: (row: ApiMonitoringRow) => void }) {
  return (
    <MonitoringApiRow
      status={row.status}
      label={row.label}
      method={row.method}
      path={row.path}
      totalCount={row.totalCount}
      unresolvedErrorCount={row.unresolvedErrorCount}
      avgDurationMs={row.avgDurationMs}
      trend={row.trend}
      onOpenDetail={onOpenDetail ? () => onOpenDetail(row) : undefined}
    />
  );
}

/** 統一的時間相對顯示(用於事件流) */
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-[12px] text-slate-500">
      {children}
    </div>
  );
}

type ApiDetailTarget = {
  rowId: string;
  projectKey: ApiMonitoringProjectKey;
  route?: string;
  label?: string;
  method?: string;
  status?: ApiMonitoringStatus;
  checkedAt?: string | null;
  durationMs?: number | null;
  statusCode?: number | null;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ErrorGroupCard({
  group,
  note,
  pending,
  onNoteChange,
  onResolve,
  onReopen,
}: {
  group: ApiMonitoringErrorGroup;
  note: string;
  pending: boolean;
  onNoteChange: (value: string) => void;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const resolved = group.resolution.status === "resolved";
  return (
    <div
      className={cn(
        "rounded-md border bg-white p-3",
        resolved ? "border-slate-200" : "border-rose-200 shadow-[0_10px_24px_rgba(225,29,72,0.08)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", resolved ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700")}>
              {resolved ? "已處理" : "未處理"}
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-600">
              {group.errorType} · HTTP {group.statusCode}
            </span>
          </div>
          <p className="mt-2 text-[13px] font-semibold text-slate-900">
            {formatDateTime(group.hour)} 這個小時發生 {group.count} 次
          </p>
          <p className="mt-1 text-[11.5px] text-slate-500">
            最後發生 {formatDateTime(group.lastOccurredAt)}
            {group.avgDurationMs !== null ? ` · avg ${group.avgDurationMs}ms` : ""}
          </p>
        </div>
        {resolved ? (
          <button
            type="button"
            onClick={onReopen}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新打開
          </button>
        ) : null}
      </div>

      {resolved ? (
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
          {group.resolution.note ? `處理備註：${group.resolution.note}` : "沒有處理備註。"}
          {group.resolution.resolvedBy ? (
            <span className="ml-1 text-slate-400">· {group.resolution.resolvedBy}</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            placeholder="填寫處理備註，例如：已確認為外部服務 timeout，等待對方恢復。"
            className="min-h-[68px] w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none focus:border-slate-400"
          />
          <button
            type="button"
            onClick={onResolve}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-[11.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            標示已處理
          </button>
        </div>
      )}
    </div>
  );
}

function LineEmpty({ label }: { label: string }) {
  return <EmptyState>尚無{label}資料,等待資料源接入。</EmptyState>;
}

function latestCheckTrend(
  status: ApiMonitoringStatus,
  checkedAt: string | null,
  avgDurationMs: number | null,
  shouldPlot = Boolean(checkedAt),
): ApiMonitoringTrendBucket[] {
  const end = new Date(checkedAt ?? Date.now());
  end.setMinutes(0, 0, 0);

  return Array.from({ length: 24 }, (_, index) => {
    const hour = new Date(end);
    hour.setHours(end.getHours() - (23 - index));
    const isLatest = index === 23 && shouldPlot;
    return {
      hour: hour.toISOString(),
      total: isLatest ? 1 : 0,
      errors: isLatest && status === "error" ? 1 : 0,
      avgDurationMs: isLatest ? avgDurationMs : null,
    };
  });
}

function LineReadinessList({
  items,
  onOpenDetail,
}: {
  items: LinebotApiReadiness[];
  onOpenDetail?: (target: ApiDetailTarget) => void;
}) {
  if (!items.length) return <LineEmpty label="API Readiness" />;
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="grid grid-cols-[88px_minmax(0,1fr)_120px_180px] gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
        <div>狀態</div>
        <div>API</div>
        <div className="text-right">流量 / 延遲</div>
        <div className="text-right">24h 趨勢</div>
      </div>
      {items.map((item, index) => (
        <MonitoringApiRow
          key={`${item.path}-${item.label}-${index}`}
          status={lineStatusToApiStatus(item.status)}
          label={item.label}
          method={item.method}
          path={item.path}
          totalCount={1}
          avgDurationMs={null}
          trend={latestCheckTrend(lineStatusToApiStatus(item.status), item.lastCheckedAt, null)}
          onOpenDetail={onOpenDetail ? () => onOpenDetail({
            rowId: `line-readiness:${index}:${item.path}`,
            projectKey: "400line",
            route: item.path,
            label: item.label,
            method: item.method,
            status: lineStatusToApiStatus(item.status),
            checkedAt: item.lastCheckedAt,
          }) : undefined}
        />
      ))}
    </div>
  );
}

/* ============================================================
 * Schedule platform monitoring block
 * ============================================================ */

const scheduleCategoryMeta: Record<
  ApiMonitoringScheduleCategory,
  { label: string; icon: LucideIcon; description: string }
> = {
  overview: { label: "系統總覽", icon: LayoutDashboard, description: "管理端總覽端點，員工數、班次與待審件數。" },
  schedules: { label: "即時班表", icon: CalendarClock, description: "依館區回傳今日完整班表（正職 + 派遣）。" },
  export: { label: "資料匯出", icon: Download, description: "支援分頁與多種篩選的批次匯出 endpoints。" },
  trigger: { label: "同步觸發", icon: RefreshCw, description: "寫入端點，預設不主動探活；需手動驗證。" },
};

function maskBaseUrl(baseUrl: string | null) {
  if (!baseUrl) return "—";
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return baseUrl;
  }
}

function ProbeRow({
  probe,
  onOpenDetail,
}: {
  probe: ScheduleEndpointProbe;
  onOpenDetail?: (target: ApiDetailTarget) => void;
}) {
  return (
    <MonitoringApiRow
      status={probe.status}
      label={probe.label}
      method={probe.method}
      path={probe.path}
      totalCount={probe.checkedAt && !probe.isMutating ? 1 : 0}
      avgDurationMs={probe.durationMs}
      trend={latestCheckTrend(probe.status, probe.checkedAt, probe.durationMs, Boolean(probe.checkedAt) && !probe.isMutating)}
      onOpenDetail={onOpenDetail ? () => onOpenDetail({
        rowId: probe.id,
        projectKey: "schedule",
        route: probe.path,
        label: probe.label,
        method: probe.method,
        status: probe.status,
        checkedAt: probe.checkedAt,
        durationMs: probe.durationMs,
        statusCode: probe.statusCode,
      }) : undefined}
    />
  );
}

function ScheduleMonitoringSection({
  block,
  onOpenDetail,
}: {
  block: ScheduleMonitoringBlock;
  onOpenDetail?: (target: ApiDetailTarget) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>排班管理系統</SectionLabel>
          <p className={cn("mt-1 text-[13px]", tone.inkSoft)}>
            依 Internal API 種類分類，維持和監控平台 API row 一致的讀法。
          </p>
          <p className={cn("mt-1 text-[11.5px]", tone.inkFaint)}>
            注意：偕同課系統的 <code className="font-mono">/api/schedules/*</code>、<code className="font-mono">/api/conflicts/*</code> 是游泳教練課表 API，屬「偕同課系統」管轄，顯示在偕同課監控頁，此處為 Smart Schedule Manager 的探活結果。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600">
            <Server className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-mono">{maskBaseUrl(block.baseUrl)}</span>
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
              block.tokenConfigured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            )}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {block.tokenConfigured ? "Token 已設定" : "Token 未設定"}
          </span>
        </div>
      </div>

      {!block.tokenConfigured ? (
        <EmptyState>
          尚未設定 <code className="font-mono text-[11px]">SMART_SCHEDULE_BASE_URL</code> 或
          <code className="ml-1 font-mono text-[11px]">SMART_SCHEDULE_API_TOKEN</code>，所有端點顯示為未連線。
        </EmptyState>
      ) : null}

      <div className="space-y-5">
        {block.categories.map((category) => {
          const meta = scheduleCategoryMeta[category.key];
          const Icon = meta.icon;
          if (!category.endpoints.length) return null;
          return (
            <section key={category.key}>
              <header className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className={cn("text-[14px] font-semibold", tone.ink)}>{meta.label}</p>
                    <p className={cn("text-[11.5px]", tone.inkFaint)}>{meta.description}</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-slate-600">
                  {category.endpoints.length} endpoint
                </span>
              </header>
              <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-white">
                <div className="grid grid-cols-[88px_minmax(0,1fr)_120px_180px] gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  <div>狀態</div>
                  <div>API</div>
                  <div className="text-right">流量 / 延遲</div>
                  <div className="text-right">24h 趨勢</div>
                </div>
                {category.endpoints.map((probe) => (
                  <ProbeRow key={probe.id} probe={probe} onOpenDetail={onOpenDetail} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ApiHealthPanel({
  groupedRows,
  availableTypes,
  typeFilter,
  onTypeFilterChange,
  isLoading,
  emptyLabel = "目前沒有符合條件的 API。",
  leadingNotice,
  onOpenDetail,
}: {
  groupedRows: Array<[string, ApiMonitoringRow[]]>;
  availableTypes: string[];
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  isLoading: boolean;
  emptyLabel?: string;
  leadingNotice?: React.ReactNode;
  onOpenDetail?: (row: ApiMonitoringRow) => void;
}) {
  const visibleRowCount = groupedRows.reduce((count, [, groupRows]) => count + groupRows.length, 0);

  return (
    <div className="space-y-4">
      {leadingNotice}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cn("text-[15px] font-semibold", tone.ink)}>API 健康狀態</h2>
          <p className={cn("mt-0.5 text-[12px]", tone.inkSoft)}>
            每列右側顯示最近 24 小時小時粒度趨勢；錯誤 bucket 以 X 標示。
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {["all", ...availableTypes].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onTypeFilterChange(type)}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-2.5 text-[11.5px] font-medium transition",
                typeFilter === type
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {type === "all" ? "全部" : typeLabels[type] ?? type}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="grid grid-cols-[88px_minmax(0,1fr)_120px_180px] gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
          <span>狀態</span>
          <span>API</span>
          <span className="text-right">流量 / 延遲</span>
          <span className="text-right">24h 趨勢</span>
        </div>

        {isLoading ? (
          <div className="px-5 py-8 text-center text-[12px] text-slate-500">API 監控載入中...</div>
        ) : null}
        {!isLoading && visibleRowCount === 0 ? (
          <div className="px-5 py-8">
            <EmptyState>{emptyLabel}</EmptyState>
          </div>
        ) : null}

        {groupedRows.map(([type, groupRows]) => (
          <section key={type}>
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/40 px-5 py-2">
              <span className={cn("text-[11px] font-semibold uppercase tracking-wider", tone.inkSoft)}>
                {typeLabels[type] ?? type}
              </span>
              <span className="rounded-full bg-slate-200/70 px-2 py-px text-[10px] font-semibold tabular-nums text-slate-600">
                {groupRows.length}
              </span>
            </div>
            {groupRows.map((row) => (
              <ApiRow key={row.id} row={row} onOpenDetail={onOpenDetail} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** collab-course 專用：GET 端點 / POST-DELETE 端點分區顯示 */
function CollabCourseHealthPanel({
  rows,
  isLoading,
  onOpenDetail,
}: {
  rows: ApiMonitoringRow[];
  isLoading: boolean;
  onOpenDetail?: (row: ApiMonitoringRow) => void;
}) {
  const getRows = rows.filter((r) => !r.skipped);
  const mutatingRows = rows.filter((r) => r.skipped);

  const tableHeader = (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_120px_180px] gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
      <span>狀態</span>
      <span>API</span>
      <span className="text-right">流量 / 延遲</span>
      <span className="text-right">24h 趨勢</span>
    </div>
  );

  const renderGroups = (tableRows: ApiMonitoringRow[], placeholder: string) => {
    if (isLoading) {
      return <div className="px-5 py-8 text-center text-[12px] text-slate-500">API 監控載入中...</div>;
    }
    if (!tableRows.length) {
      return <div className="px-5 py-8"><EmptyState>{placeholder}</EmptyState></div>;
    }
    const groups = new Map<string, ApiMonitoringRow[]>();
    tableRows.forEach((row) => {
      groups.set(row.source, [...(groups.get(row.source) ?? []), row]);
    });
    return (
      <>
        {Array.from(groups.entries()).map(([src, groupRows]) => (
          <section key={src}>
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/40 px-5 py-2">
              <span className={cn("text-[11px] font-semibold uppercase tracking-wider", tone.inkSoft)}>
                {src}
              </span>
              <span className="rounded-full bg-slate-200/70 px-2 py-px text-[10px] font-semibold tabular-nums text-slate-600">
                {groupRows.length}
              </span>
            </div>
            {groupRows.map((row) => (
              <ApiRow key={row.id} row={row} onOpenDetail={onOpenDetail} />
            ))}
          </section>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <h2 className={cn("text-[15px] font-semibold", tone.ink)}>讀取端點（GET）</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-slate-600">
            {isLoading ? "—" : getRows.length}
          </span>
        </div>
        <p className={cn("mb-3 text-[12px]", tone.inkSoft)}>主動探活，納入 KPI 統計。</p>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          {tableHeader}
          {renderGroups(getRows, "偕同課系統 GET 端點尚未接入。")}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <h2 className={cn("text-[15px] font-semibold", tone.ink)}>寫入端點（POST / DELETE）</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-slate-600">
            {isLoading ? "—" : mutatingRows.length}
          </span>
        </div>
        <p className={cn("mb-3 text-[12px]", tone.inkSoft)}>
          寫入端點不主動探活，不計入 KPI 統計；僅供架構參考。
        </p>
        <div className="overflow-hidden rounded-md border border-slate-200/60 bg-white opacity-75">
          {tableHeader}
          {renderGroups(mutatingRows, "無寫入端點登錄。")}
        </div>
      </div>
    </div>
  );
}

const ERROR_TYPE_OPTIONS = [
  { value: "all", label: "全部類型" },
  { value: "timeout", label: "timeout" },
  { value: "4xx", label: "4xx" },
  { value: "5xx", label: "5xx" },
  { value: "aborted", label: "aborted" },
] as const;

function RecentErrorsPanel({ recentErrors }: { recentErrors: ApiMonitoringError[] }) {
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>("all");

  const filtered = errorTypeFilter === "all" ? recentErrors : recentErrors.filter((e) => e.errorType === errorTypeFilter);

  if (recentErrors.length === 0) {
    return <EmptyState>最近沒有 4xx / 5xx / timeout / aborted。</EmptyState>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={errorTypeFilter}
          onChange={(e) => setErrorTypeFilter(e.target.value)}
          className="h-8 rounded-[6px] border border-slate-200 bg-white px-2 text-[11.5px] font-semibold text-slate-700"
          data-testid="select-error-type-filter"
        >
          {ERROR_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-[11px] text-slate-400">{filtered.length} 筆</span>
      </div>
      {filtered.length === 0 ? (
        <EmptyState>此類型目前沒有錯誤記錄。</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          {filtered.slice(0, 50).map((error) => (
            <div key={error.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12px] font-semibold text-slate-900">{error.route}</p>
                  <p className="mt-1 text-[12px] font-medium text-rose-700">
                    {error.errorType}
                    <span className="ml-1.5 text-slate-500">· {error.durationMs}ms</span>
                  </p>
                </div>
                <span className="shrink-0 rounded bg-rose-100 px-1.5 py-px text-[10px] font-semibold text-rose-700 tabular-nums">
                  {error.statusCode}
                </span>
              </div>
              <p className="mt-1 text-[10.5px] text-slate-400">
                {relativeTime(error.occurredAt)}
                <span className="ml-1">
                  · {new Date(error.occurredAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditEventsPanel({ auditEvents }: { auditEvents: ApiMonitoringAuditEvent[] }) {
  if (auditEvents.length === 0) {
    return <EmptyState>尚無操作紀錄。</EmptyState>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      {auditEvents.slice(0, 50).map((event) => (
        <div key={event.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <p
              className={cn("max-w-[160px] truncate text-[12.5px] font-semibold", tone.ink)}
              title={event.action}
            >
              {event.action}
            </p>
            <p className="shrink-0 text-[10.5px] text-slate-400">{relativeTime(event.occurredAt)}</p>
          </div>
          <p className="mt-0.5 min-w-0 text-[11.5px] text-slate-500">
            <span className="font-medium text-slate-700">{event.actorId ?? "system"}</span>
            <span className="mx-1 text-slate-300">·</span>
            <span className="min-w-0 break-all font-mono">{event.resource}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function ApiMonitoringDetailDrawer({
  open,
  onClose,
  detail,
  isLoading,
  isError,
  notes,
  pendingFingerprint,
  onNoteChange,
  onResolve,
  onReopen,
}: {
  open: boolean;
  onClose: () => void;
  detail?: ApiMonitoringDetailDto;
  isLoading: boolean;
  isError: boolean;
  notes: Record<string, string>;
  pendingFingerprint?: string;
  onNoteChange: (fingerprint: string, note: string) => void;
  onResolve: (group: ApiMonitoringErrorGroup) => void;
  onReopen: (group: ApiMonitoringErrorGroup) => void;
}) {
  const row = detail?.row;
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-[#f7f9fc] p-0 sm:max-w-[780px]">
        <SheetHeader className="border-b border-slate-200 bg-white px-5 py-4 text-left">
          <SheetTitle className="text-[17px] font-semibold text-slate-900">
            {row ? row.label : "API 明細"}
          </SheetTitle>
          <SheetDescription className="font-mono text-[12px] text-slate-500">
            {row ? `${row.method} ${row.path}` : "讀取單一 API 的時間序列與錯誤處理狀態"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {isLoading ? (
            <EmptyState>API 明細載入中...</EmptyState>
          ) : null}
          {isError ? (
            <EmptyState>API 明細讀取失敗，請稍後重試。</EmptyState>
          ) : null}

          {detail && row ? (
            <>
              <div className="grid gap-2.5 md:grid-cols-4">
                {[
                  { label: "24h calls", value: row.totalCount.toLocaleString(), tone: "text-slate-900" },
                  { label: "未處理錯誤", value: String(row.unresolvedErrorCount), tone: row.unresolvedErrorCount > 0 ? "text-rose-700" : "text-slate-900" },
                  { label: "已處理", value: String(row.resolvedErrorCount), tone: "text-slate-700" },
                  { label: "平均延遲", value: row.avgDurationMs === null ? "—" : `${row.avgDurationMs}ms`, tone: row.avgDurationMs !== null && row.avgDurationMs >= 1000 ? "text-amber-700" : "text-slate-900" },
                ].map((item) => (
                  <div key={item.label} className="rounded-md border border-slate-200 bg-white p-3">
                    <SectionLabel>{item.label}</SectionLabel>
                    <p className={cn("mt-2 text-[22px] font-semibold tabular-nums", item.tone)}>{item.value}</p>
                  </div>
                ))}
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-slate-900">未處理錯誤</h3>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-700">
                    {detail.unresolvedErrorGroups.length} groups
                  </span>
                </div>
                {detail.unresolvedErrorGroups.length === 0 ? (
                  <EmptyState>目前沒有未處理錯誤。</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {detail.unresolvedErrorGroups.map((group) => (
                      <ErrorGroupCard
                        key={group.fingerprint}
                        group={group}
                        note={notes[group.fingerprint] ?? ""}
                        pending={pendingFingerprint === group.fingerprint}
                        onNoteChange={(value) => onNoteChange(group.fingerprint, value)}
                        onResolve={() => onResolve(group)}
                        onReopen={() => onReopen(group)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-[14px] font-semibold text-slate-900">24h 每小時明細</h3>
                <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="grid grid-cols-[1fr_80px_80px_100px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                    <span>時間</span>
                    <span className="text-right">calls</span>
                    <span className="text-right">errors</span>
                    <span className="text-right">avg</span>
                  </div>
                  {detail.hourlyBuckets.map((bucket) => (
                    <div
                      key={bucket.hour}
                      className={cn(
                        "grid grid-cols-[1fr_80px_80px_100px] gap-3 border-b border-slate-100 px-4 py-2.5 text-[12px] last:border-b-0",
                        bucket.errors > 0 ? "bg-rose-50/50" : "bg-white",
                      )}
                    >
                      <span className="inline-flex items-center gap-2 text-slate-700">
                        {bucket.errors > 0 ? <XCircle className="h-3.5 w-3.5 text-rose-600" /> : <Clock3 className="h-3.5 w-3.5 text-slate-300" />}
                        {formatDateTime(bucket.hour)}
                      </span>
                      <span className="text-right font-mono text-slate-700">{bucket.total}</span>
                      <span className={cn("text-right font-mono", bucket.errors > 0 ? "font-semibold text-rose-700" : "text-slate-400")}>{bucket.errors}</span>
                      <span className="text-right font-mono text-slate-500">{bucket.avgDurationMs === null ? "—" : `${bucket.avgDurationMs}ms`}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[14px] font-semibold text-slate-900">已處理錯誤</h3>
                {detail.resolvedErrorGroups.length === 0 ? (
                  <EmptyState>尚無已處理錯誤。</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {detail.resolvedErrorGroups.map((group) => (
                      <ErrorGroupCard
                        key={group.fingerprint}
                        group={group}
                        note={notes[group.fingerprint] ?? ""}
                        pending={pendingFingerprint === group.fingerprint}
                        onNoteChange={(value) => onNoteChange(group.fingerprint, value)}
                        onResolve={() => onResolve(group)}
                        onReopen={() => onReopen(group)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-[14px] font-semibold text-slate-900">最近 request</h3>
                {detail.recentRecords.length === 0 ? (
                  <EmptyState>尚未累積 request 明細。</EmptyState>
                ) : (
                  <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                    {detail.recentRecords.map((record: ApiMonitoringRequestRecord) => (
                      <div key={record.id} className="grid grid-cols-[1fr_74px_88px] gap-3 border-b border-slate-100 px-4 py-2.5 text-[12px] last:border-b-0">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{formatDateTime(record.occurredAt)}</p>
                          <p className="truncate font-mono text-[10.5px] text-slate-400">{record.correlationId ?? record.route}</p>
                        </div>
                        <span className={cn("text-right font-mono font-semibold", record.statusCode >= 400 || record.statusCode === 499 ? "text-rose-700" : "text-emerald-700")}>
                          {record.statusCode}
                        </span>
                        <span className="text-right font-mono text-slate-500">{record.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ============================================================
 * Page
 * ============================================================ */

export default function SystemApiMonitoringPage({ projectKey }: { projectKey: ApiMonitoringProjectKey }) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [lineTab, setLineTab] = useState<LineTabKey>(() => readLineTabFromUrl());
  const [baseTab, setBaseTab] = useState<BaseMonitoringTabKey>(() => readBaseMonitoringTabFromUrl());
  const [detailTarget, setDetailTarget] = useState<ApiDetailTarget | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["/api/bff/system/api-monitoring", projectKey],
    queryFn: () => fetchApiMonitoring(projectKey),
    refetchInterval: 30_000,
  });
  const isLineMonitoring = projectKey === "400line";
  const isScheduleMonitoring = projectKey === "schedule";
  const lineOverviewQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/overview", "monitoring"],
    queryFn: fetchLinebotManagementOverview,
    enabled: isLineMonitoring,
    retry: 1,
  });
  const lineXbsQuery = useQuery({
    queryKey: ["/api/bff/system/lineXBS-status", "monitoring"],
    queryFn: fetchLineXbsStatus,
    enabled: isLineMonitoring,
    retry: 1,
  });
  const lineServicesQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/services", "monitoring"],
    queryFn: fetchLinebotManagementServices,
    enabled: isLineMonitoring && (lineTab === "services" || lineTab === "readiness"),
    retry: 1,
  });
  const lineFacilitiesQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/facilities", "monitoring"],
    queryFn: fetchLinebotManagementFacilities,
    enabled: isLineMonitoring && (lineTab === "facilities" || lineTab === "readiness"),
    retry: 1,
  });
  const lineWhitelistQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/whitelist-snapshot", "monitoring"],
    queryFn: fetchLinebotManagementWhitelist,
    enabled: isLineMonitoring && (lineTab === "permissions" || lineTab === "readiness"),
    retry: 1,
  });
  const linePipelineQuery = useQuery({
    queryKey: ["/api/bff/system/linebot-management/announcement-pipeline", "monitoring"],
    queryFn: fetchLinebotManagementPipeline,
    enabled: isLineMonitoring && (lineTab === "pipeline" || lineTab === "readiness"),
    retry: 1,
  });
  const detailQuery = useQuery({
    queryKey: ["/api/bff/system/api-monitoring/detail", detailTarget],
    queryFn: () => {
      if (!detailTarget) throw new Error("Missing detail target");
      return fetchApiMonitoringDetail(detailTarget.projectKey, detailTarget.rowId, detailTarget);
    },
    enabled: Boolean(detailTarget),
  });
  const resolutionMutation = useMutation({
    mutationFn: (input: { group: ApiMonitoringErrorGroup; status: "resolved" | "open" }) =>
      updateApiMonitoringErrorGroupStatus(input.group.fingerprint, {
        status: input.status,
        note: resolutionNotes[input.group.fingerprint],
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/bff/system/api-monitoring", projectKey] }),
        queryClient.invalidateQueries({ queryKey: ["/api/bff/system/api-monitoring/detail"] }),
      ]);
    },
  });

  const data = query.data;
  const rows = data?.rows ?? [];
  const groupBySource = projectKey === "collab-course";
  const visibleRows = typeFilter === "all"
    ? rows
    : rows.filter((row) => (groupBySource ? row.source : row.type) === typeFilter);
  const groupedRows = useMemo(() => {
    const groups = new Map<string, ApiMonitoringRow[]>();
    visibleRows.forEach((row) => {
      const groupKey = groupBySource ? row.source : row.type;
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
    });
    return Array.from(groups.entries());
  }, [groupBySource, visibleRows]);
  const availableTypes = Array.from(new Set(rows.map((row) => groupBySource ? row.source : row.type)));
  const lineReadinessItems = useMemo(
    () => [
      ...(lineOverviewQuery.data?.apiReadiness ?? []),
      ...(lineXbsQuery.data?.apiReadiness ?? []),
      ...(lineServicesQuery.data?.apiReadiness ?? []),
      ...(lineFacilitiesQuery.data?.apiReadiness ?? []),
      ...(lineWhitelistQuery.data?.apiReadiness ?? []),
      ...(linePipelineQuery.data?.apiReadiness ?? []),
    ],
    [
      lineFacilitiesQuery.data?.apiReadiness,
      lineOverviewQuery.data?.apiReadiness,
      linePipelineQuery.data?.apiReadiness,
      lineServicesQuery.data?.apiReadiness,
      lineWhitelistQuery.data?.apiReadiness,
      lineXbsQuery.data?.apiReadiness,
    ],
  );

  const recentErrors = data?.recentErrors ?? [];
  const auditEvents = data?.auditEvents ?? [];

  const scheduleSummary: MonitoringSummary | undefined = useMemo(() => {
    if (!isScheduleMonitoring || !data?.scheduleBlock) return data?.summary;
    const s = data.scheduleBlock.summary;
    return {
      totalApis: s.healthy + s.warning + s.error,
      healthyApis: s.healthy,
      warningApis: s.warning,
      errorApis: s.error,
    };
  }, [isScheduleMonitoring, data?.scheduleBlock, data?.summary]);

  const openDetail = (target: ApiDetailTarget) => {
    setDetailTarget(target);
  };

  const openRowDetail = (row: ApiMonitoringRow) => {
    openDetail({
      rowId: row.id,
      projectKey: row.projectKey,
      route: row.path,
      label: row.label,
      method: row.method,
    });
  };

  const selectLineTab = (next: LineTabKey) => {
    setLineTab(next);
    if (!isLineMonitoring || typeof window === "undefined") return;
    const search = next === "overview" ? "" : `?tab=${next}`;
    window.history.replaceState(null, "", `/system/monitoring/400line${search}`);
  };

  const selectBaseTab = (next: BaseMonitoringTabKey) => {
    setBaseTab(next);
    if (isLineMonitoring || typeof window === "undefined") return;
    const basePath = projectKey === "all" ? "/system/monitoring" : `/system/monitoring/${projectKey}`;
    const search = next === "health" ? "" : `?tab=${next}`;
    window.history.replaceState(null, "", `${basePath}${search}`);
  };

  const renderBaseMonitoringContent = () => {
    if (baseTab === "errors") return <RecentErrorsPanel recentErrors={recentErrors} />;
    if (baseTab === "audit") return <AuditEventsPanel auditEvents={auditEvents} />;

    if (isScheduleMonitoring && data?.scheduleBlock) {
      return <ScheduleMonitoringSection block={data.scheduleBlock} onOpenDetail={openDetail} />;
    }

    if (projectKey === "collab-course") {
      return <CollabCourseHealthPanel rows={rows} isLoading={query.isLoading} onOpenDetail={openRowDetail} />;
    }

    return (
      <ApiHealthPanel
        groupedRows={groupedRows}
        availableTypes={availableTypes}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        isLoading={query.isLoading}
        emptyLabel="目前沒有符合條件的 API。"
        onOpenDetail={openRowDetail}
      />
    );
  };

  return (
    <RoleShell role="system" title="監控平台" subtitle="SYSTEM API MONITORING">
      <div className="mx-auto max-w-[1440px] space-y-5 pb-12" data-testid="system-api-monitoring-page">
        {query.isError ? (
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">監控平台資料讀取失敗</p>
              <p className="mt-0.5 text-[12px] text-rose-600/80">請稍後重試,或檢查 BFF 服務狀態。</p>
            </div>
          </div>
        ) : null}

        {/* ============ 400LINE Block ============ */}
        {isLineMonitoring ? (
          <MonitoringTopShell
            summary={data?.summary}
            kpiSlot={
              <LineCapabilityKpiBar
                cards={lineOverviewQuery.data?.cards ?? []}
                isLoading={lineOverviewQuery.isLoading}
                isError={lineOverviewQuery.isError}
              />
            }
            tabs={lineTabs}
            activeTab={lineTab}
            onSelectTab={selectLineTab}
          >
              {lineTab === "overview" ? (
                <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className={cn("text-[15px] font-semibold", tone.ink)}>400LINE 總覽</h2>
                      {lineOverviewQuery.data ? <LineStatusBadge status={lineOverviewQuery.data.status} /> : null}
                      {lineXbsQuery.data ? <LineStatusBadge status={lineXbsQuery.data.status} /> : null}
                    </div>
                    <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                      {(lineOverviewQuery.data?.cards ?? []).map((card) => (
                        <div key={card.label} className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-2">
                            <SectionLabel>{card.label}</SectionLabel>
                            <LineStatusBadge status={card.status} />
                          </div>
                          <p className={cn("mt-2 text-[22px] font-semibold tabular-nums", tone.ink)}>
                            {card.value}
                          </p>
                          <p className={cn("mt-0.5 text-[11.5px]", tone.inkSoft)}>{card.hint}</p>
                        </div>
                      ))}
                    </div>
                    {!lineOverviewQuery.isLoading && !lineOverviewQuery.isError && lineOverviewQuery.data?.status === "waiting_for_400line_api" ? (
                      <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-[12px] font-medium text-amber-700">正在等待 400LINE API 回應，數據可能尚未完整載入（通常需 2–5 秒後自動刷新）。</p>
                      </div>
                    ) : null}
                    {lineOverviewQuery.isLoading && !(lineOverviewQuery.data?.cards ?? []).length ? (
                      <p className="mt-3 text-[12px] text-slate-400">400LINE 總覽資料讀取中，請稍候…</p>
                    ) : null}
                    {lineOverviewQuery.isError ? (
                      <p className="mt-3 text-[12px] font-medium text-rose-700">400LINE 總覽資料讀取失敗。</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <SectionLabel>LineXBS 分類</SectionLabel>
                    {(lineXbsQuery.data?.groups ?? []).map((group) => (
                      <div key={group.key} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-[13px] font-semibold", tone.ink)}>{group.label}</p>
                          <LineStatusBadge status={group.status} />
                        </div>
                        <p className="mt-1 text-[11.5px] text-slate-500">
                          {group.items.length} services · {group.apiReadiness.length} readiness
                        </p>
                      </div>
                    ))}
                    {!lineXbsQuery.isLoading && !(lineXbsQuery.data?.groups ?? []).length ? (
                      <LineEmpty label="LineXBS 分類" />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {lineTab === "services" ? (
                <div className="space-y-2">
                  {(lineServicesQuery.data?.services ?? []).length ? (
                    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                      <div className="grid grid-cols-[88px_minmax(0,1fr)_120px_180px] gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                        <div>狀態</div>
                        <div>API</div>
                        <div className="text-right">流量 / 延遲</div>
                        <div className="text-right">24h 趨勢</div>
                      </div>
                      {(lineServicesQuery.data?.services ?? []).map((service) => {
                        const status = lineStatusToApiStatus(service.status);
                        const route = service.sourcePath || service.key;
                        return (
                          <MonitoringApiRow
                            key={service.key}
                            status={status}
                            label={service.label}
                            method="GET"
                            path={route}
                            totalCount={service.lastSyncAt ? 1 : 0}
                            avgDurationMs={null}
                            trend={latestCheckTrend(status, service.lastSyncAt, null, Boolean(service.lastSyncAt))}
                            onOpenDetail={() => openDetail({
                              rowId: `line-service:${service.key}`,
                              projectKey: "400line",
                              route,
                              label: service.label,
                              method: "GET",
                              status,
                              checkedAt: service.lastSyncAt,
                            })}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                  {lineServicesQuery.isLoading ? (
                    <p className="text-[12px] text-slate-500">服務監控載入中...</p>
                  ) : null}
                  {!lineServicesQuery.isLoading && !(lineServicesQuery.data?.services ?? []).length ? (
                    <LineEmpty label="服務監控" />
                  ) : null}
                </div>
              ) : null}

              {lineTab === "facilities" ? (
                <div className="space-y-2">
                  {(lineFacilitiesQuery.data?.items ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[110px_minmax(0,1fr)_220px] items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3"
                    >
                      <LineStatusBadge status={item.status} />
                      <div className="min-w-0">
                        <p className={cn("truncate text-[13px] font-semibold", tone.ink)}>{item.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-slate-500">{item.message}</p>
                      </div>
                      <p className="truncate font-mono text-[11px] text-slate-500">{item.groupId}</p>
                    </div>
                  ))}
                  {lineFacilitiesQuery.data?.diffNote ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                      {lineFacilitiesQuery.data.diffNote}
                    </div>
                  ) : null}
                  {lineFacilitiesQuery.isLoading ? (
                    <p className="text-[12px] text-slate-500">群組 / 館別載入中...</p>
                  ) : null}
                  {!lineFacilitiesQuery.isLoading && !(lineFacilitiesQuery.data?.items ?? []).length ? (
                    <LineEmpty label="群組 / 館別" />
                  ) : null}
                </div>
              ) : null}

              {lineTab === "whitelist" ? (
                <LineWhitelistManagementPanel embedded />
              ) : null}

              {lineTab === "permissions" ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <SectionLabel>規則</SectionLabel>
                    {(lineWhitelistQuery.data?.rules ?? []).map((rule) => (
                      <p key={rule} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700">
                        {rule}
                      </p>
                    ))}
                  </div>
                  <div>
                    <SectionLabel>使用者權限摘要</SectionLabel>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {(lineWhitelistQuery.data?.items ?? [])
                        .filter((item) => item.featureSummary && item.featureSummary !== "-")
                        .slice(0, 16)
                        .map((item) => (
                          <div
                            key={`${item.lineUserId}-permission`}
                            className="rounded-md border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <p className={cn("text-[13px] font-semibold", tone.ink)}>{item.displayName}</p>
                            <p className="mt-0.5 text-[12px] text-slate-500">{item.featureSummary}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                  {lineWhitelistQuery.isLoading ? (
                    <p className="text-[12px] text-slate-500">權限資料載入中...</p>
                  ) : null}
                  {!lineWhitelistQuery.isLoading && !(lineWhitelistQuery.data?.items ?? []).length ? (
                    <LineEmpty label="權限" />
                  ) : null}
                </div>
              ) : null}

              {lineTab === "pipeline" ? (
                <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                  <div className="space-y-2">
                    {(linePipelineQuery.data?.stages ?? []).map((stage) => (
                      <div key={stage.key} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-[13px] font-semibold", tone.ink)}>{stage.label}</p>
                          <LineStatusBadge status={stage.status} />
                        </div>
                        <p className="mt-1 text-[12px] leading-5 text-slate-600">{stage.description}</p>
                        {stage.sourcePath ? (
                          <p className="mt-1 font-mono text-[11px] text-slate-400">{stage.sourcePath}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <SectionLabel>公告候選計數</SectionLabel>
                    <dl className="mt-3 space-y-2.5">
                      {[
                        { label: "候選", value: linePipelineQuery.data?.counters.candidateCount },
                        { label: "今日處理", value: linePipelineQuery.data?.counters.todayProcessed },
                        { label: "問題", value: linePipelineQuery.data?.counters.issues },
                      ].map((m) => (
                        <div key={m.label} className="flex items-baseline justify-between">
                          <dt className="text-[12px] text-slate-500">{m.label}</dt>
                          <dd className={cn("text-[18px] font-semibold tabular-nums", tone.ink)}>
                            {m.value ?? "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  {linePipelineQuery.isLoading ? (
                    <p className="text-[12px] text-slate-500">重要公告管線載入中...</p>
                  ) : null}
                </div>
              ) : null}

              {lineTab === "readiness" ? <LineReadinessList items={lineReadinessItems} onOpenDetail={openDetail} /> : null}
          </MonitoringTopShell>
        ) : null}

        {!isLineMonitoring ? (
          <MonitoringTopShell
            summary={scheduleSummary}
            tabs={baseMonitoringTabs}
            activeTab={baseTab}
            onSelectTab={selectBaseTab}
          >
            {renderBaseMonitoringContent()}
          </MonitoringTopShell>
        ) : null}

        <ApiMonitoringDetailDrawer
          open={Boolean(detailTarget)}
          onClose={() => setDetailTarget(null)}
          detail={detailQuery.data}
          isLoading={detailQuery.isLoading}
          isError={detailQuery.isError}
          notes={resolutionNotes}
          pendingFingerprint={resolutionMutation.isPending ? resolutionMutation.variables?.group.fingerprint : undefined}
          onNoteChange={(fingerprint, note) => setResolutionNotes((current) => ({ ...current, [fingerprint]: note }))}
          onResolve={(group) => resolutionMutation.mutate({ group, status: "resolved" })}
          onReopen={(group) => resolutionMutation.mutate({ group, status: "open" })}
        />
      </div>
    </RoleShell>
  );
}
