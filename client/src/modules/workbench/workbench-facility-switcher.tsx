import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useAuthMe, useSwitchFacility } from "@/shared/auth/session";
import { useFacilityLabelMap } from "@/shared/auth/facility-labels";
import { cn } from "@/lib/utils";

type SwitcherTone = "employee" | "lifeguard";
type SwitcherSurface = "header" | "sidebar";

type FloatingPosition = {
  left: number;
  top: number;
  width: number;
};

const calculatePosition = (button: HTMLButtonElement): FloatingPosition => {
  const rect = button.getBoundingClientRect();
  const width = Math.min(360, Math.max(260, rect.width));
  const viewportWidth = window.innerWidth;
  return {
    left: Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12)),
    top: rect.bottom + 8,
    width,
  };
};

export function WorkbenchFacilitySwitcher({
  compact = false,
  tone = "employee",
  surface = "header",
  statusLabel,
  className,
}: {
  compact?: boolean;
  tone?: SwitcherTone;
  surface?: SwitcherSurface;
  statusLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const { data: session } = useAuthMe();
  const switchFacility = useSwitchFacility();
  const granted = session?.grantedFacilities ?? [];
  const facilityLabels = useFacilityLabelMap(granted);
  const activeFacility = session?.activeFacility && granted.includes(session.activeFacility) ? session.activeFacility : granted[0];
  const activeFacilityName = facilityLabels.getFacilityName(activeFacility);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (buttonRef.current) setPosition(calculatePosition(buttonRef.current));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-facility-switcher-menu='true']")) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", closeOnPointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("pointerdown", closeOnPointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!granted.length) return null;

  const chooseFacility = (facilityKey: string) => {
    setOpen(false);
    if (facilityKey !== activeFacility) switchFacility.mutate(facilityKey);
  };

  const isSidebarSurface = surface === "sidebar";
  const resolvedStatusLabel = statusLabel ?? (tone === "lifeguard" ? "值勤中" : "營運中");
  const iconClassName = tone === "lifeguard" ? "bg-[#e8fbf7] text-[#007166]" : "bg-[#eef5ff] text-[#1f6fd1]";
  const menu = open && position ? (
    <div
      data-facility-switcher-menu="true"
      className="fixed z-[80] overflow-hidden rounded-[10px] border border-[#dfe7ef] bg-white shadow-[0_24px_64px_-34px_rgba(15,34,58,0.68)]"
      style={{ left: position.left, top: position.top, width: position.width }}
    >
      <div className="border-b border-[#edf2f7] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">授權場館</div>
      <div className="max-h-[320px] overflow-y-auto p-2">
        {granted.map((facilityKey) => {
          const active = facilityKey === activeFacility;
          return (
            <button
              key={facilityKey}
              type="button"
              onClick={() => chooseFacility(facilityKey)}
              disabled={switchFacility.isPending}
              className={cn(
                "workbench-focus flex min-h-12 w-full items-center gap-3 rounded-[8px] px-3 text-left transition",
                active ? "bg-[#eaf8ef] text-[#0f6b46]" : "text-[#10233f] hover:bg-[#f7f9fb]",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-black">{facilityLabels.getFacilityName(facilityKey)}</span>
              {active ? <Check className="h-4 w-4 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={`切換場館：${activeFacilityName}`}
        className={cn(
          "workbench-focus inline-flex text-left transition",
          isSidebarSurface
            ? "min-h-[68px] w-full items-center gap-3 rounded-[8px] bg-white/8 px-3 py-3 text-white hover:bg-white/12"
            : "min-h-10 items-center gap-2 rounded-[8px] border border-[#dfe7ef] bg-white px-3 text-[#10233f] shadow-[0_12px_28px_-24px_rgba(15,34,58,0.55)] hover:bg-[#f8fafc]",
          !isSidebarSurface && (compact ? "w-full justify-between" : "w-[190px] max-w-[44vw]"),
          className,
        )}
      >
        {isSidebarSurface ? null : (
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[7px]", iconClassName)}>
            <Building2 className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          {isSidebarSurface ? (
            <span className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-[#9dd84f]">
              <span className="h-2 w-2 rounded-full bg-[#9dd84f]" />
              {resolvedStatusLabel}
            </span>
          ) : null}
          <span className={cn("block truncate", isSidebarSurface ? "text-[13px] font-bold text-white" : "text-[13px] font-black")}>
            {activeFacilityName}
          </span>
          {isSidebarSurface ? null : (
            <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#8b9aae]">切換場館</span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition", isSidebarSurface ? "text-white/70" : "text-[#8b9aae]", open && "rotate-180")} />
      </button>
      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : menu}
    </>
  );
}
