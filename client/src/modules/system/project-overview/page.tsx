import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowUpRight,
  Clock,
  RefreshCw,
  XCircle,
  AlertOctagon,
  History,
  Activity,
  Layers,
  TrendingDown,
  TrendingUp,
  Rocket,
  ShieldCheck,
  CircleCheck,
} from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";
import { cn } from "@/lib/utils";
import { fetchSystemProjectMonitoring } from "../project-monitoring/api";
import { fetchApiMonitoring } from "../api-monitoring/api";
import type {
  SparklineBucket,
  SystemProjectStatus,
  SystemProjectSummary,
} from "@shared/system/project-monitoring-contract";
import type { ApiMonitoringError } from "@shared/system/api-monitoring-contract";

// ============================================================================
// SystemProjectSummary contract fields used here:
//   uptime7d?: number           0-100 percentage (non-governance cards)
//   errorsTrend72h?: SparklineBucket[]  24 × 3h buckets, oldest first
//   lastActivity?: string       human-readable latest event description
//   alertsPending?: number      count of unresolved alerts (governance only)
// ============================================================================

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

interface ActivityEntry {
  id: string;
  kind: "deploy" | "fix" | "security" | "info";
  title: string;
  detail?: string;
  occurredAt: string;
}

// All enrichment fields are now part of SystemProjectSummary (see contract).
type ProjectWithMetrics = SystemProjectSummary;

const fetchWatchdogEvents = () =>
  apiGet<{ items: WatchdogEventDto[] }>("/api/bff/system/watchdog-events");
const fetchRecentAssists = () =>
  apiGet<{ items: RecentAssist[] }>(
    "/api/bff/system/operations/recent-assists?limit=50",
  );
// TODO: wire up when BFF endpoint is ready. Until then it 404s silently
// and the UI falls back to the activity-empty state.
const fetchRecentActivity = () =>
  apiGet<{ items: ActivityEntry[] }>(
    "/api/bff/system/recent-activity?limit=5",
  );

// ---------- helpers ----------

const statusDotBg = (s: SystemProjectStatus) => {
  if (s === "ready") return "bg-[#22c55e]";
  if (s === "degraded") return "bg-[#f59e0b]";
  if (s === "error") return "bg-[#dc2626]";
  return "bg-[#9ca3af]";
};

const statusToneText = (s: SystemProjectStatus) => {
  if (s === "ready") return "text-[#188249]";
  if (s === "degraded") return "text-[#9b6a00]";
  if (s === "error") return "text-[#dc2626]";
  return "text-[#536175]";
};

const sparkTone = (s: SystemProjectStatus) => {
  if (s === "error") return "bg-[#fca5a5]";
  if (s === "degraded") return "bg-[#fbc784]";
  return "bg-[#d6dde6]";
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

const ERROR_BADGE_TONE: Record<string, string> = {
  "5xx": "bg-[#ffe8eb] text-[#791f1f]",
  "4xx": "bg-[#fff6e7] text-[#633806]",
  timeout: "bg-[#fff6e7] text-[#633806]",
  aborted: "bg-[#eef2f6] text-[#536175]",
};

function badgeToneFor(err: ApiMonitoringError): string {
  if (err.statusCode && err.statusCode >= 500) return ERROR_BADGE_TONE["5xx"];
  if (err.statusCode && err.statusCode >= 400) return ERROR_BADGE_TONE["4xx"];
  return ERROR_BADGE_TONE[err.errorType] ?? "bg-[#eef2f6] text-[#536175]";
}

// Group errors by route + statusCode/errorType so 24 repeated 403s
// become one row with a count, not 24 rows of noise.
interface ErrorGroup {
  key: string;
  route: string;
  statusCode?: number;
  errorType: string;
  count: number;
  latest: ApiMonitoringError;
  hint: string;
}

function groupErrors(errors: ApiMonitoringError[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (const err of errors) {
    const key = `${err.route}|${err.statusCode ?? err.errorType}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (new Date(err.occurredAt) > new Date(existing.latest.occurredAt)) {
        existing.latest = err;
      }
    } else {
      groups.set(key, {
        key,
        route: err.route,
        statusCode: err.statusCode,
        errorType: err.errorType,
        count: 1,
        latest: err,
        hint: hintFor(err),
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return new Date(b.latest.occurredAt).getTime() - new Date(a.latest.occurredAt).getTime();
  });
}

function hintFor(err: ApiMonitoringError): string {
  if (err.statusCode === 401) return "session 過期";
  if (err.statusCode === 403) return "角色檢查未通過";
  if (err.statusCode === 404) return "路由不存在";
  if (err.statusCode && err.statusCode >= 500) return "後端錯誤";
  if (err.errorType === "timeout") return "請求逾時";
  if (err.errorType === "aborted") return "客戶端取消";
  return err.errorType;
}

// ---------- sub-components ----------

function CompactStatusHeader({
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
  const dot = ok ? "bg-[#22c55e]" : hasError ? "bg-[#dc2626]" : "bg-[#f59e0b]";
  const ring = ok
    ? "shadow-[0_0_0_4px_rgba(34,197,94,0.18)]"
    : hasError
      ? "shadow-[0_0_0_4px_rgba(220,38,38,0.18)]"
      : "shadow-[0_0_0_4px_rgba(245,158,11,0.18)]";
  const text = ok
    ? "系統運作正常"
    : hasError
      ? `系統異常 · ${attention} 個需注意`
      : `系統運作中 · ${attention} 個需注意`;

  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-3">
        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", dot, ring)} />
        <div>
          <p className="text-[14px] font-black leading-tight text-[#10233f]" data-testid="status-headline">
            {text}
          </p>
          <p className="text-[11px] font-bold text-[#637185]">
            {projectCount} 個父系統 · 30 秒自動更新
            {generatedAt && (
              <>
                {" · 最後同步 "}
                {new Date(generatedAt).toLocaleTimeString("zh-TW", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isError && (
          <span className="flex items-center gap-1 rounded-full bg-[#ffe8eb] px-2.5 py-1 text-[10px] font-black text-[#dc2626]">
            <XCircle className="h-3 w-3" />
            讀取失敗
          </span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="flex h-7 items-center gap-1.5 rounded-[6px] border border-[#dfe7ef] bg-white px-2.5 text-[11px] font-black text-[#10233f] hover:bg-[#f3f6fb] disabled:opacity-50"
          data-testid="button-refresh"
        >
          <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          更新
        </button>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  hint,
  trend,
  progress,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  trend?: { direction: "up" | "down"; label: string; tone: "good" | "bad" | "neutral" };
  progress?: number;
}) {
  const trendTone =
    trend?.tone === "good"
      ? "text-[#188249]"
      : trend?.tone === "bad"
        ? "text-[#dc2626]"
        : "text-[#637185]";
  const TrendIcon = trend?.direction === "down" ? TrendingDown : TrendingUp;
  return (
    <WorkbenchCard className="p-3">
      <p className="text-[11px] font-bold text-[#637185]">{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[22px] font-black leading-none text-[#10233f]" data-testid={`kpi-${label}`}>
          {value}
        </span>
        {unit && <span className="text-[11px] font-bold text-[#8b9aae]">{unit}</span>}
        {trend && (
          <span className={cn("ml-1 inline-flex items-center gap-0.5 text-[10px] font-black", trendTone)}>
            <TrendIcon className="h-3 w-3" />
            {trend.label}
          </span>
        )}
      </div>
      {typeof progress === "number" && (
        <div className="mt-2 h-[3px] overflow-hidden rounded-[2px] bg-[#eef2f6]">
          <div
            className={cn(
              "h-full",
              progress >= 90 ? "bg-[#22c55e]" : progress >= 70 ? "bg-[#f59e0b]" : "bg-[#dc2626]",
            )}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="mt-1.5 text-[10px] font-bold text-[#8b9aae]">{hint}</p>}
    </WorkbenchCard>
  );
}

function KpiStrip({
  healthScore,
  errors24h,
  errorsTrend,
  pending,
  alerts24h,
}: {
  healthScore: number;
  errors24h: number;
  errorsTrend?: number;
  pending: number;
  alerts24h: number;
}) {
  const trend =
    typeof errorsTrend === "number" && errorsTrend !== 0
      ? {
          direction: errorsTrend < 0 ? ("down" as const) : ("up" as const),
          label: `${Math.abs(errorsTrend)}%`,
          tone: errorsTrend < 0 ? ("good" as const) : ("bad" as const),
        }
      : undefined;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="系統健康度"
        value={healthScore}
        unit="/ 100"
        progress={healthScore}
      />
      <KpiCard
        label="24h 錯誤"
        value={errors24h}
        trend={trend}
        hint={trend ? "較昨日比較" : "尚無昨日基準"}
      />
      <KpiCard
        label="待處理"
        value={pending}
        unit="件"
        hint={pending === 0 ? "無告警 · 無失敗" : "需介入處理"}
      />
      <KpiCard
        label="24h 告警"
        value={alerts24h}
        hint="watchdog 事件總數"
      />
    </div>
  );
}

// Format a sparkline slot's time range for the popover header.
// Output: "05/21 下午03:00 – 06:00"
function formatSlotRange(isoStart: string): string {
  const start = new Date(isoStart);
  const end = new Date(start.getTime() + 3 * 3_600_000);
  const datePart = start.toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  });
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Taipei",
    });
  return `${datePart} ${fmtTime(start)} – ${fmtTime(end)}`;
}

const ERROR_TYPE_BADGE: Record<string, string> = {
  "5xx": "bg-[#ffe8eb] text-[#991b1b]",
  "4xx": "bg-[#fff6e7] text-[#7c3b00]",
  timeout: "bg-[#fdf3c5] text-[#713f00]",
  other: "bg-[#eef2f6] text-[#536175]",
};

function SparklinePopover({
  bucket,
  onClose,
}: {
  bucket: SparklineBucket;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute bottom-full left-0 z-50 mb-2 w-[230px] rounded-[8px] border border-[#dfe7ef] bg-white p-3 shadow-[0_4px_16px_rgba(16,35,63,0.12)]"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-black text-[#10233f]">
          {formatSlotRange(bucket.slotStart)}
        </span>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
          className="rounded px-1 text-[11px] text-[#8b9aae] hover:text-[#10233f]"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>
      <p className="mb-1.5 text-[10px] font-bold text-[#8b9aae]">
        {bucket.count} 個錯誤／逾時
      </p>
      {bucket.errors.length === 0 ? (
        <p className="text-[10px] text-[#8b9aae]">無詳細紀錄</p>
      ) : (
        <ul className="space-y-1">
          {bucket.errors.map((err, i) => (
            <li
              key={i}
              className="rounded-[5px] border border-[#edf1f6] bg-[#fbfcfd] px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "shrink-0 rounded-[3px] px-1 py-0.5 text-[9px] font-black",
                    ERROR_TYPE_BADGE[err.errorType] ?? ERROR_TYPE_BADGE.other,
                  )}
                >
                  {err.statusCode || err.errorType}
                </span>
                <span className="truncate font-mono text-[9px] font-bold text-[#10233f]">
                  {err.route}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] text-[#8b9aae]">
                {new Date(err.timestamp).toLocaleString("zh-TW", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                  timeZone: "Asia/Taipei",
                })}{" · "}
                {err.durationMs}ms
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sparkline({
  data,
  tone,
}: {
  data?: SparklineBucket[];
  tone: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isEmpty = !data || data.length === 0;
  const counts = isEmpty ? [] : data.map((b) => b.count);
  const max = counts.length > 0 ? Math.max(...counts, 1) : 1;

  return (
    <div ref={wrapRef} className="relative mt-2">
      <div className="flex h-3 items-end gap-[1px]">
        {isEmpty
          ? Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-[1px] bg-[#eef2f6]"
                style={{ height: "20%" }}
              />
            ))
          : data!.map((bucket, i) => (
              <div
                key={i}
                role="button"
                aria-label={`${formatSlotRange(bucket.slotStart)} · ${bucket.count} 個錯誤`}
                className={cn(
                  "flex-1 rounded-[1px] transition-opacity",
                  bucket.count > 0
                    ? cn(tone, "cursor-pointer hover:opacity-70")
                    : "bg-[#eef2f6]",
                  activeIdx === i && "ring-1 ring-[#10233f]",
                )}
                style={{ height: `${Math.max(10, (bucket.count / max) * 100)}%` }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (bucket.count === 0) return;
                  setActiveIdx(activeIdx === i ? null : i);
                }}
              />
            ))}
      </div>

      {activeIdx !== null && data && data[activeIdx] && (
        <SparklinePopover
          bucket={data[activeIdx]}
          onClose={() => setActiveIdx(null)}
        />
      )}
    </div>
  );
}

function ProjectPortalCard({ item }: { item: ProjectWithMetrics }) {
  const href = item.key === "governance" ? "/system/governance" : item.monitorHref;
  const isGovernance = item.key === "governance";
  const primaryValue = isGovernance
    ? (item.alertsPending ?? 0)
    : typeof item.uptime7d === "number"
      ? item.uptime7d.toFixed(1)
      : "—";
  const primaryUnit = isGovernance ? "告警待處理" : "% · 7d uptime";

  // Derive a human-readable services sub-label
  const servicesLabel = (() => {
    const m = item.metrics;
    const total = m.ready + m.degraded + m.error + m.notConnected;
    if (total === 0) return "服務未知";
    const parts: string[] = [];
    if (m.ready) parts.push(`${m.ready} 正常`);
    if (m.degraded) parts.push(`${m.degraded} 降級`);
    if (m.error) parts.push(`${m.error} 異常`);
    if (m.notConnected) parts.push(`${m.notConnected} 未接`);
    return parts.join(" · ");
  })();

  return (
    <Link
      href={href}
      className="group block rounded-[8px] border border-[#edf1f6] bg-white p-3 transition hover:border-[#c5d0db] hover:bg-[#fbfcfd]"
      data-testid={`project-portal-${item.key}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDotBg(item.status))} />
          <span className="text-[12px] font-black text-[#10233f]">{item.label}</span>
        </div>
        <ArrowUpRight className="h-3 w-3 text-[#c5d0db] transition group-hover:text-[#10233f] group-hover:translate-x-0.5" />
      </div>

      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-[17px] font-black leading-none text-[#10233f]">{primaryValue}</span>
        <span className="text-[10px] font-bold text-[#8b9aae]">{primaryUnit}</span>
      </div>

      <p className="mt-0.5 text-[10px] font-bold text-[#8b9aae]">{servicesLabel}</p>

      <Sparkline data={item.errorsTrend72h} tone={sparkTone(item.status)} />

      <p className={cn("mt-1 text-[10px] font-bold", statusToneText(item.status))}>
        {item.lastActivity ?? "—"}
      </p>
    </Link>
  );
}

function ProjectPortalSection({
  items,
  isLoading,
}: {
  items: ProjectWithMetrics[];
  isLoading: boolean;
}) {
  return (
    <WorkbenchCard className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-[#5e6e84]" />
        <h2 className="text-[13px] font-black text-[#10233f]">專案速覽</h2>
        <span className="text-[10px] font-bold text-[#8b9aae]">點擊進入各服務監控儀表板</span>
      </div>
      {isLoading ? (
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-[92px] animate-pulse rounded-[8px] bg-[#f3f6fb]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => (
            <ProjectPortalCard key={item.key} item={item} />
          ))}
        </div>
      )}
    </WorkbenchCard>
  );
}

function ErrorGroupsCard({
  errors,
  isLoading,
}: {
  errors: ApiMonitoringError[];
  isLoading: boolean;
}) {
  const groups = useMemo(() => groupErrors(errors).slice(0, 5), [errors]);

  return (
    <WorkbenchCard className="flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <AlertOctagon className="h-3.5 w-3.5 text-[#dc2626]" />
          <h2 className="text-[13px] font-black text-[#10233f]">近 24h 錯誤 · 分組</h2>
          <span className="rounded-full bg-[#ffe8eb] px-1.5 py-0.5 text-[10px] font-black text-[#dc2626]">
            {groups.length} 組 · {errors.length} 筆
          </span>
        </div>
        <Link
          href="/system/watchdog?tab=alerts"
          className="text-[10px] font-black text-[#5e6e84] hover:text-[#10233f]"
        >
          全部 →
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 animate-pulse rounded-[6px] bg-[#f3f6fb]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-[6px] bg-[#fbfcfd] px-3 py-6 text-center text-[12px] font-bold text-[#637185]">
          最近 24h 無錯誤 🎉
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5">
          {groups.map((g) => (
            <li key={g.key}>
              <Link
                href="/system/watchdog?tab=alerts"
                className="group flex items-center gap-2.5 rounded-[6px] bg-[#fbfcfd] p-2 hover:bg-white hover:ring-1 hover:ring-[#dfe7ef]"
                data-testid={`error-group-${g.key}`}
              >
                <span
                  className={cn(
                    "inline-flex h-5 min-w-[36px] items-center justify-center rounded-[4px] px-1.5 text-[10px] font-black",
                    badgeToneFor(g.latest),
                  )}
                >
                  {g.statusCode ?? g.errorType}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] font-bold text-[#10233f]">
                    {g.route}
                  </p>
                  <p className="text-[10px] font-bold text-[#8b9aae]">
                    最近 {formatRelative(g.latest.occurredAt)} · {g.hint}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-black leading-none text-[#10233f]">{g.count}</p>
                  <p className="text-[9px] font-bold text-[#8b9aae]">次</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WorkbenchCard>
  );
}

function activityIcon(kind: ActivityEntry["kind"]) {
  if (kind === "fix") return <CircleCheck className="h-3 w-3 text-[#188249]" />;
  if (kind === "security") return <ShieldCheck className="h-3 w-3 text-[#188249]" />;
  if (kind === "deploy") return <Rocket className="h-3 w-3 text-[#5e6e84]" />;
  return <Activity className="h-3 w-3 text-[#5e6e84]" />;
}

function RecentActivityCard({
  items,
  isLoading,
}: {
  items: ActivityEntry[];
  isLoading: boolean;
}) {
  return (
    <WorkbenchCard className="flex flex-col p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 text-[#5e6e84]" />
        <h2 className="text-[13px] font-black text-[#10233f]">近期活動</h2>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-9 animate-pulse rounded-[6px] bg-[#f3f6fb]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-[6px] bg-[#fbfcfd] px-3 py-6 text-center text-[12px] font-bold text-[#637185]">
          尚無近期活動紀錄
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2">
              <span className="mt-0.5">{activityIcon(entry.kind)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-[#10233f]">{entry.title}</p>
                <p className="text-[10px] font-bold text-[#8b9aae]">
                  {entry.detail ? `${entry.detail} · ` : ""}
                  {formatRelative(entry.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WorkbenchCard>
  );
}

// ---------- 24h timeline (bar-chart variant) ----------

interface HourBucket {
  hour: Date;
  count: number;
  severity: "info" | "warning" | "critical" | "none";
}

function buildHourBuckets(events: WatchdogEventDto[]): HourBucket[] {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const buckets: HourBucket[] = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3_600_000);
    buckets.push({ hour, count: 0, severity: "none" });
  }
  const sinceMs = now.getTime() - 23 * 3_600_000;
  for (const ev of events) {
    const t = new Date(ev.observedAt).getTime();
    if (Number.isNaN(t) || t < sinceMs) continue;
    const idx = Math.floor((t - sinceMs) / 3_600_000);
    if (idx < 0 || idx >= 24) continue;
    buckets[idx].count += 1;
    if (ev.severity === "critical") buckets[idx].severity = "critical";
    else if (ev.severity === "warning" && buckets[idx].severity !== "critical") buckets[idx].severity = "warning";
    else if (ev.severity === "info" && buckets[idx].severity === "none") buckets[idx].severity = "info";
  }
  return buckets;
}

const SEVERITY_BAR_BG: Record<HourBucket["severity"], string> = {
  critical: "bg-[#f7c1c1]",
  warning: "bg-[#fac775]",
  info: "bg-[#b5d4f4]",
  none: "bg-[#eef2f6]",
};

function TimelineCard({
  events,
  isLoading,
}: {
  events: WatchdogEventDto[];
  isLoading: boolean;
}) {
  const buckets = useMemo(() => buildHourBuckets(events), [events]);
  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.count)),
    [buckets],
  );

  return (
    <WorkbenchCard className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-[#5e6e84]" />
          <h2 className="text-[13px] font-black text-[#10233f]">24h 事件密度</h2>
          <span className="text-[10px] font-bold text-[#8b9aae]">
            每格 1 小時 · {events.length} 事件
          </span>
        </div>
        <Link
          href="/system/watchdog?tab=alerts"
          className="text-[10px] font-black text-[#5e6e84] hover:text-[#10233f]"
        >
          完整 →
        </Link>
      </div>
      {isLoading ? (
        <div className="h-10 animate-pulse rounded-[6px] bg-[#f3f6fb]" />
      ) : (
        <>
          <div className="flex h-8 items-end gap-[2px]">
            {buckets.map((b, idx) => {
              const height = b.count === 0 ? 15 : Math.max(15, (b.count / maxCount) * 100);
              return (
                <div
                  key={idx}
                  className={cn("flex-1 rounded-[2px]", SEVERITY_BAR_BG[b.severity])}
                  style={{ height: `${height}%` }}
                  title={`${b.hour.getHours().toString().padStart(2, "0")}:00 — ${b.count} 事件${b.severity !== "none" ? ` (max ${b.severity})` : ""}`}
                  data-testid={`timeline-hour-${idx}`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[9px] font-bold text-[#8b9aae]">
            {[0, 4, 8, 12, 16, 20, 23].map((i) => (
              <span key={i}>{buckets[i].hour.getHours().toString().padStart(2, "0")}:00</span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-[#8b9aae]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] bg-[#f7c1c1]" /> Critical
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] bg-[#fac775]" /> Warning
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] bg-[#b5d4f4]" /> Info
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-[2px] bg-[#eef2f6]" /> 無事件
            </span>
          </div>
        </>
      )}
    </WorkbenchCard>
  );
}

// ---------- main page ----------

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
  const activityQuery = useQuery({
    queryKey: ["/api/bff/system/recent-activity", "project-overview"],
    queryFn: fetchRecentActivity,
    refetchInterval: 120_000,
    retry: 0,
  });

  const allItems = (projectsQuery.data?.items ?? []) as ProjectWithMetrics[];
  const nonGovernance = allItems.filter((i) => i.key !== "governance");
  const generatedAt = projectsQuery.data?.generatedAt;
  const attention = nonGovernance.filter(
    (i) => i.status === "error" || i.status === "degraded",
  ).length;
  const hasError = nonGovernance.some((i) => i.status === "error");

  // health score: % of non-governance projects in 'ready' state, weighted
  const healthScore = useMemo(() => {
    if (nonGovernance.length === 0) return 0;
    const weights: Record<SystemProjectStatus, number> = {
      ready: 100,
      degraded: 60,
      error: 0,
      offline: 30,
    };
    const sum = nonGovernance.reduce(
      (acc, i) => acc + (weights[i.status] ?? 50),
      0,
    );
    return Math.round(sum / nonGovernance.length);
  }, [nonGovernance]);

  const recentErrors = apiMonQuery.data?.recentErrors ?? [];
  const events = watchdogQuery.data?.items ?? [];

  const cutoff = Date.now() - 24 * 3_600_000;
  const recentEvents = events.filter(
    (e) => new Date(e.observedAt).getTime() >= cutoff,
  );
  const criticalCount = recentEvents.filter((e) => e.severity === "critical").length;
  const warningCount = recentEvents.filter((e) => e.severity === "warning").length;
  const recentAssists = opsQuery.data?.items ?? [];
  const failedOps = recentAssists.filter((a) => {
    const t = new Date(a.createdAt).getTime();
    if (Number.isNaN(t) || t < cutoff) return false;
    const status = (a.resultStatus ?? "").toLowerCase();
    return status && status !== "success";
  }).length;
  const pending = criticalCount + warningCount + failedOps;

  const recentActivity = activityQuery.data?.items ?? [];

  const handleRefresh = () => {
    projectsQuery.refetch();
    apiMonQuery.refetch();
    watchdogQuery.refetch();
    opsQuery.refetch();
    activityQuery.refetch();
  };

  return (
    <RoleShell role="system" title="IT 首頁" subtitle="IT PROJECT OVERVIEW">
      <div
        className="mx-auto max-w-[1440px] space-y-3"
        data-testid="system-project-overview-page"
      >
        <CompactStatusHeader
          attention={attention}
          hasError={hasError}
          generatedAt={generatedAt}
          isFetching={
            projectsQuery.isFetching ||
            apiMonQuery.isFetching ||
            watchdogQuery.isFetching
          }
          isError={projectsQuery.isError}
          onRefresh={handleRefresh}
          projectCount={allItems.length}
        />

        <KpiStrip
          healthScore={healthScore}
          errors24h={recentErrors.length}
          pending={pending}
          alerts24h={recentEvents.length}
        />

        <ProjectPortalSection items={allItems} isLoading={projectsQuery.isLoading} />

        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <ErrorGroupsCard
            errors={recentErrors}
            isLoading={apiMonQuery.isLoading}
          />
          <RecentActivityCard
            items={recentActivity}
            isLoading={activityQuery.isLoading}
          />
        </div>

        <TimelineCard events={recentEvents} isLoading={watchdogQuery.isLoading} />
      </div>
    </RoleShell>
  );
}
