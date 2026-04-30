import { useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertCircle, CalendarDays, CheckSquare, ClipboardList, Megaphone, UserRound, Users, X } from "lucide-react";
import type { StaffMemberSummary, SupervisorDashboardDto, SupervisorFacilityOverview } from "@shared/domain/workbench";
import { apiGet } from "@/shared/api/client";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { RoleShell } from "@/modules/workbench/role-shell";
import { cn } from "@/lib/utils";
import { SupervisorKpiCard, SupervisorPill } from "./supervisor-ui";

const fetchSupervisorDashboard = () => apiGet<SupervisorDashboardDto>("/api/bff/supervisor/dashboard");
const getFacilityDetailHref = (facilityKey: string) => `/supervisor/facilities/${encodeURIComponent(facilityKey)}`;

function Kpi({ title, value, helper, icon: Icon, tone }: { title: string; value: string; helper: string; icon: typeof Users; tone: string }) {
  const uiTone: "green" | "blue" | "amber" | "red" | "navy" = tone.includes("ff4964")
    ? "red"
    : tone.includes("ef7d22")
      ? "amber"
      : tone.includes("2f6fe8")
        ? "blue"
        : tone.includes("15935d")
          ? "green"
          : "navy";
  return <SupervisorKpiCard label={title} value={value} helper={helper} icon={Icon} tone={uiTone} />;
}

type FacilityDutyGroup = {
  facility: SupervisorFacilityOverview;
  positions: Array<{
    title: string;
    people: StaffMemberSummary[];
  }>;
};

const positionLabel = (member: StaffMemberSummary) =>
  member.title?.trim() || member.department?.trim() || member.shiftLabel?.trim() || "未分類職位";

function buildDutyGroups(data: SupervisorDashboardDto): FacilityDutyGroup[] {
  const facilities = data.facilities?.data ?? [];
  const currentOnDuty = data.staffing.data?.currentOnDuty ?? [];
  const operatingFacilities = facilities.filter((facility) => facility.onShift > 0);
  const visibleFacilities = operatingFacilities.length ? operatingFacilities : facilities;

  return visibleFacilities.map((facility) => {
    const people = currentOnDuty.filter((member) => member.facilityKey === facility.facilityKey);
    const positions = Array.from(
      people.reduce((map, member) => {
        const key = positionLabel(member);
        map.set(key, [...(map.get(key) ?? []), member]);
        return map;
      }, new Map<string, StaffMemberSummary[]>()),
    )
      .map(([title, positionPeople]) => ({
        title,
        people: positionPeople.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));

    return { facility, positions };
  });
}

function OnDutyDrawer({
  data,
  open,
  onClose,
}: {
  data: SupervisorDashboardDto;
  open: boolean;
  onClose: () => void;
}) {
  const dutyGroups = useMemo(() => buildDutyGroups(data), [data]);
  const [selectedFacilityKey, setSelectedFacilityKey] = useState<string | null>(null);
  const selectedGroup = dutyGroups.find((group) => group.facility.facilityKey === selectedFacilityKey) ?? dutyGroups[0];
  const totalOnDuty = dutyGroups.reduce((sum, group) => sum + group.positions.reduce((count, position) => count + position.people.length, 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" aria-label="關閉當班人員抽屜" onClick={onClose} className="absolute inset-0 bg-[#10233f]/35" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col bg-white shadow-[0_24px_80px_-28px_rgba(13,42,80,0.65)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#edf1f6] px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#007166]">Now On Duty</p>
            <h2 className="mt-1 text-[20px] font-black text-[#10233f]">現在當班人員</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">依營運中場館、職位與人員分層顯示，共 {totalOnDuty} 人。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[#f3f6fb] text-[#536175]" aria-label="關閉">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[240px_1fr]">
          <div className="min-h-0 overflow-y-auto border-b border-[#edf1f6] bg-[#f8fafc] p-4 md:border-b-0 md:border-r">
            <p className="mb-3 text-[12px] font-black text-[#536175]">營運中場館</p>
            <div className="space-y-2">
              {dutyGroups.length ? dutyGroups.map((group) => {
                const peopleCount = group.positions.reduce((sum, position) => sum + position.people.length, 0);
                const active = group.facility.facilityKey === selectedGroup?.facility.facilityKey;
                return (
                  <button
                    key={group.facility.facilityKey}
                    type="button"
                    onClick={() => setSelectedFacilityKey(group.facility.facilityKey)}
                    className={cn(
                      "w-full rounded-[10px] border p-3 text-left transition",
                      active ? "border-[#15935d] bg-white shadow-sm" : "border-transparent bg-transparent hover:bg-white",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-[13px] font-black text-[#10233f]">{group.facility.facilityName}</p>
                      <span className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-black",
                        peopleCount > 0 ? "bg-[#eaf8ef] text-[#15935d]" : "bg-[#eef2f6] text-[#8b9aae]",
                      )}>
                        {peopleCount} 人
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-bold text-[#8b9aae]">{group.facility.area} · {group.facility.facilityKey}</p>
                  </button>
                );
              }) : (
                <div className="rounded-[10px] bg-white p-4 text-[13px] font-bold text-[#637185]">目前沒有營運中場館。</div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            {selectedGroup ? (
              <div className="space-y-4">
                <div className="rounded-[12px] bg-[#10233f] p-4 text-white">
                  <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[#9dd84f]">Facility</p>
                  <h3 className="mt-1 text-[22px] font-black">{selectedGroup.facility.facilityName}</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-[8px] bg-white/10 p-3">
                      <p className="text-[20px] font-black">{selectedGroup.facility.onShift}</p>
                      <p className="text-[11px] font-bold text-white/70">當班</p>
                    </div>
                    <div className="rounded-[8px] bg-white/10 p-3">
                      <p className="text-[20px] font-black">{selectedGroup.facility.next}</p>
                      <p className="text-[11px] font-bold text-white/70">下一班</p>
                    </div>
                    <div className="rounded-[8px] bg-white/10 p-3">
                      <p className="text-[20px] font-black">{selectedGroup.positions.length}</p>
                      <p className="text-[11px] font-bold text-white/70">職位</p>
                    </div>
                  </div>
                </div>

                {selectedGroup.positions.length ? selectedGroup.positions.map((position) => (
                  <section key={position.title} className="rounded-[12px] border border-[#e6edf4] bg-[#fbfcfd] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-[15px] font-black text-[#10233f]">{position.title}</h4>
                      <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[11px] font-black text-[#2f6fe8]">{position.people.length} 人</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {position.people.map((member, index) => (
                        <div key={`${member.employeeNumber ?? member.name}-${index}`} className="flex items-center gap-3 rounded-[10px] bg-white p-3 shadow-sm">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eaf8ef] text-[13px] font-black text-[#15935d]">
                            {member.name.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-black text-[#10233f]">{member.name}</p>
                            <p className="truncate text-[11px] font-bold text-[#8b9aae]">
                              {member.employeeNumber ?? "無員編"} · {member.timeRange ?? "依排班系統"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )) : (
                  <div className="grid min-h-[280px] place-items-center rounded-[12px] bg-[#fbfcfd] p-8 text-center">
                    <div>
                      <UserRound className="mx-auto h-12 w-12 text-[#9aa8ba]" />
                      <p className="mt-3 text-[16px] font-black text-[#10233f]">目前沒有當班人員資料</p>
                      <p className="mt-1 text-[13px] font-bold text-[#637185]">資料會依排班 / Ragic BFF 回傳自動顯示。</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function FacilityOverviewGrid({
  data,
  onOpenDutyDrawer,
  onOpenFacilityDetail,
}: {
  data: SupervisorDashboardDto;
  onOpenDutyDrawer: () => void;
  onOpenFacilityDetail: (facilityKey: string) => void;
}) {
  const facilities = data.facilities?.data ?? [];
  const facilityRailRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });

  const startFacilityRailDrag = (event: PointerEvent<HTMLDivElement>) => {
    const rail = facilityRailRef.current;
    if (!rail) return;
    dragState.current = { active: true, moved: false, startX: event.clientX, scrollLeft: rail.scrollLeft };
    rail.setPointerCapture(event.pointerId);
  };
  const moveFacilityRailDrag = (event: PointerEvent<HTMLDivElement>) => {
    const rail = facilityRailRef.current;
    if (!rail || !dragState.current.active) return;
    const delta = event.clientX - dragState.current.startX;
    if (Math.abs(delta) > 4) {
      dragState.current.moved = true;
    }
    event.preventDefault();
    rail.scrollLeft = dragState.current.scrollLeft - delta;
  };
  const stopFacilityRailDrag = () => {
    dragState.current.active = false;
  };
  const scrollFacilityRailWithWheel = (event: WheelEvent<HTMLDivElement>) => {
    const rail = facilityRailRef.current;
    if (!rail) return;
    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (horizontalIntent) return;
    event.preventDefault();
    rail.scrollLeft += event.deltaY;
  };
  const shouldSuppressClickAfterDrag = (event: MouseEvent<HTMLElement>) => {
    if (!dragState.current.moved) return true;
    event.preventDefault();
    event.stopPropagation();
    dragState.current.moved = false;
    return true;
  };
  const openFacilityDetail = (facilityKey: string, event: MouseEvent<HTMLElement>) => {
    if (shouldSuppressClickAfterDrag(event)) return;
    onOpenFacilityDetail(facilityKey);
  };
  const suppressFacilityClickAfterDrag = (event: MouseEvent<HTMLElement>) => {
    if (!dragState.current.moved) return false;
    event.preventDefault();
    event.stopPropagation();
    dragState.current.moved = false;
    return true;
  };

  if (!facilities.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-[8px] border border-[#dfe7ef] bg-white p-4 shadow-sm md:hidden">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#007166]">Facilities</p>
          <h2 className="mt-1 text-[18px] font-black text-[#10233f]">場館營運模組</h2>
          <p className="mt-1 text-[12px] font-bold text-[#637185]">手機端快速查看授權場館與當班人員。</p>
        </div>
        <button
          type="button"
          onClick={onOpenDutyDrawer}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white"
        >
          <Users className="h-4 w-4" />
          查看當班人員
        </button>
      </div>
      <div className="hidden items-center justify-between gap-3 md:flex">
        <div>
          <h2 className="text-[16px] font-black text-[#10233f]">授權場館狀態</h2>
          <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">同一排橫向瀏覽；可用滑鼠拖曳、觸控滑動或水平滾輪移動。</p>
        </div>
        <button
          type="button"
          onClick={onOpenDutyDrawer}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-[12px] font-black text-[#007166] shadow-sm ring-1 ring-[#dfe7ef]"
        >
          <Users className="h-4 w-4" />
          查看當班人員
        </button>
      </div>
      <div
        ref={facilityRailRef}
        onPointerDown={startFacilityRailDrag}
        onPointerMove={moveFacilityRailDrag}
        onPointerUp={stopFacilityRailDrag}
        onPointerLeave={stopFacilityRailDrag}
        onPointerCancel={stopFacilityRailDrag}
        onWheel={scrollFacilityRailWithWheel}
        className="flex touch-pan-x snap-x gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin] cursor-grab active:cursor-grabbing"
        aria-label="授權場館狀態橫向圖卡列表"
      >
        {facilities.map((facility) => (
          <article
            key={facility.facilityKey}
            onClickCapture={suppressFacilityClickAfterDrag}
            className="w-[82vw] min-w-[300px] max-w-[360px] shrink-0 snap-start rounded-[8px] border border-[#dfe7ef] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 sm:w-[360px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[14px] font-black leading-tight text-[#10233f]">{facility.facilityName}</h2>
                <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.1em] text-[#8b9aae]">{facility.area} · {facility.facilityKey}</p>
              </div>
              <SupervisorPill tone={facility.onShift > 0 ? "green" : "amber"}>
                {facility.onShift > 0 ? "營運中" : "待排班"}
              </SupervisorPill>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[12px] font-black">
              <span className="rounded-[8px] bg-[#f7f9fb] p-2">現職<br />{facility.active}</span>
              <span className="rounded-[8px] bg-[#f7f9fb] p-2">當班<br />{facility.onShift}</span>
              <span className="rounded-[8px] bg-[#f7f9fb] p-2">交辦<br />{facility.openHandovers}</span>
              <span className="rounded-[8px] bg-[#f7f9fb] p-2">任務<br />{facility.incompleteTasks}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#edf1f6] pt-3">
              <span className="text-[12px] font-bold text-[#536175]">篩選本館</span>
              <button
                type="button"
                onClick={(event) => openFacilityDetail(facility.facilityKey, event)}
                aria-label={`進入 ${facility.facilityName} 詳細面板`}
                className="workbench-focus inline-flex min-h-8 items-center rounded-[8px] px-2 text-[12px] font-black text-[#007166]"
              >
                進入詳細面板 →
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function SupervisorDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/bff/supervisor/dashboard"], queryFn: fetchSupervisorDashboard });
  const [, navigate] = useLocation();
  const [dutyDrawerOpen, setDutyDrawerOpen] = useState(false);

  return (
    <RoleShell title="今日營運總覽" subtitle="OPERATIONS OVERVIEW · 授權場館營運、交辦、任務與公告確認狀態" role="supervisor">
      {isLoading || !data ? (
        <div className="rounded-[8px] bg-white p-6 text-[14px] font-bold text-[#637185]">載入主管控制台...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <Kpi title="營運人力" value={`${data.staffing.data?.active ?? 0} / ${data.staffing.data?.total ?? 0}`} helper={`在班 ${data.staffing.data?.onShift ?? 0} 人　缺班 ${data.staffing.data?.absent ?? 0} 人`} icon={Users} tone="text-[#15935d]" />
            <Kpi title="待審核異常" value={`${data.pendingAnomalies.data?.length ?? 0}`} helper="需儘速處理" icon={AlertCircle} tone="text-[#ff4964]" />
            <Kpi title="未完成交班" value={`${data.incompleteTasks.data?.length ?? 0}`} helper="待回報 / 待完成" icon={ClipboardList} tone="text-[#10233f]" />
            <Kpi title="未確認公告人數" value={`${data.announcementAcks.data?.unconfirmed ?? 0}`} helper="需補強通知" icon={Megaphone} tone="text-[#ef7d22]" />
            <Kpi title="今日剩餘交接" value={`${data.handoverOverview.data?.open ?? 0}`} helper="提醒 / 服務 / 櫃台" icon={CheckSquare} tone="text-[#2f6fe8]" />
          </div>

          <FacilityOverviewGrid
            data={data}
            onOpenDutyDrawer={() => setDutyDrawerOpen(true)}
            onOpenFacilityDetail={(facilityKey) => navigate(getFacilityDetailHref(facilityKey))}
          />
          <OnDutyDrawer data={data} open={dutyDrawerOpen} onClose={() => setDutyDrawerOpen(false)} />

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <WorkbenchCard className="p-5">
              <h2 className="mb-4 text-[15px] font-black">快速操作</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {["新增交班", "指派交接", "發布公告", "交接紀錄", "新增活動", "異常審核"].map((label, index) => (
                  <button key={label} className="min-h-[72px] rounded-[8px] bg-[#fbfcfd] p-3 text-[12px] font-black text-[#263b56] hover:bg-white hover:shadow">
                    <CalendarDays className={cn("mx-auto mb-2 h-5 w-5", index % 2 ? "text-[#ff4964]" : "text-[#2f6fe8]")} />
                    {label}
                  </button>
                ))}
              </div>
            </WorkbenchCard>
            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-black">未完成交班 Top 5</h2>
                <button className="workbench-focus rounded-[8px] px-2 py-1 text-[11px] font-black text-[#007166]">查看全部 →</button>
              </div>
              <div className="space-y-2">
                {(data.incompleteTasks.data ?? []).slice(0, 5).length ? (data.incompleteTasks.data ?? []).slice(0, 5).map((task) => (
                  <div key={task.id} className="flex min-h-[44px] items-center gap-3 rounded-[8px] bg-[#fbfcfd] px-3 py-2 text-[13px]">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", task.priority === "high" ? "bg-[#ff4964]" : "bg-[#15935d]")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-[#10233f]">{task.title}</p>
                      <p className="truncate text-[11px] font-bold text-[#8b9aae]">{task.assignedToName ?? task.createdByName ?? "待指派"} · {task.dueLabel ?? task.dueAt ?? "未設定期限"}</p>
                    </div>
                    <span className={cn("rounded-[4px] px-2 py-1 text-[10px] font-black", task.priority === "high" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#eaf8ef] text-[#15935d]")}>{task.priority === "high" ? "高" : "低"}</span>
                  </div>
                )) : (
                  <div className="grid min-h-[132px] place-items-center rounded-[8px] bg-[#fbfcfd] text-center text-[13px] font-bold text-[#637185]">
                    目前沒有未完成交班。
                  </div>
                )}
              </div>
            </WorkbenchCard>
          </div>
        </div>
      )}
    </RoleShell>
  );
}
