import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, FileText, Link as LinkIcon, PenLine, Copy } from "lucide-react";
import { useAuthMe } from "@/shared/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ParkingContract, ParkingPlan, ParkingVehicle } from "@shared/schema";
import { ContractSigningView, type SigningContractData, type SigningSubmitPayload } from "@/pages/parking/contract-signing-view";
import { PARKING_TERMS_VERSION, PARKING_TERMS_TITLE, PARKING_TERMS_PARTIES, PARKING_TERMS_SECTIONS } from "@shared/parking-terms";
import {
  ParkingShell, ParkingGuard, PlateDisplay, StatusBadge,
  CONTRACT_STATUS_LABELS, CONTRACT_STATUS_VARIANT,
} from "./_shared";

interface NewForm {
  vehicleId: string;
  planId: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
  depositAmount: string;
  status: string;
  note: string;
}

const NEW_EMPTY: NewForm = {
  vehicleId: "",
  planId: "",
  startDate: "",
  endDate: "",
  totalAmount: "0",
  depositAmount: "0",
  status: "draft",
  note: "",
};

export default function ParkingContractsPage() {
  const { data: session, isLoading, isError } = useAuthMe();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("__all");
  const [creating, setCreating] = useState<NewForm | null>(null);
  const [openDetail, setOpenDetail] = useState<ParkingContract | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("0");
  const [inPersonSign, setInPersonSign] = useState<ParkingContract | null>(null);
  const [issuedLink, setIssuedLink] = useState<{ url: string; expiresAt: string } | null>(null);

  const qs = statusFilter !== "__all" ? `?status=${encodeURIComponent(statusFilter)}` : "";
  const listQ = useQuery<{ items: ParkingContract[] }>({
    queryKey: ["/api/parking/contracts", statusFilter],
    queryFn: async () => {
      const r = await fetch(`/api/parking/contracts${qs}`, { credentials: "include" });
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

  const plansQ = useQuery<{ items: ParkingPlan[] }>({
    queryKey: ["/api/parking/plans"],
    queryFn: async () => {
      const r = await fetch("/api/parking/plans", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const vehicleMap = useMemo(() => {
    const m = new Map<number, ParkingVehicle>();
    (vehiclesQ.data?.items ?? []).forEach((v) => m.set(v.id, v));
    return m;
  }, [vehiclesQ.data]);

  const planMap = useMemo(() => {
    const m = new Map<number, ParkingPlan>();
    (plansQ.data?.items ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [plansQ.data]);

  const createMut = useMutation({
    mutationFn: async (input: NewForm) => (await apiRequest("POST", "/api/parking/contracts", {
      vehicleId: Number(input.vehicleId),
      planId: Number(input.planId),
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      totalAmount: Number(input.totalAmount || 0),
      depositAmount: Number(input.depositAmount || 0),
      status: input.status || "draft",
      note: input.note || null,
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parking/dashboard"] });
      setCreating(null);
      toast({ title: "已建立合約" });
    },
    onError: (e: Error) => toast({ title: "建立失敗", description: e.message, variant: "destructive" }),
  });

  const issueLinkMut = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("POST", `/api/parking/contracts/${id}/issue-sign-link`, {})).json(),
    onSuccess: (data: { token: string; url: string; expiresAt: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/contracts"] });
      const fullUrl = `${window.location.origin}${data.url}`;
      setIssuedLink({ url: fullUrl, expiresAt: data.expiresAt });
    },
    onError: (e: Error) => toast({ title: "產生簽約連結失敗", description: e.message, variant: "destructive" }),
  });

  const terminateMut = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/parking/contracts/${id}/terminate`, {})).json(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parking/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parking/dashboard"] });
      setOpenDetail(data);
      toast({ title: "合約已終止" });
    },
    onError: (e: Error) => toast({ title: "終止失敗", description: e.message, variant: "destructive" }),
  });

  const refundMut = useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: number }) => (await apiRequest("POST", `/api/parking/contracts/${id}/refund`, { refundAmount: amount })).json(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parking/dashboard"] });
      setOpenDetail(data);
      setRefundOpen(false);
      toast({ title: "已記錄退款" });
    },
    onError: (e: Error) => toast({ title: "退款失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <ParkingGuard session={session} isLoading={isLoading} isError={isError}>
      <ParkingShell
        title="租約管理"
        subtitle="建立、簽約、終止與退款"
        headerExtra={
          <Button data-testid="button-new-contract" onClick={() => setCreating({ ...NEW_EMPTY })}>
            <Plus className="h-4 w-4 mr-1" /> 新增合約
          </Button>
        }
      >
        <div className="mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">全部狀態</SelectItem>
              {Object.entries(CONTRACT_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>合約編號</TableHead>
                <TableHead>車牌</TableHead>
                <TableHead>方案</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>起迄</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">載入中…</TableCell></TableRow>}
              {!listQ.isLoading && (listQ.data?.items.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8" data-testid="text-contracts-empty">尚未建立合約</TableCell></TableRow>
              )}
              {listQ.data?.items.map((c) => {
                const v = vehicleMap.get(c.vehicleId);
                const p = planMap.get(c.planId);
                return (
                  <TableRow key={c.id} data-testid={`row-contract-${c.id}`}>
                    <TableCell className="font-mono text-xs">{c.contractNumber}</TableCell>
                    <TableCell>{v ? <PlateDisplay plate={v.licensePlate} size="sm" /> : <span className="text-muted-foreground">#{c.vehicleId}</span>}</TableCell>
                    <TableCell>{p?.name ?? `#${c.planId}`}</TableCell>
                    <TableCell><StatusBadge value={c.status} labels={CONTRACT_STATUS_LABELS} variants={CONTRACT_STATUS_VARIANT} /></TableCell>
                    <TableCell className="font-mono text-xs">{c.startDate || "—"} ~ {c.endDate || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" data-testid={`button-detail-contract-${c.id}`} onClick={() => setOpenDetail(c)}>詳情</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Create dialog */}
        <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>新增合約</DialogTitle></DialogHeader>
            {creating && (
              <div className="grid gap-3">
                <div>
                  <Label>車輛</Label>
                  <Select value={creating.vehicleId} onValueChange={(v) => setCreating({ ...creating, vehicleId: v })}>
                    <SelectTrigger data-testid="select-vehicle"><SelectValue placeholder="選擇車輛" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {(vehiclesQ.data?.items ?? []).map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>{v.licensePlate} · {v.ownerName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>方案</Label>
                  <Select value={creating.planId} onValueChange={(v) => {
                    const plan = planMap.get(Number(v));
                    setCreating({
                      ...creating,
                      planId: v,
                      totalAmount: plan ? String(plan.price) : creating.totalAmount,
                      depositAmount: plan ? String(plan.deposit) : creating.depositAmount,
                    });
                  }}>
                    <SelectTrigger data-testid="select-plan"><SelectValue placeholder="選擇方案" /></SelectTrigger>
                    <SelectContent>
                      {(plansQ.data?.items ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}（{p.price.toLocaleString()} 元）</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>起始日</Label>
                    <Input value={creating.startDate} onChange={(e) => setCreating({ ...creating, startDate: e.target.value })} placeholder="2026-05-01" data-testid="input-start-date" />
                  </div>
                  <div>
                    <Label>到期日</Label>
                    <Input value={creating.endDate} onChange={(e) => setCreating({ ...creating, endDate: e.target.value })} placeholder="2027-04-30" data-testid="input-end-date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>合約金額</Label>
                    <Input type="number" value={creating.totalAmount} onChange={(e) => setCreating({ ...creating, totalAmount: e.target.value })} data-testid="input-total-amount" />
                  </div>
                  <div>
                    <Label>押金</Label>
                    <Input type="number" value={creating.depositAmount} onChange={(e) => setCreating({ ...creating, depositAmount: e.target.value })} data-testid="input-deposit-amount" />
                  </div>
                </div>
                <div>
                  <Label>初始狀態</Label>
                  <Select value={creating.status} onValueChange={(v) => setCreating({ ...creating, status: v })}>
                    <SelectTrigger data-testid="select-initial-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">草稿</SelectItem>
                      <SelectItem value="awaiting_sign">待簽約</SelectItem>
                      <SelectItem value="awaiting_payment">待付款</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>備註</Label>
                  <Textarea value={creating.note} onChange={(e) => setCreating({ ...creating, note: e.target.value })} data-testid="input-contract-note" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreating(null)}>取消</Button>
              <Button
                data-testid="button-save-contract"
                disabled={createMut.isPending || !creating?.vehicleId || !creating?.planId}
                onClick={() => creating && createMut.mutate(creating)}
              >建立</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail sheet */}
        <Sheet open={!!openDetail} onOpenChange={(o) => !o && setOpenDetail(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> 合約詳情</SheetTitle>
            </SheetHeader>
            {openDetail && (
              <div className="mt-4 space-y-4 text-sm">
                <DetailRow label="合約編號" value={<span className="font-mono">{openDetail.contractNumber}</span>} />
                <DetailRow label="狀態" value={<StatusBadge value={openDetail.status} labels={CONTRACT_STATUS_LABELS} variants={CONTRACT_STATUS_VARIANT} />} />
                <DetailRow label="車輛" value={vehicleMap.get(openDetail.vehicleId) ? <PlateDisplay plate={vehicleMap.get(openDetail.vehicleId)!.licensePlate} size="sm" /> : `#${openDetail.vehicleId}`} />
                <DetailRow label="方案" value={planMap.get(openDetail.planId)?.name ?? `#${openDetail.planId}`} />
                <DetailRow label="起迄" value={`${openDetail.startDate || "—"} ~ ${openDetail.endDate || "—"}`} />
                <DetailRow label="合約金額" value={`NT$ ${openDetail.totalAmount.toLocaleString()}`} />
                <DetailRow label="押金" value={`NT$ ${openDetail.depositAmount.toLocaleString()}`} />
                {openDetail.signedAt ? <DetailRow label="簽約時間" value={new Date(openDetail.signedAt as any).toLocaleString("zh-TW")} /> : null}
                {openDetail.terminatedAt ? <DetailRow label="終止時間" value={new Date(openDetail.terminatedAt as any).toLocaleString("zh-TW")} /> : null}
                {openDetail.refundedAt ? <DetailRow label="退款時間" value={`${new Date(openDetail.refundedAt as any).toLocaleString("zh-TW")} (NT$ ${(openDetail.refundAmount ?? 0).toLocaleString()})`} /> : null}
                {openDetail.note ? <DetailRow label="備註" value={openDetail.note} /> : null}

                {/* Phase 2: signed evidence — show photos + signature once captured */}
                {(openDetail.signatureImageUrl || openDetail.vehicleRegPhotoUrl) && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">簽約證明</p>
                    {openDetail.signerName && (
                      <DetailRow label="簽署人" value={`${openDetail.signerName}${openDetail.signerIdLast4 ? ` · 身分證末 4 碼 ${openDetail.signerIdLast4}` : ""}`} />
                    )}
                    {openDetail.termsVersion && <DetailRow label="條款版本" value={openDetail.termsVersion} />}
                    {openDetail.signatureImageUrl && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">簽名</p>
                        <img src={openDetail.signatureImageUrl} alt="signature" className="rounded border border-border bg-white max-h-24" data-testid="img-signature" />
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {openDetail.vehicleRegPhotoUrl && <PhotoThumb label="行照" url={openDetail.vehicleRegPhotoUrl} testid="img-vehicle-reg" />}
                      {openDetail.driverLicensePhotoUrl && <PhotoThumb label="駕照" url={openDetail.driverLicensePhotoUrl} testid="img-driver-license" />}
                      {openDetail.idCardPhotoUrl && <PhotoThumb label="身分證" url={openDetail.idCardPhotoUrl} testid="img-id-card" />}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">狀態操作</p>
                  <div className="flex flex-wrap gap-2">
                    {(openDetail.status === "draft" || openDetail.status === "awaiting_sign") && (
                      <>
                        <Button size="sm" data-testid="button-open-in-person-sign" onClick={() => setInPersonSign(openDetail)}>
                          <PenLine className="h-3.5 w-3.5 mr-1" /> 開啟簽約（現場）
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="button-issue-sign-link"
                          disabled={issueLinkMut.isPending}
                          onClick={() => issueLinkMut.mutate(openDetail.id)}
                        >
                          <LinkIcon className="h-3.5 w-3.5 mr-1" /> 產生簽約連結
                        </Button>
                      </>
                    )}
                    {!["terminated", "refunded"].includes(openDetail.status) && (
                      <Button size="sm" variant="destructive" data-testid="button-terminate-contract" disabled={terminateMut.isPending} onClick={() => terminateMut.mutate(openDetail.id)}>
                        終止合約
                      </Button>
                    )}
                    {openDetail.status !== "refunded" && (
                      <Button size="sm" variant="outline" data-testid="button-refund-contract" onClick={() => { setRefundAmount(String(openDetail.depositAmount)); setRefundOpen(true); }}>
                        申請退款
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-2">注意：簽約後若方案需付款，狀態會轉為「待付款」；客戶回報付款並由主管核准後才會變為「履約中」。</p>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>記錄退款</DialogTitle></DialogHeader>
            <div className="grid gap-2">
              <Label>退款金額（NT$）</Label>
              <Input type="number" min="0" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} data-testid="input-refund-amount" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOpen(false)}>取消</Button>
              <Button
                variant="destructive"
                data-testid="button-confirm-refund"
                disabled={refundMut.isPending || !openDetail}
                onClick={() => openDetail && refundMut.mutate({ id: openDetail.id, amount: Number(refundAmount || 0) })}
              >確認退款</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* In-person signing dialog (full-screen) */}
        <Dialog open={!!inPersonSign} onOpenChange={(o) => !o && setInPersonSign(null)}>
          <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto p-0">
            <DialogHeader className="sticky top-0 z-10 bg-background border-b border-border px-4 py-2">
              <DialogTitle>現場簽約 · {inPersonSign?.contractNumber}</DialogTitle>
            </DialogHeader>
            {inPersonSign && (
              <InPersonSigningPanel
                contract={inPersonSign}
                vehicle={vehicleMap.get(inPersonSign.vehicleId) ?? null}
                plan={planMap.get(inPersonSign.planId) ?? null}
                onDone={(updated) => {
                  setInPersonSign(null);
                  setOpenDetail(updated);
                  queryClient.invalidateQueries({ queryKey: ["/api/parking/contracts"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/parking/dashboard"] });
                  toast({ title: "現場簽約完成" });
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Issued link share dialog */}
        <Dialog open={!!issuedLink} onOpenChange={(o) => !o && setIssuedLink(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>簽約連結已產生</DialogTitle></DialogHeader>
            {issuedLink && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  將下列連結傳送給客戶（SMS / LINE / Email 皆可），客戶於行動裝置完成簽約即可。
                  此連結可使用至 {new Date(issuedLink.expiresAt).toLocaleString("zh-TW")}。
                </p>
                <div className="flex items-center gap-2">
                  <Input value={issuedLink.url} readOnly className="font-mono text-xs" data-testid="input-issued-link" />
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="button-copy-link"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(issuedLink.url); toast({ title: "連結已複製" }); }
                      catch { toast({ title: "複製失敗，請手動選取", variant: "destructive" }); }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> 複製
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIssuedLink(null)}>關閉</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </ParkingShell>
    </ParkingGuard>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function PhotoThumb({ label, url, testid }: { label: string; url: string; testid: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <img src={url} alt={label} className="h-20 w-full object-cover rounded border border-border" data-testid={testid} />
    </a>
  );
}

// In-person signing panel — admin opens on tablet, hands to customer.
// Reuses the same ContractSigningView as the public route but talks to the
// supervisor-only endpoints with cookie auth. Vehicle/plan are passed in from
// the parent (already loaded), so no extra fetches are needed.
function InPersonSigningPanel({ contract, vehicle, plan, onDone }: {
  contract: ParkingContract;
  vehicle: ParkingVehicle | null;
  plan: ParkingPlan | null;
  onDone: (updated: ParkingContract) => void;
}) {
  const data: SigningContractData = {
    contract: {
      id: contract.id,
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      endDate: contract.endDate,
      totalAmount: contract.totalAmount,
      depositAmount: contract.depositAmount,
    },
    vehicle: vehicle ? { licensePlate: vehicle.licensePlate, ownerName: vehicle.ownerName, ownerPhone: vehicle.ownerPhone } : null,
    plan: plan ? { name: plan.name, planType: plan.planType, durationMonths: plan.durationMonths, price: plan.price, deposit: plan.deposit } : null,
    terms: {
      version: PARKING_TERMS_VERSION,
      title: PARKING_TERMS_TITLE,
      parties: PARKING_TERMS_PARTIES,
      sections: PARKING_TERMS_SECTIONS,
    },
  };

  const uploadFile = async (file: File): Promise<string> => {
    const r = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
    });
    if (!r.ok) throw new Error("無法取得上傳連結");
    const { uploadURL, objectPath } = await r.json();
    const put = await fetch(uploadURL, {
      method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!put.ok) throw new Error("檔案上傳失敗");
    return objectPath;
  };

  const submit = async (payload: SigningSubmitPayload) => {
    const r = await fetch(`/api/parking/contracts/${contract.id}/sign`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.message || "送出失敗");
    }
    const result = await r.json();
    onDone(result.contract ?? result);
  };

  return (
    <ContractSigningView
      data={data}
      uploadFile={uploadFile}
      submit={submit}
      headline="現場簽約 — 請承租人於本平板簽署"
    />
  );
}
