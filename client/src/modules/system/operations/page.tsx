import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { NotConnectedCard } from "@/components/shared/not-connected-card";
import { RoleShell } from "@/modules/workbench/role-shell";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

export default function SystemOperationsPage() {
  return (
    <RoleShell role="system" title="運維協助中心" subtitle="協助主管 / 救生員 / 員工處理日常系統問題">
      <div className="mx-auto max-w-[1440px] space-y-4" data-testid="system-operations-page">
        <Link href="/system" className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[12px] font-black text-[#536175]">
          <ChevronLeft className="h-4 w-4" />
          回控制中心
        </Link>
        <WorkbenchCard className="p-5">
          <NotConnectedCard
            title="下版啟用"
            reason="upcoming"
            className="border-[#d7e7f7] bg-[#f4f9ff]"
          />
          <p className="mt-4 text-[13px] font-bold leading-6 text-[#536175]">
            運維協助功能將於下個迭代啟用，包含：按 user 查、軟介入（reset session / refresh cache / 重發通知）。
          </p>
        </WorkbenchCard>
      </div>
    </RoleShell>
  );
}
