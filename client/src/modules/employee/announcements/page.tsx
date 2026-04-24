import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, Megaphone } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";
import { fetchEmployeeHome } from "../home/api";

export default function EmployeeAnnouncementsPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["/api/bff/employee/home", "announcements"], queryFn: fetchEmployeeHome });
  const announcements = data?.announcements.data ?? [];
  const required = announcements.filter((item) => item.priority === "required").length;

  return (
    <EmployeeShell title="群組公告" subtitle="公告固定顯示標題、結束時間與內容，來源由 400 小幫手 Internal API 映射。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">公告總數</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#10233f]">{announcements.length}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">必讀</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#ff4964]">{required}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">資料狀態</p>
            <p className="mt-2 text-[22px] font-black text-[#15935d]">{data?.announcements.status ?? "loading"}</p>
          </WorkbenchCard>
        </div>

        <WorkbenchCard tone="navy" className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-white/12 text-[#9dd84f]">
              <Megaphone className="h-5 w-5" />
            </div>
            <h2 className="text-[15px] font-black text-white">必讀公告</h2>
          </div>
          {isLoading ? (
            <div className="rounded-[8px] bg-white/10 p-4 text-[13px] font-bold text-white">載入公告中...</div>
          ) : isError ? (
            <div className="rounded-[8px] bg-white/10 p-4 text-[13px] font-bold text-[#ffd0d8]">公告資料暫時無法取得。</div>
          ) : (
            <div className="space-y-3">
              {announcements.map((item) => (
                <article key={item.id} className="rounded-[8px] bg-white p-4 text-[#10233f]">
                  <div className="flex items-start gap-3">
                    <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#2f6fe8]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-black leading-5">{item.title}</h3>
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", item.priority === "required" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#fff1e7] text-[#ef7d22]")}>
                          {item.priority === "required" ? "必讀" : "提醒"}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] font-black text-[#8b9aae]">結束時間：{item.deadlineLabel ?? item.effectiveRange}</p>
                      <p className="mt-2 text-[13px] font-medium leading-6 text-[#536175]">{item.content || item.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#8b9aae]">{item.effectiveRange}</span>
                        <button className="workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] bg-[#edf7f4] px-3 text-[12px] font-black text-[#007166]">
                          <CheckCircle2 className="h-4 w-4" />
                          已讀
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {!announcements.length ? <div className="rounded-[8px] bg-white/10 p-6 text-center text-[13px] font-bold text-white">目前沒有公告。</div> : null}
            </div>
          )}
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
