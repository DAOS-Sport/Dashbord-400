import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Loader2, MapPin, RefreshCw, UploadCloud } from "lucide-react";
import { Link } from "wouter";

type CaptureModule = "water_quality" | "coach_dive" | "cleanup" | "lost_and_found";

interface PhotoUploadResult {
  photoUrl: string;
  photoKey: string;
  serverAddress: string | null;
  serverReceivedAt: string;
  latitude: number;
  longitude: number;
  clientAddress: string | null;
  clientCaptureTimeIso: string;
}

interface LifeguardCameraCaptureProps {
  module: CaptureModule;
  extraFields?: ReactNode;
  description?: string;
  onSubmitted: (record: PhotoUploadResult) => Promise<void> | void;
}

type GpsState =
  | { status: "loading" }
  | { status: "blocked"; message: string }
  | { status: "ready"; latitude: number; longitude: number; address: string | null };

const formatTaipeiTime = (date: Date) =>
  new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    timeZoneName: "short",
  }).format(date);

const toDms = (value: number, positive: string, negative: string) => {
  const dir = value >= 0 ? positive : negative;
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(3);
  return `${dir} ${degrees}° ${minutes}' ${seconds}"`;
};

const clientReverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("accept-language", "zh-TW");
    const res = await fetch(url, { headers: { "Accept-Language": "zh-TW" }, signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const data = await res.json() as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
};

const watermarkPhoto = async (file: File, gps: Extract<GpsState, { status: "ready" }>): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);
  const now = new Date();
  const fontSize = Math.max(18, Math.round(canvas.width / 40));
  const padding = Math.round(fontSize * 0.45);
  const lines = [
    `網絡: ${formatTaipeiTime(now)}`,
    `本地: ${formatTaipeiTime(now)}`,
    `${toDms(gps.latitude, "N", "S")}, ${toDms(gps.longitude, "E", "W")}`,
    "台灣",
    gps.address ?? "地址解析中",
  ];
  ctx.font = `700 ${fontSize}px sans-serif`;
  const maxWidth = Math.min(canvas.width * 0.76, Math.max(...lines.map((line) => ctx.measureText(line).width)));
  const lineHeight = Math.round(fontSize * 1.32);
  const boxWidth = maxWidth + padding * 2;
  const boxHeight = lines.length * lineHeight + padding * 2;
  const x = canvas.width - boxWidth - padding;
  const y = padding;
  ctx.fillStyle = "rgba(0,0,0,0.56)";
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.fillStyle = "#fff";
  lines.forEach((line, index) => {
    ctx.fillText(line, x + padding, y + padding + lineHeight * (index + 0.78), maxWidth);
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("照片處理失敗")), "image/jpeg", 0.9);
  });
};

function UploadingState({ progress, stage }: { progress: number; stage: string }) {
  return (
    <div className="rounded-[16px] border border-[#dfe7ef] bg-white p-6 text-center shadow-[0_8px_24px_-12px_rgba(13,42,80,0.18)]">
      <Loader2 className="mx-auto h-14 w-14 animate-spin text-[#15935d]" />
      <p className="mt-5 text-[22px] font-black text-[#10233f]">上傳中... {progress}%</p>
      <p className="mt-2 text-[14px] font-bold leading-6 text-[#3d4a5f]">{stage}</p>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#edf3f8]">
        <div className="h-full rounded-full bg-[#15935d] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function SuccessState({ onAnother }: { onAnother: () => void }) {
  return (
    <div className="rounded-[16px] border border-[#c8efdd] bg-white p-6 text-center shadow-[0_8px_24px_-12px_rgba(13,42,80,0.18)]">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e3f7ef] text-[#116247]">
        <CheckCircle2 className="h-9 w-9" />
      </div>
      <p className="mt-5 text-[24px] font-black text-[#10233f]">已完成</p>
      <p className="mt-2 text-[14px] font-bold text-[#3d4a5f]">紀錄已儲存</p>
      <div className="mt-6 grid gap-3">
        <button type="button" onClick={onAnother} className="min-h-[64px] rounded-[12px] bg-[#15935d] px-4 text-[16px] font-black text-white shadow-[0_4px_12px_-2px_rgba(21,147,93,0.35)]">
          新增另一筆
        </button>
        <Link href="/lifeguard" className="grid min-h-[56px] place-items-center rounded-[12px] border border-[#dfe7ef] bg-white px-4 text-[16px] font-black text-[#10233f]">
          回救生首頁
        </Link>
      </div>
    </div>
  );
}

export function LifeguardCameraCapture({ module, extraFields, description, onSubmitted }: LifeguardCameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [gps, setGps] = useState<GpsState>({ status: "loading" });
  const [gpsWaitSeconds, setGpsWaitSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [captureTimeIso, setCaptureTimeIso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("正在處理浮水印");
  const [uploadAttempts, setUploadAttempts] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestGps = () => {
    setGps({ status: "loading" });
    setGpsWaitSeconds(0);
    setError(null);
    if (!navigator.geolocation) {
      setGps({ status: "blocked", message: "此裝置或瀏覽器不支援位置資訊。" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setGps({ status: "ready", latitude, longitude, address: "地址解析中" });
        const address = await clientReverseGeocode(latitude, longitude);
        setGps({ status: "ready", latitude, longitude, address });
      },
      () => setGps({ status: "blocked", message: "無法取得位置資訊，請允許瀏覽器位置權限。" }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    requestGps();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gps.status !== "loading") return undefined;
    const timer = window.setInterval(() => setGpsWaitSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [gps.status]);

  useEffect(() => {
    if (!busy) return undefined;
    setUploadProgress(18);
    setUploadStage("正在上傳照片");
    const timer = window.setInterval(() => {
      setUploadProgress((value) => {
        if (value < 40) {
          setUploadStage("正在上傳照片");
          return value + 9;
        }
        if (value < 72) {
          setUploadStage("正在儲存紀錄");
          return value + 7;
        }
        setUploadStage("正在完成確認");
        return Math.min(value + 3, 94);
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [busy]);

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPhotoBlob(null);
    setCaptureTimeIso(null);
    setError(null);
    setUploadAttempts(0);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || gps.status !== "ready") return;
    setError(null);
    setUploadStage("正在處理浮水印");
    try {
      const blob = await watermarkPhoto(file, gps);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPhotoBlob(blob);
      setCaptureTimeIso(new Date().toISOString());
      setPreviewUrl(URL.createObjectURL(blob));
      setUploadAttempts(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "照片處理失敗");
    }
  };

  const upload = async () => {
    if (!photoBlob || gps.status !== "ready" || !captureTimeIso) return;
    setBusy(true);
    setUploadProgress(12);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", new File([photoBlob], `${module}.jpg`, { type: "image/jpeg" }));
      form.append("metadata", JSON.stringify({
        module,
        latitude: gps.latitude,
        longitude: gps.longitude,
        clientCaptureTimeIso: captureTimeIso,
        clientAddress: gps.address ?? undefined,
        description,
      }));
      const res = await fetch("/api/bff/lifeguard/photo-upload", { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || "上傳失敗");
      setUploadProgress(88);
      setUploadStage("正在儲存紀錄");
      const payload = await res.json() as Omit<PhotoUploadResult, "latitude" | "longitude" | "clientAddress" | "clientCaptureTimeIso">;
      await onSubmitted({
        ...payload,
        latitude: gps.latitude,
        longitude: gps.longitude,
        clientAddress: gps.address,
        clientCaptureTimeIso: captureTimeIso,
      });
      setUploadProgress(100);
      setDone(true);
      setPhotoBlob(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    } catch (err) {
      setUploadAttempts((value) => value + 1);
      setError(err instanceof Error ? err.message : "網路連線不穩，請重試。");
    } finally {
      setBusy(false);
    }
  };

  if (gps.status === "loading") {
    return (
      <div className="rounded-[16px] border border-[#dfe7ef] bg-white p-6 text-center shadow-[0_8px_24px_-12px_rgba(13,42,80,0.18)]">
        <Loader2 className="mx-auto h-16 w-16 animate-spin text-[#15935d]" />
        <p className="mt-6 text-[22px] font-black text-[#10233f]">正在取得位置...</p>
        <p className="mt-3 text-[14px] font-bold leading-6 text-[#3d4a5f]">通常 5-10 秒內完成</p>
        <p className="mt-1 text-[14px] font-bold text-[#637185]">已等待 {gpsWaitSeconds} 秒</p>
        <button type="button" onClick={requestGps} className="mt-6 min-h-[56px] w-full rounded-[12px] border border-[#dfe7ef] bg-white px-4 text-[16px] font-black text-[#10233f]">
          取消重試
        </button>
      </div>
    );
  }

  if (gps.status === "blocked") {
    return (
      <div className="rounded-[16px] border border-[#ffd0d8] bg-white p-6 shadow-[0_8px_24px_-12px_rgba(13,42,80,0.18)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fff1f3] text-[#9f2434]">
          <AlertTriangle className="h-9 w-9" />
        </div>
        <p className="mt-5 text-center text-[24px] font-black text-[#9f2434]">無法取得位置</p>
        <p className="mt-4 text-[15px] font-bold leading-7 text-[#3d4a5f]">此功能必須開啟位置權限。</p>
        <div className="mt-4 rounded-[14px] bg-[#fff6f8] p-4 text-[14px] font-bold leading-7 text-[#3d4a5f]">
          <p>開啟方式：</p>
          <p>iPhone: 設定 → Safari → 位置</p>
          <p>Android: 設定 → 應用 → 權限</p>
          <p className="mt-2 text-[#9f2434]">{gps.message}</p>
        </div>
        <div className="mt-6 grid gap-3">
          <button type="button" onClick={requestGps} className="min-h-[64px] rounded-[12px] bg-[#15935d] px-4 text-[16px] font-black text-white shadow-[0_4px_12px_-2px_rgba(21,147,93,0.35)]">
            重新嘗試
          </button>
          <Link href="/lifeguard" className="grid min-h-[48px] place-items-center text-[15px] font-black text-[#536175]">
            回首頁
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return <SuccessState onAnother={() => { setDone(false); clearPreview(); }} />;
  }

  if (busy) {
    return <UploadingState progress={uploadProgress} stage={uploadStage} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-[#dfe7ef] bg-white p-4 shadow-[0_8px_24px_-12px_rgba(13,42,80,0.18)]">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[#e3f7ef] text-[#007166]"><MapPin className="h-6 w-6" /></span>
          <div className="min-w-0">
            <p className="text-[18px] font-black text-[#10233f]">位置已取得</p>
            <p className="mt-2 break-words text-[14px] font-bold leading-6 text-[#3d4a5f]">{gps.address ?? "地址解析中"}</p>
            <p className="mt-2 font-mono text-[13px] font-black text-[#637185]">{gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}</p>
          </div>
        </div>
      </div>

      {extraFields}

      {!previewUrl ? (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-[16px] bg-[#15935d] text-[20px] font-black text-white shadow-[0_4px_12px_-2px_rgba(21,147,93,0.35)]">
          <Camera className="h-16 w-16" />
          按一下拍照
        </button>
      ) : (
        <div className="space-y-4">
          <img src={previewUrl} alt="浮水印照片預覽" className="max-h-[60vh] w-full rounded-[16px] border border-[#dfe7ef] bg-white object-contain" />
          {error ? (
            <div className="rounded-[16px] border border-[#ffd0d8] bg-[#fff6f8] p-4">
              <p className="flex items-center gap-2 text-[18px] font-black text-[#9f2434]"><AlertTriangle className="h-5 w-5" />上傳失敗</p>
              <p className="mt-2 text-[14px] font-bold leading-6 text-[#3d4a5f]">{error || "網路連線不穩，請重試。"}</p>
              {uploadAttempts >= 3 ? <p className="mt-2 text-[13px] font-black text-[#9f2434]">連續失敗 3 次，請聯絡主管協助。</p> : null}
            </div>
          ) : null}
          <div className="grid gap-3">
            <button type="button" onClick={upload} className="min-h-[64px] rounded-[12px] bg-[#15935d] px-4 text-[16px] font-black text-white shadow-[0_4px_12px_-2px_rgba(21,147,93,0.35)]">
              <UploadCloud className="mr-2 inline h-5 w-5" />{error ? "重新上傳" : "確認上傳"}
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} className="min-h-[56px] rounded-[12px] border border-[#dfe7ef] bg-white px-4 text-[16px] font-black text-[#10233f]">
              <RefreshCw className="mr-2 inline h-5 w-5" />重拍
            </button>
            <button type="button" onClick={clearPreview} className="min-h-[48px] text-center text-[15px] font-black text-[#536175]">
              <ArrowLeft className="mr-2 inline h-4 w-4" />取消
            </button>
          </div>
        </div>
      )}

      {error && !previewUrl ? <div className="rounded-[12px] bg-[#fff1f3] p-3 text-[13px] font-black text-[#9f2434]">{error}</div> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
