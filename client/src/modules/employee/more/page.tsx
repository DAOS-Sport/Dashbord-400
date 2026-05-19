import { Link, useLocation } from "wouter";
import { NotConnectedCard } from "@/components/shared/not-connected-card";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

const pendingSurfaces: Record<string, { title: string; helper: string; helpLink?: string }> = {
  "/employee/registration-courses": {
    title: "報名 / 課程",
    helper: "booking provider 尚未接通；目前只顯示等待接通狀態，不顯示假課程。",
  },
};

export default function EmployeeMorePage() {
  const [location] = useLocation();

  const surface = pendingSurfaces[location] ?? {
    title: "更多功能",
    helper: "此入口正在收斂到正式模組，請先使用常用文件與首頁導航。",
  };

  return (
    <EmployeeShell title={surface.title} subtitle="外部資料源待接通時維持可見，但不顯示 mock 資料。">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <WorkbenchCard className="p-5">
          <NotConnectedCard title={surface.title} reason="external_pending" helpLink={surface.helpLink} />
          <p className="mt-4 text-[13px] font-bold leading-6 text-[#637185]">{surface.helper}</p>
        </WorkbenchCard>
        <WorkbenchCard className="h-fit p-5">
          <h2 className="text-[16px] font-black text-[#10233f]">可先使用</h2>
          <div className="mt-3 grid gap-2">
            <Link href="/employee/documents" className="workbench-focus rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[13px] font-black text-[#0d2a50]">
              常用文件
            </Link>
            <Link href="/employee/activity-periods" className="workbench-focus rounded-[8px] border border-[#dfe7ef] bg-white px-3 py-2 text-[13px] font-black text-[#0d2a50]">
              活動檔期 / 課程快訊
            </Link>
          </div>
        </WorkbenchCard>
      </div>
    </EmployeeShell>
  );
}
