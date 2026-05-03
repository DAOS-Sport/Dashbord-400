import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Search,
  Settings,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { useSchool } from "@/lib/court-school";
import { SCHOOLS, getSchoolName, type SchoolId } from "@/lib/court-utils";

interface NavSuffix {
  suffix: string;
  label: string;
  icon: React.ReactNode;
  testId: string;
}

const NAV: NavSuffix[] = [
  { suffix: "", label: "單日排程", icon: <CalendarDays className="w-4 h-4" />, testId: "nav-day" },
  { suffix: "/week", label: "本週檢視", icon: <LayoutGrid className="w-4 h-4" />, testId: "nav-week" },
  { suffix: "/month", label: "月曆總覽", icon: <CalendarRange className="w-4 h-4" />, testId: "nav-month" },
  { suffix: "/search", label: "搜尋預約", icon: <Search className="w-4 h-4" />, testId: "nav-search" },
  { suffix: "/admin", label: "後台匯入", icon: <Settings className="w-4 h-4" />, testId: "nav-admin" },
];

interface AppHeaderProps {
  rightSlot?: React.ReactNode;
  subtitle?: string;
  lastSync?: number | null;
  syncLoading?: boolean;
}

function SyncBadge({
  lastSync,
  loading,
}: {
  lastSync: number | null | undefined;
  loading?: boolean;
}) {
  const hasSync = !!lastSync;
  const timeText = hasSync ? format(new Date(lastSync!), "HH:mm") : "—";
  return (
    <div
      className="hidden md:inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 text-[11px] text-gray-600"
      data-testid="sync-status"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className={`relative rounded-full h-1.5 w-1.5 ${loading ? "bg-amber-400" : "bg-emerald-500"}`}
        />
      </span>
      <span className="font-medium text-gray-700">
        {loading ? "同步中" : "已連線"}
      </span>
      <span className="text-gray-400">·</span>
      <span className="text-gray-500">{timeText}</span>
    </div>
  );
}

export function AppHeader({
  rightSlot,
  subtitle = "Google Calendar 即時同步",
  lastSync,
  syncLoading,
}: AppHeaderProps) {
  const [location, navigate] = useLocation();
  const school = useSchool();
  const schoolName = getSchoolName(school);

  const navItems = NAV.map((n) => ({
    ...n,
    to: `/courts/${school}${n.suffix}`,
  }));

  const isActive = (to: string) => {
    if (location === to) return true;
    if (location.startsWith(`${to}/`) || location.startsWith(`${to}?`))
      return true;
    return false;
  };

  const switchSchool = (newSchool: SchoolId) => {
    if (newSchool === school) return;
    const m = location.match(/^\/courts\/[a-z]+(\/[^?]*)?(\?.*)?$/);
    const suffix = m?.[1] ?? "";
    const search = m?.[2] ?? "";
    navigate(`/courts/${newSchool}${suffix}${search}`);
  };

  const showSyncBadge = lastSync !== undefined;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/employee">
              <button
                data-testid="link-back-workbench"
                className="flex items-center gap-1 px-2 h-8 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                title="返回工作台"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">返回工作台</span>
              </button>
            </Link>
            <div className="hidden sm:block h-5 w-px bg-gray-200" />
            <Link href={`/courts/${school}`}>
              <div
                className="flex items-center gap-2 cursor-pointer group"
                data-testid="brand-link"
              >
                <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <h1
                  className="hidden sm:block text-[15px] font-semibold text-gray-900 tracking-tight whitespace-nowrap"
                  data-testid="brand-title"
                  title={subtitle}
                >
                  {schoolName}場地預約
                </h1>
              </div>
            </Link>

            <div
              className="hidden md:flex items-center bg-gray-100 rounded-md p-0.5"
              data-testid="school-switcher"
            >
              {SCHOOLS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => switchSchool(s.id)}
                  data-testid={`school-${s.id}`}
                  className={`px-2.5 h-7 rounded text-xs font-medium transition ${
                    s.id === school
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {s.shortName}
                </button>
              ))}
            </div>

            <nav className="hidden md:flex items-center gap-0.5 ml-2">
              {navItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link key={item.to} href={item.to}>
                    <button
                      data-testid={item.testId}
                      className={`px-2.5 h-7 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {showSyncBadge && (
              <SyncBadge lastSync={lastSync} loading={syncLoading} />
            )}
            {rightSlot && (
              <div className="hidden md:flex items-center gap-2">{rightSlot}</div>
            )}
          </div>
        </div>

        {rightSlot && (
          <div className="flex md:hidden items-center justify-end gap-2 pb-2 -mt-1">
            {rightSlot}
          </div>
        )}

        <div
          className="flex md:hidden items-center bg-gray-100 rounded-md p-0.5 mb-2"
          data-testid="school-switcher-mobile"
        >
          {SCHOOLS.map((s) => (
            <button
              key={s.id}
              onClick={() => switchSchool(s.id)}
              data-testid={`school-${s.id}-mobile`}
              className={`flex-1 px-2.5 h-7 rounded text-xs font-medium transition ${
                s.id === school
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {s.shortName}
            </button>
          ))}
        </div>

        <nav className="flex md:hidden items-center gap-0.5 overflow-x-auto pb-2 -mt-1">
          {navItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link key={item.to} href={item.to}>
                <button
                  data-testid={`${item.testId}-mobile`}
                  className={`px-2.5 h-7 rounded-md text-xs font-medium flex items-center gap-1 whitespace-nowrap transition ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
