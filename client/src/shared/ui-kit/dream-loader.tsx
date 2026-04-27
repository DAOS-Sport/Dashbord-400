import { cn } from "@/lib/utils";

interface DreamLoaderProps {
  label?: string;
  compact?: boolean;
  className?: string;
}

export function DreamLoader({ label = "Dreams 工作台載入中", compact = false, className }: DreamLoaderProps) {
  return (
    <div className={cn("grid place-items-center text-center", compact ? "min-h-[160px]" : "min-h-[280px]", className)}>
      <div className="flex flex-col items-center gap-4">
        <div className={cn("relative", compact ? "h-16 w-16" : "h-24 w-24")}>
          <div className="absolute inset-0 rounded-[18px] bg-[#0d2a50] shadow-[0_20px_42px_-24px_rgba(13,42,80,0.85)]" />
          <div className="absolute -inset-2 rounded-full border-2 border-transparent border-r-[#1cb4a3] border-t-[#9dd84f] motion-safe:animate-spin" />
          <svg className="absolute inset-0 h-full w-full p-4" viewBox="0 0 80 80" role="img" aria-label="Dreams loading">
            <g className="motion-safe:origin-center motion-safe:animate-pulse">
              <path d="M19 54 L36 37 L44 45 L27 62 Z" fill="#eef7ff" />
              <path d="M31 23 L41 13 L57 29 L47 39 Z" fill="#9dd84f" />
              <path d="M41 13 L49 13 L61 25 L57 29 Z" fill="#b9f061" />
              <path d="M46 40 L57 29 L65 37 L54 48 Z" fill="#eef7ff" />
              <path d="M22 21 L30 13 L38 21 L30 29 Z" fill="#1cb4a3" />
            </g>
          </svg>
          <div className="absolute -right-1 top-3 h-2 w-2 rounded-full bg-[#9dd84f] motion-safe:animate-ping" />
          <div className="absolute -bottom-1 left-4 flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9dd84f] motion-safe:animate-bounce" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#1cb4a3] motion-safe:animate-bounce [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#eef7ff] motion-safe:animate-bounce [animation-delay:240ms]" />
          </div>
        </div>
        <div>
          <p className={cn("font-black text-[#10233f]", compact ? "text-[13px]" : "text-[15px]")}>{label}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b9aae]">駿斯 CMS</p>
        </div>
      </div>
    </div>
  );
}
