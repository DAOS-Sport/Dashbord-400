import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, CheckSquare, ClipboardList, Eye, Megaphone, PanelTop, Users } from "lucide-react";
import type { SupervisorDashboardDto } from "@shared/domain/workbench";
import { apiGet } from "@/shared/api/client";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { RoleShell } from "@/modules/workbench/role-shell";
import { cn } from "@/lib/utils";

const fetchSupervisorDashboard = () => apiGet<SupervisorDashboardDto>("/api/bff/supervisor/dashboard");
const layoutOptions = [
  ["kpis", "核心 KPI"],
  ["staffing", "人力狀態"],
  ["anomalies", "待審異常"],
  ["tasks", "未完成交班"],
  ["quickActions", "快速操作"],
  ["activity", "近期活動"],
] as const;

type LayoutKey = (typeof layoutOptions)[number][0];
type LayoutState = Record<LayoutKey, boolean>;

const defaultLayout: LayoutState = {
  kpis: true,
  staffing: true,
  anomalies: true,
  tasks: true,
  quickActions: true,
  activity: true,
};

function Kpi({ title, value, helper, icon: Icon, tone }: { title: string; value: string; helper: string; icon: typeof Users; tone: string }) {
  return (
    <WorkbenchCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-[#637185]">{title}</p>
          <p className={cn("mt-2 text-[26px] font-black", tone)}>{value}</p>
          <p className="text-[11px] font-medium text-[#8b9aae]">{helper}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff]">
          <Icon className="h-5 w-5 text-[#2f6fe8]" />
        </div>
      </div>
    </WorkbenchCard>
  );
}

function LayoutControls({
  layout,
  onToggle,
  onReset,
}: {
  layout: LayoutState;
  onToggle: (key: LayoutKey) => void;
  onReset: () => void;
}) {
  return (
    <WorkbenchCard className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#2f6fe8]">
            <PanelTop className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[15px] font-black">版面控制</h2>
            <p className="text-[12px] font-bold text-[#8b9aae]">主管可依現場需求開關 Dashboard widget。</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {layoutOptions.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-[8px] border px-3 text-[12px] font-black transition",
                layout[key]
                  ? "border-[#bfe4ce] bg-[#eaf8ef] text-[#15935d]"
                  : "border-[#dfe7ef] bg-white text-[#8b9aae]",
              )}
            >
              <Eye className="h-4 w-4" />
              {label}
            </button>
          ))}
          <button type="button" onClick={onReset} className="min-h-9 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
            重設
          </button>
        </div>
      </div>
    </WorkbenchCard>
  );
}

export default function SupervisorDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/bff/supervisor/dashboard"], queryFn: fetchSupervisorDashboard });
  const [layout, setLayout] = useState<LayoutState>(defaultLayout);
  const visibleOperationalGrid = useMemo(
    () => [layout.staffing, layout.anomalies, layout.tasks].filter(Boolean).length,
    [layout.staffing, layout.anomalies, layout.tasks],
  );

  const toggleLayout = (key: LayoutKey) => setLayout((current) => ({ ...current, [key]: !current[key] }));

  return (
    <RoleShell title="主管儀表板" subtitle="快速掌握團隊狀態與重要事項" role="supervisor">
      {isLoading || !data ? (
        <div className="rounded-[8px] bg-white p-6 text-[14px] font-bold text-[#637185]">載入主管控制台...</div>
      ) : (
        <div className="space-y-4">
          {layout.kpis ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi title="當班人力" value={`${data.staffing.data?.active ?? 0} / ${data.staffing.data?.total ?? 0}`} helper={`在班 ${data.staffing.data?.onShift ?? 0} 人　缺班 ${data.staffing.data?.absent ?? 0} 人`} icon={Users} tone="text-[#15935d]" />
              <Kpi title="待審核異常" value={`${data.pendingAnomalies.data?.length ?? 0}`} helper="需儘速處理" icon={AlertCircle} tone="text-[#ff4964]" />
              <Kpi title="未完成交班" value={`${data.incompleteTasks.data?.length ?? 0}`} helper="待回報 / 待完成" icon={ClipboardList} tone="text-[#10233f]" />
              <Kpi title="未確認公告人數" value={`${data.announcementAcks.data?.unconfirmed ?? 0}`} helper="需補強通知" icon={Megaphone} tone="text-[#ef7d22]" />
              <Kpi title="今日剩餘交接" value={`${data.handoverOverview.data?.open ?? 0}`} helper="提醒 / 服務 / 櫃台" icon={CheckSquare} tone="text-[#2f6fe8]" />
            </div>
          ) : null}

          {visibleOperationalGrid > 0 ? (
          <div className={cn("grid gap-4", visibleOperationalGrid === 1 ? "xl:grid-cols-1" : visibleOperationalGrid === 2 ? "xl:grid-cols-2" : "xl:grid-cols-[1fr_1.2fr_1.2fr]")}>
            {layout.staffing ? (
            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-black">人力狀態總覽</h2>
                <button className="text-[11px] font-black text-[#007166]">查看全部 →</button>
              </div>
              <div className="grid gap-5 sm:grid-cols-[120px_1fr] xl:grid-cols-1">
                <div className="mx-auto grid h-[120px] w-[120px] place-items-center rounded-full border-[18px] border-[#2f6fe8] bg-white">
                  <div className="text-center">
                    <p className="text-[24px] font-black">{data.staffing.data?.active}</p>
                    <p className="text-[11px] font-bold text-[#8b9aae]">在線</p>
                  </div>
                </div>
                <div className="space-y-3 text-[13px] font-bold">
                  {[
                    ["現職", `${data.staffing.data?.active ?? 0} 人`, "Ragic", "bg-[#2f6fe8]"],
                    ["當班", `${data.staffing.data?.onShift ?? 0} 人`, "排班", "bg-[#45b76b]"],
                    ["未當班", `${data.staffing.data?.absent ?? 0} 人`, "推估", "bg-[#ff4964]"],
                  ].map(([label, count, pct, color]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className={cn("h-2 w-2 rounded-full", color)} />
                      <span className="flex-1">{label}</span>
                      <span className="text-[#637185]">{count}</span>
                      <span className="text-[#8b9aae]">{pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </WorkbenchCard>
            ) : null}

            {layout.anomalies ? (
            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-black">待審核異常</h2>
                <button className="text-[11px] font-black text-[#007166]">查看全部 →</button>
              </div>
              <div className="space-y-3">
                {data.pendingAnomalies.data?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-[8px] bg-[#fbfcfd] p-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-[#fff1e7] text-[12px] font-black text-[#ef7d22]">{item.employeeName.slice(0, 1)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black">{item.employeeName}　{item.issue}</p>
                      <p className="text-[11px] text-[#8b9aae]">遲到 {item.waitingMinutes} 分鐘</p>
                    </div>
                    <span className="rounded-[4px] bg-[#ffe8eb] px-2 py-1 text-[10px] font-black text-[#ff4964]">高</span>
                  </div>
                ))}
              </div>
            </WorkbenchCard>
            ) : null}

            {layout.tasks ? (
            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-black">未完成交班 Top 5</h2>
                <button className="text-[11px] font-black text-[#007166]">查看全部 →</button>
              </div>
              <div className="space-y-3">
                {data.incompleteTasks.data?.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 text-[13px]">
                    <span className={cn("h-2 w-2 rounded-full", task.priority === "high" ? "bg-[#ff4964]" : "bg-[#15935d]")} />
                    <span className="min-w-0 flex-1 truncate font-bold">{task.title}</span>
                    <span className={cn("rounded-[4px] px-2 py-1 text-[10px] font-black", task.priority === "high" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#eaf8ef] text-[#15935d]")}>{task.priority === "high" ? "高" : "低"}</span>
                  </div>
                ))}
              </div>
            </WorkbenchCard>
            ) : null}
          </div>
          ) : null}

          {(layout.quickActions || layout.activity) ? (
          <div className={cn("grid gap-4", layout.quickActions && layout.activity ? "xl:grid-cols-[1.3fr_0.7fr]" : "xl:grid-cols-1")}>
            {layout.quickActions ? (
            <WorkbenchCard className="p-5">
              <h2 className="mb-4 text-[15px] font-black">快速操作</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {["新增交班", "指派交接", "發布公告", "交接紀錄", "新增活動", "異常審核"].map((label, index) => (
                  <button key={label} className="min-h-[72px] rounded-[8px] bg-[#fbfcfd] p-3 text-[12px] font-black text-[#263b56] hover:bg-white hover:shadow">
                    <CalendarDays className={cn("mx-auto mb-2 h-5 w-5", index % 2 ? "text-[#ff4964]" : "text-[#2f6fe8]")} />
                    {label}
                  </button>
                ))}
              </div>
            </WorkbenchCard>
            ) : null}
            {layout.activity ? (
            <WorkbenchCard className="p-5">
              <h2 className="mb-4 text-[15px] font-black">近期活動</h2>
              {data.campaigns.data?.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-[8px] bg-[#f7f9fb] p-3">
                  <div className="h-14 w-20 rounded-[8px] bg-gradient-to-br from-[#0d7f77] to-[#9dd84f]" />
                  <div>
                    <p className="text-[13px] font-black">{item.title}</p>
                    <p className="text-[11px] text-[#8b9aae]">{item.effectiveRange}</p>
                  </div>
                </div>
              ))}
            </WorkbenchCard>
            ) : null}
          </div>
          ) : null}
        </div>
      )}
    </RoleShell>
  );
}
