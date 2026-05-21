import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, LineChart, UsersRound } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { apiGet } from "@/shared/api/client";

type Period = "7d" | "30d";

type InsightsOverview = {
  period: { from: string; to: string; label: string };
  totalEvents: number;
  uniqueUsers: number;
  topModules: Array<{ moduleId: string; label: string; eventCount: number; uniqueUserCount: number; deltaPct: number }>;
  anomalies: Array<{ moduleId: string; label: string; type: "spike" | "drop"; deltaPct: number; currentCount: number; previousCount: number }>;
  byRole: Array<{ role: string; eventCount: number; uniqueUserCount: number }>;
  byFacility: Array<{ facilityKey: string; facilityName: string; eventCount: number }>;
};

type ModuleInsight = {
  moduleId: string;
  label: string;
  current: { eventCount: number; uniqueUserCount: number; completionRate?: number };
  previous: { eventCount: number; uniqueUserCount: number; completionRate?: number };
  delta: { eventCountPct: number; uniqueUserCountPct: number; completionRatePct?: number };
  dailyBreakdown: Array<{ date: string; eventCount: number; uniqueUserCount: number }>;
  topUsers: Array<{ userId: string; name: string; eventCount: number }>;
  topFacilities: Array<{ facilityKey: string; facilityName: string; eventCount: number }>;
};

const fetchOverview = (period: Period) =>
  apiGet<InsightsOverview>(`/api/bff/system/insights/overview?period=${period}`);

const fetchModule = (moduleId: string, period: Period) =>
  apiGet<ModuleInsight>(`/api/bff/system/insights/module/${encodeURIComponent(moduleId)}?period=${period}`);

const pct = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value}%`;
};

const trendClass = (value: number) => value < -30 ? "text-[#dc2626]" : value > 300 ? "text-[#ca8a04]" : "text-[#15935d]";

export default function SystemInsightsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const overviewQuery = useQuery({
    queryKey: ["/api/bff/system/insights/overview", period],
    queryFn: () => fetchOverview(period),
  });
  const moduleQuery = useQuery({
    queryKey: ["/api/bff/system/insights/module", selectedModuleId, period],
    queryFn: () => fetchModule(selectedModuleId!, period),
    enabled: Boolean(selectedModuleId),
  });
  const data = overviewQuery.data;
  const topModule = data?.topModules[0];
  const kpis = [
    { label: "使用次數", value: data?.totalEvents ?? 0, color: "text-[#0d2a50]", icon: BarChart3 },
    { label: "使用人數", value: data?.uniqueUsers ?? 0, color: "text-[#15935d]", icon: UsersRound },
    { label: "最常用功能", value: topModule?.eventCount ?? 0, helper: topModule?.label ?? "—", color: "text-[#0d2a50]", icon: LineChart },
    { label: "異常變化", value: data?.anomalies.length ?? 0, color: data?.anomalies.length ? "text-[#ca8a04]" : "text-[#15935d]", icon: AlertTriangle },
  ];
  const maxRole = Math.max(1, ...(data?.byRole.map((item) => item.eventCount) ?? [0]));
  const maxFacility = Math.max(1, ...(data?.byFacility.map((item) => item.eventCount) ?? [0]));

  return (
    <RoleShell role="system" title="行為洞察" subtitle="CMS 內部 · 使用狀況與功能熱度分析">
      <div className="mx-auto max-w-[1440px] space-y-3" data-testid="system-insights-page">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="inline-flex rounded-[8px] border border-[#dfe7ef] bg-white p-1" aria-label="選擇統計期間">
            {(["7d", "30d"] as Period[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={cn("min-h-9 rounded-[4px] px-4 text-[12px] font-black", period === item ? "bg-[#0d2a50] text-white" : "text-[#637185]")}
              >
                近 {item === "7d" ? "7" : "30"} 天
              </button>
            ))}
          </div>
        </div>

        {overviewQuery.isError ? (
          <div className="rounded-[8px] border border-[#ffc7cf] bg-[#fff7f8] p-3 text-[13px] font-black text-[#dc2626]">
            使用狀況資料載入失敗，請稍後重試。
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => {
            const Icon = item.icon;
            return (
              <WorkbenchCard key={item.label} className="min-h-[92px] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8b9aae]">{item.label}</p>
                  <Icon className="h-4 w-4 text-[#8b9aae]" />
                </div>
                <p className={cn("mt-2 text-[32px] font-black tabular-nums", item.color)}>{item.value}</p>
                {item.helper ? <p className="text-[12px] font-bold text-[#637185]">{item.helper}</p> : null}
              </WorkbenchCard>
            );
          })}
        </div>

        {data?.anomalies.length ? (
          <WorkbenchCard className="border-[#f2dda8] bg-[#fffdf7] p-3.5">
            <p className="text-[16px] font-black text-[#10233f]">需要注意的變化</p>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">功能使用量突然變多或變少時，會列在這裡提醒你追蹤。</p>
            <div className="mt-3 grid gap-2">
              {data.anomalies.slice(0, 5).map((item) => (
                <button
                  type="button"
                  key={item.moduleId}
                  onClick={() => setSelectedModuleId(item.moduleId)}
                  className="grid min-h-11 grid-cols-[1fr_120px_100px] items-center gap-3 rounded-[8px] border border-[#f2dda8] bg-white px-3 text-left text-[12px] font-bold"
                >
                  <span className="font-black text-[#10233f]">{item.label}</span>
                  <span className={item.type === "drop" ? "text-[#dc2626]" : "text-[#ca8a04]"}>
                    {item.type === "drop" ? "下降" : "上升"} {Math.abs(item.deltaPct)}%
                  </span>
                  <span className="text-right text-[#637185]">{item.currentCount} / {item.previousCount}</span>
                </button>
              ))}
            </div>
          </WorkbenchCard>
        ) : data && !data.anomalies.length && data.topModules.length > 0 ? (
          <WorkbenchCard className="border-[#dfe7ef] bg-[#f8fbff] p-3.5">
            <p className="text-[14px] font-black text-[#10233f]">需要注意的變化</p>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">目前比較區間內無顯著異常，系統將在下個週期自動比較使用量變化。</p>
            <p className="mt-1 text-[11px] text-[#8b9aae]">若系統剛部署或功能為首次被使用，前一週期無資料，此區塊將在資料累積後開始顯示異常。</p>
          </WorkbenchCard>
        ) : data && !data.topModules.length ? (
          <WorkbenchCard className="border-[#dfe7ef] bg-[#f8fbff] p-3.5">
            <p className="text-[14px] font-black text-[#10233f]">需要注意的變化</p>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">目前無使用紀錄，行為分析將於首次活動後開始累積。</p>
          </WorkbenchCard>
        ) : null}

        <WorkbenchCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[#edf1f6] p-3.5">
            <div>
              <p className="text-[16px] font-black text-[#10233f]">最常使用的功能</p>
              <p className="mt-1 text-[12px] font-bold text-[#637185]">點選任一功能，可查看每天使用量與主要使用者。</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead className="bg-[#f8fbff] text-[#637185]">
                <tr>
                  <th className="px-3 py-2 font-black">功能代碼</th>
                  <th className="px-3 py-2 font-black">功能名稱</th>
                  <th className="px-3 py-2 text-right font-black">使用次數</th>
                  <th className="px-3 py-2 text-right font-black">使用人數</th>
                  <th className="px-3 py-2 text-right font-black">變化</th>
                  <th className="px-3 py-2 font-black">趨勢</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topModules ?? []).map((item) => (
                  <tr
                    key={item.moduleId}
                    onClick={() => setSelectedModuleId(item.moduleId)}
                    className="h-11 cursor-pointer border-b border-[#edf1f6] transition hover:bg-[#fbfcfd]"
                  >
                    <td className="px-3 font-black text-[#10233f]">{item.moduleId}</td>
                    <td className="px-3 font-bold text-[#536175]">{item.label}</td>
                    <td className="px-3 text-right font-black tabular-nums text-[#10233f]">{item.eventCount}</td>
                    <td className="px-3 text-right font-bold tabular-nums text-[#536175]">{item.uniqueUserCount}</td>
                    <td className={cn("px-3 text-right font-black tabular-nums", trendClass(item.deltaPct))}>{pct(item.deltaPct)}</td>
                    <td className="px-3">
                      <Sparkline values={[0, Math.max(0, item.eventCount - 1), item.eventCount]} />
                    </td>
                  </tr>
                ))}
                {!data?.topModules.length ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[13px] font-bold text-[#8b9aae]">目前尚未累積使用紀錄。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </WorkbenchCard>

        <div className="grid gap-3 xl:grid-cols-2">
          <BreakdownPanel title="依角色統計" rows={data?.byRole ?? []} max={maxRole} getLabel={(row) => row.role} />
          <BreakdownPanel title="依場館統計" rows={data?.byFacility ?? []} max={maxFacility} getLabel={(row) => row.facilityName} />
        </div>

        <ModuleDetailSheet open={Boolean(selectedModuleId)} onOpenChange={(open) => !open && setSelectedModuleId(null)} detail={moduleQuery.data} isLoading={moduleQuery.isLoading} />
      </div>
    </RoleShell>
  );
}

function BreakdownPanel<T extends { eventCount: number }>({
  title,
  rows,
  max,
  getLabel,
}: {
  title: string;
  rows: T[];
  max: number;
  getLabel: (row: T) => string;
}) {
  return (
    <WorkbenchCard className="p-3.5">
      <p className="text-[16px] font-black text-[#10233f]">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.slice(0, 8).map((row, index) => (
          <div key={index} className="grid grid-cols-[120px_1fr_58px] items-center gap-3 text-[12px] font-bold">
            <span className="truncate text-[#536175]">{getLabel(row)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#edf1f6]">
              <span className="block h-full rounded-full bg-[#15935d]" style={{ width: `${Math.max(4, (row.eventCount / max) * 100)}%` }} />
            </span>
            <span className="text-right tabular-nums text-[#10233f]">{row.eventCount}</span>
          </div>
        ))}
        {!rows.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-center text-[13px] font-bold text-[#8b9aae]">尚無資料。</div> : null}
      </div>
    </WorkbenchCard>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 90 + 5},${28 - (value / max) * 22}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-24" aria-hidden="true">
      <polyline points={points} fill="none" stroke="#15935d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ModuleDetailSheet({
  open,
  onOpenChange,
  detail,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail?: ModuleInsight;
  isLoading: boolean;
}) {
  const sparkValues = useMemo(() => detail?.dailyBreakdown.map((item) => item.eventCount) ?? [], [detail]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-[#f3f6fb] p-0 sm:max-w-[520px]">
        <SheetHeader className="border-b border-[#dfe7ef] bg-white p-4 text-left">
          <SheetTitle className="text-[18px] font-black text-[#10233f]">{detail?.label ?? "功能詳細"}</SheetTitle>
          <SheetDescription className="text-[12px] font-bold text-[#637185]">
            查看每日使用量、主要使用者、主要場館與完成率。
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-4">
          {isLoading ? <div className="rounded-[8px] bg-white p-4 text-[13px] font-bold text-[#637185]">載入中...</div> : null}
          {detail ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label="使用次數" value={detail.current.eventCount} delta={detail.delta.eventCountPct} />
                <MiniMetric label="使用人數" value={detail.current.uniqueUserCount} delta={detail.delta.uniqueUserCountPct} />
                <MiniMetric label="完成率" value={detail.current.completionRate ?? "—"} delta={detail.delta.completionRatePct} suffix={typeof detail.current.completionRate === "number" ? "%" : ""} />
              </div>
              <WorkbenchCard className="p-3.5">
                <p className="text-[16px] font-black text-[#10233f]">每日趨勢</p>
                <div className="mt-3 rounded-[8px] border border-[#edf1f6] bg-[#fbfcfd] p-3">
                  <Sparkline values={sparkValues.length ? sparkValues : [0, 0, 0]} />
                </div>
                <div className="mt-3 grid gap-1 text-[12px] font-bold text-[#637185]">
                  {detail.dailyBreakdown.map((row) => (
                    <div key={row.date} className="grid grid-cols-[1fr_80px_80px]">
                      <span>{row.date}</span>
                      <span className="text-right">{row.eventCount} 次</span>
                      <span className="text-right">{row.uniqueUserCount} 人</span>
                    </div>
                  ))}
                </div>
              </WorkbenchCard>
              <WorkbenchCard className="p-3.5">
                <p className="text-[16px] font-black text-[#10233f]">主要使用者</p>
                <DetailRows rows={detail.topUsers} labelKey="name" />
              </WorkbenchCard>
              <WorkbenchCard className="p-3.5">
                <p className="text-[16px] font-black text-[#10233f]">主要場館</p>
                <DetailRows rows={detail.topFacilities} labelKey="facilityName" />
              </WorkbenchCard>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniMetric({ label, value, delta, suffix = "" }: { label: string; value: number | string; delta?: number; suffix?: string }) {
  return (
    <WorkbenchCard className="p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8b9aae]">{label}</p>
      <p className="mt-2 text-[24px] font-black tabular-nums text-[#10233f]">{value}{suffix}</p>
      <p className={cn("mt-1 text-[12px] font-black", delta === undefined ? "text-[#8b9aae]" : trendClass(delta))}>{pct(delta)}</p>
    </WorkbenchCard>
  );
}

function DetailRows<T extends { eventCount: number } & Record<string, unknown>>({ rows, labelKey }: { rows: T[]; labelKey: keyof T }) {
  if (!rows.length) return <div className="mt-3 rounded-[8px] bg-[#fbfcfd] p-4 text-center text-[13px] font-bold text-[#8b9aae]">尚無資料。</div>;
  return (
    <div className="mt-3 overflow-hidden rounded-[8px] border border-[#edf1f6]">
      {rows.map((row, index) => (
        <div key={index} className="grid min-h-11 grid-cols-[1fr_72px] items-center border-b border-[#edf1f6] px-3 text-[12px] font-bold last:border-b-0">
          <span className="truncate text-[#536175]">{String(row[labelKey] ?? "-")}</span>
          <span className="text-right font-black tabular-nums text-[#10233f]">{row.eventCount}</span>
        </div>
      ))}
    </div>
  );
}
