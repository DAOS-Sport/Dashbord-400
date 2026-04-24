import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, RefreshCw, Search, UserCheck, Users } from "lucide-react";
import type { SupervisorDashboardDto, StaffMemberSummary } from "@shared/domain/workbench";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";
import { cn } from "@/lib/utils";

const fetchSupervisorDashboard = () => apiGet<SupervisorDashboardDto>("/api/bff/supervisor/dashboard");

function StaffList({ title, items, empty }: { title: string; items: StaffMemberSummary[]; empty: string }) {
  return (
    <WorkbenchCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-black">{title}</h2>
        <span className="text-[12px] font-bold text-[#8b9aae]">{items.length} 人</span>
      </div>
      <div className="space-y-3">
        {items.slice(0, 30).map((item, index) => (
          <div key={`${item.employeeNumber ?? item.name}-${index}`} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eef5ff] text-[12px] font-black text-[#2f6fe8]">{item.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-[#10233f]">{item.name}</p>
              <p className="truncate text-[11px] font-bold text-[#8b9aae]">{item.facilityName ?? item.department ?? "未映射館別"} {item.timeRange ? `· ${item.timeRange}` : ""}</p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", item.status === "active" ? "bg-[#eaf8ef] text-[#15935d]" : "bg-[#eef2f6] text-[#637185]")}>{item.status ?? "現職"}</span>
          </div>
        ))}
        {!items.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">{empty}</div> : null}
      </div>
    </WorkbenchCard>
  );
}

export default function SupervisorPeoplePage() {
  const [query, setQuery] = useState("");
  const dashboardQuery = useQuery({
    queryKey: ["/api/bff/supervisor/dashboard", "people"],
    queryFn: fetchSupervisorDashboard,
  });
  const staffing = dashboardQuery.data?.staffing.data;
  const activeEmployees = staffing?.activeEmployees ?? [];
  const currentOnDuty = staffing?.currentOnDuty ?? [];
  const nextOnDuty = staffing?.nextOnDuty ?? [];
  const filteredEmployees = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return activeEmployees;
    return activeEmployees.filter((item) => `${item.name}${item.employeeNumber ?? ""}${item.department ?? ""}${item.facilityName ?? ""}`.includes(keyword));
  }, [activeEmployees, query]);

  return (
    <RoleShell role="supervisor" title="人力狀態" subtitle="由 Ragic 現職人事資料與 Smart Schedule 今日班表組合，顯示現職、當班與下一班。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">現職人員</p>
            <p className="mt-2 text-[26px] font-black text-[#10233f]">{staffing?.active ?? 0}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">目前當班</p>
            <p className="mt-2 text-[26px] font-black text-[#15935d]">{staffing?.onShift ?? 0}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">下一班</p>
            <p className="mt-2 text-[26px] font-black text-[#2f6fe8]">{nextOnDuty.length}</p>
          </WorkbenchCard>
        </div>

        <WorkbenchCard className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-black">人員查詢</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">以姓名、員工編號、部門或館別篩選。</p>
              </div>
            </div>
            <div className="flex min-h-10 min-w-0 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 lg:w-80">
              <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] font-bold outline-none" placeholder="搜尋人員" />
              <button type="button" onClick={() => dashboardQuery.refetch()} aria-label="重新整理">
                <RefreshCw className={cn("h-4 w-4 text-[#637185]", dashboardQuery.isFetching && "animate-spin")} />
              </button>
            </div>
          </div>
        </WorkbenchCard>

        <div className="grid gap-4 xl:grid-cols-3">
          <StaffList title="現職人員" items={filteredEmployees} empty="尚未取得 Ragic 現職資料。" />
          <StaffList title="目前當班" items={currentOnDuty} empty="目前沒有當班資料。" />
          <StaffList title="下一班人員" items={nextOnDuty} empty="目前沒有下一班資料。" />
        </div>

        <WorkbenchCard className="p-5">
          <h2 className="mb-4 text-[15px] font-black">館別分布</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(staffing?.byFacility ?? []).map((item) => (
              <div key={item.facilityKey} className="rounded-[8px] bg-[#fbfcfd] p-3">
                <p className="text-[13px] font-black text-[#10233f]">{item.facilityName}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px] font-black">
                  <span><UserCheck className="mx-auto mb-1 h-4 w-4 text-[#2f6fe8]" />{item.active}</span>
                  <span><Clock3 className="mx-auto mb-1 h-4 w-4 text-[#15935d]" />{item.onShift}</span>
                  <span><Clock3 className="mx-auto mb-1 h-4 w-4 text-[#ef7d22]" />{item.next}</span>
                </div>
              </div>
            ))}
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
