import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ImagePlus, MessageSquareText, Plus, RefreshCw, Search, Send, Trash2, X } from "lucide-react";
import type { HandoverItemDto } from "@shared/domain/workbench";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { LifeguardShell } from "@/modules/lifeguard/lifeguard-shell";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import {
  completeEmployeeFrontDeskHandover,
  createEmployeeFrontDeskHandover,
  deleteEmployeeFrontDeskHandover,
  fetchEmployeeHandoverList,
  readEmployeeFrontDeskHandover,
  replyEmployeeFrontDeskHandover,
} from "../home/api";
import { useTrackEvent } from "@/shared/telemetry/useTrackEvent";

const defaultDueDateTime = () => {
  const date = new Date();
  date.setHours(date.getHours() + 4, 0, 0, 0);
  return date.toISOString().slice(0, 16);
};

type HandoverTab = "pending" | "completed";
type HandoverPriority = "normal" | "low" | "high";

const priorityOptions: Array<{ value: HandoverPriority; label: string }> = [
  { value: "normal", label: "一般" },
  { value: "low", label: "提醒" },
  { value: "high", label: "優先" },
];

const priorityLabel: Record<HandoverPriority, string> = {
  normal: "一般",
  low: "提醒",
  high: "優先",
};

const priorityClass: Record<HandoverPriority, string> = {
  normal: "bg-[#eef2f6] text-[#536175]",
  low: "bg-[#fff6e7] text-[#d27a16]",
  high: "bg-[#ffe8eb] text-[#ff4964]",
};

const statusMetricClass = {
  normal: "text-[#0d2a50]",
  low: "text-[#ef7d22]",
  high: "text-[#ff4964]",
  completed: "text-[#15935d]",
};

const uploadHandoverImage = async (file: File, facilityKey: string): Promise<string> => {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("facilityKey", facilityKey);
  const response = await fetch("/api/handover/image-upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.message === "string" ? payload.message : "圖片上傳失敗");
  }
  if (typeof payload.url !== "string") {
    throw new Error("圖片上傳回傳格式不正確");
  }
  return payload.url;
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit", weekday: "short" });

const sortPendingByDueDate = (items: HandoverItemDto[]) =>
  [...items].sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));

const dueMetaFor = (item: HandoverItemDto) => {
  if (item.status === "completed") {
    return { label: `完成 ${formatDate(item.updatedAt)} ${formatTime(item.updatedAt)}`, className: "bg-[#eef2f6] text-[#536175]" };
  }
  if (item.status === "expired") {
    return { label: `已逾期 ${formatDate(item.dueDate)} ${formatTime(item.dueDate)}`, className: "bg-[#ffe8eb] text-[#ff4964]" };
  }
  const dueAt = Date.parse(item.dueDate);
  const diff = dueAt - Date.now();
  if (diff <= 60 * 60 * 1000) {
    return { label: `1 小時內 ${formatTime(item.dueDate)}`, className: "bg-[#fff6e7] text-[#d27a16]" };
  }
  if (diff <= 24 * 60 * 60 * 1000) {
    return { label: `今日 ${formatTime(item.dueDate)}`, className: "bg-[#eaf8ef] text-[#15935d]" };
  }
  return { label: `${formatDate(item.dueDate)} ${formatTime(item.dueDate)}`, className: "bg-[#eef6ff] text-[#1967d2]" };
};

function HandoverRow({
  item,
  onRead,
  onStartReply,
  onReplyTextChange,
  onCancelReply,
  onSubmitReply,
  onComplete,
  onDelete,
  isPending,
  isReplying,
  replyText,
  isReplySubmitting,
}: {
  item: HandoverItemDto;
  onRead: (id: string) => void;
  onStartReply: (id: string) => void;
  onReplyTextChange: (value: string) => void;
  onCancelReply: () => void;
  onSubmitReply: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
  isReplying: boolean;
  replyText: string;
  isReplySubmitting: boolean;
}) {
  const priority = item.priority ?? "normal";
  const dueMeta = dueMetaFor(item);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasImageRecord = item.linkedActionType === "image" && Boolean(item.linkedActionUrl);
  return (
    <article className="border-b border-dashed border-[#cfd9e5] px-4 py-4 last:border-b-0">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#35c785] text-[13px] font-black text-white">
          {item.createdBy.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-black leading-6 text-[#10233f]">{item.title}</h3>
              <p className="mt-0.5 truncate text-[12px] font-bold text-[#8b9aae]">
                {item.createdBy}
                <span className="mx-2">·</span>
                E{item.id.padStart(3, "0")}
              </p>
              <p className="mt-1 text-[13px] font-medium leading-6 text-[#536175]">{item.content}</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <span className={cn("rounded-[6px] px-2 py-1 text-[11px] font-black", dueMeta.className)}>
                {dueMeta.label}
              </span>
              <span className={cn("rounded-[6px] px-2 py-1 text-[11px] font-black", priorityClass[priority])}>
                {item.status === "completed" ? "已處理" : priorityLabel[priority]}
              </span>
            </div>
          </div>
          {item.reportNote ? (
            <div className="mt-3 rounded-[8px] border border-[#edf2f7] bg-[#f7f9fb] px-3 py-2">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#8b9aae]">補充紀錄</p>
              <p className="mt-1 whitespace-pre-wrap text-[12px] font-bold leading-5 text-[#637185]">{item.reportNote}</p>
            </div>
          ) : null}
          {hasImageRecord ? (
            <figure className="mt-3 overflow-hidden rounded-[8px] border border-[#dfe7ef] bg-[#f7f9fb]">
              <img
                src={item.linkedActionUrl ?? ""}
                alt={`${item.title} 圖片紀錄`}
                loading="lazy"
                className="max-h-72 w-full bg-white object-contain"
              />
              <figcaption className="border-t border-[#edf2f7] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#8b9aae]">
                圖片紀錄
              </figcaption>
            </figure>
          ) : null}
          {isReplying && isPending ? (
            <div className="mt-3 rounded-[10px] border border-[#dfe7ef] bg-[#fbfcfd] p-3">
              <label className="text-[12px] font-black text-[#536175]" htmlFor={`handover-reply-${item.id}`}>
                補充內容
              </label>
              <textarea
                id={`handover-reply-${item.id}`}
                value={replyText}
                onChange={(event) => onReplyTextChange(event.target.value)}
                maxLength={1200}
                className="mt-2 min-h-[92px] w-full rounded-[8px] border border-[#cfd9e5] bg-white p-3 text-[13px] font-bold leading-6 text-[#10233f] outline-none focus:border-[#0d2a50]"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#8b9aae]">{replyText.length} / 1200 字</span>
                <div className="flex gap-2">
                  <button type="button" onClick={onCancelReply} className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={!replyText.trim() || isReplySubmitting}
                    onClick={() => onSubmitReply(item.id)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-3 text-[12px] font-black text-white disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {isReplySubmitting ? "送出中..." : "送出補充"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {isPending ? (
              <>
                <button type="button" onClick={() => onRead(item.id)} className="min-h-8 rounded-[7px] border border-[#cfd9e5] bg-white px-3 text-[12px] font-black text-[#536175]">
                  標記已讀
                </button>
                <button type="button" onClick={() => onStartReply(item.id)} className="min-h-8 rounded-[7px] border border-[#cfd9e5] bg-white px-3 text-[12px] font-black text-[#536175]">
                  {isReplying ? "正在補充" : "回覆補充"}
                </button>
                <button type="button" onClick={() => onComplete(item.id)} className="min-h-8 rounded-[7px] border border-[#bfe9cf] bg-[#eaf8ef] px-3 text-[12px] font-black text-[#15935d]">
                  完成
                </button>
                {!confirmingDelete ? (
                  <button type="button" onClick={() => setConfirmingDelete(true)} className="inline-flex min-h-8 items-center gap-1 rounded-[7px] border border-[#ffc6cf] bg-white px-3 text-[12px] font-black text-[#ff4964]">
                    <Trash2 className="h-3.5 w-3.5" />
                    刪除
                  </button>
                ) : (
                  <span className="inline-flex flex-wrap gap-2 rounded-[8px] bg-[#fff0f1] p-1">
                    <button type="button" onClick={() => onDelete(item.id)} className="min-h-8 rounded-[7px] bg-[#ff4964] px-3 text-[12px] font-black text-white">
                      確認刪除
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(false)} className="min-h-8 rounded-[7px] bg-white px-3 text-[12px] font-black text-[#536175]">
                      取消
                    </button>
                  </span>
                )}
              </>
            ) : (
              <span className="rounded-[7px] bg-[#eef2f6] px-3 py-1.5 text-[12px] font-black text-[#536175]">只讀檢視</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function HandoverPageContent({ shell }: { shell: "employee" | "lifeguard" }) {
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const trackEvent = useTrackEvent();
  const [tab, setTab] = useState<HandoverTab>("pending");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDateTime);
  const [priority, setPriority] = useState<HandoverPriority>("normal");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handoverQuery = useQuery({
    queryKey: ["/api/bff/employee/handover/list", facilityKey],
    queryFn: () => fetchEmployeeHandoverList(facilityKey),
  });

  const invalidateHandovers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/handover/list", facilityKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      setImageUploadError(null);
      const imageUrl = imageFile ? await uploadHandoverImage(imageFile, facilityKey) : null;
      return createEmployeeFrontDeskHandover({
        facilityKey,
        title: title.trim() || content.trim().slice(0, 48) || "新增交接",
        content: content.trim(),
        dueDate: new Date(dueDate).toISOString(),
        priority,
        linkedActionType: imageUrl ? "image" : null,
        linkedActionUrl: imageUrl,
      });
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      setDueDate(defaultDueDateTime());
      setPriority("normal");
      setImageFile(null);
      setImagePreviewUrl(null);
      setImageUploadError(null);
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-create" });
      invalidateHandovers();
    },
    onError: (error) => {
      setImageUploadError(error instanceof Error ? error.message : "圖片或交接新增失敗");
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeEmployeeFrontDeskHandover(id),
    onSuccess: () => {
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-complete" });
      invalidateHandovers();
    },
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => readEmployeeFrontDeskHandover(id),
    onSuccess: () => {
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-read" });
      invalidateHandovers();
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reportNote }: { id: string; reportNote: string }) => replyEmployeeFrontDeskHandover(id, reportNote),
    onSuccess: () => {
      setReplyingId(null);
      setReplyText("");
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-reply" });
      invalidateHandovers();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmployeeFrontDeskHandover(id),
    onSuccess: () => {
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-delete" });
      invalidateHandovers();
    },
  });

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageUploadError("只能上傳圖片檔");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError("圖片大小不可超過 10MB");
      return;
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageUploadError(null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageUploadError(null);
  };

  const items = handoverQuery.data?.items ?? [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const byTab = tab === "pending"
      ? sortPendingByDueDate(items.filter((item) => item.status === "pending" || item.status === "expired"))
      : items.filter((item) => item.status === "completed").sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    if (!normalized) return byTab;
    return byTab.filter((item) => `${item.createdBy} ${item.title} ${item.content} ${item.reportNote ?? ""}`.toLowerCase().includes(normalized));
  }, [items, query, tab]);

  const openItems = items.filter((item) => item.status === "pending" || item.status === "expired");
  const normalCount = openItems.filter((item) => (item.priority ?? "normal") === "normal").length;
  const reminderCount = openItems.filter((item) => item.priority === "low").length;
  const highPriorityCount = openItems.filter((item) => item.priority === "high").length;
  const completedCount = items.filter((item) => item.status === "completed").length;
  const pendingCount = openItems.length;
  const statusMetrics = [
    { label: "一般", value: normalCount, className: statusMetricClass.normal },
    { label: "提醒", value: reminderCount, className: statusMetricClass.low },
    { label: "優先", value: highPriorityCount, className: statusMetricClass.high },
    { label: "已完成", value: completedCount, className: statusMetricClass.completed },
  ];

  const Shell = shell === "lifeguard" ? LifeguardShell : EmployeeShell;

  return (
    <Shell title="交接任務" subtitle={`本日 ${items.length} 則 · 依館別共用`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {statusMetrics.map((metric) => (
            <section key={metric.label} className="rounded-[8px] border border-[#dfe7ef] bg-white px-4 py-4 shadow-sm">
              <p className="text-[12px] font-bold text-[#637185]">{metric.label}</p>
              <p className={cn("mt-2 text-[24px] font-black leading-none", metric.className)}>{metric.value}</p>
            </section>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <section className="rounded-[8px] border border-[#dfe7ef] bg-white shadow-[0_18px_40px_-34px_rgba(15,34,58,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] px-4 py-4">
            <div>
              <h2 className="text-[18px] font-black text-[#10233f]">交接任務列表</h2>
              <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">未完成依剩餘時間近到遠排序</p>
            </div>
            <button onClick={() => handoverQuery.refetch()} className="workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
              <RefreshCw className={cn("h-4 w-4", handoverQuery.isFetching && "animate-spin")} />
              重新整理
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex rounded-[8px] bg-[#eef2f6] p-1">
              <button type="button" onClick={() => setTab("pending")} className={cn("min-h-8 rounded-[7px] px-3 text-[12px] font-black", tab === "pending" ? "bg-white text-[#10233f] shadow-sm" : "text-[#637185]")}>
                未完成 {pendingCount}
              </button>
              <button type="button" onClick={() => setTab("completed")} className={cn("min-h-8 rounded-[7px] px-3 text-[12px] font-black", tab === "completed" ? "bg-white text-[#10233f] shadow-sm" : "text-[#637185]")}>
                已完成
              </button>
            </div>
            <label className="flex min-h-9 min-w-[220px] items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3">
              <Search className="h-4 w-4 text-[#8b9aae]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[12px] font-bold outline-none placeholder:text-[#9aa8ba]" placeholder="查詢已完成或交接內容" />
            </label>
          </div>
          <div className="min-h-[420px]">
            {handoverQuery.isLoading ? (
              <div className="p-6 text-[13px] font-bold text-[#637185]">載入交接任務中...</div>
            ) : filtered.length ? (
              filtered.map((item) => (
                <HandoverRow
                  key={item.id}
                  item={item}
                  isPending={tab === "pending"}
                  isReplying={replyingId === item.id}
                  replyText={replyingId === item.id ? replyText : ""}
                  isReplySubmitting={replyMutation.isPending}
                  onRead={(id) => readMutation.mutate(id)}
                  onStartReply={(id) => {
                    setReplyingId(id);
                    setReplyText("");
                  }}
                  onReplyTextChange={setReplyText}
                  onCancelReply={() => {
                    setReplyingId(null);
                    setReplyText("");
                  }}
                  onSubmitReply={(id) => {
                    if (replyText.trim()) replyMutation.mutate({ id, reportNote: replyText.trim() });
                  }}
                  onComplete={(id) => completeMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            ) : (
              <div className="grid min-h-[360px] place-items-center p-6 text-center">
                <div>
                  <MessageSquareText className="mx-auto h-10 w-10 text-[#9aa8ba]" />
              <p className="mt-3 text-[15px] font-black text-[#10233f]">{tab === "pending" ? "尚未設定交接任務" : "查無已完成交接"}</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">資料會依館別與目前登入員工權限回傳。</p>
                </div>
              </div>
            )}
          </div>
          </section>

          <aside className="h-fit rounded-[8px] border border-[#dfe7ef] bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,34,58,0.45)]">
          <div className="border-l-4 border-[#16b6b1] pl-3">
            <h2 className="text-[18px] font-black text-[#10233f]">新增交接任務</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">作者：{session?.displayName ?? "員工"} · 場館：{facilityKey}</p>
          </div>
          <label className="mt-4 block text-[12px] font-black text-[#536175]" htmlFor="handover-title">
            標題
          </label>
          <input
            id="handover-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={140}
            className="mt-2 min-h-10 w-full rounded-[8px] border border-[#cfd9e5] bg-white px-3 text-[14px] font-bold text-[#10233f] outline-none focus:border-[#0d2a50]"
          />
          <label className="mt-4 block text-[12px] font-black text-[#536175]" htmlFor="handover-content">
            內容
          </label>
          <textarea
            id="handover-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={2000}
            className="mt-2 min-h-[190px] w-full rounded-[8px] border border-[#9aa8ba] bg-white p-4 text-[14px] font-bold leading-6 text-[#10233f] outline-none focus:border-[#0d2a50]"
          />
          <div className="mt-2 flex items-center justify-between text-[12px] font-bold text-[#8b9aae]">
            <span>{content.length} / 2000 字</span>
            <label className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              <input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-[7px] border border-[#dfe7ef] px-2 py-1 text-[#10233f]" />
            </label>
          </div>
          <div className="mt-5 border-t border-[#dfe7ef] pt-4">
            <p className="mb-2 text-[12px] font-black text-[#637185]">標記為：</p>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => setPriority(option.value)} className={cn("min-h-9 rounded-[8px] border px-4 text-[12px] font-black", priority === option.value ? "border-[#0d2a50] bg-[#0d2a50] text-white" : "border-[#cfd9e5] bg-white text-[#536175]")}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 border-t border-[#dfe7ef] pt-4">
            <p className="mb-2 text-[12px] font-black text-[#637185]">圖片紀錄</p>
            {imagePreviewUrl ? (
              <div className="overflow-hidden rounded-[8px] border border-[#dfe7ef] bg-[#f7f9fb]">
                <img src={imagePreviewUrl} alt="交接圖片預覽" className="max-h-52 w-full bg-white object-contain" />
                <div className="flex items-center justify-between gap-2 border-t border-[#edf2f7] px-3 py-2">
                  <p className="min-w-0 truncate text-[12px] font-bold text-[#536175]">{imageFile?.name}</p>
                  <button type="button" onClick={clearImage} className="inline-flex min-h-8 items-center gap-1 rounded-[7px] border border-[#ffc6cf] bg-white px-2 text-[12px] font-black text-[#ff4964]">
                    <X className="h-3.5 w-3.5" />
                    移除
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#9aa8ba] bg-[#fbfcfd] px-4 py-3 text-center text-[12px] font-black text-[#536175]">
                <ImagePlus className="h-5 w-5 text-[#16b6b1]" />
                上傳交接圖片
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
              </label>
            )}
            {imageUploadError ? <p className="mt-2 text-[12px] font-bold text-[#ff4964]">{imageUploadError}</p> : null}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => { setTitle(""); setContent(""); clearImage(); }} className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-4 text-[12px] font-black text-[#536175]">
              取消
            </button>
            <button type="button" disabled={!content.trim() || !dueDate || createMutation.isPending} onClick={() => createMutation.mutate()} className="inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[12px] font-black text-white disabled:opacity-50">
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? (imageFile ? "上傳並送出..." : "送出中...") : "送出"}
            </button>
          </div>
          {createMutation.isError ? <p className="mt-3 text-[12px] font-bold text-[#ff4964]">新增失敗，請確認資料來源或稍後再試。</p> : null}
          {(completeMutation.isPending || readMutation.isPending || replyMutation.isPending || deleteMutation.isPending) ? (
            <p className="mt-3 inline-flex items-center gap-2 text-[12px] font-bold text-[#637185]"><CheckCircle2 className="h-4 w-4" />處理中...</p>
          ) : null}
          </aside>
        </div>
      </div>
    </Shell>
  );
}

export function LifeguardHandoverPage() {
  return <HandoverPageContent shell="lifeguard" />;
}

export default function EmployeeHandoverPage() {
  return <HandoverPageContent shell="employee" />;
}
