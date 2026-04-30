import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3, ClipboardList, Download, Megaphone, Users } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { fetchSupervisorReportAnalytics, fetchSupervisorReportDashboard } from "./api";
import { SupervisorKpiCard } from "../supervisor-ui";

export default function SupervisorReportsPage() {
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const dashboardQuery = useQuery({ queryKey: ["/api/bff/supervisor/dashboard", "reports"], queryFn: fetchSupervisorReportDashboard });
  const analyticsQuery = useQuery({ queryKey: ["/api/portal/analytics", facilityKey], queryFn: () => fetchSupervisorReportAnalytics(facilityKey) });
  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const exportReport = () => {
    const rows = [
      ["metric", "value"],
      ["active_staff", dashboard?.staffing.data?.active ?? 0],
      ["pending_anomalies", dashboard?.pendingAnomalies.data?.length ?? 0],
      ["incomplete_tasks", dashboard?.incompleteTasks.data?.length ?? 0],
      ["unconfirmed_announcements", dashboard?.announcementAcks.data?.unconfirmed ?? 0],
      ["ui_events", analytics?.totalEvents ?? 0],
      [],
      ["date", "event_count"],
      ...(analytics?.dailyCounts ?? []).map((day) => [day.day, day.count]),
      [],
      ["event_type", "target", "target_label", "count"],
      ...(analytics?.topTargets ?? []).map((item) => [item.eventType, item.target ?? "", item.targetLabel ?? "", item.count]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `supervisor-report-${facilityKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const metrics: readonly (readonly [label: string, value: number, Icon: LucideIcon, tone: string])[] = [
    ["在班人力", dashboard?.staffing.data?.active ?? 0, Users, "text-[#15935d]"],
    ["待審異常", dashboard?.pendingAnomalies.data?.length ?? 0, Activity, "text-[#ff4964]"],
    ["未完成任務", dashboard?.incompleteTasks.data?.length ?? 0, ClipboardList, "text-[#10233f]"],
    ["未確認公告", dashboard?.announcementAcks.data?.unconfirmed ?? 0, Megaphone, "text-[#ef7d22]"],
    ["UI 事件", analytics?.totalEvents ?? 0, BarChart3, "text-[#2f6fe8]"],
  ];

  return (
    <RoleShell role="supervisor" title="報表" subtitle="REPORTS · 以 supervisor BFF 與 Portal analytics 彙整主管常用指標，不回接 system overview。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(([label, value, Icon, tone]) => (
            <SupervisorKpiCard
              key={label}
              label={label}
              value={value}
              icon={Icon}
              tone={tone.includes("ff4964") ? "red" : tone.includes("ef7d22") ? "amber" : tone.includes("15935d") ? "green" : tone.includes("2f6fe8") ? "blue" : "navy"}
            />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black">事件趨勢</h2>
              <button
                type="button"
                onClick={exportReport}
                className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]"
              >
                <Download className="h-4 w-4" />
                匯出 CSV
              </button>
            </div>
            <div className="flex h-56 items-end gap-2 rounded-[8px] bg-[#fbfcfd] p-4">
              {(analytics?.dailyCounts ?? []).slice(-14).map((day, index) => (
                <div key={`${day.day}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-t bg-[#2f6fe8]" style={{ height: `${Math.max(8, Math.min(100, Number(day.count) * 12))}%` }} />
                  <span className="text-[10px] font-bold text-[#8b9aae]">{day.day.slice(5)}</span>
                </div>
              ))}
              {!analytics?.dailyCounts?.length ? <div className="m-auto text-[13px] font-bold text-[#637185]">尚無事件趨勢資料</div> : null}
            </div>
          </WorkbenchCard>

          <WorkbenchCard className="p-5">
            <h2 className="mb-4 text-[15px] font-black">熱門操作</h2>
            <div className="space-y-3">
              {(analytics?.topTargets ?? []).slice(0, 8).map((item, index) => (
                <div key={`${item.eventType}-${item.target}-${index}`} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eef5ff] text-[11px] font-black text-[#2f6fe8]">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-[#10233f]">{item.targetLabel ?? item.target ?? item.eventType}</p>
                    <p className="text-[11px] font-bold text-[#8b9aae]">{item.eventType}</p>
                  </div>
                  <span className="text-[13px] font-black text-[#10233f]">{item.count}</span>
                </div>
              ))}
              {!analytics?.topTargets?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無熱門操作資料。</div> : null}
            </div>
          </WorkbenchCard>
        </div>
      </div>
    </RoleShell>
  );
}
