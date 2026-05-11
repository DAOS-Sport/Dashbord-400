import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleShell } from "@/modules/workbench/role-shell";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";

export type SupervisorModuleLayoutMode = "standard" | "wide" | "schedule";

export interface SupervisorModuleTab {
  href: string;
  label: string;
  Icon?: LucideIcon;
  testId?: string;
  exact?: boolean;
}

export interface SupervisorModuleShellProps {
  moduleId: string;
  title: string;
  eyebrow: string;
  description?: string;
  tabs?: SupervisorModuleTab[];
  actions?: ReactNode;
  children: ReactNode;
  layoutMode?: SupervisorModuleLayoutMode;
  contentClassName?: string;
}

const layoutClass: Record<SupervisorModuleLayoutMode, string> = {
  standard: "max-w-[1480px]",
  wide: "max-w-[1680px]",
  schedule: "max-w-none",
};

export function SupervisorModuleShell({
  moduleId,
  title,
  eyebrow,
  description,
  tabs = [],
  actions,
  children,
  layoutMode = "standard",
  contentClassName,
}: SupervisorModuleShellProps) {
  return (
    <RoleShell role="supervisor" title={title} subtitle={description ?? eyebrow}>
      <section
        className={cn("supervisor-module mx-auto w-full", layoutClass[layoutMode], contentClassName)}
        data-module-id={moduleId}
      >
        <div className="mb-4 rounded-[8px] border border-[var(--supervisor-border)] bg-white p-3 shadow-[var(--supervisor-shadow-sm)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2f9e5b]">{eyebrow}</p>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-[#536175]">{description}</p>
            </div>
            {actions ? <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] xl:max-w-[72%] xl:pb-0">{actions}</div> : null}
          </div>
          {tabs.length ? <SupervisorModuleTabs tabs={tabs} className="mt-3" /> : null}
        </div>
        {children}
      </section>
    </RoleShell>
  );
}

export function SupervisorModuleTabs({ tabs, className }: { tabs: SupervisorModuleTab[]; className?: string }) {
  const [location] = useLocation();
  return (
    <nav className={cn("flex gap-1 overflow-x-auto rounded-[7px] bg-[#f4f6f8] p-1", className)} aria-label="supervisor module tabs">
      {tabs.map(({ href, label, Icon, testId, exact }) => {
        const active = exact ? location === href : location === href || location.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            data-testid={testId}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[6px] px-3 text-[12px] font-black transition",
              active
                ? "bg-[#102940] text-white shadow-[0_8px_18px_-14px_rgba(16,41,64,0.75)]"
                : "text-[#536175] hover:bg-white hover:text-[#102940]",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SupervisorPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-[8px] border border-[var(--supervisor-border)] bg-white shadow-[var(--supervisor-shadow-sm)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SupervisorMetricCard({
  label,
  value,
  tone = "default",
  testId,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "blue" | "green" | "amber" | "red" | "muted";
  testId?: string;
}) {
  const toneClass = {
    default: "text-[#102940]",
    blue: "text-[#2e74d8]",
    green: "text-[#2f9e5b]",
    amber: "text-[#d8872b]",
    red: "text-[#e45363]",
    muted: "text-[#7c8998]",
  }[tone];
  return (
    <div className="rounded-[8px] border border-[var(--supervisor-border)] bg-white px-4 py-3 shadow-[var(--supervisor-shadow-sm)]" data-testid={testId}>
      <p className="text-[11px] font-bold text-[#536175]">{label}</p>
      <p className={cn("mt-2 font-mono text-[26px] font-black leading-none tabular-nums", toneClass)}>{value}</p>
    </div>
  );
}

export function SupervisorEmptyState({ message }: { message: string }) {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-[8px] border border-dashed border-[var(--supervisor-border-strong)] bg-[#fafbfc] p-8 text-center" data-testid="text-empty">
      <div>
        <CheckCircle2 className="mx-auto h-8 w-8 text-[#93a1b2]" />
        <p className="mt-3 text-[14px] font-black text-[#102940]">{message}</p>
      </div>
    </div>
  );
}

export function SupervisorErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] border border-[#f0b2b9] bg-[#fff6f7] p-5 text-center text-[13px] font-bold text-[#e45363]" data-testid="text-error">
      <AlertCircle className="mx-auto mb-2 h-5 w-5" />
      {message}
    </div>
  );
}

export function SupervisorLoadingState({ label = "載入中" }: { label?: string }) {
  return (
    <div className="grid min-h-[180px] place-items-center rounded-[8px] border border-[var(--supervisor-border)] bg-white" data-testid="text-loading">
      <DreamLoader compact label={label} />
    </div>
  );
}

export function SupervisorInlineLoading({ label = "處理中" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-bold text-[#536175]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </span>
  );
}
