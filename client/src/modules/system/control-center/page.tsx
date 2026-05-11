import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchSystemControlCenter, type ControlCenterSeverity } from "./api";

const queryKey = ["/api/bff/system/control-center"];

const severityStyle: Record<ControlCenterSeverity, { dot: string; label: string; border: string }> = {
  normal: { dot: "bg-[#15935d]", label: "正常", border: "border-[#dfe7ef]" },
  warning: { dot: "bg-[#ca8a04]", label: "注意", border: "border-[#f2dda8]" },
  critical: { dot: "bg-[#dc2626]", label: "Critical", border: "border-[#ffc7cf]" },
};

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";

export default function SystemControlCenterPage() {
  const queryClient = useQueryClient();
  const controlCenterQuery = useQuery({
    queryKey,
    queryFn: fetchSystemControlCenter,
    staleTime: 5_000,
  });
  const data = controlCenterQuery.data;
  const refreshedAt = useMemo(() => formatTime(data?.generatedAt), [data?.generatedAt]);
  const kpiCards = [
    { label: "Ready", value: data?.kpi.readyModules ?? 0, color: "text-[#15935d]", href: "/system/watchdog" },
    { label: "Degraded", value: data?.kpi.degradedModules ?? 0, color: "text-[#ca8a04]", href: "/system/watchdog" },
    { label: "NotConnected", value: data?.kpi.notConnectedModules ?? 0, color: "text-[#6b7280]", href: "/system/watchdog" },
    { label: "Error", value: data?.kpi.errorModules ?? 0, color: "text-[#dc2626]", href: "/system/watchdog" },
    { label: "Audit 24h", value: data?.kpi.audit24h ?? 0, color: "text-[#0d2a50]", href: "/system/governance" },
    { label: "Critical 24h", value: data?.kpi.watchdogCritical24h ?? 0, color: "text-[#dc2626]", href: "/system/watchdog" },
  ];
  const tiles = [
    {
      key: "watchdog",
      title: "WATCHDOG",
      href: "/system/watchdog",
      severity: data?.tiles.watchdog.severity ?? "normal",
      lines: [
        `${data?.tiles.watchdog.criticalCount ?? 0} 件 critical 待處理`,
        `最近: ${data?.tiles.watchdog.lastEventTitle ?? "目前沒有事件"}`,
      ],
    },
    {
      key: "operations",
      title: "OPERATIONS",
      href: "/system/operations",
      severity: data?.tiles.operations.severity ?? "normal",
      lines: ["運維協助中心", "下版啟用"],
    },
    {
      key: "insights",
      title: "INSIGHTS",
      href: "/system/insights",
      severity: data?.tiles.insights.severity ?? "normal",
      lines: ["行為洞察", data?.tiles.insights.anomalyHint ?? "下版啟用"],
    },
    {
      key: "governance",
      title: "GOVERNANCE",
      href: "/system/governance",
      severity: data?.tiles.governance.severity ?? "normal",
      lines: [
        `${data?.tiles.governance.moduleCount ?? 0} 個模組`,
        `${data?.tiles.governance.orphanCount ?? 0} 個孤兒`,
      ],
    },
  ];

  return (
    <RoleShell role="system" title="系統控制中心" subtitle="SYSTEM CONTROL CENTER">
      <div className="mx-auto max-w-[1440px] space-y-5" data-testid="system-control-center-page">
        <div className="flex flex-col gap-3 rounded-[8px] border border-[#dfe7ef] bg-white p-5 shadow-[0_8px_24px_-16px_rgba(13,42,80,0.18)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#15935d]">System Control Center</p>
            <h1 className="mt-1 text-[24px] font-black text-[#10233f]">全域健康總覽</h1>
            <p className="mt-1 text-[13px] font-bold text-[#637185]">最後更新 {refreshedAt}</p>
          </div>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey })}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-4 text-[13px] font-black text-[#10233f]"
          >
            <RefreshCw className={cn("h-4 w-4", controlCenterQuery.isFetching && "animate-spin")} />
            重新整理
          </button>
        </div>

        {controlCenterQuery.isError ? (
          <div className="rounded-[8px] border border-[#ffc7cf] bg-[#fff7f8] p-4 text-[13px] font-black text-[#dc2626]">
            控制中心資料載入失敗，已保留頁面入口供手動檢查。
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpiCards.map((item) => (
            <Link key={item.label} href={item.href} className="block">
              <WorkbenchCard className="min-h-[100px] p-4 transition hover:border-[#b9c7d7]">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8b9aae]">{item.label}</p>
                <p className={cn("mt-3 text-[32px] font-black tabular-nums", item.color)}>{item.value}</p>
              </WorkbenchCard>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {tiles.map((tile) => {
            const ui = severityStyle[tile.severity];
            return (
              <Link key={tile.key} href={tile.href} className="block">
                <WorkbenchCard className={cn("min-h-[160px] border p-5 transition hover:shadow-[0_12px_32px_-18px_rgba(13,42,80,0.30)]", ui.border)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", ui.dot)} />
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">{ui.label}</span>
                      </div>
                      <h2 className="mt-3 text-[18px] font-black text-[#10233f]">{tile.title}</h2>
                    </div>
                    <ArrowRight className="h-5 w-5 text-[#637185]" />
                  </div>
                  <div className="mt-5 space-y-1">
                    {tile.lines.map((line) => (
                      <p key={line} className="text-[13px] font-bold leading-6 text-[#536175]">{line}</p>
                    ))}
                  </div>
                </WorkbenchCard>
              </Link>
            );
          })}
        </div>

        <WorkbenchCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#edf1f6] p-4">
            <div>
              <h2 className="text-[16px] font-black text-[#10233f]">Recent Critical Events</h2>
              <p className="mt-1 text-[12px] font-bold text-[#637185]">最近 5 筆 critical / warning watchdog events。</p>
            </div>
            <Link href="/system/watchdog" className="text-[12px] font-black text-[#007166]">查看全部 Watchdog events →</Link>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {(data?.recentCriticalEvents ?? []).map((event) => (
              <Link key={event.id} href="/system/watchdog" className="grid gap-2 border-b border-[#edf1f6] p-4 transition hover:bg-[#fbfcfd] md:grid-cols-[120px_110px_1fr_160px] md:items-center">
                <span className="text-[12px] font-bold text-[#637185]">{formatTime(event.createdAt)}</span>
                <span className={cn("w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase", event.severity === "critical" ? "bg-[#ffe8eb] text-[#dc2626]" : "bg-[#fff6e7] text-[#ca8a04]")}>{event.severity}</span>
                <span className="truncate text-[13px] font-black text-[#10233f]">{event.title}</span>
                <span className="truncate text-[12px] font-bold text-[#637185]">{event.source}{event.role ? ` · ${event.role}` : ""}</span>
              </Link>
            ))}
            {!(data?.recentCriticalEvents ?? []).length ? (
              <div className="grid min-h-[160px] place-items-center p-6 text-center">
                <div>
                  <CheckCircle2 className="mx-auto h-10 w-10 text-[#15935d]" />
                  <p className="mt-3 text-[14px] font-black text-[#10233f]">目前系統穩定，無關鍵事件</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">Watchdog 有事件時會集中出現在這裡。</p>
                </div>
              </div>
            ) : null}
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
