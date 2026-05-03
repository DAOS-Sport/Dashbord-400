import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
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
import type { ParkingPayment, ParkingContract, ParkingVehicle } from "@shared/schema";
import {
  ParkingShell, ParkingGuard, PlateDisplay, StatusBadge,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_VARIANT,
} from "./_shared";

type ReviewState = { payment: ParkingPayment; action: "approved" | "rejected"; note: string } | null;

export default function ParkingPaymentsPage() {
  const { data: session, isLoading, isError } = useAuthMe();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [review, setReview] = useState<ReviewState>(null);

  const qs = statusFilter !== "__all" ? `?status=${encodeURIComponent(statusFilter)}` : "";
  const listQ = useQuery<{ items: ParkingPayment[] }>({
    queryKey: ["/api/parking/payments", statusFilter],
    queryFn: async () => {
      const r = await fetch(`/api/parking/payments${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const contractsQ = useQuery<{ items: ParkingContract[] }>({
    queryKey: ["/api/parking/contracts", "__all"],
    queryFn: async () => {
      const r = await fetch("/api/parking/contracts?limit=1000", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const vehiclesQ = useQuery<{ items: ParkingVehicle[]; total: number }>({
    queryKey: ["/api/parking/vehicles"],
    queryFn: async () => {
      const r = await fetch("/api/parking/vehicles?limit=500", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const contractMap = useMemo(() => {
    const m = new Map<number, ParkingContract>();
    (contractsQ.data?.items ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [contractsQ.data]);

  const vehicleMap = useMemo(() => {
    const m = new Map<number, ParkingVehicle>();
    (vehiclesQ.data?.items ?? []).forEach((v) => m.set(v.id, v));
    return m;
  }, [vehiclesQ.data]);

  const reviewMut = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: "approved" | "rejected"; note: string }) =>
      (await apiRequest("POST", `/api/parking/payments/${id}/review`, { status, reviewNote: note || null })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parking/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parking/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parking/dashboard"] });
      setReview(null);
      toast({ title: "已完成審核" });
    },
    onError: (e: Error) => toast({ title: "審核失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <ParkingGuard session={session} isLoading={isLoading} isError={isError}>
      <ParkingShell title="付款審核" subtitle="客戶回報轉帳後，主管在此核准或拒絕；核准會自動延長合約與車輛到期日">
        <div className="mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-payment-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">全部</SelectItem>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>回報時間</TableHead>
                <TableHead>合約 / 車牌</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead>後 5 碼</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>備註</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">載入中…</TableCell></TableRow>}
              {!listQ.isLoading && (listQ.data?.items.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8" data-testid="text-payments-empty">沒有符合條件的付款記錄</TableCell></TableRow>
              )}
              {listQ.data?.items.map((p) => {
                const contract = contractMap.get(p.contractId);
                const vehicle = contract ? vehicleMap.get(contract.vehicleId) : undefined;
                return (
                  <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.reportedAt as any).toLocaleString("zh-TW")}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{contract?.contractNumber ?? `合約 #${p.contractId}`}</div>
                      <div className="mt-1">{vehicle ? <PlateDisplay plate={vehicle.licensePlate} size="sm" /> : null}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">NT$ {p.amount.toLocaleString()}</TableCell>
                    <TableCell className="font-mono">{p.transferLast5}</TableCell>
                    <TableCell><StatusBadge value={p.status} labels={PAYMENT_STATUS_LABELS} variants={PAYMENT_STATUS_VARIANT} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{p.reportedNote || (p.reviewNote ? `審核：${p.reviewNote}` : "—")}</TableCell>
                    <TableCell className="text-right">
                      {p.status === "pending" ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" data-testid={`button-approve-${p.id}`} onClick={() => setReview({ payment: p, action: "approved", note: "" })}>
                            <Check className="h-4 w-4 mr-1" /> 核准
                          </Button>
                          <Button size="sm" variant="destructive" data-testid={`button-reject-${p.id}`} onClick={() => setReview({ payment: p, action: "rejected", note: "" })}>
                            <X className="h-4 w-4 mr-1" /> 拒絕
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{p.reviewedByName ?? "—"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{review?.action === "approved" ? "核准付款" : "拒絕付款"}</DialogTitle>
            </DialogHeader>
            {review && (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border border-border p-3 space-y-1 bg-muted/40">
                  <div>金額：<span className="font-bold">NT$ {review.payment.amount.toLocaleString()}</span></div>
                  <div>轉帳後 5 碼：<span className="font-mono">{review.payment.transferLast5}</span></div>
                  {review.payment.reportedNote ? <div className="text-xs text-muted-foreground">客戶備註：{review.payment.reportedNote}</div> : null}
                </div>
                <div>
                  <Label>審核備註</Label>
                  <Textarea value={review.note} onChange={(e) => setReview({ ...review, note: e.target.value })} data-testid="input-review-note" />
                </div>
                {review.action === "approved" && (
                  <p className="text-xs text-muted-foreground">核准後：合約自動轉為「履約中」，並依方案月數延長到期日；同時更新車輛狀態與到期日。</p>
                )}
                {review.action === "rejected" && (
                  <p className="text-xs text-muted-foreground">拒絕後：合約退回「待付款」，客戶可重新回報。</p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReview(null)}>取消</Button>
              <Button
                variant={review?.action === "rejected" ? "destructive" : "default"}
                data-testid="button-confirm-review"
                disabled={reviewMut.isPending || !review}
                onClick={() => review && reviewMut.mutate({ id: review.payment.id, status: review.action, note: review.note })}
              >確認</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ParkingShell>
    </ParkingGuard>
  );
}
