import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, GraduationCap, Loader2, AlertCircle } from "lucide-react";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { SupervisorModuleShell } from "@/modules/supervisor/module-shell";
import { cn } from "@/lib/utils";

interface SwimVenue { id: string; name: string; shortName?: string }
interface SwimTimeSlot { period: number; label: string; startTime: string; endTime: string }
interface SwimScheduleEntry {
  id: string; date: string;
  venue: SwimVenue;
  timeSlot: SwimTimeSlot;
  className: string;
  coachName: string;
  coachName2?: string;
  status?: string;
}

const DAYS = ["一", "二", "三", "四", "五", "六", "日"];
const COLORS = [
  "bg-[#e8f0fe] text-[#1a56cb] border-[#c3d3fb]",
  "bg-[#e6f4ea] text-[#1a6335] border-[#b7dfc3]",
  "bg-[#fce8e6] text-[#b31412] border-[#f5c0be]",
  "bg-[#fff3e0] text-[#b45309] border-[#fdd9a0]",
  "bg-[#f3e8fd] text-[#6b21a8] border-[#d8b4fe]",
  "bg-[#e0f7fa] text-[#006064] border-[#80deea]",
  "bg-[#fce4ec] text-[#880e4f] border-[#f48fb1]",
];

function getWeekStart(offset = 0): Date {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtDisplay(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function CollabCoursesPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("all");

  const weekStart = useMemo(() => getWeekStart(weekOffset), [weekOffset]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }), [weekStart]);

  const { data: venues = [], isLoading: venuesLoading } = useQuery<SwimVenue[]>({
    queryKey: ["/api/bff/collab-courses/venues"],
  });

  const { data: schedules = [], isLoading: schedulesLoading, isError } = useQuery<SwimScheduleEntry[]>({
    queryKey: ["/api/bff/collab-courses/schedules", fmt(weekStart), fmt(weekEnd)],
    queryFn: () =>
      fetch(`/api/bff/collab-courses/schedules?startDate=${fmt(weekStart)}&endDate=${fmt(weekEnd)}`)
        .then((r) => r.json()),
  });

  const filteredSchedules = useMemo(() =>
    selectedVenueId === "all"
      ? schedules
      : schedules.filter((e) => e.venue.id === selectedVenueId),
    [schedules, selectedVenueId]);

  const timeSlots = useMemo(() => {
    const seen = new Map<number, SwimTimeSlot>();
    schedules.forEach((e) => { if (!seen.has(e.timeSlot.period)) seen.set(e.timeSlot.period, e.timeSlot); });
    return Array.from(seen.values()).sort((a, b) => a.period - b.period);
  }, [schedules]);

  const classColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    schedules.forEach((e) => { if (!map.has(e.className)) { map.set(e.className, COLORS[i % COLORS.length]); i++; } });
    return map;
  }, [schedules]);

  const lookup = useMemo(() => {
    const map = new Map<string, SwimScheduleEntry[]>();
    filteredSchedules.forEach((e) => {
      const key = `${e.date}|${e.timeSlot.period}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [filteredSchedules]);

  const isLoading = venuesLoading || schedulesLoading;

  const weekLabel = weekOffset === 0
    ? `本週（${fmtDisplay(weekStart)}–${fmtDisplay(weekEnd)}）`
    : weekOffset === 1
    ? `下週（${fmtDisplay(weekStart)}–${fmtDisplay(weekEnd)}）`
    : weekOffset === -1
    ? `上週（${fmtDisplay(weekStart)}–${fmtDisplay(weekEnd)}）`
    : `${fmtDisplay(weekStart)}–${fmtDisplay(weekEnd)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            data-testid="button-prev-week"
            className="workbench-focus grid h-8 w-8 place-items-center rounded-[6px] border border-[#dfe7ef] bg-white text-[#637185] hover:bg-[#f7f9fb]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-black text-[#10233f]" data-testid="text-week-label">{weekLabel}</span>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            data-testid="button-next-week"
            className="workbench-focus grid h-8 w-8 place-items-center rounded-[6px] border border-[#dfe7ef] bg-white text-[#637185] hover:bg-[#f7f9fb]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              data-testid="button-today-week"
              className="workbench-focus ml-1 rounded-[6px] border border-[#dfe7ef] bg-white px-2.5 py-1 text-[11px] font-black text-[#637185] hover:bg-[#f7f9fb]"
            >
              本週
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedVenueId("all")}
            data-testid="tab-venue-all"
            className={cn(
              "workbench-focus rounded-full px-3 py-1 text-[11px] font-black transition",
              selectedVenueId === "all"
                ? "bg-[#10233f] text-white"
                : "border border-[#dfe7ef] bg-white text-[#637185] hover:bg-[#f7f9fb]",
            )}
          >
            全部場館
          </button>
          {venues.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVenueId(v.id)}
              data-testid={`tab-venue-${v.id}`}
              className={cn(
                "workbench-focus rounded-full px-3 py-1 text-[11px] font-black transition",
                selectedVenueId === v.id
                  ? "bg-[#10233f] text-white"
                  : "border border-[#dfe7ef] bg-white text-[#637185] hover:bg-[#f7f9fb]",
              )}
            >
              {v.shortName ?? v.name}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#637185]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] font-bold text-[#b31412]">
          <AlertCircle className="h-4 w-4" /> 無法載入課表，請稍後再試
        </div>
      ) : timeSlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-[#8b9aae]">
          <GraduationCap className="h-8 w-8 opacity-40" />
          <p className="text-[13px] font-bold">本週無課程資料</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-[#dfe7ef] bg-white">
          <table className="min-w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[#dfe7ef] bg-[#f7f9fb]">
                <th className="w-[90px] px-3 py-2.5 text-left text-[11px] font-black text-[#8b9aae]">節次</th>
                {weekDates.map((d, i) => {
                  const isToday = fmt(d) === fmt(new Date());
                  return (
                    <th
                      key={i}
                      className={cn(
                        "px-2 py-2.5 text-center text-[11px] font-black",
                        isToday ? "text-[#1f6fd1]" : "text-[#8b9aae]",
                      )}
                    >
                      <div>{DAYS[i]}</div>
                      <div className={cn("mt-0.5 text-[12px]", isToday && "font-black text-[#1f6fd1]")}>
                        {fmtDisplay(d)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, si) => (
                <tr
                  key={slot.period}
                  className={cn("border-b border-[#dfe7ef]", si % 2 === 1 && "bg-[#fafbfc]")}
                >
                  <td className="px-3 py-2 align-top">
                    <div className="font-black text-[#10233f]">第{slot.period}節</div>
                    <div className="text-[10px] text-[#8b9aae]">{slot.startTime}–{slot.endTime}</div>
                  </td>
                  {weekDates.map((d, di) => {
                    const key = `${fmt(d)}|${slot.period}`;
                    const entries = lookup.get(key) ?? [];
                    return (
                      <td key={di} className="px-1.5 py-1.5 align-top">
                        <div className="space-y-1">
                          {entries.map((e) => {
                            const colorClass = classColorMap.get(e.className) ?? COLORS[0];
                            return (
                              <div
                                key={e.id}
                                data-testid={`card-course-${e.id}`}
                                className={cn(
                                  "rounded-[6px] border px-2 py-1.5 text-[11px]",
                                  colorClass,
                                )}
                              >
                                <div className="font-black leading-tight">{e.className}</div>
                                <div className="mt-0.5 text-[10px] opacity-80">
                                  {e.venue.shortName ?? e.venue.name}
                                </div>
                                <div className="mt-0.5 text-[10px] opacity-70">
                                  {e.coachName}{e.coachName2 ? ` / ${e.coachName2}` : ""}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function EmployeeCollabCoursesFrame() {
  return (
    <EmployeeShell title="偕同課課表" subtitle="swim-scheduler 偕同課週課表">
      <CollabCoursesPage />
    </EmployeeShell>
  );
}

export function SupervisorCollabCoursesFrame() {
  return (
    <SupervisorModuleShell
      moduleId="collab-courses"
      title="偕同課課表"
      eyebrow="COLLAB COURSES"
      description="swim-scheduler 偕同課課表，依場館與週次篩選。"
      layoutMode="default"
    >
      <CollabCoursesPage />
    </SupervisorModuleShell>
  );
}

export default CollabCoursesPage;
