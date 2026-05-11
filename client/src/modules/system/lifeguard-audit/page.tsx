import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, MapPin, ShieldCheck } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";

interface AuditRow {
  module: string;
  item: Record<string, string | number | null | boolean | Record<string, unknown>>;
}

export default function SystemLifeguardAuditPage() {
  const [facilityKey, setFacilityKey] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [claimStatus, setClaimStatus] = useState("all");
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (facilityKey !== "all") params.set("facilityKey", facilityKey);
    if (claimStatus !== "all") params.set("claimStatus", claimStatus);
    return `/api/bff/system/lifeguard-audit?${params.toString()}`;
  }, [facilityKey, claimStatus]);
  const { data, isLoading } = useQuery({ queryKey: [query], queryFn: () => apiGet<{ rows: AuditRow[] }>(query) });
  const rows = (data?.rows ?? []).filter((row) => moduleFilter === "all" || row.module === moduleFilter);
  const csvUrl = `${query}${query.includes("?") ? "&" : "?"}format=csv`;

  return (
    <RoleShell role="system" title="救生稽核" subtitle="查看 lifeguard_* tables、GPS、照片與失物狀態。">
      <div className="space-y-4">
        <WorkbenchCard className="p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <label className="text-[12px] font-black text-[#10233f]">場館
              <input value={facilityKey} onChange={(e) => setFacilityKey(e.target.value)} className="mt-1 min-h-10 w-full rounded-[8px] border border-[#dfe7ef] px-3" placeholder="all 或 facilityKey" />
            </label>
            <label className="text-[12px] font-black text-[#10233f]">模組
              <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="mt-1 min-h-10 w-full rounded-[8px] border border-[#dfe7ef] px-3">
                <option value="all">全部</option>
                <option value="water_quality">水質</option>
                <option value="coach_dive">教練下水</option>
                <option value="cleanup">打掃</option>
                <option value="lost_and_found">失物</option>
              </select>
            </label>
            <label className="text-[12px] font-black text-[#10233f]">認領狀態
              <select value={claimStatus} onChange={(e) => setClaimStatus(e.target.value)} className="mt-1 min-h-10 w-full rounded-[8px] border border-[#dfe7ef] px-3">
                <option value="all">全部</option>
                <option value="unclaimed">未認領</option>
                <option value="claimed">已認領</option>
                <option value="disposed">已廢棄</option>
              </select>
            </label>
            <a href={csvUrl} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[12px] font-black text-white"><Download className="h-4 w-4" />CSV</a>
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="overflow-hidden">
          <div className="grid grid-cols-[120px_90px_1fr_130px_120px] gap-3 border-b border-[#edf1f6] bg-[#f7f9fb] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#637185]">
            <span>時間</span><span>模組</span><span>救生員 / 場館</span><span>GPS</span><span>照片</span>
          </div>
          {isLoading ? <div className="p-6 text-[13px] font-bold text-[#637185]">載入中...</div> : null}
          <div className="divide-y divide-[#edf1f6]">
            {rows.map((row) => {
              const item = row.item;
              return (
                <details key={`${row.module}-${item.id}`} className="group">
                  <summary className="grid cursor-pointer grid-cols-[120px_90px_1fr_130px_120px] gap-3 px-4 py-3 text-[12px] font-bold text-[#10233f] hover:bg-[#fbfcfd]">
                    <span>{String(item.createdAt ?? "").slice(0, 16)}</span>
                    <span>{row.module}</span>
                    <span>{String(item.createdBy ?? "unknown")} / {String(item.facilityKey ?? "")}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-[#15935d]" />{item.latitude ? "有" : "無"}</span>
                    <span>{item.photoUrl ? "有照片" : "無照片"}</span>
                  </summary>
                  <div className="grid gap-3 bg-[#fbfcfd] p-4 md:grid-cols-[240px_1fr]">
                    {item.photoUrl ? <img src={String(item.photoUrl)} className="max-h-60 rounded-[10px] object-contain" alt="救生照片" /> : <div className="rounded-[10px] bg-white p-6 text-center text-[12px] font-bold text-[#8b9aae]">無照片</div>}
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-[13px] font-black text-[#10233f]"><ShieldCheck className="h-4 w-4 text-[#15935d]" />Metadata</p>
                      <pre className="max-h-72 overflow-auto rounded-[8px] bg-white p-3 text-[11px]">{JSON.stringify(item, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              );
            })}
            {!rows.length && !isLoading ? <div className="p-6 text-center text-[13px] font-bold text-[#637185]">尚無救生稽核資料。</div> : null}
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
