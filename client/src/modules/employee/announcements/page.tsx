import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Megaphone, Search } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { useAuthMe } from "@/shared/auth/session";
import { cn } from "@/lib/utils";
import { acknowledgeEmployeeAnnouncement, fetchEmployeeHome } from "../home/api";

export default function EmployeeAnnouncementsPage() {
  const auth = useAuthMe();
  const facilityKey = auth.data?.activeFacility ?? "xinbei_pool";
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const { data, isLoading, isError } = useQuery({ queryKey: ["/api/bff/employee/home", "announcements"], queryFn: fetchEmployeeHome });
  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeEmployeeAnnouncement(id, facilityKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bff/employee/home", "announcements"] });
    },
  });

  const announcements = data?.announcements.data ?? [];
  const required = announcements.filter((item) => item.priority === "required").length;
  const unconfirmedRequired = announcements.filter((item) => item.priority === "required" && !item.isAcknowledged).length;
  const filteredAnnouncements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return announcements;
    return announcements.filter((item) =>
      `${item.title} ${item.summary ?? ""} ${item.content ?? ""} ${item.effectiveRange ?? ""}`.toLowerCase().includes(normalizedQuery),
    );
  }, [announcements, query]);

  return (
    <EmployeeShell title="群組公告" subtitle="員工端僅提供搜尋、閱讀與必讀公告確認；發布與審核保留在主管與系統端。">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">公告總數</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#10233f]">{announcements.length}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">必讀未確認</p>
            <p data-fluid-number className="mt-2 text-[28px] font-black text-[#ff4964]">{unconfirmedRequired}</p>
          </WorkbenchCard>
          <WorkbenchCard className="p-4">
            <p className="text-[12px] font-bold text-[#637185]">資料狀態</p>
            <p className="mt-2 text-[22px] font-black text-[#15935d]">{data?.announcements.status ?? "loading"}</p>
          </WorkbenchCard>
        </div>

        <WorkbenchCard tone="navy" className="p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-white/12 text-[#9dd84f]">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-black text-white">必讀公告</h2>
                <p className="text-[12px] font-bold text-white/60">{required} 則必讀，{filteredAnnouncements.length} 則符合篩選</p>
              </div>
            </div>
            <label className="flex min-h-10 items-center gap-2 rounded-[8px] bg-white px-3 text-[#10233f] lg:min-w-80">
              <Search className="h-4 w-4 shrink-0 text-[#637185]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋公告標題或內容"
                className="workbench-focus min-h-9 flex-1 bg-transparent text-[13px] font-bold outline-none"
              />
            </label>
          </div>
          {isLoading ? (
            <div className="rounded-[8px] bg-white/10 p-4 text-[13px] font-bold text-white">載入公告中...</div>
          ) : isError ? (
            <div className="rounded-[8px] bg-white/10 p-4 text-[13px] font-bold text-[#ffd0d8]">公告資料暫時無法取得。</div>
          ) : (
            <div className="space-y-3">
              {filteredAnnouncements.map((item) => (
                <article key={item.id} className="rounded-[8px] bg-white p-4 text-[#10233f]">
                  <div className="flex items-start gap-3">
                    <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#2f6fe8]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-black leading-5">{item.title}</h3>
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", item.priority === "required" ? "bg-[#ffe8eb] text-[#ff4964]" : "bg-[#fff1e7] text-[#ef7d22]")}>
                          {item.priority === "required" ? "必讀" : "提醒"}
                        </span>
                        {item.isAcknowledged ? <span className="rounded-full bg-[#edf7f4] px-2 py-1 text-[10px] font-black text-[#007166]">已確認</span> : null}
                      </div>
                      <p className="mt-2 text-[12px] font-black text-[#8b9aae]">結束時間：{item.deadlineLabel ?? item.effectiveRange ?? "未設定"}</p>
                      <p className="mt-2 whitespace-pre-wrap text-[13px] font-medium leading-6 text-[#536175]">{item.content || item.summary}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#8b9aae]">
                          {item.isAcknowledged && item.acknowledgedAt ? `確認於 ${new Date(item.acknowledgedAt).toLocaleString("zh-TW")}` : item.effectiveRange}
                        </span>
                        <button
                          type="button"
                          disabled={ackMutation.isPending || item.isAcknowledged}
                          onClick={() => ackMutation.mutate(item.id)}
                          className={cn(
                            "workbench-focus inline-flex min-h-9 items-center gap-2 rounded-[8px] px-3 text-[12px] font-black disabled:cursor-not-allowed",
                            item.isAcknowledged ? "bg-[#edf7f4] text-[#007166]" : "bg-[#10233f] text-white",
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {item.isAcknowledged ? "已確認" : "確認已讀"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {!filteredAnnouncements.length ? <div className="rounded-[8px] bg-white/10 p-6 text-center text-[13px] font-bold text-white">目前沒有符合條件的公告。</div> : null}
            </div>
          )}
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
