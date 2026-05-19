import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HomeCardDto } from "@shared/modules";
import { ArrowRight, CalendarDays, Camera, CheckCircle2, ClipboardList, Droplets, MapPin, PackageSearch, Waves, X } from "lucide-react";
import { Link } from "wouter";
import { apiGet } from "@/shared/api/client";
import { FacilityGate } from "@/shared/auth/facility-gate";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { FloatingQuickActionsPanel } from "@/modules/workbench/floating-quick-actions";
import { cn } from "@/lib/utils";
import { LifeguardShell } from "../lifeguard-shell";
import {
  lifeguardOperationDrawerConfig,
  lifeguardOperationModules,
  type LifeguardOperationModule,
  type LifeguardOperationModuleId,
} from "../operation-modules";

const fetchLifeguardHome = () => apiGet<{ cards: HomeCardDto[]; facility: { key: string; name: string } }>("/api/bff/lifeguard/home");
const fetchLifeguardRecords = () =>
  apiGet<{
    waterQuality: unknown[];
    coachDive: unknown[];
    cleanup: unknown[];
    lostItems: unknown[];
    laneIssues: unknown[];
  }>("/api/bff/lifeguard/records");
const lifeguardQuickActions = lifeguardOperationModules.map(({ label, helper, href, Icon }) => ({ label, helper, href, Icon }));

const currentShiftLabel = () => {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour >= 5 && hour < 12) return "早班";
  if (hour >= 12 && hour < 17) return "午班";
  return "晚班";
};

const currentTaipeiDateLabel = () =>
  new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

const toneClass = (tone: LifeguardOperationModule["tone"]) =>
  cn(
    tone === "green" && "bg-[#e3f7ef] text-[#116247]",
    tone === "blue" && "bg-[#e9f1ff] text-[#2456b3]",
    tone === "amber" && "bg-[#fff0d4] text-[#8a520b]",
    tone === "violet" && "bg-[#eee8ff] text-[#5134b0]",
    tone === "rose" && "bg-[#ffe4e9] text-[#9f2434]",
    tone === "slate" && "bg-[#edf2f7] text-[#536175]",
  );

function useMobileGpsStatus() {
  const [status, setStatus] = useState<"checking" | "ready" | "blocked">("checking");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 1023px)").matches) return;
    if (!navigator.geolocation) {
      setStatus("blocked");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setStatus("ready"),
      () => setStatus("blocked"),
      { enableHighAccuracy: true, timeout: 7_000, maximumAge: 60_000 },
    );
  }, []);

  return status;
}

function LifeguardOperationDrawer({
  module,
  onClose,
}: {
  module: LifeguardOperationModule;
  onClose: () => void;
}) {
  const drawer = lifeguardOperationDrawerConfig[module.id];
  const Icon = module.Icon;
  return (
    <div className="fixed inset-0 z-40 hidden bg-[#10233f]/24 backdrop-blur-[2px] lg:block" role="dialog" aria-modal="true" aria-label={drawer.title}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="關閉救生作業抽屜" onClick={onClose} />
      <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-[420px] flex-col border-l border-[#dfe7ef] bg-white shadow-[0_28px_88px_-48px_rgba(15,34,58,0.82)]">
        <div className="flex items-start justify-between gap-3 border-b border-[#edf1f6] p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#1cb4a3]">LIFEGUARD PREVIEW</p>
            <h2 className="mt-2 text-[22px] font-black text-[#10233f]">{drawer.title}</h2>
            <p className="mt-2 text-[13px] font-medium leading-6 text-[#637185]">{module.purpose}</p>
          </div>
          <button type="button" onClick={onClose} className="workbench-focus grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[#f3f7fb] text-[#536175] hover:bg-[#edf3f8]" aria-label="關閉">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-3">
            <div className={cn("grid h-16 w-16 place-items-center rounded-[8px]", toneClass(module.tone))}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="rounded-[8px] bg-[#f7f9fb] p-4">
              <p className="text-[12px] font-black text-[#10233f]">{drawer.statusLabel}</p>
              <p className="mt-2 text-[12px] font-medium leading-6 text-[#637185]">{drawer.emptyText}</p>
            </div>
            <div className="rounded-[8px] border border-dashed border-[#cfdbe8] bg-white p-4">
              <p className="text-[12px] font-black text-[#10233f]">資料狀態</p>
              <p className="mt-2 text-[12px] font-medium leading-6 text-[#637185]">此抽屜只做桌機預覽導流；手機端會直接進入詳細作業頁。</p>
            </div>
          </div>
        </div>
        <div className="border-t border-[#edf1f6] p-5">
          <Link href={module.href} className="workbench-focus flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#0d2a50] px-4 text-[13px] font-black text-white transition hover:bg-[#173c69]">
            {drawer.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function MobilePrimaryActionCard({
  module,
  cta,
  subtitle,
}: {
  module: LifeguardOperationModule;
  cta: string;
  subtitle: string;
}) {
  const Icon = module.Icon;
  return (
    <Link
      href={module.href}
      className="workbench-focus block min-h-[140px] rounded-[16px] border border-[#dfe7ef] bg-white p-4 shadow-[0_8px_24px_-12px_rgba(13,42,80,0.18)]"
    >
      <div className="flex h-full min-h-[108px] flex-col">
        <div className="flex items-start gap-4">
          <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-[14px]", toneClass(module.tone))}>
            <Icon className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-black leading-7 text-[#10233f]">{module.label}</h2>
            <p className="mt-1 text-[14px] font-medium leading-6 text-[#3d4a5f]">{subtitle}</p>
          </div>
        </div>
        <div className="mt-auto flex justify-end pt-4">
          <span className="inline-flex min-h-[48px] items-center justify-center rounded-[12px] bg-[#0d2a50] px-4 text-[16px] font-black text-white">
            {cta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function MobileLifeguardHome({
  facilityName,
  records,
}: {
  facilityName: string;
  records?: Awaited<ReturnType<typeof fetchLifeguardRecords>>;
}) {
  const gpsStatus = useMobileGpsStatus();
  const shiftLabel = currentShiftLabel();
  const waterModule = lifeguardOperationModules.find((module) => module.id === "water-quality")!;
  const coachModule = lifeguardOperationModules.find((module) => module.id === "coach-dive")!;
  const cleanupModule = lifeguardOperationModules.find((module) => module.id === "cleanup")!;
  const lostModule = lifeguardOperationModules.find((module) => module.id === "lost-and-found")!;
  const laneIssueModule = lifeguardOperationModules.find((module) => module.id === "lane-issues")!;
  const laneRentalModule = lifeguardOperationModules.find((module) => module.id === "lane-rentals")!;
  const photoModule = shiftLabel === "晚班" ? cleanupModule : coachModule;
  const gpsMeta = {
    checking: { label: "GPS 檢查中", className: "bg-[#f7c948]" },
    ready: { label: "GPS 已就緒", className: "bg-[#32d17c]" },
    blocked: { label: "GPS 未開啟", className: "bg-[#ff4964]" },
  }[gpsStatus];
  const summary = [
    ["水質檢測", records?.waterQuality?.length ?? 0],
    ["教練下水", records?.coachDive?.length ?? 0],
    ["下班打掃", records?.cleanup?.length ?? 0],
    ["失物", records?.lostItems?.length ?? 0],
  ];

  return (
    <div className="space-y-4 lg:hidden">
      <section className="rounded-[20px] bg-[#0d2a50] p-5 text-white shadow-[0_8px_24px_-12px_rgba(13,42,80,0.32)]">
        <p className="text-[28px] font-black leading-9">{shiftLabel}</p>
        <p className="mt-1 text-[22px] font-black leading-8">{facilityName}</p>
        <div className="my-4 h-px bg-white/16" />
        <div className="space-y-2 text-[14px] font-bold leading-6 text-[#dbe8f6]">
          <p className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{currentTaipeiDateLabel()}</p>
          <p className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-full", gpsMeta.className)} />{gpsMeta.label}</p>
        </div>
      </section>

      <MobilePrimaryActionCard module={waterModule} cta="立即檢測" subtitle="拍照記錄 pH 與餘氯試紙" />
      <MobilePrimaryActionCard
        module={photoModule}
        cta={photoModule.id === "cleanup" ? "立即回報" : "立即拍照"}
        subtitle={photoModule.id === "cleanup" ? "收班前完成打掃照片回報" : "記錄教練下水現場照片"}
      />
      <MobilePrimaryActionCard module={lostModule} cta="新增失物" subtitle="拾獲物品拍照、定位與登記" />

      <section className="grid grid-cols-3 gap-2">
        <Link href={laneIssueModule.href} className="workbench-focus flex min-h-[56px] flex-col items-center justify-center rounded-full border border-[#dfe7ef] bg-white px-2 text-[13px] font-black text-[#10233f]">
          <Waves className="mb-1 h-5 w-5 text-[#5134b0]" />
          水道事項
        </Link>
        <Link href={laneRentalModule.href} className="workbench-focus flex min-h-[56px] flex-col items-center justify-center rounded-full border border-[#dfe7ef] bg-white px-2 text-[13px] font-black text-[#10233f]">
          <CalendarDays className="mb-1 h-5 w-5 text-[#536175]" />
          租借狀態
        </Link>
        <Link href="/lifeguard/handover" className="workbench-focus flex min-h-[56px] flex-col items-center justify-center rounded-full border border-[#dfe7ef] bg-white px-2 text-[13px] font-black text-[#10233f]">
          <ClipboardList className="mb-1 h-5 w-5 text-[#007166]" />
          交辦
        </Link>
      </section>

      <section className="rounded-[16px] border border-[#dfe7ef] bg-white p-4 shadow-[0_8px_24px_-12px_rgba(13,42,80,0.18)]">
        <h2 className="text-[18px] font-black text-[#10233f]">今日已紀錄</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {summary.map(([label, count]) => (
            <div key={String(label)} className="rounded-[14px] bg-[#f7f9fb] p-3">
              <p className="text-[13px] font-black text-[#3d4a5f]">{label}</p>
              <p className="mt-1 font-mono text-[28px] font-black text-[#10233f]">{count}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LifeguardHomeContent() {
  const { data, isLoading } = useQuery({ queryKey: ["/api/bff/lifeguard/home"], queryFn: fetchLifeguardHome });
  const records = useQuery({ queryKey: ["/api/bff/lifeguard/records"], queryFn: fetchLifeguardRecords });
  const [selectedModuleId, setSelectedModuleId] = useState<LifeguardOperationModuleId | null>(null);
  const selectedModule = selectedModuleId ? lifeguardOperationModules.find((module) => module.id === selectedModuleId) : undefined;
  const facilityName = data?.facility.name ?? "今日救生場館";
  const desktopCards = useMemo(() => lifeguardOperationModules, []);

  return (
    <LifeguardShell title="救生員工作台" subtitle="今日救生作業、照片回傳與現場紀錄從這裡進入。">
      {isLoading ? (
        <div className="rounded-[8px] bg-white p-6 text-[13px] font-bold text-[#637185]">載入救生工作台...</div>
      ) : (
        <>
          <MobileLifeguardHome facilityName={facilityName} records={records.data} />

          <div className="hidden space-y-4 lg:block">
            <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
              <WorkbenchCard className="p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#1cb4a3]">TODAY OPS</p>
                <h2 className="mt-2 text-[22px] font-black text-[#10233f]">{facilityName}</h2>
                <p className="mt-2 text-[13px] font-medium leading-6 text-[#637185]">先確認場館與班別，再進入水質、拍照、收班、水道與失物模組。</p>
              </WorkbenchCard>
              <WorkbenchCard className="p-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[8px] bg-[#f2fbf7] p-3">
                    <p className="text-[11px] font-black text-[#637185]">班別</p>
                    <p className="mt-2 text-[18px] font-black text-[#007166]">{currentShiftLabel()}</p>
                  </div>
                  <div className="rounded-[8px] bg-[#f7f9fb] p-3">
                    <p className="text-[11px] font-black text-[#637185]">模組</p>
                    <p className="mt-2 font-mono text-[18px] font-black text-[#10233f]">{lifeguardOperationModules.length}</p>
                  </div>
                  <div className="rounded-[8px] bg-[#fffaf0] p-3">
                    <p className="text-[11px] font-black text-[#637185]">狀態</p>
                    <p className="mt-2 text-[18px] font-black text-[#8a520b]">待接線</p>
                  </div>
                </div>
              </WorkbenchCard>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {desktopCards.map((module) => {
                const Icon = module.Icon;
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => setSelectedModuleId(module.id)}
                    className="workbench-focus group min-h-[168px] rounded-[8px] border border-[#dfe7ef] bg-white p-4 text-left shadow-[0_18px_56px_-44px_rgba(15,34,58,0.62)] transition hover:-translate-y-0.5 hover:border-[#bfd0df]"
                  >
                    <span className={cn("grid h-11 w-11 place-items-center rounded-[8px]", toneClass(module.tone))}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="mt-4 block text-[15px] font-black leading-5 text-[#10233f]">{module.label}</span>
                    <span className="mt-2 line-clamp-2 block text-[12px] font-medium leading-5 text-[#637185]">{module.helper}</span>
                    <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-black text-[#007166]">
                      開啟預覽
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </button>
                );
              })}
            </div>
            <FloatingQuickActionsPanel eyebrow="Floating Actions" title="今日救生作業" items={lifeguardQuickActions} tone="green" />
            {selectedModule ? <LifeguardOperationDrawer module={selectedModule} onClose={() => setSelectedModuleId(null)} /> : null}
          </div>
        </>
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
