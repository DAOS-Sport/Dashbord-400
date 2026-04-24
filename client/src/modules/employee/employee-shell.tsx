import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  Home,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import { facilityConfigs } from "@/config/facility-configs";
import { useAuthMe, useSwitchFacility } from "@/shared/auth/session";

type EmployeeNavItem = readonly [label: string, href: string, Icon: LucideIcon, badge?: string];

const employeeNav: readonly EmployeeNavItem[] = [
  ["首頁", "/employee", Home],
  ["交班事項", "/employee/tasks", ClipboardCheck],
  ["群組公告", "/employee/announcements", Bell, "2"],
  ["櫃台交接", "/employee/handover", MessageSquareText],
  ["今日班表", "/employee/shift", CalendarDays],
  ["更多入口", "/employee/more", MoreHorizontal],
];

const mobileNav: readonly EmployeeNavItem[] = [
  ["首頁", "/employee", Home],
  ["交班", "/employee/tasks", ClipboardCheck],
  ["公告", "/employee/announcements", Bell],
  ["交接", "/employee/handover", MessageSquareText],
  ["更多", "/employee/more", MoreHorizontal],
];

const isActivePath = (location: string, href: string) =>
  href === "/employee" ? location === href || location === "/EMPLOYEE" : location === href || location.startsWith(`${href}/`);

interface EmployeeShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

function FacilitySwitcher() {
  const { data: session } = useAuthMe();
  const switchFacility = useSwitchFacility();
  const granted = session?.grantedFacilities ?? [];
  if (granted.length <= 1) return null;

  return (
    <select
      value={session?.activeFacility ?? granted[0]}
      onChange={(event) => switchFacility.mutate(event.target.value)}
      className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f]"
      aria-label="切換館別"
    >
      {granted.map((facilityKey) => (
        <option key={facilityKey} value={facilityKey}>
          {facilityConfigs[facilityKey]?.shortName ?? facilityKey}
        </option>
      ))}
    </select>
  );
}

export function EmployeeShell({ title, subtitle, children }: EmployeeShellProps) {
  const [location] = useLocation();

  return (
    <div className="workbench-shell">
      <div className="flex min-h-dvh">
        <aside className="workbench-sidebar hidden w-[232px] shrink-0 flex-col p-5 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#17345b]">
              <Sparkles className="h-5 w-5 text-[#9dd84f]" />
            </div>
            <p className="truncate text-[17px] font-black">駿斯 Kinetic Ops</p>
          </div>

          <div className="mt-6 rounded-[8px] bg-white/8 p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[#9dd84f]">
              <span className="h-2 w-2 rounded-full bg-[#9dd84f]" />
              營運中
            </div>
            <p className="line-clamp-2 text-[13px] font-bold">新北高中游泳池 & 運動中心</p>
          </div>

          <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {employeeNav.map(([label, href, Icon, badge]) => {
              const active = isActivePath(location, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "workbench-focus flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-left text-[14px] font-bold transition",
                    active ? "bg-gradient-to-r from-[#1cb4a3] to-[#9dd84f] text-white" : "text-[#d6e2ef] hover:bg-white/10",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge ? <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ff4964] text-[10px]">{badge}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center gap-3 rounded-[8px] px-3 py-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#007166] text-[12px] font-black">駿</div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold">全端測試開發</p>
                <p className="text-[11px] text-[#b6c7d9]">員工</p>
              </div>
            </div>
            <Link href="/employee/more" className="workbench-focus flex min-h-9 w-full items-center gap-3 rounded-[8px] px-3 text-[13px] text-[#d6e2ef] hover:bg-white/10">
              <Settings className="h-4 w-4" />
              更多設定
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-[#dfe7ef] bg-[#0d2a50] text-white shadow-[0_1px_0_rgba(255,255,255,0.05)] lg:bg-white/[0.88] lg:text-[#10233f] lg:backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 lg:h-14 lg:px-7">
              <div className="flex items-center gap-3">
                <button aria-label="開啟選單" className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10 lg:hidden">
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-[15px] font-black lg:hidden">員工工作台</p>
                  <p className="hidden text-[11px] font-black uppercase tracking-[0.1em] text-[#79d146] lg:block">Employee</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden lg:block">
                  <RoleSwitcher />
                </div>
                <button aria-label="搜尋" className="workbench-focus hidden h-10 w-10 place-items-center rounded-full bg-[#f0f4f8] text-[#10233f] lg:grid">
                  <Search className="h-4 w-4" />
                </button>
                <button aria-label="通知" className="workbench-focus relative grid h-10 w-10 place-items-center rounded-full bg-white/10 lg:bg-[#f0f4f8] lg:text-[#10233f]">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff4964]" />
                </button>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#007166] text-[13px] font-black text-white">
                  <UserRound className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 px-4 py-2 lg:hidden">
              <RoleSwitcher compact />
            </div>
          </header>

          <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-black leading-tight text-[#10233f] lg:text-[30px]">{title}</h1>
                <p className="mt-1 text-[13px] font-medium leading-5 text-[#637185]">{subtitle}</p>
              </div>
              <Link href="/employee" className="workbench-focus inline-flex min-h-9 items-center rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                回首頁
              </Link>
              <FacilitySwitcher />
            </div>
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e5ecf3] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {mobileNav.map(([label, href, Icon]) => {
          const active = isActivePath(location, href);
          return (
            <Link
              key={href}
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
