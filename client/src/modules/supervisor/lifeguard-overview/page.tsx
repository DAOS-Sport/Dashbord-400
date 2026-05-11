import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ClipboardList, Droplets, PackageSearch, Waves } from "lucide-react";
import { apiGet, apiPost } from "@/shared/api/client";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { SupervisorModuleShell } from "../module-shell";

type Row = Record<string, string | number | null | boolean | Record<string, unknown>>;

interface OverviewPayload {
  waterQuality: Row[];
  coachDive: Row[];
  cleanup: Row[];
  laneIssues: Row[];
  lostItems: Row[];
}

function PhotoGrid({ title, items, icon: Icon }: { title: string; items: Row[]; icon: typeof Camera }) {
  return (
    <WorkbenchCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#15935d]" />
        <h2 className="text-[16px] font-black text-[#10233f]">{title}</h2>
        <span className="ml-auto rounded-full bg-[#f2f5f8] px-2 py-1 text-[11px] font-black text-[#536175]">{items.length}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, 6).map((item) => (
          <a key={String(item.id)} href={String(item.photoUrl)} target="_blank" rel="noreferrer" className="rounded-[12px] border border-[#dfe7ef] bg-[#fbfcfd] p-3">
            {item.photoUrl ? <img src={String(item.photoUrl)} alt={title} className="h-36 w-full rounded-[10px] object-cover" /> : null}
            <p className="mt-3 text-[13px] font-black text-[#10233f]">{String(item.createdBy ?? "未知救生員")}</p>
            <p className="text-[11px] font-bold text-[#8b9aae]">{String(item.createdAt ?? "")}</p>
          </a>
        ))}
        {!items.length ? <div className="rounded-[12px] bg-[#f7f9fb] p-6 text-center text-[13px] font-bold text-[#637185]">今日尚無紀錄。</div> : null}
      </div>
    </WorkbenchCard>
  );
}

export default function SupervisorLifeguardOverviewPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["/api/bff/supervisor/lifeguard-overview"], queryFn: () => apiGet<OverviewPayload>("/api/bff/supervisor/lifeguard-overview") });
  const claim = useMutation({
    mutationFn: (id: number) => apiPost(`/api/bff/lifeguard/lost-and-found/${id}/claim`, { claimedByName: window.prompt("認領人姓名") || "", claimedByContact: window.prompt("聯絡方式") || "", claimNote: "主管端處理" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/lifeguard-overview"] }),
  });
  const dispose = useMutation({
    mutationFn: (id: number) => apiPost(`/api/bff/lifeguard/lost-and-found/${id}/dispose`, { disposedReason: window.prompt("廢棄原因") || "主管端標記廢棄" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bff/supervisor/lifeguard-overview"] }),
  });

  return (
    <SupervisorModuleShell moduleId="supervisor-lifeguard-overview" title="救生紀錄總覽" eyebrow="LIFEGUARD OBSERVER" description="查看授權場館內救生照片、水道事項與失物招領狀態。" layoutMode="wide">
      {isLoading ? <WorkbenchCard className="p-6 text-[13px] font-bold text-[#637185]">載入救生紀錄...</WorkbenchCard> : (
        <div className="space-y-4">
          <PhotoGrid title="今日水質檢測" items={data?.waterQuality ?? []} icon={Droplets} />
          <PhotoGrid title="今日教練下水紀錄" items={data?.coachDive ?? []} icon={Camera} />
          <PhotoGrid title="今日打掃紀錄" items={data?.cleanup ?? []} icon={ClipboardList} />
          <div className="grid gap-4 xl:grid-cols-2">
            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center gap-2"><Waves className="h-4 w-4 text-[#5134b0]" /><h2 className="text-[16px] font-black">水道事項</h2></div>
              <div className="space-y-2">
                {(data?.laneIssues ?? []).map((item) => (
                  <button key={String(item.id)} onClick={() => setSelected(item)} className="block w-full rounded-[10px] bg-[#fbfcfd] p-3 text-left text-[13px] font-bold text-[#10233f]">{String(item.content ?? "")}</button>
                ))}
                {!data?.laneIssues?.length ? <p className="rounded-[10px] bg-[#f7f9fb] p-5 text-center text-[13px] font-bold text-[#637185]">尚無水道事項。</p> : null}
              </div>
            </WorkbenchCard>
            <WorkbenchCard className="p-5">
              <div className="mb-4 flex items-center gap-2"><PackageSearch className="h-4 w-4 text-[#9f2434]" /><h2 className="text-[16px] font-black">失物招領待處理</h2></div>
              <div className="space-y-2">
                {(data?.lostItems ?? []).slice(0, 5).map((item) => (
                  <div key={String(item.id)} className="rounded-[10px] bg-[#fbfcfd] p-3">
                    <p className="text-[13px] font-black text-[#10233f]">{String(item.itemDescription ?? "未命名失物")}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button onClick={() => claim.mutate(Number(item.id))} className="min-h-9 rounded-[8px] bg-[#15935d] text-[12px] font-black text-white">認領</button>
                      <button onClick={() => dispose.mutate(Number(item.id))} className="min-h-9 rounded-[8px] bg-[#fff1f3] text-[12px] font-black text-[#9f2434]">廢棄</button>
                    </div>
                  </div>
                ))}
                {!data?.lostItems?.length ? <p className="rounded-[10px] bg-[#f7f9fb] p-5 text-center text-[13px] font-bold text-[#637185]">無待處理失物。</p> : null}
              </div>
            </WorkbenchCard>
          </div>
        </div>
      )}
      {selected ? (
        <div className="fixed inset-0 z-50 bg-[#10233f]/30 p-4" onClick={() => setSelected(null)}>
          <div className="ml-auto h-full max-w-lg overflow-auto rounded-[12px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[18px] font-black text-[#10233f]">紀錄詳情</h2>
            <pre className="mt-4 whitespace-pre-wrap rounded-[8px] bg-[#f7f9fb] p-3 text-[12px]">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </SupervisorModuleShell>
  );
}
