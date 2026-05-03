import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import BentoCard from "@/components/portal/BentoCard";
import type { LaneRental } from "@shared/schema";

const LANES = ["A", "B", "C", "D", "E"] as const;
const SLOTS: Array<{ start: string; end: string }> = (() => {
  const out: Array<{ start: string; end: string }> = [];
  let mins = 5 * 60 + 30;
  const endLimit = 22 * 60;
  while (mins < endLimit) {
    const next = mins + 30;
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    out.push({ start: fmt(mins), end: fmt(next) });
    mins = next;
  }
  return out;
})();

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface Props {
  facilityKey: string;
}

// Read-only portal card showing today's lane rentals. Surfaced when
// facilityConfigs[facilityKey].sections.rental === true. The full grid
// is collapsible; the summary view shows just the active bookings.
export default function PortalLaneRentalCard({ facilityKey }: Props) {
  const [expanded, setExpanded] = useState(false);
  const date = todayStr();

  const q = useQuery<{ items: LaneRental[] }>({
    queryKey: ["/api/lane-rentals", facilityKey, date],
    queryFn: async () => {
      const res = await fetch(`/api/lane-rentals?facilityKey=${encodeURIComponent(facilityKey)}&date=${date}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!facilityKey,
  });

  const items = q.data?.items ?? [];
  const sortedItems = [...items].sort((a, b) =>
    a.laneCode.localeCompare(b.laneCode) || a.startTime.localeCompare(b.startTime),
  );

  return (
    <BentoCard testId="section-lane-rentals" variant="white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="portal-label text-stitch-secondary">RENTAL</span>
          <h2 className="font-headline text-xl font-bold text-stitch-primary mt-1">今日水道租借</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{date}（唯讀）</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="portal-label text-stitch-secondary cursor-pointer hover:underline"
          data-testid="button-toggle-lane-rentals"
        >
          {expanded ? "收合 ▴" : "完整時段表 ▾"}
        </button>
      </div>

      {q.isLoading && <p className="text-sm text-slate-400 py-4 text-center" data-testid="state-rental-loading">載入中…</p>}

      {!q.isLoading && !expanded && (
        sortedItems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4" data-testid="state-rental-empty">今日尚無水道租借</p>
        ) : (
          <ul className="space-y-1.5" data-testid="list-rental-summary">
            {sortedItems.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-stitch-surface-low text-sm"
                data-testid={`item-rental-${r.id}`}
              >
                <span className="font-mono font-bold text-stitch-secondary w-8">{r.laneCode}</span>
                <span className="font-mono text-xs text-slate-600 w-[88px]">{r.startTime}-{r.endTime}</span>
                <span className="flex-1 truncate text-stitch-on-surface font-medium">{r.renterName}</span>
              </li>
            ))}
          </ul>
        )
      )}

      {!q.isLoading && expanded && (
        <div className="overflow-x-auto rounded-lg border border-stitch-surface-low" data-testid="grid-rental-full">
          <table className="w-full text-[11px]">
            <thead className="bg-stitch-surface-low">
              <tr>
                <th className="px-2 py-1.5 text-left font-bold w-[78px]">時段</th>
                {LANES.map((l) => (
                  <th key={l} className="px-2 py-1.5 text-center font-bold">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot, idx) => (
                <tr key={slot.start} className={idx % 2 === 0 ? "bg-white" : "bg-stitch-surface-low/40"}>
                  <td className="px-2 py-1 font-mono text-slate-500 whitespace-nowrap">{slot.start}</td>
                  {LANES.map((lane) => {
                    const hit = items.find((r) =>
                      r.laneCode === lane &&
                      timeToMin(r.startTime) < timeToMin(slot.end) &&
                      timeToMin(slot.start) < timeToMin(r.endTime),
                    );
                    const isFirst = hit && hit.startTime === slot.start;
                    return (
                      <td
                        key={lane}
                        className={hit ? "bg-emerald-100 text-emerald-900 px-1 py-0.5 text-center font-bold border-l border-emerald-300" : "px-1 py-0.5"}
                        data-testid={`portal-cell-${lane}-${slot.start}`}
                      >
                        {isFirst ? hit.renterName.slice(0, 6) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BentoCard>
  );
}
