import { Car, LayoutDashboard, Tags, FileText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  SupervisorErrorState,
  SupervisorLoadingState,
  SupervisorModuleShell,
  type SupervisorModuleTab,
} from "@/modules/supervisor/module-shell";

// Plan/vehicle type labels
export const PLAN_TYPE_LABELS: Record<string, string> = {
  monthly: "月租",
  quarterly: "季租",
  yearly: "年租",
  member: "會員",
  swim_team: "泳隊",
  employee: "員工",
  special: "特約",
  blacklist: "黑名單",
};

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  active: "使用中",
  expired: "已到期",
  suspended: "停用",
  blacklisted: "黑名單",
};

export const VEHICLE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expired: "secondary",
  suspended: "outline",
  blacklisted: "destructive",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  awaiting_sign: "待簽約",
  awaiting_payment: "待付款",
  payment_review: "付款審核中",
  active: "履約中",
  expiring_soon: "即將到期",
  expired: "已到期",
  terminated: "已終止",
  refunded: "已退款",
};

export const CONTRACT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  awaiting_sign: "outline",
  awaiting_payment: "secondary",
  payment_review: "secondary",
  active: "default",
  expiring_soon: "secondary",
  expired: "outline",
  terminated: "destructive",
  refunded: "destructive",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已拒絕",
};

export const PAYMENT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

const PARKING_TABS: SupervisorModuleTab[] = [
  { href: "/supervisor/parking", label: "戰情總覽", Icon: LayoutDashboard, exact: true, testId: "tab-parking-dashboard" },
  { href: "/supervisor/parking/vehicles", label: "車輛管理",  Icon: Car, testId: "tab-parking-vehicles" },
  { href: "/supervisor/parking/plans",    label: "方案管理",  Icon: Tags, testId: "tab-parking-plans" },
  { href: "/supervisor/parking/contracts",label: "租約管理",  Icon: FileText, testId: "tab-parking-contracts" },
  { href: "/supervisor/parking/payments", label: "付款審核",  Icon: Wallet, testId: "tab-parking-payments" },
];

export function ParkingShell({ title, subtitle, headerExtra, children }: {
  title: string; subtitle?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SupervisorModuleShell
      moduleId="parking"
      title={title}
      eyebrow="PARKING OPERATIONS"
      description={subtitle ?? "停車場會員、租約、付款與活動日控管。"}
      tabs={PARKING_TABS}
      actions={headerExtra}
      layoutMode="wide"
    >
      {children}
    </SupervisorModuleShell>
  );
}

export function PlateDisplay({ plate, size = "md" }: { plate: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg"
    ? "text-2xl px-4 py-2"
    : size === "sm"
    ? "text-sm px-2 py-1"
    : "text-base px-3 py-1.5";
  return (
    <span
      data-testid={`text-plate-${plate}`}
      className={cn(
        "inline-block font-mono font-bold tracking-wider rounded-md border-2 border-foreground/70 bg-background text-foreground",
        cls,
      )}
    >
      {plate}
    </span>
  );
}

export function StatusBadge({ value, labels, variants }: {
  value: string;
  labels: Record<string, string>;
  variants: Record<string, "default" | "secondary" | "destructive" | "outline">;
}) {
  return (
    <Badge variant={variants[value] ?? "outline"} data-testid={`status-${value}`}>
      {labels[value] ?? value}
    </Badge>
  );
}

export function ParkingGuard({ session, isLoading, isError, children }: {
  session: any; isLoading: boolean; isError: boolean; children: React.ReactNode;
}) {
  if (isLoading) return <SupervisorLoadingState label="權限驗證中" />;
  if (isError || !session) {
    return <SupervisorErrorState message="請先登入後台。" />;
  }
  const ok = session.grantedRoles?.includes("supervisor") || session.grantedRoles?.includes("system");
  if (!ok) {
    return <SupervisorErrorState message="無瀏覽權限：此頁面僅開放給主管或系統管理員。" />;
  }
  return <>{children}</>;
}
