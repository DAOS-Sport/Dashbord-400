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

function effectivePeriodKey(s: WaterQualitySchedule): string {
  return `${s.startDate ?? "0000-00-00"}|${s.endDate ?? "9999-12-31"}`;
}

function periodLabel(s: WaterQualitySchedule): string {
  if (!s.startDate && !s.endDate) return "永久生效";
  if (s.startDate && s.endDate) return `${s.startDate} ~ ${s.endDate}`;
  if (s.startDate) return `${s.startDate} 起`;
  return `至 ${s.endDate}`;
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

  // Group by pool, then by effective period (sorted: priority DESC, startDate DESC NULLS LAST, scheduledTime ASC)
  const groupedByPool = new Map<string, WaterQualitySchedule[]>();
  for (const it of items) {
    const arr = groupedByPool.get(it.poolName) ?? [];
    arr.push(it);
    groupedByPool.set(it.poolName, arr);
  }
  groupedByPool.forEach((rows) => {
    rows.sort((a: WaterQualitySchedule, b: WaterQualitySchedule) => {
      // priority DESC
      if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
      // effective start DESC (newer first; null = 永久 = oldest)
      const sa = a.startDate ?? "";
      const sb = b.startDate ?? "";
      if (sa !== sb) return sb.localeCompare(sa);
      // scheduledTime ASC
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });
  });

  return (
    <WorkLogAdminShell
      title="水質測量時段"
      description="設定每池的水質檢測時間表（支援生效期間、定時間隔、客製時段、優先順序）"
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
          {Array.from(groupedByPool.entries()).map(([pool, rows]) => {
            // Inside each pool, sub-group by effective period for visual separation
            const byPeriod = new Map<string, WaterQualitySchedule[]>();
            for (const r of rows) {
              const k = effectivePeriodKey(r);
              const arr = byPeriod.get(k) ?? [];
              arr.push(r);
              byPeriod.set(k, arr);
            }
            return (
              <div key={pool} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 border-b border-border">
                  <h3 className="font-bold text-sm">{pool}</h3>
                </div>
                {Array.from(byPeriod.values()).map((periodRows) => (
                  <div key={effectivePeriodKey(periodRows[0])} className="border-b border-border last:border-b-0">
                    <div className="bg-muted/20 px-4 py-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>生效期間：<span className="font-mono text-foreground">{periodLabel(periodRows[0])}</span></span>
                      <span>優先順序：<span className="font-mono text-foreground">{periodRows[0].priority ?? 0}</span></span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">班別</TableHead>
                          <TableHead className="w-24">時間</TableHead>
                          <TableHead className="w-28">間隔(分)</TableHead>
                          <TableHead>客製時段</TableHead>
                          <TableHead className="w-20 text-center">啟用</TableHead>
                          <TableHead className="w-24 text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {periodRows.map((row) => (
                          <TableRow key={row.id} data-testid={`row-water-schedule-${row.id}`}>
                            <TableCell className="text-xs">{shiftLabel(row.shiftType)}</TableCell>
                            <TableCell className="font-mono text-sm">{row.scheduledTime}</TableCell>
                            <TableCell className="font-mono text-xs">{row.intervalMinutes ?? "—"}</TableCell>
                            <TableCell className="text-xs font-mono">
                              {row.customTimes && row.customTimes.length > 0 ? row.customTimes.join(", ") : "—"}
                            </TableCell>
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
            );
          })}
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
  startDate?: string | null;
  endDate?: string | null;
  intervalMinutes?: number | null;
  customTimesText: string;
  priority: number;
  isActive: boolean;
}

function EditDialog({ facilityKey, existing, onClose }: { facilityKey: string; existing: WaterQualitySchedule | null; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    defaultValues: existing ? {
      facilityKey: existing.facilityKey,
      poolName: existing.poolName,
      shiftType: existing.shiftType as FormValues["shiftType"],
      scheduledTime: existing.scheduledTime,
      startDate: existing.startDate ?? "",
      endDate: existing.endDate ?? "",
      intervalMinutes: existing.intervalMinutes ?? null,
      customTimesText: existing.customTimes?.join(", ") ?? "",
      priority: existing.priority ?? 0,
      isActive: existing.isActive,
    } : {
      facilityKey,
      poolName: "",
      shiftType: "morning",
      scheduledTime: "08:00",
      startDate: "",
      endDate: "",
      intervalMinutes: null,
      customTimesText: "",
      priority: 0,
      isActive: true,
    },
  });

  const saveMut = useMutation({
    mutationFn: async (v: FormValues) => {
      const customTimes = v.customTimesText
        .split(/[,\s、]+/)
        .map((s) => s.trim())
        .filter((s) => /^\d{2}:\d{2}$/.test(s));
      const payload = {
        facilityKey: v.facilityKey,
        poolName: v.poolName,
        shiftType: v.shiftType,
        scheduledTime: v.scheduledTime,
        startDate: v.startDate || null,
        endDate: v.endDate || null,
        intervalMinutes: v.intervalMinutes && v.intervalMinutes > 0 ? Number(v.intervalMinutes) : null,
        customTimes: customTimes.length > 0 ? customTimes : null,
        priority: Number(v.priority) || 0,
        isActive: v.isActive,
      };
      const parsed = insertWaterQualityScheduleSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "輸入有誤");
      if (existing) await apiRequest("PATCH", `/api/work-logs/admin/water-schedules/${existing.id}`, parsed.data);
      else await apiRequest("POST", "/api/work-logs/admin/water-schedules", parsed.data);
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "編輯水質時段" : "新增水質時段"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMut.mutate(v))} className="space-y-3">
            <FormField name="poolName" control={form.control} rules={{ required: "請填寫水池名稱" }} render={({ field }) => (
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
                  <FormLabel>預設時間 *</FormLabel>
                  <FormControl><Input type="time" {...field} data-testid="input-water-schedule-time" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="rounded-lg border border-dashed p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">生效期間（留空＝永久）</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField name="startDate" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">起始日</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="input-water-schedule-start-date" /></FormControl>
                  </FormItem>
                )} />
                <FormField name="endDate" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">結束日</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="input-water-schedule-end-date" /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">排程策略（三選一即可，皆留空＝只用上方預設時間）</p>
              <FormField name="intervalMinutes" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">每隔幾分鐘測量一次</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={5}
                      max={720}
                      placeholder="例如 60 = 每小時"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      data-testid="input-water-schedule-interval"
                    />
                  </FormControl>
                </FormItem>
              )} />
              <FormField name="customTimesText" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">客製時段（HH:MM, 以逗號分隔）</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如 09:00, 11:30, 14:00, 17:00"
                      {...field}
                      data-testid="input-water-schedule-custom-times"
                    />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <FormField name="priority" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>優先順序</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                      data-testid="input-water-schedule-priority"
                    />
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">數字越大越優先（預設 0）</p>
                </FormItem>
              )} />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">啟用</span>
                <FormField name="isActive" control={form.control} render={({ field }) => (
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-water-schedule-active" /></FormControl>
                )} />
              </div>
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
