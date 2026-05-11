import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, CheckCircle2 } from "lucide-react";
import { useAuthMe, useSwitchFacility } from "@/shared/auth/session";
import { useFacilityLabelMap } from "@/shared/auth/facility-labels";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";
import { cn } from "@/lib/utils";

type FacilityGateProps = {
  role: "employee" | "lifeguard";
  title: string;
  subtitle: string;
  children: ReactNode;
  compact?: boolean;
};

const confirmationKeyFor = (role: FacilityGateProps["role"], facilityKey: string) =>
  `junsi.cms.${role}.facility-confirmed.${facilityKey}`;

export function FacilityGate({ role, title, subtitle, children, compact = false }: FacilityGateProps) {
  const { data: session, isLoading } = useAuthMe();
  const switchFacility = useSwitchFacility();
  const granted = session?.grantedFacilities ?? [];
  const facilityLabels = useFacilityLabelMap(granted);
  const activeFacility = session?.activeFacility && granted.includes(session.activeFacility) ? session.activeFacility : undefined;
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const activeConfirmationKey = activeFacility ? confirmationKeyFor(role, activeFacility) : undefined;
  const confirmed = Boolean(activeConfirmationKey && confirmedKey === activeConfirmationKey);

  useEffect(() => {
    if (!activeConfirmationKey || typeof window === "undefined") {
      setConfirmedKey(null);
      return;
    }
    setConfirmedKey(window.sessionStorage.getItem(activeConfirmationKey) === "1" ? activeConfirmationKey : null);
  }, [activeConfirmationKey]);

  const facilities = useMemo(
    () => granted.map((key) => ({ key, name: facilityLabels.getFacilityName(key) })),
    [granted, facilityLabels.data?.items],
  );

  const confirmFacility = async (facilityKey: string) => {
    if (!facilityKey) return;
    if (facilityKey !== session?.activeFacility) {
      await switchFacility.mutateAsync(facilityKey);
    }
    const key = confirmationKeyFor(role, facilityKey);
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, "1");
    setConfirmedKey(key);
  };

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f4f7fb] p-6">
        <div className="w-full max-w-sm rounded-[8px] bg-white px-5 py-4 shadow-lg">
          <DreamLoader compact label="場館授權讀取中" />
        </div>
      </div>
    );
  }

  if (!granted.length) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f4f7fb] p-6">
        <WorkbenchCard className="w-full max-w-md p-6 text-center">
          <Building2 className="mx-auto h-10 w-10 text-[#8b9aae]" />
          <h1 className="mt-4 text-[20px] font-black text-[#10233f]">無可用場館</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#637185]">目前帳號沒有授權場館，請由主管或系統管理員調整場館權限後再進入工作台。</p>
        </WorkbenchCard>
      </div>
    );
  }

  if (!confirmed) {
    return (
      <div className="min-h-dvh bg-[#f4f7fb] px-4 py-8 sm:px-6 lg:px-8">
        <div className={cn("mx-auto w-full", compact ? "max-w-2xl" : "max-w-4xl")}>
          <div className="mb-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1cb4a3]">{role === "lifeguard" ? "LIFEGUARD" : "EMPLOYEE"}</p>
            <h1 className="mt-2 text-[28px] font-black leading-tight text-[#10233f] sm:text-[34px]">{title}</h1>
            <p className="mt-2 max-w-2xl text-[14px] font-medium leading-6 text-[#637185]">{subtitle}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {facilities.map((facility) => {
              const active = facility.key === activeFacility;
              return (
                <button
                  key={facility.key}
                  type="button"
                  onClick={() => confirmFacility(facility.key)}
                  disabled={switchFacility.isPending}
                  className={cn(
                    "workbench-focus min-h-[112px] rounded-[8px] border bg-white p-4 text-left shadow-[0_18px_45px_-38px_rgba(15,34,58,0.45)] transition hover:-translate-y-0.5",
                    active ? "border-[#1cb4a3]" : "border-[#dfe7ef]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#eef5ff] text-[#1f6fd1]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    {active ? <CheckCircle2 className="h-5 w-5 text-[#15935d]" /> : null}
                  </div>
                  <p className="mt-4 text-[16px] font-black text-[#10233f]">{facility.name}</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8b9aae]">{active ? "目前選取，點擊開始今日作業" : "切換到此場館並開始今日作業"}</p>
                </button>
              );
            })}
          </div>
          {switchFacility.isPending ? <p className="mt-4 text-[12px] font-bold text-[#637185]">場館切換中...</p> : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
