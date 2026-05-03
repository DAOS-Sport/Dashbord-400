import { Link, useLocation } from "wouter";
import { Car, LayoutDashboard, Tags, FileText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

const PARKING_TABS: Array<{ href: string; label: string; Icon: typeof Car }> = [
  { href: "/admin/parking/dashboard", label: "戰情總覽", Icon: LayoutDashboard },
  { href: "/admin/parking/vehicles", label: "車輛管理",  Icon: Car },
  { href: "/admin/parking/plans",    label: "方案管理",  Icon: Tags },
  { href: "/admin/parking/contracts",label: "租約管理",  Icon: FileText },
  { href: "/admin/parking/payments", label: "付款審核",  Icon: Wallet },
];

export function ParkingShell({ title, subtitle, headerExtra, children }: {
  title: string; subtitle?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  return (
    <div className="h-full overflow-auto bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">PARKING · 停車場會員與租約管理</p>
              <h1 className="text-xl font-bold mt-0.5 flex items-center gap-2" data-testid="text-page-title">
                <Car className="h-5 w-5 text-primary" />
                {title}
              </h1>
              {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
            </div>
            {headerExtra ? <div className="flex items-center gap-2 flex-wrap">{headerExtra}</div> : null}
          </div>
          <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="parking sub-nav">
            {PARKING_TABS.map(({ href, label, Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  data-testid={`tab-parking-${href.split("/").pop()}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover-elevate active-elevate-2",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
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
  if (isLoading) return <div className="grid h-full place-items-center p-8 text-sm text-muted-foreground">驗證中…</div>;
  if (isError || !session) {
    return (
      <div className="grid h-full place-items-center p-8">
        <p className="text-sm text-muted-foreground" data-testid="text-need-login">請先登入後台。</p>
      </div>
    );
  }
  const ok = session.grantedRoles?.includes("supervisor") || session.grantedRoles?.includes("system");
  if (!ok) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center space-y-3" data-testid="text-no-permission">
          <p className="text-lg font-bold">無瀏覽權限</p>
          <p className="text-sm text-muted-foreground">此頁面僅開放給主管或系統管理員。</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
