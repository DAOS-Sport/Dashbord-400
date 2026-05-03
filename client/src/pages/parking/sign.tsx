import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useState } from "react";
import { ContractSigningView, type SigningContractData, type SigningSubmitPayload } from "./contract-signing-view";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function ParkingSignPage() {
  const [, params] = useRoute("/parking/sign/:token");
  const token = params?.token ?? "";
  const [done, setDone] = useState(false);

  const q = useQuery<SigningContractData>({
    queryKey: ["/api/parking/sign-tokens", token],
    queryFn: async () => {
      const r = await fetch(`/api/parking/sign-tokens/${token}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || "載入失敗");
      }
      return r.json();
    },
    enabled: !!token,
    retry: false,
  });

  const uploadFile = async (file: File): Promise<string> => {
    const r = await fetch(`/api/parking/sign-tokens/${token}/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, contentType: file.type }),
    });
    if (!r.ok) throw new Error("無法取得上傳連結");
    const { uploadURL, objectPath } = await r.json();
    const put = await fetch(uploadURL, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!put.ok) throw new Error("檔案上傳失敗");
    return objectPath;
  };

  const submit = async (payload: SigningSubmitPayload) => {
    const r = await fetch(`/api/parking/sign-tokens/${token}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.message || "送出失敗");
    }
  };

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">PARKING · 電子簽約</p>
          <h1 className="text-lg font-bold">夢想體育學院新北高中 — 停車場租約</h1>
        </div>
      </header>
      {q.isLoading && (
        <div className="grid place-items-center p-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mb-2" />
          <p>載入簽約資料中…</p>
        </div>
      )}
      {q.isError && (
        <div className="mx-auto max-w-md p-6">
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <p className="text-base font-semibold text-destructive" data-testid="text-sign-error">
                {(q.error as Error).message || "簽約連結無效"}
              </p>
              <p className="text-xs text-muted-foreground">請聯絡櫃台重新發送簽約連結。</p>
            </CardContent>
          </Card>
        </div>
      )}
      {q.data && !done && (
        <ContractSigningView
          data={q.data}
          uploadFile={uploadFile}
          submit={submit}
          onComplete={() => setDone(true)}
        />
      )}
      {done && (
        <div className="mx-auto max-w-md p-6">
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <p className="text-2xl">🎉</p>
              <p className="text-lg font-bold" data-testid="text-sign-done">簽約完成！</p>
              <p className="text-sm text-muted-foreground">
                我們已收到您的簽約資料。如需付款，櫃台會與您聯繫後續流程；如有疑問請來電 02-2855-9883。
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
