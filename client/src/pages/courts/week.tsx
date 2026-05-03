import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppHeader } from "./_components/app-header";
import { ReservationDetailModal } from "./_components/reservation-detail-modal";
import { useSchool } from "@/lib/court-school";
import { getTodayString } from "@/lib/court-date-utils";
import {
  getCourtBarClass,
  getCourtType,
  getCourtTypeLabel,
  getCourtName,
  getCourtsBySchool,
} from "@/lib/court-utils";
import type { CourtType } from "@shared/court-config";
import type { CourtReservation as Reservation } from "@shared/schema";

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getCellTintClass(type: CourtType | undefined): string {
  switch (type) {
    case "baseball":
    case "baseball2f":
      return "bg-orange-50 hover:bg-orange-100";
    case "gym":
      return "bg-purple-50 hover:bg-purple-100";
    case "basketball":
      return "bg-red-50 hover:bg-red-100";
    case "dance":
      return "bg-pink-50 hover:bg-pink-100";
    case "oxygen":
      return "bg-cyan-50 hover:bg-cyan-100";
    case "badminton":
      return "bg-blue-50 hover:bg-blue-100";
    default:
      return "bg-gray-50 hover:bg-gray-100";
  }
}

function getCellBadgeClass(type: CourtType | undefined): string {
  switch (type) {
    case "baseball":
    case "baseball2f":
      return "bg-orange-500/90 text-white";
    case "gym":
      return "bg-purple-500/90 text-white";
    case "basketball":
      return "bg-red-500/90 text-white";
    case "dance":
      return "bg-pink-500/90 text-white";
    case "oxygen":
      return "bg-cyan-500/90 text-white";
    case "badminton":
      return "bg-blue-500/90 text-white";
    default:
      return "bg-gray-500/90 text-white";
  }
}

const WEEKDAY_LABELS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];

export default function CourtsWeekPage() {
  const today = getTodayString();
  const school = useSchool();
  const [location, navigate] = useLocation();
  const schoolCourts = getCourtsBySchool(school);

  const initialAnchor = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      const dateParam = url.searchParams.get("date");
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return new Date(dateParam + "T00:00:00");
      }
    } catch {
      /* ignore */
    }
    return new Date(today + "T00:00:00");
  }, [today, location]);

  const [weekStart, setWeekStart] = useState<Date>(() =>
    getMondayOf(initialAnchor),
  );

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const dateStrs = useMemo(() => weekDays.map(fmtDate), [weekDays]);

  const dayQueries = useQueries({
    queries: dateStrs.map((d) => ({
      queryKey: [`/api/courts/${school}/reservations`, d],
    })),
  });

  const isLoading = dayQueries.some((q) => q.isLoading);
  const isFetching = dayQueries.some((q) => q.isFetching);
  const lastSync =
    dayQueries
      .map((q) => q.dataUpdatedAt)
      .filter((t) => !!t)
      .sort()
      .at(-1) ?? null;

  const matrix = useMemo(() => {
    const m = new Map<number, Reservation[][]>();
    for (const c of schoolCourts) {
      m.set(
        c.id,
        Array.from({ length: 7 }, () => [] as Reservation[]),
      );
    }
    dayQueries.forEach((q, dayIdx) => {
      const list = (q.data as Reservation[] | undefined) ?? [];
      for (const r of list) {
        const arr = m.get(r.court);
        if (arr) arr[dayIdx].push(r);
      }
    });
    Array.from(m.values()).forEach((arr: Reservation[][]) => {
      arr.forEach((list) =>
        list.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );
    });
    return m;
  }, [dayQueries, schoolCourts]);

  const dayTotals = useMemo(
    () =>
      dateStrs.map((_, dayIdx) => {
        let total = 0;
        Array.from(matrix.values()).forEach(
          (arr: Reservation[][]) => (total += arr[dayIdx].length),
        );
        return total;
      }),
    [dateStrs, matrix],
  );

  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  const [openCell, setOpenCell] = useState<{
    dayIdx: number;
    courtId: number;
  } | null>(null);
  const [detail, setDetail] = useState<Reservation | null>(null);

  const handlePrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const handleNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const handleThisWeek = () =>
    setWeekStart(getMondayOf(new Date(today + "T00:00:00")));

  const weekRangeText = `${format(weekStart, "M/d", { locale: zhTW })} – ${format(
    weekDays[6],
    "M/d",
    { locale: zhTW },
  )}`;

  const headerRight = (
    <>
      <div className="flex items-center bg-white border border-gray-200 rounded-md h-8">
        <button
          onClick={handlePrev}
          data-testid="button-prev-week"
          className="px-1.5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-l-md transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div
          className="px-2 text-xs font-medium text-gray-700 min-w-[100px] text-center tabular-nums"
          data-testid="text-current-week"
        >
          {weekRangeText}
        </div>
        <button
          onClick={handleNext}
          data-testid="button-next-week"
          className="px-1.5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-r-md transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <Button
        onClick={handleThisWeek}
        data-testid="button-this-week"
        size="sm"
        variant="outline"
        className="h-8 px-3 text-xs font-medium"
      >
        本週
      </Button>
    </>
  );

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `140px repeat(7, minmax(90px, 1fr))`,
  };
  const minWidth = 140 + 7 * 90;

  const openCellData = openCell
    ? {
        date: dateStrs[openCell.dayIdx],
        dateObj: weekDays[openCell.dayIdx],
        courtId: openCell.courtId,
        list: matrix.get(openCell.courtId)?.[openCell.dayIdx] ?? [],
      }
    : null;

  const noCourts = schoolCourts.length === 0;

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <AppHeader
        rightSlot={headerRight}
        lastSync={lastSync}
        syncLoading={isFetching}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              本週檢視
            </h2>
            <div className="text-sm text-gray-500 mt-0.5">
              本週共{" "}
              <strong className="text-blue-700" data-testid="text-week-total">
                {weekTotal}
              </strong>{" "}
              筆預約
              {isLoading && (
                <span
                  className="ml-2 inline-flex items-center gap-1 text-blue-600"
                  data-testid="status-loading"
                >
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                  載入中
                </span>
              )}
            </div>
          </div>
        </div>

        {noCourts ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <div className="text-base font-medium text-gray-700 mb-1">
              尚未建立場地資料
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${minWidth}px` }}>
                <div
                  className="grid bg-gray-50/80 border-b border-gray-200 sticky top-0 z-10"
                  style={gridStyle}
                >
                  <div className="px-3 py-3 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    場地 \ 日期
                  </div>
                  {weekDays.map((d, idx) => {
                    const dateStr = fmtDate(d);
                    const isToday = dateStr === today;
                    const isWeekend = idx >= 5;
                    return (
                      <button
                        key={dateStr}
                        onClick={() =>
                          navigate(`/courts/${school}?date=${dateStr}`)
                        }
                        data-testid={`week-header-${dateStr}`}
                        title="點擊查看該日詳細排程"
                        className={`px-2 py-2 border-l border-gray-100 first:border-l-0 text-left transition group ${
                          isToday ? "bg-blue-50" : "hover:bg-gray-100/70"
                        }`}
                      >
                        <div
                          className={`text-[10px] font-medium ${
                            isToday
                              ? "text-blue-700"
                              : isWeekend
                                ? idx === 6
                                  ? "text-red-500"
                                  : "text-blue-500"
                                : "text-gray-500"
                          }`}
                        >
                          {WEEKDAY_LABELS[idx]}
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span
                            className={`text-[15px] font-semibold tabular-nums ${
                              isToday ? "text-blue-700" : "text-gray-900"
                            }`}
                          >
                            {d.getDate()}
                          </span>
                          <span
                            className={`text-[10px] tabular-nums ${
                              isToday ? "text-blue-500" : "text-gray-400"
                            }`}
                          >
                            {pad2(d.getMonth() + 1)}/{pad2(d.getDate())}
                          </span>
                          {dayTotals[idx] > 0 && (
                            <span className="ml-auto text-[10px] font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 tabular-nums">
                              {dayTotals[idx]}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {schoolCourts.map((court) => {
                  const type = court.type;
                  const tint = getCellTintClass(type);
                  const badge = getCellBadgeClass(type);
                  const bar = getCourtBarClass(type);
                  const rowData = matrix.get(court.id) ?? [];
                  return (
                    <div
                      key={court.id}
                      className="grid border-t border-gray-100"
                      style={gridStyle}
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-white sticky left-0 z-[1] border-r border-gray-100">
                        <div
                          className={`w-[3px] self-stretch rounded-full ${bar}`}
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] text-gray-400 leading-tight">
                            {getCourtTypeLabel(type)}
                          </div>
                          <div
                            className="text-[12px] font-semibold text-gray-800 truncate leading-tight"
                            title={court.name}
                          >
                            {court.name}
                          </div>
                        </div>
                      </div>
                      {weekDays.map((_, dayIdx) => {
                        const list = rowData[dayIdx] ?? [];
                        const dateStr = dateStrs[dayIdx];
                        const isToday = dateStr === today;
                        const hasBooking = list.length > 0;

                        if (!hasBooking) {
                          return (
                            <div
                              key={dateStr}
                              data-testid={`cell-${court.id}-${dateStr}`}
                              className={`h-14 border-l border-gray-100 first:border-l-0 ${
                                isToday ? "bg-blue-50/40" : ""
                              }`}
                            />
                          );
                        }

                        return (
                          <button
                            key={dateStr}
                            data-testid={`cell-${court.id}-${dateStr}`}
                            onClick={() =>
                              setOpenCell({ dayIdx, courtId: court.id })
                            }
                            className={`h-14 border-l border-gray-100 first:border-l-0 px-2 py-1.5 flex flex-col justify-center items-stretch gap-1 transition cursor-pointer ${tint} ${
                              isToday ? "ring-1 ring-blue-200 ring-inset" : ""
                            }`}
                            title={`${list.length} 筆預約 — 點擊查看詳情`}
                          >
                            <div className="flex items-center gap-1">
                              <div className="flex flex-1 gap-0.5 min-w-0">
                                {list.slice(0, 4).map((r) => (
                                  <div
                                    key={r.id}
                                    className={`h-1.5 flex-1 rounded-full ${bar} opacity-80`}
                                  />
                                ))}
                              </div>
                              <span
                                className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 tabular-nums shrink-0 ${badge}`}
                              >
                                {list.length}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-600 truncate text-left tabular-nums">
                              {list[0].startTime}
                              {list.length > 1 && (
                                <span className="text-gray-400">
                                  {" "}
                                  · +{list.length - 1}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!openCell} onOpenChange={(v) => !v && setOpenCell(null)}>
        <DialogContent className="sm:max-w-md" data-testid="week-cell-dialog">
          {openCellData && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${getCourtBarClass(
                      getCourtType(openCellData.courtId),
                    )}`}
                  />
                  {getCourtName(openCellData.courtId)}
                  <span className="text-sm font-normal text-gray-500">
                    ·{" "}
                    {format(openCellData.dateObj, "M月d日 (EEEE)", {
                      locale: zhTW,
                    })}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {openCellData.list.length === 0 ? (
                  <div className="text-sm text-gray-400 py-4 text-center">
                    無預約
                  </div>
                ) : (
                  openCellData.list.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setDetail(r);
                        setOpenCell(null);
                      }}
                      data-testid={`week-dialog-item-${r.id}`}
                      className="w-full text-left bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm rounded-lg p-3 transition flex items-center gap-3"
                    >
                      <div
                        className={`w-1 self-stretch rounded-full ${getCourtBarClass(
                          getCourtType(r.court),
                        )}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {r.customerName}
                          </span>
                          {r.bookingNumber && (
                            <span className="text-[10px] text-gray-400">
                              #{r.bookingNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-gray-500 tabular-nums mt-0.5">
                          {r.startTime}–{r.endTime}
                          {r.serviceName && (
                            <span className="text-gray-400">
                              {" "}
                              · {r.serviceName}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-gray-100">
                <Link href={`/courts/${school}?date=${openCellData.date}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-blue-600 hover:text-blue-700"
                    data-testid="week-dialog-jump"
                    onClick={() => setOpenCell(null)}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    跳到該日完整排程
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ReservationDetailModal
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        reservation={detail}
      />
    </div>
  );
}
