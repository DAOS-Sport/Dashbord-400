import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CalendarDays, Camera, CheckCircle2, ClipboardList, Droplets, Image as ImageIcon, MapPin, PackageSearch, RefreshCw, Search, UserCheck, Users, Waves } from "lucide-react";
import type { ShiftSummary, StaffMemberSummary, SupervisorDashboardDto, SupervisorFacilityDetailDto, SupervisorFacilityFrontDeskModuleDto, SupervisorFacilityModuleItemDto } from "@shared/domain/workbench";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchMetricCluster } from "@/modules/workbench/metric-cluster";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";
import { cn } from "@/lib/utils";
import { SupervisorPill } from "../supervisor-ui";

type FacilityShiftResponse = {
  facilityKey: string;
  facilityName: string;
  date: string;
  shifts: ShiftSummary[];
  totalCount: number;
  activeCount: number;
  sourceStatus: { connected: boolean; lastSyncedAt?: string; errorMessage?: string };
};

const fetchSupervisorDashboard = () => apiGet<SupervisorDashboardDto>("/api/bff/supervisor/dashboard");
const fetchFacilityDetail = (facilityKey: string) =>
  apiGet<SupervisorFacilityDetailDto>(`/api/bff/supervisor/facilities/${encodeURIComponent(facilityKey)}/detail`);
const fetchFacilitySchedule = (facilityKey: string) =>
  apiGet<FacilityShiftResponse>(`/api/bff/supervisor/facilities/${encodeURIComponent(facilityKey)}/schedule`);
const getFacilityDetailHref = (facilityKey: string) => `/supervisor/facilities/${encodeURIComponent(facilityKey)}`;

const roleLabel = (item: StaffMemberSummary) =>
  item.title?.trim() || item.department?.trim() || item.shiftLabel?.trim() || "未分類";


function StaffRows({ title, items, empty }: { title: string; items: StaffMemberSummary[]; empty: string }) {
  return (
    <WorkbenchCard className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-black text-[#10233f]">{title}</h2>
        <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[11px] font-black text-[#2f6fe8]">{items.length} 人</span>
      </div>
      <div className="grid gap-2">
        {items.slice(0, 18).map((item, index) => (
          <div key={`${item.employeeNumber ?? item.name}-${index}`} className="flex min-h-[54px] items-center gap-3 rounded-[8px] bg-[#fbfcfd] px-3 py-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf8ef] text-[12px] font-black text-[#15935d]">
              {item.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-[#10233f]">{item.name}</p>
              <p className="truncate text-[11px] font-bold text-[#8b9aae]">{roleLabel(item)} {item.timeRange ? `· ${item.timeRange}` : ""}</p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", item.status === "active" ? "bg-[#eaf8ef] text-[#15935d]" : "bg-[#eef2f6] text-[#637185]")}>
              {item.status === "active" ? "當班" : "下一班"}
            </span>
          </div>
        ))}
        {!items.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-5 text-center text-[13px] font-bold text-[#637185]">{empty}</div> : null}
      </div>
    </WorkbenchCard>
  );
}

function AttachmentGrid({ item }: { item: SupervisorFacilityModuleItemDto }) {
  const attachments = item.attachments ?? [];
  if (!attachments.length) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        attachment.kind === "image" ? (
          <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-[8px] border border-[#dfe7ef] bg-white">
            <img src={attachment.url} alt={attachment.label} className="h-28 w-full object-cover transition group-hover:scale-[1.02]" />
            <span className="flex min-h-8 items-center gap-2 px-2 text-[11px] font-black text-[#536175]">
              <ImageIcon className="h-3.5 w-3.5" />
              {attachment.label}
            </span>
          </a>
        ) : (
          <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#0d2a50]">
            <ImageIcon className="h-4 w-4" />
            {attachment.label}
          </a>
        )
      ))}
    </div>
  );
}

const moduleIcon = {
  "water-quality": Droplets,
  "coach-dive": Camera,
  cleanup: CheckCircle2,
  "lane-issues": Waves,
  "lost-and-found": PackageSearch,
};

function ModuleBlock({ title, items, empty }: { title: string; items: SupervisorFacilityModuleItemDto[]; empty: string }) {
  return (
    <div className="rounded-[8px] border border-[#e6edf4] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-black text-[#10233f]">{title}</h3>
        <span className="rounded-full bg-[#eef2f6] px-2 py-1 text-[10px] font-black text-[#637185]">{items.length} 筆</span>
      </div>
      <div className="grid gap-3">
        {items.slice(0, 6).map((item) => (
          <article key={item.id} className="rounded-[8px] bg-[#fbfcfd] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black text-[#10233f]">{item.title}</p>
                {item.meta ? <p className="mt-1 truncate text-[11px] font-bold text-[#8b9aae]">{item.meta}</p> : null}
              </div>
              <span className="shrink-0 rounded-full bg-[#eaf8ef] px-2 py-1 text-[10px] font-black text-[#15935d]">{item.status}</span>
            </div>
            {item.description ? <p className="mt-2 line-clamp-3 text-[12px] font-bold leading-5 text-[#536175]">{item.description}</p> : null}
            <AttachmentGrid item={item} />
          </article>
        ))}
        {!items.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-5 text-center text-[13px] font-bold text-[#637185]">{empty}</div> : null}
      </div>
    </div>
  );
}

function FrontDeskModules({ modules, fallbackItems }: { modules?: SupervisorFacilityFrontDeskModuleDto[]; fallbackItems: SupervisorFacilityModuleItemDto[] }) {
  const visibleModules = modules?.length
    ? modules
    : [{
        id: "handover" as const,
        label: "交接事項",
        status: fallbackItems.length ? "ready" as const : "empty" as const,
        count: fallbackItems.length,
        items: fallbackItems,
      }];
  return (
    <div className="grid gap-4">
      <div className="rounded-[8px] border border-[#dfe7ef] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#0d2a50]">Front Desk</p>
            <h2 className="mt-1 text-[16px] font-black text-[#10233f]">櫃台端模組狀態</h2>
          </div>
          <span className="rounded-full bg-[#eef2f6] px-3 py-1 text-[11px] font-black text-[#637185]">{visibleModules.length} 項</span>
        </div>
        <div className="grid gap-3">
          {visibleModules.map((module) => (
            <ModuleBlock key={module.id} title={module.label} items={module.items} empty={`目前沒有${module.label}資料。`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shift helpers（對齊 /employee/shift 頁面）────────────────────────────────

const fmtShiftTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
};

function classifyShiftRole(role?: string): "counter" | "lifeguard" | "other" {
  if (!role) return "other";
  if (role === "櫃台") return "counter";
  if (role.includes("救生")) return "lifeguard";
  return "other";
}

function classifyShiftPeriod(s: ShiftSummary): "morning" | "evening" | "both" {
  if (!s.startsAt || !s.endsAt) return "morning";
  const sh = new Date(s.startsAt).getHours();
  const eh = new Date(s.endsAt).getHours();
  if (sh < 12 && eh > 12) return "both";
  if (sh >= 12) return "evening";
  return "morning";
}

function ShiftPersonRow({ shift }: { shift: ShiftSummary }) {
  const status = shift.status === "active" ? "active" : shift.status === "upcoming" ? "upcoming" : "finished";
  const name = shift.employeeName ?? shift.label.split("/")[0]?.trim() ?? "—";
  return (
    <div className="flex items-center gap-2.5" data-testid={`row-shift-person-${shift.id}`}>
      <span className={cn("text-[15px] font-bold leading-snug", status === "finished" ? "text-[#c8d3de]" : "text-[#10233f]")}>
        {name}
      </span>
      <span className="font-mono text-[12px] font-bold text-[#8b9aae]">
        {fmtShiftTime(shift.startsAt)}–{fmtShiftTime(shift.endsAt)}
      </span>
      {status === "active" && (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eaf8ef] px-2 py-0.5 text-[10px] font-black text-[#15935d]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#15935d]" />
          上班中
        </span>
      )}
      {status === "finished" && (
        <span className="ml-auto shrink-0 text-[10px] font-bold text-[#c8d3de]">已結束</span>
      )}
    </div>
  );
}

function ShiftRoleSection({ label, labelClass, shifts }: { label: string; labelClass: string; shifts: ShiftSummary[] }) {
  if (!shifts.length) return null;
  return (
    <div className="px-4 py-3">
      <p className={cn("mb-2.5", labelClass)}>{label}</p>
      <div className="space-y-2">
        {shifts.map((s) => <ShiftPersonRow key={s.id} shift={s} />)}
      </div>
    </div>
  );
}

function TodaySchedulePanel({ facilityKey }: { facilityKey: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["/api/bff/supervisor/facilities/schedule", facilityKey],
    queryFn: () => fetchFacilitySchedule(facilityKey),
    enabled: Boolean(facilityKey),
    staleTime: 60_000,
  });

  const shifts = data?.shifts ?? [];
  const morningShifts = useMemo(
    () => shifts.filter((s) => { const p = classifyShiftPeriod(s); return p === "morning" || p === "both"; }),
    [shifts],
  );
  const eveningShifts = useMemo(
    () => shifts.filter((s) => { const p = classifyShiftPeriod(s); return p === "evening" || p === "both"; }),
    [shifts],
  );

  const connected = data?.sourceStatus?.connected ?? false;

  return (
    <WorkbenchCard className="overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#007166]" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#007166]">Smart Schedule</p>
            <h2 className="text-[15px] font-black text-[#10233f]">今日排班</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[12px] font-bold text-[#8b9aae]">{data.date}</span>
          )}
          {data && data.activeCount > 0 && (
            <span className="rounded-full bg-[#eaf8ef] px-2.5 py-0.5 text-[11px] font-black text-[#15935d]">
              {data.activeCount} 人在班
            </span>
          )}
          <button type="button" onClick={() => refetch()} aria-label="重新整理排班" data-testid="button-refresh-schedule">
            <RefreshCw className={cn("h-4 w-4 text-[#637185]", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* States */}
      {isLoading && (
        <div className="border-t border-[#f0f4f8] px-5 py-6 text-[13px] font-bold text-[#8b9aae]">載入排班中…</div>
      )}
      {!isLoading && (isError || (data && !connected)) && (
        <div className="border-t border-[#f0f4f8] px-5 py-6">
          <p className="text-[13px] font-bold text-[#b05c00]">目前無法取得 Smart Schedule 資料</p>
          <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">
            {data?.sourceStatus?.errorMessage ?? "排班系統可能暫時無法連線，請稍後再試。"}
          </p>
        </div>
      )}
      {!isLoading && data && connected && shifts.length === 0 && (
        <div className="border-t border-[#f0f4f8] px-5 py-6 text-[13px] font-bold text-[#8b9aae]">今日尚無排班資料。</div>
      )}

      {/* 早班 / 晚班 雙欄 */}
      {!isLoading && data && connected && shifts.length > 0 && (
        <>
          <div className="grid grid-cols-2 divide-x divide-[#f0f4f8] border-t border-[#f0f4f8]">
            {/* 早班 */}
            <div>
              <div className="border-b border-[#f0f4f8] px-4 py-2.5">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#2f9e5b]">早班</p>
                <p className="text-[10px] font-bold text-[#8b9aae]">12:00 前</p>
              </div>
              {morningShifts.length === 0 ? (
                <div className="px-4 py-5 text-[12px] font-bold text-[#8b9aae]">無早班人員</div>
              ) : (
                <div className="divide-y divide-[#f0f4f8]">
                  <ShiftRoleSection label="櫃台" labelClass="text-[11px] font-black tracking-wide text-[#8b9aae]" shifts={morningShifts.filter((s) => classifyShiftRole(s.role) === "counter")} />
                  <ShiftRoleSection label="救生" labelClass="text-[13px] font-black text-[#10233f]" shifts={morningShifts.filter((s) => classifyShiftRole(s.role) === "lifeguard")} />
                  {morningShifts.filter((s) => classifyShiftRole(s.role) === "other").length > 0 && (
                    <ShiftRoleSection
                      label={morningShifts.find((s) => classifyShiftRole(s.role) === "other")?.role || "其他"}
                      labelClass="text-[12px] font-black text-[#536175]"
                      shifts={morningShifts.filter((s) => classifyShiftRole(s.role) === "other")}
                    />
                  )}
                </div>
              )}
            </div>
            {/* 晚班 */}
            <div>
              <div className="border-b border-[#f0f4f8] px-4 py-2.5">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#2f6fe8]">晚班</p>
                <p className="text-[10px] font-bold text-[#8b9aae]">12:00 後</p>
              </div>
              {eveningShifts.length === 0 ? (
                <div className="px-4 py-5 text-[12px] font-bold text-[#8b9aae]">無晚班人員</div>
              ) : (
                <div className="divide-y divide-[#f0f4f8]">
                  <ShiftRoleSection label="櫃台" labelClass="text-[11px] font-black tracking-wide text-[#8b9aae]" shifts={eveningShifts.filter((s) => classifyShiftRole(s.role) === "counter")} />
                  <ShiftRoleSection label="救生" labelClass="text-[13px] font-black text-[#10233f]" shifts={eveningShifts.filter((s) => classifyShiftRole(s.role) === "lifeguard")} />
                  {eveningShifts.filter((s) => classifyShiftRole(s.role) === "other").length > 0 && (
                    <ShiftRoleSection
                      label={eveningShifts.find((s) => classifyShiftRole(s.role) === "other")?.role || "其他"}
                      labelClass="text-[12px] font-black text-[#536175]"
                      shifts={eveningShifts.filter((s) => classifyShiftRole(s.role) === "other")}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#f0f4f8] bg-[#f8fafc] px-5 py-2.5">
            <span className="text-[11px] font-bold text-[#8b9aae]">本日共計</span>
            <span className="text-[12px] font-black text-[#10233f]">{data.totalCount} 人次</span>
          </div>
        </>
      )}
    </WorkbenchCard>
  );
}

type SupervisorPeoplePageProps = {
  facilityKey?: string;
};

export default function SupervisorPeoplePage({ facilityKey: routeFacilityKey }: SupervisorPeoplePageProps = {}) {
  const [query, setQuery] = useState("");
  const dashboardQuery = useQuery({
    queryKey: ["/api/bff/supervisor/dashboard", "facilities"],
    queryFn: fetchSupervisorDashboard,
  });
  const decodedRouteFacilityKey = routeFacilityKey ? decodeURIComponent(routeFacilityKey) : undefined;
  const detailMode = Boolean(decodedRouteFacilityKey);
  const detailQuery = useQuery({
    queryKey: ["/api/bff/supervisor/facilities/detail", decodedRouteFacilityKey],
    queryFn: () => fetchFacilityDetail(decodedRouteFacilityKey!),
    enabled: Boolean(decodedRouteFacilityKey),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const staffing = dashboardQuery.data?.staffing.data;
  const facilities = dashboardQuery.data?.facilities?.data ?? [];
  const selectedFacility = decodedRouteFacilityKey
    ? facilities.find((facility) => facility.facilityKey === decodedRouteFacilityKey) ?? detailQuery.data?.facility
    : undefined;
  const keyword = query.trim();
  const visibleFacilities = useMemo(() => (
    keyword
      ? facilities.filter((facility) => `${facility.facilityName}${facility.facilityKey}${facility.area ?? ""}`.includes(keyword))
      : facilities
  ), [facilities, keyword]);

  if (detailMode && dashboardQuery.isSuccess && !selectedFacility && detailQuery.isError) {
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
    <RoleShell
      role="supervisor"
      title={detailMode ? selectedFacility?.facilityName ?? "場館詳細" : "場館狀態"}
      subtitle={detailMode ? "FACILITY DETAIL · 櫃台交接、場租、公告活動與救生作業狀態" : "FACILITY STATUS · 授權館別、當班人員、下一班與模組概況。"}
    >
      <div className="space-y-4">
        {dashboardQuery.isLoading ? (
          <div className="rounded-[8px] bg-white p-6 text-[13px] font-bold text-[#637185]">載入場館狀態中...</div>
        ) : null}

        <WorkbenchMetricCluster
          eyebrow="On Site"
          title="現場人力摘要"
          helper="館別分布已合併在此；單館詳情可查看櫃台與救生模組狀態。"
          columnsClassName="grid-cols-3"
          spanLastOnMobile={false}
          items={[
            { label: "授權館別", value: facilities.length, helper: visibleFacilities.map((item) => item.facilityName).join(" / ") || "尚無館別", icon: MapPin, tone: "navy" },
            { label: "當班人力", value: staffing?.onShift ?? 0, helper: `現職 ${staffing?.active ?? 0} / 總人數 ${staffing?.total ?? 0}`, icon: Users, tone: "green" },
            { label: "下一班", value: staffing?.nextOnDuty?.length ?? 0, helper: "即將接班人員", icon: UserCheck, tone: "blue" },
          ]}
        />

        {!detailMode ? (
          <>
            <WorkbenchCard className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-[15px] font-black text-[#10233f]">授權場館詳細資訊</h2>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">每張卡只保留館別、當班、下一班、櫃台交接與救生水質狀態。</p>
                </div>
                <div className="flex min-h-10 min-w-0 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 lg:w-80">
                  <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] font-bold outline-none" placeholder="搜尋館別" />
                  <button type="button" onClick={() => dashboardQuery.refetch()} aria-label="重新整理">
                    <RefreshCw className={cn("h-4 w-4 text-[#637185]", dashboardQuery.isFetching && "animate-spin")} />
                  </button>
                </div>
              </div>
            </WorkbenchCard>

            <div className="grid gap-3 xl:grid-cols-3">
              {visibleFacilities.map((facility) => {
                const todayCount = facility.todayTotal ?? facility.onShift;
                const todayPeople = (staffing?.allTodayOnDuty ?? staffing?.currentOnDuty ?? []).filter(
                  (item) => item.facilityKey === facility.facilityKey,
                );
                const nextPeople = (staffing?.nextOnDuty ?? []).filter((item) => item.facilityKey === facility.facilityKey);
                const hasToday = todayCount > 0;
                return (
                  <WorkbenchCard key={facility.facilityKey} className="overflow-hidden p-0">
                    <div className="flex items-start justify-between gap-3 border-b border-[#edf1f6] p-4">
                      <div className="min-w-0">
                        <h2 className="truncate text-[17px] font-black text-[#10233f]">{facility.facilityName}</h2>
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">
                          <MapPin className="h-3 w-3" />
                          {facility.area} · {facility.facilityKey}
                        </p>
                      </div>
                      <SupervisorPill tone={hasToday ? "green" : "amber"}>
                        {hasToday ? "今日有班" : "今日無排班"}
                      </SupervisorPill>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-4 text-[12px] font-black">
                      <div className="rounded-[8px] bg-[#fbfcfd] p-3">
                        <p className="text-[#8b9aae]">今日排班</p>
                        <p className="mt-1 text-[20px] text-[#15935d]">{todayCount}</p>
                        <p className="truncate text-[11px] text-[#637185]">{todayPeople.map((item) => item.name).slice(0, 3).join("、") || "尚無資料"}</p>
                      </div>
                      <div className="rounded-[8px] bg-[#fbfcfd] p-3">
                        <p className="text-[#8b9aae]">當班／待接</p>
                        <p className="mt-1 text-[20px] text-[#2f6fe8]">{facility.onShift + facility.next}</p>
                        <p className="truncate text-[11px] text-[#637185]">
                          {nextPeople.slice(0, 3).map((item) => item.name).join("、") ||
                            (facility.onShift > 0 ? `${facility.onShift} 人在班` : "無")}
                        </p>
                      </div>
                      <div className="rounded-[8px] bg-[#fbfcfd] p-3">
                        <p className="text-[#8b9aae]">櫃台交接事項</p>
                        <p className="mt-1 text-[20px] text-[#0d2a50]">{facility.openHandovers ?? 0}</p>
                        <p className="text-[11px] text-[#637185]">未完成 {facility.incompleteTasks ?? 0}</p>
                      </div>
                      <div className="rounded-[8px] bg-[#fbfcfd] p-3">
                        <p className="text-[#8b9aae]">救生水質檢測</p>
                        <p className="mt-1 text-[20px] text-[#007166]">{facility.lifeguardWaterQualityCount ?? 0}</p>
                        <p className="text-[11px] text-[#637185]">附件 {facility.lifeguardAttachmentCount ?? 0}</p>
                      </div>
                    </div>
                    <div className="border-t border-[#edf1f6] bg-[#f8fafc] px-4 py-3 text-right">
                      <Link href={getFacilityDetailHref(facility.facilityKey)} className="workbench-focus inline-flex min-h-9 items-center rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white">
                        查看場館狀態
                      </Link>
                    </div>
                  </WorkbenchCard>
                );
              })}
            </div>
          </>
        ) : null}

        {detailMode && selectedFacility ? (
          <>
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
                  ["當班", selectedFacility.onShift, "text-[#15935d]"],
                  ["下一班", selectedFacility.next, "text-[#2f6fe8]"],
                  ["櫃台交接", selectedFacility.openHandovers ?? 0, "text-[#0d2a50]"],
                  ["救生水質", selectedFacility.lifeguardWaterQualityCount ?? 0, "text-[#007166]"],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="border-b border-r border-[#edf1f6] p-4 last:border-r-0 md:border-b-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">{label}</p>
                    <p className={cn("mt-1 text-[26px] font-black", color)}>{value}</p>
                  </div>
                ))}
              </div>
            </WorkbenchCard>

            <TodaySchedulePanel facilityKey={decodedRouteFacilityKey!} />

            <div className="grid gap-4 xl:grid-cols-2">
              <StaffRows title="當班現職人員" items={detailQuery.data?.staffing.current ?? []} empty="目前沒有當班資料。" />
              <StaffRows title="下一班人員" items={detailQuery.data?.staffing.next ?? []} empty="目前沒有下一班資料。" />
            </div>

            {detailQuery.isLoading ? <div className="rounded-[8px] bg-white p-5 text-[13px] font-bold text-[#637185]">載入單館模組概況中...</div> : null}
            {detailQuery.isError ? (
              <div className="flex items-center justify-between rounded-[8px] border border-[#fde8e8] bg-[#fff8f8] p-4">
                <p className="text-[13px] font-bold text-[#c94444]">模組概況載入失敗，請稍後再試。</p>
                <button type="button" onClick={() => detailQuery.refetch()} className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175] hover:bg-[#f5f7fa]">重試</button>
              </div>
            ) : null}
            {detailQuery.data ? (
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <FrontDeskModules modules={detailQuery.data.frontDesk.modules} fallbackItems={detailQuery.data.frontDesk.items} />
                <div className="grid gap-4">
                  <div className="rounded-[8px] border border-[#dfe7ef] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#007166]">Lifeguard Modules</p>
                        <h2 className="mt-1 text-[16px] font-black text-[#10233f]">救生功能模組概況</h2>
                      </div>
                      <span className="rounded-full bg-[#eaf8ef] px-3 py-1 text-[11px] font-black text-[#15935d]">{detailQuery.data.lifeguard.waterQualityStatus}</span>
                    </div>
                    <div className="grid gap-3">
                      {detailQuery.data.lifeguard.modules.map((module) => {
                        const Icon = moduleIcon[module.id as keyof typeof moduleIcon] ?? ClipboardList;
                        return (
                          <div key={module.id} className="rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-white text-[#007166]">
                                  <Icon className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-[13px] font-black text-[#10233f]">{module.label}</p>
                                  <p className="text-[11px] font-bold text-[#8b9aae]">{module.status === "ready" ? "已有回報" : "尚無回報"}</p>
                                </div>
                              </div>
                              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#0d2a50]">{module.count}</span>
                            </div>
                            <div className="mt-3">
                              <ModuleBlock title={`${module.label}明細`} items={module.items} empty="目前沒有明細。" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </RoleShell>
  );
}
