import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Clock3, MapPin, RefreshCw, Search, UserCheck, Users } from "lucide-react";
import type { SupervisorDashboardDto, StaffMemberSummary } from "@shared/domain/workbench";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";
import { cn } from "@/lib/utils";
import { SupervisorKpiCard, SupervisorPill } from "../supervisor-ui";

const fetchSupervisorDashboard = () => apiGet<SupervisorDashboardDto>("/api/bff/supervisor/dashboard");
const getFacilityDetailHref = (facilityKey: string) => `/supervisor/facilities/${encodeURIComponent(facilityKey)}`;

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

type SupervisorPeoplePageProps = {
  facilityKey?: string;
};

export default function SupervisorPeoplePage({ facilityKey: routeFacilityKey }: SupervisorPeoplePageProps = {}) {
  const [query, setQuery] = useState("");
  const [selectedFacilityKey, setSelectedFacilityKey] = useState<string | "all">("all");
  const dashboardQuery = useQuery({
    queryKey: ["/api/bff/supervisor/dashboard", "people"],
    queryFn: fetchSupervisorDashboard,
  });
  const staffing = dashboardQuery.data?.staffing.data;
  const facilities = dashboardQuery.data?.facilities?.data ?? [];
  const activeEmployees = staffing?.activeEmployees ?? [];
  const currentOnDuty = staffing?.currentOnDuty ?? [];
  const nextOnDuty = staffing?.nextOnDuty ?? [];
  const decodedRouteFacilityKey = routeFacilityKey ? decodeURIComponent(routeFacilityKey) : undefined;
  const detailMode = Boolean(decodedRouteFacilityKey);
  const effectiveFacilityKey = decodedRouteFacilityKey ?? selectedFacilityKey;
  const selectedFacility = decodedRouteFacilityKey
    ? facilities.find((facility) => facility.facilityKey === decodedRouteFacilityKey)
    : selectedFacilityKey === "all"
      ? undefined
      : facilities.find((facility) => facility.facilityKey === selectedFacilityKey);
  const facilityMatches = (item: StaffMemberSummary) => effectiveFacilityKey === "all" || item.facilityKey === effectiveFacilityKey;
  const filteredEmployees = useMemo(() => {
    const keyword = query.trim();
    return activeEmployees
      .filter(facilityMatches)
      .filter((item) => !keyword || `${item.name}${item.employeeNumber ?? ""}${item.department ?? ""}${item.facilityName ?? ""}`.includes(keyword));
  }, [activeEmployees, query, effectiveFacilityKey]);
  const filteredCurrentOnDuty = currentOnDuty.filter(facilityMatches);
  const filteredNextOnDuty = nextOnDuty.filter(facilityMatches);
  const scopeTitle = detailMode ? selectedFacility?.facilityName ?? "場館詳細" : "場館";
  const scopeSubtitle = detailMode
    ? `FACILITY DETAIL · 營運總覽 > 場館 > ${selectedFacility?.facilityName ?? decodedRouteFacilityKey ?? ""}`
    : "FACILITY · 營運總覽 > 場館，僅顯示主管授權館別的人力、當班與下一班資料。";

  if (detailMode && dashboardQuery.isSuccess && !selectedFacility) {
    return (
      <RoleShell role="supervisor" title="場館詳細" subtitle="FACILITY DETAIL · 此場館不在目前主管授權範圍內。">
        <WorkbenchCard className="grid min-h-[320px] place-items-center p-8 text-center">
          <div>
            <p className="text-[18px] font-black text-[#10233f]">找不到可管理的場館</p>
            <p className="mt-2 text-[13px] font-bold text-[#637185]">此場館不存在，或目前帳號沒有該館權限。</p>
            <Link href="/supervisor/facilities" className="workbench-focus mt-5 inline-flex min-h-10 items-center rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white">
              回到場館列表
            </Link>
          </div>
        </WorkbenchCard>
      </RoleShell>
    );
  }

  return (
    <RoleShell role="supervisor" title={scopeTitle} subtitle={scopeSubtitle}>
      <div className="space-y-4">
        {detailMode && selectedFacility ? (
          <WorkbenchCard className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 border-b border-[#edf1f6] p-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#007166]">Facility Detail</p>
                <h2 className="mt-2 truncate text-[24px] font-black text-[#10233f]">{selectedFacility.facilityName}</h2>
                <p className="mt-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">{selectedFacility.area} · {selectedFacility.facilityKey}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SupervisorPill tone={selectedFacility.onShift > 0 ? "green" : "amber"}>
                  {selectedFacility.onShift > 0 ? "營運中" : "待排班"}
                </SupervisorPill>
                <Link href="/supervisor/facilities" className="workbench-focus inline-flex min-h-10 items-center rounded-[8px] border border-[#dfe7ef] bg-white px-4 text-[12px] font-black text-[#536175]">
                  返回全部場館
                </Link>
              </div>
            </div>
            <div className="grid border-b border-[#edf1f6] md:grid-cols-4">
              {[
                ["ACTIVE 當班", `${selectedFacility.onShift} / ${selectedFacility.active}`, "text-[#15935d]"],
                ["HANDOVER 交辦", selectedFacility.openHandovers, "text-[#0d2a50]"],
                ["TASKS 任務", selectedFacility.incompleteTasks, "text-[#ef7d22]"],
                ["NEXT 下一班", selectedFacility.next, "text-[#2f6fe8]"],
              ].map(([label, value, color]) => (
                <div key={label} className="border-b border-r border-[#edf1f6] p-4 last:border-r-0 md:border-b-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">{label}</p>
                  <p className={cn("mt-1 text-[26px] font-black", color)}>{value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 bg-[#fbfcfd] p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#007166] text-[14px] font-black text-white">
                {(selectedFacility.currentLead?.name ?? "未").slice(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#8b9aae]">當班主理人</p>
                <p className="truncate text-[15px] font-black text-[#10233f]">
                  {selectedFacility.currentLead?.name ?? "尚未接班"}
                  {selectedFacility.currentLead?.title ? <span className="ml-1 font-bold text-[#637185]">· {selectedFacility.currentLead.title}</span> : null}
                </p>
              </div>
            </div>
          </WorkbenchCard>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <SupervisorKpiCard label={detailMode ? "本館現職" : "現職人員"} value={detailMode ? filteredEmployees.length : staffing?.active ?? 0} helper={detailMode ? "依目前場館過濾" : "Ragic 授權人員"} icon={Users} tone="navy" />
          <SupervisorKpiCard label={detailMode ? "本館當班" : "目前當班"} value={detailMode ? filteredCurrentOnDuty.length : staffing?.onShift ?? 0} helper="依班表與館別 scope" icon={Clock3} tone="green" />
          <SupervisorKpiCard label={detailMode ? "本館下一班" : "下一班"} value={filteredNextOnDuty.length} helper="即將交接人力" icon={UserCheck} tone="blue" />
        </div>

        {!detailMode ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-black text-[#10233f]">授權場館詳細資訊</h2>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">這裡承載各館數字、當班主理人、交辦與任務狀況；首頁場館牌卡只作為入口。</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFacilityKey("all")}
                className={cn(
                  "workbench-focus min-h-9 shrink-0 rounded-[8px] border px-3 text-[12px] font-black",
                  selectedFacilityKey === "all" ? "border-[#16b6b1] bg-[#e7f7f6] text-[#007166]" : "border-[#dfe7ef] bg-white text-[#536175]",
                )}
              >
                顯示全部
              </button>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {facilities.map((facility) => (
                <WorkbenchCard
                  key={facility.facilityKey}
                  className={cn(
                    "overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_-34px_rgba(13,42,80,0.75)]",
                    selectedFacilityKey === facility.facilityKey && "ring-2 ring-[#16b6b1]/25",
                  )}
                >
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-[17px] font-black leading-tight text-[#10233f]">{facility.facilityName}</h2>
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">
                        <MapPin className="h-3 w-3" />
                        {facility.area} · {facility.facilityKey}
                      </p>
                    </div>
                    <SupervisorPill tone={facility.onShift > 0 ? "green" : "amber"}>
                      {facility.onShift > 0 ? "營運中" : "待排班"}
                    </SupervisorPill>
                  </div>
                  <div className="flex items-center gap-3 border-t border-[#edf1f6] px-4 py-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-[#007166] text-[13px] font-black text-white">
                      {(facility.currentLead?.name ?? "未").slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#8b9aae]">當班主理人</p>
                      <p className="truncate text-[14px] font-black text-[#10233f]">
                        {facility.currentLead?.name ?? "尚未接班"}
                        {facility.currentLead?.title ? <span className="ml-1 font-bold text-[#637185]">· {facility.currentLead.title}</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 border-t border-[#edf1f6]">
                    <div className="border-r border-[#edf1f6] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Active</p>
                      <p className="mt-1 text-[24px] font-black text-[#15935d]">
                        {facility.onShift}
                        <span className="ml-1 text-[13px] text-[#8b9aae]">/ {facility.active}</span>
                      </p>
                    </div>
                    <div className="border-r border-[#edf1f6] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Handover</p>
                      <p className="mt-1 text-[24px] font-black text-[#0d2a50]">{facility.openHandovers}</p>
                    </div>
                    <div className="border-r border-[#edf1f6] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Tasks</p>
                      <p className="mt-1 text-[24px] font-black text-[#ef7d22]">{facility.incompleteTasks}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Next</p>
                      <p className="mt-1 text-[24px] font-black text-[#2f6fe8]">{facility.next}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-[#f8fafc] px-4 py-3">
                    <button type="button" onClick={() => setSelectedFacilityKey(facility.facilityKey)} className="workbench-focus min-h-8 rounded-[8px] px-2 text-[12px] font-black text-[#536175]">
                      篩選本館
                    </button>
                    <Link
                      href={getFacilityDetailHref(facility.facilityKey)}
                      aria-label={`進入 ${facility.facilityName} 詳細面板`}
                      className="workbench-focus inline-flex min-h-8 items-center rounded-[8px] px-2 text-[12px] font-black text-[#007166]"
                    >
                      進入詳細面板 →
                    </Link>
                  </div>
                </WorkbenchCard>
              ))}
            </div>
          </section>
        ) : null}

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
          <StaffList title="目前當班" items={filteredCurrentOnDuty} empty="目前沒有當班資料。" />
          <StaffList title="下一班人員" items={filteredNextOnDuty} empty="目前沒有下一班資料。" />
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
