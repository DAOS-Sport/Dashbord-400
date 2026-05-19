import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { useAuthMe } from "@/shared/auth/session";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

type FacilityGateProps = {
  role: "employee" | "lifeguard";
  title: string;
  subtitle: string;
  children: ReactNode;
  compact?: boolean;
};

export function FacilityGate({ children }: FacilityGateProps) {
  const { data: session, isLoading } = useAuthMe();
  const granted = session?.grantedFacilities ?? [];

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

  return <>{children}</>;
}
