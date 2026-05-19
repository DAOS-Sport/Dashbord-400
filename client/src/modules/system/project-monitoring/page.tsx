import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ArrowRight, Server, ShieldCheck } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchSystemProjectDetail } from "./api";
import type { SystemProjectGroup, SystemProjectStatus } from "@shared/system/project-monitoring-contract";

const statusLabel = (status: SystemProjectStatus) => {
  if (status === "ready") return "正常";
  if (status === "degraded") return "注意";
  if (status === "error") return "錯誤";
  return "未連線";
};

const statusClass = (status: SystemProjectStatus) =>
  status === "ready"
    ? "bg-[#e9f8df] text-[#188249]"
    : status === "degraded"
      ? "bg-[#fff6e7] text-[#9b6a00]"
      : status === "error"
        ? "bg-[#ffe8eb] text-[#dc2626]"
        : "bg-[#eef2f6] text-[#536175]";

interface SystemProjectMonitoringPageProps {
  projectKey: SystemProjectGroup;
  mode: "control" | "status";
}

export default function SystemProjectMonitoringPage({ projectKey, mode }: SystemProjectMonitoringPageProps) {
  const detailQuery = useQuery({
    queryKey: ["/api/bff/system/project-monitoring", projectKey],
    queryFn: () => fetchSystemProjectDetail(projectKey),
    refetchInterval: 30_000,
  });
  const detail = detailQuery.data;
  const title = detail?.label ?? "系統專案";
  const modeLabel = mode === "status" ? "服務監控" : "控制中心";

  return (
    <RoleShell role="system" title={`${title} ${modeLabel}`} subtitle="SYSTEM PROJECT MONITORING">
      <div className="mx-auto max-w-[1440px] space-y-3" data-testid="system-project-monitoring-page">
        {detailQuery.isError ? (
          <div className="rounded-[8px] border border-[#ffc7cf] bg-[#fff7f8] p-3 text-[13px] font-black text-[#dc2626]">
            專案監控資料讀取失敗。
          </div>
        ) : null}

        <WorkbenchCard className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[#0f766e]">
                {mode === "status" ? <Server className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                <p className="text-[11px] font-black uppercase tracking-[0.16em]">PROJECT {mode.toUpperCase()}</p>
              </div>
              <h1 className="mt-2 text-[24px] font-black text-[#10233f]">{title} {modeLabel}</h1>
              <p className="mt-1 text-[13px] font-bold text-[#637185]">{detail?.description ?? "載入專案監控資料中..."}</p>
            </div>
            {detail ? <span className={cn("rounded-full px-3 py-1.5 text-[12px] font-black", statusClass(detail.status))}>{statusLabel(detail.status)}</span> : null}
          </div>
        </WorkbenchCard>

        {detail ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { label: "正常", value: detail.metrics.ready },
                { label: "注意", value: detail.metrics.degraded },
                { label: "未連線", value: detail.metrics.notConnected },
                { label: "錯誤", value: detail.metrics.error },
              ].map((item) => (
                <WorkbenchCard key={item.label} className="p-4">
                  <div className="flex items-center justify-between text-[#8b9aae]">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em]">{item.label}</p>
                    <Activity className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-[30px] font-black text-[#10233f]">{item.value}</p>
                </WorkbenchCard>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">服務狀態</h2>
                <div className="mt-3 grid gap-2">
                  {detail.services.map((service) => (
                    <div key={service.id} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-black text-[#10233f]">{service.label}</p>
                          <p className="mt-1 text-[12px] font-bold leading-5 text-[#637185]">{service.message}</p>
                        </div>
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusClass(service.status))}>{statusLabel(service.status)}</span>
                      </div>
                      <p className="mt-2 font-mono text-[11px] font-black text-[#8b9aae]">{service.source}</p>
                    </div>
                  ))}
                </div>
              </WorkbenchCard>

              <WorkbenchCard className="p-4">
                <h2 className="text-[16px] font-black text-[#10233f]">快速導航</h2>
                <div className="mt-3 grid gap-2">
                  <Link href={detail.controlCenterHref} className="inline-flex min-h-10 items-center justify-between rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb]">
                    控制中心
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href={detail.monitorHref} className="inline-flex min-h-10 items-center justify-between rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb]">
                    服務監控
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {detail.governanceHref ? (
                    <Link href={detail.governanceHref} className="inline-flex min-h-10 items-center justify-between rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] hover:bg-[#f3f6fb]">
                      治理/設定
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
                <div className="mt-4 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                  <p className="text-[12px] font-black text-[#10233f]">狀態說明</p>
                  <ul className="mt-2 space-y-1">
                    {detail.notes.map((note) => (
                      <li key={note} className="text-[12px] font-bold leading-5 text-[#637185]">{note}</li>
                    ))}
                  </ul>
                </div>
              </WorkbenchCard>
            </div>
          </>
        ) : (
          <WorkbenchCard className="p-6 text-[13px] font-bold text-[#637185]">載入專案狀態中...</WorkbenchCard>
        )}
      </div>
    </RoleShell>
  );
}
