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
  GraduationCap,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  FileText,
  Gauge,
  GripVertical,
  Home,
  Link as LinkIcon,
  ListChecks,
  Menu,
  MessageSquareText,
  PlusCircle,
  Plus,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  UserRound,
  Wrench,
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
  ShortcutSummary,
  StickyNoteSummary,
  TaskSummary,
} from "@shared/domain/workbench";
import type { NavigationModuleDto } from "@shared/modules";
import { defaultEmployeeHomeWidgets, normalizeWidgetLayout } from "@shared/domain/layout";
import { Link, useLocation } from "wouter";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { BrandLockup, BrandMark } from "@/shared/brand";
import { riseIn, staggerContainer } from "@/shared/motion/tokens";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import {
  createEmployeeResource,
  createEmployeeFrontDeskHandover,
  completeEmployeeFrontDeskHandover,
  deleteEmployeeFrontDeskHandover,
  fetchEmployeeHome,
  readEmployeeFrontDeskHandover,
  replyEmployeeFrontDeskHandover,
  searchEmployeeWorkbench,
  type EmployeeSearchResultDTO,
} from "./api";
import { EmployeeResourceActions } from "@/modules/employee/resources/employee-resource-actions";
import { cn } from "@/lib/utils";
import { facilityConfigs } from "@/config/facility-configs";
import { useAuthMe, useSwitchFacility } from "@/shared/auth/session";
import { fetchModuleNavigation } from "@/shared/modules/api";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";

const shortcutIcons = {
  blue: ClipboardCheck,
  green: FileText,
  amber: CheckCircle2,
  violet: CalendarDays,
  rose: Wrench,
  cyan: FileText,
};

const shortcutIconsById: Record<string, LucideIcon> = {
  clock: ClipboardCheck,
  handover: MessageSquareText,
  announcements: Bell,
  events: CalendarDays,
  documents: FileText,
  "sticky-notes": StickyNote,
  qna: BookOpen,
};

const getShortcutIcon = (shortcut: ShortcutSummary) =>
  shortcutIconsById[shortcut.id] ?? shortcutIcons[shortcut.tone];

const toneClass: Record<ShortcutSummary["tone"], string> = {
  blue: "bg-white/55 text-[#1f6fd1]",
  green: "bg-white/55 text-[#15935d]",
  amber: "bg-white/55 text-[#d27a16]",
  violet: "bg-white/55 text-[#6947d8]",
  rose: "bg-white/55 text-[#db4b5a]",
  cyan: "bg-white/55 text-[#1487a8]",
};

const shortcutSurfaceClass: Record<ShortcutSummary["tone"], string> = {
  blue: "border-[#c8ddf8] bg-[#eef6ff] hover:border-[#95bee9] hover:bg-[#e4f1ff]",
  green: "border-[#bfe7d2] bg-[#eaf8f0] hover:border-[#8ed5ae] hover:bg-[#def3e9]",
  amber: "border-[#efd5a5] bg-[#fff2d7] hover:border-[#e0b660] hover:bg-[#ffe9c4]",
  violet: "border-[#d1c6fb] bg-[#efeaff] hover:border-[#aa98ef] hover:bg-[#e8e0ff]",
  rose: "border-[#efc6cc] bg-[#ffedf0] hover:border-[#e497a4] hover:bg-[#ffe1e6]",
  cyan: "border-[#bfe5ee] bg-[#e8f9fc] hover:border-[#8ccfdd] hover:bg-[#dcf4fa]",
};

const shortcutToneOptions: ShortcutSummary["tone"][] = ["blue", "green", "amber", "violet", "rose", "cyan"];
const shortcutPreferenceKey = "junsi.cms.employee.quick-actions.v4";
const quickNoteDraftKey = "junsi.cms.employee.quick-note-draft.v1";
const shortcutLimit = 7;

const toOptionalIso = (date: string, time: string) => {
  if (!date) return undefined;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const shortcutCandidates: ShortcutSummary[] = [
  { id: "handover", label: "交辦事項", href: "/employee/handover", tone: "green" },
  { id: "announcements", label: "群組公告", href: "/employee/announcements", tone: "violet" },
  { id: "events", label: "活動檔期", href: "/employee/activity-periods", tone: "amber" },
  { id: "documents", label: "常用文件", href: "/employee/documents", tone: "cyan" },
  { id: "sticky-notes", label: "個人工作記事", href: "/employee/personal-note", tone: "rose" },
  { id: "qna", label: "相關問題詢問", href: "/employee/qna", tone: "violet" },
];

const normalizeActionableShortcuts = (shortcuts: ShortcutSummary[]) =>
  shortcuts
    .filter((shortcut) => {
      const href = shortcut.href?.trim();
      if (!href || href.startsWith("#")) return false;
      if (shortcut.id === "more" || shortcut.id === "checkins" || href === "/employee/more") return false;
      return true;
    })
    .slice(0, shortcutLimit);

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

const employeeNavigationSlots: Array<{
  ids: string[];
  label: string;
  href: string;
  iconKey: string;
}> = [
  { ids: ["employee-home", "dashboard"], label: "首頁", href: "/employee", iconKey: "home" },
  { ids: ["handover"], label: "櫃台交接", href: "/employee/handover", iconKey: "message-square-text" },
  { ids: ["activity-periods", "campaigns-events"], label: "活動檔期/課程快訊", href: "/employee/activity-periods", iconKey: "calendar-days" },
  { ids: ["employee-resources", "quick-links"], label: "常用文件", href: "/employee/documents", iconKey: "file-text" },
  { ids: ["employee-training"], label: "員工教材", href: "/employee/training", iconKey: "graduation-cap" },
  { ids: ["personal-note"], label: "個人工作記事", href: "/employee/personal-note", iconKey: "file-text" },
  { ids: ["knowledge-base-qna"], label: "相關問題詢問", href: "/employee/qna", iconKey: "book-open" },
];

const toEmployeeNavigationItems = (items: NavigationModuleDto[] | undefined): EmployeeNavigationItem[] => {
  const apiItems = (items ?? []).filter((item) => item.routePath.startsWith("/employee"));
  const sourceById = new Map(apiItems.map((item) => [item.id, item]));
  return employeeNavigationSlots
    .map((slot) => {
      const source = slot.ids.map((id) => sourceById.get(id)).find(Boolean);
      return {
        id: source?.id ?? slot.ids[0],
        label: slot.label,
        icon: iconByKey[source?.iconKey ?? slot.iconKey] ?? iconByKey[slot.iconKey] ?? Home,
        href: slot.href,
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
  const navigation = useQuery({
    queryKey: ["/api/modules/navigation", "employee-home-sidebar"],
    queryFn: fetchModuleNavigation,
    staleTime: 60_000,
  });
  const items = toEmployeeNavigationItems(navigation.data?.items);
  return (
    <aside className="hidden h-full min-h-0 w-[232px] shrink-0 flex-col bg-[#1f3f68] p-5 text-white shadow-[20px_0_40px_-32px_rgba(13,31,55,0.7)] lg:flex">
      <BrandLockup markClassName="h-10 w-10 rounded-[8px]" titleClassName="text-[18px] text-white" />

      <div className="mt-6 rounded-[8px] bg-white/8 p-3">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[#9dd84f]">
          <span className="h-2 w-2 rounded-full bg-[#9dd84f]" />
          營運中
        </div>
        <p className="line-clamp-2 text-[13px] font-bold">新北高中游泳池 & 運動中心</p>
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {!items.length && navigation.isLoading ? (
          <div className="rounded-[8px] bg-white/8 px-3 py-3 text-[12px] font-bold text-[#d6e2ef]">導覽載入中…</div>
        ) : null}
        {items.map((item) => {
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
  const activeFacility = session?.activeFacility ?? granted[0] ?? "xinbei_pool";
  const activeFacilityName = facilityConfigs[activeFacility]?.facilityName ?? activeFacility;
  return (
    <header className="z-20 shrink-0 border-b border-[#dfe7ef] bg-[#0d2a50] text-white lg:bg-white/90 lg:text-[#10233f] lg:backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between px-4 lg:h-14 lg:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <button aria-label="開啟選單" className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10">
            <Menu className="h-5 w-5" />
          </button>
          <BrandMark className="h-8 w-8 rounded-[8px]" />
          <p className="text-[15px] font-black">駿斯 CMS</p>
        </div>
        <label className="relative hidden min-w-0 cursor-pointer items-center gap-3 rounded-[8px] px-1 py-1 transition hover:bg-[#f5f8fb] lg:flex">
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
                <option key={facilityKey} value={facilityKey}>{facilityConfigs[facilityKey]?.facilityName ?? facilityKey}</option>
              ))}
            </select>
          ) : null}
        </label>
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <RoleSwitcher visualActiveRole="employee" />
          </div>
          <button className="workbench-focus hidden min-h-9 items-center rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] lg:inline-flex">
            員工
          </button>
          <button aria-label="通知" className="workbench-focus relative grid h-10 w-10 place-items-center rounded-full bg-white/10 lg:bg-[#f0f4f8] lg:text-[#10233f]">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#ff4964] text-[9px] font-black text-white">4</span>
          </button>
          <button aria-label="員工帳號" className="workbench-focus grid h-9 w-9 place-items-center rounded-full bg-[#32d17c] text-[13px] font-black text-white">{session?.displayName?.slice(0, 1) || "陳"}</button>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-2 lg:hidden">
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
      <div className="rounded-[8px] border border-[#dfe7ef] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(15,34,58,0.45)]">
        <div className="flex items-center gap-3">
          <CloudSun className="h-10 w-10 text-[#ffc340]" />
          <div>
            <p className="text-[26px] font-black text-[#10233f]">{home.weather.data?.temperatureC ?? "--"}°C</p>
            <p className="text-[12px] font-bold text-[#637185]">{home.weather.data?.label ?? "資料暫不可用"}</p>
            <p className="text-[11px] text-[#8b9aae]">濕度 {home.weather.data?.humidity ?? "--"}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksCard({ tasks }: { tasks: TaskSummary[] }) {
  const activeTasks = tasks.filter((task) => task.status !== "done");
  return (
    <WorkbenchCard className="p-5">
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
        <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">目前沒有待辦任務。</div>
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
    <WorkbenchCard className="p-5">
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
        <div className="flex min-h-[170px] flex-col items-center justify-center rounded-[8px] bg-[#f7f9fb] px-4 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#6d7c90] shadow-sm">
            <MessageSquareText className="h-7 w-7" />
          </div>
          <p className="mt-4 text-[16px] font-black text-[#10233f]">尚未設定交辦事項</p>
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

function AnnouncementCard({ announcements }: { announcements: AnnouncementSummary[] }) {
  return (
    <WorkbenchCard tone="navy" className="p-5">
      <SectionTitle title="群組重要公告" eyebrow="Must Read" action="查看全部" actionHref="/employee/announcements" dark />
      <div className="space-y-3">
        {announcements.map((item) => (
          <button key={item.id} className="flex min-h-[68px] w-full items-center gap-3 rounded-[8px] bg-white p-3 text-left text-[#10233f]">
            <Bell className="h-5 w-5 shrink-0 text-[#2f6fe8]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black">{item.title}</p>
              <p className="mt-1 truncate text-[11px] font-medium text-[#64748b]">{item.effectiveRange}</p>
            </div>
            <span className={cn("rounded-[4px] px-1.5 py-0.5 text-[10px] font-black", item.priority === "required" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#fff1e7] text-[#ef7d22]")}>
              {item.priority === "required" ? "重要" : "提醒"}
            </span>
          </button>
        ))}
        <button className="min-h-11 w-full rounded-[8px] bg-white/12 text-[13px] font-black text-white">查看所有公告</button>
      </div>
    </WorkbenchCard>
  );
}

const isShortcutTone = (value: unknown): value is ShortcutSummary["tone"] =>
  typeof value === "string" && shortcutToneOptions.includes(value as ShortcutSummary["tone"]);

const normalizeShortcutHref = (href: string | undefined, fallback: string) => {
  const value = href?.trim();
  if (!value) return fallback;
  if (value.startsWith("/employee") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("#")) {
    return value;
  }
  return fallback;
};

const readShortcutPreference = (): ShortcutSummary[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(shortcutPreferenceKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((item): item is ShortcutSummary =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.href === "string" &&
        isShortcutTone(item.tone),
      )
      .slice(0, shortcutLimit);
  } catch {
    return null;
  }
};

const writeShortcutPreference = (shortcuts: ShortcutSummary[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(shortcutPreferenceKey, JSON.stringify(shortcuts.slice(0, shortcutLimit)));
};

const mergeShortcutPreference = (source: ShortcutSummary[], preference: ShortcutSummary[] | null): ShortcutSummary[] => {
  const sourceItems = source.slice(0, shortcutLimit);
  const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
  const merged: ShortcutSummary[] = [];
  for (const saved of preference ?? []) {
    const base = sourceById.get(saved.id);
    if (!base) continue;
    merged.push({
      ...base,
      label: base.label,
      href: normalizeShortcutHref(saved.href, base.href),
      tone: isShortcutTone(saved.tone) ? saved.tone : base.tone,
    });
  }
  for (const item of sourceItems) {
    if (!merged.some((saved) => saved.id === item.id)) {
      merged.push(item);
    }
  }
  return merged.slice(0, shortcutLimit);
};

function Shortcuts({ shortcuts }: { shortcuts: ShortcutSummary[] }) {
  const baseShortcuts = useMemo(() => normalizeActionableShortcuts(shortcuts), [shortcuts]);
  const [isEditing, setIsEditing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutSummary[]>(() => mergeShortcutPreference(baseShortcuts, readShortcutPreference()));

  useEffect(() => {
    setCustomShortcuts(mergeShortcutPreference(baseShortcuts, readShortcutPreference()));
  }, [baseShortcuts]);

  const moveShortcut = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= customShortcuts.length) return;
    setCustomShortcuts((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      writeShortcutPreference(next);
      return next;
    });
  };

  const resetShortcuts = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(shortcutPreferenceKey);
    }
    setCustomShortcuts(baseShortcuts);
  };

  const dropShortcut = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setCustomShortcuts((current) => {
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      writeShortcutPreference(next);
      return next;
    });
    setDragIndex(null);
  };

  const removeShortcut = (id: string) => {
    setCustomShortcuts((current) => {
      const next = current.filter((item) => item.id !== id);
      writeShortcutPreference(next);
      return next;
    });
  };

  const addShortcut = (shortcut: ShortcutSummary) => {
    setCustomShortcuts((current) => {
      if (current.some((item) => item.id === shortcut.id) || current.length >= shortcutLimit) return current;
      const next = [...current, shortcut];
      writeShortcutPreference(next);
      return next;
    });
    setShowAddMenu(false);
  };

  const remainingCandidates = shortcutCandidates.filter((candidate) => !customShortcuts.some((item) => item.id === candidate.id));

  return (
    <WorkbenchCard className="p-5">
      <SectionTitle
        title="快速操作"
        eyebrow="Shortcuts"
        action={isEditing ? "完成" : "自訂排序"}
        onAction={() => {
          setIsEditing((current) => !current);
          setShowAddMenu(false);
        }}
      />
      {isEditing ? (
        <div className="mb-3 rounded-[8px] border border-dashed border-[#cfd9e5] bg-[#fbfcfd] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12px] font-bold text-[#536175]">
              <GripVertical className="h-4 w-4 text-[#007166]" />
              拖曳圖示即可調整順序，點擊加號新增模組入口。
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={customShortcuts.length >= shortcutLimit || !remainingCandidates.length}
                onClick={() => setShowAddMenu((current) => !current)}
                className="inline-flex min-h-8 items-center gap-1 rounded-[8px] bg-[#0d2a50] px-2 text-[11px] font-black text-white disabled:opacity-45"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                新增模組
              </button>
              <button
                type="button"
                onClick={resetShortcuts}
                className="inline-flex min-h-8 items-center rounded-[8px] border border-[#dfe7ef] bg-white px-2 text-[11px] font-black text-[#536175]"
              >
                重設
              </button>
            </div>
          </div>
          {showAddMenu ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {remainingCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => addShortcut(candidate)}
                  className="flex min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-left text-[12px] font-black text-[#263b56] hover:border-[#9dd84f]"
                >
                  <Plus className="h-4 w-4 text-[#007166]" />
                  {candidate.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("grid gap-3", isEditing ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-7" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-7")}>
        {customShortcuts.map((shortcut, index) => {
          const Icon = getShortcutIcon(shortcut);
          return isEditing ? (
            <div
              key={shortcut.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropShortcut(index)}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "relative flex min-h-[92px] cursor-grab flex-col items-center justify-center gap-2 rounded-[8px] border p-3 text-center shadow-[0_12px_28px_-26px_rgba(15,34,58,0.45)] transition-[transform,box-shadow,border-color,background-color]",
                shortcutSurfaceClass[shortcut.tone],
                dragIndex === index ? "scale-[0.98] opacity-60" : "hover:-translate-y-0.5 hover:shadow-md",
              )}
            >
              <button
                type="button"
                onClick={() => removeShortcut(shortcut.id)}
                className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#fff0f1] text-[#db4b5a]"
                aria-label={`移除 ${shortcut.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="absolute left-2 top-2 text-[#9aa8ba]" aria-hidden>
                <GripVertical className="h-4 w-4" />
              </div>
              <span className={cn("grid h-10 w-10 place-items-center rounded-[8px]", toneClass[shortcut.tone])}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="max-w-full truncate text-[12px] font-black text-[#263b56]">{shortcut.label}</span>
            </div>
          ) : (
            <a
              key={shortcut.id}
              href={shortcut.href}
              target={isInternalHref(shortcut.href) ? undefined : "_blank"}
              rel={isInternalHref(shortcut.href) ? undefined : "noreferrer"}
              className={cn(
                "group flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-[8px] border px-2 text-center shadow-[0_12px_28px_-26px_rgba(15,34,58,0.45)] transition-[transform,box-shadow,border-color,background-color] hover:-translate-y-0.5 hover:shadow-md",
                shortcutSurfaceClass[shortcut.tone],
              )}
            >
              <span className={cn("grid h-10 w-10 place-items-center rounded-[8px]", toneClass[shortcut.tone])}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="max-w-full truncate text-[12px] font-black text-[#263b56]">{shortcut.label}</span>
            </a>
          );
        })}
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
  if (!campaigns.length) return <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未新增活動檔期 / 課程快訊。</div>;
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
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#15935d]">{campaign.statusLabel}</span>
          </a>
          <EmployeeResourceActions resourceId={campaign.resourceId} title={campaign.title} content={campaign.effectiveRange} url={campaign.linkUrl} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function DocumentList({ documents, onChanged }: { documents: DocumentSummary[]; onChanged: () => void }) {
  if (!documents.length) return <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未新增常用文件。</div>;
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
    <WorkbenchCard className="p-5">
      <SectionTitle title="便利貼" eyebrow="Notes" action="員工自建" />
      <div className="space-y-3">
        <AddResourceForm
          category="sticky_note"
          facilityKey={facilityKey}
          titlePlaceholder="便利貼標題"
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

function CompactEventsCard({ campaigns, facilityKey, onChanged }: { campaigns: CampaignSummary[]; facilityKey: string; onChanged: () => void }) {
  const [showComposer, setShowComposer] = useState(false);
  return (
    <WorkbenchCard className="p-5">
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
            <span className="shrink-0 rounded-full bg-[#edf8f2] px-2 py-1 text-[10px] font-black text-[#15935d]">{campaign.statusLabel}</span>
          </Link>
        )) : (
          <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未新增活動檔期 / 課程快訊。</div>
        )}
      </div>
    </WorkbenchCard>
  );
}

function CompactDocumentsCard({ documents }: { documents: DocumentSummary[] }) {
  return (
    <WorkbenchCard className="p-5">
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
          <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未新增常用文件。</div>
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
      const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "便利貼";
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0d1f37]/35" role="dialog" aria-modal="true" aria-label="快速新增便利貼">
      <button type="button" aria-label="關閉便利貼新增視窗" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="fixed bottom-0 right-0 top-0 z-[51] flex h-dvh w-full max-w-[420px] shrink-0 flex-col bg-white shadow-[0_24px_60px_-24px_rgba(15,34,58,0.55)]">
        <div className="flex items-center justify-between border-b border-[#e6edf4] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-black text-[#10233f]">快速便利貼</h2>
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
                {mutation.isPending ? "新增中…" : "新增便利貼"}
              </button>
            </div>
            {savedMessage ? <p className="mt-2 text-[12px] font-black text-[#15935d]" role="status">{savedMessage}</p> : null}
            {mutation.isError ? <p className="mt-2 text-[12px] font-bold text-[#ff4964]" role="alert">新增失敗，請確認資料庫連線後再試。</p> : null}
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-black text-[#10233f]">最近便利貼</h3>
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
              <div className="rounded-[8px] bg-[#f7f9fb] p-6 text-center text-[13px] font-bold text-[#637185]">尚未新增便利貼。</div>
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
    <WorkbenchCard className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[#10233f]">便利貼</h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8b9aae]">Notes</p>
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
          <button type="button" onClick={() => setComposerOpen(true)} className="w-full rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185] hover:bg-[#f3f6f9]">
            尚未新增便利貼。
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

function ShiftBoardCard({ board }: { board?: ShiftBoardDto }) {
  const shifts = board?.shifts ?? [];
  const previewRows = shifts.flatMap((shift) =>
    shift.people.map((person) => ({
      shift,
      person,
      status: shift.isCurrent ? "進行中" : shift.isFuture ? "未來" : "已結束",
    })),
  );
  return (
    <WorkbenchCard className="p-5">
      <SectionTitle title="今日班表" eyebrow="Shift" showAction={false} />
      {!board?.sourceStatus.connected ? (
        <div className="rounded-[8px] bg-[#fff7f8] p-6 text-center text-[13px] font-bold text-[#ff4964]">班表資料暫時無法取得</div>
      ) : previewRows.length ? (
        <div className="space-y-3">
          {previewRows.slice(0, 6).map(({ shift, person, status }) => (
            <div
              key={`${shift.shiftId}-${person.userId}-${person.name}`}
              className={cn(
                "flex min-h-[64px] items-center gap-3 rounded-[8px] border px-3 py-2",
                shift.isCurrent ? "border-[#9dd84f] bg-[#f1fbec]" : "border-[#e6edf4] bg-[#fbfcfd]",
              )}
            >
              <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-black text-white", shift.isCurrent ? "bg-[#15935d]" : "bg-[#6c7a8e]")}>
                {person.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black text-[#10233f]">
                  {person.name}{person.isCurrentUser ? "（你）" : ""} · {person.role}
                </p>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">
                  {formatShiftTimeLong(shift.start)} - {formatShiftTimeLong(shift.end)}
                </p>
              </div>
              <span className={cn(
                "shrink-0 rounded-[8px] px-2 py-1 text-[11px] font-black",
                shift.isCurrent ? "bg-[#dff5d7] text-[#12854d]" : shift.isFuture ? "bg-[#eef2f6] text-[#637185]" : "bg-[#eef2f6] text-[#8b9aae]",
              )}>
                {status}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 text-[13px]">
            <span className="font-bold text-[#637185]">本日出勤</span>
            <span className="font-black text-[#10233f]">{board.totalCount} 人</span>
          </div>
        </div>
      ) : (
        <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">今日尚無班表</div>
      )}
    </WorkbenchCard>
  );
}

function LowerGrid({ home, visibleKeys, onResourceCreated }: { home: EmployeeHomeDto; visibleKeys: Set<string>; onResourceCreated: () => void }) {
  const shiftBoard = isShiftBoardPayload(home.homeCards?.shiftReminder.payload) ? home.homeCards?.shiftReminder.payload : undefined;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-4">
      {visibleKeys.has("shifts") ? <ShiftBoardCard board={shiftBoard} /> : null}
      {visibleKeys.has("events") ? <CompactEventsCard campaigns={home.campaigns.data ?? []} facilityKey={home.facility.key} onChanged={onResourceCreated} /> : null}
      {visibleKeys.has("documents") ? <CompactDocumentsCard documents={home.documents.data ?? []} /> : null}
      {visibleKeys.has("stickyNotes") ? <CompactStickyNotesCard notes={home.stickyNotes.data ?? []} facilityKey={home.facility.key} onChanged={onResourceCreated} /> : null}
    </div>
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
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e5ecf3] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
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

export default function EmployeeHomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [handoverDrawerOpen, setHandoverDrawerOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/bff/employee/home"],
    queryFn: fetchEmployeeHome,
  });
  const layoutItems = useMemo(() => normalizeWidgetLayout(data?.layout?.data, defaultEmployeeHomeWidgets), [data?.layout?.data]);
  const visibleWidgets = useMemo(() => new Set(layoutItems.filter((item) => item.enabled).map((item) => item.key)), [layoutItems]);
  const primaryWidgets = layoutItems.filter((item) => item.enabled && item.area === "primary");
  const lowerWidgets = layoutItems.filter((item) => item.enabled && item.area === "lower");
  const handoverPayload = isHandoverHomePayload(data?.homeCards?.handover.payload) ? data?.homeCards?.handover.payload : undefined;
  const shortcutPayload = Array.isArray(data?.homeCards?.quickActions.payload)
    ? data.homeCards.quickActions.payload as ShortcutSummary[]
    : data?.shortcuts.data ?? [];
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
          <main className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-6 pb-24 sm:px-6 lg:px-6 lg:py-7">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
              <motion.div variants={riseIn}>
                {visibleWidgets.has("search") ? (
                  <Hero
                    home={data}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    searchResults={searchQueryResult.data?.items ?? []}
                    isSearching={searchQueryResult.isFetching}
                  />
                ) : null}
              </motion.div>
              {primaryWidgets.length ? (
                <>
                  <motion.div variants={riseIn} className="hidden gap-4 lg:grid lg:grid-cols-3">
                    {["handover", "tasks", "announcements"].map((key) => {
                      if (!primaryWidgets.some((widget) => widget.key === key)) return null;
                      if (key === "handover") return <HandoverCard key={key} handovers={data.handover.data ?? []} payload={handoverPayload} onOpenDrawer={() => setHandoverDrawerOpen(true)} />;
                      if (key === "tasks") return <TasksCard key={key} tasks={data.tasks.data ?? []} />;
                      if (key === "announcements") return <AnnouncementCard key={key} announcements={data.announcements.data ?? []} />;
                      return null;
                    })}
                  </motion.div>
                  <motion.div variants={riseIn} className="space-y-4 lg:hidden">
                    {primaryWidgets.some((widget) => widget.key === "tasks") ? <TasksCard tasks={data.tasks.data ?? []} /> : null}
                    {visibleWidgets.has("shortcuts") ? <Shortcuts shortcuts={shortcutPayload} /> : null}
                    {primaryWidgets.some((widget) => widget.key === "announcements") ? <AnnouncementCard announcements={data.announcements.data ?? []} /> : null}
                    {primaryWidgets.some((widget) => widget.key === "handover") ? <HandoverCard handovers={data.handover.data ?? []} payload={handoverPayload} onOpenDrawer={() => setHandoverDrawerOpen(true)} /> : null}
                  </motion.div>
                </>
              ) : null}
              {visibleWidgets.has("shortcuts") ? (
                <motion.div variants={riseIn} className="hidden lg:block">
                  <Shortcuts shortcuts={shortcutPayload} />
                </motion.div>
              ) : null}
              {lowerWidgets.length ? (
                <motion.div variants={riseIn}>
                  <LowerGrid
                    home={data}
                    visibleKeys={new Set(lowerWidgets.map((item) => item.key))}
                    onResourceCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] })}
                  />
                </motion.div>
              ) : null}
            </motion.div>
          </main>
        </div>
      </div>
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
    </div>
  );
}
