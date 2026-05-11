import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Clock3,
  EyeOff,
  Megaphone,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import type { AnnouncementSummary } from "@shared/domain/workbench";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import {
  acknowledgeEmployeeAnnouncement,
  createEmployeeResource,
  fetchEmployeeHome,
  hideAnnouncementOverlay,
  listHiddenAnnouncementOverlays,
  pinAnnouncementOverlay,
  unhideAnnouncementOverlay,
  unpinAnnouncementOverlay,
  updateAnnouncementOverlayNote,
} from "../home/api";

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
  required: { label: "必讀", badgeClass: "bg-[#ffe8ed] text-[#ff4964]", rowClass: "bg-[#fff7f8]" },
  sop: { label: "規則 SOP", badgeClass: "bg-[#fff3e6] text-[#d77a1f]", rowClass: "bg-white" },
  notice: { label: "通知公告", badgeClass: "bg-[#eafbf4] text-[#15935d]", rowClass: "bg-white" },
  event: { label: "活動 / 折扣", badgeClass: "bg-[#eaf2ff] text-[#2f6fe8]", rowClass: "bg-white" },
};

const PIN_PRESETS: Array<{ key: string; label: string; hours: number }> = [
  { key: "1h", label: "1 小時", hours: 1 },
  { key: "4h", label: "4 小時", hours: 4 },
  { key: "1d", label: "1 天", hours: 24 },
  { key: "3d", label: "3 天", hours: 72 },
  { key: "7d", label: "7 天", hours: 168 },
];

const toDisplayTime = (value: string | undefined | null) => {
  if (!value) return "未設定";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const toRelativeFuture = (iso: string | null | undefined) => {
  if (!iso) return null;
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return null;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes} 分鐘後到期`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} 小時後到期`;
  const days = Math.round(hours / 24);
  return `${days} 天後到期`;
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

export default function EmployeeAnnouncementsPage() {
  const auth = useAuthMe();
  const facilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const isSupervisor = Boolean(
    auth.data?.grantedRoles?.includes("supervisor") || auth.data?.grantedRoles?.includes("system"),
  );
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AnnouncementFilter>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [hiddenPanelOpen, setHiddenPanelOpen] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [pinUntilDraft, setPinUntilDraft] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    content: "",
    type: "notice" as AnnouncementKind,
    pinned: false,
    scheduledAt: "",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/bff/employee/home", "announcements"],
    queryFn: fetchEmployeeHome,
  });
  const hiddenQuery = useQuery({
    queryKey: ["/api/announcement-overlays/hidden"],
    queryFn: listHiddenAnnouncementOverlays,
    enabled: isSupervisor && hiddenPanelOpen,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "announcements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/announcement-overlays/hidden"] });
  };

  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeEmployeeAnnouncement(id, facilityKey),
    onSuccess: invalidateAll,
  });
  const createMutation = useMutation({
    mutationFn: () => {
      const scheduledAt = draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : undefined;
      return createEmployeeResource({
        facilityKey,
        category: "announcement",
        title: draft.title.trim(),
        content: JSON.stringify({ body: draft.content.trim(), type: draft.type, scheduledAt }),
        isPinned: draft.pinned,
      });
    },
    onSuccess: () => {
      setDraft({ title: "", content: "", type: "notice", pinned: false, scheduledAt: "" });
      setComposerOpen(false);
      invalidateAll();
    },
  });
  const hideMutation = useMutation({ mutationFn: (id: string) => hideAnnouncementOverlay(id), onSuccess: invalidateAll });
  const unhideMutation = useMutation({ mutationFn: (id: string) => unhideAnnouncementOverlay(id), onSuccess: invalidateAll });
  const pinMutation = useMutation({
    mutationFn: ({ id, until }: { id: string; until: string }) => pinAnnouncementOverlay(id, until),
    onSuccess: () => {
      setActivePinId(null);
      setPinUntilDraft("");
      invalidateAll();
    },
  });
  const unpinMutation = useMutation({ mutationFn: (id: string) => unpinAnnouncementOverlay(id), onSuccess: invalidateAll });
  const noteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string | null }) => updateAnnouncementOverlayNote(id, note),
    onSuccess: () => {
      setActiveNoteId(null);
      setNoteDraft("");
      invalidateAll();
    },
  });

  const announcements = useMemo(() => (data?.announcements.data ?? []) as UiAnnouncement[], [data?.announcements.data]);

  const filteredAnnouncements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return announcements
      .filter((item) => (filter === "all" ? true : inferKind(item) === filter))
      .filter((item) => {
        if (!normalizedQuery) return true;
        return `${item.title} ${item.summary ?? ""} ${item.content ?? ""} ${item.overlayNote ?? ""} ${item.effectiveRange ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
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
  const emptyMessage = data?.announcements.status === "unavailable"
    ? data.announcements.meta.fallbackReason
    : data?.announcements.status === "degraded"
      ? data.announcements.meta.fallbackReason
      : "公告模組已接 BFF；沒有資料時不補假公告。";

  const submitAnnouncement = () => {
    if (!draft.title.trim()) return;
    createMutation.mutate();
  };

  const openNoteEditor = (item: UiAnnouncement) => {
    setActiveNoteId(item.id);
    setNoteDraft(item.overlayNote ?? "");
  };
  const submitNote = (id: string) => {
    const trimmed = noteDraft.trim();
    noteMutation.mutate({ id, note: trimmed.length === 0 ? null : trimmed });
  };

  const openPinPicker = (item: UiAnnouncement) => {
    setActivePinId(item.id);
    const next = new Date(Date.now() + 60 * 60 * 1000);
    next.setSeconds(0, 0);
    const iso = new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString();
    setPinUntilDraft(iso.slice(0, 16));
  };
  const submitPin = (id: string, hours?: number) => {
    let untilIso: string | null = null;
    if (hours) untilIso = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    else if (pinUntilDraft) untilIso = new Date(pinUntilDraft).toISOString();
    if (!untilIso) return;
    pinMutation.mutate({ id, until: untilIso });
  };

  return (
    <EmployeeShell
      title="群組公告"
      subtitle={`共 ${counts.all} 則・${unread} 則尚未確認・${pinned} 則置頂`}
    >
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                data-testid={`button-filter-${item.key}`}
                className={cn(
                  "workbench-focus min-h-9 rounded-[8px] border px-4 text-[12px] font-black",
                  filter === item.key
                    ? "border-[#0d2a50] bg-[#0d2a50] text-white"
                    : "border-[#dfe7ef] bg-white text-[#536175]",
                )}
              >
                {item.label} {counts[item.key]}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-[999px] border border-[#dfe7ef] bg-white px-4 shadow-sm sm:w-[320px]">
              <Search className="h-4 w-4 shrink-0 text-[#8b9aae]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋公告標題、內容、備註..."
                data-testid="input-search-announcements"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#10233f] outline-none placeholder:text-[#9aa8ba]"
              />
            </label>
            {isSupervisor ? (
              <button
                type="button"
                onClick={() => setHiddenPanelOpen((v) => !v)}
                data-testid="button-toggle-hidden"
                className="workbench-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-4 text-[13px] font-black text-[#536175]"
              >
                <EyeOff className="h-4 w-4" />
                {hiddenPanelOpen ? "收起隱藏列表" : "已隱藏公告"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setComposerOpen((value) => !value)}
              data-testid="button-toggle-composer"
              className="workbench-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white"
            >
              <Plus className="h-4 w-4" />
              新增公告
            </button>
          </div>
        </div>

        {/* Hidden panel (supervisor) */}
        {isSupervisor && hiddenPanelOpen ? (
          <WorkbenchCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-black text-[#10233f]">已隱藏公告（僅主管可見）</h3>
              <span className="text-[11px] font-bold text-[#8b9aae]">
                共 {hiddenQuery.data?.length ?? 0} 則
              </span>
            </div>
            {hiddenQuery.isLoading ? (
              <DreamLoader compact label="讀取已隱藏公告" />
            ) : hiddenQuery.data && hiddenQuery.data.length > 0 ? (
              <ul className="divide-y divide-dashed divide-[#d8e2ee]">
                {hiddenQuery.data.map((row) => (
                  <li key={row.announcementId} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-black text-[#10233f]" data-testid={`text-hidden-id-${row.announcementId}`}>
                        {row.announcementId}
                      </p>
                      <p className="text-[11px] font-bold text-[#8b9aae]">
                        由 {row.lastModifiedByName ?? row.lastModifiedBy}（{row.lastModifiedRole}）於 {toDisplayTime(row.updatedAt)} 隱藏
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => unhideMutation.mutate(row.announcementId)}
                      disabled={unhideMutation.isPending}
                      data-testid={`button-unhide-${row.announcementId}`}
                      className="workbench-focus inline-flex min-h-8 items-center gap-1 rounded-[6px] bg-[#1cb4a3] px-3 text-[11px] font-black text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      恢復顯示
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-[12px] font-bold text-[#8b9aae]">目前沒有被隱藏的公告。</p>
            )}
          </WorkbenchCard>
        ) : null}

        {/* Composer */}
        {composerOpen ? (
          <WorkbenchCard className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_180px_120px] lg:items-end">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Title</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
                  placeholder="公告標題"
                  data-testid="input-new-title"
                  className="mt-1 min-h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 text-[13px] font-bold outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8b9aae]">Content</span>
                <input
                  value={draft.content}
                  onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))}
                  placeholder="內容"
                  data-testid="input-new-content"
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
                  data-testid="button-submit-new-announcement"
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

        {/* List */}
        <WorkbenchCard className="overflow-hidden p-0">
          {isLoading ? (
            <DreamLoader compact label="公告資料載入中" />
          ) : isError ? (
            <div className="p-8 text-center text-[13px] font-bold text-[#ff4964]">公告資料暫時無法取得。</div>
          ) : filteredAnnouncements.length ? (
            <ul className="divide-y divide-dashed divide-[#d8e2ee]">
              {filteredAnnouncements.map((item) => {
                const kind = inferKind(item);
                const meta = typeMeta[kind];
                const acknowledged = Boolean(item.isAcknowledged);
                const pinExpiry = toRelativeFuture(item.overlayPinnedUntil);
                const isOverlayPinned = Boolean(item.overlayPinnedUntil) && pinExpiry !== null;
                const sortTime = toDisplayTime(item.scheduledAt ?? item.publishedAt ?? item.effectiveRange);
                const fullText = item.content || item.summary || "（無原文內容）";
                return (
                  <li
                    key={item.id}
                    className={cn("px-4 py-4", item.isPinned ? "bg-[#fff8f9]" : meta.rowClass)}
                    data-testid={`row-announcement-${item.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-[6px] px-2 py-1 text-[11px] font-black", meta.badgeClass)}>{meta.label}</span>
                      {isOverlayPinned ? (
                        <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#ffe8ed] px-2 py-1 text-[11px] font-black text-[#ff4964]">
                          <Pin className="h-3 w-3" /> 置頂・{pinExpiry}
                        </span>
                      ) : item.isPinned ? (
                        <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#eef2f6] px-2 py-1 text-[11px] font-black text-[#637185]">
                          <Pin className="h-3 w-3" /> 置頂
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8b9aae]">
                        <Clock3 className="h-3 w-3" /> {sortTime}
                      </span>
                      {item.sourceLabel ? (
                        <span className="text-[11px] font-bold text-[#8b9aae]">・{item.sourceLabel}</span>
                      ) : null}
                    </div>

                    <h3 className="mt-2 text-[14px] font-black leading-5 text-[#10233f]">{item.title}</h3>

                    {item.overlayNote ? (
                      <div className="mt-2 flex items-start gap-2 rounded-[6px] border border-[#f1c66c] bg-[#fffaf0] px-3 py-2 text-[12px] font-bold leading-5 text-[#8a6510]">
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="whitespace-pre-wrap">{item.overlayNote}</span>
                        <span className="ml-auto text-[10px] font-bold text-[#b89252]">
                          {item.overlayLastModifiedByName ?? "—"}
                        </span>
                      </div>
                    ) : null}

                    <p
                      className="mt-2 whitespace-pre-wrap text-[13px] font-medium leading-6 text-[#3a4658]"
                      data-testid={`text-content-${item.id}`}
                    >
                      {fullText}
                    </p>

                    {/* Action bar */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={ackMutation.isPending || acknowledged}
                        onClick={() => ackMutation.mutate(item.id)}
                        data-testid={`button-ack-${item.id}`}
                        className={cn(
                          "workbench-focus inline-flex min-h-8 items-center gap-1 rounded-[6px] px-3 text-[11px] font-black disabled:cursor-not-allowed",
                          acknowledged ? "bg-[#eef2f6] text-[#637185]" : "bg-[#1f3f68] text-white",
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {acknowledged ? "已讀" : "我已讀"}
                      </button>

                      {isOverlayPinned ? (
                        <button
                          type="button"
                          onClick={() => unpinMutation.mutate(item.id)}
                          disabled={unpinMutation.isPending}
                          data-testid={`button-unpin-${item.id}`}
                          className="workbench-focus inline-flex min-h-8 items-center gap-1 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[11px] font-black text-[#637185]"
                        >
                          <PinOff className="h-3.5 w-3.5" /> 取消置頂
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPinPicker(item)}
                          data-testid={`button-pin-${item.id}`}
                          className="workbench-focus inline-flex min-h-8 items-center gap-1 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[11px] font-black text-[#637185]"
                        >
                          <Pin className="h-3.5 w-3.5" /> 置頂到…
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openNoteEditor(item)}
                        data-testid={`button-note-${item.id}`}
                        className="workbench-focus inline-flex min-h-8 items-center gap-1 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[11px] font-black text-[#637185]"
                      >
                        <Pencil className="h-3.5 w-3.5" /> {item.overlayNote ? "編輯備註" : "加備註"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`確定要隱藏這則公告？\n（僅主管可恢復顯示）\n\n${item.title}`)) {
                            hideMutation.mutate(item.id);
                          }
                        }}
                        disabled={hideMutation.isPending}
                        data-testid={`button-hide-${item.id}`}
                        className="workbench-focus inline-flex min-h-8 items-center gap-1 rounded-[6px] border border-[#fcd6db] bg-[#fff5f6] px-3 text-[11px] font-black text-[#d23a4f]"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> 隱藏
                      </button>
                    </div>

                    {/* Pin picker inline */}
                    {activePinId === item.id ? (
                      <div className="mt-3 rounded-[8px] border border-[#dfe7ef] bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-black text-[#637185]">置頂期間：</span>
                          {PIN_PRESETS.map((preset) => (
                            <button
                              key={preset.key}
                              type="button"
                              onClick={() => submitPin(item.id, preset.hours)}
                              disabled={pinMutation.isPending}
                              data-testid={`button-pin-preset-${preset.key}-${item.id}`}
                              className="workbench-focus min-h-8 rounded-[6px] border border-[#dfe7ef] bg-[#f7f9fb] px-3 text-[11px] font-black text-[#10233f]"
                            >
                              {preset.label}
                            </button>
                          ))}
                          <input
                            type="datetime-local"
                            value={pinUntilDraft}
                            onChange={(e) => setPinUntilDraft(e.target.value)}
                            data-testid={`input-pin-until-${item.id}`}
                            className="min-h-8 rounded-[6px] border border-[#dfe7ef] bg-white px-2 text-[11px] font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => submitPin(item.id)}
                            disabled={!pinUntilDraft || pinMutation.isPending}
                            data-testid={`button-pin-confirm-${item.id}`}
                            className="workbench-focus min-h-8 rounded-[6px] bg-[#0d2a50] px-3 text-[11px] font-black text-white disabled:bg-[#8b9aae]"
                          >
                            自訂時間
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActivePinId(null);
                              setPinUntilDraft("");
                            }}
                            className="workbench-focus inline-flex min-h-8 items-center gap-1 rounded-[6px] px-2 text-[11px] font-black text-[#8b9aae]"
                          >
                            <X className="h-3.5 w-3.5" /> 取消
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Note editor inline */}
                    {activeNoteId === item.id ? (
                      <div className="mt-3 rounded-[8px] border border-[#dfe7ef] bg-white p-3">
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="例如：與 5/8 公告重複；以此則為準"
                          rows={2}
                          maxLength={1000}
                          data-testid={`input-note-${item.id}`}
                          className="w-full rounded-[6px] border border-[#dfe7ef] bg-[#fbfcfd] p-2 text-[12px] font-bold text-[#10233f] outline-none"
                        />
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveNoteId(null);
                              setNoteDraft("");
                            }}
                            className="workbench-focus min-h-8 rounded-[6px] px-3 text-[11px] font-black text-[#8b9aae]"
                          >
                            取消
                          </button>
                          {item.overlayNote ? (
                            <button
                              type="button"
                              onClick={() => noteMutation.mutate({ id: item.id, note: null })}
                              disabled={noteMutation.isPending}
                              data-testid={`button-note-clear-${item.id}`}
                              className="workbench-focus min-h-8 rounded-[6px] border border-[#dfe7ef] bg-white px-3 text-[11px] font-black text-[#d23a4f]"
                            >
                              清除備註
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => submitNote(item.id)}
                            disabled={noteMutation.isPending}
                            data-testid={`button-note-save-${item.id}`}
                            className="workbench-focus min-h-8 rounded-[6px] bg-[#0d2a50] px-3 text-[11px] font-black text-white"
                          >
                            儲存
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid min-h-[280px] place-items-center p-8 text-center">
              <div>
                <Bell className="mx-auto h-10 w-10 text-[#9aa8ba]" />
                <p className="mt-3 text-[16px] font-black text-[#10233f]">目前沒有符合條件的公告</p>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">{emptyMessage}</p>
              </div>
            </div>
          )}
        </WorkbenchCard>

        <div className="flex items-start gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-4 py-3 text-[12px] font-bold leading-5 text-[#637185]">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6fd1]" />
          公告原文直接顯示於列表；任何登入者皆可置頂、加備註、隱藏；只有主管可恢復已隱藏的公告。
        </div>
      </div>
    </EmployeeShell>
  );
}
