import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight, MapPinned, Plus, Ruler, Save, Trash2 } from "lucide-react";
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

const SLOTS: Array<{ start: string; end: string }> = (() => {
  const out: Array<{ start: string; end: string }> = [];
  let mins = 5 * 60 + 30;
  const endLimit = 22 * 60;
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  while (mins < endLimit) {
    const next = mins + 30;
    out.push({ start: fmt(mins), end: fmt(next) });
    mins = next;
  }
  return out;
})();

type LaneZone = {
  id: string;
  laneCode: string;
  label: string;
  startMeter: number;
  endMeter: number;
  color?: string | null;
};

type PoolDiagramConfig = {
  poolLength: 25 | 50;
  laneCount: number;
  zones: LaneZone[];
};

interface DialogState {
  mode: "create" | "edit";
  laneCode: string;
  zoneId: string;
  zoneLabel: string;
  startMeter: number;
  endMeter: number;
  startTime: string;
  endTime: string;
  rental?: LaneRental;
}

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

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function rangeOverlapsSlot(rental: LaneRental, slot: { start: string; end: string }): boolean {
  return timeToMin(rental.startTime) < timeToMin(slot.end) && timeToMin(slot.start) < timeToMin(rental.endTime);
}

const createDefaultDiagramConfig = (facilityKey: string): PoolDiagramConfig => {
  const poolLength = facilityKey === "songshan_pool" ? 25 : 50;
  const laneCount = facilityKey === "songshan_pool" ? 5 : 6;
  return {
    poolLength,
    laneCount,
    zones: LANE_CODES.slice(0, laneCount).map((code, index) => ({
      id: `${code}-full`,
      laneCode: code,
      label: laneLabel(code),
      startMeter: 0,
      endMeter: poolLength,
      color: laneColor(index),
    })),
  };
};

function normalizeLayout(facilityKey: string, layout?: Partial<PoolDiagramConfig> | null): PoolDiagramConfig {
  const base = createDefaultDiagramConfig(facilityKey);
  if (!layout) return base;
  const poolLength = Number(layout.poolLength) === 25 ? 25 : 50;
  const laneCount = Math.min(8, Math.max(4, Number(layout.laneCount ?? base.laneCount)));
  const zones = Array.isArray(layout.zones) && layout.zones.length
    ? layout.zones.map((zone, index) => ({
      id: zone.id || `${zone.laneCode || LANE_CODES[index] || "A"}-${index}`,
      laneCode: zone.laneCode || LANE_CODES[index] || "A",
      label: zone.label || laneLabel(zone.laneCode || LANE_CODES[index] || "A"),
      startMeter: Math.max(0, Math.min(poolLength, Number(zone.startMeter ?? 0))),
      endMeter: Math.max(1, Math.min(poolLength, Number(zone.endMeter ?? poolLength))),
      color: zone.color || laneColor(index),
    })).filter((zone) => zone.startMeter < zone.endMeter)
    : base.zones;
  return { poolLength, laneCount, zones };
}

const zoneMatchesRental = (zone: LaneZone, rental: LaneRental) =>
  rental.laneCode === zone.laneCode &&
  rangesOverlap(zone.startMeter, zone.endMeter, rental.startMeter ?? 0, rental.endMeter ?? 50);

export default function AdminLaneRentalsPage() {
  const { data: session, isLoading: sessLoading, isError: sessError } = useAuthMe();
  const allFacilityKeys = useMemo(() => Object.keys(facilityConfigs), []);
  const [facilityKey, setFacilityKey] = useState<string>("songshan_pool");
  const [date, setDate] = useState<string>(todayStr());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const { toast } = useToast();

  const layoutQ = useQuery<{ layout: PoolDiagramConfig | null }>({
    queryKey: ["/api/lane-rentals/layout", facilityKey],
    queryFn: async () => {
      const res = await fetch(`/api/lane-rentals/layout?facilityKey=${encodeURIComponent(facilityKey)}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!facilityKey,
  });
  const diagramConfig = useMemo(() => normalizeLayout(facilityKey, layoutQ.data?.layout), [facilityKey, layoutQ.data?.layout]);
  const [draftConfig, setDraftConfig] = useState<PoolDiagramConfig | null>(null);
  const activeConfig = draftConfig ?? diagramConfig;

  const activeLaneCodes = LANE_CODES.slice(0, activeConfig.laneCount);
  const activeZones = useMemo(() => (
    activeConfig.zones
      .filter((zone) => activeLaneCodes.includes(zone.laneCode))
      .sort((a, b) => activeLaneCodes.indexOf(a.laneCode) - activeLaneCodes.indexOf(b.laneCode) || a.startMeter - b.startMeter)
  ), [activeConfig.zones, activeLaneCodes]);

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
    const totalSlotHours = SLOTS.length * 0.5 * activeZones.length;
    const bookedHours = items.reduce((sum, r) => sum + (timeToMin(r.endTime) - timeToMin(r.startTime)) / 60, 0);
    return { total: totalSlotHours, booked: bookedHours, free: Math.max(0, totalSlotHours - bookedHours) };
  }, [activeZones.length, items]);

  const saveLayoutMut = useMutation({
    mutationFn: async (input: PoolDiagramConfig) => {
      const res = await apiRequest("PUT", `/api/lane-rentals/layout?facilityKey=${encodeURIComponent(facilityKey)}`, {
        facilityKey,
        poolLength: input.poolLength,
        laneCount: input.laneCount,
        zones: input.zones,
      });
      return res.json();
    },
    onSuccess: () => {
      setDraftConfig(null);
      queryClient.invalidateQueries({ queryKey: ["/api/lane-rentals/layout", facilityKey] });
      toast({ title: "已儲存水道切分" });
    },
    onError: (e: Error) => toast({ title: "儲存失敗", description: e.message, variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: async (input: {
      laneCode: string;
      zoneId: string;
      zoneLabel: string;
      startMeter: number;
      endMeter: number;
      startTime: string;
      endTime: string;
      renterName: string;
      renterContact?: string;
      note?: string;
    }) => {
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
  if (!allowed) return <SupervisorErrorState message="無瀏覽權限：此頁面僅開放給主管或系統管理員使用。" />;

  const actions = (
    <>
      <Select value={facilityKey} onValueChange={(value) => { setFacilityKey(value); setDraftConfig(null); }}>
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
      <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))} data-testid="button-prev-day"><ChevronLeft className="h-4 w-4" /></Button>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7c8998]" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} className="h-9 w-[168px] rounded-[7px] border-[#d3d8de] bg-white pl-8 text-[12px] font-bold" data-testid="input-date" />
      </div>
      <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))} data-testid="button-next-day"><ChevronRight className="h-4 w-4" /></Button>
      <Button variant="outline" onClick={() => setDate(todayStr())} data-testid="button-today">今日</Button>
    </>
  );

  return (
    <SupervisorModuleShell
      moduleId="lane-rentals"
      title="水道租借"
      eyebrow="LANE RENTALS"
      description="先切分水道區域，再點擊區域安排承租人；同水道同時間只有 meter 區間重疊才會衝突。"
      actions={actions}
      layoutMode="schedule"
    >
      <div className="mb-4 grid gap-3 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="grid grid-cols-3 gap-2 2xl:grid-cols-1">
          <SupervisorMetricCard label="總區段時數" value={`${metrics.total.toFixed(1)} 小時`} testId="metric-total" />
          <SupervisorMetricCard label="已租時數" value={`${metrics.booked.toFixed(1)} 小時`} testId="metric-booked" tone="green" />
          <SupervisorMetricCard label="空檔時數" value={`${metrics.free.toFixed(1)} 小時`} testId="metric-free" tone="muted" />
        </div>
        <LaneDiagramEditor
          config={activeConfig}
          onChange={setDraftConfig}
          onSave={() => saveLayoutMut.mutate(activeConfig)}
          isSaving={saveLayoutMut.isPending}
          onSelectZone={(zone) => setDialog({ mode: "create", laneCode: zone.laneCode, zoneId: zone.id, zoneLabel: zone.label, startMeter: zone.startMeter, endMeter: zone.endMeter, startTime: SLOTS[0].start, endTime: SLOTS[0].end })}
        />
      </div>

      {rentalsQ.isError ? (
        <div className="rounded-[8px] border border-[#ffd3da] bg-[#fff7f8] p-4 text-[13px] font-bold text-[#9f2336]" data-testid="text-lane-rental-error">
          此場館租借資料暫時無法載入；水道配置仍可先儲存。
        </div>
      ) : null}

      {rentalsQ.isLoading ? (
        <div className="grid place-items-center py-16"><DreamLoader label="載入中" compact /></div>
      ) : null}

      {!rentalsQ.isLoading && !rentalsQ.isError ? (
        <SupervisorPanel className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="sticky top-0 bg-[#f7f9fb]">
                <tr>
                  <th className="w-[88px] border-r border-[var(--supervisor-border)] px-3 py-2 text-left font-black text-[#102940]">時段</th>
                  {activeZones.map((zone) => (
                    <th key={zone.id} className="border-r border-[var(--supervisor-border)] px-3 py-2 text-center font-black text-[#102940] last:border-r-0" data-testid={`header-zone-${zone.id}`}>
                      {zone.label}
                      <span className="mt-0.5 block text-[10px] text-[#7c8998]">{zone.laneCode} · {zone.startMeter}-{zone.endMeter}m</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot, idx) => (
                  <tr key={slot.start} className={idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"}>
                    <td className="whitespace-nowrap border-r border-[var(--supervisor-border)] px-3 py-1.5 font-mono text-[11px] text-[#7c8998]">{slot.start}-{slot.end}</td>
                    {activeZones.map((zone) => {
                      const hit = items.find((r) => zoneMatchesRental(zone, r) && rangeOverlapsSlot(r, slot));
                      const isFirstSlot = hit && hit.startTime === slot.start;
                      return (
                        <td key={zone.id} className="border-r border-[var(--supervisor-border)] p-0 last:border-r-0">
                          {hit ? (
                            <button
                              type="button"
                              onClick={() => setDialog({
                                mode: "edit",
                                laneCode: hit.laneCode,
                                zoneId: hit.zoneId ?? zone.id,
                                zoneLabel: hit.zoneLabel ?? zone.label,
                                startMeter: hit.startMeter ?? zone.startMeter,
                                endMeter: hit.endMeter ?? zone.endMeter,
                                startTime: hit.startTime,
                                endTime: hit.endTime,
                                rental: hit,
                              })}
                              className="h-8 w-full border-l-2 border-[#2f9e5b] bg-[#e7f4ec] px-2 text-left text-[#165f35] transition hover:bg-[#d7eddf]"
                              data-testid={`cell-rental-${zone.id}-${slot.start}`}
                            >
                              {isFirstSlot ? <span className="block truncate text-[10px] font-bold">{hit.renterName}</span> : ""}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDialog({ mode: "create", laneCode: zone.laneCode, zoneId: zone.id, zoneLabel: zone.label, startMeter: zone.startMeter, endMeter: zone.endMeter, startTime: slot.start, endTime: slot.end })}
                              className="h-8 w-full transition hover:bg-[#e7f4ec]"
                              data-testid={`cell-empty-${zone.id}-${slot.start}`}
                              aria-label={`新增 ${zone.label} ${slot.start}-${slot.end}`}
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
      ) : null}

      {dialog ? (
        <RentalDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onCreate={(input) => createMut.mutate(input)}
          onUpdate={(id, patch) => updateMut.mutate({ id, ...patch })}
          onDelete={(id) => deleteMut.mutate(id)}
          isPending={createMut.isPending || updateMut.isPending || deleteMut.isPending}
          slots={SLOTS}
        />
      ) : null}
    </SupervisorModuleShell>
  );
}

function LaneDiagramEditor({
  config,
  onChange,
  onSave,
  onSelectZone,
  isSaving,
}: {
  config: PoolDiagramConfig;
  onChange: (next: PoolDiagramConfig) => void;
  onSave: () => void;
  onSelectZone: (zone: LaneZone) => void;
  isSaving: boolean;
}) {
  const poolLength = config.poolLength;
  const activeLaneCodes = LANE_CODES.slice(0, config.laneCount);
  const sortedZones = config.zones
    .filter((zone) => activeLaneCodes.includes(zone.laneCode))
    .sort((a, b) => activeLaneCodes.indexOf(a.laneCode) - activeLaneCodes.indexOf(b.laneCode) || a.startMeter - b.startMeter);

  const patchZone = (id: string, patch: Partial<LaneZone>) => {
    onChange({ ...config, zones: config.zones.map((zone) => zone.id === id ? { ...zone, ...patch } : zone) });
  };

  const addZone = () => {
    const laneCode = activeLaneCodes[0] ?? "A";
    const count = config.zones.filter((zone) => zone.laneCode === laneCode).length + 1;
    onChange({
      ...config,
      zones: [
        ...config.zones,
        {
          id: `${laneCode}-${Date.now()}`,
          laneCode,
          label: `${laneLabel(laneCode)} 區段 ${count}`,
          startMeter: 0,
          endMeter: Math.min(10, poolLength),
          color: laneColor(count),
        },
      ],
    });
  };

  const removeZone = (id: string) => {
    if (config.zones.length <= 1) return;
    onChange({ ...config, zones: config.zones.filter((zone) => zone.id !== id) });
  };

  return (
    <SupervisorPanel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--supervisor-border)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-[#e7f7f6] text-[#007166]">
            <MapPinned className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#007166]">SHARED LAYOUT</p>
            <h2 className="mt-1 text-[15px] font-black text-[#102940]">共享水道切分</h2>
            <p className="mt-1 text-[12px] font-bold text-[#637185]">設定會存入資料庫，主管與救生端共用同一份水道區域。</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={String(config.poolLength)} onValueChange={(value) => onChange({ ...config, poolLength: Number(value) as 25 | 50 })}>
            <SelectTrigger className="h-9 w-[132px] rounded-[7px] bg-white text-[12px] font-black"><Ruler className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 公尺</SelectItem>
              <SelectItem value="50">50 公尺</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(config.laneCount)} onValueChange={(value) => onChange({ ...config, laneCount: Number(value) })}>
            <SelectTrigger className="h-9 w-[118px] rounded-[7px] bg-white text-[12px] font-black"><SelectValue /></SelectTrigger>
            <SelectContent>{[4, 5, 6, 7, 8].map((count) => <SelectItem key={count} value={String(count)}>{count} 道</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={addZone}><Plus className="mr-2 h-4 w-4" />新增區域</Button>
          <Button onClick={onSave} disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "儲存中" : "儲存配置"}</Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-x-auto">
          <div className="min-w-[680px] rounded-[10px] border border-[#dfe7ef] bg-[#f8fbff] p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-black text-[#637185]"><span>0m 起點</span><span>{poolLength}m 終點</span></div>
            <div className="space-y-1">
              {activeLaneCodes.map((laneCode, index) => (
                <div key={laneCode} className="grid grid-cols-[76px_1fr] items-center gap-2">
                  <div className="text-[12px] font-black text-[#102940]">{laneLabel(laneCode)}</div>
                  <div className="relative h-11 rounded-[8px] border border-[#dfe7ef] bg-white">
                    {sortedZones.filter((zone) => zone.laneCode === laneCode).map((zone) => {
                      const left = Math.max(0, Math.min(100, (zone.startMeter / poolLength) * 100));
                      const width = Math.max(5, Math.min(100 - left, ((zone.endMeter - zone.startMeter) / poolLength) * 100));
                      return (
                        <button
                          key={zone.id}
                          type="button"
                          onClick={() => onSelectZone(zone)}
                          className="absolute top-1/2 flex h-8 -translate-y-1/2 items-center justify-center rounded-[7px] px-2 text-[11px] font-black text-white"
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: zone.color || laneColor(index) }}
                          data-testid={`button-zone-${zone.id}`}
                        >
                          <span className="truncate">{zone.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {sortedZones.map((zone, index) => (
            <div key={zone.id} className="rounded-[8px] border border-[#dfe7ef] bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <Select value={zone.laneCode} onValueChange={(value) => patchZone(zone.id, { laneCode: value })}>
                  <SelectTrigger className="h-8 w-[120px] text-[12px] font-black"><SelectValue /></SelectTrigger>
                  <SelectContent>{activeLaneCodes.map((code) => <SelectItem key={code} value={code}>{laneLabel(code)}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeZone(zone.id)} disabled={config.zones.length <= 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Input value={zone.label} onChange={(event) => patchZone(zone.id, { label: event.target.value })} className="mb-2 h-8 text-[12px] font-bold" aria-label={`${zone.label} 名稱`} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min={0} max={poolLength} value={zone.startMeter} onChange={(event) => patchZone(zone.id, { startMeter: Math.max(0, Math.min(poolLength, Number(event.target.value))) })} className="h-8 text-[12px] font-bold" aria-label={`${zone.label} 起點公尺`} />
                <Input type="number" min={0} max={poolLength} value={zone.endMeter} onChange={(event) => patchZone(zone.id, { endMeter: Math.max(0, Math.min(poolLength, Number(event.target.value))) })} className="h-8 text-[12px] font-bold" aria-label={`${zone.label} 終點公尺`} />
              </div>
              <Input value={zone.color || laneColor(index)} onChange={(event) => patchZone(zone.id, { color: event.target.value })} className="mt-2 h-8 text-[12px] font-bold" aria-label={`${zone.label} 色碼`} />
            </div>
          ))}
        </div>
      </div>
    </SupervisorPanel>
  );
}

interface RentalDialogProps {
  state: DialogState;
  onClose: () => void;
  onCreate: (input: {
    laneCode: string;
    zoneId: string;
    zoneLabel: string;
    startMeter: number;
    endMeter: number;
    startTime: string;
    endTime: string;
    renterName: string;
    renterContact?: string;
    note?: string;
  }) => void;
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

  const handleSubmit = () => {
    if (!renterName.trim() || startTime >= endTime) return;
    if (isEdit && state.rental) {
      onUpdate(state.rental.id, { renterName: renterName.trim(), renterContact: renterContact || undefined, note: note || undefined, startTime, endTime });
    } else {
      onCreate({
        laneCode: state.laneCode,
        zoneId: state.zoneId,
        zoneLabel: state.zoneLabel,
        startMeter: state.startMeter,
        endMeter: state.endMeter,
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
          <DialogTitle>{isEdit ? "編輯租借" : "新增租借"} · {state.zoneLabel}</DialogTitle>
        </DialogHeader>
        <div className="rounded-[8px] bg-[#f7f9fb] px-3 py-2 text-[12px] font-bold text-[#536175]">
          {state.laneCode} · {state.startMeter}-{state.endMeter}m
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rental-start" className="text-xs">開始時間</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="rental-start" data-testid="select-start-time"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">{slots.map((s) => <SelectItem key={s.start} value={s.start}>{s.start}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rental-end" className="text-xs">結束時間</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="rental-end" data-testid="select-end-time"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">{slots.map((s) => <SelectItem key={s.end} value={s.end}>{s.end}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="rental-name" className="text-xs">承租人 *</Label>
            <Input id="rental-name" value={renterName} onChange={(e) => setRenterName(e.target.value)} placeholder="例：王小明 / 潛水社" data-testid="input-renter-name" />
          </div>
          <div>
            <Label htmlFor="rental-contact" className="text-xs">聯絡方式</Label>
            <Input id="rental-contact" value={renterContact} onChange={(e) => setRenterContact(e.target.value)} placeholder="電話 / Email" data-testid="input-renter-contact" />
          </div>
          <div>
            <Label htmlFor="rental-note" className="text-xs">備註</Label>
            <Textarea id="rental-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：自備教練、需準備浮具" rows={2} data-testid="textarea-note" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {isEdit && state.rental ? (
            <Button variant="destructive" onClick={() => onDelete(state.rental!.id)} disabled={isPending} data-testid="button-delete-rental" className="mr-auto">
              <Trash2 className="mr-1 h-4 w-4" />
              取消租借
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={isPending} data-testid="button-cancel-dialog">取消</Button>
          <Button onClick={handleSubmit} disabled={isPending || !renterName.trim() || startTime >= endTime} data-testid="button-save-rental">
            {isPending ? "處理中..." : isEdit ? "儲存" : "新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
