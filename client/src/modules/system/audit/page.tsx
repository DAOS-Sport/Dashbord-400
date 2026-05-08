import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Activity, FileSearch, MousePointerClick, ShieldCheck, Users } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { fetchAuditLogs, fetchAuditPortalAnalytics, fetchUiEventOverview } from "./api";

export default function SystemAuditPage() {
  const uiQuery = useQuery({ queryKey: ["/api/bff/system/ui-event-overview"], queryFn: fetchUiEventOverview });
  const analyticsQuery = useQuery({ queryKey: ["/api/portal/analytics", "audit"], queryFn: fetchAuditPortalAnalytics });
  const auditLogsQuery = useQuery({ queryKey: ["/api/audit/logs"], queryFn: fetchAuditLogs });
  const analytics = analyticsQuery.data;
  const metrics: readonly (readonly [label: string, value: number, Icon: LucideIcon, tone: string])[] = [
    ["UI 事件", uiQuery.data?.totalEvents ?? 0, MousePointerClick, "text-[#2f6fe8]"],
    ["Client Errors", uiQuery.data?.totalClientErrors ?? 0, Activity, "text-[#ff4964]"],
    ["Portal Events", analytics?.totalEvents ?? 0, ShieldCheck, "text-[#15935d]"],
    ["使用者", analytics?.topEmployees?.length ?? 0, Users, "text-[#10233f]"],
  ];

  return (
    <RoleShell role="system" title="操作稽核" subtitle="集中檢視 UI event、Portal analytics 與後續 raw inspector audit。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {metrics.map(([label, value, Icon, tone]) => (
            <WorkbenchCard key={label} className="p-4">
              <p className="text-[12px] font-bold text-[#637185]">{label}</p>
              <div className="mt-2 flex items-center justify-between">
                <p className={`text-[26px] font-black ${tone}`}>{value}</p>
                <Icon className="h-5 w-5 text-[#2f6fe8]" />
              </div>
            </WorkbenchCard>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <WorkbenchCard className="p-5">
            <h2 className="mb-4 text-[15px] font-black">事件類型</h2>
            <div className="space-y-3">
              {(analytics?.byType ?? []).map((item) => (
                <div key={item.eventType} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                  <FileSearch className="h-4 w-4 text-[#2f6fe8]" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-black text-[#10233f]">{item.eventType}</span>
                  <span className="text-[13px] font-black text-[#10233f]">{item.count}</span>
                </div>
              ))}
              {!analytics?.byType?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無事件類型資料。</div> : null}
            </div>
          </WorkbenchCard>

          <WorkbenchCard className="p-5">
            <h2 className="mb-4 text-[15px] font-black">高頻使用者</h2>
            <div className="space-y-3">
              {(analytics?.topEmployees ?? []).slice(0, 8).map((item, index) => (
                <div key={`${item.employeeNumber}-${index}`} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eef5ff] text-[11px] font-black text-[#2f6fe8]">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-[#10233f]">{item.employeeName ?? "未知使用者"}</p>
                    <p className="text-[11px] font-bold text-[#8b9aae]">{item.employeeNumber ?? "無員編"}</p>
                  </div>
                  <span className="text-[13px] font-black text-[#10233f]">{item.count}</span>
                </div>
              ))}
              {!analytics?.topEmployees?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無使用者稽核資料。</div> : null}
            </div>
          </WorkbenchCard>

          <WorkbenchCard className="p-5 xl:col-span-2">
            <h2 className="mb-4 text-[15px] font-black">Audit Logs</h2>
            <div className="space-y-3">
              {(auditLogsQuery.data?.items ?? []).map((item) => (
                <div key={`${item.id ?? item.timestamp}-${item.action}`} className="grid gap-2 rounded-[8px] bg-[#fbfcfd] p-3 md:grid-cols-[1fr_150px_120px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-[#10233f]">{item.action}</p>
                    <p className="truncate text-[11px] font-bold text-[#8b9aae]">{item.resource}{item.resourceId ? ` / ${item.resourceId}` : ""}</p>
                  </div>
                  <p className="text-[12px] font-bold text-[#637185]">{item.actorId ?? "system"}</p>
                  <p className="text-[12px] font-black text-[#10233f]">{item.resultStatus ?? "success"}</p>
                </div>
              ))}
              {!auditLogsQuery.data?.items?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無 audit log 資料。</div> : null}
            </div>
          </WorkbenchCard>
        </div>
      </div>
    </RoleShell>
  );
}
