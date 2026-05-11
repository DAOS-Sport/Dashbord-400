import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmployeeShell } from "@/modules/employee/employee-shell";
import { fetchEmployeeHome } from "../home/api";
import type { ShiftSummary } from "@shared/domain/workbench";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
};

const shortFacilityName = (full: string) =>
  full.replace(/游泳池|&運動中心|運動中心|&.*/, "").trim() || full;

function classifyRole(role?: string): "counter" | "lifeguard" | "other" {
  if (!role) return "other";
  if (role === "櫃台") return "counter";
  if (role.includes("救生")) return "lifeguard";
  return "other";
}

function getActivePeriod(shifts: ShiftSummary[]): string {
  const sorted = [...shifts].sort((a, b) => Date.parse(a.startsAt ?? "0") - Date.parse(b.startsAt ?? "0"));
  const firstEvening = sorted.find((s) => {
    const h = s.startsAt ? new Date(s.startsAt).getHours() : -1;
    return h >= 14;
  });
  if (!firstEvening) return "早班";
  return Date.now() >= Date.parse(firstEvening.startsAt ?? "0") ? "晚班" : "早班";
}

// ── Components ───────────────────────────────────────────────────────────────

type PersonStatus = "active" | "upcoming" | "finished";

function getPersonStatus(s: ShiftSummary): PersonStatus {
  return s.status === "active" ? "active" : s.status === "upcoming" ? "upcoming" : "finished";
}

function ShiftPersonRow({ shift }: { shift: ShiftSummary }) {
  const status = getPersonStatus(shift);
  const name = shift.employeeName ?? shift.label.split("/")[0]?.trim() ?? "—";
  return (
    <div className="flex items-center gap-2.5" data-testid={`row-shift-person-${shift.id}`}>
      <span
        className={cn(
          "text-[16px] font-bold leading-snug",
          status === "finished" ? "text-[#c8d3de]" : "text-[#10233f]",
        )}
      >
        {name}
      </span>
      <span className="font-mono text-[13px] font-bold text-[#8b9aae]">
        {fmtTime(shift.startsAt)}–{fmtTime(shift.endsAt)}
      </span>
      {status === "active" && (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eaf8ef] px-2 py-0.5 text-[10px] font-black text-[#15935d]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#15935d]" />
          上班中
        </span>
      )}
      {status === "finished" && (
        <span className="ml-auto shrink-0 text-[10px] font-bold text-[#c8d3de]">已結束</span>
      )}
    </div>
  );
}

function RoleSection({
  label,
  labelClass,
  shifts,
}: {
  label: string;
  labelClass: string;
  shifts: ShiftSummary[];
}) {
  if (!shifts.length) return null;
  return (
    <div className="px-5 py-4">
      <p className={cn("mb-3", labelClass)} data-testid={`section-role-${label}`}>{label}</p>
      <div className="space-y-2.5">
        {shifts.map((s) => (
          <ShiftPersonRow key={s.id} shift={s} />
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const useNow = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
};

export default function EmployeeShiftPage() {
  const now = useNow();
  const homeQuery = useQuery({ queryKey: ["/api/bff/employee/home"], queryFn: fetchEmployeeHome });
  const home = homeQuery.data;
  const shifts = home?.shifts.data ?? [];
  const facilityName = shortFacilityName(home?.facility.name ?? "");
  const activeCount = shifts.filter((s) => s.status === "active").length;

  const activePeriod = getActivePeriod(shifts);

  const counterShifts = shifts.filter((s) => classifyRole(s.role) === "counter");
  const lifeguardShifts = shifts.filter((s) => classifyRole(s.role) === "lifeguard");
  const otherShifts = shifts.filter((s) => classifyRole(s.role) === "other");

  const currentTime = now.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  });

  return (
    <EmployeeShell title="今日班表" subtitle="即時從排班系統拉取，每 30 秒更新一次。">
      <div className="rounded-[14px] border border-[#e6edf4] bg-white overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[17px] font-black tracking-tight text-[#10233f]" data-testid="shift-title">
            即時班表
          </h2>
          <span className="text-[12px] font-bold text-[#8b9aae]" data-testid="shift-current-time">
            現在 {currentTime}
          </span>
        </div>

        {/* Loading */}
        {homeQuery.isLoading && (
          <div className="px-5 pb-6 text-[13px] font-bold text-[#8b9aae]">載入班表中…</div>
        )}

        {/* Empty */}
        {!homeQuery.isLoading && shifts.length === 0 && (
          <div className="px-5 pb-6 text-[13px] font-bold text-[#8b9aae]">今日尚無班表資料。</div>
        )}

        {/* Content */}
        {!homeQuery.isLoading && shifts.length > 0 && (
          <>
            {/* Facility + active count row */}
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

            {/* Active period label */}
            <div className="border-t border-[#f0f4f8] px-5 pt-4 pb-1">
              <p
                className="text-[22px] font-black leading-none tracking-tight text-[#15935d]"
                data-testid="shift-period-label"
              >
                {activePeriod}
              </p>
            </div>

            {/* Role sections */}
            <div className="divide-y divide-[#f0f4f8]">
              <RoleSection
                label="櫃台"
                labelClass="text-[12px] font-black tracking-wide text-[#8b9aae]"
                shifts={counterShifts}
              />
              <RoleSection
                label="救生"
                labelClass="text-[18px] font-black text-[#10233f]"
                shifts={lifeguardShifts}
              />
              {otherShifts.length > 0 && (
                <RoleSection
                  label={otherShifts[0]?.role || "其他"}
                  labelClass="text-[14px] font-black text-[#536175]"
                  shifts={otherShifts}
                />
              )}
            </div>

            {/* Footer total */}
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
