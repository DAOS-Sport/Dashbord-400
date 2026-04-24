import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
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
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./role-switcher";

const roleNav = {
  supervisor: [
    ["首頁總覽", "/supervisor", Home],
    ["交班狀態", "/supervisor/tasks", ClipboardList],
    ["公告管理", "/supervisor/announcements", Bell],
    ["交接管理", "/supervisor/handover", FileText],
    ["異常審核", "/supervisor/anomalies", ShieldCheck],
    ["人力狀態", "/supervisor/people", Users],
    ["報表分析", "/supervisor/reports", BarChart3],
    ["系統設定", "/supervisor/settings", Settings],
  ],
  system: [
    ["總覽 Dashboard", "/system", Home],
    ["系統健康", "/system/health", Gauge],
    ["告警中心", "/system/alerts", Bell],
    ["整合監控", "/system/integrations", ShieldCheck],
    ["操作稽核", "/system/audit", FileText],
    ["Raw Inspector", "/system/raw-inspector", Search],
  ],
} as const;

type NavItem = readonly [label: string, href: string, Icon: LucideIcon];
type MobileNavItem = readonly [label: string, href: string, Icon: LucideIcon];

const roleMobileNav: Record<"supervisor" | "system", readonly MobileNavItem[]> = {
  supervisor: [
    ["首頁", "/supervisor", Home],
    ["交班", "/supervisor/tasks", ClipboardList],
    ["公告", "/supervisor/announcements", Bell],
    ["人力", "/supervisor/people", Users],
    ["更多", "/supervisor/reports", MoreHorizontal],
  ],
  system: [
    ["首頁", "/system", Home],
    ["健康", "/system/health", Gauge],
    ["告警", "/system/alerts", Bell],
    ["整合", "/system/integrations", ShieldCheck],
    ["更多", "/system/raw-inspector", MoreHorizontal],
  ],
};

interface RoleShellProps {
  role: "supervisor" | "system";
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function RoleShell({ role, title, subtitle, children }: RoleShellProps) {
  const [location] = useLocation();
  const nav: readonly NavItem[] = roleNav[role];
  const userLabel = role === "system" ? "System (IT)" : "張主任";
  const roleLabel = role === "system" ? "系統管理員" : "主管・台中館";

  return (
    <div className="workbench-shell">
      <div className="flex min-h-dvh">
        <aside className="workbench-sidebar hidden w-[216px] shrink-0 flex-col p-4 text-white lg:flex">
          <div className="mb-5 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#143058] text-[#9dd84f]">
              <Gauge className="h-4 w-4" />
            </div>
            <p className="text-[14px] font-black">駿斯 Kinetic Ops</p>
          </div>
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
            {nav.map(([label, href, Icon], index) => {
              const roleRoot = href === "/supervisor" || href === "/system";
              const active = roleRoot ? location === href : location === href || location.startsWith(`${href}/`);
              const rootActive = index === 0 && role === "supervisor" && location === "/";
              return (
                <Link
                  key={label}
                  href={href}
                  className={cn(
                    "workbench-focus flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-[13px] font-bold transition",
                    active || rootActive
                      ? "bg-gradient-to-r from-[#1cb4a3] to-[#9dd84f] text-white"
                      : "text-[#d8e3ef] hover:bg-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{label}</span>
                  {label.includes("異常") || label.includes("告警") ? (
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
        {roleMobileNav[role].map(([label, href, Icon]) => {
          const roleRoot = href === "/supervisor" || href === "/system";
          const active = roleRoot ? location === href : location === href || location.startsWith(`${href}/`);
          return (
            <Link
              key={String(label)}
              href={href}
              aria-label={label}
              className={cn(
                "workbench-focus flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-black",
                active ? "bg-[#eef5ff] text-[#1f6fd1]" : "text-[#6c7a8e]",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
