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
  facilityKey: string;
  sourceFacilityKey: string;
  isFanOut: boolean;
  parentId: number | null;
  fanOutTargets: string[] | null;
  title: string;
  content: string;
  createdBy: string;
  createdByName: string;
  sourceGroupId: string | null;
  senderName: string | null;
  priority: string;
  geminiStatus: string;
  geminiIsEvent: boolean | null;
  geminiStartAt: string | null;
  geminiEndAt: string | null;
  geminiSummary: string | null;
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

async function createBroadcast(payload: { facilityKey: string; title: string; content: string }) {
  return apiRequest("/api/group-broadcasts", { method: "POST", body: JSON.stringify(payload) });
}

async function deleteBroadcast(id: number) {
  return apiRequest(`/api/group-broadcasts/${id}`, { method: "DELETE" });
}

export default function SupervisorGroupBroadcastsPage() {
  const auth = useAuthMe();
  const activeFacilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();

  const [filterSource, setFilterSource] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState({
    facilityKey: activeFacilityKey,
    title: "",
    content: "",
  });

  const broadcastsQuery = useQuery({
    queryKey: ["/api/group-broadcasts/admin", filterSource],
    queryFn: () => fetchAdminBroadcasts(filterSource || undefined),
  });

  const createMutation = useMutation({
    mutationFn: createBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/group-broadcasts/admin"] });
      setForm({ facilityKey: activeFacilityKey, title: "", content: "" });
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
  const primaryBroadcasts = broadcasts.filter((b) => !b.isFanOut);

  const handleCreate = () => {
    if (!form.title.trim() || !form.content.trim()) return;
    createMutation.mutate({
      facilityKey: form.facilityKey,
      title: form.title.trim(),
      content: form.content.trim(),
    });
  };

  const handleDelete = (b: GroupBroadcast) => {
    if (!window.confirm(`確定要刪除「${b.title}」？若為三蘆區廣播，所有 fan-out 副本也會一併刪除。`)) return;
    deleteMutation.mutate(b.id);
  };

  return (
    <RoleShell
      role="supervisor"
      title="群組重要公告"
      subtitle="主管可發布廣播至指定場館；三蘆區自動 fan-out 至新北高中、三重商工、三民高中。Gemini 自動偵測活動並寫入候選池。"
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
            發布廣播
          </button>
        </div>

        {/* Composer */}
        {composerOpen ? (
          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#007166]">New Broadcast</p>
                <h2 className="mt-1 text-[18px] font-black">發布群組廣播</h2>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[12px] font-black text-[#536175]">發送場館</span>
                  <select
                    value={form.facilityKey}
                    onChange={(e) => setForm((f) => ({ ...f, facilityKey: e.target.value }))}
                    data-testid="select-facility"
                    className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-black outline-none focus:border-[#2f6fe8]"
                  >
                    {FILTER_OPTIONS.filter((o) => o.value).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {form.facilityKey === "salu_counter" ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#2f6fe8]">
                      <Radio className="h-3.5 w-3.5" />
                      三蘆區：自動 fan-out 至新北高中、三重商工、三民高中
                    </p>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-[12px] font-black text-[#536175]">廣播標題</span>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="公告標題（最多 200 字）"
                    data-testid="input-title"
                    className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-bold outline-none focus:border-[#2f6fe8]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[12px] font-black text-[#536175]">廣播內容</span>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="內容（Gemini 將自動分析是否為活動/課程）"
                  rows={5}
                  data-testid="input-content"
                  className="mt-2 w-full resize-y rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-3 text-[14px] font-bold leading-6 outline-none focus:border-[#2f6fe8]"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!form.title.trim() || !form.content.trim() || createMutation.isPending}
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
            { label: "主播廣播", value: primaryBroadcasts.length, cls: "text-[#2f6fe8]" },
            { label: "Fan-out 副本", value: broadcasts.filter((b) => b.isFanOut).length, cls: "text-[#6947d8]" },
            { label: "Gemini 偵測活動", value: broadcasts.filter((b) => b.geminiIsEvent).length, cls: "text-[#15935d]" },
            { label: "三蘆區廣播", value: broadcasts.filter((b) => b.sourceFacilityKey === "salu_counter" && !b.isFanOut).length, cls: "text-[#ef7d22]" },
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
          ) : primaryBroadcasts.length === 0 ? (
            <div className="p-8 text-center">
              <Megaphone className="mx-auto h-10 w-10 text-[#c7d2de]" />
              <p className="mt-3 text-[14px] font-black text-[#8b9aae]">尚無廣播記錄</p>
            </div>
          ) : (
            <ul className="divide-y divide-dashed divide-[#d8e2ee]">
              {primaryBroadcasts.map((b) => {
                const geminiMeta = geminiStatusMeta[b.geminiStatus] ?? geminiStatusMeta.pending;
                const isSanlu = b.sourceFacilityKey === "salu_counter";
                return (
                  <li key={b.id} className="px-5 py-4" data-testid={`row-broadcast-${b.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-[6px] bg-[#eef5ff] px-2 py-1 text-[10px] font-black text-[#2f6fe8]">
                            {facilityLabel(b.sourceFacilityKey)}
                          </span>
                          {b.priority !== "normal" ? (
                            <span className={cn("rounded-[6px] px-2 py-1 text-[10px] font-black", (priorityMeta[b.priority] ?? priorityMeta.normal).cls)}>
                              {(priorityMeta[b.priority] ?? priorityMeta.normal).label}
                            </span>
                          ) : null}
                          {b.sourceGroupId ? (
                            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#f0fff7] px-2 py-1 text-[10px] font-black text-[#15935d]">
                              LINE 群組
                            </span>
                          ) : null}
                          {isSanlu && b.fanOutTargets && b.fanOutTargets.length > 1 ? (
                            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#f3f0ff] px-2 py-1 text-[10px] font-black text-[#6947d8]">
                              <Users className="h-3 w-3" />
                              Fan-out × {b.fanOutTargets.length}
                            </span>
                          ) : null}
                          <span className={cn("rounded-[6px] px-2 py-1 text-[10px] font-black", geminiMeta.cls)}>
                            <Sparkles className="mr-1 inline h-3 w-3" />
                            {geminiMeta.label}
                          </span>
                          {b.geminiIsEvent ? (
                            <span className="rounded-[6px] bg-[#eaf8ef] px-2 py-1 text-[10px] font-black text-[#15935d]">
                              活動偵測 ✓
                            </span>
                          ) : null}
                          <span className="text-[11px] font-bold text-[#8b9aae]">{toDisplayTime(b.createdAt)}</span>
                          <span className="text-[11px] font-bold text-[#8b9aae]">by {b.createdByName}</span>
                        </div>
                        <h3 className="mt-2 text-[15px] font-black text-[#10233f]">{b.title}</h3>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] font-medium leading-6 text-[#3a4658]">
                          {b.content}
                        </p>
                        {b.geminiSummary ? (
                          <p className="mt-2 rounded-[6px] bg-[#f7f9fb] px-3 py-2 text-[12px] font-bold text-[#536175]">
                            <Sparkles className="mr-1 inline h-3 w-3 text-[#6947d8]" />
                            Gemini 摘要：{b.geminiSummary}
                          </p>
                        ) : null}
                        {isSanlu && b.fanOutTargets && b.fanOutTargets.length > 1 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-[11px] font-black text-[#8b9aae]">Fan-out 目標：</span>
                            {b.fanOutTargets.map((fk) => (
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
