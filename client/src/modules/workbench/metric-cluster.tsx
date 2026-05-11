import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

type MetricTone = "green" | "blue" | "amber" | "red" | "navy" | "gray";

export type WorkbenchMetricItem = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  href?: string;
};

const toneClass: Record<MetricTone, { text: string; icon: string; border: string }> = {
  green: { text: "text-[#15935d]", icon: "bg-[#e7f7ee] text-[#15935d]", border: "border-l-[#15935d]" },
  blue: { text: "text-[#2f6fe8]", icon: "bg-[#e8f1ff] text-[#2f6fe8]", border: "border-l-[#2f6fe8]" },
  amber: { text: "text-[#c86912]", icon: "bg-[#fff4e4] text-[#c86912]", border: "border-l-[#c86912]" },
  red: { text: "text-[#dc4c62]", icon: "bg-[#ffecef] text-[#dc4c62]", border: "border-l-[#dc4c62]" },
  navy: { text: "text-[#10233f]", icon: "bg-[#edf2f7] text-[#10233f]", border: "border-l-[#10233f]" },
  gray: { text: "text-[#637185]", icon: "bg-[#f1f5f9] text-[#637185]", border: "border-l-[#8b9aae]" },
};

function MetricCell({ item, spanMobile }: { item: WorkbenchMetricItem; spanMobile: boolean }) {
  const tone = toneClass[item.tone ?? "navy"];
  const Icon = item.icon;
  const content = (
    <div
      className={cn(
        "group flex min-h-[78px] items-start justify-between gap-2 border-l-2 bg-white px-3 py-3 transition hover:bg-[#fbfcfd] sm:min-h-[84px] sm:px-4",
        tone.border,
        spanMobile && "col-span-2 sm:col-span-1",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[11px] font-black text-[#536175] sm:text-[12px]">{item.label}</p>
        <p className={cn("mt-1 text-[24px] font-black leading-none tabular-nums sm:text-[28px]", tone.text)}>{item.value}</p>
        {item.helper ? <p className="mt-1 truncate text-[11px] font-bold text-[#8b9aae]">{item.helper}</p> : null}
      </div>
      {Icon ? (
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[8px]", tone.icon)}>
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );

  if (!item.href) return content;

  return (
    <Link href={item.href} className={cn("block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15935d] focus-visible:ring-offset-2", spanMobile && "col-span-2 sm:col-span-1")}>
      {content}
    </Link>
  );
}

export function WorkbenchMetricCluster({
  title,
  eyebrow,
  helper,
  items,
  className,
  columnsClassName = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5",
  spanLastOnMobile = true,
}: {
  title?: string;
  eyebrow?: string;
  helper?: ReactNode;
  items: WorkbenchMetricItem[];
  className?: string;
  columnsClassName?: string;
  spanLastOnMobile?: boolean;
}) {
  return (
    <WorkbenchCard className={cn("overflow-hidden p-0", className)}>
      {title || eyebrow || helper ? (
        <div className="flex flex-col gap-1 border-b border-[#edf1f6] bg-[#fbfcfd] px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#007166]">{eyebrow}</p> : null}
            {title ? <h2 className="mt-0.5 text-[15px] font-black text-[#10233f]">{title}</h2> : null}
          </div>
          {helper ? <p className="text-[11px] font-bold text-[#8b9aae]">{helper}</p> : null}
        </div>
      ) : null}
      <div className={cn("grid gap-px bg-[#e6edf4]", columnsClassName)}>
        {items.map((item, index) => (
          <MetricCell key={item.label} item={item} spanMobile={spanLastOnMobile && items.length % 2 === 1 && index === items.length - 1} />
        ))}
      </div>
    </WorkbenchCard>
  );
}
