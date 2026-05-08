import { useQuery } from "@tanstack/react-query";
import type { HomeCardDto } from "@shared/modules";
import { Camera, ClipboardList, Droplets, PackageSearch, Waves } from "lucide-react";
import { apiGet } from "@/shared/api/client";
import { FacilityGate } from "@/shared/auth/facility-gate";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { FloatingQuickActionsPanel, type FloatingQuickActionItem } from "@/modules/workbench/floating-quick-actions";
import { LifeguardShell } from "../lifeguard-shell";

const fetchLifeguardHome = () => apiGet<{ cards: HomeCardDto[]; facility: { key: string; name: string } }>("/api/bff/lifeguard/home");
const lifeguardQuickActions: FloatingQuickActionItem[] = [
  { label: "水質檢測照片回傳", helper: "拍照與數值紀錄", href: "/lifeguard/log", Icon: Droplets },
  { label: "教練下水拍照記錄", helper: "下水確認留存", href: "/lifeguard/log", Icon: Camera },
  { label: "下班打掃照片傳送", helper: "收班前回報", href: "/lifeguard/log", Icon: ClipboardList },
  { label: "水道事項", helper: "租借與異常註記", href: "/lifeguard/log", Icon: Waves },
  { label: "失物招領登記", helper: "拾獲物件紀錄", href: "/lifeguard/log", Icon: PackageSearch },
];

function LifeguardHomeContent() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/bff/lifeguard/home"], queryFn: fetchLifeguardHome });
  const cards = data?.cards ?? [];
  const primaryIds = new Set(["shift-reminder", "lifeguard-log", "handover"]);
  const primaryCards = cards.filter((card) => primaryIds.has(card.moduleId));
  const secondaryCards = cards.filter((card) => !primaryIds.has(card.moduleId));

  return (
    <LifeguardShell title="救生員工作台" subtitle="值勤班表、救生員日誌、交接與公告都從這裡進入。">
      {isLoading ? (
        <div className="rounded-[8px] bg-white p-6 text-[13px] font-bold text-[#637185]">載入救生工作台...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {primaryCards.map((card) => (
              <a key={card.moduleId} href={card.routePath ?? "/lifeguard"} className="block">
                <WorkbenchCard className="h-full min-h-[132px] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-42px_rgba(15,34,58,0.5)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1cb4a3]">{card.moduleId}</p>
                  <h2 className="mt-2 text-[18px] font-black text-[#10233f]">{card.title}</h2>
                  <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-6 text-[#637185]">{card.subtitle ?? card.sourceStatus.errorMessage ?? "已納入救生員工作台。"}</p>
                </WorkbenchCard>
              </a>
            ))}
          </div>
          <WorkbenchCard className="p-4 xl:hidden">
            <h2 className="text-[15px] font-black text-[#10233f]">今日救生作業</h2>
              <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-5">
                {lifeguardQuickActions.map((action) => {
                  const Icon = action.Icon;
                  return (
                    <a
                      key={action.label}
                      href={action.href}
                      className="workbench-focus flex min-h-[58px] items-center gap-3 rounded-[8px] border border-[#dfe7ef] bg-[#fbfcfd] px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-[#b7c7d8] hover:bg-white"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#e8fbf7] text-[#007166]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-black text-[#10233f]">{action.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] font-bold text-[#8b9aae]">{action.helper}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
          </WorkbenchCard>
          <FloatingQuickActionsPanel eyebrow="Floating Actions" title="今日救生作業" items={lifeguardQuickActions} tone="green" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {secondaryCards.map((card) => (
              <a key={card.moduleId} href={card.routePath ?? "/lifeguard"} className="block">
                <WorkbenchCard className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-42px_rgba(15,34,58,0.5)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1cb4a3]">{card.moduleId}</p>
                  <h2 className="mt-2 text-[16px] font-black text-[#10233f]">{card.title}</h2>
                  <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-6 text-[#637185]">{card.subtitle ?? card.sourceStatus.errorMessage ?? "已納入救生員工作台。"}</p>
                </WorkbenchCard>
              </a>
            ))}
          </div>
        </div>
      )}
    </LifeguardShell>
  );
}

export default function LifeguardHomePage() {
  return (
    <FacilityGate
      role="lifeguard"
      title="選擇今日救生場館"
      subtitle="救生端會先確認 activeFacility，確認後才載入今日班別、水質、拍照回傳、交接、失物與水道事項。"
      compact
    >
      <LifeguardHomeContent />
    </FacilityGate>
  );
}
