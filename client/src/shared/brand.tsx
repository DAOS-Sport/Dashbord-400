import junsiLogoUrl from "@assets/logo_(1)_1776402178727.jpg";
import { cn } from "@/lib/utils";

export const APP_BRAND_NAME = "駿斯 CMS";
export const APP_BRAND_SUBTITLE = "JUNSI CONTENT MANAGEMENT SYSTEM";

interface BrandMarkProps {
  className?: string;
  imageClassName?: string;
}

export function BrandMark({ className, imageClassName }: BrandMarkProps) {
  return (
    <span className={cn("inline-grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#0d2a50] shadow-sm", className)}>
      <img src={junsiLogoUrl} alt="駿斯" className={cn("h-full w-full object-cover", imageClassName)} />
    </span>
  );
}

interface BrandLockupProps {
  className?: string;
  markClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  showSubtitle?: boolean;
}

export function BrandLockup({
  className,
  markClassName,
  titleClassName,
  subtitleClassName,
  showSubtitle = false,
}: BrandLockupProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <BrandMark className={markClassName} />
      <div className="min-w-0">
        <p className={cn("truncate text-[17px] font-black", titleClassName)}>{APP_BRAND_NAME}</p>
        {showSubtitle ? (
          <p className={cn("truncate text-[10px] font-black uppercase tracking-[0.16em]", subtitleClassName)}>
            {APP_BRAND_SUBTITLE}
          </p>
        ) : null}
      </div>
    </div>
  );
}
