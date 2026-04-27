import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, MessageSquareText, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import type { HandoverItemDto } from "@shared/domain/workbench";
import { EmployeeShell } from "@/modules/employee/employee-shell";
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

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit", weekday: "short" });

const sortPendingByDueDate = (items: HandoverItemDto[]) =>
  [...items].sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));

function HandoverRow({
  item,
  onRead,
  onReply,
  onComplete,
  onDelete,
  isPending,
}: {
  item: HandoverItemDto;
  onRead: (id: string) => void;
  onReply: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const priority = item.priority ?? "normal";
  return (
    <article className="border-b border-dashed border-[#cfd9e5] px-4 py-4 last:border-b-0">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#35c785] text-[13px] font-black text-white">
          {item.createdBy.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-black text-[#10233f]">
                {item.createdBy}
                <span className="ml-2 text-[12px] font-bold text-[#8b9aae]">E{item.id.padStart(3, "0")}</span>
              </p>
              <p className="mt-1 text-[13px] font-medium leading-6 text-[#536175]">{item.content}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={cn("rounded-[6px] px-2 py-1 text-[11px] font-black", priorityClass[priority])}>
                {item.status === "completed" ? "已處理" : priorityLabel[priority]}
              </span>
              <span className="text-[12px] font-bold text-[#8b9aae]">{formatTime(item.dueDate)}</span>
            </div>
          </div>
          {item.reportNote ? <p className="mt-2 rounded-[8px] bg-[#f7f9fb] px-3 py-2 text-[12px] font-bold text-[#637185]">{item.reportNote}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {isPending ? (
              <>
                <button type="button" onClick={() => onRead(item.id)} className="min-h-8 rounded-[7px] border border-[#cfd9e5] bg-white px-3 text-[12px] font-black text-[#536175]">
                  標記已讀
                </button>
                <button type="button" onClick={() => onReply(item.id)} className="min-h-8 rounded-[7px] border border-[#cfd9e5] bg-white px-3 text-[12px] font-black text-[#536175]">
                  回覆補充
                </button>
                <button type="button" onClick={() => onComplete(item.id)} className="min-h-8 rounded-[7px] border border-[#bfe9cf] bg-[#eaf8ef] px-3 text-[12px] font-black text-[#15935d]">
                  完成
                </button>
                <button type="button" onClick={() => onDelete(item.id)} className="inline-flex min-h-8 items-center gap-1 rounded-[7px] border border-[#ffc6cf] bg-white px-3 text-[12px] font-black text-[#ff4964]">
                  <Trash2 className="h-3.5 w-3.5" />
                  刪除
                </button>
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

export default function EmployeeHandoverPage() {
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const trackEvent = useTrackEvent();
  const [tab, setTab] = useState<HandoverTab>("pending");
  const [query, setQuery] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDateTime);
  const [priority, setPriority] = useState<HandoverPriority>("normal");

  const handoverQuery = useQuery({
    queryKey: ["/api/bff/employee/handover/list", facilityKey],
    queryFn: () => fetchEmployeeHandoverList(facilityKey),
  });

  const invalidateHandovers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/handover/list", facilityKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
  };

  const createMutation = useMutation({
    mutationFn: () => createEmployeeFrontDeskHandover({
      facilityKey,
      title: content.trim().slice(0, 48) || "新增交接",
      content: content.trim(),
      dueDate: new Date(dueDate).toISOString(),
      priority,
    }),
    onSuccess: () => {
      setContent("");
      setDueDate(defaultDueDateTime());
      setPriority("normal");
      trackEvent("ACTION_SUBMIT", { moduleId: "handover", actionType: "handover-create" });
      invalidateHandovers();
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
    onSuccess: invalidateHandovers,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reportNote }: { id: string; reportNote: string }) => replyEmployeeFrontDeskHandover(id, reportNote),
    onSuccess: invalidateHandovers,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmployeeFrontDeskHandover(id),
    onSuccess: invalidateHandovers,
  });

  const items = handoverQuery.data?.items ?? [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const byTab = tab === "pending"
      ? sortPendingByDueDate(items.filter((item) => item.status === "pending" || item.status === "expired"))
      : items.filter((item) => item.status === "completed").sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    if (!normalized) return byTab;
    return byTab.filter((item) => `${item.createdBy} ${item.title} ${item.content} ${item.reportNote ?? ""}`.toLowerCase().includes(normalized));
  }, [items, query, tab]);

  const pendingCount = items.filter((item) => item.status === "pending" || item.status === "expired").length;

  return (
    <EmployeeShell title="櫃台交接列表" subtitle={`本日 ${items.length} 則`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <section className="rounded-[8px] border border-[#dfe7ef] bg-white shadow-[0_18px_40px_-34px_rgba(15,34,58,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] px-4 py-4">
            <div>
              <h2 className="text-[18px] font-black text-[#10233f]">櫃台交接列表</h2>
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
              <div className="p-6 text-[13px] font-bold text-[#637185]">載入櫃台交接中...</div>
            ) : filtered.length ? (
              filtered.map((item) => (
                <HandoverRow
                  key={item.id}
                  item={item}
                  isPending={tab === "pending"}
                  onRead={(id) => readMutation.mutate(id)}
                  onReply={(id) => {
                    const reportNote = window.prompt("補充內容");
                    if (reportNote?.trim()) replyMutation.mutate({ id, reportNote: reportNote.trim() });
                  }}
                  onComplete={(id) => completeMutation.mutate(id)}
                  onDelete={(id) => {
                    if (window.confirm("確認刪除這筆交接？")) deleteMutation.mutate(id);
                  }}
                />
              ))
            ) : (
              <div className="grid min-h-[360px] place-items-center p-6 text-center">
                <div>
                  <MessageSquareText className="mx-auto h-10 w-10 text-[#9aa8ba]" />
                  <p className="mt-3 text-[15px] font-black text-[#10233f]">{tab === "pending" ? "尚未設定交接事項" : "查無已完成交接"}</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">資料會依館別與目前登入員工權限回傳。</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-[8px] border border-[#dfe7ef] bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,34,58,0.45)]">
          <div className="border-l-4 border-[#16b6b1] pl-3">
            <h2 className="text-[18px] font-black text-[#10233f]">新增交接</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">作者：{session?.displayName ?? "員工"} · 場館：{facilityKey}</p>
          </div>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={2000}
            className="mt-4 min-h-[190px] w-full rounded-[8px] border border-[#9aa8ba] bg-white p-4 text-[14px] font-bold leading-6 text-[#10233f] outline-none focus:border-[#0d2a50]"
            placeholder="請填寫交接內容（最多 2000 字）..."
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
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setContent("")} className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-4 text-[12px] font-black text-[#536175]">
              取消
            </button>
            <button type="button" disabled={!content.trim() || !dueDate || createMutation.isPending} onClick={() => createMutation.mutate()} className="inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[12px] font-black text-white disabled:opacity-50">
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? "送出中..." : "送出"}
            </button>
          </div>
          {createMutation.isError ? <p className="mt-3 text-[12px] font-bold text-[#ff4964]">新增失敗，請確認資料來源或稍後再試。</p> : null}
          {(completeMutation.isPending || readMutation.isPending || replyMutation.isPending || deleteMutation.isPending) ? (
            <p className="mt-3 inline-flex items-center gap-2 text-[12px] font-bold text-[#637185]"><CheckCircle2 className="h-4 w-4" />處理中...</p>
          ) : null}
        </aside>
      </div>
    </EmployeeShell>
  );
}
