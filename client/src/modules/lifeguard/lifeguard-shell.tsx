import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, Camera, ChevronUp, ClipboardList, Droplets, Home, LifeBuoy, LogOut, Menu, MessageSquareText, PackageSearch, Waves, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { WorkbenchGlobalSearch } from "@/modules/workbench/workbench-global-search";
import { WorkbenchFacilitySwitcher } from "@/modules/workbench/workbench-facility-switcher";
import { WorkbenchNotificationBell } from "@/modules/workbench/workbench-notification-bell";
import { BrandLockup } from "@/shared/brand";
import { useAuthMe, useLogout } from "@/shared/auth/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFacilityLabelMap } from "@/shared/auth/facility-labels";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";
import { cn } from "@/lib/utils";
import { lifeguardOperationModules } from "./operation-modules";

const iconByKey: Record<string, LucideIcon> = {
  home: Home,
  lifebuoy: LifeBuoy,
  bell: Bell,
  droplets: Droplets,
  camera: Camera,
  "clipboard-list": ClipboardList,
  waves: Waves,
  "package-search": PackageSearch,
  "calendar-days": CalendarDays,
  "message-square-text": MessageSquareText,
};

const primaryNav = [
  { id: "lifeguard-home", label: "首頁", href: "/lifeguard", Icon: Home },
  ...lifeguardOperationModules.map((module) => ({
    id: module.id,
    label: module.label,
    href: module.href,
    Icon: iconByKey[module.iconKey] ?? LifeBuoy,
  })),
];

const secondaryNav = [
  { id: "handover", label: "交辦事項", href: "/lifeguard/handover", Icon: MessageSquareText },
];

const currentShiftLabel = () => {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 5 && hour < 12) return "早班";
  if (hour >= 12 && hour < 17) return "午班";
  return "晚班";
};

const isActivePath = (location: string, href: string) =>
  href === "/lifeguard" ? location === href : location === href || location.startsWith(`${href}/`);

function MobileDrawer({
  open,
  onClose,
  title,
  facilityName,
  items,
  location,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  facilityName: string;
  items: Array<{ id: string; label: string; href: string; Icon: LucideIcon }>;
  location: string;
  onNavigate: (item: { id: string; href: string }) => void;
}) {
  const [, setLocation] = useLocation();
  const logout = useLogout();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-[#10233f]/42" aria-label="關閉選單" onClick={onClose} />
      <aside className="absolute bottom-0 left-0 top-0 flex w-[86vw] max-w-[360px] flex-col bg-white shadow-[24px_0_72px_-42px_rgba(13,42,80,0.78)]">
        <div className="shrink-0 bg-[#0d2a50] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <BrandLockup markClassName="h-10 w-10 rounded-[8px]" titleClassName="text-[17px] text-white" />
            <button type="button" onClick={onClose} className="workbench-focus grid h-12 w-12 place-items-center rounded-[12px] bg-white/10" aria-label="關閉選單">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 rounded-[12px] bg-white/10 p-3">
            <p className="flex items-center gap-2 text-[12px] font-black text-[#9dd84f]"><span className="h-2 w-2 rounded-full bg-[#9dd84f]" />值勤中</p>
            <p className="mt-1 line-clamp-2 text-[15px] font-black">{facilityName}</p>
            <p className="mt-1 text-[12px] font-bold text-[#c9d7e6]">{currentShiftLabel()} · 救生員</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">場館</p>
            <WorkbenchFacilitySwitcher compact tone="lifeguard" className="min-h-[48px] w-full text-[14px]" />
          </div>
          <div className="my-4 border-t border-[#e6edf5]" />
          <nav className="grid gap-2">
            {[...items, ...secondaryNav].map((item) => {
              const active = isActivePath(location, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    onNavigate(item);
                    onClose();
                  }}
                  className={cn(
                    "workbench-focus flex min-h-[56px] items-center gap-3 rounded-[12px] px-3 text-[15px] font-black transition",
                    active ? "bg-[#e8fbf7] text-[#007166]" : "bg-[#f7f9fb] text-[#10233f] hover:bg-[#eef4f8]",
                  )}
                >
                  <item.Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="shrink-0 border-t border-[#e6edf5] p-4">
          <button
            type="button"
            onClick={() => logout.mutate(undefined, { onSuccess: () => setLocation("/login") })}
            className="workbench-focus flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[12px] border border-[#dfe7ef] bg-white text-[15px] font-black text-[#536175]"
          >
            <LogOut className="h-5 w-5" />
            登出
          </button>
        </div>
      </aside>
    </div>
  );
}

function MobileMoreDrawer({
  open,
  onClose,
  location,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  location: string;
  onNavigate: (item: { id: string; href: string }) => void;
}) {
  if (!open) return null;
  const moreItems = [
    ...lifeguardOperationModules.map((module) => ({ id: module.id, label: module.label, href: module.href, Icon: module.Icon, helper: module.helper })),
    ...secondaryNav.map((item) => ({ ...item, helper: "交接追蹤" })),
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="更多救生入口">
      <button type="button" className="absolute inset-0 bg-[#10233f]/36" aria-label="關閉更多入口" onClick={onClose} />
      <aside className="absolute bottom-0 left-0 right-0 max-h-[82dvh] rounded-t-[24px] bg-white p-4 shadow-[0_-24px_72px_-44px_rgba(13,42,80,0.72)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#d6e1ec]" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[18px] font-black text-[#10233f]">更多救生入口</p>
            <p className="mt-1 text-[13px] font-bold text-[#637185]">水道、租借、作業紀錄</p>
          </div>
          <button type="button" onClick={onClose} className="workbench-focus grid h-12 w-12 place-items-center rounded-[12px] bg-[#f2f6fa]" aria-label="關閉">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[60dvh] gap-2 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {moreItems.map((item) => {
            const active = isActivePath(location, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => {
                  onNavigate(item);
                  onClose();
                }}
                className={cn(
                  "workbench-focus flex min-h-[58px] items-center gap-3 rounded-[14px] px-3 text-left transition",
                  active ? "bg-[#e8fbf7] text-[#007166]" : "bg-[#f7f9fb] text-[#10233f] hover:bg-[#eef4f8]",
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white text-inherit shadow-sm">
                  <item.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-black">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[12px] font-bold text-[#637185]">{item.helper}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export function LifeguardShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const trackEvent = useTrackEvent();
  const { data: session } = useAuthMe();
  const { logout } = useLogout();
  const granted = session?.grantedFacilities ?? [];
  const facilityLabels = useFacilityLabelMap(granted);
  const activeFacility = session?.activeFacility && granted.includes(session.activeFacility) ? session.activeFacility : undefined;
  const facilityName = facilityLabels.getFacilityName(activeFacility);
  const userName = session?.displayName || "救生員";
  const shiftName = currentShiftLabel();
  const waterModule = lifeguardOperationModules.find((module) => module.id === "water-quality")!;
  const photoModule = shiftName === "晚班" ? lifeguardOperationModules.find((module) => module.id === "cleanup")! : lifeguardOperationModules.find((module) => module.id === "coach-dive")!;
  const lostModule = lifeguardOperationModules.find((module) => module.id === "lost-and-found")!;
  const mobileNav = [
    { id: "lifeguard-home", label: "首頁", href: "/lifeguard", Icon: Home, kind: "link" as const },
    { id: waterModule.id, label: "水質", href: waterModule.href, Icon: waterModule.Icon, kind: "link" as const },
    { id: photoModule.id, label: "拍照", href: photoModule.href, Icon: Camera, kind: "primary" as const },
    { id: lostModule.id, label: "失物", href: lostModule.href, Icon: lostModule.Icon, kind: "link" as const },
    { id: "lifeguard-more", label: "更多", href: "#", Icon: Menu, kind: "more" as const },
  ];

  const trackNavigate = (item: { id: string; href: string }) => trackEvent("NAV_CLICK", { moduleId: item.id, moduleRoute: item.href });

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
            <p className="px-3 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8fb2ce]">救生作業</p>
            {primaryNav.map((item) => {
              const active = isActivePath(location, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => trackNavigate(item)}
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
            <div className="my-2 border-t border-white/10" />
            {secondaryNav.map((item) => {
              const active = isActivePath(location, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => trackNavigate(item)}
                  className={cn(
                    "workbench-focus flex min-h-10 shrink-0 items-center gap-3 rounded-[8px] px-3 text-left text-[14px] font-bold transition",
                    active ? "bg-white/14 text-white" : "text-[#d6e2ef] hover:bg-white/10",
                  )}
                >
                  <item.Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
                    <p className="truncate text-[11px] text-[#b6c7d9]">{session?.userId || "未登入"} · 救生員</p>
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
        </aside>
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-20 shrink-0 border-b border-[#dfe7ef] bg-[#0d2a50] text-white lg:bg-white/[0.92] lg:text-[#10233f]">
            <div className="flex h-16 w-full items-center justify-between gap-2 px-2 lg:h-14 lg:px-6">
              <div className="flex min-w-0 items-center gap-2 lg:gap-3">
                <button aria-label="開啟選單" onClick={() => setMobileMenuOpen(true)} className="workbench-focus grid h-14 w-14 shrink-0 place-items-center rounded-[14px] bg-white/10 lg:hidden">
                  <Menu className="h-6 w-6" />
                </button>
                <WorkbenchFacilitySwitcher tone="lifeguard" className="w-[172px] max-w-[54vw]" />
              </div>
              <div className="flex items-center gap-2">
                <WorkbenchGlobalSearch role="lifeguard" />
                <WorkbenchNotificationBell role="lifeguard" />
              </div>
            </div>
          </header>
          <main className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-4 pb-24 sm:px-6 lg:px-6 lg:py-7">
            <div className="mb-5 hidden lg:block">
              <h1 className="text-[30px] font-black leading-tight text-[#10233f]">{title}</h1>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#637185]">{subtitle}</p>
            </div>
            {children}
          </main>
        </div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e5ecf3] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {mobileNav.map((item) => {
          const active = item.kind === "more" ? mobileMoreOpen : isActivePath(location, item.href);
          const Icon = item.Icon;
          if (item.kind === "more") {
            return (
              <button
                key={item.id}
                type="button"
                aria-label="更多救生入口"
                aria-expanded={mobileMoreOpen}
                onClick={() => setMobileMoreOpen(true)}
                className={cn("workbench-focus flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[14px] text-[11px] font-black", active ? "bg-[#eef5ff] text-[#1f6fd1]" : "text-[#6c7a8e]")}
              >
                <Icon className="h-6 w-6" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={item.label}
              onClick={() => trackNavigate(item)}
              className={cn(
                "workbench-focus flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[14px] text-[11px] font-black transition",
                item.kind === "primary" ? "-mt-4 bg-[#15935d] text-white shadow-[0_10px_24px_-12px_rgba(21,147,93,0.8)]" : active ? "bg-[#eef5ff] text-[#1f6fd1]" : "text-[#6c7a8e]",
              )}
            >
              <Icon className={cn("h-6 w-6", item.kind === "primary" && "h-7 w-7")} />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="救生員選單"
        facilityName={facilityName}
        items={primaryNav}
        location={location}
        onNavigate={trackNavigate}
      />
      <MobileMoreDrawer open={mobileMoreOpen} onClose={() => setMobileMoreOpen(false)} location={location} onNavigate={trackNavigate} />
    </div>
  );
}
