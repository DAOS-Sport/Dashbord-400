import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { fetchAuditLogs } from "./api";

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SystemAuditPage() {
  const query = useQuery({
    queryKey: ["/api/audit/logs", "system-audit-page"],
    queryFn: fetchAuditLogs,
    retry: 1,
  });

  const items = query.data?.items ?? [];

  return (
    <RoleShell role="system" title="操作稽核" subtitle="AUDIT LOGS">
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="system-audit-page">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-black uppercase tracking-wide text-text-muted">System Audit</p>
            <h1 className="mt-2 text-[28px] font-black leading-tight text-text-strong">操作稽核</h1>
            <p className="mt-2 max-w-3xl text-[14px] font-semibold leading-6 text-text-body">
              讀取原本的 audit log 頁面資料，保留獨立檢視入口。
            </p>
          </div>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-border-subtle bg-surface-solid px-3 text-[12px] font-black text-text-body">
            <ShieldCheck className="h-4 w-4" />
            {query.isFetching ? "同步中" : `${items.length} 筆`}
          </span>
        </section>

        <WorkbenchCard className="overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-[16px] font-black text-text-strong">最近紀錄</h2>
            <p className="mt-1 text-[12px] font-bold text-text-body">來源：/api/audit/logs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-surface-soft text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">
                <tr>
                  <th className="px-4 py-3">時間</th>
                  <th className="px-4 py-3">操作者</th>
                  <th className="px-4 py-3">動作</th>
                  <th className="px-4 py-3">資源</th>
                  <th className="px-4 py-3">結果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {items.map((item) => (
                  <tr key={item.id ?? `${item.timestamp}-${item.action}-${item.resourceId ?? item.resource}`} className="hover:bg-surface-soft">
                    <td className="px-4 py-3 font-mono text-[12px] font-bold text-text-body">{formatTime(item.timestamp)}</td>
                    <td className="px-4 py-3 font-bold text-text-strong">{item.actorId ?? "system"}</td>
                    <td className="px-4 py-3 font-mono text-[12px] font-black text-text-strong">{item.action}</td>
                    <td className="px-4 py-3 text-text-body">{item.resourceId ? `${item.resource} / ${item.resourceId}` : item.resource}</td>
                    <td className="px-4 py-3 font-bold text-text-body">{item.resultStatus ?? "success"}</td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[13px] font-bold text-text-body">
                      {query.isLoading ? "audit log 載入中..." : query.isError ? "Audit logs 暫時無法載入。" : "尚無 audit log。"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
