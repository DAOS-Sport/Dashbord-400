import { useQuery } from "@tanstack/react-query";
import type { HomeCardDto } from "@shared/modules";
import { apiGet } from "@/shared/api/client";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { LifeguardShell } from "../lifeguard-shell";

const fetchLifeguardHome = () => apiGet<{ cards: HomeCardDto[]; facility: { key: string; name: string } }>("/api/bff/lifeguard/home");

export default function LifeguardHomePage() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/bff/lifeguard/home"], queryFn: fetchLifeguardHome });
  return (
    <LifeguardShell title="救生員工作台" subtitle="值勤班表、救生員日誌、交接與公告都從這裡進入。">
      {isLoading ? (
        <div className="rounded-[8px] bg-white p-6 text-[13px] font-bold text-[#637185]">載入救生工作台...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.cards ?? []).map((card) => (
            <a key={card.moduleId} href={card.routePath ?? "/lifeguard"} className="block">
              <WorkbenchCard className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-42px_rgba(15,34,58,0.5)]">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1cb4a3]">{card.moduleId}</p>
                <h2 className="mt-2 text-[18px] font-black text-[#10233f]">{card.title}</h2>
                <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-6 text-[#637185]">{card.subtitle ?? card.sourceStatus.errorMessage ?? "已納入救生員工作台。"}</p>
              </WorkbenchCard>
            </a>
          ))}
        </div>
      )}
    </LifeguardShell>
  );
}
