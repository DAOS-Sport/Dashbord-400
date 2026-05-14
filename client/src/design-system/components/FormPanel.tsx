import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FormPanelProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  tone?: "teal" | "navy";
  className?: string;
}

/**
 * Usage:
 * <FormPanel title="新增活動" footer={<ActionButton>送出</ActionButton>}>...</FormPanel>
 */
export function FormPanel({ title, subtitle, footer, children, tone = "teal", className }: FormPanelProps) {
  return (
    <section className={cn("overflow-hidden rounded-ds-lg border border-border-default bg-surface-elevated shadow-card-rest backdrop-blur-xl", className)}>
      <div className="flex">
        <div className={cn("w-1 shrink-0", tone === "teal" ? "bg-accent-teal" : "bg-primary-navy")} />
        <div className="min-w-0 flex-1">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="text-h2 text-text-strong">{title}</h2>
            {subtitle ? <p className="mt-1 text-body-sm text-text-body">{subtitle}</p> : null}
          </div>
          <div className="p-5">{children}</div>
          {footer ? <div className="border-t border-border-subtle bg-white/50 px-5 py-4">{footer}</div> : null}
        </div>
      </div>
    </section>
  );
}
