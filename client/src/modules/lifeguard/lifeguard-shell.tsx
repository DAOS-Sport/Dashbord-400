import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, BookOpen, CalendarDays, FileText, GraduationCap, Home, LifeBuoy, Menu, MessageSquareText, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { NavigationModuleDto } from "@shared/modules";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import { BrandLockup } from "@/shared/brand";
import { facilityConfigs } from "@/config/facility-configs";
import { useAuthMe } from "@/shared/auth/session";
import { fetchModuleNavigation } from "@/shared/modules/api";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";
import { cn } from "@/lib/utils";

const iconByKey: Record<string, LucideIcon> = {
  home: Home,
  lifebuoy: LifeBuoy,
  "calendar-days": CalendarDays,
  bell: Bell,
  "message-square-text": MessageSquareText,
  "file-text": FileText,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  search: Search,
};

const toNavItems = (items: NavigationModuleDto[] | undefined) =>
  (items ?? []).map((item) => ({
    id: item.id,
    label: item.name,
    href: item.routePath,
    Icon: iconByKey[item.iconKey] ?? Home,
  }));

export function LifeguardShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const [location] = useLocation();
  const trackEvent = useTrackEvent();
  const { data: session } = useAuthMe();
  const navigation = useQuery({
    queryKey: ["/api/modules/navigation", "lifeguard-shell"],
    queryFn: fetchModuleNavigation,
    staleTime: 60_000,
  });
  const nav = toNavItems(navigation.data?.items);
  const mobileItems = nav.slice(0, 5);
  const facilityName = facilityConfigs[session?.activeFacility ?? "xinbei_pool"]?.facilityName ?? session?.activeFacility ?? "授權場館";

  return (
    <div className="workbench-shell h-dvh overflow-hidden bg-[#f3f6fb]">
      <div className="flex h-full min-w-0">
        <aside className="hidden h-full min-h-0 w-[232px] shrink-0 flex-col bg-[#1f3f68] px-4 py-4 text-white shadow-[20px_0_40px_-32px_rgba(13,31,55,0.7)] lg:flex">
          <BrandLockup markClassName="h-10 w-10 rounded-[8px]" titleClassName="text-[17px] text-white" />
          <div className="mt-4 rounded-[8px] bg-white/8 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-[#9dd84f]">
              <span className="h-2 w-2 rounded-full bg-[#9dd84f]" />
              值勤中
            </div>
            <p className="line-clamp-2 text-[13px] font-bold">{facilityName}</p>
            <p className="mt-1 text-[11px] text-[#b6c7d9]">Lifeguard Console</p>
          </div>
          <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {!nav.length && navigation.isLoading ? (
              <div className="rounded-[8px] bg-white/8 px-3 py-3 text-[12px] font-bold text-[#d6e2ef]">導覽載入中...</div>
            ) : null}
            {nav.map((item) => {
              const active = item.href === "/lifeguard" ? location === item.href : location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
                  className={cn(
                    "workbench-focus flex min-h-10 shrink-0 items-center gap-3 rounded-[8px] px-3 text-left text-[14px] font-bold transition",
                    active ? "bg-gradient-to-r from-[#1cb4a3] to-[#9dd84f] text-white" : "text-[#d6e2ef] hover:bg-white/10",
                  )}
                >
                  <item.Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-20 shrink-0 border-b border-[#dfe7ef] bg-[#0d2a50] text-white lg:bg-white/[0.92] lg:text-[#10233f]">
            <div className="flex h-14 w-full items-center justify-between px-4 lg:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button aria-label="開啟選單" className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10 lg:hidden">
                  <Menu className="h-5 w-5" />
                </button>
                <Link href="/lifeguard" className="hidden h-8 w-8 place-items-center rounded-[8px] border border-[#e2e9f2] bg-white text-[#8b9aae] lg:grid" aria-label="回救生首頁">
                  <Home className="h-4 w-4" />
                </Link>
                <div className="min-w-0">
                  <p className="max-w-[280px] truncate text-[15px] font-black lg:text-[13px] lg:text-[#10233f]">{facilityName}</p>
                  <p className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-[#8b9aae] lg:block">LIFEGUARD</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden lg:block">
                  <RoleSwitcher visualActiveRole="lifeguard" />
                </div>
                <button aria-label="通知" className="workbench-focus relative grid h-10 w-10 place-items-center rounded-full bg-white/10 lg:bg-[#f0f4f8] lg:text-[#10233f]">
                  <Bell className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="border-t border-white/10 px-4 py-2 lg:hidden">
              <RoleSwitcher compact visualActiveRole="lifeguard" />
            </div>
          </header>
          <main className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-5 pb-24 sm:px-6 lg:px-6 lg:py-7">
            <div className="mb-5">
              <h1 className="text-[24px] font-black leading-tight text-[#10233f] lg:text-[30px]">{title}</h1>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#637185]">{subtitle}</p>
            </div>
            {children}
          </main>
        </div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e5ecf3] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {mobileItems.map((item) => {
          const active = item.href === "/lifeguard" ? location === item.href : location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              onClick={() => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href })}
              className={cn("workbench-focus flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-black", active ? "bg-[#eef5ff] text-[#1f6fd1]" : "text-[#6c7a8e]")}
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
