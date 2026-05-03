import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Upload, FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export interface CsvColumn {
  key: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "intArray";
  hint?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  endpoint: string;
  invalidateQueryKey: unknown[];
  facilityKey: string;
  moduleType: "lifeguard" | "counter";
  columns: CsvColumn[];
  templateRows: Record<string, string>[];
}

interface BulkResult {
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; message: string }>;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const t = text.replace(/^\uFEFF/, "");
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && t[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some((x) => x.length > 0)) lines.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); if (cur.some((x) => x.length > 0)) lines.push(cur); }
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map((h) => h.trim());
  return { headers, rows: lines.slice(1) };
}

function coerceValue(raw: string, type: CsvColumn["type"]): unknown {
  const v = raw.trim();
  if (v === "") return undefined;
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  if (type === "boolean") {
    const lo = v.toLowerCase();
    if (["true", "1", "yes", "y", "是", "t"].includes(lo)) return true;
    if (["false", "0", "no", "n", "否", "f"].includes(lo)) return false;
    return v;
  }
  if (type === "intArray") {
    return v.split(/[,;|]/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  }
  return v;
}

function buildTemplateCsv(columns: CsvColumn[], rows: Record<string, string>[]): string {
  const head = columns.map((c) => c.key).join(",");
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = r[c.key] ?? "";
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",")
  ).join("\n");
  return `\uFEFF${head}\n${body}\n`;
}

export function CsvImportDialog({ open, onClose, title, endpoint, invalidateQueryKey, facilityKey, moduleType, columns, templateRows }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ items: Record<string, unknown>[]; rawCount: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const reset = () => { setParsed(null); setParseError(null); setResult(null); if (fileRef.current) fileRef.current.value = ""; };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (file: File) => {
    setParsed(null); setParseError(null); setResult(null);
    try {
      const text = await file.text();
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) { setParseError("CSV 內容為空"); return; }
      const requiredCols = columns.filter((c) => c.required).map((c) => c.key);
      const missing = requiredCols.filter((k) => !headers.includes(k));
      if (missing.length > 0) { setParseError(`缺少必要欄位：${missing.join(", ")}`); return; }
      if (rows.length === 0) { setParseError("CSV 沒有資料列"); return; }
      const items = rows.map((row) => {
        const obj: Record<string, unknown> = { facilityKey, moduleType };
        for (let i = 0; i < headers.length; i++) {
          const col = columns.find((c) => c.key === headers[i]);
          if (!col) continue;
          const val = coerceValue(row[i] ?? "", col.type);
          if (val !== undefined) obj[col.key] = val;
        }
        return obj;
      });
      setParsed({ items, rawCount: rows.length });
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "讀取檔案失敗");
    }
  };

  const importMut = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("請先選擇 CSV");
      const r = await apiRequest("POST", endpoint, { items: parsed.items });
      return (await r.json()) as BulkResult;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
      if (data.failureCount === 0) {
        toast({ title: `成功匯入 ${data.successCount} 筆` });
      } else {
        toast({ title: `部分成功`, description: `成功 ${data.successCount} 筆，失敗 ${data.failureCount} 筆`, variant: "destructive" });
      }
    },
    onError: (e: Error) => toast({ title: "匯入失敗", description: e.message, variant: "destructive" }),
  });

  const downloadTemplate = () => {
    const csv = buildTemplateCsv(columns, templateRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}-範本.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-csv-import">
        <DialogHeader>
          <DialogTitle>匯入 CSV — {title}</DialogTitle>
          <DialogDescription>一次匯入大量項目。系統會自動套用目前選擇的館別與模組。</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-bold mb-1.5">欄位說明</p>
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              {columns.map((c) => (
                <div key={c.key}>
                  <span className="font-mono font-bold text-foreground">{c.key}</span>
                  {c.required && <span className="text-rose-600 ml-1">*</span>}
                  {c.hint && <span className="ml-2">— {c.hint}</span>}
                </div>
              ))}
              <p className="pt-1 text-muted-foreground/80">facilityKey、moduleType 會自動帶入目前選擇的館別（{facilityKey}）/ 模組（{moduleType}），不需要在 CSV 提供。</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
              <Download className="h-4 w-4 mr-1" /> 下載範本 CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="button-pick-csv">
              <FileText className="h-4 w-4 mr-1" /> 選擇 CSV 檔
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              data-testid="input-csv-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {parseError && (
            <div className="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700" data-testid="text-parse-error">{parseError}</div>
          )}

          {parsed && !result && (
            <div className="rounded border border-border bg-card p-3" data-testid="text-parsed-summary">
              <p className="text-sm">共解析 <span className="font-bold">{parsed.rawCount}</span> 筆資料，準備匯入。</p>
              <p className="text-[11px] text-muted-foreground mt-1">系統會逐筆驗證，失敗的項目會列出行號與原因。</p>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="rounded border border-border bg-card p-3">
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-600 font-bold" data-testid="text-success-count">成功 {result.successCount} 筆</span>
                  <span className={`font-bold ${result.failureCount > 0 ? "text-rose-600" : "text-muted-foreground"}`} data-testid="text-failure-count">
                    失敗 {result.failureCount} 筆
                  </span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded border border-rose-200 bg-rose-50 p-2 max-h-48 overflow-y-auto" data-testid="list-import-errors">
                  <p className="text-xs font-bold text-rose-700 mb-1">錯誤明細（CSV 行號，標頭不計）</p>
                  {result.errors.map((er, idx) => (
                    <div key={idx} className="text-[11px] text-rose-700 font-mono" data-testid={`text-error-row-${er.row}`}>
                      第 {er.row} 列：{er.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} data-testid="button-close-import">關閉</Button>
          <Button
            type="button"
            disabled={!parsed || importMut.isPending || !!result}
            onClick={() => importMut.mutate()}
            data-testid="button-confirm-import"
          >
            <Upload className="h-4 w-4 mr-1" />
            {importMut.isPending ? "匯入中…" : "開始匯入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
