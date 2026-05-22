import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  ClipboardList,
  Gauge,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchSystemControlCenter, type SystemControlCenterDto } from "./api";

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

const roleIcon = {
  employee: Users,
  lifeguard: ShieldCheck,
  supervisor: ClipboardList,
  system: Server,
} as const;

const hubLinks = [
  { label: "Watchdog", href: "/system/watchdog", Icon: ShieldCheck, hint: "事件、整合、告警" },
  { label: "API Catalog", href: "/system/api-catalog", Icon: Server, hint: "完整路由、模組、資料來源" },
  { label: "API 監控", href: "/system/monitoring", Icon: Server, hint: "各系統 API health" },
  { label: "400LINE", href: "/system/monitoring/400line", Icon: Bot, hint: "白名單與 LINE readiness" },
  { label: "運維協助", href: "/system/operations", Icon: Activity, hint: "使用者排查與 audit" },
  { label: "行為洞察", href: "/system/insights", Icon: Gauge, hint: "使用率與異常趨勢" },
  { label: "功能關係", href: "/system/function-relations", Icon: Network, hint: "資料表與模組關係" },
] as const;

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
  return (
    <WorkbenchCard className="min-h-[136px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
          <p className="mt-3 text-[30px] font-black leading-none text-text-strong">{value}</p>
        </div>
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[8px] ring-1 ring-inset", severityClass[severity])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[12px] font-semibold leading-5 text-text-body">{hint}</p>
    </WorkbenchCard>
  );
}

function HubLinkCard({ label, href, hint, Icon }: (typeof hubLinks)[number]) {
  return (
    <Link
      href={href}
      className="group flex min-h-[86px] items-center justify-between gap-3 rounded-[8px] border border-border-subtle bg-surface-solid px-4 py-3 transition hover:border-border-emphasis hover:shadow-card-rest"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-surface-soft text-text-strong ring-1 ring-border-subtle">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-black text-text-strong">{label}</p>
          <p className="mt-1 truncate text-[12px] font-semibold text-text-body">{hint}</p>
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted transition group-hover:text-text-strong" />
    </Link>
  );
}

function RoleApiSurfaceCard({ surface }: { surface: SystemControlCenterDto["roleApiSurfaces"][number] }) {
  const Icon = roleIcon[surface.role];
  return (
    <WorkbenchCard className="flex min-h-[380px] flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-surface-soft text-text-strong ring-1 ring-border-subtle">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-black text-text-strong">{surface.label}</h3>
            <p className="mt-1 text-[12px] font-semibold text-text-body">{surface.moduleCount} modules / {surface.apiCount} APIs</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-black text-text-body ring-1 ring-border-subtle">
          BFF {surface.bffCount}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-[8px] bg-surface-soft px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-text-muted">Proxy</p>
          <p className="mt-1 text-[18px] font-black text-text-strong">{surface.proxyCount}</p>
        </div>
        <div className="rounded-[8px] bg-surface-soft px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-text-muted">Legacy</p>
          <p className="mt-1 text-[18px] font-black text-text-strong">{surface.legacyCount}</p>
        </div>
        <div className="rounded-[8px] bg-surface-soft px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-text-muted">Partial</p>
          <p className="mt-1 text-[18px] font-black text-text-strong">{surface.partialCount}</p>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-hidden">
        {surface.topModules.slice(0, 4).map((module) => (
          <div key={module.moduleId} className="rounded-[8px] border border-border-subtle bg-surface-solid p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black text-text-strong">{module.label}</p>
                <p className="mt-1 truncate text-[11px] font-semibold text-text-muted">{module.routePath ?? module.moduleId}</p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-black text-text-body">
                {module.apiCount}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {module.primaryApis.slice(0, 2).map((api) => (
                <div key={`${api.method}-${api.path}`} className="grid grid-cols-[48px_minmax(0,1fr)_52px] items-center gap-2 text-[11px]">
                  <span className="font-mono font-black text-text-strong">{api.method}</span>
                  <span className="truncate font-mono text-text-body">{api.path}</span>
                  <span className="truncate text-right font-bold text-text-muted">{api.kind}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WorkbenchCard>
  );
}

export default function SystemControlCenterPage() {
  const { data, isFetching } = useQuery({
    queryKey: ["/api/bff/system/control-center"],
    queryFn: fetchSystemControlCenter,
    refetchInterval: 15_000,
    retry: 1,
  });

  const kpi = data?.kpi;

  return (
    <RoleShell role="system" title="控制中心" subtitle="IT HUB">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-wide text-text-muted">System Hub</p>
            <h1 className="mt-2 text-[28px] font-black leading-tight text-text-strong">控制中心</h1>
            <p className="mt-2 max-w-3xl text-[14px] font-semibold leading-6 text-text-body">
              系統管理先看健康、告警、運維與角色 API surface，再切到各監控頁處理細節。
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] font-bold text-text-muted">
            <RefreshCw className={cn("h-4 w-4", isFetching ? "animate-spin" : "")} />
            {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "同步中"}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="健康模組"
            value={kpi?.readyModules ?? 0}
            hint={`異常 ${kpi?.errorModules ?? 0} / 降級 ${kpi?.degradedModules ?? 0} / 未連線 ${kpi?.notConnectedModules ?? 0}`}
            Icon={ShieldCheck}
            severity={(kpi?.errorModules ?? 0) > 0 ? "critical" : (kpi?.degradedModules ?? 0) > 0 ? "warning" : "normal"}
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

        <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <WorkbenchCard className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-black text-text-strong">系統入口</h2>
                <p className="mt-1 text-[12px] font-semibold text-text-body">從 hub 直接切到目前最常用的系統面。</p>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset", severityClass[data?.tiles.watchdog.severity ?? "normal"])}>
                {severityText[data?.tiles.watchdog.severity ?? "normal"]}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {hubLinks.map((item) => <HubLinkCard key={item.href} {...item} />)}
            </div>
          </WorkbenchCard>

          <WorkbenchCard className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-black text-text-strong">最近告警</h2>
                <p className="mt-1 text-[12px] font-semibold text-text-body">只列 warning / critical，詳細處理進 Watchdog。</p>
              </div>
              <Link href="/system/watchdog?tab=alerts" className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-border-subtle bg-surface-solid px-3 text-[12px] font-black text-text-strong hover:bg-surface-soft">
                告警
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {(data?.recentCriticalEvents ?? []).length ? data!.recentCriticalEvents.map((event) => (
                <div key={event.id} className="grid gap-3 rounded-[8px] border border-border-subtle bg-surface-solid p-3 md:grid-cols-[96px_minmax(0,1fr)_120px] md:items-center">
                  <span className={cn("w-fit rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset", event.severity === "critical" ? severityClass.critical : severityClass.warning)}>
                    {event.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-text-strong">{event.title}</p>
                    <p className="mt-1 truncate text-[11px] font-semibold text-text-muted">
                      {[event.source, event.moduleId, event.role].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                  <span className="text-left text-[11px] font-bold text-text-muted md:text-right">
                    {new Date(event.createdAt).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )) : (
                <div className="rounded-[8px] border border-dashed border-border-default bg-surface-soft px-4 py-8 text-center text-[13px] font-semibold text-text-body">
                  目前沒有 warning / critical 告警。
                </div>
              )}
            </div>
          </WorkbenchCard>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[16px] font-black text-text-strong">角色 API Surface</h2>
              <p className="mt-1 text-[12px] font-semibold text-text-body">依角色整理目前投放到工作台的模組與 API，方便看 BFF、proxy、legacy 邊界。</p>
            </div>
            <Link href="/system/monitoring" className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-[8px] border border-border-subtle bg-surface-solid px-3 text-[12px] font-black text-text-strong hover:bg-surface-soft">
              全部 API 監控
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 xl:grid-cols-4">
            {(data?.roleApiSurfaces ?? []).map((surface) => (
              <RoleApiSurfaceCard key={surface.role} surface={surface} />
            ))}
          </div>
        </section>
      </div>
    </RoleShell>
  );
}
