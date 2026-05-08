import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/shared/api/client";
import { useAuthMe } from "@/shared/auth/session";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { LifeguardShell } from "../lifeguard-shell";

type LifeguardTodayDto = {
  workDate: string;
  shiftType: "morning" | "noon" | "night";
  progress: { totalRequired: number; totalCompleted: number; handoverPending: number };
  sections: { handover: Array<{ id: number; content: string; authorName: string; createdAt: string }> };
};

const todayInTaipei = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

export default function LifeguardLogPage() {
  const { data: session } = useAuthMe();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const facilityKey = session?.activeFacility ?? "xinbei_pool";
  const workDate = todayInTaipei();
  const shiftType = "morning";
  const queryKey = useMemo(() => ["/api/work-logs/today", facilityKey, workDate, shiftType], [facilityKey, workDate, shiftType]);
  const today = useQuery({
    queryKey,
    queryFn: () => apiGet<LifeguardTodayDto>(`/api/work-logs/today?facilityKey=${encodeURIComponent(facilityKey)}&workDate=${workDate}&shiftType=${shiftType}&moduleType=lifeguard`),
    enabled: Boolean(session),
  });
  const createHandover = useMutation({
    mutationFn: () => apiPost("/api/work-logs/handover", {
      facilityKey,
      workDate,
      fromShift: shiftType,
      toShift: "noon",
      category: "general",
      content,
      isImportant: false,
      needsAttention: false,
    }),
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return (
    <LifeguardShell title="救生員日誌" subtitle="記錄今日水質、交接事項與值勤日報，寫入後會留下 audit row。">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <WorkbenchCard className="p-5">
          <h2 className="text-[16px] font-black text-[#10233f]">今日進度</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[8px] bg-[#f7fbff] p-4">
              <p className="text-[12px] font-bold text-[#637185]">必填項目</p>
              <p className="mt-2 text-[24px] font-black text-[#10233f]">{today.data?.progress.totalRequired ?? 0}</p>
            </div>
            <div className="rounded-[8px] bg-[#f2fbf4] p-4">
              <p className="text-[12px] font-bold text-[#637185]">已完成</p>
              <p className="mt-2 text-[24px] font-black text-[#15935d]">{today.data?.progress.totalCompleted ?? 0}</p>
            </div>
            <div className="rounded-[8px] bg-[#fbfcfd] p-4">
              <p className="text-[12px] font-bold text-[#637185]">待確認交接</p>
              <p className="mt-2 text-[24px] font-black text-[#536175]">{today.data?.progress.handoverPending ?? 0}</p>
            </div>
          </div>
        </WorkbenchCard>
        <WorkbenchCard className="p-5">
          <h2 className="text-[16px] font-black text-[#10233f]">新增交接紀錄</h2>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-4 min-h-[140px] w-full resize-none rounded-[8px] border border-[#dfe7ef] bg-white p-4 text-[14px] font-bold leading-7 text-[#10233f] outline-none focus:border-[#1cb4a3]"
            placeholder="輸入救生交接、注意事項或異常補充..."
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!content.trim() || createHandover.isPending}
              onClick={() => createHandover.mutate()}
              className="min-h-10 rounded-[8px] bg-[#0d2a50] px-4 text-[12px] font-black text-white disabled:opacity-50"
            >
              {createHandover.isPending ? "寫入中..." : "新增日誌交接"}
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {(today.data?.sections.handover ?? []).slice(0, 5).map((item) => (
              <article key={item.id} className="rounded-[8px] border border-[#e6edf4] bg-[#fbfcfd] p-3">
                <p className="text-[13px] font-bold leading-6 text-[#10233f]">{item.content}</p>
                <p className="mt-1 text-[11px] font-bold text-[#8b9aae]">{item.authorName} · {item.createdAt}</p>
              </article>
            ))}
          </div>
        </WorkbenchCard>
      </div>
    </LifeguardShell>
  );
}
