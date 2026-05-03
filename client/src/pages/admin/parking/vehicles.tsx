import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuthMe } from "@/shared/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ParkingVehicle } from "@shared/schema";
import {
  ParkingShell, ParkingGuard, PlateDisplay, StatusBadge,
  PLAN_TYPE_LABELS, VEHICLE_STATUS_LABELS, VEHICLE_STATUS_VARIANT,
} from "./_shared";

interface FormState {
  id?: number;
  licensePlate: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  vehicleType: string;
  status: string;
  expiresAt: string;
  note: string;
}

const EMPTY: FormState = {
  licensePlate: "",
  ownerName: "",
  ownerPhone: "",
  ownerEmail: "",
  vehicleType: "monthly",
  status: "active",
  expiresAt: "",
  note: "",
};

function normalizePlate(s: string): string {
  return s.toUpperCase().replace(/[\s-]+/g, "");
}

export default function ParkingVehiclesPage() {
  const { data: session, isLoading: sessLoading, isError: sessError } = useAuthMe();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("__all");
  const [status, setStatus] = useState<string>("__all");
  const [dialog, setDialog] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ParkingVehicle | null>(null);

  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (vehicleType !== "__all") params.set("vehicleType", vehicleType);
  if (status !== "__all") params.set("status", status);
  const qs = params.toString();

  const listQ = useQuery<{ items: ParkingVehicle[]; total: number }>({
    queryKey: ["/api/parking/vehicles", qs],
    queryFn: async () => {
      const r = await fetch(`/api/parking/vehicles${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: FormState) => (await apiRequest("POST", "/api/parking/vehicles", buildPayload(input))).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/vehicles"] });
      setDialog(null);
      toast({ title: "已新增車輛" });
    },
    onError: (e: Error) => toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async (input: FormState) => {
      // licensePlate is the natural key — server doesn't allow patching it.
      const { id, licensePlate: _ignored, ...rest } = input;
      void _ignored;
      return (await apiRequest("PATCH", `/api/parking/vehicles/${id}`, buildPayload({ ...rest, licensePlate: "" }, true))).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/vehicles"] });
      setDialog(null);
      toast({ title: "已更新車輛" });
    },
    onError: (e: Error) => toast({ title: "更新失敗", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/parking/vehicles/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/vehicles"] });
      setConfirmDelete(null);
      toast({ title: "已刪除車輛" });
    },
    onError: (e: Error) => toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <ParkingGuard session={session} isLoading={sessLoading} isError={sessError}>
      <ParkingShell
        title="車輛管理"
        subtitle="所有以車牌為鍵的車輛資料"
        headerExtra={
          <Button data-testid="button-new-vehicle" onClick={() => setDialog({ ...EMPTY })}>
            <Plus className="h-4 w-4 mr-1" /> 新增車輛
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            placeholder="搜尋車牌 / 車主 / 電話"
            className="w-[260px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-vehicle-search"
          />
          <Select value={vehicleType} onValueChange={setVehicleType}>
            <SelectTrigger className="w-[160px]" data-testid="select-vehicle-type-filter"><SelectValue placeholder="車輛分類" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">全部分類</SelectItem>
              {Object.entries(PLAN_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]" data-testid="select-vehicle-status-filter"><SelectValue placeholder="狀態" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">全部狀態</SelectItem>
              {Object.entries(VEHICLE_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>車牌</TableHead>
                <TableHead>車主</TableHead>
                <TableHead>聯絡電話</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>到期日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">載入中…</TableCell></TableRow>}
              {!listQ.isLoading && (listQ.data?.items.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8" data-testid="text-vehicles-empty">尚無資料</TableCell></TableRow>
              )}
              {listQ.data?.items.map((v) => (
                <TableRow key={v.id} data-testid={`row-vehicle-${v.id}`}>
                  <TableCell><PlateDisplay plate={v.licensePlate} /></TableCell>
                  <TableCell className="font-medium">{v.ownerName}</TableCell>
                  <TableCell className="text-muted-foreground">{v.ownerPhone || "—"}</TableCell>
                  <TableCell>{PLAN_TYPE_LABELS[v.vehicleType] ?? v.vehicleType}</TableCell>
                  <TableCell><StatusBadge value={v.status} labels={VEHICLE_STATUS_LABELS} variants={VEHICLE_STATUS_VARIANT} /></TableCell>
                  <TableCell className="font-mono text-xs">{v.expiresAt || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" data-testid={`button-edit-vehicle-${v.id}`} onClick={() => setDialog({
                      id: v.id,
                      licensePlate: v.licensePlate,
                      ownerName: v.ownerName,
                      ownerPhone: v.ownerPhone ?? "",
                      ownerEmail: v.ownerEmail ?? "",
                      vehicleType: v.vehicleType,
                      status: v.status,
                      expiresAt: v.expiresAt ?? "",
                      note: v.note ?? "",
                    })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" data-testid={`button-delete-vehicle-${v.id}`} onClick={() => setConfirmDelete(v)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{dialog?.id ? "編輯車輛" : "新增車輛"}</DialogTitle></DialogHeader>
            {dialog && (
              <div className="grid gap-3">
                <div>
                  <Label>車牌（自動轉大寫、去連字號）</Label>
                  <Input
                    value={dialog.licensePlate}
                    disabled={!!dialog.id}
                    onChange={(e) => setDialog({ ...dialog, licensePlate: normalizePlate(e.target.value) })}
                    data-testid="input-plate"
                    placeholder="ABC1234"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>車主姓名</Label>
                    <Input value={dialog.ownerName} onChange={(e) => setDialog({ ...dialog, ownerName: e.target.value })} data-testid="input-owner-name" />
                  </div>
                  <div>
                    <Label>聯絡電話</Label>
                    <Input value={dialog.ownerPhone} onChange={(e) => setDialog({ ...dialog, ownerPhone: e.target.value })} data-testid="input-owner-phone" />
                  </div>
                </div>
                <div>
                  <Label>Email（選填）</Label>
                  <Input type="email" value={dialog.ownerEmail} onChange={(e) => setDialog({ ...dialog, ownerEmail: e.target.value })} data-testid="input-owner-email" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>車輛分類</Label>
                    <Select value={dialog.vehicleType} onValueChange={(v) => setDialog({ ...dialog, vehicleType: v })}>
                      <SelectTrigger data-testid="select-vehicle-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PLAN_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>狀態</Label>
                    <Select value={dialog.status} onValueChange={(v) => setDialog({ ...dialog, status: v })}>
                      <SelectTrigger data-testid="select-vehicle-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(VEHICLE_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>到期日（YYYY-MM-DD，選填）</Label>
                  <Input value={dialog.expiresAt} onChange={(e) => setDialog({ ...dialog, expiresAt: e.target.value })} placeholder="2026-12-31" data-testid="input-expires-at" />
                </div>
                <div>
                  <Label>備註</Label>
                  <Textarea value={dialog.note} onChange={(e) => setDialog({ ...dialog, note: e.target.value })} data-testid="input-note" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} data-testid="button-cancel">取消</Button>
              <Button
                data-testid="button-save-vehicle"
                disabled={createMut.isPending || updateMut.isPending}
                onClick={() => {
                  if (!dialog) return;
                  if (dialog.id) updateMut.mutate(dialog);
                  else createMut.mutate(dialog);
                }}
              >
                {dialog?.id ? "儲存" : "建立"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>確認刪除？</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">將刪除車牌 <span className="font-mono font-bold">{confirmDelete?.licensePlate}</span>。此動作無法復原。</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)} data-testid="button-cancel-delete">取消</Button>
              <Button variant="destructive" onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)} data-testid="button-confirm-delete">刪除</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ParkingShell>
    </ParkingGuard>
  );
}

function buildPayload(s: FormState, isUpdate = false): Record<string, unknown> {
  const p: Record<string, unknown> = {
    ownerName: s.ownerName,
    ownerPhone: s.ownerPhone || null,
    ownerEmail: s.ownerEmail || null,
    vehicleType: s.vehicleType,
    status: s.status,
    expiresAt: s.expiresAt || null,
    note: s.note || null,
  };
  if (!isUpdate) p.licensePlate = s.licensePlate;
  return p;
}
