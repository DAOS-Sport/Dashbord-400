import { CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
import type {
  ApiMonitoringDetailDto,
  ApiMonitoringErrorGroup,
  ApiMonitoringRequestRecord,
} from "@shared/system/api-monitoring-contract";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </p>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-[12px] text-slate-500">
      {children}
    </div>
  );
}

function ErrorGroupCard({
  group,
  note,
  pending,
  onNoteChange,
  onResolve,
  onReopen,
}: {
  group: ApiMonitoringErrorGroup;
  note: string;
  pending: boolean;
  onNoteChange: (value: string) => void;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const resolved = group.resolution.status === "resolved";
  return (
    <div
      className={cn(
        "rounded-md border bg-white p-3",
        resolved ? "border-slate-200" : "border-rose-200 shadow-[0_10px_24px_rgba(225,29,72,0.08)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", resolved ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700")}>
              {resolved ? "已處理" : "未處理"}
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-600">
              {group.errorType} · HTTP {group.statusCode}
            </span>
          </div>
          <p className="mt-2 text-[13px] font-semibold text-slate-900">
            {formatDateTime(group.hour)} 這個小時發生 {group.count} 次
          </p>
          <p className="mt-1 text-[11.5px] text-slate-500">
            最後發生 {formatDateTime(group.lastOccurredAt)}
            {group.avgDurationMs !== null ? ` · avg ${group.avgDurationMs}ms` : ""}
          </p>
        </div>
        {resolved ? (
          <button
            type="button"
            onClick={onReopen}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新打開
          </button>
        ) : null}
      </div>

      {resolved ? (
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
          {group.resolution.note ? `處理備註：${group.resolution.note}` : "沒有處理備註。"}
          {group.resolution.resolvedBy ? (
            <span className="ml-1 text-slate-400">· {group.resolution.resolvedBy}</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={2}
            placeholder="填寫處理備註，例如：已確認為外部服務 timeout，等待對方恢復。"
            className="min-h-[68px] w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none focus:border-slate-400"
          />
          <button
            type="button"
            onClick={onResolve}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-[11.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            標示已處理
          </button>
        </div>
      )}
    </div>
  );
}

export function ApiMonitoringDetailDrawer({
  open,
  onClose,
  detail,
  isLoading,
  isError,
  notes,
  pendingFingerprint,
  onNoteChange,
  onResolve,
  onReopen,
}: {
  open: boolean;
  onClose: () => void;
  detail?: ApiMonitoringDetailDto;
  isLoading: boolean;
  isError: boolean;
  notes: Record<string, string>;
  pendingFingerprint?: string;
  onNoteChange: (fingerprint: string, note: string) => void;
  onResolve: (group: ApiMonitoringErrorGroup) => void;
  onReopen: (group: ApiMonitoringErrorGroup) => void;
}) {
  const row = detail?.row;
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-surface-soft p-0 sm:max-w-[780px]">
        <SheetHeader className="border-b border-slate-200 bg-white px-5 py-4 text-left">
          <SheetTitle className="text-[17px] font-semibold text-slate-900">
            {row ? row.label : "API 明細"}
          </SheetTitle>
          <SheetDescription className="font-mono text-[12px] text-slate-500">
            {row ? `${row.method} ${row.path}` : "讀取單一 API 的時間序列與錯誤處理狀態"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {isLoading ? (
            <EmptyState>API 明細載入中...</EmptyState>
          ) : null}
          {isError ? (
            <EmptyState>API 明細讀取失敗，請稍後重試。</EmptyState>
          ) : null}

          {detail && row ? (
            <>
              <div className="grid gap-2.5 md:grid-cols-4">
                {[
                  { label: "24h calls", value: row.totalCount.toLocaleString(), tone: "text-slate-900" },
                  { label: "未處理錯誤", value: String(row.unresolvedErrorCount), tone: row.unresolvedErrorCount > 0 ? "text-rose-700" : "text-slate-900" },
                  { label: "已處理", value: String(row.resolvedErrorCount), tone: "text-slate-700" },
                  { label: "平均延遲", value: row.avgDurationMs === null ? "—" : `${row.avgDurationMs}ms`, tone: row.avgDurationMs !== null && row.avgDurationMs >= 1000 ? "text-amber-700" : "text-slate-900" },
                ].map((item) => (
                  <div key={item.label} className="rounded-md border border-slate-200 bg-white p-3">
                    <SectionLabel>{item.label}</SectionLabel>
                    <p className={cn("mt-2 text-[22px] font-semibold tabular-nums", item.tone)}>{item.value}</p>
                  </div>
                ))}
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-slate-900">未處理錯誤</h3>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-700">
                    {detail.unresolvedErrorGroups.length} groups
                  </span>
                </div>
                {detail.unresolvedErrorGroups.length === 0 ? (
                  <EmptyState>目前沒有未處理錯誤。</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {detail.unresolvedErrorGroups.map((group) => (
                      <ErrorGroupCard
                        key={group.fingerprint}
                        group={group}
                        note={notes[group.fingerprint] ?? ""}
                        pending={pendingFingerprint === group.fingerprint}
                        onNoteChange={(value) => onNoteChange(group.fingerprint, value)}
                        onResolve={() => onResolve(group)}
                        onReopen={() => onReopen(group)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-[14px] font-semibold text-slate-900">24h 每小時明細</h3>
                <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="grid grid-cols-[1fr_80px_80px_100px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                    <span>時間</span>
                    <span className="text-right">calls</span>
                    <span className="text-right">errors</span>
                    <span className="text-right">avg</span>
                  </div>
                  {detail.hourlyBuckets.map((bucket) => (
                    <div
                      key={bucket.hour}
                      className={cn(
                        "grid grid-cols-[1fr_80px_80px_100px] gap-3 border-b border-slate-100 px-4 py-2.5 text-[12px] last:border-b-0",
                        bucket.errors > 0 ? "bg-rose-50/50" : "bg-white",
                      )}
                    >
                      <span className="inline-flex items-center gap-2 text-slate-700">
                        {bucket.errors > 0 ? <XCircle className="h-3.5 w-3.5 text-rose-600" /> : <Clock3 className="h-3.5 w-3.5 text-slate-300" />}
                        {formatDateTime(bucket.hour)}
                      </span>
                      <span className="text-right font-mono text-slate-700">{bucket.total}</span>
                      <span className={cn("text-right font-mono", bucket.errors > 0 ? "font-semibold text-rose-700" : "text-slate-400")}>{bucket.errors}</span>
                      <span className="text-right font-mono text-slate-500">{bucket.avgDurationMs === null ? "—" : `${bucket.avgDurationMs}ms`}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[14px] font-semibold text-slate-900">已處理錯誤</h3>
                {detail.resolvedErrorGroups.length === 0 ? (
                  <EmptyState>尚無已處理錯誤。</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {detail.resolvedErrorGroups.map((group) => (
                      <ErrorGroupCard
                        key={group.fingerprint}
                        group={group}
                        note={notes[group.fingerprint] ?? ""}
                        pending={pendingFingerprint === group.fingerprint}
                        onNoteChange={(value) => onNoteChange(group.fingerprint, value)}
                        onResolve={() => onResolve(group)}
                        onReopen={() => onReopen(group)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-[14px] font-semibold text-slate-900">最近 request</h3>
                {detail.recentRecords.length === 0 ? (
                  <EmptyState>尚未累積 request 明細。</EmptyState>
                ) : (
                  <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                    {detail.recentRecords.map((record: ApiMonitoringRequestRecord) => (
                      <div key={record.id} className="grid grid-cols-[1fr_74px_88px] gap-3 border-b border-slate-100 px-4 py-2.5 text-[12px] last:border-b-0">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800">{formatDateTime(record.occurredAt)}</p>
                          <p className="truncate font-mono text-[10.5px] text-slate-400">{record.correlationId ?? record.route}</p>
                        </div>
                        <span className={cn("text-right font-mono font-semibold", record.statusCode >= 400 || record.statusCode === 499 ? "text-rose-700" : "text-emerald-700")}>
                          {record.statusCode}
                        </span>
                        <span className="text-right font-mono text-slate-500">{record.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
