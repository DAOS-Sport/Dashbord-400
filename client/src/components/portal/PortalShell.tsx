import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { usePortalAuth } from "@/hooks/use-bound-facility";
import { getFacilityConfig } from "@/config/facility-configs";
import { trackPortalEvent } from "@/hooks/usePortalData";
import companyLogo from "@assets/logo_(1)_1776402178727.jpg";

interface PortalShellProps {
  children: (ctx: { searchTerm: string }) => React.ReactNode;
  facilityKey: string;
  pageTitle?: string;
}

interface NavItem {
  label: string;
  icon: string;
  path: string;
  supervisorOnly?: boolean;
}

const SIDE_NAV: NavItem[] = [
  { label: "首頁", icon: "dashboard", path: "" },
  { label: "救生員日誌", icon: "assignment", path: "/work-log" },
  { label: "櫃台交接", icon: "swap_horiz", path: "/handover" },
  { label: "群組公告", icon: "campaign", path: "/announcements" },
  { label: "活動檔期", icon: "event", path: "/campaigns" },
  { label: "班表入口", icon: "badge", path: "/shift" },
  { label: "公告審核", icon: "fact_check", path: "/review", supervisorOnly: true },
  { label: "後台管理", icon: "admin_panel_settings", path: "/manage", supervisorOnly: true },
];

const TOP_NAV: { label: string; key: string }[] = [
  { label: "DASHBOARD", key: "" },
  { label: "ACTIVITY", key: "/announcements" },
  { label: "DIRECTORY", key: "/handover" },
];

function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden>
      {name}
    </span>
  );
}

export default function PortalShell({ children, facilityKey, pageTitle }: PortalShellProps) {
  const { auth, logout } = usePortalAuth();
  const [location, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const config = getFacilityConfig(facilityKey);
  const basePath = `/portal/${facilityKey}`;

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // 自動 pageview 追蹤
  useEffect(() => {
    if (!auth) return;
    const subPath = location.replace(basePath, "") || "/";
    trackPortalEvent(
      { eventType: "pageview", target: subPath, targetLabel: pageTitle },
      { employeeNumber: auth.employeeNumber, employeeName: auth.name, facilityKey },
    );
  }, [location, basePath, auth, facilityKey, pageTitle]);

  const visibleSideNav = SIDE_NAV.filter((it) => !it.supervisorOnly || auth?.isSupervisor);

  const handleLogout = () => {
    logout();
    navigate("/portal/login");
  };

  const isPathActive = (sub: string) => {
    const full = basePath + sub;
    if (sub === "") return location === basePath || location === basePath + "/";
    return location === full || location.startsWith(full + "/");
  };

  return (
    <div className="portal min-h-screen bg-stitch-surface text-stitch-on-surface">
      {/* Top Nav */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 md:px-8"
        style={{ background: "rgba(0,29,66,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
        data-testid="portal-topbar"
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-slate-200 hover:bg-white/10"
            onClick={() => setMobileOpen((s) => !s)}
            data-testid="button-mobile-menu"
            aria-label="開啟選單"
          >
            <MaterialIcon name={mobileOpen ? "close" : "menu"} />
          </button>
          <Link href="/employee">
            <button
              type="button"
              className="flex items-center gap-1 px-2.5 h-9 rounded-lg text-slate-200 hover:bg-white/10 text-sm"
              data-testid="link-back-workbench"
              title="返回工作台"
            >
              <MaterialIcon name="arrow_back" className="text-base" />
              <span className="hidden sm:inline">返回工作台</span>
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <img
              src={companyLogo}
              alt="駿斯運動事業 Logo"
              className="w-9 h-9 rounded-xl object-cover"
              data-testid="img-portal-logo"
            />
            <span
              className="text-white font-headline text-xl md:text-2xl font-black tracking-tight"
              data-testid="text-portal-brand"
            >
              駿斯 <span className="text-stitch-tertiary">Kinetic</span> Ops
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-2">
          {TOP_NAV.map((it) => {
            const active = isPathActive(it.key);
            return (
              <Link key={it.key} href={basePath + it.key}>
                <span
                  className={`px-3 py-1.5 cursor-pointer portal-label transition-colors ${
                    active
                      ? "text-stitch-tertiary border-b-2 border-stitch-tertiary"
                      : "text-slate-300 hover:text-white"
                  }`}
                  data-testid={`link-topnav-${it.label}`}
                >
                  {it.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden md:flex items-center bg-white/5 rounded-full pl-3 pr-2 h-9 w-64">
            <MaterialIcon name="search" className="text-slate-400 text-base" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋公告 / 交接 / 活動..."
              className="bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-500 ml-2 flex-1 min-w-0"
              data-testid="input-portal-search"
            />
          </div>
          <button className="p-2 rounded-full text-slate-300 hover:bg-white/10" data-testid="button-notifications" aria-label="通知">
            <MaterialIcon name="notifications" />
          </button>
          {auth && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #006b60, #19335a)" }}
              data-testid="text-user-avatar"
              title={auth.name}
            >
              {auth.name?.charAt(0) || "U"}
            </div>
          )}
        </div>
      </header>

      {/* Mobile search */}
      <div className="md:hidden fixed top-16 left-0 right-0 z-40 px-4 py-2 bg-stitch-primary/85 backdrop-blur-xl">
        <div className="flex items-center bg-white/5 rounded-full pl-3 pr-2 h-9">
          <MaterialIcon name="search" className="text-slate-400 text-base" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋..."
            className="bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-500 ml-2 flex-1 min-w-0"
            data-testid="input-portal-search-mobile"
          />
        </div>
      </div>

      {/* Side Nav */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 z-30 pt-20 pb-4"
        style={{
          background: "rgba(25,51,90,0.85)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          borderTopRightRadius: "1.5rem",
          borderBottomRightRadius: "1.5rem",
        }}
        data-testid="portal-sidebar"
      >
        <div className="px-5 mb-6">
          <div className="rounded-2xl p-4 warm-glow" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: "#9dd84f" }} />
              <span className="text-stitch-tertiary text-[10px] font-bold tracking-[0.12em] uppercase">當班中</span>
            </div>
            <div className="flex items-center gap-3">
              <img
                src={companyLogo}
                alt="logo"
                className="w-10 h-10 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="h-display-tc text-white text-base leading-tight truncate" data-testid="text-facility-name">
                  {config?.facilityName || "未設定館別"}
                </div>
                {config?.area && (
                  <div className="text-slate-300 text-[11px] mt-0.5">{config.area}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {visibleSideNav.map((it) => {
            const active = isPathActive(it.path);
            return (
              <Link key={it.label} href={basePath + it.path}>
                <span
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm cursor-pointer transition-all ${
                    active
                      ? "text-white font-semibold shadow-teal-glow"
                      : "text-slate-300 hover:text-stitch-tertiary hover:bg-white/10"
                  }`}
                  style={
                    active
                      ? { background: "linear-gradient(135deg, #006b60, #9dd84f)" }
                      : undefined
                  }
                  data-testid={`link-sidebar-${it.label}`}
                >
                  <MaterialIcon name={it.icon} className="text-[20px]" />
                  <span>{it.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 mt-auto pt-4">
          {auth && (
            <div className="flex items-center gap-3 px-4 py-2 mb-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: "#006b60" }}
              >
                {auth.name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <div className="text-white text-xs font-medium truncate" data-testid="text-sidebar-user">
                  {auth.name}
                </div>
                <div className="text-slate-400 text-[10px]">{auth.role || "員工"}</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 rounded-full text-slate-300 hover:text-red-300 hover:bg-white/5 text-sm transition-colors"
            data-testid="button-logout"
          >
            <MaterialIcon name="logout" className="text-[18px]" />
            <span>登出</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
            data-testid="overlay-mobile-menu"
          />
          <aside
            className="md:hidden fixed left-0 top-16 bottom-0 w-64 z-50 p-3 space-y-1 overflow-y-auto"
            style={{ background: "rgba(25,51,90,0.98)", borderTopRightRadius: "1.5rem", borderBottomRightRadius: "1.5rem" }}
          >
            {visibleSideNav.map((it) => {
              const active = isPathActive(it.path);
              return (
                <Link key={it.label} href={basePath + it.path}>
                  <span
                    className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm cursor-pointer ${
                      active ? "text-white font-semibold" : "text-slate-300"
                    }`}
                    style={active ? { background: "linear-gradient(135deg, #006b60, #9dd84f)" } : undefined}
                    data-testid={`link-mobile-${it.label}`}
                  >
                    <MaterialIcon name={it.icon} className="text-[20px]" />
                    <span>{it.label}</span>
                  </span>
                </Link>
              );
            })}
          </aside>
        </>
      )}

      {/* Main */}
      <main className="md:ml-64 pt-28 md:pt-24 pb-24 md:pb-12 px-4 md:px-8 max-w-[1600px]">
        {pageTitle && (
          <h1
            className="font-headline text-3xl md:text-5xl font-black text-stitch-primary tracking-tight mb-6 md:mb-8"
            data-testid="text-page-title"
          >
            {pageTitle}
          </h1>
        )}
        {children({ searchTerm })}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-16"
        style={{ background: "rgba(0,29,66,0.95)", backdropFilter: "blur(20px)" }}
        data-testid="portal-bottom-nav"
      >
        {visibleSideNav.slice(0, 5).map((it) => {
          const active = isPathActive(it.path);
          return (
            <Link key={it.label} href={basePath + it.path}>
              <span
                className={`flex flex-col items-center gap-0.5 cursor-pointer ${
                  active ? "text-stitch-tertiary" : "text-slate-400"
                }`}
                data-testid={`link-bottom-${it.label}`}
              >
                <MaterialIcon name={it.icon} className="text-[22px]" />
                <span className="text-[10px] font-medium">{it.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
