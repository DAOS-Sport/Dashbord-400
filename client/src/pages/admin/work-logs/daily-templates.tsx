import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertDailyTaskTemplateSchema, type DailyTaskTemplate } from "@shared/schema";
import { AdminRoleGuard, EmptyState, ErrorState, INPUT_TYPES, LoadingState, WorkLogAdminShell, shiftLabel, useAdminFacility } from "./_shared";

export default function DailyTemplatesPage() {
  return (
    <AdminRoleGuard>
      <Inner />
    </AdminRoleGuard>
  );
}

function Inner() {
  const [facilityKey, setFacilityKey] = useAdminFacility();
  const [editing, setEditing] = useState<DailyTaskTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<{ items: DailyTaskTemplate[] }>({
    queryKey: ["/api/work-logs/admin/daily-templates", facilityKey],
    queryFn: async () => {
      const r = await fetch(`/api/work-logs/admin/daily-templates?facilityKey=${encodeURIComponent(facilityKey)}`, { credentials: "include" });
      if (!r.ok) throw new Error("載入失敗");
      return r.json();
    },
    enabled: !!facilityKey,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/work-logs/admin/daily-templates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/daily-templates", facilityKey] });
    },
    onError: (e: Error) => toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];

  return (
    <WorkLogAdminShell
      title="每日固定事項"
      description="設定每天必須執行的固定任務（依班別篩選），員工值班時會自動列入工作日誌"
      facilityKey={facilityKey}
      onFacilityChange={setFacilityKey}
      actions={
        <Button onClick={() => setCreating(true)} data-testid="button-create-daily-template">
          <Plus className="h-4 w-4 mr-1" /> 新增項目
        </Button>
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="載入清單失敗" />
      ) : items.length === 0 ? (
        <EmptyState message="尚未建立任何每日固定事項，點右上「新增項目」開始建立" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">排序</TableHead>
                <TableHead>任務名稱</TableHead>
                <TableHead className="w-20">班別</TableHead>
                <TableHead className="w-32">輸入類型</TableHead>
                <TableHead className="w-16 text-center">必填</TableHead>
                <TableHead className="w-16 text-center">啟用</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id} data-testid={`row-daily-${row.id}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.sortOrder}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.taskName}</div>
                    {row.description && <div className="text-xs text-muted-foreground mt-0.5">{row.description}</div>}
                  </TableCell>
                  <TableCell><span className="text-xs">{shiftLabel(row.shiftType)}</span></TableCell>
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
                      <Button size="icon" variant="ghost" onClick={() => setEditing(row)} data-testid={`button-edit-daily-${row.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeletingId(row.id)} data-testid={`button-delete-daily-${row.id}`}>
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
        <EditDialog
          facilityKey={facilityKey}
          existing={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <AlertDialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除？</AlertDialogTitle>
            <AlertDialogDescription>
              刪除後此項目將不再出現在工作日誌中。已建立的完成紀錄不受影響。
            </AlertDialogDescription>
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
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkLogAdminShell>
  );
}

interface FormValues {
  facilityKey: string;
  shiftType: "morning" | "noon" | "night" | "all";
  taskName: string;
  description?: string;
  inputType: string;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}

function EditDialog({ facilityKey, existing, onClose }: { facilityKey: string; existing: DailyTaskTemplate | null; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(insertDailyTaskTemplateSchema),
    defaultValues: existing ? {
      facilityKey: existing.facilityKey,
      shiftType: existing.shiftType as FormValues["shiftType"],
      taskName: existing.taskName,
      description: existing.description ?? "",
      inputType: existing.inputType,
      isRequired: existing.isRequired,
      sortOrder: existing.sortOrder,
      isActive: existing.isActive,
    } : {
      facilityKey,
      shiftType: "all",
      taskName: "",
      description: "",
      inputType: "checkbox",
      isRequired: true,
      sortOrder: 0,
      isActive: true,
    },
  });

  const saveMut = useMutation({
    mutationFn: async (values: FormValues) => {
      if (existing) {
        await apiRequest("PATCH", `/api/work-logs/admin/daily-templates/${existing.id}`, values);
      } else {
        await apiRequest("POST", "/api/work-logs/admin/daily-templates", values);
      }
    },
    onSuccess: () => {
      toast({ title: existing ? "已更新" : "已新增" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/daily-templates", facilityKey] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "編輯每日固定事項" : "新增每日固定事項"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMut.mutate(v))} className="space-y-3">
            <FormField name="taskName" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>任務名稱 *</FormLabel>
                <FormControl><Input {...field} data-testid="input-daily-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="description" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>說明</FormLabel>
                <FormControl><Textarea {...field} rows={2} data-testid="input-daily-desc" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField name="shiftType" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>班別</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-daily-shift"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="morning">早班</SelectItem>
                      <SelectItem value="noon">中班</SelectItem>
                      <SelectItem value="night">晚班</SelectItem>
                      <SelectItem value="all">全班</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField name="inputType" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>輸入類型</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-daily-input"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {INPUT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <FormField name="sortOrder" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>排序</FormLabel>
                <FormControl>
                  <Input type="number" {...field} value={field.value} onChange={(e) => field.onChange(Number(e.target.value))} data-testid="input-daily-sort" />
                </FormControl>
              </FormItem>
            )} />
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">必填</p>
                <p className="text-xs text-muted-foreground">送出日報前必須完成</p>
              </div>
              <FormField name="isRequired" control={form.control} render={({ field }) => (
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-daily-required" /></FormControl>
              )} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">啟用</p>
                <p className="text-xs text-muted-foreground">停用後員工不會看到此項</p>
              </div>
              <FormField name="isActive" control={form.control} render={({ field }) => (
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-daily-active" /></FormControl>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" disabled={saveMut.isPending} data-testid="button-save-daily">
                {saveMut.isPending ? "儲存中…" : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
