import { useMemo } from "react";
import { CalendarCheck, Clock, Activity, CircleDashed } from "lucide-react";
import {
  getCourtsBySchool,
  type CourtType,
  type SchoolId,
} from "@/lib/court-utils";
import type { CourtReservation as Reservation } from "@shared/schema";

interface StatsCardsProps {
  reservations: Reservation[];
  school: SchoolId;
}

const HOURS_PER_DAY = 16;
const HOUR_SLOTS = Array.from({ length: HOURS_PER_DAY }, (_, i) => 6 + i);

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function reservationHours(r: Reservation): number[] {
  const start = toMinutes(r.startTime);
  const end = toMinutes(r.endTime);
  const hours: number[] = [];
  for (const h of HOUR_SLOTS) {
    const slotStart = h * 60;
    const slotEnd = slotStart + 60;
    if (start < slotEnd && end > slotStart) hours.push(h);
  }
  return hours;
}

const TYPE_GROUPS: { key: string; label: string; types: CourtType[] }[] = [
  { key: "badminton", label: "羽球場", types: ["badminton"] },
  { key: "baseball", label: "棒球場", types: ["baseball", "baseball2f"] },
  {
    key: "facility",
    label: "其他場地",
    types: ["gym", "basketball", "dance", "oxygen", "other"],
  },
];

export function StatsCards({ reservations, school }: StatsCardsProps) {
  const stats = useMemo(() => {
    const schoolCourts = getCourtsBySchool(school);
    const usedCells = new Set<string>();
    let totalHours = 0;

    for (const r of reservations) {
      const hours = reservationHours(r);
      totalHours += hours.length;
      for (const h of hours) usedCells.add(`${r.court}-${h}`);
    }

    const totalCells = schoolCourts.length * HOURS_PER_DAY;
    const usedCellCount = usedCells.size;
    const freeCellCount = Math.max(0, totalCells - usedCellCount);

    const groupRates = TYPE_GROUPS.map((g) => {
      const courtsInGroup = schoolCourts.filter((c) =>
        g.types.includes(c.type),
      );
      const courtIds = new Set(courtsInGroup.map((c) => c.id));
      const groupTotalCells = courtsInGroup.length * HOURS_PER_DAY;
      let groupUsed = 0;
      Array.from(usedCells).forEach((cell) => {
        const [courtStr] = cell.split("-");
        if (courtIds.has(parseInt(courtStr, 10))) groupUsed++;
      });
      const rate =
        groupTotalCells > 0
          ? Math.round((groupUsed / groupTotalCells) * 100)
          : 0;
      return {
        key: g.key,
        label: g.label,
        rate,
        used: groupUsed,
        total: groupTotalCells,
      };
    });

    return {
      total: reservations.length,
      totalHours,
      usedCellCount,
      freeCellCount,
      groupRates,
    };
  }, [reservations, school]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
      <StatCard
        icon={<CalendarCheck className="w-3.5 h-3.5" />}
        iconClass="bg-blue-50 text-blue-400"
        label="今日總預約"
        value={stats.total}
        unit="筆"
        testId="stat-total"
      />
      <StatCard
        icon={<Clock className="w-3.5 h-3.5" />}
        iconClass="bg-emerald-50 text-emerald-400"
        label="已使用時段"
        value={stats.totalHours}
        unit="小時"
        testId="stat-hours"
      />
      {stats.groupRates.map((g) => {
        const palette =
          g.key === "badminton"
            ? "bg-blue-50 text-blue-400"
            : g.key === "baseball"
              ? "bg-orange-50 text-orange-400"
              : "bg-purple-50 text-purple-400";
        return (
          <StatCard
            key={g.key}
            icon={<Activity className="w-3.5 h-3.5" />}
            iconClass={palette}
            label={`${g.label}使用率`}
            value={g.rate}
            unit="%"
            sublabel={`${g.used} / ${g.total}`}
            testId={`stat-rate-${g.key}`}
            progress={g.rate}
          />
        );
      })}
      <StatCard
        icon={<CircleDashed className="w-3.5 h-3.5" />}
        iconClass="bg-gray-50 text-gray-300"
        label="空閒時段"
        value={stats.freeCellCount}
        unit="格"
        testId="stat-free"
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: number;
  unit?: string;
  sublabel?: string;
  testId: string;
  progress?: number;
}

function StatCard({
  icon,
  iconClass,
  label,
  value,
  unit,
  sublabel,
  testId,
  progress,
}: StatCardProps) {
  return (
    <div
      className="bg-white rounded-md border border-gray-200/70 px-2.5 py-2"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-gray-400 font-medium leading-tight truncate">
          {label}
        </div>
        <div
          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${iconClass}`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-lg font-bold text-gray-900 tabular-nums leading-tight">
          {value}
        </span>
        {unit && <span className="text-[10px] text-gray-300">{unit}</span>}
        {sublabel && (
          <span className="ml-auto text-[9px] text-gray-300 tabular-nums">
            {sublabel}
          </span>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-1.5 h-[2px] bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-300 rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
