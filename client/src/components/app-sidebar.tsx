import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  TrendingUp,
  Building2,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Sun,
  Moon,
  FileText,
  BarChart3,
  ExternalLink,
  ClipboardList,
  ListChecks,
  CalendarRange,
  Droplets,
  FlaskConical,
  ClipboardCheck,
  Trophy,
  Car,
  Tags,
  Wallet,
  Waves,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/shared/brand";

const navItems = [
  { title: "營運戰情總覽", url: "/", icon: LayoutDashboard, group: "營運管理" },
  { title: "打卡異常管理", url: "/anomaly-reports", icon: AlertTriangle, group: "營運管理" },
  { title: "決策與數據洞察", url: "/analytics", icon: TrendingUp, group: "營運管理" },
  { title: "跨館資源監控", url: "/operations", icon: Building2, group: "營運管理" },
  { title: "公告審核中心", url: "/announcements", icon: FileText, group: "公告歸納" },
  { title: "公告分析總覽", url: "/announcements/summary", icon: BarChart3, group: "公告歸納" },
  { title: "每日固定事項", url: "/admin/work-logs/daily-templates", icon: ClipboardList, group: "救生員日誌" },
  { title: "主管交辦任務", url: "/admin/work-logs/assigned-tasks", icon: ListChecks, group: "救生員日誌" },
  { title: "每週循環任務", url: "/admin/work-logs/recurring-templates", icon: CalendarRange, group: "救生員日誌" },
  { title: "水質測量時段", url: "/admin/work-logs/water-schedules", icon: Droplets, group: "救生員日誌" },
  { title: "水質標準值", url: "/admin/work-logs/water-standards", icon: FlaskConical, group: "救生員日誌" },
  { title: "主管審核", url: "/admin/work-logs/submissions", icon: ClipboardCheck, group: "救生員日誌" },
  { title: "櫃台每日固定", url: "/admin/counter-logs/daily-templates", icon: ClipboardList, group: "櫃台工作" },
  { title: "櫃台交辦任務", url: "/admin/counter-logs/assigned-tasks", icon: ListChecks, group: "櫃台工作" },
  { title: "櫃台主管審核", url: "/admin/counter-logs/submissions", icon: ClipboardCheck, group: "櫃台工作" },
  { title: "水道租借", url: "/admin/lane-rentals", icon: Waves, group: "櫃台工作" },
  { title: "停車場總覽", url: "/admin/parking/dashboard", icon: Car, group: "停車場" },
  { title: "車輛管理", url: "/admin/parking/vehicles", icon: Car, group: "停車場" },
  { title: "方案管理", url: "/admin/parking/plans", icon: Tags, group: "停車場" },
  { title: "租約管理", url: "/admin/parking/contracts", icon: FileText, group: "停車場" },
  { title: "付款審核", url: "/admin/parking/payments", icon: Wallet, group: "停車場" },
  { title: "活動日", url: "/admin/parking/event-days", icon: CalendarRange, group: "停車場" },
  { title: "新北高中", url: "/supervisor/courts/xinbei", icon: Trophy, group: "場地預約" },
  { title: "三重商工", url: "/supervisor/courts/sanchong", icon: Trophy, group: "場地預約" },
  { title: "HR 與權限稽核", url: "/hr-audit", icon: ShieldCheck, group: "系統管理" },
  { title: "微服務健康監控", url: "/system-health", icon: Activity, group: "系統管理" },
];

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDark(true);
    else if (saved === "light") setDark(false);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setDark(true);
  }, []);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      data-testid="button-theme-toggle"
    >
      {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <BrandMark className="h-8 w-8 rounded-md" />
          <div>
            <p className="text-sm font-semibold tracking-heading text-foreground" data-testid="text-app-title">
              駿斯 CMS
            </p>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">v2.1</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {["營運管理", "公告歸納", "救生員日誌", "櫃台工作", "停車場", "場地預約", "系統管理"].map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-3">
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.filter((item) => item.group === group).map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        data-active={isActive || undefined}
                        className={isActive ? "bg-accent font-medium" : ""}
                      >
                        <Link href={item.url} data-testid={`link-nav-${item.title}`}>
                          <item.icon className="h-4 w-4" />
                          <span className="text-[13px]">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        <a
          href="/portal"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          data-testid="link-portal-entry"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>員工值班入口</span>
        </a>
        <ThemeToggle />
        <div className="px-3 py-2">
          <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
            駿斯運動事業
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
