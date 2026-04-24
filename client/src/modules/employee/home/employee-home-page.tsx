import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  FileText,
  Gauge,
  Home,
  Link as LinkIcon,
  ListChecks,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import type {
  AnnouncementSummary,
  EmployeeHomeDto,
  ShortcutSummary,
  TaskSummary,
} from "@shared/domain/workbench";
import { Link, useLocation } from "wouter";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { riseIn, staggerContainer } from "@/shared/motion/tokens";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import { fetchEmployeeHome } from "./api";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "首頁", icon: Home, href: "/employee" },
  { label: "櫃台交接", icon: MessageSquareText, href: "/employee/handover" },
  { label: "群組公告", icon: Bell, href: "/employee/announcements", badge: "2" },
  { label: "活動檔期", icon: CalendarDays, href: "/employee/shift" },
  { label: "班表入口", icon: ClipboardCheck, href: "/employee/shift" },
  { label: "任務管理", icon: ListChecks, href: "/employee/tasks" },
  { label: "報名 / 課程", icon: BookOpen, href: "/employee/more" },
  { label: "點名 / 打卡", icon: ShieldCheck, href: "/employee/more" },
  { label: "匯款確認", icon: CheckCircle2, href: "/employee/more" },
  { label: "設備回報", icon: Wrench, href: "/employee/more" },
  { label: "知識庫 Q&A", icon: MessageSquareText, href: "/employee/more" },
  { label: "個人記事", icon: FileText, href: "/employee/more" },
];

const shortcutIcons = {
  blue: ClipboardCheck,
  green: FileText,
  amber: CheckCircle2,
  violet: CalendarDays,
  rose: Wrench,
  cyan: FileText,
};

const toneClass: Record<ShortcutSummary["tone"], string> = {
  blue: "bg-[#edf5ff] text-[#1f6fd1]",
  green: "bg-[#edfbf4] text-[#15935d]",
  amber: "bg-[#fff6e7] text-[#d27a16]",
  violet: "bg-[#f2efff] text-[#6947d8]",
  rose: "bg-[#fff0f1] text-[#db4b5a]",
  cyan: "bg-[#ecfbff] text-[#1487a8]",
};

function SectionTitle({
  title,
  eyebrow,
  action = "查看全部",
  dark = false,
}: {
  title: string;
  eyebrow: string;
  action?: string;
  dark?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className={cn("text-[15px] font-bold", dark ? "text-white" : "text-[#10233f]")}>{title}</h2>
        <p className={cn("mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em]", dark ? "text-[#9dd84f]" : "text-[#8b9aae]")}>
          {eyebrow}
        </p>
      </div>
      <button
        className={cn(
          "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-bold",
          dark ? "text-[#9dd84f] hover:bg-white/10" : "text-[#007166] hover:bg-[#edf7f4]",
        )}
      >
        {action}
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}

function DesktopSidebar() {
  const [location] = useLocation();
  return (
    <aside className="hidden h-dvh w-[232px] shrink-0 flex-col rounded-r-[18px] bg-[#1f3f68] p-5 text-white shadow-[20px_0_40px_-32px_rgba(13,31,55,0.7)] lg:flex">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#17345b]">
          <Sparkles className="h-5 w-5 text-[#9dd84f]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[18px] font-black">駿斯 Kinetic Ops</p>
        </div>
      </div>

      <div className="mt-6 rounded-[8px] bg-white/8 p-3">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[#9dd84f]">
          <span className="h-2 w-2 rounded-full bg-[#9dd84f]" />
          營運中
        </div>
        <p className="line-clamp-2 text-[13px] font-bold">新北高中游泳池 & 運動中心</p>
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/employee" ? location === "/employee" || location === "/EMPLOYEE" : location.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "workbench-focus flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-left text-[14px] font-bold transition",
                active ? "bg-gradient-to-r from-[#1cb4a3] to-[#9dd84f] text-white" : "text-[#d6e2ef] hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
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
            <p className="truncate text-[13px] font-bold">駐拍意</p>
            <p className="text-[11px] text-[#b6c7d9]">員工</p>
          </div>
        </div>
        <Link href="/employee/more" className="workbench-focus flex min-h-9 w-full items-center gap-3 rounded-[8px] px-3 text-[13px] text-[#d6e2ef] hover:bg-white/10">
          <Settings className="h-4 w-4" />
          設定
        </Link>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#dfe7ef] bg-[#0d2a50] text-white lg:bg-white/80 lg:text-[#10233f] lg:backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 lg:h-16 lg:px-7">
        <div className="flex items-center gap-3 lg:hidden">
          <button aria-label="開啟選單" className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10">
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-[15px] font-black">駿斯 Kinetic Ops</p>
        </div>
        <nav className="hidden items-center gap-8 lg:flex">
          {["DASHBOARD", "ACTIVITY", "DIRECTORY"].map((label, index) => (
            <button
              key={label}
              className={cn(
                "h-16 border-b-2 px-2 text-[11px] font-black tracking-[0.08em]",
                index === 0 ? "border-[#79d146] text-[#79d146]" : "border-transparent text-[#536175]",
              )}
            >
              {label}
            </button>
          ))}
        </nav>
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
          <button aria-label="員工帳號" className="workbench-focus grid h-10 w-10 place-items-center rounded-full bg-[#007166] text-[13px] font-black text-white">駿</button>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-2 lg:hidden">
        <RoleSwitcher compact />
      </div>
    </header>
  );
}

function Hero({ home }: { home: EmployeeHomeDto }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_180px] lg:items-center">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#007166]">Duty Dashboard</p>
        <h1 className="mt-2 max-w-[820px] text-[28px] font-black leading-tight text-[#10233f] sm:text-[34px] lg:text-[40px]">
          {home.facility.name}
        </h1>
        <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-[#637185]">
          <CalendarDays className="h-4 w-4 text-[#007166]" />
          {home.facility.businessDate}
        </p>
      </div>
      <div className="rounded-[8px] bg-white/75 p-4 shadow-[0_22px_50px_-35px_rgba(15,34,58,0.35)]">
        <div className="flex items-center gap-3">
          <CloudSun className="h-10 w-10 text-[#ffc340]" />
          <div>
            <p className="text-[26px] font-black text-[#10233f]">{home.weather.data?.temperatureC ?? "--"}°C</p>
            <p className="text-[12px] font-bold text-[#637185]">{home.weather.data?.label ?? "資料暫不可用"}</p>
            <p className="text-[11px] text-[#8b9aae]">濕度 {home.weather.data?.humidity ?? "--"}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HandoverCard({ count }: { count: number }) {
  return (
    <WorkbenchCard className="p-5">
      <SectionTitle title="交接事項" eyebrow="Handover" />
      <div className="flex min-h-[170px] flex-col items-center justify-center rounded-[8px] bg-[#f7f9fb] px-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#6d7c90] shadow-sm">
          <MessageSquareText className="h-7 w-7" />
        </div>
        <p className="mt-4 text-[16px] font-black text-[#10233f]">{count > 0 ? `${count} 則待確認交接` : "尚未設定交接事項"}</p>
        <p className="mt-1 text-[12px] font-medium text-[#637185]">請聯絡 當班人員</p>
        <button className="mt-5 min-h-10 rounded-[8px] bg-[#32af5c] px-5 text-[13px] font-black text-white">新增交接事項</button>
      </div>
    </WorkbenchCard>
  );
}

function TaskCard({ tasks }: { tasks: TaskSummary[] }) {
  const done = tasks.filter((task) => task.status === "done").length;
  return (
    <WorkbenchCard className="p-5">
      <SectionTitle title="今日任務" eyebrow="Tasks" />
      <div className="grid min-h-[170px] grid-cols-[82px_1fr] items-center gap-4">
        <div className="grid h-[82px] w-[82px] place-items-center rounded-full border-[8px] border-[#eef2f6]">
          <div className="text-center">
            <p className="text-[24px] font-black text-[#10233f]">{done}/{tasks.length}</p>
            <p className="text-[11px] font-bold text-[#8b9aae]">已完成</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-right text-[12px] font-black text-[#10233f]">{tasks.length - done} 項待完成</p>
          {tasks.slice(0, 5).map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-[13px]">
              <span className={cn("h-2 w-2 rounded-full", task.status === "done" ? "bg-[#32af5c]" : "bg-[#007166]")} />
              <span className="min-w-0 flex-1 truncate font-bold text-[#4d5b70]">{task.title}</span>
              <span className={cn("rounded-[4px] px-1.5 py-0.5 text-[10px] font-black", task.priority === "high" ? "bg-[#fff1e7] text-[#ef7d22]" : "bg-[#edfbf4] text-[#32af5c]")}>
                {task.priority === "high" ? "高" : "低"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </WorkbenchCard>
  );
}

function AnnouncementCard({ announcements }: { announcements: AnnouncementSummary[] }) {
  return (
    <WorkbenchCard tone="navy" className="p-5">
      <SectionTitle title="群組重要公告" eyebrow="Must Read" action="查看全部" dark />
      <div className="space-y-3">
        {announcements.map((item) => (
          <button key={item.id} className="flex min-h-[68px] w-full items-center gap-3 rounded-[8px] bg-white p-3 text-left text-[#10233f]">
            <Bell className="h-5 w-5 shrink-0 text-[#2f6fe8]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black">{item.title}</p>
              <p className="mt-1 truncate text-[11px] font-medium text-[#64748b]">{item.effectiveRange}</p>
            </div>
            <span className={cn("rounded-[4px] px-1.5 py-0.5 text-[10px] font-black", item.priority === "required" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#fff1e7] text-[#ef7d22]")}>
              {item.priority === "required" ? "重要" : "提醒"}
            </span>
          </button>
        ))}
        <button className="min-h-11 w-full rounded-[8px] bg-white/12 text-[13px] font-black text-white">查看所有公告</button>
      </div>
    </WorkbenchCard>
  );
}

function Shortcuts({ shortcuts }: { shortcuts: ShortcutSummary[] }) {
  return (
    <WorkbenchCard className="p-5">
      <SectionTitle title="快速操作" eyebrow="Shortcuts" action="自訂排序" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {shortcuts.map((shortcut) => {
          const Icon = shortcutIcons[shortcut.tone];
          return (
            <a key={shortcut.id} href={shortcut.href} className="group flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-[8px] bg-[#fbfcfd] px-2 text-center transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
              <span className={cn("grid h-10 w-10 place-items-center rounded-[8px]", toneClass[shortcut.tone])}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[12px] font-black text-[#263b56]">{shortcut.label}</span>
            </a>
          );
        })}
      </div>
    </WorkbenchCard>
  );
}

function LowerGrid({ home }: { home: EmployeeHomeDto }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <WorkbenchCard className="p-5">
        <SectionTitle title="今日班表" eyebrow="Shift" action="查看班表" />
        <div className="space-y-4">
          {home.shifts.data?.map((shift) => (
            <div key={shift.id}>
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-black text-[#10233f]">{shift.label} <span className="ml-2 font-bold">{shift.timeRange}</span></p>
                <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", shift.status === "active" ? "bg-[#eaf8ef] text-[#32af5c]" : "bg-[#eef2f6] text-[#637185]")}>
                  {shift.status === "active" ? "進行中" : "未開始"}
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[#e9eef4]">
                <div className={cn("h-1.5 rounded-full", shift.status === "active" ? "w-1/2 bg-[#32af5c]" : "w-0 bg-[#32af5c]")} />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 text-[13px]">
            <span className="font-bold text-[#637185]">本日出勤</span>
            <span className="font-black text-[#10233f]">1 / 2 人</span>
          </div>
        </div>
      </WorkbenchCard>
      <WorkbenchCard className="p-5">
        <SectionTitle title="活動 / 課程快訊" eyebrow="Events" action="查看更多" />
        <div className="space-y-3">
          {home.campaigns.data?.map((campaign) => (
            <div key={campaign.id} className="flex items-center gap-3 rounded-[8px] bg-[#f7f9fb] p-3">
              <div className="h-14 w-20 rounded-[8px] bg-gradient-to-br from-[#0d7f77] to-[#9dd84f]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black text-[#10233f]">{campaign.title}</p>
                <p className="mt-1 text-[11px] font-bold text-[#637185]">{campaign.effectiveRange}</p>
              </div>
              <span className="rounded-full bg-[#eaf8ef] px-2 py-1 text-[10px] font-black text-[#15935d]">{campaign.statusLabel}</span>
            </div>
          ))}
        </div>
      </WorkbenchCard>
      <WorkbenchCard className="p-5">
        <SectionTitle title="常用文件" eyebrow="Documents" action="查看更多" />
        <div className="space-y-3">
          {home.documents.data?.map((doc) => (
            <button key={doc.id} className="flex min-h-12 w-full items-center gap-3 rounded-[8px] px-2 text-left hover:bg-[#f7f9fb]">
              <FileText className="h-5 w-5 text-[#1f6fd1]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-black text-[#10233f]">{doc.title}</span>
                <span className="block text-[11px] font-medium text-[#8b9aae]">更新：{doc.updatedAt}</span>
              </span>
            </button>
          ))}
        </div>
      </WorkbenchCard>
    </div>
  );
}

function BottomNav() {
  const items = [
    { label: "首頁", icon: Home, href: "/employee" },
    { label: "任務", icon: ListChecks, href: "/employee/tasks" },
    { label: "公告", icon: Bell, href: "/employee/announcements" },
    { label: "交接", icon: MessageSquareText, href: "/employee/handover" },
    { label: "更多", icon: MoreHorizontal, href: "/employee/more" },
  ];
  const [location] = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e5ecf3] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/employee" ? location === "/employee" || location === "/EMPLOYEE" : location.startsWith(item.href);
        return (
          <Link key={item.label} href={item.href} className={cn("workbench-focus flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-black", active ? "bg-[#eef5ff] text-[#1f6fd1]" : "text-[#6c7a8e]")}>
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f4f7fb] p-6">
      <div className="w-full max-w-sm rounded-[8px] bg-white px-5 py-4 text-center text-[14px] font-bold text-[#536175] shadow-lg">載入工作台資料中...</div>
    </div>
  );
}

export default function EmployeeHomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/bff/employee/home"],
    queryFn: fetchEmployeeHome,
  });

  if (isLoading) return <LoadingState />;

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f4f7fb] p-6">
        <WorkbenchCard className="w-full max-w-md p-6 text-center">
          <Gauge className="mx-auto h-10 w-10 text-[#ef7d22]" />
          <h1 className="mt-4 text-[20px] font-black text-[#10233f]">工作台暫時無法載入</h1>
          <p className="mt-2 text-[14px] text-[#637185]">BFF 資料來源尚未回應，請稍後再試。</p>
        </WorkbenchCard>
      </div>
    );
  }

  return (
    <div className="workbench-shell">
      <div className="flex min-h-dvh">
        <DesktopSidebar />
        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <TopBar />
          <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-7 lg:py-8">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
              <motion.div variants={riseIn}>
                <Hero home={data} />
              </motion.div>
              <motion.div variants={riseIn} className="grid gap-4 lg:grid-cols-3">
                <HandoverCard count={data.handover.data?.length ?? 0} />
                <TaskCard tasks={data.tasks.data ?? []} />
                <AnnouncementCard announcements={data.announcements.data ?? []} />
              </motion.div>
              <motion.div variants={riseIn}>
                <Shortcuts shortcuts={data.shortcuts.data ?? []} />
              </motion.div>
              <motion.div variants={riseIn}>
                <LowerGrid home={data} />
              </motion.div>
            </motion.div>
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
