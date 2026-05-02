import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Eye, Clock, ImageIcon, Download } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DailyReportSubmission, WorkLogTaskCompletion, WaterQualityRecord, LifeguardHandoverNote } from "@shared/schema";
import { AdminRoleGuard, EmptyState, ErrorState, LoadingState, WorkLogAdminShell, shiftLabel, useAdminFacility, useModuleType } from "./_shared";

interface DetailResponse {
  submission: DailyReportSubmission;
  completions: WorkLogTaskCompletion[];
  waterRecords: WaterQualityRecord[];
  handovers: LifeguardHandoverNote[];
}

export default function SubmissionsPage() {
  return <AdminRoleGuard><Inner /></AdminRoleGuard>;
}

function todayInTaipei(): string {
  const now = new Date();
  const taipei = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  return `${taipei.getFullYear()}-${String(taipei.getMonth() + 1).padStart(2, "0")}-${String(taipei.getDate()).padStart(2, "0")}`;
}

function Inner() {
  const moduleType = useModuleType();
  const [facilityKey, setFacilityKey] = useAdminFacility();
  const [statusFilter, setStatusFilter] = useState<string>("submitted");
  const [workDate, setWorkDate] = useState<string>(todayInTaipei());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const { toast: exportToast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery<{ items: DailyReportSubmission[] }>({
    queryKey: ["/api/work-logs/admin/submissions", moduleType, facilityKey, workDate, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facilityKey) params.set("facilityKey", facilityKey);
      params.set("moduleType", moduleType);
      if (workDate) params.set("workDate", workDate);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const r = await fetch(`/api/work-logs/admin/submissions?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("載入失敗");
      return r.json();
    },
    enabled: !!facilityKey,
  });

  const items = data?.items ?? [];

  return (
    <WorkLogAdminShell
      title="主管審核 / 日報歷史"
      description="檢視員工送出的日報，可批准或退回要求補正，亦可下載每日日報表 CSV"
      facilityKey={facilityKey}
      onFacilityChange={setFacilityKey}
      actions={
        <>
          <Input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="w-[140px]"
            data-testid="input-submissions-date"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px]" data-testid="select-submissions-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">待審核</SelectItem>
              <SelectItem value="approved">已批准</SelectItem>
              <SelectItem value="returned">已退回</SelectItem>
              <SelectItem value="all">全部</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setExportOpen(true)} data-testid="button-open-export">
            <Download className="h-4 w-4 mr-1" /> 下載報表
          </Button>
        </>
      }
    >
      {isLoading ? <LoadingState /> : isError ? <ErrorState message="載入失敗" /> : items.length === 0 ? (
        <EmptyState message="此日期沒有對應狀態的日報" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">班別</TableHead>
                <TableHead>送出人</TableHead>
                <TableHead className="w-28">送出時間</TableHead>
                <TableHead className="w-24">完成度</TableHead>
                <TableHead className="w-24">水質</TableHead>
                <TableHead className="w-20">狀態</TableHead>
                <TableHead className="w-36">審核人</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const summary = (row.summary ?? {}) as Record<string, number>;
                return (
                  <TableRow key={row.id} data-testid={`row-submission-${row.id}`}>
                    <TableCell><span className="text-xs">{shiftLabel(row.shiftType)}</span></TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{row.submittedByName ?? row.submittedBy}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{row.submittedBy}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.submittedAt ? new Date(row.submittedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {row.totalCompleted}/{row.totalRequired}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span>共 {summary.waterQualityCount ?? 0} 筆</span>
                      {(summary.abnormalCount ?? 0) > 0 && (
                        <span className="ml-1 text-rose-600 font-bold">⚠ {summary.abnormalCount}</span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.reviewedByName ?? row.reviewedBy ?? "—"}
                      {row.reviewedAt && (
                        <div className="text-[11px]">{new Date(row.reviewedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }).slice(5, 16)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(row.id)} data-testid={`button-view-submission-${row.id}`}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> 檢視
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {detailId !== null && (
        <DetailDialog id={detailId} onClose={() => { setDetailId(null); refetch(); }} />
      )}

      {exportOpen && (
        <ExportDialog
          facilityKey={facilityKey}
          moduleType={moduleType}
          defaultDate={workDate}
          statusFilter={statusFilter}
          onClose={() => setExportOpen(false)}
          onError={(msg) => exportToast({ title: "下載失敗", description: msg, variant: "destructive" })}
        />
      )}
    </WorkLogAdminShell>
  );
}

function ExportDialog({
  facilityKey,
  moduleType,
  defaultDate,
  statusFilter,
  onClose,
  onError,
}: {
  facilityKey: string;
  moduleType: "lifeguard" | "counter";
  defaultDate: string;
  statusFilter: string;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"single" | "range">("single");
  const [singleDate, setSingleDate] = useState(defaultDate);
  const [fromDate, setFromDate] = useState(defaultDate);
  const [toDate, setToDate] = useState(defaultDate);
  const [format, setFormat] = useState<"summary" | "detail">("summary");
  const [includeStatus, setIncludeStatus] = useState<string>(statusFilter);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!facilityKey) {
      onError("請先選擇場館");
      return;
    }
    if (mode === "range" && fromDate > toDate) {
      onError("開始日期不可晚於結束日期");
      return;
    }

    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set("facilityKey", facilityKey);
      params.set("moduleType", moduleType);
      params.set("format", format);
      if (includeStatus !== "all") params.set("status", includeStatus);
      if (mode === "single") {
        params.set("workDate", singleDate);
      } else {
        params.set("fromDate", fromDate);
        params.set("toDate", toDate);
      }

      const r = await fetch(`/api/work-logs/admin/submissions/export?${params}`, { credentials: "include" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message ?? `下載失敗 (HTTP ${r.status})`);
      }

      const blob = await r.blob();
      const filename = (() => {
        const cd = r.headers.get("Content-Disposition") ?? "";
        const m = cd.match(/filename="?([^";]+)"?/);
        if (m) return m[1];
        const datePart = mode === "range" ? `${fromDate}_${toDate}` : singleDate;
        const modulePrefix = moduleType === "counter" ? "counter" : "lifeguard";
        return `${modulePrefix}-daily-report_${facilityKey}_${datePart}_${format}.csv`;
      })();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !downloading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>下載每日日報表</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium mb-1.5">日期範圍</p>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition ${mode === "single" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}
                data-testid="tab-export-single"
              >
                單日
              </button>
              <button
                type="button"
                onClick={() => setMode("range")}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition ${mode === "range" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}
                data-testid="tab-export-range"
              >
                日期區間
              </button>
            </div>
            {mode === "single" ? (
              <Input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                data-testid="input-export-single-date"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">起始日</p>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} data-testid="input-export-from-date" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">結束日</p>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} data-testid="input-export-to-date" />
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="font-medium mb-1.5">格式</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormat("summary")}
                className={`flex-1 px-3 py-2 rounded-md text-xs text-left border transition ${format === "summary" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                data-testid="button-format-summary"
              >
                <p className="font-bold">摘要</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">一筆日報一列，含完成度、水質筆數、審核狀態</p>
              </button>
              <button
                type="button"
                onClick={() => setFormat("detail")}
                className={`flex-1 px-3 py-2 rounded-md text-xs text-left border transition ${format === "detail" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                data-testid="button-format-detail"
              >
                <p className="font-bold">明細</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">逐筆任務／水質／交接事項展開（資料較多）</p>
              </button>
            </div>
          </div>

          <div>
            <p className="font-medium mb-1.5">狀態</p>
            <Select value={includeStatus} onValueChange={setIncludeStatus}>
              <SelectTrigger data-testid="select-export-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="submitted">待審核</SelectItem>
                <SelectItem value="approved">已批准</SelectItem>
                <SelectItem value="returned">已退回</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-[11px] text-muted-foreground border-l-2 border-amber-400 pl-2">
            CSV 檔已自動加上 UTF-8 BOM，使用 Excel 開啟時中文會正常顯示。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={downloading}>取消</Button>
          <Button onClick={handleDownload} disabled={downloading} data-testid="button-confirm-export">
            <Download className="h-4 w-4 mr-1" />
            {downloading ? "下載中…" : "下載 CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    submitted: { cls: "bg-amber-100 text-amber-700", label: "待審核" },
    approved: { cls: "bg-emerald-100 text-emerald-700", label: "已批准" },
    returned: { cls: "bg-rose-100 text-rose-700", label: "已退回" },
  };
  const m = map[status] ?? { cls: "bg-slate-100 text-slate-700", label: status };
  return <span className={`text-[11px] px-2 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

function DetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { toast } = useToast();
  const [reviewNote, setReviewNote] = useState("");

  const { data, isLoading, isError } = useQuery<DetailResponse>({
    queryKey: ["/api/work-logs/admin/submissions", id],
    queryFn: async () => {
      const r = await fetch(`/api/work-logs/admin/submissions/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("載入失敗");
      return r.json();
    },
  });

  const approveMut = useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/work-logs/admin/submissions/${id}/approve`, { reviewNote }); },
    onSuccess: () => {
      toast({ title: "已批准日報" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/submissions"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "批准失敗", description: e.message, variant: "destructive" }),
  });

  const returnMut = useMutation({
    mutationFn: async () => {
      if (!reviewNote.trim()) {
        throw new Error("請填寫退回理由");
      }
      await apiRequest("POST", `/api/work-logs/admin/submissions/${id}/return`, { reviewNote });
    },
    onSuccess: () => {
      toast({ title: "已退回日報" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-logs/admin/submissions"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "退回失敗", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>日報詳情</DialogTitle>
        </DialogHeader>
        {isLoading ? <LoadingState /> : isError || !data ? <ErrorState message="載入失敗" /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">送出人</p>
                <p className="font-medium text-sm">{data.submission.submittedByName ?? data.submission.submittedBy}</p>
              </div>
              <div>
                <p className="text-muted-foreground">日期 / 班別</p>
                <p className="font-medium text-sm">{data.submission.workDate} · {shiftLabel(data.submission.shiftType)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">完成度</p>
                <p className="font-medium text-sm font-mono">{data.submission.totalCompleted} / {data.submission.totalRequired}</p>
              </div>
              <div>
                <p className="text-muted-foreground">狀態</p>
                <p className="text-sm"><StatusBadge status={data.submission.status} /></p>
              </div>
              {data.submission.reviewNote && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">前次審核留言</p>
                  <p className="text-sm italic">{data.submission.reviewNote}</p>
                </div>
              )}
            </div>

            <div>
              <SectionTitle icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} title={`完成項目 (${data.completions.filter((c) => c.isCompleted).length}/${data.completions.length})`} />
              {data.completions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">無任務紀錄</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.completions.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 rounded border p-2" data-testid={`item-completion-${c.id}`}>
                      {c.isCompleted ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className={c.isCompleted ? "" : "text-muted-foreground"}>{c.taskName}</p>
                        {c.inputValue && <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">{JSON.stringify(c.inputValue)}</p>}
                        {c.notes && <p className="text-xs italic mt-0.5">備註：{c.notes}</p>}
                      </div>
                      {c.completedByName && <p className="text-[11px] text-muted-foreground shrink-0">{c.completedByName}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <SectionTitle icon={<Clock className="h-4 w-4 text-sky-600" />} title={`水質紀錄 (${data.waterRecords.length})`} />
              {data.waterRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">無水質紀錄</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.waterRecords.map((w) => (
                    <li key={w.id} className={`rounded border p-2 ${w.isAbnormal ? "border-rose-300 bg-rose-50/40" : ""}`} data-testid={`item-water-${w.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{w.poolName} · {w.scheduledTime ?? "—"}</p>
                        {w.isAbnormal && <span className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded">異常</span>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{JSON.stringify(w.measurements)}</p>
                      {w.abnormalNote && <p className="text-xs italic mt-0.5">說明：{w.abnormalNote}</p>}
                      {w.photoUrls && w.photoUrls.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <ImageIcon className="h-3 w-3" /> {w.photoUrls.length} 張照片
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data.handovers.length > 0 && (
              <div>
                <SectionTitle icon={<Clock className="h-4 w-4 text-violet-600" />} title={`本班交接給下班 (${data.handovers.length})`} />
                <ul className="space-y-1.5 text-sm">
                  {data.handovers.map((h) => (
                    <li key={h.id} className="rounded border p-2" data-testid={`item-handover-${h.id}`}>
                      <p className={h.isImportant ? "font-bold text-amber-700" : ""}>{h.content}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {h.authorName ?? h.authorEmployeeNumber} · {shiftLabel(h.fromShift)} → {shiftLabel(h.toShift)}
                        {h.isConfirmed && <span className="ml-2 text-emerald-600">✓ 已確認</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.submission.status === "submitted" && (
              <div>
                <p className="text-sm font-medium mb-1.5">審核留言（退回時必填）</p>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={2}
                  placeholder="例如：水質紀錄缺少早班 8:00 那筆"
                  data-testid="input-review-note"
                />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {data?.submission.status === "submitted" && (
            <>
              <Button variant="outline" onClick={() => returnMut.mutate()} disabled={returnMut.isPending} data-testid="button-return-submission">
                <XCircle className="h-4 w-4 mr-1" /> 退回補正
              </Button>
              <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending} data-testid="button-approve-submission">
                <CheckCircle2 className="h-4 w-4 mr-1" /> 批准
              </Button>
            </>
          )}
          {data?.submission.status !== "submitted" && (
            <Button variant="outline" onClick={onClose}>關閉</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {icon}
      <h4 className="text-sm font-bold">{title}</h4>
    </div>
  );
}
