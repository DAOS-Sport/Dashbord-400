import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, FileText, MessageSquarePlus, RefreshCw } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import { createSupervisorHandover, fetchSupervisorHandovers, updateSupervisorHandover } from "./api";
import { SupervisorEmptyState, SupervisorPill } from "../supervisor-ui";

const handoverColumns = [
  { key: "pending", title: "待處理", statuses: ["pending", "claimed"] },
  { key: "progress", title: "進行中", statuses: ["in_progress", "reported"] },
  { key: "done", title: "已完成", statuses: ["done", "cancelled"] },
] as const;

export default function SupervisorHandoverPage() {
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueAt, setDueAt] = useState("");
  const handoversQuery = useQuery({
    queryKey: ["/api/portal/operational-handovers", facilityKey],
    queryFn: () => fetchSupervisorHandovers(facilityKey),
  });
  const createMutation = useMutation({
    mutationFn: () => createSupervisorHandover({
      facilityKey,
      title: title.trim(),
      content: content.trim(),
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      priority: "normal",
    }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/portal/operational-handovers", facilityKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/dashboard"] });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "claimed" | "in_progress" | "reported" | "done" | "cancelled" }) => updateSupervisorHandover(id, { status } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/operational-handovers", facilityKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/dashboard"] });
    },
  });
  const handovers = handoversQuery.data?.items ?? [];
  const open = handovers.filter((item) => item.status !== "done" && item.status !== "cancelled").length;
  const grouped = useMemo(
    () => handoverColumns.map((column) => ({
      ...column,
      items: handovers.filter((item) => column.statuses.includes(item.status as never)),
    })),
    [handovers],
  );

  return (
    <RoleShell role="supervisor" title="櫃台交接" subtitle="主管可建立同館交辦、檢視員工回報並調整狀態；不綁固定班別，避免污染班表來源。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">交班總數</p>
            <p className="mt-2 text-[26px] font-black text-[#10233f]">{handovers.length}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">待處理</p>
            <p className="mt-2 text-[26px] font-black text-[#ef7d22]">{open}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">目前場館</p>
            <p className="mt-2 text-[22px] font-black text-[#2f6fe8]">{facilityKey}</p>
          </WorkbenchCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-black">新增交班</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">依館別與到期時間推送到員工端櫃台交辦。</p>
              </div>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                交辦標題
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[14px] font-bold outline-none focus:border-[#2f6fe8]" />
              </label>
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                到期時間
                <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" />
              </label>
              <label className="grid gap-1 text-[12px] font-black text-[#536175]">
                交辦內容
                <textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-40 w-full rounded-[8px] border border-[#dfe7ef] bg-white p-3 text-[14px] font-bold leading-6 outline-none focus:border-[#2f6fe8]" />
              </label>
            </div>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!title.trim() || !content.trim() || createMutation.isPending}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              {createMutation.isPending ? "送出中" : "建立交辦事項"}
            </button>
          </WorkbenchCard>

          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black">交接看板</h2>
              <button onClick={() => handoversQuery.refetch()} className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                <RefreshCw className={cn("h-4 w-4", handoversQuery.isFetching && "animate-spin")} />
                重新整理
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {handoversQuery.isLoading ? (
                <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185] lg:col-span-3">載入交班資料...</div>
              ) : handovers.length > 0 ? (
                grouped.map((column) => (
                  <section key={column.key} className="rounded-[12px] border border-[#e5e8ec] bg-[#f8fafc] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[13px] font-black text-[#102940]">{column.title}</h3>
                      <SupervisorPill tone={column.key === "done" ? "green" : column.key === "progress" ? "blue" : "amber"}>{column.items.length}</SupervisorPill>
                    </div>
                    <div className="space-y-3">
                      {column.items.length ? column.items.map((item) => (
                        <article key={item.id} className="rounded-[10px] border border-[#e6edf4] bg-white p-3 shadow-sm">
                          <div className="flex items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#2f6fe8]" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="break-words text-[13px] font-black text-[#10233f]">{item.title}</p>
                                <SupervisorPill tone="gray">{item.status}</SupervisorPill>
                                {item.dueAt ? <SupervisorPill tone="blue">到期 {new Date(item.dueAt).toLocaleString("zh-TW")}</SupervisorPill> : null}
                              </div>
                              <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-[12px] font-bold leading-5 text-[#536175]">{item.content}</p>
                              {item.reportNote ? <p className="mt-2 rounded-[8px] bg-[#f8fafc] p-2 text-[12px] font-bold text-[#637185]">員工回報：{item.reportNote}</p> : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(["claimed", "in_progress", "reported", "done", "cancelled"] as const).map((status) => (
                                  <button key={status} type="button" onClick={() => statusMutation.mutate({ id: item.id, status })} className="workbench-focus rounded-[8px] border border-[#dfe7ef] bg-white px-2 py-1 text-[11px] font-black text-[#536175]">
                                    {status}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </article>
                      )) : (
                        <div className="rounded-[10px] bg-white p-4 text-center text-[12px] font-bold text-[#8b9aae]">目前沒有{column.title}交辦。</div>
                      )}
                    </div>
                  </section>
                ))
              ) : (
                <SupervisorEmptyState icon={CheckCircle2} title="目前沒有交班事項" description="建立後會同步出現在員工端櫃台交辦清單。" className="lg:col-span-3" />
              )}
            </div>
          </WorkbenchCard>
        </div>
      </div>
    </RoleShell>
  );
}
