import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  GraduationCap,
  Home,
  BarChart3,
  Menu,
  MoreHorizontal,
  Megaphone,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { NavigationModuleDto } from "@shared/modules";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./role-switcher";
import { fetchModuleNavigation } from "@/shared/modules/api";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";
import { BrandLockup } from "@/shared/brand";

type NavItem = {
  id: string;
  label: string;
  href: string;
  Icon: LucideIcon;
};

const iconByKey: Record<string, LucideIcon> = {
  home: Home,
  bell: Bell,
  "clipboard-check": ClipboardList,
  "message-square-text": FileText,
  "file-text": FileText,
  "graduation-cap": GraduationCap,
  gauge: Gauge,
  "shield-check": ShieldCheck,
  search: Search,
  link: MoreHorizontal,
  building: Building2,
  megaphone: Megaphone,
  users: Users,
};

type NavigationSlot = {
  ids: string[];
  label: string;
  href: string;
  iconKey: string;
};

const systemNavigationSlots: NavigationSlot[] = [
  { ids: ["system-dashboard", "dashboard"], label: "系統總覽", href: "/system", iconKey: "gauge" },
  { ids: ["system-health"], label: "系統健康", href: "/system/health", iconKey: "gauge" },
  { ids: ["system-observability", "watchdog-events"], label: "告警中心", href: "/system/alerts", iconKey: "bell" },
  {
    ids: ["integration-sync-jobs", "linebot-integration", "schedule-integration", "ragic-integration"],
    label: "整合狀態",
    href: "/system/integrations",
    iconKey: "link",
  },
  { ids: ["telemetry-audit"], label: "Audit / Telemetry", href: "/system/audit", iconKey: "shield-check" },
  { ids: ["raw-inspector"], label: "Raw Inspector", href: "/system/raw-inspector", iconKey: "shield-check" },
  { ids: ["employee-training"], label: "教材觀看紀錄", href: "/system/training-views", iconKey: "graduation-cap" },
];

const supervisorNavigationSlots: NavigationSlot[] = [
  { ids: ["supervisor-dashboard", "dashboard"], label: "營運總覽", href: "/supervisor", iconKey: "home" },
  { ids: ["facilities"], label: "場館", href: "/supervisor/facilities", iconKey: "building" },
  { ids: ["tasks"], label: "任務管理", href: "/supervisor/tasks", iconKey: "clipboard-check" },
  { ids: ["announcements", "announcement-review"], label: "公告管理", href: "/supervisor/announcements", iconKey: "megaphone" },
  { ids: ["handover"], label: "櫃台交接", href: "/supervisor/handover", iconKey: "message-square-text" },
  { ids: ["employee-training"], label: "員工教材", href: "/supervisor/training", iconKey: "graduation-cap" },
  { ids: ["anomalies"], label: "異常審核", href: "/supervisor/anomalies", iconKey: "shield-check" },
  { ids: ["analytics"], label: "報表", href: "/supervisor/reports", iconKey: "gauge" },
];

const fromNavigationModule = (item: NavigationModuleDto): NavItem => ({
  id: item.id,
  label: item.name,
  href: item.routePath,
  Icon: iconByKey[item.iconKey] ?? Home,
});

const toSystemNavItems = (items: NavigationModuleDto[] | undefined): NavItem[] => {
  const systemItems = (items ?? []).filter((item) => item.routePath.startsWith("/system"));
  const systemItemsById = new Map(systemItems.map((item) => [item.id, item]));

  return systemNavigationSlots.map((slot) => {
    const item = slot.ids.map((id) => systemItemsById.get(id)).find(Boolean);
    return item
      ? {
          ...fromNavigationModule(item),
          label: slot.label,
          href: slot.href,
          Icon: iconByKey[item.iconKey] ?? iconByKey[slot.iconKey] ?? Home,
        }
      : {
          id: slot.ids[0],
          label: slot.label,
          href: slot.href,
          Icon: iconByKey[slot.iconKey] ?? Home,
        };
  });
};

const toRoleNavItems = (role: "supervisor" | "system", items: NavigationModuleDto[] | undefined): NavItem[] => {
  if (role === "system") {
    return toSystemNavItems(items);
  }

  const supervisorItems = (items ?? []).filter((item) => item.routePath.startsWith("/supervisor"));
  const supervisorItemsById = new Map(supervisorItems.map((item) => [item.id, item]));
  return supervisorNavigationSlots.map((slot) => {
    const item = slot.ids.map((id) => supervisorItemsById.get(id)).find(Boolean);
    return item
      ? {
          ...fromNavigationModule(item),
          label: slot.label,
          href: slot.href,
          Icon: iconByKey[item.iconKey] ?? iconByKey[slot.iconKey] ?? Home,
        }
      : {
          id: slot.ids[0],
          label: slot.label,
          href: slot.href,
          Icon: iconByKey[slot.iconKey] ?? Home,
        };
  });
};

interface RoleShellProps {
  role: "supervisor" | "system";
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function RoleShell({ role, title, subtitle, children }: RoleShellProps) {
  const [location] = useLocation();
  const trackEvent = useTrackEvent();
  const navigation = useQuery({
    queryKey: ["/api/modules/navigation", role],
    queryFn: fetchModuleNavigation,
    staleTime: 60_000,
  });
  const nav = toRoleNavItems(role, navigation.data?.items);
  const mobileItems = nav.slice(0, 5);
  const userLabel = role === "system" ? "System (IT)" : "主管工作台";
  const roleLabel = role === "system" ? "系統管理員" : "營運主管";
  const supervisorShell = role === "supervisor";

  return (
    <div className={cn("workbench-shell h-dvh overflow-hidden bg-[#f3f6fb]", supervisorShell && "supervisor-workbench")}>
      <div className="flex h-full min-w-0">
        <aside className="workbench-sidebar hidden h-full min-h-0 w-[220px] shrink-0 flex-col gap-4 p-[18px_14px] text-white lg:flex">
          <BrandLockup className="px-1 pb-1" markClassName="h-[26px] w-[26px] rounded-[7px]" titleClassName="text-[16px] text-white" />
          <div className="rounded-[10px] border border-white/10 bg-white/[0.04] p-3 text-[12px] leading-5 text-[#b8c8da]">
            <div className="mb-2 flex items-center gap-2 font-black text-white">
              <span className="h-[7px] w-[7px] rounded-full bg-[#2f9e5b] shadow-[0_0_0_3px_rgba(47,158,91,0.18)]" />
              營運中
            </div>
            <p className="truncate font-bold text-[#d9e4ef]">授權場館工作台</p>
            <p className="truncate text-[11px] text-[#9eacbc]">Supervisor Console</p>
          </div>
          <div className="flex items-center gap-3 rounded-[10px] bg-white/[0.04] p-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#2f9e5b] text-white">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-black">{userLabel}</p>
              <p className="truncate text-[11px] text-[#b8c8da]">{roleLabel}</p>
            </div>
          </div>
          <div className="px-2 text-[9.5px] font-black uppercase tracking-[0.18em] text-[#9eacbc]">MAIN</div>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {!nav.length && navigation.isLoading ? (
              <div className="rounded-[8px] bg-white/8 px-3 py-3 text-[12px] font-bold text-[#d8e3ef]">導覽載入中...</div>
            ) : null}
            {nav.map((item, index) => {
              const roleRoot = item.href === "/supervisor" || item.href === "/system";
              const active = roleRoot ? location === item.href : location === item.href || location.startsWith(`${item.href}/`);
              const rootActive = index === 0 && role === "supervisor" && location === "/";
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
                  className={cn(
                    "workbench-focus flex min-h-10 items-center gap-3 rounded-[6px] px-3 text-[13.5px] font-bold transition",
                    active || rootActive
                      ? "bg-[#2f9e5b] text-white"
                      : "text-[#d8e3ef] hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <item.Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                  {item.label.includes("異常") || item.label.includes("告警") ? (
                    <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-[#ff4964] text-[10px]">5</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-white/10 pt-3">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-[#2f9e5b] text-[11px] font-black text-white">駿</div>
              <div className="min-w-0 text-[12px] leading-4">
                <p className="truncate font-black text-white">營運主管</p>
                <p className="truncate text-[11px] text-[#9eacbc]">Supervisor</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden pb-20 lg:pb-0">
          <header className="z-20 shrink-0 border-b border-[#dfe7ef] bg-[#0d2a50] text-white shadow-[0_1px_0_rgba(255,255,255,0.05)] lg:bg-white lg:text-[#102940]">
            <div className="flex h-14 w-full items-center justify-between gap-3 px-4 lg:h-14 lg:px-6">
              <div className="flex items-center gap-3">
                <button aria-label="開啟選單" className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] bg-white/10 lg:hidden">
                  <Menu className="h-5 w-5" />
                </button>
                <div className="hidden min-w-0 items-center gap-3 lg:flex">
                  <div className="grid h-8 w-8 place-items-center rounded-[6px] border border-[#e5e8ec] bg-[#fafbfc] text-[#4b596a]">
                    <Home className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-black">{role === "system" ? "系統管理" : "主管營運工作台"}</p>
                    <p className="text-[9.5px] font-black uppercase tracking-[0.18em] text-[#7c8998]">{role === "system" ? "SYSTEM" : "SUPERVISOR"}</p>
                  </div>
                </div>
                <p className="text-[15px] font-black lg:hidden">{role === "system" ? "IT 治理台" : "主管控制台"}</p>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <div className="hidden lg:block">
                  <RoleSwitcher />
                </div>
                <button aria-label="搜尋" className="workbench-focus hidden h-9 w-9 place-items-center rounded-full bg-[#f0f4f8] lg:grid">
                  <Search className="h-4 w-4" />
                </button>
                <button aria-label="通知" className="workbench-focus relative grid h-9 w-9 place-items-center rounded-full bg-white/10 lg:bg-[#f0f4f8]">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff4964]" />
                </button>
                <div className="hidden min-w-0 items-center gap-2 border-l border-[#e5e8ec] pl-2 text-[12px] font-bold text-[#4b596a] lg:flex">
                  <span className="max-w-[160px] truncate">全端測試開發</span>
                  <span className="rounded-[6px] bg-[#102940] px-2 py-1 text-[10px] font-black text-white">/{role === "system" ? "SYSTEM" : "SUPERVISOR"}</span>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#2f9e5b] text-[12px] font-black text-white">駿</div>
              </div>
            </div>
          </header>

          <main className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 lg:px-6 lg:py-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#2f9e5b]">{role === "system" ? "SYSTEM WORKBENCH" : "SUPERVISOR WORKBENCH"}</p>
                <h1 className="text-[24px] font-black leading-tight text-[#102940] lg:text-[30px]">{title}</h1>
                <p className="mt-1 max-w-[820px] text-[13px] font-medium leading-5 text-[#667386]">{subtitle}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2 text-[12px]">
                <div className="lg:hidden">
                  <RoleSwitcher compact />
                </div>
                <button className="workbench-focus min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 font-bold text-[#536175]">2026/04/23</button>
                <button className="workbench-focus min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 font-bold text-[#536175]">台中館</button>
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e5ecf3] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {!mobileItems.length && navigation.isLoading ? (
          <div className="col-span-5 rounded-[8px] bg-[#f7f9fb] px-3 py-3 text-center text-[12px] font-bold text-[#637185]">導覽載入中...</div>
        ) : null}
        {mobileItems.map((item) => {
          const roleRoot = item.href === "/supervisor" || item.href === "/system";
          const active = roleRoot ? location === item.href : location === item.href || location.startsWith(`${item.href}/`);
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
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
