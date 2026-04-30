import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { fetchEmployeeHome } from "../home/api";
import type { ShiftSummary } from "@shared/domain/workbench";
import { cn } from "@/lib/utils";

const fmtTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
};

const fmtRemaining = (endsAt?: string): string => {
  if (!endsAt) return "";
  const ms = Date.parse(endsAt) - Date.now();
  if (ms <= 0) return "已結束";
  const totalMins = Math.ceil(ms / 60000);
  if (totalMins < 60) return `剩 ${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `剩 ${h}h${m}m` : `剩 ${h}h`;
};

const calcProgress = (startsAt?: string, endsAt?: string): number => {
  if (!startsAt || !endsAt) return 0;
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
};

const periodMap: Record<string, string> = {
  early: "早班",
  mid: "中班",
  late: "晚班",
  custom: "特殊班",
};

const roleKey = (s: ShiftSummary): string => {
  if (s.role && s.role.trim() && !/^(regular|overtime|substitute)$/.test(s.role.trim())) return s.role.trim();
  // No role data — each person gets their own row
  return s.id;
};

const roleDisplay = (s: ShiftSummary): string => {
  if (s.role && s.role.trim() && !/^(regular|overtime|substitute)$/.test(s.role.trim())) return s.role.trim();
  if (s.period && periodMap[s.period]) return periodMap[s.period];
  if (s.kind && s.kind !== "regular") return s.kind;
  const h = s.startsAt ? new Date(s.startsAt).getHours() : -1;
  if (h >= 0 && h < 12) return "早班";
  if (h >= 12 && h < 16) return "中班";
  if (h >= 16) return "晚班";
  return "一般班";
};

type ShiftGroup = {
  role: string;
  active?: ShiftSummary;
  next?: ShiftSummary;
  all: ShiftSummary[];
};

const buildGroups = (shifts: ShiftSummary[]): ShiftGroup[] => {
  const map = new Map<string, ShiftSummary[]>();
  for (const s of shifts) {
    const key = roleKey(s);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  const groups: ShiftGroup[] = [];
  for (const [role, items] of Array.from(map.entries())) {
    const sorted = [...items].sort((a, b) => Date.parse(a.startsAt ?? "0") - Date.parse(b.startsAt ?? "0"));
    const active = sorted.find((s) => s.status === "active");
    const activeEnd = active ? Date.parse(active.endsAt ?? "0") : 0;
    const next = sorted.find((s) => s.status !== "active" && Date.parse(s.startsAt ?? "0") >= activeEnd);
    groups.push({ role, active, next, all: sorted });
  }
  return groups.sort((a, b) => {
    if (!!a.active !== !!b.active) return a.active ? -1 : 1;
    const aT = Date.parse(a.active?.startsAt ?? a.all[0]?.startsAt ?? "0");
    const bT = Date.parse(b.active?.startsAt ?? b.all[0]?.startsAt ?? "0");
    return aT - bT;
  });
};

const useNow = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
};

const shortFacilityName = (full: string) =>
  full.replace(/游泳池|&運動中心|運動中心|&.*/, "").trim() || full;

export default function EmployeeShiftPage() {
  const now = useNow();
  const homeQuery = useQuery({ queryKey: ["/api/bff/employee/home"], queryFn: fetchEmployeeHome });
  const home = homeQuery.data;
  const shifts = home?.shifts.data ?? [];
  const facilityName = shortFacilityName(home?.facility.name ?? "");
  const activeCount = shifts.filter((s) => s.status === "active").length;
  const groups = buildGroups(shifts);

  const currentTime = now.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  });

  return (
    <EmployeeShell title="今日班表" subtitle="即時從排班系統拉取，每 30 秒更新一次。">
      <div className="rounded-[14px] border border-[#e6edf4] bg-white overflow-hidden shadow-sm">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[17px] font-black tracking-tight text-[#10233f]" data-testid="shift-title">
            即時班表
          </h2>
          <span className="text-[12px] font-bold text-[#8b9aae]" data-testid="shift-current-time">
            現在 {currentTime}
          </span>
        </div>

        {/* ── Loading ── */}
        {homeQuery.isLoading && (
          <div className="px-5 pb-6 text-[13px] font-bold text-[#8b9aae]">載入班表中…</div>
        )}

        {/* ── Empty ── */}
        {!homeQuery.isLoading && shifts.length === 0 && (
          <div className="px-5 pb-6 text-[13px] font-bold text-[#8b9aae]">今日尚無班表資料。</div>
        )}

        {/* ── Facility row ── */}
        {!homeQuery.isLoading && shifts.length > 0 && (
          <>
            <div className="flex items-center justify-between border-t border-[#f0f4f8] px-5 py-2.5">
              <span className="text-[14px] font-black text-[#263b56]" data-testid="shift-facility-name">
                {facilityName}
              </span>
              {activeCount > 0 && (
                <span
                  className="rounded-full bg-[#eaf8ef] px-3 py-0.5 text-[11px] font-black text-[#15935d]"
                  data-testid="shift-active-count"
                >
                  {activeCount} 人在班
                </span>
              )}
            </div>

            {/* ── Shift groups ── */}
            <div className="divide-y divide-[#f0f4f8]">
              {groups.map((group) => (
                <ShiftGroupRow key={group.role} group={group} />
              ))}
            </div>

            {/* ── Footer total ── */}
            <div className="flex items-center justify-between border-t border-[#f0f4f8] bg-[#f8fafc] px-5 py-3">
              <span className="text-[12px] font-bold text-[#8b9aae]">本日班表總計</span>
              <span className="text-[13px] font-black text-[#10233f]">{shifts.length} 人</span>
            </div>
          </>
        )}
      </div>
    </EmployeeShell>
  );
}

function ShiftGroupRow({ group }: { group: ShiftGroup }) {
  const person = group.active ?? group.all.at(-1);
  if (!person) return null;

  const isActive = !!group.active;
  const isUpcoming = !group.active && group.all.some((s) => s.status === "upcoming");
  const progress = isActive ? calcProgress(person.startsAt, person.endsAt) : isUpcoming ? 0 : 100;
  const remaining = isActive ? fmtRemaining(person.endsAt) : isUpcoming ? "未到班" : "已結束";
  const label = roleDisplay(person);

  return (
    <div className="px-5 py-4" data-testid={`shift-group-${group.role}`}>
      {/* Role label */}
      <p className="mb-0.5 text-[11px] font-bold tracking-wide text-[#8b9aae]">
        {label}
      </p>

      {/* Name + time */}
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={cn(
            "text-[20px] font-black leading-snug",
            isActive ? "text-[#10233f]" : "text-[#aab4be]",
          )}
          data-testid={`shift-name-${group.role}`}
        >
          {person.employeeName ?? person.label.split("/")[0]?.trim() ?? "—"}
        </p>
        <span className="shrink-0 text-[13px] font-bold text-[#637185]">
          {fmtTime(person.startsAt)} – {fmtTime(person.endsAt)}
        </span>
      </div>

      {/* Progress bar + remaining */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-[#eef2f6]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: isActive ? "#4a5a1e" : "#c8d3de",
            }}
          />
        </div>
        <span
          className={cn(
            "w-[60px] shrink-0 text-right text-[11px] font-bold",
            isActive ? "text-[#637185]" : "text-[#aab4be]",
          )}
        >
          {remaining}
        </span>
      </div>

      {/* Next shift handover */}
      {group.next && (
        <p className="mt-1.5 text-[12px] font-bold text-[#8b9aae]">
          └ 接{" "}
          <span className="text-[#537190]">
            {group.next.employeeName ?? group.next.label.split("/")[0]?.trim()}
          </span>
          {" · "}
          {fmtTime(group.next.startsAt)}–{fmtTime(group.next.endsAt)}
        </p>
      )}
    </div>
  );
}
