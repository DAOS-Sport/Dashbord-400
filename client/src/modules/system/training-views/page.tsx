import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, Eye, FileSearch, GraduationCap, UserRoundCheck, Users } from "lucide-react";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { fetchTrainingViewReport } from "./api";

const dateLabel = (value?: string) => {
  if (!value) return "無時間";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function SystemTrainingViewsPage() {
  const reportQuery = useQuery({ queryKey: ["/api/telemetry/training-views"], queryFn: fetchTrainingViewReport });
  const report = reportQuery.data;
  const metrics: readonly (readonly [label: string, value: number, Icon: LucideIcon, tone: string])[] = [
    ["觀看次數", report?.totalViews ?? 0, Eye, "text-[#2f6fe8]"],
    ["觀看人數", report?.uniqueViewers ?? 0, Users, "text-[#15935d]"],
    ["被看教材", report?.uniqueResources ?? 0, BookOpenCheck, "text-[#ef7d22]"],
  ];

  return (
    <RoleShell role="system" title="員工教材觀看紀錄" subtitle="IT/System 檢視員工教材是否被查閱；資料來源為 ui_events / TRAINING_VIEW。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {metrics.map(([label, value, Icon, tone]) => (
            <WorkbenchCard key={label} className="p-4">
              <p className="text-[12px] font-bold text-[#637185]">{label}</p>
              <div className="mt-2 flex items-center justify-between">
                <p className={`text-[26px] font-black ${tone}`}>{value}</p>
                <Icon className="h-5 w-5 text-[#2f6fe8]" />
              </div>
            </WorkbenchCard>
          ))}
        </div>

        {reportQuery.isLoading ? (
          <WorkbenchCard className="p-8">
            <DreamLoader compact label="觀看紀錄載入中" />
          </WorkbenchCard>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <WorkbenchCard className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black">
                <GraduationCap className="h-5 w-5 text-[#2f6fe8]" />
                教材觀看排行
              </h2>
              <div className="space-y-3">
                {(report?.byResource ?? []).slice(0, 10).map((item, index) => (
                  <div key={item.resourceId} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eef5ff] text-[11px] font-black text-[#2f6fe8]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-[#10233f]">{item.title}</p>
                      <p className="text-[11px] font-bold text-[#8b9aae]">{item.mediaType ?? "教材"} · 最後觀看 {dateLabel(item.lastViewedAt)}</p>
                    </div>
                    <span className="text-[13px] font-black text-[#10233f]">{item.count}</span>
                  </div>
                ))}
                {!report?.byResource?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無教材觀看紀錄。</div> : null}
              </div>
            </WorkbenchCard>

            <WorkbenchCard className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black">
                <UserRoundCheck className="h-5 w-5 text-[#15935d]" />
                觀看員工
              </h2>
              <div className="space-y-3">
                {(report?.byViewer ?? []).slice(0, 10).map((item, index) => (
                  <div key={item.userId} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eaf8ef] text-[11px] font-black text-[#15935d]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-[#10233f]">{item.userId}</p>
                      <p className="text-[11px] font-bold text-[#8b9aae]">{item.role ?? "unknown"} · {item.facilityKey ?? "無場館"} · {dateLabel(item.lastViewedAt)}</p>
                    </div>
                    <span className="text-[13px] font-black text-[#10233f]">{item.count}</span>
                  </div>
                ))}
                {!report?.byViewer?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無觀看員工資料。</div> : null}
              </div>
            </WorkbenchCard>
          </div>
        )}

        <WorkbenchCard className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black">
            <FileSearch className="h-5 w-5 text-[#2f6fe8]" />
            最近觀看
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="text-[#8b9aae]">
                <tr className="border-b border-[#edf1f5]">
                  <th className="px-3 py-2 font-black">時間</th>
                  <th className="px-3 py-2 font-black">教材</th>
                  <th className="px-3 py-2 font-black">員工</th>
                  <th className="px-3 py-2 font-black">角色</th>
                  <th className="px-3 py-2 font-black">場館</th>
                </tr>
              </thead>
              <tbody>
                {(report?.latestViews ?? []).map((item, index) => (
                  <tr key={`${item.id ?? item.correlationId ?? index}`} className="border-b border-[#f2f5f8]">
                    <td className="px-3 py-3 font-bold text-[#637185]">{dateLabel(item.occurredAt)}</td>
                    <td className="max-w-[320px] truncate px-3 py-3 font-black text-[#10233f]">{item.title ?? item.resourceId ?? "未命名教材"}</td>
                    <td className="px-3 py-3 font-bold text-[#536175]">{item.userId ?? "anonymous"}</td>
                    <td className="px-3 py-3 font-bold text-[#536175]">{item.role ?? "unknown"}</td>
                    <td className="px-3 py-3 font-bold text-[#536175]">{item.facilityKey ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!report?.latestViews?.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">尚無最近觀看紀錄。</div> : null}
          </div>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
