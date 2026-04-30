import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock3, Megaphone } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { useAuthMe } from "@/shared/auth/session";
import { fetchEmployeeHome, fetchEmployeeShiftBoard } from "../home/api";

const formatShiftTime = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
};

export default function EmployeeShiftPage() {
  const { data: session } = useAuthMe();
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const shiftQuery = useQuery({ queryKey: ["/api/bff/employee/shifts/today", facilityKey], queryFn: () => fetchEmployeeShiftBoard(facilityKey) });
  const homeQuery = useQuery({ queryKey: ["/api/bff/employee/home", "shift"], queryFn: fetchEmployeeHome });
  const campaigns = homeQuery.data?.campaigns.data ?? [];
  const board = shiftQuery.data;
  const shifts = board?.shifts ?? [];

  return (
    <EmployeeShell title="今日班表" subtitle="班表由 Smart Schedule / schedule integration 透過 BFF 唯讀呈現。">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <WorkbenchCard className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="workbench-icon-tile grid h-10 w-10 place-items-center rounded-[8px] text-[#2f6fe8]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h2 className="text-[15px] font-black text-[#10233f]">班表狀態</h2>
          </div>
          {shiftQuery.isLoading ? (
            <div className="rounded-[8px] bg-[#fbfcfd] p-4 text-[13px] font-bold text-[#637185]">載入班表中...</div>
          ) : shiftQuery.isError || !board?.sourceStatus.connected ? (
            <div className="rounded-[8px] bg-[#fff7f8] p-4 text-[13px] font-bold text-[#ff4964]">班表資料暫時無法取得。</div>
          ) : shifts.length ? (
            <div className="space-y-4">
              {shifts.map((shift) => (
                <div key={shift.shiftId} className={cn("rounded-[8px] border p-4", shift.isCurrent ? "border-[#9dd84f] bg-[#f1fbec]" : "border-[#e6edf4] bg-[#fbfcfd]")}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={cn("font-black text-[#10233f]", shift.isCurrent ? "text-[18px]" : "text-[15px]")}>
                        {formatShiftTime(shift.start)} – {formatShiftTime(shift.end)}
                      </p>
                      <p className="mt-1 text-[12px] font-bold text-[#637185]">{board.facility.name}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-1 text-[11px] font-black", shift.isCurrent ? "bg-[#15935d] text-white" : "bg-[#eef2f6] text-[#637185]")}>
                      {shift.isCurrent ? "目前班別" : shift.isFuture ? "未來" : "已結束"}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {shift.people.map((person) => (
                      <div key={`${shift.shiftId}-${person.userId}-${person.name}`} className={cn("rounded-[8px] bg-white px-3 py-2 text-[13px] font-bold", person.isCurrentUser ? "text-[#007166]" : "text-[#263b56]")}>
                        {person.name}{person.isCurrentUser ? "（你）" : ""} / {person.role}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-[8px] bg-[#eef5ff] px-3 py-2 text-[13px]">
                <span className="font-bold text-[#637185]">本日出勤</span>
                <span className="font-black text-[#10233f]">{board.totalCount} 人</span>
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">今日尚無班表</div>
          )}
        </WorkbenchCard>

        <WorkbenchCard className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="workbench-icon-tile grid h-10 w-10 place-items-center rounded-[8px] text-[#2f6fe8]">
              <Megaphone className="h-5 w-5" />
            </div>
            <h2 className="text-[15px] font-black text-[#10233f]">活動檔期 / 課程快訊</h2>
          </div>
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className="flex items-center gap-3 rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-4">
                <Clock3 className="h-5 w-5 shrink-0 text-[#ef7d22]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-black text-[#10233f]">{campaign.title}</p>
                  <p className="mt-1 text-[12px] font-bold text-[#637185]">{campaign.effectiveRange}</p>
                </div>
                <span className="rounded-full bg-[#eaf8ef] px-2 py-1 text-[10px] font-black text-[#15935d]">{campaign.statusLabel}</span>
              </article>
            ))}
            {!campaigns.length ? <div className="rounded-[8px] bg-[#fbfcfd] p-6 text-center text-[13px] font-bold text-[#637185]">目前沒有活動檔期 / 課程快訊。</div> : null}
          </div>
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
