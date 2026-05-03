import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  COURTS,
  getCourtTypeLabel,
  getCourtBarClass,
  getCourtType,
} from "@/lib/court-utils";
import type { CourtReservation as Reservation } from "@shared/schema";

interface CalendarGridProps {
  reservations: Reservation[];
  onReservationClick: (reservation: Reservation) => void;
  visibleCourts?: number[];
  showNowIndicator?: boolean;
}

const TIME_SLOTS = [
  { start: "06:00", end: "07:00" },
  { start: "07:00", end: "08:00" },
  { start: "08:00", end: "09:00" },
  { start: "09:00", end: "10:00" },
  { start: "10:00", end: "11:00" },
  { start: "11:00", end: "12:00" },
  { start: "12:00", end: "13:00" },
  { start: "13:00", end: "14:00" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
  { start: "17:00", end: "18:00" },
  { start: "18:00", end: "19:00" },
  { start: "19:00", end: "20:00" },
  { start: "20:00", end: "21:00" },
  { start: "21:00", end: "22:00" },
];

const ROW_HEIGHT = 64;
const TIME_COL = 60;
const TOTAL_MINUTES = 16 * 60;

const getStatusDotClass = (status: string) => {
  switch (status) {
    case "confirmed":
      return "bg-blue-500";
    case "pending":
      return "bg-amber-500";
    case "member":
      return "bg-emerald-500";
    default:
      return "bg-gray-400";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "confirmed":
      return "已確認";
    case "pending":
      return "待確認";
    case "member":
      return "會員";
    default:
      return status;
  }
};

const buildTooltip = (r: Reservation) => {
  const lines: string[] = [];
  lines.push(`${getStatusLabel(r.status)} · ${r.customerName}`);
  if (r.bookingNumber) lines.push(`#${r.bookingNumber}`);
  lines.push(`${r.startTime}–${r.endTime}`);
  if (r.serviceName) lines.push(r.serviceName);
  if (r.notes) lines.push(`備註：${r.notes.slice(0, 80)}`);
  return lines.join("\n");
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function CalendarGrid({
  reservations,
  onReservationClick,
  visibleCourts,
  showNowIndicator = false,
}: CalendarGridProps) {
  const courtsToShow = useMemo(() => {
    if (!visibleCourts) return [];
    const set = new Set(visibleCourts);
    return COURTS.filter((c) => set.has(c.id));
  }, [visibleCourts]);

  const gridStyle = {
    gridTemplateColumns: `${TIME_COL}px repeat(${courtsToShow.length}, minmax(80px, 1fr))`,
  };
  const minWidth = TIME_COL + courtsToShow.length * 80;

  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const getReservationForSlot = (courtId: number, startTime: string) => {
    return reservations.find((r) => {
      if (r.court !== courtId) return false;
      const slotEnd = TIME_SLOTS.find((slot) => slot.start === startTime)?.end;
      if (!slotEnd) return false;
      const slotStartMin = toMinutes(startTime);
      const slotEndMin = toMinutes(slotEnd);
      const reservationStartMin = toMinutes(r.startTime);
      const reservationEndMin = toMinutes(r.endTime);
      return reservationStartMin < slotEndMin && reservationEndMin > slotStartMin;
    });
  };

  const isReservationStartInSlot = (
    reservation: Reservation,
    slotStart: string,
    slotEnd: string,
  ) => {
    const resStart = toMinutes(reservation.startTime);
    return resStart >= toMinutes(slotStart) && resStart < toMinutes(slotEnd);
  };

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [bodyHeight, setBodyHeight] = useState<number>(
    TIME_SLOTS.length * ROW_HEIGHT,
  );

  useLayoutEffect(() => {
    if (!bodyRef.current) return;
    const el = bodyRef.current;
    setBodyHeight(el.getBoundingClientRect().height);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) setBodyHeight(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [courtsToShow.length]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!showNowIndicator) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [showNowIndicator]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowInRange = nowMinutes >= 6 * 60 && nowMinutes < 22 * 60;
  const nowOffsetPx = ((nowMinutes - 6 * 60) / TOTAL_MINUTES) * bodyHeight;
  const nowLabel = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-auto max-h-[calc(100vh-120px)]">
        <div style={{ minWidth: `${minWidth}px` }}>
          <div
            className="grid bg-gray-50 border-b border-gray-200 sticky top-0 z-20"
            style={gridStyle}
          >
            <div className="px-2 py-2.5 text-center font-medium text-gray-500 text-[10px] uppercase tracking-wide">
              時間
            </div>
            {courtsToShow.map((court) => (
              <div
                key={court.id}
                className="relative px-2 py-2.5 text-center border-l border-gray-100 first:border-l-0"
              >
                <div
                  className={`absolute top-0 left-3 right-3 h-0.5 ${getCourtBarClass(court.type)} opacity-70`}
                />
                <div className="text-[10px] text-gray-500 leading-tight">
                  {getCourtTypeLabel(court.type)}
                </div>
                <div
                  className="text-[12px] font-semibold text-gray-900 truncate leading-tight mt-0.5"
                  title={court.name}
                >
                  {court.name}
                </div>
              </div>
            ))}
          </div>

          <div className="relative" ref={bodyRef}>
            {showNowIndicator && nowInRange && (
              <div
                className="absolute inset-x-0 z-10 pointer-events-none flex items-center"
                style={{ top: `${nowOffsetPx}px`, transform: "translateY(-50%)" }}
                data-testid="now-indicator"
              >
                <div
                  className="shrink-0 flex items-center justify-end pr-1.5"
                  style={{ width: `${TIME_COL}px` }}
                >
                  <span className="text-[10px] font-semibold text-rose-500 bg-white px-1 rounded tabular-nums shadow-sm">
                    {nowLabel}
                  </span>
                </div>
                <div className="flex-1 relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <div className="h-px bg-rose-400/80" />
                </div>
              </div>
            )}

            {TIME_SLOTS.map((timeSlot, rowIdx) => (
              <div
                key={timeSlot.start}
                className={`grid overflow-hidden ${rowIdx === 0 ? "" : "border-t border-gray-100"}`}
                style={{ ...gridStyle, height: `${ROW_HEIGHT}px` }}
              >
                <div className="px-1 flex flex-col justify-center items-center text-gray-400">
                  <div className="text-[11px] font-medium tabular-nums">
                    {timeSlot.start}
                  </div>
                </div>

                {courtsToShow.map((court) => {
                  const reservation = getReservationForSlot(court.id, timeSlot.start);
                  const isStartSlot =
                    reservation &&
                    isReservationStartInSlot(reservation, timeSlot.start, timeSlot.end);
                  return (
                    <div
                      key={`${court.id}-${timeSlot.start}`}
                      className="border-l border-gray-100 first:border-l-0 p-0.5"
                    >
                      {reservation ? (
                        isStartSlot ? (
                          <button
                            onClick={() => onReservationClick(reservation)}
                            data-testid={`reservation-${reservation.id}`}
                            title={buildTooltip(reservation)}
                            className="h-full w-full bg-white rounded-md overflow-hidden border border-gray-200/80 hover:border-gray-300 hover:shadow-sm transition cursor-pointer text-left flex"
                          >
                            <div
                              className={`w-[3px] shrink-0 ${getCourtBarClass(getCourtType(court.id))}`}
                            />
                            <div className="flex-1 min-w-0 px-1.5 py-1 flex flex-col justify-center gap-0.5">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(reservation.status)}`}
                                />
                                <span className="text-[12px] font-medium text-gray-800 truncate">
                                  {reservation.customerName}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 tabular-nums truncate">
                                {reservation.startTime}–{reservation.endTime}
                                {reservation.serviceName && (
                                  <span className="ml-1 text-gray-300">
                                    · {reservation.serviceName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ) : (
                          <button
                            onClick={() => onReservationClick(reservation)}
                            data-testid={`reservation-${reservation.id}-cont`}
                            title={buildTooltip(reservation)}
                            className="h-full w-full bg-white/60 rounded-md overflow-hidden border border-dashed border-gray-200 hover:border-gray-300 hover:bg-white transition cursor-pointer flex items-center"
                          >
                            <div
                              className={`w-[3px] self-stretch shrink-0 ${getCourtBarClass(getCourtType(court.id))} opacity-60`}
                            />
                            <div className="flex-1 min-w-0 px-1.5 flex items-center gap-1 text-gray-400">
                              <svg
                                className="w-2.5 h-2.5 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                              <span className="text-[10px] truncate">
                                {reservation.customerName}
                              </span>
                            </div>
                          </button>
                        )
                      ) : (
                        <div
                          data-testid={`slot-${court.id}-${timeSlot.start}`}
                          className="h-full w-full rounded-md hover:bg-blue-50/40 transition-colors"
                          title="可預約"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
