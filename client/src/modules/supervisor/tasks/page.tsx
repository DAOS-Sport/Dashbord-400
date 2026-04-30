import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, ClipboardList, Clock3, Edit3, Filter, ListChecks, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import { SupervisorKpiCard } from "../supervisor-ui";
import {
  createEmployeeTask,
  deleteEmployeeTask,
  fetchEmployeeTasks,
  updateEmployeeTask,
  updateEmployeeTaskStatus,
  type EmployeeTaskDTO,
} from "@/modules/employee/home/api";

type TaskStatus = EmployeeTaskDTO["status"] | "all";
type Priority = EmployeeTaskDTO["priority"];
type MetricKey = "total" | "high" | "progress" | "done";
type TaskUpdateInput = Partial<{
  title: string;
  content: string | null;
  priority: Priority;
  dueAt: string | null;
  status: EmployeeTaskDTO["status"];
}>;

const statusLabel: Record<EmployeeTaskDTO["status"], string> = {
  pending: "待處理",
  in_progress: "進行中",
  done: "已完成",
  cancelled: "已取消",
};

const statusTone: Record<EmployeeTaskDTO["status"], string> = {
  pending: "bg-[#fff6e7] text-[#ef7d22]",
  in_progress: "bg-[#eef5ff] text-[#2f6fe8]",
  done: "bg-[#eaf8ef] text-[#15935d]",
  cancelled: "bg-[#eef2f6] text-[#637185]",
};

const metricCards: readonly (readonly [label: string, key: MetricKey, Icon: LucideIcon, tone: string])[] = [
  ["任務總數", "total", ClipboardList, "text-[#10233f]"],
  ["高優先", "high", AlertCircle, "text-[#ff4964]"],
  ["進行中", "progress", Clock3, "text-[#2f6fe8]"],
  ["已完成", "done", CheckCircle2, "text-[#15935d]"],
];

const toIsoOrNull = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toDateTimeLocal = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 16);
};

function SupervisorTaskForm({
  facilityKey,
  onCreated,
}: {
  facilityKey: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [assignedToName, setAssignedToName] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const createMutation = useMutation({
    mutationFn: () =>
      createEmployeeTask({
        facilityKey,
        title,
        content: content || null,
        priority,
        assignedToName: assignedToName || null,
        assignedToUserId: assignedToUserId || null,
        dueAt: toIsoOrNull(dueAt),
      }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setPriority("normal");
      setAssignedToName("");
      setAssignedToUserId("");
      setDueAt("");
      onCreated();
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-1 text-[12px] font-black text-[#536175]">
        任務標題
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="workbench-focus min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-black text-[#10233f]" />
      </label>
      <label className="grid gap-1 text-[12px] font-black text-[#536175]">
        任務內容
        <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={5} className="workbench-focus w-full resize-none rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[13px] font-bold leading-6 text-[#536175]" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[12px] font-black text-[#536175]">
          優先度
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="workbench-focus min-h-11 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]">
          <option value="low">低優先</option>
          <option value="normal">一般</option>
          <option value="high">高優先</option>
          </select>
        </label>
        <label className="grid gap-1 text-[12px] font-black text-[#536175]">
          到期時間
          <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="workbench-focus min-h-11 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]" />
        </label>
        <label className="grid gap-1 text-[12px] font-black text-[#536175]">
          指派姓名
          <input value={assignedToName} onChange={(event) => setAssignedToName(event.target.value)} className="workbench-focus min-h-11 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]" />
        </label>
        <label className="grid gap-1 text-[12px] font-black text-[#536175]">
          員工編號
          <input value={assignedToUserId} onChange={(event) => setAssignedToUserId(event.target.value)} className="workbench-focus min-h-11 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]" />
        </label>
      </div>
      <button type="submit" disabled={createMutation.isPending || !title.trim()} className="workbench-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#10233f] px-4 text-[13px] font-black text-white disabled:opacity-50">
        <Plus className="h-4 w-4" />
        {createMutation.isPending ? "派發中" : "派發任務"}
      </button>
    </form>
  );
}

function TaskRow({
  task,
  isPending,
  onUpdate,
  onStatus,
  onDelete,
}: {
  task: EmployeeTaskDTO;
  isPending: boolean;
  onUpdate: (id: number, input: TaskUpdateInput) => void;
  onStatus: (id: number, status: EmployeeTaskDTO["status"]) => void;
  onDelete: (id: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [content, setContent] = useState(task.content ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueAt, setDueAt] = useState(toDateTimeLocal(task.dueAt));

  const save = () => {
    onUpdate(task.id, { title, content: content || null, priority, dueAt: toIsoOrNull(dueAt) });
    setIsEditing(false);
  };

  return (
    <div className="rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", task.priority === "high" ? "bg-[#ff4964]" : task.priority === "normal" ? "bg-[#2f6fe8]" : "bg-[#15935d]")} />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="workbench-focus min-h-10 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-black text-[#10233f]" />
                <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={2} className="workbench-focus w-full resize-none rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[13px] font-bold text-[#536175]" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="workbench-focus min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]">
                    <option value="low">低優先</option>
                    <option value="normal">一般</option>
                    <option value="high">高優先</option>
                  </select>
                  <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="workbench-focus min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]" />
                </div>
              </div>
            ) : (
              <>
                <p className="text-[14px] font-black leading-5 text-[#10233f]">{task.title}</p>
                {task.content ? <p className="mt-1 whitespace-pre-wrap text-[12px] font-bold leading-5 text-[#637185]">{task.content}</p> : null}
                <p className="mt-2 text-[11px] font-bold text-[#8b9aae]">
                  建立：{task.createdByName}{task.assignedToName ? ` · 指派：${task.assignedToName}` : " · 全館可完成"}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusTone[task.status])}>{statusLabel[task.status]}</span>
          <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", task.priority === "high" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#eef2f6] text-[#637185]")}>
            {task.priority === "high" ? "高優先" : task.priority === "normal" ? "一般" : "低"}
          </span>
          {task.dueAt ? <span className="rounded-full bg-[#fff6e7] px-2 py-1 text-[10px] font-black text-[#ef7d22]">{new Date(task.dueAt).toLocaleString("zh-TW")}</span> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-[#e6edf4] pt-3">
        {isEditing ? (
          <>
            <button type="button" disabled={isPending || !title.trim()} onClick={save} className="inline-flex items-center gap-2 rounded-[8px] bg-[#eaf8ef] px-3 py-2 text-[12px] font-black text-[#15935d]"><Save className="h-4 w-4" />儲存</button>
            <button type="button" onClick={() => setIsEditing(false)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#eef2f6] px-3 py-2 text-[12px] font-black text-[#536175]"><X className="h-4 w-4" />取消</button>
          </>
        ) : (
          <>
            <button type="button" disabled={isPending} onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#eef5ff] px-3 py-2 text-[12px] font-black text-[#2f6fe8]"><Edit3 className="h-4 w-4" />編輯</button>
            {task.status !== "done" ? <button type="button" disabled={isPending} onClick={() => onStatus(task.id, "done")} className="rounded-[8px] bg-[#eaf8ef] px-3 py-2 text-[12px] font-black text-[#15935d]">完成</button> : null}
            {task.status !== "cancelled" ? <button type="button" disabled={isPending} onClick={() => onStatus(task.id, "cancelled")} className="rounded-[8px] bg-[#fff6e7] px-3 py-2 text-[12px] font-black text-[#ef7d22]">取消</button> : null}
            <button type="button" disabled={isPending} onClick={() => onDelete(task.id)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#fff0f1] px-3 py-2 text-[12px] font-black text-[#db4b5a]"><Trash2 className="h-4 w-4" />刪除</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SupervisorTasksPage() {
  const auth = useAuthMe();
  const facilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["/api/tasks", "supervisor", facilityKey],
    queryFn: () => fetchEmployeeTasks(facilityKey),
    enabled: Boolean(facilityKey),
  });
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("all");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks", "supervisor", facilityKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
  };
  const updateMutation = useMutation({ mutationFn: ({ id, input }: { id: number; input: TaskUpdateInput }) => updateEmployeeTask(id, input), onSuccess: invalidate });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: number; status: EmployeeTaskDTO["status"] }) => updateEmployeeTaskStatus(id, status), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: deleteEmployeeTask, onSuccess: invalidate });
  const tasks = data?.items ?? [];
  const filteredTasks = useMemo(
    () => tasks.filter((task) => (statusFilter === "all" || task.status === statusFilter) && (!priorityOnly || task.priority === "high")),
    [priorityOnly, statusFilter, tasks],
  );
  const metricValue: Record<MetricKey, number> = {
    total: tasks.length,
    high: tasks.filter((task) => task.priority === "high").length,
    progress: tasks.filter((task) => task.status === "in_progress").length,
    done: tasks.filter((task) => task.status === "done").length,
  };
  const pending = updateMutation.isPending || statusMutation.isPending || deleteMutation.isPending;

  return (
    <RoleShell role="supervisor" title="任務管理" subtitle="主管可派發與管理同館任務；排班仍維持外部唯讀，不在本地修改班表。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(([label, key, Icon, tone]) => (
            <SupervisorKpiCard
              key={key}
              label={label}
              value={metricValue[key]}
              icon={Icon}
              tone={tone.includes("ff4964") ? "red" : tone.includes("15935d") ? "green" : tone.includes("2f6fe8") ? "blue" : "navy"}
            />
          ))}
        </div>

        <WorkbenchCard className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-black">任務篩選</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">讀取獨立 tasks table，交接紀錄保留在 handover module。</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "in_progress", "done", "cancelled"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn("min-h-9 rounded-[8px] border px-3 text-[12px] font-black", statusFilter === status ? "border-[#0d2a50] bg-[#0d2a50] text-white" : "border-[#dfe7ef] bg-white text-[#637185]")}
                >
                  {status === "all" ? "全部" : statusLabel[status]}
                </button>
              ))}
              <button type="button" onClick={() => setPriorityOnly((current) => !current)} className={cn("min-h-9 rounded-[8px] border px-3 text-[12px] font-black", priorityOnly ? "border-[#ffd5dc] bg-[#ffe8eb] text-[#ff4964]" : "border-[#dfe7ef] bg-white text-[#637185]")}>
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-black">任務清單</h2>
              <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">{filteredTasks.length} 筆，新增任務從右側抽屜派發。</p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="workbench-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white"
            >
              <Plus className="h-4 w-4" />
              新增任務
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入任務資料...</div>
            ) : isError ? (
              <div className="flex items-center gap-3 rounded-[8px] bg-[#fff7f8] p-4 text-[#ff4964]">
                <AlertCircle className="h-5 w-5" />
                <p className="text-[13px] font-black">任務資料暫時無法載入，請確認 tasks API 與 DB schema。</p>
              </div>
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isPending={pending}
                  onUpdate={(id, input) => updateMutation.mutate({ id, input })}
                  onStatus={(id, status) => statusMutation.mutate({ id, status })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            ) : (
              <div className="grid min-h-48 place-items-center rounded-[8px] bg-[#fbfcfd] p-6 text-center">
                <div>
                  <ListChecks className="mx-auto h-10 w-10 text-[#8b9aae]" />
                  <p className="mt-3 text-[14px] font-black text-[#10233f]">沒有符合條件的任務</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">主管派發任務後，員工可在首頁與任務頁直接完成。</p>
                </div>
              </div>
            )}
          </div>
        </WorkbenchCard>
      </div>
      {createOpen ? (
        <div className="supervisor-drawer">
          <div className="supervisor-drawer-panel">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#dfe7ef] bg-white p-5">
              <div className="border-l-4 border-[#16b6b1] pl-3">
                <h2 className="text-[20px] font-black text-[#10233f]">新增任務</h2>
                <p className="mt-1 text-[12px] font-bold text-[#637185]">派發同館任務，員工可直接標記完成。</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} aria-label="關閉新增任務" className="workbench-focus grid h-10 w-10 place-items-center rounded-[8px] bg-[#f1f5f9] text-[#536175]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <SupervisorTaskForm
                facilityKey={facilityKey}
                onCreated={() => {
                  invalidate();
                  setCreateOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </RoleShell>
  );
}
