import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { CsvImportDialog, type CsvColumn } from "./csv-import-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertRecurringTaskTemplateSchema, type RecurringTaskTemplate } from "@shared/schema";
import { AdminRoleGuard, EmptyState, ErrorState, INPUT_TYPES, LoadingState, WorkLogAdminShell, shiftLabel, useAdminFacility, useModuleType } from "./_shared";

const RECURRING_CSV_COLUMNS: CsvColumn[] = [
  { key: "taskName", required: true, type: "string", hint: "任務名稱" },
  { key: "description", type: "string", hint: "說明（選填）" },
  { key: "inputType", required: true, type: "string", hint: "checkbox | text | number | photo …" },
  { key: "recurrenceType", required: true, type: "string", hint: "daily | weekly | monthly" },
  { key: "recurrenceDays", type: "intArray", hint: "weekly: 0=日 1=一 … 6=六；monthly: 1–31，多個用逗號分隔" },
  { key: "shiftType", type: "string", hint: "morning | noon | night | all（預設 all）" },
  { key: "isRequired", type: "boolean", hint: "true / false" },
  { key: "isActive", type: "boolean", hint: "true / false" },
];

const RECURRING_TEMPLATE_ROWS: Record<string, string>[] = [
  { taskName: "蓄水池清潔", description: "每週一執行", inputType: "checkbox", recurrenceType: "weekly", recurrenceDays: "1", shiftType: "morning", isRequired: "true", isActive: "true" },
  { taskName: "月底盤點", description: "", inputType: "checkbox", recurrenceType: "monthly", recurrenceDays: "28,29,30", shiftType: "all", isRequired: "true", isActive: "true" },
  { taskName: "每日設備檢查", description: "", inputType: "checkbox", recurrenceType: "daily", recurrenceDays: "", shiftType: "all", isRequired: "true", isActive: "true" },
];

const WEEKDAYS = [
  { value: 0, label: "日" },
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
];

export default function RecurringTemplatesPage() {
  return <AdminRoleGuard><Inner /></AdminRoleGuard>;
}

function Inner() {
  const moduleType = useModuleType();
  const [facilityKey, setFacilityKey] = useAdminFacility();
  const [editing, setEditing] = useState<RecurringTaskTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<{ items: RecurringTaskTemplate[] }>({
    queryKey: ["/api/work-logs/admin/recurring-templates", moduleType, facilityKey],
    queryFn: async () => {
      const r = await fetch(`/api/work-logs/admin/recurring-templates?facilityKey=${encodeURIComponent(facilityKey)}&moduleType=${moduleType}`, { credentials: "include" });
      if (!r.ok) throw new Error("載入失敗");
      return r.json();
    },
    enabled: !!facilityKey,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/work-logs/admin/recurring-templates/${id}`); },
    onSuccess: () => {
      toast({ title: "已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/recurring-templates", moduleType, facilityKey] });
    },
    onError: (e: Error) => toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];

  return (
    <WorkLogAdminShell
      title="每週循環任務"
      description="按星期幾或月份重複出現的任務（例如每週一蓄水池清潔）"
      facilityKey={facilityKey}
      onFacilityChange={setFacilityKey}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImporting(true)} data-testid="button-import-csv-recurring">
            <Upload className="h-4 w-4 mr-1" /> 匯入 CSV
          </Button>
          <Button onClick={() => setCreating(true)} data-testid="button-create-recurring">
            <Plus className="h-4 w-4 mr-1" /> 新增循環任務
          </Button>
        </div>
      }
    >
      {isLoading ? <LoadingState /> : isError ? <ErrorState message="載入失敗" /> : items.length === 0 ? (
        <EmptyState message="尚未建立循環任務" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任務名稱</TableHead>
                <TableHead className="w-24">頻率</TableHead>
                <TableHead className="w-44">星期/日期</TableHead>
                <TableHead className="w-20">班別</TableHead>
                <TableHead className="w-32">輸入類型</TableHead>
                <TableHead className="w-16 text-center">必填</TableHead>
                <TableHead className="w-16 text-center">啟用</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id} data-testid={`row-recurring-${row.id}`}>
                  <TableCell>
                    <div className="font-medium">{row.taskName}</div>
                    {row.description && <div className="text-xs text-muted-foreground mt-0.5">{row.description}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{row.recurrenceType}</TableCell>
                  <TableCell className="text-xs">
                    {row.recurrenceType === "weekly" ? (row.recurrenceDays ?? []).map((d) => WEEKDAYS[d]?.label).join("、")
                      : row.recurrenceType === "monthly" ? (row.recurrenceDays ?? []).join(", ")
                      : "每天"}
                  </TableCell>
                  <TableCell className="text-xs">{shiftLabel(row.shiftType)}</TableCell>
                  <TableCell><span className="text-xs font-mono">{row.inputType}</span></TableCell>
                  <TableCell className="text-center">
                    <span className={`text-xs font-bold ${row.isRequired ? "text-rose-600" : "text-muted-foreground"}`}>
                      {row.isRequired ? "必填" : "選填"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-xs ${row.isActive ? "text-emerald-600 font-bold" : "text-muted-foreground line-through"}`}>
                      {row.isActive ? "啟用" : "停用"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(row)} data-testid={`button-edit-recurring-${row.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeletingId(row.id)} data-testid={`button-delete-recurring-${row.id}`}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(creating || editing) && (
        <EditDialog facilityKey={facilityKey} moduleType={moduleType} existing={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}

      <CsvImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        title="每週循環任務"
        endpoint="/api/work-logs/admin/recurring-templates/bulk"
        invalidateQueryKey={["/api/work-logs/admin/recurring-templates", moduleType, facilityKey]}
        facilityKey={facilityKey}
        moduleType={moduleType}
        columns={RECURRING_CSV_COLUMNS}
        templateRows={RECURRING_TEMPLATE_ROWS}
      />

      <AlertDialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>確認刪除？</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-delete" onClick={() => { if (deletingId !== null) { deleteMut.mutate(deletingId); setDeletingId(null); } }}>刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkLogAdminShell>
  );
}

interface FormValues {
  facilityKey: string;
  moduleType: "lifeguard" | "counter";
  taskName: string;
  description?: string;
  inputType: string;
  recurrenceType: "daily" | "weekly" | "monthly";
  recurrenceDays?: number[] | null;
  shiftType: "morning" | "noon" | "night" | "all";
  isRequired: boolean;
  isActive: boolean;
}

function EditDialog({ facilityKey, moduleType, existing, onClose }: { facilityKey: string; moduleType: "lifeguard" | "counter"; existing: RecurringTaskTemplate | null; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(insertRecurringTaskTemplateSchema),
    defaultValues: existing ? {
      facilityKey: existing.facilityKey,
      moduleType: ((existing.moduleType ?? "lifeguard") as "lifeguard" | "counter"),
      taskName: existing.taskName,
      description: existing.description ?? "",
      inputType: existing.inputType,
      recurrenceType: existing.recurrenceType as "daily" | "weekly" | "monthly",
      recurrenceDays: existing.recurrenceDays ?? [],
      shiftType: existing.shiftType as FormValues["shiftType"],
      isRequired: existing.isRequired,
      isActive: existing.isActive,
    } : {
      facilityKey,
      moduleType,
      taskName: "",
      description: "",
      inputType: "checkbox",
      recurrenceType: "weekly",
      recurrenceDays: [1],
      shiftType: "all",
      isRequired: true,
      isActive: true,
    },
  });

  const recurrenceType = form.watch("recurrenceType");
  const days = form.watch("recurrenceDays") ?? [];

  const saveMut = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload = { ...v, description: v.description || null, recurrenceDays: v.recurrenceDays ?? [] };
      if (existing) await apiRequest("PATCH", `/api/work-logs/admin/recurring-templates/${existing.id}`, payload);
      else await apiRequest("POST", "/api/work-logs/admin/recurring-templates", payload);
    },
    onSuccess: () => {
      toast({ title: existing ? "已更新" : "已新增" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/recurring-templates", moduleType, facilityKey] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });

  const toggleDay = (d: number) => {
    const set = new Set(days);
    if (set.has(d)) set.delete(d); else set.add(d);
    form.setValue("recurrenceDays", Array.from(set).sort((a, b) => a - b));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "編輯循環任務" : "新增循環任務"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMut.mutate(v))} className="space-y-3">
            <FormField name="taskName" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>任務名稱 *</FormLabel>
                <FormControl><Input {...field} data-testid="input-recurring-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="description" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>說明</FormLabel>
                <FormControl><Textarea {...field} rows={2} data-testid="input-recurring-desc" /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField name="recurrenceType" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>頻率</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v === "daily") form.setValue("recurrenceDays", []); }}>
                    <FormControl><SelectTrigger data-testid="select-recurring-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="daily">每天</SelectItem>
                      <SelectItem value="weekly">每週</SelectItem>
                      <SelectItem value="monthly">每月</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField name="shiftType" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>班別</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-recurring-shift"><SelectValue /></SelectTrigger></FormControl>
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
            {recurrenceType === "weekly" && (
              <div>
                <p className="text-sm font-medium mb-2">星期幾出現 *</p>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAYS.map((w) => {
                    const active = days.includes(w.value);
                    return (
                      <button
                        type="button"
                        key={w.value}
                        onClick={() => toggleDay(w.value)}
                        className={`w-10 h-10 rounded-full text-sm font-bold border-2 transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary"}`}
                        data-testid={`button-weekday-${w.value}`}
                      >{w.label}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {recurrenceType === "monthly" && (
              <FormField name="recurrenceDays" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>每月哪些日期（用逗號分隔，例如 1,15,28）</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-recurring-monthly-days"
                      value={(field.value ?? []).join(",")}
                      onChange={(e) => {
                        const arr = e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 1 && n <= 31);
                        field.onChange(arr);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )} />
            )}
            <FormField name="inputType" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>輸入類型</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger data-testid="select-recurring-input"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {INPUT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">必填</span>
                <FormField name="isRequired" control={form.control} render={({ field }) => (
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-recurring-required" /></FormControl>
                )} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">啟用</span>
                <FormField name="isActive" control={form.control} render={({ field }) => (
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-recurring-active" /></FormControl>
                )} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" disabled={saveMut.isPending} data-testid="button-save-recurring">
                {saveMut.isPending ? "儲存中…" : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
