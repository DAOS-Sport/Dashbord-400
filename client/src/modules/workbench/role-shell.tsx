import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ClipboardList,
  FileText,
  Gauge,
  Home,
  BarChart3,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
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
  gauge: Gauge,
  "shield-check": ShieldCheck,
  search: Search,
  link: MoreHorizontal,
};

const toRoleNavItems = (role: "supervisor" | "system", items: NavigationModuleDto[] | undefined): NavItem[] =>
  (items ?? [])
    .filter((item) => item.routePath.startsWith(`/${role}`))
    .map((item) => ({
      id: item.id,
      label: item.name,
      href: item.routePath,
      Icon: iconByKey[item.iconKey] ?? Home,
    }));

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
  const userLabel = role === "system" ? "System (IT)" : "張主任";
  const roleLabel = role === "system" ? "系統管理員" : "主管・台中館";

  return (
    <div className="workbench-shell">
      <div className="flex min-h-dvh">
        <aside className="workbench-sidebar hidden w-[216px] shrink-0 flex-col p-4 text-white lg:flex">
          <BrandLockup className="mb-5" markClassName="h-8 w-8 rounded-[8px]" titleClassName="text-[14px] text-white" />
          <div className="mb-5 flex items-center gap-3 rounded-[8px] bg-white/8 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-[#1f3f68]">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-black">{userLabel}</p>
              <p className="truncate text-[11px] text-[#b8c8da]">{roleLabel}</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
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
                    "workbench-focus flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-[13px] font-bold transition",
                    active || rootActive
                      ? "bg-gradient-to-r from-[#1cb4a3] to-[#9dd84f] text-white"
                      : "text-[#d8e3ef] hover:bg-white/10",
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
        </aside>

        <div className="min-w-0 flex-1 pb-20 lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-[#dfe7ef] bg-[#0d2a50] text-white shadow-[0_1px_0_rgba(255,255,255,0.05)] lg:bg-white/[0.88] lg:text-[#10233f] lg:backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-4 lg:h-12 lg:px-6">
              <div className="flex items-center gap-3">
                <button aria-label="開啟選單" className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] bg-white/10 lg:hidden">
                  <Menu className="h-5 w-5" />
                </button>
                <div className="hidden lg:block">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#79d146]">{role === "system" ? "Overview" : "Dashboard"}</p>
                </div>
                <p className="text-[15px] font-black lg:hidden">{role === "system" ? "IT 治理台" : "主管控制台"}</p>
              </div>
              <div className="flex items-center gap-2">
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
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#007166] text-[12px] font-black text-white">駿</div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 lg:px-6 lg:py-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-black leading-tight text-[#10233f] lg:text-[30px]">{title}</h1>
                <p className="mt-1 text-[13px] font-medium text-[#637185]">{subtitle}</p>
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
