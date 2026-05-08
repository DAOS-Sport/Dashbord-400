import { GripVertical, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export type FloatingQuickActionItem = {
  label: string;
  helper?: string;
  href: string;
  Icon: LucideIcon;
};

const isActiveRoute = (currentPath: string, href: string) => {
  if (!href.startsWith("/")) return false;
  return currentPath === href || currentPath.startsWith(`${href}/`);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const shortcutTileClasses = [
  "bg-[#dff5ea] text-[#116247] hover:bg-[#d2eedf]",
  "bg-[#e5efff] text-[#2456b3] hover:bg-[#d8e6ff]",
  "bg-[#fff0d4] text-[#8a520b] hover:bg-[#ffe6b8]",
  "bg-[#eee8ff] text-[#5134b0] hover:bg-[#e3d9ff]",
  "bg-[#ffe4e9] text-[#9f2434] hover:bg-[#ffd6de]",
];

export function FloatingQuickActionsPanel({
  eyebrow,
  title,
  items,
  tone = "green",
  actionsSlot,
}: {
  eyebrow: string;
  title: string;
  items: FloatingQuickActionItem[];
  tone?: "green" | "blue";
  actionsSlot?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [position, setPosition] = useState({ right: 16, top: 104 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startRight: number; startTop: number } | null>(null);
  const didDragRef = useRef(false);
  const [location] = useLocation();
  const panelWidth = 80;

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startRight: position.right,
      startTop: position.top,
    };
    didDragRef.current = false;
    setIsDragging(true);
    event.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (event: PointerEvent) => {
      const start = dragRef.current;
      if (!start) return;
      const deltaX = event.clientX - start.startX;
      const deltaY = event.clientY - start.startY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        didDragRef.current = true;
      }
      const maxRight = Math.max(8, window.innerWidth - panelWidth - 8);
      const maxTop = Math.max(72, window.innerHeight - 96);
      setPosition({
        right: clamp(start.startRight - deltaX, 8, maxRight),
        top: clamp(start.startTop + deltaY, 72, maxTop),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 120);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onPointerDown={beginDrag}
        onClick={() => {
          if (didDragRef.current) {
            didDragRef.current = false;
            return;
          }
          setIsOpen(true);
        }}
        title={`開啟${title}`}
        aria-label={`開啟${title}`}
        className={cn(
          "workbench-focus fixed z-20 hidden h-11 w-11 touch-none place-items-center rounded-[8px] border border-[#dfe7ef] bg-white/95 text-[#536175] shadow-[0_18px_48px_-32px_rgba(15,34,58,0.72)] backdrop-blur-xl transition hover:bg-[#f8fafc] xl:grid",
          isDragging && "cursor-grabbing",
        )}
        style={{ right: position.right, top: position.top }}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    );
  }

  const defaultActionSlot = (
    <button
      type="button"
      onPointerDown={beginDrag}
      title={`拖曳${title}`}
      aria-label={`拖曳${title}`}
      className={cn(
        "workbench-focus grid h-9 w-9 touch-none place-items-center rounded-[8px] bg-[#f3f7fb] text-[#536175] transition hover:bg-[#edf3f8]",
        isDragging && "cursor-grabbing",
      )}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <aside
      className="fixed z-20 hidden w-[80px] flex-col overflow-hidden rounded-[8px] border border-[#dfe7ef] bg-white/95 shadow-[0_24px_72px_-44px_rgba(15,34,58,0.72)] backdrop-blur-xl xl:flex"
      aria-label={title}
      style={{ right: position.right, top: position.top }}
    >
      <div className="border-b border-[#edf1f6] px-1.5 py-2">
        <div
          className={cn("mb-1 grid touch-none place-items-center", isDragging && "cursor-grabbing")}
          onPointerDown={beginDrag}
          title={`拖曳${title}`}
          aria-label={`拖曳${title}`}
        >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_0_4px_rgba(21,147,93,0.10)]", tone === "blue" ? "bg-[#2f6fe8]" : "bg-[#15935d]")} title={eyebrow} />
          <h2 className="sr-only">{title}</h2>
        </div>
        <span className="sr-only">{title}</span>
        <div className="flex shrink-0 items-center justify-center gap-1">
          {actionsSlot ? <div className="shrink-0">{actionsSlot}</div> : defaultActionSlot}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title={`關閉${title}`}
            aria-label={`關閉${title}`}
            className="workbench-focus grid h-9 w-9 place-items-center rounded-[8px] bg-[#f3f7fb] text-[#536175] transition hover:bg-[#edf3f8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <nav className="grid gap-1.5 p-1.5" aria-label={title}>
        {items.map(({ label, helper, href, Icon }, index) => {
          const isActive = isActiveRoute(location, href);
          const tileClass = shortcutTileClasses[index % shortcutTileClasses.length];
          return (
            <a
              key={label}
              href={href}
              target={href.startsWith("/") ? undefined : "_blank"}
              rel={href.startsWith("/") ? undefined : "noreferrer"}
              title={helper ? `${label} - ${helper}` : label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "workbench-focus group relative grid min-h-[76px] justify-items-center gap-2 rounded-[8px] px-1.5 py-3 text-center shadow-[0_10px_24px_-22px_rgba(15,34,58,0.9)] transition duration-150",
                tileClass,
                isActive && "ring-2 ring-[#10233f]/18 ring-offset-2 ring-offset-white",
              )}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-[8px] bg-white/60 text-current transition duration-150 group-hover:scale-[1.03]"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="grid min-w-0 justify-items-center">
                <span className="line-clamp-2 block max-w-[64px] break-words text-[11px] font-black leading-[14px] text-current">{label}</span>
              </span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
