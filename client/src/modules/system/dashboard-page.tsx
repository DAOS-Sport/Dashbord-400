import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Database, FileSearch, Gauge, Server, Settings, ShieldAlert, Users } from "lucide-react";
import type { SystemOverviewDto } from "@shared/domain/workbench";
import type { ModuleHealthDto } from "@shared/modules";
import { apiGet } from "@/shared/api/client";
import { fetchModuleHealth } from "@/shared/modules/api";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { RoleShell } from "@/modules/workbench/role-shell";
import { cn } from "@/lib/utils";

const fetchSystemOverview = () => apiGet<SystemOverviewDto>("/api/bff/system/overview");
const metricIcons: readonly LucideIcon[] = [Gauge, Server, Database, ShieldAlert, Users];
const quickTools: readonly (readonly [label: string, Icon: LucideIcon])[] = [
  ["Raw Inspector", FileSearch],
  ["操作稽核查詢", ShieldAlert],
  ["整合監控", Server],
  ["報表產生器", Database],
  ["設定管理", Settings],
  ["使用者管理", Users],
];

function StatusBadge({ status }: { status: "ok" | "warning" | "critical" }) {
  return (
    <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", status === "ok" ? "bg-[#eaf8ef] text-[#15935d]" : status === "warning" ? "bg-[#fff6e7] text-[#ef7d22]" : "bg-[#ffe8eb] text-[#ff4964]")}>
      {status === "ok" ? "正常" : status === "warning" ? "警告" : "異常"}
    </span>
  );
}

function ModuleHealthBadge({ status }: { status: ModuleHealthDto["status"] }) {
  return (
    <span className={cn(
      "rounded-full px-2 py-1 text-[10px] font-black",
      status === "ready"
        ? "bg-[#eaf8ef] text-[#15935d]"
        : status === "degraded"
          ? "bg-[#fff6e7] text-[#ef7d22]"
          : status === "error"
            ? "bg-[#ffe8eb] text-[#ff4964]"
            : "bg-[#eef2f6] text-[#637185]",
    )}>
      {status}
    </span>
  );
}

export default function SystemDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/bff/system/overview"], queryFn: fetchSystemOverview });
  const healthQuery = useQuery({ queryKey: ["/api/modules/health", "system-dashboard"], queryFn: fetchModuleHealth, staleTime: 30_000 });
  const healthItems = healthQuery.data?.items ?? [];
  const healthCounts = {
    ready: healthItems.filter((item) => item.status === "ready").length,
    degraded: healthItems.filter((item) => item.status === "degraded").length,
    notConnected: healthItems.filter((item) => item.status === "not_connected").length,
    error: healthItems.filter((item) => item.status === "error").length,
  };

  return (
    <RoleShell title="系統總覽" subtitle="掌握系統狀態與異常推播" role="system">
      {isLoading || !data ? (
        <div className="rounded-[8px] bg-white p-6 text-[14px] font-bold text-[#637185]">載入治理台...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {data.metrics.data?.map((metric, index) => (
              <WorkbenchCard key={metric.label} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold text-[#637185]">{metric.label}</p>
                    <p className={cn("mt-2 text-[24px] font-black", metric.status === "critical" ? "text-[#ff4964]" : metric.status === "warning" ? "text-[#ef7d22]" : "text-[#15935d]")}>{metric.value}</p>
                    <p className="text-[11px] font-medium text-[#8b9aae]">{metric.helper}</p>
                  </div>
                  {(() => {
                    const Icon = metricIcons[index] ?? Gauge;
                    return <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff]"><Icon className="h-5 w-5 text-[#2f6fe8]" /></div>;
                  })()}
                </div>
              </WorkbenchCard>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1fr]">
            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-black">模組健康總覽</h2>
                <button className="rounded-[8px] border border-[#dfe7ef] px-3 py-1.5 text-[11px] font-black text-[#637185]">/api/modules/health</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[8px] bg-[#fbfcfd] p-4">
                  <p className="text-[12px] font-bold text-[#637185]">Ready</p>
                  <p className="mt-2 text-[24px] font-black text-[#15935d]">{healthCounts.ready}</p>
                </div>
                <div className="rounded-[8px] bg-[#fbfcfd] p-4">
                  <p className="text-[12px] font-bold text-[#637185]">Degraded</p>
                  <p className="mt-2 text-[24px] font-black text-[#ef7d22]">{healthCounts.degraded}</p>
                </div>
                <div className="rounded-[8px] bg-[#fbfcfd] p-4">
                  <p className="text-[12px] font-bold text-[#637185]">Not Connected</p>
                  <p className="mt-2 text-[24px] font-black text-[#637185]">{healthCounts.notConnected}</p>
                </div>
                <div className="rounded-[8px] bg-[#fbfcfd] p-4">
                  <p className="text-[12px] font-bold text-[#637185]">Error</p>
                  <p className="mt-2 text-[24px] font-black text-[#ff4964]">{healthCounts.error}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {healthQuery.isLoading ? (
                  <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入 module health...</div>
                ) : null}
                {healthItems.slice(0, 6).map((item) => (
                  <div key={item.moduleId} className="flex items-start justify-between gap-3 rounded-[8px] border border-[#e6edf4] bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black text-[#10233f]">{item.moduleId}</p>
                      <p className="truncate text-[11px] font-medium text-[#8b9aae]">{item.issues[0] ?? "module ready"}</p>
                    </div>
                    <ModuleHealthBadge status={item.status} />
                  </div>
                ))}
              </div>
            </WorkbenchCard>

            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-black">告警概況</h2>
                <button className="text-[11px] font-black text-[#007166]">查看全部 →</button>
              </div>
              <div className="space-y-3">
                {data.incidents.data?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <StatusBadge status={item.severity === "critical" ? "critical" : item.severity === "warning" ? "warning" : "ok"} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{item.title}</span>
                    <span className="text-[11px] text-[#8b9aae]">{item.time}</span>
                  </div>
                ))}
              </div>
            </WorkbenchCard>

            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-black">整合失敗</h2>
                <button className="text-[11px] font-black text-[#007166]">查看線索 →</button>
              </div>
              <div className="space-y-3">
                {data.integrationFailures.data?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                    <AlertTriangle className="h-4 w-4 text-[#ef7d22]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black">{item.title}</p>
                      <p className="text-[11px] text-[#8b9aae]">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </WorkbenchCard>
          </div>

          <WorkbenchCard className="p-5">
            <h2 className="mb-4 text-[15px] font-black">快速工具</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {quickTools.map(([label, Icon]) => (
                <button key={label} className="min-h-[76px] rounded-[8px] bg-[#fbfcfd] p-3 text-[12px] font-black text-[#263b56] hover:bg-white hover:shadow">
                  <Icon className="mx-auto mb-2 h-5 w-5 text-[#2f6fe8]" />
                  {label}
                </button>
              ))}
            </div>
          </WorkbenchCard>
        </div>
      )}
    </RoleShell>
  );
}
