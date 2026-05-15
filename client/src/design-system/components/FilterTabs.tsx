import { cn } from "@/lib/utils";

export interface FilterTabItem<TValue extends string = string> {
  label: string;
  value: TValue;
  count?: number;
}

export interface FilterTabsProps<TValue extends string = string> {
  tabs: FilterTabItem<TValue>[];
  activeValue: TValue;
  onChange: (value: TValue) => void;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Usage:
 * <FilterTabs tabs={[{label: "全部", value: "all", count: 10}]} activeValue="all" onChange={setTab} />
 */
export function FilterTabs<TValue extends string = string>({ tabs, activeValue, onChange, size = "md", className }: FilterTabsProps<TValue>) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === activeValue;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "workbench-focus inline-flex items-center gap-2 rounded-ds-pill font-bold transition",
              size === "sm" ? "min-h-8 px-3 text-[12px]" : "min-h-10 px-4 text-[13px]",
              active ? "bg-primary-navy text-white shadow-card-rest" : "bg-transparent text-text-body hover:bg-primary-navy/6",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]", active ? "bg-white/18 text-white" : "bg-primary-navy/8 text-text-muted")}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
