import { useEffect, useMemo, useState } from "react";
import { Redirect } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Calendar, Trash2, MapPinned, Ruler } from "lucide-react";
import { useAuthMe } from "@/shared/auth/session";
import { facilityConfigs } from "@/config/facility-configs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DreamLoader } from "@/shared/ui-kit/dream-loader";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { LaneRental } from "@shared/schema";
import {
  SupervisorErrorState,
  SupervisorLoadingState,
  SupervisorMetricCard,
  SupervisorModuleShell,
  SupervisorPanel,
} from "@/modules/supervisor/module-shell";

const LANE_CODES = ["A", "B", "C", "D", "E", "F", "G", "H"];
const laneLabel = (code: string) => code === "B" ? "潛水租借水道 B" : `水道 ${code}`;
const laneColor = (index: number) => ["#15935d", "#2f6fe8", "#c86912", "#7453d6", "#dc4c62", "#007166", "#8b5a2b", "#536175"][index % 8];

// 5:30 ~ 22:00, 30 min slots → 34 slots (last endTime is 22:00)
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

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function rangeOverlapsSlot(rental: LaneRental, slot: { start: string; end: string }): boolean {
  return timeToMin(rental.startTime) < timeToMin(slot.end) && timeToMin(slot.start) < timeToMin(rental.endTime);
}

interface DialogState {
  mode: "create" | "edit";
  laneCode: string;
  startTime: string;
  endTime: string;
  rental?: LaneRental;
}

type PoolDiagramConfig = {
  poolLength: "25" | "50";
  laneCount: number;
  usage: Record<string, { label: string; startMeter: number; endMeter: number; color: string }>;
};

const diagramStorageKey = (facilityKey: string) => `junsz:lane-diagram:${facilityKey}`;

const createDefaultDiagramConfig = (facilityKey: string): PoolDiagramConfig => ({
  poolLength: facilityKey === "songshan_pool" ? "25" : "50",
  laneCount: facilityKey === "songshan_pool" ? 5 : 6,
  usage: Object.fromEntries(
    LANE_CODES.map((code, index) => [
      code,
      {
        label: laneLabel(code),
        startMeter: 0,
        endMeter: facilityKey === "songshan_pool" ? 25 : 50,
        color: laneColor(index),
      },
    ]),
  ),
});

export default function AdminLaneRentalsPage() {
  const { data: session, isLoading: sessLoading, isError: sessError } = useAuthMe();
  const allFacilityKeys = useMemo(() => Object.keys(facilityConfigs), []);
  const [facilityKey, setFacilityKey] = useState<string>("songshan_pool");
  const [date, setDate] = useState<string>(todayStr());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [diagramConfig, setDiagramConfig] = useState<PoolDiagramConfig>(() => createDefaultDiagramConfig("songshan_pool"));
  const { toast } = useToast();

  useEffect(() => {
    const stored = window.localStorage.getItem(diagramStorageKey(facilityKey));
    if (stored) {
      try {
        setDiagramConfig(JSON.parse(stored) as PoolDiagramConfig);
        return;
      } catch {
        window.localStorage.removeItem(diagramStorageKey(facilityKey));
      }
    }
    setDiagramConfig(createDefaultDiagramConfig(facilityKey));
  }, [facilityKey]);

  useEffect(() => {
    window.localStorage.setItem(diagramStorageKey(facilityKey), JSON.stringify(diagramConfig));
  }, [diagramConfig, facilityKey]);

  const activeLanes = useMemo(
    () => LANE_CODES.slice(0, diagramConfig.laneCount).map((code, index) => ({
      code,
      label: diagramConfig.usage[code]?.label || laneLabel(code),
      color: diagramConfig.usage[code]?.color || laneColor(index),
    })),
    [diagramConfig],
  );

  const rentalsQ = useQuery<{ items: LaneRental[] }>({
    queryKey: ["/api/lane-rentals", facilityKey, date],
    queryFn: async () => {
      const res = await fetch(`/api/lane-rentals?facilityKey=${encodeURIComponent(facilityKey)}&date=${date}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!facilityKey,
  });

  const items = rentalsQ.data?.items ?? [];

  const metrics = useMemo(() => {
    const totalSlotHours = SLOTS.length * 0.5 * activeLanes.length;
    const bookedHours = items.reduce((sum, r) => sum + (timeToMin(r.endTime) - timeToMin(r.startTime)) / 60, 0);
    return {
      total: totalSlotHours,
      booked: bookedHours,
      free: Math.max(0, totalSlotHours - bookedHours),
    };
  }, [activeLanes.length, items]);

  const createMut = useMutation({
    mutationFn: async (input: { laneCode: string; startTime: string; endTime: string; renterName: string; renterContact?: string; note?: string }) => {
      const res = await apiRequest("POST", "/api/lane-rentals", { facilityKey, bookingDate: date, ...input });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lane-rentals", facilityKey, date] });
      setDialog(null);
      toast({ title: "已新增租借" });
    },
    onError: (e: Error) => toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...patch }: { id: number; renterName?: string; renterContact?: string; note?: string; startTime?: string; endTime?: string }) => {
      const res = await apiRequest("PATCH", `/api/lane-rentals/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lane-rentals", facilityKey, date] });
      setDialog(null);
      toast({ title: "已更新" });
    },
    onError: (e: Error) => toast({ title: "更新失敗", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/lane-rentals/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lane-rentals", facilityKey, date] });
      setDialog(null);
      toast({ title: "已取消租借" });
    },
    onError: (e: Error) => toast({ title: "取消失敗", description: e.message, variant: "destructive" }),
  });

  if (sessLoading) return <SupervisorLoadingState label="權限驗證中" />;
  if (sessError || !session) return <Redirect to="/login" />;
  const allowed = session.grantedRoles?.includes("supervisor") || session.grantedRoles?.includes("system");
  if (!allowed) {
    return <SupervisorErrorState message="無瀏覽權限：此頁面僅開放給主管或系統管理員使用。" />;
  }

  // Build a lookup: laneCode → rentals on that lane
  const rentalsByLane: Record<string, LaneRental[]> = {};
  for (const r of items) {
    if (!rentalsByLane[r.laneCode]) rentalsByLane[r.laneCode] = [];
    rentalsByLane[r.laneCode].push(r);
  }

  const actions = (
    <>
      <Select value={facilityKey} onValueChange={setFacilityKey}>
        <SelectTrigger className="h-9 w-full min-w-[250px] rounded-[7px] border-[#d3d8de] bg-white text-[12px] font-bold sm:w-[260px]" data-testid="select-lane-rental-facility">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allFacilityKeys.map((k) => (
            <SelectItem key={k} value={k} data-testid={`option-facility-${k}`}>
              {facilityConfigs[k].shortName} · {facilityConfigs[k].facilityName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))} data-testid="button-prev-day">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7c8998]" />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || todayStr())}
          className="h-9 w-[168px] rounded-[7px] border-[#d3d8de] bg-white pl-8 text-[12px] font-bold"
          data-testid="input-date"
        />
      </div>
      <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))} data-testid="button-next-day">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" onClick={() => setDate(todayStr())} data-testid="button-today">今日</Button>
    </>
  );

  return (
    <SupervisorModuleShell
      moduleId="lane-rentals"
      title="水道租借"
      eyebrow="LANE RENTALS"
      description="松山館水道時段租借、現場查詢與衝突控管。"
      actions={actions}
      layoutMode="schedule"
    >
      <div className="mb-4 grid gap-3 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="grid grid-cols-3 gap-2 2xl:grid-cols-1">
          <SupervisorMetricCard label="總時數" value={`${metrics.total.toFixed(1)} 小時`} testId="metric-total" />
          <SupervisorMetricCard label="已租時數" value={`${metrics.booked.toFixed(1)} 小時`} testId="metric-booked" tone="green" />
          <SupervisorMetricCard label="空檔時數" value={`${metrics.free.toFixed(1)} 小時`} testId="metric-free" tone="muted" />
        </div>
        <LaneDiagramEditor config={diagramConfig} onChange={setDiagramConfig} activeLanes={activeLanes} compact />
      </div>

      <div>
        {rentalsQ.isError && (
          <div className="rounded-[8px] border border-[#ffd3da] bg-[#fff7f8] p-4 text-[13px] font-bold text-[#9f2336]" data-testid="text-lane-rental-error">
            此場館租借資料暫時無法載入；員工示意圖仍可先編輯，待後端權限與資料源接通後會自動顯示排程。
          </div>
        )}

        {rentalsQ.isLoading && (
          <div className="grid place-items-center py-16"><DreamLoader label="載入中" compact /></div>
        )}

        {!rentalsQ.isLoading && !rentalsQ.isError && (
          <SupervisorPanel className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-xs">
                <thead className="sticky top-0 bg-[#f7f9fb]">
                  <tr>
                    <th className="w-[88px] border-r border-[var(--supervisor-border)] px-3 py-2 text-left font-black text-[#102940]">時段</th>
                    {activeLanes.map((l) => (
                      <th key={l.code} className="border-r border-[var(--supervisor-border)] px-3 py-2 text-center font-black text-[#102940] last:border-r-0" data-testid={`header-lane-${l.code}`}>
                        {l.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map((slot, idx) => (
                    <tr key={slot.start} className={idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"}>
                      <td className="whitespace-nowrap border-r border-[var(--supervisor-border)] px-3 py-1.5 font-mono text-[11px] text-[#7c8998]">
                        {slot.start}-{slot.end}
                      </td>
                      {activeLanes.map((lane) => {
                        const onLane = rentalsByLane[lane.code] || [];
                        const hit = onLane.find((r) => rangeOverlapsSlot(r, slot));
                        // Show renter name only on the first slot of the rental
                        const isFirstSlot = hit && hit.startTime === slot.start;
                        return (
                          <td key={lane.code} className="border-r border-[var(--supervisor-border)] p-0 last:border-r-0">
                            {hit ? (
                              <button
                                type="button"
                                onClick={() => setDialog({ mode: "edit", laneCode: lane.code, startTime: hit.startTime, endTime: hit.endTime, rental: hit })}
                                className="h-7 w-full border-l-2 border-[#2f9e5b] bg-[#e7f4ec] px-2 text-left text-[#165f35] transition hover:bg-[#d7eddf]"
                                data-testid={`cell-rental-${lane.code}-${slot.start}`}
                              >
                                {isFirstSlot ? <span className="text-[10px] font-bold truncate block">{hit.renterName}</span> : ""}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDialog({ mode: "create", laneCode: lane.code, startTime: slot.start, endTime: slot.end })}
                                className="h-7 w-full transition hover:bg-[#e7f4ec]"
                                data-testid={`cell-empty-${lane.code}-${slot.start}`}
                                aria-label={`新增 ${lane.label} ${slot.start}-${slot.end}`}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SupervisorPanel>
        )}
      </div>

      {dialog && (
        <RentalDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onCreate={(input) => createMut.mutate(input)}
          onUpdate={(id, patch) => updateMut.mutate({ id, ...patch })}
          onDelete={(id) => deleteMut.mutate(id)}
          isPending={createMut.isPending || updateMut.isPending || deleteMut.isPending}
          slots={SLOTS}
        />
      )}
    </SupervisorModuleShell>
  );
}

function LaneDiagramEditor({
  config,
  activeLanes,
  onChange,
  compact = false,
}: {
  config: PoolDiagramConfig;
  activeLanes: Array<{ code: string; label: string; color: string }>;
  onChange: (next: PoolDiagramConfig) => void;
  compact?: boolean;
}) {
  const poolLength = Number(config.poolLength);
  const updateUsage = (code: string, patch: Partial<PoolDiagramConfig["usage"][string]>) => {
    onChange({
      ...config,
      usage: {
        ...config.usage,
        [code]: {
          ...(config.usage[code] ?? { label: laneLabel(code), startMeter: 0, endMeter: poolLength, color: laneColor(0) }),
          ...patch,
        },
      },
    });
  };

  return (
    <SupervisorPanel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--supervisor-border)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#e7f7f6] text-[#007166]">
            <MapPinned className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#007166]">STAFF DIAGRAM</p>
            <h2 className="mt-1 text-[15px] font-black text-[#102940]">員工水道示意圖</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">{compact ? "設定泳池長度、水道數與每道使用座標。" : "設定 25 / 50 公尺泳池、水道數與每道使用範圍；現場員工可依示意圖快速判斷座標。"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={config.poolLength} onValueChange={(value) => {
            const nextLength = value as "25" | "50";
            onChange({
              ...config,
              poolLength: nextLength,
              usage: Object.fromEntries(
                Object.entries(config.usage).map(([code, usage]) => [
                  code,
                  { ...usage, endMeter: Math.min(Number(nextLength), usage.endMeter || Number(nextLength)) },
                ]),
              ),
            });
          }}>
            <SelectTrigger className="h-9 w-[132px] rounded-[7px] bg-white text-[12px] font-black">
              <Ruler className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 公尺</SelectItem>
              <SelectItem value="50">50 公尺</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(config.laneCount)} onValueChange={(value) => onChange({ ...config, laneCount: Number(value) })}>
            <SelectTrigger className="h-9 w-[118px] rounded-[7px] bg-white text-[12px] font-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[4, 5, 6, 7, 8].map((count) => <SelectItem key={count} value={String(count)}>{count} 道</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={compact ? "grid gap-3 p-4" : "grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]"}>
        <div className="overflow-x-auto">
          <div className={compact ? "min-w-[520px] rounded-[10px] border border-[#dfe7ef] bg-[#f8fbff] p-3" : "min-w-[680px] rounded-[10px] border border-[#dfe7ef] bg-[#f8fbff] p-3"}>
            <div className="mb-2 flex items-center justify-between text-[11px] font-black text-[#637185]">
              <span>0m 起點</span>
              <span>{config.poolLength}m 終點</span>
            </div>
            <div className="space-y-1">
              {activeLanes.map((lane) => {
                const usage = config.usage[lane.code] ?? { label: lane.label, startMeter: 0, endMeter: poolLength, color: lane.color };
                const left = Math.max(0, Math.min(100, (usage.startMeter / poolLength) * 100));
                const width = Math.max(6, Math.min(100 - left, ((usage.endMeter - usage.startMeter) / poolLength) * 100));
                return (
                  <div key={lane.code} className="grid grid-cols-[76px_1fr] items-center gap-2">
                    <div className="text-[12px] font-black text-[#102940]">{lane.label}</div>
                    <div className="relative h-10 rounded-[8px] border border-[#dfe7ef] bg-white">
                      <div
                        className="absolute top-1/2 flex h-7 -translate-y-1/2 items-center justify-center rounded-[7px] px-2 text-[11px] font-black text-white"
                        style={{ left: `${left}%`, width: `${width}%`, backgroundColor: usage.color }}
                      >
                        <span className="truncate">{usage.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={compact ? "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" : "max-h-[360px] space-y-2 overflow-y-auto pr-1"}>
          {activeLanes.map((lane) => {
            const usage = config.usage[lane.code] ?? { label: lane.label, startMeter: 0, endMeter: poolLength, color: lane.color };
            return (
              <div key={lane.code} className={compact ? "w-[220px] shrink-0 rounded-[8px] border border-[#dfe7ef] bg-white p-3" : "rounded-[8px] border border-[#dfe7ef] bg-white p-3"}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-black text-[#102940]">{lane.label}</p>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: usage.color }} />
                </div>
                <Input value={usage.label} onChange={(event) => updateUsage(lane.code, { label: event.target.value })} className="mb-2 h-8 text-[12px] font-bold" aria-label={`${lane.label} 使用名稱`} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min={0} max={poolLength} value={usage.startMeter} onChange={(event) => updateUsage(lane.code, { startMeter: Math.max(0, Math.min(poolLength, Number(event.target.value))) })} className="h-8 text-[12px] font-bold" aria-label={`${lane.label} 起點公尺`} />
                  <Input type="number" min={0} max={poolLength} value={usage.endMeter} onChange={(event) => updateUsage(lane.code, { endMeter: Math.max(0, Math.min(poolLength, Number(event.target.value))) })} className="h-8 text-[12px] font-bold" aria-label={`${lane.label} 終點公尺`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SupervisorPanel>
  );
}

interface RentalDialogProps {
  state: DialogState;
  onClose: () => void;
  onCreate: (input: { laneCode: string; startTime: string; endTime: string; renterName: string; renterContact?: string; note?: string }) => void;
  onUpdate: (id: number, patch: { renterName?: string; renterContact?: string; note?: string; startTime?: string; endTime?: string }) => void;
  onDelete: (id: number) => void;
  isPending: boolean;
  slots: Array<{ start: string; end: string }>;
}

function RentalDialog({ state, onClose, onCreate, onUpdate, onDelete, isPending, slots }: RentalDialogProps) {
  const isEdit = state.mode === "edit";
  const [renterName, setRenterName] = useState(state.rental?.renterName ?? "");
  const [renterContact, setRenterContact] = useState(state.rental?.renterContact ?? "");
  const [note, setNote] = useState(state.rental?.note ?? "");
  const [startTime, setStartTime] = useState(state.startTime);
  const [endTime, setEndTime] = useState(state.endTime);

  const startOptions = slots.map((s) => s.start);
  const endOptions = slots.map((s) => s.end);

  const handleSubmit = () => {
    if (!renterName.trim()) return;
    if (startTime >= endTime) return;
    if (isEdit && state.rental) {
      onUpdate(state.rental.id, {
        renterName: renterName.trim(),
        renterContact: renterContact || undefined,
        note: note || undefined,
        startTime,
        endTime,
      });
    } else {
      onCreate({
        laneCode: state.laneCode,
        startTime,
        endTime,
        renterName: renterName.trim(),
        renterContact: renterContact || undefined,
        note: note || undefined,
      });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent data-testid="dialog-rental">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "編輯租借" : "新增租借"} · 水道 {state.laneCode}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rental-start" className="text-xs">開始時間</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="rental-start" data-testid="select-start-time"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {startOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rental-end" className="text-xs">結束時間</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="rental-end" data-testid="select-end-time"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {endOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="rental-name" className="text-xs">承租人 *</Label>
            <Input
              id="rental-name"
              value={renterName}
              onChange={(e) => setRenterName(e.target.value)}
              placeholder="例：王小明 / 潛水社"
              data-testid="input-renter-name"
            />
          </div>
          <div>
            <Label htmlFor="rental-contact" className="text-xs">聯絡方式</Label>
            <Input
              id="rental-contact"
              value={renterContact}
              onChange={(e) => setRenterContact(e.target.value)}
              placeholder="電話 / Email"
              data-testid="input-renter-contact"
            />
          </div>
          <div>
            <Label htmlFor="rental-note" className="text-xs">備註</Label>
            <Textarea
              id="rental-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：自備教練、需準備浮具"
              rows={2}
              data-testid="textarea-note"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit && state.rental && (
            <Button
              variant="destructive"
              onClick={() => onDelete(state.rental!.id)}
              disabled={isPending}
              data-testid="button-delete-rental"
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              取消租借
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isPending} data-testid="button-cancel-dialog">取消</Button>
          <Button onClick={handleSubmit} disabled={isPending || !renterName.trim() || startTime >= endTime} data-testid="button-save-rental">
            {isPending ? "處理中..." : isEdit ? "儲存" : "新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
