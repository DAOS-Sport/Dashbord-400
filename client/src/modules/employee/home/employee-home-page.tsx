import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CloudSun,
  FileText,
  Gauge,
  GraduationCap,
  Home,
  Link as LinkIcon,
  ListChecks,
  Menu,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
  StickyNote,
} from "lucide-react";
import type {
  AnnouncementSummary,
  CampaignSummary,
  DocumentSummary,
  EmployeeHomeDto,
  HandoverItemDto,
  HandoverSummary,
  ShiftBoardDto,
  ShiftSummary,
  StickyNoteSummary,
  TaskSummary,
} from "@shared/domain/workbench";
import type { NavigationModuleDto } from "@shared/modules";
import type { BffSection } from "@shared/bff/envelope";
import { defaultEmployeeHomeWidgets, normalizeWidgetLayout } from "@shared/domain/layout";
import { Link, useLocation } from "wouter";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { DegradedCard, NotConnectedCard } from "@/components/shared/not-connected-card";
import { BrandLockup, BrandMark } from "@/shared/brand";
import { riseIn, staggerContainer } from "@/shared/motion/tokens";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import { FloatingQuickActionsPanel, type FloatingQuickActionItem } from "@/modules/workbench/floating-quick-actions";
import {
  createEmployeeResource,
  createEmployeeFrontDeskHandover,
  completeEmployeeFrontDeskHandover,
  deleteEmployeeFrontDeskHandover,
  fetchEmployeeCourtsToday,
  fetchEmployeeHome,
  readEmployeeFrontDeskHandover,
  replyEmployeeFrontDeskHandover,
  searchEmployeeWorkbench,
  type EmployeeCourtReservationPreview,
  type EmployeeSearchResultDTO,
} from "./api";
import { EmployeeResourceActions } from "@/modules/employee/resources/employee-resource-actions";
import { cn } from "@/lib/utils";
import { FacilityGate } from "@/shared/auth/facility-gate";
import { useAuthMe, useSwitchFacility } from "@/shared/auth/session";
import { useFacilityLabelMap } from "@/shared/auth/facility-labels";
import { fetchModuleNavigation } from "@/shared/modules/api";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";
import { getWorkbenchRoutes } from "@shared/navigation/workbench-routes";
import { getCourtName, getCourtsBySchool, getSchoolName, type SchoolId } from "@/lib/court-utils";
import { getEmployeeCourtSchoolsForFacility } from "@/modules/employee/courts-visibility";

const quickNoteDraftKey = "junsi.cms.employee.quick-note-draft.v1";

const employeeHomeQuickActions: FloatingQuickActionItem[] = [
  { label: "任務管理", helper: "查看與完成今日任務", href: "/employee/tasks", Icon: ListChecks },
  { label: "群組公告", helper: "查看必讀公告與置頂通知", href: "/employee/announcements", Icon: Bell },
  { label: "櫃台交接", helper: "回報交辦與交接事項", href: "/employee/handover", Icon: MessageSquareText },
  { label: "異常回報", helper: "進入點名/打卡異常入口", href: "/employee/checkins", Icon: ShieldCheck },
  { label: "今日班表", helper: "查看今日班表與場館值勤", href: "/employee/shift", Icon: CalendarDays },
];

const toOptionalIso = (date: string, time: string) => {
  if (!date) return undefined;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const iconByKey: Record<string, LucideIcon> = {
  home: Home,
  "message-square-text": MessageSquareText,
  bell: Bell,
  "calendar-days": CalendarDays,
  "clipboard-check": ListChecks,
  "book-open": BookOpen,
  "shield-check": ShieldCheck,
  "file-text": FileText,
  "graduation-cap": GraduationCap,
  link: LinkIcon,
  search: Search,
};

type EmployeeNavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
};

const toEmployeeNavigationItems = (items: NavigationModuleDto[] | undefined): EmployeeNavigationItem[] => {
  const apiItems = (items ?? []).filter((item) => item.routePath.startsWith("/employee"));
  const sourceById = new Map(apiItems.map((item) => [item.id, item]));
  return getWorkbenchRoutes("employee")
    .map((route) => {
      const source = sourceById.get(route.moduleId);
      return {
        id: source?.id ?? route.moduleId,
        label: route.label,
        icon: iconByKey[source?.iconKey ?? route.iconKey] ?? iconByKey[route.iconKey] ?? Home,
        href: route.primaryPath,
      };
    })
    .filter((item): item is EmployeeNavigationItem => Boolean(item));
};

const formatShiftTime = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
};

const formatShiftTimeLong = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const formatShortDateTime = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const todayDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const isInternalHref = (href?: string | null) => Boolean(href?.startsWith("/"));

type HandoverHomePayload = {
  title: "交辦事項";
  items: Array<Pick<HandoverItemDto, "id" | "title" | "dueDate" | "preview" | "status">>;
  totalPending: number;
  primaryAction: { label: "新增交辦事項"; action: "open_drawer" };
  viewAllRoute: "/employee/handover";
};

const isHandoverHomePayload = (value: unknown): value is HandoverHomePayload =>
  Boolean(value && typeof value === "object" && Array.isArray((value as HandoverHomePayload).items));

const isShiftBoardPayload = (value: unknown): value is ShiftBoardDto =>
  Boolean(value && typeof value === "object" && Array.isArray((value as ShiftBoardDto).shifts));

type EmployeeHomeSlotKey =
  | "search"
  | "handover"
  | "announcements"
  | "shifts"
  | "events"
  | "documents"
  | "stickyNotes"
  | "courts"
  | "tutoringToday";

type EmployeeHomeResolvedLayout = {
  enabledKeys: Set<string>;
  isEnabled: (key: EmployeeHomeSlotKey) => boolean;
};

const resolveEmployeeHomeSlots = (items: ReturnType<typeof normalizeWidgetLayout>): EmployeeHomeResolvedLayout => {
  const enabledKeys = new Set(items.filter((item) => item.enabled).map((item) => item.key));
  return {
    enabledKeys,
    isEnabled: (key) => enabledKeys.has(key),
  };
};

const defaultDueDateTime = () => {
  const date = new Date();
  date.setHours(date.getHours() + 4, 0, 0, 0);
  return date.toISOString().slice(0, 16);
};

function SectionTitle({
  title,
  eyebrow,
  action = "查看全部",
  actionHref,
  onAction,
  dark = false,
  showAction = true,
}: {
  title: string;
  eyebrow: string;
  action?: string;
  actionHref?: string;
  onAction?: () => void;
  dark?: boolean;
  showAction?: boolean;
}) {
  const actionClassName = cn(
    "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-bold",
    dark ? "text-[#9dd84f] hover:bg-white/10" : "text-[#007166] hover:bg-[#edf7f4]",
  );
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className={cn("text-[15px] font-bold", dark ? "text-white" : "text-[#10233f]")}>{title}</h2>
        <p className={cn("mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em]", dark ? "text-[#9dd84f]" : "text-[#8b9aae]")}>
          {eyebrow}
        </p>
      </div>
      {!showAction ? null : actionHref ? (
        <Link href={actionHref} className={actionClassName}>
          {action}
          <span aria-hidden>→</span>
        </Link>
      ) : (
        <button type="button" onClick={onAction} className={actionClassName}>
          {action}
          <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}

function DesktopSidebar() {
  const [location] = useLocation();
  const trackEvent = useTrackEvent();
  const { data: session } = useAuthMe();
  const navigation = useQuery({
    queryKey: ["/api/modules/navigation", "employee-home-sidebar"],
    queryFn: fetchModuleNavigation,
    staleTime: 60_000,
  });
  const items = toEmployeeNavigationItems(navigation.data?.items);
  const granted = session?.grantedFacilities ?? [];
  const facilityLabels = useFacilityLabelMap(granted);
  const facilityName = facilityLabels.getFacilityName(session?.activeFacility);
  const visibleItems = getEmployeeCourtSchoolsForFacility(session?.activeFacility, facilityName).length
    ? items
    : items.filter((item) => item.id !== "courts");
  return (
    <aside className="hidden h-full min-h-0 w-[232px] shrink-0 flex-col bg-[#1f3f68] p-5 text-white shadow-[20px_0_40px_-32px_rgba(13,31,55,0.7)] md:flex">
      <BrandLockup markClassName="h-10 w-10 rounded-[8px]" titleClassName="text-[18px] text-white" />

      <div className="mt-6 rounded-[8px] bg-white/8 p-3">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[#9dd84f]">
          <span className="h-2 w-2 rounded-full bg-[#9dd84f]" />
          營運中
        </div>
        <p className="line-clamp-2 text-[13px] font-bold">{facilityName}</p>
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {!items.length && navigation.isLoading ? (
          <div className="rounded-[8px] bg-white/8 px-3 py-3 text-[12px] font-bold text-[#d6e2ef]">導覽載入中…</div>
        ) : null}
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/employee" ? location === "/employee" || location === "/EMPLOYEE" : location.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
              className={cn(
                "workbench-focus flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-left text-[14px] font-bold transition",
                active ? "bg-gradient-to-r from-[#1cb4a3] to-[#9dd84f] text-white" : "text-[#d6e2ef] hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge ? <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ff4964] text-[10px]">{item.badge}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 rounded-[8px] px-3 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#007166] text-[12px] font-black">駿</div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold">員工工作台</p>
            <p className="text-[11px] text-[#b6c7d9]">員工</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const { data: session } = useAuthMe();
  const switchFacility = useSwitchFacility();
  const granted = session?.grantedFacilities ?? [];
  const facilityLabels = useFacilityLabelMap(granted);
  const activeFacility = session?.activeFacility && granted.includes(session.activeFacility) ? session.activeFacility : "";
  const activeFacilityName = facilityLabels.getFacilityName(activeFacility);
  return (
    <header className="z-20 shrink-0 border-b border-[#dfe7ef] bg-[#0d2a50] text-white md:bg-white/90 md:text-[#10233f] md:backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between px-4 md:h-14 md:px-6">
        <div className="flex items-center gap-3 md:hidden">
          <button aria-label="開啟選單" className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10">
            <Menu className="h-5 w-5" />
          </button>
          <BrandMark className="h-8 w-8 rounded-[8px]" />
          <p className="text-[15px] font-black">駿斯 CMS</p>
        </div>
        <label className="relative hidden min-w-0 cursor-pointer items-center gap-3 rounded-[8px] px-1 py-1 transition hover:bg-[#f5f8fb] md:flex">
          <div className="grid h-8 w-8 place-items-center rounded-[7px] border border-[#e2e9f2] bg-white text-[#9aa8ba]">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="max-w-[280px] truncate text-[13px] font-black text-[#10233f]">{activeFacilityName}</span>
              {granted.length > 1 ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#8b9aae]" /> : null}
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8b9aae]">Dashboard</p>
          </div>
          {granted.length > 1 ? (
            <select
              value={activeFacility}
              onChange={(event) => switchFacility.mutate(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="切換場館"
            >
              {granted.map((facilityKey) => (
                <option key={facilityKey} value={facilityKey}>{facilityLabels.getFacilityName(facilityKey)}</option>
              ))}
            </select>
          ) : null}
        </label>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <RoleSwitcher visualActiveRole="employee" />
          </div>
          <button className="workbench-focus hidden min-h-9 items-center rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] md:inline-flex">
            員工
          </button>
          <button aria-label="通知" className="workbench-focus relative grid h-10 w-10 place-items-center rounded-full bg-white/10 md:bg-[#f0f4f8] md:text-[#10233f]">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#ff4964] text-[9px] font-black text-white">4</span>
          </button>
          <button aria-label="員工帳號" className="workbench-focus grid h-9 w-9 place-items-center rounded-full bg-[#32d17c] text-[13px] font-black text-white">{session?.displayName?.slice(0, 1) || "陳"}</button>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-2 md:hidden">
        <RoleSwitcher compact visualActiveRole="employee" />
      </div>
    </header>
  );
}

const searchTypeLabel: Record<EmployeeSearchResultDTO["type"], string> = {
  announcement: "公告",
  handover: "交接",
  task: "交班",
  shift: "班表",
  shortcut: "入口",
  document: "文件",
  campaign: "活動",
  training: "教材",
  qna: "問答",
};

function Hero({
  home,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  isSearching,
}: {
  home: EmployeeHomeDto;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: EmployeeSearchResultDTO[];
  isSearching: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_170px] lg:items-end">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8b9aae]">Quick Search</p>
        <label className="mt-2 flex min-h-14 items-center gap-3 rounded-[8px] border border-[#dfe7ef] bg-white px-4 shadow-[0_18px_45px_-36px_rgba(15,34,58,0.25)]">
          <Search className="h-4 w-4 shrink-0 text-[#9aa8ba]" />
          <input
            aria-label="快速搜尋"
            name="employee-workbench-search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-[#10233f] outline-none placeholder:text-[#8b9aae]"
            placeholder="搜尋公告、交接、班表、入口、常見問題…"
          />
        </label>
        {searchQuery.trim().length >= 2 ? (
          <div className="mt-2 max-w-[820px] rounded-[8px] border border-[#dfe7ef] bg-white p-2 shadow-[0_18px_45px_-36px_rgba(15,34,58,0.45)]">
            {isSearching ? <div className="px-3 py-2 text-[12px] font-bold text-[#637185]">搜尋中…</div> : null}
            {!isSearching && searchResults.length === 0 ? <div className="px-3 py-2 text-[12px] font-bold text-[#637185]">沒有找到符合的資訊。</div> : null}
            {searchResults.map((item) => (
              <Link key={item.id} href={item.href} className="flex min-h-11 items-center gap-3 rounded-[8px] px-3 py-2 hover:bg-[#f7f9fb]">
                <span className="shrink-0 rounded-[6px] bg-[#eef5ff] px-2 py-1 text-[11px] font-black text-[#1f6fd1]">{searchTypeLabel[item.type]}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-[#10233f]">{item.title}</span>
                  <span className="block truncate text-[11px] font-bold text-[#8b9aae]">{item.summary}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-[#637185]">
          <CalendarDays className="h-4 w-4 text-[#007166]" />
          {home.facility.businessDate}
        </p>
      </div>
      {home.weather.status === "unavailable" || !home.weather.data ? (
        <NotConnectedCard title="天氣卡片" reason="external_pending" className="min-h-[128px]" />
      ) : home.weather.status === "degraded" ? (
        <DegradedCard title="天氣卡片" className="min-h-[128px]" />
      ) : (
        <div className="rounded-[8px] border border-[#dfe7ef] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(15,34,58,0.45)]">
          <div className="flex items-center gap-3">
            <CloudSun className="h-10 w-10 text-[#ffc340]" />
            <div>
              <p className="text-[26px] font-black text-[#10233f]">{home.weather.data.temperatureC}°C</p>
              <p className="text-[12px] font-bold text-[#637185]">{home.weather.data.label}</p>
              <p className="text-[11px] text-[#8b9aae]">濕度 {home.weather.data.humidity}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TasksCard({ tasks }: { tasks: TaskSummary[] }) {
  const activeTasks = tasks.filter((task) => task.status !== "done");
  return (
    <WorkbenchCard className="h-full p-5">
      <SectionTitle title="今日任務" eyebrow="Tasks" actionHref="/employee/tasks" />
      {activeTasks.length > 0 ? (
        <div className="space-y-3">
          {activeTasks.slice(0, 4).map((task) => (
            <Link key={`task-${task.id}`} href="/employee/tasks" className="block rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-[#10233f]">{task.title}</p>
                  <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">
                    {task.assignedToName ? `指派：${task.assignedToName}` : task.createdByName ? `建立：${task.createdByName}` : "員工任務"}
                    {task.dueLabel ? ` · ${task.dueLabel}` : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-black", task.priority === "high" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#eef2f6] text-[#637185]")}>
                  {task.priority === "high" ? "高" : task.priority === "low" ? "低" : "一般"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[8px] bg-[#fbfcfd] p-5 text-center text-[13px] font-bold text-[#637185]">目前沒有待辦任務。</div>
      )}
    </WorkbenchCard>
  );
}

function HandoverCard({
  handovers,
  payload,
  onOpenDrawer,
}: {
  handovers: HandoverSummary[];
  payload?: HandoverHomePayload;
  onOpenDrawer: () => void;
}) {
  const items = payload?.items ?? handovers
    .filter((item) => item.status === "pending" || item.status === "unread" || item.status === "read")
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.title,
      preview: item.content ?? "",
      dueDate: item.dueLabel ?? item.targetDate ?? "",
      status: "pending" as const,
    }));
  const total = payload?.totalPending ?? items.length;
  return (
    <WorkbenchCard className="h-full p-5">
      <SectionTitle title="交辦事項" eyebrow="Handover" action="查看全部" actionHref="/employee/handover" />
      {total > 0 ? (
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <button key={`handover-${item.id}`} type="button" onClick={onOpenDrawer} className="block w-full rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3 text-left">
              <p className="truncate text-[13px] font-black text-[#10233f]">{item.title}</p>
              <p className="mt-1 truncate text-[11px] font-bold text-[#8b9aae]">{item.preview || "尚無內容摘要"} · {item.dueDate ? formatShortDateTime(item.dueDate) : "未設定到期"}</p>
            </button>
          ))}
          <div className="pt-1">
            <button type="button" onClick={onOpenDrawer} className="workbench-focus min-h-9 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white">
              新增交辦事項
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[128px] flex-col items-center justify-center rounded-[8px] bg-[#f7f9fb] px-4 py-5 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#6d7c90] shadow-sm">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <p className="mt-3 text-[15px] font-black text-[#10233f]">尚未設定交辦事項</p>
          <p className="mt-1 text-[12px] font-medium text-[#637185]">請新增交辦事項</p>
          <button type="button" onClick={onOpenDrawer} className="workbench-focus mt-4 min-h-9 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white">
            新增交辦事項
          </button>
        </div>
      )}
    </WorkbenchCard>
  );
}

function HandoverDrawer({
  open,
  facilityKey,
  items,
  onClose,
  onChanged,
}: {
  open: boolean;
  facilityKey: string;
  items: Array<Pick<HandoverItemDto, "id" | "title" | "dueDate" | "preview" | "status">>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const trackEvent = useTrackEvent();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDateTime);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const createMutation = useMutation({
    mutationFn: () => createEmployeeFrontDeskHandover({ facilityKey, title: title.trim(), content: content.trim(), dueDate: new Date(dueDate).toISOString() }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setDueDate(defaultDueDateTime());
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-create" });
      onChanged();
    },
  });
  const readMutation = useMutation({
    mutationFn: (id: string) => readEmployeeFrontDeskHandover(id),
    onSuccess: () => {
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-read" });
      onChanged();
    },
  });
  const replyMutation = useMutation({
    mutationFn: ({ id, reportNote }: { id: string; reportNote: string }) => replyEmployeeFrontDeskHandover(id, reportNote),
    onSuccess: () => {
      setReplyingId(null);
      setReplyText("");
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-reply" });
      onChanged();
    },
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) => completeEmployeeFrontDeskHandover(id),
    onSuccess: () => {
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-complete" });
      onChanged();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmployeeFrontDeskHandover(id),
    onSuccess: () => {
      setConfirmingDeleteId(null);
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-delete" });
      onChanged();
    },
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0d1f37]/35" role="dialog" aria-modal="true" aria-label="交辦事項">
      <button type="button" aria-label="關閉交辦事項" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[420px] flex-col bg-white shadow-[0_24px_60px_-24px_rgba(15,34,58,0.55)]">
        <div className="flex items-center justify-between border-b border-[#e6edf4] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-black text-[#10233f]">交辦事項</h2>
            <p className="text-[12px] font-bold text-[#637185]">新增交辦事項並追蹤 pending 狀態</p>
          </div>
          <button type="button" onClick={onClose} className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] bg-[#f3f6f9] text-[#536175]">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] p-3">
            <div className="grid gap-2">
              <label className="text-[12px] font-black text-[#536175]" htmlFor="home-handover-title">標題</label>
              <input
                id="home-handover-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold text-[#10233f] outline-none"
              />
              <label className="text-[12px] font-black text-[#536175]" htmlFor="home-handover-content">內容</label>
              <textarea
                id="home-handover-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-24 rounded-[8px] border border-[#dfe7ef] bg-white p-3 text-[13px] font-bold text-[#10233f] outline-none"
              />
              <label className="text-[12px] font-black text-[#536175]" htmlFor="home-handover-due-date">到期時間</label>
              <input
                id="home-handover-due-date"
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-bold text-[#10233f] outline-none"
              />
              <button
                type="button"
                disabled={!title.trim() || !content.trim() || !dueDate || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="workbench-focus min-h-10 rounded-[8px] bg-[#0d2a50] px-3 text-[13px] font-black text-white disabled:opacity-50"
              >
                {createMutation.isPending ? "新增中..." : "新增交辦事項"}
              </button>
              {createMutation.isError ? <p className="text-[11px] font-bold text-[#ff4964]">新增失敗，請確認欄位或稍後再試。</p> : null}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-black text-[#10233f]">Pending 交辦列表</h3>
              <Link href="/employee/handover" className="text-[12px] font-black text-[#007166]">完整頁</Link>
            </div>
            {items.length ? items.map((item) => (
              <article key={item.id} className="rounded-[8px] border border-[#e6edf4] bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-[#10233f]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] font-medium text-[#637185]">{item.preview || "尚無內容摘要"}</p>
                    <p className="mt-2 text-[11px] font-bold text-[#8b9aae]">{item.dueDate ? formatShortDateTime(item.dueDate) : "未設定到期"}</p>
                  </div>
                </div>
                {replyingId === item.id ? (
                  <div className="mt-3 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] p-3">
                    <label className="text-[12px] font-black text-[#536175]" htmlFor={`home-handover-reply-${item.id}`}>補充內容</label>
                    <textarea
                      id={`home-handover-reply-${item.id}`}
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      maxLength={1200}
                      className="mt-2 min-h-[86px] w-full rounded-[8px] border border-[#dfe7ef] bg-white p-3 text-[13px] font-bold leading-6 text-[#10233f] outline-none focus:border-[#0d2a50]"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#8b9aae]">{replyText.length} / 1200 字</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setReplyingId(null); setReplyText(""); }} className="min-h-8 rounded-[7px] border border-[#dfe7ef] bg-white px-3 text-[11px] font-black text-[#536175]">
                          取消
                        </button>
                        <button
                          type="button"
                          disabled={!replyText.trim() || replyMutation.isPending}
                          onClick={() => replyMutation.mutate({ id: item.id, reportNote: replyText.trim() })}
                          className="min-h-8 rounded-[7px] bg-[#0d2a50] px-3 text-[11px] font-black text-white disabled:opacity-50"
                        >
                          {replyMutation.isPending ? "送出中" : "送出補充"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={readMutation.isPending}
                    onClick={() => readMutation.mutate(item.id)}
                    className="workbench-focus rounded-[8px] border border-[#dfe7ef] bg-white px-2 py-1 text-[11px] font-black text-[#536175] disabled:opacity-50"
                  >
                    標記已讀
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReplyingId(item.id); setReplyText(""); }}
                    className="workbench-focus rounded-[8px] border border-[#dfe7ef] bg-white px-2 py-1 text-[11px] font-black text-[#536175]"
                  >
                    {replyingId === item.id ? "正在補充" : "回覆補充"}
                  </button>
                  <button
                    type="button"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate(item.id)}
                    className="workbench-focus shrink-0 rounded-[8px] bg-[#eaf8ef] px-2 py-1 text-[11px] font-black text-[#15935d] disabled:opacity-50"
                  >
                    完成
                  </button>
                  {confirmingDeleteId !== item.id ? (
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => setConfirmingDeleteId(item.id)}
                      className="workbench-focus rounded-[8px] border border-[#ffc6cf] bg-white px-2 py-1 text-[11px] font-black text-[#ff4964] disabled:opacity-50"
                    >
                      刪除
                    </button>
                  ) : (
                    <span className="flex flex-wrap gap-2 rounded-[8px] bg-[#fff0f1] p-1">
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="min-h-8 rounded-[7px] bg-[#ff4964] px-2 text-[11px] font-black text-white disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? "刪除中" : "確認刪除"}
                      </button>
                      <button type="button" onClick={() => setConfirmingDeleteId(null)} className="min-h-8 rounded-[7px] bg-white px-2 text-[11px] font-black text-[#536175]">
                        取消
                      </button>
                    </span>
                  )}
                </div>
              </article>
            )) : (
              <div className="rounded-[8px] bg-[#f7f9fb] p-5 text-center text-[13px] font-bold text-[#637185]">尚未設定交辦事項</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function AnnouncementCard({ announcements, source }: { announcements: AnnouncementSummary[]; source?: BffSection<AnnouncementSummary[]> }) {
  const sourceMessage = (() => {
    if (source?.status !== "unavailable" && source?.status !== "degraded") return "目前沒有需要優先閱讀的群組公告。";
    const reason = source.meta.fallbackReason ?? "";
    if (/TOKEN|LINE_BOT|ADMIN|API/i.test(reason)) return "公告來源暫時無法同步，請先以主管公告頁確認最新資訊。";
    return reason || "公告來源暫時無法同步，請稍後再試。";
  })();
  const [primaryAnnouncement, ...secondaryAnnouncements] = announcements.slice(0, 3);
  return (
    <WorkbenchCard className="h-full border-[#f1c66c] bg-[#fffaf0] p-5 shadow-[0_20px_48px_-36px_rgba(180,83,9,0.45)]">
      <SectionTitle title="群組重要公告" eyebrow="Pinned" action="全部公告" actionHref="/employee/announcements" />
      <div className="space-y-2.5">
        {primaryAnnouncement ? (
          <div className="rounded-[8px] border border-[#efc36f] bg-white p-3.5 text-[#10233f]">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[#fff0d4] text-[#b45309]">
                <Bell className="h-4 w-4" />
              </span>
              <span className="rounded-[4px] bg-[#fff1e7] px-1.5 py-0.5 text-[10px] font-black text-[#b45309]">
                {primaryAnnouncement.priority === "required" ? "重要" : "提醒"}
              </span>
              <span className="min-w-0 truncate text-[11px] font-bold text-[#8a6510]">
                {primaryAnnouncement.sourceLabel ? `${primaryAnnouncement.sourceLabel} · ` : ""}{primaryAnnouncement.effectiveRange}
              </span>
            </div>
            <p className="line-clamp-2 text-[14px] font-black leading-5">{primaryAnnouncement.title}</p>
            {/* Single-item view: show summary so user can read content without navigating */}
            {!secondaryAnnouncements.length && primaryAnnouncement.summary ? (
              <p className="mt-1.5 line-clamp-3 text-[12px] font-bold leading-5 text-[#6b5b2e]">{primaryAnnouncement.summary}</p>
            ) : null}
            {primaryAnnouncement.isExpiringSoon ? (
              <span className="mt-2 inline-flex rounded-[4px] bg-[#fef2f2] px-1.5 py-0.5 text-[10px] font-black text-[#dc2626]">即將結束</span>
            ) : null}
            {primaryAnnouncement.overlayNote ? (
              <p className="mt-2 line-clamp-1 text-[11px] font-bold text-[#b45309]">{primaryAnnouncement.overlayNote}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[8px] border border-dashed border-[#f1d394] bg-white/55 p-5 text-center text-[13px] font-bold text-[#8a6510]">
            <span>{sourceMessage}</span>
            {source?.updatedAt ? (
              <span className="mt-1.5 block text-[10px] font-bold text-[#b8975a]">上次更新：{formatShortDateTime(source.updatedAt)}</span>
            ) : null}
          </div>
        )}
        {secondaryAnnouncements.length ? (
          <div className="divide-y divide-[#f3dfb4] overflow-hidden rounded-[8px] border border-[#f3dfb4] bg-white/70">
            {secondaryAnnouncements.map((item) => (
              <Link key={item.id} href="/employee/announcements" className="flex min-h-[54px] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#d98216]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-black text-[#10233f]">{item.title}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold text-[#8b6b2a]">
                    {item.sourceLabel ? `${item.sourceLabel} · ` : ""}{item.effectiveRange}
                  </span>
                </span>
                <span className="shrink-0 rounded-[4px] bg-[#fff1e7] px-1.5 py-0.5 text-[10px] font-black text-[#b45309]">
                  提醒
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </WorkbenchCard>
  );
}

function AddResourceForm({
  category,
  facilityKey,
  titlePlaceholder,
  contentPlaceholder,
  urlPlaceholder,
  onCreated,
}: {
  category: "event" | "document" | "sticky_note";
  facilityKey: string;
  titlePlaceholder: string;
  contentPlaceholder: string;
  urlPlaceholder?: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const mutation = useMutation({
    mutationFn: () => createEmployeeResource({
      facilityKey,
      category,
      title,
      content: content.trim() || undefined,
      url: url.trim() || undefined,
      isPinned: category === "sticky_note",
    }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setUrl("");
      onCreated();
    },
  });
  const canSubmit = title.trim().length > 0 && !mutation.isPending;

  return (
    <div className="rounded-[8px] border border-dashed border-[#cfd9e5] bg-[#fbfcfd] p-3">
      <div className="grid gap-2">
        <input
          aria-label={titlePlaceholder}
          name={`${category}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold text-[#10233f] outline-none"
          placeholder={titlePlaceholder}
        />
        <input
          aria-label={contentPlaceholder}
          name={`${category}-content`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold text-[#10233f] outline-none"
          placeholder={contentPlaceholder}
        />
        {urlPlaceholder ? (
          <input
            aria-label={urlPlaceholder}
            name={`${category}-url`}
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold text-[#10233f] outline-none"
            placeholder={urlPlaceholder}
          />
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {mutation.isPending ? "新增中…" : "新增"}
        </button>
        {mutation.isError ? <p className="text-[11px] font-bold text-[#ff4964]">新增失敗，請確認欄位格式。</p> : null}
      </div>
    </div>
  );
}

function EventList({ campaigns, onChanged }: { campaigns: CampaignSummary[]; onChanged: () => void }) {
  if (!campaigns.length) return <div className="rounded-[8px] bg-[#fbfcfd] px-4 py-3 text-center text-[12px] font-bold text-[#8b9aae]">尚未新增活動檔期 / 課程快訊。</div>;
  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="rounded-[8px] bg-[#f7f9fb] p-3">
          <a href={campaign.linkUrl || "#"} className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-[#eaf8ef] text-[#15935d]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-[#10233f]">{campaign.title}</p>
              <p className="mt-1 truncate text-[11px] font-bold text-[#637185]">{campaign.effectiveRange}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${campaign.statusLabel === "即將結束" ? "bg-[#fef2f2] text-[#dc2626]" : campaign.statusLabel === "即將開始" ? "bg-[#eff6ff] text-[#2563eb]" : "bg-white text-[#15935d]"}`}>{campaign.statusLabel}</span>
          </a>
          <EmployeeResourceActions resourceId={campaign.resourceId} title={campaign.title} content={campaign.effectiveRange} url={campaign.linkUrl} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function DocumentList({ documents, onChanged }: { documents: DocumentSummary[]; onChanged: () => void }) {
  if (!documents.length) return <div className="rounded-[8px] bg-[#fbfcfd] px-4 py-3 text-center text-[12px] font-bold text-[#8b9aae]">尚未新增常用文件。</div>;
  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div key={doc.id} className="rounded-[8px] px-2 py-2 hover:bg-[#f7f9fb]">
          <a href={doc.url || "#"} className="flex min-h-12 w-full items-center gap-3 text-left">
            <FileText className="h-5 w-5 shrink-0 text-[#1f6fd1]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black text-[#10233f]">{doc.title}</span>
              <span className="block truncate text-[11px] font-medium text-[#8b9aae]">{doc.description || `更新：${doc.updatedAt}`}</span>
            </span>
          </a>
          <EmployeeResourceActions resourceId={doc.resourceId} title={doc.title} content={doc.description} url={doc.url} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function StickyNotesCard({ notes, facilityKey, onCreated }: { notes: StickyNoteSummary[]; facilityKey: string; onCreated: () => void }) {
  return (
    <WorkbenchCard className="h-full p-5">
      <SectionTitle title="個人工作貼" eyebrow="Personal" action="員工自建" />
      <div className="space-y-3">
        <AddResourceForm
          category="sticky_note"
          facilityKey={facilityKey}
          titlePlaceholder="個人工作貼標題"
          contentPlaceholder="提醒內容"
          onCreated={onCreated}
        />
        {notes.map((note) => (
          <div key={note.id} className="rounded-[8px] border border-[#f0dfaa] bg-[#fff9df] p-3">
            <p className="text-[13px] font-black text-[#10233f]">{note.title}</p>
            <p className="mt-1 text-[12px] font-bold leading-5 text-[#536175]">{note.content}</p>
            {note.scheduledAt ? <p className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#9a7a1d]">{formatShortDateTime(note.scheduledAt)}</p> : null}
            <p className="mt-2 text-[10px] font-bold text-[#9a7a1d]">{note.authorName || "員工"} · {note.createdAt}</p>
            <EmployeeResourceActions resourceId={note.resourceId} title={note.title} content={note.content} scheduledAt={note.scheduledAt} onChanged={onCreated} showScheduledAtField />
          </div>
        ))}
      </div>
    </WorkbenchCard>
  );
}

function CompactEventsCard({ campaigns, facilityKey, onChanged, source }: { campaigns: CampaignSummary[]; facilityKey: string; onChanged: () => void; source?: BffSection<CampaignSummary[]> }) {
  const [showComposer, setShowComposer] = useState(false);
  return (
    <WorkbenchCard className="h-full p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[#10233f]">活動檔期 / 課程快訊</h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8b9aae]">Events</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setShowComposer((current) => !current)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-[#007166] hover:bg-[#edf7f4]">
            新增快訊
            <span aria-hidden>＋</span>
          </button>
          <Link href="/employee/activity-periods" className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-[#007166] hover:bg-[#edf7f4]">
            查看更多
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
      {showComposer ? (
        <div className="mb-3">
          <AddResourceForm
            category="event"
            facilityKey={facilityKey}
            titlePlaceholder="活動檔期 / 課程名稱"
            contentPlaceholder="時間或備註"
            urlPlaceholder="報名或說明連結 https://…"
            onCreated={() => {
              setShowComposer(false);
              onChanged();
            }}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        {campaigns.length ? campaigns.slice(0, 4).map((campaign) => (
          <Link key={campaign.id} href="/employee/activity-periods" className="flex min-h-12 items-center gap-3 rounded-[8px] px-2 py-2 hover:bg-[#f7f9fb]">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#eaf8ef] text-[#15935d]">
              <CalendarDays className="h-4 w-4" />
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black text-[#10233f]">{campaign.title}</span>
              <span className="block truncate text-[11px] font-bold text-[#637185]">{campaign.effectiveRange}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${campaign.statusLabel === "即將結束" ? "bg-[#fef2f2] text-[#dc2626]" : campaign.statusLabel === "即將開始" ? "bg-[#eff6ff] text-[#2563eb]" : "bg-[#edf8f2] text-[#15935d]"}`}>{campaign.statusLabel}</span>
          </Link>
        )) : (
          <div className="rounded-[8px] bg-[#fbfcfd] px-4 py-3 text-center text-[12px] font-bold text-[#8b9aae]">
            <span>目前沒有活動快訊</span>
            {source?.updatedAt ? (
              <span className="mt-1 block text-[10px] font-bold text-[#adb9c8]">上次更新：{formatShortDateTime(source.updatedAt)}</span>
            ) : null}
          </div>
        )}
      </div>
    </WorkbenchCard>
  );
}

function CompactDocumentsCard({ documents }: { documents: DocumentSummary[] }) {
  return (
    <WorkbenchCard className="h-full p-5">
      <SectionTitle title="常用文件" eyebrow="Documents" action="查看更多" actionHref="/employee/documents" />
      <div className="space-y-2">
        {documents.length ? documents.slice(0, 4).map((doc) => {
          const className = cn(
            "flex min-h-12 items-center gap-3 rounded-[8px] px-2 py-2",
            doc.url ? "hover:bg-[#f7f9fb]" : "cursor-not-allowed opacity-70",
          );
          const content = (
            <>
              <FileText className="h-5 w-5 shrink-0 text-[#1f6fd1]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-black text-[#10233f]">{doc.title}</span>
                <span className="block truncate text-[11px] font-medium text-[#8b9aae]">{doc.description || `更新：${doc.updatedAt}`}</span>
              </span>
              {doc.url ? <ChevronRight className="h-4 w-4 shrink-0 text-[#9aa8ba]" /> : <span className="shrink-0 rounded-full bg-[#eef2f6] px-2 py-1 text-[10px] font-black text-[#637185]">未綁連結</span>}
            </>
          );
          return doc.url && isInternalHref(doc.url) ? (
            <Link key={doc.id} href={doc.url} className={className}>{content}</Link>
          ) : (
            <a
              key={doc.id}
              href={doc.url || undefined}
              target={doc.url ? "_blank" : undefined}
              rel={doc.url ? "noreferrer" : undefined}
              aria-disabled={!doc.url}
              className={className}
              onClick={(event) => {
                if (!doc.url) event.preventDefault();
              }}
            >
              {content}
            </a>
          );
        }) : (
          <div className="rounded-[8px] bg-[#fbfcfd] px-4 py-3 text-center text-[12px] font-bold text-[#8b9aae]">尚未新增常用文件。</div>
        )}
      </div>
    </WorkbenchCard>
  );
}

function StickyNoteComposer({
  facilityKey,
  notes,
  onClose,
  onCreated,
}: {
  facilityKey: string;
  notes: StickyNoteSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [portalTarget] = useState<HTMLElement | null>(() => (typeof document === "undefined" ? null : document.body));
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(quickNoteDraftKey) ?? "";
  });
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const canSubmit = draft.trim().length > 0;
  const scheduledAt = toOptionalIso(scheduledDate, scheduledTime);
  const mutation = useMutation({
    mutationFn: () => {
      const content = draft.trim();
      const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "個人工作貼";
      return createEmployeeResource({
        facilityKey,
        category: "sticky_note",
        title: firstLine.slice(0, 60),
        content,
        isPinned: true,
        scheduledAt,
      });
    },
    onSuccess: () => {
      setDraft("");
      setScheduledDate("");
      setScheduledTime("");
      setSavedMessage("已新增，可繼續記下一則。");
      if (typeof window !== "undefined") window.localStorage.removeItem(quickNoteDraftKey);
      window.setTimeout(() => setSavedMessage(""), 1800);
      onCreated();
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draft.trim()) window.localStorage.setItem(quickNoteDraftKey, draft);
    else window.localStorage.removeItem(quickNoteDraftKey);
  }, [draft]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !portalTarget) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    textareaRef.current?.focus({ preventScroll: true });

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [portalTarget]);

  const composer = (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0d1f37]/35" role="dialog" aria-modal="true" aria-label="快速新增個人工作貼">
      <button type="button" aria-label="關閉個人工作貼新增視窗" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-[51] flex h-dvh w-full max-w-[420px] shrink-0 flex-col bg-white shadow-[0_24px_60px_-24px_rgba(15,34,58,0.55)]">
        <div className="flex items-center justify-between border-b border-[#e6edf4] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-black text-[#10233f]">快速個人工作貼</h2>
            <p className="text-[12px] font-bold text-[#8b9aae]">先記下來，稍後再整理。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-[8px] bg-[#f3f6f9] text-[#637185]" aria-label="關閉">
            ×
          </button>
        </div>
        <div data-quick-note-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          <div className="rounded-[12px] border border-[#f0dfaa] bg-[#fffdf0] p-4 shadow-[0_20px_50px_-42px_rgba(15,34,58,0.4)]">
            <label className="sr-only" htmlFor="quick-note-draft">今天要記什麼</label>
            <p className="mb-2 text-[12px] font-black text-[#7a6b45]">內容</p>
            <textarea
              id="quick-note-draft"
              name="quick-note-draft"
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit && !mutation.isPending) {
                  event.preventDefault();
                  mutation.mutate();
                }
              }}
              className="min-h-[220px] w-full resize-none rounded-[10px] border border-[#eadba8] bg-white/80 p-4 text-[15px] font-bold leading-7 text-[#10233f] outline-none focus:border-[#d3b95f]"
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-[12px] font-black text-[#7a6b45]">
                日期
                <input
                  name="quick-note-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  className="min-h-10 rounded-[8px] border border-[#eadba8] bg-white px-3 text-[13px] font-bold text-[#10233f] outline-none focus:border-[#d3b95f]"
                />
              </label>
              <label className="grid gap-1 text-[12px] font-black text-[#7a6b45]">
                時間
                <input
                  name="quick-note-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                  className="min-h-10 rounded-[8px] border border-[#eadba8] bg-white px-3 text-[13px] font-bold text-[#10233f] outline-none focus:border-[#d3b95f]"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span />
              <button
                type="button"
                disabled={!canSubmit || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="min-h-10 rounded-[8px] bg-[#0d2a50] px-4 text-[12px] font-black text-white disabled:opacity-50"
              >
                {mutation.isPending ? "新增中…" : "新增個人工作貼"}
              </button>
            </div>
            {savedMessage ? <p className="mt-2 text-[12px] font-black text-[#15935d]" role="status">{savedMessage}</p> : null}
            {mutation.isError ? <p className="mt-2 text-[12px] font-bold text-[#ff4964]" role="alert">新增失敗，請確認資料庫連線後再試。</p> : null}
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-black text-[#10233f]">最近個人工作貼</h3>
            <Link href="/employee/personal-note" className="text-[12px] font-black text-[#007166]" onClick={onClose}>查看全部</Link>
          </div>
          <div className="mt-3 space-y-2">
            {notes.length ? notes.slice(0, 5).map((note) => (
              <article key={note.id} className="rounded-[10px] border border-[#f0dfaa] bg-[#fff9df] p-3">
                <p className="truncate text-[13px] font-black text-[#10233f]">{note.title}</p>
                <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-5 text-[#536175]">{note.content}</p>
                {note.scheduledAt ? <p className="mt-2 text-[11px] font-black text-[#9a7a1d]">{formatShortDateTime(note.scheduledAt)}</p> : null}
              </article>
            )) : (
              <div className="rounded-[8px] bg-[#f7f9fb] p-6 text-center text-[13px] font-bold text-[#637185]">尚未新增個人工作貼。</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );

  return portalTarget ? createPortal(composer, portalTarget) : null;
}

function CompactStickyNotesCard({ notes, facilityKey, onChanged }: { notes: StickyNoteSummary[]; facilityKey: string; onChanged: () => void }) {
  const [composerOpen, setComposerOpen] = useState(false);
  return (
    <WorkbenchCard className="h-full p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[#10233f]">個人工作貼</h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8b9aae]">Personal</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setComposerOpen(true)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-[#007166] hover:bg-[#edf7f4]">
            新增
            <span aria-hidden>＋</span>
          </button>
          <Link href="/employee/personal-note" className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-[#007166] hover:bg-[#edf7f4]">
            查看全部
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
      <div className="space-y-2">
        {notes.length ? notes.slice(0, 3).map((note) => (
          <button key={note.id} type="button" onClick={() => setComposerOpen(true)} className="block w-full rounded-[8px] border border-[#f0dfaa] bg-[#fff9df] p-3 text-left hover:bg-[#fff4c8]">
            <p className="truncate text-[13px] font-black text-[#10233f]">{note.title}</p>
            <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-5 text-[#536175]">{note.content}</p>
            {note.scheduledAt ? <p className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#9a7a1d]">{formatShortDateTime(note.scheduledAt)}</p> : null}
            <p className="mt-2 text-[10px] font-bold text-[#9a7a1d]">{note.authorName || "員工"} · {note.createdAt}</p>
          </button>
        )) : (
          <button type="button" onClick={() => setComposerOpen(true)} className="w-full rounded-[8px] bg-[#fbfcfd] px-4 py-3 text-center text-[12px] font-bold text-[#8b9aae] hover:bg-[#f3f6f9]">
            尚未新增個人工作貼。
          </button>
        )}
      </div>
      {composerOpen ? (
        <StickyNoteComposer
          facilityKey={facilityKey}
          notes={notes}
          onClose={() => setComposerOpen(false)}
          onCreated={onChanged}
        />
      ) : null}
    </WorkbenchCard>
  );
}

// ── CourtsScrollCard ─────────────────────────────────────────────────────────

function CourtsScrollCard({ schools, onOpenDrawer }: { schools: SchoolId[]; onOpenDrawer: () => void }) {
  const workDate = todayDateString();
  const xinbeiQuery = useQuery({
    queryKey: ["/api/courts/xinbei/reservations", workDate, "employee-home"],
    queryFn: () => fetchEmployeeCourtsToday("xinbei", workDate),
    staleTime: 60_000,
    retry: false,
    enabled: schools.includes("xinbei"),
  });
  const sanchongQuery = useQuery({
    queryKey: ["/api/courts/sanchong/reservations", workDate, "employee-home"],
    queryFn: () => fetchEmployeeCourtsToday("sanchong", workDate),
    staleTime: 60_000,
    retry: false,
    enabled: schools.includes("sanchong"),
  });

  const selectedSchools = schools.filter((school, index, list) => list.indexOf(school) === index);
  const queryBySchool = {
    xinbei: xinbeiQuery,
    sanchong: sanchongQuery,
  } satisfies Record<SchoolId, typeof xinbeiQuery>;

  const nowMs = Date.now();
  const parseRsvMs = (timeStr: string): number => {
    const [hStr, mStr] = timeStr.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };

  const allReservations: Array<{ school: SchoolId; reservation: EmployeeCourtReservationPreview }> = [];
  for (const school of selectedSchools) {
    for (const r of (queryBySchool[school].data ?? [])) {
      allReservations.push({ school, reservation: r });
    }
  }
  allReservations.sort((a, b) => {
    const aDiff = Math.abs(parseRsvMs(a.reservation.startTime) - nowMs);
    const bDiff = Math.abs(parseRsvMs(b.reservation.startTime) - nowMs);
    if (aDiff !== bDiff) return aDiff - bDiff;
    return a.reservation.court - b.reservation.court;
  });

  const isLoading = selectedSchools.some((s) => queryBySchool[s].isLoading);
  const primarySchool = selectedSchools[0] ?? "xinbei";

  const schoolBadgeClass: Record<SchoolId, string> = {
    xinbei: "bg-[#dbeafe] text-[#1d4ed8]",
    sanchong: "bg-[#dcfce7] text-[#15803d]",
  };

  if (!selectedSchools.length) return null;

  return (
    <WorkbenchCard className="h-full p-5">
      <SectionTitle
        title="今日場租"
        eyebrow="Courts"
        action="完整查看"
        actionHref={`/employee/courts/${primarySchool}`}
      />
      {isLoading ? (
        <div className="rounded-[8px] bg-[#f7f9fb] p-4 text-center text-[12px] font-bold text-[#8b9aae]">
          場租資料載入中…
        </div>
      ) : allReservations.length === 0 ? (
        <div className="rounded-[8px] bg-[#f7f9fb] p-4 text-center text-[12px] font-bold text-[#8b9aae]">
          今日尚無場租紀錄。
        </div>
      ) : (
        <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d4dde8]">
          <div className="flex gap-3" style={{ minWidth: "max-content" }}>
            {allReservations.map(({ school, reservation }) => (
              <Link
                key={`${school}-${reservation.id ?? reservation.court}-${reservation.startTime}`}
                href={`/employee/courts/${school}?date=${reservation.date}`}
                className="workbench-focus flex w-[148px] shrink-0 flex-col justify-between rounded-[10px] border border-[#e3eaf2] bg-white p-3 shadow-[0_1px_4px_rgba(15,34,58,0.07)] transition hover:border-[#b6d0f5] hover:bg-[#f3f8ff]"
                data-testid={`card-court-rsv-${school}-${reservation.id ?? reservation.court}-${reservation.startTime}`}
              >
                <span className={cn("mb-2 self-start rounded-full px-2 py-0.5 text-[10px] font-black", schoolBadgeClass[school])}>
                  {getSchoolName(school)}
                </span>
                <p className="line-clamp-2 text-[13px] font-black leading-snug text-[#10233f]">
                  {reservation.customerName || "未命名場租"}
                </p>
                <p className="mt-1 truncate text-[11px] font-bold text-[#637185]">
                  {getCourtName(reservation.court)}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-bold text-[#8b9aae]">
                  {reservation.serviceName || "一般場租"}
                </p>
                <span className="mt-2 font-mono text-[12px] font-black tabular-nums text-[#007166]">
                  {reservation.startTime}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="text-[12px] font-black text-[#007166] hover:underline"
          data-testid="button-courts-open-drawer"
        >
          依學校分類查看 →
        </button>
        <span className="text-[11px] font-bold text-[#8b9aae]">{allReservations.length} 筆今日場租</span>
      </div>
    </WorkbenchCard>
  );
}

// ── CourtsDetailDrawer ────────────────────────────────────────────────────────

function CourtsDetailDrawer({
  open,
  schools,
  onClose,
}: {
  open: boolean;
  schools: SchoolId[];
  onClose: () => void;
}) {
  const workDate = todayDateString();
  const xinbeiQuery = useQuery({
    queryKey: ["/api/courts/xinbei/reservations", workDate, "courts-drawer"],
    queryFn: () => fetchEmployeeCourtsToday("xinbei", workDate),
    staleTime: 60_000,
    retry: false,
    enabled: open && schools.includes("xinbei"),
  });
  const sanchongQuery = useQuery({
    queryKey: ["/api/courts/sanchong/reservations", workDate, "courts-drawer"],
    queryFn: () => fetchEmployeeCourtsToday("sanchong", workDate),
    staleTime: 60_000,
    retry: false,
    enabled: open && schools.includes("sanchong"),
  });

  if (!open) return null;

  const todayDay = new Date().getDate();
  const queryBySchool = {
    xinbei: xinbeiQuery,
    sanchong: sanchongQuery,
  } satisfies Record<SchoolId, typeof xinbeiQuery>;

  const schoolHeaderClass: Record<SchoolId, string> = {
    xinbei: "bg-[#1d4ed8] text-white",
    sanchong: "bg-[#15803d] text-white",
  };

  const selectedSchools = schools.filter((school, index, list) => list.indexOf(school) === index);
  const primarySchool = selectedSchools[0] ?? "xinbei";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0d1f37]/35" role="dialog" aria-modal="true" aria-label="場租查看">
      <button type="button" aria-label="關閉場租" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[400px] flex-col bg-white shadow-[0_24px_60px_-24px_rgba(15,34,58,0.55)]">
        <div className="flex items-center justify-between border-b border-[#e6edf4] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-black text-[#10233f]">今日場租</h2>
            <p className="mt-0.5 text-[12px] font-bold text-[#637185]">依學校場地分類</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] bg-[#f3f6f9] text-[20px] text-[#536175]"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {selectedSchools.map((school) => {
            const q = queryBySchool[school];
            const nowMsD = Date.now();
            const parseRsvMsD = (timeStr: string): number => {
              const [hStr, mStr] = timeStr.split(":");
              const h = parseInt(hStr, 10); const m = parseInt(mStr, 10);
              if (Number.isNaN(h) || Number.isNaN(m)) return 0;
              const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime();
            };
            const rsvs = (q.data ?? []).slice().sort((a, b) => {
              const aDiff = Math.abs(parseRsvMsD(a.startTime) - nowMsD);
              const bDiff = Math.abs(parseRsvMsD(b.startTime) - nowMsD);
              if (aDiff !== bDiff) return aDiff - bDiff;
              return a.court - b.court;
            });
            return (
              <div key={school}>
                <div className={cn("mb-3 flex items-center justify-between rounded-[8px] px-3 py-2", schoolHeaderClass[school])}>
                  <span className="text-[14px] font-black">{getSchoolName(school)}場租</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-[18px] font-black">
                    {todayDay}
                  </span>
                </div>
                {q.isLoading ? (
                  <div className="rounded-[8px] bg-[#f7f9fb] p-3 text-center text-[12px] font-bold text-[#8b9aae]">載入中…</div>
                ) : q.isError ? (
                  <div className="rounded-[8px] border border-[#ffd7dd] bg-[#fff5f6] p-3 text-[12px] font-bold text-[#d7334f]">資料暫時無法載入。</div>
                ) : rsvs.length === 0 ? (
                  <div className="rounded-[8px] bg-[#f7f9fb] p-3 text-center text-[12px] font-bold text-[#8b9aae]">今日尚無場租。</div>
                ) : (
                  <div className="space-y-2">
                    {rsvs.map((r) => (
                      <div
                        key={`${r.id ?? r.court}-${r.startTime}`}
                        className="flex items-center justify-between gap-3 rounded-[8px] border border-[#e3eaf2] bg-[#fbfcfd] px-3 py-2"
                        data-testid={`drawer-court-rsv-${school}-${r.id ?? r.court}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-[#10233f]">{r.customerName || "未命名場租"}</p>
                          <p className="mt-0.5 truncate text-[11px] font-bold text-[#637185]">
                            {getCourtName(r.court)} · {r.serviceName || "一般場租"}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[12px] font-black tabular-nums text-[#007166]">
                          {r.startTime}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[#e6edf4] p-4">
          <Link
            href={`/employee/courts/${primarySchool}`}
            className="workbench-focus inline-flex min-h-9 items-center justify-center rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white"
            data-testid="link-courts-full-page"
          >
            完整查看
          </Link>
          <Link
            href={`/employee/courts/${primarySchool}/search`}
            className="workbench-focus inline-flex min-h-9 items-center justify-center rounded-[8px] bg-[#edf7f4] px-3 text-[12px] font-black text-[#007166]"
            data-testid="link-courts-search"
          >
            搜尋場租
          </Link>
        </div>
      </aside>
    </div>
  );
}

function TodayTutoringCard() {
  return (
    <WorkbenchCard className="h-full border-[#e3eaf2] bg-[#fbfcfd] p-5 opacity-80">
      <SectionTitle title="今日家教預約" eyebrow="Tutoring" showAction={false} />
      <div className="rounded-[8px] border border-dashed border-[#d9e2ec] bg-white/55 p-3 text-[#9aa7b8]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black">今日</p>
            <p className="mt-1 text-[24px] font-black tabular-nums">0</p>
            <p className="text-[11px] font-bold">筆預約</p>
          </div>
          <span className="rounded-full border border-[#d9e2ec] bg-[#f7f9fb] px-2 py-1 text-[10px] font-black text-[#9aa7b8]">
            即將加入
          </span>
        </div>

        <div className="mt-3 space-y-2">
          <div className="text-[10px] font-mono font-black text-[#b3bfcc]">10:00-11:00</div>
          <div className="rounded-[8px] bg-[#f4f7fa] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-black text-[#a8b4c3]">教練課程</span>
              <span className="text-[12px] font-bold text-[#b3bfcc]">一對多家教</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2].map((item) => (
                <span key={item} className="grid h-7 w-7 place-items-center rounded-full bg-[#e6ebf1] text-[#b3bfcc]">
                  <GraduationCap className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] font-bold leading-5 text-[#a8b4c3]">家教預約模組規劃中；正式開放後會依時間排序顯示教練、課程比例與學生簽到狀態。</p>
    </WorkbenchCard>
  );
}

const formatShiftClock = (value?: string) => {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatBoardDateHeader = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" }).format(parsed);
};

const getShiftPeriodLabel = (start?: string) => {
  if (!start) return "班次";
  const hour = new Date(start).getHours();
  if (Number.isNaN(hour)) return "班次";
  if (hour < 11) return "早班";
  if (hour < 16) return "午班";
  return "晚班";
};

const fmtShiftHHMM = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const SHIFT_ROLE_PRIORITY = ["櫃台", "救生", "救生員", "守望", "教練", "PT", "pt", "主管"];

type ShiftPersonWithTime = {
  userId: string;
  name: string;
  role: string;
  isCurrentUser: boolean;
  startTime: string;
  endTime: string;
  isCurrent: boolean;
  isFuture: boolean;
};

function buildShiftPeriodGroups(
  shifts: ShiftBoardDto["shifts"],
): Array<{ label: string; byRole: Map<string, ShiftPersonWithTime[]> }> {
  const early = new Map<string, ShiftPersonWithTime[]>();
  const late = new Map<string, ShiftPersonWithTime[]>();
  const seen = new Set<string>();
  const sorted = [...shifts].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const shift of sorted) {
    // Task #95: use explicit period from API first; early/mid → 早班, late → 晚班
    // fallback to time-based heuristic when period is absent
    const hour = new Date(shift.start).getHours();
    const bucket =
      shift.period === "early" || shift.period === "mid"
        ? early
        : shift.period === "late"
          ? late
          : hour < 14
            ? early
            : late;
    const st = fmtShiftHHMM(shift.start);
    const et = fmtShiftHHMM(shift.end);
    for (const p of shift.people) {
      if (seen.has(p.userId)) continue;
      seen.add(p.userId);
      const person: ShiftPersonWithTime = { ...p, startTime: st, endTime: et, isCurrent: shift.isCurrent, isFuture: shift.isFuture };
      const arr = bucket.get(p.role) ?? [];
      arr.push(person);
      bucket.set(p.role, arr);
    }
  }
  const sortRoles = (m: Map<string, ShiftPersonWithTime[]>) =>
    new Map<string, ShiftPersonWithTime[]>(
      Array.from(m.entries()).sort(([a], [b]) => {
        const ai = SHIFT_ROLE_PRIORITY.indexOf(a);
        const bi = SHIFT_ROLE_PRIORITY.indexOf(b);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      }),
    );
  const groups: Array<{ label: string; byRole: Map<string, ShiftPersonWithTime[]> }> = [];
  if (early.size) groups.push({ label: "早班", byRole: sortRoles(early) });
  if (late.size) groups.push({ label: "晚班", byRole: sortRoles(late) });
  return groups;
}

const ROLE_TAG_STYLES: Record<string, string> = {
  救生員: "bg-[#e6f0ff] text-[#2a5fd1]",
  PT: "bg-[#efe6ff] text-[#7a3fcf]",
  pt: "bg-[#efe6ff] text-[#7a3fcf]",
  教練: "bg-[#ffe9d6] text-[#c0651a]",
  櫃台: "bg-[#e1f5ee] text-[#127558]",
  主管: "bg-[#fff2cf] text-[#8a6510]",
};
const roleTagClass = (role: string) =>
  ROLE_TAG_STYLES[role] ?? ROLE_TAG_STYLES[role.toLowerCase()] ?? "bg-[#eef2f6] text-[#637185]";

const AVATAR_PALETTE = [
  "bg-[#fde2e4] text-[#9a1f3a]",
  "bg-[#fde9c9] text-[#8a5a12]",
  "bg-[#e6f3d4] text-[#3f6c12]",
  "bg-[#d4ecff] text-[#1d4e8c]",
  "bg-[#e7defb] text-[#5b3aa8]",
  "bg-[#ffe1f0] text-[#a32873]",
  "bg-[#d4f1e8] text-[#0f6b54]",
];
const avatarToneClass = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const formatRemainingHours = (now: number, endIso: string) => {
  const end = Date.parse(endIso);
  if (!Number.isFinite(end)) return null;
  const ms = end - now;
  if (ms <= 0) return null;
  const hours = ms / (60 * 60 * 1000);
  if (hours >= 1) return `${Math.round(hours)}`;
  const minutes = Math.max(1, Math.round(ms / (60 * 1000)));
  return `${minutes}m`;
};

// ── Shift board helpers ──────────────────────────────────────────────────────

type FlatShiftPerson = {
  userId: string;
  name: string;
  role: string;
  isCurrentUser: boolean;
  start: string;
  end: string;
  isCurrent: boolean;
  isFuture: boolean;
};

function flattenShiftPeople(shifts: ShiftBoardDto["shifts"]): FlatShiftPerson[] {
  const byId = new Map<string, FlatShiftPerson>();
  // Priority: active (isCurrent) > upcoming (isFuture) > finished
  const priority = (p: Pick<FlatShiftPerson, "isCurrent" | "isFuture">) =>
    p.isCurrent ? 2 : p.isFuture ? 1 : 0;
  for (const s of shifts) {
    for (const p of s.people) {
      const existing = byId.get(p.userId);
      const candidate: FlatShiftPerson = { ...p, start: s.start, end: s.end, isCurrent: s.isCurrent, isFuture: s.isFuture };
      if (!existing || priority(candidate) > priority(existing)) {
        byId.set(p.userId, candidate);
      }
    }
  }
  return Array.from(byId.values());
}

function getBoardActivePeriod(shifts: ShiftBoardDto["shifts"], nowMs: number): string {
  const sorted = [...shifts].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const firstEvening = sorted.find((s) => new Date(s.start).getHours() >= 14);
  if (!firstEvening) return "早班";
  return nowMs >= Date.parse(firstEvening.start) ? "晚班" : "早班";
}

function classifyShiftRole(role: string): "counter" | "lifeguard" | "other" {
  if (role === "櫃台") return "counter";
  if (role.includes("救生")) return "lifeguard";
  return "other";
}

type PersonWithStatus = { person: FlatShiftPerson; status: "active" | "upcoming" | "finished" };

function ShiftRoleBlock({
  label,
  labelClass,
  people,
}: {
  label: string;
  labelClass: string;
  people: PersonWithStatus[];
}) {
  if (!people.length) return null;
  return (
    <div>
      <p className={cn("mb-2", labelClass)}>{label}</p>
      <div className="space-y-1.5">
        {people.map(({ person, status }) => (
          <div key={person.userId} className="flex items-center gap-2" data-testid={`row-shift-person-${person.userId}`}>
            <span
              className={cn(
                "text-[16px] font-bold leading-snug",
                status === "finished" ? "text-[#c8d3de]" : "text-[#10233f]",
              )}
            >
              {person.name}
            </span>
            {status === "active" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-2 py-0.5 text-[10px] font-black text-[#15935d]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#15935d]" />
                上班中
              </span>
            )}
            {status === "finished" && (
              <span className="text-[10px] font-bold text-[#c8d3de]">已結束</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ShiftBoardCard ───────────────────────────────────────────────────────────

function ShiftBoardCard({ board }: { board?: ShiftBoardDto }) {
  const shifts = board?.shifts ?? [];
  const dateLabel = formatBoardDateHeader(board?.date);
  const facilityName = board?.facility?.name ?? "";
  const headerSubtitle = [facilityName, dateLabel].filter(Boolean).join(" · ");
  const lastSyncLabel = board?.sourceStatus.lastSyncedAt
    ? new Date(board.sourceStatus.lastSyncedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  const periodGroups = buildShiftPeriodGroups(shifts);
  const earlyGroup = periodGroups.find((g) => g.label === "早班");
  const lateGroup = periodGroups.find((g) => g.label === "晚班");

  const renderPeriodCol = (
    group: ReturnType<typeof buildShiftPeriodGroups>[0] | undefined,
    label: string,
  ) => {
    const allPeople = group ? Array.from(group.byRole.values()).flat() : [];
    return (
      <div className="min-w-0 flex-1">
        <p className="mb-3 text-[22px] font-black leading-none tracking-tight text-[#15935d]">{label}</p>
        {allPeople.length === 0 ? (
          <p className="text-[12px] font-bold text-[#8b9aae]">今日無{label}</p>
        ) : (
          <div className="space-y-2.5">
            {allPeople.map((person) => (
              <div
                key={person.userId}
                className="flex items-baseline justify-between gap-2"
                data-testid={`row-shift-person-${person.userId}`}
              >
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[15px] font-bold leading-snug",
                      person.isCurrent || person.isFuture ? "text-[#10233f]" : "text-[#a8b5c5]",
                    )}
                  >
                    {person.name}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-[#8b9aae]">{person.role}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-[#637185]">
                  {person.startTime}–{person.endTime}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <WorkbenchCard className="flex h-full flex-col overflow-hidden p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[16px] font-black text-[#10233f]">今日班表</h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b9aae]">SHIFT</span>
          </div>
          {headerSubtitle ? (
            <p className="mt-1 text-[12px] font-bold text-[#8b9aae]" data-testid="text-shift-board-subtitle">{headerSubtitle}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8b9aae]">本日</p>
          <p className="text-[18px] font-black leading-none text-[#10233f]" data-testid="text-shift-board-total">
            {board?.totalCount ?? 0} <span className="text-[12px] font-bold text-[#637185]">人</span>
          </p>
        </div>
      </div>

      {/* Body */}
      {!board ? (
        <NotConnectedCard title="今日班表" reason="external_pending" />
      ) : !board.sourceStatus.connected ? (
        <DegradedCard title="今日班表" />
      ) : shifts.length === 0 ? (
        <div className="rounded-[10px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">今日尚無班表</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex gap-5">
            {renderPeriodCol(earlyGroup, "早班")}
            <div className="w-px shrink-0 self-stretch bg-[#f0f4f8]" />
            {renderPeriodCol(lateGroup, "晚班")}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex shrink-0 items-center justify-between border-t border-[#f0f4f8] pt-2 text-[11px]">
        <span className="font-bold text-[#8b9aae]">
          {lastSyncLabel ? `最後同步 ${lastSyncLabel}` : "尚未同步"}
        </span>
        <Link
          href="/employee/shift"
          className="font-black text-[#007166] hover:underline"
          data-testid="link-shift-view-all"
        >
          前往完整班表 →
        </Link>
      </div>
    </WorkbenchCard>
  );
}

function BottomNav() {
  const [location] = useLocation();
  const trackEvent = useTrackEvent();
  const navigation = useQuery({
    queryKey: ["/api/modules/navigation", "employee-home-mobile-nav"],
    queryFn: fetchModuleNavigation,
    staleTime: 60_000,
  });
  const items = toEmployeeNavigationItems(navigation.data?.items).slice(0, 5);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e5ecf3] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
      {!items.length && navigation.isLoading ? (
        <div className="col-span-5 rounded-[8px] bg-[#f7f9fb] px-3 py-3 text-center text-[12px] font-bold text-[#637185]">導覽載入中…</div>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/employee" ? location === "/employee" || location === "/EMPLOYEE" : location.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
            className={cn("workbench-focus flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-black", active ? "bg-[#eef5ff] text-[#1f6fd1]" : "text-[#6c7a8e]")}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f4f7fb] p-6">
      <div className="w-full max-w-sm rounded-[8px] bg-white px-5 py-4 shadow-lg">
        <DreamLoader compact label="Dreams 工作台資料載入中" />
      </div>
    </div>
  );
}

function EmployeeHomeContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [handoverDrawerOpen, setHandoverDrawerOpen] = useState(false);
  const [courtsDrawerOpen, setCourtsDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/bff/employee/home"],
    queryFn: fetchEmployeeHome,
    refetchInterval: 60_000,
  });
  const layoutItems = useMemo(() => normalizeWidgetLayout(data?.layout?.data, defaultEmployeeHomeWidgets), [data?.layout?.data]);
  const homeSlots = useMemo(() => resolveEmployeeHomeSlots(layoutItems), [layoutItems]);
  const courtSchools = useMemo(() => getEmployeeCourtSchoolsForFacility(data?.facility.key, data?.facility.name), [data?.facility.key, data?.facility.name]);
  const handoverPayload = isHandoverHomePayload(data?.homeCards?.handover.payload) ? data?.homeCards?.handover.payload : undefined;
  const shiftBoard = isShiftBoardPayload(data?.homeCards?.shiftReminder.payload) ? data?.homeCards?.shiftReminder.payload : undefined;
  const searchQueryResult = useQuery({
    queryKey: ["/api/bff/employee/search", data?.facility.key, searchQuery],
    queryFn: () => searchEmployeeWorkbench(searchQuery, data?.facility.key),
    enabled: Boolean(data?.facility.key && searchQuery.trim().length >= 2),
  });

  if (isLoading) return <LoadingState />;

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f4f7fb] p-6">
        <WorkbenchCard className="w-full max-w-md p-6 text-center">
          <Gauge className="mx-auto h-10 w-10 text-[#ef7d22]" />
          <h1 className="mt-4 text-[20px] font-black text-[#10233f]">工作台暫時無法載入</h1>
          <p className="mt-2 text-[14px] text-[#637185]">BFF 資料來源尚未回應，請稍後再試。</p>
        </WorkbenchCard>
      </div>
    );
  }

  return (
    <div className="workbench-shell h-dvh overflow-hidden bg-[#f3f6fb]">
      <div className="flex h-full min-w-0">
        <DesktopSidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-6 pb-24 sm:px-6 md:px-6 md:py-7">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="mx-auto max-w-[1760px] space-y-4">
              <motion.div variants={riseIn}>
                {homeSlots.isEnabled("search") ? (
                  <Hero
                    home={data}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    searchResults={searchQueryResult.data?.items ?? []}
                    isSearching={searchQueryResult.isFetching}
                  />
                ) : null}
              </motion.div>
              <motion.div variants={riseIn} className="grid items-stretch gap-4 lg:grid-cols-12">
                {homeSlots.isEnabled("handover") ? (
                  <div className="h-full lg:col-span-4">
                    <HandoverCard
                      handovers={data.handover.data ?? []}
                      payload={handoverPayload}
                      onOpenDrawer={() => setHandoverDrawerOpen(true)}
                    />
                  </div>
                ) : null}
                {homeSlots.isEnabled("tutoringToday") ? (
                  <div className="h-full lg:col-span-3">
                    <TodayTutoringCard />
                  </div>
                ) : null}
                {homeSlots.isEnabled("announcements") ? (
                  <div className="h-full lg:col-span-5">
                    <AnnouncementCard announcements={data.announcements.data ?? []} source={data.announcements} />
                  </div>
                ) : null}
              </motion.div>
              <motion.div variants={riseIn} className="grid items-stretch gap-4 lg:grid-cols-12">
                {homeSlots.isEnabled("shifts") ? (
                  <div className="h-full lg:col-span-5">
                    <ShiftBoardCard board={shiftBoard} />
                  </div>
                ) : null}
                {homeSlots.isEnabled("events") ? (
                  <div className="h-full lg:col-span-3">
                    <CompactEventsCard
                      campaigns={data.campaigns.data ?? []}
                      facilityKey={data.facility.key}
                      onChanged={() => queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] })}
                      source={data.campaigns}
                    />
                  </div>
                ) : null}
                {homeSlots.isEnabled("documents") ? (
                  <div className="h-full lg:col-span-4">
                    <CompactDocumentsCard documents={data.documents.data ?? []} />
                  </div>
                ) : null}
              </motion.div>
              <motion.div variants={riseIn} className="grid items-stretch gap-4 lg:grid-cols-12">
                {homeSlots.isEnabled("courts") && courtSchools.length ? (
                  <div className="h-full lg:col-span-8">
                    <CourtsScrollCard schools={courtSchools} onOpenDrawer={() => setCourtsDrawerOpen(true)} />
                  </div>
                ) : null}
                {homeSlots.isEnabled("stickyNotes") ? (
                  <div className="h-full lg:col-span-4">
                    <CompactStickyNotesCard
                      notes={data.stickyNotes.data ?? []}
                      facilityKey={data.facility.key}
                      onChanged={() => queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] })}
                    />
                  </div>
                ) : null}
              </motion.div>
              {homeSlots.enabledKeys.size === 0 ? (
                <motion.div variants={riseIn}>
                  <WorkbenchCard className="p-6 text-center">
                    <p className="text-[15px] font-black text-[#10233f]">目前沒有啟用的首頁模組</p>
                    <p className="mt-1 text-[12px] font-bold text-[#637185]">可到員工設定重新啟用首頁卡片。</p>
                    <Link href="/employee/settings" className="mt-4 inline-flex min-h-9 items-center justify-center rounded-[8px] bg-[#0d2a50] px-4 text-[12px] font-black text-white">
                      開啟員工設定
                    </Link>
                  </WorkbenchCard>
                </motion.div>
              ) : null}
            </motion.div>
          </main>
        </div>
      </div>
      <FloatingQuickActionsPanel eyebrow="Employee Actions" title="員工快捷操作" items={employeeHomeQuickActions} tone="blue" />
      <BottomNav />
      <HandoverDrawer
        open={handoverDrawerOpen}
        facilityKey={data.facility.key}
        items={handoverPayload?.items ?? []}
        onClose={() => setHandoverDrawerOpen(false)}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
          queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/handover/list"] });
        }}
      />
      <CourtsDetailDrawer
        open={courtsDrawerOpen}
        schools={courtSchools}
        onClose={() => setCourtsDrawerOpen(false)}
      />
    </div>
  );
}

export default function EmployeeHomePage() {
  return (
    <FacilityGate
      role="employee"
      title="選擇今日工作場館"
      subtitle="員工端會先確認 activeFacility，確認後才載入今日班表、交辦、公告與日誌資料。"
    >
      <EmployeeHomeContent />
    </FacilityGate>
  );
}
