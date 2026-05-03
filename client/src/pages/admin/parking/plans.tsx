import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuthMe } from "@/shared/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ParkingPlan } from "@shared/schema";
import { ParkingShell, ParkingGuard, PLAN_TYPE_LABELS } from "./_shared";

interface PlanForm {
  id?: number;
  planKey: string;
  name: string;
  planType: string;
  durationMonths: string;
  price: string;
  deposit: string;
  guarantee: string;
  notifyDaysBefore: string;
  requiresContract: boolean;
  requiresPayment: boolean;
  requiresReview: boolean;
  allowsOnlineRenewal: boolean;
  isActive: boolean;
  displayOrder: string;
  description: string;
}

const EMPTY: PlanForm = {
  planKey: "",
  name: "",
  planType: "monthly",
  durationMonths: "1",
  price: "0",
  deposit: "0",
  guarantee: "0",
  notifyDaysBefore: "30",
  requiresContract: true,
  requiresPayment: true,
  requiresReview: true,
  allowsOnlineRenewal: true,
  isActive: true,
  displayOrder: "0",
  description: "",
};

export default function ParkingPlansPage() {
  const { data: session, isLoading, isError } = useAuthMe();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<PlanForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ParkingPlan | null>(null);

  const listQ = useQuery<{ items: ParkingPlan[] }>({
    queryKey: ["/api/parking/plans", "all"],
    queryFn: async () => {
      const r = await fetch("/api/parking/plans?includeInactive=1", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const upsertMut = useMutation({
    mutationFn: async (input: PlanForm) => {
      const payload = toPayload(input);
      if (input.id) return (await apiRequest("PATCH", `/api/parking/plans/${input.id}`, payload)).json();
      return (await apiRequest("POST", "/api/parking/plans", payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/plans"] });
      setDialog(null);
      toast({ title: "已儲存" });
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/parking/plans/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/plans"] });
      setConfirmDelete(null);
      toast({ title: "已刪除" });
    },
    onError: (e: Error) => toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <ParkingGuard session={session} isLoading={isLoading} isError={isError}>
      <ParkingShell
        title="方案管理"
        subtitle="維護月租 / 季租 / 年租 / 會員 / 員工 / 特約 / 黑名單方案"
        headerExtra={
          <Button data-testid="button-new-plan" onClick={() => setDialog({ ...EMPTY })}>
            <Plus className="h-4 w-4 mr-1" /> 新增方案
          </Button>
        }
      >
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>順序</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>類型</TableHead>
                <TableHead className="text-right">月數</TableHead>
                <TableHead className="text-right">價格</TableHead>
                <TableHead className="text-right">押金</TableHead>
                <TableHead>啟用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">載入中…</TableCell></TableRow>}
              {!listQ.isLoading && (listQ.data?.items.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8" data-testid="text-plans-empty">尚未建立任何方案</TableCell></TableRow>
              )}
              {listQ.data?.items.map((p) => (
                <TableRow key={p.id} data-testid={`row-plan-${p.id}`}>
                  <TableCell className="text-muted-foreground tabular-nums">{p.displayOrder}</TableCell>
                  <TableCell className="font-medium">
                    <div>{p.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{p.planKey}</div>
                  </TableCell>
                  <TableCell>{PLAN_TYPE_LABELS[p.planType] ?? p.planType}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.durationMonths ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.price.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.deposit.toLocaleString()}</TableCell>
                  <TableCell>{p.isActive ? <Badge>啟用</Badge> : <Badge variant="outline">停用</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" data-testid={`button-edit-plan-${p.id}`} onClick={() => setDialog(planToForm(p))}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid={`button-delete-plan-${p.id}`} onClick={() => setConfirmDelete(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{dialog?.id ? "編輯方案" : "新增方案"}</DialogTitle></DialogHeader>
            {dialog && (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>方案代號（小寫英數+底線）</Label>
                    <Input value={dialog.planKey} disabled={!!dialog.id} onChange={(e) => setDialog({ ...dialog, planKey: e.target.value.toLowerCase() })} placeholder="monthly_basic" data-testid="input-plan-key" />
                  </div>
                  <div>
                    <Label>顯示順序</Label>
                    <Input type="number" value={dialog.displayOrder} onChange={(e) => setDialog({ ...dialog, displayOrder: e.target.value })} data-testid="input-display-order" />
                  </div>
                </div>
                <div>
                  <Label>方案名稱</Label>
                  <Input value={dialog.name} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} data-testid="input-plan-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>類型</Label>
                    <Select value={dialog.planType} onValueChange={(v) => setDialog({ ...dialog, planType: v })}>
                      <SelectTrigger data-testid="select-plan-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PLAN_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>合約月數（會員/黑名單可空）</Label>
                    <Input type="number" min="0" value={dialog.durationMonths} onChange={(e) => setDialog({ ...dialog, durationMonths: e.target.value })} data-testid="input-duration-months" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>價格</Label>
                    <Input type="number" min="0" value={dialog.price} onChange={(e) => setDialog({ ...dialog, price: e.target.value })} data-testid="input-price" />
                  </div>
                  <div>
                    <Label>押金</Label>
                    <Input type="number" min="0" value={dialog.deposit} onChange={(e) => setDialog({ ...dialog, deposit: e.target.value })} data-testid="input-deposit" />
                  </div>
                  <div>
                    <Label>保證金</Label>
                    <Input type="number" min="0" value={dialog.guarantee} onChange={(e) => setDialog({ ...dialog, guarantee: e.target.value })} data-testid="input-guarantee" />
                  </div>
                </div>
                <div>
                  <Label>到期前通知天數</Label>
                  <Input type="number" min="0" value={dialog.notifyDaysBefore} onChange={(e) => setDialog({ ...dialog, notifyDaysBefore: e.target.value })} data-testid="input-notify-days" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Toggle label="需要合約" v={dialog.requiresContract} on={(v) => setDialog({ ...dialog, requiresContract: v })} testid="switch-requires-contract" />
                  <Toggle label="需要付款" v={dialog.requiresPayment} on={(v) => setDialog({ ...dialog, requiresPayment: v })} testid="switch-requires-payment" />
                  <Toggle label="需要審核" v={dialog.requiresReview} on={(v) => setDialog({ ...dialog, requiresReview: v })} testid="switch-requires-review" />
                  <Toggle label="允許線上續約" v={dialog.allowsOnlineRenewal} on={(v) => setDialog({ ...dialog, allowsOnlineRenewal: v })} testid="switch-allow-renewal" />
                  <Toggle label="啟用此方案" v={dialog.isActive} on={(v) => setDialog({ ...dialog, isActive: v })} testid="switch-is-active" />
                </div>
                <div>
                  <Label>方案說明</Label>
                  <Textarea rows={3} value={dialog.description} onChange={(e) => setDialog({ ...dialog, description: e.target.value })} data-testid="input-description" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>取消</Button>
              <Button
                data-testid="button-save-plan"
                disabled={upsertMut.isPending}
                onClick={() => dialog && upsertMut.mutate(dialog)}
              >儲存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>確認刪除方案？</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">將刪除方案「{confirmDelete?.name}」。已綁定此方案的合約不會自動處理。</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>取消</Button>
              <Button variant="destructive" onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)} data-testid="button-confirm-delete-plan">刪除</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ParkingShell>
    </ParkingGuard>
  );
}

function Toggle({ label, v, on, testid }: { label: string; v: boolean; on: (v: boolean) => void; testid: string }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 cursor-pointer hover-elevate">
      <span className="text-sm">{label}</span>
      <Switch checked={v} onCheckedChange={on} data-testid={testid} />
    </label>
  );
}

function planToForm(p: ParkingPlan): PlanForm {
  return {
    id: p.id,
    planKey: p.planKey,
    name: p.name,
    planType: p.planType,
    durationMonths: p.durationMonths == null ? "" : String(p.durationMonths),
    price: String(p.price),
    deposit: String(p.deposit),
    guarantee: String(p.guarantee),
    notifyDaysBefore: String(p.notifyDaysBefore),
    requiresContract: p.requiresContract,
    requiresPayment: p.requiresPayment,
    requiresReview: p.requiresReview,
    allowsOnlineRenewal: p.allowsOnlineRenewal,
    isActive: p.isActive,
    displayOrder: String(p.displayOrder),
    description: p.description ?? "",
  };
}

function toPayload(f: PlanForm): Record<string, unknown> {
  return {
    planKey: f.planKey,
    name: f.name,
    planType: f.planType,
    durationMonths: f.durationMonths === "" ? null : Number(f.durationMonths),
    price: Number(f.price || 0),
    deposit: Number(f.deposit || 0),
    guarantee: Number(f.guarantee || 0),
    notifyDaysBefore: Number(f.notifyDaysBefore || 0),
    requiresContract: f.requiresContract,
    requiresPayment: f.requiresPayment,
    requiresReview: f.requiresReview,
    allowsOnlineRenewal: f.allowsOnlineRenewal,
    isActive: f.isActive,
    displayOrder: Number(f.displayOrder || 0),
    description: f.description || null,
  };
}
