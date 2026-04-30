import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

export function SupervisorEyebrow({ children }: { children: ReactNode }) {
  return <p className="supervisor-eyebrow">{children}</p>;
}

export function SupervisorPanel({
  children,
  className,
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <WorkbenchCard tone={dark ? "navy" : "light"} className={cn("supervisor-card", className)}>
      {children}
    </WorkbenchCard>
  );
}

export function SupervisorCardHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("supervisor-card-head", className)}>
      <div className="min-w-0">
        <h2 className="supervisor-card-title">{title}</h2>
        {eyebrow ? <SupervisorEyebrow>{eyebrow}</SupervisorEyebrow> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SupervisorKpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon: LucideIcon;
  tone?: "green" | "blue" | "amber" | "red" | "navy" | "purple";
}) {
  return (
    <SupervisorPanel className="supervisor-kpi">
      <div className="min-w-0">
        <p className="supervisor-kpi-label">{label}</p>
        <p className={cn("supervisor-kpi-value", `supervisor-tone-${tone}`)}>{value}</p>
        {helper ? <p className="supervisor-kpi-helper">{helper}</p> : null}
      </div>
      <div className={cn("supervisor-kpi-icon", `supervisor-kpi-icon-${tone}`)}>
        <Icon className="h-5 w-5" />
      </div>
    </SupervisorPanel>
  );
}

export function SupervisorPill({
  children,
  tone = "gray",
  className,
}: {
  children: ReactNode;
  tone?: "green" | "blue" | "amber" | "red" | "gray" | "purple";
  className?: string;
}) {
  return <span className={cn("supervisor-pill", `supervisor-pill-${tone}`, className)}>{children}</span>;
}

export function SupervisorFilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <SupervisorPanel className={cn("supervisor-filter-bar", className)}>{children}</SupervisorPanel>;
}

export function SupervisorEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("supervisor-empty", className)}>
      {Icon ? <Icon className="mx-auto h-10 w-10 text-[#94a0b1]" aria-hidden="true" /> : null}
      <p className="mt-3 text-[15px] font-black text-[#102940]">{title}</p>
      {description ? <p className="mt-1 text-[13px] font-bold text-[#667386]">{description}</p> : null}
    </div>
  );
}
