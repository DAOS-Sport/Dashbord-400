import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader, getCourtsBasePath } from "./_components/app-header";
import { useSchool } from "@/lib/court-school";
import { getTodayString } from "@/lib/court-date-utils";

interface MonthResponse {
  yearMonth: string;
  counts: Record<string, number>;
}

const WEEK_HEADER = ["日", "一", "二", "三", "四", "五", "六"];

function buildMonthCells(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const cells: { date: string | null; day: number | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: dateStr, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}

export default function CourtsMonthPage() {
  const today = getTodayString();
  const school = useSchool();
  const [location, setLocation] = useLocation();
  const basePath = getCourtsBasePath(location);

  const initialDate = new Date(today + "T00:00:00");
  const [currentMonth, setCurrentMonth] = useState({
    year: initialDate.getFullYear(),
    month: initialDate.getMonth() + 1,
  });

  const yearMonth = `${currentMonth.year}-${String(currentMonth.month).padStart(2, "0")}`;

  const { data, isLoading, isFetching, dataUpdatedAt } =
    useQuery<MonthResponse>({
      queryKey: [`/api/courts/${school}/reservations-month`, yearMonth],
    });

  const cells = useMemo(
    () => buildMonthCells(currentMonth.year, currentMonth.month),
    [currentMonth],
  );

  const counts = data?.counts ?? {};
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const handlePrev = () =>
    setCurrentMonth((prev) => {
      const m = prev.month - 1;
      if (m < 1) return { year: prev.year - 1, month: 12 };
      return { year: prev.year, month: m };
    });

  const handleNext = () =>
    setCurrentMonth((prev) => {
      const m = prev.month + 1;
      if (m > 12) return { year: prev.year + 1, month: 1 };
      return { year: prev.year, month: m };
    });

  const handleToday = () => {
    const d = new Date();
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const handleDateClick = (dateStr: string) =>
    setLocation(`${basePath}/${school}?date=${dateStr}`);

  const monthDisplay = format(
    new Date(`${yearMonth}-01T00:00:00`),
    "yyyy年M月",
    { locale: zhTW },
  );

  const headerRight = (
    <>
      <div className="flex items-center bg-white border border-gray-200 rounded-md h-8">
        <button
          onClick={handlePrev}
          data-testid="button-prev-month"
          className="px-1.5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-l-md transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div
          className="px-2 text-xs font-medium text-gray-700 min-w-[80px] text-center tabular-nums"
          data-testid="text-current-month"
        >
          {monthDisplay}
        </div>
        <button
          onClick={handleNext}
          data-testid="button-next-month"
          className="px-1.5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-r-md transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <Button
        onClick={handleToday}
        data-testid="button-today"
        size="sm"
        variant="outline"
        className="h-8 px-3 text-xs font-medium"
      >
        本月
      </Button>
    </>
  );

  return (
    <div className="font-sans">
      <AppHeader
        rightSlot={headerRight}
        lastSync={dataUpdatedAt || null}
        syncLoading={isFetching}
      />

      <main>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              月曆總覽
            </h2>
            <div className="text-sm text-gray-500 mt-0.5">
              本月共{" "}
              <strong className="text-blue-700" data-testid="text-total-count">
                {totalCount}
              </strong>{" "}
              筆預約
              {isLoading && (
                <span
                  className="ml-2 inline-flex items-center gap-1 text-blue-600"
                  data-testid="status-loading"
                >
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  載入中
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {WEEK_HEADER.map((w, i) => (
              <div
                key={w}
                className={`p-3 text-center font-semibold text-sm border-r border-gray-200 last:border-r-0 ${
                  i === 0
                    ? "text-red-600"
                    : i === 6
                      ? "text-blue-600"
                      : "text-gray-700"
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              if (!cell.date) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="border-r border-b border-gray-200 last:border-r-0 min-h-[100px] bg-gray-50"
                  />
                );
              }
              const count = counts[cell.date] ?? 0;
              const isToday = cell.date === today;
              const weekday = idx % 7;
              return (
                <button
                  key={cell.date}
                  onClick={() => handleDateClick(cell.date!)}
                  data-testid={`day-${cell.date}`}
                  className={`border-r border-b border-gray-200 last:border-r-0 min-h-[100px] p-2 text-left hover:bg-blue-50 transition-colors flex flex-col ${
                    isToday ? "bg-blue-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-semibold ${
                        isToday
                          ? "bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
                          : weekday === 0
                            ? "text-red-600"
                            : weekday === 6
                              ? "text-blue-600"
                              : "text-gray-900"
                      }`}
                    >
                      {cell.day}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    {count > 0 ? (
                      <div
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          count >= 20
                            ? "bg-red-100 text-red-700"
                            : count >= 10
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {count} 筆
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">無預約</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
