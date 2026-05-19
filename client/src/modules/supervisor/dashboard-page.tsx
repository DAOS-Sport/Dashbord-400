import { useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AlertCircle, CalendarCheck, CalendarDays, Car, CheckSquare, ClipboardCheck, ClipboardList, Megaphone, UserRound, Users, Waves, X } from "lucide-react";
import type { StaffMemberSummary, SupervisorDashboardDto, SupervisorFacilityOverview } from "@shared/domain/workbench";
import { apiGet } from "@/shared/api/client";
import { useAuthMe } from "@/shared/auth/session";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { RoleShell } from "@/modules/workbench/role-shell";
import { FloatingQuickActionsPanel, type FloatingQuickActionItem } from "@/modules/workbench/floating-quick-actions";
import { WorkbenchMetricCluster } from "@/modules/workbench/metric-cluster";
import { cn } from "@/lib/utils";
import { SupervisorPill } from "./supervisor-ui";
import {
  SupervisorModulePreviewCard,
  type SupervisorHomeDrawerStatus,
  type SupervisorModulePreview,
  type SupervisorModulePreviewItem,
} from "./home-module-drawers";

const fetchSupervisorDashboard = () => apiGet<SupervisorDashboardDto>("/api/bff/supervisor/dashboard");
const getFacilityDetailHref = (facilityKey: string) => `/supervisor/facilities/${encodeURIComponent(facilityKey)}`;
const isInteractiveRailTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('a,button,input,select,textarea,[role="button"],[data-no-rail-drag="true"]'));

interface ParkingDashboardSummary {
  activeVehicleCount: number;
  expiringSoonCount: number;
  pendingPaymentReviewCount: number;
  notSignedCount: number;
  overdueCount: number;
  todayEventDayCount: number;
  monthRevenue: number;
}

interface WorkLogSubmissionPreview {
  id: number | string;
  status: string;
  workDate?: string;
  shiftType?: string;
  submittedByName?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  totalCompleted?: number;
  totalRequired?: number;
}

interface LaneRentalPreview {
  id: number | string;
  bookingDate?: string;
  laneCode?: string;
  startTime: string;
  endTime: string;
  renterName?: string | null;
}

interface CourtReservationPreview {
  id?: number | string;
  date?: string;
  school?: string;
  court?: string | number;
  courtName?: string;
  startTime?: string;
  endTime?: string;
  customerName?: string;
  title?: string;
  status?: string;
}

const todayYmd = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatNumber = (value: unknown) => Number(value ?? 0).toLocaleString("zh-TW");

const minutesBetween = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
};

const extractItems = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as { items?: unknown; results?: unknown; reservations?: unknown };
  if (Array.isArray(record.items)) return record.items as T[];
  if (Array.isArray(record.results)) return record.results as T[];
  if (Array.isArray(record.reservations)) return record.reservations as T[];
  return [];
};

const fetchParkingSummary = () => apiGet<ParkingDashboardSummary>("/api/parking/dashboard");

const fetchCounterLogPreview = (facilityKey: string, workDate: string) => {
  const params = new URLSearchParams({ facilityKey, workDate, moduleType: "counter" });
  return apiGet<{ items: WorkLogSubmissionPreview[] }>(`/api/work-logs/admin/submissions?${params.toString()}`);
};

const fetchLaneRentalPreview = (workDate: string) => {
  const params = new URLSearchParams({ facilityKey: "songshan_pool", date: workDate });
  return apiGet<{ items: LaneRentalPreview[] }>(`/api/lane-rentals?${params.toString()}`);
};

const fetchCourtsPreview = async (workDate: string) => {
  const [xinbei, sanchong] = await Promise.all([
    apiGet<CourtReservationPreview[]>(`/api/courts/xinbei/reservations/${workDate}`),
    apiGet<CourtReservationPreview[]>(`/api/courts/sanchong/reservations/${workDate}`),
  ]);
  return { xinbei, sanchong };
};

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
}: {
  data: SupervisorDashboardDto;
  onOpenDutyDrawer: () => void;
}) {
  const facilities = data.facilities?.data ?? [];
  const [, navigate] = useLocation();
  const facilityRailRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });

  const startFacilityRailDrag = (event: PointerEvent<HTMLDivElement>) => {
    const rail = facilityRailRef.current;
    if (!rail) return;
    if (isInteractiveRailTarget(event.target)) {
      dragState.current = { active: false, moved: false, startX: 0, scrollLeft: rail.scrollLeft };
      return;
    }
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
        {facilities.map((facility) => {
          const dutyPeople = (data.staffing.data?.currentOnDuty ?? []).filter(
            (m) => m.facilityKey === facility.facilityKey,
          );
          const classifyMember = (m: StaffMemberSummary): "counter" | "lifeguard" | "other" => {
            const lbl = [m.title, m.department, m.shiftLabel].filter(Boolean).join(" ");
            if (lbl.includes("救生")) return "lifeguard";
            if (lbl.includes("櫃台")) return "counter";
            return "other";
          };
          const counterMembers = dutyPeople.filter((m) => classifyMember(m) === "counter");
          const lifeguardMembers = dutyPeople.filter((m) => classifyMember(m) === "lifeguard");

          const hour = new Date().getHours();
          const facilityPeriod = hour >= 14 ? "晚班" : "早班";

          return (
            <article
              key={facility.facilityKey}
              onClickCapture={suppressFacilityClickAfterDrag}
              className="w-[82vw] min-w-[300px] max-w-[360px] shrink-0 snap-start rounded-[8px] border border-[#dfe7ef] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 sm:w-[360px]"
            >
              {/* Facility name + status */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[14px] font-black leading-tight text-[#10233f]">{facility.facilityName}</h2>
                  <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.1em] text-[#8b9aae]">{facility.area} · {facility.facilityKey}</p>
                </div>
                <SupervisorPill tone={facility.onShift > 0 ? "green" : "amber"}>
                  {facility.onShift > 0 ? "營運中" : "待排班"}
                </SupervisorPill>
              </div>

              {/* Stats row */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px] font-black">
                <span className="rounded-[8px] bg-[#f7f9fb] p-2">當班<br />{facility.onShift}</span>
                <span className="rounded-[8px] bg-[#f7f9fb] p-2">交辦<br />{facility.openHandovers ?? 0}</span>
                <span className="rounded-[8px] bg-[#f7f9fb] p-2">未完成<br />{facility.incompleteTasks ?? 0}</span>
              </div>

              {/* Shift breakdown */}
              {dutyPeople.length > 0 ? (
                <div className="mt-3 rounded-[8px] bg-[#f8fafc] p-3">
                  <p className="mb-2.5 text-[22px] font-black leading-none tracking-tight text-[#15935d]">
                    {facilityPeriod}
                  </p>
                  {counterMembers.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-[12px] font-black tracking-wide text-[#8b9aae]">櫃台</p>
                      <div className="space-y-1">
                        {counterMembers.map((m, i) => (
                          <div key={`${m.employeeNumber ?? m.name}-${i}`} className="flex items-center gap-2">
                            <span className={cn("text-[16px] font-bold leading-snug", m.status === "off" ? "text-[#c8d3de]" : "text-[#10233f]")}>
                              {m.name}
                            </span>
                            {m.status === "active" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-2 py-0.5 text-[10px] font-black text-[#15935d]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#15935d]" />
                                上班中
                              </span>
                            )}
                            {m.status === "off" && (
                              <span className="text-[10px] font-bold text-[#c8d3de]">已結束</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lifeguardMembers.length > 0 && (
                    <div>
                      <p className="mb-1 text-[18px] font-black text-[#10233f]">救生</p>
                      <div className="space-y-1">
                        {lifeguardMembers.map((m, i) => (
                          <div key={`${m.employeeNumber ?? m.name}-${i}`} className="flex items-center gap-2">
                            <span className={cn("text-[16px] font-bold leading-snug", m.status === "off" ? "text-[#c8d3de]" : "text-[#10233f]")}>
                              {m.name}
                            </span>
                            {m.status === "active" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-2 py-0.5 text-[10px] font-black text-[#15935d]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#15935d]" />
                                上班中
                              </span>
                            )}
                            {m.status === "off" && (
                              <span className="text-[10px] font-bold text-[#c8d3de]">已結束</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 rounded-[8px] bg-[#f8fafc] p-3 text-center text-[12px] font-bold text-[#8b9aae]">
                  目前無當班資料
                </div>
              )}

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between border-t border-[#edf1f6] pt-3">
                <span className="text-[12px] font-bold text-[#536175]">篩選本館</span>
                <button
                  type="button"
                  data-no-rail-drag="true"
                  aria-label={`進入 ${facility.facilityName} 詳細面板`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    dragState.current.moved = false;
                    navigate(getFacilityDetailHref(facility.facilityKey));
                  }}
                  className="workbench-focus inline-flex min-h-8 items-center rounded-[8px] px-2 text-[12px] font-black text-[#007166]"
                >
                  進入詳細面板 →
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const submissionStatusLabel: Record<string, string> = {
  submitted: "待審核",
  approved: "已核准",
  returned: "已退回",
};

const shiftLabel: Record<string, string> = {
  morning: "早班",
  noon: "中班",
  night: "晚班",
  all: "全班",
};

const supervisorQuickActions: FloatingQuickActionItem[] = [
  { label: "櫃台交接", helper: "新增或調整今日交辦", href: "/supervisor/handover", Icon: ClipboardList },
  { label: "公告發布", helper: "推送場館公告", href: "/supervisor/announcements", Icon: Megaphone },
  { label: "異常審核", helper: "處理待審核事件", href: "/supervisor/anomalies", Icon: AlertCircle },
  { label: "營運報表", helper: "開啟統計與匯出", href: "/supervisor/reports", Icon: CalendarDays },
];

function SupervisorQuickActionRail() {
  return (
    <FloatingQuickActionsPanel eyebrow="Floating Actions" title="快速操作" items={supervisorQuickActions} tone="green" />
  );
}

export default function SupervisorDashboardPage() {
  const { data: session, isLoading: sessionLoading } = useAuthMe();
  const canLoadSupervisorDashboard = session?.activeRole === "supervisor" || session?.activeRole === "system";
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["/api/bff/supervisor/dashboard", session?.activeRole],
    queryFn: fetchSupervisorDashboard,
    enabled: Boolean(canLoadSupervisorDashboard),
    retry: false,
  });
  const [dutyDrawerOpen, setDutyDrawerOpen] = useState(false);
  const workDate = useMemo(() => todayYmd(), []);
  const facilities = data?.facilities?.data ?? [];
  const primaryFacilityKey = facilities[0]?.facilityKey ?? "";
  const hasSongshan = facilities.some((facility) => facility.facilityKey === "songshan_pool");

  const parkingQuery = useQuery({
    queryKey: ["supervisor-home", "parking"],
    queryFn: fetchParkingSummary,
    enabled: Boolean(data),
    retry: false,
  });
  const counterLogQuery = useQuery({
    queryKey: ["supervisor-home", "counter-log", primaryFacilityKey, workDate],
    queryFn: () => fetchCounterLogPreview(primaryFacilityKey, workDate),
    enabled: Boolean(data && primaryFacilityKey),
    retry: false,
  });
  const laneRentalQuery = useQuery({
    queryKey: ["supervisor-home", "lane-rentals", workDate],
    queryFn: () => fetchLaneRentalPreview(workDate),
    enabled: Boolean(data && hasSongshan),
    retry: false,
  });
  const courtsQuery = useQuery({
    queryKey: ["supervisor-home", "courts", workDate],
    queryFn: () => fetchCourtsPreview(workDate),
    enabled: Boolean(data),
    retry: false,
  });

  const modulePreviews = useMemo<SupervisorModulePreview[]>(() => {
    const parking = parkingQuery.data;
    const parkingStatus: SupervisorHomeDrawerStatus = parkingQuery.isLoading
      ? "loading"
      : parkingQuery.isError
        ? "error"
        : "ready";
    const parkingItems: SupervisorModulePreviewItem[] = parking ? [
      { id: "parking-expiring", title: "30 日內到期合約", value: formatNumber(parking.expiringSoonCount), tone: parking.expiringSoonCount > 0 ? "amber" : "green" },
      { id: "parking-payments", title: "待審核付款", value: formatNumber(parking.pendingPaymentReviewCount), tone: parking.pendingPaymentReviewCount > 0 ? "amber" : "green" },
      { id: "parking-not-signed", title: "尚未簽約", value: formatNumber(parking.notSignedCount), tone: parking.notSignedCount > 0 ? "navy" : "green" },
      { id: "parking-overdue", title: "逾期未繳 / 已過期", value: formatNumber(parking.overdueCount), tone: parking.overdueCount > 0 ? "red" : "green" },
    ] : [];

    const counterItems = extractItems<WorkLogSubmissionPreview>(counterLogQuery.data).slice(0, 5);
    const counterPending = counterItems.filter((item) => item.status === "submitted").length;
    const counterReturned = counterItems.filter((item) => item.status === "returned").length;
    const counterStatus: SupervisorHomeDrawerStatus = !primaryFacilityKey
      ? "degraded"
      : counterLogQuery.isLoading
        ? "loading"
        : counterLogQuery.isError
          ? "error"
          : counterItems.length
            ? "ready"
            : "empty";

    const laneItems = extractItems<LaneRentalPreview>(laneRentalQuery.data).slice(0, 5);
    const bookedHours = extractItems<LaneRentalPreview>(laneRentalQuery.data).reduce((sum, item) => sum + minutesBetween(item.startTime, item.endTime) / 60, 0);
    const totalLaneHours = 82.5;
    const laneStatus: SupervisorHomeDrawerStatus = !hasSongshan
      ? "degraded"
      : laneRentalQuery.isLoading
        ? "loading"
        : laneRentalQuery.isError
          ? "error"
          : laneItems.length
            ? "ready"
            : "empty";

    const xinbeiReservations = courtsQuery.data?.xinbei ?? [];
    const sanchongReservations = courtsQuery.data?.sanchong ?? [];
    const courtItems = [
      ...xinbeiReservations.map((item) => ({ ...item, school: "新北高中" })),
      ...sanchongReservations.map((item) => ({ ...item, school: "三重商工" })),
    ].slice(0, 5);
    const courtStatus: SupervisorHomeDrawerStatus = courtsQuery.isLoading
      ? "loading"
      : courtsQuery.isError
        ? "error"
        : courtItems.length
          ? "ready"
          : "empty";
    const courtTotal = xinbeiReservations.length + sanchongReservations.length;

    return [
      {
        moduleId: "parking",
        eyebrow: "Parking",
        title: "停車場管理",
        description: "車輛、租約、付款審核與到期風險摘要。",
        status: parkingStatus,
        statusLabel: parkingStatus === "error" ? "載入失敗" : parkingStatus === "loading" ? "載入中" : "已連線",
        icon: Car,
        primaryMetric: formatNumber(parking?.activeVehicleCount),
        primaryLabel: "履約中車輛",
        secondaryMetric: formatNumber(parking?.pendingPaymentReviewCount),
        secondaryLabel: "待審核付款",
        stats: [
          { label: "履約中車輛", value: formatNumber(parking?.activeVehicleCount), tone: "green" },
          { label: "30 日內到期", value: formatNumber(parking?.expiringSoonCount), tone: "amber" },
          { label: "未簽約", value: formatNumber(parking?.notSignedCount), tone: "navy" },
          { label: "本月收入", value: `$${formatNumber(parking?.monthRevenue)}`, tone: "blue" },
        ],
        items: parkingItems,
        emptyText: "目前沒有停車場待辦摘要。",
        errorText: "停車場摘要載入失敗，仍可前往完整頁確認車輛與付款狀態。",
        ctas: [
          { label: "前往停車場總覽", href: "/supervisor/parking" as const },
          { label: "付款審核", href: "/supervisor/parking/payments" as const, variant: "secondary" },
        ],
      },
      {
        moduleId: "counter-log",
        eyebrow: "Counter Log",
        title: "櫃台日誌",
        description: "今日櫃台日報、待審核與退回摘要。",
        status: counterStatus,
        statusLabel: counterStatus === "error" ? "載入失敗" : counterStatus === "degraded" ? "無場館" : counterStatus === "loading" ? "載入中" : counterStatus === "empty" ? "無回報" : "已連線",
        icon: ClipboardCheck,
        primaryMetric: formatNumber(counterItems.length),
        primaryLabel: "今日回報",
        secondaryMetric: formatNumber(counterPending),
        secondaryLabel: "待審核",
        stats: [
          { label: "今日回報", value: formatNumber(counterItems.length), tone: "blue" },
          { label: "待審核", value: formatNumber(counterPending), tone: counterPending > 0 ? "amber" : "green" },
          { label: "退回", value: formatNumber(counterReturned), tone: counterReturned > 0 ? "red" : "green" },
        ],
        items: counterItems.map((item) => ({
          id: String(item.id),
          title: item.submittedByName ?? item.submittedBy ?? "未命名回報",
          meta: `${item.workDate ?? workDate} · ${shiftLabel[item.shiftType ?? ""] ?? item.shiftType ?? "未標班別"} · ${item.totalCompleted ?? 0}/${item.totalRequired ?? 0}`,
          value: submissionStatusLabel[item.status] ?? item.status,
          tone: item.status === "returned" ? "red" : item.status === "submitted" ? "amber" : "green",
        })),
        emptyText: "今日尚無櫃台日誌回報。",
        errorText: "櫃台日誌摘要載入失敗，請進入審核頁查看完整列表。",
        ctas: [
          { label: "前往櫃台日誌審核", href: "/supervisor/counter-log/submissions" as const },
        ],
      },
      {
        moduleId: "lane-rentals",
        eyebrow: "Lane Rentals",
        title: "水道租借",
        description: "松山水道今日租借時段、已租與空檔摘要。",
        status: laneStatus,
        statusLabel: laneStatus === "error" ? "載入失敗" : laneStatus === "degraded" ? "需松山權限" : laneStatus === "loading" ? "載入中" : laneStatus === "empty" ? "無租借" : "已連線",
        icon: Waves,
        primaryMetric: bookedHours.toFixed(1),
        primaryLabel: "已租小時",
        secondaryMetric: Math.max(0, totalLaneHours - bookedHours).toFixed(1),
        secondaryLabel: "空檔小時",
        stats: [
          { label: "總時數", value: `${totalLaneHours.toFixed(1)}h`, tone: "navy" },
          { label: "已租時數", value: `${bookedHours.toFixed(1)}h`, tone: "blue" },
          { label: "空檔時數", value: `${Math.max(0, totalLaneHours - bookedHours).toFixed(1)}h`, tone: "green" },
        ],
        items: laneItems.map((item) => ({
          id: String(item.id),
          title: item.renterName ?? "未命名租借",
          meta: `${item.laneCode ?? "水道"} · ${item.startTime}-${item.endTime}`,
          value: `${(minutesBetween(item.startTime, item.endTime) / 60).toFixed(1)}h`,
          tone: "blue",
        })),
        emptyText: "今日松山水道尚無租借區段。",
        errorText: "水道租借摘要載入失敗，仍可前往完整排程表。",
        ctas: [
          { label: "前往水道租借", href: "/supervisor/lane-rentals" as const },
        ],
      },
      {
        moduleId: "courts",
        eyebrow: "Courts",
        title: "場地預約",
        description: "新北高中與三重商工今日預約量與同步狀態。",
        status: courtStatus,
        statusLabel: courtStatus === "error" ? "載入失敗" : courtStatus === "loading" ? "載入中" : courtStatus === "empty" ? "無預約" : "已連線",
        icon: CalendarCheck,
        primaryMetric: formatNumber(xinbeiReservations.length),
        primaryLabel: "新北高中",
        secondaryMetric: formatNumber(sanchongReservations.length),
        secondaryLabel: "三重商工",
        stats: [
          { label: "新北高中今日", value: formatNumber(xinbeiReservations.length), tone: "blue" },
          { label: "三重商工今日", value: formatNumber(sanchongReservations.length), tone: "green" },
          { label: "空檔預估", value: formatNumber(Math.max(0, 224 - courtTotal)), tone: "navy" },
          { label: "同步狀態", value: courtsQuery.isError ? "異常" : "已連線", tone: courtsQuery.isError ? "red" : "green" },
        ],
        items: courtItems.map((item, index) => ({
          id: String(item.id ?? `${item.school}-${index}`),
          title: item.customerName ?? item.title ?? "未命名預約",
          meta: `${item.school} · ${item.courtName ?? `場地 ${item.court ?? "-"}`} · ${item.startTime ?? "--:--"}-${item.endTime ?? "--:--"}`,
          value: item.status ?? "預約",
          tone: "blue",
        })),
        emptyText: "今日尚無場地預約。",
        errorText: "場地預約摘要載入失敗，完整日曆仍可從模組頁開啟。",
        ctas: [
          { label: "前往新北高中日曆", href: "/supervisor/courts/xinbei" as const },
          { label: "搜尋預約", href: "/supervisor/courts/xinbei/search" as const, variant: "secondary" },
        ],
      },
    ];
  }, [
    counterLogQuery.data,
    counterLogQuery.isError,
    counterLogQuery.isLoading,
    courtsQuery.data,
    courtsQuery.isError,
    courtsQuery.isLoading,
    hasSongshan,
    laneRentalQuery.data,
    laneRentalQuery.isError,
    laneRentalQuery.isLoading,
    parkingQuery.data,
    parkingQuery.isError,
    parkingQuery.isLoading,
    primaryFacilityKey,
    workDate,
  ]);

  return (
    <RoleShell title="今日營運總覽" subtitle="OPERATIONS OVERVIEW · 授權場館營運、櫃台交接與公告確認狀態" role="supervisor">
      {sessionLoading || !canLoadSupervisorDashboard ? (
        <div className="rounded-[8px] bg-white p-6 text-[14px] font-bold text-[#637185]">正在切換主管權限...</div>
      ) : isError ? (
        <WorkbenchCard className="p-6">
          <div className="flex max-w-2xl flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#fff4e8] text-[#ef7d22]">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#ef7d22]">Dashboard Error</p>
                <h2 className="mt-1 text-[18px] font-black text-[#10233f]">主管資料無法載入</h2>
                <p className="mt-2 text-[13px] font-bold leading-6 text-[#637185]">
                  主管首頁主資料回傳錯誤，畫面已停止無限載入。若剛從其他端切到主管端，請重新載入；若持續發生，通常是目前帳號沒有主管權限或 session 尚未完成更新。
                </p>
                <p className="mt-2 rounded-[8px] bg-[#f7f9fb] px-3 py-2 text-[12px] font-bold text-[#536175]">
                  {error instanceof Error ? error.message : "無法讀取 /api/bff/supervisor/dashboard"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="workbench-focus inline-flex min-h-10 items-center justify-center rounded-[8px] bg-[#15935d] px-4 text-[12px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#8b9aae]"
              >
                {isFetching ? "重新載入中..." : "重新載入"}
              </button>
              <Link
                href="/login"
                className="workbench-focus inline-flex min-h-10 items-center justify-center rounded-[8px] bg-[#f3f6fb] px-4 text-[12px] font-black text-[#10233f]"
              >
                重新登入
              </Link>
            </div>
          </div>
        </WorkbenchCard>
      ) : isLoading || !data ? (
        <div className="rounded-[8px] bg-white p-6 text-[14px] font-bold text-[#637185]">載入主管控制台...</div>
      ) : (
        <div className="space-y-4">
          <WorkbenchMetricCluster
            eyebrow="Operations"
            title="今日營運摘要"
            helper="集中顯示，減少首頁高度。"
            items={[
              { label: "營運人力", value: `${data.staffing.data?.active ?? 0} / ${data.staffing.data?.total ?? 0}`, helper: `在班 ${data.staffing.data?.onShift ?? 0} 人　缺班 ${data.staffing.data?.absent ?? 0} 人`, icon: Users, tone: "green" },
              { label: "待審核異常", value: data.pendingAnomalies.data?.length ?? 0, helper: "需儘速處理", icon: AlertCircle, tone: "red", href: "/supervisor/anomalies" },
              { label: "未完成交班", value: data.incompleteTasks.data?.length ?? 0, helper: "待回報 / 待完成", icon: ClipboardList, tone: "navy", href: "/supervisor/handover" },
              { label: "未確認公告", value: data.announcementAcks.data?.unconfirmed ?? 0, helper: "需補強通知", icon: Megaphone, tone: "amber", href: "/supervisor/announcements" },
              { label: "剩餘交接", value: data.handoverOverview.data?.open ?? 0, helper: "提醒 / 服務 / 櫃台", icon: CheckSquare, tone: "blue", href: "/supervisor/handover" },
            ]}
          />

          <FacilityOverviewGrid
            data={data}
            onOpenDutyDrawer={() => setDutyDrawerOpen(true)}
          />
          <WorkbenchCard className="overflow-hidden p-0">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div className="px-5 pt-5">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#007166]">Module Drawers</p>
                <h2 className="mt-1 text-[16px] font-black text-[#10233f]">主管模組抽屜</h2>
              </div>
              <p className="px-5 text-[12px] font-bold text-[#8b9aae] sm:pb-1">摘要快速瀏覽；點卡片直接進詳細頁。</p>
            </div>
            <div className="flex snap-x gap-3 overflow-x-auto px-5 pb-5 [scrollbar-width:thin]" aria-label="主管模組水平導覽">
              {modulePreviews.map((preview) => (
                <div key={preview.moduleId} className="w-[82vw] min-w-[292px] max-w-[340px] shrink-0 snap-start sm:w-[320px]">
                  <SupervisorModulePreviewCard preview={preview} />
                </div>
              ))}
            </div>
          </WorkbenchCard>
          <OnDutyDrawer data={data} open={dutyDrawerOpen} onClose={() => setDutyDrawerOpen(false)} />
          <SupervisorQuickActionRail />

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
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
