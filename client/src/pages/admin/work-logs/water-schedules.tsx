import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertWaterQualityScheduleSchema, type WaterQualitySchedule } from "@shared/schema";
import { AdminRoleGuard, EmptyState, ErrorState, LoadingState, WorkLogAdminShell, shiftLabel, useAdminFacility } from "./_shared";

export default function WaterSchedulesPage() {
  return <AdminRoleGuard><Inner /></AdminRoleGuard>;
}

function Inner() {
  const [facilityKey, setFacilityKey] = useAdminFacility();
  const [editing, setEditing] = useState<WaterQualitySchedule | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<{ items: WaterQualitySchedule[] }>({
    queryKey: ["/api/work-logs/admin/water-schedules", facilityKey],
    queryFn: async () => {
      const r = await fetch(`/api/work-logs/admin/water-schedules?facilityKey=${encodeURIComponent(facilityKey)}`, { credentials: "include" });
      if (!r.ok) throw new Error("載入失敗");
      return r.json();
    },
    enabled: !!facilityKey,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/work-logs/admin/water-schedules/${id}`); },
    onSuccess: () => {
      toast({ title: "已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/water-schedules", facilityKey] });
    },
    onError: (e: Error) => toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const grouped = new Map<string, WaterQualitySchedule[]>();
  for (const it of items) {
    const arr = grouped.get(it.poolName) ?? [];
    arr.push(it);
    grouped.set(it.poolName, arr);
  }

  return (
    <WorkLogAdminShell
      title="水質測量時段"
      description="設定每池每班的水質檢測時間點"
      facilityKey={facilityKey}
      onFacilityChange={setFacilityKey}
      actions={
        <Button onClick={() => setCreating(true)} data-testid="button-create-water-schedule">
          <Plus className="h-4 w-4 mr-1" /> 新增時段
        </Button>
      }
    >
      {isLoading ? <LoadingState /> : isError ? <ErrorState message="載入失敗" /> : items.length === 0 ? (
        <EmptyState message="尚未設定水質時段" />
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([pool, rows]) => (
            <div key={pool} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 border-b border-border">
                <h3 className="font-bold text-sm">{pool}</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">班別</TableHead>
                    <TableHead className="w-28">時間</TableHead>
                    <TableHead className="w-20 text-center">啟用</TableHead>
                    <TableHead className="w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows
                    .slice()
                    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                    .map((row) => (
                    <TableRow key={row.id} data-testid={`row-water-schedule-${row.id}`}>
                      <TableCell className="text-xs">{shiftLabel(row.shiftType)}</TableCell>
                      <TableCell className="font-mono text-sm">{row.scheduledTime}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs ${row.isActive ? "text-emerald-600 font-bold" : "text-muted-foreground line-through"}`}>
                          {row.isActive ? "啟用" : "停用"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(row)} data-testid={`button-edit-water-schedule-${row.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingId(row.id)} data-testid={`button-delete-water-schedule-${row.id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <EditDialog facilityKey={facilityKey} existing={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}

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
  poolName: string;
  shiftType: "morning" | "noon" | "night" | "all";
  scheduledTime: string;
  isActive: boolean;
}

function EditDialog({ facilityKey, existing, onClose }: { facilityKey: string; existing: WaterQualitySchedule | null; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(insertWaterQualityScheduleSchema),
    defaultValues: existing ? {
      facilityKey: existing.facilityKey,
      poolName: existing.poolName,
      shiftType: existing.shiftType as FormValues["shiftType"],
      scheduledTime: existing.scheduledTime,
      isActive: existing.isActive,
    } : {
      facilityKey,
      poolName: "",
      shiftType: "morning",
      scheduledTime: "08:00",
      isActive: true,
    },
  });

  const saveMut = useMutation({
    mutationFn: async (v: FormValues) => {
      if (existing) await apiRequest("PATCH", `/api/work-logs/admin/water-schedules/${existing.id}`, v);
      else await apiRequest("POST", "/api/work-logs/admin/water-schedules", v);
    },
    onSuccess: () => {
      toast({ title: existing ? "已更新" : "已新增" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/water-schedules", facilityKey] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{existing ? "編輯水質時段" : "新增水質時段"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMut.mutate(v))} className="space-y-3">
            <FormField name="poolName" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>水池名稱 *</FormLabel>
                <FormControl><Input {...field} placeholder="例如：主池 / SPA / 兒童池" data-testid="input-water-schedule-pool" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField name="shiftType" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>班別</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-water-schedule-shift"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="morning">早班</SelectItem>
                      <SelectItem value="noon">中班</SelectItem>
                      <SelectItem value="night">晚班</SelectItem>
                      <SelectItem value="all">全班</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField name="scheduledTime" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>時間 *</FormLabel>
                  <FormControl><Input type="time" {...field} data-testid="input-water-schedule-time" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">啟用</span>
              <FormField name="isActive" control={form.control} render={({ field }) => (
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-water-schedule-active" /></FormControl>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" disabled={saveMut.isPending} data-testid="button-save-water-schedule">
                {saveMut.isPending ? "儲存中…" : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
