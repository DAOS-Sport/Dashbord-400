import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Camera, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface SigningTermsData {
  version: string;
  title: string;
  parties: string;
  sections: { heading: string; body: string[] }[];
}

export interface SigningContractData {
  contract: {
    id: number;
    contractNumber: string;
    startDate: string | null;
    endDate: string | null;
    totalAmount: number;
    depositAmount: number;
  };
  vehicle?: { licensePlate: string; ownerName: string; ownerPhone: string | null } | null;
  plan?: { name: string; planType: string; durationMonths: number | null; price: number; deposit: number } | null;
  terms: SigningTermsData;
}

export interface SigningSubmitPayload {
  signatureImageUrl: string;
  signerName: string;
  signerIdLast4: string | null;
  vehicleRegPhotoUrl: string;
  driverLicensePhotoUrl: string;
  idCardPhotoUrl: string | null;
  agreedTermsVersion: string;
}

interface Props {
  data: SigningContractData;
  /** Returns the final object path (e.g. /objects/uploads/abc) for the uploaded file. */
  uploadFile: (file: File) => Promise<string>;
  /** Submit the finalize payload. Should throw on error. */
  submit: (payload: SigningSubmitPayload) => Promise<void>;
  /** Called once submission succeeded. */
  onComplete?: () => void;
  /** Pre-fill signer name (e.g. for in-person mode using vehicle owner). */
  defaultSignerName?: string;
  /** Title shown at the top — varies between in-person and remote. */
  headline?: string;
}

export function ContractSigningView({
  data, uploadFile, submit, onComplete, defaultSignerName, headline,
}: Props) {
  const { toast } = useToast();
  const [signerName, setSignerName] = useState(defaultSignerName || data.vehicle?.ownerName || "");
  const [signerIdLast4, setSignerIdLast4] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null);
  const [idCardPhoto, setIdCardPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const termsScrollRef = useRef<HTMLDivElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigEmptyRef = useRef(true);
  const sigDrawingRef = useRef(false);

  // Detect scrolled-to-bottom on terms.
  useEffect(() => {
    const el = termsScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setScrolledToEnd(true);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Setup signature pad on canvas.
  useEffect(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.floor(cssW * ratio);
    canvas.height = Math.floor(cssH * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    const getXY = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      sigDrawingRef.current = true;
      sigEmptyRef.current = false;
      const { x, y } = getXY(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!sigDrawingRef.current) return;
      const { x, y } = getXY(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const onUp = (e: PointerEvent) => {
      sigDrawingRef.current = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    sigEmptyRef.current = true;
  };

  const canSubmit = useMemo(() => {
    return (
      !!signerName.trim() &&
      agreed && scrolledToEnd &&
      !!vehiclePhoto && !!licensePhoto &&
      !sigEmptyRef.current &&
      !submitting
    );
  }, [signerName, agreed, scrolledToEnd, vehiclePhoto, licensePhoto, submitting]);

  const handleSubmit = async () => {
    if (sigEmptyRef.current) {
      toast({ title: "請先簽名", variant: "destructive" });
      return;
    }
    if (!vehiclePhoto || !licensePhoto) {
      toast({ title: "請上傳行照與駕照照片", variant: "destructive" });
      return;
    }
    if (signerIdLast4 && !/^\d{4}$/.test(signerIdLast4)) {
      toast({ title: "身分證後 4 碼格式錯誤", variant: "destructive" });
      return;
    }
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    setSubmitting(true);
    try {
      const signatureImageUrl = canvas.toDataURL("image/png");
      await submit({
        signatureImageUrl,
        signerName: signerName.trim(),
        signerIdLast4: signerIdLast4 || null,
        vehicleRegPhotoUrl: vehiclePhoto,
        driverLicensePhotoUrl: licensePhoto,
        idCardPhotoUrl: idCardPhoto,
        agreedTermsVersion: data.terms.version,
      });
      toast({ title: "簽約完成，謝謝！" });
      onComplete?.();
    } catch (e) {
      toast({ title: "簽約送出失敗", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-24" data-testid="view-contract-signing">
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg" data-testid="text-signing-headline">
            {headline ?? "停車場租賃契約 — 電子簽署"}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-mono">
            合約編號：{data.contract.contractNumber} · 條款版本：{data.terms.version}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Info label="承租人" value={data.vehicle?.ownerName ?? "—"} />
          <Info label="連絡電話" value={data.vehicle?.ownerPhone ?? "—"} />
          <Info label="車牌號碼" value={data.vehicle?.licensePlate ?? "—"} mono />
          <Info label="租賃方案" value={data.plan?.name ?? "—"} />
          <Info label="起迄日期" value={`${data.contract.startDate || "—"} ~ ${data.contract.endDate || "—"}`} />
          <Info
            label="費用 / 押金"
            value={`NT$ ${data.contract.totalAmount.toLocaleString()} / ${data.contract.depositAmount.toLocaleString()}`}
          />
        </CardContent>
      </Card>

      {/* Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">租賃條款（{data.terms.title}）</CardTitle>
          <p className="text-xs text-muted-foreground whitespace-pre-line">{data.terms.parties}</p>
        </CardHeader>
        <CardContent>
          <div
            ref={termsScrollRef}
            className="h-72 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-[13px] leading-relaxed space-y-3"
            data-testid="scroll-terms"
          >
            {data.terms.sections.map((s) => (
              <div key={s.heading} className="space-y-1">
                <p className="font-semibold text-foreground">{s.heading}</p>
                {s.body.map((p, i) => (
                  <p key={i} className="text-foreground/80 whitespace-pre-line">{p}</p>
                ))}
              </div>
            ))}
            <p className="pt-2 text-center text-[11px] text-muted-foreground" data-testid="text-terms-end">
              — 條款結束 —
            </p>
          </div>
          <label className="mt-3 flex items-start gap-2">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              disabled={!scrolledToEnd}
              data-testid="checkbox-agree-terms"
            />
            <span className={cn("text-sm", !scrolledToEnd && "text-muted-foreground")}>
              我已詳閱並同意上述條款（請先捲動至底部閱讀完）
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Photo uploads */}
      <Card>
        <CardHeader><CardTitle className="text-base">證件上傳</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <PhotoSlot label="行照（必填）" required value={vehiclePhoto} onChange={setVehiclePhoto} uploadFile={uploadFile} testid="vehicle-reg" />
          <PhotoSlot label="駕照（必填）" required value={licensePhoto} onChange={setLicensePhoto} uploadFile={uploadFile} testid="driver-license" />
          <PhotoSlot label="身分證（選填）" value={idCardPhoto} onChange={setIdCardPhoto} uploadFile={uploadFile} testid="id-card" />
        </CardContent>
      </Card>

      {/* Signer info + signature */}
      <Card>
        <CardHeader><CardTitle className="text-base">簽署人資訊與簽名</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="signer-name">簽署人姓名</Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="請輸入您的姓名"
                data-testid="input-signer-name"
              />
            </div>
            <div>
              <Label htmlFor="signer-id-last4">身分證末 4 碼（選填）</Label>
              <Input
                id="signer-id-last4"
                inputMode="numeric"
                maxLength={4}
                value={signerIdLast4}
                onChange={(e) => setSignerIdLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                data-testid="input-signer-id-last4"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>請於下方簽名</Label>
              <Button type="button" variant="outline" size="sm" onClick={clearSignature} data-testid="button-clear-signature">
                <X className="h-3.5 w-3.5 mr-1" /> 清除
              </Button>
            </div>
            <canvas
              ref={sigCanvasRef}
              className="block w-full h-48 touch-none rounded-md border-2 border-dashed border-border bg-white"
              data-testid="canvas-signature"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">使用滑鼠或手指於框內簽名。</p>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 left-0 right-0 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {agreed && scrolledToEnd ? "✓ 已同意條款" : "請完成條款閱讀並勾選同意"}
          </p>
          <Button
            size="lg"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="button-submit-signing"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            送出簽約
          </Button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold", mono && "font-mono")} data-testid={`text-info-${label}`}>{value}</p>
    </div>
  );
}

function PhotoSlot({
  label, required, value, onChange, uploadFile, testid,
}: {
  label: string;
  required?: boolean;
  value: string | null;
  onChange: (path: string | null) => void;
  uploadFile: (file: File) => Promise<string>;
  testid: string;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "檔案過大", description: "限 10MB 以內", variant: "destructive" });
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setBusy(true);
    try {
      const path = await uploadFile(file);
      onChange(path);
    } catch (e) {
      toast({ title: "上傳失敗", description: (e as Error).message, variant: "destructive" });
      setPreviewUrl(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        data-testid={`button-upload-${testid}`}
        className={cn(
          "flex h-32 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/20",
          "hover-elevate active-elevate-2 transition",
          value ? "border-solid border-primary/40" : "",
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="h-full w-full object-cover" data-testid={`img-preview-${testid}`} />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {busy ? "上傳中…" : "點擊拍照／選擇檔案"}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
        data-testid={`input-file-${testid}`}
      />
      {value && <p className="text-[10px] font-mono text-muted-foreground truncate">{value}</p>}
    </div>
  );
}
