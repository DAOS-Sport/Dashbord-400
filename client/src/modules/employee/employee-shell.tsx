import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronUp,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  PackageSearch,
  Search,
} from "lucide-react";
import type { NavigationModuleDto } from "@shared/modules";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import { useAuthMe, useLogout } from "@/shared/auth/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFacilityLabelMap } from "@/shared/auth/facility-labels";
import { fetchModuleNavigation } from "@/shared/modules/api";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";
import { BrandLockup } from "@/shared/brand";
import { getWorkbenchRoutes } from "@shared/navigation/workbench-routes";
import { getEmployeeCourtSchoolsForFacility } from "@/modules/employee/courts-visibility";
import { EmployeeFloatingQuickActions } from "./employee-floating-quick-actions";
import { WorkbenchFacilitySwitcher } from "@/modules/workbench/workbench-facility-switcher";
import { WorkbenchNotificationBell } from "@/modules/workbench/workbench-notification-bell";

type EmployeeNavItem = {
  id: string;
  label: string;
  href: string;
  Icon: LucideIcon;
  badge?: string;
};

const iconByKey: Record<string, LucideIcon> = {
  home: Home,
  "clipboard-check": ClipboardCheck,
  bell: Bell,
  "message-square-text": MessageSquareText,
  "calendar-days": CalendarDays,
  link: MoreHorizontal,
  "book-open": BookOpen,
  "file-text": FileText,
  "graduation-cap": GraduationCap,
  "package-search": PackageSearch,
  search: Search,
};

const isActivePath = (location: string, href: string) =>
  href === "/employee" ? location === href || location === "/EMPLOYEE" : location === href || location.startsWith(`${href}/`);

const toEmployeeNavItems = (items: NavigationModuleDto[] | undefined): EmployeeNavItem[] => {
  const apiItems = (items ?? []).filter((item) => item.routePath.startsWith("/employee"));
  const sourceById = new Map(apiItems.map((item) => [item.id, item]));

  return getWorkbenchRoutes("employee").map((route) => {
    const source = sourceById.get(route.moduleId);
    const iconKey = source?.iconKey ?? route.iconKey;
    return {
      id: source?.id ?? route.moduleId,
      label: route.label,
      href: route.primaryPath,
      Icon: iconByKey[iconKey] ?? iconByKey[route.iconKey] ?? Home,
    };
  });
};

function EmployeeDesktopSidebar({
  items,
  loading,
  location,
  onNavigate,
  userName,
  userId,
  collapsed,
}: {
  items: EmployeeNavItem[];
  loading: boolean;
  location: string;
  onNavigate: (item: EmployeeNavItem) => void;
  userName: string;
  userId: string;
  collapsed: boolean;
}) {
  const { logout } = useLogout();
  return (
    <aside
      aria-hidden={collapsed}
      className={cn(
        "hidden h-full min-h-0 shrink-0 overflow-hidden bg-[#1f3f68] text-white transition-[width,box-shadow] duration-200 md:flex",
        collapsed ? "pointer-events-none w-0 shadow-none" : "w-[232px] shadow-[20px_0_40px_-32px_rgba(13,31,55,0.7)]",
      )}
    >
      <div className="flex h-full w-[232px] shrink-0 flex-col px-4 py-4">
        <BrandLockup markClassName="h-10 w-10 rounded-[8px]" titleClassName="text-[17px] text-white" />

        <WorkbenchFacilitySwitcher tone="employee" surface="sidebar" statusLabel="營運中" className="mt-4 shrink-0" />

        <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {!items.length && loading ? (
            <div className="rounded-[8px] bg-white/8 px-3 py-3 text-[12px] font-bold text-[#d6e2ef]">導覽載入中…</div>
          ) : null}
          {items.map((item) => {
            const active = isActivePath(location, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => onNavigate(item)}
                className={cn(
                  "workbench-focus flex min-h-10 shrink-0 items-center gap-3 rounded-[8px] px-3 text-left text-[14px] font-bold transition",
                  active ? "bg-gradient-to-r from-[#1cb4a3] to-[#9dd84f] text-white" : "text-[#d6e2ef] hover:bg-white/10",
                )}
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ff4964] text-[10px]">{item.badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 shrink-0 border-t border-white/10 pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="workbench-focus flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left hover:bg-white/10">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#007166] text-[12px] font-black">{userName.slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{userName}</p>
                  <p className="truncate text-[11px] text-[#b6c7d9]">{userId} · 員工</p>
                </div>
                <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[#9eacbc]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuItem onClick={logout} className="gap-2 text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4" />
                登出
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
}

interface EmployeeShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function EmployeeShell({ title, subtitle, children }: EmployeeShellProps) {
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const trackEvent = useTrackEvent();
  const { data: session } = useAuthMe();
  const navigation = useQuery({
    queryKey: ["/api/modules/navigation", "employee-shell"],
    queryFn: fetchModuleNavigation,
    staleTime: 60_000,
  });
  const nav = toEmployeeNavItems(navigation.data?.items);
  const granted = session?.grantedFacilities ?? [];
  const facilityLabels = useFacilityLabelMap(granted);
  const activeFacility = session?.activeFacility && granted.includes(session.activeFacility) ? session.activeFacility : undefined;
  const facilityName = facilityLabels.getFacilityName(activeFacility);
  const userName = session?.displayName || "員工";
  const userId = session?.userId || "未登入";
  const visibleNav = getEmployeeCourtSchoolsForFacility(activeFacility, facilityName).length
    ? nav
    : nav.filter((item) => item.id !== "courts");
  const mobileItems = visibleNav.slice(0, 5);

  return (
    <div className="workbench-shell h-dvh overflow-hidden bg-[#f3f6fb]">
      <div className="flex h-full min-w-0">
        <EmployeeDesktopSidebar
          items={visibleNav}
          loading={navigation.isLoading}
          location={location}
          onNavigate={(item) => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
          userName={userName}
          userId={userId}
          collapsed={sidebarCollapsed}
        />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-20 shrink-0 border-b border-[#dfe7ef] bg-[#0d2a50] text-white shadow-[0_1px_0_rgba(255,255,255,0.05)] md:bg-white/[0.92] md:text-[#10233f] md:backdrop-blur-xl">
            <div className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  aria-label={sidebarCollapsed ? "展開側欄" : "收合側欄"}
                  aria-expanded={!sidebarCollapsed}
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10 md:bg-[#eef5ff] md:text-[#1f6fd1]"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
              <div className="hidden justify-center md:flex">
                <RoleSwitcher visualActiveRole="employee" />
              </div>
              <div className="flex min-w-0 justify-end">
                <WorkbenchNotificationBell role="employee" />
              </div>
            </div>
            <div className="border-t border-white/10 px-4 py-2 md:hidden">
              <RoleSwitcher compact visualActiveRole="employee" />
            </div>
          </header>

          <main className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-5 pb-24 sm:px-6 md:px-6 md:py-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-black leading-tight text-[#10233f] md:text-[30px]">{title}</h1>
                {subtitle ? <p className="mt-1 text-[13px] font-medium leading-5 text-[#637185]">{subtitle}</p> : null}
              </div>
              <Link href="/employee" className="workbench-focus inline-flex min-h-9 items-center rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                回首頁
              </Link>
            </div>
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e5ecf3] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
        {!mobileItems.length && navigation.isLoading ? (
          <div className="col-span-5 rounded-[8px] bg-[#f7f9fb] px-3 py-3 text-center text-[12px] font-bold text-[#637185]">導覽載入中…</div>
        ) : null}
        {mobileItems.map((item) => {
          const active = isActivePath(location, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              onClick={() => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
              className={cn(
                "workbench-focus flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-black",
                active ? "bg-[#eef5ff] text-[#1f6fd1]" : "text-[#6c7a8e]",
              )}
            >
              <item.Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <EmployeeFloatingQuickActions />
    </div>
  );
}
