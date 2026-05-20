import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SwimVenue {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface SwimTimeSlot {
  id: string;
  period: string;
  startTime: string;
  endTime: string;
  order: number;
}

interface SwimScheduleItem {
  id: string;
  date: string;
  venueId: string;
  timeSlotId: string;
  className: string;
  coachName: string | null;
  coachName2: string | null;
  coachCount: number;
  isClassLocked: boolean;
  notes: string | null;
  venue: SwimVenue;
  timeSlot: SwimTimeSlot;
}

const VENUE_COLORS: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  yellow: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const DOW_ZH = ["日", "一", "二", "三", "四", "五", "六"];

const getWeekStart = (offset = 0): Date => {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const toDateStr = (d: Date): string => d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });

const formatDateRange = (start: Date, end: Date): string => {
  const s = start.toLocaleDateString("zh-TW", { month: "long", day: "numeric" });
  const e = end.toLocaleDateString("zh-TW", { month: "long", day: "numeric" });
  return `${start.getFullYear()} 年  ${s} – ${e}`;
};

export default function CollabCoursesPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("all");

  const weekStart = useMemo(() => getWeekStart(weekOffset), [weekOffset]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const startDate = toDateStr(weekStart);
  const endDate = toDateStr(weekEnd);

  const { data: venuesData, isLoading: venuesLoading } = useQuery<{ venues: SwimVenue[] }>({
    queryKey: ["/api/bff/collab-courses/venues"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: schedulesData, isLoading: schedLoading, refetch } = useQuery<{
    schedules: SwimScheduleItem[];
    venues: SwimVenue[];
    startDate: string;
    endDate: string;
    fetchedAt: string;
  }>({
    queryKey: ["/api/bff/collab-courses/schedules", startDate, endDate, selectedVenueId],
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (selectedVenueId !== "all") params.set("venueId", selectedVenueId);
      return fetch(`/api/bff/collab-courses/schedules?${params}`).then((r) => r.json());
    },
    staleTime: 60 * 1000,
  });

  const venues = venuesData?.venues ?? [];
  const schedules = schedulesData?.schedules ?? [];

  const timeSlots = useMemo(() => {
    const map = new Map<string, SwimTimeSlot>();
    for (const s of schedules) {
      if (!map.has(s.timeSlot.id)) map.set(s.timeSlot.id, s.timeSlot);
    }
    return Array.from(map.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [schedules]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return { date: toDateStr(d), label: `${DOW_ZH[d.getDay()]}`, dayNum: d.getDate(), d };
    });
  }, [weekStart]);

  const cellMap = useMemo(() => {
    const m = new Map<string, SwimScheduleItem[]>();
    for (const item of schedules) {
      const key = `${item.date}__${item.timeSlot.id}`;
      const arr = m.get(key) ?? [];
      arr.push(item);
      m.set(key, arr);
    }
    return m;
  }, [schedules]);

  const isLoading = venuesLoading || schedLoading;
  const today = toDateStr(new Date());

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/60 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">偕同課週次課表</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setWeekOffset(0)}
              data-testid="btn-week-today"
            >
              本週
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((o) => o - 1)}
              data-testid="btn-week-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[180px] text-center hidden sm:block">
              {formatDateRange(weekStart, weekEnd)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((o) => o + 1)}
              data-testid="btn-week-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => refetch()}
              data-testid="btn-refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedVenueId("all")}
            data-testid="tab-venue-all"
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              selectedVenueId === "all"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            全部場館
          </button>
          {venues.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVenueId(v.id)}
              data-testid={`tab-venue-${v.id}`}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                selectedVenueId === v.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            載入課表中…
          </div>
        ) : timeSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <CalendarDays className="h-8 w-8 opacity-30" />
            <p className="text-sm">本週尚無課表資料</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-border/60">
                <th className="py-2 px-3 text-left text-muted-foreground font-medium w-[90px] bg-muted/30 border-r border-border/40">
                  時段
                </th>
                {weekDays.map(({ date, label, dayNum }) => (
                  <th
                    key={date}
                    className={cn(
                      "py-2 px-2 text-center font-medium border-r border-border/40 last:border-r-0",
                      date === today
                        ? "bg-foreground/5 text-foreground"
                        : "text-muted-foreground bg-muted/20",
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] opacity-70">週{label}</span>
                      <span
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold",
                          date === today && "bg-foreground text-background",
                        )}
                      >
                        {dayNum}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => (
                <tr key={slot.id} className="border-b border-border/40 hover:bg-muted/10">
                  <td className="py-2 px-3 border-r border-border/40 bg-muted/20 align-top">
                    <div className="font-medium text-foreground">{slot.period}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {slot.startTime}:00–{slot.endTime}:00
                    </div>
                  </td>
                  {weekDays.map(({ date }) => {
                    const key = `${date}__${slot.id}`;
                    const items = cellMap.get(key) ?? [];
                    return (
                      <td
                        key={date}
                        className={cn(
                          "py-1.5 px-1.5 border-r border-border/40 last:border-r-0 align-top min-h-[60px]",
                          date === today && "bg-foreground/3",
                        )}
                        data-testid={`cell-${date}-${slot.id}`}
                      >
                        {items.length === 0 ? null : (
                          <div className="flex flex-col gap-1">
                            {items.map((item) => {
                              const colorClass =
                                VENUE_COLORS[item.venue.color] ??
                                "bg-muted text-muted-foreground";
                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "rounded px-1.5 py-1 text-[11px] leading-tight",
                                    colorClass,
                                  )}
                                  data-testid={`schedule-item-${item.id}`}
                                >
                                  {selectedVenueId === "all" && (
                                    <div className="flex items-center gap-0.5 mb-0.5 opacity-70">
                                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                                      <span className="text-[10px] truncate">{item.venue.name}</span>
                                    </div>
                                  )}
                                  <div className="font-semibold truncate">{item.className}</div>
                                  {item.coachName && (
                                    <div className="truncate opacity-80">
                                      {item.coachName}
                                      {item.coachName2 && ` / ${item.coachName2}`}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {schedules.length > 0 && (
        <div className="px-4 py-2 border-t border-border/40 flex items-center gap-2 flex-wrap">
          {venues
            .filter((v) => selectedVenueId === "all" || v.id === selectedVenueId)
            .map((v) => (
              <span key={v.id} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span
                  className={cn("h-2 w-2 rounded-sm", VENUE_COLORS[v.color]?.split(" ")[0] ?? "bg-muted")}
                />
                {v.name}
              </span>
            ))}
          {schedulesData?.fetchedAt && (
            <span className="ml-auto text-[10px] text-muted-foreground opacity-60">
              更新於 {new Date(schedulesData.fetchedAt).toLocaleTimeString("zh-TW")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
