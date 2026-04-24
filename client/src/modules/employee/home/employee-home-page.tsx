import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import type {
  AnnouncementSummary,
  CampaignSummary,
  DocumentSummary,
  EmployeeHomeDto,
  HandoverSummary,
  ShiftSummary,
  ShortcutSummary,
  StickyNoteSummary,
  TaskSummary,
} from "@shared/domain/workbench";
import { defaultEmployeeHomeWidgets, normalizeWidgetLayout } from "@shared/domain/layout";
import { Link, useLocation } from "wouter";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { riseIn, staggerContainer } from "@/shared/motion/tokens";
import { RoleSwitcher } from "@/modules/workbench/role-switcher";
import {
  createEmployeeResource,
  deleteEmployeeResource,
  fetchEmployeeHome,
  searchEmployeeWorkbench,
  updateEmployeeResource,
  type EmployeeSearchResultDTO,
} from "./api";
import { cn } from "@/lib/utils";
import { facilityConfigs } from "@/config/facility-configs";
import { useAuthMe, useSwitchFacility } from "@/shared/auth/session";

const navItems = [
  { label: "首頁", icon: Home, href: "/employee" },
  { label: "櫃台交接", icon: MessageSquareText, href: "/employee/handover" },
  { label: "群組公告", icon: Bell, href: "/employee/announcements", badge: "2" },
  { label: "活動檔期", icon: CalendarDays, href: "/employee/shift" },
  { label: "班表入口", icon: ClipboardCheck, href: "/employee/shift" },
  { label: "交班事項", icon: ListChecks, href: "/employee/tasks" },
  { label: "報名 / 課程", icon: BookOpen, href: "/employee/more" },
  { label: "點名 / 打卡", icon: ShieldCheck, href: "/employee/more" },
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

const formatShiftTime = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
};

const shiftPeriodLabel = (shift: ShiftSummary) => {
  if (shift.startsAt) {
    const parsed = new Date(shift.startsAt);
    if (!Number.isNaN(parsed.getTime())) {
      const hour = parsed.getHours();
      if (hour >= 16) return "晚班";
      if (hour >= 12) return "中班";
      return "早班";
    }
  }
  const label = `${shift.label} ${shift.startsAt ?? ""}`;
  if (/晚|16:|17:|18:|19:|20:|21:|22:/.test(label)) return "晚班";
  if (/中|12:|13:|14:|15:/.test(label)) return "中班";
  return "早班";
};

const buildShiftRows = (shifts: ShiftSummary[] = []) => {
  const groups = new Map<string, { facilityName: string; early: string[]; mid: string[]; late: string[]; timeRange: string }>();
  shifts.forEach((shift) => {
    const facilityName = shift.venueName || "本館";
    const current = groups.get(facilityName) ?? { facilityName, early: [], mid: [], late: [], timeRange: "" };
    const period = shiftPeriodLabel(shift);
    const name = shift.employeeName || shift.label.split("/")[0]?.trim() || "未命名";
    if (period === "晚班") current.late.push(name);
    else if (period === "中班") current.mid.push(name);
    else current.early.push(name);
    if (!current.timeRange) current.timeRange = shift.startsAt && shift.endsAt ? `${formatShiftTime(shift.startsAt)} - ${formatShiftTime(shift.endsAt)}` : shift.timeRange;
    groups.set(facilityName, current);
  });
  return Array.from(groups.values());
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
  const { data: session } = useAuthMe();
  const switchFacility = useSwitchFacility();
  const granted = session?.grantedFacilities ?? [];
  return (
    <header className="sticky top-0 z-20 border-b border-[#dfe7ef] bg-[#0d2a50] text-white lg:bg-white/80 lg:text-[#10233f] lg:backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 lg:h-16 lg:px-7">
        <div className="flex items-center gap-3 lg:hidden">
          <button aria-label="開啟選單" className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-white/10">
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-[15px] font-black">駿斯 Kinetic Ops</p>
        </div>
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#1f6fd1]">
            <Home className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-black text-[#10233f]">{facilityConfigs[session?.activeFacility ?? "xinbei_pool"]?.facilityName ?? "新北高中游泳池&運動中心"}</p>
            <p className="text-[11px] font-bold text-[#79b943]">DASHBOARD</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <RoleSwitcher />
          </div>
          {granted.length > 1 ? (
            <select
              value={session?.activeFacility ?? granted[0]}
              onChange={(event) => switchFacility.mutate(event.target.value)}
              className="hidden min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#10233f] lg:block"
              aria-label="切換館別"
            >
              {granted.map((facilityKey) => (
                <option key={facilityKey} value={facilityKey}>{facilityConfigs[facilityKey]?.shortName ?? facilityKey}</option>
              ))}
            </select>
          ) : null}
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

const searchTypeLabel: Record<EmployeeSearchResultDTO["type"], string> = {
  announcement: "公告",
  handover: "交接",
  task: "交班",
  shift: "班表",
  shortcut: "入口",
  document: "文件",
  campaign: "活動",
};

function Hero({
  home,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  isSearching,
}: {
  home: EmployeeHomeDto;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: EmployeeSearchResultDTO[];
  isSearching: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_180px] lg:items-center">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#007166]">Quick Search</p>
        <label className="mt-2 flex min-h-14 max-w-[820px] items-center gap-3 rounded-[8px] border border-[#dfe7ef] bg-white px-4 shadow-[0_18px_45px_-36px_rgba(15,34,58,0.45)]">
          <Search className="h-5 w-5 shrink-0 text-[#2f6fe8]" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-[#10233f] outline-none placeholder:text-[#8b9aae]"
            placeholder="搜尋公告、交接、班表、入口、常見問題"
          />
        </label>
        {searchQuery.trim().length >= 2 ? (
          <div className="mt-2 max-w-[820px] rounded-[8px] border border-[#dfe7ef] bg-white p-2 shadow-[0_18px_45px_-36px_rgba(15,34,58,0.45)]">
            {isSearching ? <div className="px-3 py-2 text-[12px] font-bold text-[#637185]">搜尋中...</div> : null}
            {!isSearching && searchResults.length === 0 ? <div className="px-3 py-2 text-[12px] font-bold text-[#637185]">沒有找到符合的資訊。</div> : null}
            {searchResults.map((item) => (
              <Link key={item.id} href={item.href} className="flex min-h-11 items-center gap-3 rounded-[8px] px-3 py-2 hover:bg-[#f7f9fb]">
                <span className="shrink-0 rounded-[6px] bg-[#eef5ff] px-2 py-1 text-[11px] font-black text-[#1f6fd1]">{searchTypeLabel[item.type]}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-[#10233f]">{item.title}</span>
                  <span className="block truncate text-[11px] font-bold text-[#8b9aae]">{item.summary}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
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

function HandoverCard({ handovers, tasks }: { handovers: HandoverSummary[]; tasks: TaskSummary[] }) {
  const total = handovers.length + tasks.length;
  return (
    <WorkbenchCard className="p-5">
      <SectionTitle title="交接事項" eyebrow="Handover" />
      {total > 0 ? (
        <div className="space-y-3">
          {tasks.slice(0, 3).map((task) => (
            <Link key={`task-${task.id}`} href="/employee/tasks" className="block rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3">
              <p className="truncate text-[13px] font-black text-[#10233f]">{task.title}</p>
              <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">{task.dueLabel ?? "今日交班"} · {task.status}</p>
            </Link>
          ))}
          {handovers.slice(0, Math.max(0, 4 - tasks.length)).map((item) => (
            <Link key={`handover-${item.id}`} href="/employee/handover" className="block rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3">
              <p className="truncate text-[13px] font-black text-[#10233f]">{item.title}</p>
              <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">{item.authorName} · {item.dueLabel ?? item.status}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[170px] flex-col items-center justify-center rounded-[8px] bg-[#f7f9fb] px-4 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#6d7c90] shadow-sm">
            <MessageSquareText className="h-7 w-7" />
          </div>
          <p className="mt-4 text-[16px] font-black text-[#10233f]">尚未設定交接事項</p>
          <p className="mt-1 text-[12px] font-medium text-[#637185]">交班與交接會合併顯示在這裡</p>
        </div>
      )}
    </WorkbenchCard>
  );
}

function TutorBookingCard() {
  return (
    <WorkbenchCard className="p-5">
      <SectionTitle title="今日家教預約" eyebrow="Private Coaching" />
      <div className="grid min-h-[170px] place-items-center rounded-[8px] bg-[#f7f9fb] px-4 text-center">
        <div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-[#8b9aae] shadow-sm">
            <CalendarDays className="h-7 w-7" />
          </div>
          <p className="mt-4 text-[16px] font-black text-[#10233f]">功能尚未開放</p>
          <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">之後接課程 / 預約資料來源</p>
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

function AddResourceForm({
  category,
  facilityKey,
  titlePlaceholder,
  contentPlaceholder,
  urlPlaceholder,
  onCreated,
}: {
  category: "event" | "document" | "sticky_note";
  facilityKey: string;
  titlePlaceholder: string;
  contentPlaceholder: string;
  urlPlaceholder?: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const mutation = useMutation({
    mutationFn: () => createEmployeeResource({
      facilityKey,
      category,
      title,
      content: content.trim() || undefined,
      url: url.trim() || undefined,
      isPinned: category === "sticky_note",
    }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setUrl("");
      onCreated();
    },
  });
  const canSubmit = title.trim().length > 0 && !mutation.isPending;

  return (
    <div className="rounded-[8px] border border-dashed border-[#cfd9e5] bg-[#fbfcfd] p-3">
      <div className="grid gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold text-[#10233f] outline-none"
          placeholder={titlePlaceholder}
        />
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold text-[#10233f] outline-none"
          placeholder={contentPlaceholder}
        />
        {urlPlaceholder ? (
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold text-[#10233f] outline-none"
            placeholder={urlPlaceholder}
          />
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {mutation.isPending ? "新增中..." : "新增"}
        </button>
        {mutation.isError ? <p className="text-[11px] font-bold text-[#ff4964]">新增失敗，請確認欄位格式。</p> : null}
      </div>
    </div>
  );
}

function ResourceActions({
  resourceId,
  title,
  content,
  url,
  onChanged,
}: {
  resourceId?: number;
  title: string;
  content?: string;
  url?: string;
  onChanged: () => void;
}) {
  const updateMutation = useMutation({
    mutationFn: (next: { title: string; content?: string | null; url?: string | null }) => updateEmployeeResource(resourceId!, next),
    onSuccess: onChanged,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteEmployeeResource(resourceId!),
    onSuccess: onChanged,
  });
  if (!resourceId) return null;
  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        onClick={() => {
          const nextTitle = window.prompt("標題", title);
          if (nextTitle === null) return;
          const nextContent = window.prompt("內容 / 備註", content || "");
          if (nextContent === null) return;
          const nextUrl = url === undefined ? undefined : window.prompt("連結", url || "");
          updateMutation.mutate({ title: nextTitle, content: nextContent || null, url: nextUrl === undefined ? undefined : nextUrl || null });
        }}
        className="rounded-[6px] bg-white px-2 py-1 text-[10px] font-black text-[#536175]"
      >
        編輯
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("確認刪除？")) deleteMutation.mutate();
        }}
        className="rounded-[6px] bg-[#fff0f1] px-2 py-1 text-[10px] font-black text-[#db4b5a]"
      >
        刪除
      </button>
    </div>
  );
}

function EventList({ campaigns, onChanged }: { campaigns: CampaignSummary[]; onChanged: () => void }) {
  if (!campaigns.length) return <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未新增活動 / 課程快訊。</div>;
  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="rounded-[8px] bg-[#f7f9fb] p-3">
          <a href={campaign.linkUrl || "#"} className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-[#eaf8ef] text-[#15935d]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-[#10233f]">{campaign.title}</p>
              <p className="mt-1 truncate text-[11px] font-bold text-[#637185]">{campaign.effectiveRange}</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#15935d]">{campaign.statusLabel}</span>
          </a>
          <ResourceActions resourceId={campaign.resourceId} title={campaign.title} content={campaign.effectiveRange} url={campaign.linkUrl} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function DocumentList({ documents, onChanged }: { documents: DocumentSummary[]; onChanged: () => void }) {
  if (!documents.length) return <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未新增常用文件。</div>;
  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div key={doc.id} className="rounded-[8px] px-2 py-2 hover:bg-[#f7f9fb]">
          <a href={doc.url || "#"} className="flex min-h-12 w-full items-center gap-3 text-left">
            <FileText className="h-5 w-5 shrink-0 text-[#1f6fd1]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black text-[#10233f]">{doc.title}</span>
              <span className="block truncate text-[11px] font-medium text-[#8b9aae]">{doc.description || `更新：${doc.updatedAt}`}</span>
            </span>
          </a>
          <ResourceActions resourceId={doc.resourceId} title={doc.title} content={doc.description} url={doc.url} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function StickyNotesCard({ notes, facilityKey, onCreated }: { notes: StickyNoteSummary[]; facilityKey: string; onCreated: () => void }) {
  return (
    <WorkbenchCard className="p-5">
      <SectionTitle title="便利貼" eyebrow="Notes" action="員工自建" />
      <div className="space-y-3">
        <AddResourceForm
          category="sticky_note"
          facilityKey={facilityKey}
          titlePlaceholder="便利貼標題"
          contentPlaceholder="提醒內容"
          onCreated={onCreated}
        />
        {notes.map((note) => (
          <div key={note.id} className="rounded-[8px] border border-[#f0dfaa] bg-[#fff9df] p-3">
            <p className="text-[13px] font-black text-[#10233f]">{note.title}</p>
            <p className="mt-1 text-[12px] font-bold leading-5 text-[#536175]">{note.content}</p>
            <p className="mt-2 text-[10px] font-bold text-[#9a7a1d]">{note.authorName || "員工"} · {note.createdAt}</p>
            <ResourceActions resourceId={note.resourceId} title={note.title} content={note.content} onChanged={onCreated} />
          </div>
        ))}
      </div>
    </WorkbenchCard>
  );
}

function LowerGrid({ home, visibleKeys, onResourceCreated }: { home: EmployeeHomeDto; visibleKeys: Set<string>; onResourceCreated: () => void }) {
  const shiftRows = buildShiftRows(home.shifts.data ?? []);
  const activeTime = home.shifts.data?.find((shift) => shift.status === "active") ?? home.shifts.data?.[0];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {visibleKeys.has("shifts") ? <WorkbenchCard className="p-5">
        <SectionTitle title="今日班表" eyebrow="Shift" action="查看班表" />
        <div className="space-y-3">
          <div className="rounded-[8px] bg-[#eef5ff] px-3 py-2">
            <p className="text-[11px] font-black text-[#536175]">當班時段</p>
            <p className="mt-0.5 text-[14px] font-black text-[#10233f]">
              {activeTime?.startsAt && activeTime?.endsAt ? `${formatShiftTime(activeTime.startsAt)} - ${formatShiftTime(activeTime.endsAt)}` : activeTime?.timeRange ?? "尚無班表"}
            </p>
          </div>
          {shiftRows.map((row) => (
            <div key={row.facilityName} className="rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3">
              <p className="text-[14px] font-black text-[#10233f]">{row.facilityName}</p>
              <div className="mt-3 grid gap-2 text-[13px]">
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 font-black text-[#536175]">早班</span>
                  <span className="min-w-0 text-right font-bold text-[#10233f]">{row.early.join("、") || "-"}</span>
                </div>
                {row.mid.length ? (
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 font-black text-[#536175]">中班</span>
                    <span className="min-w-0 text-right font-bold text-[#10233f]">{row.mid.join("、")}</span>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 font-black text-[#536175]">晚班</span>
                  <span className="min-w-0 text-right font-bold text-[#10233f]">{row.late.join("、") || "-"}</span>
                </div>
              </div>
            </div>
          ))}
          {!shiftRows.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">目前沒有班表資料。</div> : null}
          <div className="flex items-center justify-between pt-1 text-[13px]">
            <span className="font-bold text-[#637185]">本日出勤</span>
            <span className="font-black text-[#10233f]">{home.shifts.data?.length ?? 0} 人</span>
          </div>
        </div>
      </WorkbenchCard> : null}
      {visibleKeys.has("events") ? <WorkbenchCard className="p-5">
        <SectionTitle title="活動 / 課程快訊" eyebrow="Events" action="員工可新增" />
        <div className="space-y-3">
          <AddResourceForm category="event" facilityKey={home.facility.key} titlePlaceholder="活動 / 課程名稱" contentPlaceholder="時間或備註" urlPlaceholder="報名或說明連結 https://..." onCreated={onResourceCreated} />
          <EventList campaigns={home.campaigns.data ?? []} onChanged={onResourceCreated} />
        </div>
      </WorkbenchCard> : null}
      {visibleKeys.has("documents") ? <WorkbenchCard className="p-5">
        <SectionTitle title="常用文件" eyebrow="Documents" action="員工可新增" />
        <div className="space-y-3">
          <AddResourceForm category="document" facilityKey={home.facility.key} titlePlaceholder="文件名稱" contentPlaceholder="用途或備註" urlPlaceholder="文件連結 https://..." onCreated={onResourceCreated} />
          <DocumentList documents={home.documents.data ?? []} onChanged={onResourceCreated} />
        </div>
      </WorkbenchCard> : null}
      {visibleKeys.has("stickyNotes") ? <StickyNotesCard notes={home.stickyNotes.data ?? []} facilityKey={home.facility.key} onCreated={onResourceCreated} /> : null}
    </div>
  );
}

function BottomNav() {
  const items = [
    { label: "首頁", icon: Home, href: "/employee" },
    { label: "交班", icon: ListChecks, href: "/employee/tasks" },
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
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/bff/employee/home"],
    queryFn: fetchEmployeeHome,
  });
  const layoutItems = useMemo(() => normalizeWidgetLayout(data?.layout?.data, defaultEmployeeHomeWidgets), [data?.layout?.data]);
  const visibleWidgets = useMemo(() => new Set(layoutItems.filter((item) => item.enabled).map((item) => item.key)), [layoutItems]);
  const primaryWidgets = layoutItems.filter((item) => item.enabled && item.area === "primary");
  const lowerWidgets = layoutItems.filter((item) => item.enabled && item.area === "lower");
  const searchQueryResult = useQuery({
    queryKey: ["/api/bff/employee/search", data?.facility.key, searchQuery],
    queryFn: () => searchEmployeeWorkbench(searchQuery, data?.facility.key),
    enabled: Boolean(data?.facility.key && searchQuery.trim().length >= 2),
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
                {visibleWidgets.has("search") ? (
                  <Hero
                    home={data}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    searchResults={searchQueryResult.data?.items ?? []}
                    isSearching={searchQueryResult.isFetching}
                  />
                ) : null}
              </motion.div>
              {primaryWidgets.length ? (
                <motion.div variants={riseIn} className="grid gap-4 lg:grid-cols-3">
                  {primaryWidgets.map((widget) => {
                    if (widget.key === "handover") return <HandoverCard key={widget.key} handovers={data.handover.data ?? []} tasks={data.tasks.data ?? []} />;
                    if (widget.key === "tutorBooking") return <TutorBookingCard key={widget.key} />;
                    if (widget.key === "announcements") return <AnnouncementCard key={widget.key} announcements={data.announcements.data ?? []} />;
                    return null;
                  })}
                </motion.div>
              ) : null}
              {visibleWidgets.has("shortcuts") ? (
                <motion.div variants={riseIn}>
                  <Shortcuts shortcuts={data.shortcuts.data ?? []} />
                </motion.div>
              ) : null}
              {lowerWidgets.length ? (
                <motion.div variants={riseIn}>
                  <LowerGrid
                    home={data}
                    visibleKeys={new Set(lowerWidgets.map((item) => item.key))}
                    onResourceCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] })}
                  />
                </motion.div>
              ) : null}
            </motion.div>
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
