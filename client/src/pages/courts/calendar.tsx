import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useLocation } from "wouter";
import { RefreshCw, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarGrid } from "./_components/calendar-grid";
import { MobileScheduleList } from "./_components/mobile-schedule-list";
import { ReservationDetailModal } from "./_components/reservation-detail-modal";
import { StatusLegend } from "./_components/status-legend";
import { StatsCards } from "./_components/stats-cards";
import { AppHeader } from "./_components/app-header";
import { useSchool } from "@/lib/court-school";
import { getTodayString } from "@/lib/court-date-utils";
import {
  getCourtCategories,
  getCourtsBySchool,
  getCourtsByFilter,
} from "@/lib/court-utils";
import type { CourtReservation as Reservation } from "@shared/schema";

export default function CourtsCalendarPage() {
  const school = useSchool();
  const [location] = useLocation();

  const getInitialDate = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get("date");
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
    }
    return getTodayString();
  };

  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [courtFilter, setCourtFilter] = useState<string>("all");

  const schoolCourts = getCourtsBySchool(school);
  const categories = getCourtCategories(school);
  const visibleCourts = getCourtsByFilter(school, courtFilter);

  useEffect(() => {
    setCourtFilter("all");
  }, [school]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (
      dateParam &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateParam) &&
      dateParam !== selectedDate
    ) {
      setSelectedDate(dateParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const {
    data: reservations = [],
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery<Reservation[]>({
    queryKey: [`/api/courts/${school}/reservations`, selectedDate],
    enabled: !!selectedDate,
  });

  const handleTodayClick = () => setSelectedDate(getTodayString());
  const handlePreviousDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  };
  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  };

  const currentDateDisplay = format(
    new Date(selectedDate + "T00:00:00"),
    "yyyy年M月d日 (EEEE)",
    { locale: zhTW },
  );

  const headerRight = (
    <>
      <div className="flex items-center bg-white border border-gray-200 rounded-md h-8">
        <button
          onClick={handlePreviousDay}
          data-testid="button-previous-day"
          title="前一天"
          className="px-1.5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-l-md transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Input
          type="date"
          id="date-picker"
          data-testid="input-date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-7 px-1 text-xs w-[120px] border-0 bg-transparent text-gray-700 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          onClick={handleNextDay}
          data-testid="button-next-day"
          title="後一天"
          className="px-1.5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-r-md transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <Button
        onClick={handleTodayClick}
        data-testid="button-today"
        size="sm"
        variant="outline"
        className="h-8 px-3 text-xs font-medium"
      >
        今天
      </Button>
      <button
        onClick={() => refetch()}
        data-testid="button-refresh"
        title="重新整理"
        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </>
  );

  const noCourts = schoolCourts.length === 0;

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <AppHeader
        rightSlot={headerRight}
        lastSync={dataUpdatedAt || null}
        syncLoading={isFetching}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2
              className="text-xl sm:text-2xl font-bold text-gray-900"
              data-testid="text-current-date"
            >
              {currentDateDisplay}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                營業時間 06:00 – 22:00
              </span>
              <span className="text-gray-300">·</span>
              <span>共 {schoolCourts.length} 個場地</span>
              {isLoading && (
                <>
                  <span className="text-gray-300">·</span>
                  <span
                    className="inline-flex items-center gap-1 text-blue-600"
                    data-testid="status-loading"
                  >
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    載入中
                  </span>
                </>
              )}
            </div>
          </div>

          {!noCourts && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={courtFilter} onValueChange={setCourtFilter}>
                <SelectTrigger
                  className="w-[180px] bg-white"
                  data-testid="select-court-filter"
                >
                  <SelectValue placeholder="場地篩選" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>分類</SelectLabel>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>單一場地</SelectLabel>
                    {schoolCourts.map((c) => (
                      <SelectItem key={c.id} value={`court-${c.id}`}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {noCourts ? (
          <div
            className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center"
            data-testid="empty-school-courts"
          >
            <div className="text-base font-medium text-gray-700 mb-1">
              尚未建立場地資料
            </div>
            <p className="text-sm text-gray-500">
              請於
              <code className="mx-1 bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                shared/court-config.ts
              </code>
              加入場地清單。
            </p>
          </div>
        ) : (
          <>
            <StatsCards reservations={reservations} school={school} />

            <div className="hidden md:block">
              <CalendarGrid
                reservations={reservations}
                onReservationClick={setSelectedReservation}
                visibleCourts={visibleCourts}
                showNowIndicator={selectedDate === getTodayString()}
              />
            </div>

            <div className="md:hidden">
              <MobileScheduleList
                reservations={reservations}
                onReservationClick={setSelectedReservation}
                visibleCourts={visibleCourts}
              />
            </div>

            <StatusLegend />
          </>
        )}
      </main>

      <ReservationDetailModal
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        reservation={selectedReservation}
      />
    </div>
  );
}
