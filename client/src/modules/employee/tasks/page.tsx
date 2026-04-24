import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock3, Send } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import {
  fetchEmployeeOperationalHandovers,
  reportEmployeeOperationalHandover,
  type OperationalHandoverDTO,
} from "../home/api";

const statusLabel: Record<OperationalHandoverDTO["status"], string> = {
  pending: "待處理",
  claimed: "已自領",
  in_progress: "進行中",
  reported: "已回報",
  done: "已完成",
  cancelled: "已取消",
};

function HandoverCard({
  handover,
  onReport,
  isPending,
}: {
  handover: OperationalHandoverDTO;
  onReport: (id: number, status: "claimed" | "reported" | "done") => void;
  isPending: boolean;
}) {
  const Icon = handover.status === "done" ? CheckCircle2 : handover.status === "claimed" || handover.status === "in_progress" ? Clock3 : Circle;
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-4">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", handover.status === "done" ? "text-[#15935d]" : "text-[#2f6fe8]")} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black leading-5 text-[#10233f]">{handover.title}</p>
          <p className="mt-2 whitespace-pre-wrap text-[12px] font-bold leading-5 text-[#637185]">{handover.content}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#536175]">{statusLabel[handover.status]}</span>
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", handover.priority === "high" ? "bg-[#fff1e7] text-[#ef7d22]" : "bg-[#edf7f4] text-[#15935d]")}>
              {handover.priority === "high" ? "高優先" : handover.priority === "low" ? "低" : "一般"}
            </span>
            <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[11px] font-black text-[#2f6fe8]">{handover.targetDate} {handover.targetShiftLabel}</span>
            {handover.dueAt ? <span className="rounded-full bg-[#fff6e7] px-2 py-1 text-[11px] font-black text-[#ef7d22]">期限 {new Date(handover.dueAt).toLocaleString("zh-TW")}</span> : null}
          </div>
          {handover.reportNote ? <p className="mt-3 rounded-[8px] bg-white p-2 text-[12px] font-bold text-[#536175]">回報：{handover.reportNote}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[#e6edf4] pt-3">
        {handover.status === "pending" ? (
          <button type="button" disabled={isPending} onClick={() => onReport(handover.id, "claimed")} className="rounded-[8px] bg-[#eef5ff] px-3 py-2 text-[12px] font-black text-[#2f6fe8]">自領</button>
        ) : null}
        {handover.status !== "done" && handover.status !== "cancelled" ? (
          <>
            <button type="button" disabled={isPending} onClick={() => onReport(handover.id, "reported")} className="inline-flex items-center gap-2 rounded-[8px] bg-[#fff6e7] px-3 py-2 text-[12px] font-black text-[#ef7d22]"><Send className="h-4 w-4" />回報</button>
            <button type="button" disabled={isPending} onClick={() => onReport(handover.id, "done")} className="rounded-[8px] bg-[#eaf8ef] px-3 py-2 text-[12px] font-black text-[#15935d]">完成</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function EmployeeTasksPage() {
  const auth = useAuthMe();
  const facilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/portal/operational-handovers", facilityKey],
    queryFn: () => fetchEmployeeOperationalHandovers(facilityKey),
    enabled: Boolean(facilityKey),
  });
  const reportMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "claimed" | "reported" | "done" }) => reportEmployeeOperationalHandover(id, { status }),
    onSuccess: () => {
      setMessage("交班狀態已更新");
      queryClient.invalidateQueries({ queryKey: ["/api/portal/operational-handovers", facilityKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
    },
  });
  const handovers = data?.items ?? [];
  const done = handovers.filter((item) => item.status === "done").length;
  const active = handovers.filter((item) => item.status !== "done" && item.status !== "cancelled").length;

  return (
    <EmployeeShell title="交班事項" subtitle="依目前館別與指定班別顯示主管交班，可自領、回報或完成。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">待處理</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#ef7d22]">{active}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">已完成</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#15935d]">{done}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">目前館別</p>
            <p className="mt-2 text-[22px] font-black text-[#2f6fe8]">{facilityKey}</p>
          </WorkbenchCard>
        </div>

        <WorkbenchCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-black text-[#10233f]">交班清單</h2>
            <span className="text-[12px] font-bold text-[#8b9aae]">{handovers.length} 筆</span>
          </div>
          {isLoading ? (
            <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入交班中...</div>
          ) : isError ? (
            <div className="rounded-[8px] bg-[#fff7f8] p-4 text-[13px] font-bold text-[#ff4964]">交班資料暫時無法取得。</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {message ? <div className="rounded-[8px] bg-[#eaf8ef] p-3 text-[12px] font-black text-[#15935d] lg:col-span-2">{message}</div> : null}
              {handovers.map((handover) => (
                <HandoverCard key={handover.id} handover={handover} isPending={reportMutation.isPending} onReport={(id, status) => reportMutation.mutate({ id, status })} />
              ))}
              {!handovers.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">目前沒有交班事項。</div> : null}
            </div>
          )}
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
