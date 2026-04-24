import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, FileText, MessageSquarePlus, RefreshCw } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import { createSupervisorHandover, fetchSupervisorHandovers, updateSupervisorHandover } from "./api";

const today = () => new Date().toISOString().slice(0, 10);

export default function SupervisorHandoverPage() {
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetDate, setTargetDate] = useState(today());
  const [targetShiftLabel, setTargetShiftLabel] = useState("早班");
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
      targetDate,
      targetShiftLabel,
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

  return (
    <RoleShell role="supervisor" title="交接管理" subtitle="主管可指定交班日期、班別、期限與狀態，BFF 依館別與班表推送到員工端。">
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

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-black">新增交班</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">時間與班別會成為員工端顯示條件。</p>
              </div>
            </div>
            <div className="grid gap-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[14px] font-bold outline-none focus:border-[#2f6fe8]" placeholder="交班標題" />
              <div className="grid gap-3 sm:grid-cols-3">
                <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" />
                <select value={targetShiftLabel} onChange={(event) => setTargetShiftLabel(event.target.value)} className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold">
                  <option value="早班">早班</option>
                  <option value="中班">中班</option>
                  <option value="晚班">晚班</option>
                  <option value="主管指定">主管指定</option>
                </select>
                <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="min-h-11 rounded-[8px] border border-[#dfe7ef] px-3 text-[13px] font-bold" />
              </div>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-40 w-full rounded-[8px] border border-[#dfe7ef] bg-white p-3 text-[14px] font-bold leading-6 outline-none focus:border-[#2f6fe8]" placeholder="輸入交班內容、處理方式、注意事項或需要回報的資訊" />
            </div>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!title.trim() || !content.trim() || createMutation.isPending}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              {createMutation.isPending ? "送出中" : "建立交班"}
            </button>
          </WorkbenchCard>

          <WorkbenchCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black">交班列表</h2>
              <button onClick={() => handoversQuery.refetch()} className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                <RefreshCw className={cn("h-4 w-4", handoversQuery.isFetching && "animate-spin")} />
                重新整理
              </button>
            </div>
            <div className="space-y-3">
              {handoversQuery.isLoading ? (
                <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入交班資料...</div>
              ) : handovers.length > 0 ? (
                handovers.map((item) => (
                  <div key={item.id} className="rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#2f6fe8]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-black text-[#10233f]">{item.title}</p>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#637185]">{item.status}</span>
                          <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[10px] font-black text-[#2f6fe8]">{item.targetDate} {item.targetShiftLabel}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[13px] font-bold leading-6 text-[#536175]">{item.content}</p>
                        {item.reportNote ? <p className="mt-2 rounded-[8px] bg-white p-2 text-[12px] font-bold text-[#637185]">員工回報：{item.reportNote}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(["claimed", "in_progress", "reported", "done", "cancelled"] as const).map((status) => (
                            <button key={status} type="button" onClick={() => statusMutation.mutate({ id: item.id, status })} className="rounded-[8px] border border-[#dfe7ef] bg-white px-2 py-1 text-[11px] font-black text-[#536175]">
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid min-h-56 place-items-center rounded-[8px] bg-[#fbfcfd] p-6 text-center">
                  <div>
                    <CheckCircle2 className="mx-auto h-10 w-10 text-[#15935d]" />
                    <p className="mt-3 text-[14px] font-black text-[#10233f]">目前沒有交班事項</p>
                    <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">建立後會同步出現在員工端交班清單。</p>
                  </div>
                </div>
              )}
            </div>
          </WorkbenchCard>
        </div>
      </div>
    </RoleShell>
  );
}
