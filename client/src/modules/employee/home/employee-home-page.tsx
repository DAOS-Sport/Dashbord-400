import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CloudSun,
  FileText,
  Gauge,
  GraduationCap,
  Home,
  Link as LinkIcon,
  ListChecks,
  ChevronUp,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  Search,
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
} from "@shared/domain/workbench";
import type { NavigationModuleDto } from "@shared/modules";
import type { BffSection } from "@shared/bff/envelope";
import { defaultEmployeeHomeWidgets, normalizeWidgetLayout } from "@shared/domain/layout";
import { Link, useLocation } from "wouter";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { DegradedCard, NotConnectedCard } from "@/components/shared/not-connected-card";
import { BrandLockup } from "@/shared/brand";
import { riseIn, staggerContainer } from "@/shared/motion/tokens";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import { EmployeeFloatingQuickActions } from "@/modules/employee/employee-floating-quick-actions";
import { EmployeeFacilitySwitcher } from "@/modules/employee/employee-facility-switcher";
import { WorkbenchNotificationBell } from "@/modules/workbench/workbench-notification-bell";
import { WorkbenchGlobalSearch } from "@/modules/workbench/workbench-global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WidgetLayoutPanel } from "@/modules/employee/settings/widget-layout-panel";
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
import { useAuthMe, useLogout } from "@/shared/auth/session";
import { useFacilityLabelMap } from "@/shared/auth/facility-labels";
import { fetchModuleNavigation } from "@/shared/modules/api";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";
import { getWorkbenchRoutes } from "@shared/navigation/workbench-routes";
import { getCourtName, getCourtsBySchool, getSchoolName, type SchoolId } from "@/lib/court-utils";
import { getEmployeeCourtSchoolsForFacility } from "@/modules/employee/courts-visibility";
import { ShiftBoardCard } from "./shift-board-card";

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
    dark ? "text-accent-lime hover:bg-white/10" : "text-stitch-on-secondary-container hover:bg-emerald-50",
  );
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className={cn("text-[15px] font-bold", dark ? "text-white" : "text-text-strong")}>{title}</h2>
        <p className={cn("mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em]", dark ? "text-accent-lime" : "text-text-muted")}>
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

function DesktopSidebar({ collapsed }: { collapsed: boolean }) {
  const [location] = useLocation();
  const trackEvent = useTrackEvent();
  const { data: session } = useAuthMe();
  const logoutMutation = useLogout();
  const [widgetPanelOpen, setWidgetPanelOpen] = useState(false);
  const navigation = useQuery({
    queryKey: ["/api/modules/navigation", "employee-home-sidebar"],
    queryFn: fetchModuleNavigation,
    staleTime: 60_000,
  });
  const items = toEmployeeNavigationItems(navigation.data?.items);
  const granted = session?.grantedFacilities ?? [];
  const facilityLabels = useFacilityLabelMap(granted);
  const facilityName = facilityLabels.getFacilityName(session?.activeFacility);
  const userName = session?.displayName || "員工";
  const userId = session?.userId || "未登入";
  const visibleItems = getEmployeeCourtSchoolsForFacility(session?.activeFacility, facilityName).length
    ? items
    : items.filter((item) => item.id !== "courts");
  return (
    <>
    <aside
      aria-hidden={collapsed}
      className={cn(
        "hidden h-full min-h-0 shrink-0 overflow-hidden bg-primary-navy-soft text-white transition-[width,box-shadow] duration-200 md:flex",
        collapsed ? "pointer-events-none w-0 shadow-none" : "w-[232px] shadow-[20px_0_40px_-32px_rgba(13,31,55,0.7)]",
      )}
    >
      <div className="flex h-full w-[232px] shrink-0 flex-col p-5">
        <BrandLockup markClassName="h-10 w-10 rounded-[8px]" titleClassName="text-[18px] text-white" />

        <EmployeeFacilitySwitcher surface="sidebar" statusLabel="營運中" className="mt-6" />

        <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {!items.length && navigation.isLoading ? (
            <div className="rounded-[8px] bg-white/8 px-3 py-3 text-[12px] font-bold text-slate-200">導覽載入中…</div>
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
                  active ? "bg-gradient-to-r from-accent-teal to-accent-lime text-white" : "text-slate-200 hover:bg-white/10",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? <span className="grid h-5 w-5 place-items-center rounded-full bg-state-priority text-[10px]">{item.badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2 hover:bg-white/10"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stitch-on-secondary-container text-[12px] font-black">
                  {userName.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13px] font-bold">{userName}</p>
                  <p className="truncate text-[11px] text-slate-300">{userId} · 員工</p>
                </div>
                <ChevronUp className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuItem
                onClick={() => setWidgetPanelOpen(true)}
                className="gap-2"
                data-testid="menu-item-widget-settings"
              >
                <LayoutDashboard className="h-4 w-4 text-blue-600" />
                首頁版型設定
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate(undefined, { onSettled: () => { window.location.href = "/login"; } })}
                disabled={logoutMutation.isPending}
                className="gap-2 text-red-600 focus:text-red-600"
                data-testid="menu-item-logout"
              >
                <LogOut className="h-4 w-4" />
                {logoutMutation.isPending ? "登出中…" : "登出"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
    <WidgetLayoutPanel open={widgetPanelOpen} onOpenChange={setWidgetPanelOpen} />
    </>
  );
}

function TopBar({
  sidebarCollapsed,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="z-20 shrink-0 border-b border-border-default bg-primary-navy text-white md:bg-white/90 md:text-text-strong md:backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between gap-3 px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label={sidebarCollapsed ? "展開側欄" : "收合側欄"}
            aria-expanded={!sidebarCollapsed}
            onClick={onToggleSidebar}
            className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10 md:bg-blue-50 md:text-blue-600"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <WorkbenchGlobalSearch role="employee" />
          <WorkbenchNotificationBell role="employee" />
        </div>
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
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-text-muted">Quick Search</p>
        <label className="mt-2 flex min-h-14 items-center gap-3 rounded-[8px] border border-border-default bg-white px-4 shadow-[0_18px_45px_-36px_rgba(15,34,58,0.25)]">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            aria-label="快速搜尋"
            name="employee-workbench-search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-text-strong outline-none placeholder:text-text-muted"
            placeholder="搜尋公告、交接、班表、入口、常見問題…"
          />
        </label>
        {searchQuery.trim().length >= 2 ? (
          <div className="mt-2 max-w-[820px] rounded-[8px] border border-border-default bg-white p-2 shadow-[0_18px_45px_-36px_rgba(15,34,58,0.45)]">
            {isSearching ? <div className="px-3 py-2 text-[12px] font-bold text-text-body">搜尋中…</div> : null}
            {!isSearching && searchResults.length === 0 ? <div className="px-3 py-2 text-[12px] font-bold text-text-body">沒有找到符合的資訊。</div> : null}
            {searchResults.map((item) => (
              <Link key={item.id} href={item.href} className="flex min-h-11 items-center gap-3 rounded-[8px] px-3 py-2 hover:bg-surface-soft">
                <span className="shrink-0 rounded-[6px] bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-600">{searchTypeLabel[item.type]}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-text-strong">{item.title}</span>
                  <span className="block truncate text-[11px] font-bold text-text-muted">{item.summary}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-text-body">
          <CalendarDays className="h-4 w-4 text-stitch-on-secondary-container" />
          {home.facility.businessDate}
        </p>
      </div>
      {home.weather.status === "unavailable" || !home.weather.data ? (
        <NotConnectedCard title="天氣卡片" reason="external_pending" className="min-h-[128px]" />
      ) : home.weather.status === "degraded" ? (
        <DegradedCard title="天氣卡片" className="min-h-[128px]" />
      ) : (
        <div className="rounded-[8px] border border-border-default bg-white p-4 shadow-[0_18px_40px_-32px_rgba(15,34,58,0.45)]">
          <div className="flex items-center gap-3">
            <CloudSun className="h-10 w-10 text-amber-400" />
            <div>
              <p className="text-[26px] font-black text-text-strong">{home.weather.data.temperatureC}°C</p>
              <p className="text-[12px] font-bold text-text-body">{home.weather.data.label}</p>
              <p className="text-[11px] text-text-muted">濕度 {home.weather.data.humidity}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
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
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => {
            const isDone = item.status === "completed";
            const isExpired = item.status === "expired";
            return (
              <button key={`handover-${item.id}`} type="button" onClick={onOpenDrawer}
                className={cn(
                  "block w-full rounded-[8px] border p-3 text-left",
                  isDone
                    ? "border-emerald-100 bg-emerald-50"
                    : isExpired
                    ? "border-rose-200 bg-rose-50"
                    : "border-border-subtle bg-surface-soft",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "truncate text-[13px] font-black",
                      isDone ? "text-emerald-800" : isExpired ? "text-rose-800" : "text-text-strong",
                    )}>{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] font-bold text-text-muted">
                      {item.preview || "尚無內容摘要"} · {item.dueDate ? formatShortDateTime(item.dueDate) : "未設定到期"}
                    </p>
                  </div>
                  {isDone && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">已完成</span>
                  )}
                  {isExpired && (
                    <span className="shrink-0 rounded-full bg-rose-200 px-1.5 py-0.5 text-[10px] font-black text-rose-800">已逾期</span>
                  )}
                </div>
              </button>
            );
          })}
          <div className="pt-1">
            <button type="button" onClick={onOpenDrawer} className="workbench-focus min-h-9 rounded-[8px] bg-primary-navy px-3 text-[12px] font-black text-white">
              新增交辦事項
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[128px] flex-col items-center justify-center rounded-[8px] bg-surface-soft px-4 py-5 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-text-body shadow-sm">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <p className="mt-3 text-[15px] font-black text-text-strong">尚未設定交辦事項</p>
          <p className="mt-1 text-[12px] font-medium text-text-body">請新增交辦事項</p>
          <button type="button" onClick={onOpenDrawer} className="workbench-focus mt-4 min-h-9 rounded-[8px] bg-primary-navy px-3 text-[12px] font-black text-white">
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
    <div className="fixed inset-0 z-50 flex justify-end bg-primary-navy/35" role="dialog" aria-modal="true" aria-label="交辦事項">
      <button type="button" aria-label="關閉交辦事項" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[420px] flex-col bg-white shadow-[0_24px_60px_-24px_rgba(15,34,58,0.55)]">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-[18px] font-black text-text-strong">交辦事項</h2>
            <p className="text-[12px] font-bold text-text-body">新增交辦事項並追蹤 pending 狀態</p>
          </div>
          <button type="button" onClick={onClose} className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] bg-surface-base text-text-body">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="rounded-[8px] border border-border-default bg-surface-soft p-3">
            <div className="grid gap-2">
              <label className="text-[12px] font-black text-text-body" htmlFor="home-handover-title">標題</label>
              <input
                id="home-handover-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-h-10 rounded-[8px] border border-border-default bg-white px-3 text-[13px] font-bold text-text-strong outline-none"
              />
              <label className="text-[12px] font-black text-text-body" htmlFor="home-handover-content">內容</label>
              <textarea
                id="home-handover-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-24 rounded-[8px] border border-border-default bg-white p-3 text-[13px] font-bold text-text-strong outline-none"
              />
              <label className="text-[12px] font-black text-text-body" htmlFor="home-handover-due-date">到期時間</label>
              <input
                id="home-handover-due-date"
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="min-h-10 rounded-[8px] border border-border-default bg-white px-3 text-[13px] font-bold text-text-strong outline-none"
              />
              <button
                type="button"
                disabled={!title.trim() || !content.trim() || !dueDate || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="workbench-focus min-h-10 rounded-[8px] bg-primary-navy px-3 text-[13px] font-black text-white disabled:opacity-50"
              >
                {createMutation.isPending ? "新增中..." : "新增交辦事項"}
              </button>
              {createMutation.isError ? <p className="text-[11px] font-bold text-state-priority">新增失敗，請確認欄位或稍後再試。</p> : null}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-black text-text-strong">Pending 交辦列表</h3>
              <Link href="/employee/handover" className="text-[12px] font-black text-stitch-on-secondary-container">完整頁</Link>
            </div>
            {items.length ? items.map((item) => (
              <article key={item.id} className="rounded-[8px] border border-border-subtle bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-text-strong">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] font-medium text-text-body">{item.preview || "尚無內容摘要"}</p>
                    <p className="mt-2 text-[11px] font-bold text-text-muted">{item.dueDate ? formatShortDateTime(item.dueDate) : "未設定到期"}</p>
                  </div>
                </div>
                {replyingId === item.id ? (
                  <div className="mt-3 rounded-[8px] border border-border-default bg-surface-soft p-3">
                    <label className="text-[12px] font-black text-text-body" htmlFor={`home-handover-reply-${item.id}`}>補充內容</label>
                    <textarea
                      id={`home-handover-reply-${item.id}`}
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      maxLength={1200}
                      className="mt-2 min-h-[86px] w-full rounded-[8px] border border-border-default bg-white p-3 text-[13px] font-bold leading-6 text-text-strong outline-none focus:border-primary-navy"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-text-muted">{replyText.length} / 1200 字</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setReplyingId(null); setReplyText(""); }} className="min-h-8 rounded-[7px] border border-border-default bg-white px-3 text-[11px] font-black text-text-body">
                          取消
                        </button>
                        <button
                          type="button"
                          disabled={!replyText.trim() || replyMutation.isPending}
                          onClick={() => replyMutation.mutate({ id: item.id, reportNote: replyText.trim() })}
                          className="min-h-8 rounded-[7px] bg-primary-navy px-3 text-[11px] font-black text-white disabled:opacity-50"
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
                    className="workbench-focus rounded-[8px] border border-border-default bg-white px-2 py-1 text-[11px] font-black text-text-body disabled:opacity-50"
                  >
                    標記已讀
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReplyingId(item.id); setReplyText(""); }}
                    className="workbench-focus rounded-[8px] border border-border-default bg-white px-2 py-1 text-[11px] font-black text-text-body"
                  >
                    {replyingId === item.id ? "正在補充" : "回覆補充"}
                  </button>
                  <button
                    type="button"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate(item.id)}
                    className="workbench-focus shrink-0 rounded-[8px] bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-600 disabled:opacity-50"
                  >
                    完成
                  </button>
                  {confirmingDeleteId !== item.id ? (
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => setConfirmingDeleteId(item.id)}
                      className="workbench-focus rounded-[8px] border border-rose-200 bg-white px-2 py-1 text-[11px] font-black text-state-priority disabled:opacity-50"
                    >
                      刪除
                    </button>
                  ) : (
                    <span className="flex flex-wrap gap-2 rounded-[8px] bg-rose-50 p-1">
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="min-h-8 rounded-[7px] bg-state-priority px-2 text-[11px] font-black text-white disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? "刪除中" : "確認刪除"}
                      </button>
                      <button type="button" onClick={() => setConfirmingDeleteId(null)} className="min-h-8 rounded-[7px] bg-white px-2 text-[11px] font-black text-text-body">
                        取消
                      </button>
                    </span>
                  )}
                </div>
              </article>
            )) : (
              <div className="rounded-[8px] bg-surface-soft p-5 text-center text-[13px] font-bold text-text-body">尚未設定交辦事項</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function AnnouncementCard({ announcements, source }: { announcements: AnnouncementSummary[]; source?: BffSection<AnnouncementSummary[]> }) {
  const filterBreakdown = source?.meta.filterBreakdown;
  const sourceMessage = (() => {
    if (source?.status !== "unavailable" && source?.status !== "degraded") {
      if (filterBreakdown && filterBreakdown.upstreamTotal > 0) {
        const filtered = filterBreakdown.qualityFiltered + filterBreakdown.scopeFiltered;
        return `上游有 ${filterBreakdown.upstreamTotal} 筆公告，${filtered > 0 ? `其中 ${filtered} 筆因品質或範圍篩選排除，` : ""}目前無符合顯示條件的公告。`;
      }
      return "目前沒有需要優先閱讀的群組公告。";
    }
    const reason = source.meta.fallbackReason ?? "";
    if (/TOKEN|LINE_BOT|ADMIN|API/i.test(reason)) return "公告來源暫時無法同步，請先以主管公告頁確認最新資訊。";
    return reason || "公告來源暫時無法同步，請稍後再試。";
  })();
  const [primaryAnnouncement, ...secondaryAnnouncements] = announcements.slice(0, 3);
  return (
    <WorkbenchCard className="h-full border-amber-300 bg-amber-50 p-5 shadow-[0_20px_48px_-36px_rgba(180,83,9,0.45)]">
      <SectionTitle title="群組重要公告" eyebrow="Pinned" action="全部公告" actionHref="/employee/announcements" />
      <div className="space-y-2.5">
        {primaryAnnouncement ? (
          <div className="rounded-[8px] border border-amber-300 bg-white p-3.5 text-text-strong">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-amber-100 text-amber-700">
                <Bell className="h-4 w-4" />
              </span>
              <span className="rounded-[4px] bg-orange-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                {primaryAnnouncement.priority === "required" ? "重要" : "提醒"}
              </span>
              <span className="min-w-0 truncate text-[11px] font-bold text-amber-800">
                {primaryAnnouncement.sourceLabel ? `${primaryAnnouncement.sourceLabel} · ` : ""}{primaryAnnouncement.effectiveRange}
              </span>
            </div>
            <p className="line-clamp-2 text-[14px] font-black leading-5">{primaryAnnouncement.title}</p>
            {/* Single-item view: show summary so user can read content without navigating */}
            {!secondaryAnnouncements.length && primaryAnnouncement.summary ? (
              <p className="mt-1.5 line-clamp-3 text-[12px] font-bold leading-5 text-amber-900">{primaryAnnouncement.summary}</p>
            ) : null}
            {primaryAnnouncement.isExpiringSoon ? (
              <span className="mt-2 inline-flex rounded-[4px] bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600">即將結束</span>
            ) : null}
            {primaryAnnouncement.overlayNote ? (
              <p className="mt-2 line-clamp-1 text-[11px] font-bold text-amber-700">{primaryAnnouncement.overlayNote}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[8px] border border-dashed border-amber-200 bg-white/55 p-5 text-center text-[13px] font-bold text-amber-800">
            <span>{sourceMessage}</span>
            {source?.meta.lastSyncAt ? (
              <span className="mt-1.5 block text-[10px] font-bold text-amber-600">上次更新：{formatShortDateTime(source.meta.lastSyncAt)}</span>
            ) : null}
          </div>
        )}
        {secondaryAnnouncements.length ? (
          <div className="divide-y divide-amber-200 overflow-hidden rounded-[8px] border border-amber-200 bg-white/70">
            {secondaryAnnouncements.map((item) => (
              <Link key={item.id} href="/employee/announcements" className="flex min-h-[54px] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-black text-text-strong">{item.title}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-bold text-amber-800">
                    {item.sourceLabel ? `${item.sourceLabel} · ` : ""}{item.effectiveRange}
                  </span>
                </span>
                <span className="shrink-0 rounded-[4px] bg-orange-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
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
  category: "event" | "document";
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
    <div className="rounded-[8px] border border-dashed border-border-emphasis bg-surface-soft p-3">
      <div className="grid gap-2">
        <input
          aria-label={titlePlaceholder}
          name={`${category}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-9 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold text-text-strong outline-none"
          placeholder={titlePlaceholder}
        />
        <input
          aria-label={contentPlaceholder}
          name={`${category}-content`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-9 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold text-text-strong outline-none"
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
            className="min-h-9 rounded-[8px] border border-border-default bg-white px-3 text-[12px] font-bold text-text-strong outline-none"
            placeholder={urlPlaceholder}
          />
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] bg-primary-navy px-3 text-[12px] font-black text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {mutation.isPending ? "新增中…" : "新增"}
        </button>
        {mutation.isError ? <p className="text-[11px] font-bold text-state-priority">新增失敗，請確認欄位格式。</p> : null}
      </div>
    </div>
  );
}

function EventList({ campaigns, onChanged }: { campaigns: CampaignSummary[]; onChanged: () => void }) {
  if (!campaigns.length) return <div className="rounded-[8px] bg-surface-soft px-4 py-3 text-center text-[12px] font-bold text-text-muted">尚未新增活動檔期 / 課程快訊。</div>;
  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="rounded-[8px] bg-surface-soft p-3">
          <a href={campaign.linkUrl || "#"} className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-emerald-50 text-emerald-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-text-strong">{campaign.title}</p>
              <p className="mt-1 truncate text-[11px] font-bold text-text-body">{campaign.effectiveRange}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${campaign.statusLabel === "即將結束" ? "bg-red-50 text-red-600" : campaign.statusLabel === "即將開始" ? "bg-blue-50 text-blue-600" : "bg-white text-emerald-600"}`}>{campaign.statusLabel}</span>
          </a>
          <EmployeeResourceActions resourceId={campaign.resourceId} title={campaign.title} content={campaign.effectiveRange} url={campaign.linkUrl} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function DocumentList({ documents, onChanged }: { documents: DocumentSummary[]; onChanged: () => void }) {
  if (!documents.length) return <div className="rounded-[8px] bg-surface-soft px-4 py-3 text-center text-[12px] font-bold text-text-muted">尚未新增常用文件。</div>;
  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div key={doc.id} className="rounded-[8px] px-2 py-2 hover:bg-surface-soft">
          <a href={doc.url || "#"} className="flex min-h-12 w-full items-center gap-3 text-left">
            <FileText className="h-5 w-5 shrink-0 text-blue-600" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black text-text-strong">{doc.title}</span>
              <span className="block truncate text-[11px] font-medium text-text-muted">{doc.description || `更新：${doc.updatedAt}`}</span>
            </span>
          </a>
          <EmployeeResourceActions resourceId={doc.resourceId} title={doc.title} content={doc.description} url={doc.url} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function CompactEventsCard({ campaigns, facilityKey, onChanged, source }: { campaigns: CampaignSummary[]; facilityKey: string; onChanged: () => void; source?: BffSection<CampaignSummary[]> }) {
  const [showComposer, setShowComposer] = useState(false);
  return (
    <WorkbenchCard className="h-full p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-text-strong">活動檔期 / 課程快訊</h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">Events</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setShowComposer((current) => !current)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-stitch-on-secondary-container hover:bg-emerald-50">
            新增快訊
            <span aria-hidden>＋</span>
          </button>
          <Link href="/employee/activity-periods" className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-bold text-stitch-on-secondary-container hover:bg-emerald-50">
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
          <Link key={campaign.id} href="/employee/activity-periods" className="flex min-h-12 items-center gap-3 rounded-[8px] px-2 py-2 hover:bg-surface-soft">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-emerald-50 text-emerald-600">
              <CalendarDays className="h-4 w-4" />
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black text-text-strong">{campaign.title}</span>
              <span className="block truncate text-[11px] font-bold text-text-body">{campaign.effectiveRange}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${campaign.statusLabel === "即將結束" ? "bg-red-50 text-red-600" : campaign.statusLabel === "即將開始" ? "bg-blue-50 text-blue-600" : "bg-surface-soft text-emerald-600"}`}>{campaign.statusLabel}</span>
          </Link>
        )) : (
          <div className="rounded-[8px] bg-surface-soft px-4 py-3 text-center text-[12px] font-bold text-text-muted">
            <span>目前沒有活動快訊</span>
            {source?.meta.lastSyncAt ? (
              <span className="mt-1 block text-[10px] font-bold text-text-body">上次更新：{formatShortDateTime(source.meta.lastSyncAt)}</span>
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
            doc.url ? "hover:bg-surface-soft" : "cursor-not-allowed opacity-70",
          );
          const content = (
            <>
              <FileText className="h-5 w-5 shrink-0 text-blue-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-black text-text-strong">{doc.title}</span>
                <span className="block truncate text-[11px] font-medium text-text-muted">{doc.description || `更新：${doc.updatedAt}`}</span>
              </span>
              {doc.url ? <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" /> : <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-text-body">未綁連結</span>}
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
          <div className="rounded-[8px] bg-surface-soft px-4 py-3 text-center text-[12px] font-bold text-text-muted">尚未新增常用文件。</div>
        )}
      </div>
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
    xinbei: "bg-surface-soft text-text-body",
    sanchong: "bg-surface-soft text-text-body",
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
        <div className="rounded-[8px] bg-surface-soft p-4 text-center text-[12px] font-bold text-text-muted">
          場租資料載入中…
        </div>
      ) : allReservations.length === 0 ? (
        <div className="rounded-[8px] bg-surface-soft p-4 text-center text-[12px] font-bold text-text-muted">
          今日尚無場租紀錄。
        </div>
      ) : (
        <div className="overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-surface-soft">
          <div className="flex gap-3" style={{ minWidth: "max-content" }}>
            {allReservations.map(({ school, reservation }) => (
              <Link
                key={`${school}-${reservation.id ?? reservation.court}-${reservation.startTime}`}
                href={`/employee/courts/${school}?date=${reservation.date}`}
                className="workbench-focus flex w-[148px] shrink-0 flex-col justify-between rounded-[10px] border border-border-default bg-white p-3 shadow-[0_1px_4px_rgba(15,34,58,0.07)] transition hover:border-border-default hover:bg-surface-soft"
                data-testid={`card-court-rsv-${school}-${reservation.id ?? reservation.court}-${reservation.startTime}`}
              >
                <span className={cn("mb-2 self-start rounded-full px-2 py-0.5 text-[10px] font-black", schoolBadgeClass[school])}>
                  {getSchoolName(school)}
                </span>
                <p className="line-clamp-2 text-[13px] font-black leading-snug text-text-strong">
                  {reservation.customerName || "未命名場租"}
                </p>
                <p className="mt-1 truncate text-[11px] font-bold text-text-body">
                  {getCourtName(reservation.court)}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-bold text-text-muted">
                  {reservation.serviceName || "一般場租"}
                </p>
                <span className="mt-2 font-mono text-[12px] font-black tabular-nums text-stitch-on-secondary-container">
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
          className="text-[12px] font-black text-stitch-on-secondary-container hover:underline"
          data-testid="button-courts-open-drawer"
        >
          依學校分類查看 →
        </button>
        <span className="text-[11px] font-bold text-text-muted">{allReservations.length} 筆今日場租</span>
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
    xinbei: "bg-surface-soft text-white",
    sanchong: "bg-surface-soft text-white",
  };

  const selectedSchools = schools.filter((school, index, list) => list.indexOf(school) === index);
  const primarySchool = selectedSchools[0] ?? "xinbei";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-primary-navy/35" role="dialog" aria-modal="true" aria-label="場租查看">
      <button type="button" aria-label="關閉場租" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[400px] flex-col bg-white shadow-[0_24px_60px_-24px_rgba(15,34,58,0.55)]">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="text-[18px] font-black text-text-strong">今日場租</h2>
            <p className="mt-0.5 text-[12px] font-bold text-text-body">依學校場地分類</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] bg-surface-base text-[20px] text-text-body"
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
                  <div className="rounded-[8px] bg-surface-soft p-3 text-center text-[12px] font-bold text-text-muted">載入中…</div>
                ) : q.isError ? (
                  <div className="rounded-[8px] border border-border-default bg-surface-soft p-3 text-[12px] font-bold text-text-body">資料暫時無法載入。</div>
                ) : rsvs.length === 0 ? (
                  <div className="rounded-[8px] bg-surface-soft p-3 text-center text-[12px] font-bold text-text-muted">今日尚無場租。</div>
                ) : (
                  <div className="space-y-2">
                    {rsvs.map((r) => (
                      <div
                        key={`${r.id ?? r.court}-${r.startTime}`}
                        className="flex items-center justify-between gap-3 rounded-[8px] border border-border-default bg-surface-soft px-3 py-2"
                        data-testid={`drawer-court-rsv-${school}-${r.id ?? r.court}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-text-strong">{r.customerName || "未命名場租"}</p>
                          <p className="mt-0.5 truncate text-[11px] font-bold text-text-body">
                            {getCourtName(r.court)} · {r.serviceName || "一般場租"}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[12px] font-black tabular-nums text-stitch-on-secondary-container">
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

        <div className="grid grid-cols-2 gap-2 border-t border-border-subtle p-4">
          <Link
            href={`/employee/courts/${primarySchool}`}
            className="workbench-focus inline-flex min-h-9 items-center justify-center rounded-[8px] bg-primary-navy px-3 text-[12px] font-black text-white"
            data-testid="link-courts-full-page"
          >
            完整查看
          </Link>
          <Link
            href={`/employee/courts/${primarySchool}/search`}
            className="workbench-focus inline-flex min-h-9 items-center justify-center rounded-[8px] bg-emerald-50 px-3 text-[12px] font-black text-stitch-on-secondary-container"
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
    <WorkbenchCard className="h-full border-border-default bg-surface-soft p-5 opacity-80">
      <SectionTitle title="今日家教預約" eyebrow="Tutoring" showAction={false} />
      <div className="rounded-[8px] border border-dashed border-border-default bg-white/55 p-3 text-text-body">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black">今日</p>
            <p className="mt-1 text-[24px] font-black tabular-nums">0</p>
            <p className="text-[11px] font-bold">筆預約</p>
          </div>
          <span className="rounded-full border border-border-default bg-surface-soft px-2 py-1 text-[10px] font-black text-text-body">
            即將加入
          </span>
        </div>

        <div className="mt-3 space-y-2">
          <div className="text-[10px] font-mono font-black text-text-body">10:00-11:00</div>
          <div className="rounded-[8px] bg-surface-soft p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-black text-text-body">教練課程</span>
              <span className="text-[12px] font-bold text-text-body">一對多家教</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2].map((item) => (
                <span key={item} className="grid h-7 w-7 place-items-center rounded-full bg-surface-soft text-text-body">
                  <GraduationCap className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] font-bold leading-5 text-text-body">家教預約模組規劃中；正式開放後會依時間排序顯示教練、課程比例與學生簽到狀態。</p>
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
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-border-default bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
      {!items.length && navigation.isLoading ? (
        <div className="col-span-5 rounded-[8px] bg-surface-soft px-3 py-3 text-center text-[12px] font-bold text-text-body">導覽載入中…</div>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/employee" ? location === "/employee" || location === "/EMPLOYEE" : location.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
            className={cn("workbench-focus flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-black", active ? "bg-blue-50 text-blue-600" : "text-text-body")}
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
    <div className="grid min-h-dvh place-items-center bg-surface-soft p-6">
      <div className="w-full max-w-sm rounded-[8px] bg-white px-5 py-4 shadow-lg">
        <DreamLoader compact label="Dreams 工作台資料載入中" />
      </div>
    </div>
  );
}

function EmployeeHomeContent() {
  const [handoverDrawerOpen, setHandoverDrawerOpen] = useState(false);
  const [courtsDrawerOpen, setCourtsDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  if (isLoading) return <LoadingState />;

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface-soft p-6">
        <WorkbenchCard className="w-full max-w-md p-6 text-center">
          <Gauge className="mx-auto h-10 w-10 text-text-body" />
          <h1 className="mt-4 text-[20px] font-black text-text-strong">工作台暫時無法載入</h1>
          <p className="mt-2 text-[14px] text-text-body">BFF 資料來源尚未回應，請稍後再試。</p>
        </WorkbenchCard>
      </div>
    );
  }

  return (
    <div className="workbench-shell h-dvh overflow-hidden bg-surface-base">
      <div className="flex h-full min-w-0">
        <DesktopSidebar collapsed={sidebarCollapsed} />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((current) => !current)} />
          <main className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-6 pb-24 sm:px-6 md:px-6 md:py-7">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="mx-auto max-w-[1760px] space-y-4">
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
                  <div className="h-full lg:col-span-12">
                    <CourtsScrollCard schools={courtSchools} onOpenDrawer={() => setCourtsDrawerOpen(true)} />
                  </div>
                ) : null}
              </motion.div>
              {homeSlots.enabledKeys.size === 0 ? (
                <motion.div variants={riseIn}>
                  <WorkbenchCard className="p-6 text-center">
                    <p className="text-[15px] font-black text-text-strong">目前沒有啟用的首頁模組</p>
                    <p className="mt-1 text-[12px] font-bold text-text-body">可到員工設定重新啟用首頁卡片。</p>
                    <Link href="/employee/settings" className="mt-4 inline-flex min-h-9 items-center justify-center rounded-[8px] bg-primary-navy px-4 text-[12px] font-black text-white">
                      開啟員工設定
                    </Link>
                  </WorkbenchCard>
                </motion.div>
              ) : null}
            </motion.div>
          </main>
        </div>
      </div>
      <EmployeeFloatingQuickActions />
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
