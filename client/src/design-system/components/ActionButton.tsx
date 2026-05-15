import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
}

const variantClass = {
  primary: "bg-primary-navy text-white shadow-card-rest hover:bg-primary-navy-soft",
  secondary: "border border-primary-navy/18 bg-white text-primary-navy hover:bg-surface-soft",
  ghost: "bg-transparent text-primary-navy hover:bg-primary-navy/6",
  danger: "border border-state-priority/30 bg-white text-state-priority hover:bg-state-priority/8",
};

const sizeClass = {
  sm: "min-h-8 px-3 text-[12px]",
  md: "min-h-10 px-4 text-[13px]",
  lg: "min-h-12 px-5 text-[14px]",
};

/**
 * Usage:
 * <ActionButton variant="primary" icon={<Plus />}>新增</ActionButton>
 */
export function ActionButton({ variant = "primary", size = "md", icon, loading, disabled, children, className, ...props }: ActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "workbench-focus inline-flex items-center justify-center gap-2 rounded-ds-md font-bold transition disabled:cursor-not-allowed disabled:opacity-55",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
