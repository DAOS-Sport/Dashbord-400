import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, ClipboardList, Clock3, Filter, ListChecks, RefreshCw } from "lucide-react";
import type { TaskSummary } from "@shared/domain/workbench";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchSupervisorTaskBoard } from "./api";

type TaskStatus = TaskSummary["status"] | "all";
type MetricKey = "total" | "high" | "progress" | "done";

const statusLabel: Record<TaskSummary["status"], string> = {
  pending: "待處理",
  in_progress: "進行中",
  reported: "待回報",
  done: "已完成",
};

const statusTone: Record<TaskSummary["status"], string> = {
  pending: "bg-[#fff6e7] text-[#ef7d22]",
  in_progress: "bg-[#eef5ff] text-[#2f6fe8]",
  reported: "bg-[#f0ecff] text-[#6947d8]",
  done: "bg-[#eaf8ef] text-[#15935d]",
};

const metricCards: readonly (readonly [label: string, key: MetricKey, Icon: LucideIcon, tone: string])[] = [
  ["交班總數", "total", ClipboardList, "text-[#10233f]"],
  ["高優先", "high", AlertCircle, "text-[#ff4964]"],
  ["進行中", "progress", Clock3, "text-[#2f6fe8]"],
  ["已完成", "done", CheckCircle2, "text-[#15935d]"],
];

function TaskRow({ task }: { task: TaskSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", task.priority === "high" ? "bg-[#ff4964]" : task.priority === "normal" ? "bg-[#2f6fe8]" : "bg-[#15935d]")} />
        <div className="min-w-0">
          <p className="text-[14px] font-black leading-5 text-[#10233f]">{task.title}</p>
          <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">ID {task.id}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusTone[task.status])}>{statusLabel[task.status]}</span>
        <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", task.priority === "high" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#eef2f6] text-[#637185]")}>
          {task.priority === "high" ? "高優先" : task.priority === "normal" ? "一般" : "低"}
        </span>
      </div>
    </div>
  );
}

export default function SupervisorTasksPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["/api/bff/supervisor/dashboard", "tasks"],
    queryFn: fetchSupervisorTaskBoard,
  });
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("all");
  const [priorityOnly, setPriorityOnly] = useState(false);

  const tasks = data?.incompleteTasks.data ?? [];
  const filteredTasks = useMemo(
    () => tasks.filter((task) => (statusFilter === "all" || task.status === statusFilter) && (!priorityOnly || task.priority === "high")),
    [priorityOnly, statusFilter, tasks],
  );
  const metricValue: Record<MetricKey, number> = {
    total: tasks.length,
    high: tasks.filter((task) => task.priority === "high").length,
    progress: tasks.filter((task) => task.status === "in_progress" || task.status === "reported").length,
    done: tasks.filter((task) => task.status === "done").length,
  };

  return (
    <RoleShell role="supervisor" title="交班狀態" subtitle="以主管 BFF 交班投影集中檢視待辦、優先序與現場處理狀態。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(([label, key, Icon, tone]) => (
            <WorkbenchCard key={key} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#637185]">{label}</p>
                  <p className={cn("mt-2 text-[26px] font-black", tone)}>{metricValue[key]}</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff]">
                  <Icon className="h-5 w-5 text-[#2f6fe8]" />
                </div>
              </div>
            </WorkbenchCard>
          ))}
        </div>

        <WorkbenchCard className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-black">交班篩選</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">讀主管首頁交班投影，狀態由交接管理更新。</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "in_progress", "reported", "done"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn("min-h-9 rounded-[8px] border px-3 text-[12px] font-black", statusFilter === status ? "border-[#0d2a50] bg-[#0d2a50] text-white" : "border-[#dfe7ef] bg-white text-[#637185]")}
                >
                  {status === "all" ? "全部" : statusLabel[status]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPriorityOnly((current) => !current)}
                className={cn("min-h-9 rounded-[8px] border px-3 text-[12px] font-black", priorityOnly ? "border-[#ffd5dc] bg-[#ffe8eb] text-[#ff4964]" : "border-[#dfe7ef] bg-white text-[#637185]")}
              >
                只看高優先
              </button>
              <button type="button" onClick={() => refetch()} className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                重新整理
              </button>
            </div>
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-black">交班清單</h2>
            <span className="text-[12px] font-bold text-[#8b9aae]">{filteredTasks.length} 筆</span>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入交班資料...</div>
            ) : isError ? (
              <div className="flex items-center gap-3 rounded-[8px] bg-[#fff7f8] p-4 text-[#ff4964]">
                <AlertCircle className="h-5 w-5" />
                <p className="text-[13px] font-black">交班投影暫時無法載入，請確認 BFF 或 Portal DB。</p>
              </div>
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((task) => <TaskRow key={task.id} task={task} />)
            ) : (
              <div className="grid min-h-48 place-items-center rounded-[8px] bg-[#fbfcfd] p-6 text-center">
                <div>
                  <ListChecks className="mx-auto h-10 w-10 text-[#8b9aae]" />
                  <p className="mt-3 text-[14px] font-black text-[#10233f]">沒有符合條件的交班</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">建立交班後，這裡會顯示指派、回報與完成狀態。</p>
                </div>
              </div>
            )}
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
