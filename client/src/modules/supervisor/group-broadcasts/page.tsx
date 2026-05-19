import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Radio, Sparkles, Trash2, Users } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useAuthMe } from "@/shared/auth/session";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface GroupBroadcast {
  id: number;
  sourceGroupId: string | null;
  sourceFacilityKey: string;
  targetFacilityKeys: string[];
  originalText: string;
  title: string | null;
  summary: string | null;
  priority: string;
  senderName: string | null;
  geminiStatus: string;
  isEvent: boolean | null;
  startAt: string | null;
  endAt: string | null;
  geminiProcessedAt: string | null;
  candidateId: number | null;
  createdAt: string;
}

const FACILITY_LABELS: Record<string, string> = {
  xinbei_pool: "新北高中",
  salu_counter: "三重商工",
  sanmin_pool: "三民高中",
  songshan_pool: "松山",
  zhuke_pool: "竹科",
};

const facilityLabel = (key: string) => FACILITY_LABELS[key] ?? key;

const priorityMeta: Record<string, { label: string; cls: string }> = {
  normal: { label: "一般", cls: "bg-[#eef2f6] text-[#536175]" },
  high: { label: "重要", cls: "bg-[#fff3e6] text-[#d77a1f]" },
  urgent: { label: "緊急", cls: "bg-[#ffe8eb] text-[#ff4964]" },
};

const geminiStatusMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: "待分析", cls: "bg-[#eef2f6] text-[#637185]" },
  processing: { label: "分析中", cls: "bg-[#fff3e6] text-[#d77a1f]" },
  done: { label: "分析完成", cls: "bg-[#eaf8ef] text-[#15935d]" },
  failed: { label: "分析失敗", cls: "bg-[#ffe8eb] text-[#ff4964]" },
  skipped: { label: "無 API Key", cls: "bg-[#eef2f6] text-[#8b9aae]" },
};

const toDisplayTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : iso;
};

const FILTER_OPTIONS = [
  { value: "", label: "全部場館" },
  { value: "xinbei_pool", label: "新北高中" },
  { value: "salu_counter", label: "三重商工" },
  { value: "sanmin_pool", label: "三民高中" },
  { value: "songshan_pool", label: "松山" },
  { value: "zhuke_pool", label: "竹科" },
];

async function fetchAdminBroadcasts(sourceFacilityKey?: string): Promise<{ data: GroupBroadcast[] }> {
  const url = sourceFacilityKey
    ? `/api/group-broadcasts/admin?sourceFacilityKey=${encodeURIComponent(sourceFacilityKey)}&limit=100`
    : "/api/group-broadcasts/admin?limit=100";
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("讀取失敗");
  return res.json() as Promise<{ data: GroupBroadcast[] }>;
}

async function createBroadcast(payload: { sourceFacilityKey: string; originalText: string; priority?: string }) {
  return apiRequest("POST", "/api/group-broadcasts", payload);
}

async function deleteBroadcast(id: number) {
  return apiRequest("DELETE", `/api/group-broadcasts/${id}`);
}

export default function SupervisorGroupBroadcastsPage() {
  const auth = useAuthMe();
  const activeFacilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();

  const [filterSource, setFilterSource] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState({
    sourceFacilityKey: activeFacilityKey,
    originalText: "",
    priority: "normal",
  });

  const broadcastsQuery = useQuery({
    queryKey: ["/api/group-broadcasts/admin", filterSource],
    queryFn: () => fetchAdminBroadcasts(filterSource || undefined),
  });

  const createMutation = useMutation({
    mutationFn: createBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/group-broadcasts/admin"] });
      setForm({ sourceFacilityKey: activeFacilityKey, originalText: "", priority: "normal" });
      setComposerOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/group-broadcasts/admin"] });
    },
  });

  const broadcasts = broadcastsQuery.data?.data ?? [];
  const isFanOutBroadcast = (b: GroupBroadcast) => b.targetFacilityKeys.length > 1;

  const handleCreate = () => {
    if (!form.originalText.trim()) return;
    createMutation.mutate({
      sourceFacilityKey: form.sourceFacilityKey,
      originalText: form.originalText.trim(),
      priority: form.priority as "normal" | "high" | "urgent",
    });
  };

  const handleDelete = (b: GroupBroadcast) => {
    const displayTitle = b.title ?? b.originalText.slice(0, 30);
    if (!window.confirm(`確定要刪除「${displayTitle}」？此操作無法復原。`)) return;
    deleteMutation.mutate(b.id);
  };

  return (
    <RoleShell
      role="supervisor"
      title="群組重要公告"
      subtitle="接收 LINE 群組廣播並自動 fan-out；Gemini 自動萃取標題、優先級，偵測活動並寫入候選池。"
    >
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterSource(opt.value)}
                data-testid={`button-filter-source-${opt.value || "all"}`}
                className={cn(
                  "workbench-focus min-h-9 rounded-[8px] border px-3 text-[12px] font-black",
                  filterSource === opt.value
                    ? "border-[#0d2a50] bg-[#0d2a50] text-white"
                    : "border-[#dfe7ef] bg-white text-[#536175]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setComposerOpen((v) => !v)}
            data-testid="button-toggle-composer"
            className="workbench-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white"
          >
            <Plus className="h-4 w-4" />
            手動發布
          </button>
        </div>

        {/* Composer */}
        {composerOpen ? (
          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#007166]">New Broadcast</p>
                <h2 className="mt-1 text-[18px] font-black">手動發布群組廣播</h2>
                <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">Gemini 將自動萃取標題與優先級，無需手動填寫。</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[12px] font-black text-[#536175]">來源場館</span>
                  <select
                    value={form.sourceFacilityKey}
                    onChange={(e) => setForm((f) => ({ ...f, sourceFacilityKey: e.target.value }))}
                    data-testid="select-facility"
                    className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-black outline-none focus:border-[#2f6fe8]"
                  >
                    {FILTER_OPTIONS.filter((o) => o.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {form.sourceFacilityKey === "salu_counter" ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#2f6fe8]">
                      <Radio className="h-3.5 w-3.5" />
                      三蘆區：自動 fan-out 至新北高中、三重商工、三民高中
                    </p>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-[12px] font-black text-[#536175]">優先級（可選，Gemini 會自動判斷）</span>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    data-testid="select-priority"
                    className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-black outline-none focus:border-[#2f6fe8]"
                  >
                    <option value="normal">一般</option>
                    <option value="high">重要</option>
                    <option value="urgent">緊急</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-[12px] font-black text-[#536175]">廣播原文（LINE 訊息內容）</span>
                <textarea
                  value={form.originalText}
                  onChange={(e) => setForm((f) => ({ ...f, originalText: e.target.value }))}
                  placeholder="貼入 LINE 群組訊息原文，Gemini 將自動分析標題、優先級，並偵測是否為活動/課程"
                  rows={6}
                  data-testid="input-original-text"
                  className="mt-2 w-full resize-y rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-3 text-[14px] font-bold leading-6 outline-none focus:border-[#2f6fe8]"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!form.originalText.trim() || createMutation.isPending}
                  data-testid="button-submit-broadcast"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-5 text-[13px] font-black text-white disabled:opacity-60"
                >
                  <Megaphone className="h-4 w-4" />
                  {createMutation.isPending ? "發送中..." : "發送廣播"}
                </button>
                {createMutation.isError ? (
                  <p className="text-[12px] font-bold text-[#ff4964]">發送失敗，請稍後再試</p>
                ) : null}
              </div>
            </div>
          </WorkbenchCard>
        ) : null}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "廣播總數", value: broadcasts.length, cls: "text-[#2f6fe8]" },
            { label: "三蘆區廣播", value: broadcasts.filter(isFanOutBroadcast).length, cls: "text-[#6947d8]" },
            { label: "Gemini 偵測活動", value: broadcasts.filter((b) => b.isEvent).length, cls: "text-[#15935d]" },
            { label: "LINE 群組來源", value: broadcasts.filter((b) => b.sourceGroupId).length, cls: "text-[#ef7d22]" },
          ].map(({ label, value, cls }) => (
            <WorkbenchCard key={label} className="p-4">
              <p className={cn("text-[24px] font-black", cls)}>{value}</p>
              <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">{label}</p>
            </WorkbenchCard>
          ))}
        </div>

        {/* Broadcast list */}
        <WorkbenchCard className="overflow-hidden p-0">
          <div className="border-b border-dashed border-[#d8e2ee] px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#8b9aae]">Broadcasts</p>
            <h2 className="mt-1 text-[16px] font-black">廣播記錄</h2>
          </div>

          {broadcastsQuery.isLoading ? (
            <DreamLoader compact label="載入廣播記錄" />
          ) : broadcastsQuery.isError ? (
            <div className="p-8 text-center text-[13px] font-bold text-[#ff4964]">讀取失敗</div>
          ) : broadcasts.length === 0 ? (
            <div className="p-8 text-center">
              <Megaphone className="mx-auto h-10 w-10 text-[#c7d2de]" />
              <p className="mt-3 text-[14px] font-black text-[#8b9aae]">尚無廣播記錄</p>
            </div>
          ) : (
            <ul className="divide-y divide-dashed divide-[#d8e2ee]">
              {broadcasts.map((b) => {
                const geminiMeta = geminiStatusMeta[b.geminiStatus] ?? geminiStatusMeta.pending;
                const isSanlu = isFanOutBroadcast(b);
                const pm = priorityMeta[b.priority] ?? priorityMeta.normal;
                const displayTitle = b.title ?? b.originalText.slice(0, 60);
                return (
                  <li key={b.id} className="px-5 py-4" data-testid={`row-broadcast-${b.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-[6px] bg-[#eef5ff] px-2 py-1 text-[10px] font-black text-[#2f6fe8]">
                            {facilityLabel(b.sourceFacilityKey)}
                          </span>
                          {b.priority !== "normal" ? (
                            <span className={cn("rounded-[6px] px-2 py-1 text-[10px] font-black", pm.cls)}>
                              {pm.label}
                            </span>
                          ) : null}
                          {b.sourceGroupId ? (
                            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#f0fff7] px-2 py-1 text-[10px] font-black text-[#15935d]">
                              LINE 群組
                            </span>
                          ) : null}
                          {isSanlu ? (
                            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#f3f0ff] px-2 py-1 text-[10px] font-black text-[#6947d8]">
                              <Users className="h-3 w-3" />
                              Fan-out × {b.targetFacilityKeys.length}
                            </span>
                          ) : null}
                          <span className={cn("rounded-[6px] px-2 py-1 text-[10px] font-black", geminiMeta.cls)}>
                            <Sparkles className="mr-1 inline h-3 w-3" />
                            {geminiMeta.label}
                          </span>
                          {b.isEvent ? (
                            <span className="rounded-[6px] bg-[#eaf8ef] px-2 py-1 text-[10px] font-black text-[#15935d]">
                              活動偵測 ✓
                            </span>
                          ) : null}
                          <span className="text-[11px] font-bold text-[#8b9aae]">{toDisplayTime(b.createdAt)}</span>
                          {b.senderName ? (
                            <span className="text-[11px] font-bold text-[#8b9aae]">by {b.senderName}</span>
                          ) : null}
                        </div>
                        {/* Title: shown once Gemini extracts it; fallback to truncated originalText */}
                        <h3 className="mt-2 text-[15px] font-black text-[#10233f]">{displayTitle}</h3>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] font-medium leading-6 text-[#3a4658]">
                          {b.originalText}
                        </p>
                        {b.summary ? (
                          <p className="mt-2 rounded-[6px] bg-[#f7f9fb] px-3 py-2 text-[12px] font-bold text-[#536175]">
                            <Sparkles className="mr-1 inline h-3 w-3 text-[#6947d8]" />
                            Gemini 摘要：{b.summary}
                          </p>
                        ) : null}
                        {isSanlu ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-[11px] font-black text-[#8b9aae]">Fan-out 目標：</span>
                            {b.targetFacilityKeys.map((fk) => (
                              <span key={fk} className="rounded-[4px] bg-[#eef2f6] px-2 py-0.5 text-[10px] font-black text-[#536175]">
                                {facilityLabel(fk)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${b.id}`}
                        aria-label="刪除廣播"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-[#ffd1da] bg-white text-[#ff4964] hover:bg-[#fff0f2] disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
