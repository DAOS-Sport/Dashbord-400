import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock3, Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import {
  createEmployeeTask,
  deleteEmployeeTask,
  fetchEmployeeTasks,
  updateEmployeeTask,
  updateEmployeeTaskStatus,
  type EmployeeTaskDTO,
} from "../home/api";

type Priority = EmployeeTaskDTO["priority"];

const statusLabel: Record<EmployeeTaskDTO["status"], string> = {
  pending: "待處理",
  in_progress: "進行中",
  done: "已完成",
  cancelled: "已取消",
};

const priorityLabel: Record<Priority, string> = {
  low: "低",
  normal: "一般",
  high: "高優先",
};

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

function TaskForm({
  facilityKey,
  onCreated,
}: {
  facilityKey: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueAt, setDueAt] = useState("");
  const createMutation = useMutation({
    mutationFn: () => createEmployeeTask({ facilityKey, title, content: content || null, priority, dueAt: toIsoOrNull(dueAt) }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setPriority("normal");
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
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-4 lg:grid-cols-[1.2fr_1fr_auto]">
      <div className="space-y-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="新增任務標題"
          className="workbench-focus min-h-11 w-full rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[14px] font-black text-[#10233f]"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="內容或備註"
          rows={2}
          className="workbench-focus w-full resize-none rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[13px] font-bold text-[#536175]"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="workbench-focus min-h-11 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]">
          <option value="low">低優先</option>
          <option value="normal">一般</option>
          <option value="high">高優先</option>
        </select>
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="workbench-focus min-h-11 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]"
        />
      </div>
      <button type="submit" disabled={createMutation.isPending || !title.trim()} className="workbench-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#10233f] px-4 text-[13px] font-black text-white disabled:opacity-50">
        <Plus className="h-4 w-4" />
        新增
      </button>
    </form>
  );
}

function TaskCard({
  task,
  canEdit,
  onDone,
  onDelete,
  onUpdate,
  isPending,
}: {
  task: EmployeeTaskDTO;
  canEdit: boolean;
  onDone: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, input: Partial<EmployeeTaskDTO>) => void;
  isPending: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [content, setContent] = useState(task.content ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueAt, setDueAt] = useState(toDateTimeLocal(task.dueAt));
  const Icon = task.status === "done" ? CheckCircle2 : task.status === "in_progress" ? Clock3 : Circle;

  const save = () => {
    onUpdate(task.id, { title, content: content || null, priority, dueAt: toIsoOrNull(dueAt) } as Partial<EmployeeTaskDTO>);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-4">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", task.status === "done" ? "text-[#15935d]" : "text-[#2f6fe8]")} />
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
              {task.content ? <p className="mt-2 whitespace-pre-wrap text-[12px] font-bold leading-5 text-[#637185]">{task.content}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#536175]">{statusLabel[task.status]}</span>
                <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", task.priority === "high" ? "bg-[#fff1e7] text-[#ef7d22]" : "bg-[#edf7f4] text-[#15935d]")}>{priorityLabel[task.priority]}</span>
                {task.dueAt ? <span className="rounded-full bg-[#fff6e7] px-2 py-1 text-[11px] font-black text-[#ef7d22]">期限 {new Date(task.dueAt).toLocaleString("zh-TW")}</span> : null}
                <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-[11px] font-black text-[#2f6fe8]">{task.source === "employee" ? "員工自建" : "主管派發"}</span>
              </div>
              <p className="mt-2 text-[11px] font-bold text-[#8b9aae]">
                建立：{task.createdByName}{task.assignedToName ? ` · 指派：${task.assignedToName}` : ""}
              </p>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[#e6edf4] pt-3">
        {isEditing ? (
          <>
            <button type="button" disabled={isPending || !title.trim()} onClick={save} className="inline-flex items-center gap-2 rounded-[8px] bg-[#eaf8ef] px-3 py-2 text-[12px] font-black text-[#15935d]"><Save className="h-4 w-4" />儲存</button>
            <button type="button" onClick={() => setIsEditing(false)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#eef2f6] px-3 py-2 text-[12px] font-black text-[#536175]"><X className="h-4 w-4" />取消</button>
          </>
        ) : (
          <>
            {task.status !== "done" && task.status !== "cancelled" ? (
              <button type="button" disabled={isPending} onClick={() => onDone(task.id)} className="rounded-[8px] bg-[#eaf8ef] px-3 py-2 text-[12px] font-black text-[#15935d]">完成</button>
            ) : null}
            {canEdit ? (
              <>
                <button type="button" disabled={isPending} onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#eef5ff] px-3 py-2 text-[12px] font-black text-[#2f6fe8]"><Edit3 className="h-4 w-4" />編輯</button>
                <button type="button" disabled={isPending} onClick={() => onDelete(task.id)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#fff0f1] px-3 py-2 text-[12px] font-black text-[#db4b5a]"><Trash2 className="h-4 w-4" />刪除</button>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function EmployeeTasksPage() {
  const auth = useAuthMe();
  const facilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const userId = auth.data?.userId;
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/tasks", facilityKey],
    queryFn: () => fetchEmployeeTasks(facilityKey),
    enabled: Boolean(facilityKey),
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks", facilityKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
  };
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<EmployeeTaskDTO> }) => updateEmployeeTask(id, input),
    onSuccess: invalidate,
  });
  const doneMutation = useMutation({
    mutationFn: (id: number) => updateEmployeeTaskStatus(id, "done"),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteEmployeeTask,
    onSuccess: invalidate,
  });
  const tasks = data?.items ?? [];
  const active = tasks.filter((item) => item.status !== "done" && item.status !== "cancelled").length;
  const done = tasks.filter((item) => item.status === "done").length;
  const high = tasks.filter((item) => item.priority === "high" && item.status !== "done").length;
  const pending = updateMutation.isPending || doneMutation.isPending || deleteMutation.isPending;
  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => Number(a.status === "done") - Number(b.status === "done")), [tasks]);

  return (
    <EmployeeShell title="任務管理" subtitle="員工可建立自己的任務；主管派發任務可直接完成，排班維持外部唯讀。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">待處理</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#ef7d22]">{active}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">高優先</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#ff4964]">{high}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">已完成</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#15935d]">{done}</p>
          </WorkbenchCard>
        </div>

        <WorkbenchCard className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-black text-[#10233f]">任務清單</h2>
              <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">員工自建任務可編輯刪除；主管派發任務可直接完成。</p>
            </div>
            <span className="text-[12px] font-bold text-[#8b9aae]">{tasks.length} 筆</span>
          </div>
          <div className="space-y-4">
            <TaskForm facilityKey={facilityKey} onCreated={invalidate} />
            {isLoading ? (
              <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入任務中...</div>
            ) : isError ? (
              <div className="rounded-[8px] bg-[#fff7f8] p-4 text-[13px] font-bold text-[#ff4964]">任務資料暫時無法取得。</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {sortedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={task.createdByUserId === userId}
                    isPending={pending}
                    onDone={(id) => doneMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onUpdate={(id, input) => updateMutation.mutate({ id, input })}
                  />
                ))}
                {!tasks.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">目前沒有任務。</div> : null}
              </div>
            )}
          </div>
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
