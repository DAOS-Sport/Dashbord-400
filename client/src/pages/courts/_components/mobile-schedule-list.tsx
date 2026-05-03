import { useMemo } from "react";
import {
  COURTS,
  getCourtBarClass,
  getCourtTypeLabel,
  type CourtInfo,
} from "@/lib/court-utils";
import type { CourtReservation as Reservation } from "@shared/schema";

interface MobileScheduleListProps {
  reservations: Reservation[];
  onReservationClick: (reservation: Reservation) => void;
  visibleCourts?: number[];
}

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

export function MobileScheduleList({
  reservations,
  onReservationClick,
  visibleCourts,
}: MobileScheduleListProps) {
  const courtsToShow = useMemo(() => {
    if (!visibleCourts) return [];
    const set = new Set(visibleCourts);
    return COURTS.filter((c) => set.has(c.id));
  }, [visibleCourts]);

  const reservationsByCourt = useMemo(() => {
    const map = new Map<number, Reservation[]>();
    for (const r of reservations) {
      const list = map.get(r.court) || [];
      list.push(r);
      map.set(r.court, list);
    }
    Array.from(map.values()).forEach((list: Reservation[]) => {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }, [reservations]);

  return (
    <div className="space-y-3">
      {courtsToShow.map((court) => {
        const courtReservations = reservationsByCourt.get(court.id) || [];
        return (
          <CourtCard
            key={court.id}
            court={court}
            reservations={courtReservations}
            onReservationClick={onReservationClick}
          />
        );
      })}
    </div>
  );
}

function CourtCard({
  court,
  reservations,
  onReservationClick,
}: {
  court: CourtInfo;
  reservations: Reservation[];
  onReservationClick: (r: Reservation) => void;
}) {
  const count = reservations.length;

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      data-testid={`mobile-court-${court.id}`}
    >
      <div className="flex items-stretch">
        <div className={`w-1.5 shrink-0 ${getCourtBarClass(court.type)}`} />
        <div className="flex-1 flex items-center justify-between px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[10px] text-gray-400">
              {getCourtTypeLabel(court.type)}
            </div>
            <div className="text-sm font-semibold text-gray-900 truncate">
              {court.name}
            </div>
          </div>
          {count > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold shrink-0">
              {count} 筆
            </span>
          ) : (
            <span className="text-[11px] text-gray-300 shrink-0">無預約</span>
          )}
        </div>
      </div>

      {count > 0 && (
        <ul className="border-t border-gray-100 divide-y divide-gray-100">
          {reservations.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onReservationClick(r)}
                data-testid={`mobile-reservation-${r.id}`}
                className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 shrink-0 text-[11px] font-medium text-gray-500 tabular-nums leading-tight">
                  <div>{r.startTime}</div>
                  <div className="text-gray-300">{r.endTime}</div>
                </div>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(r.status)}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {r.customerName}
                  </div>
                  {r.serviceName && (
                    <div className="text-[11px] text-gray-400 truncate">
                      {r.serviceName}
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
