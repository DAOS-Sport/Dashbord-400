import { useMemo, useState } from "react";
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
import { insertDailyTaskTemplateSchema, type DailyTaskTemplate, type DailyTaskCategory } from "@shared/schema";
import { AdminRoleGuard, EmptyState, ErrorState, INPUT_TYPES, LoadingState, WorkLogAdminShell, shiftLabel, useAdminFacility, useModuleType } from "./_shared";

const CATEGORY_TABS: Array<{ value: "all" | DailyTaskCategory; label: string; hint?: string }> = [
  { value: "all", label: "全部" },
  { value: "routine", label: "例行事項", hint: "依班別每天執行的固定項目" },
  { value: "opening", label: "開館報表", hint: "每天開館時要檢查的項目（開燈、開門、空調…）" },
  { value: "closing", label: "閉館報表", hint: "每天閉館時要檢查的項目（關燈、關窗、關空調…）" },
  { value: "locker_inspection", label: "更衣室巡視", hint: "更衣室、烤箱、蒸氣室等定時巡視項目（可設每隔幾分鐘）" },
];

const CATEGORY_LABELS: Record<DailyTaskCategory, string> = {
  routine: "例行",
  opening: "開館",
  closing: "閉館",
  locker_inspection: "更衣室",
};

const CATEGORY_BADGE_CLASS: Record<DailyTaskCategory, string> = {
  routine: "bg-slate-100 text-slate-700 border-slate-300",
  opening: "bg-amber-50 text-amber-700 border-amber-300",
  closing: "bg-indigo-50 text-indigo-700 border-indigo-300",
  locker_inspection: "bg-emerald-50 text-emerald-700 border-emerald-300",
};

export default function DailyTemplatesPage() {
  return (
    <AdminRoleGuard>
      <Inner />
    </AdminRoleGuard>
  );
}

function Inner() {
  const moduleType = useModuleType();
  const [facilityKey, setFacilityKey] = useAdminFacility();
  const [editing, setEditing] = useState<DailyTaskTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<"all" | DailyTaskCategory>("all");
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<{ items: DailyTaskTemplate[] }>({
    queryKey: ["/api/work-logs/admin/daily-templates", moduleType, facilityKey],
    queryFn: async () => {
      const r = await fetch(`/api/work-logs/admin/daily-templates?facilityKey=${encodeURIComponent(facilityKey)}&moduleType=${moduleType}`, { credentials: "include" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/daily-templates", moduleType, facilityKey] });
    },
    onError: (e: Error) => toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  });

  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    if (activeCategory === "all") return allItems;
    return allItems.filter((it) => (it.category ?? "routine") === activeCategory);
  }, [allItems, activeCategory]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allItems.length, routine: 0, opening: 0, closing: 0, locker_inspection: 0 };
    for (const it of allItems) {
      const cat = (it.category ?? "routine") as DailyTaskCategory;
      c[cat] = (c[cat] ?? 0) + 1;
    }
    return c;
  }, [allItems]);

  const activeTab = CATEGORY_TABS.find((t) => t.value === activeCategory);

  return (
    <WorkLogAdminShell
      title="每日固定事項"
      description="設定每天必須執行的固定任務、開館 / 閉館報表、更衣室巡視項目，員工值班時會自動列入工作日誌"
      facilityKey={facilityKey}
      onFacilityChange={setFacilityKey}
      actions={
        <Button onClick={() => setCreating(true)} data-testid="button-create-daily-template">
          <Plus className="h-4 w-4 mr-1" /> 新增項目
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1 border-b border-border pb-1">
        {CATEGORY_TABS.map((tab) => {
          const active = activeCategory === tab.value;
          const count = counts[tab.value] ?? 0;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveCategory(tab.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                active ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
              data-testid={`tab-category-${tab.value}`}
            >
              {tab.label}
              <span className={`text-[10px] font-mono px-1 rounded ${active ? "bg-white/20" : "bg-muted-foreground/15"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {activeTab?.hint && (
        <p className="text-xs text-muted-foreground mb-3">{activeTab.hint}</p>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="載入清單失敗" />
      ) : items.length === 0 ? (
        <EmptyState message={`此分類尚無項目，點右上「新增項目」開始建立${activeTab && activeTab.value !== "all" ? `（${activeTab.label}）` : ""}`} />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">排序</TableHead>
                <TableHead className="w-20">分類</TableHead>
                <TableHead>任務名稱</TableHead>
                <TableHead className="w-20">班別</TableHead>
                <TableHead className="w-24">輸入類型</TableHead>
                <TableHead className="w-20 text-center">巡視間隔</TableHead>
                <TableHead className="w-16 text-center">必填</TableHead>
                <TableHead className="w-16 text-center">需照片</TableHead>
                <TableHead className="w-16 text-center">啟用</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const cat = (row.category ?? "routine") as DailyTaskCategory;
                return (
                  <TableRow key={row.id} data-testid={`row-daily-${row.id}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.sortOrder}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_BADGE_CLASS[cat]}`} data-testid={`badge-category-${row.id}`}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.taskName}</div>
                      {row.description && <div className="text-xs text-muted-foreground mt-0.5">{row.description}</div>}
                    </TableCell>
                    <TableCell><span className="text-xs">{shiftLabel(row.shiftType)}</span></TableCell>
                    <TableCell><span className="text-xs font-mono">{row.inputType}</span></TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {row.intervalMinutes ? `${row.intervalMinutes} 分` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-bold ${row.isRequired ? "text-rose-600" : "text-muted-foreground"}`}>
                        {row.isRequired ? "必填" : "選填"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center" data-testid={`cell-require-photo-${row.id}`}>
                      <span className={`text-xs ${row.requirePhoto ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>
                        {row.requirePhoto ? "需要" : "—"}
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {(creating || editing) && (
        <EditDialog
          facilityKey={facilityKey}
          moduleType={moduleType}
          existing={editing}
          defaultCategory={activeCategory === "all" ? "routine" : activeCategory}
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
  moduleType: "lifeguard" | "counter";
  category: DailyTaskCategory;
  shiftType: "morning" | "noon" | "night" | "all";
  taskName: string;
  description?: string;
  inputType: string;
  isRequired: boolean;
  requirePhoto: boolean;
  intervalMinutes?: number | null;
  sortOrder: number;
  isActive: boolean;
}

function EditDialog({ facilityKey, moduleType, existing, defaultCategory, onClose }: { facilityKey: string; moduleType: "lifeguard" | "counter"; existing: DailyTaskTemplate | null; defaultCategory: DailyTaskCategory; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(insertDailyTaskTemplateSchema),
    defaultValues: existing ? {
      facilityKey: existing.facilityKey,
      moduleType: ((existing.moduleType ?? "lifeguard") as "lifeguard" | "counter"),
      category: ((existing.category ?? "routine") as DailyTaskCategory),
      shiftType: existing.shiftType as FormValues["shiftType"],
      taskName: existing.taskName,
      description: existing.description ?? "",
      inputType: existing.inputType,
      isRequired: existing.isRequired,
      requirePhoto: existing.requirePhoto ?? false,
      intervalMinutes: existing.intervalMinutes ?? null,
      sortOrder: existing.sortOrder,
      isActive: existing.isActive,
    } : {
      facilityKey,
      moduleType,
      category: defaultCategory,
      shiftType: defaultCategory === "opening" ? "morning" : defaultCategory === "closing" ? "night" : "all",
      taskName: "",
      description: "",
      inputType: "checkbox",
      isRequired: true,
      requirePhoto: false,
      intervalMinutes: defaultCategory === "locker_inspection" ? 60 : null,
      sortOrder: 0,
      isActive: true,
    },
  });

  const watchCategory = form.watch("category");

  const saveMut = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        intervalMinutes: values.category === "locker_inspection" && values.intervalMinutes ? Number(values.intervalMinutes) : null,
      };
      if (existing) {
        await apiRequest("PATCH", `/api/work-logs/admin/daily-templates/${existing.id}`, payload);
      } else {
        await apiRequest("POST", "/api/work-logs/admin/daily-templates", payload);
      }
    },
    onSuccess: () => {
      toast({ title: existing ? "已更新" : "已新增" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/daily-templates", moduleType, facilityKey] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "編輯項目" : "新增項目"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => saveMut.mutate(v))} className="space-y-3">
            <FormField name="category" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>分類 *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger data-testid="select-daily-category"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="routine">例行事項</SelectItem>
                    <SelectItem value="opening">開館報表</SelectItem>
                    <SelectItem value="closing">閉館報表</SelectItem>
                    <SelectItem value="locker_inspection">更衣室巡視</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="taskName" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>任務名稱 *</FormLabel>
                <FormControl><Input {...field} placeholder={watchCategory === "opening" ? "例如：開大廳燈" : watchCategory === "closing" ? "例如：關空調" : watchCategory === "locker_inspection" ? "例如：女更衣室巡視" : "例如：擦拭櫃台"} data-testid="input-daily-name" /></FormControl>
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
            {watchCategory === "locker_inspection" && (
              <FormField name="intervalMinutes" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>巡視間隔（分鐘）</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={5}
                      max={720}
                      placeholder="例如 60 = 每小時巡視一次"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      data-testid="input-daily-interval"
                    />
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">員工會在每個間隔點看到提醒，並需勾選此次巡視結果（烤箱／蒸氣室／更衣室狀況）</p>
                  <FormMessage />
                </FormItem>
              )} />
            )}
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
                <p className="text-sm font-medium">需要照片</p>
                <p className="text-xs text-muted-foreground">完成此項時必須上傳一張照片</p>
              </div>
              <FormField name="requirePhoto" control={form.control} render={({ field }) => (
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-daily-require-photo" /></FormControl>
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
