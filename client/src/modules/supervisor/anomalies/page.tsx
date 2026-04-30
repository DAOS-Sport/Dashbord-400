import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Clock, Image as ImageIcon, Mail, MapPin, RefreshCw, Search, Trash2, UserRound } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import type { AnomalyReport } from "./api";
import { deleteAnomalyReport, fetchAnomalyReports, fetchNotificationRecipients, resolveAnomalyReport } from "./api";
import { SupervisorKpiCard } from "../supervisor-ui";

const isResolved = (report: AnomalyReport) => report.resolution === "resolved";
type AnomalyCardKey = "pending" | "resolved" | "attachments" | "recipients";
const metricCards: readonly (readonly [label: string, key: AnomalyCardKey, Icon: LucideIcon, tone: string])[] = [
  ["待處理", "pending", AlertTriangle, "text-[#ff4964]"],
  ["已處理", "resolved", CheckCircle2, "text-[#15935d]"],
  ["附件", "attachments", ImageIcon, "text-[#2f6fe8]"],
  ["通知收件者", "recipients", Mail, "text-[#6947d8]"],
];

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
};

function ResolutionBadge({ report }: { report: AnomalyReport }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black",
      isResolved(report) ? "bg-[#eaf8ef] text-[#15935d]" : "bg-[#fff6e7] text-[#ef7d22]",
    )}>
      {isResolved(report) ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {isResolved(report) ? "已處理" : "待處理"}
    </span>
  );
}

function ReportListItem({
  report,
  active,
  onSelect,
}: {
  report: AnomalyReport;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[8px] border p-3 text-left transition hover:bg-white hover:shadow-sm",
        active ? "border-[#ff4964] bg-[#fff7f8]" : "border-[#e6edf4] bg-[#fbfcfd]",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <ResolutionBadge report={report} />
        <span className="text-[11px] font-bold text-[#8b9aae]">{formatDateTime(report.createdAt)}</span>
      </div>
      <p className="text-[14px] font-black text-[#10233f]">{report.employeeName || "未知員工"}</p>
      <p className="mt-1 line-clamp-2 text-[12px] font-medium text-[#637185]">{report.context || report.failReason || report.errorMsg || "未提供異常說明"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#8b9aae]">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{report.venueName || "未指定場館"}</span>
        {report.imageUrls?.length ? <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" />{report.imageUrls.length} 張</span> : null}
      </div>
    </button>
  );
}

function ReportDetail({
  report,
  onResolve,
  onReopen,
  onDelete,
  busy,
}: {
  report?: AnomalyReport;
  onResolve: (report: AnomalyReport) => void;
  onReopen: (report: AnomalyReport) => void;
  onDelete: (report: AnomalyReport) => void;
  busy: boolean;
}) {
  if (!report) {
    return (
      <WorkbenchCard className="grid min-h-[420px] place-items-center p-6 text-center">
        <div>
          <AlertTriangle className="mx-auto h-10 w-10 text-[#8b9aae]" />
          <p className="mt-3 text-[15px] font-black">選擇一筆異常通報</p>
          <p className="mt-1 text-[13px] text-[#637185]">主管可檢視員工說明、打卡狀態、附件與處理紀錄。</p>
        </div>
      </WorkbenchCard>
    );
  }

  return (
    <WorkbenchCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#ff4964]">Anomaly Review</p>
          <h2 className="mt-2 text-[20px] font-black leading-tight">{report.context || "打卡異常通報"}</h2>
          <p className="mt-1 text-[13px] font-bold text-[#637185]">{report.employeeName || "未知員工"} · {report.employeeCode || "無員編"}</p>
        </div>
        <ResolutionBadge report={report} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ["場館", report.venueName || "-"],
          ["職務", report.role || "-"],
          ["打卡狀態", report.clockStatus || "-"],
          ["打卡類型", report.clockType || "-"],
          ["打卡時間", report.clockTime || "-"],
          ["距離", report.distance ? `${report.distance}m` : "-"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[8px] bg-[#fbfcfd] p-3">
            <p className="text-[11px] font-black text-[#8b9aae]">{label}</p>
            <p className="mt-1 text-[13px] font-black text-[#10233f]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <section className="rounded-[8px] bg-[#fff7f8] p-3">
          <h3 className="text-[12px] font-black text-[#ff4964]">失敗原因</h3>
          <p className="mt-1 text-[13px] leading-6 text-[#263b56]">{report.failReason || report.errorMsg || "未提供"}</p>
        </section>
        <section className="rounded-[8px] bg-[#f7f9fb] p-3">
          <h3 className="text-[12px] font-black text-[#536175]">員工備註</h3>
          <p className="mt-1 text-[13px] leading-6 text-[#263b56]">{report.userNote || "無"}</p>
        </section>
        {report.reportText ? (
          <section className="rounded-[8px] bg-[#10233f] p-3 text-white">
            <h3 className="text-[12px] font-black text-[#9dd84f]">通報全文</h3>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[12px] leading-6">{report.reportText}</pre>
          </section>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onResolve(report)}
          disabled={busy || isResolved(report)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#15935d] px-4 text-[13px] font-black text-white disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          標記已處理
        </button>
        <button
          type="button"
          onClick={() => onReopen(report)}
          disabled={busy || !isResolved(report)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#ef7d22] px-4 text-[13px] font-black text-white disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          改回待處理
        </button>
        <button
          type="button"
          onClick={() => onDelete(report)}
          disabled={busy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ffd5dc] bg-white px-4 text-[13px] font-black text-[#ff4964] disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          刪除
        </button>
      </div>
    </WorkbenchCard>
  );
}

export default function SupervisorAnomaliesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("pending");
  const [keyword, setKeyword] = useState("");

  const reportsQuery = useQuery({ queryKey: ["/api/anomaly-reports"], queryFn: fetchAnomalyReports });
  const recipientsQuery = useQuery({ queryKey: ["/api/notification-recipients"], queryFn: fetchNotificationRecipients });
  const reports = reportsQuery.data ?? [];
  const filteredReports = useMemo(() => {
    const lower = keyword.trim().toLowerCase();
    return reports.filter((report) => {
      const statusMatch = statusFilter === "all" || (statusFilter === "resolved" ? isResolved(report) : !isResolved(report));
      const text = `${report.employeeName ?? ""} ${report.employeeCode ?? ""} ${report.context ?? ""} ${report.venueName ?? ""}`.toLowerCase();
      return statusMatch && (!lower || text.includes(lower));
    });
  }, [keyword, reports, statusFilter]);
  const selected = filteredReports.find((report) => report.id === selectedId) ?? filteredReports[0];
  const pendingCount = reports.filter((report) => !isResolved(report)).length;
  const resolvedCount = reports.filter(isResolved).length;
  const imageCount = reports.reduce((sum, report) => sum + (report.imageUrls?.length ?? 0), 0);
  const metricValue: Record<AnomalyCardKey, number> = {
    pending: pendingCount,
    resolved: resolvedCount,
    attachments: imageCount,
    recipients: recipientsQuery.data?.filter((item) => item.enabled).length ?? 0,
  };

  const resolveMutation = useMutation({
    mutationFn: ({ report, resolution }: { report: AnomalyReport; resolution: "pending" | "resolved" }) =>
      resolveAnomalyReport(report.id, resolution, resolution === "resolved" ? "主管工作台處理完成" : "主管工作台改回待處理"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/anomaly-reports"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (report: AnomalyReport) => deleteAnomalyReport(report.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/anomaly-reports"] }),
  });

  return (
    <RoleShell role="supervisor" title="異常審核" subtitle="ANOMALY REVIEW · 集中處理打卡異常、附件、通知收件者與處理狀態。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(([label, key, Icon, tone]) => (
            <SupervisorKpiCard
              key={key}
              label={label}
              value={metricValue[key]}
              icon={Icon}
              tone={tone.includes("ff4964") ? "red" : tone.includes("15935d") ? "green" : tone.includes("6947") ? "purple" : "blue"}
            />
          ))}
        </div>

        <WorkbenchCard className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label className="text-[12px] font-black text-[#536175]">搜尋異常通報</label>
              <div className="mt-2 flex min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3">
                <Search className="h-4 w-4 text-[#8b9aae]" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[14px] font-bold outline-none"
                  placeholder="員工、員編、場館、異常內容"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 rounded-[8px] border border-[#dfe7ef] bg-white p-1">
              {(["pending", "resolved", "all"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn("min-h-9 rounded-[6px] px-3 text-[12px] font-black", statusFilter === status ? "bg-[#0d2a50] text-white" : "text-[#637185]")}
                >
                  {status === "pending" ? "待處理" : status === "resolved" ? "已處理" : "全部"}
                </button>
              ))}
            </div>
          </div>
        </WorkbenchCard>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <WorkbenchCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-black">通報列表</h2>
              <span className="text-[12px] font-bold text-[#8b9aae]">{filteredReports.length} 筆</span>
            </div>
            <div className="space-y-3">
              {reportsQuery.isLoading ? (
                <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入異常通報...</div>
              ) : filteredReports.length > 0 ? (
                filteredReports.map((report) => (
                  <ReportListItem
                    key={report.id}
                    report={report}
                    active={report.id === selected?.id}
                    onSelect={() => setSelectedId(report.id)}
                  />
                ))
              ) : (
                <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center">
                  <UserRound className="mx-auto h-8 w-8 text-[#8b9aae]" />
                  <p className="mt-2 text-[13px] font-bold text-[#637185]">沒有符合條件的異常通報。</p>
                </div>
              )}
            </div>
          </WorkbenchCard>

          <ReportDetail
            report={selected}
            busy={resolveMutation.isPending || deleteMutation.isPending}
            onResolve={(report) => resolveMutation.mutate({ report, resolution: "resolved" })}
            onReopen={(report) => resolveMutation.mutate({ report, resolution: "pending" })}
            onDelete={(report) => deleteMutation.mutate(report)}
          />
        </div>
      </div>
    </RoleShell>
  );
}
