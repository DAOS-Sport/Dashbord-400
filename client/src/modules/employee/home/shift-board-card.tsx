import { Link } from "wouter";
import type { ShiftBoardDto } from "@shared/domain/workbench";
import { DegradedCard, NotConnectedCard } from "@/components/shared/not-connected-card";
import { cn } from "@/lib/utils";
import { WorkbenchCard } from "@/shared/ui-kit/workbench-card";

const formatBoardDateHeader = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" }).format(parsed);
};

const fmtShiftHHMM = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

type FlatShiftPerson = {
  userId: string;
  name: string;
  role: string;
  isCurrentUser: boolean;
  start: string;
  end: string;
  isCurrent: boolean;
  isFuture: boolean;
};

type RoleGroup = "櫃台" | "救生" | "守望" | "其他";
const ROLE_GROUP_ORDER: RoleGroup[] = ["櫃台", "救生", "守望", "其他"];

function classifyRoleGroup(role: string): RoleGroup {
  if (role === "櫃台") return "櫃台";
  if (role.includes("救生")) return "救生";
  if (role.includes("守望")) return "守望";
  return "其他";
}

type PersonWithStatus = { person: FlatShiftPerson; status: "active" | "upcoming" | "finished" };

function ShiftRoleBlock({
  label,
  labelClass,
  people,
}: {
  label: string;
  labelClass: string;
  people: PersonWithStatus[];
}) {
  if (!people.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <p className={cn("text-[11px] font-black uppercase tracking-[0.08em]", labelClass)}>{label}</p>
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-slate-100 px-1 text-[10px] font-black text-text-body">
          {people.length}
        </span>
      </div>
      <div className="space-y-2">
        {people.map(({ person, status }) => (
          <div key={person.userId} className="flex items-center justify-between gap-2" data-testid={`row-shift-person-${person.userId}`}>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "truncate text-[14px] font-bold leading-snug",
                  status === "finished" ? "text-slate-300" : "text-text-strong",
                )}
              >
                {person.name}
              </span>
              {status === "active" && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  上班中
                </span>
              )}
            </div>
            <span className={cn("shrink-0 font-mono text-[11px] font-bold tabular-nums", status === "finished" ? "text-slate-300" : "text-text-body")}>
              {fmtShiftHHMM(person.start)}–{fmtShiftHHMM(person.end)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildMorningEveningFromBoard(shifts: ShiftBoardDto["shifts"]): { morning: FlatShiftPerson[]; evening: FlatShiftPerson[] } {
  const morning = new Map<string, FlatShiftPerson>();
  const evening = new Map<string, FlatShiftPerson>();
  const prio = (p: { isCurrent: boolean; isFuture: boolean }) => (p.isCurrent ? 2 : p.isFuture ? 1 : 0);
  for (const s of shifts) {
    const sh = s.start ? new Date(s.start).getHours() : 0;
    const eh = s.end ? new Date(s.end).getHours() : 0;
    const toMorning = sh < 12;
    const toEvening = sh >= 12 || (sh < 12 && eh > 12);
    for (const p of s.people) {
      const entry: FlatShiftPerson = { ...p, start: s.start, end: s.end, isCurrent: s.isCurrent, isFuture: s.isFuture };
      if (toMorning) {
        const ex = morning.get(p.userId);
        if (!ex || prio(entry) > prio(ex)) morning.set(p.userId, entry);
      }
      if (toEvening) {
        const ex = evening.get(p.userId);
        if (!ex || prio(entry) > prio(ex)) evening.set(p.userId, entry);
      }
    }
  }
  return { morning: Array.from(morning.values()), evening: Array.from(evening.values()) };
}

function buildRoleGroupMap(people: FlatShiftPerson[]): Map<RoleGroup, PersonWithStatus[]> {
  const map = new Map<RoleGroup, PersonWithStatus[]>();
  for (const person of people) {
    const g = classifyRoleGroup(person.role);
    const status: "active" | "upcoming" | "finished" = person.isCurrent ? "active" : person.isFuture ? "upcoming" : "finished";
    const arr = map.get(g) ?? [];
    arr.push({ person, status });
    map.set(g, arr);
  }
  return map;
}

const ROLE_GROUP_LABEL_CLASS: Record<RoleGroup, string> = {
  櫃台: "text-text-body",
  救生: "text-text-body",
  守望: "text-text-body",
  其他: "text-text-body",
};

export function ShiftBoardCard({ board }: { board?: ShiftBoardDto }) {
  const shifts = board?.shifts ?? [];
  const dateLabel = formatBoardDateHeader(board?.date);
  const facilityName = board?.facility?.name ?? "";
  const headerSubtitle = [facilityName, dateLabel].filter(Boolean).join(" · ");
  const lastSyncLabel = board?.sourceStatus.lastSyncedAt
    ? new Date(board.sourceStatus.lastSyncedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return (
    <WorkbenchCard className="flex h-full flex-col overflow-hidden p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[16px] font-black text-text-strong">今日班表</h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">SHIFT</span>
          </div>
          {headerSubtitle ? (
            <p className="mt-1 text-[12px] font-bold text-text-muted" data-testid="text-shift-board-subtitle">{headerSubtitle}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">本日</p>
          <p className="text-[18px] font-black leading-none text-text-strong" data-testid="text-shift-board-total">
            {board?.totalCount ?? 0} <span className="text-[12px] font-bold text-text-body">人</span>
          </p>
        </div>
      </div>

      {!board ? (
        <NotConnectedCard title="今日班表" reason="external_pending" />
      ) : !board.sourceStatus.connected ? (
        <DegradedCard title="今日班表" />
      ) : shifts.length === 0 ? (
        <div className="rounded-[10px] bg-surface-soft p-6 text-center text-[13px] font-bold text-text-body">今日尚無班表</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {(() => {
            const { morning, evening } = buildMorningEveningFromBoard(shifts);
            const morningMap = buildRoleGroupMap(morning);
            const eveningMap = buildRoleGroupMap(evening);
            return (
              <div className="grid grid-cols-2 divide-x divide-border-subtle">
                <div className="flex flex-col">
                  <div className="border-b border-border-subtle px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">早班</p>
                    <p className="text-[9px] font-bold text-text-muted">12:00 前</p>
                  </div>
                  <div className="space-y-4 px-3 py-3">
                    {ROLE_GROUP_ORDER.map((g) => {
                      const people = morningMap.get(g) ?? [];
                      return people.length ? <ShiftRoleBlock key={g} label={g} labelClass={ROLE_GROUP_LABEL_CLASS[g]} people={people} /> : null;
                    })}
                    {!morning.length && <div className="py-4 text-center text-[12px] font-bold text-text-muted">無早班</div>}
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="border-b border-border-subtle px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">晚班</p>
                    <p className="text-[9px] font-bold text-text-muted">12:00 後</p>
                  </div>
                  <div className="space-y-4 px-3 py-3">
                    {ROLE_GROUP_ORDER.map((g) => {
                      const people = eveningMap.get(g) ?? [];
                      return people.length ? <ShiftRoleBlock key={g} label={g} labelClass={ROLE_GROUP_LABEL_CLASS[g]} people={people} /> : null;
                    })}
                    {!evening.length && <div className="py-4 text-center text-[12px] font-bold text-text-muted">無晚班</div>}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="mt-3 flex shrink-0 items-center justify-between border-t border-border-subtle pt-2 text-[11px]">
        <span className="font-bold text-text-muted">
          {lastSyncLabel ? `最後同步 ${lastSyncLabel}` : "尚未同步"}
        </span>
        <Link
          href="/employee/shift"
          className="font-black text-stitch-on-secondary-container hover:underline"
          data-testid="link-shift-view-all"
        >
          前往完整班表 →
        </Link>
      </div>
    </WorkbenchCard>
  );
}
