import { cn } from "@/lib/utils";

interface DreamLoaderProps {
  label?: string;
  compact?: boolean;
  className?: string;
}

export function DreamLoader({
  label = "載入中",
  compact = false,
  className,
}: DreamLoaderProps) {
  return (
    <div
      className={cn(
        "grid place-items-center",
        compact ? "min-h-[120px]" : "min-h-[220px]",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className={cn(
            "rounded-full border-[3px] border-[#e6eaf0] border-t-[#22b8a8] motion-safe:animate-spin",
            compact ? "h-8 w-8" : "h-10 w-10",
          )}
          role="status"
          aria-label={label}
        />
        <p
          className={cn(
            "font-semibold text-[#10233f]",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {label}
        </p>
      </div>
    </div>
  );
}