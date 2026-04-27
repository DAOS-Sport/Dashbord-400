import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  FileText,
  Megaphone,
  MessageSquareReply,
  Pin,
  PinOff,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import type { AnnouncementSummary } from "@shared/domain/workbench";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import { acknowledgeEmployeeAnnouncement, createEmployeeResource, fetchEmployeeHome, updateEmployeeResource } from "../home/api";

type AnnouncementKind = "required" | "sop" | "notice" | "event";
type AnnouncementFilter = "all" | AnnouncementKind;
type UiAnnouncement = AnnouncementSummary & {
  type?: AnnouncementSummary["type"] | AnnouncementKind;
  isPinned?: boolean;
};

const filters: Array<{ key: AnnouncementFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "required", label: "必讀" },
  { key: "sop", label: "規則 SOP" },
  { key: "notice", label: "通知公告" },
  { key: "event", label: "活動 / 折扣" },
];

const typeMeta: Record<AnnouncementKind, { label: string; badgeClass: string; rowClass: string }> = {
  required: {
    label: "必讀",
    badgeClass: "bg-[#ffe8ed] text-[#ff4964]",
    rowClass: "bg-[#fff7f8]",
  },
  sop: {
    label: "規則 SOP",
    badgeClass: "bg-[#fff3e6] text-[#d77a1f]",
    rowClass: "bg-white",
  },
  notice: {
    label: "通知公告",
    badgeClass: "bg-[#eafbf4] text-[#15935d]",
    rowClass: "bg-white",
  },
  event: {
    label: "活動 / 折扣",
    badgeClass: "bg-[#eaf2ff] text-[#2f6fe8]",
    rowClass: "bg-white",
  },
};

const toDisplayTime = (value: string | undefined) => {
  if (!value) return "未設定";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toTimestamp = (item: UiAnnouncement) => {
  const candidates = [item.scheduledAt, item.publishedAt, item.deadlineLabel, item.effectiveRange, item.acknowledgedAt];
  for (const candidate of candidates) {
    const parsed = Date.parse(candidate ?? "");
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const inferKind = (item: UiAnnouncement): AnnouncementKind => {
  if (item.type === "required" || item.type === "sop" || item.type === "notice" || item.type === "event") return item.type;
  if (item.priority === "required") return "required";
  const text = `${item.title} ${item.summary} ${item.content ?? ""}`.toLowerCase();
  if (/sop|規則|流程|制度|手冊/.test(text)) return "sop";
  if (/活動|折扣|優惠|課程|報名|event|sale/.test(text)) return "event";
  return "notice";
};

const splitAnnouncementLines = (item: UiAnnouncement) => {
  const source = item.content || item.summary || "";
  return source
    .split(/\n+|。|；|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
};

function DetailBlock({
  icon,
  title,
  children,
  tone = "neutral",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: "neutral" | "success" | "warm";
}) {
  const toneClass = {
    neutral: "border-[#dfe7ef] bg-[#fbfaf4]",
    success: "border-[#1cb4a3] bg-[#eefdfa]",
    warm: "border-[#eadfca] bg-[#fffdf7]",
  }[tone];

  return (
    <section className={cn("rounded-[8px] border p-4", toneClass)}>
      <div className="mb-2 flex items-center gap-2 text-[12px] font-black text-[#10233f]">
        {icon}
        {title}
      </div>
      <div className="text-[13px] font-bold leading-7 text-[#637185]">{children}</div>
    </section>
  );
}

interface EmployeeAnnouncementsPageProps {
  announcementId?: string;
}

export default function EmployeeAnnouncementsPage({ announcementId }: EmployeeAnnouncementsPageProps) {
  const auth = useAuthMe();
  const facilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AnnouncementFilter>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [pinOverrides, setPinOverrides] = useState<Record<string, boolean>>({});
  const [ackOverrides, setAckOverrides] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState({
    title: "",
    content: "",
    type: "notice" as AnnouncementKind,
    pinned: false,
    scheduledAt: "",
  });
  const { data, isLoading, isError } = useQuery({ queryKey: ["/api/bff/employee/home", "announcements"], queryFn: fetchEmployeeHome });
  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeEmployeeAnnouncement(id, facilityKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "announcements"] });
    },
  });
  const createMutation = useMutation({
    mutationFn: () => {
      const scheduledAt = draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : undefined;
      return createEmployeeResource({
        facilityKey,
        category: "announcement",
        title: draft.title.trim(),
        content: JSON.stringify({
          body: draft.content.trim(),
          type: draft.type,
          scheduledAt,
        }),
        isPinned: draft.pinned,
      });
    },
    onSuccess: () => {
      setDraft({ title: "", content: "", type: "notice", pinned: false, scheduledAt: "" });
      setComposerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "announcements"] });
    },
  });
  const updatePinMutation = useMutation({
    mutationFn: ({ resourceId, isPinned }: { resourceId: number; isPinned: boolean }) => updateEmployeeResource(resourceId, { isPinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "announcements"] });
    },
  });

  const announcements = useMemo(() => {
    const serverItems = (data?.announcements.data ?? []) as UiAnnouncement[];
    return serverItems.map((item) => ({
      ...item,
      isPinned: pinOverrides[item.id] ?? item.isPinned ?? item.priority === "required",
      isAcknowledged: ackOverrides[item.id] ?? item.isAcknowledged,
    }));
  }, [ackOverrides, data?.announcements.data, pinOverrides]);

  const filteredAnnouncements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return announcements
      .filter((item) => (filter === "all" ? true : inferKind(item) === filter))
      .filter((item) => {
        if (!normalizedQuery) return true;
        return `${item.title} ${item.summary ?? ""} ${item.content ?? ""} ${item.effectiveRange ?? ""}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        const pinned = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
        if (pinned !== 0) return pinned;
        const required = Number(inferKind(b) === "required") - Number(inferKind(a) === "required");
        if (required !== 0) return required;
        return toTimestamp(b) - toTimestamp(a);
      });
  }, [announcements, filter, query]);

  const counts = useMemo(() => ({
    all: announcements.length,
    required: announcements.filter((item) => inferKind(item) === "required").length,
    sop: announcements.filter((item) => inferKind(item) === "sop").length,
    notice: announcements.filter((item) => inferKind(item) === "notice").length,
    event: announcements.filter((item) => inferKind(item) === "event").length,
  }), [announcements]);
  const unread = announcements.filter((item) => !item.isAcknowledged).length;
  const pinned = announcements.filter((item) => item.isPinned).length;
  const selectedAnnouncement = useMemo(() => {
    if (!announcementId) return undefined;
    const decodedId = decodeURIComponent(announcementId);
    return announcements.find((item) => item.id === decodedId);
  }, [announcementId, announcements]);

  const submitAnnouncement = () => {
    if (!draft.title.trim()) return;
    createMutation.mutate();
  };

  const markAcknowledged = (item: UiAnnouncement) => {
    ackMutation.mutate(item.id);
  };

  const togglePinned = (item: UiAnnouncement) => {
    const nextValue = !item.isPinned;
    setPinOverrides((overrides) => ({ ...overrides, [item.id]: nextValue }));
    if (item.resourceId) updatePinMutation.mutate({ resourceId: item.resourceId, isPinned: nextValue });
  };

  if (announcementId) {
    const item = selectedAnnouncement;
    const kind = item ? inferKind(item) : "notice";
    const meta = typeMeta[kind];
    const acknowledged = Boolean(item?.isAcknowledged);
    const lines = item ? splitAnnouncementLines(item) : [];

    return (
      <EmployeeShell title="群組公告" subtitle="公告詳情、建議動作與已讀確認">
        {isLoading ? (
          <WorkbenchCard className="p-0">
            <DreamLoader compact label="公告詳情載入中" />
          </WorkbenchCard>
        ) : !item ? (
          <WorkbenchCard className="p-8 text-center">
            <Bell className="mx-auto h-10 w-10 text-[#9aa8ba]" />
            <h2 className="mt-3 text-[18px] font-black text-[#10233f]">找不到這則公告</h2>
            <p className="mt-1 text-[13px] font-bold text-[#8b9aae]">公告可能已下架，或資料來源尚未同步。</p>
            <Link href="/employee/announcements" className="workbench-focus mt-5 inline-flex min-h-10 items-center rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white">
              返回公告列表
            </Link>
          </WorkbenchCard>
        ) : (
          <div className="space-y-4">
            <Link href="/employee/announcements" className="workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] px-2 text-[12px] font-black text-[#637185] hover:bg-white">
              <ArrowLeft className="h-4 w-4" />
              返回公告列表 / {meta.label}
            </Link>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <WorkbenchCard className="p-5 lg:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-[6px] px-2 py-1 text-[11px] font-black", meta.badgeClass)}>{meta.label}</span>
                  {item.isPinned ? <span className="rounded-[6px] bg-[#eef2f6] px-2 py-1 text-[11px] font-black text-[#637185]">置頂</span> : null}
                  <span className="text-[12px] font-bold text-[#8b9aae]">{toDisplayTime(item.scheduledAt ?? item.publishedAt ?? item.effectiveRange)}</span>
                  <span className="text-[12px] font-bold text-[#8b9aae]">・駿斯 CMS</span>
                </div>
                <h2 className="mt-5 max-w-[820px] text-[28px] font-black leading-tight text-[#10233f] lg:text-[34px]">
                  {item.title}
                </h2>
                <div className="mt-3 h-1 w-44 rounded-full bg-[#ff6b78]" />

                <div className="mt-7 space-y-4">
                  <DetailBlock icon={<ClipboardList className="h-4 w-4 text-[#d27a16]" />} title="摘要" tone="warm">
                    <p>{item.summary || item.content || "此公告尚未填寫摘要。"}</p>
                  </DetailBlock>

                  <DetailBlock icon={<CheckCircle2 className="h-4 w-4 text-[#1cb4a3]" />} title="建議動作" tone="success">
                    {lines.length ? (
                      <ol className="list-decimal space-y-1 pl-4">
                        {lines.slice(0, 3).map((line, index) => <li key={`${item.id}-action-${index}`}>{line}</li>)}
                      </ol>
                    ) : (
                      <p>請閱讀公告內容，並依現場主管指示完成確認。</p>
                    )}
                  </DetailBlock>

                  <DetailBlock icon={<MessageSquareReply className="h-4 w-4 text-[#7a8ba0]" />} title="建議回覆模板">
                    <p>
                      「已閱讀 {item.title}，會依公告內容完成現場作業與回報。」
                    </p>
                  </DetailBlock>

                  <DetailBlock icon={<FileText className="h-4 w-4 text-[#d27a16]" />} title="原文">
                    <p className="whitespace-pre-wrap">{item.content || item.summary || "無原文內容。"}</p>
                  </DetailBlock>
                </div>
              </WorkbenchCard>

              <div className="space-y-4">
                <WorkbenchCard className="p-5">
                  <div className="border-l-4 border-[#ff4964] pl-3">
                    <h3 className="text-[16px] font-black text-[#10233f]">已讀確認</h3>
                    <p className="mt-2 text-[12px] font-bold leading-5 text-[#637185]">
                      {kind === "required" ? "重要公告需要員工確認理解。" : "可在閱讀後標記已確認。"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => markAcknowledged(item)}
                    disabled={ackMutation.isPending || acknowledged}
                    className={cn(
                      "workbench-focus mt-4 flex min-h-10 w-full items-center justify-center rounded-[8px] text-[13px] font-black disabled:cursor-not-allowed",
                      acknowledged ? "bg-[#eef2f6] text-[#637185]" : "bg-[#1f3f68] text-white",
                    )}
                  >
                    {acknowledged ? "已確認理解" : "我已讀並理解"}
                  </button>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[12px] font-bold text-[#8b9aae]">
                      <span>{acknowledged ? "你的確認已完成" : "尚未完成你的確認"}</span>
                      <span>{acknowledged ? "1 / 1" : "0 / 1"}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#c8d3df] bg-white">
                      <div className="h-full rounded-full bg-[#6ccf57]" style={{ width: acknowledged ? "100%" : "0%" }} />
                    </div>
                  </div>
                </WorkbenchCard>

                <WorkbenchCard className="p-5">
                  <div className="border-l-4 border-[#6ccf57] pl-3">
                    <h3 className="text-[16px] font-black text-[#10233f]">已確認名單</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {acknowledged ? (
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1cb4a3] text-[12px] font-black text-white">
                          {(auth.data?.displayName ?? "你").slice(0, 1)}
                        </span>
                        <div>
                          <p className="text-[13px] font-black text-[#10233f]">{auth.data?.displayName ?? "你"}</p>
                          <p className="text-[11px] font-bold text-[#8b9aae]">已確認</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 rounded-[8px] bg-[#f7f9fb] p-3">
                        <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-[#8b9aae]" />
                        <p className="text-[12px] font-bold leading-5 text-[#637185]">
                          名單明細 BFF 尚未接線；目前顯示你的個人確認狀態。
                        </p>
                      </div>
                    )}
                  </div>
                </WorkbenchCard>
              </div>
            </div>
          </div>
        )}
      </EmployeeShell>
    );
  }

  return (
    <EmployeeShell title="群組公告" subtitle={`共 ${counts.all} 則・${unread} 則尚未確認・${pinned} 則置頂`}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "workbench-focus min-h-9 rounded-[8px] border px-4 text-[12px] font-black",
                  filter === item.key ? "border-[#0d2a50] bg-[#0d2a50] text-white" : "border-[#dfe7ef] bg-white text-[#536175]",
                )}
              >
                {item.label} {counts[item.key]}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-[999px] border border-[#dfe7ef] bg-white px-4 shadow-sm sm:w-[360px]">
              <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋公告標題、內容..."
                className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none placeholder:text-[#9aa8ba]"
              />
            </label>
            <button
              type="button"
              onClick={() => setComposerOpen((value) => !value)}
              className="workbench-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white"
            >
              <Plus className="h-4 w-4" />
              新增公告
            </button>
          </div>
        </div>

        {composerOpen ? (
          <WorkbenchCard className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_180px_120px] lg:items-end">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Title</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
                  placeholder="公告標題"
                  className="mt-1 min-h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 text-[13px] font-bold outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Content</span>
                <input
                  value={draft.content}
                  onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))}
                  placeholder="內容可先寬鬆記錄，像 Notion 一樣補充"
                  className="mt-1 min-h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 text-[13px] font-bold outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Type / Time</span>
                <div className="mt-1 grid gap-2">
                  <select
                    value={draft.type}
                    onChange={(event) => setDraft((value) => ({ ...value, type: event.target.value as AnnouncementKind }))}
                    className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]"
                  >
                    <option value="required">必讀</option>
                    <option value="sop">規則 SOP</option>
                    <option value="notice">通知公告</option>
                    <option value="event">活動 / 折扣</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={draft.scheduledAt}
                    onChange={(event) => setDraft((value) => ({ ...value, scheduledAt: event.target.value }))}
                    className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-bold text-[#10233f]"
                  />
                </div>
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                  <input
                    type="checkbox"
                    checked={draft.pinned}
                    onChange={(event) => setDraft((value) => ({ ...value, pinned: event.target.checked }))}
                    className="h-4 w-4 rounded border-[#dfe7ef]"
                  />
                  置頂
                </label>
                <button
                  type="button"
                  onClick={submitAnnouncement}
                  disabled={!draft.title.trim() || createMutation.isPending}
                  className="workbench-focus min-h-10 rounded-[8px] bg-[#1f3f68] px-3 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#8b9aae]"
                >
                  {createMutation.isPending ? "送出中" : "加入清單"}
                </button>
              </div>
            </div>
            {createMutation.isError ? (
              <p className="mt-3 text-[12px] font-bold text-[#ff4964]">公告新增失敗，請確認資料庫連線或稍後再試。</p>
            ) : null}
          </WorkbenchCard>
        ) : null}

        <WorkbenchCard className="overflow-hidden p-0">
          {isLoading ? (
            <DreamLoader compact label="公告資料載入中" />
          ) : isError ? (
            <div className="p-8 text-center text-[13px] font-bold text-[#ff4964]">公告資料暫時無法取得。</div>
          ) : filteredAnnouncements.length ? (
            <div className="divide-y divide-dashed divide-[#d8e2ee]">
              {filteredAnnouncements.map((item) => {
                const kind = inferKind(item);
                const meta = typeMeta[kind];
                const displayTime = toDisplayTime(item.scheduledAt ?? item.publishedAt ?? item.effectiveRange);
                const acknowledged = Boolean(item.isAcknowledged);
                return (
                  <article key={item.id} className={cn("grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center", item.isPinned ? "bg-[#fff8f9]" : meta.rowClass)}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("mt-1 shrink-0 rounded-[6px] px-2 py-1 text-[11px] font-black", meta.badgeClass)}>{meta.label}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/employee/announcements/${encodeURIComponent(item.id)}`}
                            className="workbench-focus min-w-0 rounded-[6px] text-[14px] font-black leading-5 text-[#10233f] hover:text-[#1f6fd1]"
                          >
                            {item.title}
                          </Link>
                          {item.isPinned ? <Pin className="h-3.5 w-3.5 text-[#ff4964]" /> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-5 text-[#637185]">{item.summary || item.content || "尚未填寫內容"}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <button
                        type="button"
                        aria-label={item.isPinned ? "取消置頂" : "置頂"}
                        onClick={() => togglePinned(item)}
                        className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] border border-[#dfe7ef] bg-white text-[#637185]"
                      >
                        {item.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </button>
                      <div className="min-w-[92px] text-right">
                        <p className="inline-flex items-center justify-end gap-1 text-[11px] font-bold text-[#8b9aae]">
                          <Clock3 className="h-3.5 w-3.5" />
                          {displayTime}
                        </p>
                        <button
                          type="button"
                          disabled={ackMutation.isPending || acknowledged}
                          onClick={() => markAcknowledged(item)}
                          className={cn(
                            "mt-1 min-h-7 rounded-[6px] px-2 text-[11px] font-black disabled:cursor-not-allowed",
                            acknowledged ? "bg-[#eef2f6] text-[#637185]" : "bg-[#ffe8ed] text-[#ff4964]",
                          )}
                        >
                          {acknowledged ? "已讀" : "未確認"}
                        </button>
                      </div>
                      <Link
                        href={`/employee/announcements/${encodeURIComponent(item.id)}`}
                        aria-label={`查看 ${item.title}`}
                        className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] text-[#9aa8ba] hover:bg-[#f7f9fb] hover:text-[#1f6fd1]"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-[280px] place-items-center p-8 text-center">
              <div>
                <Bell className="mx-auto h-10 w-10 text-[#9aa8ba]" />
                <p className="mt-3 text-[16px] font-black text-[#10233f]">目前沒有符合條件的公告</p>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">公告模組已接 BFF；沒有資料時不補假公告。</p>
              </div>
            </div>
          )}
        </WorkbenchCard>

        <div className="flex items-start gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-4 py-3 text-[12px] font-bold leading-5 text-[#637185]">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6fd1]" />
          公告列表吃 Employee BFF；員工新增公告走 employee_resources/announcement，正式對外發布與審核仍保留在 supervisor/system announcement governance。
        </div>
      </div>
    </EmployeeShell>
  );
}
