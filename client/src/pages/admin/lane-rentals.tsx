import { useMemo, useState } from "react";
import { Redirect } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Waves, ChevronLeft, ChevronRight, Calendar, Trash2 } from "lucide-react";
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

const LANES: Array<{ code: "A" | "B" | "C" | "D" | "E"; label: string }> = [
  { code: "A", label: "水道 A" },
  { code: "B", label: "潛水租借水道 B" },
  { code: "C", label: "水道 C" },
  { code: "D", label: "水道 D" },
  { code: "E", label: "水道 E" },
];

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
  laneCode: "A" | "B" | "C" | "D" | "E";
  startTime: string;
  endTime: string;
  rental?: LaneRental;
}

export default function AdminLaneRentalsPage() {
  const { data: session, isLoading: sessLoading, isError: sessError } = useAuthMe();
  const allFacilityKeys = useMemo(() => Object.keys(facilityConfigs), []);
  const [facilityKey, setFacilityKey] = useState<string>("songshan_pool");
  const [date, setDate] = useState<string>(todayStr());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const { toast } = useToast();

  const isSongshan = facilityKey === "songshan_pool";

  const rentalsQ = useQuery<{ items: LaneRental[] }>({
    queryKey: ["/api/lane-rentals", facilityKey, date],
    queryFn: async () => {
      const res = await fetch(`/api/lane-rentals?facilityKey=${encodeURIComponent(facilityKey)}&date=${date}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!facilityKey && isSongshan,
  });

  const items = rentalsQ.data?.items ?? [];

  const metrics = useMemo(() => {
    const totalSlotHours = SLOTS.length * 0.5 * LANES.length;
    const bookedHours = items.reduce((sum, r) => sum + (timeToMin(r.endTime) - timeToMin(r.startTime)) / 60, 0);
    return {
      total: totalSlotHours,
      booked: bookedHours,
      free: Math.max(0, totalSlotHours - bookedHours),
    };
  }, [items]);

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

  if (sessLoading) {
    return <div className="grid h-full place-items-center"><DreamLoader label="權限驗證中" /></div>;
  }
  if (sessError || !session) return <Redirect to="/login" />;
  const allowed = session.grantedRoles?.includes("supervisor") || session.grantedRoles?.includes("system");
  if (!allowed) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center space-y-3" data-testid="text-no-permission">
          <p className="text-lg font-bold">無瀏覽權限</p>
          <p className="text-sm text-muted-foreground">此頁面僅開放給主管或系統管理員使用。</p>
        </div>
      </div>
    );
  }

  // Build a lookup: laneCode → rentals on that lane
  const rentalsByLane: Record<string, LaneRental[]> = {};
  for (const r of items) {
    if (!rentalsByLane[r.laneCode]) rentalsByLane[r.laneCode] = [];
    rentalsByLane[r.laneCode].push(r);
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">水道租借管理 · LANE RENTALS</p>
              <h1 className="text-xl font-bold mt-0.5 flex items-center gap-2" data-testid="text-page-title">
                <Waves className="h-5 w-5 text-primary" />
                水道租借
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={facilityKey} onValueChange={setFacilityKey}>
                <SelectTrigger className="w-[260px]" data-testid="select-lane-rental-facility">
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
                <Calendar className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || todayStr())}
                  className="pl-8 w-[170px]"
                  data-testid="input-date"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))} data-testid="button-next-day">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setDate(todayStr())} data-testid="button-today">今日</Button>
            </div>
          </div>

          {isSongshan && (
            <div className="grid grid-cols-3 gap-3 mt-4 max-w-2xl">
              <MetricCard label="總時數" value={`${metrics.total.toFixed(1)} 小時`} testId="metric-total" />
              <MetricCard label="已租時數" value={`${metrics.booked.toFixed(1)} 小時`} testId="metric-booked" tone="primary" />
              <MetricCard label="空檔時數" value={`${metrics.free.toFixed(1)} 小時`} testId="metric-free" tone="muted" />
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {!isSongshan && (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-12 text-center" data-testid="text-only-songshan">
            <Waves className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-base font-bold">目前僅松山國小開放</p>
            <p className="text-sm text-muted-foreground mt-1">水道租借管理目前僅針對松山國小室內溫水游泳池。請於上方切換場館。</p>
          </div>
        )}

        {isSongshan && rentalsQ.isLoading && (
          <div className="grid place-items-center py-16"><DreamLoader label="載入中" compact /></div>
        )}

        {isSongshan && !rentalsQ.isLoading && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold w-[88px] border-r border-border">時段</th>
                    {LANES.map((l) => (
                      <th key={l.code} className="px-3 py-2 text-center font-bold border-r border-border last:border-r-0" data-testid={`header-lane-${l.code}`}>
                        {l.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map((slot, idx) => (
                    <tr key={slot.start} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground border-r border-border whitespace-nowrap">
                        {slot.start}-{slot.end}
                      </td>
                      {LANES.map((lane) => {
                        const onLane = rentalsByLane[lane.code] || [];
                        const hit = onLane.find((r) => rangeOverlapsSlot(r, slot));
                        // Show renter name only on the first slot of the rental
                        const isFirstSlot = hit && hit.startTime === slot.start;
                        return (
                          <td key={lane.code} className="border-r border-border last:border-r-0 p-0">
                            {hit ? (
                              <button
                                type="button"
                                onClick={() => setDialog({ mode: "edit", laneCode: lane.code, startTime: hit.startTime, endTime: hit.endTime, rental: hit })}
                                className="w-full h-7 px-2 text-left bg-emerald-100 hover:bg-emerald-200 text-emerald-900 transition border-l-2 border-emerald-500"
                                data-testid={`cell-rental-${lane.code}-${slot.start}`}
                              >
                                {isFirstSlot ? <span className="text-[10px] font-bold truncate block">{hit.renterName}</span> : ""}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDialog({ mode: "create", laneCode: lane.code, startTime: slot.start, endTime: slot.end })}
                                className="w-full h-7 hover:bg-primary/10 transition"
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
          </div>
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
    </div>
  );
}

function MetricCard({ label, value, testId, tone }: { label: string; value: string; testId: string; tone?: "primary" | "muted" }) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3" data-testid={testId}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</p>
    </div>
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
