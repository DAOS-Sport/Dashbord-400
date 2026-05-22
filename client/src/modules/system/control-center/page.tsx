import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Gauge,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchApiMonitoring } from "../api-monitoring/api";
import {
  fetchSystemApiCatalog,
  fetchSystemControlCenter,
  type SystemApiCatalogDto,
  type SystemControlCenterDto,
} from "./api";
import type {
  ApiMonitoringDto,
  ApiMonitoringProjectKey,
} from "@shared/system/api-monitoring-contract";

const severityText = {
  normal: "正常",
  warning: "注意",
  critical: "嚴重",
} as const;

const severityClass = {
  normal: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  critical: "bg-rose-50 text-rose-700 ring-rose-600/20",
} as const;

const badgeStyleClass = {
  aborted:
    "bg-amber-50 text-amber-700 border border-amber-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
  "4xx":
    "bg-amber-50 text-amber-700 border border-amber-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
  "5xx":
    "bg-rose-50 text-rose-700 border border-rose-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
  timeout:
    "bg-rose-50 text-rose-700 border border-rose-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
  normal:
    "bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
  warning:
    "bg-amber-50 text-amber-700 border border-amber-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
  critical:
    "bg-rose-50 text-rose-700 border border-rose-200/60 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
} as const;

const hubLinks = [
  {
    label: "Watchdog",
    href: "/system/watchdog",
    Icon: ShieldCheck,
    hint: "事件、整合、告警",
  },
  {
    label: "治理面",
    href: "/system/governance",
    Icon: Gauge,
    hint: "Registry、API Surface、Audit",
  },
  {
    label: "API Catalog",
    href: "/system/api-catalog",
    Icon: Server,
    hint: "完整路由、模組、資料來源",
  },
  {
    label: "API 監控",
    href: "/system/monitoring",
    Icon: Server,
    hint: "各系統 API health",
  },
  {
    label: "400LINE",
    href: "/system/monitoring/400line",
    Icon: Bot,
    hint: "白名單與 LINE readiness",
  },
  {
    label: "運維協助",
    href: "/system/operations",
    Icon: Activity,
    hint: "使用者排查與 audit",
  },
  {
    label: "行為洞察",
    href: "/system/insights",
    Icon: Gauge,
    hint: "使用率與異常趨勢",
  },
  {
    label: "功能關係",
    href: "/system/function-relations",
    Icon: Network,
    hint: "資料表與模組關係",
  },
] as const;

type HubLink = (typeof hubLinks)[number];

type QuickRow = {
  id: string;
  badgeType: keyof typeof badgeStyleClass;
  title: string;
  meta: string;
  metric: string;
  time?: string;
};

function MetricCard({
  label,
  value,
  hint,
  Icon,
  severity = "normal",
}: {
  label: string;
  value: number;
  hint: string;
  Icon: typeof Activity;
  severity?: keyof typeof severityClass;
}) {
  const accentClass = {
    normal: "before:bg-emerald-500",
    warning: "before:bg-amber-500",
    critical: "before:bg-rose-500",
  }[severity];
  const valueClass = {
    normal: "text-emerald-700",
    warning: "text-amber-700",
    critical: "text-rose-700",
  }[severity];

  return (
    <WorkbenchCard
      className={cn(
        "relative min-h-[126px] overflow-hidden p-4 pl-5 before:absolute before:left-0 before:top-0 before:h-full before:w-1",
        accentClass,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>
          <p
            className={cn(
              "mt-3 text-[28px] font-semibold leading-none tabular-nums",
              valueClass,
            )}
          >
            {value}
          </p>
        </div>
        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      <p className="mt-2 truncate text-[11px] text-slate-400">{hint}</p>
    </WorkbenchCard>
  );
}

function MiniMetric({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string | number;
  tone?: keyof typeof severityClass;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-[24px] font-bold leading-none tabular-nums tracking-tight",
          tone === "critical"
            ? "text-rose-600"
            : tone === "warning"
              ? "text-amber-600"
              : "text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DistributionBars({
  items,
}: {
  items: Array<{
    label: string;
    value: number;
    tone: keyof typeof severityClass;
  }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-[12px]">
            <span className="font-medium text-slate-700">{item.label}</span>
            <span className="tabular-nums text-slate-500">{item.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full",
                item.tone === "critical"
                  ? "bg-rose-500"
                  : item.tone === "warning"
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
              style={{
                width: `${Math.max(4, Math.round((item.value / max) * 100))}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PaginatedBriefing({
  rows,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  viewType,
}: {
  rows: QuickRow[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  viewType: "400line" | "monitoring" | "catalog" | "control";
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const headers = useMemo(() => {
    if (viewType === "400line") {
      return {
        col1: "TYPE",
        col2: "400LINE ROUTE",
        col3: "HTTP / LATENCY",
        col4: "TIME",
      };
    }
    if (viewType === "monitoring") {
      return {
        col1: "STATUS",
        col2: "ENDPOINT PATH",
        col3: "TOTAL CALLS",
        col4: "LAST CHECKED",
      };
    }
    if (viewType === "catalog") {
      return {
        col1: "STATE",
        col2: "MODULE SOURCE",
        col3: "API COUNT",
        col4: "ROUTES",
      };
    }
    return {
      col1: "SEVERITY",
      col2: "EVENT SIGNAL",
      col3: "METRIC",
      col4: "OCCURRED AT",
    };
  }, [viewType]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[100px_minmax(0,1fr)_140px_110px] gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
        <span>{headers.col1}</span>
        <span>{headers.col2}</span>
        <span className="text-right">{headers.col3}</span>
        <span className="text-right">{headers.col4}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {pageRows.length ? (
          pageRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[100px_minmax(0,1fr)_140px_110px] items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-b-0 hover:bg-slate-50/30 transition"
            >
              <div>
                <span
                  className={
                    badgeStyleClass[row.badgeType] ?? badgeStyleClass.normal
                  }
                >
                  {row.badgeType}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-slate-800 tracking-tight">
                  {row.title}
                </p>
                <p className="mt-1 truncate text-[11px] font-medium font-mono text-slate-400 select-all">
                  {row.meta}
                </p>
              </div>
              <span className="text-right text-[12px] font-semibold text-slate-700 font-mono">
                {row.metric}
              </span>
              <span className="text-right text-[11px] font-medium text-slate-400 font-mono">
                {row.time ?? "-"}
              </span>
            </div>
          ))
        ) : (
          <div className="px-4 py-16 text-center text-[12px] text-slate-400 font-medium">
            目前沒有可顯示的數據快訊。
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/30 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
          <span>每頁顯示</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            {[5, 8, 12].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className="h-7 rounded border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            disabled={safePage <= 1}
          >
            上一頁
          </button>
          <span className="text-[11px] font-bold font-mono text-slate-500 px-1">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className="h-7 rounded border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            disabled={safePage >= totalPages}
          >
            下一頁
          </button>
        </div>
      </div>
    </div>
  );
}

function buildMonitoringRows(
  monitoring?: ApiMonitoringDto,
  is400Line = false,
): QuickRow[] {
  if (!monitoring) return [];

  const errorRows = monitoring.recentErrors.map((error) => {
    let badgeType: keyof typeof badgeStyleClass = "4xx";
    if (error.errorType === "timeout") badgeType = "timeout";
    if (error.errorType === "5xx") badgeType = "5xx";
    if (error.errorType === "aborted") badgeType = "aborted";

    return {
      id: error.id,
      badgeType,
      title: error.route,
      meta: error.correlationId
        ? `id: ${error.correlationId}`
        : error.errorType,
      metric: `${error.statusCode} / ${error.durationMs}ms`,
      time: new Date(error.occurredAt).toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  if (is400Line) return errorRows;
  if (errorRows.length) return errorRows;

  return monitoring.rows.slice(0, 20).map((row) => ({
    id: row.id,
    badgeType:
      row.status === "error"
        ? "critical"
        : row.status === "warning" || row.status === "not_connected"
          ? "warning"
          : "normal",
    title: `${row.method} ${row.path}`,
    meta: row.label,
    metric: `${row.totalCount} calls`,
    time: row.lastCheckedAt
      ? new Date(row.lastCheckedAt).toLocaleString("zh-TW", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-",
  }));
}

function buildCatalogRows(catalog?: SystemApiCatalogDto): QuickRow[] {
  return (catalog?.moduleSources ?? []).slice(0, 24).map((module) => ({
    id: module.moduleId,
    badgeType:
      module.status === "implemented"
        ? "normal"
        : module.status === "partial"
          ? "warning"
          : "critical",
    title: module.label,
    meta: `${module.moduleId} / ${module.project}`,
    metric: `${module.apiCount} APIs`,
    time: `${module.routeCount} routes`,
  }));
}

function buildControlRows(data?: SystemControlCenterDto): QuickRow[] {
  return (data?.recentCriticalEvents ?? []).map((event) => ({
    id: event.id,
    badgeType: event.severity === "critical" ? "critical" : "warning",
    title: event.title,
    meta: [event.source, event.moduleId, event.role]
      .filter(Boolean)
      .join(" / "),
    metric: event.severity.toUpperCase(),
    time: new Date(event.createdAt).toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}

// 修改 QuickViewContent 接收 onSelectTab
function QuickViewContent({
  activePreview,
  data,
  monitoring,
  catalog,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectTab,
}: {
  activePreview: HubLink;
  data?: SystemControlCenterDto;
  monitoring?: ApiMonitoringDto;
  catalog?: SystemApiCatalogDto;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSelectTab: (href: string) => void;
}) {
  const is400Line = activePreview.href === "/system/monitoring/400line";
  const isMonitoringView =
    activePreview.href === "/system/monitoring" || is400Line;
  const isCatalogView =
    activePreview.href === "/system/api-catalog" ||
    activePreview.href === "/system/governance" ||
    activePreview.href === "/system/function-relations";

  const rows = isMonitoringView
    ? buildMonitoringRows(monitoring, is400Line)
    : isCatalogView
      ? buildCatalogRows(catalog)
      : buildControlRows(data);
  const viewType = is400Line
    ? "400line"
    : isMonitoringView
      ? "monitoring"
      : isCatalogView
        ? "catalog"
        : "control";

  const metrics = isMonitoringView
    ? [
        {
          label: "API 總數",
          value: monitoring?.summary.totalApis ?? 0,
          tone: "normal" as const,
        },
        {
          label: "正常",
          value: monitoring?.summary.healthyApis ?? 0,
          tone: "normal" as const,
        },
        {
          label: "警告",
          value: monitoring?.summary.warningApis ?? 0,
          tone: "warning" as const,
        },
        {
          label: "異常",
          value: monitoring?.summary.errorApis ?? 0,
          tone: "critical" as const,
        },
      ]
    : isCatalogView
      ? [
          {
            label: "API",
            value: catalog?.summary.totalApis ?? 0,
            tone: "normal" as const,
          },
          {
            label: "Modules",
            value: catalog?.summary.registeredModules ?? 0,
            tone: "normal" as const,
          },
          {
            label: "Unmapped",
            value: catalog?.summary.unmappedApis ?? 0,
            tone:
              (catalog?.summary.unmappedApis ?? 0) > 0
                ? ("warning" as const)
                : ("normal" as const),
          },
          {
            label: "Inferred",
            value: catalog?.summary.inferredModuleMatches ?? 0,
            tone: "warning" as const,
          },
        ]
      : [
          {
            label: "Critical",
            value: data?.kpi.watchdogCritical24h ?? 0,
            tone: "critical" as const,
          },
          {
            label: "Audit 24h",
            value: data?.kpi.audit24h ?? 0,
            tone: "normal" as const,
          },
          {
            label: "待處理",
            value: data?.tiles.operations.pendingCount ?? 0,
            tone:
              (data?.tiles.operations.pendingCount ?? 0) > 0
                ? ("warning" as const)
                : ("normal" as const),
          },
          {
            label: "治理缺口",
            value: data?.tiles.governance.orphanCount ?? 0,
            tone:
              (data?.tiles.governance.orphanCount ?? 0) > 0
                ? ("warning" as const)
                : ("normal" as const),
          },
        ];

  const distribution = [
    {
      label: "正常",
      value: rows.filter((row) => row.badgeType === "normal").length,
      tone: "normal" as const,
    },
    {
      label: "警告",
      value: rows.filter((row) =>
        ["warning", "4xx", "aborted"].includes(row.badgeType),
      ).length,
      tone: "warning" as const,
    },
    {
      label: "異常",
      value: rows.filter((row) =>
        ["critical", "5xx", "timeout"].includes(row.badgeType),
      ).length,
      tone: "critical" as const,
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 pt-2">
          {hubLinks.map((tab) => {
            const isTabActive = tab.href === activePreview.href;
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => onSelectTab(tab.href)}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium transition focus:outline-none",
                  isTabActive
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <TabIcon
                  className={cn(
                    "h-3.5 w-3.5",
                    isTabActive ? "text-slate-900" : "text-slate-500",
                  )}
                />
                <span>{tab.label}</span>
                {isTabActive ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-slate-900" />
                ) : null}
              </button>
            );
          })}
      </div>

      <div className="bg-slate-50/40 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MiniMetric key={metric.label} {...metric} />
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <PaginatedBriefing
            rows={rows}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            viewType={viewType}
          />

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[13px] font-bold text-slate-800 tracking-tight">
                Error Distribution
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                依目前頁籤資料統計。
              </p>
              <div className="mt-5">
                <DistributionBars items={distribution} />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>統計狀態</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-600 font-mono">
                LIVE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SystemControlCenterPage() {
  const [previewHref, setPreviewHref] =
    useState<(typeof hubLinks)[number]["href"]>("/system/watchdog");
  const [quickPage, setQuickPage] = useState(1);
  const [quickPageSize, setQuickPageSize] = useState(8);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["/api/bff/system/control-center"],
    queryFn: fetchSystemControlCenter,
    refetchInterval: 15_000,
    retry: 1,
  });

  const kpi = data?.kpi;
  const activePreview =
    hubLinks.find((item) => item.href === previewHref) ?? hubLinks[0];

  const monitoringProjectKey: ApiMonitoringProjectKey | null =
    previewHref === "/system/monitoring/400line"
      ? "400line"
      : previewHref === "/system/monitoring"
        ? "all"
        : null;

  const monitoringQuery = useQuery({
    queryKey: [
      "/api/bff/system/api-monitoring",
      "control-center-preview",
      monitoringProjectKey,
    ],
    queryFn: () => fetchApiMonitoring(monitoringProjectKey ?? "all"),
    enabled: Boolean(monitoringProjectKey),
    retry: 1,
  });

  const catalogQuery = useQuery({
    queryKey: ["/api/bff/system/api-catalog", "control-center-preview"],
    queryFn: fetchSystemApiCatalog,
    enabled: [
      "/system/api-catalog",
      "/system/governance",
      "/system/function-relations",
    ].includes(previewHref),
    retry: 1,
  });

  useEffect(() => {
    setQuickPage(1);
  }, [previewHref, quickPageSize]);

  if (isError && !data) {
    return (
      <RoleShell role="system" title="控制中心" subtitle="IT HUB">
        <div
          className="mx-auto max-w-[1440px] space-y-5 pb-12"
          data-testid="system-control-center-page"
        >
          <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">控制中心資料讀取失敗</p>
              <p className="mt-0.5 text-[12px] text-rose-600/80">
                請確認權限與 BFF 狀態；頁面已停止顯示 0 值摘要。
              </p>
            </div>
          </div>
        </div>
      </RoleShell>
    );
  }

  return (
    <RoleShell role="system" title="控制中心" subtitle="IT HUB">
      <div
        className="mx-auto max-w-[1440px] space-y-5 pb-12"
        data-testid="system-control-center-page"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="健康模組"
            value={kpi?.readyModules ?? 0}
            hint={`異常 ${kpi?.errorModules ?? 0} / 降級 ${kpi?.degradedModules ?? 0} / 未連線 ${kpi?.notConnectedModules ?? 0}`}
            Icon={ShieldCheck}
            severity={
              (kpi?.errorModules ?? 0) > 0
                ? "critical"
                : (kpi?.degradedModules ?? 0) > 0
                  ? "warning"
                  : "normal"
            }
          />
          <MetricCard
            label="Watchdog"
            value={kpi?.watchdogCritical24h ?? 0}
            hint={`最近事件：${data?.tiles.watchdog.lastEventTitle ?? "無待處理事件"}`}
            Icon={AlertTriangle}
            severity={data?.tiles.watchdog.severity ?? "normal"}
          />
          <MetricCard
            label="Audit"
            value={kpi?.audit24h ?? 0}
            hint={`今日運維完成 ${data?.tiles.operations.todayHandledCount ?? 0}，待處理 ${data?.tiles.operations.pendingCount ?? 0}`}
            Icon={Activity}
            severity={data?.tiles.operations.severity ?? "normal"}
          />
          <MetricCard
            label="治理缺口"
            value={data?.tiles.governance.orphanCount ?? 0}
            hint={`${data?.tiles.governance.moduleCount ?? 0} 個 system 模組，狀態 ${severityText[data?.tiles.governance.severity ?? "normal"]}`}
            Icon={Gauge}
            severity={data?.tiles.governance.severity ?? "normal"}
          />
        </div>

        <WorkbenchCard className="overflow-hidden p-0 border border-slate-200/80 shadow-sm rounded-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                System Control Center
              </p>
              <h2 className="mt-0.5 text-[15px] font-bold text-slate-900 tracking-tight">
                控制中心
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 text-slate-400",
                  isFetching ? "animate-spin" : "",
                )}
              />
              {data?.generatedAt
                ? new Date(data.generatedAt).toLocaleTimeString("zh-TW", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "同步中"}
            </div>
          </div>

          <div>
              <QuickViewContent
                activePreview={activePreview}
                data={data}
                monitoring={monitoringQuery.data}
                catalog={catalogQuery.data}
                page={quickPage}
                pageSize={quickPageSize}
                onPageChange={setQuickPage}
                onPageSizeChange={setQuickPageSize}
                onSelectTab={(href) =>
                  setPreviewHref(href as typeof previewHref)
                }
              />

              <section className="bg-slate-50/40 px-5 pb-5">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-800 tracking-tight">
                      最近告警
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                      僅列出最近的警告與嚴重事件，完整處理請至 Watchdog。
                    </p>
                  </div>
                  <Link
                    href="/system/watchdog?tab=alerts"
                    className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    詳細告警
                    <ArrowUpRight className="h-3 w-3 text-slate-400" />
                  </Link>
                </div>

                <div className="mt-3 space-y-2">
                  {(data?.recentCriticalEvents ?? []).length ? (
                    data!.recentCriticalEvents.map((event) => (
                      <div
                        key={event.id}
                        className="grid gap-3 rounded-lg border border-slate-200/80 bg-white p-3 md:grid-cols-[100px_minmax(0,1fr)_120px] md:items-center hover:shadow-sm transition"
                      >
                        <div>
                          <span
                            className={cn(
                              "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              event.severity === "critical"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200",
                            )}
                          >
                            {event.severity}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-bold text-slate-800 tracking-tight">
                            {event.title}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400 font-mono">
                            {[event.source, event.moduleId, event.role]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        </div>
                        <span className="text-left text-[11px] font-medium text-slate-400 font-mono md:text-right">
                          {new Date(event.createdAt).toLocaleString("zh-TW", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center text-[11px] font-medium text-slate-400">
                      目前系統狀態良好，沒有任何 warning / critical 告警。
                    </div>
                  )}
                </div>
              </section>
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
