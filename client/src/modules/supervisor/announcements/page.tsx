import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Clock, FileText, Megaphone, Pin, Plus, RefreshCw, Search, Sparkles, Trash2, XCircle } from "lucide-react";
import type { AnnouncementCandidate, AnnouncementFilters } from "@/types/announcement";
import type { SystemAnnouncementDTO } from "@/types/portal";
import { STATUS_LABELS, TYPE_LABELS } from "@/types/announcement";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import { RoleShell } from "@/modules/workbench/role-shell";
import { SupervisorKpiCard } from "../supervisor-ui";
import {
  approveAnnouncementCandidate,
  deleteSupervisorSystemAnnouncement,
  fetchAnnouncementCandidates,
  fetchAnnouncementSummary,
  fetchSupervisorSystemAnnouncements,
  rejectAnnouncementCandidate,
  upsertSupervisorSystemAnnouncement,
  type SupervisorAnnouncementInput,
} from "./api";

const statusTone: Record<string, string> = {
  pending_review: "bg-[#fff6e7] text-[#ef7d22]",
  approved: "bg-[#eaf8ef] text-[#15935d]",
  rejected: "bg-[#ffe8eb] text-[#ff4964]",
  ignored: "bg-[#eef2f6] text-[#637185]",
  vip_chat: "bg-[#fff8d9] text-[#9c6b00]",
};

const summaryCards: readonly (readonly [label: string, key: "totalMessagesToday" | "analyzedMessagesToday" | "pendingReviewCount" | "approvedCount" | "rejectedCount", Icon: LucideIcon, tone: string])[] = [
  ["今日訊息", "totalMessagesToday", Megaphone, "text-[#2f6fe8]"],
  ["今日分析", "analyzedMessagesToday", Search, "text-[#6947d8]"],
  ["待審核", "pendingReviewCount", Clock, "text-[#ef7d22]"],
  ["已核准", "approvedCount", CheckCircle2, "text-[#15935d]"],
  ["已退回", "rejectedCount", XCircle, "text-[#ff4964]"],
];

const announcementTypeLabels: Record<SystemAnnouncementDTO["announcementType"], string> = {
  notice: "通知公告",
  required: "必讀確認",
  sop: "規則 SOP",
  event: "活動",
  discount: "優惠",
  course: "課程",
};

const severityLabels: Record<SystemAnnouncementDTO["severity"], string> = {
  info: "一般",
  warning: "提醒",
  critical: "重要",
};

const toDatetimeLocal = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const toIsoOrUndefined = (value: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const emptyAnnouncementForm = (facilityKey: string): SupervisorAnnouncementInput => ({
  facilityKey,
  title: "",
  content: "",
  announcementType: "notice",
  severity: "info",
  isPinned: false,
  isActive: true,
  publishedAt: toDatetimeLocal(),
  expiresAt: "",
});

const confidence = (value: number | string | undefined) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value ?? 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusTone[status] ?? statusTone.pending_review)}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function CandidateRow({
  candidate,
  active,
  onSelect,
}: {
  candidate: AnnouncementCandidate;
  active: boolean;
  onSelect: () => void;
}) {
  const score = confidence(candidate.confidence);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[8px] border p-3 text-left transition hover:bg-white hover:shadow-sm",
        active ? "border-[#2f6fe8] bg-[#eef5ff]" : "border-[#e6edf4] bg-[#fbfcfd]",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={candidate.status} />
        <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[10px] font-black text-[#2f6fe8]">
          {TYPE_LABELS[candidate.candidateType] ?? candidate.candidateType}
        </span>
        {score >= 0.8 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-2 py-1 text-[10px] font-black text-[#15935d]">
            <Sparkles className="h-3 w-3" />
            高信心 {(score * 100).toFixed(0)}%
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 text-[14px] font-black text-[#10233f]">{candidate.title || "未命名公告候選"}</p>
      <p className="mt-1 line-clamp-2 text-[12px] font-medium text-[#637185]">{candidate.summary || candidate.originalText || "尚無摘要"}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-bold text-[#8b9aae]">
        <span className="truncate">{candidate.facilityName || candidate.groupName || candidate.groupId || "未指定場館"}</span>
        <span>{candidate.detectedAt ? new Date(candidate.detectedAt).toLocaleDateString("zh-TW") : "-"}</span>
      </div>
    </button>
  );
}

function DetailPanel({
  candidate,
  onApprove,
  onReject,
  busy,
}: {
  candidate?: AnnouncementCandidate;
  onApprove: (candidate: AnnouncementCandidate) => void;
  onReject: (candidate: AnnouncementCandidate) => void;
  busy: boolean;
}) {
  if (!candidate) {
    return (
      <WorkbenchCard className="grid min-h-[420px] place-items-center p-6 text-center">
        <div>
          <FileText className="mx-auto h-10 w-10 text-[#8b9aae]" />
          <p className="mt-3 text-[15px] font-black">選擇一筆公告候選</p>
          <p className="mt-1 text-[13px] text-[#637185]">主管可在右側檢視來源、建議回覆與處理動作。</p>
        </div>
      </WorkbenchCard>
    );
  }

  return (
    <WorkbenchCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#007166]">Review Detail</p>
          <h2 className="mt-2 text-[20px] font-black leading-tight">{candidate.title}</h2>
        </div>
        <StatusBadge status={candidate.status} />
      </div>

      <div className="mt-5 space-y-4">
        <section>
          <h3 className="text-[12px] font-black text-[#536175]">AI 摘要</h3>
          <p className="mt-2 rounded-[8px] bg-[#f7f9fb] p-3 text-[14px] leading-6 text-[#263b56]">{candidate.summary || "無摘要"}</p>
        </section>
        <section>
          <h3 className="text-[12px] font-black text-[#536175]">原始訊息</h3>
          <p className="mt-2 max-h-40 overflow-auto rounded-[8px] bg-[#10233f] p-3 text-[13px] leading-6 text-white">{candidate.originalText || "無原始訊息"}</p>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[8px] bg-[#fbfcfd] p-3">
            <p className="text-[11px] font-black text-[#8b9aae]">建議動作</p>
            <p className="mt-1 text-[13px] font-bold">{candidate.recommendedAction || "待主管判斷"}</p>
          </div>
          <div className="rounded-[8px] bg-[#fbfcfd] p-3">
            <p className="text-[11px] font-black text-[#8b9aae]">適用對象</p>
            <p className="mt-1 text-[13px] font-bold">{candidate.appliesToRoles?.join(", ") || "all"}</p>
          </div>
        </section>
        {candidate.recommendedReply ? (
          <section>
            <h3 className="text-[12px] font-black text-[#536175]">建議回覆</h3>
            <p className="mt-2 rounded-[8px] border border-[#dfe7ef] bg-white p-3 text-[13px] leading-6">{candidate.recommendedReply}</p>
          </section>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onApprove(candidate)}
          disabled={busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#15935d] px-4 text-[13px] font-black text-white disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" />
          核准公告
        </button>
        <button
          type="button"
          onClick={() => onReject(candidate)}
          disabled={busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#ff4964] px-4 text-[13px] font-black text-white disabled:opacity-60"
        >
          <XCircle className="h-4 w-4" />
          退回
        </button>
      </div>
    </WorkbenchCard>
  );
}

function ManualAnnouncementPanel({
  facilityKey,
  items,
  loading,
  onSubmit,
  onEdit,
  onDelete,
  form,
  setForm,
  resetForm,
  busy,
  mode = "full",
}: {
  facilityKey: string;
  items: SystemAnnouncementDTO[];
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (item: SystemAnnouncementDTO) => void;
  onDelete: (id: number) => void;
  form: SupervisorAnnouncementInput;
  setForm: (value: SupervisorAnnouncementInput | ((current: SupervisorAnnouncementInput) => SupervisorAnnouncementInput)) => void;
  resetForm: () => void;
  busy: boolean;
  mode?: "full" | "form" | "list";
}) {
  return (
    <div className={cn("grid gap-4", mode === "full" && "xl:grid-cols-[0.95fr_1.05fr]")}>
      {mode !== "list" ? (
      <WorkbenchCard className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#007166]">Manual Publish</p>
            <h2 className="mt-1 text-[18px] font-black">手動發布公告</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">場館：{facilityKey}</p>
          </div>
          {form.id ? (
            <button type="button" onClick={resetForm} className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
              取消編輯
            </button>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-black text-[#536175]">公告標題</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-bold outline-none focus:border-[#2f6fe8]"
                required
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-black text-[#536175]">公告類型</span>
              <select
                value={form.announcementType}
                onChange={(event) => setForm((current) => ({ ...current, announcementType: event.target.value as SystemAnnouncementDTO["announcementType"] }))}
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-black outline-none focus:border-[#2f6fe8]"
              >
                {Object.entries(announcementTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[12px] font-black text-[#536175]">公告內容</span>
            <textarea
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              className="mt-2 min-h-[128px] w-full resize-y rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-3 text-[14px] font-bold leading-6 outline-none focus:border-[#2f6fe8]"
              required
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-black text-[#536175]">重要程度</span>
              <select
                value={form.severity}
                onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as SystemAnnouncementDTO["severity"] }))}
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-black outline-none focus:border-[#2f6fe8]"
              >
                {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 pt-7">
              <label className="flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) => setForm((current) => ({ ...current, isPinned: event.target.checked }))}
                  className="h-4 w-4 accent-[#15935d]"
                />
                置頂
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 accent-[#15935d]"
                />
                啟用
              </label>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-black text-[#536175]">發布時間</span>
              <input
                type="datetime-local"
                value={form.publishedAt ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-bold outline-none focus:border-[#2f6fe8]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-black text-[#536175]">下架時間</span>
              <input
                type="datetime-local"
                value={form.expiresAt ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-bold outline-none focus:border-[#2f6fe8]"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {busy ? "處理中" : form.id ? "更新公告" : "發布公告"}
          </button>
        </form>
      </WorkbenchCard>
      ) : null}

      {mode !== "form" ? (
      <WorkbenchCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#007166]">Published</p>
            <h2 className="mt-1 text-[18px] font-black">已發布公告</h2>
          </div>
          <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[12px] font-black text-[#2f6fe8]">{items.length} 筆</span>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入公告...</div>
          ) : items.length > 0 ? (
            items.map((item) => (
              <article key={item.id} className={cn("rounded-[8px] border p-4", item.isPinned ? "border-[#ffd1da] bg-[#fff8f9]" : "border-[#e6edf4] bg-[#fbfcfd]")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[10px] font-black text-[#2f6fe8]">{announcementTypeLabels[item.announcementType] ?? item.announcementType}</span>
                      <span className="rounded-full bg-[#eef2f6] px-2 py-1 text-[10px] font-black text-[#637185]">{severityLabels[item.severity] ?? item.severity}</span>
                      {item.isPinned ? <span className="inline-flex items-center gap-1 rounded-full bg-[#ffe8eb] px-2 py-1 text-[10px] font-black text-[#ff4964]"><Pin className="h-3 w-3" />置頂</span> : null}
                      {!item.isActive ? <span className="rounded-full bg-[#eef2f6] px-2 py-1 text-[10px] font-black text-[#8b9aae]">停用</span> : null}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-[15px] font-black text-[#10233f]">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-6 text-[#637185]">{item.content}</p>
                    <p className="mt-2 text-[11px] font-bold text-[#8b9aae]">
                      {new Date(item.publishedAt).toLocaleString("zh-TW")}
                      {item.expiresAt ? ` - ${new Date(item.expiresAt).toLocaleString("zh-TW")}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => onEdit(item)} className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#0d2a50]">
                      編輯
                    </button>
                    <button type="button" onClick={() => onDelete(item.id)} className="grid h-10 w-10 place-items-center rounded-[8px] border border-[#ffd1da] bg-white text-[#ff4964]" aria-label="刪除公告">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚未發布公告。</div>
          )}
        </div>
      </WorkbenchCard>
      ) : null}
    </div>
  );
}

export default function SupervisorAnnouncementsPage() {
  const queryClient = useQueryClient();
  const auth = useAuthMe();
  const facilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const [filters, setFilters] = useState<AnnouncementFilters>({ page: 1, pageSize: 20, status: "pending_review" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [announcementDrawerOpen, setAnnouncementDrawerOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState<SupervisorAnnouncementInput>(() => emptyAnnouncementForm(facilityKey));
  const summaryQuery = useQuery({ queryKey: ["/api/announcement-dashboard/summary"], queryFn: fetchAnnouncementSummary });
  const systemAnnouncementsQuery = useQuery({
    queryKey: ["/api/portal/system-announcements", facilityKey],
    queryFn: () => fetchSupervisorSystemAnnouncements(facilityKey),
    enabled: !!facilityKey,
  });
  const candidatesQuery = useQuery({
    queryKey: ["/api/announcement-candidates", filters],
    queryFn: () => fetchAnnouncementCandidates(filters),
  });

  const candidates = useMemo(
    () => candidatesQuery.data?.candidates ?? candidatesQuery.data?.items ?? [],
    [candidatesQuery.data],
  );
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0];

  const approveMutation = useMutation({
    mutationFn: (candidate: AnnouncementCandidate) => approveAnnouncementCandidate(candidate, "全端測試開發"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/announcement-candidates"] }),
  });
  const rejectMutation = useMutation({
    mutationFn: (candidate: AnnouncementCandidate) => rejectAnnouncementCandidate(candidate, "全端測試開發", "由主管工作台退回"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/announcement-candidates"] }),
  });
  const saveAnnouncementMutation = useMutation({
    mutationFn: upsertSupervisorSystemAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/system-announcements"] });
      setAnnouncementForm(emptyAnnouncementForm(facilityKey));
      setAnnouncementDrawerOpen(false);
    },
  });
  const deleteAnnouncementMutation = useMutation({
    mutationFn: deleteSupervisorSystemAnnouncement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/portal/system-announcements"] }),
  });

  const applyKeyword = () => setFilters((current) => ({ ...current, keyword: keyword || undefined, page: 1 }));
  const resetAnnouncementForm = () => setAnnouncementForm(emptyAnnouncementForm(facilityKey));
  const editAnnouncement = (item: SystemAnnouncementDTO) => {
    setAnnouncementForm({
      id: item.id,
      facilityKey: item.facilityKey ?? facilityKey,
      title: item.title,
      content: item.content,
      announcementType: item.announcementType ?? "notice",
      severity: item.severity,
      isPinned: Boolean(item.isPinned),
      isActive: item.isActive,
      publishedAt: toDatetimeLocal(item.publishedAt),
      expiresAt: item.expiresAt ? toDatetimeLocal(item.expiresAt) : "",
    });
    setAnnouncementDrawerOpen(true);
  };
  const submitAnnouncement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveAnnouncementMutation.mutate({
      ...announcementForm,
      facilityKey,
      publishedAt: toIsoOrUndefined(announcementForm.publishedAt ?? ""),
      expiresAt: toIsoOrUndefined(announcementForm.expiresAt ?? "") ?? null,
    });
  };
  const openCreateAnnouncement = () => {
    resetAnnouncementForm();
    setAnnouncementDrawerOpen(true);
  };

  return (
    <RoleShell role="supervisor" title="公告管理" subtitle="主管可手動發布公告，也可審核 LINE Bot Assistant 候選公告。">
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreateAnnouncement}
            className="workbench-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white"
          >
            <Plus className="h-4 w-4" />
            新增公告
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map(([label, key, Icon, tone]) => (
            <SupervisorKpiCard
              key={label}
              label={label}
              value={summaryQuery.data?.[key] ?? 0}
              icon={Icon}
              tone={tone.includes("ff4964") ? "red" : tone.includes("ef7d22") ? "amber" : tone.includes("15935d") ? "green" : tone.includes("6947") ? "purple" : "blue"}
            />
          ))}
        </div>

        <ManualAnnouncementPanel
          facilityKey={facilityKey}
          items={systemAnnouncementsQuery.data?.items ?? []}
          loading={systemAnnouncementsQuery.isLoading}
          form={announcementForm}
          setForm={setAnnouncementForm}
          resetForm={resetAnnouncementForm}
          onSubmit={submitAnnouncement}
          onEdit={editAnnouncement}
          onDelete={(id) => deleteAnnouncementMutation.mutate(id)}
          busy={saveAnnouncementMutation.isPending || deleteAnnouncementMutation.isPending}
          mode="list"
        />

        <WorkbenchCard className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label className="text-[12px] font-black text-[#536175]">搜尋候選公告</label>
              <div className="mt-2 flex min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3">
                <Search className="h-4 w-4 text-[#8b9aae]" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && applyKeyword()}
                  className="min-w-0 flex-1 bg-transparent text-[14px] font-bold outline-none"
                  placeholder="輸入標題、摘要或原文"
                />
              </div>
            </div>
            <select
              value={filters.status || ""}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value || undefined, page: 1 }))}
              className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black"
            >
              <option value="">全部狀態</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button onClick={applyKeyword} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white">
              <RefreshCw className="h-4 w-4" />
              套用
            </button>
          </div>
        </WorkbenchCard>

        {candidatesQuery.isError ? (
          <WorkbenchCard className="flex items-center gap-3 p-4 text-[#ff4964]">
            <AlertCircle className="h-5 w-5" />
            <p className="text-[13px] font-black">公告候選池暫時無法載入，請確認 LINE Bot Assistant API。</p>
          </WorkbenchCard>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <WorkbenchCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-black">候選列表</h2>
              <span className="text-[12px] font-bold text-[#8b9aae]">{candidatesQuery.data?.total ?? candidates.length} 筆</span>
            </div>
            <div className="space-y-3">
              {candidatesQuery.isLoading ? (
                <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入公告候選...</div>
              ) : candidates.length > 0 ? (
                candidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    active={candidate.id === selected?.id}
                    onSelect={() => setSelectedId(candidate.id)}
                  />
                ))
              ) : (
                <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">目前沒有符合條件的候選公告。</div>
              )}
            </div>
          </WorkbenchCard>

          <DetailPanel
            candidate={selected}
            busy={approveMutation.isPending || rejectMutation.isPending}
            onApprove={(candidate) => approveMutation.mutate(candidate)}
            onReject={(candidate) => rejectMutation.mutate(candidate)}
          />
        </div>
      </div>
      {announcementDrawerOpen ? (
        <div className="supervisor-drawer">
          <aside className="supervisor-drawer-panel">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e5e8ec] bg-white p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2f9e5b]">New Announcement</p>
                <h2 className="mt-1 text-[20px] font-black text-[#102940]">{announcementForm.id ? "編輯公告" : "新增公告"}</h2>
                <p className="mt-1 text-[12px] font-bold text-[#667386]">類型、置頂、啟用與發布時間都寫回正式公告 API。</p>
              </div>
              <button
                type="button"
                aria-label="關閉公告抽屜"
                onClick={() => setAnnouncementDrawerOpen(false)}
                className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-[#f4f6f8] text-[#4b596a]"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <ManualAnnouncementPanel
                facilityKey={facilityKey}
                items={[]}
                loading={false}
                form={announcementForm}
                setForm={setAnnouncementForm}
                resetForm={resetAnnouncementForm}
                onSubmit={submitAnnouncement}
                onEdit={editAnnouncement}
                onDelete={(id) => deleteAnnouncementMutation.mutate(id)}
                busy={saveAnnouncementMutation.isPending || deleteAnnouncementMutation.isPending}
                mode="form"
              />
            </div>
          </aside>
        </div>
      ) : null}
    </RoleShell>
  );
}
