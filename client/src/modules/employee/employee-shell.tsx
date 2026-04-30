import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ChevronDown,
  FileText,
  GraduationCap,
  Home,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { NavigationModuleDto } from "@shared/modules";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import { facilityConfigs } from "@/config/facility-configs";
import { useAuthMe, useSwitchFacility } from "@/shared/auth/session";
import { fetchModuleNavigation } from "@/shared/modules/api";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";
import { BrandLockup } from "@/shared/brand";

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
  "shield-check": ShieldCheck,
  search: Search,
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

const isActivePath = (location: string, href: string) =>
  href === "/employee" ? location === href || location === "/EMPLOYEE" : location === href || location.startsWith(`${href}/`);

const toEmployeeNavItems = (items: NavigationModuleDto[] | undefined): EmployeeNavItem[] => {
  const apiItems = (items ?? []).filter((item) => item.routePath.startsWith("/employee"));
  const sourceById = new Map(apiItems.map((item) => [item.id, item]));

  return employeeNavigationSlots.map((slot) => {
    const source = slot.ids.map((id) => sourceById.get(id)).find(Boolean);
    const iconKey = source?.iconKey ?? slot.iconKey;
    return {
      id: source?.id ?? slot.ids[0],
      label: slot.label,
      href: slot.href,
      Icon: iconByKey[iconKey] ?? iconByKey[slot.iconKey] ?? Home,
    };
  });
};

function EmployeeDesktopSidebar({
  items,
  loading,
  location,
  onNavigate,
}: {
  items: EmployeeNavItem[];
  loading: boolean;
  location: string;
  onNavigate: (item: EmployeeNavItem) => void;
}) {
  return (
    <aside className="hidden h-full min-h-0 w-[232px] shrink-0 flex-col bg-[#1f3f68] p-5 text-white shadow-[20px_0_40px_-32px_rgba(13,31,55,0.7)] lg:flex">
      <BrandLockup markClassName="h-10 w-10 rounded-[8px]" titleClassName="text-[17px] text-white" />

      <div className="mt-6 rounded-[8px] bg-white/8 p-3">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[#9dd84f]">
          <span className="h-2 w-2 rounded-full bg-[#9dd84f]" />
          營運中
        </div>
        <p className="line-clamp-2 text-[13px] font-bold">新北高中游泳池 & 運動中心</p>
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
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
                "workbench-focus flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-left text-[14px] font-bold transition",
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
          {facilityConfigs[facilityKey]?.facilityName ?? facilityKey}
        </option>
      ))}
    </select>
  );
}

export function EmployeeShell({ title, subtitle, children }: EmployeeShellProps) {
  const [location] = useLocation();
  const trackEvent = useTrackEvent();
  const { data: session } = useAuthMe();
  const navigation = useQuery({
    queryKey: ["/api/modules/navigation", "employee-shell"],
    queryFn: fetchModuleNavigation,
    staleTime: 60_000,
  });
  const nav = toEmployeeNavItems(navigation.data?.items);
  const mobileItems = nav.slice(0, 5);

  return (
    <div className="workbench-shell h-dvh overflow-hidden bg-[#f3f6fb]">
      <div className="flex h-full min-w-0">
        <EmployeeDesktopSidebar
          items={nav}
          loading={navigation.isLoading}
          location={location}
          onNavigate={(item) => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
        />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-20 shrink-0 border-b border-[#dfe7ef] bg-[#0d2a50] text-white shadow-[0_1px_0_rgba(255,255,255,0.05)] lg:bg-white/[0.92] lg:text-[#10233f] lg:backdrop-blur-xl">
            <div className="flex h-14 w-full items-center justify-between px-4 lg:h-14 lg:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button aria-label="開啟選單" className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10 lg:hidden">
                  <Menu className="h-5 w-5" />
                </button>
                <Link href="/employee" className="hidden h-8 w-8 place-items-center rounded-[8px] border border-[#e2e9f2] bg-white text-[#8b9aae] lg:grid" aria-label="回員工首頁">
                  <Home className="h-4 w-4" />
                </Link>
                <div className="min-w-0">
                  <p className="max-w-[180px] truncate text-[15px] font-black sm:max-w-[280px] lg:max-w-[300px] lg:text-[13px] lg:text-[#10233f]">{facilityConfigs[session?.activeFacility ?? "xinbei_pool"]?.facilityName ?? "新北泳池館"}</p>
                  <p className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-[#8b9aae] lg:block">Dashboard</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden lg:block">
                  <RoleSwitcher visualActiveRole="employee" />
                </div>
                <div className="hidden md:block">
                  <FacilitySwitcher />
                </div>
                <button className="workbench-focus hidden min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] lg:inline-flex">
                  員工
                  <ChevronDown className="h-3.5 w-3.5 text-[#8b9aae]" />
                </button>
                <button aria-label="通知" className="workbench-focus relative grid h-10 w-10 place-items-center rounded-full bg-white/10 lg:bg-[#f0f4f8] lg:text-[#10233f]">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#ff4964] text-[9px] font-black text-white">4</span>
                </button>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#32d17c] text-[13px] font-black text-white">
                  {session?.displayName?.slice(0, 1) || <UserRound className="h-4 w-4" />}
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 px-4 py-2 lg:hidden">
              <RoleSwitcher compact visualActiveRole="employee" />
            </div>
          </header>

          <main className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-5 pb-24 sm:px-6 lg:px-6 lg:py-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-black leading-tight text-[#10233f] lg:text-[30px]">{title}</h1>
                {subtitle ? <p className="mt-1 text-[13px] font-medium leading-5 text-[#637185]">{subtitle}</p> : null}
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
    </div>
  );
}
