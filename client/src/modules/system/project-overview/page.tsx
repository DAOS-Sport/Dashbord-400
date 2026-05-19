import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock, RefreshCw, TriangleAlert, XCircle, Wifi } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchSystemProjectMonitoring } from "../project-monitoring/api";
import type { SystemProjectStatus, SystemProjectSummary } from "@shared/system/project-monitoring-contract";

const statusLabel = (s: SystemProjectStatus) => {
  if (s === "ready") return "正常";
  if (s === "degraded") return "注意";
  if (s === "error") return "錯誤";
  return "未連線";
};

const statusClass = (s: SystemProjectStatus) => {
  if (s === "ready") return "bg-[#e9f8df] text-[#188249]";
  if (s === "degraded") return "bg-[#fff6e7] text-[#9b6a00]";
  if (s === "error") return "bg-[#ffe8eb] text-[#dc2626]";
  return "bg-[#eef2f6] text-[#536175]";
};

const statusDotClass = (s: SystemProjectStatus) => {
  if (s === "ready") return "bg-[#22c55e]";
  if (s === "degraded") return "bg-[#f59e0b]";
  if (s === "error") return "bg-[#dc2626]";
  return "bg-[#9ca3af]";
};

const PROJECT_ICON_LABEL: Record<string, string> = {
  "400cms": "CMS",
  "400line": "LINE",
  "schedule": "班表",
  "collab-course": "偕同課",
};

function MetricCell({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[8px] bg-[#f7f9fb] px-3 py-2.5">
      <span className={cn("text-[20px] font-black leading-none", accent)}>{value}</span>
      <span className="text-[10px] font-black text-[#8b9aae]">{label}</span>
    </div>
  );
}

function ProjectWidget({ item }: { item: SystemProjectSummary }) {
  const iconLabel = PROJECT_ICON_LABEL[item.key] ?? item.key.toUpperCase().slice(0, 4);
  return (
    <WorkbenchCard className="flex flex-col gap-0 overflow-hidden p-0" data-testid={`card-project-${item.key}`}>
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-[#f0f4f8] p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[#10233f] font-mono text-[11px] font-black text-white">
          {iconLabel}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-black text-[#10233f]">{item.label}</h2>
            <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black", statusClass(item.status))}>
              <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClass(item.status))} />
              {statusLabel(item.status)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-5 text-[#637185]">{item.description}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-2 px-5 py-4">
        <MetricCell label="正常" value={item.metrics.ready} accent="text-[#188249]" />
        <MetricCell label="注意" value={item.metrics.degraded} accent="text-[#9b6a00]" />
        <MetricCell label="未連線" value={item.metrics.notConnected} accent="text-[#536175]" />
        <MetricCell label="錯誤" value={item.metrics.error} accent="text-[#dc2626]" />
      </div>

      {/* Footer links */}
      <div className="mt-auto flex items-center gap-2 border-t border-[#f0f4f8] px-5 py-3">
        <Link
          href={item.controlCenterHref}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb]"
          data-testid={`link-control-${item.key}`}
        >
          控制中心
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href={item.monitorHref}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb]"
          data-testid={`link-monitor-${item.key}`}
        >
          服務監控
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {item.governanceHref ? (
          <Link
            href={item.governanceHref}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb]"
            data-testid={`link-governance-${item.key}`}
          >
            治理
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        <span className="ml-auto font-mono text-[10px] font-black text-[#9eacbc]">
          {new Date(item.lastUpdatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </span>
      </div>
    </WorkbenchCard>
  );
}

export default function SystemProjectOverviewPage() {
  const query = useQuery({
    queryKey: ["/api/bff/system/project-monitoring"],
    queryFn: fetchSystemProjectMonitoring,
    refetchInterval: 30_000,
  });

  const allItems = query.data?.items ?? [];
  const items = allItems.filter((i) => i.key !== "governance");

  const readyCount = items.filter((i) => i.status === "ready").length;
  const degradedCount = items.filter((i) => i.status === "degraded").length;
  const errorCount = items.filter((i) => i.status === "error" || i.status === "not_connected").length;
  const generatedAt = query.data?.generatedAt;

  const overallOk = degradedCount === 0 && errorCount === 0;

  return (
    <RoleShell role="system" title="跨專案總覽" subtitle="IT PROJECT OVERVIEW">
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="system-project-overview-page">

        {/* Top summary bar */}
        <WorkbenchCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", overallOk ? "bg-[#eaf8ef]" : degradedCount > 0 ? "bg-[#fff6e7]" : "bg-[#ffe8eb]")}>
                  {overallOk
                    ? <CheckCircle2 className="h-5 w-5 text-[#188249]" />
                    : errorCount > 0
                      ? <XCircle className="h-5 w-5 text-[#dc2626]" />
                      : <TriangleAlert className="h-5 w-5 text-[#9b6a00]" />}
                </span>
                <div>
                  <p className="text-[14px] font-black text-[#10233f]">
                    {overallOk ? "所有系統運作正常" : errorCount > 0 ? "部分系統異常" : "部分系統注意"}
                  </p>
                  <p className="text-[11px] font-bold text-[#637185]">{items.length} 個父系統</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[12px] font-bold">
                  <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                  <span className="text-[#188249]">{readyCount} 正常</span>
                </div>
                {degradedCount > 0 && (
                  <div className="flex items-center gap-1.5 text-[12px] font-bold">
                    <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                    <span className="text-[#9b6a00]">{degradedCount} 注意</span>
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="flex items-center gap-1.5 text-[12px] font-bold">
                    <span className="h-2 w-2 rounded-full bg-[#dc2626]" />
                    <span className="text-[#dc2626]">{errorCount} 異常</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {generatedAt && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8b9aae]">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    最後同步 {new Date(generatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                className="flex h-8 items-center gap-1.5 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb] disabled:opacity-50"
                data-testid="button-refresh"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
                重新整理
              </button>
              {query.isError && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#ffe8eb] px-3 py-1 text-[11px] font-black text-[#dc2626]">
                  <XCircle className="h-3.5 w-3.5" />
                  資料讀取失敗
                </span>
              )}
              {!query.isError && !generatedAt && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#8b9aae]">
                  <Wifi className="h-3.5 w-3.5" />
                  連線中...
                </span>
              )}
            </div>
          </div>
        </WorkbenchCard>

        {/* Project widgets grid */}
        {query.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <WorkbenchCard key={n} className="h-[220px] animate-pulse bg-[#f7f9fb] p-5" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <ProjectWidget key={item.key} item={item} />
            ))}
          </div>
        ) : (
          <WorkbenchCard className="p-8 text-center text-[13px] font-bold text-[#637185]">
            目前無專案監控資料，請稍後再試。
          </WorkbenchCard>
        )}
      </div>
    </RoleShell>
  );
}
