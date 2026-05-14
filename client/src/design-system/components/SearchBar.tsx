import type { InputHTMLAttributes, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
  variant?: "default" | "compact";
}

/**
 * Usage:
 * <SearchBar placeholder="搜尋公告..." value={query} onChange={setQuery} />
 */
export function SearchBar({ value, onChange, icon, variant = "default", className, ...props }: SearchBarProps) {
  return (
    <label className={cn("flex items-center gap-3 rounded-ds-md border border-border-default bg-surface-elevated px-4 shadow-card-rest backdrop-blur-xl", variant === "compact" ? "min-h-10" : "min-h-14", className)}>
      <span className="text-text-muted">{icon ?? <Search className="h-4 w-4" />}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-body font-medium text-text-strong outline-none placeholder:text-text-muted"
        {...props}
      />
    </label>
  );
}
