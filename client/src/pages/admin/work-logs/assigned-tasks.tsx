import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertLifeguardAssignedTaskSchema, type LifeguardAssignedTask } from "@shared/schema";
import { AdminRoleGuard, EmptyState, ErrorState, INPUT_TYPES, LoadingState, WorkLogAdminShell, shiftLabel, useAdminFacility, useModuleType } from "./_shared";

export default function AssignedTasksPage() {
  return (
    <AdminRoleGuard>
      <Inner />
    </AdminRoleGuard>
  );
}

function Inner() {
  const moduleType = useModuleType();
  const [facilityKey, setFacilityKey] = useAdminFacility();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LifeguardAssignedTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [taskDateFilter, setTaskDateFilter] = useState<string>("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<{ items: LifeguardAssignedTask[] }>({
    queryKey: ["/api/work-logs/admin/assigned-tasks", moduleType, facilityKey, statusFilter, taskDateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ facilityKey, moduleType });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (taskDateFilter) params.set("taskDate", taskDateFilter);
      const r = await fetch(`/api/work-logs/admin/assigned-tasks?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("載入失敗");
      return r.json();
    },
    enabled: !!facilityKey,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/work-logs/admin/assigned-tasks/${id}`);
    },
    onSuccess: () => {
      toast({ title: "已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/assigned-tasks", moduleType, facilityKey] });
    },
    onError: (e: Error) => toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];

  return (
    <WorkLogAdminShell
      title="主管交辦任務"
      description="一次性指派給特定員工或班別的臨時任務"
      facilityKey={facilityKey}
      onFacilityChange={setFacilityKey}
      actions={
        <>
          <Input
            type="date"
            value={taskDateFilter}
            onChange={(e) => setTaskDateFilter(e.target.value)}
            className="w-[150px]"
            placeholder="任務日期"
            data-testid="input-assigned-date-filter"
          />
          {taskDateFilter && (
            <Button size="sm" variant="ghost" onClick={() => setTaskDateFilter("")} data-testid="button-clear-date-filter">
              清除日期
            </Button>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">執行中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
              <SelectItem value="all">全部</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)} data-testid="button-create-assigned-task">
            <Plus className="h-4 w-4 mr-1" /> 指派任務
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="載入清單失敗" />
      ) : items.length === 0 ? (
        <EmptyState message="目前沒有交辦任務" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任務名稱</TableHead>
                <TableHead className="w-28">日期/班別</TableHead>
                <TableHead className="w-32">指派對象</TableHead>
                <TableHead className="w-32">輸入類型</TableHead>
                <TableHead className="w-24">狀態</TableHead>
                <TableHead className="w-32">指派人</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id} data-testid={`row-assigned-${row.id}`}>
                  <TableCell>
                    <div className="font-medium">{row.taskName}</div>
                    {row.description && <div className="text-xs text-muted-foreground mt-0.5">{row.description}</div>}
                    {row.dueDate && <div className="text-xs text-amber-600 mt-0.5">截止：{row.dueDate}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.taskDate ?? "—"}
                    {row.assignedToShift ? <div>{shiftLabel(row.assignedToShift)}</div> : null}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{row.assignedToEmployeeNumber ?? "—"}</TableCell>
                  <TableCell><span className="text-xs font-mono">{row.inputType}</span></TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.assignedByName ?? row.assignedBy ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(row)} data-testid={`button-edit-assigned-${row.id}`}>
                      <Pencil className="h-3.5 w-3.5 text-sky-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeletingId(row.id)} data-testid={`button-delete-assigned-${row.id}`}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {creating && <TaskDialog facilityKey={facilityKey} moduleType={moduleType} onClose={() => setCreating(false)} />}
      {editing && <TaskDialog facilityKey={facilityKey} moduleType={moduleType} task={editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除？</AlertDialogTitle>
            <AlertDialogDescription>刪除後此筆交辦任務將不再出現。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => {
                if (deletingId !== null) {
                  deleteMut.mutate(deletingId);
                  setDeletingId(null);
                }
              }}
            >刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkLogAdminShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-slate-100 text-slate-600",
    cancelled: "bg-rose-100 text-rose-700",
  };
  const label: Record<string, string> = {
    active: "執行中",
    completed: "已完成",
    cancelled: "已取消",
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded ${map[status] ?? "bg-slate-100 text-slate-700"}`}>{label[status] ?? status}</span>;
}

interface FormValues {
  facilityKey: string;
  moduleType: "lifeguard" | "counter";
  taskName: string;
  description?: string;
  inputType: string;
  assignedToEmployeeNumber?: string | null;
  assignedToShift?: "morning" | "noon" | "night" | "all" | null;
  taskDate?: string | null;
  dueDate?: string | null;
  isRequired: boolean;
  status?: "active" | "completed" | "cancelled";
}

function TaskDialog({ facilityKey, moduleType, task, onClose }: { facilityKey: string; moduleType: "lifeguard" | "counter"; task?: LifeguardAssignedTask; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!task;
  const form = useForm<FormValues>({
    resolver: zodResolver(insertLifeguardAssignedTaskSchema),
    defaultValues: {
      facilityKey,
      moduleType,
      taskName: task?.taskName ?? "",
      description: task?.description ?? "",
      inputType: task?.inputType ?? "checkbox",
      assignedToEmployeeNumber: task?.assignedToEmployeeNumber ?? "",
      assignedToShift: (task?.assignedToShift as FormValues["assignedToShift"]) ?? null,
      taskDate: task?.taskDate ?? "",
      dueDate: task?.dueDate ?? "",
      isRequired: task?.isRequired ?? true,
      status: (task?.status as FormValues["status"]) ?? "active",
    },
  });

  const saveMut = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        assignedToEmployeeNumber: values.assignedToEmployeeNumber || null,
        assignedToShift: values.assignedToShift || null,
        taskDate: values.taskDate || null,
        dueDate: values.dueDate || null,
        description: values.description || null,
      };
      if (isEdit && task) {
        await apiRequest("PATCH", `/api/work-logs/admin/assigned-tasks/${task.id}`, payload);
      } else {
        await apiRequest("POST", "/api/work-logs/admin/assigned-tasks", payload);
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "已更新任務" : "已指派任務" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/assigned-tasks", moduleType, facilityKey] });
      onClose();
    },
    onError: (e: Error) => toast({ title: isEdit ? "更新失敗" : "指派失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "編輯交辦任務" : "指派交辦任務"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMut.mutate(v))} className="space-y-3">
            <FormField name="taskName" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>任務名稱 *</FormLabel>
                <FormControl><Input {...field} data-testid="input-assigned-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="description" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>說明</FormLabel>
                <FormControl><Textarea {...field} rows={2} value={field.value ?? ""} data-testid="input-assigned-desc" /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField name="taskDate" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>任務日期</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="input-assigned-date" /></FormControl>
                </FormItem>
              )} />
              <FormField name="assignedToShift" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>指定班別</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                    <FormControl><SelectTrigger data-testid="select-assigned-shift"><SelectValue placeholder="不指定" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="morning">早班</SelectItem>
                      <SelectItem value="noon">中班</SelectItem>
                      <SelectItem value="night">晚班</SelectItem>
                      <SelectItem value="all">全班</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <FormField name="assignedToEmployeeNumber" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>指定員工編號</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="留空 = 班別全員" data-testid="input-assigned-employee" /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField name="dueDate" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>截止日期</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="input-assigned-due" /></FormControl>
                </FormItem>
              )} />
              <FormField name="inputType" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>輸入類型</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-assigned-input"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {INPUT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            {isEdit && (
              <FormField name="status" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>狀態</FormLabel>
                  <Select value={field.value ?? "active"} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-assigned-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">執行中</SelectItem>
                      <SelectItem value="completed">已完成</SelectItem>
                      <SelectItem value="cancelled">已取消</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" disabled={saveMut.isPending} data-testid="button-save-assigned">
                {saveMut.isPending ? "送出中…" : isEdit ? "儲存" : "指派"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
