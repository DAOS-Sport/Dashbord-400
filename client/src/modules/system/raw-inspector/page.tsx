import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Code2, DatabaseZap, RefreshCw, Search } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchRawInspectorTarget, rawInspectorTargets, type RawInspectorPath } from "./api";

export default function SystemRawInspectorPage() {
  const [target, setTarget] = useState<RawInspectorPath>("/api/bff/system/overview");
  const rawQuery = useQuery({
    queryKey: ["raw-inspector", target],
    queryFn: () => fetchRawInspectorTarget(target),
  });
  const pretty = rawQuery.data ? JSON.stringify(rawQuery.data, null, 2) : "";

  return (
    <RoleShell role="system" title="Raw Inspector" subtitle="受控檢視本平台 BFF / proxy JSON，避免前端直接打外部來源。">
      <div className="space-y-4">
        <WorkbenchCard className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
                <DatabaseZap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-black">查詢目標</h2>
                <p className="text-[12px] font-bold text-[#8b9aae]">目前只開放白名單 endpoint。</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value as RawInspectorPath)}
                className="min-h-10 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[13px] font-black text-[#10233f]"
              >
                {rawInspectorTargets.map(([path, label]) => <option key={path} value={path}>{label}</option>)}
              </select>
              <button onClick={() => rawQuery.refetch()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white">
                <RefreshCw className={cn("h-4 w-4", rawQuery.isFetching && "animate-spin")} />
                查詢
              </button>
            </div>
          </div>
        </WorkbenchCard>

        <WorkbenchCard className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <Code2 className="h-5 w-5 text-[#2f6fe8]" />
            <div>
              <h2 className="text-[15px] font-black">{target}</h2>
              <p className="text-[12px] font-bold text-[#8b9aae]">Raw JSON 只供系統治理與 Replit 重連檢查。</p>
            </div>
          </div>
          {rawQuery.isLoading ? (
            <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入原始資料...</div>
          ) : rawQuery.isError ? (
            <div className="rounded-[8px] bg-[#fff7f8] p-4 text-[13px] font-bold text-[#ff4964]">查詢失敗，請確認 BFF 或外部代理狀態。</div>
          ) : (
            <pre className="max-h-[620px] overflow-auto rounded-[8px] bg-[#10233f] p-4 text-[12px] leading-6 text-white">
              {pretty}
            </pre>
          )}
        </WorkbenchCard>

        <WorkbenchCard className="p-4">
          <div className="flex items-start gap-3">
            <Search className="mt-0.5 h-5 w-5 shrink-0 text-[#ef7d22]" />
            <p className="text-[12px] font-bold leading-5 text-[#637185]">每次查詢會寫入 telemetry 事件，供系統端追蹤 Raw Inspector 使用情況。</p>
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
