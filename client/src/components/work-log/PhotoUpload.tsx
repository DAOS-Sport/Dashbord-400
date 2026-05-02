import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden>{name}</span>;
}

interface PhotoUploadProps {
  value: string[];
  onChange: (next: string[]) => void;
  facilityKey: string;
  folder?: string;
  max?: number;
  disabled?: boolean;
  testIdPrefix?: string;
}

const MAX_DEFAULT = 5;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif";

export function PhotoUpload({
  value,
  onChange,
  facilityKey,
  folder = "work-logs",
  max = MAX_DEFAULT,
  disabled = false,
  testIdPrefix = "photo",
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { toast } = useToast();

  const remaining = Math.max(0, max - value.length);
  const canAdd = !disabled && !uploading && remaining > 0;

  async function uploadOne(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("facilityKey", facilityKey);
    fd.append("folder", folder);
    const res = await fetch("/api/work-logs/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    const data = (await res.json()) as { url?: string };
    if (!data?.url) throw new Error("回應缺少 url");
    return data.url;
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const all = Array.from(files);
    const list = all.slice(0, remaining);
    const skipped = all.length - list.length;
    if (skipped > 0) {
      toast({
        title: `已略過 ${skipped} 張照片`,
        description: `每筆最多 ${max} 張，先上傳前 ${list.length} 張`,
      });
    }
    if (list.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: list.length });
    const next = [...value];
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      try {
        const url = await uploadOne(list[i]);
        next.push(url);
        onChange([...next]);
      } catch (e) {
        failed++;
        console.error("[PhotoUpload] upload failed", e);
        toast({ title: "照片上傳失敗", description: e instanceof Error ? e.message : "未知錯誤", variant: "destructive" });
      } finally {
        setProgress({ done: i + 1, total: list.length });
      }
    }
    setUploading(false);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    if (failed === 0 && list.length > 0) {
      toast({ title: "照片已上傳", description: `共 ${list.length} 張` });
    }
  };

  const handleRemove = (idx: number) => {
    if (disabled) return;
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-upload-root`}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
              data-testid={`${testIdPrefix}-thumb-${i}`}
            >
              <img src={url} alt={`照片 ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/80"
                  aria-label="移除照片"
                  data-testid={`${testIdPrefix}-remove-${i}`}
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-stitch-on-surface text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          data-testid={`${testIdPrefix}-trigger`}
        >
          <MaterialIcon name="photo_camera" className="text-sm" />
          {uploading ? "上傳中…" : value.length > 0 ? "再加一張" : "拍照／選擇照片"}
        </button>
        <span className="text-[11px] text-slate-500">
          {value.length} / {max}
          {progress && ` · ${progress.done}/${progress.total}`}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        capture="environment"
        multiple={remaining > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        data-testid={`${testIdPrefix}-file-input`}
      />
    </div>
  );
}

export default PhotoUpload;
