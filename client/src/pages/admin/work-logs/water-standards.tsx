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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertWaterQualityStandardSchema, type WaterQualityStandard } from "@shared/schema";
import { AdminRoleGuard, EmptyState, ErrorState, LoadingState, WorkLogAdminShell, useAdminFacility } from "./_shared";

export default function WaterStandardsPage() {
  return <AdminRoleGuard><Inner /></AdminRoleGuard>;
}

function Inner() {
  const [facilityKey, setFacilityKey] = useAdminFacility();
  const [editing, setEditing] = useState<WaterQualityStandard | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<{ items: WaterQualityStandard[] }>({
    queryKey: ["/api/work-logs/admin/water-standards", facilityKey],
    queryFn: async () => {
      const r = await fetch(`/api/work-logs/admin/water-standards?facilityKey=${encodeURIComponent(facilityKey)}`, { credentials: "include" });
      if (!r.ok) throw new Error("載入失敗");
      return r.json();
    },
    enabled: !!facilityKey,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/work-logs/admin/water-standards/${id}`); },
    onSuccess: () => {
      toast({ title: "已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/water-standards", facilityKey] });
    },
    onError: (e: Error) => toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const grouped = new Map<string, WaterQualityStandard[]>();
  for (const it of items) {
    const arr = grouped.get(it.poolName) ?? [];
    arr.push(it);
    grouped.set(it.poolName, arr);
  }

  return (
    <WorkLogAdminShell
      title="水質標準值"
      description="每池每項參數 (PH、餘氯、ORP 等) 的合理範圍。員工輸入時會自動比對並提示異常。"
      facilityKey={facilityKey}
      onFacilityChange={setFacilityKey}
      actions={
        <Button onClick={() => setCreating(true)} data-testid="button-create-water-standard">
          <Plus className="h-4 w-4 mr-1" /> 新增標準
        </Button>
      }
    >
      {isLoading ? <LoadingState /> : isError ? <ErrorState message="載入失敗" /> : items.length === 0 ? (
        <EmptyState message="尚未建立任何水質標準" />
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
                    <TableHead>參數</TableHead>
                    <TableHead className="w-20">單位</TableHead>
                    <TableHead className="w-24 text-right">下限</TableHead>
                    <TableHead className="w-24 text-right">上限</TableHead>
                    <TableHead className="w-20 text-center">啟用</TableHead>
                    <TableHead className="w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} data-testid={`row-water-standard-${row.id}`}>
                      <TableCell className="font-medium">{row.parameterName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.unit ?? ""}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.minValue ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.maxValue ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs ${row.isActive ? "text-emerald-600 font-bold" : "text-muted-foreground line-through"}`}>
                          {row.isActive ? "啟用" : "停用"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(row)} data-testid={`button-edit-water-standard-${row.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingId(row.id)} data-testid={`button-delete-water-standard-${row.id}`}>
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
  parameterName: string;
  unit?: string | null;
  minValue?: string | null;
  maxValue?: string | null;
  isActive: boolean;
}

function EditDialog({ facilityKey, existing, onClose }: { facilityKey: string; existing: WaterQualityStandard | null; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(insertWaterQualityStandardSchema),
    defaultValues: existing ? {
      facilityKey: existing.facilityKey,
      poolName: existing.poolName,
      parameterName: existing.parameterName,
      unit: existing.unit ?? "",
      minValue: existing.minValue ?? "",
      maxValue: existing.maxValue ?? "",
      isActive: existing.isActive,
    } : {
      facilityKey,
      poolName: "",
      parameterName: "",
      unit: "",
      minValue: "",
      maxValue: "",
      isActive: true,
    },
  });

  const saveMut = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload = { ...v, unit: v.unit || null, minValue: v.minValue || null, maxValue: v.maxValue || null };
      if (existing) await apiRequest("PATCH", `/api/work-logs/admin/water-standards/${existing.id}`, payload);
      else await apiRequest("POST", "/api/work-logs/admin/water-standards", payload);
    },
    onSuccess: () => {
      toast({ title: existing ? "已更新" : "已新增" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/water-standards", facilityKey] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{existing ? "編輯水質標準" : "新增水質標準"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMut.mutate(v))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField name="poolName" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>水池 *</FormLabel>
                  <FormControl><Input {...field} placeholder="例如 主池" data-testid="input-water-standard-pool" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="parameterName" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>參數 *</FormLabel>
                  <FormControl><Input {...field} placeholder="例如 PH" data-testid="input-water-standard-param" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField name="unit" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>單位</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="例如 mg/L、°C" data-testid="input-water-standard-unit" /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField name="minValue" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>下限</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="例如 6.5" data-testid="input-water-standard-min" /></FormControl>
                </FormItem>
              )} />
              <FormField name="maxValue" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>上限</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="例如 8.0" data-testid="input-water-standard-max" /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">啟用</span>
              <FormField name="isActive" control={form.control} render={({ field }) => (
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-water-standard-active" /></FormControl>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" disabled={saveMut.isPending} data-testid="button-save-water-standard">
                {saveMut.isPending ? "儲存中…" : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
